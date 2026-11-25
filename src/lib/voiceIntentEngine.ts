import {
  convertNumberWordsToDigits,
  levenshteinDistance,
  normalizeCourseCodeQuery,
  parseSpokenNumber,
  stringSimilarity
} from './speechUtils';

export type VoicePageContext =
  | 'quiz-active'
  | 'quiz-list'
  | 'lesson'
  | 'course-detail'
  | 'courses-list'
  | 'past-questions'
  | 'timetable'
  | 'announcements'
  | 'dashboard'
  | 'landing'
  | 'other';

export interface VoiceCourseRef {
  id: string;
  code: string;
  title: string;
}

export interface VoiceTopicRef {
  id: string;
  title: string;
  order: number;
}

export type VoiceCommandId =
  | 'help'
  | 'describePage'
  | 'stopSpeech'
  | 'pauseSpeech'
  | 'resumeSpeech'
  | 'repeatSpeech'
  | 'fasterSpeech'
  | 'slowerSpeech'
  | 'nextParagraph'
  | 'previousParagraph'
  | 'readSummary'
  | 'readNotes'
  | 'readPage'
  | 'readFromHere'
  | 'startQuiz'
  | 'readQuestion'
  | 'repeatOptions'
  | 'selectOption'
  | 'selectTrueFalse'
  | 'selectWordBankWord'
  | 'nextQuestion'
  | 'previousQuestion'
  | 'howMuchTimeIsLeft'
  | 'submitQuiz'
  | 'markTopicComplete'
  | 'bookmarkThis'
  | 'listTopics'
  | 'nextTopic'
  | 'previousTopic'
  | 'goToTopic'
  | 'openCourse'
  | 'goHome'
  | 'openCourses'
  | 'openPastQuestions'
  | 'openTimetable'
  | 'openAnnouncements'
  | 'openQuizzes'
  | 'goBack'
  | 'logout';

export interface AllowedVoiceCommandSpec {
  id: VoiceCommandId;
  label: string;
  acceptsArgument?: boolean;
  requiresConfirmation?: boolean;
}

export interface VoiceIntentCandidate {
  commandId: VoiceCommandId;
  label: string;
  score: number;
  argument?: string;
  requiresConfirmation?: boolean;
}

export interface NormalizedVoiceInput {
  raw: string;
  lowercaseClean: string;
  strippedFillers: string;
  withDigits: string;
  compact: string;
  tokens: string[];
}

export type VoiceResolutionResult =
  | {
      status: 'matched';
      candidate: VoiceIntentCandidate;
      normalized: NormalizedVoiceInput;
    }
  | {
      status: 'confirm-single';
      candidate: VoiceIntentCandidate;
      normalized: NormalizedVoiceInput;
    }
  | {
      status: 'disambiguate-two';
      candidates: [VoiceIntentCandidate, VoiceIntentCandidate];
      normalized: NormalizedVoiceInput;
    }
  | {
      status: 'unmatched';
      normalized: NormalizedVoiceInput;
    };

const FILLER_PHRASES: RegExp[] = [
  /\b(?:could|would|can)\s+you\s+(?:please|kindly)?\b/g,
  /\b(?:can|may|could)\s+i\s+(?:please)?\b/g,
  /\bi\s+(?:would\s+like|need|want|wan|wanna)\s+(?:to\s+)?\b/g,
  /\bmake\s+you\s+(?:please\s+)?\b/g,
  /\bcarry\s+me\s+(?:go\s+|to\s+)?\b/g,
  /\btake\s+me\s+(?:to\s+|go\s+)?\b/g,
  /\bbring\s+me\s+(?:to\s+)?\b/g,
  /\blet\s+me\s+(?:please\s+)?\b/g,
  /\bhelp\s+me\s+(?:to\s+)?\b/g,
  /\bshow\s+me\b/g,
  /\bplease\b/g,
  /\babeg\b/g,
  /\bi\s+beg\b/g,
  /\bbiko\b/g,
  /\bkindly\b/g,
  /\boya\b/g,
  /\bjust\b/g,
  /\bnow\b/g
];

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'my',
  'to',
  'for',
  'of',
  'in',
  'on',
  'at',
  'am',
  'me',
  'it',
  'us',
  'please'
]);

/**
 * Normalizes spoken text:
 * - lowercases & removes punctuation
 * - removes polite / Nigerian Pidgin filler phrases
 * - converts number words & spoken digits to numbers
 * - drops minor stop words into compact tokens
 */
