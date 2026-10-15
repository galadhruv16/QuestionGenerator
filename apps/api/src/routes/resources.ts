import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  finalizeResourceRequestSchema,
  resourceListQuerySchema,
  uploadInitRequestSchema,
} from '@groundq/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { env } from '../config/env.js';
import { createSupabaseUserClient } from '../lib/supabase.js';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/require-auth.js';
import { processResourcePipeline } from '../services/resource-processor.js';
import {
  analyzePyqPattern,
  listProjectPyqPatterns,
} from '../services/pyq-analyzer.js';

const uuidSchema = z.string().uuid();

const resourceFields =
  'id, project_id, original_filename, storage_path, mime_type, file_extension, file_size_bytes, resource_kind, status, page_count, checksum_sha256, created_at, updated_at, archived_at';

const sanitizeFilename = (filename: string) =>
  filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_');

const encodeCursor = (createdAt: string, id: string) =>
  Buffer.from(JSON.stringify({ created_at: createdAt, id })).toString(
    'base64url',
  );

const decodeCursor = (cursor: string) => {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    return z
      .object({ created_at: z.string().datetime(), id: uuidSchema })
      .parse(parsed);
  } catch {
    return null;
  }
};

const ensureProjectAccess = async (
  client: SupabaseClient,
  projectId: string,
  userId: string,
) => {
  const { data: project, error } = await client
    .from('projects')
    .select('id, owner_id, archived_at')
    .eq('id', projectId)
    .eq('owner_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!project || project.archived_at) {
    return null;
  }
  return project;
};

type RouteParams = {
  projectId?: string;
  resourceId?: string;
};

const getParams = (req: { params: unknown }): RouteParams =>
  req.params as RouteParams;

export const resourcesRouter = Router({ mergeParams: true });

resourcesRouter.use(requireAuth);

// 1. Upload initialization
resourcesRouter.post('/upload-init', async (request, response, next) => {
  const parsedProjectId = uuidSchema.safeParse(getParams(request).projectId);
  if (!parsedProjectId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid project ID format.',
        details: {},
      },
    });
  }

  const parsedBody = uploadInitRequestSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Resource upload parameters are invalid.',
        details: parsedBody.error.flatten(),
      },
    });
  }

  try {
    const authenticatedRequest = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authenticatedRequest.accessToken);
    const projectId = parsedProjectId.data;

    const project = await ensureProjectAccess(
      client,
      projectId,
      authenticatedRequest.authUser.id,
    );
    if (!project) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found or archived.',
        },
      });
    }

    const { file_size_bytes, filename, mime_type, resource_kind } =
      parsedBody.data;
    const resourceId = randomUUID();
    const safeFilename = sanitizeFilename(filename);
    const bucketObjectKey = `${projectId}/${resourceId}/${safeFilename}`;
    const storagePath = `resources/${bucketObjectKey}`;

    const { error: insertError } = await client
      .from('resources')
      .insert({
        file_extension: 'pdf',
        file_size_bytes,
        id: resourceId,
        mime_type,
        original_filename: filename,
        project_id: projectId,
        resource_kind,
        status: 'UPLOADING',
        storage_path: storagePath,
        uploaded_by: authenticatedRequest.authUser.id,
      })
      .select(resourceFields)
      .single();

    if (insertError) throw insertError;

    let uploadDetails = {
      method: 'POST',
      url: `${env.SUPABASE_URL ?? ''}/storage/v1/object/resources/${bucketObjectKey}`,
    };

    try {
      const { data: signedUpload } = await client.storage
        .from('resources')
        .createSignedUploadUrl(bucketObjectKey);
      if (signedUpload?.signedUrl) {
        uploadDetails = {
          method: 'POST',
          url: signedUpload.signedUrl,
          ...(signedUpload.token ? { token: signedUpload.token } : {}),
        };
      }
    } catch {
      // Fallback url preserved when signed upload URL is unsupported
    }

    return response.status(200).json({
      data: {
        resource_id: resourceId,
        storage_path: storagePath,
        upload: uploadDetails,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// 2. Finalize resource upload
resourcesRouter.post('/', async (request, response, next) => {
  const parsedProjectId = uuidSchema.safeParse(getParams(request).projectId);
  if (!parsedProjectId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid project ID format.',
        details: {},
      },
    });
  }

  const parsedBody = finalizeResourceRequestSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Resource finalization parameters are invalid.',
        details: parsedBody.error.flatten(),
      },
    });
  }

  try {
    const authenticatedRequest = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authenticatedRequest.accessToken);
    const projectId = parsedProjectId.data;

    const project = await ensureProjectAccess(
      client,
      projectId,
      authenticatedRequest.authUser.id,
    );
    if (!project) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found or archived.',
        },
      });
    }

    const { checksum_sha256, original_filename, resource_id, resource_kind } =
      parsedBody.data;

    const { data: existing, error: fetchError } = await client
      .from('resources')
      .select(resourceFields)
      .eq('id', resource_id)
      .eq('project_id', projectId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Resource upload initialization not found.',
        },
      });
    }

    const bucketObjectKey = existing.storage_path.startsWith('resources/')
      ? existing.storage_path.slice('resources/'.length)
      : existing.storage_path;

    const parentPath = bucketObjectKey.split('/').slice(0, -1).join('/');
    const filename = bucketObjectKey.split('/').pop();

    const { data: fileData, error: fileCheckError } = await client.storage
      .from('resources')
      .list(parentPath, {
        search: filename,
      });

    const fileExists =
      !fileCheckError &&
      Array.isArray(fileData) &&
      fileData.some((f) => f.name === filename);

    if (!fileExists) {
      return response.status(422).json({
        error: {
          code: 'UNPROCESSABLE_RESOURCE',
          message:
            'Uploaded file not found in storage. Ensure file was successfully uploaded to Supabase Storage before finalization.',
          details: fileCheckError
            ? { storage_error: fileCheckError.message }
            : {},
        },
      });
    }

    const updatePayload: Record<string, unknown> = {
      original_filename,
      resource_kind,
      status: 'READY_TO_PROCESS',
    };
    if (checksum_sha256) {
      updatePayload.checksum_sha256 = checksum_sha256;
    }

    const { data: updatedResource, error: updateError } = await client
      .from('resources')
      .update(updatePayload)
      .eq('id', resource_id)
      .select(resourceFields)
      .single();

    if (updateError) throw updateError;

    return response.status(201).json({ data: updatedResource });
  } catch (error) {
    return next(error);
  }
});

