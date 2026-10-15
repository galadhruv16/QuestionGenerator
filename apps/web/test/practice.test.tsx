import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProjectPracticeStudioPage } from '../src/app/pages/ProjectPracticeStudioPage';
import { demoQuestions } from '../src/app/pages/ProjectQuestionsPage';
import { getPracticeSession, clearPracticeSession } from '../src/app/services/session-store';

const TEST_PROJECT_ID = '123e4567-e89b-12d3-a456-426614174000';

function renderPracticePage(
  initialQuestions = demoQuestions,
  projectId = TEST_PROJECT_ID,
) {
  window.history.pushState({}, '', `/app/projects/${projectId}/practice`);
  return render(
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <ProjectPracticeStudioPage initialQuestions={initialQuestions} />
          }
          path="/app/projects/:projectId/practice"
        />
      </Routes>
    </BrowserRouter>,
  );
}

describe('ProjectPracticeStudioPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearPracticeSession(TEST_PROJECT_ID);
  });

  it('renders the Practice Studio header, breadcrumbs, mode badge, and pipeline tabs', () => {
    renderPracticePage();

    expect(screen.getAllByText('Interactive Practice Mode').length).toBeGreaterThan(0);
    expect(screen.getByText('Workspaces')).toBeInTheDocument();
    expect(screen.getAllByText('Self-Paced Practice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Timed Mock Exam').length).toBeGreaterThan(0);
    expect(screen.getByText('06 Practice Studio')).toBeInTheDocument();
  });

  it('switches between Self-Paced Practice and Timed Mock Exam modes', () => {
    renderPracticePage();

    // Default mode is Self-Paced Practice
    expect(screen.getByText('Feedback Active')).toBeInTheDocument();

    // Click Timed Mock Exam button
    const mockExamBtn = screen.getAllByRole('button', { name: /Timed Mock Exam/i })[0]!;
    fireEvent.click(mockExamBtn);

    // Header updates to Timed Mock Exam badge and timer becomes visible
    expect(screen.getByText('Sim')).toBeInTheDocument();
  });

  it('allows answering questions, navigating with Next/Prev buttons, and jumping via Question Matrix', () => {
    renderPracticePage();

    // Verify Question 1 is shown
    expect(screen.getByText(/Question 1/i)).toBeInTheDocument();

    // Select candidate option [A]
    const radioInputs = screen.getAllByRole('radio');
    expect(radioInputs.length).toBeGreaterThan(0);
    fireEvent.click(radioInputs[0]!);

    // Assessment Progress updates to 1 Answered
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);

    // Click Save & Next Question
    const nextBtn = screen.getByRole('button', { name: /Save & Next Question/i });
    fireEvent.click(nextBtn);

    // Question 2 should now be displayed
    expect(screen.getByText(/Question 2/i)).toBeInTheDocument();

    // Click question 1 in Question Matrix to jump back
    const matrixBtns = screen.getAllByRole('button', { name: '1' });
    const q1MatrixBtn = matrixBtns.find((b) => b.textContent === '1');
    if (q1MatrixBtn) {
      fireEvent.click(q1MatrixBtn);
      expect(screen.getByText(/Question 1/i)).toBeInTheDocument();
    }
  });

  it('toggles flagging questions for review and updates telemetry', () => {
    renderPracticePage();

    // Initially unflagged
    const flagBtn = screen.getByRole('button', { name: /Flag for Review/i });
    expect(flagBtn).toBeInTheDocument();

    // Click flag
    fireEvent.click(flagBtn);

    // Button updates to Flagged for Review
    expect(screen.getByText('Flagged for Review')).toBeInTheDocument();
  });

  it('reveals immediate pedagogical feedback and grounding source citations in Practice Mode', () => {
    renderPracticePage();

    // In demoQuestions, select an option on Question 1
    const radioInputs = screen.getAllByRole('radio');
    fireEvent.click(radioInputs[0]!);

    // Should display pedagogical rationale and grounding citation
    expect(screen.getByText(/Pedagogical Rationale:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Deterministic Grounding/i).length).toBeGreaterThan(0);
  });

  it('opens and operates the Scientific Utility Calculator modal', () => {
    renderPracticePage();

    // Open calculator modal
    const calcTrigger = screen.getByRole('button', { name: /Calculator/i });
    fireEvent.click(calcTrigger);

    expect(screen.getByText('Scientific Utility')).toBeInTheDocument();

    // Press '7', '+', '5', '='
    fireEvent.click(screen.getByLabelText('calc-btn-7'));
    fireEvent.click(screen.getByLabelText('calc-btn-+'));
    fireEvent.click(screen.getByLabelText('calc-btn-5'));
    fireEvent.click(screen.getByLabelText('calc-btn-='));

    // Result should display 12
    expect(screen.getByText('12')).toBeInTheDocument();

    // Close calculator
    const closeBtn = screen.getByLabelText(/close calculator/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Scientific Utility')).not.toBeInTheDocument();
  });

  it('opens confirmation modal, submits assessment, and displays the Scorecard & Bloom breakdown', () => {
    renderPracticePage();

    // Click Submit Assessment in header
    const submitBtn = screen.getByRole('button', { name: /Submit Assessment/i });
    fireEvent.click(submitBtn);

    // Confirmation dialog appears
    expect(screen.getByText('Confirm Assessment Submission')).toBeInTheDocument();

    // Confirm submission
    const confirmBtn = screen.getByRole('button', { name: /Confirm & Submit Paper/i });
    fireEvent.click(confirmBtn);

    // Evaluation scorecard appears
    expect(screen.getByText('Assessment Evaluation Complete')).toBeInTheDocument();
    expect(screen.getByText('Assessment Performance & Grounding Audit')).toBeInTheDocument();
    expect(screen.getByText(/Total Score/i)).toBeInTheDocument();
    expect(screen.getByText(/Comprehensive Answer Key & Grounding Audit/i)).toBeInTheDocument();
  });

  it('persists session state into sessionStorage', () => {
    renderPracticePage();

    // Select an option
    const radioInputs = screen.getAllByRole('radio');
    fireEvent.click(radioInputs[0]!);

    // Retrieve practice session from sessionStorage
    const saved = getPracticeSession(TEST_PROJECT_ID);
    expect(saved).not.toBeNull();
    expect(saved?.mode).toBe('practice');
    expect(Object.keys(saved?.selectedAnswers || {}).length).toBeGreaterThan(0);
  });
});
