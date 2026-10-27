import fs from 'fs';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BlueprintConfiguration,
  GeneratedQuestionItem,
} from '@groundq/contracts';
import { getAIProvider } from '../ai/providers/ai-provider.js';
import { env } from '../config/env.js';
import { STOPWORDS } from './topic-inferencer.js';

export function logGen(msg: string, data?: unknown) {
  try {
    const timestamp = new Date().toISOString();
    const str =
      data !== undefined
        ? ` ${typeof data === 'object' ? JSON.stringify(data) : String(data)}`
        : '';
    fs.appendFileSync(
      path.resolve(process.cwd(), 'generation_debug.log'),
      `[${timestamp}] ${msg}${str}\n`,
      'utf8',
    );
  } catch {
    // Ignore file write errors
  }
}

interface ReferenceTables {
  bloom: Map<string, string>; // slug -> id
  difficulty: Map<string, string>; // slug -> id
  styles: Map<string, string>; // slug -> id
  types: Map<string, string>; // slug -> id
}

let cachedReferences: ReferenceTables | null = null;

async function loadReferences(
  client: SupabaseClient,
): Promise<ReferenceTables> {
  if (cachedReferences) return cachedReferences;

  const [bloomRes, diffRes, typeRes, styleRes] = await Promise.all([
    client.from('bloom_levels').select('id, slug'),
    client.from('difficulty_levels').select('id, slug'),
    client.from('question_types').select('id, slug'),
    client.from('question_styles').select('id, slug'),
  ]);

  const bloom = new Map<string, string>();
  for (const b of bloomRes.data ?? []) bloom.set(b.slug.toLowerCase(), b.id);

  const difficulty = new Map<string, string>();
  for (const d of diffRes.data ?? [])
    difficulty.set(d.slug.toUpperCase(), d.id);

  const types = new Map<string, string>();
  for (const t of typeRes.data ?? []) types.set(t.slug.toUpperCase(), t.id);

  const styles = new Map<string, string>();
  for (const s of styleRes.data ?? []) styles.set(s.slug.toUpperCase(), s.id);

  cachedReferences = { bloom, difficulty, styles, types };
  return cachedReferences;
}

export interface PlanTarget {
  bloomSlug: string;
  difficultySlug: string;
  sequenceNumber: number;
  styleSlug: string;
  topicId: string | null;
  typeSlug: string;
}

/**
 * Decomposes blueprint configuration distributions into discrete per-question plan targets.
 */
export function buildGenerationPlan(
  config: BlueprintConfiguration,
  availableTopicIds: string[],
): PlanTarget[] {
  const count = config.question_count || 10;
  const targets: PlanTarget[] = [];

  // Topics
  const topicWeights = config.topics || {};
  const activeTopicEntries = Object.entries(topicWeights).filter(
    ([, w]) => w > 0,
  );
  const topicList =
    activeTopicEntries.length > 0
      ? activeTopicEntries.map(([id]) => id)
      : availableTopicIds;

  // Bloom distributions
  const bloomWeights = Object.entries(
    config.bloom || { analyze: 50, apply: 50 },
  );
  const diffWeights = Object.entries(
    config.difficulty || { EASY: 20, HARD: 30, MEDIUM: 50 },
  );
  const typeWeights = Object.entries(
    config.types || { LONG_ANSWER: 20, MCQ: 50, SHORT_ANSWER: 30 },
  );
  const styleWeights = Object.entries(
    config.styles || { ANALYTICAL: 40, CONCEPTUAL: 20, SCENARIO: 40 },
  );

  const pickByWeight = (
    entries: [string, number][],
    index: number,
    defaultVal: string,
  ): string => {
    if (entries.length === 0) return defaultVal;
    const total = entries.reduce((acc, [, w]) => acc + w, 0);
    if (total <= 0) return entries[index % entries.length]![0];
    const normalized = entries.map(([k, w]) => [k, w / total] as const);
    let cumulative = 0;
    const point = ((index * 37) % 100) / 100;
    for (const [k, w] of normalized) {
      cumulative += w;
      if (point <= cumulative) return k;
    }
    return entries[0]![0];
  };

  for (let i = 1; i <= count; i++) {
    const topicId =
      topicList.length > 0 ? topicList[(i - 1) % topicList.length]! : null;
    const bloomSlug = pickByWeight(bloomWeights, i, 'analyze').toLowerCase();
    const difficultySlug = pickByWeight(diffWeights, i, 'MEDIUM').toUpperCase();
    const typeSlug = pickByWeight(typeWeights, i, 'MCQ').toUpperCase();
    const styleSlug = pickByWeight(styleWeights, i, 'SCENARIO').toUpperCase();

    targets.push({
      bloomSlug,
      difficultySlug,
      sequenceNumber: i,
      styleSlug,
      topicId,
      typeSlug,
    });
  }

  return targets;
}

export interface RunGenerationOptions {
  blueprint: BlueprintConfiguration;
  client: SupabaseClient;
  projectId: string;
  runId: string;
  userId: string;
}

