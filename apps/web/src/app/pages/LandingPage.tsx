import { Icon, Logo, SectionEyebrow, SiteHeader } from '../components/ui';
import { Link } from 'react-router-dom';

function QuestionBlueprint() {
  return (
    <div className="blueprint-window window-shadow">
      <div className="window-toolbar">
        <span className="window-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="window-label">
          GENERATION BLUEPRINT <b>›</b> NEW SET
        </span>
        <span className="window-status">
          <span className="status-dot" /> READY
        </span>
      </div>
      <div className="blueprint-body">
        <div className="blueprint-main">
          <div className="panel-heading">
            <div>
              <span className="micro-label">QUESTION BLUEPRINT</span>
              <h3>Build your set</h3>
            </div>
            <span className="count-chip">20 ITEMS</span>
          </div>
          <div className="blueprint-grid">
            <div className="blueprint-field">
              <span className="field-label">QUESTION TYPE</span>
              <div className="segmented">
                <span className="selected">Mixed</span>
                <span>MCQ</span>
                <span>Short answer</span>
              </div>
            </div>
            <div className="blueprint-field">
              <span className="field-label">DIFFICULTY</span>
              <div className="difficulty-bars">
                <span />
                <span />
                <span className="muted" />
              </div>
              <div className="difficulty-labels">
                <b>Easy</b>
                <b>Medium</b>
                <b>Hard</b>
              </div>
            </div>
          </div>
          <div className="blueprint-field topic-field">
            <span className="field-label">TOPIC DISTRIBUTION</span>
            <div className="topic-bars">
              <span style={{ width: '48%' }} />
              <span style={{ width: '29%' }} />
              <span style={{ width: '23%' }} />
            </div>
            <div className="topic-legend">
              <span>
                <i className="indigo" /> Deadlocks &amp; Concurrency <b>48%</b>
              </span>
              <span>
                <i className="teal" /> Virtual Memory Management <b>29%</b>
              </span>
              <span>
                <i className="lavender" /> Preemptive CPU Scheduling <b>23%</b>
              </span>
            </div>
          </div>
          <div className="blueprint-field">
            <span className="field-label">BLOOM TAXONOMY</span>
            <div className="bloom-row">
              <span>Remember</span>
              <span>Understand</span>
              <span className="active">Apply</span>
              <span className="active">Analyze</span>
              <span className="active">Evaluate</span>
              <span>Create</span>
            </div>
          </div>
        </div>
        <aside className="blueprint-side">
          <span className="micro-label">CONFIGURATION SUMMARY</span>
          <div className="summary-number">20</div>
          <p>questions targeted</p>
          <div className="summary-rule" />
          <div className="summary-row">
            <span>Cognitive load</span>
            <b>Medium</b>
          </div>
          <div className="summary-row">
            <span>Grounding</span>
            <b className="teal-text">Required</b>
          </div>
          <div className="summary-row">
            <span>Duplicates</span>
            <b>Strict</b>
          </div>
          <button className="button button-dark" type="button">
            Save blueprint <Icon name="arrow" size={15} />
          </button>
        </aside>
      </div>
    </div>
  );
}