export function normalizeSpokenCommand(raw: string): NormalizedVoiceInput {
  const lowercaseClean = (raw || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let stripped = lowercaseClean;
  for (const re of FILLER_PHRASES) {
    stripped = stripped.replace(re, ' ');
  }
  stripped = stripped.replace(/\s+/g, ' ').trim();

  const withDigits = convertNumberWordsToDigits(stripped || lowercaseClean);
  const tokens = withDigits
    .split(/\s+/)
    .filter((t) => Boolean(t) && !STOP_WORDS.has(t));

  return {
    raw: raw.trim(),
    lowercaseClean,
    strippedFillers: stripped || lowercaseClean,
    withDigits,
    compact: tokens.join(' ').trim(),
    tokens
  };
}

/**
 * Fuzzy token similarity between a query and target phrase.
 */
function tokenPhraseSimilarity(queryTokens: string[], targetText: string): number {
  const targetTokens = targetText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));

  if (queryTokens.length === 0 || targetTokens.length === 0) return 0;

  let matchedWeight = 0;
  for (const qt of queryTokens) {
    let bestTokenSim = 0;
    for (const tt of targetTokens) {
      if (qt === tt) {
        bestTokenSim = 1;
        break;
      }
      if (tt.startsWith(qt) || qt.startsWith(tt)) {
        bestTokenSim = Math.max(bestTokenSim, 0.88);
      } else {
        const sim = stringSimilarity(qt, tt);
        if (sim >= 0.72) {
          bestTokenSim = Math.max(bestTokenSim, sim * 0.92);
        }
      }
    }
    matchedWeight += bestTokenSim;
  }

  const queryCoverage = matchedWeight / queryTokens.length;
  const targetCoverage = matchedWeight / Math.max(1, targetTokens.length);
  return queryCoverage * 0.65 + targetCoverage * 0.35;
}

/**
 * Finds ranked matching courses by fuzzy code or title matching.
 */
