import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSupabaseClient } from '../../lib/supabase';
import { Logo } from '../components/ui';

type Project = {
  created_at: string;
  description: string | null;
  id: string;
  name: string;
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1';

export function WorkspacePage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const request = async (path: string, init?: RequestInit) => {
    const { data } = await getSupabaseClient().auth.getSession();
    if (!data.session) {
      navigate('/sign-in');
      throw new Error('Your session has ended. Please sign in again.');
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
    request('/projects')
      .then((payload) => setProjects(payload.data))
      .catch((requestError: unknown) =>
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Could not load your projects.',
        ),
      )
      .finally(() => setIsLoading(false));
  }, []);

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const payload = await request('/projects', {
        body: JSON.stringify({ description: description || undefined, name }),
        method: 'POST',
      });
      setProjects((current) => [payload.data, ...current]);
      setName('');
      setDescription('');
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

  const signOut = async () => {
    await getSupabaseClient().auth.signOut();
    navigate('/');
  };

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <Logo />
        <button className="workspace-signout" onClick={signOut} type="button">
          Sign out
        </button>
      </header>
      <section className="workspace-content">
        <p className="workspace-eyebrow">GROUNDQ / PROJECTS</p>
        <h1>Your study projects</h1>
        <p className="workspace-intro">
          Start with a project. Your resources, topic map, generation runs, and
          question bank will stay isolated inside it.
        </p>
        <form className="project-form" onSubmit={createProject}>
          <label>
            Project name
            <input
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          <label>
            Description <small>Optional</small>
            <textarea
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </label>
          <button disabled={isSaving} type="submit">
            {isSaving ? 'Creating…' : 'Create project'}
          </button>
        </form>
        {error && (
          <p className="workspace-error" role="alert">
            {error}
          </p>
        )}
        <section aria-labelledby="project-list-title" className="project-list">
          <h2 id="project-list-title">Projects</h2>
          {isLoading ? (
            <p>Loading your projects…</p>
          ) : projects.length ? (
            <ul>
              {projects.map((project) => (
                <li key={project.id}>
                  <Link
                    className="project-link"
                    to={`/app/projects/${project.id}/resources`}
                  >
                    <strong>{project.name}</strong>
                    {project.description && <span>{project.description}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No projects yet. Create one to prepare your first study corpus.
            </p>
          )}
        </section>
        <Link className="workspace-home" to="/">
          Return to home
        </Link>
      </section>
    </main>
  );
}
