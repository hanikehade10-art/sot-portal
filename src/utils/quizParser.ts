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

  // Split raw text by questions starting with Q: (or fallback to double blank lines if no Q: detected)
  let rawBlocks: string[] = [];
  const startsWithQRegex = /(?:^|\n)(?=[Qq](?:uestion|\d+)?\s*[:\.\-])/;
  if (startsWithQRegex.test(rawText)) {
    rawBlocks = rawText.split(startsWithQRegex).map(b => b.trim()).filter(Boolean);
  } else {
    rawBlocks = rawText.split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean);
  }

  if (rawBlocks.length === 0) {
    return { items, errors: ['No question blocks detected. Start each question with Q: or separate with blank lines.'] };
  }

  rawBlocks.forEach((block, blockIndex) => {
    const blockNum = blockIndex + 1;
    const lines = block.split('\n');

    let questionText = '';
    let questionType: 'multiple-choice' | 'true-false' = 'multiple-choice';
    const optionMatches: { letter: string; text: string }[] = [];
    let answerLetter = '';
    const explanationLines: string[] = [];
    const whyNotNotes: Record<string, string> = {};

    let currentSection: 'question' | 'options' | 'explanation' | 'whyNot' = 'question';
    let currentWhyNotTarget = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check if line is Type line
      const typeMatch = trimmed.match(/^(?:Type|Question\s*Type)\s*[:=\-]\s*(.*)$/i);
      if (typeMatch) {
        currentSection = 'options';
        const typeVal = typeMatch[1].trim().toLowerCase();
        if (typeVal.includes('true') || typeVal.includes('tf') || typeVal.includes('false')) {
          questionType = 'true-false';
        } else {
          questionType = 'multiple-choice';
        }
        continue;
      }

      // Check if line is Answer line
      const ansMatch = trimmed.match(/^(?:Answer|Ans|Correct|Correct\s*Answer)\s*[:=\-]\s*(.+)$/i);
      if (ansMatch) {
        currentSection = 'options';
        const rawAns = ansMatch[1].trim();
        if (/^(?:true|t)$/i.test(rawAns)) {
          questionType = 'true-false';
          answerLetter = 'TRUE';
        } else if (/^(?:false|f)$/i.test(rawAns)) {
          questionType = 'true-false';
          answerLetter = 'FALSE';
        } else {
          const letterMatch = rawAns.match(/^([A-Fa-f0-9])/);
          answerLetter = letterMatch ? letterMatch[1].toUpperCase() : rawAns.toUpperCase();
        }
        continue;
      }

      // Check if line is Why not line: e.g. "Why not A: ...", "Why not B: ..."
      const whyNotMatch = trimmed.match(/^(?:Why\s+not|Why\s+isn't|Why\s+not\s+option)\s+([A-Fa-f]|True|False)\s*[:=\-]\s*(.*)$/i);
      if (whyNotMatch) {
        currentSection = 'whyNot';
        currentWhyNotTarget = whyNotMatch[1].toUpperCase();
        whyNotNotes[currentWhyNotTarget] = whyNotMatch[2].trim();
        continue;
      }

      // Check if line starts the Explanation section
      const expMatch = trimmed.match(/^(?:Explanation|Explain|Reason)\s*[:=\-]\s*(.*)$/i);
      if (expMatch) {
        currentSection = 'explanation';
        if (expMatch[1].trim()) {
          explanationLines.push(expMatch[1].trim());
        }
        continue;
      }

      // If we are currently reading the Explanation
      if (currentSection === 'explanation') {
        explanationLines.push(line);
        continue;
      }

      // If we are currently reading Why not notes
      if (currentSection === 'whyNot') {
        if (currentWhyNotTarget && trimmed) {
          whyNotNotes[currentWhyNotTarget] = `${whyNotNotes[currentWhyNotTarget]}\n${trimmed}`;
        }
        continue;
      }

      // Check for standalone option line: e.g. "A) option text" or "A. option text"
      const singleOptionMatch = trimmed.match(/^([A-Fa-f])[\)\.\:]\s*(.*)$/);
      if (singleOptionMatch && !trimmed.includes(') ') && !trimmed.includes('. ')) {
        currentSection = 'options';
        optionMatches.push({
          letter: singleOptionMatch[1].toUpperCase(),
          text: singleOptionMatch[2].trim()
        });
        continue;
      }

      // Check for inline options e.g. "A) option  B) option  C) option"
      const inlineMatches: { letter: string; text: string }[] = [];
      let m: RegExpExecArray | null;
      const re = /([A-Fa-f])[\)\.\:]\s*(.*?)(?=\s+[A-Fa-f][\)\.\:]|$)/g;
      while ((m = re.exec(trimmed)) !== null) {
        if (m[2].trim()) {
          inlineMatches.push({ letter: m[1].toUpperCase(), text: m[2].trim() });
        }
      }

      if (inlineMatches.length > 0) {
        currentSection = 'options';
        inlineMatches.forEach(opt => optionMatches.push(opt));
        continue;
      }

      // Otherwise, we are reading the question prompt text
      if (currentSection === 'question') {
        const cleanedLine = trimmed.replace(/^(?:Q\d*|Question\s*\d*|\d+)[\:\.\)]\s*/i, '').trim();
        if (cleanedLine) {
          questionText = questionText ? `${questionText}\n${cleanedLine}` : cleanedLine;
        }
      }
    }

    const fullExplanation = explanationLines.join('\n').trim();

    // Validation for question text
    if (!questionText.trim()) {
      errors.push(`Question #${blockNum}: Missing question text.`);
      return;
    }

    const qId = 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + '_' + blockNum;

    // Handle True/False questions
    if (questionType === 'true-false') {
      let correctIndex = -1;
      if (answerLetter === 'TRUE' || answerLetter === 'A' || answerLetter === '1') {
        correctIndex = 0; // True
      } else if (answerLetter === 'FALSE' || answerLetter === 'B' || answerLetter === '2') {
        correctIndex = 1; // False
      }

      if (correctIndex === -1) {
        errors.push(`Question #${blockNum} ("${questionText.slice(0, 30)}..."): Answer must be "True" or "False".`);
        return;
      }

      items.push({
        question: {
          id: qId,
          text: questionText.trim(),
          type: 'true-false',
          options: ['True', 'False']
        },
        key: {
          questionId: qId,
          correctOptionIndex: correctIndex,
          explanation: fullExplanation || `The statement is ${correctIndex === 0 ? 'True' : 'False'}.`,
          whyNotNotes: Object.keys(whyNotNotes).length > 0 ? whyNotNotes : undefined
        }
      });
      return;
    }

    // Validation for Multiple Choice
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

    items.push({
      question: {
        id: qId,
        text: questionText.trim(),
        type: 'multiple-choice',
        options: optionMatches.map(o => o.text.trim())
      },
      key: {
        questionId: qId,
        correctOptionIndex: correctIndex,
        explanation: fullExplanation || `Option ${String.fromCharCode(65 + correctIndex)} is the correct answer.`,
        whyNotNotes: Object.keys(whyNotNotes).length > 0 ? whyNotNotes : undefined
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
