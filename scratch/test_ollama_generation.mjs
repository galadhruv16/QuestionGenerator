const model = 'phi3:latest';
const prompt = `You are a computer science professor creating an exam question.
Topic: Singly Linked Lists
Cognitive Level: Bloom ANALYZE
Difficulty: HARD
Format: MCQ

Return strictly a valid JSON object matching:
{
  "stem": "Question stem here...",
  "options": [
    { "option_index": 0, "option_text": "Option A...", "is_correct": false, "explanation": "Distractor rationale..." },
    { "option_index": 1, "option_text": "Option B...", "is_correct": true, "explanation": "Why correct..." },
    { "option_index": 2, "option_text": "Option C...", "is_correct": false, "explanation": "Distractor rationale..." },
    { "option_index": 3, "option_text": "Option D...", "is_correct": false, "explanation": "Distractor rationale..." }
  ],
  "model_answer": "Detailed answer explanation...",
  "citation_anchor": "Floyd cycle detection pointers"
}`;

async function main() {
  console.log('Sending request to Ollama using model', model);
  const start = Date.now();
  const res = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      format: 'json',
      stream: false,
      options: { temperature: 0.2 }
    })
  });
  const data = await res.json();
  console.log('Elapsed ms:', Date.now() - start);
  console.log('RESULT:\n', data.response);
}

main().catch(console.error);
