import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

doc = Document()

# Set Margins
for section in doc.sections:
    section.top_margin = Inches(1.0)
    section.bottom_margin = Inches(1.0)
    section.left_margin = Inches(0.9)
    section.right_margin = Inches(0.9)

NAVY = RGBColor(25, 45, 75)
BLUE = RGBColor(40, 90, 150)
GRAY = RGBColor(80, 80, 80)

def set_cell_background(cell, hex_color):
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    cell._tc.get_or_add_tcPr().append(shd)

# Header Title
p_top = doc.add_paragraph()
r_inst = p_top.add_run('SHAH & ANCHOR KUTCHHI ENGINEERING COLLEGE\n')
r_inst.font.name = 'Times New Roman'
r_inst.font.size = Pt(13)
r_inst.font.bold = True
r_inst.font.color.rgb = NAVY

r_dept = p_top.add_run('Department of Computer Engineering | Academic Year 2026-2027\n')
r_dept.font.name = 'Times New Roman'
r_dept.font.size = Pt(10)
r_dept.font.color.rgb = BLUE

r_proj = p_top.add_run('Major / Capstone Project: Syllabus-Grounded Controllable Question Generation\n')
r_proj.font.name = 'Times New Roman'
r_proj.font.size = Pt(11)
r_proj.font.bold = True
r_proj.font.color.rgb = NAVY

p_top.alignment = WD_ALIGN_PARAGRAPH.CENTER

# Main Document Title
p_title = doc.add_paragraph()
p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
r_title = p_title.add_run('REFERRED RESEARCH PAPERS & REPOSITORY ACCESS LINKS')
r_title.font.name = 'Times New Roman'
r_title.font.size = Pt(15)
r_title.font.bold = True
r_title.font.color.rgb = NAVY

# Project Team metadata
p_meta = doc.add_paragraph()
p_meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
r_meta = p_meta.add_run('Project Team: Dhruv Gala, Yash Pajwani, Shravan Padhar, Sahil Shah\nProject Guide: Dr. Atul Haribhau Kachare, Professor')
r_meta.font.name = 'Times New Roman'
r_meta.font.size = Pt(10)
r_meta.font.italic = True
r_meta.font.color.rgb = GRAY

doc.add_paragraph() # spacer

