import { Router } from 'express';
import {
  createTopicSchema,
  inferTopicsRequestSchema,
  reorderTopicsRequestSchema,
  updateTopicSchema,
} from '@groundq/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createSupabaseUserClient } from '../lib/supabase.js';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/require-auth.js';
import {
  inferTopicsFromChunks,
  persistInferredTopics,
} from '../services/topic-inferencer.js';

const uuidSchema = z.string().uuid();

const topicFields =
  'id, project_id, parent_id, name, description, source, sort_order, is_active, created_at, updated_at, archived_at';

const getParams = (request: unknown) =>
  (request as { params: { projectId?: string; topicId?: string } }).params;

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

export const topicsRouter = Router({ mergeParams: true });

topicsRouter.use(requireAuth);

/**
 * GET /api/v1/projects/:projectId/topics
 * Returns the hierarchical topic tree (Modules with nested Subtopics) + chunk count
 */
topicsRouter.get('/', async (request, response, next) => {
  const { projectId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  if (!parsedProjectId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Project id is invalid.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    const project = await ensureProjectAccess(
      client,
      parsedProjectId.data,
      authReq.authUser.id,
    );
    if (!project) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          details: {},
          message: 'Project not found.',
        },
      });
    }

    // 1. Fetch active topics for project ordered by sort_order
    const { data: rawTopics, error: topicsError } = await client
      .from('topics')
      .select(topicFields)
      .eq('project_id', parsedProjectId.data)
      .is('archived_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (topicsError) throw topicsError;

    const topics = rawTopics ?? [];

    // 2. Fetch chunk-topic counts
    const topicIds = topics.map((t) => t.id);
    let chunkCounts: Record<string, number> = {};

    if (topicIds.length > 0) {
      const { data: mappings, error: mappingError } = await client
        .from('chunk_topics')
        .select('topic_id, chunk_id')
        .in('topic_id', topicIds);

      if (!mappingError && mappings) {
        chunkCounts = mappings.reduce(
          (acc, m) => {
            acc[m.topic_id] = (acc[m.topic_id] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );
      }
    }

    // 3. Assemble 2-level hierarchy: Parent Modules -> Subtopics
    const parentTopics = topics.filter((t) => !t.parent_id);
    const subtopicMap = new Map<string, typeof topics>();

    for (const t of topics) {
      if (t.parent_id) {
        const existing = subtopicMap.get(t.parent_id) ?? [];
        existing.push(t);
        subtopicMap.set(t.parent_id, existing);
      }
    }

    const tree = parentTopics.map((parent) => {
      const children = subtopicMap.get(parent.id) ?? [];
      const parentChunkCount =
        (chunkCounts[parent.id] ?? 0) +
        children.reduce((acc, c) => acc + (chunkCounts[c.id] ?? 0), 0);

      return {
        ...parent,
        chunk_count: parentChunkCount,
        subtopics: children.map((c) => ({
          ...c,
          chunk_count: chunkCounts[c.id] ?? 0,
        })),
      };
    });

    return response.json({
      data: tree,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/projects/:projectId/topics
 * Create a new topic or subtopic manually
 */
topicsRouter.post('/', async (request, response, next) => {
  const { projectId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  if (!parsedProjectId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Project id is invalid.',
      },
    });
  }

  const parsedBody = createTopicSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: parsedBody.error.flatten(),
        message: 'Topic data is invalid.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    const project = await ensureProjectAccess(
      client,
      parsedProjectId.data,
      authReq.authUser.id,
    );
    if (!project) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          details: {},
          message: 'Project not found.',
        },
      });
    }

    const { description, name, parent_id, sort_order } = parsedBody.data;

    // Validate parent topic belongs to project if parent_id provided
    if (parent_id) {
      const { data: parentTopic, error: parentError } = await client
        .from('topics')
        .select('id, parent_id, project_id')
        .eq('id', parent_id)
        .eq('project_id', parsedProjectId.data)
        .is('archived_at', null)
        .maybeSingle();

      if (parentError || !parentTopic) {
        return response.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            details: {},
            message: 'Parent topic not found in this project.',
          },
        });
      }

      // Enforce strictly 2 levels: parent must NOT have a parent
      if (parentTopic.parent_id) {
        return response.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            details: {},
            message:
              'GroundQ V1 supports a maximum of 2 hierarchy levels (Module -> Subtopic).',
          },
        });
      }
    }

    // Determine sort_order if not explicitly given
    let finalOrder = sort_order;
    if (finalOrder === undefined) {
      const { count } = await client
        .from('topics')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', parsedProjectId.data)
        .is('parent_id', parent_id ?? null)
        .is('archived_at', null);

      finalOrder = (count ?? 0) + 1;
    }

    const { data: topic, error: insertError } = await client
      .from('topics')
      .insert({
        description: description ?? null,
        is_active: true,
        name,
        parent_id: parent_id ?? null,
        project_id: parsedProjectId.data,
        sort_order: finalOrder,
        source: 'USER_DEFINED',
      })
      .select(topicFields)
      .single();

    if (insertError) throw insertError;

    return response.status(201).json({
      data: topic,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * PATCH /api/v1/projects/:projectId/topics/:topicId
 * Update an existing topic name, description, or parent
 */
topicsRouter.patch('/:topicId', async (request, response, next) => {
  const { projectId, topicId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  const parsedTopicId = uuidSchema.safeParse(topicId);

  if (!parsedProjectId.success || !parsedTopicId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Project id or topic id is invalid.',
      },
    });
  }

  const parsedBody = updateTopicSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: parsedBody.error.flatten(),
        message: 'Topic update payload is invalid.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    const project = await ensureProjectAccess(
      client,
      parsedProjectId.data,
      authReq.authUser.id,
    );
    if (!project) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          details: {},
          message: 'Project not found.',
        },
      });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (parsedBody.data.name !== undefined) {
      updatePayload.name = parsedBody.data.name;
    }
    if (parsedBody.data.description !== undefined) {
      updatePayload.description = parsedBody.data.description;
    }
    if (parsedBody.data.sort_order !== undefined) {
      updatePayload.sort_order = parsedBody.data.sort_order;
    }
    if (parsedBody.data.parent_id !== undefined) {
      updatePayload.parent_id = parsedBody.data.parent_id;
    }

    const { data: topic, error: updateError } = await client
      .from('topics')
      .update(updatePayload)
      .eq('id', parsedTopicId.data)
      .eq('project_id', parsedProjectId.data)
      .is('archived_at', null)
      .select(topicFields)
      .single();

    if (updateError) throw updateError;

    return response.json({
      data: topic,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/projects/:projectId/topics/reorder
 * Bulk reorder topics
 */
topicsRouter.post('/reorder', async (request, response, next) => {
  const { projectId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  if (!parsedProjectId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Project id is invalid.',
      },
    });
  }

  const parsedBody = reorderTopicsRequestSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: parsedBody.error.flatten(),
        message: 'Reorder payload is invalid.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    const project = await ensureProjectAccess(
      client,
      parsedProjectId.data,
      authReq.authUser.id,
    );
    if (!project) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          details: {},
          message: 'Project not found.',
        },
      });
    }

    for (const item of parsedBody.data.items) {
      await client
        .from('topics')
        .update({
          parent_id: item.parent_id,
          sort_order: item.sort_order,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
        .eq('project_id', parsedProjectId.data);
    }

    return response.json({
      data: { success: true },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/projects/:projectId/topics/:topicId/archive
 * Archive topic (archive-first lifecycle, never hard-delete)
 */
topicsRouter.post('/:topicId/archive', async (request, response, next) => {
  const { projectId, topicId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  const parsedTopicId = uuidSchema.safeParse(topicId);

  if (!parsedProjectId.success || !parsedTopicId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Project id or topic id is invalid.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    const project = await ensureProjectAccess(
      client,
      parsedProjectId.data,
      authReq.authUser.id,
    );
    if (!project) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          details: {},
          message: 'Project not found.',
        },
      });
    }

    const archiveTime = new Date().toISOString();

    // Archive topic and any children
    const { data: topic, error: archiveError } = await client
      .from('topics')
      .update({ archived_at: archiveTime, is_active: false })
      .eq('id', parsedTopicId.data)
      .eq('project_id', parsedProjectId.data)
      .select(topicFields)
      .single();

    if (archiveError) throw archiveError;

    // Archive child subtopics as well
    await client
      .from('topics')
      .update({ archived_at: archiveTime, is_active: false })
      .eq('parent_id', parsedTopicId.data)
      .eq('project_id', parsedProjectId.data);

    return response.json({
      data: topic,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/projects/:projectId/topics/infer
 * Deterministically extract 2-level topic tree from processed resource chunks using Ollama
 */
topicsRouter.post('/infer', async (request, response, next) => {
  const { projectId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  if (!parsedProjectId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Project id is invalid.',
      },
    });
  }

  const parsedBody = inferTopicsRequestSchema.safeParse(request.body ?? {});

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    const project = await ensureProjectAccess(
      client,
      parsedProjectId.data,
      authReq.authUser.id,
    );
    if (!project) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          details: {},
          message: 'Project not found.',
        },
      });
    }

    // 1. Fetch chunks from ready resources in this project
    let chunksQuery = client
      .from('resource_chunks')
      .select('id, chunk_index, page_number, text, resource_id')
      .eq('project_id', parsedProjectId.data)
      .order('chunk_index', { ascending: true });

    if (
      parsedBody.success &&
      parsedBody.data.resource_ids &&
      parsedBody.data.resource_ids.length > 0
    ) {
      chunksQuery = chunksQuery.in('resource_id', parsedBody.data.resource_ids);
    }

    const { data: chunks, error: chunksError } = await chunksQuery;
    if (chunksError) throw chunksError;

    if (!chunks || chunks.length === 0) {
      return response.status(400).json({
        error: {
          code: 'RESOURCE_NOT_READY',
          details: {},
          message:
            'No processed resource chunks found for this project. Ingest resources first.',
        },
      });
    }

    // 2. Perform Dual-Engine Topic Inference
    const inferenceResult = await inferTopicsFromChunks(
      chunks,
      parsedBody.success ? parsedBody.data.model_name : undefined,
      undefined,
      parsedBody.success ? parsedBody.data.model_provider : undefined,
    );

    // 3. Persist inferred hierarchy & mappings
    await persistInferredTopics(
      client,
      parsedProjectId.data,
      inferenceResult,
      chunks,
    );

    return response.json({
      data: {
        chunk_count: inferenceResult.chunkCount,
        model_used: inferenceResult.modelUsed,
        modules_inferred: inferenceResult.modules.length,
        status: 'SUCCESS',
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/v1/projects/:projectId/topics/:topicId/evidence
 * Fetch grounding evidence chunks mapped to this topic
 */
topicsRouter.get('/:topicId/evidence', async (request, response, next) => {
  const { projectId, topicId } = getParams(request);
  const parsedProjectId = uuidSchema.safeParse(projectId);
  const parsedTopicId = uuidSchema.safeParse(topicId);

  if (!parsedProjectId.success || !parsedTopicId.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: {},
        message: 'Project id or topic id is invalid.',
      },
    });
  }

  try {
    const authReq = request as unknown as AuthenticatedRequest;
    const client = createSupabaseUserClient(authReq.accessToken);

    const project = await ensureProjectAccess(
      client,
      parsedProjectId.data,
      authReq.authUser.id,
    );
    if (!project) {
      return response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          details: {},
          message: 'Project not found.',
        },
      });
    }

    const { data: mappings, error: mapError } = await client
      .from('chunk_topics')
      .select(
        'chunk_id, confidence, source, resource_chunks (id, chunk_index, page_number, section_title, text, resource_id, resources (original_filename))',
      )
      .eq('topic_id', parsedTopicId.data);

    if (mapError) throw mapError;

    interface MappingRow {
      chunk_id: string;
      confidence: number | string | null;
      resource_chunks: {
        chunk_index: number;
        page_number: number | null;
        resource_id: string;
        resources?: { original_filename?: string } | null;
        section_title: string | null;
        text: string;
      } | null;
      source: 'AUTO_INFERRED' | 'USER_ASSIGNED';
    }

    const evidence = ((mappings ?? []) as unknown as MappingRow[]).map((m) => ({
      chunk_id: m.chunk_id,
      chunk_index: m.resource_chunks?.chunk_index ?? 0,
      confidence: m.confidence ? Number(m.confidence) : 0.95,
      page_number: m.resource_chunks?.page_number ?? null,
      resource_id: m.resource_chunks?.resource_id ?? '',
      resource_name:
        m.resource_chunks?.resources?.original_filename ?? 'Source Document',
      section_title: m.resource_chunks?.section_title ?? null,
      source: m.source,
      text: m.resource_chunks?.text ?? '',
    }));

    return response.json({
      data: evidence,
    });
  } catch (error) {
    return next(error);
  }
});
