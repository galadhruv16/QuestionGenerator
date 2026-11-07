import { describe, expect, it } from 'vitest';
import {
  apiVersion,
  createProjectSchema,
  generationBlueprintSchema,
  idSchema,
  projectSchema,
  questionVersionSchema,
  updateProjectSchema,
  uploadInitRequestSchema,
  validationCheckSchema,
} from '../src/index.js';

describe('shared contracts scaffold', () => {
  it('exports the version boundary and common schema', () => {
    expect(apiVersion).toBe('v1');
    expect(idSchema.safeParse('not-an-id').success).toBe(false);
  });

  it('validates project response data', () => {
    expect(
      projectSchema.safeParse({
        archived_at: null,
        created_at: '2026-10-08T12:00:00.000Z',
        description: null,
        id: 'not-an-id',
        name: 'Operating Systems',
        updated_at: '2026-10-08T12:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('provides structured generation, question, and validation schemas', () => {
    expect(
      generationBlueprintSchema.safeParse({
        bloom: { analyze: 100 },
        difficulty: { hard: 100 },
        duplicate_policy: 'avoid',
        question_count: 10,
        question_styles: ['analytical'],
        question_types: ['long_answer'],
        topics: [],
      }).success,
    ).toBe(true);
    expect(questionVersionSchema.shape.content).toBeDefined();
    expect(validationCheckSchema.shape.status).toBeDefined();
  });

  it('validates resource schemas and enforces 100MB limit on PDF uploads', () => {
    const validInit = {
      file_size_bytes: 85 * 1024 * 1024,
      filename: 'lecture-notes.pdf',
      mime_type: 'application/pdf',
      resource_kind: 'STUDY_MATERIAL',
    };
    expect(uploadInitRequestSchema.safeParse(validInit).success).toBe(true);

    const oversizedInit = {
      ...validInit,
      file_size_bytes: 101 * 1024 * 1024,
    };
    expect(uploadInitRequestSchema.safeParse(oversizedInit).success).toBe(
      false,
    );

    // Verify multi-format support
    expect(
      uploadInitRequestSchema.safeParse({
        ...validInit,
        filename: 'lecture-notes.docx',
      }).success,
    ).toBe(true);

    expect(
      uploadInitRequestSchema.safeParse({
        ...validInit,
        filename: 'distributed-systems.pptx',
        resource_kind: 'PRESENTATION',
      }).success,
    ).toBe(true);

    expect(
      uploadInitRequestSchema.safeParse({
        ...validInit,
        filename: 'whiteboard-notes.png',
      }).success,
    ).toBe(true);

    // Reject unsupported formats
    const unsupportedInit = {
      ...validInit,
      filename: 'malicious-script.exe',
    };
    expect(uploadInitRequestSchema.safeParse(unsupportedInit).success).toBe(
      false,
    );
  });

  it('validates project create and update schemas with strict name and length boundaries', () => {
    // Valid create
    expect(
      createProjectSchema.safeParse({ name: 'Valid Project' }).success,
    ).toBe(true);

    // Trim whitespace
    const parsed = createProjectSchema.safeParse({
      name: '  Trimmed Project  ',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe('Trimmed Project');
    }

    // Rejects empty or whitespace-only name
    expect(createProjectSchema.safeParse({ name: '' }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(
      createProjectSchema.safeParse({ name: 'a'.repeat(121) }).success,
    ).toBe(false);

    // Update schema partial
    expect(updateProjectSchema.safeParse({ name: 'New Name' }).success).toBe(
      true,
    );
    expect(updateProjectSchema.safeParse({ name: '' }).success).toBe(false);
    expect(updateProjectSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(
      updateProjectSchema.safeParse({ name: 'a'.repeat(121) }).success,
    ).toBe(false);
    expect(
      updateProjectSchema.safeParse({ description: 'a'.repeat(1001) }).success,
    ).toBe(false);
  });
});
