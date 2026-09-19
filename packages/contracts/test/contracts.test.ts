import { describe, expect, it } from 'vitest';
import { apiVersion, idSchema } from '../src/index.js';

describe('shared contracts scaffold', () => {
  it('exports the version boundary and common schema', () => {
    expect(apiVersion).toBe('v1');
    expect(idSchema.safeParse('not-an-id').success).toBe(false);
  });
});
