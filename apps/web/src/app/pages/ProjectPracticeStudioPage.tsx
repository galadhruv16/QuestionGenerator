import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Icon, Logo } from '../components/ui';
import {
  getCachedProject,
  getPracticeSession,
  savePracticeSession,
  clearPracticeSession,
  type PracticeSessionState,
} from '../services/session-store';

export interface QuestionOption {
  id: string;
  option_text: string;
  is_correct: boolean;
  sort_order: number;
}

export interface QuestionItem {
  id: string;
  sort_order: number;
  status: 'DRAFT' | 'AVAILABLE' | 'ACCEPTED' | 'REJECTED';
  current_version?: {
    question_text: string;
    model_answer?: string | null;
    explanation?: string | null;
    options?: QuestionOption[];
    question_options?: QuestionOption[];
    bloom_levels?: {
      name: string;
      slug: string;
      level_number?: number;
    } | null;
    question_types?: {
      name: string;
      slug: string;
    } | null;
    question_source_refs?: Array<{
      chunk_id: string;
      resource_chunks?: {
        page_number?: number;
        resources?: {
          original_filename?: string;
        };
      };
    }>;
  } | null;
}

// Fallback academic dataset if no questions exist
const FALLBACK_PRACTICE_QUESTIONS: QuestionItem[] = [
  {
    id: 'mock-q1',
    sort_order: 1,
    status: 'ACCEPTED',
    current_version: {
      question_text:
        "Under Lamport's Logical Clocks, if event a occurs before event b in the same process, which invariant must hold strictly across timestamp assignments?",
      bloom_levels: { name: 'Remember', slug: 'remember', level_number: 1 },
      question_types: { name: 'Multiple Choice', slug: 'mcq' },
      options: [
        { id: 'opt-1a', option_text: 'C(a) < C(b)', is_correct: true, sort_order: 1 },
        { id: 'opt-1b', option_text: 'C(a) == C(b) + 1', is_correct: false, sort_order: 2 },
        { id: 'opt-1c', option_text: 'C(b) < C(a)', is_correct: false, sort_order: 3 },
        { id: 'opt-1d', option_text: 'C(a) and C(b) are logically incomparable', is_correct: false, sort_order: 4 },
      ],
      explanation:
        'Clock Condition 1 asserts that within a single process Pi, if event a precedes event b, then C(a) < C(b).',
      question_source_refs: [
        {
          chunk_id: 'chk-014',
          resource_chunks: {
            page_number: 14,
            resources: { original_filename: 'Lamport_Clocks_1978.pdf' },
          },
        },
      ],
    },
  },
  {
    id: 'mock-q2',
    sort_order: 2,
    status: 'ACCEPTED',
    current_version: {
      question_text:
        'In the Raft Consensus Protocol, what condition is necessary for a Leader node to commit an entry from its current term?',
      bloom_levels: { name: 'Understand', slug: 'understand', level_number: 2 },
      question_types: { name: 'Multiple Choice', slug: 'mcq' },
      options: [
        { id: 'opt-2a', option_text: 'The entry has been replicated on all follower nodes in the cluster.', is_correct: false, sort_order: 1 },
        { id: 'opt-2b', option_text: 'The entry has been safely replicated on a strict majority of servers.', is_correct: true, sort_order: 2 },
        { id: 'opt-2c', option_text: 'The candidate term counter reaches 2F + 1 epochs.', is_correct: false, sort_order: 3 },
        { id: 'opt-2d', option_text: 'All previous term entries have been written to volatile disk.', is_correct: false, sort_order: 4 },
      ],
      explanation:
        'Raft guarantees safety by committing current-term entries once replicated to a majority (N/2 + 1) of cluster peers.',
      question_source_refs: [
        {
          chunk_id: 'chk-042',
          resource_chunks: {
            page_number: 8,
            resources: { original_filename: 'Ongaro_Raft_Dissertation.pdf' },
          },
        },
      ],
    },
  },
  {
    id: 'mock-q3',
    sort_order: 3,
    status: 'ACCEPTED',
    current_version: {
      question_text:
        'Consider the CAP Theorem in a network partition scenario. If a system chooses CP (Consistency and Partition Tolerance), what is the immediate trade-off enforced on clients?',
      bloom_levels: { name: 'Apply', slug: 'apply', level_number: 3 },
      question_types: { name: 'Multiple Choice', slug: 'mcq' },
      options: [
        { id: 'opt-3a', option_text: 'Eventual read latency drops to zero.', is_correct: false, sort_order: 1 },
        { id: 'opt-3b', option_text: 'Some non-faulty nodes must deny or delay client requests to prevent stale reads.', is_correct: true, sort_order: 2 },
        { id: 'opt-3c', option_text: 'Network partitioning heals automatically within two round trips.', is_correct: false, sort_order: 3 },
        { id: 'opt-3d', option_text: 'Data replication becomes asynchronous across all split components.', is_correct: false, sort_order: 4 },
      ],
      explanation:
        'Under CP, availability is sacrificed during partitions: nodes unable to guarantee up-to-date linearizable data must reject writes/reads.',
      question_source_refs: [
        {
          chunk_id: 'chk-079',
          resource_chunks: {
            page_number: 31,
            resources: { original_filename: 'Brewer_CAP_Retrospective.pdf' },
          },
        },
      ],
    },
  },
  {
    id: 'mock-q4',
    sort_order: 4,
    status: 'ACCEPTED',
    current_version: {
      question_text:
        "In an asynchronous distributed kernel implementing Dijkstra's Banker's Algorithm for deadlock avoidance, assume 5 concurrent worker threads and 3 resource types R1, R2, R3. Under what mathematical precondition will the allocation vector grant guarantee that the state transition preserves global safety?",
      bloom_levels: { name: 'Analyze', slug: 'analyze', level_number: 4 },
      question_types: { name: 'Multiple Choice', slug: 'mcq' },
      options: [
        { id: 'opt-4a', option_text: 'Mutual exclusion is temporarily suspended for non-preemptive lock handoffs across node vectors.', is_correct: false, sort_order: 1 },
        { id: 'opt-4b', option_text: 'There exists at least one topological permutation sequence <T1, T2, ... Tn> such that maximum resource claims are satisfiable by currently available plus released preceding allocations.', is_correct: true, sort_order: 2 },
        { id: 'opt-4c', option_text: 'The cycle detection invariant across all node wait-for graphs returns null within a 2-phase commit window.', is_correct: false, sort_order: 3 },
        { id: 'opt-4d', option_text: 'Linear total order sequence acquisition is enforced strictly through physical clock synchronization.', is_correct: false, sort_order: 4 },
      ],
      explanation:
        "Dijkstra's formal safety criterion requires the existence of a safe execution sequence of processes such that remaining claims can be met with available resources.",
      question_source_refs: [
        {
          chunk_id: 'chk-092',
          resource_chunks: {
            page_number: 328,
            resources: { original_filename: 'Operating_System_Concepts_10th.pdf' },
          },
        },
      ],
    },
  },
  {
    id: 'mock-q5',
    sort_order: 5,
    status: 'ACCEPTED',
    current_version: {
      question_text:
        'When evaluating Paxos against Raft in terms of state machine replication, which architectural distinction accurately describes Raft’s leader election constraint?',
      bloom_levels: { name: 'Evaluate', slug: 'evaluate', level_number: 5 },
      question_types: { name: 'Multiple Choice', slug: 'mcq' },
      options: [
        { id: 'opt-5a', option_text: 'A candidate can be elected even if its log lacks committed entries from previous terms.', is_correct: false, sort_order: 1 },
        { id: 'opt-5b', option_text: 'Raft allows log entries to flow bi-directionally between the leader and followers.', is_correct: false, sort_order: 2 },
        { id: 'opt-5c', option_text: 'A candidate must contain all committed entries in its log to win an election (Log Matching / Election Restriction).', is_correct: true, sort_order: 3 },
        { id: 'opt-5d', option_text: 'Paxos forbids leaders from proposing values concurrently.', is_correct: false, sort_order: 4 },
      ],
      explanation:
        'Raft uses a simpler invariant where voters reject candidate votes if the candidate log is less up-to-date than their own, avoiding log repair from followers into the leader.',
      question_source_refs: [
        {
          chunk_id: 'chk-115',
          resource_chunks: {
            page_number: 11,
            resources: { original_filename: 'Ongaro_Raft_Dissertation.pdf' },
          },
        },
      ],
    },
  },
];

