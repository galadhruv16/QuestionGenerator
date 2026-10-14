// Test refined extractor on sample text with JavaScript, Canvas, TOC, and glyphs
const sampleChunks = [
  {
    chunk_index: 0,
    id: 'c0',
    page_number: 1,
    text: `JavaScript for Beginners Course notes
    Table of Contents
    1. Introduction to JavaScript Variables .................... 5
    2. Functions and Scope ................................... 15
    3. DOM Manipulation and Events ........................... 30
    4. Asynchronous JavaScript and Promises .................. 55
    5. Object-Oriented JavaScript and Classes ................ 80`
  },
  {
    chunk_index: 1,
    id: 'c1',
    page_number: 5,
    text: `Chapter 1: JavaScript Variables and Data Types
    In JavaScript, variables can be declared using var, let, and const.
    • Primitive Data Types: Numbers, strings, booleans, null, and undefined.
    • Type Coercion: Implicit and explicit type conversions in JavaScript.
    • Variable Hoisting: How declarations are hoisted during compilation phase.`
  },
  {
    chunk_index: 2,
    id: 'c2',
    page_number: 15,
    text: `Chapter 2: Functions and Scope
    Functions are first-class citizens in JavaScript.
    • Function Declarations vs Expressions: Differences in hoisting and syntax.
    • Lexical Scope and Closures: Inner functions retaining access to outer scope.
    • Arrow Functions and This Binding: Lexical this in ES6 arrow functions.
    // Code sample:
    const calculateCenter = () => {
      let x = (win_width/2);
      let y = (win_height/2);
      return { x, y };
    };`
  },
  {
    chunk_index: 3,
    id: 'c3',
    page_number: 30,
    text: `Chapter 3: DOM Manipulation and Events
    The Document Object Model represents HTML documents as trees of objects.
    • Selecting DOM Elements: Using querySelector and getElementById.
    • Event Listeners and Propagation: Event bubbling and capturing phases.
    • Dynamic DOM Updates: Creating, appending, and removing elements in real-time.
    ⌧ Event-based Refers To Javascript's Ability To Run Certain tasks asynchronously.`
  },
  {
    chunk_index: 4,
    id: 'c4',
    page_number: 55,
    text: `Chapter 4: Asynchronous JavaScript and Promises
    JavaScript uses an event loop with a single execution thread.
    • Event Loop and Call Stack: Microtasks vs macrotasks execution order.
    • Promises and Async Await: Handling asynchronous operations cleanly.
    • Fetch API and HTTP Requests: Performing network requests in modern JavaScript.`
  }
];

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

function cleanTextString(str) {
  return str
    .replace(/[\u2300-\u23FF\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\uF000-\uFFFF]/g, ' ')
    .replace(/^[•\-\*–—\s\d.:)]+/, '')
    .replace(/[.;,:\s]+$/, '')
    .trim();
}

