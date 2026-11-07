import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { createProjectSchema, updateProjectSchema } from '@groundq/contracts';
import { z } from 'zod';
import { createSupabaseUserClient } from '../lib/supabase.js';
import { resourcesRouter } from './resources.js';
import { topicsRouter } from './topics.js';
import { presetsRouter } from './presets.js';
import { blueprintsRouter } from './blueprints.js';
import { generationRunsRouter } from './generation-runs.js';
import { questionsRouter } from './questions.js';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/require-auth.js';
import { listProjectPyqPatterns } from '../services/pyq-analyzer.js';

const projectIdSchema = z.string().uuid();
const projectListQuerySchema = z.object({
  cursor: z.string().optional(),
  include_archived: z.enum(['true', 'false']).default('false'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const projectFields =
  'id, name, description, created_at, updated_at, archived_at';

const encodeCursor = (createdAt: string, id: string) =>
  Buffer.from(JSON.stringify({ created_at: createdAt, id })).toString(
    'base64url',
  );

const decodeCursor = (cursor: string) => {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    return z
      .object({ created_at: z.string().datetime(), id: projectIdSchema })
      .parse(parsed);
  } catch {
    return null;
  }
};

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get('/', async (request, response, next) => {
  try {
    const authenticatedRequest = request as unknown as AuthenticatedRequest;
    const parsedQuery = projectListQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project list parameters are invalid.',
          details: parsedQuery.error.flatten(),
        },
      });
    }
    const {
      cursor,
      include_archived: includeArchived,
      limit,
    } = parsedQuery.data;
    const decodedCursor = cursor ? decodeCursor(cursor) : null;
    if (cursor && !decodedCursor) {
      return response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project cursor is invalid.',
          details: {},
        },
      });
    }

    const client = createSupabaseUserClient(authenticatedRequest.accessToken);
    let query = client
      .from('projects')
      .select(projectFields)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    if (includeArchived === 'false') {
      query = query.is('archived_at', null);
    }
    if (decodedCursor) {
      query = query.or(
        `created_at.lt.${decodedCursor.created_at},and(created_at.eq.${decodedCursor.created_at},id.lt.${decodedCursor.id})`,
      );
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const projects = data ?? [];
    const hasMore = projects.length > limit;
    const visibleProjects = hasMore ? projects.slice(0, limit) : projects;
    const lastProject = visibleProjects.at(-1);

    return response.json({
      data: visibleProjects,
      meta: {
        has_more: hasMore,
        next_cursor:
          hasMore && lastProject
            ? encodeCursor(lastProject.created_at, lastProject.id)
            : null,
      },
    });
  } catch (error) {
    return next(error);
  }
});

projectsRouter.get('/:projectId', async (request, response, next) => {
  const parsedProjectId = projectIdSchema.safeParse(request.params.projectId);
  if (!parsedProjectId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Project id is invalid.',
        details: {},
      },
    });
  }

  try {
    const authenticatedRequest = request as unknown as AuthenticatedRequest;
    const { data, error } = await createSupabaseUserClient(
      authenticatedRequest.accessToken,
    )
      .from('projects')
      .select(projectFields)
      .eq('id', parsedProjectId.data)
      .single();

    if (error) throw error;
    return response.json({ data });
  } catch (error) {
    return next(error);
  }
});

projectsRouter.post('/', async (request, response, next) => {
  const parsed = createProjectSchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Project details are invalid.',
        details: parsed.error.flatten(),
      },
    });
  }

  try {
    const authenticatedRequest = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authenticatedRequest.accessToken);
    const { data, error } = await client
      .from('projects')
      .insert({ ...parsed.data, owner_id: authenticatedRequest.authUser.id })
      .select(projectFields)
      .single();

    if (error) {
      throw error;
    }

    return response.status(201).json({ data });
  } catch (error) {
    return next(error);
  }
});

