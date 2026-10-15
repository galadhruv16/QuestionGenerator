import { describe, expect, it } from 'vitest';
import { pyqAnalysisPatternSchema } from '@groundq/contracts';
import {
  clearPyqPatternCache,
  getCachedPyqPattern,
  parsePyqHeuristically,
  setCachedPyqPattern,
} from '../src/services/pyq-analyzer.js';

describe('PYQ Pattern Analyzer Service', () => {
  const sampleExamPaper = `
UNIVERSITY EXAMINATION - COMPUTER SCIENCE & ENGINEERING
CS842: DISTRIBUTED SYSTEMS & CONCURRENCY
Time Allowed: 3 Hours                                  Maximum Marks: 100

PART A: OBJECTIVE & CONCEPTUAL RECALL (20 Marks)
Answer all questions. Each question carries 2 marks.

1. Define the term mutual exclusion in concurrent distributed systems. [2 marks]
2. State the four Coffman conditions necessary for deadlock to occur. [2 marks]
3. Which of the following best describes Lamport logical timestamps? [2 marks]
   (a) Physical wall-clock synchronization
   (b) Partial ordering of distributed events based on happened-before relation
   (c) Network NTP round-trip time estimator
   (d) Hardware cycle counter
4. Explain how Ricart-Agrawala algorithm reduces message complexity compared to Lamport. [2 marks]
5. List two differences between blocking and non-blocking RPC communication. [2 marks]

PART B: APPLIED PROBLEM SOLVING & ANALYSIS (40 Marks)
Answer any 4 questions. Each question carries 10 marks.

6. Calculate the effective memory access time in a paging system with a TLB hit ratio of 95%, TLB lookup time of 10ns, and main memory access time of 100ns. [10 marks]
7. Solve the following allocation state using Banker's Algorithm and determine whether the system is in a safe state. [10 marks]
8. Analyze the message overhead of the Bully election algorithm under worst-case network failure scenarios. Compare with the Ring election algorithm. [10 marks]
9. Derive the conditions under which Belady's anomaly occurs in FIFO page replacement compared to LRU. [10 marks]

PART C: ADVANCED EVALUATION & SYSTEM SYNTHESIS (40 Marks)
Answer both questions. Each question carries 20 marks.

10. Evaluate the Byzantine Fault Tolerant (PBFT) consensus protocol under asynchronous network partitions. Justify whether safety or liveness is preserved. [20 marks]
11. Design and construct a fault-tolerant distributed transaction coordinator using 2-Phase Commit (2PC) with persistent write-ahead logging (WAL). Formulate the recovery protocol when the coordinator crashes during the PREPARE phase. [20 marks]
`;

  it('accurately extracts blueprint distributions using heuristic parser', () => {
    const pattern = parsePyqHeuristically(
      sampleExamPaper,
      '00000000-0000-0000-0000-000000000001',
      'CS842_Midterm_Exam_2024.pdf',
    );

    // Schema fidelity
    const validation = pyqAnalysisPatternSchema.safeParse(pattern);
    expect(validation.success).toBe(true);

    // Question count and marks
    expect(pattern.total_detected_questions).toBeGreaterThanOrEqual(10);
    expect(pattern.detected_marks_total).toBe(100);

    // Percentage normalizations sum to 100
    const bloomSum = Object.values(pattern.bloom_distribution).reduce(
      (a, b) => a + b,
      0,
    );
    expect(bloomSum).toBe(100);

    const formatSum = Object.values(pattern.format_distribution).reduce(
      (a, b) => a + b,
      0,
    );
    expect(formatSum).toBe(100);

    const diffSum = Object.values(pattern.difficulty_distribution).reduce(
      (a, b) => a + b,
      0,
    );
    expect(diffSum).toBe(100);

    // Cognitive balance captures higher order questions
    expect(pattern.bloom_distribution.apply).toBeGreaterThan(0);
    expect(pattern.bloom_distribution.analyze).toBeGreaterThan(0);
    expect(pattern.bloom_distribution.evaluate).toBeGreaterThan(0);

    // Format captures MCQs, Short, and Long answer components
    expect(pattern.format_distribution.mcq).toBeGreaterThan(0);
    expect(pattern.format_distribution.short_answer).toBeGreaterThan(0);
    expect(pattern.format_distribution.long_answer).toBeGreaterThan(0);

    // Sections breakdown contains detected parts
    expect(pattern.sections.length).toBeGreaterThanOrEqual(3);
    expect(pattern.sections[0].title).toContain('PART A');
  });

  it('manages pattern in-memory caching correctly', () => {
    clearPyqPatternCache();
    const id = '00000000-0000-0000-0000-000000000042';
    expect(getCachedPyqPattern(id)).toBeUndefined();

    const pattern = parsePyqHeuristically(
      sampleExamPaper,
      id,
      'Cached_Exam.pdf',
    );
    setCachedPyqPattern(id, pattern);

    const retrieved = getCachedPyqPattern(id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.resource_name).toBe('Cached_Exam.pdf');
    expect(retrieved?.total_detected_questions).toBe(pattern.total_detected_questions);

    clearPyqPatternCache();
    expect(getCachedPyqPattern(id)).toBeUndefined();
  });
});
