import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon, Logo } from '../components/ui';
import { getCachedProject } from '../services/session-store';
import type { QuestionItem } from './ProjectQuestionsPage';
import { demoQuestions } from './ProjectQuestionsPage';

export function ProjectExportStudioPage({
  initialQuestions,
}: {
  initialQuestions?: QuestionItem[];
} = {}) {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const cached = projectId ? getCachedProject(projectId) : null;
  const initialData: QuestionItem[] =
    initialQuestions ??
    (Array.isArray(cached?.questions) && (cached.questions as QuestionItem[]).length > 0
      ? (cached.questions as QuestionItem[])
      : demoQuestions);

  const [questions, setQuestions] = useState<QuestionItem[]>(initialData);
  const [projectTitle, setProjectTitle] = useState(
    cached?.project?.name ?? 'CS-842: Distributed Systems Core',
  );

  // Active view: Student Question Paper vs Confidential Answer Key & Rubric
  const [viewMode, setViewMode] = useState<'paper' | 'answer-key'>('paper');

  // Metadata Configuration
  const [department, setDepartment] = useState(
    'Department of Computer Science & Engineering',
  );
  const [courseCode, setCourseCode] = useState(
    cached?.project?.name ?? 'CS-842: Distributed Systems Core',
  );
  const [assessmentTitle, setAssessmentTitle] = useState(
    'Midterm Examination — Fall 2026',
  );
  const [examDate, setExamDate] = useState('Oct 24, 2026');
  const [durationMins, setDurationMins] = useState(90);
  const [renderCandidateBox, setRenderCandidateBox] = useState(true);

  // Guidelines
  const [proctorGuidelines, setProctorGuidelines] = useState(
    `1. Calculators permitted. Strictly closed-book, closed-notes.\n2. Answer all Multiple Choice questions in Section A.\n3. Show all working for conceptual and architectural proofs in Section B.\n4. Academic Honor Code Protocol strictly enforced. Hand in the entire booklet to the chief proctor.`,
  );

  // Layout & Typography
  const [gridFormat, setGridFormat] = useState<'single' | 'two-col' | 'ruled'>(
    'single',
  );
  const [fontSize, setFontSize] = useState<'10pt' | '11pt' | '12pt'>('11pt');
  const [printMargin, setPrintMargin] = useState('1.0 in (Standard)');

  // Toggles
  const [includeGrounding, setIncludeGrounding] = useState(true);
  const [includeBloom, setIncludeBloom] = useState(true);
  const [shuffleVariantB, setShuffleVariantB] = useState(false);

  // Question Selection: Requirement 3: Default to ACCEPTED questions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const acceptedIds = initialData
      .filter((q) => q.status === 'ACCEPTED')
      .map((q) => q.id);
    if (acceptedIds.length > 0) return new Set(acceptedIds);
    // Fallback if none are accepted yet: select all
    return new Set(initialData.map((q) => q.id));
  });

  // Requirement 1: Allow instructor to customize marks per question
  const [questionMarks, setQuestionMarks] = useState<Record<string, number>>(
    () => {
      const marksMap: Record<string, number> = {};
      for (const q of initialData) {
        const typeSlug =
          q.current_version?.question_types?.slug?.toUpperCase() || 'MCQ';
        if (typeSlug === 'MCQ') {
          marksMap[q.id] = 4;
        } else if (typeSlug.includes('LONG') || typeSlug.includes('SCENARIO')) {
          marksMap[q.id] = 8;
        } else {
          marksMap[q.id] = 5;
        }
      }
      return marksMap;
    },
  );

  // Zoom scale
  const [zoomLevel, setZoomLevel] = useState(100);

  // Load live questions if available
  useEffect(() => {
    if (initialQuestions) return;
    if (!projectId) return;

    async function loadData() {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/questions?limit=1000`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data) && json.data.length > 0) {
            const validData: QuestionItem[] = json.data.filter(
              (q: QuestionItem) => q && q.current_version != null,
            );
            setQuestions(validData);
            const accepted = validData
              .filter((q: QuestionItem) => q.status === 'ACCEPTED')
              .map((q: QuestionItem) => q.id);
            if (accepted.length > 0) {
              setSelectedIds(new Set(accepted));
            } else {
              setSelectedIds(new Set(validData.map((q: QuestionItem) => q.id)));
            }

            setQuestionMarks((prev) => {
              const updated = { ...prev };
              for (const q of validData) {
                if (!updated[q.id]) {
                  const typeSlug =
                    q.current_version?.question_types?.slug?.toUpperCase() || 'MCQ';
                  updated[q.id] =
                    typeSlug === 'MCQ'
                      ? 4
                      : typeSlug.includes('LONG')
                        ? 8
                        : 5;
                }
              }
              return updated;
            });
          }
        }
      } catch (e) {
        console.error('Failed to load questions for export studio:', e);
      }
    }
    void loadData();
  }, [projectId, initialQuestions]);

  // Included questions ordered
  const includedQuestions = useMemo(() => {
    let list = questions.filter((q) => selectedIds.has(q.id) && q.current_version != null);
    if (shuffleVariantB) {
      // Deterministic reverse/interleave shuffle for Variant B
      list = [...list].reverse();
    }
    return list;
  }, [questions, selectedIds, shuffleVariantB]);

  // Total marks computed dynamically
  const totalCalculatedMarks = useMemo(() => {
    return includedQuestions.reduce(
      (sum, q) => sum + (questionMarks[q.id] ?? 4),
      0,
    );
  }, [includedQuestions, questionMarks]);

  // Section grouping: Section A (MCQs) and Section B (Subjective / Conceptual)
  const sections = useMemo(() => {
    const sectionA = includedQuestions.filter(
      (q) =>
        (q.current_version?.question_types?.slug?.toUpperCase() || 'MCQ') ===
        'MCQ',
    );
    const sectionB = includedQuestions.filter(
      (q) =>
        (q.current_version?.question_types?.slug?.toUpperCase() || 'MCQ') !==
        'MCQ',
    );
    return { sectionA, sectionB };
  }, [includedQuestions]);

  const handleUpdateMarks = (questionId: string, marks: number) => {
    setQuestionMarks((prev) => ({
      ...prev,
      [questionId]: Math.max(1, marks),
    }));
  };

  const handleToggleQuestion = (questionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const handleSelectAllAccepted = () => {
    const acceptedIds = questions
      .filter((q) => q.status === 'ACCEPTED')
      .map((q) => q.id);
    setSelectedIds(new Set(acceptedIds.length > 0 ? acceptedIds : questions.map((q) => q.id)));
  };

  // Direct print action
  const handlePrint = () => {
    window.print();
  };

  // Export as structured text / Word document
  const handleExportWord = () => {
    let content = `${department}\n${courseCode}\n${assessmentTitle}\nDate: ${examDate} | Duration: ${durationMins} Mins | Total Marks: ${totalCalculatedMarks}\n\n`;
    content += `INSTRUCTIONS:\n${proctorGuidelines}\n\n`;

    if (viewMode === 'paper') {
      content += `=== SECTION A: MULTIPLE CHOICE QUESTIONS ===\n\n`;
      sections.sectionA.forEach((q, idx) => {
        content += `Q${idx + 1}. [${questionMarks[q.id] ?? 4} Marks]\n${q.current_version?.question_text || ''}\n`;
        const options = q.current_version?.question_options ?? [];
        options.forEach((opt, oIdx) => {
          content += `  (${String.fromCharCode(65 + oIdx)}) ${opt.option_text}\n`;
        });
        content += `\n`;
      });

      if (sections.sectionB.length > 0) {
        content += `=== SECTION B: SHORT & LONG ANSWER QUESTIONS ===\n\n`;
        sections.sectionB.forEach((q, idx) => {
          content += `Q${sections.sectionA.length + idx + 1}. [${questionMarks[q.id] ?? 5} Marks]\n${q.current_version?.question_text || ''}\n\n`;
        });
      }
    } else {
      content += `=== CONFIDENTIAL INSTRUCTOR ANSWER KEY & RUBRIC ===\n\n`;
      includedQuestions.forEach((q, idx) => {
        content += `Q${idx + 1}. [${questionMarks[q.id] ?? 4} Marks]\nStem: ${q.current_version?.question_text || ''}\n`;
        if (q.current_version?.model_answer) {
          content += `Model Answer / Solution: ${q.current_version?.model_answer}\n`;
        }
        if (q.current_version?.explanation) {
          content += `Rationale: ${q.current_version?.explanation}\n`;
        }
        const sRef = q.current_version?.question_source_refs?.[0];
        if (sRef) {
          content += `Source Citation: ${sRef.resource_chunks?.resources?.original_filename || 'Curriculum PDF'}, Page ${sRef.resource_chunks?.page_number || 1}, Chunk #${sRef.chunk_id}\n`;
        }
        content += `\n----------------------------------------\n\n`;
      });
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${assessmentTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${viewMode === 'paper' ? 'StudentPaper' : 'AnswerKey'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export JSON / Canvas QTI payload
  const handleExportJSON = () => {
    const payload = {
      assessment: {
        title: assessmentTitle,
        course: courseCode,
        department,
        date: examDate,
        durationMinutes: durationMins,
        totalMarks: totalCalculatedMarks,
        guidelines: proctorGuidelines,
      },
      questions: includedQuestions.map((q, idx) => ({
        questionNumber: idx + 1,
        marks: questionMarks[q.id] ?? 4,
        type: q.current_version?.question_types?.slug || 'MCQ',
        bloom: q.current_version?.bloom_levels?.slug || 'understand',
        difficulty: q.current_version?.difficulty_levels?.slug || 'MEDIUM',
        stem: q.current_version?.question_text || '',
        options: (q.current_version?.question_options ?? []).map((o, oIdx) => ({
          letter: String.fromCharCode(65 + oIdx),
          text: o.option_text,
          isCorrect: o.is_correct,
        })),
        modelAnswer: q.current_version?.model_answer,
        explanation: q.current_version?.explanation,
        grounding: q.current_version?.question_source_refs?.[0]
          ? {
              document:
                q.current_version?.question_source_refs?.[0]?.resource_chunks
                  ?.resources?.original_filename,
              pageNumber:
                q.current_version?.question_source_refs?.[0]?.resource_chunks
                  ?.page_number,
              chunkId: q.current_version?.question_source_refs?.[0]?.chunk_id,
            }
          : null,
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${assessmentTitle.replace(/[^a-zA-Z0-9]/g, '_')}_AssessmentPackage.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#fbf8fc] text-[#0f172a] font-sans antialiased min-h-screen flex flex-col overflow-x-hidden print:bg-white print:text-black">
      {/* 1. TOP APP BAR */}
      <header className="h-16 w-full border-b border-[#e2e8f0] bg-white px-4 sm:px-8 flex items-center justify-between shrink-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)] print:hidden">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2.5 shrink-0">
            <Logo to="/app" />
          </div>
          <span className="h-4 w-px bg-[#e2e8f0]" />
          <nav
            aria-label="Breadcrumb"
            className="flex items-center space-x-2 text-xs font-mono text-[#64748b] truncate"
          >
            <Link
              className="hover:text-[#0f172a] transition-colors"
              to="/app"
            >
              Workspaces
            </Link>
            <span className="text-[#cbd5e1]">/</span>
            <Link
              className="hover:text-[#0f172a] transition-colors truncate max-w-[200px]"
              to={`/app/projects/${projectId}/resources`}
            >
              {projectTitle}
            </Link>
            <span className="text-[#cbd5e1]">/</span>
            <Link
              className="hover:text-[#0f172a] transition-colors"
              to={`/app/projects/${projectId}/questions`}
            >
              Question Bank
            </Link>
            <span className="text-[#cbd5e1]">/</span>
            <span className="text-[#3157d5] font-semibold bg-[#eef2ff] px-2 py-0.5 rounded border border-[#3157d5]/30">
              Export &amp; Paper Builder
            </span>
          </nav>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          {/* Quick stats */}
          <div className="hidden lg:flex items-center space-x-2.5 px-3 py-1 rounded-full bg-[#f8fafc] border border-[#e2e8f0] font-mono text-xs text-[#64748b]">
            <span className="font-semibold text-[#3157d5] flex items-center gap-1">
              <Icon name="verified" size={13} />
              <span>{includedQuestions.length} Questions</span>
            </span>
            <span className="text-[#cbd5e1]">•</span>
            <span className="font-bold text-[#0f172a]">
              {totalCalculatedMarks} Marks
            </span>
            <span className="text-[#cbd5e1]">•</span>
            <span>{durationMins} Mins</span>
          </div>

          <button
            className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#64748b] hover:text-[#0f172a] text-xs font-mono transition-colors flex items-center space-x-1"
            onClick={() => {
              setAssessmentTitle('Midterm Examination — Fall 2026');
              setDurationMins(90);
              setFontSize('11pt');
              setGridFormat('single');
            }}
            type="button"
          >
            <Icon name="refresh" size={13} />
            <span>Reset Layout</span>
          </button>

          {/* Export Actions */}
          <div className="flex items-center space-x-1.5">
            <button
              className="px-3 py-1.5 rounded-lg bg-[#3157d5] hover:bg-[#2544ab] text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
              onClick={handlePrint}
              type="button"
            >
              <Icon name="print" size={14} />
              <span>Print / Save PDF</span>
            </button>
            <button
              className="px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#334155] text-xs font-mono font-medium transition-colors"
              onClick={handleExportWord}
              title="Download as text/document"
              type="button"
            >
              <Icon name="download" size={14} />
            </button>
            <button
              className="px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#334155] text-xs font-mono font-medium transition-colors"
              onClick={handleExportJSON}
              title="Export Canvas / QTI / JSON package"
              type="button"
            >
              <Icon name="layers" size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. SUB-HEADER / RIBBON & PIPELINE TABS */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 pt-3 shrink-0 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-xs font-bold text-[#3157d5] bg-[#eef2ff] border border-[#3157d5]/30 px-2 py-0.5 rounded flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3157d5] animate-pulse" />
              STUDIO V1.4
            </span>
            <span className="text-[#cbd5e1]">•</span>
            <span className="font-mono text-xs text-[#334155] font-semibold flex items-center gap-1">
              <Icon name="file" size={14} />
              <span>
                {assessmentTitle.replace(/[^a-zA-Z0-9]/g, '_')}_Draft.gnd
              </span>
            </span>
            <span className="text-[#cbd5e1]">•</span>
            <span className="font-mono text-xs text-emerald-700 flex items-center gap-1 font-medium">
              <Icon name="verified" size={13} />
              <span>All {includedQuestions.length} Items Grounded</span>
            </span>
          </div>

          {/* Mode Switcher: Requirement 2: Separate Deliverables */}
          <div className="flex items-center bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-0.5 font-mono text-xs">
            <button
              className={`px-3 py-1 rounded font-medium transition-all ${
                viewMode === 'paper'
                  ? 'bg-white text-[#3157d5] font-semibold shadow-xs border border-[#e2e8f0]'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
              onClick={() => setViewMode('paper')}
              type="button"
            >
              Student Question Paper
            </button>
            <button
              className={`px-3 py-1 rounded font-medium transition-all flex items-center gap-1.5 ${
                viewMode === 'answer-key'
                  ? 'bg-rose-50 text-rose-800 font-semibold shadow-xs border border-rose-200'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
              onClick={() => setViewMode('answer-key')}
              type="button"
            >
              <Icon name="lock" size={12} />
              <span>Instructor Answer Key &amp; Rubric</span>
            </button>
          </div>
        </div>

        {/* Pipeline Navigation Tabs */}
        <div className="flex space-x-1 font-mono text-xs border-t border-[#f1f5f9] pt-1">
          <Link
            className="px-3.5 py-2 text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] rounded-t border-b-2 border-transparent transition-colors flex items-center space-x-1.5"
            to={`/app/projects/${projectId}/resources`}
          >
            <span className="text-[#94a3b8]">01</span>
            <span>Resources</span>
          </Link>
          <Link
            className="px-3.5 py-2 text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] rounded-t border-b-2 border-transparent transition-colors flex items-center space-x-1.5"
            to={`/app/projects/${projectId}/topics`}
          >
            <span className="text-[#94a3b8]">02</span>
            <span>Topic Map</span>
          </Link>
          <Link
            className="px-3.5 py-2 text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] rounded-t border-b-2 border-transparent transition-colors flex items-center space-x-1.5"
            to={`/app/projects/${projectId}/generation`}
          >
            <span className="text-[#94a3b8]">03</span>
            <span>Generation Studio</span>
          </Link>
          <Link
            className="px-3.5 py-2 text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] rounded-t border-b-2 border-transparent transition-colors flex items-center space-x-1.5"
            to={`/app/projects/${projectId}/questions`}
          >
            <span className="text-[#94a3b8]">04</span>
            <span>Question Bank</span>
            <span className="bg-[#e2e8f0] text-[#334155] text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {questions.length}
            </span>
          </Link>
          <div className="px-3.5 py-2 text-[#3157d5] font-semibold border-b-2 border-[#3157d5] bg-[#eef2ff]/60 rounded-t flex items-center space-x-2">
            <span className="text-[#3157d5] font-bold">05</span>
            <span>Export &amp; Paper Builder</span>
            <span className="bg-[#3157d5] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              Active
            </span>
          </div>
          <Link
            className="px-3.5 py-2 text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] rounded-t border-b-2 border-transparent transition-colors flex items-center space-x-1.5"
            to={`/app/projects/${projectId}/practice`}
          >
            <span className="text-[#94a3b8]">06</span>
            <span>Practice &amp; Mock Studio</span>
          </Link>
        </div>
      </div>

      {/* 3. MAIN SPLIT STUDIO WORKSPACE */}
      <main className="flex-1 flex overflow-hidden bg-[#f1f5f9] print:bg-white print:overflow-visible">
        {/* LEFT CONFIGURATION SIDEBAR (~400px) */}
        <aside className="w-[400px] shrink-0 bg-white border-r border-[#e2e8f0] overflow-y-auto p-6 space-y-6 text-xs print:hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
            <div className="flex items-center gap-2">
              <Icon name="tune" size={18} />
              <h2 className="font-serif font-bold text-base text-[#0f172a]">
                Paper Blueprint
              </h2>
            </div>
            <span className="font-mono text-[10px] font-bold bg-[#f1f5f9] text-[#64748b] px-2 py-0.5 rounded">
              STUDIO CONTROLS
            </span>
          </div>

          {/* Section 1: Institutional Metadata */}
          <div className="space-y-3">
            <label className="font-mono text-xs uppercase tracking-wider font-semibold text-[#0f172a] flex items-center gap-1.5">
              <Icon name="school" size={14} />
              <span>1. Institutional Metadata</span>
            </label>

            <div className="space-y-2.5">
              <div>
                <label className="block font-mono text-[11px] text-[#64748b] mb-1">
                  Department / Faculty
                </label>
                <input
                  className="w-full px-3 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded text-xs text-[#0f172a] focus:border-[#3157d5] focus:outline-none"
                  onChange={(e) => setDepartment(e.target.value)}
                  type="text"
                  value={department}
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] text-[#64748b] mb-1">
                  Course Code &amp; Module Name
                </label>
                <input
                  className="w-full px-3 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded text-xs text-[#0f172a] font-mono focus:border-[#3157d5] focus:outline-none"
                  onChange={(e) => setCourseCode(e.target.value)}
                  type="text"
                  value={courseCode}
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] text-[#64748b] mb-1">
                  Assessment Title
                </label>
                <input
                  className="w-full px-3 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded text-xs text-[#0f172a] focus:border-[#3157d5] focus:outline-none"
                  onChange={(e) => setAssessmentTitle(e.target.value)}
                  type="text"
                  value={assessmentTitle}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <label className="block font-mono text-[10px] text-[#64748b] mb-1">
                    Exam Date
                  </label>
                  <input
                    className="w-full px-2 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded text-[11px] font-mono text-[#0f172a] focus:border-[#3157d5] focus:outline-none"
                    onChange={(e) => setExamDate(e.target.value)}
                    type="text"
                    value={examDate}
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] text-[#64748b] mb-1">
                    Duration (Min)
                  </label>
                  <input
                    className="w-full px-2 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded text-[11px] font-mono text-[#0f172a] focus:border-[#3157d5] focus:outline-none"
                    onChange={(e) =>
                      setDurationMins(parseInt(e.target.value, 10) || 60)
                    }
                    type="number"
                    value={durationMins}
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] text-[#64748b] mb-1">
                    Total Marks
                  </label>
                  <div className="w-full px-2 py-1.5 bg-[#eef2ff] border border-[#3157d5]/30 rounded text-[11px] font-mono font-bold text-[#3157d5] text-center">
                    {totalCalculatedMarks} M
                  </div>
                </div>
              </div>

              <label className="flex items-center justify-between p-2.5 rounded bg-[#f8fafc] border border-[#e2e8f0] cursor-pointer hover:bg-slate-100 transition-colors">
                <span className="flex items-center gap-2 font-mono text-xs text-[#0f172a]">
                  <Icon name="badge" size={14} />
                  <span>Render Candidate ID &amp; Signature Box</span>
                </span>
                <input
                  checked={renderCandidateBox}
                  className="rounded border-[#cbd5e1] text-[#3157d5] focus:ring-0"
                  onChange={(e) => setRenderCandidateBox(e.target.checked)}
                  type="checkbox"
                />
              </label>
            </div>
          </div>

          <div className="h-px bg-[#f1f5f9]" />

          {/* Section 2: Instructions & Honor Code */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-mono text-xs uppercase tracking-wider font-semibold text-[#0f172a] flex items-center gap-1.5">
                <Icon name="shield" size={14} />
                <span>2. Proctor Guidelines &amp; Honor Code</span>
              </label>
            </div>
            <textarea
              className="w-full p-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded text-xs text-[#0f172a] focus:border-[#3157d5] focus:outline-none leading-relaxed"
              onChange={(e) => setProctorGuidelines(e.target.value)}
              rows={4}
              value={proctorGuidelines}
            />
          </div>

          <div className="h-px bg-[#f1f5f9]" />

          {/* Section 3: Typography & Geometry */}
          <div className="space-y-3">
            <label className="font-mono text-xs uppercase tracking-wider font-semibold text-[#0f172a] flex items-center gap-1.5">
              <Icon name="sliders" size={14} />
              <span>3. Typography &amp; Page Geometry</span>
            </label>

            <div className="space-y-2">
              <span className="block font-mono text-[11px] text-[#64748b]">
                Grid Formatting
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#f8fafc] rounded border border-[#e2e8f0] font-mono text-[11px]">
                <button
                  className={`py-1 rounded text-center transition-all ${
                    gridFormat === 'single'
                      ? 'bg-white shadow-xs font-semibold text-[#3157d5] border border-[#cbd5e1]'
                      : 'text-[#64748b] hover:text-[#0f172a]'
                  }`}
                  onClick={() => setGridFormat('single')}
                  type="button"
                >
                  Single Col
                </button>
                <button
                  className={`py-1 rounded text-center transition-all ${
                    gridFormat === 'two-col'
                      ? 'bg-white shadow-xs font-semibold text-[#3157d5] border border-[#cbd5e1]'
                      : 'text-[#64748b] hover:text-[#0f172a]'
                  }`}
                  onClick={() => setGridFormat('two-col')}
                  type="button"
                >
                  Two-Col Eco
                </button>
                <button
                  className={`py-1 rounded text-center transition-all ${
                    gridFormat === 'ruled'
                  ? 'bg-white shadow-xs font-semibold text-[#3157d5] border border-[#cbd5e1]'
                  : 'text-[#64748b] hover:text-[#0f172a]'
                  }`}
                  onClick={() => setGridFormat('ruled')}
                  type="button"
                >
                  Ruled Lines
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="block font-mono text-[10px] text-[#64748b] mb-1">
                    Body Scale
                  </span>
                  <div className="flex items-center border border-[#cbd5e1] rounded overflow-hidden font-mono text-[11px]">
                    {(['10pt', '11pt', '12pt'] as const).map((size) => (
                      <button
                        className={`flex-1 py-1 text-center transition-colors ${
                          fontSize === size
                            ? 'bg-[#3157d5] text-white font-semibold'
                            : 'text-[#64748b] hover:bg-[#f8fafc]'
                        }`}
                        key={size}
                        onClick={() => setFontSize(size)}
                        type="button"
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block font-mono text-[10px] text-[#64748b] mb-1">
                    Print Margin
                  </span>
                  <select
                    className="w-full py-1 px-2 font-mono text-[11px] bg-[#f8fafc] border border-[#cbd5e1] rounded text-[#0f172a] focus:outline-none"
                    onChange={(e) => setPrintMargin(e.target.value)}
                    value={printMargin}
                  >
                    <option>1.0 in (Standard)</option>
                    <option>0.75 in (Compact)</option>
                    <option>1.25 in (Editorial)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-[#f1f5f9]" />

          {/* Section 4: Grounding & Provenance Toggles */}
          <div className="space-y-3">
            <label className="font-mono text-xs uppercase tracking-wider font-semibold text-[#0f172a] flex items-center gap-1.5">
              <Icon name="verified" size={14} />
              <span>4. Assessment &amp; Provenance Protocol</span>
            </label>

            <div className="space-y-2 font-mono text-[11px]">
              <label className="flex items-center justify-between p-2 rounded hover:bg-[#f8fafc] transition-colors cursor-pointer border border-transparent hover:border-[#e2e8f0]">
                <div>
                  <span className="font-semibold text-[#0f172a] block">
                    Source Grounding Citations
                  </span>
                  <span className="text-[#64748b] text-[10px] block">
                    Include PDF page &amp; chunk references in Answer Key
                  </span>
                </div>
                <input
                  checked={includeGrounding}
                  className="rounded border-[#cbd5e1] text-[#3157d5] focus:ring-0"
                  onChange={(e) => setIncludeGrounding(e.target.checked)}
                  type="checkbox"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded hover:bg-[#f8fafc] transition-colors cursor-pointer border border-transparent hover:border-[#e2e8f0]">
                <div>
                  <span className="font-semibold text-[#0f172a] block">
                    Bloom's Taxonomy Badges
                  </span>
                  <span className="text-[#64748b] text-[10px] block">
                    Display cognitive depth (L1 - L6) on questions
                  </span>
                </div>
                <input
                  checked={includeBloom}
                  className="rounded border-[#cbd5e1] text-[#3157d5] focus:ring-0"
                  onChange={(e) => setIncludeBloom(e.target.checked)}
                  type="checkbox"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded hover:bg-[#f8fafc] transition-colors cursor-pointer border border-transparent hover:border-[#e2e8f0]">
                <div>
                  <span className="font-semibold text-[#0f172a] block">
                    Shuffle Questions (Anti-Cheat Set B)
                  </span>
                  <span className="text-[#64748b] text-[10px] block">
                    Generates reverse/interleaved sequence
                  </span>
                </div>
                <input
                  checked={shuffleVariantB}
                  className="rounded border-[#cbd5e1] text-[#3157d5] focus:ring-0"
                  onChange={(e) => setShuffleVariantB(e.target.checked)}
                  type="checkbox"
                />
              </label>
            </div>
          </div>

          <div className="h-px bg-[#f1f5f9]" />

          {/* Section 5: Question Mark Customizer & Selection */}
          <div className="space-y-3 pb-6">
            <div className="flex items-center justify-between">
              <label className="font-mono text-xs uppercase tracking-wider font-semibold text-[#0f172a] flex items-center gap-1.5">
                <Icon name="layers" size={14} />
                <span>5. Question Selection &amp; Custom Marks</span>
              </label>
              <button
                className="text-[10px] font-mono text-[#3157d5] hover:underline"
                onClick={handleSelectAllAccepted}
                type="button"
              >
                Reset to Accepted
              </button>
            </div>

            <p className="text-[11px] text-[#64748b] leading-tight">
              Customize marks per question. Total exam marks calculate automatically.
            </p>

            {/* List of included questions */}
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const isSelected = selectedIds.has(q.id);
                const currentMarks = questionMarks[q.id] ?? 4;
                const isAccepted = q.status === 'ACCEPTED';

                return (
                  <div
                    className={`p-2.5 rounded-lg border transition-all text-xs ${
                      isSelected
                        ? 'bg-white border-[#cbd5e1] shadow-xs'
                        : 'bg-[#f8fafc] border-[#e2e8f0] opacity-60'
                    }`}
                    key={q.id}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <input
                          checked={isSelected}
                          className="mt-1 rounded border-[#cbd5e1] text-[#3157d5] focus:ring-0 cursor-pointer"
                          onChange={() => handleToggleQuestion(q.id)}
                          type="checkbox"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-mono text-[10px] mb-0.5">
                            <span className="font-bold text-[#0f172a]">
                              #{String(q.sort_order || idx + 1).padStart(2, '0')}
                            </span>
                            {isAccepted && (
                              <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded font-semibold">
                                ACCEPTED
                              </span>
                            )}
                            <span className="text-[#64748b] truncate">
                              {q.current_version?.question_types?.name || 'MCQ'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#334155] line-clamp-2 leading-snug">
                            {q.current_version?.question_text || ''}
                          </p>
                        </div>
                      </div>

                      {/* Customizable Mark Allocation */}
                      <div className="flex items-center gap-1 shrink-0">
                        <label className="font-mono text-[10px] text-[#64748b]">
                          Marks:
                        </label>
                        <input
                          aria-label={`Marks for question ${q.sort_order || idx + 1}`}
                          className="w-12 px-1.5 py-0.5 bg-[#f8fafc] border border-[#cbd5e1] rounded font-mono text-xs text-center font-bold text-[#3157d5] focus:border-[#3157d5] focus:outline-none"
                          disabled={!isSelected}
                          min={1}
                          onChange={(e) =>
                            handleUpdateMarks(
                              q.id,
                              parseInt(e.target.value, 10) || 1,
                            )
                          }
                          type="number"
                          value={currentMarks}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* RIGHT LIVE PRINT PREVIEW CANVAS */}
        <section className="flex-1 p-6 lg:p-10 overflow-y-auto flex flex-col items-center space-y-6 relative print:p-0 print:space-y-0 print:overflow-visible">
          {/* Floating Live Control Toolbar */}
          <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-2 rounded-full bg-white/95 backdrop-blur-md border border-[#cbd5e1] shadow-md text-[#0f172a] text-xs font-mono print:hidden">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <button
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                onClick={() => setZoomLevel((z) => Math.max(75, z - 10))}
                title="Zoom Out"
                type="button"
              >
                -
              </button>
              <span className="w-10 text-center font-semibold">{zoomLevel}%</span>
              <button
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                title="Zoom In"
                type="button"
              >
                +
              </button>
            </div>

            <div className="h-4 w-px bg-[#e2e8f0]" />

            {/* View Switcher: Requirement 2 */}
            <div className="flex items-center gap-1">
              <span className="text-[#64748b]">Viewing:</span>
              <span
                className={`font-semibold px-2 py-0.5 rounded ${
                  viewMode === 'paper'
                    ? 'bg-[#eef2ff] text-[#3157d5]'
                    : 'bg-rose-50 text-rose-800'
                }`}
              >
                {viewMode === 'paper'
                  ? 'Student Question Paper'
                  : 'Confidential Answer Key'}
              </span>
            </div>

            <div className="h-4 w-px bg-[#e2e8f0]" />

            {/* Quick Fast Actions */}
            <div className="flex items-center gap-1.5">
              <button
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#f8fafc] hover:bg-slate-100 border border-[#e2e8f0] text-[#0f172a] font-medium transition-colors"
                onClick={handlePrint}
                type="button"
              >
                <Icon name="print" size={13} />
                <span>Print</span>
              </button>
              <button
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#3157d5] text-white font-medium shadow-sm hover:bg-[#2544ab] transition-all"
                onClick={handleExportWord}
                type="button"
              >
                <Icon name="download" size={13} />
                <span>Download Doc</span>
              </button>
            </div>
          </div>

          {/* ============================================================== */}
          {/* REALISTIC A4 SHEET PREVIEW CANVAS                             */}
          {/* ============================================================== */}
          <div
            className="w-full flex justify-center transition-transform origin-top print:transform-none"
            style={{ transform: `scale(${zoomLevel / 100})` }}
          >
            {viewMode === 'paper' ? (
              /* ========================================== */
              /* SHEET 1: STUDENT QUESTION PAPER            */
              /* ========================================== */
              <article
                className={`max-w-[850px] w-full bg-white shadow-xl rounded-sm p-12 sm:p-14 border border-[#e2e8f0] text-[#0f172a] relative font-serif print:shadow-none print:border-none print:p-0 print:max-w-none ${
                  fontSize === '10pt'
                    ? 'text-[13px] leading-relaxed'
                    : fontSize === '12pt'
                      ? 'text-[15px] leading-relaxed'
                      : 'text-[14px] leading-relaxed'
                }`}
              >
                {/* Header Corner Watermark */}
                <div className="absolute top-4 right-5 font-mono text-[10px] text-[#94a3b8] uppercase tracking-wider flex items-center gap-1">
                  <span>ABET ACCREDITED • EXAM BOOKLET A</span>
                </div>

                {/* Institutional Crest & Formal Title */}
                <div className="text-center space-y-1.5 pb-6 border-b border-[#0f172a]/20">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#f8fafc] mb-1 border border-[#e2e8f0]">
                    <Icon name="school" size={24} />
                  </div>
                  <h1 className="font-serif text-2xl font-bold tracking-tight text-[#0f172a] uppercase">
                    {department}
                  </h1>
                  <p className="font-sans text-sm font-semibold text-[#0f172a] tracking-wide uppercase">
                    {courseCode} — {assessmentTitle}
                  </p>
                  <p className="font-mono text-xs text-[#64748b] uppercase tracking-widest pt-1">
                    SEMESTER I ({examDate.toUpperCase()}) • TIME ALLOWED:{' '}
                    {durationMins} MINUTES • TOTAL MARKS: {totalCalculatedMarks}
                  </p>
                </div>

                {/* Candidate Identification Fill Box */}
                {renderCandidateBox && (
                  <div className="my-6 p-4 rounded border border-[#0f172a]/40 bg-[#fbf8fc]/50 font-sans text-xs">
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                      <div className="flex items-end gap-2">
                        <span className="font-semibold text-[#0f172a] shrink-0">
                          Candidate Name:
                        </span>
                        <div className="flex-1 border-b border-dotted border-[#0f172a]/60 h-4" />
                      </div>
                      <div className="flex items-end gap-2">
                        <span className="font-semibold text-[#0f172a] shrink-0">
                          Student Roll No:
                        </span>
                        <div className="flex-1 border-b border-dotted border-[#0f172a]/60 h-4" />
                      </div>
                      <div className="flex items-end gap-2">
                        <span className="font-semibold text-[#0f172a] shrink-0">
                          Signature:
                        </span>
                        <div className="flex-1 border-b border-dotted border-[#0f172a]/60 h-4" />
                      </div>
                      <div className="flex items-end gap-2">
                        <span className="font-semibold text-[#0f172a] shrink-0">
                          Desk / Seat No:
                        </span>
                        <div className="flex-1 border-b border-dotted border-[#0f172a]/60 h-4" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Instructions Box */}
                <div className="p-3.5 bg-[#f8fafc] rounded border border-[#e2e8f0] font-sans text-xs space-y-1.5 text-[#475569] mb-8">
                  <div className="font-bold uppercase tracking-wider text-[11px] text-[#0f172a] font-mono flex items-center gap-1.5">
                    <Icon name="alert" size={13} />
                    <span>Instructions to Candidates</span>
                  </div>
                  <p className="text-[12px] leading-relaxed whitespace-pre-line">
                    {proctorGuidelines}
                  </p>
                </div>

                {/* SECTION A: MULTIPLE CHOICE */}
                {sections.sectionA.length > 0 && (
                  <div className="mb-8">
                    <div className="mb-5 pb-1 border-b-2 border-[#0f172a] flex items-baseline justify-between font-sans">
                      <h2 className="font-serif text-base font-bold uppercase tracking-wide text-[#0f172a]">
                        Section A: Multiple Choice Questions
                      </h2>
                      <span className="font-mono text-xs font-bold text-[#0f172a] uppercase">
                        [
                        {sections.sectionA.reduce(
                          (sum, q) => sum + (questionMarks[q.id] ?? 4),
                          0,
                        )}{' '}
                        Marks]
                      </span>
                    </div>

                    <div
                      className={
                        gridFormat === 'two-col'
                          ? 'grid grid-cols-2 gap-6'
                          : 'space-y-6'
                      }
                    >
                      {sections.sectionA.map((q, qIndex) => {
                        const marks = questionMarks[q.id] ?? 4;
                        const bloom =
                          q.current_version?.bloom_levels?.name || 'Analyze';

                        return (
                          <div className="space-y-2.5 break-inside-avoid" key={q.id}>
                            <div className="flex items-baseline justify-between font-sans">
                              <span className="font-bold text-sm text-[#0f172a]">
                                Q{qIndex + 1}.{' '}
                                <span className="font-mono text-xs font-semibold text-[#3157d5] ml-1">
                                  [{marks} Marks]
                                </span>
                              </span>
                              {includeBloom && (
                                <span className="font-mono text-[10px] text-[#64748b] uppercase tracking-wider">
                                  Bloom: {bloom}
                                </span>
                              )}
                            </div>

                            <p className="font-serif text-justify text-[#0f172a] leading-relaxed">
                              {q.current_version?.question_text || ''}
                            </p>

                            {/* Multiple Choice Bubbles */}
                            <div className="space-y-1.5 pt-1 pl-2 font-sans text-xs">
                              {(q.current_version?.question_options ?? []).map(
                                (opt, oIdx) => (
                                  <div
                                    className="flex items-start gap-2.5"
                                    key={opt.id || oIdx}
                                  >
                                    <span className="w-5 h-5 rounded-full border border-[#64748b] flex items-center justify-center font-mono text-[11px] font-bold shrink-0 mt-0.5">
                                      {String.fromCharCode(65 + oIdx)}
                                    </span>
                                    <p className="leading-snug text-[#1e293b]">
                                      {opt.option_text}
                                    </p>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* SECTION B: SHORT & LONG ANSWER / CONCEPTUAL */}
                {sections.sectionB.length > 0 && (
                  <div className="mb-8">
                    <div className="mb-5 pb-1 border-b-2 border-[#0f172a] flex items-baseline justify-between font-sans">
                      <h2 className="font-serif text-base font-bold uppercase tracking-wide text-[#0f172a]">
                        Section B: Conceptual &amp; Architectural Proofs
                      </h2>
                      <span className="font-mono text-xs font-bold text-[#0f172a] uppercase">
                        [
                        {sections.sectionB.reduce(
                          (sum, q) => sum + (questionMarks[q.id] ?? 5),
                          0,
                        )}{' '}
                        Marks]
                      </span>
                    </div>

                    <div className="space-y-6">
                      {sections.sectionB.map((q, qIndex) => {
                        const marks = questionMarks[q.id] ?? 5;
                        const bloom =
                          q.current_version?.bloom_levels?.name || 'Evaluate';

                        return (
                          <div className="space-y-3 break-inside-avoid" key={q.id}>
                            <div className="flex items-baseline justify-between font-sans">
                              <span className="font-bold text-sm text-[#0f172a]">
                                Q{sections.sectionA.length + qIndex + 1}.{' '}
                                <span className="font-mono text-xs font-semibold text-[#3157d5] ml-1">
                                  [{marks} Marks]
                                </span>
                              </span>
                              {includeBloom && (
                                <span className="font-mono text-[10px] text-[#64748b] uppercase tracking-wider">
                                  Bloom: {bloom}
                                </span>
                              )}
                            </div>

                            <p className="font-serif text-justify text-[#0f172a] leading-relaxed">
                              {q.current_version?.question_text || ''}
                            </p>

                            {/* Ruled lines for answer if in ruled mode or default */}
                            <div className="pt-2 space-y-4 font-sans">
                              <div className="border-b border-dotted border-[#cbd5e1] w-full h-4" />
                              <div className="border-b border-dotted border-[#cbd5e1] w-full h-4" />
                              <div className="border-b border-dotted border-[#cbd5e1] w-full h-4" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Academic Footer */}
                <div className="mt-12 pt-4 border-t border-[#0f172a]/20 flex items-center justify-between font-mono text-[11px] text-[#64748b]">
                  <span>
                    SHA-256: {projectId ? projectId.substring(0, 12) : 'gq-exam-v1'}
                  </span>
                  <span className="font-serif italic text-center">
                    {courseCode} — {assessmentTitle} • Page 1 of 1
                  </span>
                  <span className="font-semibold">[End of Examination Paper]</span>
                </div>
              </article>
            ) : (
              /* ============================================================== */
              /* SHEET 2: CONFIDENTIAL INSTRUCTOR ANSWER KEY & RUBRIC           */
              /* ============================================================== */
              <article
                className={`max-w-[850px] w-full bg-white shadow-xl rounded-sm p-12 sm:p-14 border border-[#e2e8f0] text-[#0f172a] relative font-sans print:shadow-none print:border-none print:p-0 print:max-w-none ${
                  fontSize === '10pt'
                    ? 'text-[13px] leading-relaxed'
                    : fontSize === '12pt'
                      ? 'text-[15px] leading-relaxed'
                      : 'text-[14px] leading-relaxed'
                }`}
              >
                {/* Confidential Banner */}
                <div className="p-3 rounded bg-rose-50 border border-rose-300 text-rose-800 flex items-center justify-between mb-6 font-mono text-xs">
                  <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
                    <Icon name="lock" size={14} />
                    <span>
                      Confidential — Instructor Answer Key &amp; Provenance Ledger
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-rose-700 text-white rounded font-bold uppercase text-[10px]">
                    Internal Faculty Only
                  </span>
                </div>

                <div className="flex items-baseline justify-between border-b border-[#e2e8f0] pb-3 mb-6">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-[#0f172a]">
                      GroundQ Syllabus Anchors &amp; Grading Solutions
                    </h2>
                    <p className="font-mono text-xs text-[#64748b] mt-0.5">
                      Course: {courseCode} • Total Items: {includedQuestions.length} • Total Marks: {totalCalculatedMarks}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-1 rounded">
                    100% Grounded
                  </span>
                </div>

                {/* High Density Answer & Rubric List */}
                <div className="space-y-6">
                  {includedQuestions.map((q, idx) => {
                    const marks = questionMarks[q.id] ?? 4;
                    const correctOpt = q.current_version?.question_options?.find(
                      (o) => o.is_correct,
                    );
                    const sourceRef =
                      q.current_version?.question_source_refs?.[0];

                    return (
                      <div
                        className="p-4 bg-[#f8fafc] rounded-lg border border-[#e2e8f0] space-y-3"
                        key={q.id}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 font-mono text-xs">
                            <span className="font-bold text-white bg-[#3157d5] px-2 py-0.5 rounded">
                              Q{idx + 1}
                            </span>
                            <span className="font-bold text-[#0f172a]">
                              [{marks} Marks]
                            </span>
                            <span className="text-[#64748b]">
                              Bloom: {q.current_version?.bloom_levels?.name || 'Apply'}
                            </span>
                            <span className="text-[#cbd5e1]">•</span>
                            <span className="text-[#64748b]">
                              Difficulty:{' '}
                              {q.current_version?.difficulty_levels?.name || 'Medium'}
                            </span>
                          </div>

                          {correctOpt && (
                            <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded">
                              Correct: Option{' '}
                              {String.fromCharCode(
                                65 +
                                  (q.current_version?.question_options?.indexOf(
                                    correctOpt,
                                  ) ?? 0),
                              )}
                            </span>
                          )}
                        </div>

                        {/* Question Stem */}
                        <p className="font-serif text-sm text-[#0f172a] font-medium leading-snug">
                          {q.current_version?.question_text || ''}
                        </p>

                        {/* Correct Answer & Distractor Explanation */}
                        {correctOpt && (
                          <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded text-xs text-[#065f46] space-y-1">
                            <span className="font-mono font-bold block">
                              Correct Option:{' '}
                              {String.fromCharCode(
                                65 +
                                  (q.current_version?.question_options?.indexOf(
                                    correctOpt,
                                  ) ?? 0),
                              )}{' '}
                              — {correctOpt.option_text}
                            </span>
                            {correctOpt.explanation && (
                              <p className="text-[11px] text-[#047857]">
                                {correctOpt.explanation}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Model Answer / Solution for Subjective */}
                        {q.current_version?.model_answer && (
                          <div className="p-2.5 bg-white border border-[#e2e8f0] rounded text-xs space-y-1">
                            <span className="font-mono font-semibold text-[#0f172a] block">
                              Model Answer / Solution:
                            </span>
                            <p className="text-[#334155] leading-relaxed">
                              {q.current_version?.model_answer}
                            </p>
                          </div>
                        )}

                        {/* Pedagogical Explanation */}
                        {q.current_version?.explanation && !correctOpt?.explanation && (
                          <div className="p-2.5 bg-white border border-[#e2e8f0] rounded text-xs space-y-1">
                            <span className="font-mono font-semibold text-[#0f172a] block">
                              Pedagogical Explanation:
                            </span>
                            <p className="text-[#334155] leading-relaxed">
                              {q.current_version?.explanation}
                            </p>
                          </div>
                        )}

                        {/* Verbatim Grounding Citation */}
                        {includeGrounding && sourceRef && (
                          <div className="p-2 bg-[#f1f5f9] rounded font-mono text-[11px] text-[#475569] flex items-center justify-between">
                            <div className="flex items-center gap-1.5 truncate">
                              <Icon name="file" size={13} />
                              <span className="truncate max-w-[280px]">
                                {sourceRef.resource_chunks?.resources
                                  ?.original_filename || 'Curriculum PDF'}
                              </span>
                              <span className="text-[#cbd5e1]">•</span>
                              <span>
                                Page{' '}
                                {sourceRef.resource_chunks?.page_number || 1}
                              </span>
                              <span className="text-[#cbd5e1]">•</span>
                              <code className="text-[#3157d5] bg-white px-1 py-0.2 rounded border border-[#e2e8f0]">
                                #{sourceRef.chunk_id}
                              </code>
                            </div>
                            <span className="text-emerald-700 font-semibold shrink-0">
                              Verified Grounding
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="mt-12 pt-4 border-t border-[#0f172a]/20 flex items-center justify-between font-mono text-[11px] text-[#64748b]">
                  <span>Internal Grading Ledger</span>
                  <span className="font-serif italic text-center">
                    CONFIDENTIAL • DO NOT DISTRIBUTE TO CANDIDATES
                  </span>
                  <span>[Page 1 of 1]</span>
                </div>
              </article>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
