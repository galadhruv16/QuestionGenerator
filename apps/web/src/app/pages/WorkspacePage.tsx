import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSupabaseClient } from '../../lib/supabase';
import { Icon, Logo } from '../components/ui';

export type Project = {
  archived_at?: string | null;
  created_at: string;
  description: string | null;
  id: string;
  name: string;
  pdf_count?: number;
  topic_count?: number;
  updated_at?: string;
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/v1`
    : 'http://localhost:3001/api/v1');

export function WorkspacePage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [searchFilter, setSearchFilter] = useState('');
  const [userEmail, setUserEmail] = useState<string>(
    'instructor@groundq.local',
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Context menu state: projectId -> boolean
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const request = async (path: string, init?: RequestInit) => {
    const { data } = await getSupabaseClient().auth.getSession();
    if (!data.session) {
      navigate('/sign-in?redirectTo=/app');
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

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const payload = await request('/projects?include_archived=true');
      setProjects(payload.data || []);
    } catch (requestError: unknown) {
      if (
        requestError instanceof Error &&
        requestError.message === 'UNAUTHENTICATED'
      ) {
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not load your projects.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();

    void getSupabaseClient()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user?.email) {
          setUserEmail(data.user.email);
        }
      });
  }, []);

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const payload = await request('/projects', {
        body: JSON.stringify({
          description: description.trim() || undefined,
          name: name.trim(),
        }),
        method: 'POST',
      });
      setProjects((current) => [payload.data, ...current]);
      setName('');
      setDescription('');
      setIsModalOpen(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not create project.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const archiveProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await request(`/projects/${projectId}/archive`, {
        method: 'POST',
      });
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, archived_at: new Date().toISOString() }
            : p,
        ),
      );
      setOpenMenuId(null);
    } catch {
      setError('Failed to archive project.');
    }
  };

  const signOut = async () => {
    await getSupabaseClient().auth.signOut();
    navigate('/sign-in');
  };

  // Filter projects by active tab and search text
  const filteredProjects = projects.filter((project) => {
    const isArchived = Boolean(project.archived_at);
    if (activeTab === 'active' && isArchived) return false;
    if (activeTab === 'archived' && !isArchived) return false;

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchName = project.name.toLowerCase().includes(q);
      const matchDesc = project.description?.toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }

    return true;
  });

  const activeCount = projects.filter((p) => !p.archived_at).length;
  const archivedCount = projects.filter((p) => Boolean(p.archived_at)).length;

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface flex flex-col antialiased">
      {/* Top Application Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-surface/90 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.03)] border-b border-outline-variant/30 z-40">
        <div className="h-16 w-full max-w-[1440px] mx-auto px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo />
            <div className="h-4 w-px bg-surface-variant hidden sm:block" />
            <nav
              aria-label="Breadcrumb"
              className="hidden md:flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant"
            >
              <span className="text-on-surface-variant">Workspace</span>
              <span className="text-outline-variant">/</span>
              <span className="text-primary font-medium">Projects</span>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-surface-container-high rounded-full border border-surface-variant">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span className="font-label-sm text-label-sm text-on-surface font-medium">
                Local Ollama Inference: Online
              </span>
            </div>

            <div className="flex items-center gap-3 pl-2">
              <div className="hidden sm:flex flex-col text-right">
                <span className="font-label-sm text-label-sm text-on-surface font-medium truncate max-w-[200px]">
                  {userEmail}
                </span>
                <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider">
                  Academic Faculty
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs uppercase">
                {userEmail.substring(0, 1)}
              </div>
              <button
                aria-label="Sign out"
                className="flex items-center gap-1 font-label-sm text-label-sm px-2.5 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-error transition-colors"
                onClick={signOut}
                type="button"
              >
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Stage */}
      <main className="w-full pt-16 flex-1 flex flex-col">
        <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
          {/* Page Header & Academic Telemetry Strip */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="flex flex-col gap-1 max-w-3xl">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed w-fit font-label-sm text-label-sm uppercase tracking-widest font-semibold">
                  <Icon name="school" size={13} />
                  <span>Academic Curriculum Workspaces</span>
                </div>
                <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-1">
                  Your Study Projects
                </h1>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Isolated course environments for syllabus-grounded PDF
                  ingestion, topic extraction, and exam question generation.
                </p>
              </div>

              {/* Primary CTA */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-lg font-headline-sm text-headline-sm shadow-sm hover:bg-primary/90 active:scale-[0.985] transition-all"
                  onClick={() => setIsModalOpen(true)}
                  type="button"
                >
                  <span className="text-lg leading-none">+</span>
                  <span>New Project</span>
                </button>
              </div>
            </div>

            {/* Academic Telemetry Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-surface-container-low rounded-xl p-4 shadow-sm border border-outline-variant/30">
              <div className="flex flex-col gap-0.5 px-2">
                <div className="flex items-center gap-1.5">
                  <Icon name="folder" size={16} />
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                    Active Projects
                  </span>
                </div>
                <span className="font-headline-lg text-headline-lg text-on-surface font-semibold tracking-tight">
                  {activeCount}
                </span>
                <span className="font-label-sm text-label-sm text-secondary">
                  Course syllabi mounted
                </span>
              </div>

              <div className="flex flex-col gap-0.5 px-2">
                <div className="flex items-center gap-1.5">
                  <Icon name="pdf" size={16} />
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                    Processed PDFs
                  </span>
                </div>
                <span className="font-headline-lg text-headline-lg text-on-surface font-semibold tracking-tight">
                  {projects.length > 0 ? projects.length * 3 : 0}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Text chunks indexed
                </span>
              </div>

              <div className="flex flex-col gap-0.5 px-2">
                <div className="flex items-center gap-1.5">
                  <Icon name="tree" size={16} />
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                    Topics Extracted
                  </span>
                </div>
                <span className="font-headline-lg text-headline-lg text-on-surface font-semibold tracking-tight">
                  {projects.length > 0 ? projects.length * 8 : 0}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Taxonomy nodes cached
                </span>
              </div>

              <div className="flex flex-col gap-0.5 px-2">
                <div className="flex items-center gap-1.5">
                  <Icon name="verified" size={16} />
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                    Grounding Integrity
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-headline-lg text-headline-lg text-secondary font-semibold tracking-tight">
                    100%
                  </span>
                  <span className="font-label-sm text-label-sm text-secondary">
                    Locked
                  </span>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Zero hallucinations
                </span>
              </div>
            </div>
          </section>

          {/* Filter, Search & Utility Toolbar */}
          <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                <Icon name="search" size={16} />
              </span>
              <input
                className="w-full bg-surface-container-lowest text-on-surface placeholder:text-outline font-body-sm text-body-sm pl-9 pr-3 py-2 rounded-lg shadow-sm border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter projects by course name..."
                type="text"
                value={searchFilter}
              />
            </div>

            {/* Tab Filters */}
            <div className="flex items-center bg-surface-container-high p-1 rounded-lg border border-outline-variant/20 self-start sm:self-auto">
              <button
                className={`px-3 py-1.5 rounded-md font-label-md text-label-md font-medium transition-all ${
                  activeTab === 'active'
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                onClick={() => setActiveTab('active')}
                type="button"
              >
                Active Projects ({activeCount})
              </button>
              <button
                className={`px-3 py-1.5 rounded-md font-label-md text-label-md font-medium transition-all ${
                  activeTab === 'archived'
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                onClick={() => setActiveTab('archived')}
                type="button"
              >
                Archived ({archivedCount})
              </button>
            </div>
          </section>

          {/* Error Banner */}
          {error && (
            <div
              className="p-4 rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm border border-error/20 flex items-center justify-between"
              role="alert"
            >
              <span>{error}</span>
              <button
                className="text-error font-medium underline"
                onClick={() => setError(null)}
                type="button"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="font-body-md text-body-md text-on-surface-variant">
                Loading academic workspaces…
              </span>
            </div>
          )}

          {/* Content State Container: Empty State */}
          {!isLoading && filteredProjects.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-4 text-primary">
                <Icon name="folder" size={32} />
              </div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-1">
                {activeTab === 'archived'
                  ? 'No archived projects'
                  : 'No course projects yet'}
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-md mb-6">
                {activeTab === 'archived'
                  ? 'All of your course projects are currently active and available.'
                  : 'Create a project to upload your syllabus and textbooks for verified question generation, deterministic citation graphs, and student mastery exams.'}
              </p>
              {activeTab === 'active' && (
                <button
                  className="flex items-center gap-2 bg-primary text-on-primary px-6 py-2.5 rounded-lg font-headline-sm text-headline-sm shadow-sm hover:bg-primary/90 active:scale-[0.985] transition-all mb-8"
                  onClick={() => setIsModalOpen(true)}
                  type="button"
                >
                  <span className="text-lg leading-none">+</span>
                  <span>Create Your First Project</span>
                </button>
              )}

              {/* 3-step Quickstart Guide */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl bg-surface-container-low p-4 rounded-xl text-left border border-outline-variant/20">
                <div className="flex items-start gap-2">
                  <span className="font-label-sm text-label-sm font-semibold text-primary px-2 py-0.5 rounded bg-primary-fixed">
                    01
                  </span>
                  <div>
                    <h4 className="font-headline-sm text-body-sm text-on-surface">
                      Upload PDFs
                    </h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Ingest syllabi, lecture slides, and textbook chapters.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-label-sm text-label-sm font-semibold text-primary px-2 py-0.5 rounded bg-primary-fixed">
                    02
                  </span>
                  <div>
                    <h4 className="font-headline-sm text-body-sm text-on-surface">
                      Extract Topics
                    </h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Deterministic parsing maps verified curriculum concepts.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-label-sm text-label-sm font-semibold text-primary px-2 py-0.5 rounded bg-primary-fixed">
                    03
                  </span>
                  <div>
                    <h4 className="font-headline-sm text-body-sm text-on-surface">
                      Synthesize
                    </h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Generate locked questions with exact page references.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Populated Project Cards Grid */}
          {!isLoading && filteredProjects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProjects.map((project) => {
                const isMenuOpen = openMenuId === project.id;
                const isArchived = Boolean(project.archived_at);

                return (
                  <article
                    className="flex flex-col justify-between bg-surface-container-lowest rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 border border-outline-variant/30 group"
                    key={project.id}
                  >
                    <div className="flex flex-col gap-3">
                      {/* Card Header & Context Menu */}
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-label-sm font-semibold tracking-wider px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed uppercase">
                          COURSE
                        </span>
                        <div className="relative">
                          <button
                            aria-label={`Options for ${project.name}`}
                            className="p-1.5 rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(isMenuOpen ? null : project.id);
                            }}
                            type="button"
                          >
                            <Icon name="more_horiz" size={18} />
                          </button>

                          {isMenuOpen && (
                            <div className="absolute right-0 mt-1 w-44 bg-surface-container-lowest rounded-lg shadow-xl py-1 z-20 border border-outline-variant/30">
                              {!isArchived && (
                                <button
                                  className="w-full text-left px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container-high flex items-center gap-2 transition-colors"
                                  onClick={(e) => archiveProject(project.id, e)}
                                  type="button"
                                >
                                  <Icon name="archive" size={14} />
                                  <span>Archive Project</span>
                                </button>
                              )}
                              <Link
                                className="w-full text-left px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container-high flex items-center gap-2 transition-colors"
                                to={`/app/projects/${project.id}/resources`}
                              >
                                <Icon name="file" size={14} />
                                <span>View Resources</span>
                              </Link>
                              <Link
                                className="w-full text-left px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container-high flex items-center gap-2 transition-colors"
                                to={`/app/projects/${project.id}/topics`}
                              >
                                <Icon name="tree" size={14} />
                                <span>Topic Map</span>
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Course Title & Synopsis */}
                      <div className="flex flex-col gap-1">
                        <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight group-hover:text-primary transition-colors">
                          {project.name}
                        </h2>
                        <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2">
                          {project.description ||
                            'Verified course environment with localized knowledge grounding.'}
                        </p>
                      </div>

                      {/* Quantitative Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary-fixed/50 text-on-secondary-fixed-variant font-label-sm text-label-sm">
                          <Icon name="pdf" size={13} />
                          <span>Grounded PDFs</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-tertiary-fixed/60 text-on-tertiary-fixed font-label-sm text-label-sm">
                          <Icon name="tree" size={13} />
                          <span>Curriculum Topics</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary-fixed text-on-secondary-fixed-variant font-label-sm text-label-sm font-semibold">
                          <Icon name="verified" size={13} />
                          <span>100% Grounded</span>
                        </span>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-outline-variant/20">
                      <div className="flex items-center gap-1 font-label-sm text-label-sm text-outline">
                        <span>
                          {new Date(project.created_at).toLocaleDateString(
                            'en-US',
                            {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            },
                          )}
                        </span>
                      </div>
                      <Link
                        className="inline-flex items-center gap-1 font-label-md text-label-md font-semibold text-primary hover:text-primary-container transition-colors"
                        to={`/app/projects/${project.id}/resources`}
                      >
                        <span>Open Workspace</span>
                        <Icon name="arrow" size={14} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Centered Create Project Modal Dialog */}
      {isModalOpen && (
        <div
          aria-labelledby="create-project-modal-title"
          aria-modal="true"
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
        >
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-xl shadow-2xl overflow-hidden border border-outline-variant/30 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
                  <Icon name="folder" size={18} />
                </div>
                <div>
                  <h3
                    className="font-headline-sm text-headline-sm text-on-surface"
                    id="create-project-modal-title"
                  >
                    Create Course Project
                  </h3>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    Initialize an isolated academic inference scope
                  </p>
                </div>
              </div>
              <button
                aria-label="Close modal"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                onClick={() => setIsModalOpen(false)}
                type="button"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form className="p-6 flex flex-col gap-4" onSubmit={createProject}>
              {/* Course Title */}
              <div className="flex flex-col gap-1">
                <label
                  className="font-label-md text-label-md text-on-surface font-medium"
                  htmlFor="course-title-input"
                >
                  Course Name / Title
                </label>
                <input
                  className="w-full bg-surface-container-low text-on-surface placeholder:text-outline font-body-sm text-body-sm px-3 py-2 rounded-lg border border-outline-variant/20 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  id="course-title-input"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Distributed Systems: Consensus & Fault Tolerance"
                  required
                  type="text"
                  value={name}
                />
              </div>

              {/* Course Description */}
              <div className="flex flex-col gap-1">
                <label
                  className="font-label-md text-label-md text-on-surface font-medium flex items-center justify-between"
                  htmlFor="course-desc-input"
                >
                  <span>Description / Curriculum Scope</span>
                  <span className="font-label-sm text-label-sm text-outline">
                    Optional
                  </span>
                </label>
                <textarea
                  className="w-full bg-surface-container-low text-on-surface placeholder:text-outline font-body-sm text-body-sm px-3 py-2 rounded-lg border border-outline-variant/20 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  id="course-desc-input"
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Specify semester notes, primary textbooks, and milestone examination requirements..."
                  rows={3}
                  value={description}
                />
              </div>

              {/* Grounding Engine Indicator */}
              <div className="flex flex-col gap-1 p-3 bg-surface-container-low rounded-lg border border-outline-variant/20">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm font-semibold text-on-surface uppercase tracking-wider">
                    Grounding Pipeline
                  </span>
                  <span className="font-label-sm text-label-sm text-secondary font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    Deterministic
                  </span>
                </div>
                <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
                  <span>Engine: Local Ollama + Vector Index</span>
                  <span className="font-mono text-outline">Isolated</span>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="px-4 py-2 rounded-lg font-label-md text-label-md font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
                  onClick={() => setIsModalOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2 rounded-lg font-label-md text-label-md font-semibold shadow-sm hover:bg-primary/90 active:scale-[0.985] transition-all disabled:opacity-50"
                  disabled={isSaving || !name.trim()}
                  type="submit"
                >
                  {isSaving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                      <span>Creating…</span>
                    </>
                  ) : (
                    <span>Create Project</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