function GroundedQuestion() {
  return (
    <div className="question-window window-shadow">
      <div className="window-toolbar">
        <span className="window-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="window-label">
          Q-0842 <b>›</b> GENERATED QUESTION
        </span>
        <span className="window-status teal-text">
          <Icon name="verified" size={13} /> GROUNDED
        </span>
      </div>
      <div className="question-body">
        <div className="question-meta">
          <span className="tag tag-indigo">SCENARIO-BASED</span>
          <span className="tag tag-teal">
            <Icon name="check" size={12} /> VALID SPEC
          </span>
          <span className="question-number">01 / 20</span>
        </div>
        <h3>
          A distributed transaction engine maintains four worker processes
          competing for three non-preemptible mutex locks. Evaluate under which
          strict FIFO scheduling constraints a circular wait condition is
          mathematically guaranteed to induce catastrophic deadlock.
        </h3>
        <div className="option-list">
          <div>
            <b>A</b>
            <span>
              When lock hold-times are unbounded and resource allocation graphs
              contain cycles ≥ 3.
            </span>
          </div>
          <div className="correct">
            <b>B</b>
            <span>
              When the Coffman hold-and-wait condition is preserved without
              incremental resource ordering.
            </span>
            <Icon name="check" size={15} />
          </div>
          <div>
            <b>C</b>
            <span>
              When preemption vectors are overridden by symmetric priority
              escalation policies.
            </span>
          </div>
        </div>
        <div className="citation-card">
          <div className="citation-icon">
            <Icon name="book" size={17} />
          </div>
          <div>
            <span className="micro-label teal-text">SOURCE EVIDENCE</span>
            <p>
              <b>Silberschatz et al.</b>, Operating System Concepts (10th Ed),
              Chapter 8: Deadlocks, Section 8.3 “Resource Allocation Graphs”,
              pp. 318–321.
            </p>
          </div>
          <span className="citation-score">0.98</span>
        </div>
      </div>
    </div>
  );
}

function ValidationPanel() {
  return (
    <div className="validation-window window-shadow">
      <div className="validation-header">
        <div>
          <span className="micro-label">VERIFICATION PIPELINE</span>
          <h3>Every question earns its place.</h3>
        </div>
        <span className="verified-badge">
          <Icon name="verified" size={15} /> 4 / 4 PASSED
        </span>
      </div>
      <div className="validation-items">
        <div>
          <span className="validation-icon passed">
            <Icon name="check" size={15} />
          </span>
          <span>
            <b>Grounding</b>
            <small>Source evidence found</small>
          </span>
          <strong>100%</strong>
        </div>
        <div>
          <span className="validation-icon passed">
            <Icon name="check" size={15} />
          </span>
          <span>
            <b>Bloom alignment</b>
            <small>Analyze calibrated</small>
          </span>
          <strong>PASS</strong>
        </div>
        <div>
          <span className="validation-icon passed">
            <Icon name="check" size={15} />
          </span>
          <span>
            <b>Difficulty</b>
            <small>Hard calibrated</small>
          </span>
          <strong>PASS</strong>
        </div>
        <div>
          <span className="validation-icon passed">
            <Icon name="check" size={15} />
          </span>
          <span>
            <b>Semantic duplicate</b>
            <small>Project bank compared</small>
          </span>
          <strong>UNIQUE</strong>
        </div>
      </div>
    </div>
  );
}

function WorkflowCard({
  number,
  icon,
  title,
  text,
  label,
}: {
  number: string;
  icon: Parameters<typeof Icon>[0]['name'];
  title: string;
  text: string;
  label: string;
}) {
  return (
    <article className="workflow-card">
      <div className="workflow-number">{number}</div>
      <div className="workflow-icon">
        <Icon name={icon} size={19} />
      </div>
      <span className="micro-label">{label}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      <span className="workflow-arrow">
        <Icon name="arrowUpRight" size={16} />
      </span>
    </article>
  );
}

