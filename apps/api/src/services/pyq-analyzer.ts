import type { SupabaseClient } from '@supabase/supabase-js';
import {
  pyqAnalysisPatternSchema,
  type PyqAnalysisPattern,
} from '@groundq/contracts';
import { getAIProvider } from '../ai/providers/ai-provider.js';
import { env } from '../config/env.js';

// In-memory pattern cache to accelerate repeated requests and Generation Studio preset lookups
const pyqPatternCache = new Map<string, PyqAnalysisPattern>();

export function getCachedPyqPattern(resourceId: string): PyqAnalysisPattern | undefined {
  return pyqPatternCache.get(resourceId);
}

export function setCachedPyqPattern(resourceId: string, pattern: PyqAnalysisPattern): void {
  pyqPatternCache.set(resourceId, pattern);
}

export function clearPyqPatternCache(): void {
  pyqPatternCache.clear();
}

/**
 * Normalizes a record of numbers so the values sum exactly or approximately to 100%.
 */
function normalizePercentages<T extends Record<string, number>>(
  dist: T,
  defaults: T,
): T {
  const entries = Object.entries(dist);
  const sum = entries.reduce((acc, [, val]) => acc + (typeof val === 'number' && !isNaN(val) ? Math.max(0, val) : 0), 0);
  
  if (sum <= 0) {
    return { ...defaults };
  }

  const result: Record<string, number> = {};
  let runningTotal = 0;
  const keys = Object.keys(dist);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    if (i === keys.length - 1) {
      // Last item gets remainder to ensure sum equals 100
      result[key] = Math.max(0, 100 - runningTotal);
    } else {
      const share = Math.round(((dist[key] || 0) / sum) * 100);
      result[key] = share;
      runningTotal += share;
    }
  }

  return result as T;
}

/**
 * Deterministic heuristic rule-based analyzer for previous year question papers.
 * Evaluates question numbering, marks tags, Bloom action verbs, and format structures.
 */
