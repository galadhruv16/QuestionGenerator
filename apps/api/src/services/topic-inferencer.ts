import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { getAIProvider } from '../ai/providers/ai-provider.js';

export interface InferredSubtopic {
  description?: string;
  name: string;
}

export interface InferredModule {
  description?: string;
  name: string;
  subtopics: InferredSubtopic[];
}

export interface InferenceResult {
  chunkCount: number;
  modelUsed: string;
  modules: InferredModule[];
}

const DISALLOWED_BRANDS = new Set([
  'microsoft word',
  'mozilla firefox',
  'lotus notes',
  'libreoffice',
  'adobe acrobat',
  'google chrome',
  'internet explorer',
  'safari browser',
  'word processor',
  'operating system',
  'page number',
  'table of contents',
  'all rights reserved',
  'javascript for beginners',
]);

/**
 * Extracts candidate 2-level topic hierarchy from indexed text chunks using Dual-Engine AI.
 */
export async function inferTopicsFromChunks(
  chunks: Array<{
    chunk_index: number;
    id: string;
    page_number: number | null;
    text: string;
  }>,
  model?: string,
  timeoutMs?: number,
  provider?: 'gemini' | 'ollama' | 'groq',
): Promise<InferenceResult> {
  const chosenProvider =
    provider || (env.GEMINI_API_KEY ? 'gemini' : env.GROQ_API_KEY ? 'groq' : 'ollama');
  const chosenModel =
    model ||
    (chosenProvider === 'gemini'
      ? env.GEMINI_MODEL || 'gemini-flash-lite-latest'
      : chosenProvider === 'groq'
        ? env.GROQ_MODEL || 'llama-3.3-70b-versatile'
        : env.OLLAMA_MODEL || 'qwen2.5:7b');

  if (chunks.length === 0) {
    return {
      chunkCount: 0,
      modelUsed: chosenModel,
      modules: [],
    };
  }

  // Filter out front-matter and Table of Contents chunks
  const contentChunks = chunks.filter((c) => {
    const dotCount = (c.text.match(/\.{3,}/g) || []).length;
    return dotCount < 3 && c.text.trim().length > 60;
  });
  const validChunks = contentChunks.length > 0 ? contentChunks : chunks;

  // Sample representative chunks across the full depth of the document to cover 100% of the syllabus.
  // For massive textbooks (e.g. 200–900+ chunks), scale sample limit up to 54 chunks so every module across 300 pages is captured.
  const sampleLimit = Math.min(
    validChunks.length,
    validChunks.length > 200 ? 54 : 36,
  );
  const step = Math.max(1, Math.floor(validChunks.length / sampleLimit));
  const sampledChunks: typeof validChunks = [];
  for (
    let i = 0;
    i < validChunks.length && sampledChunks.length < sampleLimit;
    i += step
  ) {
    const chunk = validChunks[i];
    if (chunk) {
      sampledChunks.push(chunk);
    }
  }

  const maxPage = Math.max(
    ...validChunks.map((c) => c.page_number || 1),
    1,
  );
  const minPage = Math.min(
    ...validChunks.map((c) => c.page_number || 1),
    1,
  );

  const contextText = sampledChunks
    .map(
      (c) =>
        `[Document Page ${c.page_number ?? 'N/A'} of ${maxPage}]\n${c.text.slice(0, 550)}`,
    )
    .join('\n\n---\n\n');

  const systemPrompt = `You are an expert academic curriculum extraction assistant.
Analyze the following course material excerpts which span the entire document from Page ${minPage} to Page ${maxPage}, and extract a natural topic hierarchy covering the FULL syllabus:
- Level 1: Overarching modules or subject chapters reflecting the core thematic divisions of the course material.
  CRITICAL RULE: The number of modules must naturally reflect the distinct subject divisions present in the document. Short documents may have 2 to 4 modules; comprehensive textbooks or extensive notes should have 5 to 10+ modules as needed to cover all subjects.
  CRITICAL: You MUST extract modules for ALL major subject areas found throughout the entire document, from early pages through to the final pages. Do NOT stop at introductory concepts (such as basic syntax or variables); ensure intermediate and later chapters are thoroughly represented.
- Level 2: Specific core technical concepts and subtopics within each module (e.g. key mechanisms, methods, architectures, or algorithms). Each module should contain 2 to 5 subtopics.

CRITICAL CONSTRAINTS:
1. Return strictly valid JSON with no markdown formatting or markdown backticks.
2. The JSON structure MUST be:
{
  "modules": [
    {
      "name": "Distinct Module Subject Name",
      "description": "Short module scope description",
      "subtopics": [
        {
          "name": "Subtopic Concept Name",
          "description": "Key assertion or definition"
        }
      ]
    }
  ]
}
3. ANTI-BRAND & ANTI-NOISE INVARIANT:
   - NEVER extract desktop application brand names such as Microsoft Word, Mozilla Firefox, Lotus Notes, LibreOffice, Adobe Acrobat, etc.
   - NEVER extract chapter title headers as concepts if they are generic book titles (e.g. "JavaScript for Beginners").
   - Exclude author names, copyright notices, and table of contents boilerplate.
4. Each parent module must have a UNIQUE, DISTINCT name based on its subject matter. Never name multiple modules identically.
5. Subtopic names must be genuine technical concepts, NOT random fragments.
6. Keep names concise, academic, and grounded exclusively in the educational content.`;

  const userPrompt = `Course material context:\n${contextText}\n\nExtract the JSON topic hierarchy:`;

  const effectiveTimeout =
    timeoutMs ?? (env.NODE_ENV === 'test' ? 50 : 60000);

  try {
    const aiProvider = getAIProvider(chosenProvider, chosenModel);
    const rawResponse = await aiProvider.generate({
      format: 'json',
      model: chosenModel,
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      temperature: 0.15,
      timeoutMs: effectiveTimeout,
    });

    let cleanedResponse = (rawResponse || '').trim();
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();
    }

    let parsed: { modules?: InferredModule[] } | null = null;
    try {
      parsed = JSON.parse(cleanedResponse) as { modules?: InferredModule[] };
    } catch {
      const lastBrace = cleanedResponse.lastIndexOf('}');
      if (lastBrace > 0) {
        try {
          parsed = JSON.parse(
            cleanedResponse.slice(0, lastBrace + 1) + '\n]}',
          ) as { modules?: InferredModule[] };
        } catch {
          // Handled below
        }
      }
    }

    const rawModules = Array.isArray(parsed?.modules)
      ? parsed!.modules.filter(
          (m) =>
            m &&
            typeof m.name === 'string' &&
            m.name.trim().length > 0 &&
            !DISALLOWED_BRANDS.has(m.name.toLowerCase().trim()),
        )
      : [];

    // Filter subtopics and ensure distinct names across modules
    const seenNames = new Set<string>();
    const modules: InferredModule[] = [];
    for (const m of rawModules) {
      const lower = m.name.toLowerCase().trim();
      if (!seenNames.has(lower) && !DISALLOWED_BRANDS.has(lower)) {
        seenNames.add(lower);
        const validSubtopics = (m.subtopics || []).filter(
          (s) =>
            s &&
            typeof s.name === 'string' &&
            s.name.trim().length > 0 &&
            !DISALLOWED_BRANDS.has(s.name.toLowerCase().trim()),
        );
        modules.push({
          ...m,
          subtopics: validSubtopics,
        });
      }
    }

    if (modules.length > 0) {
      return {
        chunkCount: chunks.length,
        modelUsed: chosenModel,
        modules,
      };
    }
    throw new Error('AI returned empty module list');
  } catch (err: unknown) {
    console.warn(
      `[TopicInferencer] Model inference (${chosenModel}) failed, using domain-grounded extractor:`,
      err instanceof Error ? err.message : String(err),
    );
    // Robust, domain-grounded extractive fallback directly from source document headings and concepts
    const fallbackModules = extractIntelligentModules(chunks);
    return {
      chunkCount: chunks.length,
      modelUsed: `${chosenModel}-extractive-grounded`,
      modules: fallbackModules,
    };
  }
}

