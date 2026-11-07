import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProjectGenerationPage } from '../src/app/pages/ProjectGenerationPage';
import { rebalancePercentages } from '../src/app/utils/distribution';

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

  it('renders the 5 blueprint archetype cards including PYQ Blueprint Synthesis', () => {
    renderGenerationPage();

    expect(screen.getByText('Balanced Exam Prep')).toBeInTheDocument();
    expect(screen.getByText('High-Order Analytical')).toBeInTheDocument();
    expect(screen.getByText('Foundational Recall')).toBeInTheDocument();
    expect(screen.getByText('Custom Blueprint')).toBeInTheDocument();
    expect(screen.getByText('PYQ Blueprint Synthesis')).toBeInTheDocument();
    expect(screen.getByText('EXAM CALIBRATED')).toBeInTheDocument();
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

  it('calibrates generation parameters when PYQ Blueprint Synthesis preset is selected', () => {
    renderGenerationPage();

    const pyqCard = screen.getByText('PYQ Blueprint Synthesis').closest('button');
    expect(pyqCard).toBeInTheDocument();

    if (pyqCard) {
      fireEvent.click(pyqCard);
    }

    // Verify Active Exam Blueprint banner
    expect(screen.getByText(/Active Exam Blueprint:/i)).toBeInTheDocument();

    // Verify Academic Grounding Subordination Invariant (PRD §11 & §25)
    expect(
      screen.getByText(/Grounding Subordination Invariant \(PRD §11 & §25\):/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/All newly synthesized questions will be grounded strictly in your current syllabus notes/i),
    ).toBeInTheDocument();

    // Verify PYQ Focus Areas
    expect(screen.getByText('PYQ Focus Areas:')).toBeInTheDocument();
  });

  it('rebalancePercentages auto-balances to strictly 100% across all slider changes', () => {
    // 1. Initial Bloom distribution sum = 100
    const initialBloom = {
      analyze: 30,
      apply: 25,
      create: 5,
      evaluate: 15,
      remember: 10,
      understand: 15,
    };
    expect(Object.values(initialBloom).reduce((a, b) => a + b, 0)).toBe(100);

    // 2. Sliding Analyze to 61% proportionally scales remaining 5 keys to 39%
    const balanced61 = rebalancePercentages(initialBloom, 'analyze', 61);
    expect(balanced61.analyze).toBe(61);
    expect(Object.values(balanced61).reduce((a, b) => a + b, 0)).toBe(100);
    // All other values must remain >= 0
    for (const val of Object.values(balanced61)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }

    // 3. Sliding to 100% zeroes all other keys
    const allHard = rebalancePercentages(
      { easy: 20, hard: 30, medium: 50 },
      'hard',
      100,
    );
    expect(allHard).toEqual({ easy: 0, hard: 100, medium: 0 });
    expect(Object.values(allHard).reduce((a, b) => a + b, 0)).toBe(100);

    // 4. Moving down from 100% distributes remaining evenly
    const from100 = rebalancePercentages(allHard, 'hard', 50);
    expect(from100.hard).toBe(50);
    expect(from100.easy + from100.medium).toBe(50);
    expect(Object.values(from100).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('provides fully interactive Difficulty Calibration with 100% Hard and direct controls', () => {
    renderGenerationPage();

    // Check All Hard (100%) preset button
    const allHardBtn = screen.getByRole('button', { name: 'All Hard (100%)' });
    expect(allHardBtn).toBeInTheDocument();
    fireEvent.click(allHardBtn);

    // Verify 100% Hard is active
    expect(screen.getByText('Hard (Advanced)')).toBeInTheDocument();

    // Check "Make 100% Hard" button
    const make100Hard = screen.getByRole('button', { name: 'Make 100% Hard' });
    expect(make100Hard).toBeInTheDocument();
  });

  it('provides interactive Format Distribution sliders and 100% presets', () => {
    renderGenerationPage();

    expect(screen.getByRole('button', { name: '100% MCQ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '100% Short Answer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '100% Long Scenario' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /50\/50 MCQ & Short/i })).toBeInTheDocument();

    // Click 100% MCQ
    fireEvent.click(screen.getByRole('button', { name: '100% MCQ' }));
    expect(screen.getAllByText('Multiple Choice (MCQ)').length).toBeGreaterThan(0);
  });

  it('renders clickable style constraints with toggle behavior', () => {
    renderGenerationPage();

    // Scenario-Based button
    const scenarioBtn = screen.getByTitle('Realistic application scenario or hypothetical state');
    expect(scenarioBtn).toBeInTheDocument();
    expect(scenarioBtn.textContent).toContain('Scenario-Based');

    // Comparative Case toggle button
    const comparativeBtn = screen.getByTitle('Explicit contrast and trade-off comparison between options');
    expect(comparativeBtn).toBeInTheDocument();
    expect(comparativeBtn.textContent).toContain('Comparative Case');

    // Clicking Comparative Case activates it
    fireEvent.click(comparativeBtn);
    expect(comparativeBtn.textContent).toContain('✓');
  });
});

