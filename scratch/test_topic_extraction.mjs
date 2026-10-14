// Stopwords to filter out
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'did', 'do',
  'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having',
  'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
  'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on',
  'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should',
  'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there',
  'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we',
  'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your',
  'yours', 'yourself', 'yourselves', 'also', 'using', 'used', 'each', 'every', 'case', 'such', 'following'
]);

export function extractDocumentKeyPhrases(text) {
  // Extract technical phrases: Capitalized compounds (e.g. "Linked Lists", "Floyd Cycle Detection", "Sentinel Nodes")
  // and frequent 2-3 word sequences
  const phraseCounts = new Map();

  // Pattern 1: Title or section headings
  const headingMatches = text.matchAll(/(?:chapter|unit|module|section|\d+[.)])\s*[:\s]*([^\n\r.]+)/gi);
  for (const m of headingMatches) {
    const raw = m[1].trim();
    if (raw.length > 3 && raw.length < 60) {
      phraseCounts.set(raw, (phraseCounts.get(raw) || 0) + 10);
    }
  }

  // Pattern 2: Multi-word capitalized technical concepts (e.g., "Singly Linked List", "Floyd Cycle Detection", "Sentinel Node")
  const capMatches = text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g);
  for (const m of capMatches) {
    const phrase = m[1].trim();
    if (phrase.length > 4 && !STOPWORDS.has(phrase.toLowerCase())) {
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 4);
    }
  }

  // Pattern 3: Common 2-word technical grams
  const words = text
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length > 2 && !STOPWORDS.has(w));

  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    phraseCounts.set(bigram, (phraseCounts.get(bigram) || 0) + 1);
  }

  return Array.from(phraseCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([p]) => p);
}

export function extractIntelligentModules(chunks) {
  if (!chunks || chunks.length === 0) return [];

  const fullText = chunks.map(c => c.text).join('\n\n');
  const allPhrases = extractDocumentKeyPhrases(fullText);

  // Group chunks into 2-3 progressive modules
  const splitCount = Math.min(chunks.length, 3);
  const chunkSize = Math.ceil(chunks.length / splitCount);
  const modules = [];

  for (let i = 0; i < splitCount; i++) {
    const slice = chunks.slice(i * chunkSize, (i + 1) * chunkSize);
    if (slice.length === 0) continue;

    const sliceText = slice.map(c => c.text).join('\n\n');
    const slicePhrases = extractDocumentKeyPhrases(sliceText);

    // Module name derived from heading or top phrase in this slice
    let moduleHeading = slicePhrases[0];
    if (!moduleHeading) {
      // Find top sentence in slice
      const firstSentence = slice[0].text.split(/[.!?]/)[0].trim().slice(0, 50);
      moduleHeading = firstSentence || `Curriculum Unit ${i + 1}`;
    }

    // Capitalize properly
    const cleanModuleName = moduleHeading
      .replace(/^(chapter|section|module|unit|\d+[.:])\s*/i, '')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    // Subtopics from secondary phrases in slice
    const subtopics = [];
    const usedSub = new Set();
    for (const phrase of slicePhrases) {
      const cleanSub = phrase.replace(/^(chapter|section|module|unit|\d+[.:])\s*/i, '').trim();
      const lower = cleanSub.toLowerCase();
      // Ensure multi-word technical concept or capitalized compound
      const wordCount = cleanSub.split(/\s+/).length;
      if (
        cleanSub.length > 5 &&
        wordCount >= 2 &&
        !usedSub.has(lower) &&
        !cleanModuleName.toLowerCase().includes(lower) &&
        !lower.includes(cleanModuleName.toLowerCase())
      ) {
        usedSub.add(lower);
        // Find a representative sentence from slice mentioning this phrase
        const sampleSentence = sliceText.split(/[.!?]/).find(s => s.toLowerCase().includes(lower))?.trim();
        subtopics.push({
          name: cleanSub.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          description: sampleSentence ? sampleSentence.slice(0, 110) + '...' : `Key curriculum concepts covering ${cleanSub}.`
        });
        if (subtopics.length >= 3) break;
      }
    }

    if (subtopics.length === 0) {
      subtopics.push({
        name: `${cleanModuleName} Principles`,
        description: `Fundamental properties and algorithmic behavior of ${cleanModuleName}.`
      });
    }

    modules.push({
      name: `Module ${i + 1}: ${cleanModuleName}`,
      description: `Syllabus topic unit covering ${cleanModuleName} and associated operations.`,
      subtopics
    });
  }

  return modules;
}

// TEST
const linkedListChunks = [
  {
    id: 'c1',
    chunk_index: 0,
    page_number: 1,
    text: 'Chapter 3: Singly Linked Lists and Node Structure. A singly linked list is a linear data structure where elements are not stored at contiguous memory locations. Each element is an object called a node that contains a data field and a next pointer to the succeeding node. The list begins with a head pointer.'
  },
  {
    id: 'c2',
    chunk_index: 1,
    page_number: 2,
    text: 'Section 3.2: Linked List Operations - Insertion and Deletion. Inserting at head takes O(1) time. Deleting a node requires maintaining previous and current pointers. Finding an element by index takes O(n) linear time because random access is impossible.'
  },
  {
    id: 'c3',
    chunk_index: 2,
    page_number: 3,
    text: 'Section 3.3: Two-Pointer Techniques and Cycle Detection. Floyd Cycle Detection algorithm (Tortoise and Hare) uses a slow pointer advancing one step and a fast pointer advancing two steps. If a cycle exists, fast and slow will collide within the loop.'
  },
  {
    id: 'c4',
    chunk_index: 3,
    page_number: 4,
    text: 'Chapter 4: Doubly Linked Lists and Sentinel Nodes. Doubly linked lists contain both next and prev pointers. Circular linked lists connect the tail node back to the head. Sentinel nodes (dummy head and tail) eliminate boundary condition checks for empty lists.'
  }
];

const res = extractIntelligentModules(linkedListChunks);
console.log('RESULT:\n', JSON.stringify(res, null, 2));
