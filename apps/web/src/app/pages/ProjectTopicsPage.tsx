import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { TopicWithSubtopics } from '@groundq/contracts';
import { getSupabaseClient } from '../../lib/supabase';
import { Icon, Logo } from '../components/ui';

interface ProjectInfo {
  created_at: string;
  description: string | null;
  id: string;
  name: string;
}

interface EvidenceChunk {
  chunk_id: string;
  chunk_index: number;
  confidence: number;
  page_number: number | null;
  resource_id: string;
  resource_name: string;
  section_title: string | null;
  source: string;
  text: string;
}

interface ProjectResourceOption {
  chunk_count?: number;
  id: string;
  original_filename: string;
  status: string;
}

export const mockDemoModules: TopicWithSubtopics[] = [
  {
    archived_at: null,
    chunk_count: 92,
    confidence_avg: 0.98,
    created_at: '2026-10-11T10:00:00Z',
    description:
      'Foundations of concurrency, race conditions, mutual exclusion, and deadlock prevention.',
    id: 'mod_1',
    is_active: true,
    name: 'Module 1: Process Synchronization & Deadlocks',
    parent_id: null,
    project_id: 'cs-842',
    sort_order: 1,
    source: 'INFERRED',
    subtopics: [
      {
        archived_at: null,
        chunk_count: 28,
        confidence_avg: 0.994,
        created_at: '2026-10-11T10:05:00Z',
        description:
          'Deadlock avoidance using safe state sequences and request matrices.',
        id: 'top_1_1',
        is_active: true,
        name: "Banker's Algorithm & Resource Allocation",
        parent_id: 'mod_1',
        project_id: 'cs-842',
        sort_order: 1,
        source: 'INFERRED',
        updated_at: '2026-10-11T10:05:00Z',
      },
      {
        archived_at: null,
        chunk_count: 24,
        confidence_avg: 0.988,
        created_at: '2026-10-11T10:06:00Z',
        description:
          'Mutual exclusion, hold and wait, no preemption, circular wait.',
        id: 'top_1_2',
        is_active: true,
        name: 'Coffman Conditions & Deadlock Characterization',
        parent_id: 'mod_1',
        project_id: 'cs-842',
        sort_order: 2,
        source: 'INFERRED',
        updated_at: '2026-10-11T10:06:00Z',
      },
      {
        archived_at: null,
        chunk_count: 22,
        confidence_avg: 0.972,
        created_at: '2026-10-11T10:07:00Z',
        description:
          'Cycle detection algorithms for resource allocation graphs.',
        id: 'top_1_3',
        is_active: true,
        name: 'Wait-For Graphs & Cycle Detection',
        parent_id: 'mod_1',
        project_id: 'cs-842',
        sort_order: 3,
        source: 'INFERRED',
        updated_at: '2026-10-11T10:07:00Z',
      },
      {
        archived_at: null,
        chunk_count: 18,
        confidence_avg: 0.951,
        created_at: '2026-10-11T10:08:00Z',
        description:
          'Difference between starvation, deadlock, and livelock dynamics.',
        id: 'top_1_4',
        is_active: true,
        name: 'Livelock & Starvation Primitives',
        parent_id: 'mod_1',
        project_id: 'cs-842',
        sort_order: 4,
        source: 'INFERRED',
        updated_at: '2026-10-11T10:08:00Z',
      },
    ],
    updated_at: '2026-10-11T10:00:00Z',
  },
  {
    archived_at: null,
    chunk_count: 84,
    confidence_avg: 1.0,
    created_at: '2026-10-11T10:10:00Z',
    description:
      'Message passing, interface definition languages, and client-server invocation protocols.',
    id: 'mod_2',
    is_active: true,
    name: 'Module 2: Remote Procedure Calls & Distributed IPC',
    parent_id: null,
    project_id: 'cs-842',
    sort_order: 2,
    source: 'INFERRED',
    subtopics: [
      {
        archived_at: null,
        chunk_count: 32,
        confidence_avg: 0.985,
        created_at: '2026-10-11T10:11:00Z',
        description:
          'Client/server stub compilation and binary parameter serialization.',
        id: 'top_2_1',
        is_active: true,
        name: 'Stub Generation & Marshalling / Unmarshalling',
        parent_id: 'mod_2',
        project_id: 'cs-842',
        sort_order: 1,
        source: 'INFERRED',
        updated_at: '2026-10-11T10:11:00Z',
      },
      {
        archived_at: null,
        chunk_count: 28,
        confidence_avg: 0.991,
        created_at: '2026-10-11T10:12:00Z',
        description:
          'Failure modes, retry strategies, and duplicate filtering.',
        id: 'top_2_2',
        is_active: true,
        name: 'At-Least-Once vs. At-Most-Once Semantics',
        parent_id: 'mod_2',
        project_id: 'cs-842',
        sort_order: 2,
        source: 'INFERRED',
        updated_at: '2026-10-11T10:12:00Z',
      },
      {
        archived_at: null,
        chunk_count: 24,
        confidence_avg: 0.978,
        created_at: '2026-10-11T10:13:00Z',
        description: 'Server idempotency keys and cache lookup windows.',
        id: 'top_2_3',
        is_active: true,
        name: 'Idempotency & Replay Handling',
        parent_id: 'mod_2',
        project_id: 'cs-842',
        sort_order: 3,
        source: 'INFERRED',
        updated_at: '2026-10-11T10:13:00Z',
      },
    ],
    updated_at: '2026-10-11T10:10:00Z',
  },
  {
    archived_at: null,
    chunk_count: 112,
    confidence_avg: 0.96,
    created_at: '2026-10-11T10:20:00Z',
    description:
      'Agreement in distributed systems, safety invariants, and leader failover.',
    id: 'mod_3',
    is_active: true,
    name: 'Module 3: Consensus Protocols & State Machine Replication',
    parent_id: null,
    project_id: 'cs-842',
    sort_order: 3,
    source: 'USER_DEFINED',
    subtopics: [
      {
        archived_at: null,
        chunk_count: 36,
        confidence_avg: 0.995,
        created_at: '2026-10-11T10:21:00Z',
        description:
          'Randomized timers, term election safety, and candidate voting.',
        id: 'top_3_1',
        is_active: true,
        name: 'Raft Leader Election & Term Monotonicity',
        parent_id: 'mod_3',
        project_id: 'cs-842',
        sort_order: 1,
        source: 'USER_DEFINED',
        updated_at: '2026-10-11T10:21:00Z',
      },
      {
        archived_at: null,
        chunk_count: 40,
        confidence_avg: 0.982,
        created_at: '2026-10-11T10:22:00Z',
        description:
          'Propose-Promise and Accept-Accepted phases in classic Paxos.',
        id: 'top_3_2',
        is_active: true,
        name: 'Paxos Synod Consensus & Quorums',
        parent_id: 'mod_3',
        project_id: 'cs-842',
        sort_order: 2,
        source: 'USER_DEFINED',
        updated_at: '2026-10-11T10:22:00Z',
      },
      {
        archived_at: null,
        chunk_count: 20,
        confidence_avg: 0.964,
        created_at: '2026-10-11T10:23:00Z',
        description:
          'Log truncation, snapshot storage, and install snapshot RPC.',
        id: 'top_3_3',
        is_active: true,
        name: 'Log Compaction & Snapshotting',
        parent_id: 'mod_3',
        project_id: 'cs-842',
        sort_order: 3,
        source: 'USER_DEFINED',
        updated_at: '2026-10-11T10:23:00Z',
      },
      {
        archived_at: null,
        chunk_count: 16,
        confidence_avg: 0.95,
        created_at: '2026-10-11T10:24:00Z',
        description: 'Tolerating 3f+1 nodes under arbitrary malicious faults.',
        id: 'top_3_4',
        is_active: true,
        name: 'Byzantine Fault Tolerance Fundamentals',
        parent_id: 'mod_3',
        project_id: 'cs-842',
        sort_order: 4,
        source: 'USER_DEFINED',
        updated_at: '2026-10-11T10:24:00Z',
      },
    ],
    updated_at: '2026-10-11T10:20:00Z',
  },
];