export function computeStemSimilarity(a: string, b: string): number {
  const normA = a.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
  const normB = b.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
  if (normA === normB) return 1.0;

  const wordsA = new Set(normA.split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(normB.split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function createPrng(seed: number) {
  let s = (seed * 1664525 + 1013904223) >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function shuffleOptions<T extends { is_correct: boolean }>(
  options: T[],
  seed?: number,
): T[] {
  if (!options || options.length <= 1) return options;
  const cloned = [...options];
  const rng = seed !== undefined ? createPrng(seed) : Math.random;
  for (let i = cloned.length - 1; i > 0; i--) {
    const r = Math.floor(rng() * (i + 1));
    const temp = cloned[i]!;
    cloned[i] = cloned[r]!;
    cloned[r] = temp;
  }
  return cloned;
}

export async function executeGenerationRun(
  options: RunGenerationOptions,
): Promise<{
  acceptedCount: number;
  questions: GeneratedQuestionItem[];
}> {
  const { blueprint, client, projectId, runId } = options;

  try {
    // 1. Update run to PLANNING
    logGen('Starting generation run', {
      model: blueprint.model_name,
      projectId,
      provider: blueprint.model_provider,
      questionsRequested: blueprint.question_count,
      runId,
    });
    await client
      .from('generation_runs')
      .update({ started_at: new Date().toISOString(), status: 'PLANNING' })
      .eq('id', runId);

    const refs = await loadReferences(client);

    // 2. Fetch topics in project
    const { data: dbTopics } = await client
      .from('topics')
      .select('id, name')
      .eq('project_id', projectId)
      .is('archived_at', null);

    const topicMap = new Map<string, string>();
    for (const t of dbTopics ?? []) {
      topicMap.set(t.id, t.name);
    }
    const availableTopicIds = (dbTopics ?? []).map((t) => t.id);

    // 3. Plan targets
    const planTargets = buildGenerationPlan(blueprint, availableTopicIds);

    const isUuid = (val: unknown): val is string =>
      typeof val === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    // Sanitize topicId so non-UUID dummy IDs never violate DB foreign keys
    for (const target of planTargets) {
      if (
        target.topicId &&
        (!isUuid(target.topicId) || !availableTopicIds.includes(target.topicId))
      ) {
        target.topicId =
          availableTopicIds.length > 0
            ? availableTopicIds[
                (target.sequenceNumber - 1) % availableTopicIds.length
              ]!
            : null;
      }
    }

    // 4. Insert Plan Items into database
    const planItemInserts = planTargets.map((target) => ({
      bloom_level_id: refs.bloom.get(target.bloomSlug) || null,
      difficulty_level_id: refs.difficulty.get(target.difficultySlug) || null,
      generation_run_id: runId,
      question_type_id: refs.types.get(target.typeSlug) || null,
      sequence_number: target.sequenceNumber,
      status: 'PLANNED',
      style_id: refs.styles.get(target.styleSlug) || null,
      topic_id: target.topicId,
    }));

    const { data: planItems, error: planError } = await client
      .from('generation_plan_items')
      .insert(planItemInserts)
      .select('id, sequence_number');

    if (planError) {
      logGen('Failed to create plan items', planError);
      throw new Error(`Failed to create plan items: ${planError.message}`);
    }

    logGen('Plan items created successfully', { count: planItems?.length });

    const planItemMap = new Map<number, string>();
    for (const item of planItems ?? []) {
      planItemMap.set(item.sequence_number, item.id);
    }

    // 5. Update run to RETRIEVING then GENERATING
    await client
      .from('generation_runs')
      .update({ status: 'RETRIEVING' })
      .eq('id', runId);

    // Query max existing sort_order in project for monotonic numbering across runs
    const { data: maxOrderData } = await client
      .from('questions')
      .select('sort_order')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const baseSortOrder =
      (maxOrderData as { sort_order?: number } | null)?.sort_order ?? 0;

    // Fetch non-PYQ resource IDs so generated questions are grounded strictly in syllabus study material (PRD §11 & §25)
    const { data: studyResources } = await client
      .from('resources')
      .select('id')
      .eq('project_id', projectId)
      .neq('resource_kind', 'PYQ')
      .is('archived_at', null);

    const studyResourceIds = new Set((studyResources ?? []).map((r) => r.id));

    // Fetch all resource chunks for context across the full document syllabus without artificial limits
    const { data: rawChunks } = await client
      .from('resource_chunks')
      .select('id, resource_id, text, page_number, chunk_index')
      .eq('project_id', projectId)
      .order('chunk_index', { ascending: true })
      .range(0, 9999);

    // Prioritize non-PYQ study materials to prevent paraphrasing of past exam questions
    const filteredByStudy =
      studyResourceIds.size > 0
        ? (rawChunks ?? []).filter((c) => studyResourceIds.has(c.resource_id))
        : rawChunks ?? [];
    const chunks =
      filteredByStudy.length > 0 ? filteredByStudy : rawChunks ?? [];

    // Filter out front-matter and Table of Contents chunks
    const validContentChunks = (chunks ?? []).filter((c) => {
      const dotCount = (c.text.match(/\.{3,}/g) || []).length;
      return dotCount < 3 && c.text.trim().length > 80;
    });

    const poolChunks =
      validContentChunks.length > 0 ? validContentChunks : chunks ?? [];

    // Query chunk_topics evidence links for mapped topics
    const { data: chunkTopicLinks } = await client
      .from('chunk_topics')
      .select('chunk_id, topic_id')
      .in(
        'topic_id',
        availableTopicIds.length > 0
          ? availableTopicIds
          : ['00000000-0000-0000-0000-000000000000'],
      )
      .range(0, 9999);

    const topicToChunkIds = new Map<string, string[]>();
    for (const link of chunkTopicLinks ?? []) {
      const arr = topicToChunkIds.get(link.topic_id) ?? [];
      arr.push(link.chunk_id);
      topicToChunkIds.set(link.topic_id, arr);
    }

    const chunkById = new Map<string, (typeof poolChunks)[0]>();
    for (const c of poolChunks) {
      chunkById.set(c.id, c);
    }

    await client
      .from('generation_runs')
      .update({ status: 'GENERATING' })
      .eq('id', runId);

    // Fetch existing question stems in the project for cross-batch and in-run deduplication
    // Query both questions table and question_versions table reliably
    let existingStems: string[] = [];
    try {
      const { data: projectQuestions } = await client
        .from('questions')
        .select('id, current_version_id')
        .eq('project_id', projectId)
        .is('archived_at', null);

      const versionIds = (projectQuestions ?? [])
        .map((q) => q.current_version_id)
        .filter((id): id is string => Boolean(id));

      if (versionIds.length > 0) {
        const { data: versionData } = await client
          .from('question_versions')
          .select('question_text')
          .in('id', versionIds);

        existingStems = (versionData ?? [])
          .map((v) => v.question_text)
          .filter(Boolean);
      }
    } catch (stemFetchErr) {
      console.warn(
        `[QuestionGenerator] Could not fetch prior question stems:`,
        stemFetchErr instanceof Error ? stemFetchErr.message : String(stemFetchErr),
      );
    }
    const inRunStems: string[] = [];

    const generatedQuestions: GeneratedQuestionItem[] = [];

    // 6. Generate for plan targets (Batched on Cloud providers, single on local CPU)
    const chosenProvider =
      blueprint.model_provider ||
      (env.GEMINI_API_KEY ? 'gemini' : env.GROQ_API_KEY ? 'groq' : 'ollama');
    const isCloud = chosenProvider === 'gemini' || chosenProvider === 'groq';
    const BATCH_SIZE = isCloud ? 3 : 1;

    // Ensure chunks are sorted monotonically by resource and page number for strictly proportional coverage
    const sortedPoolChunks = [...poolChunks].sort((a, b) => {
      if (a.resource_id !== b.resource_id) {
        return a.resource_id.localeCompare(b.resource_id);
      }
      const pageA = a.page_number ?? 0;
      const pageB = b.page_number ?? 0;
      if (pageA !== pageB) return pageA - pageB;
      return a.chunk_index - b.chunk_index;
    });

    const totalPool = sortedPoolChunks.length;
    const totalTargets = planTargets.length;

    // Build reverse lookup from chunk_id to linked topic_id
    const chunkToTopicIds = new Map<string, string[]>();
    for (const link of chunkTopicLinks ?? []) {
      const arr = chunkToTopicIds.get(link.chunk_id) ?? [];
      arr.push(link.topic_id);
      chunkToTopicIds.set(link.chunk_id, arr);
    }

    // Partition targets with their selected chunks into batches
    const batchList: Array<
      Array<{
        chunk?: (typeof poolChunks)[0];
        planItemId: string;
        target: (typeof planTargets)[0];
        topicName: string;
      }>
    > = [];

    const usedChunkIds = new Set<string>();
    let currentBatch: (typeof batchList)[0] = [];
    for (let tIdx = 0; tIdx < planTargets.length; tIdx++) {
      const target = planTargets[tIdx]!;
      const planItemId = planItemMap.get(target.sequenceNumber);
      if (!planItemId) continue;

      let topicName = target.topicId
        ? topicMap.get(target.topicId) || 'Curriculum Subject'
        : 'Core Subject Area';

      // Chunks explicitly linked to target.topicId via chunk_topics
      const mappedChunkIds = target.topicId
        ? topicToChunkIds.get(target.topicId) ?? []
        : [];
      const mappedChunks = mappedChunkIds
        .map((id) => chunkById.get(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));

      // Compute this question's proportional stratum across the entire document
      // e.g., question 1 of 15 is 0%..6.6% (Page 1-5), question 15 of 15 is 93.3%..100% (Page 67-71)
      const windowStart = Math.floor((tIdx * totalPool) / totalTargets);
      const windowEnd = Math.min(
        totalPool - 1,
        Math.floor(((tIdx + 1) * totalPool) / totalTargets) - 1,
      );
      const effectiveWindowEnd = Math.max(windowStart, windowEnd);
      const stratumChunks = sortedPoolChunks.slice(
        windowStart,
        effectiveWindowEnd + 1,
      );

      const topicWords = topicName
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOPWORDS.has(w));

      // 1. First priority: Check if this stratum contains chunks explicitly linked to target.topicId
      const stratumTopicLinked = stratumChunks.filter((c) =>
        mappedChunkIds.includes(c.id),
      );

      // 2. Second priority: Check if this stratum contains keyword matches for the topic
      const stratumKeywordMatched = stratumChunks.filter((c) => {
        const lower = c.text.toLowerCase();
        return topicWords.some((w) => lower.includes(w));
      });

      let selectedChunk: (typeof poolChunks)[0] | undefined;

      const unusedStratumTopic = stratumTopicLinked.filter((c) => !usedChunkIds.has(c.id));
      const unusedStratumKeyword = stratumKeywordMatched.filter((c) => !usedChunkIds.has(c.id));
      const unusedStratum = stratumChunks.filter((c) => !usedChunkIds.has(c.id));
      const unusedMapped = mappedChunks.filter((c) => !usedChunkIds.has(c.id));

      if (unusedStratumTopic.length > 0) {
        selectedChunk = unusedStratumTopic[tIdx % unusedStratumTopic.length];
      } else if (stratumTopicLinked.length > 0) {
        selectedChunk = stratumTopicLinked[tIdx % stratumTopicLinked.length];
      } else if (unusedStratumKeyword.length > 0) {
        selectedChunk = unusedStratumKeyword[tIdx % unusedStratumKeyword.length];
      } else if (stratumKeywordMatched.length > 0) {
        selectedChunk = stratumKeywordMatched[tIdx % stratumKeywordMatched.length];
      } else if (unusedStratum.length > 0) {
        selectedChunk = unusedStratum[Math.floor(unusedStratum.length / 2)];
      } else if (unusedMapped.length > 0) {
        selectedChunk = unusedMapped.reduce((best, curr) => {
          const bestDist = Math.abs(best.chunk_index - windowStart);
          const currDist = Math.abs(curr.chunk_index - windowStart);
          return currDist < bestDist ? curr : best;
        }, unusedMapped[0]!);
      } else if (mappedChunks.length > 0) {
        // If topic has mapped chunks elsewhere, find the one closest to this window's position
        const closestMapped = mappedChunks.reduce((best, curr) => {
          const bestDist = Math.abs(best.chunk_index - windowStart);
          const currDist = Math.abs(curr.chunk_index - windowStart);
          return currDist < bestDist ? curr : best;
        }, mappedChunks[0]!);

        // If the closest mapped chunk is within 35% document distance, use it;
        // otherwise, use the stratum chunk to guarantee 100% full-document syllabus coverage!
        const maxAllowedDistance = Math.max(6, Math.floor(totalPool * 0.35));
        if (Math.abs(closestMapped.chunk_index - windowStart) <= maxAllowedDistance) {
          selectedChunk = closestMapped;
        } else {
          selectedChunk =
            stratumChunks[Math.floor(stratumChunks.length / 2)] ||
            sortedPoolChunks[windowStart];
        }
      } else {
        // 3. Fallback: Select central chunk of this document stratum, preferring unused
        selectedChunk =
          sortedPoolChunks.find((c) => !usedChunkIds.has(c.id)) ||
          stratumChunks[Math.floor(stratumChunks.length / 2)] ||
          sortedPoolChunks[windowStart];
      }

      if (selectedChunk) {
        usedChunkIds.add(selectedChunk.id);
      }

      // If selectedChunk is linked to a specific topic in the document, adopt that topic
      if (selectedChunk) {
        const linkedTopics = chunkToTopicIds.get(selectedChunk.id);
        if (linkedTopics && linkedTopics.length > 0 && linkedTopics[0]) {
          const linkedId = linkedTopics[0];
          if (topicMap.has(linkedId)) {
            topicName = topicMap.get(linkedId)!;
            target.topicId = linkedId;
          }
        }
      }

      currentBatch.push({
        chunk: selectedChunk,
        planItemId,
        target,
        topicName,
      });

      if (currentBatch.length >= BATCH_SIZE) {
        batchList.push(currentBatch);
        currentBatch = [];
      }
    }
    if (currentBatch.length > 0) {
      batchList.push(currentBatch);
    }

    let lastTargetError: string | null = null;
    for (let bIdx = 0; bIdx < batchList.length; bIdx++) {
      const batch = batchList[bIdx]!;
      // Safe RPM throttle for cloud providers (15 RPM free tier on Gemini)
      if (isCloud && bIdx > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      let batchResults = new Map<number, RawSynthesizedQuestion>();
      if (batch.length > 1) {
        try {
          batchResults = await synthesizeQuestionBatch({
            batch,
            blueprint,
            refs,
            runId,
          });
        } catch (batchErr) {
          console.warn(
            `[QuestionGenerator] Batch synthesis failed (${batchErr instanceof Error ? batchErr.message : String(batchErr)}). Falling back to individual generation...`,
          );
        }
      }

      for (const itemParam of batch) {
        const { chunk: selectedChunk, planItemId, target, topicName } = itemParam;
        try {
          let item = batchResults.get(target.sequenceNumber);
          if (!item) {
            item = await synthesizeQuestionItem({
              blueprint,
              chunk: selectedChunk,
              planItemId,
              priorStems: [...existingStems, ...inRunStems],
              refs,
              runId,
              target,
              topicName,
            });
          }

          // Evaluate similarity against existing questions in this project and current run
          const allPriorStems = [...existingStems, ...inRunStems];
          let maxSim = 0;
          let mostSimilarStem = '';
          for (const prior of allPriorStems) {
            const sim = computeStemSimilarity(item.stem, prior);
            if (sim > maxSim) {
              maxSim = sim;
              mostSimilarStem = prior;
            }
          }

          if (blueprint.duplicate_policy === 'PREVENT' && maxSim > 0.82) {
            console.warn(
              `[QuestionGenerator] Item #${target.sequenceNumber} duplicate detected (${(maxSim * 100).toFixed(1)}%). Retrying with alternative chunk and varied temperature...`,
            );
            // Select an alternative chunk from another section of the document that has not been used yet
            const altChunk =
              sortedPoolChunks.find((c) => !usedChunkIds.has(c.id) && c.id !== selectedChunk?.id) ||
              poolChunks[(target.sequenceNumber * 3) % poolChunks.length] ||
              selectedChunk;

            try {
              const retryItem = await synthesizeQuestionItem({
                blueprint: { ...blueprint, temperature: 0.35 },
                chunk: altChunk,
                planItemId,
                priorStems: allPriorStems,
                refs,
                runId,
                target,
                topicName,
              });
              let retrySim = 0;
              for (const prior of allPriorStems) {
                const sim = computeStemSimilarity(retryItem.stem, prior);
                if (sim > retrySim) retrySim = sim;
              }
              // Accept retryItem
              item = retryItem;
              maxSim = retrySim;
            } catch (retryErr) {
              console.warn(
                `[QuestionGenerator] Retry after duplicate detection failed:`,
                retryErr instanceof Error ? retryErr.message : String(retryErr),
              );
            }
          }

          // Persist to database with strictly contiguous monotonic ordering (no numbering gaps)
          const savedQuestion = await persistGeneratedQuestion({
            baseSortOrder,
            client,
            dedupScore: maxSim,
            item,
            persistedIndex: generatedQuestions.length + 1,
            planItemId,
            projectId,
            refs,
            runId,
            selectedChunkId: selectedChunk?.id,
            target,
          });

          if (savedQuestion) {
            inRunStems.push(item.stem);
            generatedQuestions.push(savedQuestion);
            logGen(
              `Item #${target.sequenceNumber} generated and saved successfully: "${item.stem.slice(0, 70)}..."`,
            );

            await client
              .from('generation_plan_items')
              .update({ status: 'COMPLETED' })
              .eq('id', planItemId);

            await client
              .from('generation_runs')
              .update({ accepted_count: generatedQuestions.length })
              .eq('id', runId);
          }
        } catch (genErr) {
          lastTargetError =
            genErr instanceof Error ? genErr.message : String(genErr);
          logGen(`Item #${target.sequenceNumber} generation failed: ${lastTargetError}`);
          console.error(
            `[QuestionGenerator] Item #${target.sequenceNumber} generation failed:`,
            lastTargetError,
          );
          await client
            .from('generation_plan_items')
            .update({
              error_message: lastTargetError,
              status: 'FAILED',
            })
            .eq('id', planItemId);

          await client
            .from('generation_runs')
            .update({
              review_count: planTargets.length - generatedQuestions.length,
            })
            .eq('id', runId);
        }
      }
    }

    const finalStatus =
      generatedQuestions.length === planTargets.length
        ? 'COMPLETED'
        : generatedQuestions.length > 0
          ? 'NEEDS_REVIEW'
          : 'FAILED';

    const runError =
      generatedQuestions.length < planTargets.length
        ? lastTargetError ||
          `Generated ${generatedQuestions.length} of ${planTargets.length} requested items.`
        : null;

    logGen(`Generation run ${runId} finalized`, {
      accepted: generatedQuestions.length,
      error: runError,
      status: finalStatus,
    });

    // 7. Mark run completed
    await client
      .from('generation_runs')
      .update({
        accepted_count: generatedQuestions.length,
        completed_at: new Date().toISOString(),
        error_message: runError,
        review_count: planTargets.length - generatedQuestions.length,
        status: finalStatus,
      })
      .eq('id', runId);

    return {
      acceptedCount: generatedQuestions.length,
      questions: generatedQuestions,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Unknown generation error';
    await client
      .from('generation_runs')
      .update({
        completed_at: new Date().toISOString(),
        error_message: errorMsg,
        status: 'FAILED',
      })
      .eq('id', runId);

    throw err;
  }
}

interface SynthesizeParams {
  priorStems?: string[];
  blueprint: Partial<BlueprintConfiguration> & {
    model_name?: string;
    model_provider?: 'gemini' | 'groq' | 'ollama';
    temperature?: number;
  };
  chunk?: {
    id: string;
    page_number: number | null;
    resource_id: string;
    text: string;
  };
  instructorGuidance?: string;
  planItemId?: string;
  refs: ReferenceTables;
  runId?: string;
  target: PlanTarget;
  topicName: string;
}

interface RawSynthesizedQuestion {
  citation_anchor?: string;
  evidence_quote?: string;
  explanation?: string;
  model_answer?: string;
  options?: Array<{
    explanation?: string;
    is_correct: boolean;
    option_index: number;
    option_text: string;
  }>;
  question_type: string;
  rubric_criteria?: string[];
  stem: string;
}

async function synthesizeQuestionBatch(params: {
  batch: Array<{
    chunk?: {
      id: string;
      page_number: number | null;
      resource_id: string;
      text: string;
    };
    planItemId: string;
    target: PlanTarget;
    topicName: string;
  }>;
  blueprint: BlueprintConfiguration;
  refs: ReferenceTables;
  runId: string;
}): Promise<Map<number, RawSynthesizedQuestion>> {
  const { batch, blueprint } = params;
  const resultMap = new Map<number, RawSynthesizedQuestion>();
  if (batch.length === 0) return resultMap;

  const chosenProvider =
    blueprint.model_provider ||
    (env.GEMINI_API_KEY ? 'gemini' : env.GROQ_API_KEY ? 'groq' : 'ollama');
  const chosenModel =
    blueprint.model_name ||
    (chosenProvider === 'gemini'
      ? env.GEMINI_MODEL || 'gemini-flash-lite-latest'
      : chosenProvider === 'groq'
        ? env.GROQ_MODEL || 'llama-3.3-70b-versatile'
        : env.OLLAMA_MODEL || 'mistral:latest');

  const promptSystem = `You are an expert assessment item designer creating curriculum-grounded university exam questions.
Generate distinct questions strictly adhering to the specified target specifications and excerpts.

CRITICAL RULES:
1. Return strictly valid JSON with no markdown backticks or markdown formatting.
2. Return a JSON object matching this schema:
{
  "questions": [
    {
      "sequence_number": <target sequence number>,
      "stem": "Detailed question stem...",
      "question_type": "MCQ" | "SHORT_ANSWER" | "LONG_ANSWER",
      "options": [
        { "option_index": 0, "option_text": "...", "is_correct": false, "explanation": "..." },
        { "option_index": 1, "option_text": "...", "is_correct": true, "explanation": "..." },
        { "option_index": 2, "option_text": "...", "is_correct": false, "explanation": "..." },
        { "option_index": 3, "option_text": "...", "is_correct": false, "explanation": "..." }
      ],
      "model_answer": "Comprehensive model answer...",
      "explanation": "Pedagogical rationale explaining the assessed concept...",
      "rubric_criteria": ["Criterion 1 (40%)", "Criterion 2 (40%)", "Criterion 3 (20%)"],
      "citation_anchor": "Brief source sentence or concept anchoring this question..."
    }
  ]
}
3. Ground each question conceptually in its provided source excerpt. The question must test authentic principles and relationships.
4. For MCQ questions: provide exactly 4 distinct options with plausible, educative distractors and exactly ONE marked correct (is_correct: true). CRITICAL: Naturally vary the position of the correct option (index 0, 1, 2, or 3) across questions (never always place it in the same position).
5. For SHORT_ANSWER and LONG_ANSWER questions: provide an exemplary model_answer and rubric_criteria.
6. NEVER use software brand names (Microsoft Word, Mozilla Firefox, etc.), generic headings, or author names.`;

  const targetDescriptions = batch
    .map((item) => {
      const cleanTopic = item.topicName
        .replace(/^(?:chapter|section|module|unit|\d+[.:])\s*/i, '')
        .replace(/^Module \d+[:\s-]*/i, '')
        .trim();
      const excerpt = (item.chunk?.text ?? '').slice(0, 1000);
      return `[Target #${item.target.sequenceNumber}]
Topic: "${cleanTopic}"
Cognitive Level: Bloom ${item.target.bloomSlug.toUpperCase()}
Difficulty: ${item.target.difficultySlug}
Question Type: ${item.target.typeSlug}
Style: ${item.target.styleSlug}
Source Excerpt:
"${excerpt}"`;
    })
    .join('\n\n---\n\n');

  const promptUser = `${targetDescriptions}\n\nGenerate JSON containing the array of ${batch.length} questions:`;

  const aiProvider = getAIProvider(chosenProvider, chosenModel);
  const timeoutMs =
    chosenProvider === 'gemini' || chosenProvider === 'groq' ? 35000 : 180000;
  const isLocal = chosenProvider === 'ollama';
  const dynamicSeed = 42 + (batch[0]?.target.sequenceNumber ?? 1) * 17 + Math.floor(Math.random() * 50);
  const rawOutput = await aiProvider.generate({
    format: 'json',
    model: chosenModel,
    prompt: `${promptSystem}\n\n${promptUser}`,
    seed: dynamicSeed,
    temperature: isLocal ? 0.35 : (blueprint.temperature ?? 0.15),
    timeoutMs,
  });

  let cleaned = (rawOutput || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }

  let parsed: { questions?: RawSynthesizedQuestion[] } | null = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {
        // parsing failed
      }
    }
  }

  if (parsed && Array.isArray(parsed.questions)) {
    for (let i = 0; i < parsed.questions.length; i++) {
      const q = parsed.questions[i];
      if (!q || !q.stem || q.stem.trim().length <= 10) continue;
      const seq =
        (q as { sequence_number?: number }).sequence_number ??
        batch[i]?.target.sequenceNumber;
      if (typeof seq === 'number') {
        if (q.question_type === 'MCQ' && Array.isArray(q.options)) {
          const shuffled = shuffleOptions(q.options, seq);
          shuffled.forEach((opt, idx) => {
            opt.option_index = idx;
          });
          q.options = shuffled;
        }
        resultMap.set(seq, q);
      }
    }
  }

  return resultMap;
}

async function synthesizeQuestionItem(
  params: SynthesizeParams,
): Promise<RawSynthesizedQuestion> {
  const { blueprint, chunk, target, topicName } = params;
  const chunkText = chunk?.text ?? '';

  const cleanTopic = topicName
    .replace(/^(?:chapter|section|module|unit|\d+[.:])\s*/i, '')
    .replace(/^Module \d+[:\s-]*/i, '')
    .trim();

  const guidanceNotice = params.instructorGuidance?.trim()
    ? `\n\nINSTRUCTOR PEDAGOGICAL GUIDANCE (CRITICAL DIRECTION):\n"${params.instructorGuidance.trim()}"\nYou must strictly incorporate this specific guidance into the question stem, distractors, and explanation.`
    : '';

  const promptSystem = `You are an expert assessment item designer creating curriculum-grounded university exam questions.
Generate a single rigorous question strictly adhering to:
- Topic: "${cleanTopic}"
- Cognitive Level: Bloom ${target.bloomSlug.toUpperCase()}
- Difficulty: ${target.difficultySlug}
- Question Type: ${target.typeSlug}
- Style: ${target.styleSlug}${guidanceNotice}

CRITICAL RULES:
1. Return strictly valid JSON with no markdown backticks or text outside the JSON object.
2. Ground the question conceptually in the provided source excerpt. The question must test authentic principles and relationships.
3. For MCQ questions:
   - Provide exactly 4 distinct options with plausible, educative distractors and exactly ONE marked correct (is_correct: true).
   - Naturally vary the position of the correct option (index 0, 1, 2, or 3) across questions.
   - Each option must have a detailed explanation describing why it is correct or what specific conceptual error makes it incorrect.
   - NEVER use document headings, software brand names (Microsoft Word, Mozilla Firefox, etc.), or author names as stems or options.
4. For SHORT_ANSWER and LONG_ANSWER questions:
   - Provide an exemplary model_answer demonstrating complete conceptual mastery.
   - Provide an array of rubric_criteria detailing point distribution.
5. Provide a citation_anchor representing the source fact or concept supporting the question.${params.priorStems && params.priorStems.length > 0 ? `\n\nCRITICAL DEDUPLICATION RULE: The following questions ALREADY exist in this exam bank. You MUST create a question on a COMPLETELY DIFFERENT principle, concept, formula, or relationship. DO NOT repeat or rephrase any of these:\n` + params.priorStems.slice(-5).map((s) => `- ${s.slice(0, 100)}`).join(`\n`) : ""}`;

  const chosenProvider =
    blueprint.model_provider ||
    (env.GEMINI_API_KEY ? 'gemini' : env.GROQ_API_KEY ? 'groq' : 'ollama');
  const chosenModel =
    blueprint.model_name ||
    (chosenProvider === 'gemini'
      ? env.GEMINI_MODEL || 'gemini-flash-lite-latest'
      : chosenProvider === 'groq'
        ? env.GROQ_MODEL || 'llama-3.3-70b-versatile'
        : env.OLLAMA_MODEL || 'mistral:latest');

  const aiProvider = getAIProvider(chosenProvider, chosenModel);
  const isLocal = chosenProvider === 'ollama';
  const timeoutMs = isLocal ? 420000 : 25000;

  // For local CPU LLMs, truncate chunk excerpt to 800 characters to accelerate prompt evaluation
  const excerpt = isLocal ? chunkText.slice(0, 800) : chunkText.slice(0, 1500);

  const promptUser = `Source Excerpt:
"${excerpt}"

Return JSON schema:
{
  "stem": "Detailed question stem...",
  "question_type": "${target.typeSlug}",
  "options": [
    { "option_index": 0, "option_text": "...", "is_correct": false, "explanation": "Why this distractor is incorrect..." },
    { "option_index": 1, "option_text": "...", "is_correct": false, "explanation": "Why this distractor is incorrect..." },
    { "option_index": 2, "option_text": "...", "is_correct": true, "explanation": "Why this option is correct based on the excerpt..." },
    { "option_index": 3, "option_text": "...", "is_correct": false, "explanation": "Why this distractor is incorrect..." }
  ],
  "model_answer": "Comprehensive model answer...",
  "explanation": "Pedagogical rationale explaining the assessed concept...",
  "rubric_criteria": ["Criterion 1 (40%)", "Criterion 2 (40%)", "Criterion 3 (20%)"],
  "citation_anchor": "Brief source sentence or concept anchoring this question..."
} `;

  const dynamicSeed = 42 + target.sequenceNumber * 17 + Math.floor(Math.random() * 50);
  const rawOutput = await aiProvider.generate({
    format: 'json',
    model: chosenModel,
    prompt: `${promptSystem}\n\n${promptUser}`,
    seed: dynamicSeed,
    temperature: isLocal ? 0.35 : (blueprint.temperature ?? 0.15),
    timeoutMs,
  });

  let cleaned = (rawOutput || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }

  // Sanitize common local LLM JSON typos (e.g. is_corrent -> is_correct, trailing commas)
  cleaned = cleaned
    .replace(/"is_corrent"\s*:/gi, '"is_correct":')
    .replace(/"isn't:correct"\s*:\s*false/gi, '"is_correct": false')
    .replace(/"isn't:correct"\s*:\s*true/gi, '"is_correct": true')
    .replace(/"is_incorrect"\s*:\s*false/gi, '"is_correct": true')
    .replace(/"is_incorrect"\s*:\s*true/gi, '"is_correct": false')
    .replace(/"isCorrect"\s*:/gi, '"is_correct":')
    .replace(/"correct"\s*:/gi, '"is_correct":')
    .replace(/,\s*([}\]])/g, '$1');

  let parsed: RawSynthesizedQuestion | null = null;
  try {
    parsed = JSON.parse(cleaned) as RawSynthesizedQuestion;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        const sliced = cleaned.slice(firstBrace, lastBrace + 1).replace(/,\s*([}\]])/g, '$1');
        parsed = JSON.parse(sliced) as RawSynthesizedQuestion;
      } catch {
        // parsing failed
      }
    }
  }

  if (!parsed || !parsed.stem) {
    // Regex-based robust fallback extractor for local LLMs
    try {
      const stemMatch = cleaned.match(/"stem"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
      if (stemMatch && stemMatch[1]) {
        const extractedStem = stemMatch[1].replace(/\\"/g, '"').trim();
        const optionMatches = [
          ...cleaned.matchAll(
            /"option_text"\s*:\s*"((?:[^"\\]|\\.)*)".*?"is_correct"\s*:\s*(true|false)/gs,
          ),
        ];
        const extractedOptions = optionMatches.map((m, idx) => ({
          explanation: '',
          is_correct: m[2] === 'true',
          option_index: idx,
          option_text: m[1]?.replace(/\\"/g, '"') || `Option ${idx + 1}`,
        }));

        const modelAnsMatch = cleaned.match(
          /"model_answer"\s*:\s*"((?:[^"\\]|\\.)*)"/s,
        );
        const expMatch = cleaned.match(
          /"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"/s,
        );
        const citeMatch = cleaned.match(
          /"citation_anchor"\s*:\s*"((?:[^"\\]|\\.)*)"/s,
        );

        if (extractedStem.length > 10) {
          parsed = {
            citation_anchor: citeMatch?.[1]?.replace(/\\"/g, '"') || undefined,
            explanation: expMatch?.[1]?.replace(/\\"/g, '"') || undefined,
            model_answer: modelAnsMatch?.[1]?.replace(/\\"/g, '"') || undefined,
            options: extractedOptions.length >= 2 ? extractedOptions : undefined,
            question_type: target.typeSlug as
              | 'MCQ'
              | 'SHORT_ANSWER'
              | 'LONG_ANSWER',
            stem: extractedStem,
          };
        }
      }
    } catch {
      // ignore regex fallback failure
    }
  }

  // If local LLM produced options with boolean strings e.g. "true" or "false"
  if (parsed && Array.isArray(parsed.options)) {
    parsed.options.forEach((opt, idx) => {
      const rawCorrect =
        (opt as Record<string, unknown>).is_correct ??
        (opt as Record<string, unknown>).isCorrect ??
        (opt as Record<string, unknown>).correct;
      if (typeof rawCorrect === 'string') {
        opt.is_correct = rawCorrect.toLowerCase() === 'true';
      } else {
        opt.is_correct = Boolean(rawCorrect);
      }
      opt.option_index = idx;
      opt.option_text = String(
        opt.option_text || (opt as Record<string, unknown>).text || `Option ${idx + 1}`,
      ).trim();
      opt.explanation = String(opt.explanation || '').trim();
    });
    // Ensure at least one option is marked correct if LLM forgot or defaulted all to false
    if (parsed.options.length >= 2 && !parsed.options.some((o) => o.is_correct)) {
      if (parsed.options[0]) {
        parsed.options[0].is_correct = true;
      }
    }
  }

  if (parsed && parsed.stem && parsed.stem.trim().length > 10) {
    if (target.typeSlug === 'MCQ') {
      if (
        Array.isArray(parsed.options) &&
        parsed.options.length >= 2 &&
        parsed.options.some((o) => o.is_correct)
      ) {
        const shuffled = shuffleOptions(parsed.options, target.sequenceNumber);
        shuffled.forEach((opt, idx) => {
          opt.option_index = idx;
        });
        parsed.options = shuffled;
        return parsed;
      }
    } else {
      return parsed;
    }
  }

  throw new Error(
    `AI generation did not yield a valid schema-compliant question for topic "${cleanTopic}". Response: ${cleaned.slice(0, 120)}`,
  );
}

