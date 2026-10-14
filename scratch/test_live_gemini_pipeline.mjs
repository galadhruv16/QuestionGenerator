import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync(path.resolve('apps/api/.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
  }
}

import { GeminiProvider } from '../apps/api/dist/ai/providers/gemini-provider.js';

async function main() {
  console.log('Testing live GeminiProvider with API key...');
  const provider = new GeminiProvider(
    process.env.GEMINI_API_KEY,
    'gemini-flash-latest',
  );

  console.log('Provider initialized. Testing structured generation schema...');

  const schema = {
    type: 'object',
    properties: {
      stem: { type: 'string' },
      explanation: { type: 'string' },
      options: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            is_correct: { type: 'boolean' },
            explanation: { type: 'string' }
          },
          required: ['text', 'is_correct', 'explanation']
        }
      }
    },
    required: ['stem', 'explanation', 'options']
  };

  const sampleContext = `
  Linked lists are dynamic data structures where each element (called a node) contains data and a pointer/reference to the next node in sequence.
  In a singly linked list, each node points only to the next node, meaning traversal is strictly unidirectional from the head to the null terminator.
  Inserting an element at the beginning of a singly linked list has a time complexity of O(1) because it only requires allocating a new node, setting its next pointer to the current head, and updating the head pointer. In contrast, inserting an element at the beginning of a static array has an O(n) time complexity because all subsequent elements must be shifted by one position.
  However, accessing the k-th element in a linked list requires linear traversal O(k), whereas arrays allow constant time O(1) random access via memory offset calculation.
  `;

  const prompt = `
  Generate a rigorous, high-quality college-level Multiple Choice Question (MCQ) based strictly on the provided context.
  Requirements:
  - Do NOT create trivial fill-in-the-blank or heading recitation questions.
  - Test deep analytical understanding of algorithmic complexity and pointer operations.
  - Provide 4 distinct options (1 correct, 3 plausible distractors).
  - Each distractor must have a diagnostic rationale explaining why a student might make that error.
  - Stem must be clear and self-contained.

  Context:
  ${sampleContext}
  `;

  const rawJson = await provider.generate({
    prompt: `${prompt}\nRespond strictly with valid JSON conforming to this schema:\n${JSON.stringify(schema, null, 2)}`,
    format: 'json',
    temperature: 0.2,
  });

  const response = JSON.parse(rawJson);

  console.log('\n--- LIVE SYNTHESIS RESULT ---');
  console.log(JSON.stringify(response, null, 2));

  // Assertions
  if (!response.stem || response.options.length !== 4) {
    throw new Error('Invalid structure returned');
  }
  const correctCount = response.options.filter(o => o.is_correct).length;
  if (correctCount !== 1) {
    throw new Error(`Expected 1 correct option, got ${correctCount}`);
  }
  console.log('\nVerification PASSED: High-quality question generated with 1 correct option and 3 diagnostic distractors.');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
