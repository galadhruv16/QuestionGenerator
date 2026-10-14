const sampleDoc = `
Chapter 3: Singly Linked Lists and Node Structure.
A singly linked list is a linear data structure where elements are not stored at contiguous memory locations.
Each element is an object called a node that contains a data field and a next pointer to the succeeding node.
The list begins with a head pointer.
Inserting at head takes O(1) constant time because only the head pointer is updated.
Deleting a node requires maintaining previous and current pointers.
Finding an element by index takes O(n) linear time because random access is impossible.

Section 3.2: Two-Pointer Techniques and Cycle Detection.
Floyd's Cycle Detection algorithm (Tortoise and Hare) uses two pointers that traverse the sequence at different speeds:
- A slow pointer advances by one node at each iteration (slow = slow.next).
- A fast pointer advances by two nodes at each iteration (fast = fast.next.next).
If a cycle exists, the fast pointer enters the cycle first, and the distance between the two pointers decreases by exactly 1 node per iteration, guaranteeing they collide within the cycle without an infinite loop.
`;

// Helper: Extract clean subtopics without jumbled bigrams
function extractCleanSubtopics(text, moduleName) {
  const subtopics = [];
  const seen = new Set();
  seen.add(moduleName.toLowerCase());

  // Pattern A: Capitalized multi-word technical concepts
  const capMatches = text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g);
  for (const m of capMatches) {
    const raw = m[1].trim();
    const lower = raw.toLowerCase();
    if (
      raw.length > 5 &&
      raw.length < 45 &&
      !seen.has(lower) &&
      !lower.includes(moduleName.toLowerCase()) &&
      !moduleName.toLowerCase().includes(lower)
    ) {
      seen.add(lower);
      // Sample sentence
      const sample = text.split(/[.!?]/).find(s => s.toLowerCase().includes(lower))?.trim();
      subtopics.push({
        name: raw,
        description: sample ? sample.slice(0, 100) + '...' : `Concepts covering ${raw}.`
      });
      if (subtopics.length >= 3) break;
    }
  }

  if (subtopics.length === 0) {
    subtopics.push({
      name: `${moduleName} Foundations`,
      description: `Core properties and operational behavior of ${moduleName}.`
    });
  }

  return subtopics;
}

function extractIntelligentModules(chunks) {
  if (!chunks || chunks.length === 0) return [];

  const detectedHeadings = [];
  const seenHeadings = new Set();

  for (const c of chunks) {
    const lines = c.text.split(/[\r\n]+/);
    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(
        /^(?:chapter|unit|section|module|\d+[.)])\s*[:\s-]*([^\n\r.]+)/i,
      ) || trimmed.match(/^#{1,3}\s+([^\n\r.]+)/);

      if (match && match[1]) {
        const clean = match[1].trim();
        const normalized = clean.toLowerCase();
        if (clean.length >= 4 && clean.length <= 60 && !seenHeadings.has(normalized)) {
          seenHeadings.add(normalized);
          detectedHeadings.push({ chunkIndex: c.chunk_index, heading: clean });
        }
      }
    }
  }

  if (detectedHeadings.length === 0) {
    const fullText = chunks.map(c => c.text).join('\n\n');
    const firstSentence = fullText.split(/[.!?]/)[0].trim().slice(0, 40);
    const mainTitle = firstSentence || 'Course Curriculum Unit';
    const subtopics = extractCleanSubtopics(fullText, mainTitle);
    return [{ name: mainTitle, description: `Core concepts of ${mainTitle}.`, subtopics }];
  }

  const modules = [];
  for (let i = 0; i < detectedHeadings.length; i++) {
    const currentHeading = detectedHeadings[i];
    const nextHeading = detectedHeadings[i + 1];

    const sectionChunks = chunks.filter(
      c => c.chunk_index >= currentHeading.chunkIndex && (!nextHeading || c.chunk_index < nextHeading.chunkIndex)
    );
    const sectionText = (sectionChunks.length > 0 ? sectionChunks : [chunks[currentHeading.chunkIndex]])
      .map(c => c.text)
      .join('\n\n');

    const cleanTitle = currentHeading.heading
      .replace(/^(chapter|unit|section|module|\d+[.)])\s*[:\s-]*/i, '')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    const subtopics = extractCleanSubtopics(sectionText, cleanTitle);
    modules.push({
      name: cleanTitle,
      description: `Unit covering ${cleanTitle} and associated operations.`,
      subtopics
    });
  }

  return modules;
}

const sampleChunks = [
  { chunk_index: 0, text: sampleDoc.split('Section 3.2')[0] },
  { chunk_index: 1, text: 'Section 3.2' + sampleDoc.split('Section 3.2')[1] }
];

console.log('--- EXTRACTED MODULES ---');
const mods = extractIntelligentModules(sampleChunks);
console.log(JSON.stringify(mods, null, 2));
