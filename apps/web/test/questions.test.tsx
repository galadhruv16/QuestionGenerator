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
    expect(screen.getByRole('button', { name: /Show Answer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show Grounding/i })).toBeInTheDocument();
    expect(
      screen.queryByText('Automated 3-Point Validation Ledger'),
    ).not.toBeInTheDocument();
  });

  it('handles Show Answer and Show Grounding toggle buttons for active question', () => {
    renderQuestionsPage();

    expect(screen.getByText('Assessment Options')).toBeInTheDocument();
    // Correct answer hidden initially
    expect(screen.queryByText('CORRECT ANSWER')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Grounding Evidence & PDF Citation'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Cosine Semantic Similarity/i)).not.toBeInTheDocument();

    // Toggle Show Answer
    const showAnswerBtn = screen.getByRole('button', { name: /Show Answer/i });
    fireEvent.click(showAnswerBtn);

    expect(screen.getByText('CORRECT ANSWER')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hide Answer/i })).toBeInTheDocument();

    // Toggle Show Grounding
    const showGroundingBtn = screen.getByRole('button', { name: /Show Grounding/i });
    fireEvent.click(showGroundingBtn);

    expect(
      screen.getByText('Grounding Evidence & PDF Citation'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hide Grounding/i })).toBeInTheDocument();
    expect(screen.getByText(/Page 14/i)).toBeInTheDocument();
    expect(screen.getByText(/#chk-092/i)).toBeInTheDocument();

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

  it('opens and closes the Targeted Regeneration Tweak Drawer when clicking Regenerate in Place', () => {
    renderQuestionsPage();

    // Question #01 is available by default
    const regenBtn = screen.getByRole('button', { name: /Regenerate in Place/i });
    expect(regenBtn).toBeInTheDocument();
    fireEvent.click(regenBtn);

    // Tweak drawer should open
    expect(
      screen.getByText('Targeted Regeneration'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Target Cognitive Level (Bloom)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Difficulty Calibration')).toBeInTheDocument();
    expect(
      screen.getByText('AI Inference Engine & Model'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Instructor Direction (Optional Prompt Tweak)'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Deduplication Active · Cosine similarity lock/i),
    ).toBeInTheDocument();

    // Close the drawer
    const closeBtn = screen.getByRole('button', { name: /Close drawer/i });
    fireEvent.click(closeBtn);

    expect(
      screen.queryByText('Targeted Regeneration'),
    ).not.toBeInTheDocument();
  });

  it('locks accepted questions from mutation and shows locked badge instead of regenerate button', () => {
    renderQuestionsPage();

    // Question #04 in demoQuestions is ACCEPTED
    const q4Card = screen.getByText(/Coffman's formal taxonomy/i);
    fireEvent.click(q4Card);

    // Should display Locked (Accepted) badge in bottom bar instead of active regenerate button
    expect(screen.getByText('Locked (Accepted)')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Regenerate in Place/i }),
    ).not.toBeInTheDocument();
  });

  it('shows Bulk Regenerate button when questions are selected and opens the bulk modal', () => {
    renderQuestionsPage();

    // Select all questions
    const selectAllCheckbox = screen.getByLabelText(/Select all questions/i);
    fireEvent.click(selectAllCheckbox);

    // Bulk Regenerate button appears
    const bulkRegenBtn = screen.getByRole('button', {
      name: /Bulk Regenerate/i,
    });
    expect(bulkRegenBtn).toBeInTheDocument();

    fireEvent.click(bulkRegenBtn);

    // Bulk modal opens
    expect(
      screen.getByText('Bulk Regenerate Selected Questions'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/questions will be automatically preserved without alteration/i),
    ).toBeInTheDocument();

    // Close bulk modal
    const cancelModalBtn = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(cancelModalBtn);

    expect(
      screen.queryByText('Bulk Regenerate Selected Questions'),
    ).not.toBeInTheDocument();
  });
});

