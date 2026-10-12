import { Router } from 'express';
import { createProjectSchema, updateProjectSchema } from '@groundq/contracts';
import { z } from 'zod';
import { createSupabaseUserClient } from '../lib/supabase.js';
import { resourcesRouter } from './resources.js';
import { topicsRouter } from './topics.js';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/require-auth.js';

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
  const parsed = updateProjectSchema.safeParse(request.body);
  if (
    !parsedProjectId.success ||
    !parsed.success ||
    !Object.keys(parsed.data).length
  ) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Project update details are invalid.',
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
      .update(parsed.data)
      .eq('id', parsedProjectId.data)
      .select(projectFields)
      .single();

    if (error) throw error;
    return response.json({ data });
  } catch (error) {
    return next(error);
  }
});

projectsRouter.post('/:projectId/archive', async (request, response, next) => {
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
      .update({ archived_at: new Date().toISOString() })
      .eq('id', parsedProjectId.data)
      .is('archived_at', null)
      .select(projectFields)
      .single();

    if (error) throw error;
    return response.json({ data });
  } catch (error) {
    return next(error);
  }
});

projectsRouter.use('/:projectId/resources', resourcesRouter);
projectsRouter.use('/:projectId/topics', topicsRouter);
