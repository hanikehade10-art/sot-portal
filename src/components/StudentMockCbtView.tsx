/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, cleanFirestoreData } from '../lib/firebase';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  query,
  where,
  deleteDoc
} from 'firebase/firestore';
import {
  CourseItem,
  QuizItem,
  QuizQuestion,
  QuizKeyDoc,
  MockExamAttempt,
  MockExamQuestionReview
} from '../types';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Search,
  RotateCcw,
  Award,
  BookOpen,
  Flag,
  HelpCircle,
  History,
  Trash2,
  Sparkles,
  Layers,
  Send,
  Eye,
  Check
} from 'lucide-react';
import { WhatsAppScoreShare } from './WhatsAppScoreShare';
import { ConfettiEffect } from './ConfettiEffect';
import { BadgeUnlockedModal } from './BadgeUnlockedModal';
import { EmptyState } from './EmptyState';
import { QuizListSkeleton } from './SkeletonLoader';
import { checkAndAwardBadges } from '../lib/badges';
import { UserProfile, BadgeItem } from '../types';
import { logStudentActivity } from '../lib/studentActivity';
import { getCourseAccent } from '../config/courseAccents';

interface StudentMockCbtViewProps {
  studentDepartment: string;
  studentLevel?: string;
  studentName?: string;
  matricNumber?: string;
  uid: string;
  courses: CourseItem[];
  quizzes: QuizItem[];
  onBackToHome?: () => void;
  onOpenCourses?: () => void;
  profile?: UserProfile | null;
  onBadgeUnlocked?: (badge: BadgeItem) => void;
}