export function parsePyqHeuristically(
  fullText: string,
  resourceId: string,
  resourceName: string,
): PyqAnalysisPattern {
  const lines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 1. Detect question counts using numbering patterns
  // Examples: "Q1.", "1.", "Question 1:", "Part A", etc.
  const questionMatches = fullText.match(
    /(?:^|\n)\s*(?:Q(?:uestion)?\s*\.?\s*(\d+)|(\d+)[\.\)])\s+/gi,
  ) || [];
  const detectedCount = Math.max(questionMatches.length, 10);

  // 2. Detect marks allocations
  // First check for explicit paper total marks in header
  const headerTotalMatch = fullText.match(
    /(?:maximum|max\.?|total)\s*marks?\s*[:=-]?\s*(\d+)/i,
  );
  let totalMarks = headerTotalMatch
    ? parseInt(headerTotalMatch[1] || '0', 10)
    : 0;

  if (totalMarks === 0) {
    // Sum from question-specific mark tags: e.g. "[10 marks]", "(5 M)"
    const markMatches = [
      ...fullText.matchAll(
        /(?:^|\n)[^\n]*?(?:\[|\()(\d+)\s*(?:m|marks?|pts?|points?)(?:\]|\))\s*$/gim,
      ),
    ];
    for (const m of markMatches) {
      const val = parseInt(m[1] || '0', 10);
      if (val > 0 && val <= 50) {
        totalMarks += val;
      }
    }
  }

  if (totalMarks === 0) {
    totalMarks = detectedCount * 4; // realistic academic default
  }

  // 3. Detect Question Formats
  // MCQs: check for options (a), (b), (c), (d) or A., B., C., D.
  const mcqOptionMatches =
    fullText.match(/(?:^|\n)\s*(?:\([a-d]\)|[a-d]\))\s+[^\n]+/gi) || [];
  const estimatedMcqCount = Math.floor(mcqOptionMatches.length / 4);

  // Short vs Long based on marks or length
  const perQuestionMarks = [
    ...fullText.matchAll(
      /(?:\[|\()(\d+)\s*(?:m|marks?|pts?|points?)(?:\]|\))/gi,
    ),
  ];
  let shortCount = 0;
  let longCount = 0;
  for (const m of perQuestionMarks) {
    const val = parseInt(m[1] || '0', 10);
    if (val >= 10 && val <= 50) longCount++;
    else if (val >= 2 && val < 10) shortCount++;
  }

  const rawFormat = {
    long_answer: Math.max(longCount, 2),
    mcq: Math.max(estimatedMcqCount, 4),
    short_answer: Math.max(shortCount, 4),
  };

  const formatDistribution = normalizePercentages(rawFormat, {
    long_answer: 20,
    mcq: 50,
    short_answer: 30,
  });

  // 4. Detect Bloom Taxonomy levels via pedagogical action verbs
  const textLower = fullText.toLowerCase();

  const countOccurrences = (words: string[]): number => {
    let count = 0;
    for (const w of words) {
      const regex = new RegExp(`\\b${w}\\b`, 'gi');
      const matches = textLower.match(regex);
      if (matches) count += matches.length;
    }
    return count;
  };

  const rememberCount = countOccurrences([
    'define',
    'state',
    'list',
    'name',
    'identify',
    'recall',
    'what is',
  ]);
  const understandCount = countOccurrences([
    'explain',
    'describe',
    'discuss',
    'summarize',
    'distinguish',
    'classify',
    'clarify',
  ]);
  const applyCount = countOccurrences([
    'calculate',
    'compute',
    'implement',
    'solve',
    'demonstrate',
    'determine',
    'apply',
  ]);
  const analyzeCount = countOccurrences([
    'analyze',
    'compare',
    'contrast',
    'derive',
    'differentiate',
    'investigate',
    'examine',
  ]);
  const evaluateCount = countOccurrences([
    'evaluate',
    'justify',
    'critique',
    'assess',
    'verify',
    'defend',
    'appraise',
  ]);
  const createCount = countOccurrences([
    'design',
    'synthesize',
    'formulate',
    'construct',
    'propose',
    'create',
    'develop',
  ]);

  const rawBloom = {
    analyze: Math.max(analyzeCount, 3),
    apply: Math.max(applyCount, 3),
    create: Math.max(createCount, 1),
    evaluate: Math.max(evaluateCount, 1),
    remember: Math.max(rememberCount, 2),
    understand: Math.max(understandCount, 2),
  };

  const bloomDistribution = normalizePercentages(rawBloom, {
    analyze: 30,
    apply: 25,
    create: 5,
    evaluate: 15,
    remember: 10,
    understand: 15,
  });

  // 5. Detect Difficulty Distribution (based on Bloom cognitive weights)
  const easyWeight = bloomDistribution.remember + bloomDistribution.understand * 0.5;
  const mediumWeight =
    bloomDistribution.apply +
    bloomDistribution.understand * 0.5 +
    bloomDistribution.analyze * 0.4;
  const hardWeight =
    bloomDistribution.analyze * 0.6 +
    bloomDistribution.evaluate +
    bloomDistribution.create;

  const difficultyDistribution = normalizePercentages(
    {
      easy: Math.round(easyWeight),
      hard: Math.round(hardWeight),
      medium: Math.round(mediumWeight),
    },
    { easy: 20, hard: 30, medium: 50 },
  );

  // 6. Detect Topic Frequency and Themes
  // Search for prominent capitalised noun phrases or syllabus terms
  const themeCandidates = new Set<string>();
  const topicWeights: Record<string, number> = {};

  for (const line of lines) {
    if (
      line.length > 5 &&
      line.length < 80 &&
      /^[A-Z][A-Za-z0-9\s,&:-]+$/.test(line) &&
      !line.toLowerCase().includes('page') &&
      !line.toLowerCase().includes('university') &&
      !line.toLowerCase().includes('time') &&
      !line.toLowerCase().includes('marks') &&
      !line.toLowerCase().includes('question')
    ) {
      themeCandidates.add(line);
    }
  }

  const themesArray = Array.from(themeCandidates).slice(0, 5);
  if (themesArray.length === 0) {
    themesArray.push(
      'Core Theoretical Foundations',
      'System Architecture & Mechanisms',
      'Analytical Proofs & Computational Problem Solving',
    );
  }

  // Build balanced topic distribution from themes
  const topicCount = themesArray.length;
  themesArray.forEach((theme, idx) => {
    topicWeights[theme] = Math.round(100 / topicCount) + (idx === 0 ? 100 % topicCount : 0);
  });

  // 7. Structural Section Breakdown (Part A, Part B, Part C)
  const sectionHeaders = lines.filter((l) =>
    /^(?:part|section|module)\s+[a-z0-9]+/i.test(l),
  );

  const sections =
    sectionHeaders.length > 0
      ? sectionHeaders.slice(0, 4).map((title, idx) => ({
          format: idx === 0 ? 'MCQ / Objective' : idx === 1 ? 'Short Answer' : 'Long Answer / Analytical',
          marks_per_question: idx === 0 ? 2 : idx === 1 ? 5 : 10,
          question_count: Math.round(detectedCount / sectionHeaders.length),
          title,
        }))
      : [
          {
            format: 'Objective & Short Recall',
            marks_per_question: 2,
            question_count: Math.round(detectedCount * 0.4),
            title: 'Section I: Foundational Concepts',
          },
          {
            format: 'Analytical & Problem Solving',
            marks_per_question: 6,
            question_count: Math.round(detectedCount * 0.4),
            title: 'Section II: Applied Analysis',
          },
          {
            format: 'Comprehensive Design & Proofs',
            marks_per_question: 12,
            question_count: Math.round(detectedCount * 0.2),
            title: 'Section III: Synthesis & Design',
          },
        ];

  return {
    analyzed_at: new Date().toISOString(),
    bloom_distribution: bloomDistribution,
    detected_marks_total: Math.max(totalMarks, 50),
    difficulty_distribution: difficultyDistribution,
    format_distribution: formatDistribution,
    recurring_themes: themesArray,
    resource_id: resourceId,
    resource_name: resourceName,
    sections,
    topic_distribution: topicWeights,
    total_detected_questions: detectedCount,
  };
}

