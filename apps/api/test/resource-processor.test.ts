import { describe, expect, it } from 'vitest';
import {
  chunkPages,
  type ExtractedPage,
} from '../src/services/resource-processor.js';

describe('Resource Processor Chunker', () => {
  it('returns empty array when pages have no text', () => {
    const pages: ExtractedPage[] = [
      { pageNumber: 1, text: '   ' },
      { pageNumber: 2, text: '' },
    ];
    const chunks = chunkPages(pages);
    expect(chunks).toHaveLength(0);
  });

  it('preserves page number and calculates approximate token count for short pages', () => {
    const pages: ExtractedPage[] = [
      {
        pageNumber: 1,
        text: 'Introduction to Operating Systems: Virtual Memory and Paging.',
      },
      {
        pageNumber: 2,
        text: 'Page replacement algorithms include FIFO, LRU, and Optimal.',
      },
    ];

    const chunks = chunkPages(pages);
    expect(chunks).toHaveLength(2);

    expect(chunks[0].pageNumber).toBe(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].text).toContain('Virtual Memory');
    expect(chunks[0].tokenCount).toBeGreaterThan(0);

    expect(chunks[1].pageNumber).toBe(2);
    expect(chunks[1].chunkIndex).toBe(1);
    expect(chunks[1].text).toContain('Page replacement');
  });

  it('splits long page content into overlapping chunks with identical page number', () => {
    const longText = 'Deadlock detection algorithm. '.repeat(100); // ~3,000 chars
    const pages: ExtractedPage[] = [{ pageNumber: 5, text: longText }];

    const targetSize = 1000;
    const overlap = 200;
    const chunks = chunkPages(pages, targetSize, overlap);

    expect(chunks.length).toBeGreaterThan(1);

    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].pageNumber).toBe(5);
      expect(chunks[i].chunkIndex).toBe(i);
      expect(chunks[i].text.length).toBeLessThanOrEqual(targetSize);
    }

    // Verify overlap between chunk 0 and chunk 1
    const chunk0Tail = chunks[0].text.slice(-50);
    expect(chunks[1].text).toContain(chunk0Tail);
  });
});
