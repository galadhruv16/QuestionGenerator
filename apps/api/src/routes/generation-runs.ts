import { Router } from 'express';
import {
  startGenerationRunSchema,
  type BlueprintConfiguration,
} from '@groundq/contracts';
import { z } from 'zod';
import {
  createSupabaseAdminClient,
  createSupabaseUserClient,
} from '../lib/supabase.js';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/require-auth.js';
import { executeGenerationRun } from '../services/question-generator.js';
import { normalizeModelTag } from '../ai/providers/ollama-provider.js';
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
    const projectId = parsedProjectId.data;

    // Verify project exists, belongs to authenticated user, and is not archived
    const { data: project, error: projectError } = await client
      .from('projects')
      .select('id, owner_id, archived_at')
      .eq('id', projectId)
      .eq('owner_id', authReq.authUser.id)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project || project.archived_at) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          details: {},
          message: 'Project not found or archived.',
        },
      });
    }

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
          (parsedBody.data.model_provider === 'gemini'
            ? env.GEMINI_MODEL || 'gemini-flash-lite-latest'
            : env.OLLAMA_MODEL || 'mistral:latest'),
        model_provider:
          parsedBody.data.model_provider || 'ollama',
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
      'ollama';

    if (effectiveProvider === 'gemini' && !env.GEMINI_API_KEY) {
      return response.status(400).json({
        error: {
          code: 'CONFIGURATION_ERROR',
          details: {},
          message:
            'Gemini provider requested but GEMINI_API_KEY is not configured on the server.',
        },
      });
    }

    if (effectiveProvider === 'groq' && !env.GROQ_API_KEY) {
      return response.status(400).json({
        error: {
          code: 'CONFIGURATION_ERROR',
          details: {},
          message:
            'Groq provider requested but GROQ_API_KEY is not configured on the server.',
        },
      });
    }

    const rawModel =
      parsedBody.data.model_name && parsedBody.data.model_name !== 'llama3'
        ? parsedBody.data.model_name
        : config.model_name && config.model_name !== 'llama3'
          ? config.model_name
          : effectiveProvider === 'gemini'
            ? env.GEMINI_MODEL || 'gemini-flash-lite-latest'
            : effectiveProvider === 'groq'
              ? env.GROQ_MODEL || 'llama-3.3-70b-versatile'
              : env.OLLAMA_MODEL || 'mistral:latest';

    const effectiveModel =
      effectiveProvider === 'ollama' ? normalizeModelTag(rawModel) : rawModel;

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

    // Obtain backend-only service-role client for detached background execution.
    // This decouples long-running model inference (which can take 20-30+ minutes)
    // from the user's ephemeral browser access token (JWT), preventing PGRST303 expiration.
    let backgroundClient;
    try {
      backgroundClient = createSupabaseAdminClient();
    } catch (adminClientErr) {
      const configErrMsg =
        adminClientErr instanceof Error
          ? adminClientErr.message
          : 'Backend service-role client configuration failed.';
      console.error(
        `[GenerationRun] Cannot initialize background admin client for run ${run.id}:`,
        configErrMsg,
      );
      await client
        .from('generation_runs')
        .update({
          completed_at: new Date().toISOString(),
          error_message: configErrMsg,
          status: 'FAILED',
        })
        .eq('id', run.id);

      return response.status(500).json({
        error: {
          code: 'CONFIGURATION_ERROR',
          details: {},
          message:
            'Background persistence cannot be initialized: SUPABASE_SERVICE_ROLE_KEY is missing or invalid on the server.',
        },
      });
    }

    // Kick off background execution asynchronously using the backend service-role client
    void executeGenerationRun({
      blueprint: config,
      client: backgroundClient,
      projectId: parsedProjectId.data,
      runId: run.id,
      userId: authReq.authUser.id,
    }).catch(async (err) => {
      console.error(
        `[GenerationRun] Background run ${run.id} encountered error:`,
        err,
      );
      try {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await backgroundClient
          .from('generation_runs')
          .update({
            completed_at: new Date().toISOString(),
            error_message: errorMsg,
            status: 'FAILED',
          })
          .eq('id', run.id);
      } catch (dbErr) {
        console.error(
          `[GenerationRun] Failed to persist fatal run error for ${run.id}:`,
          dbErr,
        );
      }
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
        .not('current_version_id', 'is', null)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const validQuestions = (questions ?? []).filter(
        (q: { current_version?: unknown }) => q.current_version != null,
      );

      return response.json({
        data: validQuestions,
      });
    } catch (error) {
      return next(error);
    }
  },
);
