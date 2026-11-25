/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, safeSetDoc, safeUpdateDoc, cleanFirestoreData } from '../lib/firebase';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  arrayUnion,
  query,
  where
} from 'firebase/firestore';
import { QuizItem, QuizQuestion, QuizKeyDoc, QuizAttempt } from '../types';
import {
  FileQuestion,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Search,
  RefreshCw,
  Award,
  RotateCcw,
  BookOpen,
  Check,
  X,
  Flag,
  HelpCircle,
  Share2,
  Bookmark
} from 'lucide-react';
import { ShareButton } from './ShareButton';
import { WhatsAppScoreShare } from './WhatsAppScoreShare';
import { ConfettiEffect } from './ConfettiEffect';
import { BadgeUnlockedModal } from './BadgeUnlockedModal';
import { EmptyState } from './EmptyState';
import { QuizListSkeleton } from './SkeletonLoader';
import { checkAndAwardBadges } from '../lib/badges';
import { recordWeeklyQuizPoints } from '../utils/leaderboard';
import { BookmarkItem, UserProfile, BadgeItem } from '../types';
import { logStudentActivity } from '../lib/studentActivity';
import { useAccessibility, useRegisterVoiceHandlers } from '../context/AccessibilityContext';
import { ReadAloudBar } from './ReadAloudBar';
import { cleanMarkdownForSpeech } from '../lib/speechUtils';

interface StudentQuizzesViewProps {
  studentDepartment: string;
  studentLevel?: string;
  studentName?: string;
  matricNumber?: string;
  uid: string;
  initialQuizId?: string;
  topicTitle?: string;
  onBackToTopic?: () => void;
  onBackToHome?: () => void;
  onTopicCompleted?: (topicId: string) => void;
  isBookmarked?: (type: string, id: string) => boolean;
  toggleBookmark?: (item: any) => Promise<void>;
  bookmarks?: BookmarkItem[];
  profile?: UserProfile | null;
  onBadgeUnlocked?: (badge: BadgeItem) => void;
}

const ACADEMIC_LEVELS = ['All', 'ND1', 'ND2', 'HND1', 'HND2'] as const;

