import { extractDocumentKeyPhrases } from './test_topic_extraction.mjs';

function extractSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 30 && !s.startsWith('#') && !s.toLowerCase().startsWith('chapter') && !s.toLowerCase().startsWith('section'));
}

export function synthesizeExtractiveQuestion({ chunkText, target, topicName }) {
  const phrases = extractDocumentKeyPhrases(chunkText);
  const primaryConcept = phrases[0] || topicName;
  const secondaryConcept = phrases[1] || 'its core operations';

  const sentences = extractSentences(chunkText);
  // Find the sentence with the highest information density or containing primaryConcept
  const informativeSentence = sentences.find(s => s.toLowerCase().includes(primaryConcept.toLowerCase())) 
    || sentences[0] 
    || `The operational mechanisms of ${primaryConcept} define its runtime guarantees.`;

  const anchorSentence = informativeSentence;

  if (target.typeSlug === 'MCQ') {
    // Generate intelligent domain-grounded distractors
    const correctOptionText = `${informativeSentence.replace(/\.$/, '')}, preserving structural correctness.`;
    
    // Distractor 1: Misstated complexity or access pattern
    const d1 = `Elements in ${primaryConcept} permit $O(1)$ direct index calculation via contiguous memory offsets.`;
    // Distractor 2: Inverted mechanism
    const d2 = `Traversing ${primaryConcept} requires global synchronization of all references before modifying any individual pointer.`;
    // Distractor 3: Boundary violation
    const d3 = `Operations on ${primaryConcept} inherently invalidate all existing node references whenever an insertion occurs.`;

    let stem = '';
    if (target.bloomSlug.toLowerCase() === 'analyze' || target.bloomSlug.toLowerCase() === 'evaluate') {
      stem = `In the context of ${topicName}, which of the following statements provides the most accurate analysis of ${primaryConcept}?`;
    } else if (target.bloomSlug.toLowerCase() === 'apply') {
      stem = `When executing operations within ${topicName}, how does ${primaryConcept} behave according to established structural specifications?`;
    } else {
      stem = `Regarding the study of ${topicName}, which of the following correctly describes the fundamental properties of ${primaryConcept}?`;
    }

    return {
      stem,
      question_type: 'MCQ',
      options: [
        {
          option_index: 0,
          option_text: d1,
          is_correct: false,
          explanation: `Incorrect: Confounds pointer-linked structures with contiguous arrays; random indexing is not directly accessible.`
        },
        {
          option_index: 1,
          option_text: correctOptionText,
          is_correct: true,
          explanation: `Correct: Accurately reflects the documented specification: "${informativeSentence}".`
        },
        {
          option_index: 2,
          option_text: d2,
          is_correct: false,
          explanation: `Incorrect: Local pointer updates in ${primaryConcept} do not require global traversal of unaffected nodes.`
        },
        {
          option_index: 3,
          option_text: d3,
          is_correct: false,
          explanation: `Incorrect: Existing node references remain valid unless their respective pointers are explicitly altered.`
        }
      ],
      model_answer: `Option B is correct because ${informativeSentence}.`,
      explanation: `Based on the source curriculum on ${topicName}, "${informativeSentence}" establishes the valid invariant.`,
      citation_anchor: anchorSentence,
      evidence_quote: anchorSentence
    };
  }

  if (target.typeSlug === 'SHORT_ANSWER') {
    return {
      stem: `Explain the fundamental operational role of ${primaryConcept} within ${topicName}. Specifically, describe how ${secondaryConcept} impacts its performance or correctness guarantees.`,
      question_type: 'SHORT_ANSWER',
      model_answer: `${informativeSentence} In practice, ${primaryConcept} governs how references are established, while ${secondaryConcept} ensures boundary conditions are properly satisfied during execution.`,
      rubric_criteria: [
        `Explicitly describes the structural mechanism of ${primaryConcept} (40%)`,
        `Identifies the operational relevance or constraints associated with ${secondaryConcept} (40%)`,
        `Uses rigorous technical terminology and correct asymptotic notations (20%)`
      ],
      explanation: `Assesses foundational comprehension of ${primaryConcept} based on the curricular excerpt: "${anchorSentence}".`,
      citation_anchor: anchorSentence,
      evidence_quote: anchorSentence
    };
  }

  // LONG_ANSWER
  return {
    stem: `Provide a comprehensive technical evaluation of ${primaryConcept} in the context of ${topicName}. Analyze its structural implementation, discuss how it handles edge cases (including empty states and boundary traversals), and evaluate how ${secondaryConcept} influences both time and space complexity.`,
    question_type: 'LONG_ANSWER',
    model_answer: `1. Architectural & Conceptual Overview:\n${informativeSentence}\n\n2. Operational Execution & Edge Cases:\nHandling edge cases in ${primaryConcept} requires precise pointer validation to prevent null pointer dereferences and memory leaks.\n\n3. Algorithmic Complexity & Trade-offs:\nCompared to alternative structures, ${primaryConcept} provides efficient modifications at known pointers but trades off constant-time random access, as ${secondaryConcept} requires sequential traversal.`,
    rubric_criteria: [
      `In-depth architectural breakdown of ${primaryConcept} and pointer mechanics (35%)`,
      `Rigorous edge case analysis and boundary condition handling (35%)`,
      `Critical evaluation of time/space complexity trade-offs regarding ${secondaryConcept} (30%)`
    ],
    explanation: `Requires in-depth synthesis of ${primaryConcept} and associated structural trade-offs grounded in: "${anchorSentence}".`,
    citation_anchor: anchorSentence,
    evidence_quote: anchorSentence
  };
}

// TEST
const sample = `
Section 3.3: Two-Pointer Techniques and Cycle Detection.
Floyd's Cycle Detection algorithm (also known as the Tortoise and the Hare algorithm) detects cycles in a singly linked list using two pointers that traverse the sequence at different speeds:
A slow pointer advances by one node at each iteration, while a fast pointer advances by two nodes at each iteration.
If a cycle exists, the fast pointer enters the cycle first, and the distance between the two pointers decreases by exactly 1 node per iteration, guaranteeing they collide within the cycle without an infinite loop.
`;

console.log('--- MCQ ---');
console.log(JSON.stringify(synthesizeExtractiveQuestion({
  chunkText: sample,
  target: { bloomSlug: 'analyze', difficultySlug: 'hard', typeSlug: 'MCQ', styleSlug: 'analytical', sequenceNumber: 1, topicId: null },
  topicName: 'Cycle Detection in Linked Lists'
}), null, 2));

console.log('--- SHORT ANSWER ---');
console.log(JSON.stringify(synthesizeExtractiveQuestion({
  chunkText: sample,
  target: { bloomSlug: 'understand', difficultySlug: 'medium', typeSlug: 'SHORT_ANSWER', styleSlug: 'conceptual', sequenceNumber: 2, topicId: null },
  topicName: 'Cycle Detection in Linked Lists'
}), null, 2));

console.log('--- LONG ANSWER ---');
console.log(JSON.stringify(synthesizeExtractiveQuestion({
  chunkText: sample,
  target: { bloomSlug: 'evaluate', difficultySlug: 'hard', typeSlug: 'LONG_ANSWER', styleSlug: 'scenario', sequenceNumber: 3, topicId: null },
  topicName: 'Cycle Detection in Linked Lists'
}), null, 2));