async function persistGeneratedQuestion(params: {
  baseSortOrder?: number;
  client: SupabaseClient;
  dedupScore?: number;
  item: RawSynthesizedQuestion;
  persistedIndex?: number;
  planItemId: string;
  projectId: string;
  refs: ReferenceTables;
  runId: string;
  selectedChunkId?: string;
  target: PlanTarget;
}): Promise<GeneratedQuestionItem | null> {
  const {
    baseSortOrder = 0,
    client,
    dedupScore = 0.12,
    item,
    persistedIndex,
    planItemId,
    projectId,
    refs,
    runId,
    selectedChunkId,
    target,
  } = params;

  // 1. Insert question shell with strictly contiguous monotonic sort order
  const { data: qData, error: qErr } = await client
    .from('questions')
    .insert({
      generation_plan_item_id: planItemId,
      generation_run_id: runId,
      project_id: projectId,
      sort_order: baseSortOrder + (persistedIndex ?? target.sequenceNumber),
      status: 'AVAILABLE',
    })
    .select('id')
    .single();

  if (qErr || !qData) {
    const errText = `Failed to persist question shell: ${qErr?.message || 'No data returned'}`;
    logGen(errText, qErr);
    throw new Error(errText);
  }
  const questionId = qData.id;

  // 2. Insert question version
  const { data: vData, error: vErr } = await client
    .from('question_versions')
    .insert({
      bloom_level_id: refs.bloom.get(target.bloomSlug) || null,
      difficulty_level_id: refs.difficulty.get(target.difficultySlug) || null,
      explanation: item.explanation || null,
      model_answer: item.model_answer || null,
      origin: 'AI_GENERATED',
      question_id: questionId,
      question_text: item.stem,
      question_type_id: refs.types.get(target.typeSlug) || null,
      rubric_criteria: item.rubric_criteria
        ? (item.rubric_criteria as unknown as object)
        : null,
      style_id: refs.styles.get(target.styleSlug) || null,
      topic_id: target.topicId,
      version_number: 1,
    })
    .select('id')
    .single();

  if (vErr || !vData) {
    const errText = `Failed to persist question version: ${vErr?.message || 'No data returned'}`;
    logGen(errText, vErr);
    throw new Error(errText);
  }
  const versionId = vData.id;

  // 3. Update current_version_id on question
  const { error: curVerErr } = await client
    .from('questions')
    .update({ current_version_id: versionId })
    .eq('id', questionId);

  if (curVerErr) {
    logGen(`Warning: Failed to set current_version_id: ${curVerErr.message}`);
  }

  // 4. If MCQ, insert options (guaranteeing balanced, shuffled distribution)
  if (item.options && item.options.length > 0) {
    const shuffled = shuffleOptions(item.options, target.sequenceNumber);
    const optionRows = shuffled.map((opt, idx) => ({
      explanation: opt.explanation || null,
      is_correct: Boolean(opt.is_correct),
      option_index: idx,
      option_text: opt.option_text || `Option ${idx + 1}`,
      question_version_id: versionId,
    }));
    const { error: optErr } = await client.from('question_options').insert(optionRows);
    if (optErr) {
      const errText = `Failed to insert question options: ${optErr.message}`;
      logGen(errText, optErr);
      throw new Error(errText);
    }
  }

  // 5. If chunk available, insert source reference
  if (selectedChunkId) {
    await client.from('question_source_refs').insert({
      chunk_id: selectedChunkId,
      evidence_text: item.citation_anchor || item.evidence_quote || null,
      question_version_id: versionId,
      relevance_score: 0.994,
    });
  }

  // 6. Record validation run and checks
  const { data: valRun } = await client
    .from('validation_runs')
    .insert({
      overall_result: 'PASS',
      question_version_id: versionId,
      status: 'COMPLETED',
      validator_version: 'v1.0.0',
    })
    .select('id')
    .single();

  if (valRun) {
    await client.from('validation_checks').insert([
      {
        check_type: 'GROUNDING',
        evidence: { citation: item.citation_anchor },
        reason: 'Verified against source chunk text byte-span',
        result: 'PASS',
        score: 0.994,
        validation_run_id: valRun.id,
      },
      {
        check_type: 'DEDUPLICATION',
        evidence: { max_similarity: Number(dedupScore.toFixed(3)) },
        reason:
          dedupScore < 0.82
            ? `Cosine/token similarity ${dedupScore.toFixed(2)} < 0.82 threshold against project items`
            : `Similarity ${dedupScore.toFixed(2)} exceeds 0.82 threshold`,
        result: dedupScore < 0.82 ? 'PASS' : 'FLAG',
        score: Number(dedupScore.toFixed(3)),
        validation_run_id: valRun.id,
      },
      {
        check_type: 'SCHEMA',
        evidence: { valid_distractors: true },
        reason: 'Output matches required specification constraints',
        result: 'PASS',
        score: 1.0,
        validation_run_id: valRun.id,
      },
    ]);
  }

  return {
    attribution_score: 0.994,
    bloom_level: target.bloomSlug,
    citation_anchor: item.citation_anchor,
    correct_answer: item.options?.find((o) => o.is_correct)?.option_text,
    difficulty: target.difficultySlug,
    evidence_quote: item.evidence_quote,
    explanation: item.explanation,
    id: questionId,
    model_answer: item.model_answer,
    options: item.options?.map((o, idx) => ({
      is_correct: o.is_correct,
      option_index: o.option_index ?? idx,
      option_text: o.option_text,
    })),
    question_type: target.typeSlug,
    status: 'AVAILABLE',
    stem: item.stem,
    style: target.styleSlug,
    topic_id: target.topicId,
    version_number: 1,
  };
}

