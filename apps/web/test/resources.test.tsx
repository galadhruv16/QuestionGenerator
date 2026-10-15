import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  ProjectResourcesPage,
  mockDemoResources,
} from '../src/app/pages/ProjectResourcesPage';

function renderResourcesPage(
  projectId = '123e4567-e89b-12d3-a456-426614174000',
) {
  window.history.pushState({}, '', `/app/projects/${projectId}/resources`);
  return render(
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <ProjectResourcesPage initialResources={mockDemoResources} />
          }
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
      screen.getAllByText('Historical_Scanned_Notes_1998.pdf').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('opens and closes the upload dialog', () => {
    renderResourcesPage();

    const uploadButton = screen.getByRole('button', {
      name: /\+ Upload Resource/i,
    });
    fireEvent.click(uploadButton);

    expect(screen.getByText('Upload study resource')).toBeInTheDocument();
    expect(
      screen.getByText(
        /PDF \(selectable & scanned\), PPTX Presentations, DOCX, PNG\/JPG\/WEBP/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Study Material').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Presentation (Slides)').length).toBeGreaterThan(0);
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

  it('displays the OCR alert banner when an unparseable scanned document is present', () => {
    renderResourcesPage();

    expect(
      screen.getByText(
        /Corpus Ingestion Blocked: Unreadable Document Detected/i,
      ),
    ).toBeInTheDocument();
  });

  it('renders multi-format resources including presentations, images, and vision OCR badges', () => {
    const multiFormatResources = [
      {
        checksum_sha256: 'a1b2c3d4e5',
        created_at: '2026-10-15T10:00:00Z',
        evidence_summary: '24 slides indexed',
        file_size_bytes: 4_200_000,
        id: 'res_pptx_1',
        original_filename: 'Lecture_05_Distributed_Consensus.pptx',
        page_count: 24,
        resource_kind: 'PRESENTATION' as const,
        status: 'READY' as const,
        storage_path: 'resources/projects/cs842/Lecture_05_Distributed_Consensus.pptx',
      },
      {
        checksum_sha256: 'f6e5d4c3b2',
        created_at: '2026-10-15T11:00:00Z',
        evidence_summary: 'Vision grounded handwritten notes',
        file_size_bytes: 1_800_000,
        id: 'res_img_1',
        metadata: {
          ocr_applied: true,
          reason: 'SCANNED_OR_HANDWRITTEN_PDF',
        },
        original_filename: 'Whiteboard_Handwritten_Notes.png',
        page_count: 1,
        resource_kind: 'STUDY_MATERIAL' as const,
        status: 'READY' as const,
        storage_path: 'resources/projects/cs842/Whiteboard_Handwritten_Notes.png',
      },
    ];

    window.history.pushState(
      {},
      '',
      '/app/projects/123e4567-e89b-12d3-a456-426614174000/resources',
    );
    render(
      <BrowserRouter>
        <Routes>
          <Route
            element={
              <ProjectResourcesPage initialResources={multiFormatResources} />
            }
            path="/app/projects/:projectId/resources"
          />
        </Routes>
      </BrowserRouter>,
    );

    // Verify PPTX presentation
    expect(
      screen.getByText('Lecture_05_Distributed_Consensus.pptx'),
    ).toBeInTheDocument();
    expect(screen.getByText('PPTX')).toBeInTheDocument();
    expect(screen.getByText('24 slides')).toBeInTheDocument();

    // Verify Image & Vision OCR
    expect(
      screen.getByText('Whiteboard_Handwritten_Notes.png'),
    ).toBeInTheDocument();
    expect(screen.getByText('IMAGE')).toBeInTheDocument();
    expect(screen.getByText('✦ VISION OCR')).toBeInTheDocument();
    expect(screen.getByText('1 image')).toBeInTheDocument();
  });

  it('renders PYQ Exam Paper badge and allows analyzing exam blueprint', async () => {
    const pyqReadyResource = {
      checksum_sha256: 'd490ef7711a8c9',
      created_at: '2026-10-11T13:30:00Z',
      evidence_summary: '28 pp indexed · 42 text anchors locked',
      evidence_tokens: 42,
      file_size_bytes: 5_347_737,
      id: 'res_pyq_test',
      original_filename: 'Midterm_Exam_2024_Paper.pdf',
      page_count: 28,
      resource_kind: 'PYQ' as const,
      status: 'READY' as const,
      storage_path: 'resources/projects/cs842/Midterm_Exam_2024_Paper.pdf',
    };

    window.history.pushState(
      {},
      '',
      '/app/projects/123e4567-e89b-12d3-a456-426614174000/resources',
    );
    render(
      <BrowserRouter>
        <Routes>
          <Route
            element={
              <ProjectResourcesPage initialResources={[pyqReadyResource]} />
            }
            path="/app/projects/:projectId/resources"
          />
        </Routes>
      </BrowserRouter>,
    );

    expect(screen.getByText('PYQ Exam Paper')).toBeInTheDocument();
    const analyzeBtn = screen.getByRole('button', {
      name: /Analyze Blueprint/i,
    });
    expect(analyzeBtn).toBeInTheDocument();

    fireEvent.click(analyzeBtn);

    // Verify modal appears
    expect(
      await screen.findByText('Exam Blueprint Analysis'),
    ).toBeInTheDocument();
    expect(screen.getByText('PYQ PATTERN')).toBeInTheDocument();
    expect(screen.getByText(/Total Questions/i)).toBeInTheDocument();
    expect(screen.getByText(/Detected Marks/i)).toBeInTheDocument();
    expect(screen.getByText("Bloom's Cognitive Demands")).toBeInTheDocument();
    expect(
      screen.getByText(/Apply Blueprint to Generation Studio/i),
    ).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', {
      name: /Close blueprint modal/i,
    });
    fireEvent.click(closeBtn);
    expect(
      screen.queryByText('Exam Blueprint Analysis'),
    ).not.toBeInTheDocument();
  });
});

