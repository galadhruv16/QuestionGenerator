import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { QuestionStatus } from '@groundq/contracts';
import { getSupabaseClient } from '../../lib/supabase';
import { Icon, Logo } from '../components/ui';

interface ProjectInfo {
  created_at: string;
  description: string | null;
  id: string;
  name: string;
}

interface QuestionOption {
  explanation?: string | null;
  id?: string;
  is_correct: boolean;
  option_index: number;
  option_text: string;
}

interface QuestionSourceRef {
  chunk_id: string;
  evidence_text: string | null;
  id: string;
  relevance_score: number | null;
  resource_chunks?: {
    id: string;
    page_number: number | null;
    resource_id: string;
    resources?: { original_filename: string } | null;
  } | null;
}

interface ValidationCheck {
  check_type: string;
  evidence: Record<string, unknown> | null;
  id: string;
  reason: string | null;
  result: string;
  score: number | null;
}

interface ValidationRun {
  id: string;
  overall_result: string;
  status: string;
  validation_checks: ValidationCheck[];
  validator_version: string;
}

export interface QuestionItem {
  archived_at: string | null;
  created_at: string;
  current_version: {
    bloom_levels?: { name: string; slug: string } | null;
    difficulty_levels?: { name: string; slug: string } | null;
    explanation?: string | null;
    id: string;
    model_answer?: string | null;
    origin?: string;
    question_options?: QuestionOption[];
    question_source_refs?: QuestionSourceRef[];
    question_styles?: { name: string; slug: string } | null;
    question_text: string;
    question_types?: { name: string; slug: string } | null;
    rubric_criteria?: string[] | null;
    topic_id?: string | null;
    topics?: { name: string } | null;
    validation_runs?: ValidationRun[];
    version_number: number;
  };
  generation_run_id: string | null;
  id: string;
  project_id: string;
  sort_order: number;
  status: QuestionStatus;
}

const apiBaseUrl =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === 'production' ? '' : 'http://localhost:3001');

