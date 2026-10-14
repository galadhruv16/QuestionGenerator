function synthesizeCleanFallbackQuestion({ chunkText, target, topicName }) {
  const cleanTopic = topicName.replace(/^Module \d+[:\s-]*/i, '').trim();

  // Extract clean informative sentences from chunk
  const sentences = chunkText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim().replace(/\s+/g, ' '))
    .filter(s => s.length > 30 && !/^(?:chapter|section|unit|module|\d+[.)])/i.test(s));

  const factSentence = sentences[0] || `The operational behavior of ${cleanTopic} defines its algorithmic guarantees.`;
  const cleanFact = factSentence.replace(/\.$/, '');

  if (target.typeSlug === 'MCQ') {
    return {
      stem: `Which of the following statements accurately characterizes the operational behavior and complexity of ${cleanTopic}?`,
      question_type: 'MCQ',
      options: [
        {
          option_index: 0,
          option_text: `${cleanFact}.`,
          is_correct: true,
          explanation: `Correct: Accurately reflects the course material: "${cleanFact}".`
        },
        {
          option_index: 1,
          option_text: `Elements in ${cleanTopic} permit direct random-access indexing in O(1) time through contiguous memory calculation.`,
          is_correct: false,
          explanation: `Incorrect: Confounds pointer-linked structures with contiguous arrays; random indexing is not directly accessible.`
        },
        {
          option_index: 2,
          option_text: `Modifying references in ${cleanTopic} requires a global traversal of all preceding nodes before executing any local update.`,
          is_correct: false,
          explanation: `Incorrect: Local pointer updates do not necessitate full sequential traversal of unaffected elements.`
        },
        {
          option_index: 3,
          option_text: `Every insertion or deletion operation in ${cleanTopic} automatically invalidates all existing element pointers.`,
          is_correct: false,
          explanation: `Incorrect: Existing node references remain valid unless specifically rewritten during pointer reassignment.`
        }
      ],
      model_answer: `${cleanFact}.`,
      explanation: `Ground truth is derived directly from the curriculum text: "${cleanFact}".`,
      citation_anchor: factSentence,
      evidence_quote: factSentence
    };
  }

  if (target.typeSlug === 'SHORT_ANSWER') {
    return {
      stem: `Explain the fundamental operational mechanism of ${cleanTopic} and describe the conditions required for its correct execution.`,
      question_type: 'SHORT_ANSWER',
      model_answer: `${cleanFact}. In practice, pointer modifications must be performed in strict sequence to avoid broken references, null pointer exceptions, or infinite loops.`,
      rubric_criteria: [
        `Accurately explains the core mechanism of ${cleanTopic} (40%)`,
        `Identifies correct pointer order and boundary condition handling (40%)`,
        `Uses precise technical terminology and complexity notations (20%)`
      ],
      explanation: `Assesses fundamental understanding of ${cleanTopic} based on: "${factSentence}".`,
      citation_anchor: factSentence,
      evidence_quote: factSentence
    };
  }

  // LONG_ANSWER
  return {
    stem: `Analyze the structural implementation and runtime characteristics of ${cleanTopic}. Detail how pointer references are maintained during operations, identify potential edge cases or failure modes, and evaluate the trade-offs between execution speed and memory overhead.`,
    question_type: 'LONG_ANSWER',
    model_answer: `${cleanFact}.\n\nWhen implementing operations on ${cleanTopic}, edge cases such as empty states, boundary insertions, and cyclic dependencies require explicit pointer validation to preserve structural invariants. While dynamic pointer structures eliminate the need for pre-allocated contiguous memory blocks, they incur additional memory overhead for storing pointer references and trade off constant-time random indexing in favor of efficient localized modifications.`,
    rubric_criteria: [
      `Rigorous analysis of structural mechanics and pointer management (35%)`,
      `Comprehensive edge case and boundary evaluation (35%)`,
      `Critical assessment of asymptotic complexity and memory trade-offs (30%)`
    ],
    explanation: `Requires in-depth technical analysis of ${cleanTopic} grounded in: "${factSentence}".`,
    citation_anchor: factSentence,
    evidence_quote: factSentence
  };
}

const sampleChunk = `A singly linked list is a linear data structure where elements are not stored at contiguous memory locations. Each element is an object called a node that contains a data field and a next pointer to the succeeding node. The list begins with a head pointer. Inserting at head takes O(1) time.`;

console.log('--- SAMPLE MCQ ---');
console.log(JSON.stringify(synthesizeCleanFallbackQuestion({
  chunkText: sampleChunk,
  target: { typeSlug: 'MCQ', bloomSlug: 'analyze', difficultySlug: 'hard', sequenceNumber: 1, styleSlug: 'analytical', topicId: null },
  topicName: 'Singly Linked Lists and Node Structure'
}), null, 2));

console.log('--- SAMPLE LONG ANSWER ---');
console.log(JSON.stringify(synthesizeCleanFallbackQuestion({
  chunkText: sampleChunk,
  target: { typeSlug: 'LONG_ANSWER', bloomSlug: 'evaluate', difficultySlug: 'hard', sequenceNumber: 2, styleSlug: 'scenario', topicId: null },
  topicName: 'Singly Linked Lists and Node Structure'
}), null, 2));