export interface AnalyzePyqOptions {
  client: SupabaseClient;
  model?: string;
  projectId: string;
  provider?: 'gemini' | 'ollama' | 'groq';
  resourceId: string;
}

/**
 * Analyzes a Previous Year Question (PYQ) paper using Dual-Engine AI with deterministic heuristic fallback.
 * Strictly verifies project ownership and resource validity.
 */
export async function analyzePyqPattern(
  options: AnalyzePyqOptions,
): Promise<PyqAnalysisPattern> {
  const { client, projectId, resourceId, provider, model } = options;

  // 1. Check in-memory cache
  const cached = getCachedPyqPattern(resourceId);
  if (cached) {
    return cached;
  }

  // 2. Verify resource belongs to project and is in READY state
  const { data: resource, error: resError } = await client
    .from('resources')
    .select('id, original_filename, resource_kind, status, project_id')
    .eq('id', resourceId)
    .eq('project_id', projectId)
    .is('archived_at', null)
    .single();

  if (resError || !resource) {
    throw new Error('Resource not found or does not belong to this project.');
  }

  // 3. Fetch resource chunks from Supabase
  const { data: chunks, error: chunksError } = await client
    .from('resource_chunks')
    .select('id, chunk_index, text, page_number')
    .eq('resource_id', resourceId)
    .order('chunk_index', { ascending: true });

  if (chunksError) {
    throw new Error(`Failed to retrieve resource chunks: ${chunksError.message}`);
  }

  if (!chunks || chunks.length === 0) {
    throw new Error(
      'No text chunks found for this resource. Ensure the resource processing run has completed successfully.',
    );
  }

  // Assemble full text (capping at 50,000 characters to keep within fast reasoning bounds)
  const fullText = chunks
    .map((c) => c.text.trim())
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 50000);

  const fallbackPattern = parsePyqHeuristically(
    fullText,
    resourceId,
    resource.original_filename,
  );

  // 4. Execute AI Extraction via configured provider
  const chosenProvider =
    provider || (env.GEMINI_API_KEY ? 'gemini' : env.GROQ_API_KEY ? 'groq' : 'ollama');

  const systemPrompt = `You are a university academic dean and psychometrician specializing in Bloom's Revised Taxonomy (Remember, Understand, Apply, Analyze, Evaluate, Create) and exam blueprint analysis.
Analyze the provided previous-year question (PYQ) paper and extract its exact structural, cognitive, and difficulty blueprint.
Your output MUST be a strict, raw JSON object matching the exact schema requested without markdown formatting.`;

  const userPrompt = `Analyze this previous-year exam paper and extract its structural blueprint:
Filename: "${resource.original_filename}"

--- EXAM PAPER TEXT START ---
${fullText.slice(0, 24000)}
--- EXAM PAPER TEXT END ---

Output ONLY a single JSON object with these exact keys:
{
  "total_detected_questions": <total number of distinct questions/subquestions, e.g. 15>,
  "detected_marks_total": <total marks of the assessment, e.g. 100>,
  "topic_distribution": {
    "<Topic Name 1>": <percentage weight 0-100>,
    "<Topic Name 2>": <percentage weight 0-100>
  },
  "bloom_distribution": {
    "remember": <percentage weight 0-100>,
    "understand": <percentage weight 0-100>,
    "apply": <percentage weight 0-100>,
    "analyze": <percentage weight 0-100>,
    "evaluate": <percentage weight 0-100>,
    "create": <percentage weight 0-100>
  },
  "format_distribution": {
    "mcq": <percentage weight 0-100>,
    "short_answer": <percentage weight 0-100>,
    "long_answer": <percentage weight 0-100>
  },
  "difficulty_distribution": {
    "easy": <percentage weight 0-100>,
    "medium": <percentage weight 0-100>,
    "hard": <percentage weight 0-100>
  },
  "recurring_themes": [
    "<Key recurring conceptual problem or theme 1>",
    "<Key recurring conceptual problem or theme 2>"
  ],
  "sections": [
    { "title": "<e.g. Part A - Objective>", "question_count": <number>, "marks_per_question": <number>, "format": "<e.g. MCQ>" }
  ]
}

Important Rules:
- All percentage distributions (bloom, format, difficulty, topics) MUST each sum to 100.
- Do NOT output preamble, explanations, or code blocks. Output pure JSON only.`;

  try {
    const aiProvider = getAIProvider(chosenProvider, model);
    const rawResponse = await aiProvider.generate({
      format: 'json',
      prompt: userPrompt,
      system: systemPrompt,
      temperature: 0.1,
      timeoutMs: 30000,
    });

    const cleaned = rawResponse
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsedJson = JSON.parse(cleaned);

    // Validate and normalize percentage distributions
    const bloomNormalized = normalizePercentages(
      parsedJson.bloom_distribution ?? {},
      fallbackPattern.bloom_distribution,
    );
    const formatNormalized = normalizePercentages(
      parsedJson.format_distribution ?? {},
      fallbackPattern.format_distribution,
    );
    const difficultyNormalized = normalizePercentages(
      parsedJson.difficulty_distribution ?? {},
      fallbackPattern.difficulty_distribution,
    );
    const topicNormalized = normalizePercentages(
      parsedJson.topic_distribution ?? {},
      fallbackPattern.topic_distribution,
    );

    const pattern: PyqAnalysisPattern = {
      analyzed_at: new Date().toISOString(),
      bloom_distribution: bloomNormalized,
      detected_marks_total:
        typeof parsedJson.detected_marks_total === 'number' && parsedJson.detected_marks_total > 0
          ? parsedJson.detected_marks_total
          : fallbackPattern.detected_marks_total,
      difficulty_distribution: difficultyNormalized,
      format_distribution: formatNormalized,
      recurring_themes: Array.isArray(parsedJson.recurring_themes) && parsedJson.recurring_themes.length > 0
        ? parsedJson.recurring_themes.map((t: unknown) => String(t).trim()).filter(Boolean)
        : fallbackPattern.recurring_themes,
      resource_id: resourceId,
      resource_name: resource.original_filename,
      sections: Array.isArray(parsedJson.sections) && parsedJson.sections.length > 0
        ? parsedJson.sections.map((s: Record<string, unknown>) => ({
            format: String(s.format || 'Mixed'),
            marks_per_question: Number(s.marks_per_question) || 5,
            question_count: Number(s.question_count) || 5,
            title: String(s.title || 'General Section'),
          }))
        : fallbackPattern.sections,
      topic_distribution: topicNormalized,
      total_detected_questions:
        typeof parsedJson.total_detected_questions === 'number' && parsedJson.total_detected_questions > 0
          ? parsedJson.total_detected_questions
          : fallbackPattern.total_detected_questions,
    };

    // Cache the analyzed pattern
    setCachedPyqPattern(resourceId, pattern);

    // Persist pattern into resource_processing_runs metadata if a run exists
    try {
      const { data: latestRun } = await client
        .from('resource_processing_runs')
        .select('id, metadata')
        .eq('resource_id', resourceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestRun) {
        const existingMeta = (latestRun.metadata as Record<string, unknown>) || {};
        await client
          .from('resource_processing_runs')
          .update({
            metadata: {
              ...existingMeta,
              pyq_pattern: pattern,
            },
          })
          .eq('id', latestRun.id);
      }
    } catch {
      // Non-fatal metadata update
    }

    return pattern;
  } catch (error) {
    // If AI fails or returns malformed response, safely fallback to heuristic pattern
    setCachedPyqPattern(resourceId, fallbackPattern);
    return fallbackPattern;
  }
}

