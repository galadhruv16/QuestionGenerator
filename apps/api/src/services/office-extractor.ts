import zlib from 'node:zlib';
import type { ExtractedPage } from './resource-processor.js';

interface ZipEntry {
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  filename: string;
  localHeaderOffset: number;
}

/**
 * Parses a ZIP buffer (PPTX/DOCX) using standard Central Directory parsing with node:zlib.
 */
export function readZipEntries(buffer: Buffer): Map<string, Buffer> {
  const fileMap = new Map<string, Buffer>();

  // Find End of Central Directory Record (EOCD) by scanning backwards from buffer end
  let eocdOffset = -1;
  const maxSearch = Math.min(buffer.length, 65535 + 22);
  const searchStart = buffer.length - 22;

  for (let i = searchStart; i >= buffer.length - maxSearch; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Invalid archive: End of Central Directory (EOCD) record not found.');
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  let currentOffset = centralDirectoryOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (currentOffset + 46 > buffer.length) break;
    const sig = buffer.readUInt32LE(currentOffset);
    if (sig !== 0x02014b50) break; // Central Directory file header signature

    const compressionMethod = buffer.readUInt16LE(currentOffset + 10);
    const compressedSize = buffer.readUInt32LE(currentOffset + 20);
    const uncompressedSize = buffer.readUInt32LE(currentOffset + 24);
    const filenameLen = buffer.readUInt16LE(currentOffset + 28);
    const extraLen = buffer.readUInt16LE(currentOffset + 30);
    const commentLen = buffer.readUInt16LE(currentOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(currentOffset + 42);

    const filename = buffer.toString('utf-8', currentOffset + 46, currentOffset + 46 + filenameLen);

    // Read local header to get exact data offset
    if (localHeaderOffset + 30 <= buffer.length) {
      const localSig = buffer.readUInt32LE(localHeaderOffset);
      if (localSig === 0x04034b50) {
        const localFilenameLen = buffer.readUInt16LE(localHeaderOffset + 26);
        const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
        const dataOffset = localHeaderOffset + 30 + localFilenameLen + localExtraLen;

        if (dataOffset + compressedSize <= buffer.length) {
          const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);
          let decompressed: Buffer;

          if (compressionMethod === 0) {
            decompressed = compressedData;
          } else if (compressionMethod === 8) {
            try {
              decompressed = zlib.inflateRawSync(compressedData);
            } catch {
              decompressed = Buffer.alloc(0);
            }
          } else {
            decompressed = Buffer.alloc(0);
          }

          fileMap.set(filename, decompressed);
        }
      }
    }

    currentOffset += 46 + filenameLen + extraLen + commentLen;
  }

  return fileMap;
}

/**
 * Extracts clean text from an XML string containing <a:t> or <w:t> tags.
 */
function extractXmlText(xml: string, tag: 'a:t' | 'w:t'): string {
  const regex = new RegExp(`<${tag}(?:[^>]*)>([^<]*)<\\/${tag}>`, 'gi');
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    if (match[1]) {
      matches.push(match[1]);
    }
  }

  return matches.join(' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Extracts slides from a PPTX file buffer.
 */
export function extractPagesFromPptx(buffer: Buffer): {
  pages: ExtractedPage[];
  totalPages: number;
} {
  const zipFiles = readZipEntries(buffer);
  const slideEntries: { index: number; filename: string }[] = [];

  for (const filename of zipFiles.keys()) {
    const match = filename.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
    if (match && match[1]) {
      slideEntries.push({
        filename,
        index: parseInt(match[1], 10),
      });
    }
  }

  // Sort slides numerically
  slideEntries.sort((a, b) => a.index - b.index);

  const pages: ExtractedPage[] = [];

  for (let i = 0; i < slideEntries.length; i++) {
    const slideNumber = i + 1;
    const entry = slideEntries[i];
    if (!entry) continue;

    const xmlBuffer = zipFiles.get(entry.filename);
    const xmlContent = xmlBuffer ? xmlBuffer.toString('utf-8') : '';

    const slideText = extractXmlText(xmlContent, 'a:t');

    // Also check for optional speaker notes
    const notesFilename = `ppt/notesSlides/notesSlide${entry.index}.xml`;
    const notesBuffer = zipFiles.get(notesFilename);
    const notesText = notesBuffer
      ? extractXmlText(notesBuffer.toString('utf-8'), 'a:t')
      : '';

    let combinedText = `[Slide ${slideNumber}] ${slideText}`.trim();
    if (notesText && notesText.length > 0) {
      combinedText += `\n[Speaker Notes]: ${notesText}`;
    }

    if (combinedText.length > 0) {
      pages.push({
        pageNumber: slideNumber,
        text: combinedText,
      });
    }
  }

  return {
    pages,
    totalPages: slideEntries.length,
  };
}

/**
 * Extracts text from a DOCX file buffer.
 */
export function extractPagesFromDocx(buffer: Buffer): {
  pages: ExtractedPage[];
  totalPages: number;
} {
  const zipFiles = readZipEntries(buffer);
  const docXmlBuffer = zipFiles.get('word/document.xml');

  if (!docXmlBuffer) {
    throw new Error('Invalid DOCX document: word/document.xml not found.');
  }

  const xmlContent = docXmlBuffer.toString('utf-8');

  // Split by page breaks if available, otherwise by paragraph chunks
  const pageBreakRegex =
    /<w:br[^>]*w:type="page"[^>]*\/>|<w:lastRenderedPageBreak[^>]*\/>/i;
  const rawSections = xmlContent.split(pageBreakRegex);

  const pages: ExtractedPage[] = [];
  let pageIndex = 1;

  for (const section of rawSections) {
    const text = extractXmlText(section, 'w:t');
    if (text.length > 0) {
      pages.push({
        pageNumber: pageIndex++,
        text,
      });
    }
  }

  // If document had no explicit page breaks, chunk by ~2000 chars into pages
  const firstPage = pages[0];
  if (pages.length === 1 && firstPage && firstPage.text.length > 3000) {
    const fullText = firstPage.text;
    const splitPages: ExtractedPage[] = [];
    const pageSize = 2000;
    let start = 0;
    let idx = 1;

    while (start < fullText.length) {
      const slice = fullText.slice(start, start + pageSize).trim();
      if (slice.length > 0) {
        splitPages.push({
          pageNumber: idx++,
          text: slice,
        });
      }
      start += pageSize;
    }

    return {
      pages: splitPages,
      totalPages: splitPages.length,
    };
  }

  return {
    pages,
    totalPages: pages.length || 1,
  };
}
