import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  ProjectTopicsPage,
  mockDemoModules,
} from '../src/app/pages/ProjectTopicsPage';

function renderTopicsPage(projectId = '123e4567-e89b-12d3-a456-426614174000') {
  window.history.pushState({}, '', `/app/projects/${projectId}/topics`);
  return render(
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <ProjectTopicsPage
              initialModules={mockDemoModules}
              initialReadyCount={3}
              initialTotalCount={5}
            />
          }
          path="/app/projects/:projectId/topics"
        />
      </Routes>
    </BrowserRouter>,
  );
}

describe('ProjectTopicsPage', () => {
  it('renders the course topic map header, breadcrumbs, telemetry, and pipeline tabs', () => {
    renderTopicsPage();

    expect(
      screen.getByText('Topic map & knowledge coverage'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Projects').length).toBeGreaterThan(0);
    expect(screen.getByText('Active Corpus')).toBeInTheDocument();
    expect(screen.getByText('Grounding Index')).toBeInTheDocument();
    expect(screen.getByText('Mapped Chunks')).toBeInTheDocument();

    // Check pipeline tabs
    expect(screen.getAllByText(/Topics/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Resources/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Generation')).toBeInTheDocument();
    expect(screen.getByText('Question Bank')).toBeInTheDocument();
  });

  it('renders the 2-level topic tree with modules and indented subtopics', () => {
    renderTopicsPage();

    // Module cards
    expect(
      screen.getAllByText('Module 1: Process Synchronization & Deadlocks')
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Module 2: Remote Procedure Calls & Distributed IPC')
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        'Module 3: Consensus Protocols & State Machine Replication',
      ).length,
    ).toBeGreaterThan(0);

    // Subtopics
    expect(
      screen.getAllByText("Banker's Algorithm & Resource Allocation").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText('Coffman Conditions & Deadlock Characterization'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Raft Leader Election & Term Monotonicity'),
    ).toBeInTheDocument();
  });

  it('renders the Grounding Evidence Inspector with source quotes and metrics', () => {
    renderTopicsPage();

    expect(
      screen.getByText('Grounding Evidence Inspector'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('100% Locked').length).toBeGreaterThan(0);
    expect(screen.getByText('Linked Chunks')).toBeInTheDocument();
    expect(screen.getByText('Hallucinations')).toBeInTheDocument();
    expect(
      screen.getByText(/Verified Cryptographic Evidence/i),
    ).toBeInTheDocument();
  });

  it('opens and closes the Add Topic slide-over drawer with clean, curriculum-agnostic inputs', () => {
    renderTopicsPage();

    const addTopicBtn = screen.getByRole('button', {
      name: /\+ Add Topic Manually/i,
    });
    fireEvent.click(addTopicBtn);

    expect(screen.getByText('Add Curriculum Topic')).toBeInTheDocument();
    expect(screen.getByText(/Manual Topology/i)).toBeInTheDocument();

    const titleInput = screen.getByLabelText(
      /Topic Title/i,
    ) as HTMLInputElement;
    expect(titleInput).toBeInTheDocument();
    // Verify NOT pre-filled with template strings
    expect(titleInput.value).toBe('');
    expect(screen.queryByText(/Vector Clocks/i)).not.toBeInTheDocument();

    const descriptionInput = screen.getByLabelText(
      /Conceptual Bounds & Key Assertions/i,
    ) as HTMLTextAreaElement;
    expect(descriptionInput.value).toBe('');
    expect(
      screen.queryByText(/happens-before relations/i),
    ).not.toBeInTheDocument();

    expect(screen.getByLabelText(/Parent Module/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Pedagogical Depth \(Bloom's Taxonomy\)/i),
    ).toBeInTheDocument();

    // Verify Bloom's Taxonomy options are standard educational levels
    expect(screen.getByText(/Level 1: Remember/i)).toBeInTheDocument();
    expect(screen.getByText(/Level 2: Understand/i)).toBeInTheDocument();
    expect(screen.getByText(/Level 3: Apply/i)).toBeInTheDocument();
    expect(screen.queryByText(/concurrency races/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Distributed protocol design/i),
    ).not.toBeInTheDocument();

    // Verify Primary Corroborating Source is corpus-scoped and not hardcoded to OS textbook
    const sourceSelect = screen.getByLabelText(
      /Primary Corroborating Source/i,
    ) as HTMLSelectElement;
    expect(sourceSelect).toBeInTheDocument();
    expect(sourceSelect.textContent).toContain(
      'All Project Resources (Corpus-wide)',
    );
    expect(sourceSelect.textContent).not.toContain(
      'Silberschatz_OS_Deadlocks_Ch8.pdf',
    );

    // Fill in a custom Linked Lists topic
    fireEvent.change(titleInput, { target: { value: 'Singly Linked Lists' } });
    fireEvent.change(descriptionInput, {
      target: {
        value:
          'Focus on node structure, next pointer manipulation, and traversal.',
      },
    });
    expect(titleInput.value).toBe('Singly Linked Lists');

    // Close drawer
    const closeBtn = screen.getByRole('button', { name: /Close Drawer/i });
    fireEvent.click(closeBtn);
  });
});
