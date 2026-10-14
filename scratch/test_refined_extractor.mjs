// Test refined intelligent extractor

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
  'yours', 'yourself', 'yourselves', 'also', 'using', 'used', 'case', 'following', 'chapter', 'section', 'module', 'unit'
]);

function extractIntelligentModules(chunks) {
  if (!chunks || chunks.length === 0) return [];

  const fullText = chunks.map((c) => c.text).join('\n\n');

  // 1. Detect explicit headings in the text
  const detectedHeadings = [];
  const headingRegex = /(?:^|\n)(?:#{1,3}\s+|(?:\d+\.?\s+)?(?:chapter|unit|section|part)\s*[:\s\d.]*)\s*([^\n\r.]+)/gi;
  for (const m of fullText.matchAll(headingRegex)) {
    const raw = (m[1] ?? '').trim();
    if (raw.length >= 4 && raw.length <= 60) {
      const clean = raw.replace(/^(?:chapter|unit|section|part|\d+[.:])\s*/i, '').trim();
      if (clean.length >= 4 && !STOPWORDS.has(clean.toLowerCase())) {
        detectedHeadings.push(clean);
      }
    }
  }

  // Deduplicate detected headings preserving order
  const uniqueHeadings = [];
  const seenHeadings = new Set();
  for (const h of detectedHeadings) {
    const lower = h.toLowerCase();
    if (!seenHeadings.has(lower)) {
      seenHeadings.add(lower);
      uniqueHeadings.push(
        h.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
      );
    }
  }

  // 2. Extract technical capitalized phrases & bullet concepts across text
  const conceptPhrases = [];
  const capMatches = fullText.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g);
  for (const m of capMatches) {
    const phrase = (m[1] ?? '').trim();
    if (phrase.length > 5 && !STOPWORDS.has(phrase.toLowerCase())) {
      conceptPhrases.push(phrase);
    }
  }

  // Extract bullet points
  const bulletMatches = fullText.matchAll(/(?:^|\n)\s*[-*•]\s+([^\n\r.]+)/g);
  const bulletItems = [];
  for (const m of bulletMatches) {
    const item = (m[1] ?? '').trim();
    if (item.length >= 6 && item.length <= 80) {
      bulletItems.push(item);
    }
  }

  // Count phrase frequencies
  const phraseCounts = new Map();
  for (const p of conceptPhrases) {
    const lower = p.toLowerCase();
    phraseCounts.set(lower, (phraseCounts.get(lower) || 0) + 1);
  }
  const topPhrases = Array.from(phraseCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([lower]) => {
      const original = conceptPhrases.find((c) => c.toLowerCase() === lower);
      return original || lower;
    });

  const primaryTopic = topPhrases[0] || 'Core Subject Matter';

  // 3. Determine module structure dynamically
  const modules = [];

  if (uniqueHeadings.length >= 2) {
    // Multiple explicit headings found -> each heading is a module!
    const selectedHeadings = uniqueHeadings.slice(0, 5);
    for (const heading of selectedHeadings) {
      const subtopics = extractSubtopicsForTopic(fullText, heading, bulletItems, topPhrases);
      modules.push({
        name: heading,
        description: `Comprehensive study of ${heading} and associated principles.`,
        subtopics,
      });
    }
  } else if (uniqueHeadings.length === 1) {
    // Only one explicit heading found.
    const heading = uniqueHeadings[0];
    if (primaryTopic && primaryTopic.toLowerCase() !== heading.toLowerCase()) {
      modules.push({
        name: `${primaryTopic} Fundamentals`,
        description: `Foundational concepts, representation, and memory mechanics of ${primaryTopic}.`,
        subtopics: extractSubtopicsForTopic(fullText, primaryTopic, bulletItems, topPhrases),
      });
    }
    modules.push({
      name: heading,
      description: `Comprehensive study of ${heading} and associated principles.`,
      subtopics: extractSubtopicsForTopic(fullText, heading, bulletItems, topPhrases),
    });
  } else {
    // No explicit headings found: decide based on document length
    if (chunks.length <= 4) {
      // Short document / single topic (e.g. 2-page handout on Linked Lists) -> 1 cohesive module!
      const subtopics = extractSubtopicsForTopic(fullText, primaryTopic, bulletItems, topPhrases);
      modules.push({
        name: primaryTopic,
        description: `Comprehensive coverage of ${primaryTopic} architecture and algorithmic operations.`,
        subtopics,
      });
    } else {
      // Medium to long document without explicit headings -> 2 distinct complementary modules
      const secondaryTopic = topPhrases[1] && topPhrases[1].toLowerCase() !== primaryTopic.toLowerCase()
        ? topPhrases[1]
        : 'Algorithmic Operations & Analysis';

      modules.push({
        name: `${primaryTopic} Fundamentals & Representation`,
        description: `Core architecture, pointer representations, and memory mechanics of ${primaryTopic}.`,
        subtopics: extractSubtopicsForTopic(fullText, primaryTopic, bulletItems, topPhrases),
      });

      modules.push({
        name: `${secondaryTopic} & Complexity Analysis`,
        description: `Algorithmic procedures, edge condition handling, and asymptotic trade-offs for ${secondaryTopic}.`,
        subtopics: extractSubtopicsForTopic(fullText, secondaryTopic, bulletItems, topPhrases.slice(2)),
      });
    }
  }

  return modules;
}

