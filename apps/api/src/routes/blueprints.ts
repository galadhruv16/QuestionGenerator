import { Router } from 'express';
import {
  createBlueprintSchema,
  updateBlueprintSchema,
} from '@groundq/contracts';
import { z } from 'zod';
import { createSupabaseUserClient } from '../lib/supabase.js';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/require-auth.js';

const uuidSchema = z.string().uuid();

const getParams = (request: unknown) =>
  (request as { params: { blueprintId?: string; projectId?: string } }).params;

export const blueprintsRouter = Router({ mergeParams: true });

blueprintsRouter.use(requireAuth);

/**
 * GET /api/v1/projects/:projectId/blueprints
 */
blueprintsRouter.get('/', async (request, response, next) => {
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

    const { data: blueprints, error } = await client
      .from('generation_blueprints')
      .select('*')
      .eq('project_id', parsedProjectId.data)
      .is('archived_at', null)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return response.json({
      data: blueprints ?? [],
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/projects/:projectId/blueprints
 */
blueprintsRouter.post('/', async (request, response, next) => {
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

  const parsedBody = createBlueprintSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: parsedBody.error.flatten(),
        message: 'Invalid blueprint configuration.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    const { data: blueprint, error } = await client
      .from('generation_blueprints')
      .insert({
        configuration: parsedBody.data.configuration,
        created_by: authReq.authUser.id,
        name: parsedBody.data.name || null,
        project_id: parsedProjectId.data,
      })
      .select('*')
      .single();

    if (error) throw error;

    return response.status(201).json({
      data: blueprint,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/v1/projects/:projectId/blueprints/:blueprintId
 */
blueprintsRouter.get('/:blueprintId', async (request, response, next) => {
  const { blueprintId, projectId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  const parsedBlueprintId = uuidSchema.safeParse(blueprintId);
  if (!parsedProjectId.success || !parsedBlueprintId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Invalid project or blueprint ID format.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    const { data: blueprint, error } = await client
      .from('generation_blueprints')
      .select('*')
      .eq('id', parsedBlueprintId.data)
      .eq('project_id', parsedProjectId.data)
      .maybeSingle();

    if (error) throw error;
    if (!blueprint) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          details: {},
          message: 'Blueprint not found.',
        },
      });
    }

    return response.json({
      data: blueprint,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * PATCH /api/v1/projects/:projectId/blueprints/:blueprintId
 */
blueprintsRouter.patch('/:blueprintId', async (request, response, next) => {
  const { blueprintId, projectId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  const parsedBlueprintId = uuidSchema.safeParse(blueprintId);
  if (!parsedProjectId.success || !parsedBlueprintId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Invalid project or blueprint ID format.',
      },
    });
  }

  const parsedBody = updateBlueprintSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: parsedBody.error.flatten(),
        message: 'Invalid blueprint update payload.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (parsedBody.data.name !== undefined)
      updateData.name = parsedBody.data.name;
    if (parsedBody.data.configuration)
      updateData.configuration = parsedBody.data.configuration;

    const { data: blueprint, error } = await client
      .from('generation_blueprints')
      .update(updateData)
      .eq('id', parsedBlueprintId.data)
      .eq('project_id', parsedProjectId.data)
      .is('archived_at', null)
      .select('*')
      .single();

    if (error) throw error;

    return response.json({
      data: blueprint,
    });
  } catch (error) {
    return next(error);
  }
});
