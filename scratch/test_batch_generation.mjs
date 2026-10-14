import fs from 'fs';

const envContent = fs.readFileSync('apps/api/.env', 'utf-8');
const keyMatch = envContent.match(/GEMINI_API_KEY=([^\r\n]+)/);
const key = keyMatch ? keyMatch[1].trim() : '';

const model = 'gemini-flash-lite-latest';
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

const prompt = `You are an expert university exam assessment designer.
Generate exactly 3 distinct multiple-choice questions for the following curriculum specifications:

[Target 1]
- Sequence: 1
- Topic: "JavaScript Variable Declaration"
- Cognitive Level: Bloom REMEMBER
- Difficulty: easy
- Excerpt: "JavaScript variables are containers for storing data values. In modern JavaScript, let and const are preferred over var. let allows reassigning values, while const declares block-scoped read-only constants."

[Target 2]
- Sequence: 2
- Topic: "JavaScript Variable Scoping"
- Cognitive Level: Bloom UNDERSTAND
- Difficulty: medium
- Excerpt: "Variables declared with var are function-scoped or globally-scoped, leading to hoisting anomalies. Variables declared with let and const have block scope, meaning they only exist within the curly braces where they were defined."

[Target 3]
- Sequence: 3
- Topic: "JavaScript Constant Mutation"
- Cognitive Level: Bloom APPLY
- Difficulty: medium
- Excerpt: "The const declaration prevents reassigning the identifier, but it does not make the underlying object immutable. Object properties and array elements declared with const can still be modified."

Return strictly valid JSON with this schema:
{
  "questions": [
    {
      "sequence_number": 1,
      "stem": "Question stem...",
      "question_type": "MCQ",
      "options": [
        { "option_index": 0, "option_text": "...", "is_correct": false, "explanation": "..." },
        { "option_index": 1, "option_text": "...", "is_correct": true, "explanation": "..." },
        { "option_index": 2, "option_text": "...", "is_correct": false, "explanation": "..." },
        { "option_index": 3, "option_text": "...", "is_correct": false, "explanation": "..." }
      ],
      "model_answer": "...",
      "explanation": "...",
      "citation_anchor": "..."
    }
  ]
}`;

console.log('Testing batch generation with', model);
const start = Date.now();
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' }
  })
});

console.log('Status:', res.status, 'Time:', Date.now() - start, 'ms');
const text = await res.text();
const parsed = JSON.parse(text);
const rawOut = parsed.candidates[0].content.parts[0].text;
const jsonOut = JSON.parse(rawOut);
console.log('Generated questions count:', jsonOut.questions?.length);
console.log('Sample Stem #1:', jsonOut.questions?.[0]?.stem);
console.log('Sample Stem #2:', jsonOut.questions?.[1]?.stem);
console.log('Sample Stem #3:', jsonOut.questions?.[2]?.stem);
