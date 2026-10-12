import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProjectGenerationPage } from '../src/app/pages/ProjectGenerationPage';

function renderGenerationPage(
  projectId = '123e4567-e89b-12d3-a456-426614174000',
) {
  window.history.pushState({}, '', `/app/projects/${projectId}/generation`);
  return render(
    <BrowserRouter>
      <Routes>
        <Route
          element={<ProjectGenerationPage />}
          path="/app/projects/:projectId/generation"
        />
      </Routes>
    </BrowserRouter>,
  );
}

describe('ProjectGenerationPage', () => {
  it('renders the generation studio header, breadcrumbs, telemetry, and pipeline tabs', () => {
    renderGenerationPage();

    expect(screen.getByText('Generation Studio')).toBeInTheDocument();
    expect(screen.getAllByText('Projects').length).toBeGreaterThan(0);
    expect(screen.getByText(/Corpus:/i)).toBeInTheDocument();
    expect(
      screen.getByText('Grounding Index: 100% Locked'),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Chunks Mapped/i).length).toBeGreaterThan(0);

    // Check pipeline tabs
    expect(screen.getByText('3. Generation Studio')).toBeInTheDocument();
    expect(screen.getByText(/1. Resources/i)).toBeInTheDocument();
    expect(screen.getByText(/2. Topics/i)).toBeInTheDocument();
  });

  it('renders the 4 blueprint archetype cards', () => {
    renderGenerationPage();

    expect(screen.getByText('Balanced Exam Prep')).toBeInTheDocument();
    expect(screen.getByText('High-Order Analytical')).toBeInTheDocument();
    expect(screen.getByText('Foundational Recall')).toBeInTheDocument();
    expect(screen.getByText('Custom Blueprint')).toBeInTheDocument();
  });

  it('renders Vector Matrices for curriculum, bloom, difficulty, and quality safeguards', () => {
    renderGenerationPage();

    expect(
      screen.getByText('1. Curriculum Distribution & Topic Targets'),
    ).toBeInTheDocument();
    expect(
      screen.getByText("2. Pedagogical Depth (Bloom's Taxonomy)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText('3. Difficulty & Question Formats'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('4. Grounding Policy & Quality Invariants'),
    ).toBeInTheDocument();

    // Bloom tiers
    expect(screen.getByText('L1: Remember')).toBeInTheDocument();
    expect(screen.getByText('L2: Understand')).toBeInTheDocument();
    expect(screen.getByText('L3: Apply')).toBeInTheDocument();
    expect(screen.getByText('L4: Analyze (Core)')).toBeInTheDocument();
    expect(screen.getByText('L5: Evaluate')).toBeInTheDocument();
    expect(screen.getByText('L6: Synthesize')).toBeInTheDocument();

    // Invariants
    expect(screen.getByText('Duplicate Prevention Policy')).toBeInTheDocument();
    expect(screen.getByText('Grounding Citation Anchors')).toBeInTheDocument();
  });

  it('renders the Cockpit Controller and generation launcher', () => {
    renderGenerationPage();

    expect(
      screen.getByText('Generation Blueprint Summary'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Synthesis Pipeline Execution'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /Generate \d+ Questions from Blueprint/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Save as Preset')).toBeInTheDocument();
    expect(screen.getByText('Export Spec (.JSON)')).toBeInTheDocument();
  });

  it('switches active archetype when clicking preset cards', () => {
    renderGenerationPage();

    const highOrderBtn = screen
      .getByText('High-Order Analytical')
      .closest('button');
    expect(highOrderBtn).not.toBeNull();
    if (highOrderBtn) {
      fireEvent.click(highOrderBtn);
    }

    // Question count updates to 10
    expect(
      screen.getByRole('button', {
        name: /Generate 10 Questions from Blueprint/i,
      }),
    ).toBeInTheDocument();

    const recallBtn = screen.getByText('Foundational Recall').closest('button');
    expect(recallBtn).not.toBeNull();
    if (recallBtn) {
      fireEvent.click(recallBtn);
    }

    // Question count updates to 20
    expect(
      screen.getByRole('button', {
        name: /Generate 20 Questions from Blueprint/i,
      }),
    ).toBeInTheDocument();
  });

  it('opens and closes the save preset modal', () => {
    renderGenerationPage();

    const savePresetBtn = screen.getByText('Save as Preset').closest('button');
    if (savePresetBtn) {
      fireEvent.click(savePresetBtn);
    }

    expect(screen.getByText('Save Blueprint as Preset')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/e\.g\., Midterm Advanced Analysis/i),
    ).toBeInTheDocument();

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(
      screen.queryByText('Save Blueprint as Preset'),
    ).not.toBeInTheDocument();
  });
});
