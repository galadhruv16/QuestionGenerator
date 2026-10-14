const text = `
Chapter 3: Singly Linked Lists and Node Structure.
A singly linked list is a linear data structure where elements are not stored at contiguous memory locations.
Each element is an object called a node that contains a data field and a next pointer to the succeeding node.
The list begins with a head pointer.
Inserting a node at the head takes O(1) constant time.
Deleting a node requires maintaining previous and current pointers.
Finding an element by index takes O(n) linear time because random access is impossible.

Section 3.3: Two-Pointer Techniques and Cycle Detection.
Floyd's Cycle Detection algorithm (Tortoise and Hare) uses two pointers that traverse the sequence at different speeds:
- A slow pointer advances by one node at each iteration.
- A fast pointer advances by two nodes at each iteration.
If a cycle exists, the fast pointer enters the cycle first, and the distance between them decreases by 1 node per iteration, guaranteeing they collide within the cycle without an infinite loop.
`;

const prompt = `You are a university curriculum designer.
Analyze this course text and extract the natural topic modules and their subtopics.
Do NOT force 3 modules. Decide the number of modules naturally based on the text.
Return strictly valid JSON:
{
  "modules": [
    {
      "name": "Clear Module Title (do not prefix with Module N)",
      "description": "Brief summary",
      "subtopics": [
        {
          "name": "Subtopic Name",
          "description": "Short explanation"
        }
      ]
    }
  ]
}

Text:
${text}`;

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
        num_predict: 300
      }
    })
  });
  const data = await res.json();
  console.log(`Took ${(Date.now() - t0) / 1000}s`);
  console.log(data.response);
} catch (e) {
  console.error(e);
}