// 3. List resources
resourcesRouter.get('/', async (request, response, next) => {
  const parsedProjectId = uuidSchema.safeParse(getParams(request).projectId);
  if (!parsedProjectId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid project ID format.',
        details: {},
      },
    });
  }

  const parsedQuery = resourceListQuerySchema.safeParse(request.query);
  if (!parsedQuery.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Resource list query parameters are invalid.',
        details: parsedQuery.error.flatten(),
      },
    });
  }

  try {
    const authenticatedRequest = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authenticatedRequest.accessToken);
    const projectId = parsedProjectId.data;

    const project = await ensureProjectAccess(
      client,
      projectId,
      authenticatedRequest.authUser.id,
    );
    if (!project) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found or archived.',
        },
      });
    }

    const { cursor, include_archived, limit, resource_kind, status } =
      parsedQuery.data;
    const decodedCursor = cursor ? decodeCursor(cursor) : null;
    if (cursor && !decodedCursor) {
      return response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Resource cursor is invalid.',
          details: {},
        },
      });
    }

    let query = client
      .from('resources')
      .select(resourceFields)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    if (include_archived === 'false') {
      query = query.is('archived_at', null);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (resource_kind) {
      query = query.eq('resource_kind', resource_kind);
    }
    if (decodedCursor) {
      query = query.or(
        `created_at.lt.${decodedCursor.created_at},and(created_at.eq.${decodedCursor.created_at},id.lt.${decodedCursor.id})`,
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    const resources = data ?? [];
    const hasMore = resources.length > limit;
    const visibleResources = hasMore ? resources.slice(0, limit) : resources;
    const lastResource = visibleResources.at(-1);

    return response.json({
      data: visibleResources,
      meta: {
        has_more: hasMore,
        next_cursor:
          hasMore && lastResource
            ? encodeCursor(lastResource.created_at, lastResource.id)
            : null,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// 4. Get resource
resourcesRouter.get('/:resourceId', async (request, response, next) => {
  const { projectId, resourceId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  const parsedResourceId = uuidSchema.safeParse(resourceId);

  if (!parsedProjectId.success || !parsedResourceId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid project ID or resource ID format.',
        details: {},
      },
    });
  }

  try {
    const authenticatedRequest = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authenticatedRequest.accessToken);

    const project = await ensureProjectAccess(
      client,
      parsedProjectId.data,
      authenticatedRequest.authUser.id,
    );
    if (!project) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found or archived.',
        },
      });
    }

    const { data: resource, error } = await client
      .from('resources')
      .select(resourceFields)
      .eq('id', parsedResourceId.data)
      .eq('project_id', parsedProjectId.data)
      .maybeSingle();

    if (error) throw error;
    if (!resource) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found.',
        },
      });
    }

    return response.json({ data: resource });
  } catch (error) {
    return next(error);
  }
});

