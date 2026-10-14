import { Router } from 'express';
import {
  startGenerationRunSchema,
  type BlueprintConfiguration,
} from '@groundq/contracts';
import { z } from 'zod';
import { createSupabaseUserClient } from '../lib/supabase.js';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/require-auth.js';
import { executeGenerationRun } from '../services/question-generator.js';
import { env } from '../config/env.js';

const uuidSchema = z.string().uuid();

const getParams = (request: unknown) =>
  (request as { params: { projectId?: string; runId?: string } }).params;

export const generationRunsRouter = Router({ mergeParams: true });

generationRunsRouter.use(requireAuth);

/**
 * POST /api/v1/projects/:projectId/generation-runs
 * Start an asynchronous question generation run
 */
generationRunsRouter.post('/', async (request, response, next) => {
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

  const parsedBody = startGenerationRunSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: parsedBody.error.flatten(),
        message: 'Invalid generation run request.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    let config: BlueprintConfiguration;
    let blueprintId: string | null = null;

    if (parsedBody.data.blueprint_id) {
      blueprintId = parsedBody.data.blueprint_id;
      const { data: bp, error: bpError } = await client
        .from('generation_blueprints')
        .select('*')
        .eq('id', blueprintId)
        .eq('project_id', parsedProjectId.data)
        .maybeSingle();

      if (bpError) throw bpError;
      if (!bp) {
        return response.status(404).json({
          error: {
            code: 'NOT_FOUND',
            details: {},
            message: 'Blueprint not found.',
          },
        });
      }
      config = bp.configuration as BlueprintConfiguration;
    } else if (parsedBody.data.configuration) {
      config = parsedBody.data.configuration;
    } else {
      // Default balanced configuration
      config = {
        bloom: {
          analyze: 30,
          apply: 25,
          create: 5,
          evaluate: 15,
          remember: 10,
          understand: 15,
        },
        difficulty: {
          easy: 20,
          hard: 30,
          medium: 50,
        },
        duplicate_policy: 'PREVENT',
        model_name:
          parsedBody.data.model_name ||
          (env.GEMINI_API_KEY ? env.GEMINI_MODEL || 'gemini-flash-latest' : env.OLLAMA_MODEL || 'qwen2.5:7b'),
        model_provider:
          parsedBody.data.model_provider || (env.GEMINI_API_KEY ? 'gemini' : 'ollama'),
        question_count: 10,
        styles: {
          analytical: 40,
          conceptual: 20,
          scenario: 40,
        },
        temperature: 0.15,
        topics: {},
        types: {
          long_answer: 20,
          mcq: 50,
          short_answer: 30,
        },
      };
    }

    const effectiveProvider =
      parsedBody.data.model_provider ||
      config.model_provider ||
      (env.GEMINI_API_KEY ? 'gemini' : 'ollama');

    const effectiveModel =
      (parsedBody.data.model_name && parsedBody.data.model_name !== 'llama3'
        ? parsedBody.data.model_name
        : config.model_name && config.model_name !== 'llama3'
          ? config.model_name
          : effectiveProvider === 'gemini'
            ? env.GEMINI_MODEL || 'gemini-flash-latest'
            : env.OLLAMA_MODEL || 'qwen2.5:7b');

    config.model_provider = effectiveProvider;
    config.model_name = effectiveModel;

    const requestedCount = config.question_count || 10;

    // Create the generation run
    const { data: run, error: runError } = await client
      .from('generation_runs')
      .insert({
        blueprint_id: blueprintId,
        blueprint_snapshot: config,
        created_by: authReq.authUser.id,
        duplicate_policy: config.duplicate_policy || 'PREVENT',
        model_name: effectiveModel,
        model_provider: effectiveProvider,
        project_id: parsedProjectId.data,
        requested_count: requestedCount,
        status: 'QUEUED',
      })
      .select('*')
      .single();

    if (runError) throw runError;

    // Kick off background execution asynchronously
    void executeGenerationRun({
      blueprint: config,
      client,
      projectId: parsedProjectId.data,
      runId: run.id,
      userId: authReq.authUser.id,
    }).catch((err) => {
      console.error(
        `[GenerationRun] Background run ${run.id} encountered error:`,
        err,
      );
    });

    return response.status(202).json({
      data: {
        accepted_count: 0,
        id: run.id,
        requested_count: requestedCount,
        review_count: 0,
        status: 'QUEUED',
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/v1/projects/:projectId/generation-runs
 */
generationRunsRouter.get('/', async (request, response, next) => {
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

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    const { data: runs, error } = await client
      .from('generation_runs')
      .select('*')
      .eq('project_id', parsedProjectId.data)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return response.json({
      data: runs ?? [],
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/v1/projects/:projectId/generation-runs/:runId
 */
generationRunsRouter.get('/:runId', async (request, response, next) => {
  const { projectId, runId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  const parsedRunId = uuidSchema.safeParse(runId);
  if (!parsedProjectId.success || !parsedRunId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Invalid project or run ID format.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    const { data: run, error } = await client
      .from('generation_runs')
      .select('*')
      .eq('id', parsedRunId.data)
      .eq('project_id', parsedProjectId.data)
      .maybeSingle();

    if (error) throw error;
    if (!run) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          details: {},
          message: 'Generation run not found.',
        },
      });
    }

    // Fetch plan item completion count
    const { count: completedPlanItems } = await client
      .from('generation_plan_items')
      .select('*', { count: 'exact', head: true })
      .eq('generation_run_id', parsedRunId.data)
      .eq('status', 'COMPLETED');

    const { count: totalPlanItems } = await client
      .from('generation_plan_items')
      .select('*', { count: 'exact', head: true })
      .eq('generation_run_id', parsedRunId.data);

    return response.json({
      data: {
        ...run,
        progress: {
          completed_plan_items: completedPlanItems ?? run.accepted_count,
          total_plan_items: totalPlanItems ?? run.requested_count,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/v1/projects/:projectId/generation-runs/:runId/plan
 */
generationRunsRouter.get('/:runId/plan', async (request, response, next) => {
  const { projectId, runId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  const parsedRunId = uuidSchema.safeParse(runId);
  if (!parsedProjectId.success || !parsedRunId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Invalid project or run ID format.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    const { data: items, error } = await client
      .from('generation_plan_items')
      .select(
        `
        id,
        sequence_number,
        status,
        topic_id,
        topics (name),
        bloom_levels (slug, name),
        difficulty_levels (slug, name),
        question_types (slug, name),
        question_styles (slug, name)
      `,
      )
      .eq('generation_run_id', parsedRunId.data)
      .order('sequence_number', { ascending: true });

    if (error) throw error;

    return response.json({
      data: items ?? [],
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/v1/projects/:projectId/generation-runs/:runId/questions
 */
generationRunsRouter.get(
  '/:runId/questions',
  async (request, response, next) => {
    const { projectId, runId } = getParams(request);
    const parsedProjectId = uuidSchema.safeParse(projectId);
    const parsedRunId = uuidSchema.safeParse(runId);
    if (!parsedProjectId.success || !parsedRunId.success) {
      return response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          details: {},
          message: 'Invalid project or run ID format.',
        },
      });
    }

    try {
      const authReq = request as unknown as AuthenticatedRequest;
      const client = createSupabaseUserClient(authReq.accessToken);

      const { data: questions, error } = await client
        .from('questions')
        .select(
          `
        id,
        project_id,
        status,
        sort_order,
        created_at,
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
        .eq('generation_run_id', parsedRunId.data)
        .eq('project_id', parsedProjectId.data)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      return response.json({
        data: questions ?? [],
      });
    } catch (error) {
      return next(error);
    }
  },
);
