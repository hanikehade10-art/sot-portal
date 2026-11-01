/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { QuizQuestion, QuizKeyItem } from '../types';

export interface ParsedBulkQuestion {
  question: QuizQuestion;
  key: QuizKeyItem;
}

export interface ParseResult {
  items: ParsedBulkQuestion[];
  errors: string[];
}

/**
 * Parses bulk quiz question text formatted as:
 * Q: question text
 * A) option  B) option  C) option  D) option
 * Answer: B
 * Explanation: why B is correct
 * 
 * Supports options on single lines or across multiple lines,
 * 2 to 6 options (A through F), and multiple blocks separated by blank lines.
 */
export function parseBulkQuizText(rawText: string): ParseResult {
  const items: ParsedBulkQuestion[] = [];
  const errors: string[] = [];

  if (!rawText || !rawText.trim()) {
    return { items, errors: ['Please paste or type quiz questions to import.'] };
  }

  // Split raw text into question blocks separated by one or more blank lines
  const blocks = rawText
    .split(/\n\s*\n+/)
    .map(b => b.trim())
    .filter(b => b.length > 0);

  if (blocks.length === 0) {
    return { items, errors: ['No question blocks detected. Separate questions with a blank line.'] };
  }

  blocks.forEach((block, blockIndex) => {
    const blockNum = blockIndex + 1;
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

    let questionText = '';
    const optionMatches: { letter: string; text: string }[] = [];
    let answerLetter = '';
    let explanationText = '';

    // Step 1: Identify question text (first line(s) before options)
    let readingQuestion = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if line is Answer line
      const ansMatch = line.match(/^(?:Answer|Ans|Correct|Correct\s*Answer)\s*[:=\-]\s*([A-Fa-f0-9])/i);
      if (ansMatch) {
        readingQuestion = false;
        answerLetter = ansMatch[1].toUpperCase();
        continue;
      }

      // Check if line is Explanation line
      const expMatch = line.match(/^(?:Explanation|Explain|Reason)\s*[:=\-]\s*(.*)$/i);
      if (expMatch) {
        readingQuestion = false;
        explanationText = expMatch[1].trim();
        // If explanation spans subsequent lines until next question
        for (let j = i + 1; j < lines.length; j++) {
          explanationText += ' ' + lines[j].trim();
        }
        break;
      }

      // Check for options in line: handles A) text B) text ... or A. text
      // Regex looks for ([A-F])[\)\.\:]\s*(.*?)(?=(?:[A-F][\)\.\:]|$))
      const inlineOptionRegex = /([A-Fa-f])[\)\.\:]\s*([^A-Fa-f\)\.\:]+?(?=\s+[A-Fa-f][\)\.\:]|$))/g;
      const singleOptionMatch = line.match(/^([A-Fa-f])[\)\.\:]\s*(.*)$/);

      // Check if this line starts an option or contains inline options
      if (singleOptionMatch && !line.includes(') ') && !line.includes('. ')) {
        readingQuestion = false;
        optionMatches.push({
          letter: singleOptionMatch[1].toUpperCase(),
          text: singleOptionMatch[2].trim()
        });
      } else {
        // Attempt inline extraction if it contains multiple options e.g. "A) ... B) ... C) ..."
        const matches: { letter: string; text: string }[] = [];
        let m: RegExpExecArray | null;
        const re = /([A-Fa-f])[\)\.\:]\s*(.*?)(?=\s+[A-Fa-f][\)\.\:]|$)/g;
        while ((m = re.exec(line)) !== null) {
          if (m[2].trim()) {
            matches.push({ letter: m[1].toUpperCase(), text: m[2].trim() });
          }
        }

        if (matches.length > 0) {
          readingQuestion = false;
          matches.forEach(opt => optionMatches.push(opt));
        } else if (readingQuestion) {
          // Still part of the question text
          const cleanedLine = line.replace(/^(?:Q\d*|Question\s*\d*|\d+)[\:\.\)]\s*/i, '').trim();
          questionText = questionText ? `${questionText} ${cleanedLine}` : cleanedLine;
        }
      }
    }

    // Validation for this question block
    if (!questionText.trim()) {
      errors.push(`Question #${blockNum}: Missing question text.`);
      return;
    }

    if (optionMatches.length < 2) {
      errors.push(`Question #${blockNum} ("${questionText.slice(0, 30)}..."): Requires at least 2 options (found ${optionMatches.length}).`);
      return;
    }

    if (optionMatches.length > 6) {
      errors.push(`Question #${blockNum}: Has ${optionMatches.length} options (maximum allowed is 6).`);
      return;
    }

    // Deduplicate option letters while preserving order
    const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 };
    let correctIndex = -1;

    if (!answerLetter) {
      errors.push(`Question #${blockNum}: Missing 'Answer: <Option Letter>' line.`);
      return;
    }

    if (letterMap[answerLetter] !== undefined) {
      correctIndex = letterMap[answerLetter];
    } else {
      // numeric fallback: 1 -> 0, 2 -> 1
      const num = parseInt(answerLetter, 10);
      if (!isNaN(num) && num >= 1 && num <= optionMatches.length) {
        correctIndex = num - 1;
      }
    }

    if (correctIndex < 0 || correctIndex >= optionMatches.length) {
      errors.push(`Question #${blockNum}: Answer "${answerLetter}" is invalid for the provided options (A through ${String.fromCharCode(64 + optionMatches.length)}).`);
      return;
    }

    const qId = 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + '_' + blockNum;

    items.push({
      question: {
        id: qId,
        text: questionText.trim(),
        options: optionMatches.map(o => o.text.trim())
      },
      key: {
        questionId: qId,
        correctOptionIndex: correctIndex,
        explanation: explanationText.trim() || `Option ${String.fromCharCode(65 + correctIndex)} is the correct answer.`
      }
    });
  });

  return { items, errors };
}

/**
 * Exports quiz attempt results to CSV format and triggers browser download
 */
export function exportQuizResultsToCsv(
  quizTitle: string,
  courseCode: string,
  attempts: Array<{
    studentName?: string;
    matricNumber?: string;
    department?: string;
    score: number;
    total: number;
    attempts: number;
    submittedAt: string;
  }>
) {
  const headers = [
    'Student Name',
    'Matric / JAMB No',
    'Department',
    'Score',
    'Total Questions',
    'Percentage (%)',
    'Attempts Count',
    'Submitted Date (Lagos)'
  ];

  const rows = attempts.map(att => {
    const name = `"${(att.studentName || 'Student').replace(/"/g, '""')}"`;
    const matric = `"${(att.matricNumber || 'N/A').replace(/"/g, '""')}"`;
    const dept = `"${(att.department || 'N/A').replace(/"/g, '""')}"`;
    const score = att.score;
    const total = att.total || 1;
    const pct = Math.round((score / total) * 100);
    const count = att.attempts || 1;
    let dateStr = att.submittedAt || '';
    try {
      dateStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Lagos',
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(att.submittedAt));
    } catch {
      dateStr = att.submittedAt;
    }
    const formattedDate = `"${dateStr.replace(/"/g, '""')}"`;

    return [name, matric, dept, score, total, `${pct}%`, count, formattedDate].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const cleanTitle = (quizTitle || 'Quiz').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const cleanCode = (courseCode || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `${cleanCode}_${cleanTitle}_results.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