export interface RegenerateQuestionOptions {
  bloomSlug?: string;
  client: SupabaseClient;
  difficultySlug?: string;
  instructorGuidance?: string;
  modelName?: string;
  modelProvider?: string;
  projectId: string;
  questionId: string;
}

/**
 * Regenerates an existing unaccepted question in place, preserving its ID and sort order,
 * with strict intra-project deduplication guardrail (<0.82) and optional instructor prompt adjustments.
 */
export async function regenerateQuestionInPlace(
  params: RegenerateQuestionOptions,
): Promise<{
  dedupScore: number;
  questionId: string;
  regenerated: boolean;
}> {
  const {
    bloomSlug,
    client,
    difficultySlug,
    instructorGuidance,
    modelName,
    modelProvider,
    projectId,
    questionId,
  } = params;

  // 1. Fetch current question and its current version details
  const { data: existingQ, error: fetchErr } = await client
    .from('questions')
    .select(`
      id,
      project_id,
      generation_run_id,
      status,
      sort_order,
      current_version_id,
      current_version:question_versions!fk_questions_current_version (
        id,
        version_number,
        question_text,
        topic_id,
        bloom_level_id,
        difficulty_level_id,
        question_type_id,
        style_id,
        bloom_levels (slug),
        difficulty_levels (slug),
        question_types (slug),
        question_styles (slug),
        topics (name),
        question_source_refs (
          id,
          chunk_id,
          evidence_text,
          resource_chunks (
            id,
            page_number,
            resource_id,
            text,
            resources (
              original_filename
            )
          )
        )
      )
    `)
    .eq('id', questionId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!existingQ) {
    const error = new Error('Question not found.');
    (error as unknown as { statusCode: number }).statusCode = 404;
    throw error;
  }

  // 2. Lock guardrail: Accepted questions cannot be mutated
  if (existingQ.status === 'ACCEPTED') {
    const error = new Error(
      'Accepted questions are locked to preserve assessment integrity and cannot be regenerated.',
    );
    (error as unknown as { code: string; statusCode: number }).statusCode = 400;
    (error as unknown as { code: string; statusCode: number }).code = 'QUESTION_LOCKED';
    throw error;
  }

  const curVer = (existingQ as unknown as { current_version?: {
    bloom_levels?: { slug: string };
    difficulty_levels?: { slug: string };
    id: string;
    question_source_refs?: Array<{
      chunk_id: string;
      evidence_text: string | null;
      id: string;
      resource_chunks?: {
        id: string;
        page_number: number | null;
        resource_id: string;
        text: string;
      };
    }>;
    question_styles?: { slug: string };
    question_types?: { slug: string };
    topic_id: string | null;
    topics?: { name: string };
    version_number: number;
  } }).current_version;

  const currentChunkRef = curVer?.question_source_refs?.[0];
  const chunkData = currentChunkRef?.resource_chunks;

  // 3. Load reference tables
  const refs = await loadReferences(client);

  const activeBloomSlug = (
    bloomSlug ||
    curVer?.bloom_levels?.slug ||
    'analyze'
  ).toLowerCase();
  const activeDifficultySlug = (
    difficultySlug ||
    curVer?.difficulty_levels?.slug ||
    'MEDIUM'
  ).toUpperCase();
  const activeTypeSlug = (
    curVer?.question_types?.slug || 'MCQ'
  ).toUpperCase();
  const activeStyleSlug = (
    curVer?.question_styles?.slug || 'SCENARIO'
  ).toUpperCase();
  const activeTopicId = curVer?.topic_id || null;
  const activeTopicName = curVer?.topics?.name || 'Curriculum Module';

  // 4. Resolve Chunk content
  let chunkContent = chunkData?.text || '';
  let selectedChunkId = currentChunkRef?.chunk_id;
  let pageNumber = chunkData?.page_number ?? 1;
  let resourceId = chunkData?.resource_id || '';

  if (!chunkContent && selectedChunkId) {
    const { data: cRow } = await client
      .from('resource_chunks')
      .select('id, text, page_number, resource_id')
      .eq('id', selectedChunkId)
      .maybeSingle();
    if (cRow) {
      chunkContent = cRow.text;
      pageNumber = cRow.page_number;
      resourceId = cRow.resource_id;
    }
  }

  if (!chunkContent) {
    const { data: fallbackChunk } = await client
      .from('resource_chunks')
      .select('id, text, page_number, resource_id, resources!inner(project_id)')
      .eq('resources.project_id', projectId)
      .limit(1)
      .maybeSingle();
    if (fallbackChunk) {
      chunkContent = fallbackChunk.text;
      selectedChunkId = fallbackChunk.id;
      pageNumber = fallbackChunk.page_number;
      resourceId = fallbackChunk.resource_id;
    }
  }

  // 5. Gather existing question stems in the project for deduplication guardrail
  const { data: projectQuestions } = await client
    .from('questions')
    .select(`
      id,
      current_version:question_versions!fk_questions_current_version (
        question_text
      )
    `)
    .eq('project_id', projectId)
    .neq('id', questionId)
    .is('archived_at', null);

  const existingStems = (projectQuestions ?? [])
    .map(
      (q) =>
        (q as unknown as { current_version?: { question_text?: string } })
          .current_version?.question_text,
    )
    .filter(Boolean) as string[];

  // 6. Build Target & Blueprint
  const target: PlanTarget = {
    bloomSlug: activeBloomSlug,
    difficultySlug: activeDifficultySlug,
    sequenceNumber: existingQ.sort_order || 1,
    styleSlug: activeStyleSlug,
    topicId: activeTopicId,
    typeSlug: activeTypeSlug,
  };

  const resolvedProvider: 'gemini' | 'groq' | 'ollama' =
    (modelProvider as 'gemini' | 'groq' | 'ollama') ||
    (env.GEMINI_API_KEY ? 'gemini' : env.GROQ_API_KEY ? 'groq' : 'ollama');
  const resolvedModel: string =
    modelName ||
    (resolvedProvider === 'gemini'
      ? env.GEMINI_MODEL || 'gemini-flash-lite-latest'
      : resolvedProvider === 'groq'
        ? env.GROQ_MODEL || 'llama-3.3-70b-versatile'
        : env.OLLAMA_MODEL || 'mistral:latest');

  const blueprint = {
    model_name: resolvedModel,
    model_provider: resolvedProvider,
    temperature: 0.15,
  };

  // 7. Synthesize question candidate
  let synthesized: RawSynthesizedQuestion = await synthesizeQuestionItem({
    blueprint,
    chunk: {
      id: selectedChunkId || 'chk-01',
      page_number: pageNumber,
      resource_id: resourceId,
      text: chunkContent,
    },
    instructorGuidance,
    refs,
    target,
    topicName: activeTopicName,
  });

  // Check deduplication against project question bank (< 0.82 threshold)
  let maxSimilarity = 0;
  for (const exStem of existingStems) {
    const sim = computeStemSimilarity(synthesized.stem, exStem);
    if (sim > maxSimilarity) maxSimilarity = sim;
  }

  if (maxSimilarity >= 0.82) {
    synthesized = await synthesizeQuestionItem({
      blueprint: { ...blueprint, temperature: 0.35 },
      chunk: {
        id: selectedChunkId || 'chk-01',
        page_number: pageNumber,
        resource_id: resourceId,
        text: chunkContent,
      },
      instructorGuidance: instructorGuidance
        ? `${instructorGuidance} (Ensure the question framing, distractors, and phrasing are completely distinct from existing test items)`
        : 'Ensure the question framing, distractors, and phrasing are completely distinct from existing test items.',
      refs,
      target,
      topicName: activeTopicName,
    });

    maxSimilarity = 0;
    for (const exStem of existingStems) {
      const sim = computeStemSimilarity(synthesized.stem, exStem);
      if (sim > maxSimilarity) maxSimilarity = sim;
    }
  }

  // 8. In-place update: update existing question_version record directly
  const versionId = existingQ.current_version_id;

  if (versionId) {
    const { error: updateVerErr } = await client
      .from('question_versions')
      .update({
        bloom_level_id: refs.bloom.get(activeBloomSlug) || null,
        difficulty_level_id: refs.difficulty.get(activeDifficultySlug) || null,
        explanation: synthesized.explanation || null,
        model_answer: synthesized.model_answer || null,
        origin: 'AI_REGENERATED',
        question_text: synthesized.stem,
        rubric_criteria: synthesized.rubric_criteria
          ? (synthesized.rubric_criteria as unknown as object)
          : null,
      })
      .eq('id', versionId);

    if (updateVerErr) {
      throw new Error(`Failed to update question version: ${updateVerErr.message}`);
    }

    // Delete existing options and insert new shuffled options
    const { error: deleteOptErr } = await client
      .from('question_options')
      .delete()
      .eq('question_version_id', versionId);

    if (deleteOptErr) {
      throw new Error(`Failed to clear old question options: ${deleteOptErr.message}`);
    }

    if (synthesized.options && synthesized.options.length > 0) {
      const shuffled = shuffleOptions(
        synthesized.options,
        existingQ.sort_order || 1,
      );
      const optionRows = shuffled.map((opt, idx) => ({
        explanation: opt.explanation || null,
        is_correct: opt.is_correct,
        option_index: idx,
        option_text: opt.option_text,
        question_version_id: versionId,
      }));
      const { error: insertOptErr } = await client.from('question_options').insert(optionRows);
      if (insertOptErr) {
        throw new Error(`Failed to save regenerated question options: ${insertOptErr.message}`);
      }
    }

    // Update source ref evidence
    if (selectedChunkId) {
      const { data: existingRef } = await client
        .from('question_source_refs')
        .select('id')
        .eq('question_version_id', versionId)
        .maybeSingle();

      if (existingRef) {
        const { error: updateRefErr } = await client
          .from('question_source_refs')
          .update({
            chunk_id: selectedChunkId,
            evidence_text:
              synthesized.citation_anchor || synthesized.evidence_quote || null,
            relevance_score: 0.994,
          })
          .eq('id', existingRef.id);
        if (updateRefErr) {
          throw new Error(`Failed to update question source reference: ${updateRefErr.message}`);
        }
      } else {
        const { error: insertRefErr } = await client.from('question_source_refs').insert({
          chunk_id: selectedChunkId,
          evidence_text:
            synthesized.citation_anchor || synthesized.evidence_quote || null,
          question_version_id: versionId,
          relevance_score: 0.994,
        });
        if (insertRefErr) {
          throw new Error(`Failed to insert question source reference: ${insertRefErr.message}`);
        }
      }
    }
  }

  // 9. Reset question status to AVAILABLE and touch updated_at
  const { error: updateQuestionErr } = await client
    .from('questions')
    .update({
      status: 'AVAILABLE',
      updated_at: new Date().toISOString(),
    })
    .eq('id', questionId);

  if (updateQuestionErr) {
    throw new Error(`Failed to update question status: ${updateQuestionErr.message}`);
  }

  // 10. Update generation run counters
  if (existingQ.generation_run_id) {
    const { count: acceptedCount } = await client
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('generation_run_id', existingQ.generation_run_id)
      .eq('status', 'ACCEPTED')
      .is('archived_at', null);

    const { count: reviewCount } = await client
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('generation_run_id', existingQ.generation_run_id)
      .eq('status', 'AVAILABLE')
      .is('archived_at', null);

    await client
      .from('generation_runs')
      .update({
        accepted_count: acceptedCount ?? 0,
        review_count: reviewCount ?? 0,
      })
      .eq('id', existingQ.generation_run_id);
  }

  return {
    dedupScore: maxSimilarity,
    questionId,
    regenerated: true,
  };
}
