import { z } from 'zod';

export const duplicatePolicySchema = z.enum(['PREVENT', 'ALLOW']);
export type DuplicatePolicy = z.infer<typeof duplicatePolicySchema>;

export const blueprintConfigurationSchema = z.object({
  bloom: z.record(z.string(), z.number().min(0).max(100)).default({
    analyze: 30,
    apply: 25,
    create: 5,
    evaluate: 15,
    remember: 10,
    understand: 15,
  }),
  difficulty: z.record(z.string(), z.number().min(0).max(100)).default({
    easy: 20,
    hard: 30,
    medium: 50,
  }),
  duplicate_policy: duplicatePolicySchema.default('PREVENT'),
  model_name: z.string().trim().min(1).default('llama3'),
  question_count: z.number().int().min(1).max(50).default(10),
  styles: z.record(z.string(), z.number().min(0).max(100)).default({
    analytical: 40,
    conceptual: 20,
    scenario: 40,
  }),
  temperature: z.number().min(0).max(2).default(0.15),
  topics: z.record(z.string(), z.number().min(0).max(100)).default({}),
  types: z.record(z.string(), z.number().min(0).max(100)).default({
    long_answer: 20,
    mcq: 50,
    short_answer: 30,
  }),
});

export type BlueprintConfiguration = z.infer<
  typeof blueprintConfigurationSchema
>;

export const createBlueprintSchema = z.object({
  configuration: blueprintConfigurationSchema,
  name: z.string().trim().max(255).optional(),
});
export type CreateBlueprintRequest = z.infer<typeof createBlueprintSchema>;

export const updateBlueprintSchema = z.object({
  configuration: blueprintConfigurationSchema.optional(),
  name: z.string().trim().max(255).optional(),
});
export type UpdateBlueprintRequest = z.infer<typeof updateBlueprintSchema>;

export const blueprintSchema = z.object({
  archived_at: z.string().datetime().nullable(),
  configuration: blueprintConfigurationSchema,
  created_at: z.string().datetime(),
  created_by: z.string().uuid(),
  id: z.string().uuid(),
  name: z.string().nullable().optional(),
  project_id: z.string().uuid(),
  updated_at: z.string().datetime(),
});
export type Blueprint = z.infer<typeof blueprintSchema>;

export const createPresetSchema = z.object({
  configuration: blueprintConfigurationSchema,
  description: z.string().trim().max(1000).optional(),
  name: z.string().trim().min(1, 'Preset name is required').max(255),
});
export type CreatePresetRequest = z.infer<typeof createPresetSchema>;

export const updatePresetSchema = z.object({
  configuration: blueprintConfigurationSchema.optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  name: z.string().trim().min(1).max(255).optional(),
});
export type UpdatePresetRequest = z.infer<typeof updatePresetSchema>;

export const presetSchema = z.object({
  archived_at: z.string().datetime().nullable(),
  configuration: blueprintConfigurationSchema,
  created_at: z.string().datetime(),
  description: z.string().nullable().optional(),
  id: z.string().uuid(),
  is_system: z.boolean(),
  name: z.string(),
  owner_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  updated_at: z.string().datetime(),
});
export type Preset = z.infer<typeof presetSchema>;

export const generationRunStatusValues = [
  'CREATED',
  'QUEUED',
  'PLANNING',
  'RETRIEVING',
  'GENERATING',
  'VALIDATING',
  'COMPLETED',
  'FAILED',
] as const;

export const generationRunStatusSchema = z.enum(generationRunStatusValues);
export type GenerationRunStatus = z.infer<typeof generationRunStatusSchema>;

export const startGenerationRunSchema = z.object({
  blueprint_id: z.string().uuid().optional(),
  configuration: blueprintConfigurationSchema.optional(),
  model_name: z.string().trim().optional(),
  request_id: z.string().optional(),
});
export type StartGenerationRunRequest = z.infer<
  typeof startGenerationRunSchema
>;

export const generatedQuestionItemSchema = z.object({
  attribution_score: z.number().min(0).max(1).optional(),
  bloom_level: z.string(),
  citation_anchor: z.string().optional(),
  correct_answer: z.string().optional(),
  difficulty: z.string(),
  evidence_quote: z.string().optional(),
  explanation: z.string().optional(),
  id: z.string().uuid(),
  model_answer: z.string().optional(),
  options: z
    .array(
      z.object({
        is_correct: z.boolean(),
        option_index: z.number().int(),
        option_text: z.string(),
      }),
    )
    .optional(),
  question_type: z.string(),
  status: z.string().default('AVAILABLE'),
  stem: z.string(),
  style: z.string(),
  topic_id: z.string().uuid().nullable().optional(),
  topic_name: z.string().optional(),
  version_number: z.number().int().default(1),
});
export type GeneratedQuestionItem = z.infer<typeof generatedQuestionItemSchema>;

export const generationRunSchema = z.object({
  accepted_count: z.number().int().nonnegative().default(0),
  blueprint_id: z.string().uuid().nullable().optional(),
  blueprint_snapshot: blueprintConfigurationSchema,
  completed_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime(),
  created_by: z.string().uuid(),
  duplicate_policy: duplicatePolicySchema.default('PREVENT'),
  error_message: z.string().nullable().optional(),
  id: z.string().uuid(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  model_name: z.string(),
  model_provider: z.string().default('ollama'),
  project_id: z.string().uuid(),
  questions: z.array(generatedQuestionItemSchema).optional(),
  requested_count: z.number().int().positive(),
  review_count: z.number().int().nonnegative().default(0),
  started_at: z.string().datetime().nullable().optional(),
  status: generationRunStatusSchema,
  updated_at: z.string().datetime(),
});
export type GenerationRun = z.infer<typeof generationRunSchema>;
