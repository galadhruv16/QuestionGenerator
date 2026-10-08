import { z } from 'zod';

export const validationCheckSchema = z.object({
  check_type: z.string().min(1),
  explanation: z.string().min(1),
  score: z.number().min(0).max(1).nullable(),
  status: z.enum(['PASSED', 'FAILED', 'MANUAL_REVIEW']),
});

export type ValidationCheck = z.infer<typeof validationCheckSchema>;
export type ValidationContracts = {
  check: ValidationCheck;
};
