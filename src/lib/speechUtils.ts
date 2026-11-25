/**
 * Speech, text normalization, markdown/table reading, and natural-language number utilities
 * for WCAG Accessibility & Voice Assistant.
 */

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  first: 1,
  two: 2,
  second: 2,
  three: 3,
  third: 3,
  four: 4,
  fourth: 4,
  five: 5,
  fifth: 5,
  six: 6,
  sixth: 6,
  seven: 7,
  seventh: 7,
  eight: 8,
  eighth: 8,
  nine: 9,
  ninth: 9,
  ten: 10,
  tenth: 10,
  eleven: 11,
  eleventh: 11,
  twelve: 12,
  twelfth: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50
};

/**
 * Parses spoken digits or English number words ("five", "topic 12", "twenty three") into an integer.
 */
export function parseSpokenNumber(input: string): number | null {
  if (!input) return null;
  const digitMatch = input.match(/\b(\d+)\b/);
  if (digitMatch) {
    const n = parseInt(digitMatch[1], 10);
    if (!Number.isNaN(n)) return n;
  }

  const tokens = input
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (NUMBER_WORDS[t] !== undefined) {
      const val = NUMBER_WORDS[t];
      if ((val === 20 || val === 30 || val === 40 || val === 50) && i + 1 < tokens.length) {
        const nextVal = NUMBER_WORDS[tokens[i + 1]];
        if (nextVal !== undefined && nextVal > 0 && nextVal < 10) {
          return val + nextVal;
        }
      }
      return val;
    }
  }
  return null;
}

/**
 * Formats table headers and rows into clean, spoken row-by-row sentences.
 */
export function formatTableForSpeech(headers: string[], rows: string[][]): string {
  const cleanHeaders = headers.map((h) => h.replace(/\*\*|__|`/g, '').trim());
  const parts: string[] = [];
  if (cleanHeaders.length > 0) {
    parts.push(`Table with columns: ${cleanHeaders.join(', ')}.`);
  }
  rows.forEach((row, rIdx) => {
    const cells = row.map((cell, cIdx) => {
      const cleanCell = (cell || '').replace(/\*\*|__|`/g, '').trim();
      const header = cleanHeaders[cIdx];
      return header ? `${header} is ${cleanCell || 'empty'}` : cleanCell;
    });
    parts.push(`Row ${rIdx + 1}: ${cells.join('; ')}.`);
  });
  return parts.join(' ');
}

/**
 * Converts markdown notes (including headings, lists, callouts, and markdown tables)
 * into clean plain-text blocks suitable for screen-reader & TTS playback.
 */
export function markdownToSpeechBlocks(markdown: string): string[] {
  if (!markdown || !markdown.trim()) return [];
  const rawLines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const trimmed = rawLines[i].trim();
    if (!trimmed) {
      i++;
      continue;
    }

    // Detect markdown table block
    if (trimmed.includes('|') && trimmed.split('|').filter((p) => p.trim()).length >= 2) {
      const tableLines: string[] = [];
      let j = i;
      while (j < rawLines.length && rawLines[j].trim().includes('|')) {
        tableLines.push(rawLines[j].trim());
        j++;
      }
      if (tableLines.length >= 2 && /^\|?[\s:-]+(\|[\s:-]+)+\|?$/.test(tableLines[1])) {
        const splitRow = (line: string) => {
          const cells = line.split('|').map((c) => c.trim());
          if (line.startsWith('|')) cells.shift();
          if (line.endsWith('|')) cells.pop();
          return cells;
        };
        const headers = splitRow(tableLines[0]);
        const rows = tableLines.slice(2).map(splitRow);
        blocks.push(formatTableForSpeech(headers, rows));
        i = j;
        continue;
      }
    }

    // Strip markdown decoration
    const cleaned = trimmed
      .replace(/^#{1,6}\s+/, '')
      .replace(/^>\s*/, '')
      .replace(/^[•\-*]\s+/, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();

    if (cleaned) {
      blocks.push(cleaned);
    }
    i++;
  }

  return blocks;
}

/**
 * Cleans arbitrary markdown string into a single smooth spoken string.
 */
export function cleanMarkdownForSpeech(text: string): string {
  return markdownToSpeechBlocks(text).join(' ');
}

/**
 * Splits a paragraph into individual sentences for sentence-by-sentence TTS highlighting.
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || !text.trim()) return [];
  const normalized = text.replace(/\s+/g, ' ').trim();
  // Split at sentence punctuation followed by whitespace + sentence start, preserving punctuation
  const matches = normalized.match(/[^.!?]+(?:[.!?]+["')\]]*)?(?=\s+|$)/g);
  if (!matches) return [normalized];
  return matches.map((s) => s.trim()).filter(Boolean);
}

/**
 * Normalizes a course code for fuzzy comparison (e.g. "COM 124" == "com124").
 */
export function normalizeCourseCodeQuery(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
