import { z } from 'zod';
export const idSchema = z.string().uuid();
export type Id = z.infer<typeof idSchema>;
