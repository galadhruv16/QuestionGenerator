import { z } from 'zod';

export const questionVersionSchema = z.object({
  answer_guidance: z.string().nullable(),
  content: z.string().min(1),
  difficulty: z.string().min(1),
  id: z.string().uuid(),
  question_type: z.string().min(1),
  style: z.string().min(1),
  topic_id: z.string().uuid().nullable(),
});

export type QuestionVersion = z.infer<typeof questionVersionSchema>;
export type QuestionContracts = {
  version: QuestionVersion;
};