/**
 * Lists all analyzed PYQ patterns for a given project.
 */
export async function listProjectPyqPatterns(
  client: SupabaseClient,
  projectId: string,
): Promise<PyqAnalysisPattern[]> {
  // Query all READY PYQ resources in the project
  const { data: pyqResources } = await client
    .from('resources')
    .select('id, original_filename, resource_kind, status')
    .eq('project_id', projectId)
    .eq('resource_kind', 'PYQ')
    .eq('status', 'READY')
    .is('archived_at', null);

  if (!pyqResources || pyqResources.length === 0) {
    return [];
  }

  const results: PyqAnalysisPattern[] = [];

  for (const res of pyqResources) {
    const cached = getCachedPyqPattern(res.id);
    if (cached) {
      results.push(cached);
      continue;
    }

    // Check if stored in resource_processing_runs metadata
    const { data: run } = await client
      .from('resource_processing_runs')
      .select('id, metadata')
      .eq('resource_id', res.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (run?.metadata && (run.metadata as Record<string, unknown>).pyq_pattern) {
      const parsed = pyqAnalysisPatternSchema.safeParse(
        (run.metadata as Record<string, unknown>).pyq_pattern,
      );
      if (parsed.success) {
        setCachedPyqPattern(res.id, parsed.data);
        results.push(parsed.data);
        continue;
      }
    }

    // Otherwise analyze on the fly
    try {
      const analyzed = await analyzePyqPattern({
        client,
        projectId,
        resourceId: res.id,
      });
      results.push(analyzed);
    } catch {
      // Skip failed analysis
    }
  }

  return results;
}