export function matchCoursesFuzzy(
  queryText: string,
  courses: VoiceCourseRef[]
): Array<{ course: VoiceCourseRef; score: number }> {
  if (!queryText.trim() || courses.length === 0) return [];
  const norm = normalizeSpokenCommand(queryText);
  const cleanedQuery = norm.compact
    .replace(/^(open|view|select|go|course|subject|class)\s+/i, '')
    .trim();
  if (!cleanedQuery) return [];

  const qCode = normalizeCourseCodeQuery(cleanedQuery);
  const qTokens = cleanedQuery
    .split(/\s+/)
    .filter((t) => t && !['course', 'open', 'class', 'subject'].includes(t));

  const results: Array<{ course: VoiceCourseRef; score: number }> = [];

  for (const course of courses) {
    const cCode = normalizeCourseCodeQuery(course.code || '');
    const cTitle = (course.title || '').toLowerCase();
    let bestScore = 0;

    // 1. Course code matching (exact + Levenshtein)
    if (qCode && cCode) {
      if (qCode === cCode) {
        bestScore = 0.99;
      } else {
        const dist = levenshteinDistance(qCode, cCode);
        const sim = stringSimilarity(qCode, cCode);
        // Exact digits match + similar prefix (e.g. "COME124" vs "COM124")
        const qDigits = qCode.replace(/\D/g, '');
        const cDigits = cCode.replace(/\D/g, '');
        if (qDigits && cDigits && qDigits === cDigits && dist <= 2) {
          bestScore = Math.max(bestScore, 0.86 - dist * 0.05);
        } else if (dist === 1 && qCode.length >= 4) {
          bestScore = Math.max(bestScore, 0.68);
        } else if (sim >= 0.68) {
          bestScore = Math.max(bestScore, sim * 0.85);
        }
      }
    }

    // 2. Course title fuzzy matching (e.g. "data structure" -> "Data Structures")
    if (qTokens.length > 0 && cTitle) {
      if (cTitle === cleanedQuery.toLowerCase()) {
        bestScore = Math.max(bestScore, 0.97);
      } else if (cTitle.includes(cleanedQuery.toLowerCase()) && cleanedQuery.length >= 4) {
        bestScore = Math.max(bestScore, 0.89);
      } else {
        const sim = tokenPhraseSimilarity(qTokens, cTitle);
        if (sim >= 0.55) {
          bestScore = Math.max(bestScore, Math.min(0.92, sim));
        }
      }
    }

    if (bestScore >= 0.5) {
      results.push({ course, score: Number(bestScore.toFixed(3)) });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Finds ranked matching topics inside the open course by number or fuzzy title.
 */
export function matchTopicsFuzzy(
  queryText: string,
  topics: VoiceTopicRef[]
): Array<{ topic: VoiceTopicRef; index: number; score: number }> {
  if (!queryText.trim() || topics.length === 0) return [];
  const norm = normalizeSpokenCommand(queryText);
  const cleanedQuery = norm.compact
    .replace(/^(open|view|select|go|topic|chapter|lesson|unit)\s+/i, '')
    .trim();
  if (!cleanedQuery) return [];

  const num = parseSpokenNumber(cleanedQuery);
  if (num !== null && num >= 1 && num <= topics.length) {
    return [{ topic: topics[num - 1], index: num, score: 0.98 }];
  }

  const qTokens = cleanedQuery.split(/\s+/).filter(Boolean);
  const results: Array<{ topic: VoiceTopicRef; index: number; score: number }> = [];

  topics.forEach((topic, idx) => {
    const tTitle = (topic.title || '').toLowerCase();
    let score = 0;
    if (tTitle === cleanedQuery.toLowerCase()) {
      score = 0.97;
    } else if (tTitle.includes(cleanedQuery.toLowerCase()) && cleanedQuery.length >= 3) {
      score = 0.88;
    } else {
      const sim = tokenPhraseSimilarity(qTokens, tTitle);
      if (sim >= 0.52) {
        score = Math.min(0.91, sim);
      }
    }
    if (score >= 0.5) {
      results.push({ topic, index: idx + 1, score: Number(score.toFixed(3)) });
    }
  });

  return results.sort((a, b) => b.score - a.score);
}

interface ResolveVoiceOptions {
  transcript: string;
  pageContext: VoicePageContext;
  isSpeaking: boolean;
  hasWordBankQuestion?: boolean;
  availableCommands: Set<VoiceCommandId>;
  availableCourses: VoiceCourseRef[];
  availableTopics: VoiceTopicRef[];
}

const OPTION_HOMOPHONES: Record<string, string> = {
  a: 'A',
  ay: 'A',
  hey: 'A',
  b: 'B',
  be: 'B',
  bee: 'B',
  c: 'C',
  see: 'C',
  sea: 'C',
  d: 'D',
  dee: 'D',
  e: 'E',
  f: 'F',
  ef: 'F'
};

/**
 * Deterministic NLU intent & fuzzy resolver.
 */
export function resolveVoiceIntent(opts: ResolveVoiceOptions): VoiceResolutionResult {
  const normalized = normalizeSpokenCommand(opts.transcript);
  const { compact, withDigits, lowercaseClean, tokens } = normalized;
  const { pageContext, isSpeaking, availableCommands, availableCourses, availableTopics } = opts;

  const candidates: VoiceIntentCandidate[] = [];
  const pushCandidate = (
    commandId: VoiceCommandId,
    label: string,
    score: number,
    argument?: string,
    requiresConfirmation?: boolean
  ) => {
    if (!availableCommands.has(commandId)) return;
    const existing = candidates.find(
      (c) => c.commandId === commandId && (c.argument || '') === (argument || '')
    );
    if (existing) {
      if (score > existing.score) existing.score = score;
    } else {
      candidates.push({ commandId, label, score, argument, requiresConfirmation });
    }
  };

  // 1. Help & Page Overview
  if (/\b(what can i say|help|voice commands|command list|commands|wetin i fit talk)\b/.test(withDigits) || compact === 'help') {
    pushCandidate('help', 'List voice commands', 0.98);
  }
  if (/\b(what.*on.*page|where am i|describe.*page|what page|which page)\b/.test(withDigits)) {
    pushCandidate('describePage', 'Describe this page', 0.96);
  }

  // 2. Playback & Speech Controls (exact & Pidgin synonyms)
  if (/^(stop|stop reading|quiet|silence|shut up|hush|off|stop am|stop it)$/.test(compact) || /\bstop reading\b/.test(compact)) {
    pushCandidate('stopSpeech', 'Stop reading', 0.97);
  }
  if (/^(pause|pause reading|hold on|wait|hang on|wait small|hold)$/.test(compact) || /\bpause reading\b/.test(compact)) {
    pushCandidate('pauseSpeech', 'Pause reading', 0.97);
  }
  if (
    /^(resume|continue|continue reading|go on|keep going|carry on|proceed)$/.test(withDigits) ||
    /^(resume|continue|continue reading|keep going|carry on|proceed)$/.test(compact) ||
    /\bresume reading\b/.test(compact)
  ) {
    pushCandidate('resumeSpeech', 'Resume reading', 0.97);
  }
  if (/^(repeat|say again|say that again|again|come again|pardon)$/.test(compact)) {
    pushCandidate('repeatSpeech', 'Repeat what was just said', 0.94);
  }
  if (/\b(faster|speed up|read faster|speak faster|too slow|quick)\b/.test(compact)) {
    pushCandidate('fasterSpeech', 'Read faster', 0.94);
  }
  if (/\b(slower|slow down|read slower|speak slower|too fast)\b/.test(compact)) {
    pushCandidate('slowerSpeech', 'Read slower', 0.94);
  }
  if (/\b(next paragraph|skip paragraph|forward paragraph)\b/.test(compact)) {
    pushCandidate('nextParagraph', 'Next paragraph', 0.95);
  }
  if (/\b(previous paragraph|last paragraph|back paragraph)\b/.test(compact)) {
    pushCandidate('previousParagraph', 'Previous paragraph', 0.95);
  }

  // 3. Quiz-Specific Commands (with strong boost on quiz-active screen)
  const inQuiz = pageContext === 'quiz-active';

  // Option A-F
  const explicitOptionMatch = lowercaseClean.match(
    /\b(?:option|choice|answer|pick|select|choose|mark)\s+([a-f]|bee|see|sea|dee|ay|ef)\b/i
  );
  if (explicitOptionMatch) {
    const mapped = OPTION_HOMOPHONES[explicitOptionMatch[1].toLowerCase()];
    if (mapped) {
      pushCandidate('selectOption', `Select option ${mapped}`, inQuiz ? 0.98 : 0.78, mapped);
    }
  } else if (tokens.length === 1 && OPTION_HOMOPHONES[tokens[0]] && inQuiz) {
    const mapped = OPTION_HOMOPHONES[tokens[0]];
    pushCandidate('selectOption', `Select option ${mapped}`, 0.95, mapped);
  } else if (/^i\s+(?:choose|pick|select|want)\s+([a-f]|bee|see|sea|dee|ay)$/i.test(lowercaseClean)) {
    const m = lowercaseClean.match(/([a-f]|bee|see|sea|dee|ay)$/i);
    const mapped = m ? OPTION_HOMOPHONES[m[1].toLowerCase()] : undefined;
    if (mapped) {
      pushCandidate('selectOption', `Select option ${mapped}`, inQuiz ? 0.97 : 0.72, mapped);
    }
  }

  // True / False
  if (/^(?:select |choose |answer |pick |it is |is )?true$/.test(compact)) {
    pushCandidate('selectTrueFalse', 'Select True', inQuiz ? 0.97 : 0.72, 'true');
  }
  if (/^(?:select |choose |answer |pick |it is |is )?false$/.test(compact)) {
    pushCandidate('selectTrueFalse', 'Select False', inQuiz ? 0.97 : 0.72, 'false');
  }

  // Time left
  if (/\b(how much time|time left|time remaining|minutes left|seconds left|timer|how long left)\b/.test(withDigits)) {
    pushCandidate('howMuchTimeIsLeft', 'Check remaining quiz time', inQuiz ? 0.97 : 0.7);
  }

  // Submit quiz (Always confirmation-gated)
  if (
    /\b(?:submit|finish|end|turn in|complete)\s+(?:quiz|test|exam|cbt|assessment|answers?)\b/.test(compact) ||
    (inQuiz && /^(?:submit|finish|done|i am done)$/.test(compact))
  ) {
    pushCandidate('submitQuiz', 'Submit quiz', inQuiz ? 0.97 : 0.65, undefined, true);
  }

  // Read question / repeat options
  if (/\b(?:read|repeat|tell|say|what is)\s+question\b/.test(compact) || (inQuiz && /^(?:question|read|listen|say)$/.test(compact))) {
    pushCandidate('readQuestion', 'Read the question', inQuiz ? 0.95 : 0.65);
  }
  if (/\b(?:repeat|read|tell|say|what are)\s+(?:options?|choices?|answers?)\b/.test(compact)) {
    pushCandidate('repeatOptions', 'Repeat the answer options', inQuiz ? 0.95 : 0.65);
  }

  // Next / Previous Question
  if (/\b(?:next|skip|forward)\s+question\b/.test(compact)) {
    pushCandidate('nextQuestion', 'Next question', 0.97);
  }
  if (/\b(?:previous|prev|last|back)\s+question\b/.test(compact)) {
    pushCandidate('previousQuestion', 'Previous question', 0.97);
  }

  // 4. Start or Open Quiz (handles "I need to take the quiz", "I wan do quiz", "open the quiz", "write exam")
  const wantsQuizAction =
    /\b(?:take|start|begin|do|attempt|write|answer|try|open|launch|go)\s+(?:quiz|quizzes|test|exam|cbt|assessment)\b/.test(compact) ||
    /^(?:quiz|quizzes|test|exam|cbt)$/.test(compact);

  if (wantsQuizAction) {
    const isPluralOrBrowse = /\b(quizzes|tests|exams|my quizzes|all quizzes|quiz list)\b/.test(compact) &&
      !/\b(take|start|begin|do|attempt|write)\b/.test(compact);
    if (!isPluralOrBrowse && availableCommands.has('startQuiz') && (pageContext === 'lesson' || pageContext === 'quiz-list')) {
      pushCandidate('startQuiz', 'Start the quiz', 0.96);
    } else if (availableCommands.has('openQuizzes')) {
      pushCandidate('openQuizzes', 'Open Quizzes page', 0.94);
    } else if (availableCommands.has('startQuiz')) {
      pushCandidate('startQuiz', 'Start quiz', 0.92);
    }
  }

  // 5. Reading Commands (Notes / Summary / Page / Contextual "make you read am")
  if (/\b(?:read|listen|play|tell|say)\s+(?:summary|overview|takeaway|key points)\b/.test(compact) || compact === 'summary') {
    pushCandidate('readSummary', 'Read the summary', 0.96);
  }
  if (/\b(?:read|listen|play|tell|say)\s+(?:notes?|lesson|handout|material|study)\b/.test(compact) || compact === 'notes') {
    pushCandidate('readNotes', 'Read the lesson notes', 0.96);
  }
  if (/\b(?:read|listen|play|say)\s+(?:page|screen|everything|all|content)\b/.test(compact)) {
    pushCandidate('readPage', 'Read this page', 0.95);
  }
  if (/\b(?:read|start|continue)\s+from\s+here\b/.test(compact)) {
    pushCandidate('readFromHere', 'Read from here', 0.96);
  }
  if (/^(?:read|listen|play|tell|say)$/.test(compact)) {
    if (inQuiz) {
      pushCandidate('readQuestion', 'Read the question', 0.91);
    } else if (pageContext === 'lesson') {
      pushCandidate('readNotes', 'Read the lesson notes', 0.91);
    } else {
      pushCandidate('readPage', 'Read this page', 0.9);
    }
  }

  // 6. Contextual bare "next" / "next one" / "previous" / "previous one"
  if (/^(?:next|next one|forward)$/.test(compact)) {
    if (inQuiz) {
      pushCandidate('nextQuestion', 'Next question', 0.95);
    } else if (pageContext === 'lesson') {
      pushCandidate('nextTopic', 'Next topic', 0.95);
    } else if (isSpeaking) {
      pushCandidate('nextParagraph', 'Next paragraph', 0.89);
    }
  }
  if (/^(?:previous|prev|previous one|last one)$/.test(compact)) {
    if (inQuiz) {
      pushCandidate('previousQuestion', 'Previous question', 0.95);
    } else if (pageContext === 'lesson') {
      pushCandidate('previousTopic', 'Previous topic', 0.95);
    } else if (isSpeaking) {
      pushCandidate('previousParagraph', 'Previous paragraph', 0.89);
    }
  }

  // 7. Topic / Lesson Actions ("topic", "chapter", "lesson", "unit")
  if (/\b(?:mark|set|make).*(?:complete|completed|done|finish|finished)\b/.test(compact) || /\b(?:complete|finish)\s+(?:topic|chapter|lesson|unit)\b/.test(compact)) {
    pushCandidate('markTopicComplete', 'Mark topic complete', 0.94);
  }
  if (/\b(?:bookmark|save)\b/.test(compact)) {
    pushCandidate('bookmarkThis', 'Bookmark this', 0.93);
  }
  if (/\b(?:what|which|list|read|show|tell)\s+(?:topics?|chapters?|lessons?|units?)\b/.test(compact)) {
    pushCandidate('listTopics', 'List topics', 0.95);
  }
  if (/\bnext\s+(?:topic|chapter|lesson|unit)\b/.test(compact)) {
    pushCandidate('nextTopic', 'Next topic', 0.96);
  }
  if (/\b(?:previous|prev|last|back)\s+(?:topic|chapter|lesson|unit)\b/.test(compact)) {
    pushCandidate('previousTopic', 'Previous topic', 0.96);
  }

  const topicExplicitMatch = withDigits.match(/\b(?:go to |open |view |select )?(?:topic|chapter|lesson|unit)\s+(.+)$/);
  if (topicExplicitMatch) {
    const rest = topicExplicitMatch[1].trim();
    const num = parseSpokenNumber(rest);
    if (num !== null) {
      pushCandidate('goToTopic', `Open topic ${num}`, 0.96, String(num));
    } else if (availableTopics.length > 0) {
      const topicMatches = matchTopicsFuzzy(rest, availableTopics);
      topicMatches.slice(0, 2).forEach((m) => {
        pushCandidate('goToTopic', `Open topic ${m.index}: ${m.topic.title}`, m.score, String(m.index));
      });
    } else {
      pushCandidate('goToTopic', `Open topic ${rest}`, 0.82, rest);
    }
  } else if (pageContext === 'course-detail' && availableTopics.length > 0) {
    // e.g. "open five" or "five" on a course syllabus page
    const numOnly = compact.match(/^(?:open |go |select )?(\d+)$/);
    if (numOnly) {
      const n = parseInt(numOnly[1], 10);
      if (n >= 1 && n <= availableTopics.length) {
        pushCandidate('goToTopic', `Open topic ${n}: ${availableTopics[n - 1].title}`, 0.94, String(n));
      }
    } else if (!/\b(courses?|quizzes?|quiz|home|back|timetable|past|announcements?)\b/.test(compact)) {
      const topicMatches = matchTopicsFuzzy(compact, availableTopics);
      topicMatches.slice(0, 2).forEach((m) => {
        pushCandidate('goToTopic', `Open topic ${m.index}: ${m.topic.title}`, m.score * 0.95, String(m.index));
      });
    }
  }

  // 8. Course Lookup (Exact Code, Spoken Digits Code, or Fuzzy Course Title / Code)
  const explicitCourseCode = withDigits.match(/\b(?:open|view|select|go|study)?\s*(?:course\s+)?([a-z]{2,5}\s*\d{3})\b/i);
  if (explicitCourseCode && availableCourses.length > 0) {
    const fuzzy = matchCoursesFuzzy(explicitCourseCode[1], availableCourses);
    if (fuzzy.length > 0) {
      fuzzy.slice(0, 2).forEach((m) => {
        pushCandidate('openCourse', `Open ${m.course.code} (${m.course.title})`, m.score, m.course.code);
      });
    } else {
      pushCandidate('openCourse', `Open course ${explicitCourseCode[1].toUpperCase()}`, 0.84, explicitCourseCode[1]);
    }
  } else if (explicitCourseCode) {
    pushCandidate('openCourse', `Open course ${explicitCourseCode[1].toUpperCase()}`, 0.86, explicitCourseCode[1]);
  } else if (availableCourses.length > 0 && compact.length >= 3) {
    // Fuzzy match against actual courses even without saying "open course" (e.g., "data structure", "com one twenty four")
    const strippedVerb = compact.replace(/^(?:open|view|go|my|show|select|start|take)\s+/, '').trim();
    const isGenericNavWord = /^(courses?|classes|subjects|lessons|home|main page|dashboard|quizzes?|past questions|past papers|timetable|announcements?|back|return|help|log out|sign out|summary|notes|page)$/.test(strippedVerb);
    if (!isGenericNavWord && strippedVerb.length >= 3) {
      const fuzzy = matchCoursesFuzzy(compact, availableCourses);
      fuzzy.slice(0, 2).forEach((m) => {
        pushCandidate('openCourse', `Open ${m.course.code} (${m.course.title})`, m.score, m.course.code);
      });
    }
  }

  // 9. Fill-in-the-Gaps Spoken Word Bank
  if (opts.hasWordBankQuestion && availableCommands.has('selectWordBankWord')) {
    const gapExplicit = withDigits.match(/\b(?:gap|blank|number)\s+(\d+)\s+(.+)$/);
    if (gapExplicit) {
      pushCandidate('selectWordBankWord', `Place ${gapExplicit[2]} in gap ${gapExplicit[1]}`, 0.94, `${gapExplicit[1]}|${gapExplicit[2]}`);
    } else if (/^(?:put|fill|choose|select|pick)\s+(.+)$/.test(compact)) {
      const word = compact.replace(/^(?:put|fill|choose|select|pick)\s+/, '').trim();
      if (word && !OPTION_HOMOPHONES[word]) {
        pushCandidate('selectWordBankWord', `Pick word ${word}`, 0.86, `|${word}`);
      }
    }
  }

  // 10. Primary App Navigation Intents with Synonyms & Pidgin
  if (/\b(?:go\s+home|open\s+home|main\s+page|home\s+page|dashboard|overview|start\s+page)\b/.test(compact) || /^(?:home|main|dashboard)$/.test(compact)) {
    pushCandidate('goHome', 'Go home', 0.96);
  }
  if (/\b(?:open|view|go|show|my)\s+(?:courses?|classes?|subjects?|lessons?)\b/.test(compact) || /^(?:courses?|classes?|subjects?|lessons?)$/.test(compact)) {
    pushCandidate('openCourses', 'Open courses', 0.95);
  }
  if (/\b(?:past\s+questions?|past\s+papers?|old\s+questions?|exam\s+questions?|pq|past\s+exam)\b/.test(compact)) {
    pushCandidate('openPastQuestions', 'Open past questions', 0.96);
  }
  if (/\b(?:timetable|time\s+table|class\s+schedule|exam\s+schedule|schedule|lecture\s+times?)\b/.test(compact)) {
    pushCandidate('openTimetable', 'Open timetable', 0.96);
  }
  if (/\b(?:announcements?|notices?|news|updates?|bulletin|memo)\b/.test(compact)) {
    pushCandidate('openAnnouncements', 'Open announcements', 0.96);
  }
  if (/\b(?:go\s+back|previous\s+page|last\s+page|return)\b/.test(compact) || compact === 'back') {
    if (inQuiz && compact === 'back') {
      pushCandidate('previousQuestion', 'Previous question', 0.92);
      pushCandidate('goBack', 'Exit or go back', 0.85);
    } else {
      pushCandidate('goBack', 'Go back', 0.95);
    }
  }
  if (/\b(?:log\s+out|sign\s+out|logout|signout)\b/.test(compact)) {
    pushCandidate('logout', 'Log out of your account', 0.96, undefined, true);
  }

  // Soft synonym scoring fallback when exact phrases didn't trigger high-confidence hits
  if (candidates.length === 0) {
    const softMap: Array<{
      id: VoiceCommandId;
      label: string;
      keywords: string[];
      confirm?: boolean;
    }> = [
      { id: 'openCourses', label: 'Open courses', keywords: ['course', 'courses', 'class', 'classes', 'subject', 'subjects', 'lesson', 'lessons'] },
      { id: 'openQuizzes', label: 'Open quizzes', keywords: ['quiz', 'quizzes', 'test', 'tests', 'cbt', 'exam'] },
      { id: 'openPastQuestions', label: 'Open past questions', keywords: ['past', 'papers', 'pq', 'old'] },
      { id: 'openTimetable', label: 'Open timetable', keywords: ['timetable', 'schedule', 'venue', 'lectures'] },
      { id: 'openAnnouncements', label: 'Open announcements', keywords: ['announcement', 'announcements', 'notice', 'notices', 'bulletin'] },
      { id: 'goHome', label: 'Go home', keywords: ['home', 'dashboard', 'main', 'start'] },
      { id: 'goBack', label: 'Go back', keywords: ['back', 'return', 'previous'] },
      { id: 'readPage', label: 'Read this page', keywords: ['read', 'listen', 'speak', 'tell'] }
    ];

    for (const item of softMap) {
      if (!availableCommands.has(item.id)) continue;
      let maxSim = 0;
      for (const tok of tokens) {
        if (tok.length < 3) continue;
        for (const kw of item.keywords) {
          const sim = stringSimilarity(tok, kw);
          if (sim >= 0.72 && sim > maxSim) {
            maxSim = sim;
          }
        }
      }
      if (maxSim >= 0.72) {
        // Confidence deliberately sits in confirmation band (0.55 - 0.69) for single typos
        pushCandidate(item.id, item.label, Math.min(0.68, maxSim * 0.75), undefined, item.confirm);
      }
    }
  }

  if (candidates.length === 0) {
    return { status: 'unmatched', normalized };
  }

  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const second = sorted[1];

  // Two close plausible candidates -> ask "Did you mean X or Y?"
  if (second && top.score >= 0.45 && second.score >= 0.45 && top.score - second.score < 0.12) {
    return {
      status: 'disambiguate-two',
      candidates: [top, second],
      normalized
    };
  }

  // Clear confident winner
  if (top.score >= 0.76) {
    return {
      status: 'matched',
      candidate: top,
      normalized
    };
  }

  // Single moderate guess -> ask "Did you mean X? Say yes or no."
  if (top.score >= 0.45) {
    return {
      status: 'confirm-single',
      candidate: top,
      normalized
    };
  }

  return { status: 'unmatched', normalized };
}

/**
 * Returns 3 tailored spoken command examples for the active screen when nothing matched.
 */
export function getExampleCommandsForPage(pageContext: VoicePageContext): [string, string, string] {
  switch (pageContext) {
    case 'quiz-active':
      return ['Option B', 'Next question', 'How much time is left'];
    case 'quiz-list':
      return ['Start quiz', 'Go back', 'Open courses'];
    case 'lesson':
      return ['Read the notes', 'Take the quiz', 'Next topic'];
    case 'course-detail':
      return ['Open topic 1', 'List topics', 'Go back'];
    case 'courses-list':
      return ['Open COM 124', 'Open quizzes', 'Go home'];
    case 'past-questions':
      return ['Read this page', 'Open courses', 'Go back'];
    case 'timetable':
      return ['Read this page', 'Open courses', 'Go home'];
    case 'announcements':
      return ['Read this page', 'Open timetable', 'Go home'];
    case 'dashboard':
      return ['Open courses', 'Open quizzes', 'Open timetable'];
    default:
      return ['Go home', 'Open courses', 'What is on this page'];
  }
}

/**
 * Builds the strict allowlist of commands allowed on the current page (used for Optional AI Fallback).
 */
export function getAllowedCommandsForPage(
  pageContext: VoicePageContext,
  availableCommands: Set<VoiceCommandId>
): AllowedVoiceCommandSpec[] {
  const catalog: AllowedVoiceCommandSpec[] = [
    { id: 'goHome', label: 'Go to Student Home dashboard' },
    { id: 'openCourses', label: 'Open Courses page' },
    { id: 'openPastQuestions', label: 'Open Past Questions page' },
    { id: 'openTimetable', label: 'Open Timetable page' },
    { id: 'openAnnouncements', label: 'Open Announcements page' },
    { id: 'openQuizzes', label: 'Open Quizzes page' },
    { id: 'goBack', label: 'Go back to the previous page' },
    { id: 'openCourse', label: 'Open a specific course by code or title', acceptsArgument: true },
    { id: 'describePage', label: 'Describe what is on this page' },
    { id: 'readPage', label: 'Read the page content aloud' },
    { id: 'stopSpeech', label: 'Stop reading aloud' },
    { id: 'pauseSpeech', label: 'Pause reading aloud' },
    { id: 'resumeSpeech', label: 'Resume reading aloud' },
    { id: 'repeatSpeech', label: 'Repeat what was last read' },
    { id: 'fasterSpeech', label: 'Increase reading speed' },
    { id: 'slowerSpeech', label: 'Decrease reading speed' },
    { id: 'help', label: 'List available voice commands' },
    { id: 'logout', label: 'Log out of account', requiresConfirmation: true }
  ];

  if (pageContext === 'lesson' || pageContext === 'course-detail') {
    catalog.push(
      { id: 'goToTopic', label: 'Open a syllabus topic by number or title', acceptsArgument: true },
      { id: 'listTopics', label: 'List topics in the current course' },
      { id: 'nextTopic', label: 'Open the next topic' },
      { id: 'previousTopic', label: 'Open the previous topic' },
      { id: 'readNotes', label: 'Read the lesson notes aloud' },
      { id: 'readSummary', label: 'Read the lesson summary aloud' },
      { id: 'readFromHere', label: 'Read from current paragraph' },
      { id: 'nextParagraph', label: 'Skip to next paragraph' },
      { id: 'previousParagraph', label: 'Go to previous paragraph' },
      { id: 'markTopicComplete', label: 'Mark current topic complete' },
      { id: 'bookmarkThis', label: 'Bookmark current lesson' },
      { id: 'startQuiz', label: 'Start the quiz for this topic' }
    );
  }

  if (pageContext === 'quiz-list') {
    catalog.push({ id: 'startQuiz', label: 'Start the quiz' });
  }

  if (pageContext === 'quiz-active') {
    catalog.push(
      { id: 'readQuestion', label: 'Read the current quiz question aloud' },
      { id: 'repeatOptions', label: 'Repeat the quiz answer choices' },
      { id: 'selectOption', label: 'Select multiple-choice option letter A-F', acceptsArgument: true },
      { id: 'selectTrueFalse', label: 'Select True or False', acceptsArgument: true },
      { id: 'selectWordBankWord', label: 'Pick a word from the word bank for fill-in-the-gaps', acceptsArgument: true },
      { id: 'nextQuestion', label: 'Go to the next quiz question' },
      { id: 'previousQuestion', label: 'Go to the previous quiz question' },
      { id: 'howMuchTimeIsLeft', label: 'Check how much quiz time is remaining' },
      { id: 'submitQuiz', label: 'Submit the quiz', requiresConfirmation: true }
    );
  }

  return catalog.filter((item) => availableCommands.has(item.id));
}

/**
 * Strips any accidental emails or matric-like numbers before logging an unrecognized phrase
 * so Help Improve never saves personal identifiers.
 */
export function sanitizePhraseForLogging(raw: string): string {
  return (raw || '')
    .trim()
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]')
    .replace(/\b[A-Za-z]{1,4}\/[A-Za-z]{2,4}\/\d{2,4}\/\d{3,8}\b/g, '[id]')
    .replace(/\b\d{7,15}\b/g, '[number]')
    .slice(0, 280);
}
