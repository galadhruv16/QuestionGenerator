import { z } from 'zod';

export const resourceKindValues = [
  'STUDY_MATERIAL',
  'PRESENTATION',
  'PYQ',
  'SYLLABUS',
  'OTHER',
] as const;

export const resourceKindSchema = z.enum(resourceKindValues);
export type ResourceKind = z.infer<typeof resourceKindSchema>;

export const resourceStatusValues = [
  'UPLOADING',
  'READY_TO_PROCESS',
  'PROCESSING',
  'READY',
  'FAILED',
  'ARCHIVED',
] as const;

export const resourceStatusSchema = z.enum(resourceStatusValues);
export type ResourceStatus = z.infer<typeof resourceStatusSchema>;

export const resourceSchema = z.object({
  archived_at: z.string().datetime().nullable(),
  checksum_sha256: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  file_extension: z.string().min(1),
  file_size_bytes: z.number().int().nonnegative(),
  id: z.string().uuid(),
  mime_type: z.string().min(1),
  original_filename: z.string().min(1),
  page_count: z.number().int().nonnegative().nullable().optional(),
  project_id: z.string().uuid(),
  resource_kind: resourceKindSchema,
  status: resourceStatusSchema,
  storage_path: z.string().min(1),
  updated_at: z.string().datetime(),
});

export type Resource = z.infer<typeof resourceSchema>;

export const supportedFileExtensions = [
  'pdf',
  'pptx',
  'ppt',
  'docx',
  'doc',
  'png',
  'jpg',
  'jpeg',
  'webp',
] as const;

export const supportedMimeTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const uploadInitRequestSchema = z.object({
  file_size_bytes: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024, 'File size cannot exceed 25 MB'),
  filename: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(
      /\.(pdf|pptx|ppt|docx|doc|png|jpg|jpeg|webp)$/i,
      'Supported formats: PDF, PPTX/PPT, DOCX, PNG, JPG, and WEBP (up to 25 MB)',
    ),
  mime_type: z.string().min(1),
  resource_kind: resourceKindSchema,
});

export type UploadInitRequest = z.infer<typeof uploadInitRequestSchema>;

export const uploadInitResponseSchema = z.object({
  data: z.object({
    expires_at: z.string().datetime().optional(),
    resource_id: z.string().uuid(),
    storage_path: z.string(),
    upload: z
      .object({
        method: z.string(),
        token: z.string().optional(),
        url: z.string().url(),
      })
      .optional(),
  }),
});

export type UploadInitResponse = z.infer<typeof uploadInitResponseSchema>;

export const finalizeResourceRequestSchema = z.object({
  checksum_sha256: z.string().trim().optional(),
  original_filename: z.string().trim().min(1).max(255),
  resource_id: z.string().uuid(),
  resource_kind: resourceKindSchema,
});

export type FinalizeResourceRequest = z.infer<
  typeof finalizeResourceRequestSchema
>;

export const resourceListQuerySchema = z.object({
  cursor: z.string().optional(),
  include_archived: z.enum(['true', 'false']).default('false'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  resource_kind: resourceKindSchema.optional(),
  status: resourceStatusSchema.optional(),
});

export type ResourceListQuery = z.infer<typeof resourceListQuerySchema>;

export const resourceListMetaSchema = z.object({
  has_more: z.boolean(),
  next_cursor: z.string().nullable(),
});

export const resourceListResponseSchema = z.object({
  data: z.array(resourceSchema),
  meta: resourceListMetaSchema,
});

export type ResourceListResponse = z.infer<typeof resourceListResponseSchema>;

export const resourceProcessingRunStatusValues = [
  'PENDING',
  'RUNNING',
  'READY',
  'FAILED',
  'CANCELLED',
] as const;

export const resourceProcessingRunStatusSchema = z.enum(
  resourceProcessingRunStatusValues,
);

export const resourceProcessingRunSchema = z.object({
  chunking_version: z.string().nullable().optional(),
  completed_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  embedding_model: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  id: z.string().uuid(),
  metadata: z.record(z.unknown()).nullable().optional(),
  parser_version: z.string().nullable().optional(),
  resource_id: z.string().uuid(),
  started_at: z.string().datetime().nullable(),
  status: resourceProcessingRunStatusSchema,
});

export type ResourceProcessingRun = z.infer<typeof resourceProcessingRunSchema>;

export const resourceStatusResponseSchema = z.object({
  data: z.object({
    processing_run: resourceProcessingRunSchema.nullable().optional(),
    resource_id: z.string().uuid(),
    resource_status: resourceStatusSchema,
  }),
});

export type ResourceStatusResponse = z.infer<
  typeof resourceStatusResponseSchema
>;
