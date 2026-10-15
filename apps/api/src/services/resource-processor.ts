import type { SupabaseClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';
import { env } from '../config/env.js';
import { extractPagesFromDocx, extractPagesFromPptx } from './office-extractor.js';
import {
  countPdfPagesFromBuffer,
  transcribeImageWithVision,
  transcribePdfWithVision,
} from './multimodal-transcriber.js';

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
/**
 * Computes 768-dimensional embedding vector using Google Gemini text-embedding-004 (cloud)
 * with graceful fallback to local Ollama.
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  // 1. Cloud-native path: Use Google Gemini API text-embedding-004 (768 dimensions)
  const apiKey = env.GEMINI_API_KEY ? env.GEMINI_API_KEY.trim() : undefined;
  if (apiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
      const response = await fetch(url, {
        body: JSON.stringify({
          content: {
            parts: [{ text }],
          },
          model: 'models/text-embedding-004',
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (response.ok) {
        const payload = (await response.json()) as {
          embedding?: { values?: number[] };
        };
        if (payload.embedding?.values && payload.embedding.values.length > 0) {
          return payload.embedding.values;
        }
      } else {
        console.warn(
          `[resource-processor] Gemini embedding returned HTTP ${response.status}`,
        );
      }
    } catch (err) {
      console.warn('[resource-processor] Gemini embedding failed:', err);
    }
  }

  // 2. Offline fallback: Local Ollama embedding instance
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

    // 2. Fetch resource details for format-specific routing
    const { data: resourceRecord } = await client
      .from('resources')
      .select('file_extension, mime_type, original_filename')
      .eq('id', resourceId)
      .maybeSingle();

    const fileExt = (
      resourceRecord?.file_extension ||
      storagePath.split('.').pop() ||
      ''
    ).toLowerCase();
    const mimeType = (resourceRecord?.mime_type || '').toLowerCase();

    let pages: ExtractedPage[] = [];
    let totalPages = 0;
    let parserVersion = 'pdf-parse-v1';
    let ocrApplied = false;

    if (
      fileExt === 'pptx' ||
      fileExt === 'ppt' ||
      mimeType.includes('presentation')
    ) {
      await updateRun({ metadata: { stage: 'PARSING_PRESENTATION' } });
      console.log(
        `[resource-processor] Extracting slides from presentation (${buffer.length} bytes)...`,
      );
      const presResult = extractPagesFromPptx(buffer);
      pages = presResult.pages;
      totalPages = presResult.totalPages;
      parserVersion = 'pptx-slide-parser-v1';
    } else if (
      fileExt === 'docx' ||
      fileExt === 'doc' ||
      mimeType.includes('wordprocessingml')
    ) {
      await updateRun({ metadata: { stage: 'PARSING_DOCX' } });
      console.log(
        `[resource-processor] Extracting text from Word document (${buffer.length} bytes)...`,
      );
      const docResult = extractPagesFromDocx(buffer);
      pages = docResult.pages;
      totalPages = docResult.totalPages;
      parserVersion = 'docx-parser-v1';
    } else if (
      ['png', 'jpg', 'jpeg', 'webp'].includes(fileExt) ||
      mimeType.startsWith('image/')
    ) {
      await updateRun({ metadata: { stage: 'TRANSCRIBING_IMAGE_VISION' } });
      console.log(
        `[resource-processor] Extracting handwritten notes & diagrams from image (${buffer.length} bytes)...`,
      );
      const effectiveMime = mimeType.startsWith('image/')
        ? mimeType
        : `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
      const imageResult = await transcribeImageWithVision(
        buffer,
        effectiveMime,
      );
      pages = imageResult.pages;
      totalPages = imageResult.totalPages;
      parserVersion = 'gemini-vision-image-v1';
      ocrApplied = true;
    } else {
      // PDF processing: extract selectable text layer first
      await updateRun({ metadata: { stage: 'EXTRACTING_TEXT' } });
      console.log(
        `[resource-processor] Extracting pages from PDF buffer (${buffer.length} bytes)...`,
      );
      const digitalResult = await extractPagesFromPdf(buffer);
      const digitalChars = digitalResult.pages.reduce(
        (sum, p) => sum + p.text.length,
        0,
      );

      console.log(
        `[resource-processor] Digital text extraction result: ${digitalResult.totalPages} pages, ${digitalChars} characters`,
      );

      // Check if document is scanned or has non-selectable/handwritten text
      if (
        digitalChars < 50 ||
        digitalChars / (digitalResult.totalPages || 1) < 10
      ) {
        console.log(
          `[resource-processor] Scanned or handwritten PDF detected (${digitalChars} digital chars). Engaging Gemini Multimodal Vision OCR...`,
        );
        await updateRun({
          metadata: {
            reason: 'SCANNED_OR_HANDWRITTEN_PDF',
            stage: 'OCR_VISION_TRANSCRIBING',
          },
        });

        try {
          const effectiveTotalPages =
            digitalResult.totalPages > 0
              ? digitalResult.totalPages
              : countPdfPagesFromBuffer(buffer);

          const visionResult = await transcribePdfWithVision(buffer, {
            onProgress: async (p) => {
              await updateRun({
                metadata: {
                  current_window: p.currentWindow,
                  pages_transcribed: p.processedPages,
                  progress_percent: p.progressPercent,
                  reason: 'SCANNED_OR_HANDWRITTEN_PDF',
                  stage: 'OCR_VISION_TRANSCRIBING',
                  total_pages: p.totalPages,
                },
              });
            },
            totalPages: effectiveTotalPages,
          });

          if (
            visionResult.pages.length > 0 &&
            visionResult.pages.some((p) => p.text.length > 20)
          ) {
            pages = visionResult.pages;
            totalPages = visionResult.totalPages;
            parserVersion = 'gemini-vision-multimodal-v1';
            ocrApplied = true;
          } else {
            throw new Error(
              'Gemini Vision OCR returned empty text from scanned document.',
            );
          }
        } catch (visionErr) {
          console.warn(
            `[resource-processor] Vision OCR transcription failed:`,
            visionErr,
          );
          if (digitalResult.pages.length > 0 && digitalChars > 0) {
            pages = digitalResult.pages;
            totalPages = digitalResult.totalPages;
            parserVersion = 'pdf-parse-v1 (partial)';
          } else {
            throw new Error(
              `Non-selectable or handwritten PDF could not be transcribed. OCR Error: ${visionErr instanceof Error ? visionErr.message : String(visionErr)}`,
            );
          }
        }
      } else {
        pages = digitalResult.pages;
        totalPages = digitalResult.totalPages;
        parserVersion = 'pdf-parse-v1';
      }
    }

    const totalExtractedChars = pages.reduce(
      (sum, p) => sum + p.text.length,
      0,
    );

    if (pages.length === 0 || totalExtractedChars === 0) {
      throw new Error(
        'Document processing produced no extractable text, handwritten notes, or diagrams.',
      );
    }

    console.log(
      `[resource-processor] Extraction completed via ${parserVersion}: ${totalPages} pages/slides, ${totalExtractedChars} characters (OCR: ${ocrApplied})`,
    );

    // 3. Chunk page text
    await updateRun({ metadata: { stage: 'CHUNKING' } });
    const chunks = chunkPages(pages);
    console.log(
      `[resource-processor] Generated ${chunks.length} page-bounded chunks`,
    );

    // 4. Generate embeddings with bounded concurrency (concurrency = 4)
    await updateRun({
      metadata: {
        embedded_chunks: 0,
        progress_percent: 0,
        stage: 'EMBEDDING',
        total_chunks: chunks.length,
      },
    });

    const CONCURRENCY = 4;
    let completedEmbeddings = 0;
    const embeddings = new Array<number[] | null>(chunks.length);
    let nextIdx = 0;

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, chunks.length) },
      async () => {
        while (nextIdx < chunks.length) {
          const idx = nextIdx++;
          const chunk = chunks[idx]!;
          embeddings[idx] = await getEmbedding(chunk.text);
          completedEmbeddings++;

          if (
            completedEmbeddings % 25 === 0 ||
            completedEmbeddings === chunks.length
          ) {
            await updateRun({
              metadata: {
                embedded_chunks: completedEmbeddings,
                progress_percent: Math.round(
                  (completedEmbeddings / chunks.length) * 100,
                ),
                stage: 'EMBEDDING',
                total_chunks: chunks.length,
              },
            });
          }
        }
      },
    );
    await Promise.all(workers);

    // 5. Batch insert chunks in batches of 50 to optimize database round-trips
    await updateRun({ metadata: { stage: 'PERSISTING_CHUNKS' } });
    const chunkRows = chunks.map((chunk, idx) => ({
      chunk_index: chunk.chunkIndex,
      embedding: embeddings[idx] ?? undefined,
      metadata: {
        char_length: chunk.text.length,
      },
      page_number: chunk.pageNumber,
      processing_run_id: runId,
      project_id: projectId,
      resource_id: resourceId,
      text: chunk.text,
      token_count: chunk.tokenCount,
    }));

    const BATCH_SIZE = 50;
    for (let i = 0; i < chunkRows.length; i += BATCH_SIZE) {
      const batch = chunkRows.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await client
        .from('resource_chunks')
        .insert(batch);

      if (insertError) {
        throw new Error(
          `Failed to insert chunk batch ${i}..${i + batch.length}: ${insertError.message}`,
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
          ocr_applied: ocrApplied,
          page_count: totalPages,
          stage: 'COMPLETED',
          total_chars: totalExtractedChars,
        },
        parser_version: parserVersion,
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