export function LandingPage() {
  return (
    <div className="site-page">
      <SiteHeader />
      <main>
        <section className="hero-section" id="product">
          <div className="shell hero-grid">
            <div className="hero-copy">
              <SectionEyebrow>LOCAL-FIRST QUESTION GENERATION</SectionEyebrow>
              <h1>
                Grounded knowledge.
                <br />
                <em>Better questions.</em>
              </h1>
              <p>
                Turn your study material into thoughtful, configurable
                questions—strictly grounded in the resources you provide.
              </p>
              <div className="hero-actions">
                <Link className="button button-primary" to="/sign-in">
                  Create your first project{' '}
                  <Icon name="arrowUpRight" size={16} />
                </Link>
                <a className="text-link" href="#workflow">
                  See how it works <Icon name="arrow" size={16} />
                </a>
              </div>
              <div className="hero-note">
                <span className="note-icon">
                  <Icon name="verified" size={15} />
                </span>
                <span>
                  Source-linked by design.
                  <br />
                  <b>Validated before it reaches your question bank.</b>
                </span>
              </div>
            </div>
            <div className="hero-visual">
              <div className="visual-orbit orbit-one" />
              <div className="visual-orbit orbit-two" />
              <div className="hero-visual-card">
                <div className="hero-card-top">
                  <span className="tag tag-indigo">ANALYZE</span>
                  <span className="hero-card-id">Q-0842</span>
                </div>
                <div className="hero-card-lines">
                  <span />
                  <span />
                  <span className="short" />
                </div>
                <div className="hero-card-divider" />
                <div className="hero-card-bottom">
                  <span className="mini-check">
                    <Icon name="check" size={12} />
                  </span>
                  <span>Grounding verified</span>
                  <b>0.98</b>
                </div>
              </div>
              <span className="float-label label-one">/ CONTEXT RETRIEVED</span>
              <span className="float-label label-two">/ VALIDATION PASS</span>
            </div>
          </div>
        </section>
        <section className="section blueprint-section">
          <div className="shell">
            <div className="section-intro">
              <SectionEyebrow>CONTROL THE COGNITIVE WORK</SectionEyebrow>
              <h2>
                Better questions start
                <br />
                <em>with better control.</em>
              </h2>
              <p>
                GroundQ gives curriculum designers and technical educators
                precise control over the variables that shape a useful question.
              </p>
            </div>
            <QuestionBlueprint />
          </div>
        </section>
        <section className="section question-section" id="validation">
          <div className="shell">
            <div className="section-intro split-intro">
              <div>
                <SectionEyebrow>FROM BLUEPRINT TO QUESTION</SectionEyebrow>
                <h2>
                  Generated with intent.
                  <br />
                  <em>Evidence attached.</em>
                </h2>
              </div>
              <p>
                Every accepted question carries its own context, cognitive
                target, and validation trail—so you can review the reasoning
                behind the result.
              </p>
            </div>
            <GroundedQuestion />
            <ValidationPanel />
          </div>
        </section>
        <section className="section contrast-section" id="features">
          <div className="shell">
            <div className="section-intro centered">
              <SectionEyebrow>WHY GROUNDQ</SectionEyebrow>
              <h2>
                Generic prompting is not
                <br />
                <em>a generation strategy.</em>
              </h2>
              <p>
                GroundQ replaces vague instructions with explicit controls,
                source evidence, and a reviewable quality loop.
              </p>
            </div>
            <div className="contrast-grid">
              <div className="contrast-column ordinary">
                <div className="contrast-title">
                  <span className="contrast-x">×</span>
                  <span>ORDINARY LLM PROMPTING</span>
                </div>
                <div className="contrast-item">
                  <b>Shallow factual recall</b>
                  <p>
                    Regurgitates trivial keyword definitions instead of testing
                    deep conceptual synthesis.
                  </p>
                </div>
                <div className="contrast-item">
                  <b>Repetitive phrasing</b>
                  <p>
                    Predictable stems make question sets easy to game and hard
                    to distinguish.
                  </p>
                </div>
                <div className="contrast-item">
                  <b>Hallucinatory drift</b>
                  <p>
                    Can invent concepts, page numbers, or properties absent from
                    the curriculum.
                  </p>
                </div>
                <div className="contrast-item">
                  <b>Monolithic difficulty</b>
                  <p>
                    Treats “hard” as longer text instead of meaningful cognitive
                    depth.
                  </p>
                </div>
              </div>
              <div className="contrast-column groundq">
                <div className="contrast-title">
                  <span className="contrast-check">
                    <Icon name="check" size={14} />
                  </span>
                  <span>GROUNDQ CONTROLLABLE ENGINE</span>
                </div>
                <div className="contrast-item">
                  <b>Evidence-linked grounding</b>
                  <p>
                    Questions stay anchored to the exact study resources
                    selected for the project.
                  </p>
                </div>
                <div className="contrast-item">
                  <b>Multi-tier Bloom taxonomy</b>
                  <p>
                    Target application, analysis, evaluation, and creation—not
                    only recognition.
                  </p>
                </div>
                <div className="contrast-item">
                  <b>Configurable distributions</b>
                  <p>
                    Set exact percentages across topics, cognitive levels,
                    difficulty, and formats.
                  </p>
                </div>
                <div className="contrast-item">
                  <b>Semantic verification</b>
                  <p>
                    Project-scoped similarity checks help prevent redundant
                    questions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="section workflow-section" id="workflow">
          <div className="shell">
            <div className="section-intro centered">
              <SectionEyebrow>WORKFLOW</SectionEyebrow>
              <h2>
                From study material
                <br />
                <em>to question set.</em>
              </h2>
              <p>
                A verifiable extraction process designed to honor the
                authoritative context of your original academic literature.
              </p>
            </div>
            <div className="workflow-grid">
              <WorkflowCard
                number="01"
                icon="upload"
                label="INGESTION"
                title="Add your material"
                text="Upload PDF textbooks, lecture slides, or notes. GroundQ prepares your resources for traceable generation."
              />
              <WorkflowCard
                number="02"
                icon="network"
                label="TAXONOMY"
                title="Review your topics"
                text="Organize the topic map and choose what deserves emphasis in the next generation pass."
              />
              <WorkflowCard
                number="03"
                icon="sliders"
                label="BLUEPRINT"
                title="Define the blueprint"
                text="Configure target counts, Bloom distributions, cognitive difficulty, and duplicate policy."
              />
              <WorkflowCard
                number="04"
                icon="spark"
                label="SYNTHESIS"
                title="Generate & review"
                text="Receive questions with evidence, validation results, and a clear path to manual review."
              />
            </div>
          </div>
        </section>
        <section className="section question-bank-section" id="question-bank">
          <div className="shell question-bank-card">
            <div className="question-bank-copy">
              <SectionEyebrow>YOUR PROJECT QUESTION BANK</SectionEyebrow>
              <h2>
                Keep the context.
                <br />
                <em>Keep the confidence.</em>
              </h2>
              <p>
                Every generated question remains connected to its source
                evidence, validation history, and version trail.
              </p>
              <Link className="button button-dark" to="/sign-in">
                Explore the workspace <Icon name="arrow" size={16} />
              </Link>
            </div>
            <div className="bank-preview">
              <div className="bank-row bank-row-head">
                <span>QUESTION</span>
                <span>TOPIC</span>
                <span>STATUS</span>
              </div>
              <div className="bank-row">
                <b>Compare the trade-offs of...</b>
                <span>Memory management</span>
                <em className="pill-success">VALIDATED</em>
              </div>
              <div className="bank-row">
                <b>Design a scheduling policy...</b>
                <span>Process scheduling</span>
                <em className="pill-success">VALIDATED</em>
              </div>
              <div className="bank-row">
                <b>Evaluate a deadlock scenario...</b>
                <span>Concurrency</span>
                <em className="pill-review">REVIEW</em>
              </div>
              <div className="bank-row">
                <b>Explain the impact of...</b>
                <span>Virtual memory</span>
                <em className="pill-success">VALIDATED</em>
              </div>
            </div>
          </div>
        </section>
        <section className="final-cta">
          <div className="shell">
            <span className="final-mark">
              <Icon name="spark" size={22} />
            </span>
            <SectionEyebrow>START WITH WHAT YOU KNOW</SectionEyebrow>
            <h2>
              Build questions
              <br />
              <em>worth asking.</em>
            </h2>
            <p>
              Bring your material. Keep your standards. Let GroundQ handle the
              structure.
            </p>
            <Link className="button button-primary" to="/sign-in">
              Create your first project <Icon name="arrowUpRight" size={16} />
            </Link>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="shell footer-inner">
          <Logo />
          <span>Grounded knowledge. Better questions.</span>
          <div>
            <a href="#product">Product</a>
            <a href="#workflow">How it works</a>
            <a href="#features">Features</a>
            <a href="mailto:hello@groundq.local">Contact</a>
          </div>
          <small>© 2026 GroundQ. Built for better questions.</small>
        </div>
      </footer>
    </div>
  );
}
