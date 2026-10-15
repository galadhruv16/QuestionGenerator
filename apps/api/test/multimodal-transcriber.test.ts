import { describe, expect, it } from 'vitest';
import {
  calculatePageWindows,
  countPdfPagesFromBuffer,
  parsePageDelimitedMarkdown,
} from '../src/services/multimodal-transcriber.js';

describe('Multimodal Transcriber Service', () => {
  it('parses page-delimited markdown into structured pages with headers and handwritten notes', () => {
    const rawMarkdown = `
--- Page 1 ---
# Lecture 3: Paging & Virtual Memory
[Handwritten marginalia]: Important exam topic!
Linear page table structure:
$$ \\text{Physical Address} = \\text{Frame} \\times \\text{Page Size} + \\text{Offset} $$

--- Page 2 ---
# Inverted Page Tables
Diagram: Hash table indexing virtual page numbers to inverted frame entries.
Key advantage: Memory overhead is proportional to physical memory, not virtual address space.
`;

    const result = parsePageDelimitedMarkdown(rawMarkdown);

    expect(result.totalPages).toBe(2);
    expect(result.pages).toHaveLength(2);

    expect(result.pages[0]!.pageNumber).toBe(1);
    expect(result.pages[0]!.text).toContain('Paging & Virtual Memory');
    expect(result.pages[0]!.text).toContain(
      '[Handwritten marginalia]: Important exam topic!',
    );
    expect(result.pages[0]!.text).toContain('Physical Address');

    expect(result.pages[1]!.pageNumber).toBe(2);
    expect(result.pages[1]!.text).toContain('Inverted Page Tables');
    expect(result.pages[1]!.text).toContain('Diagram: Hash table indexing');
  });

  it('treats undivided single-page notes as a clean single page', () => {
    const singleNote = `
# Whiteboard Architecture Diagram
Client -> Load Balancer -> Node.js API Service -> PostgreSQL Database
Handwritten note at bottom: "Ensure connection pooling with max 20 clients"
`;

    const result = parsePageDelimitedMarkdown(singleNote);

    expect(result.totalPages).toBe(1);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]!.pageNumber).toBe(1);
    expect(result.pages[0]!.text).toContain('Whiteboard Architecture Diagram');
    expect(result.pages[0]!.text).toContain('Ensure connection pooling');
  });

  it('handles empty input gracefully', () => {
    const result = parsePageDelimitedMarkdown('');
    expect(result.totalPages).toBe(0);
    expect(result.pages).toHaveLength(0);
  });

  it('calculates sliding page windows for 300-page massive textbooks', () => {
    // 300 pages partitioned into 10-page windows
    const windows300 = calculatePageWindows(300, 10);
    expect(windows300).toHaveLength(30);

    expect(windows300[0]).toEqual({ startPage: 1, endPage: 10 });
    expect(windows300[1]).toEqual({ startPage: 11, endPage: 20 });
    expect(windows300[14]).toEqual({ startPage: 141, endPage: 150 });
    expect(windows300[29]).toEqual({ startPage: 291, endPage: 300 });

    // Edge cases: non-multiples of window size
    const windows25 = calculatePageWindows(25, 10);
    expect(windows25).toHaveLength(3);
    expect(windows25[0]).toEqual({ startPage: 1, endPage: 10 });
    expect(windows25[1]).toEqual({ startPage: 11, endPage: 20 });
    expect(windows25[2]).toEqual({ startPage: 21, endPage: 25 });

    // Small document (5 pages)
    const windows5 = calculatePageWindows(5, 10);
    expect(windows5).toHaveLength(1);
    expect(windows5[0]).toEqual({ startPage: 1, endPage: 5 });

    // Empty
    expect(calculatePageWindows(0, 10)).toHaveLength(0);
  });

  it('counts PDF pages from binary buffer using structural regex fallback', () => {
    // Simulated PDF binary with 3 page objects
    const simulatedPdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>\nendobj\n' +
        '3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n' +
        '4 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n' +
        '5 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n' +
        '%%EOF',
    );

    const pageCount = countPdfPagesFromBuffer(simulatedPdfBuffer);
    expect(pageCount).toBe(3);
  });

  it('counts PDF pages from /Count header when /Type /Page objects are embedded or compressed', () => {
    const compressedPdfBuffer = Buffer.from(
      '%PDF-1.5\n<< /Type /Pages /Count 145 >>\nstream\n...compressed binary stream...\nendstream\n%%EOF',
    );

    const pageCount = countPdfPagesFromBuffer(compressedPdfBuffer);
    expect(pageCount).toBe(145);
  });
});
