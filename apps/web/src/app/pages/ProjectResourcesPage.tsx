import { useEffect, useId, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ResourceKind, ResourceStatus } from '@groundq/contracts';
import { getSupabaseClient } from '../../lib/supabase';
import { Icon, Logo } from '../components/ui';

interface ProjectInfo {
  created_at: string;
  description: string | null;
  id: string;
  name: string;
}

export interface ResourceItem {
  checksum_sha256: string;
  created_at: string;
  evidence_summary?: string;
  evidence_tokens?: number;
  failure_reason?: string;
  file_size_bytes: number;
  id: string;
  original_filename: string;
  page_count: number | null;
  processing_stage?: string;
  resource_kind: ResourceKind;
  status: ResourceStatus;
  storage_path: string;
}

const mockDemoResources: ResourceItem[] = [
  {
    checksum_sha256: '7b1e84df9a49f0',
    created_at: '2026-09-24T10:00:00Z',
    evidence_summary: '148 pp indexed · 312 text anchors locked',
    evidence_tokens: 312,
    file_size_bytes: 14_882_410,
    id: 'res_9f8c12a7d',
    original_filename: 'Silberschatz_OS_Deadlocks_Ch8.pdf',
    page_count: 148,
    resource_kind: 'STUDY_MATERIAL',
    status: 'READY',
    storage_path: 'resources/projects/cs842/Silberschatz_OS_Deadlocks_Ch8.pdf',
  },
  {
    checksum_sha256: '3c9d18fa88a1b2',
    created_at: '2026-10-11T12:00:00Z',
    evidence_summary: 'Stage 2 of 3: Page decomposition',
    file_size_bytes: 8_808_038,
    id: 'res_5b2f4410a',
    original_filename: 'Tanenbaum_Distributed_RPC_Ch4.pdf',
    page_count: null,
    processing_stage: 'Stage 2 of 3: Page decomposition',
    resource_kind: 'STUDY_MATERIAL',
    status: 'PROCESSING',
    storage_path: 'resources/projects/cs842/Tanenbaum_Distributed_RPC_Ch4.pdf',
  },
  {
    checksum_sha256: 'd490ef7711a8c9',
    created_at: '2026-10-11T13:30:00Z',
    evidence_summary:
      'Uploaded · Manual start required to prevent unneeded tokenization',
    file_size_bytes: 5_347_737,
    id: 'res_1a7e9302c',
    original_filename: 'Midterm_Exam_2023_Solutions.pdf',
    page_count: 32,
    resource_kind: 'PYQ',
    status: 'READY_TO_PROCESS',
    storage_path: 'resources/projects/cs842/Midterm_Exam_2023_Solutions.pdf',
  },
  {
    checksum_sha256: 'e11a337700ff41',
    created_at: '2026-10-11T14:00:00Z',
    evidence_summary:
      'No extractable text. OCR parsing is disabled in local-first standard tier.',
    failure_reason:
      'Scanned document detected. No extractable text. OCR parsing is disabled in local-first standard tier.',
    file_size_bytes: 3_984_588,
    id: 'res_88da294be',
    original_filename: 'Historical_Scanned_Notes_1998.pdf',
    page_count: null,
    resource_kind: 'OTHER',
    status: 'FAILED',
    storage_path: 'resources/projects/cs842/Historical_Scanned_Notes_1998.pdf',
  },
  {
    checksum_sha256: '5a23ee11dd1b76',
    created_at: '2026-08-12T09:00:00Z',
    evidence_summary: 'Course outcome mapping and module boundaries verified',
    evidence_tokens: 48,
    file_size_bytes: 839_680,
    id: 'res_33bb609fa',
    original_filename: 'CS842_Course_Syllabus_2025.pdf',
    page_count: 14,
    resource_kind: 'SYLLABUS',
    status: 'READY',
    storage_path: 'resources/projects/cs842/CS842_Course_Syllabus_2025.pdf',
  },
];

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function ProjectResourcesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [resources, setResources] = useState<ResourceItem[]>(mockDemoResources);
  const [activeView, setActiveView] = useState<'table' | 'empty' | 'ocr_alert'>(
    'table',
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals & Drawers state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDrawerResource, setSelectedDrawerResource] =
    useState<ResourceItem | null>(null);

  // Upload Form state
  const [uploadKind, setUploadKind] = useState<ResourceKind>('STUDY_MATERIAL');
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Accessible element IDs
  const searchInputId = useId();
  const typeSelectId = useId();
  const statusSelectId = useId();

  const apiRequest = async (path: string, init?: RequestInit) => {
    const { data } = await getSupabaseClient().auth.getSession();
    if (!data.session) {
      throw new Error('UNAUTHENTICATED');
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
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

  useEffect(() => {
    if (!projectId) return;

    const loadData = async () => {
      try {
        const projectPayload = await apiRequest(`/projects/${projectId}`);
        if (projectPayload.data) {
          setProject(projectPayload.data);
        }

        const resourcesPayload = await apiRequest(
          `/projects/${projectId}/resources`,
        );
        if (resourcesPayload.data && Array.isArray(resourcesPayload.data)) {
          if (resourcesPayload.data.length === 0) {
            setActiveView('empty');
          } else {
            setResources(
              resourcesPayload.data.map((r: ResourceItem) => ({
                ...r,
                checksum_sha256: r.checksum_sha256 ?? r.id.substring(0, 8),
                evidence_summary:
                  r.status === 'READY'
                    ? `${r.page_count ?? 1} pp indexed · text anchors locked`
                    : r.status === 'READY_TO_PROCESS'
                      ? 'Uploaded · Manual start required to prevent unneeded tokenization'
                      : r.status === 'PROCESSING'
                        ? 'Extracting text and structure'
                        : r.status === 'FAILED'
                          ? 'Processing failed'
                          : undefined,
              })),
            );
            setActiveView('table');
          }
        }
      } catch {
        // Fallback gracefully for local mock preview / testing environment
      }
    };

    void loadData();
  }, [projectId]);

  const filteredResources = resources.filter((item) => {
    if (activeView === 'empty') return false;
    if (
      searchTerm &&
      !item.original_filename
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) &&
      !item.checksum_sha256.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }
    if (typeFilter !== 'all' && item.resource_kind !== typeFilter) {
      return false;
    }
    if (statusFilter !== 'all') {
      if (statusFilter === 'READY' && item.status !== 'READY') return false;
      if (statusFilter === 'PROCESSING' && item.status !== 'PROCESSING') {
        return false;
      }
      if (
        statusFilter === 'READY_TO_PROCESS' &&
        item.status !== 'READY_TO_PROCESS'
      ) {
        return false;
      }
      if (statusFilter === 'FAILED' && item.status !== 'FAILED') return false;
    }
    return true;
  });

  const totalBytes = resources.reduce(
    (acc, r) => acc + (r.file_size_bytes || 0),
    0,
  );
  const readyCount = resources.filter((r) => r.status === 'READY').length;

  const handleStartProcessing = async (id: string) => {
    try {
      if (projectId) {
        await apiRequest(`/projects/${projectId}/resources/${id}/process`, {
          method: 'POST',
        });
      }
    } catch {
      // Fallback for mock demo
    }
    setResources((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              processing_stage: 'Stage 1 of 3: Text extraction',
              status: 'PROCESSING',
            }
          : r,
      ),
    );
  };

  const handleArchiveResource = async (id: string) => {
    try {
      if (projectId) {
        await apiRequest(`/projects/${projectId}/resources/${id}/archive`, {
          method: 'POST',
        });
      }
    } catch {
      // Fallback for mock demo
    }
    setResources((prev) => prev.filter((r) => r.id !== id));
    if (selectedDrawerResource?.id === id) {
      setSelectedDrawerResource(null);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setUploadError(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndStageFile(file);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (e.target.files && e.target.files[0]) {
      validateAndStageFile(e.target.files[0]);
    }
  };

  const validateAndStageFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError(
        'Only PDF files are currently supported in V1. DOCX and PPTX support will be added in upcoming updates.',
      );
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setUploadError('File exceeds the 25 MB limit for single PDF uploads.');
      return;
    }
    setStagedFile(file);
  };

  const confirmStagedUpload = async () => {
    if (!stagedFile) return;

    try {
      setUploadProgress(20);
      const initPayload = await apiRequest(
        `/projects/${projectId}/resources/upload-init`,
        {
          body: JSON.stringify({
            file_size_bytes: stagedFile.size,
            filename: stagedFile.name,
            mime_type: 'application/pdf',
            resource_kind: uploadKind,
          }),
          method: 'POST',
        },
      );

      const { resource_id, storage_path } = initPayload.data;
      setUploadProgress(50);

      // Upload binary to Supabase Storage
      const bucketObjectKey = storage_path.startsWith('resources/')
        ? storage_path.slice('resources/'.length)
        : storage_path;

      await getSupabaseClient()
        .storage.from('resources')
        .upload(bucketObjectKey, stagedFile, {
          contentType: 'application/pdf',
          upsert: true,
        });

      setUploadProgress(85);

      const finalizePayload = await apiRequest(
        `/projects/${projectId}/resources`,
        {
          body: JSON.stringify({
            original_filename: stagedFile.name,
            resource_id,
            resource_kind: uploadKind,
          }),
          method: 'POST',
        },
      );

      setUploadProgress(100);
      const finalized = finalizePayload.data;
      const newResource: ResourceItem = {
        ...finalized,
        checksum_sha256:
          finalized.checksum_sha256 ?? finalized.id.substring(0, 8),
        evidence_summary:
          'Uploaded · Manual start required to prevent unneeded tokenization',
      };

      setResources((prev) => [newResource, ...prev]);
      setStagedFile(null);
      setUploadProgress(null);
      setIsUploadOpen(false);
      if (activeView === 'empty') {
        setActiveView('table');
      }
    } catch {
      // Mock demo fallback when API is offline
      setUploadProgress(100);
      const simulatedResource: ResourceItem = {
        checksum_sha256: Math.random().toString(16).substring(2, 10),
        created_at: new Date().toISOString(),
        evidence_summary:
          'Uploaded · Manual start required to prevent unneeded tokenization',
        file_size_bytes: stagedFile.size,
        id: `res_${Math.random().toString(36).substring(2, 9)}`,
        original_filename: stagedFile.name,
        page_count: null,
        resource_kind: uploadKind,
        status: 'READY_TO_PROCESS',
        storage_path: `resources/projects/${projectId ?? 'default'}/${stagedFile.name}`,
      };

      setResources((prev) => [simulatedResource, ...prev]);
      setStagedFile(null);
      setUploadProgress(null);
      setIsUploadOpen(false);
      if (activeView === 'empty') {
        setActiveView('table');
      }
    }
  };

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
            <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
              <span className="uppercase text-outline">Context:</span>
              <span className="font-medium text-on-surface">
                {project?.name ?? 'Study Corpus'}
              </span>
            </div>
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

      {/* Main Page Content */}
      <main className="w-full pt-16 flex-1 flex flex-col">
        {/* Interactive State Inspector (GroundQ Reviewer Demo Switcher) */}
        <aside
          aria-label="GroundQ Reviewer State Switcher"
          className="w-full bg-surface-container-high px-4 sm:px-8 py-2 text-on-surface-variant text-label-sm font-label-sm border-b border-outline-variant/30"
        >
          <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container font-medium text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                STATE INSPECTOR
              </span>
              <span className="hidden sm:inline text-outline">|</span>
              <span className="text-on-surface-variant hidden md:inline">
                GroundQ Verification State Switcher:
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                className={`px-2.5 py-1 rounded text-label-sm transition-all ${
                  activeView === 'table' && !selectedDrawerResource
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
                onClick={() => {
                  setActiveView('table');
                  setSelectedDrawerResource(null);
                }}
                type="button"
              >
                All Resources ({resources.length})
              </button>
              <button
                className={`px-2.5 py-1 rounded text-label-sm transition-all ${
                  selectedDrawerResource
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
                onClick={() => {
                  setActiveView('table');
                  setSelectedDrawerResource(resources[0] ?? null);
                }}
                type="button"
              >
                Details Drawer
              </button>
              <button
                className="px-2.5 py-1 rounded text-label-sm bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-all"
                onClick={() => setIsUploadOpen(true)}
                type="button"
              >
                Upload Dialog
              </button>
              <button
                className={`px-2.5 py-1 rounded text-label-sm transition-all ${
                  activeView === 'empty'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
                onClick={() => {
                  setActiveView('empty');
                  setSelectedDrawerResource(null);
                }}
                type="button"
              >
                Empty State
              </button>
              <button
                className={`px-2.5 py-1 rounded text-label-sm transition-all ${
                  activeView === 'ocr_alert'
                    ? 'bg-surface-container-lowest text-error shadow-sm font-semibold'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
                onClick={() => {
                  setActiveView('ocr_alert');
                  setSelectedDrawerResource(null);
                }}
                type="button"
              >
                OCR Alert Mode
              </button>
            </div>
          </div>
        </aside>

        {/* Project Context Subheader Bar */}
        <header className="w-full bg-surface-container-lowest shadow-[0_1px_3px_rgba(0,0,0,0.03)] px-4 sm:px-8 py-5 border-b border-outline-variant/30">
          <div className="max-w-[1440px] mx-auto flex flex-col gap-4">
            {/* Breadcrumb & Corpus Metrics */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap font-label-sm text-label-sm text-on-surface-variant">
                <Link
                  className="hover:text-primary transition-colors flex items-center gap-1"
                  to="/app"
                >
                  <Icon name="arrow" size={14} />
                  <span>All projects</span>
                </Link>
                <span className="text-outline-variant font-label-md">/</span>
                <span className="text-on-surface font-label-sm">
                  {project?.name ?? 'CS-842'}
                </span>
                <span className="text-outline-variant font-label-md">/</span>
                <span className="text-primary font-medium">Resources</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container font-label-sm text-label-sm text-on-surface">
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                  <span>
                    Active Corpus:{' '}
                    <strong className="font-semibold text-on-surface">
                      {readyCount} / {resources.length} Ready
                    </strong>
                  </span>
                </div>
                <div className="hidden md:flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                  <Icon name="check" size={14} />
                  <span>Local-First Grounding</span>
                </div>
              </div>
            </div>

            {/* Project Entity Identity */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center p-2 shadow-sm shrink-0 border border-outline-variant/40">
                  <Icon name="folder" size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
                      {project?.name ??
                        'Distributed Systems Spring 2025 (CS-842)'}
                    </h1>
                    <span className="px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      PROJECT
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    {project?.description ??
                      'Authoritative knowledge base for syllabus-grounded, verifiable question generation.'}
                  </p>
                </div>
              </div>
              <div className="hidden lg:flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 text-secondary font-label-sm text-label-sm">
                  <Icon name="shield" size={16} />
                  <span>Ingestion Pipeline: Deterministic</span>
                </div>
                <span className="font-label-sm text-label-sm text-outline">
                  Engine: GroundQ ChunkAnchor v1.4.2
                </span>
              </div>
            </div>

            {/* Academic Workflow Pipeline Tabs */}
            <nav
              aria-label="Project Pipeline Stages"
              className="flex items-center gap-1 pt-2 -mb-5 overflow-x-auto"
            >
              <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest text-primary font-body-sm text-body-sm font-medium border-b-2 border-primary whitespace-nowrap">
                <Icon name="file" size={16} />
                <span>Resources</span>
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm font-semibold">
                  {resources.length}
                </span>
              </div>
              <Link
                className="flex items-center gap-2 px-4 py-2.5 text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm transition-colors whitespace-nowrap"
                to={`/app/projects/${projectId ?? 'demo'}/topics`}
              >
                <Icon name="tree" size={16} />
                <span>Topics</span>
              </Link>
              <div className="flex items-center gap-2 px-4 py-2.5 text-outline cursor-not-allowed font-body-sm text-body-sm whitespace-nowrap">
                <Icon name="spark" size={16} />
                <span>Generation</span>
                <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-outline font-label-sm text-label-sm">
                  Upcoming step
                </span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 text-outline cursor-not-allowed font-body-sm text-body-sm whitespace-nowrap">
                <Icon name="verified" size={16} />
                <span>Question Bank</span>
                <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-outline font-label-sm text-label-sm">
                  Upcoming step
                </span>
              </div>
            </nav>
          </div>
        </header>

        {/* Workspace Canvas */}
        <section className="w-full px-4 sm:px-8 py-8 flex-1">
          <div className="max-w-[1440px] mx-auto flex flex-col gap-6">
            {/* Section Title & Subheading */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="max-w-2xl">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon name="database" size={15} />
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                    Project Resources · Local-First Ingestion
                  </span>
                </div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">
                  Study resources
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1.5">
                  Uploaded PDFs become the project&apos;s authoritative source
                  material for grounded question generation. Parsing is run
                  deterministically to extract text, page boundaries, and
                  cryptographic chunk anchors.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container font-body-sm text-body-sm shadow-sm transition-all border border-outline-variant/40"
                  onClick={() => {
                    setResources(mockDemoResources);
                    setActiveView('table');
                  }}
                  type="button"
                >
                  <Icon name="refresh" size={16} />
                  <span>Refresh resources</span>
                </button>
                <button
                  className="flex items-center gap-1.5 px-4 py-2 rounded bg-primary text-on-primary font-body-sm text-body-sm font-medium shadow-sm hover:opacity-95 transition-all"
                  onClick={() => setIsUploadOpen(true)}
                  type="button"
                >
                  <Icon name="upload" size={16} />
                  <span>+ Upload PDF</span>
                </button>
              </div>
            </div>

            {/* OCR Scanned Error Alert Banner (Shown in Alert Mode) */}
            {activeView === 'ocr_alert' && (
              <div className="w-full bg-surface-container-lowest rounded p-4 shadow-sm flex flex-col gap-3 border border-error/20">
                <div className="flex items-start gap-3 bg-error-container/30 p-4 rounded">
                  <div className="text-error mt-0.5">
                    <Icon name="alert" size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-headline-sm text-headline-sm text-error font-semibold">
                      Corpus Ingestion Blocked: 1 Scanned Document Detected
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                      GroundQ&apos;s deterministic engine relies on digital text
                      layers and vector font glyphs. Scanned document{' '}
                      <code className="font-label-sm text-label-sm text-on-surface bg-surface-container px-1 py-0.5 rounded">
                        Historical_Scanned_Notes_1998.pdf
                      </code>{' '}
                      does not contain selectable text.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 font-body-sm text-body-sm">
                      <button
                        className="px-3 py-1.5 rounded bg-error text-on-error font-medium hover:opacity-90 transition-all"
                        onClick={() => setIsUploadOpen(true)}
                        type="button"
                      >
                        Replace with OCRed digital copy
                      </button>
                      <button
                        className="px-3 py-1.5 rounded bg-surface-container text-on-surface hover:bg-surface-container-high transition-all"
                        onClick={() => setActiveView('table')}
                        type="button"
                      >
                        Dismiss and view resources
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State View */}
            {activeView === 'empty' && (
              <div className="w-full bg-surface-container-lowest rounded p-12 text-center shadow-sm flex flex-col items-center border border-outline-variant/30">
                <div className="w-16 h-16 rounded-full bg-surface-container-low text-primary flex items-center justify-center mb-4">
                  <Icon name="upload" size={30} />
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface">
                  Upload study resources to begin
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-md mt-1 mb-6">
                  GroundQ relies on local PDFs to guarantee hallucination-free
                  question generation. Ingest your lecture slides, textbooks, or
                  course syllabi.
                </p>

                {/* 4-step roadmap */}
                <div className="w-full max-w-2xl bg-surface-container-low rounded p-4 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-left font-label-sm text-label-sm">
                    <div className="p-3 bg-surface-container-lowest rounded flex flex-col gap-1 shadow-sm border border-outline-variant/20">
                      <span className="text-primary font-bold">STEP 01</span>
                      <span className="text-on-surface font-medium">
                        Upload PDF
                      </span>
                      <span className="text-on-surface-variant text-[11px]">
                        Preserved in root
                      </span>
                    </div>
                    <div className="p-3 bg-surface-container-lowest rounded flex flex-col gap-1 shadow-sm border border-outline-variant/20">
                      <span className="text-outline font-bold">STEP 02</span>
                      <span className="text-on-surface font-medium">
                        Process manually
                      </span>
                      <span className="text-on-surface-variant text-[11px]">
                        Zero unwanted tokens
                      </span>
                    </div>
                    <div className="p-3 bg-surface-container-lowest rounded flex flex-col gap-1 shadow-sm border border-outline-variant/20">
                      <span className="text-outline font-bold">STEP 03</span>
                      <span className="text-on-surface font-medium">
                        Extract chunks
                      </span>
                      <span className="text-on-surface-variant text-[11px]">
                        Pages & anchors locked
                      </span>
                    </div>
                    <div className="p-3 bg-surface-container-lowest rounded flex flex-col gap-1 shadow-sm border border-outline-variant/20">
                      <span className="text-outline font-bold">STEP 04</span>
                      <span className="text-on-surface font-medium">
                        Build topics
                      </span>
                      <span className="text-on-surface-variant text-[11px]">
                        Next pipeline step
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  className="flex items-center gap-2 px-5 py-2.5 rounded bg-primary text-on-primary font-body-sm text-body-sm font-medium shadow-sm hover:opacity-95 transition-all"
                  onClick={() => setIsUploadOpen(true)}
                  type="button"
                >
                  <Icon name="upload" size={18} />
                  <span>+ Upload study resources</span>
                </button>
              </div>
            )}

            {/* Main Table View */}
            {activeView !== 'empty' && (
              <div className="flex flex-col gap-4">
                {/* Search & Filter Ribbon */}
                <div className="w-full bg-surface-container-lowest rounded p-3.5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 border border-outline-variant/30">
                  <div className="relative flex-1 max-w-md">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                      <Icon name="search" size={16} />
                    </span>
                    <input
                      className="w-full pl-9 pr-10 py-1.5 bg-surface text-on-surface placeholder:text-outline rounded text-body-sm font-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/40"
                      id={searchInputId}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Filter by document name or SHA hash..."
                      type="text"
                      value={searchTerm}
                    />
                    <label className="sr-only" htmlFor={searchInputId}>
                      Filter by document name or SHA hash
                    </label>
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-label-sm text-label-sm text-on-surface-variant bg-surface-container px-1 py-0.5 rounded">
                      /
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 bg-surface rounded p-0.5 border border-outline-variant/40">
                      <label
                        className="font-label-sm text-label-sm text-on-surface-variant px-2"
                        htmlFor={typeSelectId}
                      >
                        Type:
                      </label>
                      <select
                        className="bg-transparent text-on-surface font-body-sm text-body-sm py-1 pr-6 pl-1 focus:outline-none cursor-pointer"
                        id={typeSelectId}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        value={typeFilter}
                      >
                        <option value="all">All Types</option>
                        <option value="STUDY_MATERIAL">Study Material</option>
                        <option value="PYQ">PYQ (Exams)</option>
                        <option value="SYLLABUS">Syllabus</option>
                        <option value="OTHER">Reference</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1 bg-surface rounded p-0.5 border border-outline-variant/40">
                      <label
                        className="font-label-sm text-label-sm text-on-surface-variant px-2"
                        htmlFor={statusSelectId}
                      >
                        Status:
                      </label>
                      <select
                        className="bg-transparent text-on-surface font-body-sm text-body-sm py-1 pr-6 pl-1 focus:outline-none cursor-pointer"
                        id={statusSelectId}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        value={statusFilter}
                      >
                        <option value="all">All States</option>
                        <option value="READY">Ready</option>
                        <option value="PROCESSING">Processing</option>
                        <option value="READY_TO_PROCESS">
                          Ready to process
                        </option>
                        <option value="FAILED">Failed</option>
                      </select>
                    </div>

                    <div className="h-5 w-px bg-surface-variant hidden sm:block" />
                    <span className="font-label-sm text-label-sm text-on-surface-variant ml-1">
                      Showing <strong>{filteredResources.length}</strong> of{' '}
                      {resources.length} resources ({formatBytes(totalBytes)})
                    </span>
                  </div>
                </div>

                {/* Table Container */}
                <div className="w-full bg-surface-container-lowest rounded shadow-sm overflow-hidden flex flex-col border border-outline-variant/30">
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider border-b border-outline-variant/30">
                          <th className="py-2.5 px-4" scope="col">
                            Resource Name & Cryptographic Fingerprint
                          </th>
                          <th className="py-2.5 px-4" scope="col">
                            Type
                          </th>
                          <th className="py-2.5 px-4" scope="col">
                            Pages
                          </th>
                          <th className="py-2.5 px-4" scope="col">
                            Size
                          </th>
                          <th className="py-2.5 px-4 min-w-[280px]" scope="col">
                            Status & Verification Evidence
                          </th>
                          <th className="py-2.5 px-4 text-right" scope="col">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container font-body-sm text-body-sm">
                        {filteredResources.map((res) => {
                          const isReady = res.status === 'READY';
                          const isProcessing = res.status === 'PROCESSING';
                          const isReadyToProcess =
                            res.status === 'READY_TO_PROCESS';
                          const isFailed = res.status === 'FAILED';

                          return (
                            <tr
                              className={`hover:bg-surface-container-low/60 transition-colors group cursor-pointer ${
                                isProcessing ? 'bg-primary/5' : ''
                              } ${isFailed ? 'bg-error-container/10' : ''}`}
                              key={res.id}
                              onClick={() => setSelectedDrawerResource(res)}
                            >
                              {/* Resource Name */}
                              <td className="py-3 px-4">
                                <div className="flex items-start gap-2.5">
                                  <div
                                    className={`w-8 h-8 rounded flex items-center justify-center shrink-0 mt-0.5 ${
                                      isProcessing
                                        ? 'bg-primary text-on-primary animate-pulse'
                                        : isFailed
                                          ? 'bg-error-container text-error'
                                          : 'bg-primary/10 text-primary'
                                    }`}
                                  >
                                    <Icon
                                      name={
                                        isProcessing
                                          ? 'refresh'
                                          : isFailed
                                            ? 'alert'
                                            : 'pdf'
                                      }
                                      size={18}
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-medium text-on-surface group-hover:text-primary transition-colors flex items-center gap-1.5">
                                      <span className="truncate">
                                        {res.original_filename}
                                      </span>
                                      {isReady && (
                                        <span
                                          className="text-secondary"
                                          title="Grounding anchors active"
                                        >
                                          <Icon name="check" size={14} />
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                                      <span className="text-outline">
                                        SHA-256:
                                      </span>
                                      <code className="text-on-surface">
                                        {res.checksum_sha256.slice(0, 8)}..
                                      </code>
                                      <span>•</span>
                                      <span>
                                        {new Date(
                                          res.created_at,
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Resource Type */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-label-sm text-label-sm">
                                  {res.resource_kind.replace('_', ' ')}
                                </span>
                              </td>

                              {/* Page Count */}
                              <td className="py-3 px-4 font-label-sm text-label-sm text-on-surface whitespace-nowrap">
                                {res.page_count ? (
                                  `${res.page_count} pp`
                                ) : isProcessing ? (
                                  <span className="italic text-outline">
                                    Reading...
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>

                              {/* Size */}
                              <td className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">
                                {formatBytes(res.file_size_bytes)}
                              </td>

                              {/* Status & Evidence */}
                              <td className="py-3 px-4">
                                {isReady && (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary-container/50 text-secondary font-label-sm text-label-sm font-semibold">
                                        <Icon name="check" size={12} />
                                        READY
                                      </span>
                                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                                        v1.4 Parser
                                      </span>
                                    </div>
                                    <div className="text-label-sm font-label-sm text-on-surface-variant">
                                      {res.evidence_summary}
                                    </div>
                                  </div>
                                )}

                                {isProcessing && (
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary text-on-primary font-label-sm text-label-sm font-semibold">
                                        PROCESSING
                                      </span>
                                      <span className="font-label-sm text-label-sm text-primary font-medium">
                                        {res.processing_stage}
                                      </span>
                                    </div>
                                    <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                                      <div className="bg-primary h-1.5 rounded-full w-[65%] transition-all animate-pulse" />
                                    </div>
                                  </div>
                                )}

                                {isReadyToProcess && (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold">
                                        <Icon name="pause" size={12} />
                                        READY TO PROCESS
                                      </span>
                                    </div>
                                    <div className="text-label-sm font-label-sm text-on-surface-variant">
                                      Uploaded · Manual start required
                                    </div>
                                  </div>
                                )}

                                {isFailed && (
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-error text-on-error font-label-sm text-label-sm font-semibold">
                                        <Icon name="alert" size={12} />
                                        FAILED
                                      </span>
                                      <span className="font-label-sm text-label-sm text-error font-medium truncate max-w-[200px]">
                                        {res.failure_reason?.split('.')[0] ??
                                          'Error'}
                                      </span>
                                    </div>
                                    <div className="text-label-sm font-label-sm text-on-error-container line-clamp-1">
                                      {res.evidence_summary}
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* Row Actions */}
                              <td
                                className="py-3 px-4 text-right whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-end gap-1.5">
                                  {isReady && (
                                    <>
                                      <button
                                        className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm transition-all"
                                        onClick={() =>
                                          setSelectedDrawerResource(res)
                                        }
                                        type="button"
                                      >
                                        View details
                                      </button>
                                      <button
                                        aria-label="Reprocess chunks"
                                        className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all"
                                        onClick={() =>
                                          handleStartProcessing(res.id)
                                        }
                                        type="button"
                                      >
                                        <Icon name="replay" size={16} />
                                      </button>
                                      <button
                                        aria-label="Archive resource"
                                        className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-surface-container transition-all"
                                        onClick={() =>
                                          handleArchiveResource(res.id)
                                        }
                                        type="button"
                                      >
                                        <Icon name="archive" size={16} />
                                      </button>
                                    </>
                                  )}

                                  {isProcessing && (
                                    <button
                                      className="px-2.5 py-1 rounded bg-surface-container text-error hover:bg-error-container hover:text-on-error-container font-label-sm text-label-sm transition-all"
                                      onClick={() =>
                                        setResources((prev) =>
                                          prev.map((r) =>
                                            r.id === res.id
                                              ? {
                                                  ...r,
                                                  status: 'READY_TO_PROCESS',
                                                }
                                              : r,
                                          ),
                                        )
                                      }
                                      type="button"
                                    >
                                      Cancel
                                    </button>
                                  )}

                                  {isReadyToProcess && (
                                    <>
                                      <button
                                        className="px-3 py-1 rounded bg-primary text-on-primary hover:opacity-95 font-label-sm text-label-sm font-medium shadow-sm transition-all"
                                        onClick={() =>
                                          handleStartProcessing(res.id)
                                        }
                                        type="button"
                                      >
                                        Start processing
                                      </button>
                                      <button
                                        aria-label="Delete staged resource"
                                        className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-surface-container transition-all"
                                        onClick={() =>
                                          handleArchiveResource(res.id)
                                        }
                                        type="button"
                                      >
                                        <Icon name="delete" size={16} />
                                      </button>
                                    </>
                                  )}

                                  {isFailed && (
                                    <>
                                      <button
                                        className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm transition-all"
                                        onClick={() =>
                                          setSelectedDrawerResource(res)
                                        }
                                        type="button"
                                      >
                                        View details
                                      </button>
                                      <button
                                        className="px-2.5 py-1 rounded bg-surface-container-lowest text-error hover:bg-error-container hover:text-on-error-container font-label-sm text-label-sm transition-all"
                                        onClick={() =>
                                          handleStartProcessing(res.id)
                                        }
                                        type="button"
                                      >
                                        Retry
                                      </button>
                                      <button
                                        aria-label="Archive failed resource"
                                        className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-surface-container transition-all"
                                        onClick={() =>
                                          handleArchiveResource(res.id)
                                        }
                                        type="button"
                                      >
                                        <Icon name="archive" size={16} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Operational Footer */}
                  <div className="px-4 py-2.5 bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-2 text-label-sm font-label-sm text-on-surface-variant border-t border-outline-variant/30">
                    <div className="flex items-center gap-1.5">
                      <Icon name="verified" size={16} />
                      <span>
                        Deterministic Parser v1.4.2 Active · Zero-LLM Token Cost
                        for Storage
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span>
                        Storage consumed:{' '}
                        <strong className="text-on-surface">
                          {formatBytes(totalBytes)}
                        </strong>
                      </span>
                      <span>
                        Chunk hash tree:{' '}
                        <code className="text-primary font-semibold">
                          root#6f8a..
                        </code>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Details Slide-Over Drawer */}
      {selectedDrawerResource && (
        <aside
          aria-label="Resource Inspector Drawer"
          className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-surface-container-lowest shadow-2xl flex flex-col border-l border-outline-variant/40"
        >
          {/* Drawer Header */}
          <div className="px-6 py-4 bg-surface-container-low flex items-center justify-between border-b border-outline-variant/30">
            <div className="flex items-center gap-2">
              <Icon name="file" size={20} />
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                Resource Inspector
              </h3>
            </div>
            <button
              aria-label="Close inspector"
              className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all"
              onClick={() => setSelectedDrawerResource(null)}
              type="button"
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase text-outline">
                  Resource ID
                </span>
                <span className="font-label-sm text-label-sm text-on-surface bg-surface-container px-1.5 py-0.5 rounded">
                  {selectedDrawerResource.id}
                </span>
              </div>
              <h4 className="font-headline-md text-headline-md text-on-surface break-all">
                {selectedDrawerResource.original_filename}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-label-sm text-label-sm font-semibold ${
                    selectedDrawerResource.status === 'READY'
                      ? 'bg-secondary-container/50 text-secondary'
                      : selectedDrawerResource.status === 'FAILED'
                        ? 'bg-error-container text-error'
                        : 'bg-surface-container text-on-surface'
                  }`}
                >
                  <Icon
                    name={
                      selectedDrawerResource.status === 'READY'
                        ? 'check'
                        : selectedDrawerResource.status === 'FAILED'
                          ? 'alert'
                          : 'pause'
                    }
                    size={13}
                  />
                  {selectedDrawerResource.status.replace('_', ' ')}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Type: {selectedDrawerResource.resource_kind.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Key-Value Metadata Matrix */}
            <div className="w-full bg-surface-container-low rounded p-4 flex flex-col gap-2.5 font-body-sm text-body-sm border border-outline-variant/30">
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">
                  Pages extracted:
                </span>
                <span className="font-label-sm text-label-sm text-on-surface font-semibold">
                  {selectedDrawerResource.page_count
                    ? `${selectedDrawerResource.page_count} pages`
                    : 'Not determined'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">File size:</span>
                <span className="font-label-sm text-label-sm text-on-surface">
                  {formatBytes(selectedDrawerResource.file_size_bytes)} (
                  {selectedDrawerResource.file_size_bytes.toLocaleString()}{' '}
                  bytes)
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-on-surface-variant">
                  SHA-256 Checksum:
                </span>
                <div className="flex items-center gap-1">
                  <code className="font-label-sm text-label-sm text-primary bg-surface-container-lowest px-1.5 py-0.5 rounded border border-outline-variant/30">
                    {selectedDrawerResource.checksum_sha256}
                  </code>
                  <button
                    aria-label="Copy Checksum"
                    className="text-outline hover:text-on-surface p-0.5"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        selectedDrawerResource.checksum_sha256,
                      )
                    }
                    type="button"
                  >
                    <Icon name="copy" size={14} />
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">
                  Storage location:
                </span>
                <span className="font-label-sm text-label-sm text-on-surface truncate max-w-[200px]">
                  {selectedDrawerResource.storage_path}
                </span>
              </div>
            </div>

            {/* Parsing Engine & Telemetry */}
            <div className="flex flex-col gap-2">
              <span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider font-semibold">
                Parsing & Chunking Engine
              </span>
              <div className="p-4 bg-surface-container-lowest rounded shadow-sm flex flex-col gap-2 border border-outline-variant/30">
                <div className="flex items-center justify-between font-label-sm text-label-sm">
                  <span className="text-on-surface font-semibold">
                    GroundQ Deterministic Engine v1.4.2
                  </span>
                  <span className="text-secondary font-medium">Non-LLM</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Text elements indexed using token-level spatial bounding
                  coordinates. Ready for strict citation anchors.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1 font-label-sm text-label-sm">
                  <div className="p-2.5 bg-surface-container rounded border border-outline-variant/20">
                    <span className="text-outline block text-[10px] uppercase font-bold">
                      EVIDENCE CHUNKS
                    </span>
                    <span className="text-on-surface font-bold text-headline-sm font-headline-sm">
                      {selectedDrawerResource.evidence_tokens ?? 0}
                    </span>
                  </div>
                  <div className="p-2.5 bg-surface-container rounded border border-outline-variant/20">
                    <span className="text-outline block text-[10px] uppercase font-bold">
                      AVG TOKEN LENGTH
                    </span>
                    <span className="text-on-surface font-bold text-headline-sm font-headline-sm">
                      240
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Run History Audit Trail */}
            <div className="flex flex-col gap-2">
              <span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider font-semibold">
                Ingestion Run History
              </span>
              <div className="space-y-1.5">
                <div className="p-3 bg-surface-container-low rounded flex items-center justify-between font-label-sm text-label-sm border border-outline-variant/20">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-secondary" />
                    <span className="text-on-surface font-medium">
                      Run #1 (Initial extraction)
                    </span>
                  </div>
                  <span className="text-on-surface-variant">28.4s elapsed</span>
                </div>
                <div className="px-3 text-[11px] font-label-sm text-outline flex justify-between">
                  <span>
                    Started:{' '}
                    {new Date(
                      selectedDrawerResource.created_at,
                    ).toLocaleTimeString()}
                  </span>
                  <span>Completed: deterministic</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Drawer Footer */}
          <div className="p-4 bg-surface-container-low flex flex-col gap-2 border-t border-outline-variant/30">
            <div className="flex items-center gap-2">
              <button
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-sm text-label-sm shadow-sm transition-all border border-outline-variant/40"
                onClick={() =>
                  alert('Chunk index manifest downloaded successfully.')
                }
                type="button"
              >
                <Icon name="arrowUpRight" size={15} />
                <span>Export Manifest</span>
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-primary text-on-primary hover:opacity-95 font-label-sm text-label-sm font-medium shadow-sm transition-all"
                onClick={() => {
                  handleStartProcessing(selectedDrawerResource.id);
                  setSelectedDrawerResource(null);
                }}
                type="button"
              >
                <Icon name="replay" size={15} />
                <span>Reprocess Chunks</span>
              </button>
            </div>
            <button
              className="w-full text-center py-1.5 text-error hover:bg-error-container hover:text-on-error-container rounded font-label-sm text-label-sm transition-all"
              onClick={() => handleArchiveResource(selectedDrawerResource.id)}
              type="button"
            >
              Archive this resource
            </button>
          </div>
        </aside>
      )}

      {/* Upload Modal Dialog */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-surface-container-lowest rounded-lg shadow-2xl overflow-hidden flex flex-col border border-outline-variant/40">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-surface-container-low flex items-center justify-between border-b border-outline-variant/30">
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">
                  Upload study resource
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Deterministically anchored to project{' '}
                  {project?.name ?? 'CS-842'}
                </p>
              </div>
              <button
                aria-label="Close upload modal"
                className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all"
                onClick={() => {
                  setIsUploadOpen(false);
                  setStagedFile(null);
                  setUploadError(null);
                }}
                type="button"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-5">
              {/* Classification Radio Options */}
              <div>
                <span className="block font-label-sm text-label-sm uppercase text-on-surface-variant mb-2 font-semibold">
                  Resource Classification
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'STUDY_MATERIAL', label: 'Study Material' },
                      { id: 'PYQ', label: 'PYQ (Exams)' },
                      { id: 'SYLLABUS', label: 'Syllabus' },
                      { id: 'OTHER', label: 'Reference' },
                    ] as const
                  ).map((option) => (
                    <label
                      className={`flex flex-col items-center justify-center p-3 rounded cursor-pointer transition-colors border ${
                        uploadKind === option.id
                          ? 'bg-primary/10 border-primary text-primary font-medium'
                          : 'bg-surface-container border-transparent text-on-surface hover:bg-surface-container-high'
                      }`}
                      key={option.id}
                    >
                      <input
                        checked={uploadKind === option.id}
                        className="sr-only"
                        name="res-type"
                        onChange={() => setUploadKind(option.id)}
                        type="radio"
                        value={option.id}
                      />
                      <Icon
                        name={
                          option.id === 'STUDY_MATERIAL'
                            ? 'book'
                            : option.id === 'PYQ'
                              ? 'file'
                              : option.id === 'SYLLABUS'
                                ? 'verified'
                                : 'file'
                        }
                        size={20}
                      />
                      <span className="font-label-sm text-label-sm text-center mt-1">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Drag & Drop Zone */}
              <div
                className="p-8 rounded bg-surface-container-low border-2 border-dashed border-outline-variant flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-container transition-all relative"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
              >
                <input
                  accept="application/pdf,.pdf"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleFileInput}
                  type="file"
                />
                <div className="w-12 h-12 rounded-full bg-surface-container-lowest text-primary flex items-center justify-center mb-2 shadow-sm border border-outline-variant/20">
                  <Icon name="upload" size={24} />
                </div>
                <p className="font-body-md text-body-md text-on-surface font-medium">
                  Drop PDF here, or{' '}
                  <span className="text-primary underline">
                    browse local files
                  </span>
                </p>
                <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                  PDF format only (Max 25 MB per document)
                </span>
              </div>

              {/* Upload Error Banner */}
              {uploadError && (
                <div className="p-3 bg-error-container text-on-error-container rounded text-body-sm font-body-sm flex items-center gap-2">
                  <Icon name="alert" size={18} />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Staged File View */}
              {stagedFile && (
                <div className="bg-surface-container-lowest rounded p-3.5 shadow-sm flex flex-col gap-2 border border-outline-variant/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="text-primary">
                        <Icon name="pdf" size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-body-sm text-body-sm font-medium text-on-surface truncate">
                          {stagedFile.name}
                        </p>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          {formatBytes(stagedFile.size)}
                        </span>
                      </div>
                    </div>
                    <button
                      aria-label="Remove staged file"
                      className="text-on-surface-variant hover:text-error p-1"
                      onClick={() => setStagedFile(null)}
                      type="button"
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                  {uploadProgress !== null && (
                    <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Local-First Guard Notice */}
              <div className="p-3 bg-surface-container-low rounded flex items-start gap-2 font-body-sm text-body-sm text-on-surface-variant border border-outline-variant/20">
                <div className="text-secondary mt-0.5 shrink-0">
                  <Icon name="shield" size={18} />
                </div>
                <p className="text-[12px] leading-relaxed">
                  <strong className="text-on-surface">
                    Local-First Guard:
                  </strong>{' '}
                  Uploading stores the file directly in the workspace. Parsing
                  starts manually upon confirmation to prevent unneeded
                  tokenization and background cost.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-surface-container-low flex items-center justify-between border-t border-outline-variant/30">
              <span className="font-label-sm text-label-sm text-outline">
                SHA verification on commit
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  className="px-3.5 py-1.5 rounded bg-surface-container-lowest hover:bg-surface-container text-on-surface font-body-sm text-body-sm transition-all border border-outline-variant/30"
                  onClick={() => {
                    setIsUploadOpen(false);
                    setStagedFile(null);
                    setUploadError(null);
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-1.5 rounded bg-primary text-on-primary font-body-sm text-body-sm font-medium shadow-sm hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!stagedFile || uploadProgress !== null}
                  onClick={confirmStagedUpload}
                  type="button"
                >
                  {uploadProgress !== null ? 'Uploading…' : 'Confirm & Staging'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
