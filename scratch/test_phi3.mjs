const linkedListChunk = `Section 3.3: Two-Pointer Techniques and Cycle Detection.
Floyd's Cycle Detection algorithm (also known as the Tortoise and the Hare algorithm) detects cycles in a singly linked list using two pointers that traverse the sequence at different speeds:
- A slow pointer advances by one node at each iteration (slow = slow.next).
- A fast pointer advances by two nodes at each iteration (fast = fast.next.next).
If the linked list is acyclic, the fast pointer will eventually encounter null and terminate.
If a cycle exists, the fast pointer enters the cycle first, and the distance between the two pointers decreases by exactly 1 node per iteration, guaranteeing they collide within the cycle without an infinite loop.
To find the start of the cycle, reset one pointer to the head of the list while leaving the other at the collision node, then advance both pointers one node at a time until they meet again.`;

const prompt = `You are a computer science professor creating an exam question.
Source Text:
"""${linkedListChunk}"""

Target Specifications:
- Topic: "Cycle Detection in Linked Lists"
- Cognitive Level: Bloom ANALYZE
- Difficulty: HARD
- Question Type: MCQ

Generate a rigorous assessment item grounded strictly in the source text.
Return strictly a valid JSON object matching this schema:
{
  "stem": "Question stem here...",
  "options": [
    { "option_index": 0, "option_text": "...", "is_correct": false, "explanation": "Distractor rationale..." },
    { "option_index": 1, "option_text": "...", "is_correct": true, "explanation": "Why correct..." },
    { "option_index": 2, "option_text": "...", "is_correct": false, "explanation": "Distractor rationale..." },
    { "option_index": 3, "option_text": "...", "is_correct": false, "explanation": "Distractor rationale..." }
  ],
  "model_answer": "Detailed solution...",
  "citation_anchor": "Brief source grounding sentence..."
}`;

const start = Date.now();
try {
  const res = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'phi3:latest',
      prompt,
      format: 'json',
      stream: false,
      options: { temperature: 0.2 }
    })
  });
  const data = await res.json();
  console.log('Elapsed:', (Date.now() - start) / 1000, 's');
  console.log('GENERATED REAL QUESTION:\n', data.response);
} catch (err) {
  console.error(err);
}