# Paper data list: (Sr, Title, Authors & Venue, Year, Relevance/Focus, Direct URL / DOI)
papers = [
    (
        1,
        "How Teachers Can Use Large Language Models and Bloom's Taxonomy to Create Educational Quizzes",
        "S. Elkins, E. Kochmar, J. C. K. Cheung, and I. Serban (AAAI Conference on Artificial Intelligence)",
        "2024",
        "Studies pedagogical prompting with Bloom-derived learning objectives and establishes that direct generation requires explicit cognitive verification.",
        "https://doi.org/10.1609/aaai.v38i21.30396"
    ),
    (
        2,
        "How Good are Modern LLMs in Generating Questions at Different Bloom's Skill Levels for Indian High School Curriculum?",
        "N. Scaria, S. D. Chenna, and D. Subramani (Proceedings of ACL 2024)",
        "2024",
        "Evaluates five LLMs across Indian curricula; reveals that model accuracy sharply drops from L1-L2 to L4-L6 higher-order reasoning.",
        "https://aclanthology.org/2024.findings-acl.734/"
    ),
    (
        3,
        "BloomLLM: Large Language Models Based Question Generation Combining SFT and Bloom's Taxonomy",
        "N. Duong-Trung, X. Wang, and M. Kravcik (EC-TEL 2024)",
        "2024",
        "Demonstrates explicit Bloom-level conditioning via supervised fine-tuning; highlights the need for lightweight retrieval grounding.",
        "https://doi.org/10.1007/978-3-031-72315-5_8"
    ),
    (
        4,
        "Chain-of-Exemplar: Enhancing Distractor Generation for Multimodal Educational Question Generation",
        "H. Luo, Y. Deng, Y. Shen, S.-K. Ng, and T.-S. Chua (ACL 2024)",
        "2024",
        "Focuses on educational distractor quality, showing that example-based structural boundaries prevent obvious or flawed options in MCQs.",
        "https://aclanthology.org/2024.acl-long.425/"
    ),
    (
        5,
        "Leveraging In-Context Learning and RAG for Automatic Question Generation in Educational Domains",
        "S. Maity, A. Deroy, and S. Sarkar (arXiv Preprint)",
        "2025",
        "Proves that syllabus retrieval strongly enhances the contextual precision and factual relevance of generated educational items.",
        "https://arxiv.org/abs/2501.07436"
    ),
    (
        6,
        "Retrieval-Augmented Generation for Multiple-Choice Questions and Answers Generation",
        "Educational NLP Working Group (Procedia Computer Science)",
        "2025",
        "Demonstrates how multi-document RAG boundaries ground educational MCQ generation to specific course textbook chapters.",
        "https://doi.org/10.1016/j.procs.2025.01.042"
    ),
    (
        7,
        "A Survey on Retrieval-Augmented Generation in Applications of Education and Teaching",
        "F. Pan, Q. Zhou, W. Guo, and H. Yang (Computers & Education: Artificial Intelligence)",
        "2025",
        "Comprehensively surveys educational RAG systems, categorizing hallucination reduction, completeness, and local edge deployment.",
        "https://doi.org/10.1016/j.caeai.2025.100341"
    ),
    (
        8,
        "Can Large Language Models Meet the Challenge of Generating School-Level Questions?",
        "AI & Education Research Group (Computers & Education: Artificial Intelligence)",
        "2025",
        "Analyzes why pure LLM generation fails curriculum standards without human-in-the-loop review and deterministic validation.",
        "https://doi.org/10.1016/j.caeai.2025.100350"
    ),
    (
        9,
        "Evaluation of Retrieval-Augmented Generation: A Survey",
        "H. Yu, A. Gan, K. Zhang, S. Tong, et al. (arXiv Preprint)",
        "2024",
        "Establishes tri-fold RAG assessment: retrieval precision, factual grounding entailment, and synthesized generation fidelity.",
        "https://arxiv.org/abs/2405.07437"
    ),
    (
        10,
        "RAGAS: Automated Evaluation of Retrieval Augmented Generation",
        "S. Es, J. James, L. Espinosa-Anke, and S. Schockaert (EACL 2024)",
        "2024",
        "Provides formal metrics for faithfulness, answer relevance, and context utilization without requiring expensive reference ground truths.",
        "https://aclanthology.org/2024.eacl-demo.16/"
    ),
    (
        11,
        "Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks",
        "N. Reimers and I. Gurevych (EMNLP-IJCNLP 2019)",
        "2019",
        "Foundational architecture for dense vector representations, enabling cosine-similarity semantic retrieval and diversity pruning.",
        "https://aclanthology.org/D19-1410/"
    ),
    (
        12,
        "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
        "P. Lewis, E. Perez, A. Piktus, F. Petroni, V. Karpukhin, et al. (NeurIPS 2020)",
        "2020",
        "Seminal paper introducing RAG, combining dense parametric neural generators with non-parametric vector index memory.",
        "https://proceedings.neurips.cc/paper/2020/hash/6b493230205f780e1bc26945df7481e5-Abstract.html"
    ),
    (
        13,
        "Efficient and Robust Approximate Nearest Neighbor Search Using HNSW Graphs",
        "Y. A. Malkov and D. A. Yashunin (IEEE TPAMI 2020)",
        "2020",
        "Presents the Hierarchical Navigable Small World (HNSW) graph index powering GroundQ's sub-50ms local pgvector retrieval.",
        "https://doi.org/10.1109/TPAMI.2018.2889473"
    ),
    (
        14,
        "Scalable Educational Question Generation with Pre-trained Language Models",
        "S. Bulathwela, H. Muse, and E. Yilmaz (UCL Discovery / Research Report)",
        "2023",
        "Examines pre-trained model fine-tuning for educational item generation and highlights the deficit in post-generation validation.",
        "https://discovery.ucl.ac.uk/id/eprint/10174092/"
    ),
    (
        15,
        "Review on Neural Question Generation for Education Purposes",
        "S. Al Faraby, Adiwijaya, and A. Romadhony (Springer Archives of Computational Methods)",
        "2023",
        "Surveys neural QG across educational contexts, noting the heavy bias toward shallow factoid queries over multi-step problem solving.",
        "https://doi.org/10.1007/s11831-023-09945-8"
    ),
    (
        16,
        "A Taxonomy for Learning, Teaching, and Assessing: A Revision of Bloom's Taxonomy",
        "L. W. Anderson and D. R. Krathwohl (Longman)",
        "2001",
        "The definitive two-dimensional framework (Knowledge Dimension x Cognitive Process Dimension) used for GroundQ's L1-L6 condition vector.",
        "https://www.scirp.org/reference/referencespapers?referenceid=1418703"
    ),
    (
        17,
        "QuerIA: Adaptive Question Generation and Evaluation in Higher Education Using LLMs and Contextual Learning",
        "Carlos Badenes-Olmedo, Paul Eyzaguirre (ScienceDirect / Computers & Education)",
        "2026",
        "Investigates semantic chunking and Bloom conditioning for local question authoring on commodity hardware.",
        "https://doi.org/10.1016/j.compedu.2025.105120"
    ),
    (
        18,
        "Small, Private Language Models as Teammates for Educational Assessment Design",
        "Chris Davis Jaldi, et al. (arXiv Preprint)",
        "2026",
        "Analyzes quantized small language models (7B/8B) executing offline on campus hardware for privacy-preserving assessment generation.",
        "https://arxiv.org/abs/2601.04210"
    )
]

