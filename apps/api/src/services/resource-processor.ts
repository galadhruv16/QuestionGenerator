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
    const timeoutId = setTimeout(() => controller.abort(), 15000);

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
      console.warn(
        `[resource-processor] Embedding request returned status ${response.status}`,
      );
      return null;
    }

    const payload = (await response.json()) as { embedding?: number[] };
    return payload.embedding ?? null;
  } catch (err) {
    console.warn(
      '[resource-processor] Embedding generation failed or timed out:',
      err,
    );
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

  console.log(
    `[resource-processor] Starting processing run ${runId} for resource ${resourceId}`,
  );

  const updateRun = async (
    updates: Record<string, unknown>,
    status?: string,
  ) => {
    const payload: Record<string, unknown> = { ...updates };
    if (status) payload.status = status;
    const { error } = await client
      .from('resource_processing_runs')
      .update(payload)
      .eq('id', runId);
    if (error) {
      console.error(
        `[resource-processor] Failed to update run ${runId}:`,
        error,
      );
    }
  };

  const updateResource = async (
    updates: Record<string, unknown>,
    status?: string,
  ) => {
    const payload: Record<string, unknown> = { ...updates };
    if (status) payload.status = status;
    const { error } = await client
      .from('resources')
      .update(payload)
      .eq('id', resourceId);
    if (error) {
      console.error(
        `[resource-processor] Failed to update resource ${resourceId}:`,
        error,
      );
    }
  };

  try {
    // 1. Download file from Supabase Storage
    await updateRun({ metadata: { stage: 'DOWNLOADING_FILE' } });
    console.log(
      `[resource-processor] Downloading file from storage: ${storagePath}`,
    );

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
    console.log(
      `[resource-processor] Extracting pages from PDF buffer (${buffer.length} bytes)...`,
    );
    const { pages, totalPages } = await extractPagesFromPdf(buffer);

    const totalExtractedChars = pages.reduce(
      (sum, p) => sum + p.text.length,
      0,
    );

    console.log(
      `[resource-processor] Extraction completed: ${totalPages} pages, ${totalExtractedChars} text characters`,
    );

    // Scanned document detection: non-extractable text
    if (
      totalExtractedChars < 50 ||
      totalExtractedChars / (totalPages || 1) < 10
    ) {
      const scannedError =
        'Scanned or image-only document detected. No extractable digital text layers found. GroundQ V1 requires digital PDFs with selectable text (OCR is not supported in V1).';
      console.warn(
        `[resource-processor] Resource ${resourceId} rejected: ${scannedError}`,
      );
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
    console.log(
      `[resource-processor] Generated ${chunks.length} page-bounded chunks`,
    );

    // 4. Generate embeddings and persist chunks
    await updateRun({ metadata: { stage: 'EMBEDDING' } });

    for (const chunk of chunks) {
      const embedding = await getEmbedding(chunk.text);

      const { error: insertError } = await client
        .from('resource_chunks')
        .insert({
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

      if (insertError) {
        throw new Error(
          `Failed to insert chunk ${chunk.chunkIndex}: ${insertError.message}`,
        );
      }
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
    console.log(
      `[resource-processor] Pipeline completed successfully for resource ${resourceId}`,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown processing error';
    console.error(
      `[resource-processor] Pipeline failed for resource ${resourceId}:`,
      error,
    );

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