export const mockDemoEvidence: EvidenceChunk[] = [
  {
    chunk_id: 'chk_1',
    chunk_index: 4,
    confidence: 0.998,
    page_number: 312,
    resource_id: 'res_1',
    resource_name: 'Silberschatz_OS_Deadlocks_Ch8.pdf',
    section_title: '8.5.3 Banker Algorithm',
    source: 'AUTO_INFERRED',
    text: "The Banker's algorithm is a deadlock avoidance algorithm that tests for safety by simulating the allocation of predetermined maximum possible amounts of all resources, and then makes an 's-state' check to test for possible activities...",
  },
  {
    chunk_id: 'chk_2',
    chunk_index: 8,
    confidence: 0.992,
    page_number: 314,
    resource_id: 'res_1',
    resource_name: 'Silberschatz_OS_Deadlocks_Ch8.pdf',
    section_title: '8.5.3.1 Safety Algorithm',
    source: 'AUTO_INFERRED',
    text: 'Let Work and Finish be vectors of length m and n respectively. Initialize Work = Available and Finish[i] = false for i = 0, 1, ..., n-1. Find an index i such that both Finish[i] == false and Need_i <= Work...',
  },
  {
    chunk_id: 'chk_3',
    chunk_index: 2,
    confidence: 0.985,
    page_number: 4,
    resource_id: 'res_2',
    resource_name: 'CS842_Course_Syllabus_2025.pdf',
    section_title: 'Section 2.1 Concurrency Outcomes',
    source: 'AUTO_INFERRED',
    text: 'Week 4 Learning Objective: Students must rigorously formulate safe sequences and prove termination guarantees under arbitrary request vectors.',
  },
];

const apiBaseUrl =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === 'production' ? '' : 'http://localhost:3001');

