import type { SupabaseClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';
import { env } from '../config/env.js';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ChunkItem {
  chunkIndex: number;
  pageNumber: number;
  text: string;
  tokenCount: number;
}

/**
 * Extracts page-by-page text from a PDF buffer.
 */
export async function extractPagesFromPdf(buffer: Buffer): Promise<{
  pages: ExtractedPage[];
  totalPages: number;
}> {
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    const pages: ExtractedPage[] = textResult.pages.map((p) => ({
      pageNumber: p.num,
      text: p.text.trim(),
    }));

    return {
      pages,
      totalPages: textResult.total,
    };
  } finally {
    await parser.destroy();
  }
}

/**
 * Splits extracted pages into page-bounded semantic chunks.
 */
export function chunkPages(
  pages: ExtractedPage[],
  targetChunkChars = 1200,
  overlapChars = 200,
): ChunkItem[] {
  const chunks: ChunkItem[] = [];
  let globalIndex = 0;

  for (const page of pages) {
    const text = page.text.trim();
    if (!text) continue;

    if (text.length <= targetChunkChars) {
      chunks.push({
        chunkIndex: globalIndex++,
        pageNumber: page.pageNumber,
        text,
        tokenCount: Math.ceil(text.length / 4),
      });
      continue;
    }

    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + targetChunkChars, text.length);
      const chunkText = text.substring(start, end).trim();

      if (chunkText.length > 0) {
        chunks.push({
          chunkIndex: globalIndex++,
          pageNumber: page.pageNumber,
          text: chunkText,
          tokenCount: Math.ceil(chunkText.length / 4),
        });
      }

      if (end >= text.length) break;
      start += targetChunkChars - overlapChars;
    }
  }

  return chunks;
}

/**
 * Computes embedding vector using local Ollama instance.
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(`${env.OLLAMA_BASE_URL}/api/embeddings`, {
      body: JSON.stringify({
        model: env.EMBEDDING_MODEL,
        prompt: text,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { embedding?: number[] };
    return payload.embedding ?? null;
  } catch {
    return null;
  }
}

interface ProcessResourceOptions {
  client: SupabaseClient;
  projectId: string;
  resourceId: string;
  runId: string;
  storagePath: string;
}

/**
 * Runs the end-to-end extraction, chunking, and embedding pipeline.
 */
export async function processResourcePipeline(
  options: ProcessResourceOptions,
): Promise<void> {
  const { client, projectId, resourceId, runId, storagePath } = options;

  const updateRun = async (
    updates: Record<string, unknown>,
    status?: string,
  ) => {
    const payload: Record<string, unknown> = { ...updates };
    if (status) payload.status = status;
    await client
      .from('resource_processing_runs')
      .update(payload)
      .eq('id', runId);
  };

  const updateResource = async (
    updates: Record<string, unknown>,
    status?: string,
  ) => {
    const payload: Record<string, unknown> = { ...updates };
    if (status) payload.status = status;
    await client.from('resources').update(payload).eq('id', resourceId);
  };

  try {
    // 1. Download file from Supabase Storage
    await updateRun({ metadata: { stage: 'DOWNLOADING_FILE' } });

    const bucketObjectKey = storagePath.startsWith('resources/')
      ? storagePath.slice('resources/'.length)
      : storagePath;

    const { data: blob, error: downloadError } = await client.storage
      .from('resources')
      .download(bucketObjectKey);

    if (downloadError || !blob) {
      throw new Error(
        `Failed to download resource from storage: ${downloadError?.message ?? 'Empty blob'}`,
      );
    }

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Extract text and detect scanned/image-only PDFs
    await updateRun({ metadata: { stage: 'EXTRACTING_TEXT' } });
    const { pages, totalPages } = await extractPagesFromPdf(buffer);

    const totalExtractedChars = pages.reduce(
      (sum, p) => sum + p.text.length,
      0,
    );

    // Scanned document detection: non-extractable text
    if (
      totalExtractedChars < 50 ||
      totalExtractedChars / (totalPages || 1) < 10
    ) {
      const scannedError =
        'This PDF does not contain extractable text. OCR support is not available yet.';
      await updateRun(
        {
          completed_at: new Date().toISOString(),
          error_message: scannedError,
          metadata: {
            reason: 'SCANNED_DOCUMENT',
            stage: 'EXTRACTING_TEXT',
            total_chars: totalExtractedChars,
            total_pages: totalPages,
          },
        },
        'FAILED',
      );
      await updateResource({ page_count: totalPages }, 'FAILED');
      return;
    }

    // 3. Chunk page text
    await updateRun({ metadata: { stage: 'CHUNKING' } });
    const chunks = chunkPages(pages);

    // 4. Generate embeddings and persist chunks
    await updateRun({ metadata: { stage: 'EMBEDDING' } });

    for (const chunk of chunks) {
      const embedding = await getEmbedding(chunk.text);

      await client.from('resource_chunks').insert({
        chunk_index: chunk.chunkIndex,
        embedding: embedding ?? undefined,
        metadata: {
          char_length: chunk.text.length,
        },
        page_number: chunk.pageNumber,
        processing_run_id: runId,
        project_id: projectId,
        resource_id: resourceId,
        text: chunk.text,
        token_count: chunk.tokenCount,
      });
    }

    // 5. Finalize processing run and resource state
    const completedAt = new Date().toISOString();
    await updateRun(
      {
        chunking_version: 'page-sliding-v1',
        completed_at: completedAt,
        embedding_model: env.EMBEDDING_MODEL,
        metadata: {
          chunk_count: chunks.length,
          page_count: totalPages,
          stage: 'COMPLETED',
          total_chars: totalExtractedChars,
        },
        parser_version: 'pdf-parse-v1',
      },
      'READY',
    );

    await updateResource(
      {
        page_count: totalPages,
      },
      'READY',
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown processing error';

    await updateRun(
      {
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
        metadata: { stage: 'FAILED' },
      },
      'FAILED',
    );

    await updateResource({}, 'FAILED');
  }
}
