const testChunk = `
Chapter 3: Singly Linked Lists.
A singly linked list is a linear data structure in which elements are stored in nodes.
Each node contains a data field and a next pointer to the succeeding node.
The head pointer marks the beginning of the list.
Inserting a node at the head takes O(1) constant time because only the head pointer is updated.
Deleting a node requires updating the previous node's pointer to skip the target node.
Searching for an element requires O(n) linear traversal because nodes are not stored in contiguous memory.

Chapter 4: Cycle Detection with Floyd's Algorithm.
Floyd's Cycle Detection algorithm uses two pointers: a slow pointer and a fast pointer.
The slow pointer advances by one node at each step (slow = slow.next).
The fast pointer advances by two nodes at each step (fast = fast.next.next).
If a cycle exists, the fast pointer enters the loop and the distance between the two pointers decreases by 1 each step.
Eventually, the fast pointer collides with the slow pointer inside the cycle.
If the list is acyclic, the fast pointer reaches null and the algorithm terminates.
`;

console.log('Testing Ollama on localhost:11434...');

// 1. Test Topic Inference with Mistral
const topicPrompt = `You are an academic curriculum designer.
Analyze the following course material and extract the natural topic modules and subtopics.
Do NOT force a specific number of modules. Determine the number of modules naturally from the content length and structure (e.g. 1 to 5 modules as appropriate).
Return strictly valid JSON:
{
  "modules": [
    {
      "name": "Module Title",
      "description": "Brief description",
      "subtopics": [
        {
          "name": "Subtopic Name",
          "description": "Concept description"
        }
      ]
    }
  ]
}

Course Excerpts:
${testChunk}`;

console.log('--- Calling Ollama for Topic Inference ---');
const t0 = Date.now();
try {
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'mistral:latest',
      prompt: topicPrompt,
      format: 'json',
      stream: false,
      options: { temperature: 0.2 }
    })
  });
  const data = await res.json();
  console.log(`Topic inference took ${(Date.now() - t0) / 1000}s`);
  console.log('Topic Result:\n', data.response);
} catch (err) {
  console.error('Topic inference failed:', err.message);
}
