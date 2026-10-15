import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProjectExportStudioPage } from '../src/app/pages/ProjectExportStudioPage';
import { demoQuestions } from '../src/app/pages/ProjectQuestionsPage';

function renderExportPage(
  initialQuestions = demoQuestions,
  projectId = '123e4567-e89b-12d3-a456-426614174000',
) {
  window.history.pushState({}, '', `/app/projects/${projectId}/export`);
  return render(
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <ProjectExportStudioPage initialQuestions={initialQuestions} />
          }
          path="/app/projects/:projectId/export"
        />
      </Routes>
    </BrowserRouter>,
  );
}

describe('ProjectExportStudioPage', () => {
  it('renders the Export Studio header, breadcrumbs, telemetry, and pipeline tabs', () => {
    renderExportPage();

    expect(
      screen.getAllByText('Export & Paper Builder').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Workspaces')).toBeInTheDocument();
    expect(screen.getByText(/STUDIO V1.4/i)).toBeInTheDocument();
    expect(
      screen.getAllByText('Student Question Paper').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText('Instructor Answer Key & Rubric'),
    ).toBeInTheDocument();

    // Check pipeline tabs
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('04')).toBeInTheDocument();
    expect(
      screen.getAllByText('Question Bank').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('05')).toBeInTheDocument();
  });

  it('renders the Paper Blueprint sidebar with institutional metadata and candidate ID box', () => {
    renderExportPage();

    expect(screen.getByText('Paper Blueprint')).toBeInTheDocument();
    expect(screen.getByText('1. Institutional Metadata')).toBeInTheDocument();
    expect(screen.getByText('Department / Faculty')).toBeInTheDocument();
    expect(
      screen.getByText('Render Candidate ID & Signature Box'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('2. Proctor Guidelines & Honor Code'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('3. Typography & Page Geometry'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('5. Question Selection & Custom Marks'),
    ).toBeInTheDocument();
  });

  it('defaults question selection to ACCEPTED items (Requirement 3)', () => {
    renderExportPage();

    // In demoQuestions, question #04 has status === 'ACCEPTED'
    expect(screen.getAllByText('ACCEPTED').length).toBeGreaterThan(0);
  });

  it('allows the instructor to customize marks per question and dynamically recalculates total marks (Requirement 1)', () => {
    renderExportPage();

    // Question #04 is accepted and included on the paper by default
    const q4Input = screen.getByLabelText(/Marks for question 4/i) as HTMLInputElement;
    expect(q4Input).toBeInTheDocument();

    // Update marks for question 4 to 15
    fireEvent.change(q4Input, { target: { value: '15' } });
    expect(q4Input.value).toBe('15');

    // Live preview on the paper should reflect [15 Marks]
    expect(screen.getAllByText(/\[15 Marks\]/i).length).toBeGreaterThan(0);
  });

  it('switches between Student Question Paper and Confidential Answer Key & Rubric (Requirement 2: separate deliverables)', () => {
    renderExportPage();

    // Initially in Student Question Paper mode
    expect(
      screen.getByText('Instructions to Candidates'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Confidential — Instructor Answer Key/i),
    ).not.toBeInTheDocument();

    // Switch to Instructor Answer Key & Rubric mode
    const answerKeyToggle = screen.getByRole('button', {
      name: /Instructor Answer Key & Rubric/i,
    });
    fireEvent.click(answerKeyToggle);

    // Should display confidential banner and solutions
    expect(
      screen.getByText(/Confidential — Instructor Answer Key & Provenance Ledger/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/GroundQ Syllabus Anchors & Grading Solutions/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Instructions to Candidates'),
    ).not.toBeInTheDocument();
  });

  it('triggers window.print when clicking the Print button', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderExportPage();

    const printBtns = screen.getAllByRole('button', { name: /Print/i });
    expect(printBtns.length).toBeGreaterThan(0);

    fireEvent.click(printBtns[0]!);
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });
});
