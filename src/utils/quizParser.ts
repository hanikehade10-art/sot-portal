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
    let questionType: 'multiple-choice' | 'true-false' | 'theory-best' | 'theory-select-all' | 'theory-self-check' | 'fill-gaps' = 'multiple-choice';
    const parsedOptions: { text: string; isCorrect: boolean; letter?: string }[] = [];
    let answerLetter = '';
    const modelAnswerLines: string[] = [];
    const explanationLines: string[] = [];
    const whyNotNotes: Record<string, string> = {};

    // Fill in the gaps (tap to pick) data structures
    const gapsMap: Record<number, { options: string[]; correctOption: string }> = {};
    let sharedWordBank = false;
    const wordBankWords: string[] = [];
    const sharedAnswersMap: Record<number, string> = {};
    let pointsPerGap = 1;

    let currentSection: 'question' | 'options' | 'modelAnswer' | 'explanation' | 'whyNot' | 'gaps' | 'bank' | 'answers' = 'question';
    let currentWhyNotTarget = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed && currentSection !== 'explanation' && currentSection !== 'modelAnswer' && currentSection !== 'bank') {
        continue;
      }

      // Check if line is Type line
      const typeMatch = trimmed.match(/^(?:Type|Question\s*Type)\s*[:=\-]\s*(.*)$/i);
      if (typeMatch) {
        const typeVal = typeMatch[1].trim().toLowerCase();
        if (typeVal.includes('bank') || typeVal.includes('gap') || typeVal.includes('fill')) {
          questionType = 'fill-gaps';
          sharedWordBank = true;
          currentSection = 'gaps';
        } else if (typeVal.includes('select') || typeVal.includes('all that apply')) {
          questionType = 'theory-select-all';
          currentSection = 'options';
        } else if (typeVal.includes('self') || typeVal.includes('check')) {
          questionType = 'theory-self-check';
          currentSection = 'options';
        } else if (typeVal.includes('theory') || typeVal.includes('best')) {
          questionType = 'theory-best';
          currentSection = 'options';
        } else if (typeVal.includes('true') || typeVal.includes('tf') || typeVal.includes('false')) {
          questionType = 'true-false';
          currentSection = 'options';
        } else {
          questionType = 'multiple-choice';
          currentSection = 'options';
        }
        continue;
      }

      // Check for Points per gap or Points line
      const pointsMatch = trimmed.match(/^(?:Points(?:\s*per\s*gap)?|Pts)\s*[:=\-]\s*(\d+)$/i);
      if (pointsMatch) {
        const parsedPts = parseInt(pointsMatch[1], 10);
        if (!isNaN(parsedPts) && parsedPts >= 1) {
          pointsPerGap = parsedPts;
        }
        continue;
      }

      // Check for Answers line in Word Bank mode: e.g. Answers: 1. modem | 2. internet | 3. purposes...
      const answersMatch = trimmed.match(/^(?:Answers|Answer|Keys|Key)\s*[:=\-]\s*(.*)$/i);
      const isBankAnswersLine = answersMatch && (
        questionType === 'fill-gaps' ||
        sharedWordBank ||
        answersMatch[1].includes('|') ||
        answersMatch[1].includes(';') ||
        answersMatch[1].includes('=') ||
        /\b\d+\s*[\.\=\:\-]\s*\S+/.test(answersMatch[1])
      );

      const parseBankAnswersSegment = (textToParse: string) => {
        const segments = textToParse.split(/[|;]/).map(p => p.trim()).filter(Boolean);
        segments.forEach(seg => {
          const m = seg.match(/^(?:(?:Gap|Blank)\s*)?(\d+)\s*[\.\=\:\-]\s*(.+)$/i);
          if (m) {
            const gNum = parseInt(m[1], 10);
            const word = m[2].trim().replace(/\.$/, '');
            if (word) {
              sharedAnswersMap[gNum] = word;
            }
          } else {
            const pairRegex = /(?:(?:Gap|Blank)\s*)?(\d+)\s*[\.\=\:\-]\s*([^0-9\n|;]+)/gi;
            let pm: RegExpExecArray | null;
            let matchFound = false;
            while ((pm = pairRegex.exec(seg)) !== null) {
              const gNum = parseInt(pm[1], 10);
              const word = pm[2].trim().replace(/\.$/, '');
              if (word) {
                sharedAnswersMap[gNum] = word;
                matchFound = true;
              }
            }
            if (!matchFound) {
              const existingKeys = Object.keys(sharedAnswersMap).map(Number);
              const nextNum = existingKeys.length > 0 ? Math.max(...existingKeys) + 1 : 1;
              const word = seg.trim().replace(/\.$/, '');
              if (word) {
                sharedAnswersMap[nextNum] = word;
              }
            }
          }
        });
      };

      if (isBankAnswersLine) {
        questionType = 'fill-gaps';
        sharedWordBank = true;
        currentSection = 'answers';
        if (answersMatch[1].trim()) {
          parseBankAnswersSegment(answersMatch[1].trim());
        }
        continue;
      }

      // If we are currently reading continuation lines of Answers:
      if (currentSection === 'answers') {
        if (/^(?:Explanation|Explain|Reason|Why\s+not|Type|Question\s*Type|Q\d*)\s*[:=\-]/i.test(trimmed)) {
          // Fall through to other section handlers
        } else {
          parseBankAnswersSegment(trimmed);
          continue;
        }
      }

      // Check for legacy Gap X: *option | option2 | option3
      const gapMatch = trimmed.match(/^(?:Gap|Blank|Gap\s*#)\s*(\d+)\s*[:=\-]\s*(.+)$/i);
      if (gapMatch) {
        questionType = 'fill-gaps';
        currentSection = 'gaps';
        const gapNum = parseInt(gapMatch[1], 10);
        const rawOpts = gapMatch[2].split('|').map(o => o.trim()).filter(Boolean);
        let correctOpt = '';
        const cleanOpts: string[] = [];
        rawOpts.forEach(opt => {
          if (opt.startsWith('*') || opt.endsWith('*')) {
            const stripped = opt.replace(/^\*+|\*+$/g, '').trim();
            correctOpt = stripped;
            cleanOpts.push(stripped);
          } else {
            cleanOpts.push(opt);
          }
        });
        gapsMap[gapNum] = { options: cleanOpts, correctOption: correctOpt };
        continue;
      }

      // Check for legacy Bank: word1, word2, word3
      const bankMatch = trimmed.match(/^(?:Bank|Word\s*Bank|Shared\s*Bank|Shared\s*Word\s*Bank)\s*[:=\-]\s*(.*)$/i);
      if (bankMatch) {
        questionType = 'fill-gaps';
        sharedWordBank = true;
        currentSection = 'bank';
        if (bankMatch[1].trim()) {
          const words = bankMatch[1].split(/[|,;]/).map(w => w.trim()).filter(Boolean);
          wordBankWords.push(...words);
        }
        continue;
      }

      // If in legacy bank section and reading more words
      if (currentSection === 'bank') {
        if (/^(?:Answers|Answer|Explanation|Explain|Reason|Q\d*)\s*[:=\-]/i.test(trimmed)) {
          // Fall through
        } else {
          const words = trimmed.split(/[|,;]/).map(w => w.trim()).filter(Boolean);
          wordBankWords.push(...words);
          continue;
        }
      }

      // Check if line is Model Answer line (for self-check)
      const modelMatch = trimmed.match(/^(?:Model\s*answer|ModelAnswer|Ideal\s*answer)\s*[:=\-]\s*(.*)$/i);
      if (modelMatch) {
        currentSection = 'modelAnswer';
        if (questionType === 'multiple-choice') {
          questionType = 'theory-self-check';
        }
        if (modelMatch[1].trim()) {
          modelAnswerLines.push(modelMatch[1].trim());
        }
        continue;
      }

      // Check if line is standard Answer line (for MC or TF)
      const ansMatch = trimmed.match(/^(?:Answer|Ans|Correct|Correct\s*Answer)\s*[:=\-]\s*(.+)$/i);
      if (ansMatch) {
        const rawAns = ansMatch[1].trim();
        if (/^(?:true|t)$/i.test(rawAns)) {
          questionType = 'true-false';
          answerLetter = 'TRUE';
        } else if (/^(?:false|f)$/i.test(rawAns)) {
          questionType = 'true-false';
          answerLetter = 'FALSE';
        } else {
          answerLetter = rawAns.toUpperCase();
        }
        currentSection = 'options';
        continue;
      }

      // Check if line is Why not line: e.g. "Why not A: ...", "Why not B: ...", "Why not:"
      const whyNotMatch = trimmed.match(/^(?:Why\s+not|Why\s+isn't|Why\s+not\s+option)(?:\s+([A-Za-z0-9_]+|True|False))?\s*[:=\-]\s*(.*)$/i);
      if (whyNotMatch) {
        currentSection = 'whyNot';
        currentWhyNotTarget = (whyNotMatch[1] || 'General').toUpperCase();
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

      // If we are reading Model Answer
      if (currentSection === 'modelAnswer') {
        modelAnswerLines.push(line);
        continue;
      }

      // If we are currently reading Why not notes
      if (currentSection === 'whyNot') {
        if (currentWhyNotTarget && trimmed) {
          whyNotNotes[currentWhyNotTarget] = `${whyNotNotes[currentWhyNotTarget]}\n${trimmed}`;
        }
        continue;
      }

      // Check for bullet options:
      // * Option (marked correct)
      // - Option (marked wrong)
      const bulletMatch = trimmed.match(/^([\*\-])\s+(.+)$/);
      if (bulletMatch) {
        currentSection = 'options';
        const isCorrect = bulletMatch[1] === '*';
        parsedOptions.push({
          text: bulletMatch[2].trim(),
          isCorrect
        });
        continue;
      }

      // Check for standalone option line: e.g. "A) option text", "*A) option text", or "A) *option text"
      const hasMultipleOptionsOnLine = /(?:^|\s+)[A-Fa-f][\)\.\:]\s+.+\s+[A-Fa-f][\)\.\:]\s+/.test(trimmed);
      const singleOptionMatch = !hasMultipleOptionsOnLine ? trimmed.match(/^(\*)?\s*([A-Fa-f])[\)\.\:]\s+(\*)?\s*(.*)$/) : null;
      if (singleOptionMatch) {
        currentSection = 'options';
        const isStar = Boolean(singleOptionMatch[1] || singleOptionMatch[3] || singleOptionMatch[4].startsWith('*'));
        const cleanOptText = singleOptionMatch[4].replace(/^\*\s*/, '').trim();
        parsedOptions.push({
          letter: singleOptionMatch[2].toUpperCase(),
          text: cleanOptText,
          isCorrect: isStar
        });
        continue;
      }

      // Check for inline options e.g. "A) option  B) option  *C) option"
      if (hasMultipleOptionsOnLine) {
        const inlineMatches: { letter: string; text: string; isCorrect: boolean }[] = [];
        let m: RegExpExecArray | null;
        const re = /(?:^|\s+)(\*)?\s*([A-Fa-f])[\)\.\:]\s+(.*?)(?=\s+(?:\*)?\s*[A-Fa-f][\)\.\:]\s+|$)/g;
        while ((m = re.exec(trimmed)) !== null) {
          const optBody = (m[3] || '').trim();
          if (optBody) {
            const isStar = Boolean(m[1] || optBody.startsWith('*'));
            const cleanText = optBody.replace(/^\*\s*/, '').trim();
            inlineMatches.push({ letter: m[2].toUpperCase(), text: cleanText, isCorrect: isStar });
          }
        }

        if (inlineMatches.length >= 2) {
          currentSection = 'options';
          inlineMatches.forEach(opt => parsedOptions.push(opt));
          continue;
        }
      }

      // If in options section and not recognized as a new header, append to last option (for multiline options)
      if (currentSection === 'options' && parsedOptions.length > 0) {
        parsedOptions[parsedOptions.length - 1].text += `\n${trimmed}`;
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
    const fullModelAnswer = modelAnswerLines.join('\n').trim();

    // Validation for question text
    if (!questionText.trim()) {
      errors.push(`Question #${blockNum}: Missing question text.`);
      return;
    }

    const qId = 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + '_' + blockNum;

    // 0. Handle Fill in the Gaps (Tap to pick) questions
    if (questionType === 'fill-gaps') {
      // Find all gaps mentioned in question text [1], [2], etc.
      const detectedGaps: number[] = [];
      const gapTokenRegex = /(?:\[(\d+)\]|\((\d+)\))/g;
      let mToken: RegExpExecArray | null;
      while ((mToken = gapTokenRegex.exec(questionText)) !== null) {
        const num = parseInt(mToken[1] || mToken[2], 10);
        if (!isNaN(num) && !detectedGaps.includes(num)) {
          detectedGaps.push(num);
        }
      }
      detectedGaps.sort((a, b) => a - b);

      const allGapNumbers = Array.from(new Set([
        ...detectedGaps,
        ...Object.keys(sharedAnswersMap).map(Number)
      ])).sort((a, b) => a - b);

      if (allGapNumbers.length === 0) {
        errors.push(`Question #${blockNum} ("${questionText.slice(0, 30)}..."): Fill in the gaps requires numbered gaps in the passage, e.g. [1], [2], [3].`);
        return;
      }

      if (allGapNumbers.length > 40) {
        errors.push(`Question #${blockNum}: Has ${allGapNumbers.length} gaps (maximum supported is 40 gaps per question).`);
        return;
      }

      const gapAnswersMap: Record<string, string> = {};
      const allAnswersInGapOrder: string[] = [];

      for (const gNum of allGapNumbers) {
        const ans = sharedAnswersMap[gNum];
        if (!ans || !ans.trim()) {
          errors.push(`Question #${blockNum}: Gap [${gNum}] answer is missing under 'Answers: ...'.`);
          return;
        }
        const cleanAns = ans.trim();
        gapAnswersMap[String(gNum)] = cleanAns;
        allAnswersInGapOrder.push(cleanAns);
      }

      if (allAnswersInGapOrder.length === 0) {
        errors.push(`Question #${blockNum}: No answers found for gaps under 'Answers: ...'.`);
        return;
      }

      // Normalize passage so any (1), (2) gap notation becomes [1], [2]
      const normalizedPassage = questionText.replace(/\((\d+)\)/g, '[$1]').trim();

      items.push({
        question: {
          id: qId,
          text: normalizedPassage,
          type: 'fill-gaps',
          options: [],
          sharedWordBank: true,
          wordBank: allAnswersInGapOrder, // ALL answers in gap order (e.g. 20 answers)
          pointsPerGap: 1 // Scoring: each gap is worth 1 point
        },
        key: {
          questionId: qId,
          explanation: fullExplanation.trim(),
          gapAnswers: gapAnswersMap,
          pointsPerGap: 1,
          whyNotNotes: Object.keys(whyNotNotes).length > 0 ? whyNotNotes : undefined
        }
      });
      return;
    }

    // 1. Handle Self-Check Theory questions
    if (questionType === 'theory-self-check') {
      items.push({
        question: {
          id: qId,
          text: questionText.trim(),
          type: 'theory-self-check',
          options: [],
          modelAnswer: fullModelAnswer || ''
        },
        key: {
          questionId: qId,
          modelAnswer: fullModelAnswer || '',
          explanation: fullExplanation || fullModelAnswer || '',
          whyNotNotes: Object.keys(whyNotNotes).length > 0 ? whyNotNotes : undefined
        }
      });
      return;
    }

    // 2. Handle True/False questions
    if (questionType === 'true-false') {
      let correctIndex = -1;
      if (answerLetter === 'TRUE' || answerLetter === 'A' || answerLetter === '1') {
        correctIndex = 0; // True
      } else if (answerLetter === 'FALSE' || answerLetter === 'B' || answerLetter === '2') {
        correctIndex = 1; // False
      } else {
        // Check if bullets were used: * True, - False
        const tIndex = parsedOptions.findIndex(o => /^(?:true|t)$/i.test(o.text) && o.isCorrect);
        const fIndex = parsedOptions.findIndex(o => /^(?:false|f)$/i.test(o.text) && o.isCorrect);
        if (tIndex >= 0) correctIndex = 0;
        else if (fIndex >= 0) correctIndex = 1;
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
          explanation: fullExplanation.trim() || '',
          whyNotNotes: Object.keys(whyNotNotes).length > 0 ? whyNotNotes : undefined
        }
      });
      return;
    }

    // 3. Handle Select All that Apply questions
    if (questionType === 'theory-select-all') {
      if (parsedOptions.length < 2) {
        errors.push(`Question #${blockNum} ("${questionText.slice(0, 30)}..."): Select-all requires at least 2 options.`);
        return;
      }

      const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7 };
      const correctIndices: number[] = [];

      // Find all options marked with *
      parsedOptions.forEach((opt, idx) => {
        if (opt.isCorrect) {
          correctIndices.push(idx);
        }
      });

      // Fallback: check answerLetter e.g. "A, C" or "A and C"
      if (correctIndices.length === 0 && answerLetter) {
        const matches = answerLetter.match(/[A-H]/g);
        if (matches) {
          matches.forEach(ch => {
            const idx = letterMap[ch];
            if (idx !== undefined && idx < parsedOptions.length && !correctIndices.includes(idx)) {
              correctIndices.push(idx);
            }
          });
        }
      }

      if (correctIndices.length === 0) {
        errors.push(`Question #${blockNum} ("${questionText.slice(0, 30)}..."): Mark at least one correct option with * (e.g. * Correct statement).`);
        return;
      }

      items.push({
        question: {
          id: qId,
          text: questionText.trim(),
          type: 'theory-select-all',
          options: parsedOptions.map(o => o.text.trim())
        },
        key: {
          questionId: qId,
          correctOptionIndices: correctIndices,
          explanation: fullExplanation.trim() || '',
          whyNotNotes: Object.keys(whyNotNotes).length > 0 ? whyNotNotes : undefined
        }
      });
      return;
    }

    // 4. Handle Theory (pick the best answer) and standard Multiple Choice
    if (parsedOptions.length < 2) {
      errors.push(`Question #${blockNum} ("${questionText.slice(0, 30)}..."): Requires at least 2 options (found ${parsedOptions.length}).`);
      return;
    }

    if (parsedOptions.length > 8) {
      errors.push(`Question #${blockNum}: Has ${parsedOptions.length} options (maximum allowed is 8).`);
      return;
    }

    const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7 };
    let correctIndex = -1;

    // Check if one was marked with *
    const starIdx = parsedOptions.findIndex(o => o.isCorrect);
    if (starIdx !== -1) {
      correctIndex = starIdx;
    } else if (answerLetter) {
      if (letterMap[answerLetter] !== undefined) {
        correctIndex = letterMap[answerLetter];
      } else {
        const num = parseInt(answerLetter, 10);
        if (!isNaN(num) && num >= 1 && num <= parsedOptions.length) {
          correctIndex = num - 1;
        }
      }
    }

    if (correctIndex < 0 || correctIndex >= parsedOptions.length) {
      errors.push(`Question #${blockNum} ("${questionText.slice(0, 30)}..."): Mark the correct option with * or provide 'Answer: <letter>'.`);
      return;
    }

    items.push({
      question: {
        id: qId,
        text: questionText.trim(),
        type: questionType === 'theory-best' ? 'theory-best' : 'multiple-choice',
        options: parsedOptions.map(o => o.text.trim())
      },
      key: {
        questionId: qId,
        correctOptionIndex: correctIndex,
        explanation: fullExplanation.trim() || '',
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