export const StudentMockCbtView: React.FC<StudentMockCbtViewProps> = ({
  studentDepartment,
  studentLevel = 'ND1',
  studentName,
  matricNumber,
  uid,
  courses,
  quizzes,
  onBackToHome,
  onOpenCourses,
  profile,
  onBadgeUnlocked
}) => {
  // Screen: 'setup' | 'exam' | 'result' | 'history'
  const [currentScreen, setCurrentScreen] = useState<'setup' | 'exam' | 'result' | 'history'>('setup');

  // Polish & Badge states
  const [showConfetti, setShowConfetti] = useState(false);
  const [newlyAwardedBadge, setNewlyAwardedBadge] = useState<BadgeItem | null>(null);

  // Setup selections
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [questionCountChoice, setQuestionCountChoice] = useState<20 | 40 | 60>(20);
  const [timeLimitChoice, setTimeLimitChoice] = useState<15 | 30 | 60>(15);
  const [courseSearch, setCourseSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('All');

  // Exam session states
  const [examCourse, setExamCourse] = useState<CourseItem | null>(null);
  const [examQuestions, setExamQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(15 * 60);
  const [totalTimeSeconds, setTotalTimeSeconds] = useState<number>(15 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
  const [submittingExam, setSubmittingExam] = useState(false);
  const [wasAutoSubmitted, setWasAutoSubmitted] = useState(false);
  const [showPaletteMobile, setShowPaletteMobile] = useState(false);

  // Result state
  const [currentResult, setCurrentResult] = useState<MockExamAttempt | null>(null);
  const [resultFilterTab, setResultFilterTab] = useState<'all' | 'missed' | 'flagged'>('all');

  // Past Mock Exams History
  const [pastAttempts, setPastAttempts] = useState<MockExamAttempt[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Department Courses list (filtered by department)
  const deptCourses = useMemo(() => {
    return courses.filter(c => c.department === studentDepartment);
  }, [courses, studentDepartment]);

  // Selected course object
  const activeSelectedCourse = useMemo(() => {
    return deptCourses.find(c => c.id === selectedCourseId) || null;
  }, [deptCourses, selectedCourseId]);

  // Automatically select the first course if none selected
  useEffect(() => {
    if (!selectedCourseId && deptCourses.length > 0) {
      setSelectedCourseId(deptCourses[0].id);
    }
  }, [deptCourses, selectedCourseId]);

  // Filtered courses for course picker
  const filteredCourses = useMemo(() => {
    return deptCourses.filter(c => {
      const matchSearch =
        c.code.toLowerCase().includes(courseSearch.toLowerCase()) ||
        c.title.toLowerCase().includes(courseSearch.toLowerCase());
      const matchLevel = levelFilter === 'All' || c.level.includes(levelFilter);
      return matchSearch && matchLevel;
    });
  }, [deptCourses, courseSearch, levelFilter]);

  // Count available quiz questions for the currently selected course
  const availableQuestionsForCourse = useMemo(() => {
    if (!activeSelectedCourse) return [];
    // Find all quizzes belonging to this course code or course id
    const matchingQuizzes = quizzes.filter(q => {
      const matchDept = q.department === studentDepartment;
      const matchCode = q.courseCode?.trim().toUpperCase() === activeSelectedCourse.code.trim().toUpperCase();
      const matchId = q.courseId && q.courseId === activeSelectedCourse.id;
      return matchDept && (matchCode || matchId) && q.published;
    });

    const questionList: Array<QuizQuestion & { parentQuizId: string }> = [];
    const seenTexts = new Set<string>();

    matchingQuizzes.forEach(quiz => {
      (quiz.questions || []).forEach(q => {
        if (!q.text || !q.options || q.options.length < 2) return;
        const normalized = q.text.trim().toLowerCase();
        if (!seenTexts.has(normalized)) {
          seenTexts.add(normalized);
          questionList.push({
            ...q,
            parentQuizId: quiz.id
          });
        }
      });
    });

    return questionList;
  }, [activeSelectedCourse, quizzes, studentDepartment]);

  // Load Past Mock Exams from Firestore + LocalStorage fallback
  const fetchPastMockAttempts = async () => {
    if (!uid) return;
    setLoadingHistory(true);
    try {
      const localKey = `sot_mock_cbt_history_${uid}`;
      const cachedRaw = localStorage.getItem(localKey);
      let localList: MockExamAttempt[] = [];
      if (cachedRaw) {
        try {
          localList = JSON.parse(cachedRaw);
        } catch {}
      }

      const qRef = collection(db, 'mockExamAttempts');
      const qQuery = query(qRef, where('uid', '==', uid));
      const snap = await getDocs(qQuery);
      const remoteList: MockExamAttempt[] = [];
      snap.forEach(d => {
        remoteList.push({ id: d.id, ...d.data() } as MockExamAttempt);
      });

      // Merge and deduplicate by id
      const combinedMap = new Map<string, MockExamAttempt>();
      localList.forEach(item => combinedMap.set(item.id, item));
      remoteList.forEach(item => combinedMap.set(item.id, item));

      const merged = Array.from(combinedMap.values());
      merged.sort((a, b) => new Date(b.submittedAt || b.createdAt || 0).getTime() - new Date(a.submittedAt || a.createdAt || 0).getTime());

      setPastAttempts(merged);
      localStorage.setItem(localKey, JSON.stringify(merged.slice(0, 30)));
    } catch (err) {
      console.warn('Could not read mock exam attempts from Firestore:', err);
      // Fallback to local
      const localKey = `sot_mock_cbt_history_${uid}`;
      const cachedRaw = localStorage.getItem(localKey);
      if (cachedRaw) {
        try {
          setPastAttempts(JSON.parse(cachedRaw));
        } catch {}
      }
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchPastMockAttempts();
  }, [uid]);

  // Timer Countdown Logic
  useEffect(() => {
    if (!timerRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeftSeconds(prev => {
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

  // Auto-submit when time reaches 0
  useEffect(() => {
    if (timerRunning && timeLeftSeconds <= 0) {
      setTimerRunning(false);
      handleFinishExam(true);
    }
  }, [timeLeftSeconds, timerRunning]);

  // Format time (mm:ss or hh:mm:ss)
  const formatSeconds = (totalSeconds: number): string => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Start the Mock CBT Exam
  const handleStartExam = () => {
    if (!activeSelectedCourse || availableQuestionsForCourse.length === 0) return;

    // Pick questions at random without repeating
    const shuffled = [...availableQuestionsForCourse].sort(() => Math.random() - 0.5);
    const desiredCount = Math.min(questionCountChoice, shuffled.length);
    const selected = shuffled.slice(0, desiredCount);

    setExamCourse(activeSelectedCourse);
    setExamQuestions(selected);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setFlaggedQuestions({});

    const totalSecs = timeLimitChoice * 60;
    setTotalTimeSeconds(totalSecs);
    setTimeLeftSeconds(totalSecs);
    setWasAutoSubmitted(false);
    setTimerRunning(true);
    setCurrentScreen('exam');

    logStudentActivity({
      uid,
      name: studentName,
      department: studentDepartment,
      level: activeSelectedCourse.level,
      type: 'mock exam started',
      title: `${activeSelectedCourse.code}: Mock CBT Exam (${selected.length} Qs, ${timeLimitChoice}m)`
    });
  };

  // Submit Exam & Score Answers
  const handleFinishExam = async (isAuto = false) => {
    if (submittingExam || !examCourse || examQuestions.length === 0) return;
    setSubmittingExam(true);
    setTimerRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (isAuto) {
      setWasAutoSubmitted(true);
    }
    setShowSubmitConfirmModal(false);

    try {
      const timeUsedSeconds = Math.max(1, totalTimeSeconds - Math.max(0, timeLeftSeconds));
      const parentQuizIds = Array.from(new Set(examQuestions.map(q => (q as any).parentQuizId).filter(Boolean)));

      // Fetch answer keys for the quizzes involved
      const keyMap = new Map<string, any>();
      for (const qzId of parentQuizIds) {
        try {
          const keySnap = await getDoc(doc(db, 'quizKeys', qzId));
          if (keySnap.exists()) {
            const data = keySnap.data() as QuizKeyDoc;
            (data.keys || []).forEach(k => {
              keyMap.set(k.questionId, k);
            });
          }
        } catch (keyErr) {
          console.warn(`Could not load quiz keys for quiz ${qzId}:`, keyErr);
        }
      }

      // Review each question
      let correctCount = 0;
      let answeredCount = 0;

      const questionsReview: MockExamQuestionReview[] = examQuestions.map(q => {
        const studentChoice = selectedAnswers[q.id];
        const isAnswered = typeof studentChoice === 'number';
        if (isAnswered) answeredCount++;

        const matchingKey = keyMap.get(q.id);
        const correctIndex = matchingKey?.correctOptionIndex ?? 0;
        const isCorrect = isAnswered && studentChoice === correctIndex;
        if (isCorrect) correctCount++;

        return {
          questionId: q.id,
          parentQuizId: (q as any).parentQuizId,
          text: q.text,
          options: q.options,
          type: q.type,
          studentAnswer: isAnswered ? studentChoice : null,
          correctOptionIndex: correctIndex,
          correctOptionIndices: matchingKey?.correctOptionIndices,
          modelAnswer: matchingKey?.modelAnswer,
          isCorrect,
          explanation: matchingKey?.explanation || 'Refer to your course syllabus notes and revision materials.',
          whyNotNotes: matchingKey?.whyNotNotes,
          flagged: Boolean(flaggedQuestions[q.id])
        };
      });

      const totalQuestions = examQuestions.length;
      const score = correctCount;
      const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
      const passed = percentage >= 50;
      const now = new Date().toISOString();
      const attemptId = `${uid}_mock_${Date.now()}`;

      const attemptRecord: MockExamAttempt = {
        id: attemptId,
        uid,
        department: studentDepartment,
        courseId: examCourse.id,
        courseCode: examCourse.code,
        courseTitle: examCourse.title,
        totalQuestions,
        answeredCount,
        correctCount,
        score,
        percentage,
        timeLimitMinutes: Math.round(totalTimeSeconds / 60),
        timeUsedSeconds,
        passed,
        questionsReview,
        submittedAt: now,
        createdAt: now
      };

      // 1. Save to local storage immediately
      const localKey = `sot_mock_cbt_history_${uid}`;
      try {
        const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
        const updated = [attemptRecord, ...existing.filter((item: any) => item.id !== attemptId)];
        localStorage.setItem(localKey, JSON.stringify(updated.slice(0, 30)));
        setPastAttempts(updated);
      } catch {}

      // 2. Save to Firestore
      try {
        const sanitized = cleanFirestoreData(attemptRecord);
        await setDoc(doc(db, 'mockExamAttempts', attemptId), sanitized);
      } catch (fsErr) {
        console.warn('Notice: Mock attempt stored locally (Firestore sync note):', fsErr);
      }

      logStudentActivity({
        uid,
        name: studentName,
        department: studentDepartment,
        level: examCourse.level,
        type: 'mock exam completed',
        title: `${examCourse.code}: Scored ${percentage}% (${score}/${totalQuestions}) in Mock CBT`
      });

      // Trigger celebration confetti if passed with 50% or more
      if (percentage >= 50) {
        setShowConfetti(true);
      }

      // Check badges (First Quiz, Perfect Score, 10 Quizzes)
      try {
        const unlockedBadges = await checkAndAwardBadges({
          uid,
          currentBadges: profile?.badges,
          streakCount: profile?.streakCount,
          longestStreak: profile?.longestStreak,
          totalQuizzesTaken: pastAttempts.length + 1,
          latestScorePercentage: percentage
        });
        if (unlockedBadges.length > 0) {
          setNewlyAwardedBadge(unlockedBadges[0]);
          setShowConfetti(true);
          onBadgeUnlocked?.(unlockedBadges[0]);
        }
      } catch (bErr) {
        console.warn('Badge award check in mock cbt notice:', bErr);
      }

      setCurrentResult(attemptRecord);
      setResultFilterTab('all');
      setCurrentScreen('result');
    } catch (err) {
      console.error('Failed to submit mock exam:', err);
    } finally {
      setSubmittingExam(false);
    }
  };

  // Delete a past attempt
  const handleDeletePastAttempt = async (attemptId: string) => {
    if (!window.confirm('Delete this mock exam attempt from your history?')) return;
    try {
      const localKey = `sot_mock_cbt_history_${uid}`;
      const filtered = pastAttempts.filter(a => a.id !== attemptId);
      setPastAttempts(filtered);
      localStorage.setItem(localKey, JSON.stringify(filtered));

      await deleteDoc(doc(db, 'mockExamAttempts', attemptId)).catch(() => {});
    } catch (err) {
      console.warn('Failed to delete past attempt:', err);
    }
  };

  // Inspect past attempt result
  const handleReviewPastAttempt = (attempt: MockExamAttempt) => {
    setCurrentResult(attempt);
    setResultFilterTab('all');
    setCurrentScreen('result');
  };

  // =========================================================
  // RENDER: 1. SETUP SCREEN
  // =========================================================
  if (currentScreen === 'setup') {
    const courseAccent = activeSelectedCourse ? getCourseAccent(activeSelectedCourse.accentColor) : null;
    const questionsAvailable = availableQuestionsForCourse.length;

    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                className="p-2 rounded-xl bg-[#121C36] border border-[#24315A] text-[#9AA8C7] hover:text-white transition-all cursor-pointer group"
                title="Back to Home"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1.5 transition-transform duration-200 ease-out" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FFC700]/20 text-[#FFC700] border border-[#FFC700]/40">
                  Timed Simulation
                </span>
                <span className="text-xs text-[#9AA8C7]">{studentDepartment}</span>
              </div>
              <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-[#E6ECFA]">
                Mock CBT Exam
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCurrentScreen('history')}
            className="px-3.5 py-2 rounded-xl bg-[#121C36] hover:bg-[#1A2649] border border-[#24315A] text-xs font-bold text-[#E6ECFA] flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <History className="w-4 h-4 text-[#FFC700]" />
            <span>Past Exams ({pastAttempts.length})</span>
          </button>
        </div>

        {/* Feature Hero Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#121C36] to-[#0D162B] border border-[#24315A] space-y-3 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-[#2F52FF]/10 blur-2xl pointer-events-none" />
          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#2F52FF]">
              <Sparkles className="w-4 h-4" />
              <span>Simulate Real Examination Conditions</span>
            </div>
            <p className="text-xs sm:text-sm text-[#9AA8C7] leading-relaxed max-w-2xl">
              Sharpen your speed, accuracy, and examination confidence. Select your course, set your desired question volume and time limit, and review comprehensive question explanations upon completion.
            </p>
          </div>
        </div>

        {/* STEP 1: PICK A COURSE */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <span className="text-[10px] font-bold text-[#2F52FF] uppercase tracking-wider block">
                Step 1 of 3
              </span>
              <h3 className="font-heading font-bold text-base text-[#E6ECFA]">
                Pick a Course
              </h3>
            </div>

            {/* Level filter */}
            <div className="flex items-center gap-1 bg-[#0A1224] p-1 rounded-xl border border-[#24315A] text-xs">
              {['All', 'ND1', 'ND2', 'HND1', 'HND2'].map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevelFilter(lvl)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    levelFilter === lvl
                      ? 'bg-[#2F52FF] text-white shadow-sm'
                      : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Search courses */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#9AA8C7] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={courseSearch}
              onChange={e => setCourseSearch(e.target.value)}
              placeholder="Search by course code or title (e.g. COM 124)..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#9AA8C7] focus:outline-none focus:border-[#2F52FF] transition-colors"
            />
          </div>

          {/* Courses selection grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[280px] overflow-y-auto pr-1">
            {filteredCourses.length === 0 ? (
              <div className="col-span-full py-8 text-center text-xs text-[#9AA8C7]">
                No courses match your filter.
              </div>
            ) : (
              filteredCourses.map(c => {
                const isSelected = c.id === selectedCourseId;
                const accent = getCourseAccent(c.accentColor);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCourseId(c.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#0A1224] border-[#FFC700] shadow-[0_0_15px_rgba(255,199,0,0.2)] ring-1 ring-[#FFC700]'
                        : 'bg-[#0A1224]/80 border-[#24315A] hover:border-[#384A75]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-mono font-bold text-xs ${isSelected ? 'text-[#FFC700]' : accent.badgeText}`}>
                        {c.code}
                      </span>
                      <span className="text-[10px] text-[#9AA8C7] font-medium">
                        {c.level}
                      </span>
                    </div>
                    <p className="text-xs text-[#E6ECFA] font-medium line-clamp-2 leading-snug">
                      {c.title}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          {/* Selected Course summary banner */}
          {activeSelectedCourse && (
            <div className="p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <BookOpen className="w-4 h-4 text-[#FFC700] shrink-0" />
                <span className="text-[#E6ECFA] font-bold truncate">
                  {activeSelectedCourse.code}: {activeSelectedCourse.title}
                </span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                questionsAvailable > 0
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              }`}>
                {questionsAvailable} question{questionsAvailable === 1 ? '' : 's'} available
              </span>
            </div>
          )}
        </div>

        {/* STEP 2 & 3: QUESTIONS COUNT & TIME LIMIT */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Question Count Selection */}
          <div className="p-5 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-3">
            <span className="text-[10px] font-bold text-[#2F52FF] uppercase tracking-wider block">
              Step 2 of 3
            </span>
            <h3 className="font-heading font-bold text-sm sm:text-base text-[#E6ECFA]">
              Number of Questions
            </h3>
            <p className="text-[11px] text-[#9AA8C7]">
              Select how many questions you want to solve in this session.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {([20, 40, 60] as const).map(count => {
                const isSelected = questionCountChoice === count;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setQuestionCountChoice(count)}
                    className={`py-3 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#2F52FF] border-[#2F52FF] text-white font-black shadow-[0_0_15px_rgba(47,82,255,0.3)]'
                        : 'bg-[#0A1224] border-[#24315A] text-[#E6ECFA] hover:border-[#384A75] font-bold'
                    }`}
                  >
                    <span className="text-base block">{count}</span>
                    <span className="text-[10px] block opacity-80">Questions</span>
                  </button>
                );
              })}
            </div>

            {questionsAvailable > 0 && questionsAvailable < questionCountChoice && (
              <p className="text-[11px] text-amber-400 flex items-center gap-1.5 pt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>This course has {questionsAvailable} questions. All {questionsAvailable} will be presented.</span>
              </p>
            )}
          </div>

          {/* Time Limit Selection */}
          <div className="p-5 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-3">
            <span className="text-[10px] font-bold text-[#2F52FF] uppercase tracking-wider block">
              Step 3 of 3
            </span>
            <h3 className="font-heading font-bold text-sm sm:text-base text-[#E6ECFA]">
              Time Limit
            </h3>
            <p className="text-[11px] text-[#9AA8C7]">
              Choose how long you have before the exam automatically submits.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {([15, 30, 60] as const).map(mins => {
                const isSelected = timeLimitChoice === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setTimeLimitChoice(mins)}
                    className={`py-3 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#FFC700] border-[#FFC700] text-[#0A1224] font-black shadow-[0_0_15px_rgba(255,199,0,0.3)]'
                        : 'bg-[#0A1224] border-[#24315A] text-[#E6ECFA] hover:border-[#384A75] font-bold'
                    }`}
                  >
                    <span className="text-base block">{mins}</span>
                    <span className="text-[10px] block opacity-80">Minutes</span>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-[#9AA8C7] flex items-center gap-1.5 pt-1">
              <Clock className="w-3.5 h-3.5 text-[#FFC700]" />
              <span>Pacing: ~{Math.round((timeLimitChoice * 60) / Math.min(questionCountChoice, questionsAvailable || 20))} seconds per question</span>
            </p>
          </div>
        </div>

        {/* Start Button & Notice */}
        <div className="space-y-3 pt-2">
          {questionsAvailable === 0 ? (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>
                No published quiz questions were found for <strong>{activeSelectedCourse?.code}</strong>. Please select another course or add quiz questions in the Quizzes manager.
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartExam}
              className="w-full py-4 px-6 rounded-2xl bg-[#2F52FF] hover:bg-[#2545df] text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl transition-all cursor-pointer active:scale-[0.99] group"
            >
              <span>Start Mock Exam</span>
              <span className="text-xs opacity-90 font-mono">
                ({Math.min(questionCountChoice, questionsAvailable)} Qs • {timeLimitChoice} Mins)
              </span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          )}

          <div className="flex items-center justify-center gap-4 text-[11px] text-[#9AA8C7]">
            <span>• No repeated questions</span>
            <span>• Auto-submits on timeout</span>
            <span>• Full answer explanations</span>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // RENDER: 2. EXAM SCREEN (RUNNING)
  // =========================================================
  if (currentScreen === 'exam' && examCourse && examQuestions.length > 0) {
    const totalQuestions = examQuestions.length;
    const currentQ = examQuestions[currentQuestionIndex];
    const isAnswered = typeof selectedAnswers[currentQ?.id] === 'number';
    const isFlagged = Boolean(flaggedQuestions[currentQ?.id]);

    const answeredCount = Object.keys(selectedAnswers).length;
    const flaggedCount = Object.values(flaggedQuestions).filter(Boolean).length;
    const progressPct = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

    const isTimeUrgent = timeLeftSeconds <= 5 * 60;
    const isTimeCritical = timeLeftSeconds <= 60;

    return (
      <div className="space-y-4 max-w-4xl mx-auto pb-16">
        {/* STICKY TOP EXAM BAR: Timer, Question #, Submit */}
        <div className="sticky top-16 z-30 p-3 sm:p-4 rounded-2xl bg-[#0B1220]/95 backdrop-blur-md border border-[#24315A] shadow-xl flex items-center justify-between gap-3">
          {/* Course & Question Index */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-mono font-black text-xs sm:text-sm text-[#FFC700] px-2 py-0.5 rounded bg-[#121C36] border border-[#24315A] shrink-0">
              {examCourse.code}
            </span>
            <span className="font-heading font-extrabold text-xs sm:text-sm text-[#E6ECFA] truncate">
              Q{currentQuestionIndex + 1} of {totalQuestions}
            </span>
          </div>

          {/* Countdown Timer */}
          <div
            className={`px-3 py-1 rounded-xl font-mono font-black text-xs sm:text-sm flex items-center gap-1.5 shrink-0 border transition-all ${
              isTimeCritical
                ? 'bg-rose-600/30 border-rose-500 text-rose-400 animate-pulse'
                : isTimeUrgent
                ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                : 'bg-[#121C36] border-[#24315A] text-[#E6ECFA]'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${isTimeCritical ? 'text-rose-400' : isTimeUrgent ? 'text-amber-400' : 'text-[#FFC700]'}`} />
            <span>{formatSeconds(timeLeftSeconds)}</span>
          </div>

          {/* Submit Action */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle mobile palette */}
            <button
              type="button"
              onClick={() => setShowPaletteMobile(!showPaletteMobile)}
              className="sm:hidden p-2 rounded-xl bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA]"
              title="Toggle question grid"
            >
              <Layers className="w-4 h-4 text-[#FFC700]" />
            </button>

            <button
              type="button"
              onClick={() => setShowSubmitConfirmModal(true)}
              className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Submit</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#121C36] h-1.5 rounded-full overflow-hidden border border-[#24315A]">
          <div
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* MAIN LAYOUT: QUESTION BODY + PALETTE SIDEBAR */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* QUESTION CARD (8 COLS ON DESKTOP) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="p-5 sm:p-7 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-5 shadow-lg min-h-[360px] flex flex-col justify-between">
              {/* Question Header */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-[#24315A]/60 pb-3">
                  <span className="text-xs font-bold text-[#9AA8C7]">
                    Question {currentQuestionIndex + 1}
                  </span>

                  {/* Flag for Review button */}
                  <button
                    type="button"
                    onClick={() => {
                      setFlaggedQuestions(prev => ({
                        ...prev,
                        [currentQ.id]: !prev[currentQ.id]
                      }));
                    }}
                    className={`py-1 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                      isFlagged
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'bg-[#0A1224] border-[#24315A] text-[#9AA8C7] hover:text-[#E6ECFA]'
                    }`}
                  >
                    <Flag className={`w-3.5 h-3.5 ${isFlagged ? 'fill-amber-400 text-amber-400' : ''}`} />
                    <span>{isFlagged ? 'Flagged' : 'Flag for review'}</span>
                  </button>
                </div>

                {/* Question Text */}
                <h2 className="font-heading font-semibold text-sm sm:text-base text-[#E6ECFA] leading-relaxed pt-1">
                  {currentQ.text}
                </h2>
              </div>

              {/* Options List */}
              <div className="space-y-2.5 pt-2">
                {currentQ.options.map((optionText, optIdx) => {
                  const isSelected = selectedAnswers[currentQ.id] === optIdx;
                  const letter = String.fromCharCode(65 + optIdx);
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => {
                        setSelectedAnswers(prev => ({
                          ...prev,
                          [currentQ.id]: optIdx
                        }));
                      }}
                      className={`w-full p-3.5 sm:p-4 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#2F52FF]/20 border-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.25)]'
                          : 'bg-[#0A1224] border-[#24315A] text-[#E6ECFA] hover:border-[#384A75]'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-[#2F52FF] border-[#2F52FF] text-white'
                            : 'bg-[#121C36] border-[#24315A] text-[#9AA8C7]'
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="text-xs sm:text-sm font-normal leading-relaxed pt-0.5">
                        {optionText}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Navigation Controls: Prev, Next */}
              <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#24315A]/60">
                <button
                  type="button"
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                  className="py-2.5 px-4 rounded-xl bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <div className="text-[11px] text-[#9AA8C7] hidden sm:block">
                  {answeredCount} of {totalQuestions} answered
                </div>

                {currentQuestionIndex < totalQuestions - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQuestionIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                    className="py-2.5 px-4 rounded-xl bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSubmitConfirmModal(true)}
                    className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                  >
                    <span>Finish Exam</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* QUESTION PALETTE GRID (4 COLS ON DESKTOP, COLLAPSIBLE ON MOBILE) */}
          <div
            className={`lg:col-span-4 space-y-3 ${
              showPaletteMobile ? 'block' : 'hidden lg:block'
            }`}
          >
            <div className="p-4 sm:p-5 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4 shadow-lg sticky top-36">
              <div className="flex items-center justify-between gap-2 border-b border-[#24315A]/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#FFC700]" />
                  <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-[#E6ECFA]">
                    Question Palette ({totalQuestions})
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaletteMobile(false)}
                  className="lg:hidden text-xs text-[#9AA8C7] hover:text-white"
                >
                  Close
                </button>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-2 text-[10px] text-[#9AA8C7]">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-600 border border-emerald-500 shrink-0" />
                  <span>Answered ({answeredCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-500 border border-amber-400 shrink-0" />
                  <span>Flagged ({flaggedCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#0A1224] border border-[#2F52FF] ring-1 ring-[#2F52FF] shrink-0" />
                  <span>Current Q</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#0A1224] border border-[#24315A] shrink-0" />
                  <span>Unanswered</span>
                </div>
              </div>

              {/* Grid of question numbers */}
              <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-1.5 max-h-[300px] overflow-y-auto pr-1">
                {examQuestions.map((q, idx) => {
                  const isQAnswered = typeof selectedAnswers[q.id] === 'number';
                  const isQFlagged = Boolean(flaggedQuestions[q.id]);
                  const isCurrent = idx === currentQuestionIndex;

                  let colorClasses = 'bg-[#0A1224] border-[#24315A] text-[#9AA8C7] hover:border-[#384A75]';
                  if (isQFlagged && isQAnswered) {
                    colorClasses = 'bg-amber-500/80 border-amber-400 text-[#0A1224] font-black';
                  } else if (isQFlagged) {
                    colorClasses = 'bg-amber-500/30 border-amber-500 text-amber-300 font-bold';
                  } else if (isQAnswered) {
                    colorClasses = 'bg-emerald-600 border-emerald-500 text-white font-bold';
                  }

                  if (isCurrent) {
                    colorClasses += ' ring-2 ring-[#2F52FF] shadow-[0_0_10px_rgba(47,82,255,0.4)]';
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setCurrentQuestionIndex(idx);
                        setShowPaletteMobile(false);
                      }}
                      className={`h-8 rounded-lg border text-xs font-mono flex items-center justify-center transition-all cursor-pointer relative ${colorClasses}`}
                    >
                      <span>{idx + 1}</span>
                      {isQFlagged && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Submit shortcut */}
              <button
                type="button"
                onClick={() => setShowSubmitConfirmModal(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Exam Now</span>
              </button>
            </div>
          </div>
        </div>

        {/* SUBMIT CONFIRMATION MODAL */}
        {showSubmitConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md p-6 rounded-2xl bg-[#121C36] border-2 border-[#24315A] space-y-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-[#E6ECFA]">
                    Submit Mock CBT Exam?
                  </h3>
                  <p className="text-xs text-[#9AA8C7]">
                    Confirm your exam submission.
                  </p>
                </div>
              </div>

              {/* Status summary */}
              <div className="p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-2 text-xs">
                <div className="flex justify-between text-[#9AA8C7]">
                  <span>Total questions:</span>
                  <span className="text-[#E6ECFA] font-bold">{totalQuestions}</span>
                </div>
                <div className="flex justify-between text-[#9AA8C7]">
                  <span>Answered:</span>
                  <span className="text-emerald-400 font-bold">{answeredCount}</span>
                </div>
                <div className="flex justify-between text-[#9AA8C7]">
                  <span>Unanswered:</span>
                  <span className={totalQuestions - answeredCount > 0 ? 'text-rose-400 font-bold' : 'text-[#E6ECFA] font-bold'}>
                    {totalQuestions - answeredCount}
                  </span>
                </div>
                <div className="flex justify-between text-[#9AA8C7]">
                  <span>Flagged for review:</span>
                  <span className="text-amber-400 font-bold">{flaggedCount}</span>
                </div>
                <div className="flex justify-between text-[#9AA8C7] border-t border-[#24315A] pt-2">
                  <span>Time remaining:</span>
                  <span className="text-[#FFC700] font-mono font-bold">{formatSeconds(timeLeftSeconds)}</span>
                </div>
              </div>

              {totalQuestions - answeredCount > 0 && (
                <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>You still have {totalQuestions - answeredCount} unanswered questions!</span>
                </p>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirmModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs font-bold text-[#E6ECFA] hover:text-white transition-all cursor-pointer"
                >
                  Continue Exam
                </button>
                <button
                  type="button"
                  disabled={submittingExam}
                  onClick={() => handleFinishExam(false)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  {submittingExam ? 'Grading...' : 'Yes, Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================
  // RENDER: 3. RESULT & QUESTION-BY-QUESTION REVIEW SCREEN
  // =========================================================
  if (currentScreen === 'result' && currentResult) {
    const isPassed = currentResult.passed ?? (currentResult.percentage >= 50);
    const timeUsedFormatted = formatSeconds(currentResult.timeUsedSeconds);

    const filteredReviews = currentResult.questionsReview.filter(r => {
      if (resultFilterTab === 'missed') return !r.isCorrect;
      if (resultFilterTab === 'flagged') return Boolean(r.flagged);
      return true;
    });

    const missedCount = currentResult.questionsReview.filter(r => !r.isCorrect).length;
    const flaggedCount = currentResult.questionsReview.filter(r => Boolean(r.flagged)).length;

    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-16">
        {/* Celebration Confetti when passing (>=50%) */}
        {showConfetti && (
          <ConfettiEffect onComplete={() => setShowConfetti(false)} />
        )}

        {/* Badge Unlocked Popup Modal */}
        {newlyAwardedBadge && (
          <BadgeUnlockedModal
            badge={newlyAwardedBadge}
            onClose={() => setNewlyAwardedBadge(null)}
          />
        )}

        {/* Top Back Bar */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setCurrentScreen('setup')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FFC700] hover:text-[#fde047] cursor-pointer group transition-colors"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1.5 transition-transform duration-200 ease-out" />
            <span>Choose Another Course</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentScreen('history')}
            className="text-xs font-bold text-[#9AA8C7] hover:text-[#E6ECFA] flex items-center gap-1.5 cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-[#FFC700]" />
            <span>Past Exams</span>
          </button>
        </div>

        {/* Auto-submitted notice */}
        {wasAutoSubmitted && (
          <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Time ran out! Your exam answers were automatically submitted and graded.</span>
          </div>
        )}

        {/* SCORE CARD */}
        <div className="p-6 sm:p-7 rounded-2xl bg-[#121C36] border-2 border-[#24315A] space-y-4 shadow-xl text-center">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#9AA8C7] uppercase tracking-wider">
              {currentResult.courseCode} • Mock CBT Result
            </span>
            <h2 className="font-heading font-extrabold text-xl text-[#E6ECFA]">
              {currentResult.courseTitle}
            </h2>
          </div>

          {/* Pass / Fail Badge & Big Score */}
          <div className="py-2 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border">
              {isPassed ? (
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Passed ({currentResult.percentage}% &ge; 50%)</span>
                </span>
              ) : (
                <span className="bg-rose-500/20 text-rose-400 border border-rose-500/50 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" />
                  <span>Needs Improvement ({currentResult.percentage}% &lt; 50%)</span>
                </span>
              )}
            </div>

            <div className="text-4xl sm:text-5xl font-heading font-black text-[#FFC700]">
              {currentResult.score} <span className="text-lg font-bold text-[#9AA8C7]">/ {currentResult.totalQuestions}</span>
            </div>

            <p className="text-xs text-[#9AA8C7]">
              {currentResult.percentage}% Score • Time Used: <strong className="text-[#E6ECFA] font-mono">{timeUsedFormatted}</strong> of {currentResult.timeLimitMinutes}m
            </p>
          </div>

          {/* WhatsApp Share Card */}
          <WhatsAppScoreShare
            percentage={currentResult.percentage}
            courseCode={currentResult.courseCode}
            examLabel="Mock CBT"
            className="text-left max-w-lg mx-auto"
          />

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-3 border-t border-[#24315A]/70">
            <button
              type="button"
              onClick={handleStartExam}
              className="px-4 py-2.5 rounded-xl bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retake Mock Exam</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentScreen('setup')}
              className="px-4 py-2.5 rounded-xl bg-[#0A1224] border border-[#24315A] hover:border-[#FFC700] text-[#E6ECFA] text-xs font-bold transition-all cursor-pointer"
            >
              Change Course
            </button>
          </div>
        </div>

        {/* REVIEW SECTION WITH TABS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-heading font-bold text-sm text-[#E6ECFA]">
              Question-by-Question Review
            </h3>
            <span className="text-xs text-[#9AA8C7]">
              Showing {filteredReviews.length} of {currentResult.questionsReview.length}
            </span>
          </div>

          {/* Review Filter Tabs: All, Missed, Flagged */}
          <div className="p-1 rounded-xl bg-[#0A1224] border border-[#24315A] grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => setResultFilterTab('all')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                resultFilterTab === 'all'
                  ? 'bg-[#2F52FF] text-white shadow-sm'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
              }`}
            >
              <span>All ({currentResult.questionsReview.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setResultFilterTab('missed')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                resultFilterTab === 'missed'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
              }`}
            >
              <span>Missed ({missedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setResultFilterTab('flagged')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                resultFilterTab === 'flagged'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
              }`}
            >
              <span>Flagged ({flaggedCount})</span>
            </button>
          </div>

          {/* List of Question Review Cards */}
          <div className="space-y-4">
            {filteredReviews.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#121C36] border border-[#24315A] text-center text-xs text-[#9AA8C7]">
                {resultFilterTab === 'missed'
                  ? "Flawless score! You didn't miss any questions on this exam."
                  : 'No flagged questions for this exam.'}
              </div>
            ) : (
              filteredReviews.map((item, idx) => {
                const originalIndex = currentResult.questionsReview.findIndex(q => q.questionId === item.questionId);
                const qNum = originalIndex >= 0 ? originalIndex + 1 : idx + 1;

                return (
                  <div
                    key={item.questionId || idx}
                    className={`p-5 sm:p-6 rounded-2xl bg-[#121C36] border transition-all space-y-4 ${
                      item.isCorrect
                        ? 'border-emerald-500/40 bg-[#122238]/60'
                        : 'border-rose-500/40 bg-[#251525]/40'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-[#24315A]/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-[#0A1224] border border-[#24315A] font-mono font-bold text-xs flex items-center justify-center text-[#E6ECFA]">
                          {qNum}
                        </span>
                        <span className={`text-xs font-bold flex items-center gap-1 ${
                          item.isCorrect ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {item.isCorrect ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Correct</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Incorrect</span>
                            </>
                          )}
                        </span>
                      </div>

                      {item.flagged && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1">
                          <Flag className="w-3 h-3 fill-amber-400" />
                          <span>Flagged during exam</span>
                        </span>
                      )}
                    </div>

                    {/* Question text */}
                    <h4 className="font-heading font-medium text-sm text-[#E6ECFA] leading-relaxed">
                      {item.text}
                    </h4>

                    {/* Options Review */}
                    <div className="space-y-2">
                      {item.options.map((optText, optIdx) => {
                        const isStudentChoice = item.studentAnswer === optIdx;
                        const isCorrectOption = item.correctOptionIndex === optIdx;
                        const letter = String.fromCharCode(65 + optIdx);

                        let optClasses = 'bg-[#0A1224] border-[#24315A] text-[#9AA8C7]';
                        if (isCorrectOption) {
                          optClasses = 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200 font-medium';
                        } else if (isStudentChoice && !item.isCorrect) {
                          optClasses = 'bg-rose-500/20 border-rose-500 text-rose-300 font-medium';
                        }

                        return (
                          <div
                            key={optIdx}
                            className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs leading-relaxed ${optClasses}`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className="font-mono font-bold text-[11px] shrink-0 pt-0.5">
                                {letter})
                              </span>
                              <span>{optText}</span>
                            </div>

                            <div className="shrink-0 flex items-center gap-1.5 font-bold text-[10px]">
                              {isCorrectOption && (
                                <span className="text-emerald-400 flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Correct Answer</span>
                                </span>
                              )}
                              {isStudentChoice && !isCorrectOption && (
                                <span className="text-rose-400 flex items-center gap-1">
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Your Choice</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Unanswered notice */}
                    {item.studentAnswer === null && (
                      <p className="text-[11px] text-amber-400 italic">
                        You left this question unattempted during the exam.
                      </p>
                    )}

                    {/* Explanation Box */}
                    {item.explanation && (
                      <div className="p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-[#FFC700]">
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Author Explanation:</span>
                        </div>
                        <p className="text-[#E6ECFA] leading-relaxed text-[11px] pl-5">
                          {item.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // RENDER: 4. PAST EXAMS HISTORY SCREEN
  // =========================================================
  if (currentScreen === 'history') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-16">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setCurrentScreen('setup')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FFC700] hover:text-[#fde047] cursor-pointer group transition-colors"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1.5 transition-transform duration-200 ease-out" />
            <span>Back to Mock CBT Setup</span>
          </button>
          <span className="text-xs text-[#9AA8C7]">{pastAttempts.length} Total Exams</span>
        </div>

        <div className="p-5 sm:p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#FFC700]" />
            <h2 className="font-heading font-extrabold text-lg text-[#E6ECFA]">
              Past Mock Exam Records
            </h2>
          </div>
          <p className="text-xs text-[#9AA8C7]">
            Review your previously completed mock CBT exams, check where you improved, and inspect question explanations.
          </p>

          {loadingHistory ? (
            <QuizListSkeleton count={3} />
          ) : pastAttempts.length === 0 ? (
            <EmptyState
              icon={History}
              title="No Past Mock Exams"
              description="You haven't completed any mock CBT exams yet. Test your exam readiness under timed conditions!"
              actionLabel="Take Your First Mock Exam"
              onAction={() => setCurrentScreen('setup')}
            />
          ) : (
            <div className="space-y-3">
              {pastAttempts.map(attempt => {
                const isPass = attempt.passed ?? (attempt.percentage >= 50);
                const dateStr = attempt.submittedAt
                  ? new Date(attempt.submittedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'Earlier attempt';

                return (
                  <div
                    key={attempt.id}
                    className="p-4 rounded-xl bg-[#0A1224] border border-[#24315A] hover:border-[#384A75] flex flex-wrap items-center justify-between gap-3 transition-colors"
                  >
                    <div className="space-y-1 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#FFC700]">
                          {attempt.courseCode}
                        </span>
                        <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${
                          isPass
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        }`}>
                          {isPass ? 'Passed' : 'Needs Practice'}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-[#E6ECFA]">
                        {attempt.courseTitle}
                      </h4>
                      <p className="text-[11px] text-[#9AA8C7]">
                        {dateStr} • {attempt.totalQuestions} Questions • {formatSeconds(attempt.timeUsedSeconds)} used
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-lg font-heading font-black text-[#FFC700]">
                          {attempt.percentage}%
                        </div>
                        <div className="text-[10px] text-[#9AA8C7]">
                          {attempt.score}/{attempt.totalQuestions}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleReviewPastAttempt(attempt)}
                          className="px-3 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeletePastAttempt(attempt.id)}
                          className="p-1.5 rounded-lg bg-[#121C36] hover:bg-rose-900/40 text-[#9AA8C7] hover:text-rose-400 border border-[#24315A] transition-colors cursor-pointer"
                          title="Delete attempt"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
