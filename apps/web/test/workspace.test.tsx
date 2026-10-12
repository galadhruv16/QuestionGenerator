import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { WorkspacePage } from '../src/app/pages/WorkspacePage';

function renderWorkspacePage() {
  window.history.pushState({}, '', '/app');
  return render(
    <BrowserRouter>
      <Routes>
        <Route element={<WorkspacePage />} path="/app" />
      </Routes>
    </BrowserRouter>,
  );
}

describe('WorkspacePage', () => {
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
});