// 5. Get resource processing status
resourcesRouter.get('/:resourceId/status', async (request, response, next) => {
  const { projectId, resourceId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  const parsedResourceId = uuidSchema.safeParse(resourceId);

  if (!parsedProjectId.success || !parsedResourceId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid project ID or resource ID format.',
        details: {},
      },
    });
  }

  try {
    const authenticatedRequest = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authenticatedRequest.accessToken);

    const project = await ensureProjectAccess(
      client,
      parsedProjectId.data,
      authenticatedRequest.authUser.id,
    );
    if (!project) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found or archived.',
        },
      });
    }

    const { data: resource, error: resourceError } = await client
      .from('resources')
      .select('id, status')
      .eq('id', parsedResourceId.data)
      .eq('project_id', parsedProjectId.data)
      .maybeSingle();

    if (resourceError) throw resourceError;
    if (!resource) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found.',
        },
      });
    }

    const { data: runs, error: runsError } = await client
      .from('resource_processing_runs')
      .select('*')
      .eq('resource_id', parsedResourceId.data)
      .order('created_at', { ascending: false })
      .limit(5);

    if (runsError) throw runsError;

    const { count: chunkCount } = await client
      .from('resource_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('resource_id', parsedResourceId.data);

    const { data: chunksData } = await client
      .from('resource_chunks')
      .select('token_count')
      .eq('resource_id', parsedResourceId.data);

    const totalTokens =
      chunksData?.reduce((acc, c) => acc + (c.token_count ?? 0), 0) ?? 0;
    const avgTokens =
      chunksData && chunksData.length > 0
        ? Math.round(totalTokens / chunksData.length)
        : 0;

    return response.json({
      data: {
        avg_token_length: avgTokens,
        chunk_count: chunkCount ?? 0,
        processing_run: runs?.[0] ?? null,
        processing_runs: runs ?? [],
        resource_id: resource.id,
        resource_status: resource.status,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// 6. Start processing / reprocess resource
const handleProcess = async (
  request: Parameters<Parameters<typeof resourcesRouter.post>[1]>[0],
  response: Parameters<Parameters<typeof resourcesRouter.post>[1]>[1],
  next: Parameters<Parameters<typeof resourcesRouter.post>[1]>[2],
) => {
  const { projectId, resourceId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  const parsedResourceId = uuidSchema.safeParse(resourceId);

  if (!parsedProjectId.success || !parsedResourceId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid project ID or resource ID format.',
        details: {},
      },
    });
  }

  try {
    const authenticatedRequest = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authenticatedRequest.accessToken);

    const project = await ensureProjectAccess(
      client,
      parsedProjectId.data,
      authenticatedRequest.authUser.id,
    );
    if (!project) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found or archived.',
        },
      });
    }

    const { data: resource, error: resourceError } = await client
      .from('resources')
      .select(resourceFields)
      .eq('id', parsedResourceId.data)
      .eq('project_id', parsedProjectId.data)
      .maybeSingle();

    if (resourceError) throw resourceError;
    if (!resource || resource.archived_at) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found or archived.',
        },
      });
    }

    // Set resource status to PROCESSING
    const { data: updatedResource, error: updateError } = await client
      .from('resources')
      .update({ status: 'PROCESSING' })
      .eq('id', parsedResourceId.data)
      .select(resourceFields)
      .single();

    if (updateError) throw updateError;

    // Create a new processing run entry
    const { data: newRun, error: runError } = await client
      .from('resource_processing_runs')
      .insert({
        chunking_version: 'token-sliding-v1',
        metadata: { stage: 'QUEUED' },
        parser_version: 'pdf-extractor-v1',
        resource_id: parsedResourceId.data,
        started_at: new Date().toISOString(),
        status: 'RUNNING',
      })
      .select('*')
      .single();

    if (runError) throw runError;

    // Trigger in-process pipeline execution asynchronously
    void processResourcePipeline({
      client,
      projectId: parsedProjectId.data,
      resourceId: parsedResourceId.data,
      runId: newRun.id,
      storagePath: resource.storage_path,
    });

    return response.status(200).json({
      data: {
        processing_run: newRun,
        resource: updatedResource,
      },
    });
  } catch (error) {
    return next(error);
  }
};

