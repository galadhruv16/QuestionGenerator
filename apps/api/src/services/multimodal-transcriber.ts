import { env } from '../config/env.js';
import type { ExtractedPage } from './resource-processor.js';

const CANDIDATE_VISION_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
];

interface GeminiPart {
  inline_data?: {
    data: string;
    mime_type: string;
  };
  text?: string;
}

/**
 * Calls Google Gemini generateContent API with multimodal payload.
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout for vision OCR

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1, // Low temperature for high OCR transcription accuracy
          },
          systemInstruction: systemInstruction
            ? { parts: [{ text: systemInstruction }] }
            : undefined,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.warn(
          `[MultimodalTranscriber] Model ${model} returned HTTP ${response.status}: ${errBody.slice(0, 160)}`,
        );
        lastError = new Error(
          `Gemini Vision model ${model} unavailable (HTTP ${response.status}): ${errBody.slice(0, 160)}`,
        );
        continue;
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
      console.warn(`[MultimodalTranscriber] Failed with model ${model}:`, err);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error('All candidate Gemini Vision models failed.');
}

/**
 * Splits page-delimited transcription markdown into ExtractedPage items.
 */
export function parsePageDelimitedMarkdown(rawMarkdown: string): {
  pages: ExtractedPage[];
  totalPages: number;
} {
  const pageRegex = /---\s*Page\s+(\d+)\s*---/gi;
  const matches: { index: number; pageNum: number; headerEnd: number }[] = [];

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
 * Reads handwritten notes, math formulas, printed text, and diagrams.
 */
export async function transcribePdfWithVision(buffer: Buffer): Promise<{
  pages: ExtractedPage[];
  totalPages: number;
}> {
  console.log(
    `[MultimodalTranscriber] Sending PDF (${buffer.length} bytes) to Gemini Vision for OCR & handwriting transcription...`,
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