function isValidTitle(str) {
  if (!str) return false;
  const clean = cleanTextString(str);
  if (clean.length < 4 || clean.length > 55) return false;
  // Disqualify code, math, or TOC lines
  if (/[\(\)=\/{}\[\];<>\\`"']/.test(clean)) return false;
  if (/\.{2,}|…/.test(clean)) return false;
  if (/^(?:please|try again|note:|warning:|key points)/i.test(clean)) return false;
  const words = clean.split(/\s+/);
  if (words.length > 7) return false;
  // Must start with an uppercase letter
  if (!/^[A-Z]/.test(clean)) return false;
  return true;
}

function extractRefinedModules(chunks) {
  if (!chunks || chunks.length === 0) return [];

  // Filter out front-matter / TOC chunks (chunks with lots of dots or cover page)
  const contentChunks = chunks.filter((c) => {
    const dotCount = (c.text.match(/\.{3,}/g) || []).length;
    return dotCount < 3 && c.text.length > 80;
  });

  const activeChunks = contentChunks.length > 0 ? contentChunks : chunks;

  // 1. Detect explicit structural headings in the content
  // Strict regex with word boundaries \b
  const detectedHeadings = [];
  const headingRegex =
    /(?:^|\n)(?:#{1,3}\s+|(?:\d+\.?\s+)?\b(?:chapter|unit|section|part|module)\b\s*[:\s\d.]*)\s*([^\n\r.]+)/gi;

  for (const c of activeChunks) {
    for (const m of c.text.matchAll(headingRegex)) {
      const raw = (m[1] ?? '').trim();
      const clean = cleanTextString(raw.replace(/^(?:chapter|unit|section|part|module|\d+[.:])\s*/i, ''));
      if (isValidTitle(clean) && !STOPWORDS.has(clean.toLowerCase())) {
        detectedHeadings.push({ heading: clean, chunkId: c.id });
      }
    }
  }

  // Deduplicate detected headings
  const uniqueHeadings = [];
  const seenHeadings = new Set();
  for (const item of detectedHeadings) {
    const lower = item.heading.toLowerCase();
    if (!seenHeadings.has(lower)) {
      seenHeadings.add(lower);
      uniqueHeadings.push(item);
    }
  }

  const globalUsedSubtopics = new Set();

  const extractSubtopicsForSlice = (sliceChunks, moduleTitle) => {
    const subtopics = [];
    const lowerTitle = moduleTitle.toLowerCase();
    const sliceText = sliceChunks.map((c) => c.text).join('\n\n');

    // Extract bullet points from THIS module slice only
    const bulletMatches = sliceText.matchAll(/(?:^|\n)\s*[-*•]\s+([^\n\r.]+)/g);
    for (const m of bulletMatches) {
      const raw = (m[1] ?? '').trim();
      const clean = cleanTextString(raw.split(/[:–—]/)[0] || raw);
      if (isValidTitle(clean)) {
        const lower = clean.toLowerCase();
        if (!globalUsedSubtopics.has(lower) && !lowerTitle.includes(lower)) {
          globalUsedSubtopics.add(lower);
          subtopics.push({
            name: clean,
            description: `Core principles and practical implementation of ${clean}.`
          });
          if (subtopics.length >= 3) break;
        }
      }
    }

    // Next try capitalized technical phrases from THIS slice
    if (subtopics.length < 3) {
      const capMatches = sliceText.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g);
      for (const m of capMatches) {
        const phrase = cleanTextString(m[1] ?? '');
        if (isValidTitle(phrase)) {
          const lower = phrase.toLowerCase();
          if (!globalUsedSubtopics.has(lower) && !lowerTitle.includes(lower) && !STOPWORDS.has(lower)) {
            globalUsedSubtopics.add(lower);
            subtopics.push({
              name: phrase,
              description: `Detailed analysis and architectural rules covering ${phrase}.`
            });
            if (subtopics.length >= 3) break;
          }
        }
      }
    }

    if (subtopics.length === 0) {
      subtopics.push(
        {
          name: `${moduleTitle} Foundations`,
          description: `Core conceptual definitions, architecture, and principles of ${moduleTitle}.`
        },
        {
          name: `${moduleTitle} Applied Operations`,
          description: `Key algorithmic operations, best practices, and procedures in ${moduleTitle}.`
        }
      );
    }

    return subtopics;
  };

  const modules = [];

  if (uniqueHeadings.length >= 2) {
    // We found distinct explicit headings across the content!
    const maxModules = Math.min(uniqueHeadings.length, 6);
    for (let i = 0; i < maxModules; i++) {
      const { heading, chunkId } = uniqueHeadings[i];
      // Find chunk or related chunks for this heading
      const relevantChunks = activeChunks.filter((c) => c.id === chunkId || c.text.toLowerCase().includes(heading.toLowerCase()));
      const slice = relevantChunks.length > 0 ? relevantChunks : activeChunks;
      const subtopics = extractSubtopicsForSlice(slice, heading);
      modules.push({
        name: heading,
        description: `Comprehensive curriculum module covering ${heading}.`,
        subtopics
      });
    }
  } else {
    // Segment chunks dynamically
    const numModules = Math.min(5, Math.max(1, Math.ceil(activeChunks.length / 3)));
    const chunkSize = Math.max(1, Math.ceil(activeChunks.length / numModules));
    for (let i = 0; i < numModules; i++) {
      const slice = activeChunks.slice(i * chunkSize, (i + 1) * chunkSize);
      if (slice.length === 0) continue;
      const sliceText = slice.map((c) => c.text).join('\n\n');
      // Find best title for this slice
      let sliceTitle = `Module ${i + 1}`;
      const capMatches = sliceText.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g);
      for (const m of capMatches) {
        const candidate = cleanTextString(m[1] ?? '');
        if (isValidTitle(candidate) && !seenHeadings.has(candidate.toLowerCase())) {
          seenHeadings.add(candidate.toLowerCase());
          sliceTitle = candidate;
          break;
        }
      }
      const subtopics = extractSubtopicsForSlice(slice, sliceTitle);
      modules.push({
        name: sliceTitle,
        description: `Curriculum module focused on ${sliceTitle} and associated principles.`,
        subtopics
      });
    }
  }

  return modules;
}

const extracted = extractRefinedModules(sampleChunks);
console.log(JSON.stringify(extracted, null, 2));