resourcesRouter.post('/:resourceId/process', handleProcess);
resourcesRouter.post('/:resourceId/reprocess', handleProcess);

// 7. Archive resource
resourcesRouter.post(
  '/:resourceId/archive',
  async (request, response, next) => {
    const { projectId, resourceId } = getParams(request);
    const parsedProjectId = uuidSchema.safeParse(projectId);
    const parsedResourceId = uuidSchema.safeParse(resourceId);

    if (!parsedProjectId.success || !parsedResourceId.success) {
      return response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid project ID or resource ID format.',
          details: {},
        },
      });
    }

    try {
      const authenticatedRequest = request as unknown as AuthenticatedRequest;
      const client = createSupabaseUserClient(authenticatedRequest.accessToken);

      const project = await ensureProjectAccess(
        client,
        parsedProjectId.data,
        authenticatedRequest.authUser.id,
      );
      if (!project) {
        return response.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found or archived.',
          },
        });
      }

      const { data: archivedResource, error: archiveError } = await client
        .from('resources')
        .update({
          archived_at: new Date().toISOString(),
          status: 'ARCHIVED',
        })
        .eq('id', parsedResourceId.data)
        .eq('project_id', parsedProjectId.data)
        .is('archived_at', null)
        .select(resourceFields)
        .single();

      if (archiveError) throw archiveError;

      return response.json({ data: archivedResource });
    } catch (error) {
      return next(error);
    }
  },
);

// List all analyzed PYQ patterns for the project
resourcesRouter.get('/pyq-patterns', async (request, response, next) => {
  const { projectId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);

  if (!parsedProjectId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid project ID format.',
        details: {},
      },
    });
  }

  try {
    const authenticatedRequest = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authenticatedRequest.accessToken);

    const project = await ensureProjectAccess(
      client,
      parsedProjectId.data,
      authenticatedRequest.authUser.id,
    );
    if (!project) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found or archived.',
        },
      });
    }

    const patterns = await listProjectPyqPatterns(client, parsedProjectId.data);
    return response.json({ data: patterns });
  } catch (error) {
    return next(error);
  }
});

// Analyze blueprint patterns from a specific PYQ resource
resourcesRouter.post(
  '/:resourceId/analyze-pyq',
  async (request, response, next) => {
    const { projectId, resourceId } = getParams(request);
    const parsedProjectId = uuidSchema.safeParse(projectId);
    const parsedResourceId = uuidSchema.safeParse(resourceId);

    if (!parsedProjectId.success || !parsedResourceId.success) {
      return response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid project ID or resource ID format.',
          details: {},
        },
      });
    }

    try {
      const authenticatedRequest = request as unknown as AuthenticatedRequest;
      const client = createSupabaseUserClient(authenticatedRequest.accessToken);

      const project = await ensureProjectAccess(
        client,
        parsedProjectId.data,
        authenticatedRequest.authUser.id,
      );
      if (!project) {
        return response.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found or archived.',
          },
        });
      }

      const { model, provider } = request.body || {};

      const pattern = await analyzePyqPattern({
        client,
        model,
        projectId: parsedProjectId.data,
        provider,
        resourceId: parsedResourceId.data,
      });

      return response.json({ data: pattern });
    } catch (error: any) {
      return response.status(400).json({
        error: {
          code: 'ANALYSIS_ERROR',
          message: error?.message || 'Failed to analyze PYQ pattern.',
        },
      });
    }
  },
);

