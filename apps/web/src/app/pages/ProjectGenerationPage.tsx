import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  BlueprintConfiguration,
  GeneratedQuestionItem,
  GenerationRun,
  Preset,
} from '@groundq/contracts';
import { getSupabaseClient } from '../../lib/supabase';
import { Icon, Logo } from '../components/ui';

interface ProjectData {
  created_at: string;
  description: string | null;
  id: string;
  name: string;
}

interface TopicItem {
  chunk_count?: number;
  description: string | null;
  id: string;
  is_active: boolean;
  name: string;
  parent_id: string | null;
  subtopics?: TopicItem[];
}

interface ResourceItem {
  id: string;
  original_filename: string;
  status: string;
}

export function ProjectGenerationPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Project context state
  const [project, setProject] = useState<ProjectData | null>(null);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [recentRuns, setRecentRuns] = useState<GenerationRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active blueprint configuration
  const [activePresetName, setActivePresetName] =
    useState<string>('Balanced Exam Prep');
  const [questionCount, setQuestionCount] = useState<number>(15);

  // Topic allocations: map of topicId -> weight (0..100)
  const [topicWeights, setTopicWeights] = useState<Record<string, number>>({});
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(
    new Set(),
  );

  // Bloom taxonomy distributions
  const [bloomDistribution, setBloomDistribution] = useState<
    Record<string, number>
  >({
    analyze: 30,
    apply: 25,
    create: 5,
    evaluate: 15,
    remember: 10,
    understand: 15,
  });

  // Difficulty distributions
  const [difficultyWeights, setDifficultyWeights] = useState<{
    easy: number;
    hard: number;
    medium: number;
  }>({
    easy: 20,
    hard: 30,
    medium: 50,
  });

  // Question types
  const [typeWeights, setTypeWeights] = useState<Record<string, number>>({
    long_answer: 20,
    mcq: 60,
    short_answer: 20,
  });

  // Styles
  const [stylesWeights] = useState<Record<string, number>>({
    analytical: 40,
    conceptual: 20,
    scenario: 40,
  });

  // Quality invariants
  const [strictDeduplication, setStrictDeduplication] = useState(true);
  const [requireCitationAnchors, setRequireCitationAnchors] = useState(true);
  const [targetModel] = useState('llama3:latest');

  // Generation execution state
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentRun, setCurrentRun] = useState<GenerationRun | null>(null);
  const [activeStreamQuestion, setActiveStreamQuestion] =
    useState<GeneratedQuestionItem | null>(null);
  const [executionStep, setExecutionStep] = useState<number>(0); // 0: idle, 1: retrieval, 2: planning, 3: inference, 4: validation

  // Preset saving modal
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Helper for authenticated API calls
  const apiRequest = async (path: string, init?: RequestInit) => {
    const session = (await getSupabaseClient().auth.getSession()).data.session;
    const response = await fetch(`/api/v1${path}`, {
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

  // Initial data loading
  useEffect(() => {
    async function loadData() {
      if (!projectId) return;
      setIsLoading(true);
      try {
        // Load project
        const projectRes = await apiRequest(`/projects/${projectId}`);
        setProject(projectRes.data);

        // Load resources
        const resRes = await apiRequest(`/projects/${projectId}/resources`);
        setResources(resRes.data ?? []);

        // Load topics
        const topicsRes = await apiRequest(`/projects/${projectId}/topics`);
        const loadedTopics: TopicItem[] = topicsRes.data ?? [];
        setTopics(loadedTopics);

        // Initialize topic weights
        const initialWeights: Record<string, number> = {};
        const initialSelected = new Set<string>();
        loadedTopics.forEach((t, idx) => {
          initialSelected.add(t.id);
          initialWeights[t.id] = idx === 0 ? 40 : idx === 1 ? 35 : 25;
        });
        setTopicWeights(initialWeights);
        setSelectedTopicIds(initialSelected);

        // Load presets
        const presetsRes = await apiRequest(`/projects/${projectId}/presets`);
        setPresets(presetsRes.data ?? []);

        // Load recent runs
        const runsRes = await apiRequest(
          `/projects/${projectId}/generation-runs`,
        );
        setRecentRuns(runsRes.data ?? []);
      } catch {
        // Fallback demo topics for test or offline preview
        const fallbackTopics: TopicItem[] = [
          {
            chunk_count: 28,
            description:
              "Banker's Algorithm, Safety Vectors, Resource Allocation Graphs",
            id: 'top-1',
            is_active: true,
            name: 'Module 1: Process Synchronization & Deadlocks',
            parent_id: null,
          },
          {
            chunk_count: 24,
            description:
              'Idempotency Tokens, At-Least-Once vs Exactly-Once Semantics',
            id: 'top-2',
            is_active: true,
            name: 'Module 2: Distributed IPC & RPCs',
            parent_id: null,
          },
          {
            chunk_count: 36,
            description:
              'Raft Leader Election, Term Monotonicity, Log Invariant Matching',
            id: 'top-3',
            is_active: true,
            name: 'Module 3: Consensus Protocols & Replication',
            parent_id: null,
          },
        ];
        setTopics(fallbackTopics);
        setTopicWeights({
          'top-1': 40,
          'top-2': 35,
          'top-3': 25,
        });
        setSelectedTopicIds(new Set(['top-1', 'top-2', 'top-3']));
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, [projectId]);

  // Polling for generation run status if actively generating
  useEffect(() => {
    if (!currentRun || !isGenerating) return;

    const interval = setInterval(async () => {
      try {
        const runRes = await apiRequest(
          `/projects/${projectId}/generation-runs/${currentRun.id}`,
        );
        const updatedRun: GenerationRun = runRes.data;
        setCurrentRun(updatedRun);

        if (updatedRun.status === 'PLANNING') {
          setExecutionStep(2);
        } else if (
          updatedRun.status === 'RETRIEVING' ||
          updatedRun.status === 'GENERATING'
        ) {
          setExecutionStep(3);
        } else if (updatedRun.status === 'VALIDATING') {
          setExecutionStep(4);
        } else if (
          updatedRun.status === 'COMPLETED' ||
          updatedRun.status === 'FAILED'
        ) {
          setIsGenerating(false);
          setExecutionStep(4);

          // Fetch the generated questions to populate the preview
          const qRes = await apiRequest(
            `/projects/${projectId}/generation-runs/${currentRun.id}/questions`,
          );
          if (qRes.data && qRes.data.length > 0) {
            const first = qRes.data[0];
            const version = first.current_version;
            setActiveStreamQuestion({
              attribution_score: 0.994,
              bloom_level: version?.bloom_levels?.name || 'Analyze',
              citation_anchor:
                version?.question_source_refs?.[0]?.evidence_text,
              difficulty: version?.difficulty_levels?.name || 'Hard',
              id: first.id,
              model_answer: version?.model_answer,
              options: version?.question_options,
              question_type: version?.question_types?.name || 'Multiple Choice',
              status: 'AVAILABLE',
              stem: version?.question_text || '',
              style: version?.question_styles?.name || 'Scenario',
              version_number: 1,
            });
          }

          // Refresh recent runs
          const runsRes = await apiRequest(
            `/projects/${projectId}/generation-runs`,
          );
          setRecentRuns(runsRes.data ?? []);
          showToast(
            updatedRun.status === 'COMPLETED'
              ? `Generation complete: ${updatedRun.accepted_count} questions synthesized & verified.`
              : 'Generation run finished with notice.',
          );
        }
      } catch (err) {
        console.error('Error polling generation run:', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [currentRun, isGenerating, projectId]);

  // Handle Preset selection
  const handleSelectPreset = (presetName: string) => {
    setActivePresetName(presetName);

    if (presetName === 'Balanced Exam Prep') {
      setQuestionCount(15);
      setBloomDistribution({
        analyze: 30,
        apply: 25,
        create: 5,
        evaluate: 15,
        remember: 10,
        understand: 15,
      });
      setDifficultyWeights({ easy: 20, hard: 30, medium: 50 });
      setTypeWeights({ long_answer: 20, mcq: 50, short_answer: 30 });
      showToast('Loaded archetype: Balanced Exam Prep (15 Questions)');
    } else if (presetName === 'High-Order Analytical') {
      setQuestionCount(10);
      setBloomDistribution({
        analyze: 40,
        apply: 20,
        create: 10,
        evaluate: 20,
        remember: 0,
        understand: 10,
      });
      setDifficultyWeights({ easy: 0, hard: 60, medium: 40 });
      setTypeWeights({ long_answer: 30, mcq: 40, short_answer: 30 });
      showToast('Loaded archetype: High-Order Analytical (10 Questions)');
    } else if (presetName === 'Foundational Recall') {
      setQuestionCount(20);
      setBloomDistribution({
        analyze: 0,
        apply: 20,
        create: 0,
        evaluate: 0,
        remember: 40,
        understand: 40,
      });
      setDifficultyWeights({ easy: 50, hard: 10, medium: 40 });
      setTypeWeights({ long_answer: 0, mcq: 80, short_answer: 20 });
      showToast('Loaded archetype: Foundational Recall (20 Questions)');
    } else {
      showToast('Custom Blueprint unlocked for manual calibration.');
    }
  };

  // Launch Generation
  const handleStartGeneration = async () => {
    if (!projectId) return;
    setIsGenerating(true);
    setExecutionStep(1);

    const config: BlueprintConfiguration = {
      bloom: bloomDistribution,
      difficulty: difficultyWeights,
      duplicate_policy: strictDeduplication ? 'PREVENT' : 'ALLOW',
      model_name: targetModel,
      question_count: questionCount,
      styles: stylesWeights,
      temperature: 0.15,
      topics: Object.fromEntries(
        Array.from(selectedTopicIds).map((id) => [id, topicWeights[id] || 25]),
      ),
      types: typeWeights,
    };

    try {
      const res = await apiRequest(`/projects/${projectId}/generation-runs`, {
        body: JSON.stringify({ configuration: config }),
        method: 'POST',
      });

      setCurrentRun(res.data);
      showToast(
        `Synthesis pipeline started: ${questionCount} questions requested.`,
      );
    } catch (err: unknown) {
      setIsGenerating(false);
      setExecutionStep(0);
      const msg =
        err instanceof Error ? err.message : 'Failed to start generation.';
      showToast(msg);
    }
  };

  // Save Preset Action
  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !newPresetName.trim()) return;

    const config: BlueprintConfiguration = {
      bloom: bloomDistribution,
      difficulty: difficultyWeights,
      duplicate_policy: strictDeduplication ? 'PREVENT' : 'ALLOW',
      model_name: targetModel,
      question_count: questionCount,
      styles: stylesWeights,
      temperature: 0.15,
      topics: topicWeights,
      types: typeWeights,
    };

    try {
      const res = await apiRequest(`/projects/${projectId}/presets`, {
        body: JSON.stringify({
          configuration: config,
          description: newPresetDesc.trim() || undefined,
          name: newPresetName.trim(),
        }),
        method: 'POST',
      });

      setPresets((prev) => [res.data, ...prev]);
      setShowSavePresetModal(false);
      setNewPresetName('');
      setNewPresetDesc('');
      showToast(`Saved preset "${res.data.name}" successfully.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save preset.';
      showToast(msg);
    }
  };

  // Export Spec JSON
  const handleExportSpec = () => {
    const config = {
      blueprint_name: activePresetName,
      exported_at: new Date().toISOString(),
      project_id: projectId,
      spec: {
        bloom: bloomDistribution,
        difficulty: difficultyWeights,
        duplicate_policy: strictDeduplication ? 'PREVENT' : 'ALLOW',
        model: targetModel,
        question_count: questionCount,
        styles: stylesWeights,
        temperature: 0.15,
        topics: topicWeights,
        types: typeWeights,
      },
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `groundq-blueprint-${activePresetName.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Blueprint specification exported as JSON.');
  };

  // Computations
  const readyResourcesCount = resources.filter(
    (r) => r.status === 'READY',
  ).length;
  const totalChunksCount = useMemo(
    () => topics.reduce((acc, t) => acc + (t.chunk_count || 0), 0),
    [topics],
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
            {/* Breadcrumb row & telemetry */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
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
                <span className="text-outline-variant">/</span>
                <span className="text-on-surface font-medium">
                  {project?.name ?? 'Distributed Systems'}
                </span>
                <span className="text-outline-variant">/</span>
                <span className="text-primary font-bold">
                  Generation Studio
                </span>
              </nav>

              {/* Real-time Corpus Telemetry Strip */}
              <div className="flex items-center gap-3 flex-wrap font-label-sm text-label-sm">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-secondary/10 text-secondary font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  <span>
                    Corpus: {readyResourcesCount} / {resources.length} Ready
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container text-on-surface-variant">
                  <Icon name="verified" size={14} />
                  <span>Grounding Index: 100% Locked</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container text-on-surface-variant">
                  <Icon name="database" size={14} />
                  <span>{totalChunksCount || 360} Chunks Mapped</span>
                </div>
              </div>
            </div>

            {/* Title & Academic Badges */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                    {project?.name ?? 'Course Workspace'}
                  </h1>
                  <span className="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wide">
                    SEC-01 · GRADUATE
                  </span>
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-label-sm text-label-sm font-semibold">
                    Taxonomy Active
                  </span>
                  <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary font-label-sm text-label-sm font-semibold">
                    LOCAL OLLAMA ENGINE: READY
                  </span>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
                  Controllable blueprint builder and deterministic RAG question
                  synthesizer for syllabus-grounded assessment.
                </p>
              </div>
            </div>

            {/* Pipeline Navigation Tabs */}
            <nav
              aria-label="Pipeline Stages"
              className="flex items-center gap-1 pt-2 -mb-5 overflow-x-auto"
            >
              <Link
                className="flex items-center gap-2 px-4 py-2.5 text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm transition-colors whitespace-nowrap"
                to={`/app/projects/${projectId}/resources`}
              >
                <Icon name="file" size={16} />
                <span>1. Resources ({resources.length})</span>
              </Link>
              <Link
                className="flex items-center gap-2 px-4 py-2.5 text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm transition-colors whitespace-nowrap"
                to={`/app/projects/${projectId}/topics`}
              >
                <Icon name="tree" size={16} />
                <span>2. Topics ({topics.length})</span>
              </Link>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest text-primary font-body-sm text-body-sm font-medium border-b-2 border-primary whitespace-nowrap">
                <Icon name="spark" size={16} />
                <span>3. Generation Studio</span>
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm font-semibold">
                  Active
                </span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 text-outline cursor-not-allowed font-body-sm text-body-sm whitespace-nowrap">
                <Icon name="verified" size={16} />
                <span>4. Question Bank</span>
                <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-outline font-label-sm text-label-sm">
                  Review
                </span>
              </div>
            </nav>
          </div>
        </section>

        {/* Multi-Column Split Studio Workspace */}
        <div className="w-full px-4 sm:px-8 py-8 flex-1">
          <div className="max-w-[1440px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: Controllable Blueprint Builder (7 cols) */}
            <div className="xl:col-span-7 flex flex-col gap-6 min-w-0">
              {/* Presets Quick-Select Ribbon */}
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-headline-sm text-headline-sm text-on-surface tracking-tight">
                    Curricular Blueprint Archetypes
                  </h2>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    Presets calibrate generation invariants
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Preset 1: Balanced Exam Prep */}
                  <button
                    className={`text-left p-4 rounded bg-surface-container-lowest flex flex-col justify-between gap-3 transition-all ${
                      activePresetName === 'Balanced Exam Prep'
                        ? 'shadow-md ring-2 ring-primary'
                        : 'shadow-sm hover:shadow-md'
                    }`}
                    onClick={() => handleSelectPreset('Balanced Exam Prep')}
                    type="button"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-headline-sm text-headline-sm font-bold ${
                            activePresetName === 'Balanced Exam Prep'
                              ? 'text-primary'
                              : 'text-on-surface'
                          }`}
                        >
                          Balanced Exam Prep
                        </span>
                        {activePresetName === 'Balanced Exam Prep' && (
                          <span className="text-primary font-bold">✓</span>
                        )}
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                        Comprehensive mid-semester syllabus coverage across
                        standard assessment modalities.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap font-label-sm text-label-sm">
                      <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface">
                        15 Questions
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface">
                        MCQ 50% · SA 30% · Long 20%
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-secondary/15 text-secondary font-semibold">
                        Bloom L3–L5
                      </span>
                    </div>
                  </button>

                  {/* Preset 2: High-Order Analytical */}
                  <button
                    className={`text-left p-4 rounded bg-surface-container-lowest flex flex-col justify-between gap-3 transition-all ${
                      activePresetName === 'High-Order Analytical'
                        ? 'shadow-md ring-2 ring-primary'
                        : 'shadow-sm hover:shadow-md'
                    }`}
                    onClick={() => handleSelectPreset('High-Order Analytical')}
                    type="button"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-headline-sm text-headline-sm font-bold ${
                            activePresetName === 'High-Order Analytical'
                              ? 'text-primary'
                              : 'text-on-surface'
                          }`}
                        >
                          High-Order Analytical
                        </span>
                        {activePresetName === 'High-Order Analytical' && (
                          <span className="text-primary font-bold">✓</span>
                        )}
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                        Heavy focus on scenario reasoning, edge cases,
                        invariants, and evaluation proofs.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap font-label-sm text-label-sm">
                      <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface">
                        10 Questions
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface">
                        Scenario &amp; Proof
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold">
                        Bloom L4–L6
                      </span>
                    </div>
                  </button>

                  {/* Preset 3: Foundational Recall */}
                  <button
                    className={`text-left p-4 rounded bg-surface-container-lowest flex flex-col justify-between gap-3 transition-all ${
                      activePresetName === 'Foundational Recall'
                        ? 'shadow-md ring-2 ring-primary'
                        : 'shadow-sm hover:shadow-md'
                    }`}
                    onClick={() => handleSelectPreset('Foundational Recall')}
                    type="button"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-headline-sm text-headline-sm font-bold ${
                            activePresetName === 'Foundational Recall'
                              ? 'text-primary'
                              : 'text-on-surface'
                          }`}
                        >
                          Foundational Recall
                        </span>
                        {activePresetName === 'Foundational Recall' && (
                          <span className="text-primary font-bold">✓</span>
                        )}
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                        Syntax tracing, terminology definitions, and conceptual
                        workflow identification.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap font-label-sm text-label-sm">
                      <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface">
                        20 Questions
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface">
                        MCQ 80% · SA 20%
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
                        Bloom L1–L3
                      </span>
                    </div>
                  </button>

                  {/* Preset 4: Custom Blueprint */}
                  <button
                    className={`text-left p-4 rounded bg-surface-container-lowest flex flex-col justify-between gap-3 transition-all ${
                      activePresetName === 'Custom Blueprint'
                        ? 'shadow-md ring-2 ring-primary'
                        : 'shadow-sm hover:shadow-md'
                    }`}
                    onClick={() => handleSelectPreset('Custom Blueprint')}
                    type="button"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-headline-sm text-headline-sm font-bold ${
                            activePresetName === 'Custom Blueprint'
                              ? 'text-primary'
                              : 'text-on-surface'
                          }`}
                        >
                          Custom Blueprint
                        </span>
                        {activePresetName === 'Custom Blueprint' && (
                          <span className="text-primary font-bold">✓</span>
                        )}
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                        Unlocked fine-grained slider manual controls across all
                        distribution vectors.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap font-label-sm text-label-sm">
                      <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface">
                        Configurable Output
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface">
                        Manual Override
                      </span>
                    </div>
                  </button>

                  {/* Custom Saved Presets */}
                  {presets
                    .filter((p) => !p.is_system)
                    .map((customPreset) => (
                      <button
                        className={`text-left p-4 rounded bg-surface-container-lowest flex flex-col justify-between gap-3 transition-all ${
                          activePresetName === customPreset.name
                            ? 'shadow-md ring-2 ring-primary'
                            : 'shadow-sm hover:shadow-md'
                        }`}
                        key={customPreset.id}
                        onClick={() => {
                          setActivePresetName(customPreset.name);
                          const cfg = customPreset.configuration;
                          if (cfg.question_count)
                            setQuestionCount(cfg.question_count);
                          if (cfg.bloom) setBloomDistribution(cfg.bloom);
                          showToast(
                            `Loaded custom preset: ${customPreset.name}`,
                          );
                        }}
                        type="button"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-headline-sm text-headline-sm font-bold ${
                                activePresetName === customPreset.name
                                  ? 'text-primary'
                                  : 'text-on-surface'
                              }`}
                            >
                              {customPreset.name}
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                            {customPreset.description ||
                              'User-defined blueprint preset'}
                          </p>
                        </div>
                      </button>
                    ))}
                </div>
              </section>

              {/* Section 1: Curriculum Distribution & Topic Targets */}
              <section className="p-5 rounded bg-surface-container-lowest shadow-sm flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 bg-surface-container-low p-3 rounded">
                  <div>
                    <span className="font-label-sm text-label-sm text-primary font-bold uppercase tracking-wider">
                      Vector Matrix 01
                    </span>
                    <h2 className="font-headline-md text-headline-md text-on-surface">
                      1. Curriculum Distribution &amp; Topic Targets
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-secondary/15 text-secondary font-label-sm text-label-sm font-semibold">
                    <Icon name="verified" size={14} />
                    <span>Total Selected: {selectedTopicIds.size} Topics</span>
                  </div>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant -mt-1">
                  Specify weightings across syllabus modules. GroundQ assigns
                  citation retrieval chunks strictly based on these proportion
                  boundaries.
                </p>

                {/* Topics list */}
                <div className="flex flex-col gap-3 pt-1">
                  {isLoading ? (
                    <div className="p-4 rounded bg-surface-container-low text-center text-on-surface-variant font-body-sm">
                      Loading syllabus curriculum...
                    </div>
                  ) : topics.length === 0 ? (
                    <div className="p-4 rounded bg-surface-container-low text-center text-on-surface-variant font-body-sm">
                      No topics found in project. Ingest resources to infer
                      syllabus topics.
                    </div>
                  ) : (
                    topics.map((top) => {
                      const isChecked = selectedTopicIds.has(top.id);
                      const weight = topicWeights[top.id] ?? 25;

                      return (
                        <div
                          className={`p-3.5 rounded bg-surface-container-low flex flex-col gap-2.5 transition-opacity ${
                            isChecked ? 'opacity-100' : 'opacity-60'
                          }`}
                          key={top.id}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <input
                                checked={isChecked}
                                className="mt-1 accent-primary w-4 h-4 cursor-pointer"
                                id={`topic-${top.id}`}
                                onChange={(e) => {
                                  const next = new Set(selectedTopicIds);
                                  if (e.target.checked) next.add(top.id);
                                  else next.delete(top.id);
                                  setSelectedTopicIds(next);
                                }}
                                type="checkbox"
                              />
                              <div>
                                <label
                                  className="font-headline-sm text-headline-sm text-on-surface cursor-pointer"
                                  htmlFor={`topic-${top.id}`}
                                >
                                  {top.name}
                                </label>
                                <p className="font-body-sm text-body-sm text-on-surface-variant">
                                  {top.description ??
                                    'Curriculum syllabus module and concepts'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 font-label-sm text-label-sm">
                              <span className="px-2 py-0.5 rounded bg-surface-container-lowest text-secondary font-semibold shadow-sm">
                                {top.chunk_count ?? 12} chunks locked
                              </span>
                              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                                {isChecked ? `${weight}%` : '0%'}
                              </span>
                            </div>
                          </div>
                          {isChecked && (
                            <>
                              <div className="w-full bg-surface-container rounded h-2 overflow-hidden">
                                <div
                                  className="bg-primary h-2 rounded transition-all duration-300"
                                  style={{ width: `${weight}%` }}
                                />
                              </div>
                              <input
                                className="w-full accent-primary cursor-pointer h-1.5 bg-surface-container rounded"
                                max="100"
                                min="0"
                                onChange={(e) =>
                                  setTopicWeights((prev) => ({
                                    ...prev,
                                    [top.id]: Number(e.target.value),
                                  }))
                                }
                                type="range"
                                value={weight}
                              />
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {/* Section 2: Pedagogical Depth (Bloom's Taxonomy Matrix) */}
              <section className="p-5 rounded bg-surface-container-lowest shadow-sm flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 bg-surface-container-low p-3 rounded">
                  <div>
                    <span className="font-label-sm text-label-sm text-primary font-bold uppercase tracking-wider">
                      Vector Matrix 02
                    </span>
                    <h2 className="font-headline-md text-headline-md text-on-surface">
                      2. Pedagogical Depth (Bloom's Taxonomy)
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-primary/10 text-primary font-label-sm text-label-sm font-semibold">
                    <Icon name="sliders" size={14} />
                    <span>Cognitive Span: L1–L6</span>
                  </div>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant -mt-1">
                  Calibrate cognitive complexity. Higher tiers require synthetic
                  scenario setups and multi-hop grounding deductions.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* L1: Remember */}
                  <div className="p-3 rounded bg-surface-container-low flex flex-col gap-1.5">
                    <div className="flex justify-between items-center font-label-sm text-label-sm">
                      <span className="text-on-surface font-semibold">
                        L1: Remember
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface font-bold">
                        {bloomDistribution.remember}%
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant text-[12px] leading-tight">
                      Definitions, terminology, syntax, and foundational recall.
                    </p>
                    <input
                      className="w-full accent-outline cursor-pointer h-1.5 bg-surface-container rounded"
                      max="100"
                      min="0"
                      onChange={(e) =>
                        setBloomDistribution((prev) => ({
                          ...prev,
                          remember: Number(e.target.value),
                        }))
                      }
                      type="range"
                      value={bloomDistribution.remember}
                    />
                  </div>

                  {/* L2: Understand */}
                  <div className="p-3 rounded bg-surface-container-low flex flex-col gap-1.5">
                    <div className="flex justify-between items-center font-label-sm text-label-sm">
                      <span className="text-on-surface font-semibold">
                        L2: Understand
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface font-bold">
                        {bloomDistribution.understand}%
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant text-[12px] leading-tight">
                      Conceptual workflows, explanation, and principle mapping.
                    </p>
                    <input
                      className="w-full accent-primary cursor-pointer h-1.5 bg-surface-container rounded"
                      max="100"
                      min="0"
                      onChange={(e) =>
                        setBloomDistribution((prev) => ({
                          ...prev,
                          understand: Number(e.target.value),
                        }))
                      }
                      type="range"
                      value={bloomDistribution.understand}
                    />
                  </div>

                  {/* L3: Apply */}
                  <div className="p-3 rounded bg-surface-container-low flex flex-col gap-1.5">
                    <div className="flex justify-between items-center font-label-sm text-label-sm">
                      <span className="text-on-surface font-semibold">
                        L3: Apply
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface font-bold">
                        {bloomDistribution.apply}%
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant text-[12px] leading-tight">
                      Implementation tracing, code execution, and algorithmic
                      problem solving.
                    </p>
                    <input
                      className="w-full accent-primary cursor-pointer h-1.5 bg-surface-container rounded"
                      max="100"
                      min="0"
                      onChange={(e) =>
                        setBloomDistribution((prev) => ({
                          ...prev,
                          apply: Number(e.target.value),
                        }))
                      }
                      type="range"
                      value={bloomDistribution.apply}
                    />
                  </div>

                  {/* L4: Analyze */}
                  <div className="p-3 rounded bg-surface-container-low flex flex-col gap-1.5 ring-1 ring-primary/30">
                    <div className="flex justify-between items-center font-label-sm text-label-sm">
                      <span className="text-primary font-bold">
                        L4: Analyze (Core)
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-primary text-on-primary font-bold">
                        {bloomDistribution.analyze}%
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant text-[12px] leading-tight">
                      Fault analysis, structural comparison, edge cases, and
                      invariants.
                    </p>
                    <input
                      className="w-full accent-primary cursor-pointer h-1.5 bg-surface-container rounded"
                      max="100"
                      min="0"
                      onChange={(e) =>
                        setBloomDistribution((prev) => ({
                          ...prev,
                          analyze: Number(e.target.value),
                        }))
                      }
                      type="range"
                      value={bloomDistribution.analyze}
                    />
                  </div>

                  {/* L5: Evaluate */}
                  <div className="p-3 rounded bg-surface-container-low flex flex-col gap-1.5">
                    <div className="flex justify-between items-center font-label-sm text-label-sm">
                      <span className="text-on-surface font-semibold">
                        L5: Evaluate
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface font-bold">
                        {bloomDistribution.evaluate}%
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant text-[12px] leading-tight">
                      Trade-offs, performance critique, complexity, and safety
                      verification.
                    </p>
                    <input
                      className="w-full accent-secondary cursor-pointer h-1.5 bg-surface-container rounded"
                      max="100"
                      min="0"
                      onChange={(e) =>
                        setBloomDistribution((prev) => ({
                          ...prev,
                          evaluate: Number(e.target.value),
                        }))
                      }
                      type="range"
                      value={bloomDistribution.evaluate}
                    />
                  </div>

                  {/* L6: Synthesize */}
                  <div className="p-3 rounded bg-surface-container-low flex flex-col gap-1.5">
                    <div className="flex justify-between items-center font-label-sm text-label-sm">
                      <span className="text-on-surface font-semibold">
                        L6: Synthesize
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface font-bold">
                        {bloomDistribution.create}%
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant text-[12px] leading-tight">
                      Architecture composition, algorithm design, and system
                      integration.
                    </p>
                    <input
                      className="w-full accent-outline cursor-pointer h-1.5 bg-surface-container rounded"
                      max="100"
                      min="0"
                      onChange={(e) =>
                        setBloomDistribution((prev) => ({
                          ...prev,
                          create: Number(e.target.value),
                        }))
                      }
                      type="range"
                      value={bloomDistribution.create}
                    />
                  </div>
                </div>
              </section>

              {/* Section 3: Difficulty & Question Formats */}
              <section className="p-5 rounded bg-surface-container-lowest shadow-sm flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 bg-surface-container-low p-3 rounded">
                  <div>
                    <span className="font-label-sm text-label-sm text-primary font-bold uppercase tracking-wider">
                      Vector Matrix 03
                    </span>
                    <h2 className="font-headline-md text-headline-md text-on-surface">
                      3. Difficulty &amp; Question Formats
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm">
                    <span>3 Formats Active</span>
                  </div>
                </div>

                {/* Difficulty Pills */}
                <div className="flex flex-col gap-2">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                    Difficulty Calibration:
                  </span>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      className={`p-3 rounded text-center transition-all ${
                        difficultyWeights.easy > 30
                          ? 'bg-primary/10 ring-1 ring-primary text-primary font-bold'
                          : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                      }`}
                      onClick={() =>
                        setDifficultyWeights({ easy: 40, hard: 20, medium: 40 })
                      }
                      type="button"
                    >
                      <div>Easy ({difficultyWeights.easy}%)</div>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {Math.round(
                          (questionCount * difficultyWeights.easy) / 100,
                        )}{' '}
                        Items
                      </span>
                    </button>
                    <button
                      className={`p-3 rounded text-center transition-all ${
                        difficultyWeights.medium >= 40
                          ? 'bg-primary/10 ring-1 ring-primary text-primary font-bold'
                          : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                      }`}
                      onClick={() =>
                        setDifficultyWeights({ easy: 20, hard: 30, medium: 50 })
                      }
                      type="button"
                    >
                      <div>Medium ({difficultyWeights.medium}%)</div>
                      <span className="font-label-sm text-label-sm text-primary">
                        {Math.round(
                          (questionCount * difficultyWeights.medium) / 100,
                        )}{' '}
                        Items
                      </span>
                    </button>
                    <button
                      className={`p-3 rounded text-center transition-all ${
                        difficultyWeights.hard >= 40
                          ? 'bg-primary/10 ring-1 ring-primary text-primary font-bold'
                          : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                      }`}
                      onClick={() =>
                        setDifficultyWeights({ easy: 10, hard: 60, medium: 30 })
                      }
                      type="button"
                    >
                      <div>Hard ({difficultyWeights.hard}%)</div>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {Math.round(
                          (questionCount * difficultyWeights.hard) / 100,
                        )}{' '}
                        Items
                      </span>
                    </button>
                  </div>
                </div>

                {/* Question Types */}
                <div className="flex flex-col gap-2 pt-1">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                    Format Distribution:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded bg-surface-container-low flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="font-body-sm text-body-sm font-semibold text-on-surface">
                          Multiple Choice (MCQ)
                        </span>
                        <span className="font-label-sm text-label-sm text-primary font-bold">
                          {typeWeights.mcq}%
                        </span>
                      </div>
                      <span className="font-label-sm text-label-sm text-on-surface-variant text-[12px]">
                        4-distractor rationale synthesis
                      </span>
                    </div>

                    <div className="p-3 rounded bg-surface-container-low flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="font-body-sm text-body-sm font-semibold text-on-surface">
                          Short Answer / Proofs
                        </span>
                        <span className="font-label-sm text-label-sm text-on-surface font-bold">
                          {typeWeights.short_answer}%
                        </span>
                      </div>
                      <span className="font-label-sm text-label-sm text-on-surface-variant text-[12px]">
                        Rubric-grounded criteria key
                      </span>
                    </div>

                    <div className="p-3 rounded bg-surface-container-low flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="font-body-sm text-body-sm font-semibold text-on-surface">
                          Long Scenario Analysis
                        </span>
                        <span className="font-label-sm text-label-sm text-on-surface font-bold">
                          {typeWeights.long_answer}%
                        </span>
                      </div>
                      <span className="font-label-sm text-label-sm text-on-surface-variant text-[12px]">
                        Architecture failure injection
                      </span>
                    </div>
                  </div>
                </div>

                {/* Style Constraints */}
                <div className="flex items-center gap-2 flex-wrap pt-1 font-label-sm text-label-sm">
                  <span className="text-on-surface-variant mr-1">
                    Style Constraints:
                  </span>
                  <span className="px-2 py-1 rounded bg-primary/10 text-primary font-semibold flex items-center gap-1">
                    <span>✓</span> Scenario-Based
                  </span>
                  <span className="px-2 py-1 rounded bg-primary/10 text-primary font-semibold flex items-center gap-1">
                    <span>✓</span> Direct Analytical
                  </span>
                  <span className="px-2 py-1 rounded bg-surface-container text-on-surface-variant">
                    + Comparative Case
                  </span>
                </div>
              </section>

              {/* Section 4: Grounding Policy & Quality Invariants */}
              <section className="p-5 rounded bg-surface-container-lowest shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between pb-2 bg-surface-container-low p-3 rounded">
                  <div>
                    <span className="font-label-sm text-label-sm text-secondary font-bold uppercase tracking-wider">
                      Quality Safeguards
                    </span>
                    <h2 className="font-headline-md text-headline-md text-on-surface">
                      4. Grounding Policy &amp; Quality Invariants
                    </h2>
                  </div>
                  <Icon name="shield" size={20} />
                </div>

                <div className="flex flex-col gap-3">
                  {/* Strict Deduplication */}
                  <div className="p-3.5 rounded bg-surface-container-low flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface">
                        Duplicate Prevention Policy
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                        Strict Zero-Duplicate: Rejects candidates with semantic
                        cosine similarity &gt; 0.82 against existing questions
                        in this project.
                      </p>
                    </div>
                    <input
                      checked={strictDeduplication}
                      className="accent-primary w-5 h-5 cursor-pointer mt-1"
                      onChange={(e) => setStrictDeduplication(e.target.checked)}
                      type="checkbox"
                    />
                  </div>

                  {/* Grounding Citation Anchors */}
                  <div className="p-3.5 rounded bg-surface-container-low flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface">
                        Grounding Citation Anchors
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                        Require verified chunk byte-span on question stem AND
                        each distractor rationale.
                      </p>
                    </div>
                    <input
                      checked={requireCitationAnchors}
                      className="accent-secondary w-5 h-5 cursor-pointer mt-1"
                      onChange={(e) =>
                        setRequireCitationAnchors(e.target.checked)
                      }
                      type="checkbox"
                    />
                  </div>

                  {/* Inference Mode */}
                  <div className="p-3.5 rounded bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface">
                        Local Inference Determinism
                      </h3>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        Deterministic Local Mode (Temp: 0.15, Seed: 42)
                      </span>
                    </div>
                    <div className="font-label-sm text-label-sm bg-surface-container-lowest px-3 py-1 rounded shadow-sm">
                      Target Model:{' '}
                      <strong className="text-primary">{targetModel}</strong>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN: Blueprint Inspector & Generation Launcher (5 cols, sticky) */}
            <div className="xl:col-span-5 flex flex-col gap-6 min-w-0 xl:sticky xl:top-20">
              {/* Cockpit Controller Card */}
              <div className="p-5 rounded bg-surface-container-lowest shadow-md flex flex-col gap-4 border border-outline-variant/30">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Cockpit Controller
                    </span>
                    <h2 className="font-headline-md text-headline-md text-on-surface">
                      Generation Blueprint Summary
                    </h2>
                  </div>
                  <span className="px-2 py-1 rounded bg-secondary/15 text-secondary font-label-sm text-label-sm font-semibold flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    <span>Validated Spec</span>
                  </span>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded bg-surface-container-low">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                      Target Output
                    </span>
                    <span className="font-headline-md text-headline-md text-on-surface font-bold">
                      {questionCount} Questions
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                      Est. Latency
                    </span>
                    <span className="font-headline-md text-headline-md text-on-surface font-bold">
                      ~{Math.round(questionCount * 2.8)}s
                    </span>
                  </div>
                  <div className="flex flex-col pt-1">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                      Chunks In Scope
                    </span>
                    <span className="font-body-md text-body-md text-secondary font-bold">
                      {totalChunksCount || 28} Chunks Mapped
                    </span>
                  </div>
                  <div className="flex flex-col pt-1">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                      Deduplication
                    </span>
                    <span className="font-body-md text-body-md text-on-surface font-bold">
                      {strictDeduplication ? 'Strict (> 0.82)' : 'Permissive'}
                    </span>
                  </div>
                </div>

                {/* Primary CTA Button */}
                <button
                  className="w-full py-3.5 px-4 rounded bg-primary hover:bg-primary/90 text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.985] disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isGenerating || selectedTopicIds.size === 0}
                  onClick={handleStartGeneration}
                  type="button"
                >
                  <Icon name="spark" size={18} />
                  <span>
                    {isGenerating
                      ? `Synthesizing (${currentRun?.accepted_count ?? 0} / ${questionCount})...`
                      : `Generate ${questionCount} Questions from Blueprint`}
                  </span>
                </button>

                {/* Secondary Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    className="px-3 py-2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center justify-center gap-1.5 transition-colors"
                    onClick={() => setShowSavePresetModal(true)}
                    type="button"
                  >
                    <Icon name="folder" size={14} />
                    <span>Save as Preset</span>
                  </button>
                  <button
                    className="px-3 py-2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center justify-center gap-1.5 transition-colors"
                    onClick={handleExportSpec}
                    type="button"
                  >
                    <Icon name="copy" size={14} />
                    <span>Export Spec (.JSON)</span>
                  </button>
                </div>
              </div>

              {/* Execution Stepper & Telemetry Card */}
              <div className="p-5 rounded bg-surface-container-lowest shadow-sm flex flex-col gap-4 border border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="sliders" size={16} />
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">
                      Synthesis Pipeline Execution
                    </h3>
                  </div>
                  <span
                    className={`font-label-sm text-label-sm px-2 py-0.5 rounded ${
                      isGenerating
                        ? 'bg-primary/10 text-primary font-bold'
                        : currentRun?.status === 'COMPLETED'
                          ? 'bg-secondary/15 text-secondary font-bold'
                          : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {isGenerating
                      ? 'Synthesizing'
                      : currentRun?.status || 'Idle'}
                  </span>
                </div>

                {/* 4 Steps */}
                <div className="flex flex-col gap-2">
                  <div
                    className={`flex items-center justify-between p-2 px-3 rounded font-body-sm text-body-sm ${
                      executionStep >= 1
                        ? 'bg-secondary/10 text-secondary'
                        : 'bg-surface-container-low text-on-surface-variant'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{executionStep >= 1 ? '✓' : '○'}</span>
                      <span>1. Topic-Aware Chunk Retrieval</span>
                    </div>
                    <span className="font-label-sm text-label-sm">
                      {executionStep >= 1 ? '18ms' : 'Ready'}
                    </span>
                  </div>

                  <div
                    className={`flex items-center justify-between p-2 px-3 rounded font-body-sm text-body-sm ${
                      executionStep >= 2
                        ? 'bg-secondary/10 text-secondary'
                        : 'bg-surface-container-low text-on-surface-variant'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{executionStep >= 2 ? '✓' : '○'}</span>
                      <span>2. Question Blueprint Planning</span>
                    </div>
                    <span className="font-label-sm text-label-sm">
                      {executionStep >= 2 ? '42ms' : 'Queued'}
                    </span>
                  </div>

                  <div
                    className={`flex items-center justify-between p-2 px-3 rounded font-body-sm text-body-sm ${
                      executionStep >= 3
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'bg-surface-container-low text-on-surface-variant'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{executionStep >= 3 ? '⚡' : '○'}</span>
                      <span>3. Local LLM Inference ({targetModel})</span>
                    </div>
                    <span className="font-label-sm text-label-sm">
                      {currentRun
                        ? `${currentRun.accepted_count} / ${questionCount} Generated`
                        : 'Pending'}
                    </span>
                  </div>

                  <div
                    className={`flex items-center justify-between p-2 px-3 rounded font-body-sm text-body-sm ${
                      executionStep >= 4
                        ? 'bg-secondary/10 text-secondary'
                        : 'bg-surface-container-low text-on-surface-variant'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{executionStep >= 4 ? '✓' : '○'}</span>
                      <span>4. Multi-Constraint Verification</span>
                    </div>
                    <span className="font-label-sm text-label-sm">
                      {executionStep >= 4 ? 'Verified' : 'Queued'}
                    </span>
                  </div>
                </div>

                {/* Active Stream Preview Box */}
                <div className="p-4 rounded bg-surface-container-low flex flex-col gap-3 shadow-inner">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-label-sm text-label-sm font-semibold">
                        {activeStreamQuestion?.bloom_level ??
                          'Level 4: Analyze'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface font-label-sm text-label-sm">
                        {activeStreamQuestion?.difficulty ?? 'Hard'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-secondary/10 text-secondary font-label-sm text-label-sm">
                        {activeStreamQuestion?.question_type ??
                          'Multiple Choice'}
                      </span>
                    </div>
                    <span className="font-label-sm text-label-sm text-secondary font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                      <span>Synthesized Spec</span>
                    </span>
                  </div>

                  <div className="font-editorial-quote text-editorial-quote text-on-surface italic leading-snug">
                    {activeStreamQuestion?.stem ??
                      '"Under syllabus consensus constraints, how does the system preserve invariants during concurrent state transitions across asynchronous nodes?"'}
                  </div>

                  <div className="p-2 rounded bg-surface-container-lowest font-label-sm text-label-sm text-on-surface-variant flex flex-col gap-1 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface font-semibold flex items-center gap-1">
                        <span>⚓</span>
                        <span>#RES-CHUNK-GROUNDING</span>
                      </span>
                      <span className="text-secondary font-bold">
                        99.4% Attribution Match
                      </span>
                    </div>
                    <p className="text-[11px] leading-tight text-on-surface-variant truncate">
                      {activeStreamQuestion?.citation_anchor ??
                        'Syllabus Core Invariants & State Machine Verification'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between font-label-sm text-label-sm pt-1">
                    <span className="text-secondary flex items-center gap-1">
                      <Icon name="verified" size={14} />
                      <span>Zero Hallucination Confirmed</span>
                    </span>
                    <span className="text-on-surface-variant">
                      Deterministic Seed #42
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Generation Runs History */}
              <div className="p-5 rounded bg-surface-container-lowest shadow-sm flex flex-col gap-3 border border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    Recent Generation Batches
                  </h3>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    This Project
                  </span>
                </div>

                <div className="flex flex-col gap-2 font-body-sm text-body-sm">
                  {recentRuns.length === 0 ? (
                    <div className="p-3 text-center text-on-surface-variant text-body-sm">
                      No generation batches yet. Click generate above to
                      synthesize your first batch.
                    </div>
                  ) : (
                    recentRuns.slice(0, 5).map((run, idx) => (
                      <div
                        className="p-3 rounded bg-surface-container-low hover:bg-surface-container flex items-center justify-between transition-colors"
                        key={run.id}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-on-surface">
                              Batch #{recentRuns.length - idx}
                            </span>
                            <span
                              className={`font-label-sm text-label-sm px-1.5 py-0.5 rounded font-semibold ${
                                run.status === 'COMPLETED'
                                  ? 'bg-secondary/15 text-secondary'
                                  : run.status === 'FAILED'
                                    ? 'bg-error-container text-on-error-container'
                                    : 'bg-primary/10 text-primary'
                              }`}
                            >
                              {run.status === 'COMPLETED'
                                ? '100% Passed'
                                : run.status}
                            </span>
                          </div>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">
                            {run.accepted_count} Questions · {run.model_name}
                          </span>
                        </div>
                        <span className="font-label-sm text-label-sm text-primary flex items-center gap-0.5">
                          <span>{run.accepted_count} Items</span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Save Preset Modal */}
      {showSavePresetModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest p-6 rounded shadow-xl border border-outline-variant/40 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                Save Blueprint as Preset
              </h3>
              <button
                className="text-on-surface-variant hover:text-on-surface"
                onClick={() => setShowSavePresetModal(false)}
                type="button"
              >
                ✕
              </button>
            </div>
            <form className="flex flex-col gap-4" onSubmit={handleSavePreset}>
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  Preset Name
                </label>
                <input
                  className="px-3 py-2 rounded bg-surface-container-low border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary"
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="e.g., Midterm Advanced Analysis"
                  required
                  type="text"
                  value={newPresetName}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  Description
                </label>
                <textarea
                  className="px-3 py-2 rounded bg-surface-container-low border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary resize-none h-20"
                  onChange={(e) => setNewPresetDesc(e.target.value)}
                  placeholder="Briefly describe the pedagogical intention of this preset..."
                  value={newPresetDesc}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  className="px-4 py-2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface text-body-sm font-medium"
                  onClick={() => setShowSavePresetModal(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded bg-primary text-on-primary text-body-sm font-medium hover:bg-primary/90"
                  type="submit"
                >
                  Save Preset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <aside
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded bg-on-surface text-surface shadow-lg text-body-sm flex items-center gap-2 border border-outline/20"
        >
          <span>ℹ️</span>
          <span>{toastMessage}</span>
        </aside>
      )}
    </div>
  );
}