export const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'did', 'do',
  'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having',
  'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
  'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on',
  'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should',
  'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there',
  'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we',
  'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your',
  'yours', 'yourself', 'yourselves', 'also', 'using', 'used', 'case', 'following', 'chapter', 'section', 'module', 'unit'
]);

function cleanTextString(str: string): string {
  return str
    .replace(/[\u2300-\u23FF\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\uF000-\uFFFF]/g, ' ')
    .replace(/^[•\-\*–—\s\d.:)]+/, '')
    .replace(/[.;,:\s]+$/, '')
    .trim();
}

function isValidTitle(str: string): boolean {
  if (!str) return false;
  const clean = cleanTextString(str);
  if (clean.length < 4 || clean.length > 55) return false;
  if (DISALLOWED_BRANDS.has(clean.toLowerCase())) return false;
  // Disqualify code, math, or TOC lines
  if (/[\(\)=\/{}\[\];<>\\`"']/.test(clean)) return false;
  if (/\.{2,}|…/.test(clean)) return false;
  if (/^(?:please|try again|note:|warning:|key points)/i.test(clean)) return false;
  const words = clean.split(/\s+/);
  if (words.length > 7) return false;
  // Must start with an uppercase letter
  if (!/^[A-Z]/.test(clean)) return false;
  return true;
}

export function extractDocumentKeyPhrases(text: string): string[] {
  const phraseCounts = new Map<string, number>();

  // Pattern 1: Title or section headings with strict word boundaries
  const headingMatches = text.matchAll(
    /\b(?:chapter|unit|module|section|part)\b\s*[:\s\d.]*([^\n\r.]+)/gi,
  );
  for (const m of headingMatches) {
    const raw = cleanTextString(m[1] ?? '');
    if (isValidTitle(raw) && !STOPWORDS.has(raw.toLowerCase())) {
      phraseCounts.set(raw, (phraseCounts.get(raw) || 0) + 10);
    }
  }

  // Pattern 2: Multi-word capitalized technical concepts
  const capMatches = text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g);
  for (const m of capMatches) {
    const phrase = cleanTextString(m[1] ?? '');
    if (isValidTitle(phrase) && !STOPWORDS.has(phrase.toLowerCase())) {
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 4);
    }
  }

  // Pattern 3: Common 2-word technical grams
  const words = text
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  for (let i = 0; i < words.length - 1; i++) {
    const first = words[i];
    const second = words[i + 1];
    if (first && second) {
      const bigram = `${first} ${second}`;
      phraseCounts.set(bigram, (phraseCounts.get(bigram) || 0) + 1);
    }
  }

  return Array.from(phraseCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([p]) => p);
}

/**
 * Intelligent domain extractor that derives authentic curriculum modules and subtopics
 * directly from document section headings and capitalized domain phrases.
 * Dynamically scales module count according to actual document structure and length.
 */
export function extractIntelligentModules(
  chunks: Array<{
    chunk_index: number;
    id: string;
    page_number: number | null;
    text: string;
  }>,
): InferredModule[] {
  if (!chunks || chunks.length === 0) return [];

  // Filter out front-matter / TOC chunks (chunks with lots of dots or cover page)
  const contentChunks = chunks.filter((c) => {
    const dotCount = (c.text.match(/\.{3,}/g) || []).length;
    return dotCount < 3 && c.text.length > 80;
  });

  const activeChunks = contentChunks.length > 0 ? contentChunks : chunks;

  // 1. Detect explicit structural headings in the content using strict word boundaries
  const detectedHeadings: Array<{ chunkId: string; heading: string }> = [];
  const headingRegex =
    /(?:^|\n)(?:#{1,3}\s+|(?:\d+\.?\s+)?\b(?:chapter|unit|section|part|module)\b\s*[:\s\d.]*)\s*([^\n\r.]+)/gi;

  for (const c of activeChunks) {
    for (const m of c.text.matchAll(headingRegex)) {
      const raw = (m[1] ?? '').trim();
      const clean = cleanTextString(
        raw.replace(/^(?:chapter|unit|section|part|module|\d+[.:])\s*/i, ''),
      );
      if (isValidTitle(clean) && !STOPWORDS.has(clean.toLowerCase())) {
        detectedHeadings.push({ chunkId: c.id, heading: clean });
      }
    }
  }

  // Deduplicate detected headings
  const uniqueHeadings: Array<{ chunkId: string; heading: string }> = [];
  const seenHeadings = new Set<string>();
  for (const item of detectedHeadings) {
    const lower = item.heading.toLowerCase();
    if (!seenHeadings.has(lower)) {
      seenHeadings.add(lower);
      uniqueHeadings.push(item);
    }
  }

  const globalUsedSubtopics = new Set<string>();

  const extractSubtopicsForSlice = (
    sliceChunks: typeof chunks,
    moduleTitle: string,
  ): InferredSubtopic[] => {
    const subtopics: InferredSubtopic[] = [];
    const lowerTitle = moduleTitle.toLowerCase();
    const sliceText = sliceChunks.map((c) => c.text).join('\n\n');

    // Extract bullet points from THIS module slice only
    const bulletMatches = sliceText.matchAll(/(?:^|\n)\s*[-*•]\s+([^\n\r.]+)/g);
    for (const m of bulletMatches) {
      const raw = (m[1] ?? '').trim();
      const clean = cleanTextString(raw.split(/[:–—]/)[0] || raw);
      if (isValidTitle(clean)) {
        const lower = clean.toLowerCase();
        if (!globalUsedSubtopics.has(lower) && !lowerTitle.includes(lower)) {
          globalUsedSubtopics.add(lower);
          subtopics.push({
            description: `Core principles and practical implementation of ${clean}.`,
            name: clean,
          });
          if (subtopics.length >= 3) break;
        }
      }
    }

    // Next try capitalized technical phrases from THIS slice
    if (subtopics.length < 3) {
      const capMatches = sliceText.matchAll(
        /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g,
      );
      for (const m of capMatches) {
        const phrase = cleanTextString(m[1] ?? '');
        if (isValidTitle(phrase)) {
          const lower = phrase.toLowerCase();
          if (
            !globalUsedSubtopics.has(lower) &&
            !lowerTitle.includes(lower) &&
            !STOPWORDS.has(lower)
          ) {
            globalUsedSubtopics.add(lower);
            subtopics.push({
              description: `Detailed analysis and architectural rules covering ${phrase}.`,
              name: phrase,
            });
            if (subtopics.length >= 3) break;
          }
        }
      }
    }

    if (subtopics.length === 0) {
      subtopics.push(
        {
          description: `Core conceptual definitions, architecture, and principles of ${moduleTitle}.`,
          name: `${moduleTitle} Foundations`,
        },
        {
          description: `Key algorithmic operations, best practices, and procedures in ${moduleTitle}.`,
          name: `${moduleTitle} Applied Operations`,
        },
      );
    }

    return subtopics;
  };

  const modules: InferredModule[] = [];

  if (uniqueHeadings.length >= 2) {
    // Distinct explicit headings found across the content: distribute modules evenly across the full document
    const maxModules = Math.min(
      uniqueHeadings.length,
      activeChunks.length > 100 ? 10 : activeChunks.length > 40 ? 8 : 6,
    );
    const step = (uniqueHeadings.length - 1) / Math.max(1, maxModules - 1);
    for (let i = 0; i < maxModules; i++) {
      const headingIdx = Math.round(i * step);
      const item = uniqueHeadings[headingIdx]!;
      const relevantChunks = activeChunks.filter(
        (c) =>
          c.id === item.chunkId ||
          c.text.toLowerCase().includes(item.heading.toLowerCase()),
      );
      const slice = relevantChunks.length > 0 ? relevantChunks : activeChunks;
      const subtopics = extractSubtopicsForSlice(slice, item.heading);
      modules.push({
        description: `Comprehensive curriculum module covering ${item.heading}.`,
        name: item.heading,
        subtopics,
      });
    }
  } else {
    // Dynamic segmentation: scale module count according to content length
    const numModules = Math.min(
      6,
      Math.max(1, Math.ceil(activeChunks.length / 3)),
    );
    const chunkSize = Math.max(1, Math.ceil(activeChunks.length / numModules));
    for (let i = 0; i < numModules; i++) {
      const slice = activeChunks.slice(i * chunkSize, (i + 1) * chunkSize);
      if (slice.length === 0) continue;
      const sliceText = slice.map((c) => c.text).join('\n\n');

      let sliceTitle = `Module ${i + 1}`;
      const capMatches = sliceText.matchAll(
        /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g,
      );
      for (const m of capMatches) {
        const candidate = cleanTextString(m[1] ?? '');
        if (
          isValidTitle(candidate) &&
          !seenHeadings.has(candidate.toLowerCase())
        ) {
          seenHeadings.add(candidate.toLowerCase());
          sliceTitle = candidate;
          break;
        }
      }
      const subtopics = extractSubtopicsForSlice(slice, sliceTitle);
      modules.push({
        description: `Curriculum module focused on ${sliceTitle} and associated principles.`,
        name: sliceTitle,
        subtopics,
      });
    }
  }

  return modules;
}

/**
 * Persists inferred modules and subtopics into public.topics and links them to public.chunk_topics.
 */
export async function persistInferredTopics(
  supabase: SupabaseClient,
  projectId: string,
  inference: InferenceResult,
  chunks: Array<{
    chunk_index: number;
    id: string;
    page_number: number | null;
    text: string;
  }>,
) {
  let sortOrder = 1;

  for (const mod of inference.modules) {
    // 1. Insert parent module
    const { data: parentTopic, error: parentError } = await supabase
      .from('topics')
      .insert({
        description: mod.description ?? null,
        is_active: true,
        name: mod.name,
        parent_id: null,
        project_id: projectId,
        sort_order: sortOrder++,
        source: 'INFERRED',
      })
      .select('id')
      .single();

    if (parentError || !parentTopic) continue;

    // 2. Insert subtopics
    let subOrder = 1;
    for (const sub of mod.subtopics) {
      const { data: subTopic, error: subError } = await supabase
        .from('topics')
        .insert({
          description: sub.description ?? null,
          is_active: true,
          name: sub.name,
          parent_id: parentTopic.id,
          project_id: projectId,
          sort_order: subOrder++,
          source: 'INFERRED',
        })
        .select('id')
        .single();

      if (subError || !subTopic) continue;

      // 3. Link relevant chunks to this subtopic
      const contentChunks = chunks.filter((c) => {
        const dotCount = (c.text.match(/\.{3,}/g) || []).length;
        return dotCount < 3 && c.text.trim().length > 60;
      });
      const validChunks = contentChunks.length > 0 ? contentChunks : chunks;

      const subWords = `${sub.name} ${sub.description ?? ''}`
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOPWORDS.has(w));

      let matched = validChunks.filter((c) => {
        const lower = c.text.toLowerCase();
        return subWords.some((w) => lower.includes(w));
      });

      if (matched.length === 0) {
        // Fall back to module title words
        const modWords = mod.name
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3 && !STOPWORDS.has(w));
        matched = validChunks.filter((c) => {
          const lower = c.text.toLowerCase();
          return modWords.some((w) => lower.includes(w));
        });
      }

      // Assign up to 15 chunks evenly distributed across the matching document range
      let targets: typeof chunks = [];
      if (matched.length > 0) {
        if (matched.length <= 15) {
          targets = matched;
        } else {
          const sampleCount = 15;
          const sampleStep = (matched.length - 1) / (sampleCount - 1);
          targets = [];
          for (let sIdx = 0; sIdx < sampleCount; sIdx++) {
            targets.push(matched[Math.round(sIdx * sampleStep)]!);
          }
        }
      } else {
        const modIdx = Math.max(0, sortOrder - 2);
        const sliceSize = Math.max(
          1,
          Math.floor(validChunks.length / Math.max(1, inference.modules.length)),
        );
        const modSlice = validChunks.slice(
          modIdx * sliceSize,
          (modIdx + 1) * sliceSize,
        );
        const candidateSlice = modSlice.length > 0 ? modSlice : validChunks;
        if (candidateSlice.length <= 15) {
          targets = candidateSlice;
        } else {
          const sampleCount = 15;
          const sampleStep = (candidateSlice.length - 1) / (sampleCount - 1);
          targets = [];
          for (let sIdx = 0; sIdx < sampleCount; sIdx++) {
            targets.push(candidateSlice[Math.round(sIdx * sampleStep)]!);
          }
        }
      }

      for (const targetChunk of targets) {
        await supabase.from('chunk_topics').upsert(
          {
            chunk_id: targetChunk.id,
            confidence: 0.95,
            source: 'AUTO_INFERRED',
            topic_id: subTopic.id,
          },
          { onConflict: 'chunk_id,topic_id' },
        );
      }
    }
  }
}
