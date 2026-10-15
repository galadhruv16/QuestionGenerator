import { Router } from 'express';
import {
  bulkRegenerateQuestionsSchema,
  bulkUpdateQuestionsStatusSchema,
  createQuestionVersionSchema,
  regenerateQuestionSchema,
  updateQuestionStatusSchema,
} from '@groundq/contracts';
import { z } from 'zod';
import { createSupabaseUserClient } from '../lib/supabase.js';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/require-auth.js';
import { regenerateQuestionInPlace } from '../services/question-generator.js';

const uuidSchema = z.string().uuid();

const questionsQuerySchema = z.object({
  cursor: z.string().optional(),
  generation_run_id: z.string().uuid().optional(),
  include_archived: z.enum(['true', 'false']).default('false'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  status: z.string().optional(),
  topic_id: z.string().uuid().optional(),
});

const getParams = (request: unknown) =>
  (request as { params: { projectId?: string; questionId?: string } }).params;

export const questionsRouter = Router({ mergeParams: true });

questionsRouter.use(requireAuth);

const QUESTION_DETAIL_SELECT = `
  id,
  project_id,
  generation_run_id,
  status,
  sort_order,
  created_at,
  archived_at,
  current_version:question_versions!fk_questions_current_version (
    id,
    version_number,
    question_text,
    model_answer,
    explanation,
    rubric_criteria,
    topic_id,
    origin,
    topics (name),
    bloom_levels (slug, name),
    difficulty_levels (slug, name),
    question_types (slug, name),
    question_styles (slug, name),
    question_options (id, option_index, option_text, is_correct, explanation),
    question_source_refs (
      id,
      evidence_text,
      relevance_score,
      chunk_id,
      resource_chunks (
        id,
        page_number,
        resource_id,
        resources (
          original_filename
        )
      )
    ),
    validation_runs (
      id,
      overall_result,
      status,
      validator_version,
      validation_checks (
        id,
        check_type,
        result,
        score,
        reason,
        evidence
      )
    )
  )
`;

async function updateRunCounters(
  client: ReturnType<typeof createSupabaseUserClient>,
  runId: string,
) {
  const { count: acceptedCount } = await client
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('generation_run_id', runId)
    .eq('status', 'ACCEPTED')
    .is('archived_at', null);

  const { count: reviewCount } = await client
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('generation_run_id', runId)
    .eq('status', 'AVAILABLE')
    .is('archived_at', null);

  await client
    .from('generation_runs')
    .update({
      accepted_count: acceptedCount ?? 0,
      review_count: reviewCount ?? 0,
    })
    .eq('id', runId);
}

/**
 * GET /api/v1/projects/:projectId/questions
 */
questionsRouter.get('/', async (request, response, next) => {
  const { projectId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  if (!parsedProjectId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Invalid project ID format.',
      },
    });
  }

  const parsedQuery = questionsQuerySchema.safeParse(request.query);
  if (!parsedQuery.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: parsedQuery.error.flatten(),
        message: 'Invalid query parameters.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);
    const { generation_run_id, include_archived, limit, status, topic_id } =
      parsedQuery.data;

    let query = client
      .from('questions')
      .select(QUESTION_DETAIL_SELECT)
      .eq('project_id', parsedProjectId.data)
      .order('sort_order', { ascending: true })
      .limit(limit);

    if (include_archived === 'false') {
      query = query.is('archived_at', null);
    }
    if (generation_run_id) {
      query = query.eq('generation_run_id', generation_run_id);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (topic_id) {
      query = query.eq('current_version.topic_id', topic_id);
    }

    const { data: questions, error } = await query;

    if (error) throw error;

    return response.json({
      data: questions ?? [],
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/projects/:projectId/questions/bulk-status
 */
questionsRouter.post('/bulk-status', async (request, response, next) => {
  const { projectId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  if (!parsedProjectId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Invalid project ID format.',
      },
    });
  }

  const parsedBody = bulkUpdateQuestionsStatusSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: parsedBody.error.flatten(),
        message: 'Invalid bulk update request.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);
    const { question_ids, status } = parsedBody.data;

    // Update questions
    const { data: updatedQuestions, error: updateError } = await client
      .from('questions')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', question_ids)
      .eq('project_id', parsedProjectId.data)
      .select('id, generation_run_id');

    if (updateError) throw updateError;

    // Recalculate metrics on all unique generation runs
    const runIds = Array.from(
      new Set(
        (updatedQuestions ?? [])
          .map((q) => q.generation_run_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    for (const rId of runIds) {
      await updateRunCounters(client, rId);
    }

    return response.json({
      data: {
        updated_count: updatedQuestions?.length ?? 0,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/projects/:projectId/questions/bulk-regenerate
 * Sequentially regenerates unaccepted questions in place with deduplication check
 */
questionsRouter.post('/bulk-regenerate', async (request, response, next) => {
  const { projectId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  if (!parsedProjectId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Invalid project ID format.',
      },
    });
  }

  const parsedBody = bulkRegenerateQuestionsSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: parsedBody.error.flatten(),
        message: 'Invalid bulk regenerate request payload.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);
    const {
      bloom_slug,
      difficulty_slug,
      instructor_guidance,
      model_name,
      model_provider,
      question_ids,
    } = parsedBody.data;

    // Check which questions are eligible (skip ACCEPTED questions per invariant)
    const { data: questionsToRegen, error: fetchErr } = await client
      .from('questions')
      .select('id, status')
      .in('id', question_ids)
      .eq('project_id', parsedProjectId.data)
      .is('archived_at', null);

    if (fetchErr) throw fetchErr;

    const eligible = (questionsToRegen ?? []).filter(
      (q) => q.status !== 'ACCEPTED',
    );
    const skippedAccepted = (questionsToRegen ?? []).filter(
      (q) => q.status === 'ACCEPTED',
    );

    const regeneratedQuestions = [];
    for (const q of eligible) {
      await regenerateQuestionInPlace({
        bloomSlug: bloom_slug,
        client,
        difficultySlug: difficulty_slug,
        instructorGuidance: instructor_guidance,
        modelName: model_name,
        modelProvider: model_provider,
        projectId: parsedProjectId.data,
        questionId: q.id,
      });

      const { data: fullQ } = await client
        .from('questions')
        .select(QUESTION_DETAIL_SELECT)
        .eq('id', q.id)
        .single();

      if (fullQ) regeneratedQuestions.push(fullQ);
    }

    return response.json({
      data: {
        questions: regeneratedQuestions,
        regenerated_count: regeneratedQuestions.length,
        skipped_accepted_count: skippedAccepted.length,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/v1/projects/:projectId/questions/:questionId
 */
questionsRouter.get('/:questionId', async (request, response, next) => {
  const { projectId, questionId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  const parsedQuestionId = uuidSchema.safeParse(questionId);
  if (!parsedProjectId.success || !parsedQuestionId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Invalid project or question ID format.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    const { data: question, error } = await client
      .from('questions')
      .select(QUESTION_DETAIL_SELECT)
      .eq('id', parsedQuestionId.data)
      .eq('project_id', parsedProjectId.data)
      .maybeSingle();

    if (error) throw error;
    if (!question) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          details: {},
          message: 'Question not found.',
        },
      });
    }

    return response.json({
      data: question,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * PATCH /api/v1/projects/:projectId/questions/:questionId
 * Update status or archive question
 */
questionsRouter.patch('/:questionId', async (request, response, next) => {
  const { projectId, questionId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  const parsedQuestionId = uuidSchema.safeParse(questionId);
  if (!parsedProjectId.success || !parsedQuestionId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Invalid project or question ID format.',
      },
    });
  }

  const parsedBody = updateQuestionStatusSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: parsedBody.error.flatten(),
        message: 'Invalid update body.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (parsedBody.data.status !== undefined) {
      updatePayload.status = parsedBody.data.status;
    }
    if (parsedBody.data.archived_at !== undefined) {
      updatePayload.archived_at = parsedBody.data.archived_at;
    }

    const { data: updatedQuestion, error: updateError } = await client
      .from('questions')
      .update(updatePayload)
      .eq('id', parsedQuestionId.data)
      .eq('project_id', parsedProjectId.data)
      .select('id, generation_run_id')
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updatedQuestion) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          details: {},
          message: 'Question not found.',
        },
      });
    }

    if (updatedQuestion.generation_run_id) {
      await updateRunCounters(client, updatedQuestion.generation_run_id);
    }

    // Fetch full question detail
    const { data: fullQuestion, error: fetchError } = await client
      .from('questions')
      .select(QUESTION_DETAIL_SELECT)
      .eq('id', parsedQuestionId.data)
      .single();

    if (fetchError) throw fetchError;

    return response.json({
      data: fullQuestion,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/projects/:projectId/questions/:questionId/versions
 * Creates a new manual revision of a question, preserving provenance and version history
 */
questionsRouter.post('/:questionId/versions', async (request, response, next) => {
  const { projectId, questionId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  const parsedQuestionId = uuidSchema.safeParse(questionId);
  if (!parsedProjectId.success || !parsedQuestionId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Invalid project or question ID format.',
      },
    });
  }

  const parsedBody = createQuestionVersionSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: parsedBody.error.flatten(),
        message: 'Invalid question version payload.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    // Fetch current question and version
    const { data: currentQ, error: fetchErr } = await client
      .from('questions')
      .select(
        `
        id,
        current_version_id,
        current_version:question_versions!fk_questions_current_version (
          version_number,
          bloom_level_id,
          difficulty_level_id,
          question_type_id,
          style_id,
          topic_id
        )
      `,
      )
      .eq('id', parsedQuestionId.data)
      .eq('project_id', parsedProjectId.data)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!currentQ) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          details: {},
          message: 'Question not found.',
        },
      });
    }

    const curVer = (currentQ as unknown as { current_version?: {
      bloom_level_id: string | null;
      difficulty_level_id: string | null;
      question_type_id: string | null;
      style_id: string | null;
      topic_id: string | null;
      version_number: number;
    } }).current_version;

    const nextVersionNumber = (curVer?.version_number ?? 1) + 1;

    // Insert new version
    const { data: newVersion, error: vInsertError } = await client
      .from('question_versions')
      .insert({
        bloom_level_id: curVer?.bloom_level_id || null,
        created_by: authReq.authUser.id,
        difficulty_level_id: curVer?.difficulty_level_id || null,
        explanation: parsedBody.data.explanation || null,
        model_answer: parsedBody.data.model_answer || null,
        origin: 'INSTRUCTOR_EDITED',
        question_id: parsedQuestionId.data,
        question_text: parsedBody.data.question_text,
        question_type_id: curVer?.question_type_id || null,
        rubric_criteria: parsedBody.data.rubric_criteria
          ? (parsedBody.data.rubric_criteria as unknown as object)
          : null,
        style_id: curVer?.style_id || null,
        topic_id: curVer?.topic_id || null,
        version_number: nextVersionNumber,
      })
      .select('id')
      .single();

    if (vInsertError) throw vInsertError;

    // If options provided, insert them
    if (parsedBody.data.options && parsedBody.data.options.length > 0) {
      const optionsToInsert = parsedBody.data.options.map((opt, idx) => ({
        explanation: opt.explanation || null,
        is_correct: opt.is_correct,
        option_index: opt.option_index ?? idx,
        option_text: opt.option_text,
        question_version_id: newVersion.id,
      }));

      const { error: optErr } = await client
        .from('question_options')
        .insert(optionsToInsert);

      if (optErr) throw optErr;
    }

    // Update question current_version_id
    const { error: updateQErr } = await client
      .from('questions')
      .update({
        current_version_id: newVersion.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsedQuestionId.data);

    if (updateQErr) throw updateQErr;

    // Return the updated question detail
    const { data: fullQuestion, error: fullQErr } = await client
      .from('questions')
      .select(QUESTION_DETAIL_SELECT)
      .eq('id', parsedQuestionId.data)
      .single();

    if (fullQErr) throw fullQErr;

    return response.status(201).json({
      data: fullQuestion,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/projects/:projectId/questions/:questionId/regenerate
 * Regenerates an existing unaccepted question in place, updating its content and resetting to AVAILABLE
 */
questionsRouter.post('/:questionId/regenerate', async (request, response, next) => {
  const { projectId, questionId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  const parsedQuestionId = uuidSchema.safeParse(questionId);
  if (!parsedProjectId.success || !parsedQuestionId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Invalid project or question ID format.',
      },
    });
  }

  const parsedBody = regenerateQuestionSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: parsedBody.error.flatten(),
        message: 'Invalid regeneration payload.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);
    const {
      bloom_slug,
      difficulty_slug,
      instructor_guidance,
      model_name,
      model_provider,
    } = parsedBody.data;

    await regenerateQuestionInPlace({
      bloomSlug: bloom_slug,
      client,
      difficultySlug: difficulty_slug,
      instructorGuidance: instructor_guidance,
      modelName: model_name,
      modelProvider: model_provider,
      projectId: parsedProjectId.data,
      questionId: parsedQuestionId.data,
    });

    const { data: fullQuestion, error: fetchErr } = await client
      .from('questions')
      .select(QUESTION_DETAIL_SELECT)
      .eq('id', parsedQuestionId.data)
      .single();

    if (fetchErr) throw fetchErr;

    return response.json({
      data: fullQuestion,
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'QUESTION_LOCKED') {
      return response.status(400).json({
        error: {
          code: 'QUESTION_LOCKED',
          details: {},
          message: (error as Error).message,
        },
      });
    }
    return next(error);
  }
});