projectsRouter.patch('/:projectId', async (request, response, next) => {
  const parsedProjectId = projectIdSchema.safeParse(request.params.projectId);
  if (!parsedProjectId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Project id is invalid.',
        details: {},
      },
    });
  }

  const parsed = updateProjectSchema.safeParse(request.body);
  if (!parsed.success || !Object.keys(parsed.data).length) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Project update details are invalid.',
        details: !parsed.success ? parsed.error.flatten() : {},
      },
    });
  }

  if (parsed.data.name !== undefined) {
    const trimmed = parsed.data.name.trim();
    if (!trimmed || trimmed.length > 120) {
      return response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project name must be between 1 and 120 characters.',
          details: {},
        },
      });
    }
  }

  try {
    const authenticatedRequest = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authenticatedRequest.accessToken);

    const { data: existing, error: fetchError } = await client
      .from('projects')
      .select('id, owner_id, archived_at')
      .eq('id', parsedProjectId.data)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!existing || existing.owner_id !== authenticatedRequest.authUser.id) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found.',
          details: {},
        },
      });
    }

    if (existing.archived_at) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Archived projects cannot be modified.',
          details: {},
        },
      });
    }

    const updatePayload: { description?: string; name?: string } = {};
    if (parsed.data.name !== undefined) {
      updatePayload.name = parsed.data.name.trim();
    }
    if (parsed.data.description !== undefined) {
      updatePayload.description = parsed.data.description;
    }

    const { data, error } = await client
      .from('projects')
      .update(updatePayload)
      .eq('id', parsedProjectId.data)
      .eq('owner_id', authenticatedRequest.authUser.id)
      .is('archived_at', null)
      .select(projectFields)
      .single();

    if (error) throw error;
    return response.json({ data });
  } catch (error) {
    return next(error);
  }
});

const archiveProjectHandler = async (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  const parsedProjectId = projectIdSchema.safeParse(request.params.projectId);
  if (!parsedProjectId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Project id is invalid.',
        details: {},
      },
    });
  }

  try {
    const authenticatedRequest = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authenticatedRequest.accessToken);

    const { data: existing, error: fetchError } = await client
      .from('projects')
      .select('id, owner_id, archived_at')
      .eq('id', parsedProjectId.data)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!existing || existing.owner_id !== authenticatedRequest.authUser.id) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found.',
          details: {},
        },
      });
    }

    if (existing.archived_at) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Project is already archived.',
          details: {},
        },
      });
    }

    const { data, error } = await client
      .from('projects')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', parsedProjectId.data)
      .eq('owner_id', authenticatedRequest.authUser.id)
      .is('archived_at', null)
      .select(projectFields)
      .single();

    if (error) throw error;
    return response.json({ data });
  } catch (error) {
    return next(error);
  }
};

projectsRouter.post('/:projectId/archive', archiveProjectHandler);
projectsRouter.delete('/:projectId', archiveProjectHandler);

projectsRouter.get(
  '/:projectId/pyq-patterns',
  async (request, response, next) => {
    const parsedProjectId = projectIdSchema.safeParse(request.params.projectId);
    if (!parsedProjectId.success) {
      return response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project id is invalid.',
          details: {},
        },
      });
    }

    try {
      const authenticatedRequest = request as unknown as AuthenticatedRequest;
      const client = createSupabaseUserClient(authenticatedRequest.accessToken);
      const patterns = await listProjectPyqPatterns(
        client,
        parsedProjectId.data,
      );
      return response.json({ data: patterns });
    } catch (error) {
      return next(error);
    }
  },
);

projectsRouter.use('/:projectId/resources', resourcesRouter);
projectsRouter.use('/:projectId/topics', topicsRouter);
projectsRouter.use('/:projectId/presets', presetsRouter);
projectsRouter.use('/:projectId/blueprints', blueprintsRouter);
projectsRouter.use('/:projectId/generation-runs', generationRunsRouter);
projectsRouter.use('/:projectId/questions', questionsRouter);
