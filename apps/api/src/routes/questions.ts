import { Router } from 'express';
import { z } from 'zod';
import { createSupabaseUserClient } from '../lib/supabase.js';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/require-auth.js';

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
    const { generation_run_id, include_archived, limit, status } =
      parsedQuery.data;

    let query = client
      .from('questions')
      .select(
        `
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
            chunk_id
          )
        )
      `,
      )
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
      .select(
        `
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
            chunk_id
          )
        )
      `,
      )
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
