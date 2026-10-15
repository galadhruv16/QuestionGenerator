import { env } from '../config/env.js';
import type { ExtractedPage } from './resource-processor.js';

const CANDIDATE_VISION_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
];

export interface GeminiPart {
  file_data?: {
    file_uri: string;
    mime_type: string;
  };
  inline_data?: {
    data: string;
    mime_type: string;
  };
  text?: string;
}

export interface GeminiUploadedFile {
  mimeType: string;
  name: string;
  uri: string;
}

export interface TranscribeProgress {
  currentWindow: string;
  processedPages: number;
  progressPercent: number;
  totalPages: number;
}

export interface TranscribeOptions {
  onProgress?: (progress: TranscribeProgress) => Promise<void> | void;
  totalPages?: number;
  windowSize?: number;
}

/**
 * Uploads a large binary buffer (e.g. 20MB–100MB PDF) to the Google Gemini Files API
 * using the standard resumable upload protocol.
 */
export async function uploadToGeminiFilesApi(
  buffer: Buffer,
  mimeType: string,
  displayName = 'textbook.pdf',
): Promise<GeminiUploadedFile> {
  const apiKey = env.GEMINI_API_KEY ? env.GEMINI_API_KEY.trim() : undefined;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is required to upload large documents to the Gemini Files API.',
    );
  }

  // Step 1: Start resumable upload session
  const initUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
  const initRes = await fetch(initUrl, {
    body: JSON.stringify({
      file: {
        display_name: displayName,
      },
    }),
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(buffer.length),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'X-Goog-Upload-Protocol': 'resumable',
    },
    method: 'POST',
  });

  if (!initRes.ok) {
    const errText = await initRes.text().catch(() => '');
    throw new Error(
      `Gemini Files API upload initialization failed (HTTP ${initRes.status}): ${errText.slice(0, 200)}`,
    );
  }

  const uploadUrl = initRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    throw new Error('Gemini Files API did not return x-goog-upload-url header.');
  }

  // Step 2: Upload the binary buffer
  const uploadRes = await fetch(uploadUrl, {
    body: new Uint8Array(buffer),
    headers: {
      'Content-Length': String(buffer.length),
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
    },
    method: 'POST',
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '');
    throw new Error(
      `Gemini Files API byte upload failed (HTTP ${uploadRes.status}): ${errText.slice(0, 200)}`,
    );
  }

  const payload = (await uploadRes.json()) as {
    file?: {
      mimeType?: string;
      name?: string;
      state?: string;
      uri?: string;
    };
  };

  const file = payload.file;
  if (!file?.uri || !file?.name) {
    throw new Error(
      'Gemini Files API response did not contain expected file uri or name.',
    );
  }

  // Step 3: Wait if file state is still PROCESSING (usually instant or 1-2s for PDF)
  let state = file.state;
  let attempts = 0;
  while (state === 'PROCESSING' && attempts < 10) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    attempts++;
    try {
      const checkRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${file.name}?key=${apiKey}`,
      );
      if (checkRes.ok) {
        const checkData = (await checkRes.json()) as {
          file?: { state?: string };
        };
        state = checkData.file?.state ?? state;
      }
    } catch {
      // Keep checking
    }
  }

  return {
    mimeType: file.mimeType || mimeType,
    name: file.name,
    uri: file.uri,
  };
}

/**
 * Cleans up an uploaded file from Google Gemini Files API.
 */
export async function deleteGeminiFile(fileName: string): Promise<void> {
  const apiKey = env.GEMINI_API_KEY ? env.GEMINI_API_KEY.trim() : undefined;
  if (!apiKey || !fileName) return;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      console.warn(
        `[MultimodalTranscriber] Failed to delete Gemini file ${fileName} (HTTP ${res.status})`,
      );
    }
  } catch (err) {
    console.warn(`[MultimodalTranscriber] Cleanup error for ${fileName}:`, err);
  }
}

/**
 * Calls Google Gemini generateContent API with multimodal payload and automatic retry on 429.
 */
async function callGeminiMultimodal(
  parts: GeminiPart[],
  systemInstruction?: string,
): Promise<string> {
  const apiKey = env.GEMINI_API_KEY ? env.GEMINI_API_KEY.trim() : undefined;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured in backend environment (.env). Multimodal Vision OCR and handwriting transcription requires a valid Google Gemini API key.',
    );
  }

  const requestedModel = env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  const candidateModels = Array.from(
    new Set([requestedModel, ...CANDIDATE_VISION_MODELS]),
  );

  let lastError: Error | null = null;

  for (const model of candidateModels) {
    for (let retry = 0; retry < 3; retry++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000); // 90s timeout for vision OCR

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.1, // Low temperature for high OCR accuracy
            },
            systemInstruction: systemInstruction
              ? { parts: [{ text: systemInstruction }] }
              : undefined,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          signal: controller.signal,
        });

        if (response.status === 429) {
          console.warn(
            `[MultimodalTranscriber] Model ${model} rate limited (HTTP 429). Backing off for ${(retry + 1) * 3}s...`,
          );
          clearTimeout(timeout);
          await new Promise((r) => setTimeout(r, (retry + 1) * 3000));
          continue;
        }

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          console.warn(
            `[MultimodalTranscriber] Model ${model} returned HTTP ${response.status}: ${errBody.slice(0, 160)}`,
          );
          lastError = new Error(
            `Gemini Vision model ${model} unavailable (HTTP ${response.status}): ${errBody.slice(0, 160)}`,
          );
          break; // Break retry loop to switch candidate model
        }

        const payload = (await response.json()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
        };

        const transcribedText =
          payload.candidates?.[0]?.content?.parts
            ?.map((p) => p.text || '')
            .join('\n')
            .trim() || '';

        if (transcribedText.length > 0) {
          return transcribedText;
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          `[MultimodalTranscriber] Attempt ${retry + 1} failed with model ${model}:`,
          err,
        );
        if (retry < 2) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  throw lastError || new Error('All candidate Gemini Vision models failed.');
}

/**
 * Fast regex fallback to count pages in a PDF binary buffer.
 */
export function countPdfPagesFromBuffer(buffer: Buffer): number {
  const content = buffer.toString('binary');
  const matches = content.match(/\/Type\s*\/Page\b/g);
  if (matches && matches.length > 0) {
    return matches.length;
  }
  const countMatch = content.match(/\/Count\s+(\d+)/);
  if (countMatch && countMatch[1]) {
    const parsed = parseInt(countMatch[1], 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 1;
}

/**
 * Computes sliding page windows for batching.
 * e.g., 300 pages with windowSize 10 produces 30 windows: [1..10], [11..20], ..., [291..300].
 */
export function calculatePageWindows(
  totalPages: number,
  windowSize = 10,
): Array<{ endPage: number; startPage: number }> {
  if (totalPages <= 0) return [];
  const windows: Array<{ endPage: number; startPage: number }> = [];
  for (let start = 1; start <= totalPages; start += windowSize) {
    const end = Math.min(start + windowSize - 1, totalPages);
    windows.push({ endPage: end, startPage: start });
  }
  return windows;
}

/**
 * Splits page-delimited transcription markdown into ExtractedPage items.
 */
export function parsePageDelimitedMarkdown(rawMarkdown: string): {
  pages: ExtractedPage[];
  totalPages: number;
} {
  const pageRegex = /---\s*Page\s+(\d+)\s*---/gi;
  const matches: { headerEnd: number; index: number; pageNum: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = pageRegex.exec(rawMarkdown)) !== null) {
    const rawPageNum = match[1];
    if (rawPageNum) {
      matches.push({
        headerEnd: match.index + match[0].length,
        index: match.index,
        pageNum: parseInt(rawPageNum, 10),
      });
    }
  }

  if (matches.length === 0) {
    // If no explicit delimiters were returned, treat whole text as page 1
    const text = rawMarkdown.trim();
    return {
      pages: text ? [{ pageNumber: 1, text }] : [],
      totalPages: text ? 1 : 0,
    };
  }

  const pages: ExtractedPage[] = [];

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    if (!current) continue;
    const nextMatch = i + 1 < matches.length ? matches[i + 1] : undefined;
    const nextStart = nextMatch ? nextMatch.index : rawMarkdown.length;
    const pageText = rawMarkdown.substring(current.headerEnd, nextStart).trim();

    if (pageText.length > 0) {
      pages.push({
        pageNumber: current.pageNum,
        text: pageText,
      });
    }
  }

  return {
    pages,
    totalPages: pages.length,
  };
}

/**
 * Transcribes a scanned or non-selectable PDF using Gemini Vision multimodal processing.
 * Scales seamlessly up to 300 pages and 100 MB via Google Gemini Files API and sliding page windows,
 * eliminating the 8,192 token output ceiling and inline base64 memory constraints.
 */
export async function transcribePdfWithVision(
  buffer: Buffer,
  options: TranscribeOptions = {},
): Promise<{
  pages: ExtractedPage[];
  totalPages: number;
}> {
  const windowSize = options.windowSize || 10;
  const totalPages =
    options.totalPages && options.totalPages > 0
      ? options.totalPages
      : countPdfPagesFromBuffer(buffer);

  console.log(
    `[MultimodalTranscriber] Preparing PDF transcription (${buffer.length} bytes, ~${totalPages} pages, window size ${windowSize})...`,
  );

  // Single-window fast path if document is small enough to fit within Gemini's 8,192 token limit and inline base64 limit
  if (totalPages <= windowSize && buffer.length <= 15 * 1024 * 1024) {
    console.log(
      `[MultimodalTranscriber] Document fits in single window (${totalPages} pages <= ${windowSize}). Transcribing inline...`,
    );
    const base64Data = buffer.toString('base64');
    const prompt =
      'You are an expert academic document transcriber.\n' +
      'Transcribe all content from this document page-by-page with high fidelity.\n' +
      'Include all printed text, handwritten notes, student annotations, mathematical formulas, and structural table content.\n' +
      "For every page, output a strict header delimiter: '--- Page X ---' (where X is the 1-based page number) followed by the complete transcription in Markdown.\n" +
      'Do not skip any pages. If a page contains a diagram or chart, provide a clear structured text description of the diagram and its key labels/relationships.';

    const rawMarkdown = await callGeminiMultimodal(
      [
        {
          inline_data: {
            data: base64Data,
            mime_type: 'application/pdf',
          },
        },
        { text: prompt },
      ],
      'You are a high-precision academic OCR and handwriting transcription engine. Reproduce all text and handwritten notes accurately without hallucination.',
    );

    return parsePageDelimitedMarkdown(rawMarkdown);
  }

  // Large document path (up to 300 pages / 100 MB): Upload once to Gemini Files API and process in sliding windows
  console.log(
    `[MultimodalTranscriber] Large document detected (${totalPages} pages, ${(buffer.length / (1024 * 1024)).toFixed(1)} MB). Uploading to Gemini Files API for multi-window transcription...`,
  );

  let uploadedFile: GeminiUploadedFile | null = null;
  let useFilesApi = false;

  try {
    uploadedFile = await uploadToGeminiFilesApi(
      buffer,
      'application/pdf',
      `document_${Date.now()}.pdf`,
    );
    useFilesApi = true;
    console.log(
      `[MultimodalTranscriber] Uploaded to Gemini Files API: ${uploadedFile.name} (${uploadedFile.uri})`,
    );
  } catch (fileApiErr) {
    console.warn(
      `[MultimodalTranscriber] Gemini Files API upload failed or unavailable:`,
      fileApiErr,
    );
    // If buffer <= 25MB, fall back to inline base64 per window
    if (buffer.length <= 25 * 1024 * 1024) {
      console.log(
        `[MultimodalTranscriber] Falling back to inline base64 per window...`,
      );
      useFilesApi = false;
    } else {
      throw new Error(
        `Gemini Files API upload failed for large ${(buffer.length / (1024 * 1024)).toFixed(1)} MB document: ${fileApiErr instanceof Error ? fileApiErr.message : String(fileApiErr)}`,
      );
    }
  }

  const windows = calculatePageWindows(totalPages, windowSize);
  const allPages: ExtractedPage[] = [];
  const base64Fallback = !useFilesApi ? buffer.toString('base64') : '';

  try {
    for (let i = 0; i < windows.length; i++) {
      const { endPage, startPage } = windows[i]!;
      console.log(
        `[MultimodalTranscriber] Transcribing Window ${i + 1}/${windows.length}: Pages ${startPage} to ${endPage}...`,
      );

      const prompt =
        'You are an expert academic document transcriber.\n' +
        `Transcribe all content ONLY from Page ${startPage} through Page ${endPage} (inclusive) of this document with high fidelity.\n` +
        'Include all printed text, handwritten notes, student annotations, mathematical formulas, and structural table content.\n' +
        `For every page in this range, output a strict header delimiter: '--- Page X ---' (where X is the exact 1-based page number) followed by the complete transcription in Markdown.\n` +
        `Do not skip any pages in the range ${startPage} through ${endPage}.\n` +
        `Do not transcribe pages outside the range ${startPage} through ${endPage}.\n` +
        'If a page contains a diagram or chart, provide a clear structured text description of the diagram and its key labels/relationships.';

      const contentPart: GeminiPart =
        useFilesApi && uploadedFile
          ? {
              file_data: {
                file_uri: uploadedFile.uri,
                mime_type: 'application/pdf',
              },
            }
          : {
              inline_data: {
                data: base64Fallback,
                mime_type: 'application/pdf',
              },
            };

      const windowMarkdown = await callGeminiMultimodal(
        [contentPart, { text: prompt }],
        'You are a high-precision academic OCR and handwriting transcription engine. Reproduce all text and handwritten notes accurately without hallucination.',
      );

      const parsedWindow = parsePageDelimitedMarkdown(windowMarkdown);

      if (parsedWindow.pages.length === 0 && windowMarkdown.trim().length > 0) {
        allPages.push({
          pageNumber: startPage,
          text: windowMarkdown.trim(),
        });
      } else {
        for (const p of parsedWindow.pages) {
          const adjustedPageNum =
            p.pageNumber < startPage || p.pageNumber > endPage
              ? startPage + (p.pageNumber - 1)
              : p.pageNumber;
          allPages.push({
            pageNumber: adjustedPageNum,
            text: p.text,
          });
        }
      }

      if (options.onProgress) {
        const progressPercent = Math.round(
          ((i + 1) / windows.length) * 100,
        );
        try {
          await options.onProgress({
            currentWindow: `${startPage}-${endPage}`,
            processedPages: allPages.length,
            progressPercent,
            totalPages,
          });
        } catch (progressErr) {
          console.warn(
            '[MultimodalTranscriber] Progress callback error:',
            progressErr,
          );
        }
      }

      // Pacing delay between windows to stay well within 15 RPM
      if (i + 1 < windows.length) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
  } finally {
    if (uploadedFile) {
      console.log(
        `[MultimodalTranscriber] Cleaning up Gemini Files API file: ${uploadedFile.name}`,
      );
      await deleteGeminiFile(uploadedFile.name);
    }
  }

  allPages.sort((a, b) => a.pageNumber - b.pageNumber);

  return {
    pages: allPages,
    totalPages: Math.max(totalPages, allPages.length),
  };
}

/**
 * Transcribes an image (PNG, JPG, WEBP) containing notes, diagrams, or handwritten text.
 */
export async function transcribeImageWithVision(
  buffer: Buffer,
  mimeType: string = 'image/png',
): Promise<{
  pages: ExtractedPage[];
  totalPages: number;
}> {
  console.log(
    `[MultimodalTranscriber] Sending Image (${buffer.length} bytes, ${mimeType}) to Gemini Vision...`,
  );

  const base64Data = buffer.toString('base64');
  const prompt =
    'You are an expert academic multimodal transcriber.\n' +
    'Transcribe all visible content from this image into clean, detailed Markdown notes suitable for syllabus grounding and question generation.\n' +
    'Include all handwritten lecture notes, whiteboard writings, formulas, and printed text with exact terminology.\n' +
    'If the image is an architecture diagram, flowchart, concept map, or technical illustration, provide a comprehensive structured breakdown explaining all components, entities, data flows, and pedagogical concepts represented in the diagram.';

  const rawMarkdown = await callGeminiMultimodal(
    [
      {
        inline_data: {
          data: base64Data,
          mime_type: mimeType,
        },
      },
      { text: prompt },
    ],
    'You are an academic multimodal transcription engine. Transcribe handwritten notes, text, and diagram architectures with extreme clarity and precision.',
  );

  const text = rawMarkdown.trim();
  return {
    pages: text ? [{ pageNumber: 1, text }] : [],
    totalPages: 1,
  };
}