function extractSubtopicsForTopic(fullText, topicName, bulletItems, candidatePhrases) {
  const subtopics = [];
  const used = new Set();
  const lowerTopic = topicName.toLowerCase();

  // Try bullets first
  for (const bullet of bulletItems) {
    const lower = bullet.toLowerCase();
    if (!used.has(lower) && !lowerTopic.includes(lower) && !lower.includes(lowerTopic)) {
      used.add(lower);
      const cleanTitle = bullet.slice(0, 50).trim();
      subtopics.push({
        name: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
        description: `Detailed exploration of ${cleanTitle} as specified in the curriculum.`,
      });
      if (subtopics.length >= 3) break;
    }
  }

  // Next try top phrases
  for (const phrase of candidatePhrases) {
    if (subtopics.length >= 4) break;
    const lower = phrase.toLowerCase();
    if (!used.has(lower) && !lowerTopic.includes(lower) && !lower.includes(lowerTopic)) {
      used.add(lower);
      // Find sentence explaining phrase
      const sentence = fullText
        .split(/(?<=[.!?])\s+/)
        .find((s) => s.toLowerCase().includes(lower));

      subtopics.push({
        name: phrase,
        description: sentence
          ? `${sentence.trim().slice(0, 110)}...`
          : `Core curricular principles and operations covering ${phrase}.`,
      });
    }
  }

  if (subtopics.length === 0) {
    subtopics.push(
      {
        name: `${topicName} Structural Principles`,
        description: `Foundational definitions and structural guarantees of ${topicName}.`,
      },
      {
        name: `${topicName} Operational Procedures`,
        description: `Step-by-step algorithms, pointer manipulations, and state invariants.`,
      }
    );
  }

  return subtopics;
}

const sampleDocument = [
  {
    chunk_index: 0,
    id: 'c1',
    page_number: 1,
    text: `A singly linked list is a linear data structure where elements are not stored at contiguous memory locations.
Each element is an object called a node that contains a data field and a next pointer to the succeeding node.
The list begins with a head pointer.
Inserting at head takes O(1) constant time.
Deleting a node requires maintaining previous and current pointers.`
  },
  {
    chunk_index: 1,
    id: 'c2',
    page_number: 2,
    text: `Section 2: Two-Pointer Techniques and Cycle Detection.
Floyd Cycle Detection algorithm uses two pointers:
- Slow pointer advances by one node at each iteration.
- Fast pointer advances by two nodes at each iteration.
If a cycle exists, the fast pointer enters first and they collide without infinite looping.`
  }
];

const result = extractIntelligentModules(sampleDocument);
console.log('--- REFINED MODULE EXTRACTION RESULT ---');
console.log(JSON.stringify(result, null, 2));
