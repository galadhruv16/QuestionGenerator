import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  demoQuestions,
  ProjectQuestionsPage,
} from '../src/app/pages/ProjectQuestionsPage';

function renderQuestionsPage(
  initialQuestions = demoQuestions,
  projectId = '123e4567-e89b-12d3-a456-426614174000',
) {
  window.history.pushState({}, '', `/app/projects/${projectId}/questions`);
  return render(
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <ProjectQuestionsPage initialQuestions={initialQuestions} />
          }
          path="/app/projects/:projectId/questions"
        />
      </Routes>
    </BrowserRouter>,
  );
}

describe('ProjectQuestionsPage', () => {
  it('renders the question review header, breadcrumbs, telemetry, and pipeline tabs', () => {
    renderQuestionsPage();

    expect(screen.getAllByText('Question Review').length).toBeGreaterThan(0);
    expect(screen.getByText('Workspaces')).toBeInTheDocument();
    expect(
      screen.getByText(/Questions Synthesized/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/100% Grounded/i)).toBeInTheDocument();

    // Check pipeline tabs
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('Topic Map')).toBeInTheDocument();
    expect(screen.getByText('03')).toBeInTheDocument();
    expect(screen.getByText('Generation Studio')).toBeInTheDocument();
  });

  it('renders the 3-column split-pane layout: Slicer Sidebar, Feed, and Deep Inspection', () => {
    renderQuestionsPage();

    // Column A Sidebar filters
    expect(screen.getByText('Review Status')).toBeInTheDocument();
    expect(screen.getByText('All Items')).toBeInTheDocument();
    expect(screen.getByText('Available / Review')).toBeInTheDocument();
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.getByText('Curriculum Module')).toBeInTheDocument();
    expect(screen.getByText('Cognitive Level (Bloom)')).toBeInTheDocument();
    expect(
      screen.getAllByText('Difficulty Rating').length,
    ).toBeGreaterThan(0);

    // Column B List Feed
    expect(screen.getByText(/Questions Found/i)).toBeInTheDocument();
    expect(screen.getByText('Bulk Accept')).toBeInTheDocument();

    // Column C Deep Inspection Pane
    expect(screen.getByText(/Question #01/i)).toBeInTheDocument();
    expect(
      screen.getByText('Question Stem & Pedagogical Rationale'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Grounding Evidence & PDF Citation'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Automated 3-Point Validation Ledger'),
    ).toBeInTheDocument();
  });

  it('renders options distractor ledger and evidence grounding citation for active question', () => {
    renderQuestionsPage();

    expect(
      screen.getByText('Assessment Options & Distractor Ledger'),
    ).toBeInTheDocument();
    expect(screen.getByText('CORRECT ANSWER')).toBeInTheDocument();
    expect(
      screen.getByText('SHA-256 Byte-Lock Verified'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cosine Semantic Similarity/i)).toBeInTheDocument();
    expect(screen.getByText('Accept Question to Bank')).toBeInTheDocument();
  });

  it('allows filtering by review status pills', () => {
    renderQuestionsPage();

    const acceptedFilter = screen.getByText('Accepted');
    fireEvent.click(acceptedFilter);

    // Filtered feed should update
    expect(screen.getByText(/Questions Found/i)).toBeInTheDocument();
  });

  it('allows accepting a question from the bottom action bar', () => {
    renderQuestionsPage();

    const acceptBtn = screen.getByRole('button', {
      name: /Accept Question to Bank/i,
    });
    fireEvent.click(acceptBtn);

    expect(
      screen.getByText(/Question marked as ACCEPTED/i),
    ).toBeInTheDocument();
  });

  it('opens and closes the Edit Version modal to edit question stem and distractors', () => {
    renderQuestionsPage();

    const editBtn = screen.getByRole('button', { name: /Edit Version/i });
    fireEvent.click(editBtn);

    expect(
      screen.getByText('Edit Question Stem & Distractors'),
    ).toBeInTheDocument();
    expect(screen.getByText('Save as New Immutable Version')).toBeInTheDocument();

    // Click cancel
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(
      screen.queryByText('Edit Question Stem & Distractors'),
    ).not.toBeInTheDocument();
  });
});
