import { z } from 'zod';

const distributionSchema = z.record(
  z.string().min(1),
  z.number().min(0).max(100),
);

export const generationBlueprintSchema = z.object({
  bloom: distributionSchema,
  difficulty: distributionSchema,
  duplicate_policy: z.enum(['avoid', 'allow']),
  question_count: z.number().int().min(1).max(100),
  question_styles: z.array(z.string().min(1)).min(1),
  question_types: z.array(z.string().min(1)).min(1),
  topics: z.array(z.string().uuid()),
});

export type GenerationBlueprint = z.infer<typeof generationBlueprintSchema>;
export type GenerationContracts = {
  blueprint: GenerationBlueprint;
};
