const chunk = `A singly linked list is a linear data structure where elements are not stored at contiguous memory locations. Each element is an object called a node that contains a data field and a next pointer to the succeeding node. The list begins with a head pointer. Inserting at head takes O(1) time. Deleting a node requires maintaining previous and current pointers. Finding an element by index takes O(n) linear time because random access is impossible.`;

const prompt = `You are a computer science professor.
Generate a multiple choice question based on this text:
"""${chunk}"""

Output strictly valid JSON with no markdown:
{
  "stem": "Question stem",
  "options": [
    {"option_text": "...", "is_correct": true, "explanation": "..."},
    {"option_text": "...", "is_correct": false, "explanation": "..."},
    {"option_text": "...", "is_correct": false, "explanation": "..."},
    {"option_text": "...", "is_correct": false, "explanation": "..."}
  ],
  "model_answer": "...",
  "explanation": "..."
}`;

console.log('Sending request to Ollama (phi3:latest)...');
const t0 = Date.now();
try {
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'phi3:latest',
      prompt,
      format: 'json',
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 250 // limit output tokens so it finishes fast!
      }
    })
  });
  const data = await res.json();
  console.log(`Took ${(Date.now() - t0) / 1000}s`);
  console.log(data.response);
} catch (e) {
  console.error(e);
}