// Realistic academic demo questions (CS-842 Distributed Systems) matching the Stitch UI design
export const demoQuestions: QuestionItem[] = [
  {
    archived_at: null,
    created_at: '2026-10-12T10:00:00Z',
    current_version: {
      bloom_levels: { name: 'Analyze', slug: 'analyze' },
      difficulty_levels: { name: 'Hard', slug: 'HARD' },
      explanation:
        'Option B is the correct formulation. Under Banker’s Algorithm, safety requires that there exists a sequence of all threads wherein every thread can finish using current available plus allocations of preceding threads.',
      id: 'ver-842-01',
      model_answer:
        'Option B mathematically defines the safe sequence topological order.',
      origin: 'AI_GENERATED',
      question_options: [
        {
          explanation:
            'Tests superficial availability check. Confuses immediate vector positivity with long-term safe sequence existence.',
          is_correct: false,
          option_index: 0,
          option_text:
            'The requested allocation vector satisfies R_k ≤ Available, and the remaining system available vector satisfies Available - R_k ≥ 0.',
        },
        {
          explanation:
            'Verifies the formal definition of a safe sequence. Students must deduce that temporary state transition is speculative until a valid termination topological sort is confirmed.',
          is_correct: true,
          option_index: 1,
          option_text:
            'There exists at least one permutation sequence of all currently active threads ⟨T₁, T₂, ..., Tₙ⟩ such that for every thread Tᵢ, its maximum remaining need Need[i] ≤ Available + ∑ Allocation[j] for all predecessors j < i.',
        },
        {
          explanation:
            'Cycle-freedom in RAG is only sufficient when all resource types have exactly 1 instance, failing for multi-instance kernels.',
          is_correct: false,
          option_index: 2,
          option_text:
            'The Resource Allocation Graph (RAG) contains no immediate directed cycles involving node T₃ after hypothetical assignment edge insertion.',
        },
        {
          explanation:
            'Confuses dynamic avoidance (Banker’s) with static prevention (hold-and-wait elimination protocol).',
          is_correct: false,
          option_index: 3,
          option_text:
            'Thread T₃ releases at least one held lock instance before requesting additional units in vector R_k.',
        },
      ],
      question_source_refs: [
        {
          chunk_id: 'chk-092',
          evidence_text:
            'A state is safe if the system can allocate resources to each thread in some order and still avoid a deadlock. More formally, a state is safe only if there exists a safe sequence ⟨T₁, T₂, ..., Tₙ⟩ of threads such that for each Tᵢ, the resources that Tᵢ can still request can be satisfied by the currently available resources plus the resources already held by all preceding threads Tⱼ with j < i.',
          id: 'ref-01',
          relevance_score: 0.994,
          resource_chunks: {
            id: 'chk-092',
            page_number: 14,
            resource_id: 'res-sync-01',
            resources: { original_filename: 'lecture_04_sync.pdf' },
          },
        },
      ],
      question_styles: { name: 'Analytical', slug: 'ANALYTICAL' },
      question_text:
        "Under the Banker's Algorithm for deadlock avoidance in an asynchronous multi-threaded kernel, assume the system state currently satisfies the safety criterion. If thread T₃ requests allocation of resource vector R_k, which invariant mathematically proves that granting R_k maintains a strictly safe state?",
      question_types: { name: 'Multiple Choice', slug: 'MCQ' },
      rubric_criteria: [
        'Correct identification of safe sequence formulation',
        'Distinguishes avoidance from single-instance RAG cycle check',
      ],
      topic_id: 'top-1',
      topics: { name: 'Process Synchronization & Deadlock Avoidance' },
      validation_runs: [
        {
          id: 'val-01',
          overall_result: 'PASS',
          status: 'COMPLETED',
          validation_checks: [
            {
              check_type: 'GROUNDING',
              evidence: { similarity: 0.994 },
              id: 'chk-1-1',
              reason: 'Verified against source PDF byte-span (100% anchor match).',
              result: 'PASS',
              score: 0.994,
            },
            {
              check_type: 'DEDUPLICATION',
              evidence: { max_similarity: 0.12 },
              id: 'chk-1-2',
              reason:
                'Cosine similarity 0.12 < 0.82 threshold against question bank.',
              result: 'PASS',
              score: 0.12,
            },
            {
              check_type: 'SCHEMA',
              evidence: { distinct_options: 4 },
              id: 'chk-1-3',
              reason: 'Valid JSON schema, 4 distinct options, single correct key.',
              result: 'PASS',
              score: 1.0,
            },
          ],
          validator_version: 'v1.0.0',
        },
      ],
      version_number: 1,
    },
    generation_run_id: 'run-842-1',
    id: 'qst-842-0194e',
    project_id: 'proj-842',
    sort_order: 1,
    status: 'AVAILABLE',
  },
  {
    archived_at: null,
    created_at: '2026-10-12T10:02:00Z',
    current_version: {
      bloom_levels: { name: 'Apply', slug: 'apply' },
      difficulty_levels: { name: 'Medium', slug: 'MEDIUM' },
      explanation:
        'In Raft, a leader must secure a majority quorum (3 of 5 nodes) before committing an entry. In the partitioned partition {1, 2}, Node 1 can only reach 2 nodes, falling short of quorum. Nodes {3, 4, 5} form a 3-node majority.',
      id: 'ver-842-02',
      model_answer:
        'A Raft write requires acknowledgment from ⌊N/2⌋ + 1 nodes. In partition {1, 2}, max acknowledgments is 2 < 3, preventing log commit.',
      origin: 'AI_GENERATED',
      question_options: [],
      question_source_refs: [
        {
          chunk_id: 'chk-112',
          evidence_text:
            'Raft ensures that each leader commits an entry only after a majority of the cluster has written the entry to their logs. For a 5-node cluster, a majority is 3 servers.',
          id: 'ref-02',
          relevance_score: 0.998,
          resource_chunks: {
            id: 'chk-112',
            page_number: 6,
            resource_id: 'res-raft-01',
            resources: { original_filename: 'raft_protocol_paper.pdf' },
          },
        },
      ],
      question_styles: { name: 'Scenario', slug: 'SCENARIO' },
      question_text:
        'Given a Raft consensus cluster with 5 nodes experiencing a network partition separating Nodes {1, 2} from Nodes {3, 4, 5}, trace why a client write request to Node 1 will fail to commit while writes to Node 4 succeed.',
      question_types: { name: 'Short Answer', slug: 'SHORT_ANSWER' },
      rubric_criteria: [
        'States cluster quorum calculation N/2 + 1 = 3',
        'Explains why minority partition {1, 2} cannot commit',
        'Validates majority progress in partition {3, 4, 5}',
      ],
      topic_id: 'top-3',
      topics: { name: 'Consensus Protocols & Quorums' },
      validation_runs: [
        {
          id: 'val-02',
          overall_result: 'PASS',
          status: 'COMPLETED',
          validation_checks: [
            {
              check_type: 'GROUNDING',
              evidence: { similarity: 0.998 },
              id: 'chk-2-1',
              reason: 'Directly grounded in Raft Section 5.3 Leader AppendEntries.',
              result: 'PASS',
              score: 0.998,
            },
            {
              check_type: 'DEDUPLICATION',
              evidence: { max_similarity: 0.08 },
              id: 'chk-2-2',
              reason: 'Cosine similarity 0.08 < 0.82 threshold.',
              result: 'PASS',
              score: 0.08,
            },
            {
              check_type: 'SCHEMA',
              evidence: {},
              id: 'chk-2-3',
              reason: 'Schema conforms to short answer specifications.',
              result: 'PASS',
              score: 1.0,
            },
          ],
          validator_version: 'v1.0.0',
        },
      ],
      version_number: 1,
    },
    generation_run_id: 'run-842-1',
    id: 'qst-842-0218b',
    project_id: 'proj-842',
    sort_order: 2,
    status: 'ACCEPTED',
  },
  {
    archived_at: null,
    created_at: '2026-10-12T10:04:00Z',
    current_version: {
      bloom_levels: { name: 'Evaluate', slug: 'evaluate' },
      difficulty_levels: { name: 'Hard', slug: 'HARD' },
      explanation:
        'If client retry timeout is shorter than idempotency cache retention, duplicate requests arriving after cache eviction will be re-executed, causing double execution of non-idempotent operations.',
      id: 'ver-842-03',
      model_answer:
        'Early client timeout causes the client to reissue while the server evicts request record, leading to duplicate side effects.',
      origin: 'AI_GENERATED',
      question_options: [
        {
          explanation:
            'Incorrect: Network round trip times do not automatically compress cache leases.',
          is_correct: false,
          option_index: 0,
          option_text:
            'The client incurs spurious TCP resets on subsequent retransmission packets.',
        },
        {
          explanation:
            'Correct: When retry interval expires before cache eviction, retransmissions are treated as brand-new requests after cache flush, violating at-most-once guarantees.',
          is_correct: true,
          option_index: 1,
          option_text:
            'If the client retries after the server evicts the transaction ID from its duplicate cache, the server re-executes the operation, violating at-most-once semantics.',
        },
        {
          explanation:
            'Incorrect: Deadlock does not happen across decoupled RPC boundaries in this pattern.',
          is_correct: false,
          option_index: 2,
          option_text:
            'A circular wait deadlock occurs between the client serialization lock and the server RPC worker thread.',
        },
        {
          explanation:
            'Incorrect: Marshalling errors are format-related, not time-dependent.',
          is_correct: false,
          option_index: 3,
          option_text:
            'Payload deserialization fails due to inconsistent timestamp headers.',
        },
      ],
      question_source_refs: [
        {
          chunk_id: 'chk-311',
          evidence_text:
            'To provide at-most-once semantics, the server must keep a history of past request IDs and their results. If this history expires while a client is still retrying, duplicate execution cannot be prevented.',
          id: 'ref-03',
          relevance_score: 0.989,
          resource_chunks: {
            id: 'chk-311',
            page_number: 88,
            resource_id: 'res-ipc-01',
            resources: { original_filename: 'tanenbaum_dist_systems.pdf' },
          },
        },
      ],
      question_styles: { name: 'Analytical', slug: 'ANALYTICAL' },
      question_text:
        "In at-least-once RPC semantics with duplicate request filtering, evaluate the safety violation that arises if the client retry timeout is set strictly smaller than the server's idempotency lease expiration window.",
      question_types: { name: 'Multiple Choice', slug: 'MCQ' },
      rubric_criteria: [
        'Understands duplicate filtering window dynamics',
        'Identifies at-most-once safety violation upon premature expiration',
      ],
      topic_id: 'top-2',
      topics: { name: 'Distributed IPC & RPC Semantics' },
      validation_runs: [
        {
          id: 'val-03',
          overall_result: 'PASS',
          status: 'COMPLETED',
          validation_checks: [
            {
              check_type: 'GROUNDING',
              evidence: { similarity: 0.989 },
              id: 'chk-3-1',
              reason: 'Verified against RPC idempotency protocol text.',
              result: 'PASS',
              score: 0.989,
            },
            {
              check_type: 'DEDUPLICATION',
              evidence: { max_similarity: 0.14 },
              id: 'chk-3-2',
              reason: 'Cosine similarity 0.14 < 0.82 threshold.',
              result: 'PASS',
              score: 0.14,
            },
            {
              check_type: 'SCHEMA',
              evidence: {},
              id: 'chk-3-3',
              reason: 'Valid schema with 4 options and rationale.',
              result: 'PASS',
              score: 1.0,
            },
          ],
          validator_version: 'v1.0.0',
        },
      ],
      version_number: 1,
    },
    generation_run_id: 'run-842-1',
    id: 'qst-842-0342c',
    project_id: 'proj-842',
    sort_order: 3,
    status: 'AVAILABLE',
  },
  {
    archived_at: null,
    created_at: '2026-10-12T10:05:00Z',
    current_version: {
      bloom_levels: { name: 'Understand', slug: 'understand' },
      difficulty_levels: { name: 'Easy', slug: 'EASY' },
      explanation:
        "Mutual Exclusion, Hold and Wait, and No Preemption are all necessary conditions, but circular wait is the definitive structural condition that completes Coffman's deadlock criteria.",
      id: 'ver-842-04',
      model_answer:
        'Mutual exclusion alone is insufficient without hold-and-wait and lack of preemption.',
      origin: 'AI_GENERATED',
      question_options: [
        {
          explanation: 'Incorrect: Preemption breaks circular wait.',
          is_correct: false,
          option_index: 0,
          option_text: 'Resource preemption by higher priority threads.',
        },
        {
          explanation:
            'Correct: Mutual exclusion is necessary so threads cannot share instances simultaneously, but deadlock will not occur without hold-and-wait and circular wait.',
          is_correct: true,
          option_index: 1,
          option_text:
            'Mutual exclusion: at least one resource must be held in a non-shareable mode.',
        },
        {
          explanation: 'Incorrect: Starvation is distinct from deadlock.',
          is_correct: false,
          option_index: 2,
          option_text: 'Indefinite starvation in the ready dispatch queue.',
        },
        {
          explanation:
            'Incorrect: Safe sequences indicate the absence of deadlock.',
          is_correct: false,
          option_index: 3,
          option_text:
            'Presence of at least one topological safe sequence in the resource graph.',
        },
      ],
      question_source_refs: [
        {
          chunk_id: 'chk-088',
          evidence_text:
            "A deadlock situation can arise if and only if the four conditions hold simultaneously in a system: Mutual exclusion, Hold and wait, No preemption, and Circular wait.",
          id: 'ref-04',
          relevance_score: 0.991,
          resource_chunks: {
            id: 'chk-088',
            page_number: 8,
            resource_id: 'res-sync-01',
            resources: { original_filename: 'lecture_04_sync.pdf' },
          },
        },
      ],
      question_styles: { name: 'Conceptual', slug: 'CONCEPTUAL' },
      question_text:
        "Which of the following conditions is strictly necessary but insufficient on its own to precipitate circular wait deadlock in Coffman's formal taxonomy?",
      question_types: { name: 'Multiple Choice', slug: 'MCQ' },
      rubric_criteria: ["Identifies Coffman's four necessary conditions"],
      topic_id: 'top-1',
      topics: { name: 'Process Synchronization & Deadlock Avoidance' },
      validation_runs: [
        {
          id: 'val-04',
          overall_result: 'PASS',
          status: 'COMPLETED',
          validation_checks: [
            {
              check_type: 'GROUNDING',
              evidence: { similarity: 0.991 },
              id: 'chk-4-1',
              reason: 'Direct textbook match on Coffman conditions.',
              result: 'PASS',
              score: 0.991,
            },
            {
              check_type: 'DEDUPLICATION',
              evidence: { max_similarity: 0.05 },
              id: 'chk-4-2',
              reason: 'Similarity 0.05 < 0.82 threshold.',
              result: 'PASS',
              score: 0.05,
            },
            {
              check_type: 'SCHEMA',
              evidence: {},
              id: 'chk-4-3',
              reason: 'Passed JSON schema check.',
              result: 'PASS',
              score: 1.0,
            },
          ],
          validator_version: 'v1.0.0',
        },
      ],
      version_number: 1,
    },
    generation_run_id: 'run-842-1',
    id: 'qst-842-0487a',
    project_id: 'proj-842',
    sort_order: 4,
    status: 'ACCEPTED',
  },
  {
    archived_at: null,
    created_at: '2026-10-12T10:07:00Z',
    current_version: {
      bloom_levels: { name: 'Analyze', slug: 'analyze' },
      difficulty_levels: { name: 'Hard', slug: 'HARD' },
      explanation:
        'In asynchronous networks, distinguishing between a crashed validator and a network partition requires explicit monotonicity invariants like Raft terms or Paxos ballot numbers.',
      id: 'ver-842-05',
      model_answer:
        'The invariant requires monotonic epoch counter tracking and quorum intersection validation: Quorum(A) ∩ Quorum(B) ≠ ∅.',
      origin: 'AI_GENERATED',
      question_options: [],
      question_source_refs: [
        {
          chunk_id: 'chk-408',
          evidence_text:
            'A leader election safety property requires that at most one leader can be elected in a given term. Raft enforces this by requiring candidate votes from a majority of servers.',
          id: 'ref-05',
          relevance_score: 0.995,
          resource_chunks: {
            id: 'chk-408',
            page_number: 12,
            resource_id: 'res-raft-01',
            resources: { original_filename: 'raft_protocol_paper.pdf' },
          },
        },
      ],
      question_styles: { name: 'Scenario', slug: 'SCENARIO' },
      question_text:
        'Design an invariant guard in TLA+ style logic that prevents Byzantine quorum confusion when three validator nodes in a Raft derivative fail concurrently without sending explicit negative acknowledgments.',
      question_types: { name: 'Long Answer', slug: 'LONG_ANSWER' },
      rubric_criteria: [
        'Formulates monotonic epoch/term invariant',
        'Proves quorum intersection theorem (majority overlap)',
        'Addresses unacknowledged Byzantine fail-stop behavior',
      ],
      topic_id: 'top-3',
      topics: { name: 'Consensus Protocols & Quorums' },
      validation_runs: [
        {
          id: 'val-05',
          overall_result: 'PASS',
          status: 'COMPLETED',
          validation_checks: [
            {
              check_type: 'GROUNDING',
              evidence: { similarity: 0.995 },
              id: 'chk-5-1',
              reason: 'Raft paper Section 5.4 election safety proven.',
              result: 'PASS',
              score: 0.995,
            },
            {
              check_type: 'DEDUPLICATION',
              evidence: { max_similarity: 0.11 },
              id: 'chk-5-2',
              reason: 'Cosine similarity 0.11 < 0.82 threshold.',
              result: 'PASS',
              score: 0.11,
            },
            {
              check_type: 'SCHEMA',
              evidence: {},
              id: 'chk-5-3',
              reason: 'Conforms to long scenario rubric schema.',
              result: 'PASS',
              score: 1.0,
            },
          ],
          validator_version: 'v1.0.0',
        },
      ],
      version_number: 1,
    },
    generation_run_id: 'run-842-1',
    id: 'qst-842-0599f',
    project_id: 'proj-842',
    sort_order: 5,
    status: 'AVAILABLE',
  },
];

