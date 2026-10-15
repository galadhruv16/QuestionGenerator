import { describe, expect, it } from 'vitest';
import zlib from 'node:zlib';
import {
  extractPagesFromDocx,
  extractPagesFromPptx,
  readZipEntries,
} from '../src/services/office-extractor.js';

// Simple CRC-32 table generator for in-memory zip creation
function crc32(buf: Buffer): number {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (~crc) >>> 0;
}

function createZipBuffer(files: { filename: string; content: string }[]): Buffer {
  const localChunks: Buffer[] = [];
  const cdChunks: Buffer[] = [];
  let currentOffset = 0;

  for (const file of files) {
    const rawContent = Buffer.from(file.content, 'utf-8');
    const compressed = zlib.deflateRawSync(rawContent);
    const checksum = crc32(rawContent);
    const filenameBuf = Buffer.from(file.filename, 'utf-8');

    // Local header
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature
    localHeader.writeUInt16LE(20, 4); // Version
    localHeader.writeUInt16LE(0, 6); // Flags
    localHeader.writeUInt16LE(8, 8); // Method Deflate
    localHeader.writeUInt32LE(0, 10); // Time/date
    localHeader.writeUInt32LE(checksum, 14); // CRC
    localHeader.writeUInt32LE(compressed.length, 18); // Compressed
    localHeader.writeUInt32LE(rawContent.length, 22); // Uncompressed
    localHeader.writeUInt16LE(filenameBuf.length, 26); // Filename length
    localHeader.writeUInt16LE(0, 28); // Extra length

    const localEntry = Buffer.concat([localHeader, filenameBuf, compressed]);
    localChunks.push(localEntry);

    // Central directory header
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0); // Signature
    cdHeader.writeUInt16LE(20, 4); // Made by
    cdHeader.writeUInt16LE(20, 6); // Needed
    cdHeader.writeUInt16LE(0, 8); // Flags
    cdHeader.writeUInt16LE(8, 10); // Method Deflate
    cdHeader.writeUInt32LE(0, 12); // Time/date
    cdHeader.writeUInt32LE(checksum, 16); // CRC
    cdHeader.writeUInt32LE(compressed.length, 20); // Compressed
    cdHeader.writeUInt32LE(rawContent.length, 24); // Uncompressed
    cdHeader.writeUInt16LE(filenameBuf.length, 28); // Filename length
    cdHeader.writeUInt16LE(0, 30); // Extra length
    cdHeader.writeUInt16LE(0, 32); // Comment length
    cdHeader.writeUInt16LE(0, 34); // Disk 0
    cdHeader.writeUInt16LE(0, 36); // Internal attr
    cdHeader.writeUInt32LE(0, 38); // External attr
    cdHeader.writeUInt32LE(currentOffset, 42); // Local header offset

    cdChunks.push(Buffer.concat([cdHeader, filenameBuf]));
    currentOffset += localEntry.length;
  }

  const allLocal = Buffer.concat(localChunks);
  const allCd = Buffer.concat(cdChunks);

  // EOCD
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // Signature
  eocd.writeUInt16LE(0, 4); // Disk
  eocd.writeUInt16LE(0, 6); // CD Disk
  eocd.writeUInt16LE(files.length, 8); // Entries on disk
  eocd.writeUInt16LE(files.length, 10); // Total entries
  eocd.writeUInt32LE(allCd.length, 12); // CD size
  eocd.writeUInt32LE(allLocal.length, 16); // CD offset
  eocd.writeUInt16LE(0, 20); // Comment len

  return Buffer.concat([allLocal, allCd, eocd]);
}

describe('Office Document Extractor', () => {
  it('reads entries from a valid ZIP buffer', () => {
    const zip = createZipBuffer([
      { filename: 'hello.txt', content: 'Hello World from GroundQ' },
    ]);
    const entries = readZipEntries(zip);
    expect(entries.has('hello.txt')).toBe(true);
    expect(entries.get('hello.txt')?.toString('utf-8')).toBe(
      'Hello World from GroundQ',
    );
  });

  it('extracts slides, titles, and speaker notes from a PPTX file', () => {
    const slide1Xml = `
      <p:spTree xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:p><a:r><a:t>Distributed Consensus</a:t></a:r></a:p>
        <a:p><a:r><a:t>Paxos and Raft overview</a:t></a:r></a:p>
      </p:spTree>
    `;
    const slide2Xml = `
      <p:spTree xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:p><a:r><a:t>Leader Election Algorithm</a:t></a:r></a:p>
        <a:p><a:r><a:t>Heartbeat intervals and timeouts</a:t></a:r></a:p>
      </p:spTree>
    `;
    const notes1Xml = `
      <p:spTree xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:p><a:r><a:t>Highlight safety invariant over liveness.</a:t></a:r></a:p>
      </p:spTree>
    `;

    const pptxBuffer = createZipBuffer([
      { filename: 'ppt/slides/slide1.xml', content: slide1Xml },
      { filename: 'ppt/slides/slide2.xml', content: slide2Xml },
      { filename: 'ppt/notesSlides/notesSlide1.xml', content: notes1Xml },
    ]);

    const result = extractPagesFromPptx(pptxBuffer);

    expect(result.totalPages).toBe(2);
    expect(result.pages).toHaveLength(2);

    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].text).toContain('Distributed Consensus');
    expect(result.pages[0].text).toContain('Paxos and Raft overview');
    expect(result.pages[0].text).toContain(
      '[Speaker Notes]: Highlight safety invariant over liveness.',
    );

    expect(result.pages[1].pageNumber).toBe(2);
    expect(result.pages[1].text).toContain('Leader Election Algorithm');
  });

  it('extracts paragraphs and pages from a DOCX document', () => {
    const docXml = `
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>Unit 4: Operating System Synchronization</w:t></w:r></w:p>
          <w:p><w:r><w:t>Semaphores and Mutex locks prevent race conditions.</w:t></w:r></w:p>
          <w:p><w:r><w:br w:type="page"/></w:r></w:p>
          <w:p><w:r><w:t>Classic Problems of Synchronization: Dining Philosophers.</w:t></w:r></w:p>
        </w:body>
      </w:document>
    `;

    const docxBuffer = createZipBuffer([
      { filename: 'word/document.xml', content: docXml },
    ]);

    const result = extractPagesFromDocx(docxBuffer);

    expect(result.totalPages).toBe(2);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].text).toContain('Operating System Synchronization');
    expect(result.pages[1].text).toContain('Dining Philosophers');
  });
});
