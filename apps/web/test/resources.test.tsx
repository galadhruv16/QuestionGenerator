import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProjectResourcesPage } from '../src/app/pages/ProjectResourcesPage';

function renderResourcesPage(
  projectId = '123e4567-e89b-12d3-a456-426614174000',
) {
  window.history.pushState({}, '', `/app/projects/${projectId}/resources`);
  return render(
    <BrowserRouter>
      <Routes>
        <Route
          element={<ProjectResourcesPage />}
          path="/app/projects/:projectId/resources"
        />
      </Routes>
    </BrowserRouter>,
  );
}

describe('ProjectResourcesPage', () => {
  it('renders the project resources workspace header, breadcrumbs, and pipeline tabs', () => {
    renderResourcesPage();

    expect(screen.getByText('Study resources')).toBeInTheDocument();
    expect(screen.getByText('All projects')).toBeInTheDocument();
    expect(screen.getByText('Active Corpus:')).toBeInTheDocument();
    expect(
      screen.getByText(/Project Resources · Local-First Ingestion/i),
    ).toBeInTheDocument();

    // Check pipeline tabs
    expect(screen.getAllByText('Resources').length).toBeGreaterThan(0);
    expect(screen.getByText('Topics')).toBeInTheDocument();
    expect(screen.getByText('Generation')).toBeInTheDocument();
    expect(screen.getByText('Question Bank')).toBeInTheDocument();
  });

  it('renders the operational table with all lifecycle states', () => {
    renderResourcesPage();

    // Ready row
    expect(
      screen.getByText('Silberschatz_OS_Deadlocks_Ch8.pdf'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('READY').length).toBeGreaterThan(0);

    // Processing row
    expect(
      screen.getByText('Tanenbaum_Distributed_RPC_Ch4.pdf'),
    ).toBeInTheDocument();
    expect(screen.getByText('PROCESSING')).toBeInTheDocument();

    // Ready to process row
    expect(
      screen.getByText('Midterm_Exam_2023_Solutions.pdf'),
    ).toBeInTheDocument();
    expect(screen.getByText('READY TO PROCESS')).toBeInTheDocument();
    expect(screen.getByText('Start processing')).toBeInTheDocument();

    // Failed row
    expect(
      screen.getByText('Historical_Scanned_Notes_1998.pdf'),
    ).toBeInTheDocument();
    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('opens and closes the upload dialog', () => {
    renderResourcesPage();

    const uploadButton = screen.getByRole('button', { name: /\+ Upload PDF/i });
    fireEvent.click(uploadButton);

    expect(screen.getByText('Upload study resource')).toBeInTheDocument();
    expect(
      screen.getByText(/PDF format only \(Max 25 MB per document\)/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Study Material').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PYQ (Exams)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Syllabus').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Reference').length).toBeGreaterThan(0);

    // Close modal
    const closeButton = screen.getByRole('button', {
      name: /Close upload modal/i,
    });
    fireEvent.click(closeButton);
    expect(screen.queryByText('Upload study resource')).not.toBeInTheDocument();
  });

  it('opens the details drawer inspector when a row is clicked', () => {
    renderResourcesPage();

    const row = screen.getByText('Silberschatz_OS_Deadlocks_Ch8.pdf');
    fireEvent.click(row);

    expect(screen.getByText('Resource Inspector')).toBeInTheDocument();
    expect(screen.getByText('Parsing & Chunking Engine')).toBeInTheDocument();
    expect(screen.getByText('Ingestion Run History')).toBeInTheDocument();
    expect(screen.getByText('Reprocess Chunks')).toBeInTheDocument();
    expect(screen.getByText('Export Manifest')).toBeInTheDocument();

    const closeDrawer = screen.getByRole('button', {
      name: /Close inspector/i,
    });
    fireEvent.click(closeDrawer);
    expect(screen.queryByText('Resource Inspector')).not.toBeInTheDocument();
  });

  it('supports inspector state switching to Empty State and OCR Alert mode', () => {
    renderResourcesPage();

    // Switch to Empty State
    const emptyStateButton = screen.getByRole('button', {
      name: /Empty State/i,
    });
    fireEvent.click(emptyStateButton);

    expect(
      screen.getByText('Upload study resources to begin'),
    ).toBeInTheDocument();
    expect(screen.getByText('STEP 01')).toBeInTheDocument();
    expect(screen.getByText('STEP 02')).toBeInTheDocument();
    expect(screen.getByText('STEP 03')).toBeInTheDocument();
    expect(screen.getByText('STEP 04')).toBeInTheDocument();

    // Switch to OCR Alert Mode
    const ocrAlertButton = screen.getByRole('button', {
      name: /OCR Alert Mode/i,
    });
    fireEvent.click(ocrAlertButton);

    expect(
      screen.getByText(
        /Corpus Ingestion Blocked: 1 Scanned Document Detected/i,
      ),
    ).toBeInTheDocument();
  });
});
