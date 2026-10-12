import { z } from 'zod';

export const topicSourceValues = [
  'INFERRED',
  'USER_DEFINED',
  'IMPORTED',
] as const;

export const topicSourceSchema = z.enum(topicSourceValues);
export type TopicSource = z.infer<typeof topicSourceSchema>;

export const chunkTopicSourceValues = [
  'AUTO_INFERRED',
  'USER_ASSIGNED',
] as const;

export const chunkTopicSourceSchema = z.enum(chunkTopicSourceValues);
export type ChunkTopicSource = z.infer<typeof chunkTopicSourceSchema>;

export const topicSchema = z.object({
  archived_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  description: z.string().nullable().optional(),
  id: z.string().uuid(),
  is_active: z.boolean(),
  name: z.string().min(1).max(255),
  parent_id: z.string().uuid().nullable(),
  project_id: z.string().uuid(),
  sort_order: z.number().int(),
  source: topicSourceSchema,
  updated_at: z.string().datetime(),
});

export type Topic = z.infer<typeof topicSchema>;

export const topicWithSubtopicsSchema = topicSchema.extend({
  chunk_count: z.number().int().nonnegative().optional(),
  confidence_avg: z.number().min(0).max(1).optional(),
  subtopics: z.array(
    topicSchema.extend({
      chunk_count: z.number().int().nonnegative().optional(),
      confidence_avg: z.number().min(0).max(1).optional(),
    }),
  ),
});

export type TopicWithSubtopics = z.infer<typeof topicWithSubtopicsSchema>;

export const createTopicSchema = z.object({
  description: z.string().trim().max(1000).optional(),
  name: z.string().trim().min(1, 'Topic name is required').max(255),
  parent_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().optional(),
});

export type CreateTopicRequest = z.infer<typeof createTopicSchema>;

export const updateTopicSchema = z.object({
  description: z.string().trim().max(1000).nullable().optional(),
  name: z.string().trim().min(1).max(255).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().optional(),
});

export type UpdateTopicRequest = z.infer<typeof updateTopicSchema>;

export const reorderTopicsItemSchema = z.object({
  id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  sort_order: z.number().int().nonnegative(),
});

export const reorderTopicsRequestSchema = z.object({
  items: z.array(reorderTopicsItemSchema).min(1),
});

export type ReorderTopicsRequest = z.infer<typeof reorderTopicsRequestSchema>;

export const inferTopicsRequestSchema = z.object({
  resource_ids: z.array(z.string().uuid()).optional(),
});

export type InferTopicsRequest = z.infer<typeof inferTopicsRequestSchema>;

export const chunkTopicEvidenceSchema = z.object({
  chunk_id: z.string().uuid(),
  chunk_index: z.number().int(),
  confidence: z.number().min(0).max(1).nullable(),
  page_number: z.number().int().nullable(),
  resource_id: z.string().uuid(),
  resource_name: z.string(),
  section_title: z.string().nullable(),
  source: chunkTopicSourceSchema,
  text: z.string(),
});

export type ChunkTopicEvidence = z.infer<typeof chunkTopicEvidenceSchema>;
