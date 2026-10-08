import { z } from 'zod';

export const apiVersion = 'v1' as const;

export const projectSchema = z.object({
  archived_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  description: z.string().nullable(),
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  updated_at: z.string().datetime(),
});

export const createProjectSchema = z.object({
  description: z.string().trim().max(1_000).optional(),
  name: z.string().trim().min(1).max(120),
});

export const updateProjectSchema = createProjectSchema.partial();

export const projectListMetaSchema = z.object({
  has_more: z.boolean(),
  next_cursor: z.string().nullable(),
});

export const projectListResponseSchema = z.object({
  data: z.array(projectSchema),
  meta: projectListMetaSchema,
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    details: z.record(z.unknown()).default({}),
    message: z.string(),
  }),
});

export type Project = z.infer<typeof projectSchema>;