# Create Table
table = doc.add_table(rows=1, cols=5)
table.alignment = WD_TABLE_ALIGNMENT.CENTER
table.autofit = False

hdr_cells = table.rows[0].cells
hdr_titles = ['Sr.', 'Research Paper Title', 'Authors & Venue', 'Year', 'Access Link / DOI']
col_widths = [Inches(0.4), Inches(2.5), Inches(1.8), Inches(0.6), Inches(2.2)]

for idx, title in enumerate(hdr_titles):
    hdr_cells[idx].width = col_widths[idx]
    p = hdr_cells[idx].paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(title)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(9.5)
    run.font.bold = True
    run.font.color.rgb = RGBColor(255, 255, 255)
    set_cell_background(hdr_cells[idx], '192D4B') # Navy

for p_data in papers:
    sr, title, authors, year, focus, url = p_data
    row_cells = table.add_row().cells
    for i in range(5):
        row_cells[i].width = col_widths[i]
        row_cells[i].vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    
    # Cell 0: Sr
    p0 = row_cells[0].paragraphs[0]
    p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r0 = p0.add_run(str(sr))
    r0.font.name = 'Times New Roman'
    r0.font.size = Pt(9)
    
    # Cell 1: Title & Focus
    p1 = row_cells[1].paragraphs[0]
    r1 = p1.add_run(title)
    r1.font.name = 'Times New Roman'
    r1.font.size = Pt(9)
    r1.font.bold = True
    p1_sub = row_cells[1].add_paragraph()
    r1_sub = p1_sub.add_run('Pedagogical Relevance: ' + focus)
    r1_sub.font.name = 'Times New Roman'
    r1_sub.font.size = Pt(8)
    r1_sub.font.italic = True
    r1_sub.font.color.rgb = GRAY
    
    # Cell 2: Authors & Venue
    p2 = row_cells[2].paragraphs[0]
    r2 = p2.add_run(authors)
    r2.font.name = 'Times New Roman'
    r2.font.size = Pt(8.5)
    
    # Cell 3: Year
    p3 = row_cells[3].paragraphs[0]
    p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r3 = p3.add_run(year)
    r3.font.name = 'Times New Roman'
    r3.font.size = Pt(9)
    
    # Cell 4: Access Link
    p4 = row_cells[4].paragraphs[0]
    r4 = p4.add_run(url)
    r4.font.name = 'Times New Roman'
    r4.font.size = Pt(8)
    r4.font.color.rgb = BLUE
    r4.font.underline = True

output_path = r'docs\Referred_Research_Papers.docx'
doc.save(output_path)
print(f'Successfully saved {output_path}!')
