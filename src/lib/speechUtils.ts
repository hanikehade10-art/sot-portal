/**
 * Speech, text normalization, markdown/table reading, phonetic/fuzzy matching,
 * and natural-language number utilities for WCAG Accessibility & Voice Assistant.
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
  thirteenth: 13,
  fourteen: 14,
  fourteenth: 14,
  fifteen: 15,
  fifteenth: 15,
  sixteen: 16,
  sixteenth: 16,
  seventeen: 17,
  seventeenth: 17,
  eighteen: 18,
  eighteenth: 18,
  nineteen: 19,
  nineteenth: 19,
  twenty: 20,
  twentieth: 20,
  thirty: 30,
  thirtieth: 30,
  forty: 40,
  fortieth: 40,
  fifty: 50,
  fiftieth: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90
};

/**
 * Converts spoken number words and digit sequences into digits inside text:
 * - "topic five" -> "topic 5"
 * - "one two four" -> "124"
 * - "one twenty four" -> "124"
 * - "two oh one" -> "201"
 * - "one hundred and twenty four" -> "124"
 */
export function convertNumberWordsToDigits(input: string): string {
  if (!input) return '';
  const tokens = input.toLowerCase().trim().split(/\s+/);
  const out: string[] = [];

  const isDigitWord = (t: string) => NUMBER_WORDS[t] !== undefined && NUMBER_WORDS[t] <= 9;
  const isTensWord = (t: string) => {
    const v = NUMBER_WORDS[t];
    return v !== undefined && v >= 20 && v <= 90 && v % 10 === 0;
  };
  const isTeenOrTens = (t: string) => {
    const v = NUMBER_WORDS[t];
    return v !== undefined && v >= 10 && v <= 99;
  };

  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];

    // Preserve idiomatic "next one" / "previous one" / "last one" / "this one"
    if (
      t === 'one' &&
      i > 0 &&
      ['next', 'previous', 'prev', 'last', 'this', 'that', 'which', 'another'].includes(tokens[i - 1])
    ) {
      out.push(t);
      i++;
      continue;
    }

    // Handle "oh" as 0 only when sandwiched or paired with other number words/digits
    if (t === 'oh' && (
      (i > 0 && (isDigitWord(tokens[i - 1]) || /^\d+$/.test(tokens[i - 1]))) ||
      (i + 1 < tokens.length && (isDigitWord(tokens[i + 1]) || /^\d+$/.test(tokens[i + 1])))
    )) {
      // Let sequence collector handle below
    } else if (NUMBER_WORDS[t] === undefined) {
      out.push(t);
      i++;
      continue;
    }

    // Collect a contiguous run of number words (plus optional "oh" / "and" before tens/units)
    const run: string[] = [];
    while (i < tokens.length) {
      const cur = tokens[i];
      if (NUMBER_WORDS[cur] !== undefined || cur === 'hundred') {
        run.push(cur);
        i++;
      } else if (
        cur === 'oh' &&
        run.length > 0 &&
        i + 1 < tokens.length &&
        (NUMBER_WORDS[tokens[i + 1]] !== undefined || /^\d+$/.test(tokens[i + 1]))
      ) {
        run.push('zero');
        i++;
      } else if (
        cur === 'and' &&
        run.includes('hundred') &&
        i + 1 < tokens.length &&
        NUMBER_WORDS[tokens[i + 1]] !== undefined
      ) {
        i++;
      } else {
        break;
      }
    }

    if (run.length === 0) {
      continue;
    }

    // Case A: Contains "hundred" -> compute mathematical hundred value (e.g. "one hundred twenty four" -> 124)
    if (run.includes('hundred')) {
      let total = 0;
      let current = 0;
      for (const word of run) {
        if (word === 'hundred') {
          current = (current || 1) * 100;
        } else {
          current += NUMBER_WORDS[word] ?? 0;
        }
      }
      total += current;
      out.push(String(total));
      continue;
    }

    // Case B: Convert run tokens into digit groups and concatenate when appropriate:
    // - "one twenty four" -> "1" + "24" -> "124"
    // - "one two four" -> "1" + "2" + "4" -> "124"
    // - "twenty four" -> "24"
    const parts: string[] = [];
    let j = 0;
    while (j < run.length) {
      const w = run[j];
      if (isTensWord(w) && j + 1 < run.length && isDigitWord(run[j + 1]) && NUMBER_WORDS[run[j + 1]] > 0) {
        parts.push(String(NUMBER_WORDS[w] + NUMBER_WORDS[run[j + 1]]));
        j += 2;
      } else if (isTeenOrTens(w) || isDigitWord(w)) {
        parts.push(String(NUMBER_WORDS[w]));
        j++;
      } else {
        j++;
      }
    }
    out.push(parts.join(''));
  }

  return out.join(' ').trim();
}

/**
 * Parses spoken digits or English number words ("five", "topic 12", "twenty three") into an integer.
 */
export function parseSpokenNumber(input: string): number | null {
  if (!input) return null;
  const converted = convertNumberWordsToDigits(input);
  const digitMatch = converted.match(/\b(\d+)\b/);
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
      if (val >= 20 && val <= 90 && val % 10 === 0 && i + 1 < tokens.length) {
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
 * Computes Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  const dp: number[] = Array.from({ length: len2 + 1 }, (_, j) => j);
  for (let i = 1; i <= len1; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= len2; j++) {
      const temp = dp[j];
      if (s1[i - 1] === s2[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }
  return dp[len2];
}

/**
 * Returns similarity ratio between 0 and 1 using Levenshtein edit distance.
 */
export function stringSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  const maxLen = Math.max(s1.length, s2.length);
  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, 1 - dist / maxLen);
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
  const matches = normalized.match(/[^.!?]+(?:[.!?]+["')\]]*)?(?=\s+|$)/g);
  if (!matches) return [normalized];
  return matches.map((s) => s.trim()).filter(Boolean);
}

/**
 * Normalizes a course code for fuzzy comparison (e.g. "COM 124" == "com124", "COM one twenty four" == "COM124").
 */
export function normalizeCourseCodeQuery(raw: string): string {
  const digits = convertNumberWordsToDigits(raw || '');
  return digits.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
