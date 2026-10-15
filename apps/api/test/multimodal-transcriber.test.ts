import { describe, expect, it } from 'vitest';
import {
  parsePageDelimitedMarkdown,
  transcribePdfWithVision,
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

    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].text).toContain('Paging & Virtual Memory');
    expect(result.pages[0].text).toContain('[Handwritten marginalia]: Important exam topic!');
    expect(result.pages[0].text).toContain('Physical Address');

    expect(result.pages[1].pageNumber).toBe(2);
    expect(result.pages[1].text).toContain('Inverted Page Tables');
    expect(result.pages[1].text).toContain('Diagram: Hash table indexing');
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
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].text).toContain('Whiteboard Architecture Diagram');
    expect(result.pages[0].text).toContain('Ensure connection pooling');
  });

  it('handles empty input gracefully', () => {
    const result = parsePageDelimitedMarkdown('');
    expect(result.totalPages).toBe(0);
    expect(result.pages).toHaveLength(0);
  });
});