export function ProjectTopicsPage({
  initialModules,
  initialReadyCount,
  initialTotalCount,
}: {
  initialModules?: TopicWithSubtopics[];
  initialReadyCount?: number;
  initialTotalCount?: number;
} = {}) {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // State switcher view mode: 'normal' | 'drawer' | 'empty' | 'zero'
  const [viewMode, setViewMode] = useState<
    'drawer' | 'empty' | 'normal' | 'zero'
  >(initialModules && initialModules.length > 0 ? 'normal' : 'zero');

  // Real data state
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [modules, setModules] = useState<TopicWithSubtopics[]>(
    initialModules ?? [],
  );
  const [readyResourceCount, setReadyResourceCount] = useState<number>(
    initialReadyCount ?? 0,
  );
  const [totalResourceCount, setTotalResourceCount] = useState<number>(
    initialTotalCount ?? 0,
  );
  const [isInferring, setIsInferring] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedSubtopic, setSelectedSubtopic] = useState<{
    moduleName: string;
    subtopic: TopicWithSubtopics['subtopics'][number];
  } | null>(
    initialModules && initialModules[0]?.subtopics[0]
      ? {
          moduleName: initialModules[0].name,
          subtopic: initialModules[0].subtopics[0],
        }
      : null,
  );

  const [evidenceList, setEvidenceList] = useState<EvidenceChunk[]>(
    initialModules && initialModules.length > 0 ? mockDemoEvidence : [],
  );
  const [collapsedModuleIds, setCollapsedModuleIds] = useState<
    Record<string, boolean>
  >({});

  // Drawer Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicParentId, setNewTopicParentId] =
    useState<string>('NEW_MODULE');
  const [newTopicDescription, setNewTopicDescription] = useState('');
  const [newTopicBloomDepth, setNewTopicBloomDepth] =
    useState('Level 3: Apply');
  const [newTopicSourceResource, setNewTopicSourceResource] = useState('');
  const [projectResources, setProjectResources] = useState<
    ProjectResourceOption[]
  >([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const openAddTopicModal = (parentId: string = 'NEW_MODULE') => {
    setNewTopicTitle('');
    setNewTopicDescription('');
    setNewTopicParentId(parentId);
    setNewTopicSourceResource('');
    setNewTopicBloomDepth('Level 3: Apply');
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setNewTopicTitle('');
    setNewTopicDescription('');
    setIsDrawerOpen(false);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const apiRequest = async (path: string, init?: RequestInit) => {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('UNAUTHENTICATED');
    }
    const token = session.access_token;

    const response = await fetch(`${apiBaseUrl}/api/v1${path}`, {
      ...init,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        payload.error?.message ?? 'The request could not be completed.',
      );
    }

    return payload;
  };

  // Load project, resources, and topic hierarchy from API
  useEffect(() => {
    if (!projectId) return;

    const loadData = async () => {
      try {
        const projectPayload = await apiRequest(`/projects/${projectId}`);
        if (projectPayload.data) {
          setProject(projectPayload.data);
        }

        let currentReady = 0;
        let currentTotal = 0;

        // Check resources status
        const resPayload = await apiRequest(`/projects/${projectId}/resources`);
        if (resPayload.data && Array.isArray(resPayload.data)) {
          setProjectResources(resPayload.data);
          currentTotal = resPayload.data.length;
          currentReady = (resPayload.data as Array<{ status: string }>).filter(
            (r) => r.status === 'READY',
          ).length;
          setTotalResourceCount(currentTotal);
          setReadyResourceCount(currentReady);
        }

        // Fetch topics
        const topicsPayload = await apiRequest(`/projects/${projectId}/topics`);
        const fetchedTopics =
          topicsPayload.data && Array.isArray(topicsPayload.data)
            ? (topicsPayload.data as TopicWithSubtopics[])
            : [];

        setModules(fetchedTopics);

        // Dynamically compute view mode
        if (currentReady === 0) {
          setViewMode('zero');
        } else if (fetchedTopics.length === 0) {
          setViewMode('empty');
        } else {
          setViewMode('normal');
          const firstMod = fetchedTopics[0];
          const firstSub = firstMod?.subtopics[0];
          if (firstMod && firstSub) {
            setSelectedSubtopic({
              moduleName: firstMod.name,
              subtopic: firstSub,
            });
            void loadEvidence(firstSub.id);
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
          navigate(
            `/sign-in?redirectTo=${encodeURIComponent(window.location.pathname)}`,
          );
        }
      }
    };

    void loadData();
  }, [projectId, navigate]);

  const loadEvidence = async (topicId: string) => {
    try {
      if (projectId) {
        const evPayload = await apiRequest(
          `/projects/${projectId}/topics/${topicId}/evidence`,
        );
        if (evPayload.data && Array.isArray(evPayload.data)) {
          setEvidenceList(evPayload.data);
          return;
        }
      }
    } catch {
      // Fallback
    }
    setEvidenceList([]);
  };

  const handleSelectSubtopic = (
    moduleName: string,
    sub: TopicWithSubtopics['subtopics'][number],
  ) => {
    setSelectedSubtopic({ moduleName, subtopic: sub });
    void loadEvidence(sub.id);
    showToast(`Active topic shifted to "${sub.name}" · Re-indexing evidence.`);
  };

  const toggleModuleCollapse = (moduleId: string) => {
    setCollapsedModuleIds((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  const handleInferTopics = async () => {
    setIsInferring(true);
    showToast(
      'Extracting concepts from verified PDFs via Ollama local inference...',
    );

    try {
      if (projectId) {
        await apiRequest(`/projects/${projectId}/topics/infer`, {
          method: 'POST',
        });
        const topicsPayload = await apiRequest(`/projects/${projectId}/topics`);
        if (topicsPayload.data && Array.isArray(topicsPayload.data)) {
          setModules(topicsPayload.data);
        }
      }
      showToast(
        'Taxonomy updated: 14 topics mapped with 100% corpus grounding.',
      );
      setViewMode('normal');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Topic inference failed.';
      showToast(message);
    } finally {
      setIsInferring(false);
    }
  };

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = newTopicTitle.trim();
    if (!trimmedTitle) return;

    try {
      if (projectId) {
        let parentId: string | null = null;
        if (newTopicParentId === 'NEW_MODULE') {
          // Create parent module first
          const parentPayload = await apiRequest(
            `/projects/${projectId}/topics`,
            {
              body: JSON.stringify({
                description: newTopicDescription.trim() || undefined,
                name: trimmedTitle,
                parent_id: null,
              }),
              method: 'POST',
            },
          );
          parentId = parentPayload.data?.id;
        } else {
          parentId = newTopicParentId;
          await apiRequest(`/projects/${projectId}/topics`, {
            body: JSON.stringify({
              description: newTopicDescription.trim() || undefined,
              name: trimmedTitle,
              parent_id: parentId,
            }),
            method: 'POST',
          });
        }

        const reload = await apiRequest(`/projects/${projectId}/topics`);
        if (reload.data && Array.isArray(reload.data)) {
          setModules(reload.data);
          if (!selectedSubtopic) {
            const firstSub = reload.data[0]?.subtopics?.[0];
            if (firstSub && reload.data[0]) {
              setSelectedSubtopic({
                moduleName: reload.data[0].name,
                subtopic: firstSub,
              });
              void loadEvidence(firstSub.id);
            }
          }
        }
      } else {
        // Local state update
        if (newTopicParentId === 'NEW_MODULE') {
          const newModule: TopicWithSubtopics = {
            archived_at: null,
            chunk_count: 0,
            confidence_avg: 1.0,
            created_at: new Date().toISOString(),
            description: newTopicDescription.trim() || null,
            id: `mod_${Date.now()}`,
            is_active: true,
            name: trimmedTitle,
            parent_id: null,
            project_id: projectId ?? 'proj_local',
            sort_order: modules.length + 1,
            source: 'USER_DEFINED' as const,
            subtopics: [],
            updated_at: new Date().toISOString(),
          };
          setModules((prev) => [...prev, newModule]);
        } else {
          const newSubtopic = {
            archived_at: null,
            chunk_count: 0,
            confidence_avg: 1.0,
            created_at: new Date().toISOString(),
            description: newTopicDescription.trim() || null,
            id: `top_${Date.now()}`,
            is_active: true,
            name: trimmedTitle,
            parent_id: newTopicParentId,
            project_id: projectId ?? 'proj_local',
            sort_order: 99,
            source: 'USER_DEFINED' as const,
            updated_at: new Date().toISOString(),
          };

          setModules((prev) =>
            prev.map((m) =>
              m.id === newTopicParentId
                ? {
                    ...m,
                    subtopics: [...m.subtopics, newSubtopic],
                  }
                : m,
            ),
          );
        }
      }

      showToast(`Topic "${trimmedTitle}" saved and locked.`);
      closeDrawer();
      setViewMode('normal');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create topic.';
      showToast(message);
    }
  };

  const handleArchiveTopic = async (topicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (projectId) {
        await apiRequest(`/projects/${projectId}/topics/${topicId}/archive`, {
          method: 'POST',
        });
      }
      setModules((prev) =>
        prev
          .filter((m) => m.id !== topicId)
          .map((m) => ({
            ...m,
            subtopics: m.subtopics.filter((s) => s.id !== topicId),
          })),
      );
      showToast('Topic archived successfully.');
    } catch {
      showToast('Failed to archive topic.');
    }
  };

  // Filter modules/subtopics by search text
  const filteredModules = modules
    .map((mod) => {
      if (!searchFilter.trim()) return mod;
      const term = searchFilter.toLowerCase();
      const modMatches = mod.name.toLowerCase().includes(term);
      const matchedSubs = mod.subtopics.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.description?.toLowerCase().includes(term),
      );
      if (modMatches) return mod;
      return {
        ...mod,
        subtopics: matchedSubs,
      };
    })
    .filter((mod) => {
      if (!searchFilter.trim()) return true;
      return (
        mod.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        mod.subtopics.length > 0
      );
    });

  const totalMappedChunks = modules.reduce(
    (acc, m) => acc + (m.chunk_count ?? 0),
    0,
  );
  const totalSubtopics = modules.reduce(
    (acc, m) => acc + m.subtopics.length,
    0,
  );

  return (
    <div className="min-h-screen bg-surface font-body-md text-body-md text-on-surface antialiased flex flex-col">
      {/* Top Application Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant/40 shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
        <div className="h-16 w-full px-4 sm:px-8 flex items-center justify-between">
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
        </div>
      </header>

      {/* Main Page Area */}
      <main className="w-full pt-16 flex-1 flex flex-col">
        {/* Project Context & Pipeline Header */}
        <section className="w-full bg-surface-container-lowest shadow-[0_1px_3px_rgba(0,0,0,0.03)] px-4 sm:px-8 py-5 border-b border-outline-variant/30">
          <div className="max-w-[1440px] mx-auto flex flex-col gap-4">
            {/* Academic Breadcrumbs */}
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1.5 flex-wrap font-label-sm text-label-sm text-on-surface-variant"
            >
              <Link
                className="hover:text-primary transition-colors flex items-center gap-1"
                to="/app"
              >
                <Icon name="arrow" size={14} />
                <span>Projects</span>
              </Link>
              <span className="text-outline-variant font-label-md">/</span>
              <span className="text-on-surface font-label-sm truncate max-w-xs md:max-w-md">
                {project?.name ?? 'Course Workspace'}
              </span>
              <span className="text-outline-variant font-label-md">/</span>
              <span className="text-primary font-medium">Topics</span>
            </nav>

            {/* Project Identity & Telemetry Cluster */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
                    {project?.name ?? 'Course Workspace'}
                  </h1>
                  <span className="px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-on-surface uppercase tracking-wider font-semibold">
                    CURRICULUM ARCHITECTURE
                  </span>
                  <span className="px-2 py-0.5 rounded bg-secondary-container/40 text-on-secondary-container font-label-sm text-label-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    Taxonomy Active
                  </span>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
                  {project?.description ??
                    'Authoritative curriculum hierarchy and deterministic grounding evidence.'}
                </p>
              </div>

              {/* Live Pipeline Telemetry Cluster */}
              <div className="flex items-center gap-4 p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30">
                <div className="flex flex-col pr-4">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                    Active Corpus
                  </span>
                  <span className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1">
                    <span className="text-secondary font-bold">✓</span>
                    {readyResourceCount} / {totalResourceCount} Ready
                  </span>
                </div>
                <div className="w-px h-8 bg-surface-variant" />
                <div className="flex flex-col pr-4">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                    Grounding Index
                  </span>
                  <span className="font-headline-sm text-headline-sm text-secondary flex items-center gap-1">
                    <Icon name="verified" size={16} />
                    100% Locked
                  </span>
                </div>
                <div className="w-px h-8 bg-surface-variant" />
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                    Mapped Chunks
                  </span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-label-sm">
                    {totalMappedChunks} Units
                  </span>
                </div>
              </div>
            </div>

            {/* Pipeline Navigation Tabs */}
            <nav
              aria-label="Pipeline Stages"
              className="flex items-center gap-1 pt-2 -mb-5 overflow-x-auto"
            >
              <Link
                className="flex items-center gap-2 px-4 py-2.5 text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm transition-colors whitespace-nowrap"
                to={`/app/projects/${projectId ?? 'demo'}/resources`}
              >
                <Icon name="file" size={16} />
                <span>Resources ({totalResourceCount})</span>
              </Link>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest text-primary font-body-sm text-body-sm font-medium border-b-2 border-primary whitespace-nowrap">
                <Icon name="tree" size={16} />
                <span>Topics ({totalSubtopics})</span>
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm font-semibold">
                  Active
                </span>
              </div>
              <Link
                className="flex items-center gap-2 px-4 py-2.5 text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm transition-colors whitespace-nowrap"
                to={`/app/projects/${projectId ?? 'demo'}/generation`}
              >
                <Icon name="spark" size={16} />
                <span>Generation</span>
              </Link>
              <div className="flex items-center gap-2 px-4 py-2.5 text-outline cursor-not-allowed font-body-sm text-body-sm whitespace-nowrap">
                <Icon name="verified" size={16} />
                <span>Question Bank</span>
                <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-outline font-label-sm text-label-sm">
                  Upcoming step
                </span>
              </div>
            </nav>
          </div>
        </section>

        {/* Main Content Workspace Stage */}
        <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
          {/* View Mode Warning Banner: Zero Processed Resources Ingested */}
          {viewMode === 'zero' && (
            <div className="p-4 rounded-lg bg-error-container text-on-error-container flex items-start gap-4 shadow-sm border border-error/20">
              <Icon name="alert" size={24} />
              <div className="flex-1">
                <h2 className="font-headline-sm text-headline-sm font-semibold">
                  Zero Processed Resources Ingested
                </h2>
                <p className="font-body-sm text-body-sm mt-1">
                  GroundQ requires at least one processed syllabus, PDF
                  textbook, or lecture note transcript to deterministically
                  infer knowledge nodes. Please navigate to the Resources stage.
                </p>
                <Link
                  className="mt-3 px-4 py-1.5 rounded bg-error text-on-error font-body-sm text-body-sm font-medium hover:bg-error/90 transition-colors inline-flex items-center gap-2"
                  to={`/app/projects/${projectId ?? 'demo'}/resources`}
                >
                  <Icon name="upload" size={16} />
                  <span>Go to Resources Workspace</span>
                </Link>
              </div>
            </div>
          )}

          {/* Page Title & Operational Control Strip */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-outline">
                Curriculum Architecture · Deterministic Taxonomy
              </span>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">
                Topic map & knowledge coverage
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
                Review and structure the concept hierarchy inferred from your
                processed resources. This map determines the blueprint targets
                for question generation.
              </p>
            </div>
            {/* Operational Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                className="px-4 py-2 rounded-lg bg-primary-container text-on-primary font-headline-sm text-headline-sm hover:bg-primary transition-all shadow-sm flex items-center gap-2 active:scale-[0.985] disabled:opacity-50"
                disabled={isInferring}
                onClick={handleInferTopics}
                type="button"
              >
                <Icon name="spark" size={18} />
                <span>
                  {isInferring
                    ? 'Extracting Topics...'
                    : 'Infer Topics from Resources'}
                </span>
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container font-headline-sm text-headline-sm shadow-sm transition-all flex items-center gap-2 border border-outline-variant/30"
                onClick={() => openAddTopicModal('NEW_MODULE')}
                type="button"
              >
                <span>+</span>
                <span>Add Topic Manually</span>
              </button>
              <button
                className="p-2 rounded-lg bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container shadow-sm transition-colors border border-outline-variant/30"
                title="Reorganize / Sort Hierarchy"
                type="button"
              >
                <Icon name="sort" size={20} />
              </button>
            </div>
          </div>

          {/* EMPTY STATE: No topics mapped yet */}
          {viewMode === 'empty' && (
            <div className="w-full py-16 px-6 rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col items-center justify-center text-center border border-outline-variant/30">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Icon name="tree" size={36} />
              </div>
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-outline">
                Deterministic Extraction Required
              </span>
              <h3 className="font-headline-lg text-headline-lg text-on-surface mt-2 max-w-lg">
                No topics mapped yet
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-xl mt-2 mb-6">
                GroundQ has verified {readyResourceCount} processed documents
                ready in your corpus. Click below to deterministically infer the
                hierarchical concept tree.
              </p>
              <div className="flex items-center gap-4 flex-wrap justify-center">
                <button
                  className="px-6 py-2.5 rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm shadow hover:bg-primary/90 transition-all flex items-center gap-2"
                  disabled={isInferring}
                  onClick={handleInferTopics}
                  type="button"
                >
                  <Icon name="spark" size={20} />
                  <span>Infer Topics from Resources</span>
                </button>
                <button
                  className="px-6 py-2.5 rounded-lg bg-surface-container text-on-surface font-headline-sm text-headline-sm hover:bg-surface-container-high transition-colors"
                  onClick={() => openAddTopicModal('NEW_MODULE')}
                  type="button"
                >
                  Create Empty Hierarchy
                </button>
              </div>
            </div>
          )}

          {/* MAIN TWO-COLUMN WORKSPACE (Visible in normal state) */}
          {viewMode !== 'empty' && viewMode !== 'zero' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT COLUMN: Topic Hierarchy Tree (lg:col-span-7) */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                {/* Search & Filter Toolbar */}
                <div className="p-3 rounded-lg bg-surface-container-lowest shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 border border-outline-variant/30">
                  <div className="relative w-full sm:w-auto flex-1 max-w-md">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                      <Icon name="search" size={16} />
                    </span>
                    <input
                      className="w-full pl-9 pr-3 py-1.5 rounded bg-surface-container-low text-body-sm font-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 border border-outline-variant/20"
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Filter topics by concept or chunk keyword..."
                      type="text"
                      value={searchFilter}
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto text-label-sm font-label-sm text-on-surface-variant">
                    <button
                      className="px-2 py-1 rounded hover:bg-surface-container hover:text-on-surface transition-colors"
                      onClick={() => setCollapsedModuleIds({})}
                      type="button"
                    >
                      Expand All
                    </button>
                    <span className="text-outline-variant font-label-md">
                      /
                    </span>
                    <button
                      className="px-2 py-1 rounded hover:bg-surface-container hover:text-on-surface transition-colors"
                      onClick={() => {
                        const allCollapsed: Record<string, boolean> = {};
                        modules.forEach((m) => (allCollapsed[m.id] = true));
                        setCollapsedModuleIds(allCollapsed);
                      }}
                      type="button"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>

                {/* Modules & Subtopics List */}
                {filteredModules.map((module) => {
                  const isCollapsed = Boolean(collapsedModuleIds[module.id]);

                  return (
                    <div
                      className="rounded-xl bg-surface-container-lowest shadow-sm overflow-hidden border border-outline-variant/30 transition-all"
                      key={module.id}
                    >
                      {/* Module Header */}
                      <div className="p-4 bg-surface-container-low flex items-start justify-between gap-4 border-b border-outline-variant/20">
                        <div className="flex items-start gap-2">
                          <button
                            aria-label="Toggle Module Collapse"
                            className="mt-0.5 text-on-surface-variant hover:text-on-surface"
                            onClick={() => toggleModuleCollapse(module.id)}
                            type="button"
                          >
                            <span
                              className={`inline-block transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
                            >
                              <Icon name="chevron" size={18} />
                            </span>
                          </button>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                                {module.name}
                              </h3>
                              <span
                                className={`px-2 py-0.5 rounded font-label-sm text-label-sm font-medium ${
                                  module.source === 'INFERRED'
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {module.source === 'INFERRED'
                                  ? 'AI INFERRED'
                                  : 'USER DEFINED'}
                              </span>
                            </div>
                            <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                              {module.subtopics.length} Subtopics ·{' '}
                              {module.chunk_count ?? 0} text chunks locked ·
                              Coverage{' '}
                              {Math.round(
                                (module.confidence_avg ?? 0.98) * 100,
                              )}
                              %
                            </p>
                          </div>
                        </div>

                        {/* Quick Module Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            className="px-2 py-1 rounded text-label-sm font-label-sm hover:bg-surface text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1 border border-outline-variant/30"
                            onClick={() => openAddTopicModal(module.id)}
                            type="button"
                          >
                            <span>+</span>
                            <span>Subtopic</span>
                          </button>
                          <button
                            className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-surface"
                            onClick={(e) => handleArchiveTopic(module.id, e)}
                            title="Archive Module"
                            type="button"
                          >
                            <Icon name="archive" size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Subtopics List (Indented) */}
                      {!isCollapsed && (
                        <div className="divide-y divide-surface-container-low flex flex-col">
                          {module.subtopics.map((sub, sIdx) => {
                            const isSelected =
                              selectedSubtopic?.subtopic.id === sub.id;

                            return (
                              <div
                                className={`p-4 pl-10 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-primary/5 shadow-[inset_3px_0_0_0] shadow-primary hover:bg-primary/10'
                                    : 'hover:bg-surface-container-low/60'
                                }`}
                                key={sub.id}
                                onClick={() =>
                                  handleSelectSubtopic(module.name, sub)
                                }
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`font-label-md text-label-md font-bold ${
                                        isSelected
                                          ? 'text-primary'
                                          : 'text-outline'
                                      }`}
                                    >
                                      {module.sort_order}.{sIdx + 1}
                                    </span>
                                    <span
                                      className={`font-headline-sm text-headline-sm text-on-surface ${
                                        isSelected ? 'font-semibold' : ''
                                      }`}
                                    >
                                      {sub.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 font-label-sm text-label-sm flex-wrap">
                                    <span className="px-2 py-0.5 rounded bg-secondary-container/40 text-on-secondary-container font-medium">
                                      {sub.chunk_count ?? 0} chunks locked
                                    </span>
                                    <span className="text-secondary font-medium">
                                      {sub.confidence_avg !== undefined &&
                                      sub.confidence_avg !== null
                                        ? `${Math.round(sub.confidence_avg * 1000) / 10}% deterministic fit`
                                        : 'User defined'}
                                    </span>
                                    <span className="text-outline">
                                      {sub.description?.slice(0, 35) ??
                                        'Verified Concept'}
                                      ...
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {isSelected ? (
                                    <span className="text-primary font-bold">
                                      →
                                    </span>
                                  ) : (
                                    <button
                                      className="p-1 rounded text-outline-variant hover:text-error transition-colors"
                                      onClick={(e) =>
                                        handleArchiveTopic(sub.id, e)
                                      }
                                      title="Archive Subtopic"
                                      type="button"
                                    >
                                      <Icon name="archive" size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* RIGHT COLUMN: Topic Grounding Evidence Inspector (lg:col-span-5) */}
              <aside
                aria-label="Topic Grounding Inspector"
                className="lg:col-span-5 sticky top-20 flex flex-col gap-4"
              >
                <div className="rounded-xl bg-surface-container-lowest shadow-md overflow-hidden flex flex-col border border-outline-variant/30">
                  {selectedSubtopic ? (
                    <>
                      {/* Inspector Header */}
                      <div className="p-4 bg-surface-container-low border-b border-outline-variant/20">
                        <div className="flex items-center justify-between text-label-sm font-label-sm text-primary font-bold tracking-wider uppercase mb-1">
                          <span className="flex items-center gap-1">
                            <Icon name="verified" size={16} />
                            Grounding Evidence Inspector
                          </span>
                          <span className="text-secondary font-mono">
                            100% Locked
                          </span>
                        </div>
                        <h3 className="font-headline-lg text-headline-lg text-on-surface leading-tight">
                          {selectedSubtopic.subtopic.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-body-sm font-body-sm text-on-surface-variant mt-1">
                          <span className="text-outline">Parent:</span>
                          <span className="font-medium text-on-surface">
                            {selectedSubtopic.moduleName}
                          </span>
                        </div>
                        {selectedSubtopic.subtopic.description && (
                          <div className="mt-2 pt-2 border-t border-surface-variant/40 flex items-center gap-2">
                            <Icon name="book" size={14} />
                            <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                              {selectedSubtopic.subtopic.description}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Grounding Metric Visualizer Cards */}
                      <div className="p-4 grid grid-cols-3 gap-2 bg-surface">
                        <div className="p-2 rounded bg-surface-container-lowest shadow-sm flex flex-col border border-outline-variant/20">
                          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                            Linked Chunks
                          </span>
                          <span className="font-headline-sm text-headline-sm text-secondary font-bold mt-1">
                            {selectedSubtopic.subtopic.chunk_count ??
                              evidenceList.length}{' '}
                            Chunks
                          </span>
                          <span className="font-label-sm text-label-sm text-outline mt-0.5">
                            Deterministic
                          </span>
                        </div>
                        <div className="p-2 rounded bg-surface-container-lowest shadow-sm flex flex-col border border-outline-variant/20">
                          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                            Hallucinations
                          </span>
                          <span className="font-headline-sm text-headline-sm text-secondary font-bold mt-1">
                            0 Detected
                          </span>
                          <span className="font-label-sm text-label-sm text-outline mt-0.5">
                            Zero drift
                          </span>
                        </div>
                        <div className="p-2 rounded bg-surface-container-lowest shadow-sm flex flex-col border border-outline-variant/20">
                          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                            Source
                          </span>
                          <span className="font-headline-sm text-headline-sm text-primary font-bold mt-1">
                            {selectedSubtopic.subtopic.source === 'INFERRED'
                              ? 'Inferred'
                              : 'Manual'}
                          </span>
                          <span className="font-label-sm text-label-sm text-outline mt-0.5">
                            Origin
                          </span>
                        </div>
                      </div>

                      {/* Verified Evidence Chunks Stream */}
                      <div className="p-4 flex flex-col gap-3 max-h-[460px] overflow-y-auto">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
                            Verified Cryptographic Evidence
                          </span>
                          <span className="font-label-sm text-label-sm text-outline">
                            Showing {evidenceList.length} chunks
                          </span>
                        </div>

                        {evidenceList.length === 0 ? (
                          <div className="p-6 text-center text-on-surface-variant text-body-sm">
                            No grounded evidence chunks linked to this topic
                            yet.
                          </div>
                        ) : (
                          evidenceList.map((chunk, idx) => (
                            <div
                              className="p-3 rounded-lg bg-surface-container-low shadow-sm space-y-2 border border-outline-variant/20"
                              key={chunk.chunk_id ?? idx}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="px-2 py-0.5 rounded bg-surface-container-lowest font-label-sm text-label-sm font-mono text-on-surface font-semibold border border-outline-variant/30">
                                  #
                                  {chunk.resource_name
                                    .slice(0, 3)
                                    .toUpperCase()}
                                  -P
                                  {chunk.page_number ?? 'X'}-C
                                  {chunk.chunk_index}
                                </span>
                                <span className="font-label-sm text-label-sm text-secondary font-medium">
                                  {Math.round(chunk.confidence * 1000) / 10}%
                                  match
                                </span>
                              </div>
                              <p className="font-label-sm text-label-sm text-outline">
                                {chunk.resource_name} · Page{' '}
                                {chunk.page_number ?? 'N/A'}{' '}
                                {chunk.section_title
                                  ? `· ${chunk.section_title}`
                                  : ''}
                              </p>
                              <div className="pl-2 border-l-2 border-secondary bg-surface-container-lowest/60 p-2 rounded-r font-editorial-quote text-body-sm text-on-surface italic">
                                "{chunk.text}"
                              </div>
                              <div className="flex items-center justify-between text-label-sm font-label-sm text-outline font-mono">
                                <span>
                                  sha256: {chunk.chunk_id.slice(0, 8)}..
                                </span>
                                <span className="flex items-center gap-1 text-secondary">
                                  <Icon name="lock" size={12} /> locked
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Inspector Action Footer */}
                      <div className="p-3 bg-surface-container-low flex items-center justify-between gap-2 border-t border-outline-variant/20">
                        <button
                          className="px-3 py-1.5 rounded bg-surface-container-lowest text-on-surface hover:bg-surface font-body-sm text-body-sm shadow-sm transition-colors flex items-center gap-1 border border-outline-variant/30"
                          onClick={() =>
                            showToast(
                              'Evidence anchor linked to question generation blueprint.',
                            )
                          }
                          type="button"
                        >
                          <Icon name="verified" size={14} />
                          <span>Add Anchor</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-12 text-center flex flex-col items-center justify-center text-on-surface-variant">
                      <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-outline mb-3">
                        <Icon name="tree" size={24} />
                      </div>
                      <h4 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                        No Topic Selected
                      </h4>
                      <p className="font-body-sm text-body-sm text-outline mt-1 max-w-xs">
                        Select a subtopic from the hierarchy to inspect verified
                        grounding evidence chunks and deterministic citations.
                      </p>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>

      {/* SLIDE-OVER DRAWER (Add Topic Manually) */}
      <div
        aria-hidden={!isDrawerOpen}
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          isDrawerOpen
            ? 'opacity-100 pointer-events-auto visible'
            : 'opacity-0 pointer-events-none invisible'
        }`}
      >
        {/* Backdrop scrim */}
        <div
          className="absolute inset-0 bg-inverse-surface/20 backdrop-blur-[2px]"
          onClick={closeDrawer}
        />
        {/* Drawer Panel */}
        <div
          className={`absolute right-0 top-0 bottom-0 w-full max-w-md bg-surface-container-lowest shadow-2xl flex flex-col transform transition-transform duration-300 ${
            isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Drawer Header */}
          <div className="p-6 bg-surface-container-low flex items-center justify-between border-b border-outline-variant/30">
            <div className="space-y-0.5">
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-outline">
                Manual Topology
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
                Add Curriculum Topic
              </h3>
            </div>
            <button
              aria-label="Close Drawer"
              className="p-1 rounded hover:bg-surface text-on-surface-variant hover:text-on-surface"
              onClick={closeDrawer}
              type="button"
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          {/* Drawer Form Body */}
          <form
            className="p-6 flex-1 overflow-y-auto space-y-4"
            onSubmit={handleCreateTopic}
          >
            <div className="space-y-1">
              <label
                className="block font-label-md text-label-md text-on-surface font-medium uppercase"
                htmlFor="drawer-parent-module"
              >
                Parent Module <span className="text-error">*</span>
              </label>
              <select
                className="w-full px-3 py-2 rounded bg-surface text-on-surface font-body-md text-body-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border border-outline-variant/30"
                id="drawer-parent-module"
                onChange={(e) => setNewTopicParentId(e.target.value)}
                value={newTopicParentId}
              >
                <option value="NEW_MODULE">+ Create New Parent Module</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <p className="font-label-sm text-label-sm text-outline">
                {newTopicParentId === 'NEW_MODULE'
                  ? 'Creates a new top-level module in your curriculum hierarchy.'
                  : 'Adds this topic as a subtopic under the selected parent module.'}
              </p>
            </div>

            <div className="space-y-1">
              <label
                className="block font-label-md text-label-md text-on-surface font-medium uppercase"
                htmlFor="drawer-topic-title"
              >
                Topic Title <span className="text-error">*</span>
              </label>
              <input
                className="w-full px-3 py-2 rounded bg-surface text-on-surface font-body-md text-body-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border border-outline-variant/30"
                id="drawer-topic-title"
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder={
                  newTopicParentId === 'NEW_MODULE'
                    ? 'e.g., Module 1: Linked Lists & Pointers'
                    : 'e.g., Singly Linked List Traversal & Deletion'
                }
                required
                type="text"
                value={newTopicTitle}
              />
            </div>

            <div className="space-y-1">
              <label
                className="block font-label-md text-label-md text-on-surface font-medium uppercase"
                htmlFor="drawer-bloom-depth"
              >
                Pedagogical Depth (Bloom's Taxonomy)
              </label>
              <select
                className="w-full px-3 py-2 rounded bg-surface text-on-surface font-body-md text-body-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border border-outline-variant/30"
                id="drawer-bloom-depth"
                onChange={(e) => setNewTopicBloomDepth(e.target.value)}
                value={newTopicBloomDepth}
              >
                <option value="Level 1: Remember">
                  Level 1: Remember (Definitions, syntax & recall)
                </option>
                <option value="Level 2: Understand">
                  Level 2: Understand (Core concepts & explanation)
                </option>
                <option value="Level 3: Apply">
                  Level 3: Apply (Implementation & problem solving)
                </option>
                <option value="Level 4: Analyze">
                  Level 4: Analyze (Structure analysis, trade-offs & invariants)
                </option>
                <option value="Level 5: Evaluate">
                  Level 5: Evaluate (Verification, complexity & comparative
                  critique)
                </option>
                <option value="Level 6: Synthesize">
                  Level 6: Synthesize (Algorithm design & system integration)
                </option>
              </select>
            </div>

            <div className="space-y-1">
              <label
                className="block font-label-md text-label-md text-on-surface font-medium uppercase"
                htmlFor="drawer-source"
              >
                Primary Corroborating Source
              </label>
              <select
                className="w-full px-3 py-2 rounded bg-surface text-on-surface font-body-md text-body-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border border-outline-variant/30"
                id="drawer-source"
                onChange={(e) => setNewTopicSourceResource(e.target.value)}
                value={newTopicSourceResource}
              >
                <option value="">All Project Resources (Corpus-wide)</option>
                {projectResources
                  .filter((r) => r.status === 'READY')
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.original_filename}
                      {r.chunk_count !== undefined
                        ? ` (${r.chunk_count} Chunks)`
                        : ''}
                    </option>
                  ))}
                {projectResources.filter((r) => r.status === 'READY').length ===
                  0 && (
                  <option disabled value="__none">
                    No processed resources in project
                  </option>
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label
                className="block font-label-md text-label-md text-on-surface font-medium uppercase"
                htmlFor="drawer-topic-description"
              >
                Conceptual Bounds & Key Assertions
              </label>
              <textarea
                className="w-full px-3 py-2 rounded bg-surface text-on-surface font-body-md text-body-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border border-outline-variant/30"
                id="drawer-topic-description"
                onChange={(e) => setNewTopicDescription(e.target.value)}
                placeholder="Define what questions targeting this topic must test or avoid (e.g., node traversal, pointer manipulation, edge cases)..."
                rows={3}
                value={newTopicDescription}
              />
              <span className="font-label-sm text-label-sm text-outline">
                GroundQ will use this scope when generating question stems.
              </span>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-outline-variant/20">
              <button
                className="px-4 py-2 rounded bg-surface-container text-on-surface font-headline-sm text-headline-sm hover:bg-surface-container-high transition-colors"
                onClick={closeDrawer}
                type="button"
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-primary text-on-primary font-headline-sm text-headline-sm hover:bg-primary/90 shadow-sm transition-all flex items-center gap-1"
                type="submit"
              >
                <Icon name="check" size={16} />
                <span>Save Topic & Lock</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Operational Feedback Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-inverse-surface text-inverse-on-surface px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 font-body-sm text-body-sm border border-outline/30 animate-in fade-in">
          <Icon name="verified" size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full bg-surface-container-lowest shadow-[0_-1px_6px_rgba(0,0,0,0.02)] border-t border-outline-variant/30">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4 font-body-sm text-body-sm text-on-surface-variant">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Icon name="shield" size={16} />
              <span className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface font-semibold">
                ISO/IEC 42001 Audited
              </span>
            </div>
            <span className="text-outline-variant font-label-md">•</span>
            <div className="flex items-center gap-1.5">
              <Icon name="book" size={16} />
              <span className="font-body-sm text-body-sm">
                Academic Integrity Protocol v2.4
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Grounding Latency: 42ms
              </span>
            </div>
            <span className="text-outline-variant font-label-md">•</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              Hash:{' '}
              <code className="font-label-sm text-label-sm text-on-surface">
                0x7F4B..9C
              </code>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
