import { Router } from 'express';
import { createPresetSchema, updatePresetSchema } from '@groundq/contracts';
import { z } from 'zod';
import { createSupabaseUserClient } from '../lib/supabase.js';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/require-auth.js';

const uuidSchema = z.string().uuid();

const getParams = (request: unknown) =>
  (request as { params: { presetId?: string; projectId?: string } }).params;

export const presetsRouter = Router({ mergeParams: true });

presetsRouter.use(requireAuth);

/**
 * GET /api/v1/projects/:projectId/presets
 * Returns available presets (system presets + user/project custom presets)
 */
presetsRouter.get('/', async (request, response, next) => {
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

    const { data: presets, error } = await client
      .from('generation_presets')
      .select('*')
      .or(
        `is_system.eq.true,and(owner_id.eq.${authReq.authUser.id},project_id.eq.${parsedProjectId.data})`,
      )
      .is('archived_at', null)
      .order('is_system', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return response.json({
      data: presets ?? [],
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/projects/:projectId/presets
 * Create custom preset
 */
presetsRouter.post('/', async (request, response, next) => {
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

  const parsedBody = createPresetSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: parsedBody.error.flatten(),
        message: 'Invalid preset configuration.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    const { data: preset, error } = await client
      .from('generation_presets')
      .insert({
        configuration: parsedBody.data.configuration,
        description: parsedBody.data.description,
        is_system: false,
        name: parsedBody.data.name,
        owner_id: authReq.authUser.id,
        project_id: parsedProjectId.data,
      })
      .select('*')
      .single();

    if (error) throw error;

    return response.status(201).json({
      data: preset,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * PATCH /api/v1/projects/:projectId/presets/:presetId
 * Update custom preset
 */
presetsRouter.patch('/:presetId', async (request, response, next) => {
  const { presetId, projectId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  const parsedPresetId = uuidSchema.safeParse(presetId);
  if (!parsedProjectId.success || !parsedPresetId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Invalid project or preset ID format.',
      },
    });
  }

  const parsedBody = updatePresetSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: parsedBody.error.flatten(),
        message: 'Invalid preset update payload.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (parsedBody.data.name) updateData.name = parsedBody.data.name;
    if (parsedBody.data.description !== undefined)
      updateData.description = parsedBody.data.description;
    if (parsedBody.data.configuration)
      updateData.configuration = parsedBody.data.configuration;

    const { data: preset, error } = await client
      .from('generation_presets')
      .update(updateData)
      .eq('id', parsedPresetId.data)
      .eq('owner_id', authReq.authUser.id)
      .eq('is_system', false)
      .is('archived_at', null)
      .select('*')
      .single();

    if (error) throw error;

    return response.json({
      data: preset,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/projects/:projectId/presets/:presetId/archive
 */
presetsRouter.post('/:presetId/archive', async (request, response, next) => {
  const { presetId, projectId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  const parsedPresetId = uuidSchema.safeParse(presetId);
  if (!parsedProjectId.success || !parsedPresetId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Invalid project or preset ID format.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    const { data: preset, error } = await client
      .from('generation_presets')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', parsedPresetId.data)
      .eq('owner_id', authReq.authUser.id)
      .eq('is_system', false)
      .is('archived_at', null)
      .select('*')
      .single();

    if (error) throw error;

    return response.json({
      data: preset,
    });
  } catch (error) {
    return next(error);
  }
});
