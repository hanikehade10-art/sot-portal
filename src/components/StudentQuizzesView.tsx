/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
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
  Filter,
  RefreshCw,
  Award,
  RotateCcw,
  BookOpen,
  Check,
  X,
  HelpCircle,
  Lightbulb,
  CheckSquare
} from 'lucide-react';

interface StudentQuizzesViewProps {
  studentDepartment: string;
  studentLevel?: string;
  studentName?: string;
  matricNumber?: string;
  uid: string;
  onBackToHome?: () => void;
}

const ACADEMIC_LEVELS = ['All', 'ND1', 'ND2', 'HND1', 'HND2'] as const;

export const StudentQuizzesView: React.FC<StudentQuizzesViewProps> = ({
  studentDepartment,
  studentLevel = 'ND1',
  studentName,
  matricNumber,
  uid,
  onBackToHome
}) => {
  // Navigation Screens: 'list' | 'taking' | 'review'
  const [currentScreen, setCurrentScreen] = useState<'list' | 'taking' | 'review'>('list');

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
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [wasAutoSubmitted, setWasAutoSubmitted] = useState(false);

  // Review screen states
  const [reviewKeys, setReviewKeys] = useState<QuizKeyDoc | null>(null);
  const [reviewAttempt, setReviewAttempt] = useState<QuizAttempt | null>(null);
  const [wrongOnly, setWrongOnly] = useState(false);

  // Timer interval reference
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
    } catch (err: any) {
      console.error('Failed to load student quizzes:', err);
      setError(err?.message || 'Failed to load quizzes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [studentDepartment, uid]);

  // Handle Starting a Quiz (fetches fresh quiz doc so new attempts immediately use updated time limits or settings)
  const handleStartQuiz = async (quiz: QuizItem) => {
    let targetQuiz = quiz;
    try {
      const snap = await getDoc(doc(db, 'quizzes', quiz.id));
      if (snap.exists()) {
        targetQuiz = { id: snap.id, ...snap.data() } as QuizItem;
        // Update local quiz list so card displays the freshest time limit
        setQuizzes(prev => prev.map(q => q.id === targetQuiz.id ? targetQuiz : q));
      }
    } catch (err) {
      console.warn('Could not re-fetch latest quiz settings:', err);
    }

    setActiveQuiz(targetQuiz);
    setWasAutoSubmitted(false);

    // Shuffle questions if quiz.shuffle is enabled
    let qList = [...(targetQuiz.questions || [])];
    if (targetQuiz.shuffle) {
      qList = qList.sort(() => Math.random() - 0.5);
    }
    setActiveQuestions(qList);

    setCurrentQuestionIndex(0);
    // Initialize answers with -1 (unanswered)
    const initAnswers: Record<string, number> = {};
    qList.forEach(q => {
      initAnswers[q.id] = -1;
    });
    setSelectedAnswers(initAnswers);

    // Setup timer using fresh timeLimit (whole number from 1 to 180 minutes)
    const minutes = (targetQuiz.timeLimit && Number(targetQuiz.timeLimit) > 0)
      ? Math.min(180, Math.max(1, Math.round(Number(targetQuiz.timeLimit))))
      : 0;

    if (minutes > 0) {
      setTimeLeft(minutes * 60);
      setTimerRunning(true);
    } else {
      setTimeLeft(null);
      setTimerRunning(false);
    }

    setShowSubmitModal(false);
    setCurrentScreen('taking');
  };

  // Timer countdown hook: ticks down every second while timerRunning is true
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

  // Clean trigger for auto-submit when countdown timer reaches zero
  useEffect(() => {
    if (timerRunning && timeLeft !== null && timeLeft <= 0) {
      setTimerRunning(false);
      handleSubmitQuiz(true);
    }
  }, [timeLeft, timerRunning]);

  // Format Timer String (supports hours if >= 60 minutes)
  const formatTime = (totalSeconds: number): string => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Select option for current question
  const handleSelectOption = (optionIndex: number) => {
    if (!activeQuestions[currentQuestionIndex]) return;
    const qId = activeQuestions[currentQuestionIndex].id;
    setSelectedAnswers(prev => ({
      ...prev,
      [qId]: optionIndex
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

      // 1. First record student attempt document with answers
      const existingAttempt = attemptsMap[activeQuiz.id];
      const attemptNumber = (existingAttempt?.attempts || 0) + 1;

      // 2. Read Quiz Keys doc to score the student's submission
      let score = 0;
      let keysDocData: QuizKeyDoc | null = null;
      try {
        const keySnap = await getDoc(doc(db, 'quizKeys', activeQuiz.id));
        if (keySnap.exists()) {
          keysDocData = keySnap.data() as QuizKeyDoc;
          const keyItems = keysDocData.keys || [];

          activeQuestions.forEach(q => {
            const chosen = selectedAnswers[q.id];
            const matchingKey = keyItems.find(k => k.questionId === q.id);
            if (matchingKey && chosen !== undefined && chosen === matchingKey.correctOptionIndex) {
              score += 1;
            }
          });
        }
      } catch (keyErr) {
        console.warn('Could not read answer keys during submit:', keyErr);
      }

      const total = activeQuestions.length;
      const bestScore = Math.max(existingAttempt?.bestScore || 0, score);

      const attemptPayload: QuizAttempt = {
        id: attemptDocId,
        uid,
        quizId: activeQuiz.id,
        department: activeQuiz.department || studentDepartment,
        studentName: studentName || 'Student',
        matricNumber: matricNumber || '',
        answers: selectedAnswers,
        score,
        total,
        attempts: attemptNumber,
        bestScore,
        submittedAt: now,
        updatedAt: now
      };

      // 3. Save attempt to Firestore
      await setDoc(doc(db, 'quizAttempts', attemptDocId), attemptPayload);

      // Update local state map
      setAttemptsMap(prev => ({
        ...prev,
        [activeQuiz.id]: attemptPayload
      }));

      // Set review screen data
      setReviewAttempt(attemptPayload);
      setReviewKeys(keysDocData);
      setWrongOnly(false);
      setShowSubmitModal(false);
      setCurrentScreen('review');
    } catch (err: any) {
      console.error('Submit quiz failed:', err);
      alert(`Could not submit quiz: ${err?.message || err}`);
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
      setWrongOnly(false);
      setCurrentScreen('review');
    } catch (err) {
      console.warn('Failed to load review keys:', err);
    } finally {
      setLoading(false);
    }
  };

  // Quit taking confirmation
  const handleQuitQuiz = () => {
    if (confirm('Quit quiz? Your answers will not be saved.')) {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimerRunning(false);
      setActiveQuiz(null);
      setCurrentScreen('list');
    }
  };

  // Filtered quizzes for student list
  const filteredQuizzes = useMemo(() => {
    return quizzes.filter(q => {
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
    return Object.values(selectedAnswers).filter(val => val !== undefined && val >= 0).length;
  }, [selectedAnswers]);

  const unansweredCount = (activeQuestions.length || 0) - answeredCount;

  // =========================================================================
  // SCREEN 1: TAKING QUIZ
  // =========================================================================
  if (currentScreen === 'taking' && activeQuiz) {
    const currentQuestion = activeQuestions[currentQuestionIndex];
    const progressPct = Math.round(((currentQuestionIndex + 1) / activeQuestions.length) * 100);
    const isLastQuestion = currentQuestionIndex === activeQuestions.length - 1;
    const currentSelectedOption = currentQuestion ? selectedAnswers[currentQuestion.id] : -1;

    return (
      <div className="space-y-4 pt-1">
        {/* Sticky Top Header with Back Arrow and Timer */}
        <div className="p-3.5 rounded-2xl bg-[#121C36] border border-[#24315A] shadow-md flex items-center justify-between gap-3 sticky top-14 z-20">
          <button
            type="button"
            onClick={handleQuitQuiz}
            className="flex items-center gap-1 text-xs font-bold text-[#9AA8C7] hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#2F52FF]" />
            <span>Exit</span>
          </button>

          <div className="text-center truncate px-2">
            <span className="font-heading font-extrabold text-xs text-[#FFC700] block">
              {activeQuiz.courseCode}
            </span>
            <span className="text-[11px] text-[#E6ECFA] font-bold truncate block max-w-[200px] sm:max-w-xs">
              {activeQuiz.title}
            </span>
          </div>

          {/* Countdown Timer (if timeLimit > 0) */}
          {timeLeft !== null ? (
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono text-xs font-bold shadow-inner ${
                timeLeft < 60
                  ? 'bg-rose-950/60 text-rose-400 border border-rose-600 animate-pulse'
                  : timeLeft < 300
                  ? 'bg-amber-950/40 text-amber-400 border border-amber-600'
                  : 'bg-[#0A1224] text-[#FFC700] border border-[#24315A]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTime(timeLeft)}</span>
            </div>
          ) : (
            <span className="text-[10px] text-[#9AA8C7] font-semibold">Untimed</span>
          )}
        </div>

        {/* Progress Bar & Counter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#9AA8C7]">
            <span className="text-[#E6ECFA]">
              Question {currentQuestionIndex + 1} of {activeQuestions.length}
            </span>
            <span>{answeredCount} answered</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#121C36] border border-[#24315A] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#2F52FF] to-[#5271FF] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* QUESTION CARD */}
        {currentQuestion && (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#121C36] border border-[#24315A] shadow-md space-y-4">
            <h3 className="font-heading font-bold text-sm sm:text-base text-[#E6ECFA] leading-snug">
              {currentQuestion.text}
            </h3>

            {/* Options List */}
            {/* CRITICAL RULE: "Do NOT show right or wrong or any score during the quiz." */}
            <div className="space-y-2.5">
              {currentQuestion.options.map((optionText, optIdx) => {
                const isSelected = currentSelectedOption === optIdx;
                const letter = String.fromCharCode(65 + optIdx);

                return (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => handleSelectOption(optIdx)}
                    className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#2F52FF]/15 border-[#2F52FF] shadow-[0_0_15px_rgba(47,82,255,0.25)] text-white'
                        : 'bg-[#0A1224] border-[#24315A] hover:border-[#2F52FF]/50 text-[#E6ECFA]'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-[#2F52FF] text-white shadow-sm'
                          : 'bg-[#121C36] text-[#9AA8C7] border border-[#24315A]'
                      }`}
                    >
                      {letter}
                    </div>
                    <span className="text-xs sm:text-sm font-medium flex-1">
                      {optionText}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Navigation Buttons */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
            className="px-4 py-2 rounded-xl bg-[#121C36] hover:bg-[#1A2E63] disabled:opacity-30 disabled:hover:bg-[#121C36] border border-[#24315A] text-xs font-bold text-[#E6ECFA] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          {isLastQuestion ? (
            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className="px-5 py-2 rounded-xl bg-[#FFC700] hover:bg-[#FFE066] text-[#0A1224] font-heading font-extrabold text-xs shadow-[0_0_15px_rgba(255,199,0,0.3)] transition-all cursor-pointer"
            >
              Submit Quiz
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentQuestionIndex(prev => Math.min(activeQuestions.length - 1, prev + 1))}
              className="px-5 py-2 rounded-xl bg-[#2F52FF] hover:bg-[#4364FF] text-white font-heading font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* QUESTION NAVIGATOR GRID */}
        <div className="p-3.5 rounded-2xl bg-[#121C36] border border-[#24315A] shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[11px] text-[#9AA8C7]">
            <span className="font-bold text-[#FFC700]">Question Navigator</span>
            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className="text-xs font-bold text-[#60A5FA] hover:text-white"
            >
              Finish &amp; Submit &rarr;
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {activeQuestions.map((q, idx) => {
              const isCurrent = currentQuestionIndex === idx;
              const isAnswered = selectedAnswers[q.id] !== undefined && selectedAnswers[q.id] >= 0;

              return (
                <button
                  key={q.id || idx}
                  type="button"
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                    isCurrent
                      ? 'border-2 border-[#FFC700] text-[#FFC700] bg-[#0A1224] scale-105 shadow-sm'
                      : isAnswered
                      ? 'bg-[#2F52FF] text-white shadow-sm'
                      : 'bg-[#0A1224] text-[#9AA8C7] border border-[#24315A] hover:border-[#60A5FA]'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 text-[10px] text-[#9AA8C7] pt-1">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-[#2F52FF]" /> Answered
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded border border-[#FFC700]" /> Current
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-[#0A1224] border border-[#24315A]" /> Unanswered
            </span>
          </div>
        </div>

        {/* SUBMIT CONFIRMATION MODAL */}
        {showSubmitModal && (
          <div className="fixed inset-0 z-50 bg-[#0A1224]/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121C36] border border-[#24315A] rounded-2xl w-full max-w-sm p-4 space-y-3.5 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#FFC700]/50 flex items-center justify-center text-[#FFC700]">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-sm text-[#E6ECFA]">
                    Submit Quiz?
                  </h4>
                  <p className="text-[11px] text-[#9AA8C7]">
                    Finalize and calculate your test score
                  </p>
                </div>
              </div>

              {unansweredCount > 0 ? (
                <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-600/50 text-amber-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}!</span>
                    <p className="text-[11px] text-amber-200/80 mt-0.5">
                      Unanswered questions will be marked incorrect. Are you sure you want to proceed?
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA]">
                  You have answered all <strong>{activeQuestions.length}</strong> questions! Ready to see your score?
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowSubmitModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-[#0A1224] hover:bg-[#1A2E63] text-xs font-semibold text-[#E6ECFA] transition-colors cursor-pointer"
                >
                  Keep Reviewing
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmitQuiz(false)}
                  className="px-4 py-1.5 rounded-xl bg-[#2F52FF] hover:bg-[#4364FF] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{submitting ? 'Submitting...' : 'Yes, Submit Now'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // SCREEN 2: POST-QUIZ RESULTS & QUESTION REVIEW
  // =========================================================================
  if (currentScreen === 'review' && activeQuiz && reviewAttempt) {
    const totalQ = reviewAttempt.total || activeQuestions.length || 1;
    const score = reviewAttempt.score;
    const pct = Math.round((score / totalQ) * 100);
    const isPassed = pct >= 50;

    const keyItems = reviewKeys?.keys || [];

    // Filter questions if "wrong only" is checked
    const questionsToReview = activeQuestions.filter(q => {
      if (!wrongOnly) return true;
      const chosen = reviewAttempt.answers[q.id];
      const matchKey = keyItems.find(k => k.questionId === q.id);
      return !matchKey || chosen !== matchKey.correctOptionIndex;
    });

    return (
      <div className="space-y-4 pt-1">
        {/* Header with Back Arrow */}
        <div className="p-3.5 rounded-2xl bg-[#121C36] border border-[#24315A] shadow-sm flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setCurrentScreen('list')}
            className="flex items-center gap-1.5 text-xs font-bold text-[#2F52FF] hover:text-[#5271FF] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#2F52FF]" />
            <span className="text-[#E6ECFA]">Back to Quizzes</span>
          </button>

          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
            {activeQuiz.courseCode}
          </span>
        </div>

        {/* HERO SCORE CARD */}
        <div className="p-5 rounded-2xl bg-[#121C36] border border-[#24315A] shadow-lg text-center space-y-3 relative overflow-hidden">
          {wasAutoSubmitted && (
            <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 text-[#FFC700] shrink-0" />
              <span>Time expired! Your quiz was automatically submitted.</span>
            </div>
          )}

          <div className="w-12 h-12 rounded-2xl bg-[#0A1224] border border-[#FFC700]/50 flex items-center justify-center text-[#FFC700] mx-auto shadow-[0_0_15px_rgba(255,199,0,0.2)]">
            <Award className="w-6 h-6" />
          </div>

          <div>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#E6ECFA]">
              {score} / {totalQ}
            </h2>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-extrabold ${
                  pct >= 70
                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/50'
                    : pct >= 50
                    ? 'bg-amber-950/60 text-amber-400 border border-amber-500/50'
                    : 'bg-rose-950/60 text-rose-400 border border-rose-500/50'
                }`}
              >
                {pct}% — {pct >= 70 ? 'Excellent!' : pct >= 50 ? 'Good Effort!' : 'Keep Practicing!'}
              </span>
            </div>
            <p className="text-xs text-[#9AA8C7] mt-1.5 max-w-sm mx-auto">
              Attempt #{reviewAttempt.attempts || 1} &bull; Best Score: {reviewAttempt.bestScore || score}/{totalQ}
            </p>
          </div>

          {/* Action Buttons: Retake vs Back */}
          <div className="flex items-center justify-center gap-2.5 pt-2 border-t border-[#24315A]/60">
            <button
              type="button"
              onClick={() => handleStartQuiz(activeQuiz)}
              className="px-4 py-2 rounded-xl bg-[#2F52FF] hover:bg-[#4364FF] text-white font-heading font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retake Quiz</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentScreen('list')}
              className="px-4 py-2 rounded-xl bg-[#0A1224] hover:bg-[#1A2E63] border border-[#24315A] text-xs font-bold text-[#E6ECFA] transition-colors cursor-pointer"
            >
              Quizzes List
            </button>
          </div>
        </div>

        {/* REVIEW FILTER BAR */}
        <div className="p-3 rounded-2xl bg-[#121C36] border border-[#24315A] flex items-center justify-between">
          <span className="font-heading font-bold text-xs text-[#E6ECFA]">
            Answers &amp; Explanations ({questionsToReview.length} questions)
          </span>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={wrongOnly}
              onChange={e => setWrongOnly(e.target.checked)}
              className="w-4 h-4 rounded text-[#2F52FF] bg-[#0A1224] border-[#24315A] cursor-pointer"
            />
            <span className="text-xs font-semibold text-[#FFC700]">
              Wrong answers only
            </span>
          </label>
        </div>

        {/* QUESTION-BY-QUESTION REVIEW LIST */}
        <div className="space-y-3.5">
          {questionsToReview.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#121C36] border border-[#24315A] text-xs text-emerald-400 font-bold">
              🎉 Congratulations! You answered all questions correctly!
            </div>
          ) : (
            questionsToReview.map((q, idx) => {
              const studentChosenIdx = reviewAttempt.answers[q.id];
              const keyItem = keyItems.find(k => k.questionId === q.id);
              const correctIdx = keyItem ? keyItem.correctOptionIndex : 0;
              const isCorrect = studentChosenIdx === correctIdx;

              return (
                <div
                  key={q.id || idx}
                  className={`p-4 rounded-2xl border bg-[#121C36] shadow-sm space-y-3 transition-colors ${
                    isCorrect
                      ? 'border-emerald-500/30'
                      : 'border-rose-500/30'
                  }`}
                >
                  {/* Question Header */}
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-heading font-bold text-xs sm:text-sm text-[#E6ECFA]">
                      <span className="text-[#FFC700] mr-1.5 font-mono">Q{idx + 1}.</span>
                      {q.text}
                    </h4>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold shrink-0 flex items-center gap-1 ${
                        isCorrect
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/50'
                          : 'bg-rose-950/60 text-rose-400 border border-rose-500/50'
                      }`}
                    >
                      {isCorrect ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Correct</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" />
                          <span>Wrong</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Options List with color-coded marks */}
                  <div className="space-y-1.5">
                    {q.options.map((optText, oIdx) => {
                      const letter = String.fromCharCode(65 + oIdx);
                      const isStudentChoice = studentChosenIdx === oIdx;
                      const isActualCorrect = correctIdx === oIdx;

                      let optStyle = 'bg-[#0A1224] border-[#24315A] text-[#9AA8C7]';
                      if (isActualCorrect) {
                        optStyle = 'bg-emerald-950/30 border-emerald-500 text-emerald-200 font-bold';
                      } else if (isStudentChoice && !isCorrect) {
                        optStyle = 'bg-rose-950/30 border-rose-500 text-rose-200';
                      }

                      return (
                        <div
                          key={oIdx}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-colors ${optStyle}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#121C36] border border-[#24315A] flex items-center justify-center font-bold text-[10px] shrink-0">
                              {letter}
                            </span>
                            <span>{optText}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {isActualCorrect && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-white font-extrabold text-[9px] flex items-center gap-0.5">
                                <Check className="w-2.5 h-2.5" />
                                <span>Correct Answer</span>
                              </span>
                            )}
                            {isStudentChoice && !isActualCorrect && (
                              <span className="px-1.5 py-0.2 rounded bg-rose-500 text-white font-extrabold text-[9px] flex items-center gap-0.5">
                                <X className="w-2.5 h-2.5" />
                                <span>Your Answer</span>
                              </span>
                            )}
                            {isStudentChoice && isActualCorrect && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white font-extrabold text-[9px]">
                                Your Answer
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation Card */}
                  {keyItem?.explanation && (
                    <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-[#FFC700]">
                        <Lightbulb className="w-3.5 h-3.5 text-[#FFC700]" />
                        <span>Explanation</span>
                      </div>
                      <p className="text-xs text-[#E6ECFA] leading-relaxed">
                        {keyItem.explanation}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // SCREEN 3: QUIZZES DIRECTORY (MAIN STUDENT PAGE)
  // =========================================================================
  return (
    <div className="space-y-4 pt-1">
      {/* Page Header */}
      <div className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0A1224] border border-[#FFC700]/50 flex items-center justify-center text-[#FFC700]">
              <FileQuestion className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base text-[#E6ECFA]">
                Department Quizzes
              </h2>
              <p className="text-xs text-[#9AA8C7]">
                Practice tests &amp; multiple choice mock exams
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
            {studentDepartment}
          </span>
        </div>

        {/* 1st Sem / 2nd Sem / All Switch and Level Dropdown */}
        <div className="pt-2 border-t border-[#24315A]/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center p-0.5 rounded-lg bg-[#0A1224] border border-[#24315A]">
            {(['First Semester', 'Second Semester', 'All'] as const).map(sem => (
              <button
                key={sem}
                type="button"
                onClick={() => setSemesterFilter(sem)}
                className={`flex-1 sm:flex-initial px-3 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  semesterFilter === sem
                    ? 'bg-[#2F52FF] text-white shadow-sm'
                    : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                }`}
              >
                {sem === 'First Semester' ? '1st Sem' : sem === 'Second Semester' ? '2nd Sem' : 'All'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-[11px] text-[#9AA8C7] font-semibold">Level:</span>
            <select
              value={levelFilter}
              onChange={e => setLevelFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs font-bold text-[#FFC700] focus:outline-none focus:border-[#2F52FF] cursor-pointer"
            >
              {ACADEMIC_LEVELS.map(lvl => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search quizzes by title or course code..."
          className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/60 focus:outline-none focus:border-[#2F52FF] shadow-sm"
        />
        <Search className="w-4 h-4 text-[#9AA8C7] absolute left-3 top-3" />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-3 text-[#9AA8C7] hover:text-[#E6ECFA]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Quizzes List */}
      {loading ? (
        <div className="p-12 text-center rounded-2xl bg-[#121C36] border border-[#24315A]">
          <RefreshCw className="w-6 h-6 animate-spin text-[#FFC700] mx-auto mb-2" />
          <p className="text-xs text-[#9AA8C7]">Loading department quizzes...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#121C36] border border-[#24315A] space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#9AA8C7] mx-auto">
            <FileQuestion className="w-6 h-6 text-[#9AA8C7]" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-sm text-[#E6ECFA]">No Quizzes Available</h3>
            <p className="text-xs text-[#9AA8C7] mt-0.5 max-w-sm mx-auto">
              There are currently no practice quizzes published for this selection. Check back soon or check with your course representative!
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filteredQuizzes.map(quiz => {
            const attempt = attemptsMap[quiz.id];
            const hasAttempt = Boolean(attempt);
            const totalQ = quiz.questionCount || quiz.questions?.length || 1;
            const bestScore = attempt?.bestScore ?? attempt?.score;
            const bestPct = bestScore !== undefined ? Math.round((bestScore / totalQ) * 100) : null;

            return (
              <div
                key={quiz.id}
                className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF]/60 flex flex-col justify-between gap-3 shadow-sm transition-all"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
                      {quiz.courseCode}
                    </span>

                    {/* Best Score Badge */}
                    {hasAttempt && bestScore !== undefined ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-950/40 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        <span>Best: {bestScore}/{totalQ} ({bestPct}%)</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#0A1224] text-[#9AA8C7] border border-[#24315A]">
                        Not taken
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="font-heading font-bold text-sm text-[#E6ECFA] line-clamp-2">
                    {quiz.title}
                  </h3>

                  {/* Level & Semester Subtitle */}
                  <p className="text-[11px] text-[#9AA8C7] mt-1">
                    {quiz.level} &bull; {quiz.semester}
                  </p>

                  {/* Quiz Details (Questions & Timer) */}
                  <div className="flex items-center gap-3 text-[11px] text-[#9AA8C7] mt-3 pt-2 border-t border-[#24315A]/60">
                    <span className="flex items-center gap-1">
                      <FileQuestion className="w-3.5 h-3.5 text-[#2F52FF]" />
                      <strong>{totalQ}</strong> Questions
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#FFC700]" />
                      {quiz.timeLimit && quiz.timeLimit > 0 ? `${quiz.timeLimit} mins` : 'No limit'}
                    </span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 border-t border-[#24315A]/60 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartQuiz(quiz)}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#2F52FF] hover:bg-[#4364FF] text-white font-heading font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <span>{hasAttempt ? 'Retake Quiz' : 'Take Quiz'}</span>
                  </button>

                  {hasAttempt && (
                    <button
                      type="button"
                      onClick={() => handleViewExistingReview(quiz)}
                      title="View previous attempt results & answers"
                      className="py-2 px-3 rounded-xl bg-[#0A1224] hover:bg-[#1A2E63] border border-[#24315A] text-xs font-bold text-[#E6ECFA] transition-colors cursor-pointer"
                    >
                      Review
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