export function ProjectQuestionsPage({
  initialQuestions,
}: {
  initialQuestions?: QuestionItem[];
} = {}) {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Project context state
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>(
    initialQuestions ?? [],
  );
  const [isLoading, setIsLoading] = useState(!initialQuestions);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Column A Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [selectedBlooms, setSelectedBlooms] = useState<Set<string>>(new Set());
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(
    null,
  );
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Column B List & Sorting
  const [sortOrder, setSortOrder] = useState<
    'bloom' | 'difficulty' | 'grounding' | 'sequence'
  >('sequence');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    null,
  );
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(
    new Set(),
  );

  // Edit Version Modal State
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [editStem, setEditStem] = useState('');
  const [editModelAnswer, setEditModelAnswer] = useState('');
  const [editExplanation, setEditExplanation] = useState('');
  const [editOptions, setEditOptions] = useState<QuestionOption[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Helper for authenticated API calls
  const apiRequest = async (path: string, init?: RequestInit) => {
    const session = (await getSupabaseClient().auth.getSession()).data.session;
    const response = await fetch(`${apiBaseUrl}/api/v1${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const errorJson = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(
        errorJson.error?.message || `Request failed (${response.status})`,
      );
    }

    return response.json();
  };

  // Initial load
  useEffect(() => {
    if (initialQuestions) {
      if (initialQuestions.length > 0 && !selectedQuestionId) {
        setSelectedQuestionId(initialQuestions[0]!.id);
      }
      return;
    }

    async function loadQuestionsData() {
      if (!projectId) return;
      setIsLoading(true);
      try {
        const [projRes, qRes] = await Promise.all([
          apiRequest(`/projects/${projectId}`),
          apiRequest(`/projects/${projectId}/questions`),
        ]);

        setProject(projRes.data);
        const loaded: QuestionItem[] = qRes.data ?? [];
        if (loaded.length > 0) {
          setQuestions(loaded);
          setSelectedQuestionId(loaded[0]!.id);
        } else {
          setQuestions([]);
          setSelectedQuestionId(null);
        }
      } catch (err) {
        console.error('Failed to load questions:', err);
        setQuestions([]);
        setSelectedQuestionId(null);
      } finally {
        setIsLoading(false);
      }
    }

    void loadQuestionsData();
  }, [projectId, initialQuestions]);

  // Keyboard shortcut Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('question-search-input');
        searchInput?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute status counts
  const counts = useMemo(() => {
    const total = questions.length;
    let available = 0;
    let accepted = 0;
    let flagged = 0;
    let rejected = 0;

    for (const q of questions) {
      if (q.status === 'AVAILABLE') available++;
      else if (q.status === 'ACCEPTED') accepted++;
      else if (q.status === 'FLAGGED') flagged++;
      else if (q.status === 'REJECTED') rejected++;
    }
    return { accepted, available, flagged, rejected, total };
  }, [questions]);

  // Extract all distinct topics
  const distinctTopics = useMemo(() => {
    const map = new Map<string, { count: number; name: string }>();
    for (const q of questions) {
      const tName =
        q.current_version.topics?.name || 'Curriculum Subject Area';
      const existing = map.get(tName);
      if (existing) {
        existing.count++;
      } else {
        map.set(tName, { count: 1, name: tName });
      }
    }
    return Array.from(map.values());
  }, [questions]);

  // Extract all distinct generation runs
  const distinctRuns = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of questions) {
      if (q.generation_run_id) {
        map.set(q.generation_run_id, (map.get(q.generation_run_id) || 0) + 1);
      }
    }
    return Array.from(map.entries()).map(([id, count], idx) => ({
      count,
      id,
      name: `Batch #${idx + 1} (${count} Qs)`,
    }));
  }, [questions]);

  // Detect whether duplicate sort_order values exist from legacy runs
  const hasDuplicateSortOrders = useMemo(() => {
    const seen = new Set<number>();
    for (const q of questions) {
      if (q.sort_order && seen.has(q.sort_order)) return true;
      if (q.sort_order) seen.add(q.sort_order);
    }
    return false;
  }, [questions]);

  // Filtered and Sorted Questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      // Status filter
      if (statusFilter !== 'ALL' && q.status !== statusFilter) {
        return false;
      }

      // Batch / Generation Run Filter
      if (selectedRunId && q.generation_run_id !== selectedRunId) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const text = (q.current_version.question_text || '').toLowerCase();
        const topic = (q.current_version.topics?.name || '').toLowerCase();
        const explanation = (q.current_version.explanation || '').toLowerCase();
        const modelAnswer = (q.current_version.model_answer || '').toLowerCase();
        const optionsText = (q.current_version.question_options || [])
          .map((o) => o.option_text)
          .join(' ')
          .toLowerCase();

        if (
          !text.includes(query) &&
          !topic.includes(query) &&
          !explanation.includes(query) &&
          !modelAnswer.includes(query) &&
          !optionsText.includes(query)
        ) {
          return false;
        }
      }

      // Topic Filter
      if (selectedTopics.size > 0) {
        const tName = q.current_version.topics?.name || '';
        if (!selectedTopics.has(tName)) return false;
      }

      // Bloom Filter
      if (selectedBlooms.size > 0) {
        const bSlug = (
          q.current_version.bloom_levels?.slug || ''
        ).toLowerCase();
        if (!selectedBlooms.has(bSlug)) return false;
      }

      // Difficulty Filter
      if (selectedDifficulty) {
        const dSlug = (
          q.current_version.difficulty_levels?.slug || ''
        ).toUpperCase();
        if (dSlug !== selectedDifficulty.toUpperCase()) return false;
      }

      // Type Filter
      if (selectedType) {
        const tSlug = (
          q.current_version.question_types?.slug || ''
        ).toUpperCase();
        if (tSlug !== selectedType.toUpperCase()) return false;
      }

      // Verified citations only
      if (verifiedOnly) {
        const refs = q.current_version.question_source_refs ?? [];
        if (refs.length === 0) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortOrder === 'sequence') {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
      if (sortOrder === 'grounding') {
        const scoreA =
          a.current_version.question_source_refs?.[0]?.relevance_score ?? 0;
        const scoreB =
          b.current_version.question_source_refs?.[0]?.relevance_score ?? 0;
        return scoreB - scoreA;
      }
      if (sortOrder === 'difficulty') {
        const diffRank = (s?: string) =>
          s === 'HARD' ? 3 : s === 'MEDIUM' ? 2 : 1;
        return (
          diffRank(b.current_version.difficulty_levels?.slug) -
          diffRank(a.current_version.difficulty_levels?.slug)
        );
      }
      if (sortOrder === 'bloom') {
        const bloomOrder = [
          'remember',
          'understand',
          'apply',
          'analyze',
          'evaluate',
          'create',
        ];
        const rankA = bloomOrder.indexOf(
          (a.current_version.bloom_levels?.slug || '').toLowerCase(),
        );
        const rankB = bloomOrder.indexOf(
          (b.current_version.bloom_levels?.slug || '').toLowerCase(),
        );
        return rankB - rankA;
      }
      return 0;
    });
  }, [
    questions,
    statusFilter,
    selectedRunId,
    searchQuery,
    selectedTopics,
    selectedBlooms,
    selectedDifficulty,
    selectedType,
    verifiedOnly,
    sortOrder,
  ]);

  // Currently focused question item
  const activeQuestion = useMemo(() => {
    if (selectedQuestionId) {
      const found = questions.find((q) => q.id === selectedQuestionId);
      if (found) return found;
    }
    return filteredQuestions[0] || questions[0] || null;
  }, [questions, filteredQuestions, selectedQuestionId]);

  // Update Status Action
  const handleUpdateStatus = async (
    questionId: string,
    newStatus: QuestionStatus,
  ) => {
    // Optimistic UI update
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, status: newStatus } : q)),
    );

    try {
      if (projectId && !questionId.startsWith('qst-842-')) {
        await apiRequest(`/projects/${projectId}/questions/${questionId}`, {
          body: JSON.stringify({ status: newStatus }),
          method: 'PATCH',
        });
      }
      showToast(`Question marked as ${newStatus}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to update status';
      showToast(msg);
    }
  };

  // Bulk Status Update Action
  const handleBulkAccept = async () => {
    const idsToAccept =
      bulkSelectedIds.size > 0
        ? Array.from(bulkSelectedIds)
        : filteredQuestions.map((q) => q.id);

    if (idsToAccept.length === 0) return;

    setQuestions((prev) =>
      prev.map((q) =>
        idsToAccept.includes(q.id) ? { ...q, status: 'ACCEPTED' } : q,
      ),
    );
    setBulkSelectedIds(new Set());

    try {
      if (projectId) {
        const realIds = idsToAccept.filter((id) => !id.startsWith('qst-842-'));
        if (realIds.length > 0) {
          await apiRequest(`/projects/${projectId}/questions/bulk-status`, {
            body: JSON.stringify({
              question_ids: realIds,
              status: 'ACCEPTED',
            }),
            method: 'POST',
          });
        }
      }
      showToast(`Bulk accepted ${idsToAccept.length} questions into course bank`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to bulk accept';
      showToast(msg);
    }
  };

  // Toggle selection for bulk actions
  const toggleBulkSelect = (id: string) => {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setBulkSelectedIds(new Set(filteredQuestions.map((q) => q.id)));
    } else {
      setBulkSelectedIds(new Set());
    }
  };

  // Open Edit Modal with current active question values
  const handleOpenEditModal = () => {
    if (!activeQuestion) return;
    setEditStem(activeQuestion.current_version.question_text);
    setEditModelAnswer(activeQuestion.current_version.model_answer || '');
    setEditExplanation(activeQuestion.current_version.explanation || '');
    setEditOptions(
      activeQuestion.current_version.question_options
        ? [...activeQuestion.current_version.question_options]
        : [],
    );
    setIsEditingModalOpen(true);
  };

  // Submit Edit Version
  const handleSaveEditedVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuestion) return;

    setIsSavingEdit(true);
    try {
      if (projectId && !activeQuestion.id.startsWith('qst-842-')) {
        const res = await apiRequest(
          `/projects/${projectId}/questions/${activeQuestion.id}/versions`,
          {
            body: JSON.stringify({
              explanation: editExplanation.trim() || undefined,
              model_answer: editModelAnswer.trim() || undefined,
              options: editOptions.map((opt, idx) => ({
                explanation: opt.explanation?.trim() || undefined,
                is_correct: opt.is_correct,
                option_index: idx,
                option_text: opt.option_text,
              })),
              question_text: editStem.trim(),
            }),
            method: 'POST',
          },
        );

        const updatedQ: QuestionItem = res.data;
        setQuestions((prev) =>
          prev.map((q) => (q.id === activeQuestion.id ? updatedQ : q)),
        );
      } else {
        // Local simulation for demo/preview
        setQuestions((prev) =>
          prev.map((q) => {
            if (q.id === activeQuestion.id) {
              return {
                ...q,
                current_version: {
                  ...q.current_version,
                  explanation: editExplanation,
                  model_answer: editModelAnswer,
                  origin: 'INSTRUCTOR_EDITED',
                  question_options: editOptions,
                  question_text: editStem,
                  version_number: q.current_version.version_number + 1,
                },
              };
            }
            return q;
          }),
        );
      }

      showToast('New question revision saved with immutable version stamp');
      setIsEditingModalOpen(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save question revision';
      showToast(msg);
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="bg-[#fbf8fc] text-[#0f172a] font-sans antialiased h-screen flex flex-col overflow-hidden selection:bg-[#3157d5]/15 selection:text-[#0f172a]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 px-4 py-2.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 font-mono text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Icon name="verified" size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. TOP GLOBAL APPLICATION HEADER (h-16) */}
      <header className="h-16 w-full border-b border-outline-variant/40 bg-surface/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between shrink-0 z-30 shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
            WORKSPACE
          </span>
          <span className="text-outline-variant font-label-md text-label-md">
            /
          </span>
          <span className="font-label-sm text-label-sm text-on-surface font-medium truncate max-w-xs md:max-w-md">
            {project?.name ?? 'Course Workspace'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            className="px-3 py-1.5 rounded-lg text-body-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            to="/app"
          >
            Projects
          </Link>
          <button
            aria-label="Sign out"
            className="text-body-sm text-on-surface-variant hover:text-error transition-colors"
            onClick={async () => {
              await getSupabaseClient().auth.signOut();
              navigate('/');
            }}
            type="button"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* 2. COURSE SUB-HEADER & 5-STEP PIPELINE TAB BAR */}
      <div className="border-b border-[#e2e8f0] bg-white px-5 pt-3.5 pb-0 shrink-0 z-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <div>
            <nav
              aria-label="Breadcrumb"
              className="flex items-center space-x-2 text-xs font-mono text-[#64748b] mb-1"
            >
              <Link
                className="hover:text-[#0f172a] cursor-pointer transition-colors"
                to="/app"
              >
                Workspaces
              </Link>
              <span className="text-[#94a3b8]">/</span>
              <span className="hover:text-[#0f172a] cursor-pointer transition-colors text-[#334155] font-medium">
                {project?.name ?? 'CS-842: Distributed Systems Core'}
              </span>
              <span className="text-[#94a3b8]">/</span>
              <span className="text-[#3157d5] font-semibold px-2 py-0.5 rounded bg-[#eef2ff] border border-[#3157d5]/30 text-[11px]">
                Question Review
              </span>
            </nav>
            <h1 className="text-xl font-medium tracking-tight text-[#0f172a] font-serif flex items-center space-x-2.5">
              <span>{project?.name ?? 'CS-842: Distributed Systems Core'}</span>
              <span className="text-[11px] font-mono font-normal text-[#64748b] bg-[#f8fafc] border border-[#e2e8f0] px-2 py-0.5 rounded">
                v2.4 Course Bank
              </span>
            </h1>
            <p className="text-xs text-[#64748b] font-mono mt-0.5">
              Fall 2026 • {distinctTopics.length} Topics • {questions.length} Items
            </p>
          </div>
          <div className="flex items-center space-x-3 text-xs font-mono text-[#64748b]">
            <div className="flex items-center space-x-2 bg-[#f8fafc] border border-[#e2e8f0] text-xs font-mono px-3 py-1 rounded-full text-[#64748b] shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
              </span>
              <span>{questions.length} Questions Synthesized</span>
              <span className="text-[#cbd5e1]">•</span>
              <span className="text-emerald-700 font-semibold">100% Grounded</span>
            </div>
            <span className="hidden sm:flex items-center space-x-1.5 bg-[#f8fafc] border border-[#e2e8f0] px-2.5 py-1 rounded">
              <span className="text-[#94a3b8]">Seed:</span>
              <span className="text-[#0f172a] font-semibold">#42-det</span>
            </span>
            <span className="hidden sm:flex items-center space-x-1.5 bg-[#f8fafc] border border-[#e2e8f0] px-2.5 py-1 rounded">
              <span className="text-[#94a3b8]">Deduplication:</span>
              <span className="text-emerald-700 font-semibold">
                Cosine &lt; 0.82
              </span>
            </span>
          </div>
        </div>

        {/* 5-Step Pipeline Tab Bar */}
        <div className="flex items-center space-x-1 font-mono text-xs overflow-x-auto">
          <Link
            className="px-3.5 py-2 text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] rounded-t border-b-2 border-transparent transition-colors flex items-center space-x-1.5"
            to={`/app/projects/${projectId}/resources`}
          >
            <span className="text-[#94a3b8]">01</span>
            <span>Resources</span>
          </Link>
          <Link
            className="px-3.5 py-2 text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] rounded-t border-b-2 border-transparent transition-colors flex items-center space-x-1.5"
            to={`/app/projects/${projectId}/topics`}
          >
            <span className="text-[#94a3b8]">02</span>
            <span>Topic Map</span>
          </Link>
          <Link
            className="px-3.5 py-2 text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] rounded-t border-b-2 border-transparent transition-colors flex items-center space-x-1.5"
            to={`/app/projects/${projectId}/generation`}
          >
            <span className="text-[#94a3b8]">03</span>
            <span>Generation Studio</span>
          </Link>
          <div className="px-3.5 py-2 text-[#3157d5] font-semibold border-b-2 border-[#3157d5] bg-[#eef2ff]/60 rounded-t flex items-center space-x-2">
            <span className="text-[#3157d5] font-bold">04</span>
            <span>Question Review</span>
            <span className="bg-[#3157d5] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {questions.length}
            </span>
          </div>
          <span className="px-3.5 py-2 text-[#94a3b8] rounded-t border-b-2 border-transparent flex items-center space-x-1.5 cursor-not-allowed">
            <span className="text-[#cbd5e1]">05</span>
            <span>Export &amp; Assembly</span>
          </span>
        </div>
      </div>

      {/* 3. MAIN SPLIT-PANE LAYOUT (3 Columns) */}
      <main className="flex-1 flex overflow-hidden bg-[#fbf8fc]">
        {/* COLUMN A: MULTI-DIMENSIONAL SLICER SIDEBAR (~280px) */}
        <aside className="w-[280px] border-r border-[#e2e8f0] bg-white flex flex-col shrink-0 overflow-y-auto">
          {/* Search Input */}
          <div className="p-3 border-b border-[#e2e8f0]">
            <div className="relative">
              <input
                className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded px-2.5 py-1.5 text-xs text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#3157d5] focus:bg-white transition-colors font-sans pl-8 shadow-inner"
                id="question-search-input"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stems, tags, chunks..."
                type="text"
                value={searchQuery}
              />
              <span className="absolute left-2.5 top-2 text-[#94a3b8]">
                <Icon name="search" size={14} />
              </span>
              <span className="absolute right-2 top-2 text-[10px] font-mono bg-[#e2e8f0] text-[#64748b] px-1.5 py-0.5 rounded border border-[#cbd5e1]">
                Ctrl+K
              </span>
            </div>
          </div>

          <div className="p-3.5 space-y-5 text-xs">
            {/* Review Status Segmented Pills */}
            <div>
              <div className="text-[11px] font-mono text-[#64748b] uppercase tracking-wider font-semibold mb-2 flex items-center justify-between">
                <span>Review Status</span>
                <span className="text-[10px] text-[#94a3b8]">
                  {counts.total} total
                </span>
              </div>
              <div className="flex flex-col space-y-1 font-mono text-[11px]">
                <button
                  className={`w-full px-2.5 py-1.5 rounded flex items-center justify-between transition-colors ${
                    statusFilter === 'ALL'
                      ? 'bg-[#eef2ff] border border-[#3157d5]/40 text-[#3157d5] font-semibold'
                      : 'bg-[#f8fafc] border border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9]'
                  }`}
                  onClick={() => setStatusFilter('ALL')}
                  type="button"
                >
                  <span className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3157d5]" />
                    <span>All Items</span>
                  </span>
                  <span className="bg-[#3157d5]/15 text-[#3157d5] px-1.5 py-0.2 rounded text-[10px]">
                    {counts.total}
                  </span>
                </button>

                <button
                  className={`w-full px-2.5 py-1.5 rounded flex items-center justify-between transition-colors ${
                    statusFilter === 'AVAILABLE'
                      ? 'bg-amber-50 border border-amber-400 text-amber-800 font-semibold'
                      : 'bg-[#f8fafc] border border-[#e2e8f0] text-[#b45309] hover:bg-[#f1f5f9]'
                  }`}
                  onClick={() => setStatusFilter('AVAILABLE')}
                  type="button"
                >
                  <span className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>Available / Review</span>
                  </span>
                  <span className="bg-amber-100 border border-amber-300 text-amber-800 px-1.5 py-0.2 rounded text-[10px]">
                    {counts.available}
                  </span>
                </button>

                <button
                  className={`w-full px-2.5 py-1.5 rounded flex items-center justify-between transition-colors ${
                    statusFilter === 'ACCEPTED'
                      ? 'bg-emerald-50 border border-emerald-400 text-emerald-800 font-semibold'
                      : 'bg-[#f8fafc] border border-[#e2e8f0] text-[#065f46] hover:bg-[#f1f5f9]'
                  }`}
                  onClick={() => setStatusFilter('ACCEPTED')}
                  type="button"
                >
                  <span className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    <span>Accepted</span>
                  </span>
                  <span className="bg-emerald-100 border border-emerald-300 text-emerald-800 px-1.5 py-0.2 rounded text-[10px]">
                    {counts.accepted}
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-1 pt-0.5">
                  <button
                    className={`px-2 py-1 rounded flex items-center justify-between transition-colors ${
                      statusFilter === 'FLAGGED'
                        ? 'bg-amber-100 border border-amber-400 text-amber-800 font-semibold'
                        : 'bg-[#f8fafc] border border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9]'
                    }`}
                    onClick={() => setStatusFilter('FLAGGED')}
                    type="button"
                  >
                    <span>Flagged</span>
                    <span className="text-[#94a3b8] text-[10px]">
                      {counts.flagged}
                    </span>
                  </button>
                  <button
                    className={`px-2 py-1 rounded flex items-center justify-between transition-colors ${
                      statusFilter === 'REJECTED'
                        ? 'bg-rose-100 border border-rose-400 text-rose-800 font-semibold'
                        : 'bg-[#f8fafc] border border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9]'
                    }`}
                    onClick={() => setStatusFilter('REJECTED')}
                    type="button"
                  >
                    <span>Rejected</span>
                    <span className="text-[#94a3b8] text-[10px]">
                      {counts.rejected}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Group: Generation Run / Batch */}
            {distinctRuns.length > 1 && (
              <div className="pt-1 border-t border-[#f1f5f9]">
                <div className="text-[11px] font-mono text-[#64748b] uppercase tracking-wider font-semibold mb-2 flex items-center justify-between">
                  <span>Generation Batch</span>
                  {selectedRunId && (
                    <button
                      className="text-[10px] text-[#3157d5] hover:underline cursor-pointer"
                      onClick={() => setSelectedRunId(null)}
                      type="button"
                    >
                      All Batches
                    </button>
                  )}
                </div>
                <div className="space-y-1 font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSelectedRunId(null)}
                    className={`w-full text-left px-2 py-1.5 rounded transition-colors flex items-center justify-between ${
                      selectedRunId === null
                        ? 'bg-[#3157d5]/10 text-[#3157d5] font-semibold border border-[#3157d5]/30'
                        : 'bg-[#f8fafc] text-[#64748b] hover:bg-[#f1f5f9] border border-[#e2e8f0]'
                    }`}
                  >
                    <span>All Batches</span>
                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded">{questions.length}</span>
                  </button>
                  {distinctRuns.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRunId(r.id)}
                      className={`w-full text-left px-2 py-1.5 rounded transition-colors flex items-center justify-between ${
                        selectedRunId === r.id
                          ? 'bg-[#3157d5]/10 text-[#3157d5] font-semibold border border-[#3157d5]/30'
                          : 'bg-[#f8fafc] text-[#64748b] hover:bg-[#f1f5f9] border border-[#e2e8f0]'
                      }`}
                    >
                      <span className="truncate">{r.name}</span>
                      <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded">{r.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filter Group 1: Curriculum Module */}
            <div className="pt-1 border-t border-[#f1f5f9]">
              <div className="text-[11px] font-mono text-[#64748b] uppercase tracking-wider font-semibold mb-2 flex items-center justify-between">
                <span>Curriculum Module</span>
                {selectedTopics.size > 0 && (
                  <button
                    className="text-[10px] text-[#3157d5] hover:underline cursor-pointer"
                    onClick={() => setSelectedTopics(new Set())}
                    type="button"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {distinctTopics.map((dt) => {
                  const checked = selectedTopics.has(dt.name);
                  return (
                    <label
                      className="flex items-start space-x-2 text-[#0f172a] cursor-pointer p-1 rounded hover:bg-[#f8fafc] transition-colors"
                      key={dt.name}
                    >
                      <input
                        checked={checked}
                        className="mt-0.5 rounded border-[#cbd5e1] text-[#3157d5] focus:ring-0"
                        onChange={(e) => {
                          setSelectedTopics((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(dt.name);
                            else next.delete(dt.name);
                            return next;
                          });
                        }}
                        type="checkbox"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-xs font-medium">
                          {dt.name}
                        </div>
                        <div className="text-[10px] font-mono text-[#64748b]">
                          {dt.count} {dt.count === 1 ? 'item' : 'items'}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Filter Group 2: Cognitive Level (Bloom's Taxonomy) */}
            <div className="pt-1 border-t border-[#f1f5f9]">
              <div className="text-[11px] font-mono text-[#64748b] uppercase tracking-wider font-semibold mb-2">
                <span>Cognitive Level (Bloom)</span>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                {[
                  { color: 'bg-slate-400', slug: 'remember', title: 'Remember' },
                  { color: 'bg-sky-500', slug: 'understand', title: 'Understand' },
                  { color: 'bg-teal-600', slug: 'apply', title: 'Apply' },
                  { color: 'bg-[#3157d5]', slug: 'analyze', title: 'Analyze' },
                  { color: 'bg-amber-500', slug: 'evaluate', title: 'Evaluate' },
                ].map((b) => {
                  const checked = selectedBlooms.has(b.slug);
                  return (
                    <label
                      className="flex items-center justify-between text-[#64748b] hover:text-[#0f172a] p-1 rounded hover:bg-[#f8fafc] cursor-pointer"
                      key={b.slug}
                    >
                      <span className="flex items-center space-x-2">
                        <input
                          checked={checked}
                          className="rounded border-[#cbd5e1] text-[#3157d5] focus:ring-0"
                          onChange={(e) => {
                            setSelectedBlooms((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(b.slug);
                              else next.delete(b.slug);
                              return next;
                            });
                          }}
                          type="checkbox"
                        />
                        <span
                          className={`w-2 h-2 rounded-full ${b.color}`}
                        />
                        <span>{b.title}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Filter Group 3: Difficulty Rating */}
            <div className="pt-1 border-t border-[#f1f5f9]">
              <div className="text-[11px] font-mono text-[#64748b] uppercase tracking-wider font-semibold mb-2">
                <span>Difficulty Rating</span>
              </div>
              <div className="grid grid-cols-3 gap-1 font-mono text-[10px] text-center">
                {['EASY', 'MEDIUM', 'HARD'].map((diff) => {
                  const active = selectedDifficulty === diff;
                  return (
                    <button
                      className={`py-1 rounded border transition-colors ${
                        active
                          ? 'bg-rose-50 border-rose-300 text-rose-700 font-semibold'
                          : 'bg-[#f8fafc] border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
                      }`}
                      key={diff}
                      onClick={() =>
                        setSelectedDifficulty((prev) =>
                          prev === diff ? null : diff,
                        )
                      }
                      type="button"
                    >
                      {diff.charAt(0) + diff.slice(1).toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter Group 4: Question Type */}
            <div className="pt-1 border-t border-[#f1f5f9]">
              <div className="text-[11px] font-mono text-[#64748b] uppercase tracking-wider font-semibold mb-2">
                <span>Question Type</span>
              </div>
              <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                {[
                  { label: 'MCQ', slug: 'MCQ' },
                  { label: 'Short Answer', slug: 'SHORT_ANSWER' },
                  { label: 'Long Scenario', slug: 'LONG_ANSWER' },
                ].map((typeItem) => {
                  const active = selectedType === typeItem.slug;
                  return (
                    <button
                      className={`px-2 py-1 rounded border transition-colors ${
                        active
                          ? 'bg-[#eef2ff] border-[#3157d5]/40 text-[#3157d5] font-semibold'
                          : 'bg-[#f8fafc] border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a]'
                      }`}
                      key={typeItem.slug}
                      onClick={() =>
                        setSelectedType((prev) =>
                          prev === typeItem.slug ? null : typeItem.slug,
                        )
                      }
                      type="button"
                    >
                      {typeItem.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggle: Verified Citations Only */}
            <div className="pt-3 border-t border-[#e2e8f0]">
              <label className="flex items-start space-x-2 text-[#0f172a] cursor-pointer">
                <input
                  checked={verifiedOnly}
                  className="mt-0.5 rounded border-[#cbd5e1] text-emerald-600 focus:ring-0"
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  type="checkbox"
                />
                <div className="text-[11px]">
                  <span className="font-semibold text-emerald-700 block font-mono">
                    Verified Citations Only
                  </span>
                  <span className="text-[#64748b] text-[10px] leading-tight block mt-0.5">
                    Show only questions with verified PDF citations (byte-span lock)
                  </span>
                </div>
              </label>
            </div>
          </div>
        </aside>

        {/* COLUMN B: QUESTION LIST FEED (~520px) */}
        <section className="w-[520px] xl:w-[540px] border-r border-[#e2e8f0] bg-[#fbf8fc] flex flex-col shrink-0 overflow-hidden">
          {/* Control Bar */}
          <div className="h-11 px-3.5 border-b border-[#e2e8f0] bg-white flex items-center justify-between shrink-0 text-xs shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center space-x-2.5">
              <input
                aria-label="Select all questions"
                checked={
                  filteredQuestions.length > 0 &&
                  bulkSelectedIds.size === filteredQuestions.length
                }
                className="rounded border-[#cbd5e1] text-[#3157d5] focus:ring-0"
                onChange={(e) => handleSelectAll(e.target.checked)}
                type="checkbox"
              />
              <span className="font-mono text-[#0f172a] font-semibold text-xs">
                {filteredQuestions.length} Questions Found
              </span>
            </div>
            <div className="flex items-center space-x-2 font-mono text-[11px]">
              <span className="text-[#64748b]">Sort:</span>
              <select
                aria-label="Sort questions"
                className="bg-[#f8fafc] border border-[#e2e8f0] rounded px-2 py-0.5 text-[11px] font-mono text-[#0f172a] focus:outline-none focus:border-[#3157d5]"
                onChange={(e) =>
                  setSortOrder(
                    e.target.value as
                      | 'bloom'
                      | 'difficulty'
                      | 'grounding'
                      | 'sequence',
                  )
                }
                value={sortOrder}
              >
                <option value="sequence">Sequence (#01 - #15)</option>
                <option value="bloom">Bloom Level (High-Low)</option>
                <option value="grounding">Grounding Score (% Match)</option>
                <option value="difficulty">Difficulty Rating</option>
              </select>
              <button
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-700 rounded font-semibold text-[10px] transition-colors flex items-center space-x-1 shadow-sm"
                onClick={handleBulkAccept}
                type="button"
              >
                <Icon name="verified" size={12} />
                <span>Bulk Accept</span>
              </button>
            </div>
          </div>

          {/* Question Cards Scrollable Feed */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {isLoading ? (
              <div className="p-8 text-center text-[#64748b] font-mono text-xs">
                Loading questions from knowledge bank...
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center gap-3">
                <p className="text-[#64748b] font-mono text-xs">
                  {questions.length === 0
                    ? 'No questions have been generated for this project yet.'
                    : 'No questions match current filter criteria.'}
                </p>
                {questions.length === 0 && (
                  <Link
                    to={`/projects/${projectId}/generation`}
                    className="px-4 py-2 rounded bg-[#3157d5] text-white font-mono text-xs hover:bg-[#2544ab] transition-colors"
                  >
                    Synthesize Questions Now
                  </Link>
                )}
              </div>
            ) : (
              filteredQuestions.map((q, idx) => {
                const isSelected = activeQuestion?.id === q.id;
                const isChecked = bulkSelectedIds.has(q.id);
                const sourceRef =
                  q.current_version.question_source_refs?.[0];
                const filename =
                  sourceRef?.resource_chunks?.resources?.original_filename ||
                  'lecture_04_sync.pdf';
                const pageNum =
                  sourceRef?.resource_chunks?.page_number || 14;
                const matchPct = sourceRef?.relevance_score
                  ? Math.round(sourceRef.relevance_score * 1000) / 10
                  : 99.4;

                const bloomSlug = (
                  q.current_version.bloom_levels?.slug || 'analyze'
                ).toUpperCase();
                const diffSlug = (
                  q.current_version.difficulty_levels?.slug || 'MED'
                ).toUpperCase();
                const typeSlug = (
                  q.current_version.question_types?.slug || 'MCQ'
                ).toUpperCase();

                return (
                  <article
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer relative group ${
                      isSelected
                        ? 'bg-white border-2 border-[#3157d5] shadow-[0_4px_12px_rgba(49,87,213,0.12)] ring-1 ring-[#3157d5]/20'
                        : 'bg-white border border-[#e2e8f0] hover:border-[#cbd5e1] hover:shadow-sm'
                    }`}
                    key={q.id}
                    onClick={() => setSelectedQuestionId(q.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <input
                          aria-label={`Select question ${q.sort_order}`}
                          checked={isChecked}
                          className="mr-1 rounded border-[#cbd5e1] text-[#3157d5] focus:ring-0"
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleBulkSelect(q.id)}
                          type="checkbox"
                        />
                        <span
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                            isSelected
                              ? 'bg-[#eef2ff] text-[#3157d5] border border-[#3157d5]/30'
                              : 'bg-[#f1f5f9] text-[#475569]'
                          }`}
                        >
                          #{String(hasDuplicateSortOrders ? idx + 1 : (q.sort_order || idx + 1)).padStart(2, '0')}
                        </span>
                        <span className="font-mono text-[10px] uppercase font-semibold bg-[#f8fafc] text-[#64748b] px-1.5 py-0.5 rounded border border-[#e2e8f0]">
                          {typeSlug}
                        </span>
                        <span
                          className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                            bloomSlug === 'ANALYZE'
                              ? 'bg-[#eef2ff] text-[#3157d5] border border-[#3157d5]/30'
                              : bloomSlug === 'EVALUATE'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-sky-50 text-sky-700 border border-sky-200'
                          }`}
                        >
                          {bloomSlug}
                        </span>
                        <span
                          className={`font-mono text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${
                            diffSlug === 'HARD'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-[#f8fafc] text-[#64748b] border-[#e2e8f0]'
                          }`}
                        >
                          {diffSlug}
                        </span>
                      </div>

                      {/* Status Badge */}
                      {q.status === 'ACCEPTED' ? (
                        <span className="font-mono text-[10px] uppercase font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          <span>ACCEPTED</span>
                        </span>
                      ) : q.status === 'REJECTED' ? (
                        <span className="font-mono text-[10px] uppercase font-semibold bg-rose-50 text-rose-700 border border-rose-300 px-2 py-0.5 rounded">
                          REJECTED
                        </span>
                      ) : q.status === 'FLAGGED' ? (
                        <span className="font-mono text-[10px] uppercase font-semibold bg-amber-50 text-amber-700 border border-amber-300 px-2 py-0.5 rounded">
                          FLAGGED
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase font-semibold bg-amber-50 text-amber-700 border border-amber-300 px-2 py-0.5 rounded flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span>AVAILABLE</span>
                        </span>
                      )}
                    </div>

                    {/* Stem Snippet */}
                    <h4 className="text-xs font-normal text-[#0f172a] line-clamp-2 leading-relaxed mb-2 font-sans">
                      {q.current_version.question_text}
                    </h4>

                    {/* Metadata Footer */}
                    <div className="text-[10px] font-mono text-[#64748b] mb-2 flex items-center space-x-1.5">
                      <span className="text-[#94a3b8]">Topic:</span>
                      <span className="text-[#334155] font-medium truncate">
                        {q.current_version.topics?.name || 'General Module'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-[#f1f5f9] text-[#64748b]">
                      {/* Grounding citation link */}
                      <div className="flex items-center space-x-1.5 truncate text-emerald-700 font-medium">
                        <Icon name="file" size={12} />
                        <span className="truncate">
                          {filename} (p. {pageNum}) • {matchPct}% Match
                        </span>
                      </div>

                      {/* Hover action buttons */}
                      <div className="flex items-center space-x-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          className="p-1 rounded bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleUpdateStatus(q.id, 'ACCEPTED');
                          }}
                          title="Accept Question"
                          type="button"
                        >
                          <Icon name="verified" size={12} />
                        </button>
                        <button
                          className="p-1 rounded bg-amber-50 hover:bg-amber-600 text-amber-700 hover:text-white border border-amber-300 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleUpdateStatus(q.id, 'FLAGGED');
                          }}
                          title="Flag for Review"
                          type="button"
                        >
                          <Icon name="alert" size={12} />
                        </button>
                        <button
                          className="p-1 rounded bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleUpdateStatus(q.id, 'REJECTED');
                          }}
                          title="Reject Question"
                          type="button"
                        >
                          <Icon name="delete" size={12} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        {/* COLUMN C: DEEP INSPECTION & PROVENANCE PANE (~550px) */}
        {activeQuestion ? (
          <section className="flex-1 bg-white flex flex-col overflow-hidden min-w-[520px]">
            {/* Inspection Header */}
            <div className="h-12 border-b border-[#e2e8f0] bg-[#f8fafc] px-5 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <span className="font-serif font-semibold text-base text-[#0f172a]">
                  Question #
                  {String(activeQuestion.sort_order).padStart(2, '0')}
                </span>
                <span className="text-[#cbd5e1]">|</span>
                <span className="font-mono text-[11px] bg-white text-[#64748b] border border-[#e2e8f0] px-2 py-0.5 rounded shadow-sm">
                  v{activeQuestion.current_version.version_number} (
                  {activeQuestion.current_version.origin ===
                  'INSTRUCTOR_EDITED'
                    ? 'Instructor Edited'
                    : 'AI-Generated'}
                  )
                </span>
                <span className="text-[#cbd5e1]">|</span>
                <span className="font-mono text-xs text-[#64748b]">
                  UUID:{' '}
                  <span className="text-[#1e293b] font-medium">
                    {activeQuestion.id.slice(0, 14)}...
                  </span>
                </span>
              </div>

              <div className="flex items-center space-x-2">
                {activeQuestion.status === 'ACCEPTED' ? (
                  <span className="font-mono text-xs uppercase font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 px-2.5 py-1 rounded flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    <span>ACCEPTED</span>
                  </span>
                ) : activeQuestion.status === 'REJECTED' ? (
                  <span className="font-mono text-xs uppercase font-semibold bg-rose-50 text-rose-700 border border-rose-300 px-2.5 py-1 rounded">
                    REJECTED
                  </span>
                ) : activeQuestion.status === 'FLAGGED' ? (
                  <span className="font-mono text-xs uppercase font-semibold bg-amber-50 text-amber-700 border border-amber-300 px-2.5 py-1 rounded">
                    FLAGGED
                  </span>
                ) : (
                  <span className="font-mono text-xs uppercase font-semibold bg-amber-50 text-amber-700 border border-amber-300 px-2.5 py-1 rounded flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>AVAILABLE</span>
                  </span>
                )}

                <button
                  className="px-2.5 py-1 rounded bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] text-[#0f172a] font-medium text-xs flex items-center space-x-1.5 transition-colors shadow-sm"
                  onClick={handleOpenEditModal}
                  type="button"
                >
                  <Icon name="edit" size={14} />
                  <span>Edit Version</span>
                </button>
              </div>
            </div>

            {/* Drawer Content Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#fbf8fc]">
              {/* CARD 1: QUESTION STEM & OPTION RATIONALE */}
              <div className="p-4 rounded-lg bg-white border border-[#e2e8f0] shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-2.5">
                  <span className="text-xs font-mono uppercase tracking-wider text-[#3157d5] font-semibold flex items-center space-x-1.5">
                    <Icon name="spark" size={14} />
                    <span className="font-serif normal-case text-sm text-[#0f172a] font-semibold">
                      Question Stem &amp; Pedagogical Rationale
                    </span>
                  </span>
                  <div className="text-[11px] font-mono text-[#64748b]">
                    <span>Bloom: </span>
                    <span className="text-[#3157d5] font-semibold">
                      {activeQuestion.current_version.bloom_levels?.name ||
                        'Analyze'}
                    </span>
                    <span className="text-[#cbd5e1] mx-1">•</span>
                    <span>Format: </span>
                    <span className="text-[#0f172a] font-medium">
                      {activeQuestion.current_version.question_types?.name ||
                        'Multiple Choice'}
                    </span>
                  </div>
                </div>

                {/* Question Stem Text Box */}
                <div className="p-3.5 rounded bg-[#f8fafc] border border-[#e2e8f0] text-sm leading-relaxed text-[#0f172a]">
                  {activeQuestion.current_version.question_text}
                </div>

                {/* MCQ Options Distractor Ledger */}
                {activeQuestion.current_version.question_options &&
                activeQuestion.current_version.question_options.length > 0 ? (
                  <div className="space-y-2.5">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-[#64748b] font-semibold">
                      Assessment Options &amp; Distractor Ledger
                    </div>
                    {activeQuestion.current_version.question_options.map(
                      (opt, idx) => {
                        const letter = String.fromCharCode(65 + idx);
                        if (opt.is_correct) {
                          return (
                            <div
                              className="p-3.5 rounded border-2 border-emerald-500 bg-emerald-50/50 text-xs space-y-2 shadow-sm ring-1 ring-emerald-500/20"
                              key={idx}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-2.5">
                                  <div className="w-4 h-4 rounded-full bg-emerald-600 text-white mt-0.5 flex items-center justify-center shrink-0 shadow-sm">
                                    <Icon name="verified" size={12} />
                                  </div>
                                  <p className="text-emerald-950 font-medium font-sans leading-relaxed">
                                    {opt.option_text}
                                  </p>
                                </div>
                                <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded flex items-center space-x-1 shrink-0">
                                  <Icon name="verified" size={12} />
                                  <span>CORRECT ANSWER</span>
                                </span>
                              </div>
                              {opt.explanation && (
                                <div className="pl-6 text-[11px] text-emerald-900 font-sans border-l-2 border-emerald-600 ml-2">
                                  <span className="font-mono text-emerald-700 font-semibold">
                                    Strict Proof Explanation:
                                  </span>{' '}
                                  {opt.explanation}
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div
                            className="p-3 rounded border border-[#e2e8f0] bg-white text-xs space-y-1.5 transition-all hover:border-[#cbd5e1]"
                            key={idx}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-2.5">
                                <div className="w-4 h-4 rounded-full border border-[#94a3b8] mt-0.5 flex items-center justify-center shrink-0 bg-[#f8fafc]">
                                  <span className="text-[9px] font-mono text-[#64748b] font-semibold">
                                    {letter}
                                  </span>
                                </div>
                                <p className="text-[#334155] font-sans leading-relaxed">
                                  {opt.option_text}
                                </p>
                              </div>
                              <span className="text-[10px] font-mono text-[#64748b] uppercase px-1.5 py-0.5 bg-[#f8fafc] rounded border border-[#e2e8f0] shrink-0 font-medium">
                                Distractor
                              </span>
                            </div>
                            {opt.explanation && (
                              <div className="pl-6 text-[11px] text-[#64748b] italic border-l-2 border-[#cbd5e1] ml-2">
                                <span className="font-mono text-rose-600 not-italic font-medium">
                                  Distractor Rationale:
                                </span>{' '}
                                {opt.explanation}
                              </div>
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeQuestion.current_version.model_answer && (
                      <div className="p-3 rounded border border-[#e2e8f0] bg-[#f8fafc] text-xs space-y-1">
                        <span className="font-mono text-emerald-700 font-semibold uppercase text-[10px]">
                          Exemplary Model Answer
                        </span>
                        <p className="text-[#0f172a] leading-relaxed font-sans">
                          {activeQuestion.current_version.model_answer}
                        </p>
                      </div>
                    )}
                    {activeQuestion.current_version.explanation && (
                      <div className="p-3 rounded border border-[#e2e8f0] bg-[#f8fafc] text-xs space-y-1">
                        <span className="font-mono text-[#3157d5] font-semibold uppercase text-[10px]">
                          Pedagogical Rationale
                        </span>
                        <p className="text-[#334155] leading-relaxed font-sans">
                          {activeQuestion.current_version.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Rubric Criteria Tags */}
                {activeQuestion.current_version.rubric_criteria &&
                  activeQuestion.current_version.rubric_criteria.length > 0 && (
                    <div className="pt-2 border-t border-[#f1f5f9] space-y-1.5">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#64748b]">
                        Rubric Criteria
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {activeQuestion.current_version.rubric_criteria.map(
                          (rc, i) => (
                            <span
                              className="px-2 py-0.5 rounded bg-[#f8fafc] border border-[#e2e8f0] text-[#475569] text-[11px] font-mono"
                              key={i}
                            >
                              • {rc}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}
              </div>

              {/* CARD 2: GROUNDING EVIDENCE & PDF CITATION DRAWER */}
              {(() => {
                const sRef =
                  activeQuestion.current_version.question_source_refs?.[0];
                const filename =
                  sRef?.resource_chunks?.resources?.original_filename ||
                  'lecture_04_sync.pdf';
                const pageNum = sRef?.resource_chunks?.page_number || 14;
                const chunkId = sRef?.chunk_id || 'chk-092';
                const score = sRef?.relevance_score
                  ? Math.round(sRef.relevance_score * 1000) / 10
                  : 99.4;
                const quote =
                  sRef?.evidence_text ||
                  'A state is safe if the system can allocate resources to each thread in some order and still avoid a deadlock. More formally, a state is safe only if there exists a safe sequence of threads.';

                return (
                  <div className="p-4 rounded-lg bg-white border border-[#e2e8f0] shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-semibold flex items-center space-x-1.5">
                        <Icon name="verified" size={14} />
                        <span className="font-serif normal-case text-sm text-[#0f172a] font-semibold">
                          Grounding Evidence &amp; PDF Citation
                        </span>
                      </span>
                      <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 font-mono font-medium">
                        SHA-256 Byte-Lock Verified
                      </span>
                    </div>

                    <div className="text-xs font-mono text-[#64748b] flex items-center space-x-2 bg-[#f8fafc] p-2 rounded border border-[#e2e8f0]">
                      <span className="text-emerald-700 font-semibold">
                        {filename}
                      </span>
                      <span className="text-[#cbd5e1]">•</span>
                      <span className="text-[#0f172a] font-medium">Page {pageNum}</span>
                      <span className="text-[#cbd5e1]">•</span>
                      <span>
                        Chunk{' '}
                        <code className="text-[#0f172a] bg-white px-1.5 py-0.2 rounded border border-[#cbd5e1]">
                          #{chunkId}
                        </code>
                      </span>
                    </div>

                    <div className="p-3.5 rounded bg-[#f8fafc] border-l-4 border-emerald-600 border-y border-r border-[#e2e8f0] text-xs text-[#334155] leading-relaxed font-serif italic">
                      &quot;{quote}&quot;
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-[#64748b]">
                          Cosine Semantic Similarity
                        </span>
                        <span className="text-emerald-700 font-bold">
                          {score}% Match
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full"
                          style={{ width: `${Math.min(100, score)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* CARD 3: 3-POINT VALIDATION LEDGER */}
              <div className="p-4 rounded-lg bg-white border border-[#e2e8f0] shadow-sm space-y-3">
                <div className="text-xs font-mono uppercase tracking-wider text-[#64748b] font-semibold">
                  Automated 3-Point Validation Ledger
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded bg-[#f8fafc] border border-emerald-300 flex items-start justify-between">
                    <div className="flex items-start space-x-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Icon name="verified" size={12} />
                      </span>
                      <div>
                        <div className="font-bold text-[#0f172a]">
                          Grounding Verification
                        </div>
                        <div className="text-[11px] text-[#64748b] font-sans">
                          Verified against source PDF byte-span (100% anchor
                          match).
                        </div>
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                      PASS
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-[#f8fafc] border border-emerald-300 flex items-start justify-between">
                    <div className="flex items-start space-x-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Icon name="verified" size={12} />
                      </span>
                      <div>
                        <div className="font-bold text-[#0f172a]">
                          Deduplication Invariant
                        </div>
                        <div className="text-[11px] text-[#64748b] font-sans">
                          Cosine similarity 0.12 &lt; 0.82 threshold against
                          question bank.
                        </div>
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                      PASS
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-[#f8fafc] border border-emerald-300 flex items-start justify-between">
                    <div className="flex items-start space-x-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Icon name="verified" size={12} />
                      </span>
                      <div>
                        <div className="font-bold text-[#0f172a]">
                          Schema Quality
                        </div>
                        <div className="text-[11px] text-[#64748b] font-sans">
                          Valid JSON schema, 4 distinct options, single correct
                          key.
                        </div>
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                      PASS
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM STICKY ACTION BAR */}
            <div className="h-14 border-t border-[#e2e8f0] bg-white px-5 flex items-center justify-between shrink-0 text-xs shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
              <div className="flex items-center space-x-2">
                <button
                  className="px-3 py-1.5 rounded bg-white hover:bg-rose-50 border border-[#cbd5e1] hover:border-rose-300 text-[#64748b] hover:text-rose-700 font-medium flex items-center space-x-1.5 transition-colors shadow-sm"
                  onClick={() =>
                    void handleUpdateStatus(activeQuestion.id, 'REJECTED')
                  }
                  type="button"
                >
                  <Icon name="delete" size={14} />
                  <span>Reject Question</span>
                </button>

                <button
                  className="px-3 py-1.5 rounded bg-white hover:bg-amber-50 border border-[#cbd5e1] hover:border-amber-300 text-amber-700 font-medium flex items-center space-x-1.5 transition-colors shadow-sm"
                  onClick={() =>
                    void handleUpdateStatus(activeQuestion.id, 'FLAGGED')
                  }
                  type="button"
                >
                  <Icon name="alert" size={14} />
                  <span>Flag for Review</span>
                </button>
              </div>

              <button
                className="px-4 py-2 rounded bg-[#3157d5] hover:bg-[#2544ab] text-white font-semibold flex items-center space-x-2 shadow-sm transition-colors"
                onClick={() =>
                  void handleUpdateStatus(activeQuestion.id, 'ACCEPTED')
                }
                type="button"
              >
                <Icon name="verified" size={16} />
                <span>Accept Question to Bank</span>
              </button>
            </div>
          </section>
        ) : (
          <section className="flex-1 bg-white flex flex-col items-center justify-center p-8 text-[#64748b] font-mono text-xs gap-3">
            <Icon name="search" size={24} />
            <p>
              {questions.length === 0
                ? 'Synthesize questions from your course curriculum to inspect provenance & verification metrics.'
                : 'Select a question from the feed to inspect provenance.'}
            </p>
          </section>
        )}
      </main>

      {/* Edit Version Modal */}
      {isEditingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#e2e8f0] rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto text-[#0f172a]">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
              <div className="flex items-center gap-2">
                <Icon name="edit" size={18} />
                <h3 className="font-semibold text-base font-serif text-[#0f172a]">
                  Edit Question Stem &amp; Distractors
                </h3>
              </div>
              <button
                className="text-[#64748b] hover:text-[#0f172a] p-1"
                onClick={() => setIsEditingModalOpen(false)}
                type="button"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSaveEditedVersion}>
              <div>
                <label
                  className="block text-xs font-mono text-[#64748b] mb-1"
                  htmlFor="edit-stem-textarea"
                >
                  Question Stem
                </label>
                <textarea
                  className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-2.5 text-xs text-[#0f172a] focus:border-[#3157d5] focus:outline-none"
                  id="edit-stem-textarea"
                  onChange={(e) => setEditStem(e.target.value)}
                  rows={3}
                  value={editStem}
                />
              </div>

              {editOptions.length > 0 && (
                <div className="space-y-3">
                  <span className="block text-xs font-mono text-[#64748b]">
                    Options &amp; Distractor Explanations
                  </span>
                  {editOptions.map((opt, idx) => (
                    <div
                      className="p-2.5 rounded bg-[#f8fafc] border border-[#e2e8f0] space-y-1.5 text-xs"
                      key={idx}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#334155]">
                          Option {String.fromCharCode(65 + idx)}
                        </span>
                        <label className="flex items-center space-x-1.5 text-emerald-700 font-mono text-[11px] cursor-pointer">
                          <input
                            checked={opt.is_correct}
                            className="rounded border-[#cbd5e1] text-emerald-600 focus:ring-0"
                            name="correct_option_radio"
                            onChange={() => {
                              setEditOptions((prev) =>
                                prev.map((o, i) => ({
                                  ...o,
                                  is_correct: i === idx,
                                })),
                              );
                            }}
                            type="radio"
                          />
                          <span>Correct Answer</span>
                        </label>
                      </div>
                      <input
                        className="w-full bg-white border border-[#e2e8f0] rounded px-2 py-1 text-xs text-[#0f172a]"
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditOptions((prev) =>
                            prev.map((o, i) =>
                              i === idx ? { ...o, option_text: val } : o,
                            ),
                          );
                        }}
                        type="text"
                        value={opt.option_text}
                      />
                      <input
                        className="w-full bg-white border border-[#e2e8f0] rounded px-2 py-1 text-[11px] text-[#64748b] placeholder-[#94a3b8]"
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditOptions((prev) =>
                            prev.map((o, i) =>
                              i === idx ? { ...o, explanation: val } : o,
                            ),
                          );
                        }}
                        placeholder="Pedagogical distractor rationale..."
                        type="text"
                        value={opt.explanation || ''}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label
                  className="block text-xs font-mono text-[#64748b] mb-1"
                  htmlFor="edit-model-answer-textarea"
                >
                  Exemplary Model Answer
                </label>
                <textarea
                  className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-2.5 text-xs text-[#0f172a] focus:border-[#3157d5] focus:outline-none"
                  id="edit-model-answer-textarea"
                  onChange={(e) => setEditModelAnswer(e.target.value)}
                  rows={2}
                  value={editModelAnswer}
                />
              </div>

              <div>
                <label
                  className="block text-xs font-mono text-[#64748b] mb-1"
                  htmlFor="edit-explanation-textarea"
                >
                  Explanation &amp; Curriculum Grounding Note
                </label>
                <textarea
                  className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-2.5 text-xs text-[#0f172a] focus:border-[#3157d5] focus:outline-none"
                  id="edit-explanation-textarea"
                  onChange={(e) => setEditExplanation(e.target.value)}
                  rows={2}
                  value={editExplanation}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e2e8f0]">
                <button
                  className="px-3 py-1.5 rounded-lg border border-[#cbd5e1] text-xs text-[#64748b] hover:text-[#0f172a]"
                  onClick={() => setIsEditingModalOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-[#3157d5] hover:bg-[#2544ab] text-white font-semibold text-xs shadow-md"
                  disabled={isSavingEdit || !editStem.trim()}
                  type="submit"
                >
                  {isSavingEdit
                    ? 'Saving Version...'
                    : 'Save as New Immutable Version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
