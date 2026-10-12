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

  it('opens and closes the Add Topic slide-over drawer', () => {
    renderTopicsPage();

    const addTopicBtn = screen.getByRole('button', {
      name: /\+ Add Topic Manually/i,
    });
    fireEvent.click(addTopicBtn);

    expect(screen.getByText('Add Curriculum Topic')).toBeInTheDocument();
    expect(screen.getByText(/Manual Topology/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Topic Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Parent Module/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Pedagogical Depth \(Bloom's Taxonomy\)/i),
    ).toBeInTheDocument();

    // Close drawer
    const closeBtn = screen.getByRole('button', { name: /Close Drawer/i });
    fireEvent.click(closeBtn);
  });
});
