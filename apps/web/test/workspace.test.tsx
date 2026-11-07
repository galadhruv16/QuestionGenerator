import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspacePage, type Project } from '../src/app/pages/WorkspacePage';
import * as supabaseLib from '../src/lib/supabase';

const mockProjects: Project[] = [
  {
    archived_at: null,
    created_at: '2026-10-10T10:00:00Z',
    description: 'Kernel architectures and memory management',
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Operating Systems',
  },
  {
    archived_at: null,
    created_at: '2026-10-11T12:00:00Z',
    description: 'Relational algebra and transaction isolation',
    id: '123e4567-e89b-12d3-a456-426614174002',
    name: 'Database Management',
  },
];

function renderWorkspacePage(initialProjects?: Project[]) {
  window.history.pushState({}, '', '/app');
  return render(
    <BrowserRouter>
      <Routes>
        <Route
          element={<WorkspacePage initialProjects={initialProjects} />}
          path="/app"
        />
      </Routes>
    </BrowserRouter>,
  );
}

describe('WorkspacePage', () => {
  beforeEach(() => {
    vi.spyOn(supabaseLib, 'getSupabaseClient').mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: { access_token: 'fake-jwt-token' },
          },
        }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { email: 'instructor@groundq.local' },
          },
        }),
        signOut: vi.fn().mockResolvedValue({}),
      },
    } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the course workspaces header, breadcrumbs, telemetry strip, and tabs', () => {
    renderWorkspacePage();

    expect(screen.getByText('Your Study Projects')).toBeInTheDocument();
    expect(
      screen.getByText(/Academic Curriculum Workspaces/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Active Projects')).toBeInTheDocument();
    expect(screen.getByText('Processed PDFs')).toBeInTheDocument();
    expect(screen.getByText('Topics Extracted')).toBeInTheDocument();
    expect(screen.getByText('Grounding Integrity')).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /\+ New Project/i }),
    ).toBeInTheDocument();
  });

  it('opens and closes the centered create project modal', () => {
    renderWorkspacePage();

    const newProjectBtn = screen.getByRole('button', {
      name: /\+ New Project/i,
    });
    fireEvent.click(newProjectBtn);

    expect(screen.getByText('Create Course Project')).toBeInTheDocument();
    expect(
      screen.getByText('Initialize an isolated academic inference scope'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Course Name \/ Title/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Description \/ Curriculum Scope/i),
    ).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(closeBtn);

    expect(
      screen.queryByText('Initialize an isolated academic inference scope'),
    ).not.toBeInTheDocument();
  });

  it('renders active project cards with rename and archive controls', () => {
    renderWorkspacePage(mockProjects);

    expect(screen.getByText('Operating Systems')).toBeInTheDocument();
    expect(screen.getByText('Database Management')).toBeInTheDocument();
    expect(screen.getByText('Active Projects (2)')).toBeInTheDocument();
    expect(screen.getByText('Archived (0)')).toBeInTheDocument();

    // Verify edit and delete buttons on project cards
    expect(
      screen.getByRole('button', { name: 'Edit Operating Systems' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete Operating Systems' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit Database Management' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete Database Management' }),
    ).toBeInTheDocument();
  });

  it('opens and closes the rename modal with Escape key or Cancel button', () => {
    renderWorkspacePage(mockProjects);

    const editBtn = screen.getByRole('button', {
      name: 'Edit Operating Systems',
    });
    fireEvent.click(editBtn);

    expect(
      screen.getByRole('heading', { name: 'Rename Course Project' }),
    ).toBeInTheDocument();
    const input = screen.getByLabelText(
      /Course Name \/ Title/i,
    ) as HTMLInputElement;
    expect(input.value).toBe('Operating Systems');

    // Press Escape to cancel
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(
      screen.queryByRole('heading', { name: 'Rename Course Project' }),
    ).not.toBeInTheDocument();

    // Open again and click Cancel button
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Operating Systems' }),
    );
    expect(
      screen.getByRole('heading', { name: 'Rename Course Project' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByRole('heading', { name: 'Rename Course Project' }),
    ).not.toBeInTheDocument();
  });

  it('renames a project and updates UI immediately with toast notification', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            ...mockProjects[0],
            name: 'Advanced Operating Systems',
          },
        }),
      }),
    );

    renderWorkspacePage(mockProjects);

    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Operating Systems' }),
    );

    const input = screen.getByLabelText(/Course Name \/ Title/i);
    fireEvent.change(input, {
      target: { value: 'Advanced Operating Systems' },
    });

    const saveBtn = screen.getByRole('button', { name: 'Save Changes' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Advanced Operating Systems'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Project renamed to "Advanced Operating Systems"/i),
      ).toBeInTheDocument();
    });
  });

  it('opens the archive confirmation modal with safe retention notice and project name', () => {
    renderWorkspacePage(mockProjects);

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Database Management' }),
    );

    expect(
      screen.getByRole('heading', { name: 'Archive Project' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete and archive/i),
    ).toBeInTheDocument();
    expect(screen.getByText('"Database Management"')).toBeInTheDocument();
    expect(screen.getByText('Safe Archive Guarantee')).toBeInTheDocument();
    expect(
      screen.getByText(
        /This project will disappear from your Active Projects list and move to the Archived view./i,
      ),
    ).toBeInTheDocument();

    // Cancel leaves it intact
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByText('Safe Archive Guarantee'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Database Management')).toBeInTheDocument();
  });

  it('archives a project, updates active/archived counts, and displays archived project in archived view', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            ...mockProjects[1],
            archived_at: '2026-11-07T12:00:00Z',
          },
        }),
      }),
    );

    renderWorkspacePage(mockProjects);

    expect(screen.getByText('Active Projects (2)')).toBeInTheDocument();
    expect(screen.getByText('Archived (0)')).toBeInTheDocument();

    // Open archive modal for Database Management
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Database Management' }),
    );

    // Confirm Archive
    const archiveConfirmBtn = screen.getByRole('button', {
      name: 'Archive Project',
    });
    fireEvent.click(archiveConfirmBtn);

    await waitFor(() => {
      expect(screen.getByText('Active Projects (1)')).toBeInTheDocument();
      expect(screen.getByText('Archived (1)')).toBeInTheDocument();
      expect(
        screen.getByText(/Project "Database Management" was archived/i),
      ).toBeInTheDocument();
    });

    // Database Management should no longer be visible in the Active list
    expect(screen.queryByText('Database Management')).not.toBeInTheDocument();
    expect(screen.getByText('Operating Systems')).toBeInTheDocument();

    // Switch to Archived tab
    fireEvent.click(screen.getByText('Archived (1)'));
    expect(screen.getByText('Database Management')).toBeInTheDocument();
    expect(screen.getByText('ARCHIVED')).toBeInTheDocument();
  });
});