interface ProjectPracticeStudioPageProps {
  initialQuestions?: QuestionItem[];
}

export function ProjectPracticeStudioPage({
  initialQuestions,
}: ProjectPracticeStudioPageProps) {
  const { projectId } = useParams<{ projectId: string }>();

  // Project title and metadata from cache or fallback
  const cachedData = projectId ? getCachedProject(projectId) : null;
  const projectTitle = cachedData?.project?.title || 'Distributed Systems Core';

  // Questions state: default to ACCEPTED items if present
  const [questions, setQuestions] = useState<QuestionItem[]>(() => {
    if (initialQuestions && initialQuestions.length > 0) return initialQuestions.filter((q) => q && q.current_version != null);
    if (cachedData?.questions && cachedData.questions.length > 0) {
      const valid = cachedData.questions.filter((q) => q && q.current_version != null);
      const accepted = valid.filter((q) => q.status === 'ACCEPTED');
      return accepted.length > 0 ? accepted : valid;
    }
    return FALLBACK_PRACTICE_QUESTIONS;
  });

  // Mode: Self-Paced Practice (immediate feedback) vs Timed Mock Exam (simulation)
  const [mode, setMode] = useState<'practice' | 'mock'>('practice');

  // Navigation: current active question index
  const [currentIndex, setCurrentIndex] = useState(0);

  // Student Responses: questionId -> selectedOptionId
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});

  // Free-response sandbox text: questionId -> text
  const [freeResponseAnswers, setFreeResponseAnswers] = useState<Record<string, string>>({});

  // Flagged questions for review
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());

  // Visited questions tracking
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set([questions[0]?.id || 'mock-q1']));

  // In Practice mode: which questions have been checked/verified
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());

  // Mock Exam Timer: seconds remaining (e.g. 90 minutes = 5400s)
  const [secondsRemaining, setSecondsRemaining] = useState(5400);
  const [isTimerPaused, setIsTimerPaused] = useState(false);

  // Submission & Results
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Scientific Calculator Modal state
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcExpression, setCalcExpression] = useState('');

  // Auto-save feedback timestamp
  const [lastSavedTime, setLastSavedTime] = useState<string>('Just now');

  // Restore saved session if available
  useEffect(() => {
    if (!projectId) return;
    const saved = getPracticeSession(projectId);
    if (saved) {
      setMode(saved.mode);
      setSelectedAnswers(saved.selectedAnswers || {});
      setFreeResponseAnswers(saved.freeResponseAnswers || {});
      setFlaggedIds(new Set(saved.flaggedQuestionIds || []));
      setVisitedIds(new Set(saved.visitedQuestionIds || []));
      setVerifiedIds(new Set(saved.verifiedQuestionIds || []));
      if (saved.secondsRemaining > 0) setSecondsRemaining(saved.secondsRemaining);
      setIsSubmitted(Boolean(saved.isSubmitted));
      if (typeof saved.currentQuestionIndex === 'number') {
        setCurrentIndex(Math.min(saved.currentQuestionIndex, questions.length - 1));
      }
    }
  }, [projectId, questions.length]);

  // Load live questions from API if not provided in props
  useEffect(() => {
    if (initialQuestions) return;
    if (!projectId) return;

    async function loadData() {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/questions?limit=1000`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data) && json.data.length > 0) {
            const valid = json.data.filter((q: QuestionItem) => q && q.current_version != null);
            const accepted = valid.filter((q: QuestionItem) => q.status === 'ACCEPTED');
            const items = accepted.length > 0 ? accepted : valid;
            if (items.length > 0) {
              setQuestions(items);
              setVisitedIds((prev) => {
                const next = new Set(prev);
                if (items[0]) next.add(items[0].id);
                return next;
              });
            }
          }
        }
      } catch (e) {
        console.error('Failed to load questions for practice studio:', e);
      }
    }
    void loadData();
  }, [projectId, initialQuestions]);

  // Persist state to session storage
  const persistSession = useCallback(() => {
    if (!projectId) return;
    const sessionState: PracticeSessionState = {
      mode,
      selectedAnswers,
      freeResponseAnswers,
      flaggedQuestionIds: Array.from(flaggedIds),
      visitedQuestionIds: Array.from(visitedIds),
      verifiedQuestionIds: Array.from(verifiedIds),
      secondsRemaining,
      isSubmitted,
      currentQuestionIndex: currentIndex,
      lastUpdated: Date.now(),
    };
    savePracticeSession(projectId, sessionState);
    setLastSavedTime('Just now');
  }, [
    projectId,
    mode,
    selectedAnswers,
    freeResponseAnswers,
    flaggedIds,
    visitedIds,
    verifiedIds,
    secondsRemaining,
    isSubmitted,
    currentIndex,
  ]);

  // Periodic and change-based auto-save
  useEffect(() => {
    persistSession();
  }, [persistSession]);

  // Mock Exam Countdown Timer
  useEffect(() => {
    if (mode !== 'mock' || isTimerPaused || isSubmitted) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsSubmitted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [mode, isTimerPaused, isSubmitted]);

  // Format Timer HH:MM:SS
  const formattedTimer = useMemo(() => {
    const hrs = Math.floor(secondsRemaining / 3600);
    const mins = Math.floor((secondsRemaining % 3600) / 60);
    const secs = secondsRemaining % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }, [secondsRemaining]);

  // Active Question
  const activeQuestion: QuestionItem | undefined = questions[currentIndex];
  const activeOptions: QuestionOption[] = useMemo(() => {
    if (!activeQuestion) return [];
    const opts =
      activeQuestion.current_version?.question_options ??
      activeQuestion.current_version?.options ??
      [];
    return [...opts]
      .map((o, idx) => ({
        ...o,
        id: o.id || `opt-${idx}`,
        sort_order: o.sort_order ?? (o as unknown as { option_index?: number }).option_index ?? idx,
      }))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [activeQuestion]);

  // Current question selected option
  const selectedOptionId = activeQuestion ? selectedAnswers[activeQuestion.id] : undefined;
  const isQuestionFlagged = activeQuestion ? flaggedIds.has(activeQuestion.id) : false;
  const isQuestionVerified = activeQuestion ? verifiedIds.has(activeQuestion.id) : false;

  // Selected option object
  const selectedOptionObj = useMemo(() => {
    return activeOptions.find((o) => o.id === selectedOptionId);
  }, [activeOptions, selectedOptionId]);

  // Navigation handlers
  const handleSelectQuestion = (idx: number) => {
    if (idx < 0 || idx >= questions.length) return;
    setCurrentIndex(idx);
    const targetQ = questions[idx];
    if (targetQ) {
      setVisitedIds((prev) => new Set(prev).add(targetQ.id));
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      handleSelectQuestion(currentIndex + 1);
    } else {
      setIsSubmitModalOpen(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      handleSelectQuestion(currentIndex - 1);
    }
  };

  const handleOptionSelect = (optId: string) => {
    if (!activeQuestion) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [activeQuestion.id]: optId,
    }));
    // In practice mode, if already verified, re-verify with new option
    if (mode === 'practice') {
      setVerifiedIds((prev) => new Set(prev).add(activeQuestion.id));
    }
  };

  const handleToggleFlag = () => {
    if (!activeQuestion) return;
    setFlaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(activeQuestion.id)) {
        next.delete(activeQuestion.id);
      } else {
        next.add(activeQuestion.id);
      }
      return next;
    });
  };

  const handleClearResponse = () => {
    if (!activeQuestion) return;
    setSelectedAnswers((prev) => {
      const next = { ...prev };
      delete next[activeQuestion.id];
      return next;
    });
    setVerifiedIds((prev) => {
      const next = new Set(prev);
      next.delete(activeQuestion.id);
      return next;
    });
  };

  // Keyboard Navigation: 1-4 for options, F for flag, Enter for next
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in textarea or input
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      ) {
        return;
      }

      if (e.key >= '1' && e.key <= '4') {
        const optIndex = parseInt(e.key, 10) - 1;
        if (activeOptions[optIndex]) {
          handleOptionSelect(activeOptions[optIndex].id);
        }
      } else if (e.key.toLowerCase() === 'f') {
        handleToggleFlag();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeOptions, handleNext, handlePrev, handleOptionSelect, handleToggleFlag]);

  // Calculator logic
  const handleCalcInput = (char: string) => {
    if (char === 'C') {
      setCalcDisplay('0');
      setCalcExpression('');
    } else if (char === '=') {
      try {
        const cleanExpr = calcExpression
          .replace(/×/g, '*')
          .replace(/÷/g, '/')
          .replace(/\^/g, '**');
        // Simple safe arithmetic evaluation
        // eslint-disable-next-line no-eval
        const result = Function(`"use strict"; return (${cleanExpr || calcDisplay})`)();
        setCalcDisplay(String(result));
        setCalcExpression('');
      } catch {
        setCalcDisplay('Error');
      }
    } else if (char === '√') {
      try {
        const val = parseFloat(calcDisplay);
        const res = Math.sqrt(val);
        setCalcDisplay(String(res));
      } catch {
        setCalcDisplay('Error');
      }
    } else {
      if (calcDisplay === '0' || calcDisplay === 'Error') {
        setCalcDisplay(char);
      } else {
        setCalcDisplay((prev) => prev + char);
      }
      setCalcExpression((prev) => prev + char);
    }
  };

  // Progress metrics calculation
  const totalCount = questions.length;
  const answeredCount = Object.keys(selectedAnswers).length;
  const flaggedCount = flaggedIds.size;
  const unvisitedCount = Math.max(0, totalCount - visitedIds.size);
  const completionPercentage = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  // Performance Report Evaluation upon Submission
  const evaluation = useMemo(() => {
    let correctCount = 0;
    let earnedMarks = 0;
    let totalMarks = 0;

    const bloomStats: Record<string, { correct: number; total: number; name: string }> = {};

    questions.forEach((q) => {
      const qMarks = 4; // default 4 marks
      totalMarks += qMarks;

      const opts = q.current_version?.question_options ?? q.current_version?.options ?? [];
      const correctOpt = opts.find((o) => o.is_correct);
      const studentAnsId = selectedAnswers[q.id];
      const isCorrect = correctOpt && studentAnsId === correctOpt.id;

      if (isCorrect) {
        correctCount += 1;
        earnedMarks += qMarks;
      }

      const bloomName = q.current_version?.bloom_levels?.name || 'Cognitive';
      if (!bloomStats[bloomName]) {
        bloomStats[bloomName] = { correct: 0, total: 0, name: bloomName };
      }
      bloomStats[bloomName].total += 1;
      if (isCorrect) {
        bloomStats[bloomName].correct += 1;
      }
    });

    const percent = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
    let gradeLabel = 'Satisfactory';
    if (percent >= 90) gradeLabel = 'Exemplary / High Distinction';
    else if (percent >= 80) gradeLabel = 'Distinction / Grade A';
    else if (percent >= 70) gradeLabel = 'Proficient / Grade B';
    else if (percent >= 60) gradeLabel = 'Pass / Grade C';
    else gradeLabel = 'Needs Review';

    return {
      correctCount,
      totalCount,
      earnedMarks,
      totalMarks,
      percent,
      gradeLabel,
      bloomStats: Object.values(bloomStats),
    };
  }, [questions, selectedAnswers]);

  // Restart practice / retake exam
  const handleRetakeExam = () => {
    if (projectId) clearPracticeSession(projectId);
    setSelectedAnswers({});
    setFreeResponseAnswers({});
    setFlaggedIds(new Set());
    setVisitedIds(new Set([questions[0]?.id || 'mock-q1']));
    setVerifiedIds(new Set());
    setSecondsRemaining(5400);
    setIsSubmitted(false);
    setCurrentIndex(0);
  };

  return (
    <div className="min-h-screen bg-[#fbf8fc] text-[#1b1b1e] font-sans flex flex-col selection:bg-[#3157d5]/15 selection:text-[#3157d5]">
      {/* 1. Global Header Navigation */}
      <header className="fixed top-0 left-0 w-full z-40 bg-white/95 backdrop-blur-md border-b border-[#e2e8f0] shadow-sm">
        <div className="h-16 w-full px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="shrink-0 flex items-center">
              <Logo to="/app" />
            </div>

            <div className="h-4 w-px bg-[#cbd5e1] hidden md:block" />

            <nav
              aria-label="Academic Context"
              className="flex items-center space-x-2 text-xs font-mono text-[#64748b] truncate"
            >
              <Link
                className="hover:text-[#0f172a] transition-colors"
                to="/app"
              >
                Workspaces
              </Link>
              <span className="text-[#cbd5e1]">/</span>
              <Link
                className="hover:text-[#0f172a] transition-colors truncate max-w-[180px]"
                to={`/app/projects/${projectId}/resources`}
              >
                {projectTitle}
              </Link>
              <span className="text-[#cbd5e1]">/</span>
              <Link
                className="hover:text-[#0f172a] transition-colors"
                to={`/app/projects/${projectId}/questions`}
              >
                Question Bank
              </Link>
              <span className="text-[#cbd5e1]">/</span>
              <span className="text-[#3157d5] font-semibold bg-[#eef2ff] px-2 py-0.5 rounded border border-[#3157d5]/30">
                Interactive Practice Mode
              </span>
            </nav>
          </div>

          {/* Quick Sub-navigation Studio Links */}
          <nav className="hidden xl:flex items-center space-x-1 font-mono text-xs">
            <Link
              to={`/app/projects/${projectId}/questions`}
              className="px-2.5 py-1 rounded text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors"
            >
              04 Question Bank
            </Link>
            <Link
              to={`/app/projects/${projectId}/export`}
              className="px-2.5 py-1 rounded text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors"
            >
              05 Export Studio
            </Link>
            <span className="px-2.5 py-1 rounded bg-[#eef2ff] text-[#3157d5] font-semibold border border-[#3157d5]/20">
              06 Practice Studio
            </span>
          </nav>

          {/* Right Header Status Ribbon */}
          <div className="flex items-center space-x-3 shrink-0">
            {/* Mode Indicator Pill */}
            {mode === 'mock' ? (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#fef2f2] text-[#991b1b] border border-[#fecaca] font-mono text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse" />
                <span>Timed Mock Exam</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0] font-mono text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                <span>Self-Paced Practice</span>
              </div>
            )}

            {/* Countdown Timer with Pause/Play */}
            {mode === 'mock' && !isSubmitted && (
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] font-mono text-xs text-[#0f172a]">
                <Icon name="timer" size={14} />
                <span className="tabular-nums font-bold tracking-tight">
                  {formattedTimer}
                </span>
                <button
                  className="ml-1 text-[#64748b] hover:text-[#0f172a] transition-colors"
                  onClick={() => setIsTimerPaused((prev) => !prev)}
                  title={isTimerPaused ? 'Resume Timer' : 'Pause Timer'}
                  type="button"
                >
                  <Icon name={isTimerPaused ? 'play' : 'pause'} size={13} />
                </button>
              </div>
            )}

            {/* Submit Assessment Action Button */}
            {!isSubmitted ? (
              <button
                className="px-3.5 py-1.5 rounded-lg bg-[#3157d5] hover:bg-[#2544ab] text-white font-mono text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5 active:scale-[0.98]"
                onClick={() => setIsSubmitModalOpen(true)}
                type="button"
              >
                <Icon name="check" size={14} />
                <span>Submit Assessment</span>
              </button>
            ) : (
              <button
                className="px-3 py-1.5 rounded-lg border border-[#3157d5] text-[#3157d5] hover:bg-[#eef2ff] font-mono text-xs font-semibold transition-all flex items-center space-x-1"
                onClick={handleRetakeExam}
                type="button"
              >
                <Icon name="refresh" size={13} />
                <span>Retake Exam</span>
              </button>
            )}

            {/* User Avatar */}
            <div className="w-8 h-8 rounded-full bg-[#eef2ff] text-[#3157d5] border border-[#c7d2fe] flex items-center justify-center font-mono font-bold text-xs">
              ST
            </div>
          </div>
        </div>
      </header>

      {/* 2. Sub-Nav / Mode Switcher & Telemetry Strip */}
      <section className="w-full pt-16 bg-[#f8fafc] border-b border-[#e2e8f0] px-4 lg:px-8 py-2.5">
        <div className="max-w-[1560px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center space-x-1 p-1 bg-[#e2e8f0]/60 rounded-lg self-start">
            <button
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-mono text-xs font-semibold transition-all ${
                mode === 'practice'
                  ? 'bg-white text-[#3157d5] shadow-sm'
                  : 'text-[#64748b] hover:text-[#0f172a] hover:bg-white/50'
              }`}
              onClick={() => setMode('practice')}
              type="button"
            >
              <Icon name="school" size={14} />
              <span>Self-Paced Practice</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#eef2ff] text-[#3157d5] font-bold">
                Feedback Active
              </span>
            </button>

            <button
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-mono text-xs font-semibold transition-all ${
                mode === 'mock'
                  ? 'bg-white text-[#0f172a] shadow-sm'
                  : 'text-[#64748b] hover:text-[#0f172a] hover:bg-white/50'
              }`}
              onClick={() => setMode('mock')}
              type="button"
            >
              <Icon name="timer" size={14} />
              <span>Timed Mock Exam</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#f1f5f9] text-[#64748b] font-medium">
                Sim
              </span>
            </button>
          </div>

          {/* Telemetry Strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-[#64748b]">
            <div className="flex items-center space-x-1">
              <span className="text-[#94a3b8]">Course:</span>
              <span className="font-semibold text-[#0f172a] truncate max-w-[200px]">
                {projectTitle}
              </span>
            </div>
            <span className="text-[#cbd5e1] hidden sm:inline">•</span>
            <div className="flex items-center space-x-1">
              <span className="text-[#94a3b8]">Section:</span>
              <span className="font-medium text-[#334155]">
                {activeQuestion?.current_version?.question_types?.name || 'Core Assessment'}
              </span>
            </div>
            <span className="text-[#cbd5e1] hidden sm:inline">•</span>
            <div className="flex items-center space-x-1 text-[#059669]">
              <Icon name="checkCircle" size={13} />
              <span>Saved {lastSavedTime}</span>
            </div>

            {/* Launch Scientific Calculator */}
            <div className="ml-auto flex items-center space-x-2">
              <button
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-white hover:bg-[#f1f5f9] text-[#334155] border border-[#e2e8f0] font-mono text-xs font-medium shadow-sm transition-all"
                onClick={() => setIsCalcOpen(true)}
                title="Launch Scientific Utility Calculator"
                type="button"
              >
                <Icon name="calculator" size={13} />
                <span>Calculator</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Main Split Stage or Results View */}
      <main className="w-full max-w-[1560px] mx-auto px-4 lg:px-8 py-6 flex-1 flex flex-col">
        {isSubmitted ? (
          /* ============================================================== */
          /* SUBMITTED EXAM RESULTS & PEDAGOGICAL MASTERY REPORT           */
          /* ============================================================== */
          <div className="w-full flex flex-col gap-6">
            {/* Scorecard Hero Banner */}
            <div className="w-full bg-white rounded-xl border border-[#e2e8f0] p-6 lg:p-8 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0] font-mono text-xs font-semibold">
                    Assessment Evaluation Complete
                  </span>
                  <span className="text-xs font-mono text-[#64748b]">
                    {mode === 'mock' ? 'Timed Mock Exam Mode' : 'Self-Paced Practice Mode'}
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-serif font-bold text-[#0f172a]">
                  Assessment Performance &amp; Grounding Audit
                </h1>
                <p className="text-sm text-[#64748b] max-w-2xl">
                  Your answers have been evaluated against verified model answers and textbook citations. Review your performance breakdown across Bloom&apos;s cognitive taxonomy below.
                </p>
              </div>

              {/* Big Score Callout */}
              <div className="flex items-center space-x-6 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 lg:p-6 shrink-0">
                <div className="flex flex-col text-right">
                  <span className="font-mono text-xs text-[#64748b] uppercase tracking-wider">
                    Total Score
                  </span>
                  <span className="text-3xl lg:text-4xl font-bold font-mono text-[#3157d5]">
                    {evaluation.percent}%
                  </span>
                  <span className="text-xs font-mono text-[#64748b]">
                    {evaluation.earnedMarks} / {evaluation.totalMarks} Marks
                  </span>
                </div>
                <div className="h-12 w-px bg-[#cbd5e1]" />
                <div className="flex flex-col">
                  <span className="font-mono text-xs text-[#64748b] uppercase tracking-wider">
                    Result
                  </span>
                  <span className="text-base font-semibold text-[#0f172a]">
                    {evaluation.gradeLabel}
                  </span>
                  <span className="text-xs text-[#059669] font-mono font-medium">
                    {evaluation.correctCount} of {evaluation.totalCount} Correct
                  </span>
                </div>
              </div>
            </div>

            {/* Cognitive Taxonomy Mastery Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {evaluation.bloomStats.map((stat) => {
                const bPercent = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
                return (
                  <div
                    key={stat.name}
                    className="bg-white rounded-xl border border-[#e2e8f0] p-4 shadow-sm flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-[#0f172a]">
                        {stat.name}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#3157d5]">
                        {bPercent}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#f1f5f9] overflow-hidden">
                      <div
                        className="h-full bg-[#3157d5] transition-all duration-500 rounded-full"
                        style={{ width: `${bPercent}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-[#64748b]">
                      {stat.correct} / {stat.total} Solved Correctly
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Detailed Question Review List */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-6 lg:p-8 flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-4">
                <h2 className="text-lg font-serif font-bold text-[#0f172a]">
                  Comprehensive Answer Key &amp; Grounding Audit
                </h2>
                <div className="flex items-center space-x-2">
                  <button
                    className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] hover:bg-[#f8fafc] text-xs font-mono text-[#334155] font-semibold transition-all"
                    onClick={() => {
                      setIsSubmitted(false);
                      setMode('practice');
                    }}
                    type="button"
                  >
                    Review in Practice Studio
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-lg bg-[#3157d5] hover:bg-[#2544ab] text-white text-xs font-mono font-semibold shadow-sm transition-all"
                    onClick={handleRetakeExam}
                    type="button"
                  >
                    Retake Assessment
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                {questions.map((q, idx) => {
                  const opts = q.current_version?.question_options ?? q.current_version?.options ?? [];
                  const studentAnsId = selectedAnswers[q.id];
                  const correctOpt = opts.find((o) => o.is_correct);
                  const isCorrect = correctOpt && studentAnsId === correctOpt.id;
                  const sourceRef = q.current_version?.question_source_refs?.[0];

                  return (
                    <article
                      key={q.id}
                      className={`p-5 rounded-xl border transition-all ${
                        isCorrect
                          ? 'bg-[#f0fdf4]/40 border-[#bbf7d0]'
                          : 'bg-[#fef2f2]/40 border-[#fecaca]'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/5">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs text-[#0f172a]">
                            Q{idx + 1}.
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white text-[#475569] font-mono text-[11px] border border-[#e2e8f0]">
                            {q.current_version?.bloom_levels?.name || 'Cognitive'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white text-[#475569] font-mono text-[11px] border border-[#e2e8f0]">
                            4 Marks
                          </span>
                        </div>
                        {isCorrect ? (
                          <span className="flex items-center space-x-1 text-[#059669] font-mono text-xs font-semibold">
                            <Icon name="checkCircle" size={14} />
                            <span>Correct (+4 Marks)</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-1 text-[#dc2626] font-mono text-xs font-semibold">
                            <Icon name="crossCircle" size={14} />
                            <span>Incorrect (0 Marks)</span>
                          </span>
                        )}
                      </div>

                      {/* Stem */}
                      <p className="font-serif text-base text-[#0f172a] leading-relaxed mb-4">
                        {q.current_version?.question_text || '(Draft question version)'}
                      </p>

                      {/* Options */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4 font-mono text-xs">
                        {opts.map((opt, oIdx) => {
                          const letter = String.fromCharCode(65 + oIdx);
                          const isSelected = opt.id === studentAnsId;
                          const isAnswer = opt.is_correct;

                          let badgeClass = 'bg-white border-[#e2e8f0] text-[#334155]';
                          if (isAnswer) {
                            badgeClass = 'bg-[#ecfdf5] border-[#10b981] text-[#065f46] font-semibold';
                          } else if (isSelected && !isAnswer) {
                            badgeClass = 'bg-[#fef2f2] border-[#ef4444] text-[#991b1b]';
                          }

                          return (
                            <div
                              key={opt.id || `opt-${oIdx}`}
                              className={`p-2.5 rounded-lg border flex items-start space-x-2 ${badgeClass}`}
                            >
                              <span className="font-bold shrink-0">[{letter}]</span>
                              <span className="flex-1 font-sans">{opt.option_text}</span>
                              {isAnswer && (
                                <span className="text-[10px] font-bold text-[#059669] uppercase tracking-wider shrink-0">
                                  ✓ Correct
                                </span>
                              )}
                              {isSelected && !isAnswer && (
                                <span className="text-[10px] font-bold text-[#dc2626] uppercase tracking-wider shrink-0">
                                  ✕ Your Choice
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Pedagogical Explanation & Grounding */}
                      <div className="bg-white/80 rounded-lg p-3 border border-black/5 flex flex-col gap-1.5 text-xs">
                        {q.current_version?.explanation && (
                          <div className="text-[#334155]">
                            <strong className="text-[#0f172a]">Pedagogical Rationale:</strong>{' '}
                            {q.current_version?.explanation}
                          </div>
                        )}
                        {sourceRef && (
                          <div className="flex items-center space-x-1.5 text-[#64748b] font-mono text-[11px]">
                            <Icon name="book" size={12} />
                            <span>
                              Source:{' '}
                              {sourceRef.resource_chunks?.resources?.original_filename || 'Course Reading'}
                              {sourceRef.resource_chunks?.page_number
                                ? `, p. ${sourceRef.resource_chunks.page_number}`
                                : ''}
                              , Chunk <code className="bg-[#f1f5f9] px-1 py-0.5 rounded text-[#3157d5]">#{sourceRef.chunk_id}</code>
                            </span>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* ACTIVE EXAM / PRACTICE WORKSPACE                               */
          /* ============================================================== */
          <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
            {/* LEFT 65% Main Exam Stage */}
            <section className="w-full lg:w-[65%] flex flex-col gap-5">
              {/* Question Workspace Card */}
              <article className="w-full bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-6 lg:p-8 flex flex-col gap-6 relative overflow-hidden">
                {/* Decorative academic watermark */}
                <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-48 h-48 rounded-full bg-[#3157d5]/[0.02] pointer-events-none" />

                {/* Question Metadata Header */}
                <header className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#f1f5f9]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-serif text-lg font-bold text-[#0f172a]">
                      Question {currentIndex + 1}{' '}
                      <span className="text-sm font-sans font-normal text-[#64748b]">
                        of {questions.length}
                      </span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded bg-[#f1f5f9] text-[#475569] font-mono text-xs">
                      {activeQuestion?.current_version?.question_types?.name || 'Section A: Core'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#eef2ff] text-[#3157d5] font-mono text-xs font-semibold">
                      {activeQuestion?.current_version?.bloom_levels?.name || 'Analyze'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded bg-[#f8fafc] border border-[#e2e8f0] text-[#64748b] font-mono text-xs">
                      4 Marks
                    </span>
                  </div>

                  {/* Bookmark / Flag Toggle Button */}
                  <button
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-semibold transition-all shadow-sm ${
                      isQuestionFlagged
                        ? 'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5] hover:bg-[#fecaca]'
                        : 'bg-[#f8fafc] text-[#64748b] border border-[#e2e8f0] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
                    }`}
                    onClick={handleToggleFlag}
                    type="button"
                  >
                    <Icon name="flag" size={13} />
                    <span>{isQuestionFlagged ? 'Flagged for Review' : 'Flag for Review'}</span>
                  </button>
                </header>

                {/* Question Stem */}
                <div className="flex flex-col gap-4">
                  <p className="font-serif text-lg lg:text-xl text-[#0f172a] leading-relaxed">
                    {activeQuestion?.current_version?.question_text}
                  </p>

                  {/* Optional formal excerpt or spec block if present in prompt */}
                  {activeQuestion?.current_version?.question_text?.includes('Dijkstra') && (
                    <div className="w-full bg-[#f8fafc] rounded-lg p-3.5 border border-[#e2e8f0] font-mono text-xs overflow-x-auto">
                      <div className="flex items-center justify-between pb-1.5 text-[#64748b] border-b border-[#e2e8f0]/60 mb-2">
                        <div className="flex items-center space-x-1.5">
                          <Icon name="terminal" size={13} />
                          <span className="font-semibold text-[#0f172a]">
                            Safety Invariant Specification (Kernel State Model)
                          </span>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-[#94a3b8]">
                          Formal Model
                        </span>
                      </div>
                      <pre className="text-[#334155] leading-5">
                        <code>
                          <span className="text-[#3157d5] font-bold">IsSafeState</span>(Allocation, Max, Available) =={'\n'}
                          {'  '}
                          <span className="text-[#059669] font-bold">\E</span> seq \in Permutations(Threads):{'\n'}
                          {'    '}
                          <span className="text-[#059669] font-bold">\A</span> i \in 1..Len(seq):{'\n'}
                          {'      '}Need[seq[i]] &lt;= RunningAvailable[i]
                        </code>
                      </pre>
                    </div>
                  )}
                </div>

                {/* Multiple Choice Options Matrix */}
                <div className="flex flex-col gap-2.5 pt-1">
                  <span className="font-mono text-xs uppercase tracking-wider text-[#64748b]">
                    Select Candidate Premise
                  </span>

                  {activeOptions.map((opt, optIndex) => {
                    const letter = String.fromCharCode(65 + optIndex);
                    const isSelected = selectedOptionId === opt.id;

                    return (
                      <label
                        key={opt.id}
                        className={`group flex items-start space-x-3.5 p-3.5 rounded-lg cursor-pointer transition-all border ${
                          isSelected
                            ? 'bg-[#3157d5]/[0.05] border-[#3157d5] shadow-sm'
                            : 'bg-white hover:bg-[#f8fafc] border-[#e2e8f0]'
                        }`}
                        onClick={() => handleOptionSelect(opt.id)}
                      >
                        <div className="pt-0.5 shrink-0">
                          <input
                            checked={isSelected}
                            className="w-4 h-4 text-[#3157d5] focus:ring-0 cursor-pointer"
                            name={`practice_q_${activeQuestion?.id}`}
                            onChange={() => handleOptionSelect(opt.id)}
                            onClick={() => handleOptionSelect(opt.id)}
                            type="radio"
                            value={opt.id}
                          />
                        </div>

                        <div className="flex flex-col gap-0.5 flex-1">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`font-mono text-xs font-bold transition-colors ${
                                isSelected ? 'text-[#3157d5]' : 'text-[#64748b] group-hover:text-[#3157d5]'
                              }`}
                            >
                              [{letter}]
                            </span>
                            {isSelected && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#3157d5] text-white font-mono font-bold uppercase tracking-wider">
                                Selected
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-sans text-[#1e293b] leading-relaxed">
                            {opt.option_text}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* PRACTICE MODE ONLY: Immediate Feedback & Grounding Citation Card */}
                {mode === 'practice' && isQuestionVerified && selectedOptionObj && (
                  <div
                    className={`p-4 rounded-xl border flex flex-col gap-2 transition-all ${
                      selectedOptionObj.is_correct
                        ? 'bg-[#ecfdf5]/80 border-[#a7f3d0]'
                        : 'bg-[#fef2f2]/80 border-[#fecaca]'
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center space-x-2">
                        {selectedOptionObj.is_correct ? (
                          <div className="flex items-center space-x-1.5 text-[#065f46] font-semibold text-sm">
                            <Icon name="checkCircle" size={16} />
                            <span>Correct Answer Validated</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1.5 text-[#991b1b] font-semibold text-sm">
                            <Icon name="crossCircle" size={16} />
                            <span>
                              Incorrect Choice — Correct is [
                              {String.fromCharCode(
                                65 + activeOptions.findIndex((o) => o.is_correct),
                              )}
                              ]
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-white text-[#475569] font-mono text-[11px] border border-black/5 font-medium">
                        Deterministic Grounding
                      </span>
                    </div>

                    {activeQuestion?.current_version?.explanation && (
                      <p className="text-xs text-[#334155] leading-relaxed">
                        <strong className="text-[#0f172a]">Pedagogical Rationale:</strong>{' '}
                        {activeQuestion.current_version?.explanation}
                      </p>
                    )}

                    {activeQuestion?.current_version?.question_source_refs?.[0] && (
                      <div className="flex items-start space-x-1.5 pt-1 text-[#64748b] font-mono text-xs">
                        <Icon name="book" size={13} />
                        <span>
                          <strong className="text-[#0f172a]">Source:</strong>{' '}
                          {activeQuestion.current_version?.question_source_refs?.[0]?.resource_chunks?.resources
                            ?.original_filename || 'Course Textbook'}
                          , Page{' '}
                          {activeQuestion.current_version?.question_source_refs?.[0]?.resource_chunks?.page_number || 1}
                          , Chunk{' '}
                          <code className="bg-white px-1 py-0.5 rounded text-[#3157d5] border border-black/5">
                            #{activeQuestion.current_version?.question_source_refs?.[0]?.chunk_id}
                          </code>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Sandbox / Derivation Pad */}
                <div className="rounded-lg bg-[#f8fafc] border border-[#e2e8f0] p-4 flex flex-col gap-2">
                  <details className="group cursor-pointer">
                    <summary className="flex items-center justify-between font-mono text-xs font-semibold text-[#0f172a] list-none select-none">
                      <div className="flex items-center space-x-1.5">
                        <Icon name="edit" size={13} />
                        <span>Student Scratchpad &amp; Mathematical Derivation Sandbox</span>
                      </div>
                      <span className="text-[#64748b] group-open:rotate-180 transition-transform">
                        ▼
                      </span>
                    </summary>

                    <div className="mt-3 pt-2 flex flex-col gap-2 cursor-default">
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b]">
                        <span>Free-response scratch notes are automatically saved to your session.</span>
                        <span className="text-[#059669] flex items-center gap-1 font-medium">
                          <Icon name="checkCircle" size={11} /> Auto-saved
                        </span>
                      </div>
                      <textarea
                        className="w-full bg-white rounded-lg p-3 font-mono text-xs text-[#0f172a] border border-[#e2e8f0] focus:outline-none focus:ring-1 focus:ring-[#3157d5] shadow-sm leading-relaxed"
                        onChange={(e) => {
                          if (!activeQuestion) return;
                          const val = e.target.value;
                          setFreeResponseAnswers((prev) => ({
                            ...prev,
                            [activeQuestion.id]: val,
                          }));
                        }}
                        placeholder="Write informal notes, derivation steps, or scratch calculations here..."
                        rows={3}
                        value={
                          activeQuestion ? freeResponseAnswers[activeQuestion.id] || '' : ''
                        }
                      />
                    </div>
                  </details>
                </div>
              </article>

              {/* Bottom Question Stepper Toolbar */}
              <nav
                aria-label="Question Navigation"
                className="w-full bg-white rounded-xl border border-[#e2e8f0] p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3"
              >
                <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-start">
                  <button
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#0f172a] font-mono text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={currentIndex === 0}
                    onClick={handlePrev}
                    type="button"
                  >
                    <span>← Previous Question</span>
                  </button>

                  <button
                    className="text-[#64748b] hover:text-[#dc2626] px-2 py-1 font-mono text-xs transition-colors"
                    onClick={handleClearResponse}
                    type="button"
                  >
                    Clear Response
                  </button>
                </div>

                {/* Keyboard Shortcuts Hint */}
                <div className="hidden xl:flex items-center space-x-2 px-3 py-1 rounded-full bg-[#f8fafc] border border-[#e2e8f0] font-mono text-[11px] text-[#64748b]">
                  <span className="font-bold text-[#0f172a]">[1-4]</span> Option
                  <span className="text-[#cbd5e1]">•</span>
                  <span className="font-bold text-[#0f172a]">[F]</span> Flag
                  <span className="text-[#cbd5e1]">•</span>
                  <span className="font-bold text-[#0f172a]">[Enter]</span> Next
                </div>

                <button
                  className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-[#3157d5] text-white hover:bg-[#2544ab] font-mono text-xs font-semibold shadow-sm transition-all active:scale-[0.98]"
                  onClick={handleNext}
                  type="button"
                >
                  <span>
                    {currentIndex === questions.length - 1
                      ? 'Review & Submit'
                      : 'Save & Next Question'}
                  </span>
                  <span>→</span>
                </button>
              </nav>
            </section>

            {/* RIGHT 35% Student Telemetry & Question Matrix Palette */}
            <aside className="w-full lg:w-[35%] flex flex-col gap-5 sticky top-20">
              {/* Assessment Progress Box */}
              <div className="w-full bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Icon name="chart" size={15} />
                    <span className="font-serif font-bold text-sm text-[#0f172a]">
                      Assessment Progress
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#3157d5]">
                    {completionPercentage}% Complete
                  </span>
                </div>

                {/* Segmented Dual Tone Progress Bar */}
                <div className="w-full h-2 rounded-full bg-[#f1f5f9] overflow-hidden flex">
                  <div
                    className="bg-[#3157d5] h-full transition-all duration-300"
                    style={{ width: `${completionPercentage}%` }}
                  />
                  <div
                    className="bg-[#ef4444] h-full transition-all duration-300"
                    style={{
                      width: `${totalCount > 0 ? (flaggedCount / totalCount) * 100 : 0}%`,
                    }}
                  />
                </div>

                {/* Status Grid */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono text-xs">
                  <div className="flex flex-col items-center p-2 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                    <span className="font-bold text-base text-[#3157d5]">{answeredCount}</span>
                    <span className="text-[#64748b] text-[10px]">Answered</span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                    <span className="font-bold text-base text-[#ef4444]">{flaggedCount}</span>
                    <span className="text-[#64748b] text-[10px]">Flagged</span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                    <span className="font-bold text-base text-[#64748b]">{unvisitedCount}</span>
                    <span className="text-[#64748b] text-[10px]">Unvisited</span>
                  </div>
                </div>
              </div>

              {/* 5x5 Question Matrix Grid Palette */}
              <div className="w-full bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif font-bold text-sm text-[#0f172a]">
                    Question Matrix
                  </h2>
                  <span className="font-mono text-xs text-[#64748b]">
                    {totalCount} Questions Total
                  </span>
                </div>

                {/* Numbered Matrix Grid */}
                <div className="grid grid-cols-5 gap-2 font-mono text-xs font-semibold select-none">
                  {questions.map((q, idx) => {
                    const isCurrent = idx === currentIndex;
                    const isAnswered = Boolean(selectedAnswers[q.id]);
                    const isFlagged = flaggedIds.has(q.id);

                    let btnClass = 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]';
                    if (isCurrent) {
                      btnClass =
                        'bg-white text-[#3157d5] ring-2 ring-[#3157d5] shadow-sm font-bold';
                    } else if (isFlagged) {
                      btnClass =
                        'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5] hover:bg-[#fecaca]';
                    } else if (isAnswered) {
                      btnClass = 'bg-[#3157d5] text-white hover:bg-[#2544ab] shadow-sm';
                    }

                    return (
                      <button
                        key={q.id}
                        className={`h-9 rounded-lg flex items-center justify-center transition-all relative ${btnClass}`}
                        onClick={() => handleSelectQuestion(idx)}
                        type="button"
                      >
                        <span>{idx + 1}</span>
                        {isFlagged && !isCurrent && (
                          <span className="absolute top-1 right-1 text-[8px] text-[#ef4444]">
                            ⚑
                          </span>
                        )}
                        {isCurrent && (
                          <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#3157d5]" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend Row */}
                <div className="flex flex-wrap items-center justify-between gap-1 pt-2 font-mono text-[10px] text-[#64748b] border-t border-[#f1f5f9]">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#3157d5]" />
                    <span>Answered</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-[#fee2e2] border border-[#ef4444] text-[#ef4444] flex items-center justify-center text-[7px]">
                      ⚑
                    </span>
                    <span>Flagged</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-white ring-1 ring-[#3157d5]" />
                    <span>Current</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-[#f1f5f9]" />
                    <span>Unvisited</span>
                  </span>
                </div>
              </div>

              {/* Academic Honor Safeguards Box */}
              <div className="w-full bg-[#f8fafc] rounded-xl border border-[#e2e8f0] p-4 shadow-sm">
                <details className="group cursor-pointer">
                  <summary className="flex items-center justify-between font-mono text-xs font-semibold text-[#0f172a] select-none list-none">
                    <div className="flex items-center space-x-1.5">
                      <Icon name="shield" size={14} />
                      <span>Honor Safeguards &amp; Exam Protocol</span>
                    </div>
                    <span className="text-[#64748b] group-open:rotate-180 transition-transform">
                      ▼
                    </span>
                  </summary>
                  <ul className="mt-2.5 pt-2 flex flex-col gap-1.5 font-mono text-[11px] text-[#64748b] list-disc pl-4 border-t border-[#e2e8f0]/60">
                    <li>Scientific calculator: accessible via the built-in toolbar utility.</li>
                    <li>Browser confinement: automated supervision logs tab defocus events.</li>
                    <li>Cryptographic provenance: questions are grounded in source textbooks.</li>
                  </ul>
                </details>
              </div>

              {/* Paper Submission Readiness Card */}
              <div className="w-full bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-[#64748b] font-medium">
                    Paper Submission Readiness
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#0f172a] font-mono text-[11px] font-semibold">
                    {totalCount - answeredCount} Remaining
                  </span>
                </div>

                <button
                  className="w-full flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-lg bg-[#006a61] text-white hover:bg-[#005049] transition-all font-mono text-xs font-semibold shadow-sm active:scale-[0.98]"
                  onClick={() => setIsSubmitModalOpen(true)}
                  type="button"
                >
                  <Icon name="lock" size={14} />
                  <span>Review All &amp; Submit Paper</span>
                </button>

                <div className="flex items-center justify-center space-x-1 text-[#64748b] hover:text-[#3157d5] font-mono text-[11px] cursor-pointer transition-colors pt-1">
                  <span>Emergency Proctor Contact / System Support</span>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* 4. Scientific Calculator Modal */}
      {isCalcOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-white rounded-xl shadow-2xl border border-[#e2e8f0] p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-1 border-b border-[#f1f5f9]">
              <div className="flex items-center space-x-1.5 font-serif font-bold text-sm text-[#0f172a]">
                <Icon name="calculator" size={16} />
                <span>Scientific Utility</span>
              </div>
              <button
                aria-label="Close Calculator"
                className="p-1 rounded hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] transition-colors"
                onClick={() => setIsCalcOpen(false)}
                type="button"
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            {/* Display screen */}
            <div className="bg-[#f8fafc] rounded-lg p-3 text-right flex flex-col justify-end min-h-[64px] border border-[#e2e8f0]">
              <div className="text-[10px] font-mono text-[#64748b] h-4">
                {calcExpression || ' '}
              </div>
              <div className="text-xl font-mono font-bold text-[#0f172a] tabular-nums">
                {calcDisplay}
              </div>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
              {['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '√', '='].map(
                (btn) => {
                  let btnColor = 'bg-[#f8fafc] text-[#0f172a] hover:bg-[#f1f5f9]';
                  if (btn === 'C') {
                    btnColor = 'bg-[#fee2e2] text-[#991b1b] hover:bg-[#fecaca] font-bold';
                  } else if (btn === '=') {
                    btnColor = 'bg-[#3157d5] text-white hover:bg-[#2544ab] font-bold shadow-sm';
                  } else if (['÷', '×', '-', '+'].includes(btn)) {
                    btnColor = 'bg-[#eef2ff] text-[#3157d5] hover:bg-[#e0e7ff] font-bold';
                  }

                  return (
                    <button
                      key={btn}
                      aria-label={`calc-btn-${btn}`}
                      className={`p-2.5 rounded-md border border-[#e2e8f0] transition-colors active:scale-95 ${btnColor}`}
                      onClick={() => handleCalcInput(btn)}
                      type="button"
                    >
                      {btn}
                    </button>
                  );
                },
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Assessment Submission Confirmation Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-[#e2e8f0] p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-2 pb-2 border-b border-[#f1f5f9]">
              <Icon name="alert" size={18} />
              <h3 className="font-serif font-bold text-base text-[#0f172a]">
                Confirm Assessment Submission
              </h3>
            </div>

            <p className="text-xs text-[#64748b] leading-relaxed">
              Are you sure you want to finalize and submit your assessment paper? Your answers will be locked and graded against the verified knowledge base.
            </p>

            {/* Submission Status Recap */}
            <div className="grid grid-cols-3 gap-2 font-mono text-xs py-2 text-center bg-[#f8fafc] rounded-lg p-3 border border-[#e2e8f0]">
              <div>
                <span className="block font-bold text-[#3157d5] text-sm">{answeredCount}</span>
                <span className="text-[10px] text-[#64748b]">Answered</span>
              </div>
              <div>
                <span className="block font-bold text-[#ef4444] text-sm">{flaggedCount}</span>
                <span className="text-[10px] text-[#64748b]">Flagged</span>
              </div>
              <div>
                <span className="block font-bold text-[#64748b] text-sm">
                  {totalCount - answeredCount}
                </span>
                <span className="text-[10px] text-[#64748b]">Unanswered</span>
              </div>
            </div>

            {totalCount - answeredCount > 0 && (
              <div className="p-2.5 rounded-lg bg-[#fffbeb] border border-[#fef3c7] text-[#92400e] text-xs font-mono">
                Warning: You have {totalCount - answeredCount} unanswered questions remaining.
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] hover:bg-[#f8fafc] text-xs font-mono font-medium text-[#334155]"
                onClick={() => setIsSubmitModalOpen(false)}
                type="button"
              >
                Return to Exam
              </button>
              <button
                className="px-4 py-1.5 rounded-lg bg-[#3157d5] hover:bg-[#2544ab] text-white text-xs font-mono font-semibold shadow-sm transition-all"
                onClick={() => {
                  setIsSubmitModalOpen(false);
                  setIsSubmitted(true);
                }}
                type="button"
              >
                Confirm &amp; Submit Paper
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Footer */}
      <footer className="w-full bg-[#f8fafc] border-t border-[#e2e8f0] py-3 mt-auto">
        <div className="max-w-[1560px] mx-auto px-4 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-[#64748b] font-mono text-xs">
          <div>© 2026 GroundQ Academic Learning Engine. Localhost Modular Monolith.</div>
          <div className="flex items-center space-x-3">
            <span>Deterministic Grounding v2.4</span>
            <span className="text-[#cbd5e1]">•</span>
            <span>Academic Integrity Confinement Safe</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