export const StudentQuizzesView: React.FC<StudentQuizzesViewProps> = ({
  studentDepartment,
  studentLevel = 'ND1',
  studentName,
  matricNumber,
  uid,
  initialQuizId,
  topicTitle,
  onBackToTopic,
  onBackToHome,
  onTopicCompleted,
  isBookmarked,
  toggleBookmark,
  bookmarks,
  profile,
  onBadgeUnlocked
}) => {
  // Navigation Screens: 'list' | 'intro' | 'taking' | 'review'
  const [currentScreen, setCurrentScreen] = useState<'list' | 'intro' | 'taking' | 'review'>('list');

  // Polish & Badge states
  const [showConfetti, setShowConfetti] = useState(false);
  const [newlyAwardedBadge, setNewlyAwardedBadge] = useState<BadgeItem | null>(null);

  // Quizzes list state
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [attemptsMap, setAttemptsMap] = useState<Record<string, QuizAttempt>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters for student list
  const [semesterFilter, setSemesterFilter] = useState<'First Semester' | 'Second Semester' | 'All'>('All');
  const [levelFilter, setLevelFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Active quiz session states
  const [activeQuiz, setActiveQuiz] = useState<QuizItem | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, any>>({});
  const [shuffledOptionIndicesMap, setShuffledOptionIndicesMap] = useState<Record<string, number[]>>({});
  const [revealedModelAnswers, setRevealedModelAnswers] = useState<Record<string, boolean>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [wasAutoSubmitted, setWasAutoSubmitted] = useState(false);
  const [topicAutoCompletedNotice, setTopicAutoCompletedNotice] = useState<boolean>(false);

  // Fill in the gaps (tap to pick) states
  const [activeGapNum, setActiveGapNum] = useState<number | null>(null);
  const [selectedBankWord, setSelectedBankWord] = useState<string | null>(null);
  const [shuffledWordBankMap, setShuffledWordBankMap] = useState<Record<string, Array<{ id: string; word: string }>>>({});
  const [gapChipIdMap, setGapChipIdMap] = useState<Record<string, Record<string, string>>>({});

  // Review screen states: Missed (shown first), Correct, All
  const [reviewKeys, setReviewKeys] = useState<QuizKeyDoc | null>(null);
  const [reviewAttempt, setReviewAttempt] = useState<QuizAttempt | null>(null);
  const [reviewTab, setReviewTab] = useState<'missed' | 'correct' | 'all'>('missed');
  const [localBookmarks, setLocalBookmarks] = useState<Record<string, boolean>>({});

  // Timer interval reference
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Accessibility & speech helpers
  const { settings: a11ySettings, speak } = useAccessibility();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const lastSpokenCountdownMinuteRef = useRef<number | null>(null);
  const lastAutoReadKeyRef = useRef<string>('');
  const latestQuizReviewSpeechRef = useRef<string>('');

  // Fetch quizzes and student's attempts
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch published quizzes for this student's department
      const qRef = collection(db, 'quizzes');
      const qQuery = query(
        qRef,
        where('department', '==', studentDepartment),
        where('published', '==', true)
      );
      const qSnap = await getDocs(qQuery);
      const list: QuizItem[] = [];
      qSnap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as QuizItem);
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setQuizzes(list);

      // 2. Fetch student's attempts
      if (uid) {
        const attRef = collection(db, 'quizAttempts');
        const attQuery = query(attRef, where('uid', '==', uid));
        const attSnap = await getDocs(attQuery);
        const map: Record<string, QuizAttempt> = {};
        attSnap.forEach(d => {
          const a = d.data() as QuizAttempt;
          map[a.quizId] = a;
        });
        setAttemptsMap(map);
      }

      // Check initialQuizId if passed from a lesson
      if (initialQuizId) {
        const target = list.find(q => q.id === initialQuizId);
        if (target) {
          handleOpenIntro(target);
        }
      }
    } catch (err: any) {
      console.error('Failed to load student quizzes:', err);
      setError(err?.message || 'Failed to load quizzes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [studentDepartment, uid, initialQuizId]);

  // Open Intro Card before starting a quiz
  const handleOpenIntro = async (quiz: QuizItem) => {
    let target = quiz;
    try {
      const freshSnap = await getDoc(doc(db, 'quizzes', quiz.id));
      if (freshSnap.exists()) {
        target = { id: freshSnap.id, ...freshSnap.data() } as QuizItem;
      }
    } catch {}
    setActiveQuiz(target);
    setCurrentScreen('intro');
  };

  // Helper to extract ordered gap numbers from a question text or gaps array
  const getQuestionGapNumbers = (q: QuizQuestion): number[] => {
    const nums: number[] = [];
    if (q.text) {
      const regex = /(?:\[(\d+)\]|\((\d+)\))/g;
      let match;
      while ((match = regex.exec(q.text)) !== null) {
        const n = parseInt(match[1] || match[2], 10);
        if (!nums.includes(n) && !isNaN(n)) nums.push(n);
      }
    }
    if (q.gaps) {
      q.gaps.forEach(g => {
        if (!nums.includes(g.gapNumber)) nums.push(g.gapNumber);
      });
    }
    if (nums.length === 0 && q.wordBank && q.wordBank.length > 0) {
      for (let i = 1; i <= q.wordBank.length; i++) nums.push(i);
    }
    nums.sort((a, b) => a - b);
    return nums.length > 0 ? nums : [1];
  };

  // Helper to determine if a question has been answered
  const isQuestionAnswered = (q: QuizQuestion, ans: any): boolean => {
    if (ans === undefined || ans === null) return false;
    if (q.type === 'theory-select-all') {
      return Array.isArray(ans) && ans.length > 0;
    }
    if (q.type === 'theory-self-check') {
      return ans === 'knew' || ans === 'partly' || ans === 'not-yet';
    }
    if (q.type === 'fill-gaps') {
      return Boolean(
        ans &&
        typeof ans === 'object' &&
        !Array.isArray(ans) &&
        Object.values(ans).some(v => Boolean(v && String(v).trim()))
      );
    }
    return typeof ans === 'number' && ans >= 0;
  };

  // Start Taking Quiz after reviewing Intro Card
  const handleStartTakingQuiz = () => {
    if (!activeQuiz) return;
    setWasAutoSubmitted(false);
    setTopicAutoCompletedNotice(false);

    // Shuffle questions if quiz.shuffle is enabled
    let qList = [...(activeQuiz.questions || [])];
    if (activeQuiz.shuffle) {
      qList = qList.sort(() => Math.random() - 0.5);
    }
    setActiveQuestions(qList);
    setCurrentQuestionIndex(0);

    // Initialize answers per question type
    const initAnswers: Record<string, any> = {};
    const initFlags: Record<string, boolean> = {};
    const optMap: Record<string, number[]> = {};
    const gapBankMap: Record<string, Array<{ id: string; word: string }>> = {};

    qList.forEach(q => {
      if (q.type === 'theory-select-all') {
        initAnswers[q.id] = [];
      } else if (q.type === 'theory-self-check') {
        initAnswers[q.id] = null;
      } else if (q.type === 'fill-gaps') {
        initAnswers[q.id] = {};
      } else {
        initAnswers[q.id] = -1;
      }
      initFlags[q.id] = false;

      // Randomize option order if shuffle is enabled (except True/False)
      if (q.options && q.options.length > 1 && q.type !== 'true-false') {
        if (activeQuiz.shuffle) {
          optMap[q.id] = q.options.map((_, i) => i).sort(() => Math.random() - 0.5);
        } else {
          optMap[q.id] = q.options.map((_, i) => i);
        }
      }

      // Shared word bank for fill-gaps: all correct answers shuffled as chips
      if (q.type === 'fill-gaps') {
        const rawWords: string[] =
          q.wordBank && q.wordBank.length > 0
            ? q.wordBank
            : q.gaps
            ? q.gaps.map(g => g.options?.[0] || '').filter(Boolean)
            : [];

        // Build unique chips and shuffle them for the student
        const chips = rawWords.map((w, idx) => ({
          id: `${q.id}_c${idx}`,
          word: w
        })).sort(() => Math.random() - 0.5);

        gapBankMap[q.id] = chips;
      }
    });
    setSelectedAnswers(initAnswers);
    setShuffledOptionIndicesMap(optMap);
    setShuffledWordBankMap(gapBankMap);
    setGapChipIdMap({});
    setActiveGapNum(null);
    setSelectedBankWord(null);
    setRevealedModelAnswers({});
    setFlaggedQuestions(initFlags);

    // Setup timer (with extended quiz time multiplier when enabled)
    const baseMinutes = (activeQuiz.timeLimit && Number(activeQuiz.timeLimit) > 0)
      ? Math.min(180, Math.max(1, Math.round(Number(activeQuiz.timeLimit))))
      : 0;
    const multiplier = a11ySettings.extendedQuizTime || 1;
    const finalMinutes = baseMinutes > 0 ? Math.round(baseMinutes * multiplier) : 0;

    lastSpokenCountdownMinuteRef.current = finalMinutes > 0 ? finalMinutes : null;
    lastAutoReadKeyRef.current = '';
    setSubmitError(null);

    if (finalMinutes > 0) {
      setTimeLeft(finalMinutes * 60);
      setTimerRunning(true);
    } else {
      setTimeLeft(null);
      setTimerRunning(false);
    }

    setShowSubmitModal(false);
    setShowQuitModal(false);
    setCurrentScreen('taking');

    logStudentActivity({
      uid,
      name: studentName,
      department: studentDepartment,
      level: activeQuiz.level,
      type: 'quiz started',
      title: `${activeQuiz.courseCode}: ${activeQuiz.title}`
    });
  };

  // Timer countdown hook
  useEffect(() => {
    if (!timerRunning || timeLeft === null) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timerRunning]);

  // Clean trigger for auto-submit & spoken countdown alerts
  useEffect(() => {
    if (!timerRunning || timeLeft === null) return;
    if (timeLeft <= 0) {
      setTimerRunning(false);
      handleSubmitQuiz(true);
      return;
    }
    if (
      (a11ySettings.accessibilityMode || a11ySettings.voiceAssistantEnabled) &&
      timeLeft > 0 &&
      timeLeft % 60 === 0
    ) {
      const minsLeft = Math.floor(timeLeft / 60);
      if (lastSpokenCountdownMinuteRef.current !== minsLeft) {
        lastSpokenCountdownMinuteRef.current = minsLeft;
        // Always announce 60-second alert and periodic minute milestones
        if (minsLeft === 1 || minsLeft === 5 || minsLeft === 10 || minsLeft <= 3) {
          speak(`${minsLeft} ${minsLeft === 1 ? 'minute' : 'minutes'} remaining.`);
        }
      }
    }
  }, [timeLeft, timerRunning, a11ySettings.accessibilityMode, a11ySettings.voiceAssistantEnabled]);

  // Format Timer String
  const formatTime = (totalSeconds: number): string => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Select option for current single-choice question
  const handleSelectOption = (optionIndex: number) => {
    if (!activeQuestions[currentQuestionIndex]) return;
    const qId = activeQuestions[currentQuestionIndex].id;
    setSelectedAnswers(prev => ({
      ...prev,
      [qId]: optionIndex
    }));
  };

  // Toggle selection for select-all theory questions
  const handleToggleSelectAllOption = (optionIndex: number) => {
    if (!activeQuestions[currentQuestionIndex]) return;
    const qId = activeQuestions[currentQuestionIndex].id;
    const currentList: number[] = Array.isArray(selectedAnswers[qId]) ? selectedAnswers[qId] : [];
    const nextList = currentList.includes(optionIndex)
      ? currentList.filter(i => i !== optionIndex)
      : [...currentList, optionIndex];
    setSelectedAnswers(prev => ({
      ...prev,
      [qId]: nextList
    }));
  };

  // Rate self-check theory question (cannot be changed once tapped)
  const handleRateSelfCheck = (rating: 'knew' | 'partly' | 'not-yet') => {
    if (!activeQuestions[currentQuestionIndex]) return;
    const qId = activeQuestions[currentQuestionIndex].id;
    if (
      selectedAnswers[qId] === 'knew' ||
      selectedAnswers[qId] === 'partly' ||
      selectedAnswers[qId] === 'not-yet'
    ) {
      return; // Locked after tapping
    }
    setSelectedAnswers(prev => ({
      ...prev,
      [qId]: rating
    }));
  };

  // Fill in the gaps: fill gap with chosen word chip
  const handleFillGap = (gapNum: number, chipOrWord: { id: string; word: string } | string) => {
    if (!activeQuestions[currentQuestionIndex]) return;
    const q = activeQuestions[currentQuestionIndex];
    const qId = q.id;
    const chipWord = typeof chipOrWord === 'string' ? chipOrWord : chipOrWord.word;
    const chipId = typeof chipOrWord === 'string' ? `${qId}_g${gapNum}_${chipWord}` : chipOrWord.id;

    const currentGapAnswers: Record<string, string> = {
      ...(typeof selectedAnswers[qId] === 'object' && !Array.isArray(selectedAnswers[qId]) ? selectedAnswers[qId] : {})
    };
    currentGapAnswers[String(gapNum)] = chipWord;

    const currentChips: Record<string, string> = {
      ...(gapChipIdMap[qId] || {})
    };
    currentChips[String(gapNum)] = chipId;

    setSelectedAnswers(prev => ({
      ...prev,
      [qId]: currentGapAnswers
    }));

    setGapChipIdMap(prev => ({
      ...prev,
      [qId]: currentChips
    }));

    // Auto-advance active gap to next unfilled gap
    const gapNums = getQuestionGapNumbers(q);
    const nextUnfilled = gapNums.find(n => n !== gapNum && !currentGapAnswers[String(n)]);
    if (nextUnfilled) {
      setActiveGapNum(nextUnfilled);
    } else {
      setActiveGapNum(gapNum);
    }
  };

  // Fill in the gaps: clear answer for a gap and free the chip in the word bank
  const handleClearGap = (gapNum: number) => {
    if (!activeQuestions[currentQuestionIndex]) return;
    const q = activeQuestions[currentQuestionIndex];
    const qId = q.id;
    const currentGapAnswers: Record<string, string> = {
      ...(typeof selectedAnswers[qId] === 'object' && !Array.isArray(selectedAnswers[qId]) ? selectedAnswers[qId] : {})
    };
    delete currentGapAnswers[String(gapNum)];
    delete currentGapAnswers[gapNum];

    const currentChips: Record<string, string> = {
      ...(gapChipIdMap[qId] || {})
    };
    delete currentChips[String(gapNum)];
    delete currentChips[gapNum];

    setSelectedAnswers(prev => ({
      ...prev,
      [qId]: currentGapAnswers
    }));

    setGapChipIdMap(prev => ({
      ...prev,
      [qId]: currentChips
    }));

    setActiveGapNum(gapNum);
  };

  // Toggle mark for review
  const handleToggleFlag = () => {
    if (!activeQuestions[currentQuestionIndex]) return;
    const qId = activeQuestions[currentQuestionIndex].id;
    setFlaggedQuestions(prev => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  // Submit Quiz Logic
  const handleSubmitQuiz = async (autoSubmitted = false) => {
    if (!activeQuiz || submitting) return;
    setSubmitting(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerRunning(false);
    if (autoSubmitted) {
      setWasAutoSubmitted(true);
    }

    try {
      const now = new Date().toISOString();
      const attemptDocId = `${uid}_${activeQuiz.id}`;

      const existingAttempt = attemptsMap[activeQuiz.id];
      const attemptNumber = (existingAttempt?.attempts || 0) + 1;
      const ptsPerQ = activeQuiz.pointsPerQuestion || 1;

      // Read Quiz Keys doc to score the student's submission
      let totalEarnedScore = 0;
      const questionScores: Record<string, number> = {};
      let keysDocData: QuizKeyDoc | null = null;

      try {
        const keySnap = await getDoc(doc(db, 'quizKeys', activeQuiz.id));
        if (keySnap.exists()) {
          keysDocData = keySnap.data() as QuizKeyDoc;
          const keyItems = keysDocData.keys || [];

          activeQuestions.forEach(q => {
            const chosen = selectedAnswers[q.id];
            const matchingKey = keyItems.find(k => k.questionId === q.id);
            let earned = 0;

            if (matchingKey) {
              if (q.type === 'fill-gaps') {
                const ptsPerGap = q.pointsPerGap || matchingKey.pointsPerGap || 1;
                const gapAnswers = matchingKey.gapAnswers || {};
                const studentGapAnswers: Record<string, string> =
                  chosen && typeof chosen === 'object' && !Array.isArray(chosen) ? chosen : {};

                const allGapNumbers = new Set<string>();
                Object.keys(gapAnswers).forEach(k => allGapNumbers.add(String(k)));
                (q.gaps || []).forEach(g => allGapNumbers.add(String(g.gapNumber)));

                let correctGapsCount = 0;
                allGapNumbers.forEach(gNum => {
                  const correctWord = gapAnswers[gNum] || gapAnswers[Number(gNum)];
                  const studentWord = studentGapAnswers[gNum] || studentGapAnswers[Number(gNum)];
                  if (
                    correctWord &&
                    studentWord &&
                    String(studentWord).trim().toLowerCase() === String(correctWord).trim().toLowerCase()
                  ) {
                    correctGapsCount++;
                  }
                });

                // Scoring: each gap is worth ptsPerGap (partial credit by default)
                earned = correctGapsCount * ptsPerGap;
              } else if (q.type === 'theory-self-check') {
                if (chosen === 'knew') {
                  earned = ptsPerQ;
                } else if (chosen === 'partly') {
                  earned = 0.5 * ptsPerQ;
                } else {
                  earned = 0;
                }
              } else if (q.type === 'theory-select-all') {
                const chosenArr: number[] = Array.isArray(chosen) ? chosen : [];
                const correctArr: number[] = matchingKey.correctOptionIndices || [];
                if (activeQuiz.allowPartialCredit) {
                  // Formula: correct picked minus wrong picked, divided by total correct, never below zero
                  const correctPicked = chosenArr.filter(i => correctArr.includes(i)).length;
                  const wrongPicked = chosenArr.filter(i => !correctArr.includes(i)).length;
                  const frac = correctArr.length > 0 ? Math.max(0, (correctPicked - wrongPicked) / correctArr.length) : 0;
                  earned = Math.round(frac * ptsPerQ * 100) / 100;
                } else {
                  // Full marks only when all correct statements are selected and no wrong ones
                  const isExact =
                    chosenArr.length === correctArr.length &&
                    chosenArr.every(i => correctArr.includes(i));
                  earned = isExact ? ptsPerQ : 0;
                }
              } else {
                // multiple-choice, true-false, theory-best
                if (typeof chosen === 'number' && chosen >= 0 && chosen === matchingKey.correctOptionIndex) {
                  earned = ptsPerQ;
                } else {
                  earned = 0;
                }
              }
            }

            questionScores[q.id] = earned;
            totalEarnedScore += earned;
          });
        }
      } catch (keyErr) {
        console.warn('Could not read answer keys during submit:', keyErr);
      }

      const score = Number.isInteger(totalEarnedScore) ? totalEarnedScore : Math.round(totalEarnedScore * 10) / 10;
      
      // Calculate total possible score based on question types
      let totalPossible = 0;
      activeQuestions.forEach(q => {
        if (q.type === 'fill-gaps') {
          const matchingKey = keysDocData?.keys?.find(k => k.questionId === q.id);
          const ptsPerGap = q.pointsPerGap || matchingKey?.pointsPerGap || 1;
          const gapCount = Math.max(
            q.gaps?.length || 0,
            Object.keys(matchingKey?.gapAnswers || {}).length,
            1
          );
          totalPossible += gapCount * ptsPerGap;
        } else {
          totalPossible += ptsPerQ;
        }
      });
      const bestScore = Math.max(existingAttempt?.bestScore || 0, score);
      const percentage = totalPossible > 0 ? Math.round((totalEarnedScore / totalPossible) * 100) : 0;
      const passRequirement = activeQuiz.passingScore || 70;
      const passed = percentage >= passRequirement;

      const attemptPayload: QuizAttempt = {
        id: attemptDocId,
        uid,
        quizId: activeQuiz.id,
        department: activeQuiz.department || studentDepartment,
        studentName: studentName || 'Student',
        matricNumber: matricNumber || '',
        answers: selectedAnswers,
        questionScores,
        score,
        total: totalPossible,
        attempts: attemptNumber,
        bestScore,
        passed,
        percentage,
        submittedAt: now,
        updatedAt: now
      };

      // Save attempt to Firestore
      await safeSetDoc(doc(db, 'quizAttempts', attemptDocId), cleanFirestoreData(attemptPayload));

      // If passed and linked to a topic, mark the topic as completed on the student profile!
      if (passed && activeQuiz.topicId) {
        try {
          await safeUpdateDoc(doc(db, 'users', uid), {
            completedTopics: arrayUnion(activeQuiz.topicId)
          });
          onTopicCompleted?.(activeQuiz.topicId);
          setTopicAutoCompletedNotice(true);
        } catch (e) {
          console.warn('Failed to mark topic complete after passed quiz:', e);
        }
      }

      // Update local state map
      setAttemptsMap(prev => ({
        ...prev,
        [activeQuiz.id]: attemptPayload
      }));

      // Log quiz submitted activity event
      logStudentActivity({
        uid,
        name: studentName,
        department: studentDepartment,
        level: activeQuiz.level,
        type: 'quiz submitted',
        title: `Scored ${score}/${totalPossible} (${percentage}%) on ${activeQuiz.courseCode}: ${activeQuiz.title}`
      });

      // Trigger celebration confetti if passed with 50% or more
      if (percentage >= 50) {
        setShowConfetti(true);
      }

      // Update weekly leaderboard points (opt-in respected)
      try {
        await recordWeeklyQuizPoints({
          uid,
          department: activeQuiz.department || studentDepartment,
          fullName: studentName || profile?.fullName,
          earnedPoints: score,
          optIn: Boolean(profile?.showOnLeaderboard)
        });
      } catch (lbErr) {
        console.warn('Leaderboard score update notice:', lbErr);
      }

      // Evaluate badges (First Quiz, 10 Quizzes, Perfect Score)
      try {
        const totalQuizzes = Object.keys(attemptsMap).length + (attemptsMap[activeQuiz.id] ? 0 : 1);
        const unlockedBadges = await checkAndAwardBadges({
          uid,
          currentBadges: profile?.badges,
          streakCount: profile?.streakCount,
          longestStreak: profile?.longestStreak,
          totalQuizzesTaken: totalQuizzes,
          latestScorePercentage: percentage
        });
        if (unlockedBadges.length > 0) {
          setNewlyAwardedBadge(unlockedBadges[0]);
          setShowConfetti(true);
          onBadgeUnlocked?.(unlockedBadges[0]);
        }
      } catch (bErr) {
        console.warn('Badge award check notice:', bErr);
      }

      // Set review screen data with all questions shown
      setReviewAttempt(attemptPayload);
      setReviewKeys(keysDocData);
      setReviewTab('all');
      setShowSubmitModal(false);
      setSubmitError(null);
      setCurrentScreen('review');

      if (a11ySettings.accessibilityMode) {
        const resultLabel = passed ? 'Passed' : 'Not passed';
        speak(
          `Quiz submitted. ${resultLabel}. You scored ${score} out of ${totalPossible}, ${percentage} percent. Use listen controls or say read this page to hear explanations.`
        );
      }
    } catch (err: any) {
      console.error('Submit quiz failed:', err);
      setSubmitError(`Could not submit quiz: ${err?.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  // View existing results / review
  const handleViewExistingReview = async (quiz: QuizItem) => {
    setActiveQuiz(quiz);
    setActiveQuestions(quiz.questions || []);
    setLoading(true);
    try {
      const attempt = attemptsMap[quiz.id];
      if (!attempt) return;

      const keySnap = await getDoc(doc(db, 'quizKeys', quiz.id));
      const kData = keySnap.exists() ? (keySnap.data() as QuizKeyDoc) : null;

      setReviewAttempt(attempt);
      setReviewKeys(kData);
      setReviewTab('all');
      setCurrentScreen('review');
    } catch (err) {
      console.warn('Failed to load review keys:', err);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // FORMATTED EXPLANATION RENDERER (Supports bold, bullets & line breaks)
  // -------------------------------------------------------------
  const renderFormattedExplanation = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return (
      <div className="space-y-1 text-xs text-[#E6ECFA] leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-1" />;
          }

          const isBullet = trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ');
          const content = isBullet ? trimmed.replace(/^[•\-\*]\s*/, '') : line;

          // Parse **bold text** into strong tags
          const parts = content.split(/(\*\*[^*]+\*\*)/g);
          const renderedParts = parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
              return (
                <strong key={pIdx} className="font-extrabold text-[#FFC700]">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return <span key={pIdx}>{part}</span>;
          });

          if (isBullet) {
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1.5">
                <span className="text-[#FFC700] select-none text-xs leading-4 shrink-0">•</span>
                <div className="flex-1 leading-snug">{renderedParts}</div>
              </div>
            );
          }

          return (
            <div key={idx} className="leading-snug">
              {renderedParts}
            </div>
          );
        })}
      </div>
    );
  };

  // -------------------------------------------------------------
  // BOOKMARK QUESTION FOR REVISION
  // -------------------------------------------------------------
  const isQuestionBookmarked = (qId: string): boolean => {
    if (!activeQuiz) return false;
    const bookmarkId = `quiz_${activeQuiz.id}_q_${qId}`;
    if (isBookmarked) {
      return isBookmarked('quiz-question', bookmarkId);
    }
    return Boolean(localBookmarks[bookmarkId] || (bookmarks || []).some(b => b.id === bookmarkId));
  };

  const handleToggleQuestionBookmark = async (
    q: QuizQuestion,
    matchingKey: any,
    questionNumber: number
  ) => {
    if (!activeQuiz) return;
    const bookmarkId = `quiz_${activeQuiz.id}_q_${q.id}`;
    const optionsList =
      q.options && q.options.length > 0
        ? q.options
        : q.type === 'true-false'
        ? ['True', 'False']
        : [];
    let correctText = '';
    if (q.type === 'fill-gaps') {
      const answersMap = matchingKey?.gapAnswers || {};
      correctText = Object.entries(answersMap)
        .map(([k, v]) => `(${k}) ${v}`)
        .join(', ');
    } else if (q.type === 'theory-self-check') {
      correctText = q.modelAnswer || matchingKey?.modelAnswer || 'Model answer';
    } else if (q.type === 'theory-select-all') {
      const correctIndices = matchingKey?.correctOptionIndices || [];
      correctText = correctIndices.map((i: number) => optionsList[i] || `Option ${i + 1}`).join('; ');
    } else {
      const correctIdx = matchingKey?.correctOptionIndex ?? 0;
      correctText = optionsList[correctIdx] || `Option ${String.fromCharCode(65 + correctIdx)}`;
    }

    const willBookmark = !isQuestionBookmarked(q.id);
    setLocalBookmarks(prev => ({ ...prev, [bookmarkId]: willBookmark }));

    if (toggleBookmark) {
      await toggleBookmark({
        id: bookmarkId,
        type: 'quiz-question',
        title: `${activeQuiz.courseCode} Q${questionNumber}: ${q.text.slice(0, 70)}`,
        code: activeQuiz.courseCode,
        department: activeQuiz.department || studentDepartment,
        questionText: q.text,
        options: optionsList,
        correctAnswerText: correctText,
        explanation: matchingKey?.explanation || '',
        whyNotNotes: matchingKey?.whyNotNotes,
        createdAt: new Date().toISOString()
      });
    } else {
      try {
        const userDocRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const currentBookmarks = (userDoc.data().bookmarks || []) as BookmarkItem[];
          const exists = currentBookmarks.some(b => b.id === bookmarkId);
          let nextBookmarks: BookmarkItem[];
          if (exists) {
            nextBookmarks = currentBookmarks.filter(b => b.id !== bookmarkId);
          } else {
            nextBookmarks = [
              {
                id: bookmarkId,
                type: 'quiz-question',
                title: `${activeQuiz.courseCode} Q${questionNumber}: ${q.text.slice(0, 70)}`,
                code: activeQuiz.courseCode,
                department: activeQuiz.department || studentDepartment,
                questionText: q.text,
                options: optionsList,
                correctAnswerText: correctText,
                explanation: matchingKey?.explanation || '',
                whyNotNotes: matchingKey?.whyNotNotes || {},
                createdAt: new Date().toISOString()
              },
              ...currentBookmarks
            ];
          }
          await safeUpdateDoc(userDocRef, cleanFirestoreData({ bookmarks: nextBookmarks }));
        }
      } catch (bErr) {
        console.warn('Bookmark error:', bErr);
      }
    }
  };

  // Quit taking confirmation
  const handleQuitQuiz = () => {
    setShowQuitModal(true);
  };

  const confirmQuitQuiz = () => {
    setShowQuitModal(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerRunning(false);
    if (onBackToTopic && activeQuiz?.topicId) {
      onBackToTopic();
    } else {
      setActiveQuiz(null);
      setCurrentScreen('list');
    }
  };

  // Filtered quizzes for student list (topic quizzes do NOT appear on the Quizzes page)
  const filteredQuizzes = useMemo(() => {
    return quizzes.filter(q => {
      // Exclude topic-linked quizzes from main Quizzes page
      const isTopicQuiz = q.scope === 'topic' || (Boolean(q.topicId) && q.scope !== 'course' && q.scope !== 'general');
      if (isTopicQuiz) return false;

      const matchLevel = levelFilter === 'All' || q.level === levelFilter;
      const matchSem = semesterFilter === 'All' || q.semester === semesterFilter;
      const matchSearch =
        !searchQuery.trim() ||
        q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.courseCode.toLowerCase().includes(searchQuery.toLowerCase());
      return matchLevel && matchSem && matchSearch;
    });
  }, [quizzes, levelFilter, semesterFilter, searchQuery]);

  // Answered questions count
  const answeredCount = useMemo(() => {
    return activeQuestions.filter(q => isQuestionAnswered(q, selectedAnswers[q.id])).length;
  }, [activeQuestions, selectedAnswers]);

  const unansweredCount = activeQuestions.length - answeredCount;

  // Current active question
  const currentQ = activeQuestions[currentQuestionIndex];
  const currentQAnswer = currentQ ? selectedAnswers[currentQ.id] : undefined;
  const currentQIsFlagged = currentQ ? !!flaggedQuestions[currentQ.id] : false;
  const isCurrentTrueFalse = currentQ?.type === 'true-false';

  // Automatically sync activeGapNum for fill-gaps questions
  useEffect(() => {
    if (currentQ?.type === 'fill-gaps') {
      const nums = getQuestionGapNumbers(currentQ);
      const chosenMap =
        selectedAnswers[currentQ.id] &&
        typeof selectedAnswers[currentQ.id] === 'object' &&
        !Array.isArray(selectedAnswers[currentQ.id])
          ? selectedAnswers[currentQ.id]
          : {};
      const firstUnfilled = nums.find(n => !chosenMap[String(n)] && !chosenMap[n]);
      setActiveGapNum(firstUnfilled || nums[0] || 1);
    } else {
      setActiveGapNum(null);
    }
  }, [currentQuestionIndex, currentQ?.id]);

  // Attempts info for intro card
  const existingAttemptForActive = activeQuiz ? attemptsMap[activeQuiz.id] : null;
  const usedAttempts = existingAttemptForActive?.attempts || 0;
  const maxAttempts = activeQuiz?.attemptsAllowed || 0;
  const canAttempt = maxAttempts === 0 || usedAttempts < maxAttempts;

  // Build readable text for a question (for Listen button, auto-read, and voice commands)
  const buildQuestionSpeech = (
    q: QuizQuestion,
    idx: number,
    total: number,
    includeOptions: boolean = true
  ): string[] => {
    const blocks: string[] = [];
    if (q.type === 'fill-gaps') {
      const gapMap: Record<string, string> =
        selectedAnswers[q.id] && typeof selectedAnswers[q.id] === 'object' && !Array.isArray(selectedAnswers[q.id])
          ? selectedAnswers[q.id]
          : {};
      const readablePassage = (q.text || '')
        .replace(/\((\d+)\)/g, '[$1]')
        .replace(/\[(\d+)\]/g, (_, n) => {
          const filled = gapMap[n];
          return filled ? ` gap ${n}, filled with ${filled}, ` : ` gap ${n}, blank, `;
        });
      blocks.push(`Question ${idx + 1} of ${total}. Fill in the gaps. ${cleanMarkdownForSpeech(readablePassage)}`);
      if (includeOptions) {
        const bankChips = shuffledWordBankMap[q.id] || [];
        const usedIds = new Set(Object.values(gapChipIdMap[q.id] || {}));
        const unusedWords = bankChips.filter(c => !usedIds.has(c.id)).map(c => c.word);
        const curGap = activeGapNum || getQuestionGapNumbers(q)[0] || 1;
        blocks.push(
          `Active gap is gap ${curGap}. ${
            unusedWords.length > 0
              ? `Available word bank options: ${unusedWords.join(', ')}. Say pick followed by a word.`
              : 'All gaps are filled.'
          }`
        );
      }
      return blocks;
    }

    blocks.push(`Question ${idx + 1} of ${total}. ${cleanMarkdownForSpeech(q.text)}`);
    if (!includeOptions) return blocks;

    if (q.type === 'true-false') {
      blocks.push('Option A: True. Option B: False.');
    } else if (q.type === 'theory-self-check') {
      blocks.push('Think of your answer, then select show model answer to compare.');
    } else if (q.options && q.options.length > 0) {
      const displayIndices = shuffledOptionIndicesMap[q.id] || q.options.map((_, i) => i);
      const optionLines = displayIndices.map((origIdx, pos) => {
        const letter = String.fromCharCode(65 + pos);
        return `Option ${letter}: ${cleanMarkdownForSpeech(q.options[origIdx])}.`;
      });
      blocks.push(optionLines.join(' '));
    }
    return blocks;
  };

  // Auto-read active question and options when Accessibility mode is active
  useEffect(() => {
    if (!a11ySettings.accessibilityMode) return;
    if (currentScreen !== 'taking' || !currentQ) return;
    const key = `${activeQuiz?.id || ''}_${currentQ.id}_${currentQuestionIndex}`;
    if (lastAutoReadKeyRef.current === key) return;
    lastAutoReadKeyRef.current = key;
    const text = buildQuestionSpeech(currentQ, currentQuestionIndex, activeQuestions.length, true).join(' ');
    speak(text);
  }, [a11ySettings.accessibilityMode, currentScreen, currentQ?.id, currentQuestionIndex]);

  // Register contextual Voice Assistant commands for Quizzes
  useRegisterVoiceHandlers('student-quizzes', {
    startQuiz: () => {
      if (currentScreen === 'list') {
        const target = filteredQuizzes[0];
        if (!target) return 'No quizzes match the current list.';
        handleOpenIntro(target);
        return `Opening ${target.courseCode}: ${target.title}. Say start quiz again to begin.`;
      }
      if (currentScreen === 'intro' && activeQuiz) {
        if (!canAttempt) return 'You have reached the maximum allowed attempts for this quiz.';
        handleStartTakingQuiz();
        return `Starting ${activeQuiz.courseCode} quiz.`;
      }
      if (currentScreen === 'review' && activeQuiz && canAttempt) {
        handleStartTakingQuiz();
        return `Restarting ${activeQuiz.courseCode} quiz.`;
      }
      return 'A quiz is already in progress.';
    },
    readQuestion: () => {
      if (currentScreen === 'taking' && currentQ) {
        return buildQuestionSpeech(currentQ, currentQuestionIndex, activeQuestions.length, true).join(' ');
      }
      return undefined;
    },
    repeatOptions: () => {
      if (currentScreen !== 'taking' || !currentQ) return undefined;
      const blocks = buildQuestionSpeech(currentQ, currentQuestionIndex, activeQuestions.length, true);
      return blocks[1] || blocks[0];
    },
    selectOption: (idx, letter) => {
      if (currentScreen !== 'taking' || !currentQ) return undefined;
      if (isCurrentTrueFalse) {
        if (idx === 0 || idx === 1) {
          handleSelectOption(idx);
          return `Selected ${idx === 0 ? 'True' : 'False'}.`;
        }
        return 'Say option A for True or option B for False.';
      }
      if (currentQ.type === 'theory-self-check') {
        return 'This is a self check question. Tap show model answer to rate your recall.';
      }
      if (currentQ.type === 'fill-gaps') {
        return 'This is a fill in the gaps question. Say pick followed by a word from the word bank.';
      }
      const displayIndices = shuffledOptionIndicesMap[currentQ.id] || (currentQ.options || []).map((_, i) => i);
      if (idx < 0 || idx >= displayIndices.length) {
        return `Option ${letter} is not available for this question.`;
      }
      const origIdx = displayIndices[idx];
      if (currentQ.type === 'theory-select-all') {
        handleToggleSelectAllOption(origIdx);
        return `Toggled Option ${letter}: ${currentQ.options[origIdx]}.`;
      }
      handleSelectOption(origIdx);
      return `Selected Option ${letter}: ${currentQ.options[origIdx]}.`;
    },
    selectTrueFalse: (value) => {
      if (currentScreen !== 'taking' || !currentQ) return undefined;
      if (!isCurrentTrueFalse) return 'This question is not a True or False question.';
      handleSelectOption(value ? 0 : 1);
      return `Selected ${value ? 'True' : 'False'}.`;
    },
    selectWordBankWord: (spokenText, explicitGap) => {
      if (currentScreen !== 'taking' || !currentQ || currentQ.type !== 'fill-gaps') {
        return 'This command works on fill in the gaps questions.';
      }
      const chips = shuffledWordBankMap[currentQ.id] || [];
      const usedIds = new Set(Object.values(gapChipIdMap[currentQ.id] || {}));
      const available = chips.filter(c => !usedIds.has(c.id));
      const cleanSpoken = spokenText.toLowerCase().trim();
      const match =
        available.find(c => c.word.toLowerCase() === cleanSpoken) ||
        available.find(c => c.word.toLowerCase().includes(cleanSpoken) || cleanSpoken.includes(c.word.toLowerCase()));
      if (!match) {
        return `Could not find an available word matching ${spokenText}.`;
      }
      const targetGap = explicitGap || activeGapNum || getQuestionGapNumbers(currentQ)[0] || 1;
      handleFillGap(targetGap, match);
      return `Placed ${match.word} into gap ${targetGap}.`;
    },
    nextQuestion: () => {
      if (currentScreen !== 'taking') return undefined;
      if (currentQuestionIndex >= activeQuestions.length - 1) {
        return 'You are on the last question. Say submit quiz when ready.';
      }
      setCurrentQuestionIndex(prev => prev + 1);
      return `Moving to question ${currentQuestionIndex + 2}.`;
    },
    previousQuestion: () => {
      if (currentScreen !== 'taking') return undefined;
      if (currentQuestionIndex <= 0) {
        return 'You are on the first question.';
      }
      setCurrentQuestionIndex(prev => prev - 1);
      return `Moving back to question ${currentQuestionIndex}.`;
    },
    howMuchTimeIsLeft: () => {
      if (currentScreen !== 'taking') return undefined;
      if (timeLeft === null) return 'This quiz has no time limit.';
      const mins = Math.floor(timeLeft / 60);
      const secs = timeLeft % 60;
      return `${mins} ${mins === 1 ? 'minute' : 'minutes'} and ${secs} ${secs === 1 ? 'second' : 'seconds'} remaining.`;
    },
    requestSubmitQuiz: () => {
      if (currentScreen !== 'taking' || !activeQuiz) return undefined;
      return {
        confirmPrompt: `You have answered ${answeredCount} of ${activeQuestions.length} questions. Say yes to submit your quiz, or no to keep reviewing.`,
        onConfirm: () => handleSubmitQuiz(false)
      };
    },
    goBack: () => {
      if (currentScreen === 'taking') {
        setShowQuitModal(true);
        return 'Opened quit confirmation.';
      }
      if (currentScreen === 'intro' || currentScreen === 'review') {
        if (onBackToTopic && activeQuiz?.topicId) {
          onBackToTopic();
          return 'Returning to topic.';
        }
        setCurrentScreen('list');
        return 'Returning to quizzes list.';
      }
      if (onBackToHome) {
        onBackToHome();
        return 'Returning home.';
      }
      return undefined;
    },
    getPageDescription: () => {
      if (currentScreen === 'taking' && currentQ) {
        return `Taking ${activeQuiz?.courseCode} quiz, question ${currentQuestionIndex + 1} of ${activeQuestions.length}. ${answeredCount} answered.`;
      }
      if (currentScreen === 'intro' && activeQuiz) {
        return `Quiz details for ${activeQuiz.courseCode}: ${activeQuiz.title}. ${activeQuiz.questionCount} questions.`;
      }
      if (currentScreen === 'review' && reviewAttempt && activeQuiz) {
        return `Quiz results for ${activeQuiz.title}. Score ${reviewAttempt.score} out of ${reviewAttempt.total}.`;
      }
      return `Department quizzes page showing ${filteredQuizzes.length} quizzes.`;
    },
    getPageBlocks: () => {
      if (currentScreen === 'taking' && currentQ) {
        return buildQuestionSpeech(currentQ, currentQuestionIndex, activeQuestions.length, true);
      }
      if (currentScreen === 'review' && latestQuizReviewSpeechRef.current) {
        return [latestQuizReviewSpeechRef.current];
      }
      if (currentScreen === 'intro' && activeQuiz) {
        return [
          `${activeQuiz.courseCode}: ${activeQuiz.title}. ${activeQuiz.questionCount} questions. ${
            activeQuiz.instructions || ''
          }`
        ];
      }
      return filteredQuizzes.slice(0, 12).map((q, i) => `${i + 1}. ${q.courseCode}: ${q.title}, ${q.questionCount} questions.`);
    }
  });

  // ==============================================================
  // SCREEN 1: INTRO CARD BEFORE STARTING
  // ==============================================================
  if (currentScreen === 'intro' && activeQuiz) {
    const timeLimitMins = activeQuiz.timeLimit || 0;
    const passScore = activeQuiz.passingScore || 70;
    const ptsPerQ = activeQuiz.pointsPerQuestion || 1;
    const totalPoints = activeQuiz.questions?.reduce((acc, q) => {
      if (q.type === 'fill-gaps') {
        const gapCount = Math.max(q.gaps?.length || 0, 1);
        return acc + gapCount * (q.pointsPerGap || 1);
      }
      return acc + (activeQuiz.pointsPerQuestion || 1);
    }, 0) || (activeQuiz.questionCount * ptsPerQ);

    return (
      <div className="space-y-4 max-w-xl mx-auto">
        {/* Back Button */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (onBackToTopic && activeQuiz.topicId) {
                onBackToTopic();
              } else {
                setCurrentScreen('list');
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FFC700] hover:text-[#fde047] cursor-pointer group transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1.5 transition-transform duration-200 ease-out" />
            <span>{onBackToTopic && activeQuiz.topicId ? 'Back to Topic' : 'Back to Quizzes'}</span>
          </button>

          <ShareButton
            title={`${activeQuiz.courseCode}: ${activeQuiz.title}`}
            itemType="quiz"
            code={activeQuiz.courseCode}
            id={activeQuiz.id}
            textDetails={`Practice quiz: ${activeQuiz.questionCount} questions`}
            variant="compact"
          />
        </div>

        {/* Intro Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#121C36] border-2 border-[#24315A] space-y-5 shadow-lg">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/40 text-xs font-bold">
                {activeQuiz.courseCode}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#0A1224] text-[#9AA8C7] border border-[#24315A] text-[10px]">
                {activeQuiz.department} • {activeQuiz.level}
              </span>
              {activeQuiz.allowPartialCredit && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                  Partial Credit
                </span>
              )}
              {activeQuiz.shuffle && (
                <span className="px-2 py-0.5 rounded bg-[#0A1224] text-[#FFC700] border border-[#24315A] text-[10px] font-semibold">
                  Shuffled Options
                </span>
              )}
            </div>

            <h1 className="font-heading font-extrabold text-lg sm:text-xl text-[#E6ECFA]">
              {activeQuiz.title}
            </h1>

            {topicTitle && (
              <p className="text-xs text-[#60A5FA] flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Linked to Topic: {topicTitle}</span>
              </p>
            )}

            {activeQuiz.instructions && (
              <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#9AA8C7] leading-relaxed">
                <strong className="text-[#E6ECFA] block mb-1">Instructions:</strong>
                {activeQuiz.instructions}
              </div>
            )}
          </div>

          {/* Quiz Parameters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
            <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A]">
              <span className="text-[10px] text-[#9AA8C7] uppercase font-bold block">Questions</span>
              <span className="text-base font-black text-[#E6ECFA]">{activeQuiz.questionCount}</span>
            </div>

            <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A]">
              <span className="text-[10px] text-[#9AA8C7] uppercase font-bold block">Time Limit</span>
              <span className="text-base font-black text-[#FFC700]">
                {timeLimitMins > 0
                  ? (a11ySettings.extendedQuizTime || 1) > 1
                    ? `${Math.round(timeLimitMins * (a11ySettings.extendedQuizTime || 1))}m (${a11ySettings.extendedQuizTime}x)`
                    : `${timeLimitMins}m`
                  : 'Untimed'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A]">
              <span className="text-[10px] text-[#9AA8C7] uppercase font-bold block">Passing Score</span>
              <span className="text-base font-black text-emerald-400">{passScore}%</span>
            </div>

            <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A]">
              <span className="text-[10px] text-[#9AA8C7] uppercase font-bold block">Total Points</span>
              <span className="text-base font-black text-[#60A5FA]">{totalPoints} pts</span>
            </div>
          </div>

          {/* Attempt Status Banner */}
          <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="text-[11px] text-[#9AA8C7]">Attempts Allowed:</span>
              <p className="font-bold text-[#E6ECFA]">
                {maxAttempts === 0 ? 'Unlimited Attempts' : `${usedAttempts} of ${maxAttempts} used`}
              </p>
            </div>

            {existingAttemptForActive && (
              <div className="text-right">
                <span className="text-[10px] text-[#9AA8C7]">Best Score:</span>
                <p className="font-extrabold text-[#FFC700]">
                  {existingAttemptForActive.bestScore} / {existingAttemptForActive.total} ({Math.round((existingAttemptForActive.bestScore / (existingAttemptForActive.total || 1)) * 100)}%)
                </p>
              </div>
            )}
          </div>

          {/* Start Actions */}
          <div className="space-y-2 pt-2">
            {canAttempt ? (
              <button
                type="button"
                onClick={handleStartTakingQuiz}
                className="w-full min-h-[48px] py-3 rounded-xl bg-[#2F52FF] hover:bg-[#2545df] text-white font-black text-sm shadow-[0_0_20px_rgba(47,82,255,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Start Quiz Now</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs text-center font-bold">
                You have reached the maximum allowed attempts ({maxAttempts}) for this quiz.
              </div>
            )}

            {existingAttemptForActive && (
              <button
                onClick={() => handleViewExistingReview(activeQuiz)}
                className="w-full py-2.5 rounded-xl bg-[#0A1224] border border-[#24315A] hover:border-[#60A5FA] text-[#E6ECFA] text-xs font-bold transition-all cursor-pointer"
              >
                Review Previous Answers &amp; Explanations
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==============================================================
  // SCREEN 2: TAKING A QUIZ
  // ==============================================================
  if (currentScreen === 'taking' && activeQuiz && currentQ) {
    const ptsPerQ = activeQuiz.pointsPerQuestion || 1;

    return (
      <div className="space-y-4 max-w-xl mx-auto">
        {/* Top Header & Breadcrumb */}
        <div className="p-3.5 rounded-2xl bg-[#121C36] border border-[#24315A] shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handleQuitQuiz}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9AA8C7] hover:text-rose-400 cursor-pointer group transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1.5 transition-transform duration-200 ease-out" />
              <span>Quit Quiz</span>
            </button>

            {/* Countdown Timer */}
            {timeLeft !== null && (
              <div
                aria-live={timeLeft <= 60 ? 'polite' : 'off'}
                aria-label={`Time remaining: ${formatTime(timeLeft)}`}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-xs font-bold transition-all ${
                  timeLeft <= 60
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-500/70 animate-timer-pulse shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                    : 'bg-[#0A1224] text-[#FFC700] border border-[#24315A]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{formatTime(timeLeft)}</span>
                {(a11ySettings.extendedQuizTime || 1) > 1 && (
                  <span className="text-[10px] text-[#60A5FA] ml-1">({a11ySettings.extendedQuizTime}x)</span>
                )}
              </div>
            )}
          </div>

          {/* Breadcrumb Path */}
          <div className="flex items-center justify-between pt-1 border-t border-[#24315A]/60 text-xs">
            <div className="truncate pr-2">
              <span className="font-bold text-[#FFC700] mr-1.5">{activeQuiz.courseCode}</span>
              <span className="text-[#9AA8C7] truncate">{activeQuiz.title}</span>
            </div>
            <span className="text-[11px] text-[#60A5FA] font-bold shrink-0">
              {answeredCount} of {activeQuestions.length} Answered
            </span>
          </div>
        </div>

        {submitError && (
          <div role="alert" className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/60 text-xs text-rose-200 flex items-center justify-between gap-2">
            <span>{submitError}</span>
            <button type="button" onClick={() => setSubmitError(null)} aria-label="Dismiss submit error" className="p-1 text-rose-300 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Question Palette (Numbers 1..N showing Answered, Flagged, Unanswered) */}
        <div className="p-3 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#9AA8C7] font-semibold">Question Palette</span>
            <div className="flex items-center gap-2.5 text-[10px]">
              <span className="flex items-center gap-1 text-[#60A5FA]">
                <span className="w-2 h-2 rounded-full bg-[#2F52FF]" /> Answered
              </span>
              <span className="flex items-center gap-1 text-[#FFC700]">
                <span className="w-2 h-2 rounded-full bg-[#FFC700]" /> Flagged
              </span>
              <span className="flex items-center gap-1 text-[#9AA8C7]">
                <span className="w-2 h-2 rounded-full bg-[#0A1224] border border-[#24315A]" /> Blank
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
            {activeQuestions.map((q, idx) => {
              const isAnswered = isQuestionAnswered(q, selectedAnswers[q.id]);
              const isFlagged = !!flaggedQuestions[q.id];
              const isCurrent = idx === currentQuestionIndex;

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentQuestionIndex(idx)}
                  aria-label={`Question ${idx + 1}, ${isFlagged ? 'flagged' : isAnswered ? 'answered' : 'unanswered'}${isCurrent ? ', current question' : ''}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`relative min-w-[36px] min-h-[36px] px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                    isCurrent
                      ? 'ring-2 ring-[#FFC700] ring-offset-1 ring-offset-[#0A1224]'
                      : ''
                  } ${
                    isFlagged
                      ? 'bg-[#FFC700] text-[#0A1224]'
                      : isAnswered
                      ? 'bg-[#2F52FF] text-white'
                      : 'bg-[#0A1224] text-[#9AA8C7] border border-[#24315A]'
                  }`}
                >
                  <span>{idx + 1}</span>
                  {isFlagged && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Current Question Card with smooth slide and fade */}
        <div key={currentQuestionIndex} className="p-4 sm:p-5 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4 shadow-sm animate-page-enter">
          {/* Question Meta Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#24315A]/70 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-sm text-[#FFC700]">
                Question {currentQuestionIndex + 1} of {activeQuestions.length}
              </span>
              {currentQ.type === 'theory-best' && (
                <span className="px-2 py-0.5 rounded bg-[#0A1224] text-[#FFC700] border border-[#24315A] text-[10px] font-bold">
                  Pick Best Answer
                </span>
              )}
              {currentQ.type === 'theory-select-all' && (
                <span className="px-2 py-0.5 rounded bg-[#0A1224] text-[#FFC700] border border-[#24315A] text-[10px] font-bold">
                  Select All That Apply
                </span>
              )}
              {currentQ.type === 'theory-self-check' && (
                <span className="px-2 py-0.5 rounded bg-[#0A1224] text-[#FFC700] border border-[#24315A] text-[10px] font-bold">
                  Self-Check
                </span>
              )}
              {currentQ.type === 'fill-gaps' && (
                <span className="px-2 py-0.5 rounded bg-[#0A1224] text-[#60A5FA] border border-[#24315A] text-[10px] font-bold">
                  Fill in the Gaps (Tap to pick)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <ReadAloudBar
                sourceId={`quiz-q-${currentQ.id}`}
                label="Listen"
                blocks={buildQuestionSpeech(currentQ, currentQuestionIndex, activeQuestions.length, true)}
                compact
              />

              {/* Mark for Review Button */}
              <button
                type="button"
                onClick={handleToggleFlag}
                aria-pressed={currentQIsFlagged}
                className={`min-h-[40px] px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  currentQIsFlagged
                    ? 'bg-[#FFC700]/20 text-[#FFC700] border-[#FFC700]/60'
                    : 'bg-[#0A1224] text-[#9AA8C7] border-[#24315A] hover:text-[#E6ECFA]'
                }`}
              >
                <Flag className={`w-3.5 h-3.5 ${currentQIsFlagged ? 'fill-current text-[#FFC700]' : ''}`} aria-hidden="true" />
                <span>{currentQIsFlagged ? 'Flagged' : 'Mark for review'}</span>
              </button>
            </div>
          </div>

          {/* Question Text (for standard questions) */}
          {currentQ.type !== 'fill-gaps' && (
            <div className="text-sm sm:text-base font-bold text-[#E6ECFA] leading-relaxed">
              {currentQ.text}
            </div>
          )}

          {/* 0. Fill in the Gaps (Tap to Pick) - Interactive Passage with Gaps and Options Panel */}
          {currentQ.type === 'fill-gaps' ? (
            <div className="space-y-4 pt-1">
              {(() => {
                const gapNums = getQuestionGapNumbers(currentQ);
                const studentChosenMap: Record<string, string> =
                  (currentQAnswer && typeof currentQAnswer === 'object' && !Array.isArray(currentQAnswer))
                    ? currentQAnswer
                    : {};
                const currentActive = activeGapNum ?? (gapNums[0] || 1);
                const filledCount = gapNums.filter(n => Boolean(studentChosenMap[String(n)] || studentChosenMap[n])).length;
                const totalGaps = gapNums.length;
                const fillPercentage = totalGaps > 0 ? Math.round((filledCount / totalGaps) * 100) : 0;
                const cleanPassage = (currentQ.text || '').replace(/\((\d+)\)/g, '[$1]');
                const tokens = cleanPassage.split(/(\[\d+\])/g);

                return (
                  <>
                    {/* Passage with numbered gaps as small tappable boxes */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#0A1224] border border-[#24315A] text-sm sm:text-base leading-loose text-[#E6ECFA]">
                      {tokens.map((token, tIdx) => {
                        const match = token.match(/^\[(\d+)\]$/);
                        if (match) {
                          const gapNum = parseInt(match[1], 10);
                          const isSelected = gapNum === currentActive;
                          const chosenWord = studentChosenMap[String(gapNum)] || studentChosenMap[gapNum] || '';

                          return (
                            <button
                              key={tIdx}
                              type="button"
                              onClick={() => {
                                if (chosenWord) {
                                  // Tapping a filled gap clears it and frees the word!
                                  handleClearGap(gapNum);
                                } else {
                                  setActiveGapNum(gapNum);
                                }
                              }}
                              aria-pressed={isSelected}
                              aria-label={
                                chosenWord
                                  ? `Gap ${gapNum}, filled with ${chosenWord}. Tap to clear and free this word.`
                                  : `Gap ${gapNum}, empty${isSelected ? ', selected' : ''}. Tap to select.`
                              }
                              className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 mx-1 my-1 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border shadow-sm ${
                                isSelected
                                  ? 'ring-2 ring-[#FFC700] ring-offset-2 ring-offset-[#0A1224] bg-[#FFC700]/20 text-[#FFC700] border-[#FFC700] shadow-[0_0_15px_rgba(255,199,0,0.35)]'
                                  : chosenWord
                                  ? 'bg-[#121C36] text-[#60A5FA] border-[#2F52FF] hover:border-rose-400 hover:text-rose-300'
                                  : 'bg-[#121C36]/80 text-[#9AA8C7] border-[#24315A] hover:border-[#FFC700]'
                              }`}
                              title={chosenWord ? `Filled with "${chosenWord}". Tap to clear and free this word.` : `Tap to select Gap (${gapNum})`}
                            >
                              <span className="text-[10px] sm:text-xs font-mono opacity-80">({gapNum})</span>
                              <span className={chosenWord ? 'text-[#E6ECFA] font-extrabold' : 'text-[#60A5FA] tracking-widest'}>
                                {chosenWord || '____'}
                              </span>
                              {chosenWord && (
                                <span aria-hidden="true" className="text-[10px] text-rose-400/80 hover:text-rose-300 font-bold ml-0.5">✕</span>
                              )}
                            </button>
                          );
                        }
                        return <span key={tIdx}>{token}</span>;
                      })}
                    </div>

                    {/* Progress Bar & Counter Directly Under Passage */}
                    <div className="p-3.5 rounded-2xl bg-[#0A1224] border border-[#24315A] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#9AA8C7] font-semibold">
                          <strong className="text-[#FFC700]">{filledCount} of {totalGaps} gaps filled</strong>
                        </span>
                        <span className="font-mono text-xs font-bold text-[#60A5FA]">
                          {fillPercentage}%
                        </span>
                      </div>
                      <div className="w-full bg-[#121C36] h-2 rounded-full overflow-hidden border border-[#24315A]">
                        <div
                          className="h-full bg-gradient-to-r from-[#2F52FF] to-[#FFC700] transition-all duration-300 ease-out"
                          style={{ width: `${fillPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Horizontal Shared Word Bank Panel Directly Under Passage */}
                    <div className="p-4 rounded-2xl bg-[#0A1224] border border-[#24315A] space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#24315A]/80 pb-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#FFC700]">Word Bank</span>
                            <span className="text-[11px] font-mono text-[#9AA8C7]">
                              ({totalGaps - filledCount} remaining)
                            </span>
                          </div>
                          <span className="text-[11px] text-[#9AA8C7] block">
                            {filledCount === totalGaps
                              ? 'All gaps filled! Tap any filled gap above to clear it and change answers before submitting.'
                              : `Gap (${currentActive}) selected. Tap an available word below to place it.`}
                          </span>
                        </div>

                        {(studentChosenMap[String(currentActive)] || studentChosenMap[currentActive]) && (
                          <button
                            type="button"
                            onClick={() => handleClearGap(currentActive)}
                            className="px-2.5 py-1 rounded-lg bg-[#121C36] hover:bg-rose-950/60 border border-[#24315A] hover:border-rose-500/60 text-rose-400 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            <span>Clear Gap ({currentActive})</span>
                          </button>
                        )}
                      </div>

                      {/* Horizontal chips side by side in rows that wrap */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {(() => {
                          const bankChips: Array<{ id: string; word: string }> =
                            shuffledWordBankMap[currentQ.id] ||
                            (currentQ.wordBank || []).map((w, idx) => ({ id: `${currentQ.id}_c${idx}`, word: w }));
                          const usedChipIds = new Set(Object.values(gapChipIdMap[currentQ.id] || {}));

                          return bankChips.map((chip, wIdx) => {
                            const isUsed = usedChipIds.has(chip.id);

                            return (
                              <button
                                key={chip.id || wIdx}
                                type="button"
                                disabled={isUsed}
                                aria-label={
                                  isUsed
                                    ? `${chip.word}, already placed in a gap`
                                    : `Place ${chip.word} in Gap ${currentActive}`
                                }
                                onClick={() => {
                                  if (!isUsed && currentActive) {
                                    handleFillGap(currentActive, chip);
                                  }
                                }}
                                className={`inline-flex items-center justify-center min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                                  isUsed
                                    ? 'bg-[#0A1224]/70 text-[#9AA8C7]/30 border-[#24315A]/40 line-through opacity-35 cursor-not-allowed select-none'
                                    : 'bg-[#121C36] border-[#2F52FF]/60 hover:border-[#FFC700] hover:bg-[#2F52FF]/20 text-[#E6ECFA] cursor-pointer shadow-sm active:scale-95'
                                }`}
                                title={
                                  isUsed
                                    ? `"${chip.word}" is already placed. Tap the filled gap above to free it.`
                                    : `Tap to place "${chip.word}" in Gap (${currentActive})`
                                }
                              >
                                <span>{chip.word}</span>
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : currentQ.type === 'theory-self-check' ? (
            <div className="space-y-3 pt-1">
              {!revealedModelAnswers[currentQ.id] ? (
                <div className="p-4 rounded-xl bg-[#0A1224] border border-[#24315A] text-center space-y-2.5">
                  <p className="text-xs text-[#9AA8C7]">
                    Formulate your answer in your mind first, then tap below to view the model answer.
                  </p>
                  <button
                    type="button"
                    onClick={() => setRevealedModelAnswers(prev => ({ ...prev, [currentQ.id]: true }))}
                    className="px-4 py-2.5 rounded-xl bg-[#2F52FF] hover:bg-[#4364FF] text-white text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 shadow-sm"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Show model answer</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-[#0A1224] border border-[#FFC700]/50 space-y-1.5">
                    <span className="text-[10px] font-bold text-[#FFC700] uppercase tracking-wider block">
                      Model Answer:
                    </span>
                    <p className="text-xs text-[#E6ECFA] leading-relaxed whitespace-pre-line">
                      {currentQ.modelAnswer || 'Refer to the syllabus guidelines.'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold text-[#9AA8C7] block">
                      How did your answer compare? (Cannot be changed after tapping):
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        disabled={Boolean(currentQAnswer)}
                        onClick={() => handleRateSelfCheck('knew')}
                        className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                          currentQAnswer === 'knew'
                            ? 'bg-[#2F52FF] text-white border-white shadow-[0_0_15px_rgba(47,82,255,0.4)] ring-2 ring-white'
                            : currentQAnswer
                            ? 'bg-[#0A1224] border-[#24315A] text-[#9AA8C7] opacity-40 cursor-not-allowed'
                            : 'bg-[#0A1224] border-[#24315A] text-[#E6ECFA] hover:border-[#2F52FF] cursor-pointer'
                        }`}
                      >
                        <div className="text-xs font-extrabold">I knew it</div>
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(currentQAnswer)}
                        onClick={() => handleRateSelfCheck('partly')}
                        className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                          currentQAnswer === 'partly'
                            ? 'bg-[#2F52FF] text-white border-white shadow-[0_0_15px_rgba(47,82,255,0.4)] ring-2 ring-white'
                            : currentQAnswer
                            ? 'bg-[#0A1224] border-[#24315A] text-[#9AA8C7] opacity-40 cursor-not-allowed'
                            : 'bg-[#0A1224] border-[#24315A] text-[#E6ECFA] hover:border-[#2F52FF] cursor-pointer'
                        }`}
                      >
                        <div className="text-xs font-extrabold">Partly</div>
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(currentQAnswer)}
                        onClick={() => handleRateSelfCheck('not-yet')}
                        className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                          currentQAnswer === 'not-yet'
                            ? 'bg-[#2F52FF] text-white border-white shadow-[0_0_15px_rgba(47,82,255,0.4)] ring-2 ring-white'
                            : currentQAnswer
                            ? 'bg-[#0A1224] border-[#24315A] text-[#9AA8C7] opacity-40 cursor-not-allowed'
                            : 'bg-[#0A1224] border-[#24315A] text-[#E6ECFA] hover:border-[#2F52FF] cursor-pointer'
                        }`}
                      >
                        <div className="text-xs font-extrabold">Not yet</div>
                      </button>
                    </div>

                    {Boolean(currentQAnswer) && (
                      <p className="text-[10px] text-center text-[#60A5FA] font-semibold">
                        ✓ Response recorded. It cannot be changed.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : currentQ.type === 'theory-best' ? (
            /* 2. Theory (Pick the best answer) - Large cards with radio circle, NO letters A, B, C, D (options can be shuffled) */
            <div className="space-y-2.5 pt-1">
              {(() => {
                const displayIndices =
                  shuffledOptionIndicesMap[currentQ.id] ||
                  (currentQ.options || []).map((_, i) => i);

                return displayIndices.map(origIdx => {
                  const optText = currentQ.options[origIdx];
                  const isSelected = currentQAnswer === origIdx;

                  return (
                    <button
                      key={origIdx}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => handleSelectOption(origIdx)}
                      className={`w-full min-h-[48px] p-4 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3.5 ${
                        isSelected
                          ? 'bg-[#2F52FF] text-white border-white shadow-[0_0_15px_rgba(47,82,255,0.35)]'
                          : 'bg-[#0A1224] text-[#E6ECFA] border-[#24315A] hover:border-[#2F52FF]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'border-white bg-[#2F52FF]'
                            : 'border-[#24315A] bg-[#121C36]'
                        }`}
                      >
                        {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold leading-relaxed flex-1">
                        {optText}
                      </span>
                    </button>
                  );
                });
              })()}
            </div>
          ) : currentQ.type === 'theory-select-all' ? (
            /* 3. Theory (Select all that apply) - Checkbox cards */
            <div className="space-y-2 pt-1">
              <span className="text-[11px] text-[#9AA8C7] block">
                Select all statements that apply (one or more may be correct):
              </span>
              {(() => {
                const displayIndices =
                  shuffledOptionIndicesMap[currentQ.id] ||
                  (currentQ.options || []).map((_, i) => i);

                return displayIndices.map(origIdx => {
                  const optText = currentQ.options[origIdx];
                  const isChecked = Array.isArray(currentQAnswer) && currentQAnswer.includes(origIdx);

                  return (
                    <button
                      key={origIdx}
                      type="button"
                      aria-pressed={isChecked}
                      onClick={() => handleToggleSelectAllOption(origIdx)}
                      className={`w-full min-h-[48px] p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                        isChecked
                          ? 'bg-[#2F52FF] text-white border-white shadow-[0_0_15px_rgba(47,82,255,0.35)]'
                          : 'bg-[#0A1224] text-[#E6ECFA] border-[#24315A] hover:border-[#2F52FF]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? 'border-white bg-white text-[#2F52FF]'
                            : 'border-[#24315A] bg-[#121C36]'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 text-[#2F52FF] stroke-[3]" />}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold leading-relaxed flex-1">
                        {optText}
                      </span>
                    </button>
                  );
                });
              })()}
            </div>
          ) : isCurrentTrueFalse ? (
            /* 4. True / False Two Big Buttons */
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                aria-pressed={currentQAnswer === 0}
                onClick={() => handleSelectOption(0)}
                className={`min-h-[56px] py-4 rounded-xl text-center font-heading font-extrabold text-base transition-all cursor-pointer border-2 ${
                  currentQAnswer === 0
                    ? 'bg-[#2F52FF] text-white border-white shadow-[0_0_20px_rgba(47,82,255,0.5)] scale-[1.02]'
                    : 'bg-[#0A1224] text-[#E6ECFA] border-[#24315A] hover:border-[#2F52FF]'
                }`}
              >
                True
              </button>

              <button
                type="button"
                aria-pressed={currentQAnswer === 1}
                onClick={() => handleSelectOption(1)}
                className={`min-h-[56px] py-4 rounded-xl text-center font-heading font-extrabold text-base transition-all cursor-pointer border-2 ${
                  currentQAnswer === 1
                    ? 'bg-[#2F52FF] text-white border-white shadow-[0_0_20px_rgba(47,82,255,0.5)] scale-[1.02]'
                    : 'bg-[#0A1224] text-[#E6ECFA] border-[#24315A] hover:border-[#2F52FF]'
                }`}
              >
                False
              </button>
            </div>
          ) : (
            /* 5. Standard Multiple Choice Options List */
            <div className="space-y-2.5 pt-1">
              {(() => {
                const displayIndices =
                  shuffledOptionIndicesMap[currentQ.id] ||
                  (currentQ.options || []).map((_, i) => i);

                return displayIndices.map((origIdx, pos) => {
                  const optText = currentQ.options[origIdx];
                  const isSelected = currentQAnswer === origIdx;
                  const letter = String.fromCharCode(65 + pos);

                  return (
                    <button
                      key={origIdx}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => handleSelectOption(origIdx)}
                      className={`w-full min-h-[48px] p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                        isSelected
                          ? 'bg-[#2F52FF] text-white border-white shadow-[0_0_15px_rgba(47,82,255,0.35)]'
                          : 'bg-[#0A1224] text-[#E6ECFA] border-[#24315A] hover:border-[#2F52FF]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-white text-[#2F52FF] border-white'
                            : 'bg-[#121C36] text-[#FFC700] border-[#24315A]'
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold leading-relaxed flex-1">{optText}</span>
                    </button>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* Navigation & Submit Bar */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
            className="min-h-[48px] px-4 py-2 rounded-xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] text-xs font-bold text-[#E6ECFA] disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            <span>Previous</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="min-h-[48px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-xs shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer transition-all"
          >
            Submit Quiz
          </button>

          <button
            type="button"
            onClick={() => setCurrentQuestionIndex(prev => Math.min(activeQuestions.length - 1, prev + 1))}
            disabled={currentQuestionIndex === activeQuestions.length - 1}
            className="min-h-[48px] px-4 py-2 rounded-xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] text-xs font-bold text-[#E6ECFA] disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Submit Confirmation Dialog */}
        {showSubmitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/85 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="submit-quiz-dialog-title"
              className="relative w-full max-w-sm bg-[#121C36] border-2 border-[#24315A] rounded-2xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#24315A] pb-3">
                <h3 id="submit-quiz-dialog-title" className="font-heading font-extrabold text-sm text-[#E6ECFA]">
                  Ready to submit?
                </h3>
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  aria-label="Close submit confirmation dialog"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[#9AA8C7] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs text-[#E6ECFA]">
                <p>
                  You have answered <strong className="text-emerald-400">{answeredCount}</strong> out of{' '}
                  <strong>{activeQuestions.length}</strong> questions.
                </p>

                {unansweredCount > 0 && (
                  <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" aria-hidden="true" />
                    <span>
                      You have <strong>{unansweredCount}</strong> unanswered questions. Unanswered questions will receive 0 points.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#24315A]">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="min-h-[48px] px-3.5 py-2 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#9AA8C7] hover:text-[#E6ECFA] cursor-pointer"
                >
                  Review Questions
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmitQuiz(false)}
                  className="min-h-[48px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submitting ? 'Submitting...' : 'Yes, Submit Now'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quit Quiz Confirmation Dialog (Accessible replacement for window.confirm) */}
        {showQuitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/85 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="quit-quiz-dialog-title"
              className="relative w-full max-w-sm bg-[#121C36] border-2 border-[#24315A] rounded-2xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#24315A] pb-3">
                <h3 id="quit-quiz-dialog-title" className="font-heading font-extrabold text-sm text-[#E6ECFA]">
                  Quit quiz?
                </h3>
                <button
                  type="button"
                  onClick={() => setShowQuitModal(false)}
                  aria-label="Cancel and stay in quiz"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[#9AA8C7] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-[#E6ECFA] leading-relaxed">
                Your answers for this attempt will not be saved if you leave now.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#24315A]">
                <button
                  type="button"
                  onClick={() => setShowQuitModal(false)}
                  className="min-h-[48px] px-4 py-2 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs font-bold text-[#E6ECFA] cursor-pointer"
                >
                  Continue Quiz
                </button>
                <button
                  type="button"
                  onClick={confirmQuitQuiz}
                  className="min-h-[48px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
                >
                  Quit Attempt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==============================================================
  // SCREEN 3: RESULT & REVIEW SCREEN
  // ==============================================================
  if (currentScreen === 'review' && activeQuiz && reviewAttempt) {
    const keys = reviewKeys?.keys || [];
    const passingThreshold = activeQuiz.passingScore || 70;
    const studentScore = reviewAttempt.score;
    const studentTotal = reviewAttempt.total || 1;
    const studentPct = Math.round((studentScore / studentTotal) * 100);
    const hasPassed = studentPct >= passingThreshold;

    // Filter into Missed, Correct, and All lists
    const missedQuestions: { q: QuizQuestion; originalIndex: number }[] = [];
    const correctQuestions: { q: QuizQuestion; originalIndex: number }[] = [];
    const ptsPerQ = activeQuiz.pointsPerQuestion || 1;

    const allQuestionsWithIndex = activeQuestions.map((q, idx) => {
      const matchingKey = keys.find(k => k.questionId === q.id);
      const earned = reviewAttempt.questionScores?.[q.id];
      let isFullyCorrect = false;

      if (q.type === 'fill-gaps') {
        const ptsPerGap = q.pointsPerGap || matchingKey?.pointsPerGap || 1;
        const totalGapsCount = Math.max(
          q.gaps?.length || 0,
          Object.keys(matchingKey?.gapAnswers || {}).length,
          1
        );
        const maxPossibleForQ = totalGapsCount * ptsPerGap;
        isFullyCorrect = earned !== undefined && earned >= maxPossibleForQ;
      } else if (earned !== undefined) {
        isFullyCorrect = earned >= ptsPerQ;
      } else {
        if (q.type === 'theory-self-check') {
          isFullyCorrect = reviewAttempt.answers[q.id] === 'knew';
        } else if (q.type === 'theory-select-all') {
          const chosenArr: number[] = Array.isArray(reviewAttempt.answers[q.id]) ? reviewAttempt.answers[q.id] : [];
          const correctArr = matchingKey?.correctOptionIndices || [];
          isFullyCorrect =
            chosenArr.length === correctArr.length &&
            chosenArr.every(i => correctArr.includes(i));
        } else {
          const correctIdx = matchingKey?.correctOptionIndex ?? -1;
          const chosenIdx = reviewAttempt.answers[q.id];
          isFullyCorrect = chosenIdx !== undefined && chosenIdx !== -1 && chosenIdx === correctIdx;
        }
      }

      if (isFullyCorrect) {
        correctQuestions.push({ q, originalIndex: idx });
      } else {
        missedQuestions.push({ q, originalIndex: idx });
      }
      return { q, originalIndex: idx };
    });

    const activeDisplayList =
      reviewTab === 'missed'
        ? missedQuestions
        : reviewTab === 'correct'
        ? correctQuestions
        : allQuestionsWithIndex;

    const reviewBlocks: string[] = [
      `${activeQuiz.courseCode} ${activeQuiz.title} results. ${hasPassed ? 'Passed' : 'Not passed'}. Score ${studentScore} out of ${studentTotal}, ${studentPct} percent.`,
      ...activeDisplayList.map(({ q, originalIndex }) => {
        const matchingKey = keys.find(k => k.questionId === q.id);
        const earned = reviewAttempt.questionScores?.[q.id] ?? 0;
        const exp = matchingKey?.explanation ? ` Explanation: ${cleanMarkdownForSpeech(matchingKey.explanation)}` : '';
        return `Question ${originalIndex + 1}: ${cleanMarkdownForSpeech(q.text)}. Points earned: ${earned}.${exp}`;
      })
    ];
    latestQuizReviewSpeechRef.current = reviewBlocks.join(' ');

    return (
      <div className="space-y-4 max-w-xl mx-auto animate-page-enter">
        {/* Celebration Confetti when passing (>=50%) */}
        {showConfetti && !a11ySettings.reduceMotion && (
          <ConfettiEffect onComplete={() => setShowConfetti(false)} />
        )}

        {/* Badge Unlocked Popup Modal */}
        {newlyAwardedBadge && (
          <BadgeUnlockedModal
            badge={newlyAwardedBadge}
            onClose={() => setNewlyAwardedBadge(null)}
          />
        )}

        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (onBackToTopic && activeQuiz.topicId) {
                onBackToTopic();
              } else {
                setCurrentScreen('list');
              }
            }}
            className="min-h-[44px] inline-flex items-center gap-1.5 text-xs font-bold text-[#FFC700] hover:text-[#fde047] cursor-pointer group transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1.5 transition-transform duration-200 ease-out" />
            <span>{onBackToTopic && activeQuiz.topicId ? 'Back to Topic' : 'Back to Quizzes'}</span>
          </button>

          <ShareButton
            title={`I scored ${studentScore}/${studentTotal} (${studentPct}%) on ${activeQuiz.courseCode}: ${activeQuiz.title}!`}
            itemType="quiz"
            code={activeQuiz.courseCode}
            id={activeQuiz.id}
            textDetails={`Scored ${studentScore}/${studentTotal} on SOT Quiz Portal`}
            variant="compact"
          />
        </div>

        {/* Auto-completed Topic Banner */}
        {topicAutoCompletedNotice && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/60 text-emerald-300 text-xs font-bold flex items-center justify-between gap-2 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Great job! Topic syllabus progress has been marked as complete!</span>
            </span>
            {onBackToTopic && (
              <button
                type="button"
                onClick={onBackToTopic}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shrink-0 cursor-pointer"
              >
                Resume Topic
              </button>
            )}
          </div>
        )}

        {/* Auto-submit Notice */}
        {wasAutoSubmitted && (
          <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Time ran out! Your quiz answers were automatically submitted.</span>
          </div>
        )}

        {/* Result Score Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#121C36] border-2 border-[#24315A] space-y-4 shadow-xl text-center">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#9AA8C7] uppercase tracking-wider">
              {activeQuiz.courseCode} • Quiz Result
            </span>
            <h2 className="font-heading font-extrabold text-lg text-[#E6ECFA]">
              {activeQuiz.title}
            </h2>
          </div>

          <div className="flex justify-center">
            <ReadAloudBar
              sourceId="quiz-review-summary"
              label="Listen to results & explanations"
              blocks={reviewBlocks}
              showParagraphNav
            />
          </div>

          {/* Pass / Fail Badge & Big Score */}
          <div className="py-2 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border">
              {hasPassed ? (
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Passed ({studentPct}% &ge; {passingThreshold}%)</span>
                </span>
              ) : (
                <span className="bg-rose-500/20 text-rose-400 border border-rose-500/50 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" />
                  <span>Failed ({studentPct}% &lt; {passingThreshold}% Required)</span>
                </span>
              )}
            </div>

            <div className="text-3xl sm:text-4xl font-heading font-black text-[#FFC700]">
              {studentScore} <span className="text-lg font-bold text-[#9AA8C7]">/ {studentTotal}</span>
            </div>

            <p className="text-xs text-[#9AA8C7]">
              {studentPct}% final score • Attempt #{reviewAttempt.attempts || 1} • Best score: {reviewAttempt.bestScore}/{studentTotal}
            </p>
          </div>

          <WhatsAppScoreShare
            percentage={studentPct}
            courseCode={activeQuiz.courseCode}
            examLabel="Quiz"
            className="text-left max-w-lg mx-auto"
          />

          {/* Retake & Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2 border-t border-[#24315A]/70">
            {canAttempt ? (
              <button
                type="button"
                onClick={handleStartTakingQuiz}
                className="min-h-[48px] px-4 py-2 rounded-xl bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  Retake Quiz
                  {maxAttempts > 0 && ` (${maxAttempts - usedAttempts} attempt${maxAttempts - usedAttempts === 1 ? '' : 's'} left)`}
                </span>
              </button>
            ) : (
              <div className="px-3.5 py-1.5 rounded-xl bg-[#0A1224] border border-[#24315A] text-[11px] font-semibold text-[#9AA8C7] flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>No attempts left (Maximum {maxAttempts} reached)</span>
              </div>
            )}

            {onBackToTopic && activeQuiz.topicId && (
              <button
                type="button"
                onClick={onBackToTopic}
                className="min-h-[48px] px-4 py-2 rounded-xl bg-[#0A1224] border border-[#24315A] hover:border-[#FFC700] text-[#E6ECFA] text-xs font-bold transition-all cursor-pointer"
              >
                Back to Lesson Topic
              </button>
            )}
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* REVIEW SECTION WITH TABS: Missed (First), Correct, All      */}
        {/* ----------------------------------------------------------- */}
        <div className="space-y-3">
          {/* Tabs Selector Bar */}
          <div className="p-1 rounded-xl bg-[#0A1224] border border-[#24315A] grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => setReviewTab('missed')}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                reviewTab === 'missed'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
              }`}
            >
              <span>Missed</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  reviewTab === 'missed' ? 'bg-white/20 text-white' : 'bg-[#121C36] text-rose-400'
                }`}
              >
                {missedQuestions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setReviewTab('correct')}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                reviewTab === 'correct'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
              }`}
            >
              <span>Correct</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  reviewTab === 'correct' ? 'bg-white/20 text-white' : 'bg-[#121C36] text-emerald-400'
                }`}
              >
                {correctQuestions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setReviewTab('all')}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                reviewTab === 'all'
                  ? 'bg-[#2F52FF] text-white shadow-sm'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
              }`}
            >
              <span>All</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  reviewTab === 'all' ? 'bg-white/20 text-white' : 'bg-[#121C36] text-[#E6ECFA]'
                }`}
              >
                {activeQuestions.length}
              </span>
            </button>
          </div>

          {/* Empty State for Selected Tab */}
          {activeDisplayList.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] text-center space-y-3">
              {reviewTab === 'missed' ? (
                <>
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h4 className="font-heading font-extrabold text-sm text-[#E6ECFA]">
                    🎉 Perfect score on this attempt!
                  </h4>
                  <p className="text-xs text-[#9AA8C7] max-w-sm mx-auto">
                    You didn't miss any questions. Switch to the <strong>Correct</strong> or <strong>All</strong> tab to review your answers.
                  </p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setReviewTab('all')}
                      className="px-4 py-2 rounded-xl bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold transition-all cursor-pointer shadow-md"
                    >
                      View All Questions
                    </button>
                  </div>
                </>
              ) : reviewTab === 'correct' ? (
                <>
                  <XCircle className="w-10 h-10 text-rose-400 mx-auto" />
                  <h4 className="font-heading font-extrabold text-sm text-[#E6ECFA]">
                    No correct answers yet
                  </h4>
                  <p className="text-xs text-[#9AA8C7] max-w-sm mx-auto">
                    Review the <strong>Missed</strong> questions tab to learn the key concepts and try retaking!
                  </p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setReviewTab('missed')}
                      className="px-4 py-2 rounded-xl bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold transition-all cursor-pointer shadow-md"
                    >
                      Review Missed Questions
                    </button>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={FileQuestion}
                  title="No Questions Available"
                  description="This quiz doesn't contain any questions to review."
                  actionLabel="Back to Quizzes"
                  onAction={() => setCurrentScreen('list')}
                />
              )}
            </div>
          ) : (
            /* Questions Review List */
            <div className="space-y-3.5">
              {activeDisplayList.map(({ q, originalIndex }) => {
                const matchingKey = keys.find(k => k.questionId === q.id);
                const ptsPerQ = activeQuiz.pointsPerQuestion || 1;
                const earned = reviewAttempt.questionScores?.[q.id] ?? 0;
                const whyNotNotes = matchingKey?.whyNotNotes || {};
                const bookmarked = isQuestionBookmarked(q.id);

                const isTrueFalse = q.type === 'true-false';
                const isTheoryBest = q.type === 'theory-best';
                const isSelectAll = q.type === 'theory-select-all';
                const isSelfCheck = q.type === 'theory-self-check';
                const isFillGaps = q.type === 'fill-gaps';

                const maxPtsForQ = isFillGaps
                  ? Math.max(q.gaps?.length || 0, Object.keys(matchingKey?.gapAnswers || {}).length, 1) * (q.pointsPerGap || matchingKey?.pointsPerGap || 1)
                  : ptsPerQ;

                const chosen = reviewAttempt.answers[q.id];
                const isFullyCorrect = earned >= maxPtsForQ;
                const isPartial = earned > 0 && earned < maxPtsForQ;

                let isUnanswered = false;
                if (isFillGaps) {
                  isUnanswered =
                    !chosen ||
                    typeof chosen !== 'object' ||
                    Array.isArray(chosen) ||
                    Object.values(chosen).filter(v => Boolean(v && String(v).trim())).length === 0;
                } else if (isSelectAll) {
                  isUnanswered = !Array.isArray(chosen) || chosen.length === 0;
                } else if (isSelfCheck) {
                  isUnanswered = !chosen;
                } else {
                  isUnanswered = chosen === undefined || chosen === -1;
                }

                const optionsList =
                  q.options && q.options.length > 0
                    ? q.options
                    : isTrueFalse
                    ? ['True', 'False']
                    : [];

                return (
                  <div
                    key={q.id}
                    className={`p-4 rounded-2xl border space-y-3 transition-all ${
                      isFullyCorrect
                        ? 'bg-[#121C36] border-emerald-500/40 shadow-sm'
                        : isPartial
                        ? 'bg-[#121C36] border-[#FFC700]/50 shadow-sm'
                        : isUnanswered
                        ? 'bg-[#121C36] border-amber-500/30'
                        : 'bg-[#121C36] border-rose-500/40 shadow-sm'
                    }`}
                  >
                    {/* Header: Question Number, Result Badge & Bookmark */}
                    <div className="flex items-center justify-between gap-2 border-b border-[#24315A] pb-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-heading font-extrabold text-[#FFC700] text-sm">
                          Question {originalIndex + 1}
                        </span>

                        <span className="px-2 py-0.5 rounded bg-[#0A1224] text-[#60A5FA] border border-[#24315A] text-[10px] font-bold">
                          {isFillGaps
                            ? 'Fill in the Gaps'
                            : isTheoryBest
                            ? 'Theory (Best Answer)'
                            : isSelectAll
                            ? 'Theory (Select All)'
                            : isSelfCheck
                            ? 'Theory (Self-Check)'
                            : isTrueFalse
                            ? 'True / False'
                            : 'Multiple Choice'}
                        </span>

                        {isFullyCorrect ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center gap-1 border border-emerald-500/30">
                            <Check className="w-3 h-3" /> Correct [{earned}/{maxPtsForQ} pts]
                          </span>
                        ) : isPartial ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] flex items-center gap-1 border border-amber-500/40">
                            Partial Credit [{earned}/{maxPtsForQ} pts]
                          </span>
                        ) : isUnanswered ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px] flex items-center gap-1 border border-amber-500/30">
                            Unanswered [0/{maxPtsForQ} pts]
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold text-[10px] flex items-center gap-1 border border-rose-500/30">
                            <X className="w-3 h-3" /> Incorrect [0/{maxPtsForQ} pts]
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <ReadAloudBar
                          sourceId={`quiz-review-q-${q.id}`}
                          label="Listen"
                          blocks={[
                            `Question ${originalIndex + 1}. ${q.text}`,
                            matchingKey?.explanation ? `Explanation: ${matchingKey.explanation}` : '',
                          ].filter(Boolean)}
                          compact
                        />

                        {/* Bookmark Button to Save for Revision */}
                        <button
                          type="button"
                          onClick={() => handleToggleQuestionBookmark(q, matchingKey, originalIndex + 1)}
                          aria-pressed={bookmarked}
                          aria-label={bookmarked ? `Remove Question ${originalIndex + 1} from revision bookmarks` : `Bookmark Question ${originalIndex + 1} for revision`}
                          title={bookmarked ? 'Remove from revision bookmarks' : 'Bookmark question for revision'}
                          className={`min-h-[36px] px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                            bookmarked
                              ? 'bg-[#FFC700]/15 border-[#FFC700] text-[#FFC700]'
                              : 'bg-[#0A1224] border-[#24315A] text-[#9AA8C7] hover:text-[#E6ECFA] hover:border-[#2F52FF]'
                          }`}
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? 'fill-current text-[#FFC700]' : ''}`} aria-hidden="true" />
                          <span className="text-[10px] hidden sm:inline">
                            {bookmarked ? 'Bookmarked' : 'Bookmark'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Question Prompt Text (for non-gap questions) */}
                    {!isFillGaps && (
                      <p className="text-xs sm:text-sm font-bold text-[#E6ECFA] leading-snug">
                        {q.text}
                      </p>
                    )}

                    {/* 0. FILL IN THE GAPS (REVIEW PASSAGE WITH EMBEDDED COLOR-CODED PILLS) */}
                    {isFillGaps && (() => {
                      const gapAnswers = matchingKey?.gapAnswers || {};
                      const studentAnswers: Record<string, string> =
                        chosen && typeof chosen === 'object' && !Array.isArray(chosen) ? chosen : {};
                      const passage = (q.text || '').replace(/\((\d+)\)/g, '[$1]');
                      const tokens = passage.split(/(\[\d+\])/g);
                      const gapNums = getQuestionGapNumbers(q);

                      let correctCount = 0;
                      gapNums.forEach(n => {
                        const sAns = studentAnswers[String(n)] || studentAnswers[n];
                        const cAns = gapAnswers[String(n)] || gapAnswers[n];
                        if (sAns && cAns && String(sAns).trim().toLowerCase() === String(cAns).trim().toLowerCase()) {
                          correctCount++;
                        }
                      });

                      return (
                        <div className="space-y-3 pt-1">
                          {/* Full passage with every gap filled in, green for correct and red for wrong with correct answer beside it */}
                          <div className="p-4 sm:p-5 rounded-2xl bg-[#0A1224] border border-[#24315A] text-sm sm:text-base leading-loose text-[#E6ECFA]">
                            {tokens.map((token, tIdx) => {
                              const match = token.match(/^\[(\d+)\]$/);
                              if (match) {
                                const gapNum = parseInt(match[1], 10);
                                const studentWord = studentAnswers[String(gapNum)] || studentAnswers[gapNum];
                                const correctWord = gapAnswers[String(gapNum)] || gapAnswers[gapNum] || '—';
                                const isGapCorrect =
                                  studentWord &&
                                  correctWord &&
                                  String(studentWord).trim().toLowerCase() === String(correctWord).trim().toLowerCase();

                                if (isGapCorrect) {
                                  return (
                                    <span
                                      key={tIdx}
                                      className="inline-flex items-center gap-1.5 px-3 py-1 mx-1 my-1 rounded-xl bg-emerald-950/80 border border-emerald-500/80 text-emerald-300 font-bold text-xs sm:text-sm shadow-sm"
                                    >
                                      <span className="text-[10px] sm:text-xs font-mono text-emerald-400/80">({gapNum})</span>
                                      <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                                      <span>{studentWord}</span>
                                    </span>
                                  );
                                }

                                return (
                                  <span
                                    key={tIdx}
                                    className="inline-flex items-center flex-wrap gap-1.5 px-3 py-1 mx-1 my-1 rounded-xl bg-rose-950/80 border border-rose-500/80 text-rose-300 font-bold text-xs sm:text-sm shadow-sm"
                                  >
                                    <span className="text-[10px] sm:text-xs font-mono text-rose-400/80">({gapNum})</span>
                                    {studentWord ? (
                                      <>
                                        <X className="w-3.5 h-3.5 text-rose-400 stroke-[3]" />
                                        <span className="line-through text-rose-300/80">{studentWord}</span>
                                        <span className="text-[#9AA8C7] font-semibold text-xs mx-0.5">Ans:</span>
                                        <span className="text-emerald-400 font-extrabold">{correctWord}</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="italic text-rose-300/80">(blank)</span>
                                        <span className="text-[#9AA8C7] font-semibold text-xs mx-0.5">Ans:</span>
                                        <span className="text-emerald-400 font-extrabold">{correctWord}</span>
                                      </>
                                    )}
                                  </span>
                                );
                              }
                              return <span key={tIdx}>{token}</span>;
                            })}
                          </div>

                          {/* Gap Score Breakdown Summary */}
                          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs">
                            <span className="text-[#9AA8C7]">
                              Gap Breakdown: <strong className="text-[#FFC700]">{correctCount} of {gapNums.length}</strong> gaps correct
                            </span>
                            <span className="font-mono text-emerald-400 font-bold">
                              {earned} / {gapNums.length} pts (1 pt/gap)
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 1. THEORY (PICK THE BEST ANSWER) - NO LETTERS A-D */}
                    {isTheoryBest && (() => {
                      const correctIdx = matchingKey?.correctOptionIndex ?? 0;
                      const chosenIdx = typeof chosen === 'number' ? chosen : -1;

                      return (
                        <div className="space-y-2 pt-1">
                          <span className="text-[10px] uppercase font-bold text-[#9AA8C7] tracking-wider block">
                            Options Review:
                          </span>
                          {optionsList.map((opt, oIdx) => {
                            const isChosen = chosenIdx === oIdx;
                            const isRight = correctIdx === oIdx;

                            return (
                              <div
                                key={oIdx}
                                className={`p-3 rounded-xl border text-xs flex items-center gap-3 transition-colors ${
                                  isRight
                                    ? 'bg-emerald-950/60 border-emerald-500/70 text-emerald-200'
                                    : isChosen
                                    ? 'bg-rose-950/60 border-rose-500/70 text-rose-200'
                                    : 'bg-[#0A1224] border-[#24315A] text-[#9AA8C7]'
                                }`}
                              >
                                <span
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                    isRight
                                      ? 'border-emerald-400 bg-emerald-500 text-white'
                                      : isChosen
                                      ? 'border-rose-400 bg-rose-500 text-white'
                                      : 'border-[#24315A] bg-[#121C36]'
                                  }`}
                                >
                                  {isRight ? (
                                    <Check className="w-3 h-3 text-white stroke-[3]" />
                                  ) : isChosen ? (
                                    <X className="w-3 h-3 text-white stroke-[3]" />
                                  ) : null}
                                </span>

                                <span className={`flex-1 leading-relaxed ${isChosen && !isRight ? 'line-through text-rose-300' : ''}`}>
                                  {opt}
                                </span>

                                {isRight && (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 shrink-0">
                                    {isChosen ? 'Your choice (Correct) ✓' : 'Correct answer ✓'}
                                  </span>
                                )}

                                {isChosen && !isRight && (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold border border-rose-500/30 shrink-0">
                                    Your answer ✗
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* 2. THEORY (SELECT ALL THAT APPLY) - CHECKBOX CARDS */}
                    {isSelectAll && (() => {
                      const correctIndices = matchingKey?.correctOptionIndices || [];
                      const chosenIndices: number[] = Array.isArray(chosen) ? chosen : [];

                      return (
                        <div className="space-y-2 pt-1">
                          <span className="text-[10px] uppercase font-bold text-[#9AA8C7] tracking-wider block">
                            Statements Review:
                          </span>
                          {optionsList.map((opt, oIdx) => {
                            const isChosen = chosenIndices.includes(oIdx);
                            const isRight = correctIndices.includes(oIdx);

                            return (
                              <div
                                key={oIdx}
                                className={`p-3 rounded-xl border text-xs flex items-center gap-3 transition-colors ${
                                  isRight && isChosen
                                    ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-200'
                                    : isRight && !isChosen
                                    ? 'bg-emerald-950/20 border-dashed border-emerald-500/60 text-emerald-300'
                                    : !isRight && isChosen
                                    ? 'bg-rose-950/60 border-rose-500/80 text-rose-200'
                                    : 'bg-[#0A1224] border-[#24315A] text-[#9AA8C7]'
                                }`}
                              >
                                <span
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                                    isRight && isChosen
                                      ? 'border-emerald-400 bg-emerald-500 text-white'
                                      : isRight && !isChosen
                                      ? 'border-emerald-400 bg-transparent text-emerald-400'
                                      : !isRight && isChosen
                                      ? 'border-rose-400 bg-rose-500 text-white'
                                      : 'border-[#24315A] bg-[#121C36]'
                                  }`}
                                >
                                  {isRight && isChosen ? (
                                    <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                  ) : isRight && !isChosen ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2]" />
                                  ) : !isRight && isChosen ? (
                                    <X className="w-3.5 h-3.5 text-white stroke-[3]" />
                                  ) : null}
                                </span>

                                <span className={`flex-1 leading-relaxed ${!isRight && isChosen ? 'line-through text-rose-300' : ''}`}>
                                  {opt}
                                </span>

                                {isRight && isChosen && (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 shrink-0">
                                    Your choice (Correct) ✓
                                  </span>
                                )}

                                {isRight && !isChosen && (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30 shrink-0">
                                    Correct (Not picked)
                                  </span>
                                )}

                                {!isRight && isChosen && (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold border border-rose-500/30 shrink-0">
                                    Your choice (Incorrect) ✗
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* 3. THEORY (SELF-CHECK) - MODEL ANSWER AND RATING BADGE */}
                    {isSelfCheck && (() => {
                      const modelText = q.modelAnswer || matchingKey?.modelAnswer || '';
                      return (
                        <div className="space-y-2.5 pt-1">
                          {/* Student Rating Banner */}
                          <div
                            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                              chosen === 'knew'
                                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                                : chosen === 'partly'
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                                : chosen === 'not-yet'
                                ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                                : 'bg-[#0A1224] border-[#24315A] text-[#9AA8C7]'
                            }`}
                          >
                            <span className="text-[11px] uppercase font-bold">Your Self-Evaluation:</span>
                            <span className="font-extrabold text-xs">
                              {chosen === 'knew'
                                ? 'I knew it (Full marks) ✓'
                                : chosen === 'partly'
                                ? 'Partly (Half marks) ⚠️'
                                : chosen === 'not-yet'
                                ? 'Not yet (0 marks) ✗'
                                : 'Not evaluated'}
                            </span>
                          </div>

                          {/* Model Answer Box */}
                          <div className="p-3.5 rounded-xl bg-[#0A1224] border border-[#FFC700]/50 space-y-1.5">
                            <span className="text-[10px] font-bold text-[#FFC700] uppercase tracking-wider flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-[#FFC700]" />
                              <span>Model Answer:</span>
                            </span>
                            <p className="text-xs text-[#E6ECFA] leading-relaxed whitespace-pre-line">
                              {modelText || 'Refer to the syllabus notes.'}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 4. MULTIPLE CHOICE & TRUE/FALSE - COMPARISON CARDS */}
                    {!isFillGaps && !isTheoryBest && !isSelectAll && !isSelfCheck && (() => {
                      const correctIdx = matchingKey?.correctOptionIndex ?? -1;
                      const chosenIdx = typeof chosen === 'number' ? chosen : -1;
                      const chosenOptionText =
                        !isUnanswered && chosenIdx >= 0 && chosenIdx < optionsList.length
                          ? optionsList[chosenIdx]
                          : null;
                      const correctOptionText =
                        correctIdx >= 0 && correctIdx < optionsList.length
                          ? optionsList[correctIdx]
                          : 'Option ' + String.fromCharCode(65 + Math.max(0, correctIdx));

                      return (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                            {/* Your Answer */}
                            <div
                              className={`p-3 rounded-xl border text-xs space-y-1 ${
                                isFullyCorrect
                                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                                  : isUnanswered
                                  ? 'bg-[#0A1224] border-[#24315A] text-[#9AA8C7]'
                                  : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                              }`}
                            >
                              <span
                                className={`text-[10px] uppercase font-bold tracking-wider block ${
                                  isFullyCorrect
                                    ? 'text-emerald-400'
                                    : isUnanswered
                                    ? 'text-[#9AA8C7]'
                                    : 'text-rose-400'
                                }`}
                              >
                                Your answer
                              </span>
                              {isUnanswered ? (
                                <span className="font-medium text-[#9AA8C7] italic">Not answered</span>
                              ) : (
                                <div className="font-bold flex items-center gap-1.5">
                                  {!isTrueFalse && chosenIdx >= 0 && (
                                    <span className="font-mono text-xs">{String.fromCharCode(65 + chosenIdx)})</span>
                                  )}
                                  <span className={!isFullyCorrect ? 'line-through text-rose-300' : 'text-emerald-200'}>
                                    {chosenOptionText}
                                  </span>
                                  {isFullyCorrect ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto shrink-0" />
                                  ) : (
                                    <X className="w-3.5 h-3.5 text-rose-400 ml-auto shrink-0" />
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Correct Answer */}
                            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/60 text-xs space-y-1 text-emerald-200">
                              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">
                                Correct answer
                              </span>
                              <div className="font-bold flex items-center gap-1.5">
                                {!isTrueFalse && correctIdx >= 0 && (
                                  <span className="font-mono text-xs">{String.fromCharCode(65 + correctIdx)})</span>
                                )}
                                <span>{correctOptionText}</span>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto shrink-0" />
                              </div>
                            </div>
                          </div>

                          {/* Options Overview on error */}
                          {!isTrueFalse && !isFullyCorrect && (
                            <div className="p-2.5 rounded-xl bg-[#0A1224]/80 border border-[#24315A] text-[11px] text-[#9AA8C7] space-y-1.5">
                              <span className="font-semibold text-[#E6ECFA] block">Options Overview:</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {optionsList.map((opt, oIdx) => {
                                  const isChosen = chosenIdx === oIdx;
                                  const isRight = correctIdx === oIdx;
                                  return (
                                    <div
                                      key={oIdx}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] flex items-center justify-between gap-1.5 border ${
                                        isRight
                                          ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200 font-bold'
                                          : isChosen
                                          ? 'bg-rose-950/70 border-rose-500/60 text-rose-200 line-through'
                                          : 'bg-[#121C36] border-[#24315A] text-[#9AA8C7]'
                                      }`}
                                    >
                                      <span>{String.fromCharCode(65 + oIdx)}) {opt}</span>
                                      {isRight && <span className="text-emerald-400 text-[10px] font-bold">✓ Correct</span>}
                                      {isChosen && !isRight && <span className="text-rose-400 text-[10px] font-bold">✗ Your choice</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* 'Why this is the answer' Box with Creator's Explanation */}
                    <div className="p-3.5 rounded-xl bg-[#0A1224] border border-[#FFC700]/30 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#FFC700]">
                        <BookOpen className="w-3.5 h-3.5 text-[#FFC700]" />
                        <span>Why this is the answer:</span>
                      </div>
                      {matchingKey?.explanation && matchingKey.explanation.trim() ? (
                        renderFormattedExplanation(matchingKey.explanation.trim())
                      ) : (
                        <p className="text-xs text-[#9AA8C7] italic">
                          No explanation was written by the quiz creator for this question.
                        </p>
                      )}
                    </div>

                    {/* WRONG OPTION NOTES: 'Why not B' style notes written by the creator */}
                    {Object.keys(whyNotNotes).length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-[#9AA8C7] uppercase tracking-wider block">
                          Notes on options:
                        </span>
                        <div className="space-y-1.5">
                          {Object.entries(whyNotNotes).map(([optKey, note]) => {
                            const upperKey = optKey.toUpperCase().trim();
                            const letterCode = upperKey.charCodeAt(0) - 65;
                            let labelTitle = `Why not ${optKey}`;
                            if (upperKey.length === 1 && letterCode >= 0 && letterCode < optionsList.length) {
                              const snippet = optionsList[letterCode].length > 55 ? optionsList[letterCode].slice(0, 52) + '...' : optionsList[letterCode];
                              labelTitle = `Why not ${upperKey} ("${snippet}")`;
                            } else {
                              const num = parseInt(upperKey, 10);
                              if (!isNaN(num) && num >= 1 && num <= optionsList.length) {
                                const snippet = optionsList[num - 1].length > 55 ? optionsList[num - 1].slice(0, 52) + '...' : optionsList[num - 1];
                                labelTitle = `Why not Option ${num} ("${snippet}")`;
                              }
                            }

                            return (
                              <div
                                key={optKey}
                                className="p-2.5 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs space-y-1"
                              >
                                <span className="font-bold text-[#60A5FA] block">{labelTitle}:</span>
                                <div className="text-[#9AA8C7]">
                                  {renderFormattedExplanation(note)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==============================================================
  // SCREEN 4: STUDENT QUIZZES LIST & DIRECTORY
  // ==============================================================
  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#FFC700]/40 flex items-center justify-center text-[#FFC700]">
            <FileQuestion className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-[#E6ECFA]">
              Department Quizzes
            </h2>
            <p className="text-xs text-[#9AA8C7]">
              Practice tests and timed knowledge checks for {studentDepartment}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchData}
          aria-label="Refresh quizzes"
          title="Refresh quizzes"
          className="self-end sm:self-auto min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-xl bg-[#0A1224] border border-[#24315A] text-[#9AA8C7] hover:text-[#E6ECFA] transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#FFC700]' : ''}`} aria-hidden="true" />
        </button>
      </div>

      {/* Filter Row: Level dropdown, Semester switcher, Search input */}
      <div className="p-3.5 rounded-2xl bg-[#121C36] border border-[#24315A] shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Semester Switcher */}
          <div role="group" aria-label="Filter quizzes by semester" className="flex items-center p-0.5 rounded-lg bg-[#0A1224] border border-[#24315A]">
            {(['All', 'First Semester', 'Second Semester'] as const).map(sem => (
              <button
                key={sem}
                type="button"
                aria-pressed={semesterFilter === sem}
                onClick={() => setSemesterFilter(sem)}
                className={`flex-1 sm:flex-initial min-h-[36px] px-3 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  semesterFilter === sem
                    ? 'bg-[#2F52FF] text-white shadow-sm'
                    : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                }`}
              >
                {sem === 'All' ? 'All' : sem === 'First Semester' ? '1st Sem' : '2nd Sem'}
              </button>
            ))}
          </div>

          {/* Level Dropdown */}
          <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
            <label htmlFor="quizLevelFilter" className="text-[#9AA8C7] text-[11px] font-semibold">Level:</label>
            <select
              id="quizLevelFilter"
              value={levelFilter}
              onChange={e => setLevelFilter(e.target.value)}
              className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs font-bold text-[#FFC700] focus:outline-none focus:border-[#2F52FF] cursor-pointer"
            >
              {ACADEMIC_LEVELS.map(lvl => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            aria-label="Search quizzes by title or course code"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search quizzes by title or course code..."
            className="w-full pl-8 pr-9 py-2.5 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/60 focus:outline-none focus:border-[#2F52FF]"
          />
          <Search className="w-3.5 h-3.5 text-[#9AA8C7] absolute left-2.5 top-3" aria-hidden="true" />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear quiz search"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center text-[#9AA8C7] hover:text-[#E6ECFA] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Quizzes List */}
      {loading ? (
        <QuizListSkeleton count={4} />
      ) : filteredQuizzes.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="No Quizzes Available"
          description={
            searchQuery || semesterFilter !== 'All' || levelFilter !== 'All'
              ? 'No quizzes matched your search query or semester filters.'
              : `Practice tests published by ${studentDepartment} lecturers and reps will appear here.`
          }
          actionLabel={
            searchQuery || semesterFilter !== 'All' || levelFilter !== 'All'
              ? 'Reset Filters'
              : onBackToHome
              ? 'Back to Home'
              : undefined
          }
          onAction={() => {
            if (searchQuery || semesterFilter !== 'All' || levelFilter !== 'All') {
              setSearchQuery('');
              setSemesterFilter('All');
              setLevelFilter('All');
            } else if (onBackToHome) {
              onBackToHome();
            }
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredQuizzes.map(quiz => {
            const attempt = attemptsMap[quiz.id];
            const hasTaken = Boolean(attempt);
            const timeLimitMins = quiz.timeLimit || 0;
            const passRequirement = quiz.passingScore || 70;

            return (
              <div
                key={quiz.id}
                className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] transition-all flex flex-col justify-between space-y-3.5 shadow-sm group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-black text-sm text-[#FFC700]">
                      {quiz.courseCode}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-[#0A1224] border border-[#24315A] text-[10px] text-[#9AA8C7]">
                        {quiz.level}
                      </span>
                      <ShareButton
                        title={`${quiz.courseCode}: ${quiz.title}`}
                        itemType="quiz"
                        code={quiz.courseCode}
                        id={quiz.id}
                        textDetails={`Practice quiz: ${quiz.questionCount} questions`}
                        variant="icon"
                      />
                    </div>
                  </div>

                  <h3 className="font-heading font-bold text-sm text-[#E6ECFA] group-hover:text-white transition-colors line-clamp-2">
                    {quiz.title}
                  </h3>

                  {quiz.instructions && (
                    <p className="text-xs text-[#9AA8C7] line-clamp-1">
                      {quiz.instructions}
                    </p>
                  )}
                </div>

                {/* Metadata & Actions */}
                <div className="pt-2 border-t border-[#24315A]/60 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-[#9AA8C7]">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px]">
                        <FileQuestion className="w-3.5 h-3.5 text-[#2F52FF]" />
                        <span>{quiz.questionCount} Qs</span>
                      </span>
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-[#FFC700]" />
                        <span>{timeLimitMins > 0 ? `${timeLimitMins}m` : 'Untimed'}</span>
                      </span>
                    </div>

                    {/* Best score pill */}
                    {hasTaken ? (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        (attempt.bestScore / (attempt.total || 1)) >= (passRequirement / 100)
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        Best: {attempt.bestScore}/{attempt.total}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#9AA8C7]/70 italic">
                        Not taken
                      </span>
                    )}
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenIntro(quiz)}
                      className="flex-1 py-2 rounded-xl bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold transition-all cursor-pointer text-center shadow-sm"
                    >
                      {hasTaken ? 'Take Again' : 'Start Quiz'}
                    </button>

                    {hasTaken && (
                      <button
                        onClick={() => handleViewExistingReview(quiz)}
                        className="px-3 py-2 rounded-xl bg-[#0A1224] border border-[#24315A] hover:border-[#60A5FA] text-xs font-semibold text-[#E6ECFA] transition-colors cursor-pointer"
                        title="View previous answers and explanations"
                      >
                        Review
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
