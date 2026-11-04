/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../lib/firebase';
import { dispatchPushNotification, getDepartmentTopicSlug } from '../lib/pushNotifications';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { QuizItem, QuizQuestion, QuizKeyItem, QuizKeyDoc, QuizAttempt } from '../types';
import { SOT_DEPARTMENTS_LIST } from '../data/departments';
import { parseBulkQuizText, exportQuizResultsToCsv } from '../utils/quizParser';
import {
  FileQuestion,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  Clock,
  Shuffle,
  Eye,
  Download,
  Search,
  Filter,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  X,
  RefreshCw,
  Award,
  Users,
  Check,
  BookOpen
} from 'lucide-react';
import { ShareButton } from './ShareButton';
import { logActivity } from '../lib/activityLogger';

interface AdminQuizzesViewProps {
  userDepartment?: string;
  isRepMode?: boolean;
  adminUid: string;
  adminName: string;
}

const ACADEMIC_LEVELS = ['ND1', 'ND2', 'HND1', 'HND2'] as const;
const SEMESTERS = ['First Semester', 'Second Semester'] as const;

export const AdminQuizzesView: React.FC<AdminQuizzesViewProps> = ({
  userDepartment,
  isRepMode = false,
  adminUid,
  adminName
}) => {
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [deptFilter, setDeptFilter] = useState<string>(
    isRepMode && userDepartment ? userDepartment : 'All'
  );
  const [levelFilter, setLevelFilter] = useState<string>('All');
  const [semesterFilter, setSemesterFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Editor Modal State
  const [showEditor, setShowEditor] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);

  // Form fields
  const [formDept, setFormDept] = useState<string>(
    userDepartment || SOT_DEPARTMENTS_LIST[0]
  );
  const [formLevel, setFormLevel] = useState<string>('ND1');
  const [formSemester, setFormSemester] = useState<string>('First Semester');
  const [formCourseCode, setFormCourseCode] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formTimeLimit, setFormTimeLimit] = useState<string>('15');
  const [formPassingScore, setFormPassingScore] = useState<string>('70');
  const [formAttemptsAllowed, setFormAttemptsAllowed] = useState<string>('0');
  const [formPointsPerQuestion, setFormPointsPerQuestion] = useState<string>('1');
  const [formTopicId, setFormTopicId] = useState<string>('');
  const [formHasTimer, setFormHasTimer] = useState<boolean>(true);
  const [formShuffle, setFormShuffle] = useState<boolean>(true);
  const [formPublished, setFormPublished] = useState<boolean>(true);
  const [notifyStudents, setNotifyStudents] = useState<boolean>(true);

  // Questions and keys draft
  const [draftQuestions, setDraftQuestions] = useState<QuizQuestion[]>([]);
  const [draftKeys, setDraftKeys] = useState<QuizKeyItem[]>([]);

  // Editor question input sub-mode: 'single' | 'bulk'
  const [questionInputMode, setQuestionInputMode] = useState<'single' | 'bulk'>('bulk');

  // Single question input state
  const [singleType, setSingleType] = useState<'multiple-choice' | 'true-false'>('multiple-choice');
  const [singleText, setSingleText] = useState('');
  const [singleOptions, setSingleOptions] = useState<string[]>(['', '', '', '']);
  const [singleCorrectIndex, setSingleCorrectIndex] = useState<number>(0);
  const [singleExplanation, setSingleExplanation] = useState('');
  const [singleWhyNotNotes, setSingleWhyNotNotes] = useState<Record<string, string>>({});
  const [singleError, setSingleError] = useState<string | null>(null);

  // Bulk question input state
  const [bulkText, setBulkText] = useState('');
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string | null>(null);

  // Student view preview toggle in editor
  const [showStudentPreview, setShowStudentPreview] = useState(false);
  const [previewQuestionIndex, setPreviewQuestionIndex] = useState(0);

  // Save state
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Results Modal State
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [selectedQuizForResults, setSelectedQuizForResults] = useState<QuizItem | null>(null);
  const [resultsAttempts, setResultsAttempts] = useState<QuizAttempt[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [resultsSearch, setResultsSearch] = useState('');
  const [availableTopics, setAvailableTopics] = useState<Array<{ id: string; title: string; courseCode?: string; department?: string }>>([]);

  // Fetch quizzes and topics
  const fetchQuizzes = async () => {
    setLoading(true);
    setError(null);
    try {
      const qRef = collection(db, 'quizzes');
      let snap;
      if (isRepMode && userDepartment) {
        snap = await getDocs(query(qRef, where('department', '==', userDepartment)));
      } else {
        snap = await getDocs(qRef);
      }
      const loaded: QuizItem[] = [];
      snap.forEach(d => {
        loaded.push({ id: d.id, ...d.data() } as QuizItem);
      });
      // Sort newest first
      loaded.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setQuizzes(loaded);

      // Fetch topics for linking
      try {
        const topSnap = await getDocs(collection(db, 'topics'));
        const tops: Array<{ id: string; title: string; courseCode?: string; department?: string }> = [];
        topSnap.forEach(tDoc => {
          const tData = tDoc.data() as any;
          tops.push({ id: tDoc.id, title: tData.title, courseCode: tData.courseCode, department: tData.department });
        });
        setAvailableTopics(tops);
      } catch (tErr) {
        console.warn('Could not load topics for linking:', tErr);
      }
    } catch (err: any) {
      console.error('Error fetching quizzes:', err);
      setError(err?.message || 'Failed to load quizzes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, [userDepartment, isRepMode]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingQuizId(null);
    setFormDept(userDepartment || SOT_DEPARTMENTS_LIST[0]);
    setFormLevel('ND1');
    setFormSemester('First Semester');
    setFormCourseCode('');
    setFormTitle('');
    setFormInstructions('Choose the best answer for each question. Click Submit when done.');
    setFormTimeLimit('15');
    setFormPassingScore('70');
    setFormAttemptsAllowed('0');
    setFormPointsPerQuestion('1');
    setFormTopicId('');
    setFormHasTimer(true);
    setFormShuffle(true);
    setFormPublished(true);
    setNotifyStudents(true);
    setDraftQuestions([]);
    setDraftKeys([]);
    setQuestionInputMode('bulk');
    setBulkText('');
    setBulkErrors([]);
    setBulkSuccessMsg(null);
    setSingleType('multiple-choice');
    setSingleText('');
    setSingleOptions(['', '', '', '']);
    setSingleCorrectIndex(0);
    setSingleExplanation('');
    setShowStudentPreview(false);
    setSaveError(null);
    setShowEditor(true);
  };

  // Open Edit Modal
  const handleOpenEdit = async (quiz: QuizItem) => {
    setEditingQuizId(quiz.id);
    setFormDept(quiz.department);
    setFormLevel(quiz.level);
    setFormSemester(quiz.semester);
    setFormCourseCode(quiz.courseCode);
    setFormTitle(quiz.title);
    setFormInstructions(quiz.instructions || '');
    const hasLimit = Boolean(quiz.timeLimit && Number(quiz.timeLimit) > 0);
    const existingLimit = hasLimit ? String(Math.min(180, Math.max(1, Math.round(Number(quiz.timeLimit))))) : '15';
    setFormTimeLimit(existingLimit);
    setFormPassingScore(quiz.passingScore !== undefined ? String(quiz.passingScore) : '70');
    setFormAttemptsAllowed(quiz.attemptsAllowed !== undefined ? String(quiz.attemptsAllowed) : '0');
    setFormPointsPerQuestion(quiz.pointsPerQuestion !== undefined ? String(quiz.pointsPerQuestion) : '1');
    setFormTopicId(quiz.topicId || '');
    setFormHasTimer(hasLimit);
    setFormShuffle(Boolean(quiz.shuffle));
    setFormPublished(quiz.published);
    setDraftQuestions(quiz.questions || []);

    // Fetch keys for this quiz
    try {
      const keyDoc = await getDocs(query(collection(db, 'quizKeys'), where('quizId', '==', quiz.id)));
      if (!keyDoc.empty) {
        const kData = keyDoc.docs[0].data() as QuizKeyDoc;
        setDraftKeys(kData.keys || []);
      } else {
        // Fallback default keys if none exist
        setDraftKeys(
          (quiz.questions || []).map(q => ({
            questionId: q.id,
            correctOptionIndex: 0,
            explanation: 'Correct answer.'
          }))
        );
      }
    } catch {
      setDraftKeys(
        (quiz.questions || []).map(q => ({
          questionId: q.id,
          correctOptionIndex: 0,
          explanation: 'Correct answer.'
        }))
      );
    }

    setQuestionInputMode('single');
    setSingleType('multiple-choice');
    setBulkText('');
    setBulkErrors([]);
    setBulkSuccessMsg(null);
    setShowStudentPreview(false);
    setSaveError(null);
    setShowEditor(true);
  };

  // Toggle Published
  const handleTogglePublish = async (quiz: QuizItem) => {
    const updatedStatus = !quiz.published;
    try {
      await updateDoc(doc(db, 'quizzes', quiz.id), {
        published: updatedStatus,
        updatedAt: new Date().toISOString()
      });
      setQuizzes(prev => prev.map(q => q.id === quiz.id ? { ...q, published: updatedStatus } : q));
    } catch (err: any) {
      alert(`Could not update publish state: ${err?.message || err}`);
    }
  };

  // Delete Quiz
  const handleDeleteQuiz = async (quiz: QuizItem) => {
    if (!confirm(`Are you sure you want to permanently delete quiz "${quiz.title}" (${quiz.courseCode})? All student results will remain in records.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'quizzes', quiz.id));
      // Delete corresponding keys doc
      try {
        await deleteDoc(doc(db, 'quizKeys', quiz.id));
      } catch {}
      setQuizzes(prev => prev.filter(q => q.id !== quiz.id));

      if (auth.currentUser) {
        await logActivity({
          uid: auth.currentUser.uid,
          email: auth.currentUser.email || adminName,
          role: isRepMode ? 'Rep' : 'Admin',
          action: 'Deleted',
          itemType: 'Quiz',
          title: `${quiz.courseCode}: ${quiz.title}`
        });
      }
    } catch (err: any) {
      alert(`Could not delete quiz: ${err?.message || err}`);
    }
  };

  // Handle Add Single Question
  const handleAddSingleQuestion = () => {
    setSingleError(null);
    if (!singleText.trim()) {
      setSingleError('Please enter question text.');
      return;
    }

    const qId = 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    if (singleType === 'true-false') {
      const isTrue = singleCorrectIndex === 0;
      const newQ: QuizQuestion = {
        id: qId,
        type: 'true-false',
        text: singleText.trim(),
        options: ['True', 'False']
      };
      const cleanWhyNot: Record<string, string> = {};
      Object.entries(singleWhyNotNotes).forEach(([k, v]) => {
        if (v && v.trim()) cleanWhyNot[k] = v.trim();
      });

      const newK: QuizKeyItem = {
        questionId: qId,
        correctOptionIndex: singleCorrectIndex,
        explanation: singleExplanation.trim() || (isTrue ? 'True is the correct answer.' : 'False is the correct answer.'),
        whyNotNotes: Object.keys(cleanWhyNot).length > 0 ? cleanWhyNot : undefined
      };

      setDraftQuestions(prev => [...prev, newQ]);
      setDraftKeys(prev => [...prev, newK]);
      setSingleText('');
      setSingleExplanation('');
      setSingleWhyNotNotes({});
      setSingleCorrectIndex(0);
      return;
    }

    const cleanOpts = singleOptions.map(o => o.trim()).filter(Boolean);
    if (cleanOpts.length < 2) {
      setSingleError('Please provide at least 2 non-empty options.');
      return;
    }
    if (singleCorrectIndex >= cleanOpts.length) {
      setSingleError('Please select a valid correct option.');
      return;
    }

    const cleanWhyNot: Record<string, string> = {};
    Object.entries(singleWhyNotNotes).forEach(([k, v]) => {
      if (v && v.trim()) cleanWhyNot[k] = v.trim();
    });

    const newQ: QuizQuestion = {
      id: qId,
      type: 'multiple-choice',
      text: singleText.trim(),
      options: cleanOpts
    };
    const newK: QuizKeyItem = {
      questionId: qId,
      correctOptionIndex: singleCorrectIndex,
      explanation: singleExplanation.trim() || `Option ${String.fromCharCode(65 + singleCorrectIndex)} is correct.`,
      whyNotNotes: Object.keys(cleanWhyNot).length > 0 ? cleanWhyNot : undefined
    };

    setDraftQuestions(prev => [...prev, newQ]);
    setDraftKeys(prev => [...prev, newK]);

    // Reset single question form
    setSingleText('');
    setSingleOptions(['', '', '', '']);
    setSingleCorrectIndex(0);
    setSingleExplanation('');
    setSingleWhyNotNotes({});
  };

  // Explanations count across draft questions
  const explainedCount = useMemo(() => {
    return draftQuestions.filter((q, idx) => {
      const keyItem = draftKeys.find(k => k.questionId === q.id) || draftKeys[idx];
      return Boolean(keyItem?.explanation && keyItem.explanation.trim().length > 0);
    }).length;
  }, [draftQuestions, draftKeys]);

  // Handle Parse Bulk Text
  const handleParseBulk = () => {
    setBulkErrors([]);
    setBulkSuccessMsg(null);
    const { items, errors } = parseBulkQuizText(bulkText);
    if (errors.length > 0) {
      setBulkErrors(errors);
      return;
    }
    if (items.length === 0) {
      setBulkErrors(['No questions could be parsed. Check the syntax guidelines.']);
      return;
    }

    const newQuestions = items.map(i => i.question);
    const newKeys = items.map(i => i.key);

    setDraftQuestions(prev => [...prev, ...newQuestions]);
    setDraftKeys(prev => [...prev, ...newKeys]);

    setBulkSuccessMsg(`Successfully parsed and added ${items.length} question(s)!`);
    setBulkText('');
    setTimeout(() => setBulkSuccessMsg(null), 4000);
  };

  // Remove question from draft
  const handleRemoveDraftQuestion = (index: number) => {
    setDraftQuestions(prev => prev.filter((_, i) => i !== index));
    setDraftKeys(prev => prev.filter((_, i) => i !== index));
  };

  // Save Quiz to Firestore
  const handleSaveQuiz = async () => {
    setSaveError(null);
    if (!formTitle.trim()) {
      setSaveError('Please enter a quiz title.');
      return;
    }
    if (!formCourseCode.trim()) {
      setSaveError('Please enter a course code (e.g. COM 111).');
      return;
    }
    if (draftQuestions.length === 0) {
      setSaveError('Please add at least 1 question to the quiz.');
      return;
    }

    // Block publishing only with a confirmation if some are missing explanations
    const missingExplanationCount = draftQuestions.length - explainedCount;
    if (formPublished && missingExplanationCount > 0) {
      const confirmed = window.confirm(
        `${missingExplanationCount} of ${draftQuestions.length} question(s) have no explanation. Students will not see revision notes for them. Publish anyway?`
      );
      if (!confirmed) {
        return;
      }
    }

    setSavingQuiz(true);
    const quizId = editingQuizId || ('quiz_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));

    try {
      let finalTimeLimit = 0;
      if (formHasTimer) {
        const parsed = Number(formTimeLimit);
        if (!formTimeLimit || isNaN(parsed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 180) {
          setSaveError('Time limit must be a whole number between 1 and 180 minutes.');
          setSavingQuiz(false);
          return;
        }
        finalTimeLimit = parsed;
      }

      const parsedPassing = Number(formPassingScore);
      const passingScore = !isNaN(parsedPassing) ? Math.min(100, Math.max(1, Math.round(parsedPassing))) : 70;
      const parsedAttempts = Number(formAttemptsAllowed);
      const attemptsAllowed = !isNaN(parsedAttempts) && parsedAttempts >= 0 ? Math.round(parsedAttempts) : 0;
      const parsedPoints = Number(formPointsPerQuestion);
      const pointsPerQuestion = !isNaN(parsedPoints) && parsedPoints >= 1 ? Math.round(parsedPoints) : 1;

      const now = new Date().toISOString();
      const quizPayload: QuizItem = {
        id: quizId,
        department: formDept,
        level: formLevel,
        semester: formSemester,
        courseCode: formCourseCode.trim().toUpperCase(),
        title: formTitle.trim(),
        instructions: formInstructions.trim(),
        timeLimit: finalTimeLimit,
        shuffle: formShuffle,
        published: formPublished,
        questionCount: draftQuestions.length,
        questions: draftQuestions, // Questions with options only, NO correct answers!
        topicId: formTopicId.trim() || undefined,
        passingScore,
        attemptsAllowed,
        pointsPerQuestion,
        createdBy: adminUid,
        createdByName: adminName,
        createdAt: editingQuizId
          ? (quizzes.find(q => q.id === editingQuizId)?.createdAt || now)
          : now,
        updatedAt: now
      };

      // 1. Save Quiz doc
      await setDoc(doc(db, 'quizzes', quizId), quizPayload);

      // 2. Save Quiz Keys doc (separate document to prevent cheating)
      const keysPayload: QuizKeyDoc = {
        id: quizId,
        quizId,
        department: formDept,
        keys: draftKeys,
        updatedAt: now
      };
      await setDoc(doc(db, 'quizKeys', quizId), keysPayload);

      // Update local state
      if (editingQuizId) {
        setQuizzes(prev => prev.map(q => q.id === quizId ? quizPayload : q));
      } else {
        setQuizzes(prev => [quizPayload, ...prev]);
      }

      if (auth.currentUser) {
        await logActivity({
          uid: auth.currentUser.uid,
          email: auth.currentUser.email || adminName,
          role: isRepMode ? 'Rep' : 'Admin',
          action: editingQuizId ? 'Updated' : 'Created',
          itemType: 'Quiz',
          title: `${quizPayload.courseCode}: ${quizPayload.title}`
        });
      }

      if (formPublished && notifyStudents) {
        try {
          const topic = `dept-${getDepartmentTopicSlug(formDept)}-${formLevel.toLowerCase()}`;
          await dispatchPushNotification(
            {
              topic,
              title: `New Quiz: ${quizPayload.courseCode}`,
              body: `${quizPayload.title} (${quizPayload.questionCount} questions)`,
              link: '/dashboard?tab=quizzes'
            },
            auth.currentUser
          );
        } catch (pushErr) {
          console.warn('Push notification dispatch notice (non-fatal):', pushErr);
        }
      }

      setShowEditor(false);
    } catch (err: any) {
      console.error('Failed to save quiz:', err);
      setSaveError(err?.message || 'Failed to save quiz to Firestore.');
    } finally {
      setSavingQuiz(false);
    }
  };

  // Open Results View
  const handleOpenResults = async (quiz: QuizItem) => {
    setSelectedQuizForResults(quiz);
    setShowResultsModal(true);
    setLoadingResults(true);
    try {
      const attSnap = await getDocs(
        query(collection(db, 'quizAttempts'), where('quizId', '==', quiz.id))
      );
      const list: QuizAttempt[] = [];
      attSnap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as QuizAttempt);
      });
      // Sort highest score first, then newest
      list.sort((a, b) => b.score - a.score || new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setResultsAttempts(list);
    } catch (err: any) {
      console.error('Failed to load quiz attempts:', err);
    } finally {
      setLoadingResults(false);
    }
  };

  // Delete / Reset a student's quiz attempt record
  const handleDeleteAttempt = async (attempt: QuizAttempt) => {
    if (
      !confirm(
        `Permanently delete quiz attempt for "${attempt.studentName || 'Student'}" (${attempt.score}/${attempt.total || 1})?\n\nThis will reset their record and allow them to take the quiz again.`
      )
    ) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'quizAttempts', attempt.id));
      setResultsAttempts(prev => prev.filter(a => a.id !== attempt.id));
    } catch (err: any) {
      alert(`Failed to delete quiz attempt: ${err?.message || err}`);
    }
  };

  // Filtered quizzes for main table/cards
  const filteredQuizzes = useMemo(() => {
    return quizzes.filter(q => {
      const matchDept = deptFilter === 'All' || q.department === deptFilter;
      const matchLevel = levelFilter === 'All' || q.level === levelFilter;
      const matchSem = semesterFilter === 'All' || q.semester === semesterFilter;
      const matchSearch =
        !searchQuery.trim() ||
        q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.courseCode.toLowerCase().includes(searchQuery.toLowerCase());
      return matchDept && matchLevel && matchSem && matchSearch;
    });
  }, [quizzes, deptFilter, levelFilter, semesterFilter, searchQuery]);

  // Results computed stats
  const resultsStats = useMemo(() => {
    if (resultsAttempts.length === 0) {
      return { totalStudents: 0, totalAttempts: 0, avgScore: 0, avgPct: 0, maxScore: 0 };
    }
    const totalStudents = resultsAttempts.length;
    const totalAttempts = resultsAttempts.reduce((acc, a) => acc + (a.attempts || 1), 0);
    const sumScore = resultsAttempts.reduce((acc, a) => acc + (a.score || 0), 0);
    const totalQ = selectedQuizForResults?.questionCount || resultsAttempts[0]?.total || 1;
    const avgScore = sumScore / totalStudents;
    const avgPct = Math.round((avgScore / totalQ) * 100);
    const maxScore = Math.max(...resultsAttempts.map(a => a.bestScore ?? a.score ?? 0));

    return { totalStudents, totalAttempts, avgScore: Math.round(avgScore * 10) / 10, avgPct, maxScore };
  }, [resultsAttempts, selectedQuizForResults]);

  // Filtered results
  const filteredResultsAttempts = useMemo(() => {
    if (!resultsSearch.trim()) return resultsAttempts;
    const query = resultsSearch.toLowerCase();
    return resultsAttempts.filter(
      a =>
        (a.studentName && a.studentName.toLowerCase().includes(query)) ||
        (a.matricNumber && a.matricNumber.toLowerCase().includes(query))
    );
  }, [resultsAttempts, resultsSearch]);

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#FFC700]/40 flex items-center justify-center text-[#FFC700]">
            <FileQuestion className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-[#E6ECFA] flex items-center gap-2">
              <span>Multiple Choice Quizzes</span>
              {isRepMode && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/40">
                  {userDepartment} Rep
                </span>
              )}
            </h2>
            <p className="text-xs text-[#9AA8C7]">
              Create, publish, and evaluate practice quizzes (Google Forms style, instant auto-scoring)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchQuizzes}
            title="Refresh quizzes"
            className="p-2 rounded-xl bg-[#0A1224] border border-[#24315A] text-[#9AA8C7] hover:text-[#E6ECFA] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#FFC700]' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2F52FF] hover:bg-[#4364FF] text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Quiz</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="p-3.5 rounded-2xl bg-[#121C36] border border-[#24315A] shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Department Filter (Admin can choose all, Rep is locked) */}
          {!isRepMode && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[#9AA8C7] text-[11px] font-semibold">Dept:</span>
              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs font-bold text-[#FFC700] focus:outline-none focus:border-[#2F52FF]"
              >
                <option value="All">All Departments</option>
                {SOT_DEPARTMENTS_LIST.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          {/* Level Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-[#9AA8C7] text-[11px] font-semibold">Level:</span>
            <select
              value={levelFilter}
              onChange={e => setLevelFilter(e.target.value)}
              className="px-2 py-1 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs font-bold text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
            >
              <option value="All">All Levels</option>
              {ACADEMIC_LEVELS.map(lvl => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-[#9AA8C7] text-[11px] font-semibold">Sem:</span>
            <select
              value={semesterFilter}
              onChange={e => setSemesterFilter(e.target.value)}
              className="px-2 py-1 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs font-bold text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
            >
              <option value="All">All Semesters</option>
              {SEMESTERS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative min-w-[200px]">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by title or course code..."
            className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/60 focus:outline-none focus:border-[#2F52FF]"
          />
          <Search className="w-3.5 h-3.5 text-[#9AA8C7] absolute left-2.5 top-2.5" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-[#9AA8C7] hover:text-[#E6ECFA]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
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
            <h3 className="font-heading font-bold text-sm text-[#E6ECFA]">No Quizzes Found</h3>
            <p className="text-xs text-[#9AA8C7] mt-0.5 max-w-sm mx-auto">
              {quizzes.length === 0
                ? 'No quizzes have been created yet. Click "New Quiz" to set up your first multiple choice assessment.'
                : 'No quizzes matched your selected filters or search keyword.'}
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-[#2F52FF] text-white font-bold text-xs hover:bg-[#4364FF] transition-colors cursor-pointer"
          >
            Create New Quiz
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredQuizzes.map(quiz => (
            <div
              key={quiz.id}
              className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF]/60 transition-all shadow-sm flex flex-col justify-between gap-3"
            >
              <div>
                {/* Badges Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
                      {quiz.courseCode}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0A1224] text-[#60A5FA] border border-[#24315A]">
                      {quiz.level}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#0A1224] text-[#9AA8C7] border border-[#24315A]">
                      {quiz.semester === 'First Semester' ? '1st Sem' : '2nd Sem'}
                    </span>
                  </div>

                  {/* Published Toggle Badge */}
                  <button
                    onClick={() => handleTogglePublish(quiz)}
                    title={quiz.published ? 'Click to unpublish' : 'Click to publish'}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                      quiz.published
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${quiz.published ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                    {quiz.published ? 'Published' : 'Draft'}
                  </button>
                </div>

                {/* Title & Department */}
                <h3 className="font-heading font-bold text-sm text-[#E6ECFA] line-clamp-2">
                  {quiz.title}
                </h3>
                <p className="text-[11px] text-[#9AA8C7] mt-0.5 line-clamp-1">
                  {quiz.department}
                </p>

                {/* Metadata Pills */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#9AA8C7] mt-3 pt-2.5 border-t border-[#24315A]/60">
                  <span className="flex items-center gap-1">
                    <FileQuestion className="w-3.5 h-3.5 text-[#2F52FF]" />
                    <strong className="text-[#E6ECFA]">{quiz.questionCount || quiz.questions?.length || 0}</strong> questions
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#FFC700]" />
                    {quiz.timeLimit && quiz.timeLimit > 0 ? `${quiz.timeLimit} mins` : 'No timer'}
                  </span>
                  {quiz.shuffle && (
                    <span className="flex items-center gap-1 text-[10px] text-[#60A5FA]">
                      <Shuffle className="w-3 h-3" />
                      Shuffled
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="pt-2 border-t border-[#24315A]/60 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleOpenResults(quiz)}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-[#0A1224] hover:bg-[#1A2E63] border border-[#24315A] hover:border-[#2F52FF] text-xs font-bold text-[#E6ECFA] hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5 text-[#FFC700]" />
                  <span>Results</span>
                </button>

                <ShareButton
                  title={`${quiz.courseCode}: ${quiz.title}`}
                  itemType="quiz"
                  id={quiz.id}
                  textDetails={`${quiz.questionCount || quiz.questions?.length || 0} Questions`}
                  variant="icon"
                />

                <button
                  onClick={() => handleOpenEdit(quiz)}
                  title="Edit quiz details & questions"
                  className="p-1.5 rounded-xl bg-[#0A1224] hover:bg-[#1A2E63] border border-[#24315A] text-[#9AA8C7] hover:text-[#FFC700] transition-colors cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDeleteQuiz(quiz)}
                  title="Delete quiz"
                  className="p-1.5 rounded-xl bg-[#0A1224] hover:bg-rose-950/40 border border-[#24315A] hover:border-rose-700/60 text-[#9AA8C7] hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: QUIZ EDITOR (CREATE / EDIT)                     */}
      {/* ======================================================== */}
      {showEditor && (
        <div className="fixed inset-0 z-50 bg-[#0A1224]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-[#121C36] border border-[#24315A] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#24315A] flex items-center justify-between bg-[#0A1224]/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#121C36] border border-[#FFC700]/50 flex items-center justify-center text-[#FFC700]">
                  <FileQuestion className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-[#E6ECFA]">
                    {editingQuizId ? 'Edit Quiz' : 'Create Multiple Choice Quiz'}
                  </h3>
                  <p className="text-[10px] text-[#9AA8C7]">
                    Configure parameters and add multiple choice questions
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditor(false)}
                className="p-1.5 rounded-lg bg-[#121C36] text-[#9AA8C7] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {saveError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* 1. QUIZ METADATA SECTION */}
              <div className="p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-3">
                <span className="text-[10px] uppercase font-bold text-[#FFC700] tracking-wider block">
                  1. Quiz Details &amp; Settings
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  {/* Department */}
                  <div>
                    <label className="text-[11px] text-[#9AA8C7] block mb-1 font-semibold">Department</label>
                    {isRepMode ? (
                      <input
                        type="text"
                        disabled
                        value={userDepartment}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs font-bold text-[#FFC700] cursor-not-allowed opacity-80"
                      />
                    ) : (
                      <select
                        value={formDept}
                        onChange={e => setFormDept(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs font-bold text-[#FFC700] focus:outline-none focus:border-[#2F52FF]"
                      >
                        {SOT_DEPARTMENTS_LIST.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Level */}
                  <div>
                    <label className="text-[11px] text-[#9AA8C7] block mb-1 font-semibold">Level</label>
                    <select
                      value={formLevel}
                      onChange={e => setFormLevel(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs font-bold text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                    >
                      {ACADEMIC_LEVELS.map(lvl => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                      ))}
                    </select>
                  </div>

                  {/* Semester */}
                  <div>
                    <label className="text-[11px] text-[#9AA8C7] block mb-1 font-semibold">Semester</label>
                    <select
                      value={formSemester}
                      onChange={e => setFormSemester(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs font-bold text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                    >
                      {SEMESTERS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Course Code */}
                  <div>
                    <label className="text-[11px] text-[#9AA8C7] block mb-1 font-semibold">Course Code</label>
                    <input
                      type="text"
                      value={formCourseCode}
                      onChange={e => setFormCourseCode(e.target.value.toUpperCase())}
                      placeholder="e.g. COM 111"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs font-bold text-[#FFC700] uppercase placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                    />
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="text-[11px] text-[#9AA8C7] block mb-1 font-semibold">Quiz Title</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="e.g. Test 1: Operating Systems & Computer Fundamentals"
                    className="w-full px-3 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>

                {/* Instructions */}
                <div>
                  <label className="text-[11px] text-[#9AA8C7] block mb-1 font-semibold">Instructions (Optional)</label>
                  <textarea
                    rows={2}
                    value={formInstructions}
                    onChange={e => setFormInstructions(e.target.value)}
                    placeholder="e.g. Answer all questions. Questions will be submitted automatically when time runs out."
                    className="w-full px-3 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>

                {/* Additional Quiz Parameters (Passing score, attempts, points, topic link) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-[#24315A]/60">
                  <div>
                    <label className="text-[11px] text-[#9AA8C7] block mb-1 font-semibold">Passing Score (%)</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={formPassingScore}
                        onChange={e => setFormPassingScore(e.target.value)}
                        placeholder="70"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs font-bold text-[#FFC700] text-center focus:outline-none focus:border-[#2F52FF]"
                      />
                      <span className="text-xs text-[#9AA8C7] font-semibold">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-[#9AA8C7] block mb-1 font-semibold">Attempts Allowed</label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={formAttemptsAllowed}
                      onChange={e => setFormAttemptsAllowed(e.target.value)}
                      placeholder="0 (Unlimited)"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs font-bold text-[#E6ECFA] text-center focus:outline-none focus:border-[#2F52FF]"
                    />
                    <span className="text-[9px] text-[#9AA8C7] block mt-0.5">0 = Unlimited retakes</span>
                  </div>

                  <div>
                    <label className="text-[11px] text-[#9AA8C7] block mb-1 font-semibold">Points / Question</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={formPointsPerQuestion}
                      onChange={e => setFormPointsPerQuestion(e.target.value)}
                      placeholder="1"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs font-bold text-[#60A5FA] text-center focus:outline-none focus:border-[#2F52FF]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-[#9AA8C7] block mb-1 font-semibold">Link to Topic (Optional)</label>
                    <select
                      value={formTopicId}
                      onChange={e => setFormTopicId(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs font-bold text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                    >
                      <option value="">No linked topic</option>
                      {availableTopics
                        .filter(t => !formDept || !t.department || t.department === formDept)
                        .map(top => (
                          <option key={top.id} value={top.id}>
                            {top.courseCode ? `${top.courseCode}: ` : ''}{top.title}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Timer & Shuffle row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#24315A]/60">
                  <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-[#0A1224]/70 border border-[#24315A]/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="hasTimerCheck"
                          checked={formHasTimer}
                          onChange={e => {
                            setFormHasTimer(e.target.checked);
                            if (e.target.checked && (!formTimeLimit || Number(formTimeLimit) < 1)) {
                              setFormTimeLimit('15');
                            }
                          }}
                          className="w-4 h-4 rounded text-[#2F52FF] bg-[#121C36] border-[#24315A] cursor-pointer"
                        />
                        <label htmlFor="hasTimerCheck" className="text-xs text-[#E6ECFA] font-bold cursor-pointer flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#FFC700]" />
                          <span>Time limit</span>
                        </label>
                      </div>
                      <span className="text-[10px] text-[#9AA8C7]">1 - 180 mins</span>
                    </div>

                    {formHasTimer && (
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            max={180}
                            step={1}
                            value={formTimeLimit}
                            onChange={e => setFormTimeLimit(e.target.value)}
                            onBlur={() => {
                              if (!formTimeLimit || isNaN(Number(formTimeLimit))) {
                                setFormTimeLimit('15');
                              } else {
                                const clamped = Math.min(180, Math.max(1, Math.round(Number(formTimeLimit))));
                                setFormTimeLimit(String(clamped));
                              }
                            }}
                            placeholder="15"
                            className="w-16 px-2 py-1 rounded-lg bg-[#121C36] border border-[#24315A] text-xs text-center font-bold text-[#FFC700] focus:outline-none focus:border-[#2F52FF]"
                          />
                          <span className="text-xs text-[#9AA8C7] font-medium">mins</span>
                        </div>
                        <div className="flex items-center gap-1 ml-auto">
                          {[10, 15, 30, 60, 90].map(mins => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => setFormTimeLimit(String(mins))}
                              className={`px-1.5 py-0.5 text-[10px] rounded font-bold transition-colors cursor-pointer ${
                                formTimeLimit === String(mins)
                                    ? 'bg-[#FFC700] text-[#0A1224]'
                                    : 'bg-[#121C36] text-[#9AA8C7] hover:text-white'
                              }`}
                            >
                              {mins}m
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="shuffleCheck"
                      checked={formShuffle}
                      onChange={e => setFormShuffle(e.target.checked)}
                      className="w-4 h-4 rounded text-[#2F52FF] bg-[#121C36] border-[#24315A] cursor-pointer"
                    />
                    <label htmlFor="shuffleCheck" className="text-xs text-[#E6ECFA] font-medium cursor-pointer">
                      Shuffle questions
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="publishCheck"
                      checked={formPublished}
                      onChange={e => setFormPublished(e.target.checked)}
                      className="w-4 h-4 rounded text-[#2F52FF] bg-[#121C36] border-[#24315A] cursor-pointer"
                    />
                    <label htmlFor="publishCheck" className="text-xs text-[#E6ECFA] font-medium cursor-pointer">
                      Publish immediately
                    </label>
                  </div>
                </div>

                {formPublished && (
                  <div className="flex items-center gap-2 pt-2 border-t border-[#24315A]/60">
                    <input
                      type="checkbox"
                      id="quizNotifyCheck"
                      checked={notifyStudents}
                      onChange={e => setNotifyStudents(e.target.checked)}
                      className="w-4 h-4 rounded text-[#2F52FF] bg-[#121C36] border-[#24315A] cursor-pointer"
                    />
                    <label htmlFor="quizNotifyCheck" className="text-xs text-[#E6ECFA] font-medium cursor-pointer">
                      Notify students (Push alert to {formDept} {formLevel})
                    </label>
                  </div>
                )}
              </div>

              {/* 2. ADD QUESTIONS SECTION */}
              <div className="p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[#2F52FF] tracking-wider block">
                    2. Add Quiz Questions ({draftQuestions.length} added)
                  </span>

                  {/* Mode switcher: One by one vs Bulk */}
                  <div className="flex items-center p-0.5 rounded-lg bg-[#121C36] border border-[#24315A]">
                    <button
                      type="button"
                      onClick={() => setQuestionInputMode('bulk')}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                        questionInputMode === 'bulk'
                          ? 'bg-[#2F52FF] text-white shadow-sm'
                          : 'text-[#9AA8C7] hover:text-white'
                      }`}
                    >
                      Add Many at Once (Bulk)
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionInputMode('single')}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                        questionInputMode === 'single'
                          ? 'bg-[#2F52FF] text-white shadow-sm'
                          : 'text-[#9AA8C7] hover:text-white'
                      }`}
                    >
                      Add One by One
                    </button>
                  </div>
                </div>

                {/* BULK IMPORT FORM */}
                {questionInputMode === 'bulk' && (
                  <div className="space-y-2.5 pt-1">
                    <div className="p-2.5 rounded-lg bg-[#121C36]/80 border border-[#24315A] text-[11px] text-[#9AA8C7] space-y-1">
                      <span className="font-bold text-[#FFC700] block">Format Guidelines (Multi-line explanations &amp; 'Why not B' notes supported):</span>
                      <pre className="font-mono text-[10px] text-[#E6ECFA] p-2 rounded bg-[#0A1224] border border-[#24315A]/60 whitespace-pre-wrap leading-relaxed">
{`Q: Which device operates at the Network Layer of the OSI Model?
A) Switch  B) Router  C) Hub  D) Repeater
Answer: B
Explanation: Routers forward data packets across logical networks using IP addressing.
They determine optimal routing paths between distinct subnets.
• Layer 3 header processing
• **IP Routing** table lookups
Why not A: Switches operate at the Data Link Layer (Layer 2).
Why not C: Hubs are physical layer repeaters (Layer 1).

Q: A stack follows the LIFO principle.
Type: True/False
Answer: True
Explanation: Last In, First Out. Elements placed last are retrieved first.
Why not False: Queues follow FIFO, whereas stacks are strictly LIFO.`}
                      </pre>
                      <p className="text-[10px] text-[#9AA8C7]/80">
                        * The Explanation continues on following lines until the next Q:. Optional wrong-option notes start with "Why not A:", "Why not B:", etc. Mixed Multiple Choice and True/False questions are fully supported.
                      </p>
                    </div>

                    <textarea
                      rows={7}
                      value={bulkText}
                      onChange={e => setBulkText(e.target.value)}
                      placeholder={`Paste questions here following the format above...`}
                      className="w-full px-3 py-2 rounded-xl bg-[#121C36] border border-[#24315A] text-xs font-mono text-[#E6ECFA] placeholder-[#9AA8C7]/40 focus:outline-none focus:border-[#2F52FF]"
                    />

                    {bulkErrors.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-[11px] space-y-1">
                        <span className="font-bold block text-rose-400">Parsing errors found:</span>
                        <ul className="list-disc list-inside space-y-0.5">
                          {bulkErrors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {bulkSuccessMsg && (
                      <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>{bulkSuccessMsg}</span>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleParseBulk}
                        disabled={!bulkText.trim()}
                        className="px-4 py-2 rounded-xl bg-[#2F52FF] hover:bg-[#4364FF] disabled:opacity-50 text-white font-bold text-xs cursor-pointer transition-colors"
                      >
                        Parse &amp; Add Questions
                      </button>
                    </div>
                  </div>
                )}

                {/* SINGLE QUESTION FORM */}
                {questionInputMode === 'single' && (
                  <div className="space-y-3 pt-1">
                    {singleError && (
                      <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                        {singleError}
                      </div>
                    )}

                    {/* Question Type Switcher */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#9AA8C7] font-semibold">Question Type:</span>
                      <div className="flex items-center p-0.5 rounded-lg bg-[#121C36] border border-[#24315A]">
                        <button
                          type="button"
                          onClick={() => setSingleType('multiple-choice')}
                          className={`px-3 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                            singleType === 'multiple-choice'
                              ? 'bg-[#2F52FF] text-white shadow-sm'
                              : 'text-[#9AA8C7] hover:text-white'
                          }`}
                        >
                          Multiple Choice
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSingleType('true-false');
                            setSingleCorrectIndex(0);
                          }}
                          className={`px-3 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                            singleType === 'true-false'
                              ? 'bg-[#2F52FF] text-white shadow-sm'
                              : 'text-[#9AA8C7] hover:text-white'
                          }`}
                        >
                          True / False
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-[#9AA8C7] block mb-1 font-semibold">Question Text</label>
                      <input
                        type="text"
                        value={singleText}
                        onChange={e => setSingleText(e.target.value)}
                        placeholder={
                          singleType === 'true-false'
                            ? 'e.g. A stack follows the Last In, First Out (LIFO) principle.'
                            : 'e.g. Which of the following is an input device?'
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                      />
                    </div>

                    {/* True / False Selection Buttons */}
                    {singleType === 'true-false' ? (
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-[#9AA8C7] font-semibold">Correct Answer (Click to select)</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setSingleCorrectIndex(0)}
                            className={`p-3 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${
                              singleCorrectIndex === 0
                                ? 'bg-emerald-600/25 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                                : 'bg-[#121C36] border-[#24315A] text-[#9AA8C7] hover:text-white'
                            }`}
                          >
                            <span>True</span>
                            {singleCorrectIndex === 0 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => setSingleCorrectIndex(1)}
                            className={`p-3 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${
                              singleCorrectIndex === 1
                                ? 'bg-emerald-600/25 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                                : 'bg-[#121C36] border-[#24315A] text-[#9AA8C7] hover:text-white'
                            }`}
                          >
                            <span>False</span>
                            {singleCorrectIndex === 1 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Multiple Choice Options (2 to 6) */
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] text-[#9AA8C7] font-semibold">Options &amp; Correct Answer</label>
                          <div className="flex items-center gap-1.5">
                            {singleOptions.length < 6 && (
                              <button
                                type="button"
                                onClick={() => setSingleOptions(prev => [...prev, ''])}
                                className="text-[10px] font-bold text-[#60A5FA] hover:text-white"
                              >
                                + Add Option
                              </button>
                            )}
                            {singleOptions.length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSingleOptions(prev => prev.slice(0, prev.length - 1));
                                  if (singleCorrectIndex >= singleOptions.length - 1) {
                                    setSingleCorrectIndex(0);
                                  }
                                }}
                                className="text-[10px] font-bold text-rose-400 hover:text-white ml-2"
                              >
                                - Remove Option
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {singleOptions.map((opt, optIdx) => {
                            const letter = String.fromCharCode(65 + optIdx);
                            const isCorrect = singleCorrectIndex === optIdx;
                            return (
                              <div
                                key={optIdx}
                                className={`p-2 rounded-lg border flex items-center gap-2 transition-colors ${
                                  isCorrect
                                    ? 'bg-emerald-950/20 border-emerald-500/50'
                                    : 'bg-[#121C36] border-[#24315A]'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setSingleCorrectIndex(optIdx)}
                                  title={`Mark ${letter} as correct`}
                                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer ${
                                    isCorrect
                                      ? 'bg-emerald-500 text-white shadow-sm'
                                      : 'bg-[#0A1224] text-[#9AA8C7] border border-[#24315A]'
                                  }`}
                                >
                                  {letter}
                                </button>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setSingleOptions(prev => {
                                      const next = [...prev];
                                      next[optIdx] = val;
                                      return next;
                                    });
                                  }}
                                  placeholder={`Option ${letter}`}
                                  className="flex-1 bg-transparent text-xs text-[#E6ECFA] focus:outline-none"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Explanation (Multi-line) */}
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <label className="text-[11px] text-[#9AA8C7] font-semibold">
                          Explanation (Why this answer is correct)
                        </label>
                        <span className="text-[10px] text-[#FFC700]">
                          Line breaks, bullets (• or -) and **bold** are kept
                        </span>
                      </div>

                      {!singleExplanation.trim() && (
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>No explanation written yet. Questions without explanations will trigger a warning.</span>
                        </div>
                      )}

                      <textarea
                        rows={4}
                        value={singleExplanation}
                        onChange={e => setSingleExplanation(e.target.value)}
                        placeholder="e.g. A stack operates on a Last In, First Out (LIFO) basis because elements inserted last are popped first.&#10;&#10;Key points:&#10;• Insertion and deletion happen at the top&#10;• **Push** adds an element, **Pop** removes it"
                        className="w-full px-3 py-2 rounded-lg bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF] leading-relaxed"
                      />
                    </div>

                    {/* Optional Wrong-Option Notes ('Why not B' style notes) */}
                    <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-2">
                      <span className="text-[11px] font-bold text-[#60A5FA] block">
                        Optional: Wrong-Option Notes ('Why not B' notes)
                      </span>
                      <p className="text-[10px] text-[#9AA8C7]">
                        Explain specifically why wrong options are incorrect so students learn from their mistakes.
                      </p>

                      <div className="space-y-2 pt-1">
                        {singleType === 'true-false' ? (
                          (() => {
                            const wrongLabel = singleCorrectIndex === 0 ? 'False' : 'True';
                            const wrongKey = wrongLabel.toUpperCase();
                            return (
                              <div className="space-y-1">
                                <label className="text-[10px] text-[#9AA8C7] font-bold">
                                  Why not {wrongLabel}:
                                </label>
                                <input
                                  type="text"
                                  value={singleWhyNotNotes[wrongKey] || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setSingleWhyNotNotes(prev => ({
                                      ...prev,
                                      [wrongKey]: val
                                    }));
                                  }}
                                  placeholder={`e.g. The statement is not ${wrongLabel} because...`}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                                />
                              </div>
                            );
                          })()
                        ) : (
                          singleOptions.map((opt, optIdx) => {
                            if (optIdx === singleCorrectIndex) return null;
                            const letter = String.fromCharCode(65 + optIdx);
                            return (
                              <div key={optIdx} className="space-y-1">
                                <label className="text-[10px] text-[#9AA8C7] font-bold">
                                  Why not {letter} ({opt || `Option ${letter}`}):
                                </label>
                                <input
                                  type="text"
                                  value={singleWhyNotNotes[letter] || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setSingleWhyNotNotes(prev => ({
                                      ...prev,
                                      [letter]: val
                                    }));
                                  }}
                                  placeholder={`e.g. Option ${letter} describes a queue rather than a stack.`}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                                />
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddSingleQuestion}
                        className="px-4 py-2 rounded-xl bg-[#2F52FF] hover:bg-[#4364FF] text-white font-bold text-xs cursor-pointer shadow-sm transition-all"
                      >
                        Add Question to List
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. PREVIEW & MANAGE QUESTIONS */}
              {draftQuestions.length > 0 && (
                <div className="p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#24315A] pb-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#FFC700] tracking-wider block">
                        3. Questions Review ({draftQuestions.length} Questions)
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold text-[#E6ECFA]">
                          {explainedCount} of {draftQuestions.length} questions have explanations
                        </span>
                        {explainedCount < draftQuestions.length && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40">
                            ⚠️ {draftQuestions.length - explainedCount} missing
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowStudentPreview(!showStudentPreview)}
                      className="px-2.5 py-1 rounded-lg bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] text-[#E6ECFA] text-xs font-semibold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#2F52FF]" />
                      <span>{showStudentPreview ? 'Show Editor List' : 'Student Mode Preview'}</span>
                    </button>
                  </div>

                  {/* STUDENT PREVIEW MODE */}
                  {showStudentPreview ? (
                    <div className="p-4 rounded-xl bg-[#121C36] border border-[#2F52FF]/40 space-y-3">
                      <div className="flex items-center justify-between border-b border-[#24315A] pb-2 text-[11px] text-[#9AA8C7]">
                        <span className="font-bold text-[#FFC700]">
                          Student Preview (Question {previewQuestionIndex + 1} of {draftQuestions.length})
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={previewQuestionIndex === 0}
                            onClick={() => setPreviewQuestionIndex(prev => Math.max(0, prev - 1))}
                            className="p-1 rounded bg-[#0A1224] disabled:opacity-30"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={previewQuestionIndex >= draftQuestions.length - 1}
                            onClick={() => setPreviewQuestionIndex(prev => Math.min(draftQuestions.length - 1, prev + 1))}
                            className="p-1 rounded bg-[#0A1224] disabled:opacity-30"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {draftQuestions[previewQuestionIndex] && (
                        <div className="space-y-3">
                          <h4 className="font-heading font-bold text-sm text-[#E6ECFA]">
                            {previewQuestionIndex + 1}. {draftQuestions[previewQuestionIndex].text}
                          </h4>
                          <div className="space-y-2">
                            {draftQuestions[previewQuestionIndex].options.map((opt, oIdx) => (
                              <div
                                key={oIdx}
                                className="p-2.5 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center gap-2.5 text-xs text-[#E6ECFA]"
                              >
                                <span className="w-6 h-6 rounded-full bg-[#121C36] border border-[#24315A] flex items-center justify-center font-bold text-xs text-[#9AA8C7]">
                                  {String.fromCharCode(65 + oIdx)}
                                </span>
                                <span>{opt}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* LIST OF DRAFT QUESTIONS */
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {draftQuestions.map((q, idx) => {
                        const keyItem = draftKeys.find(k => k.questionId === q.id) || draftKeys[idx];
                        const correctIdx = keyItem ? keyItem.correctOptionIndex : 0;
                        const hasExplanation = Boolean(keyItem?.explanation && keyItem.explanation.trim().length > 0);
                        const hasWhyNotNotes = Boolean(keyItem?.whyNotNotes && Object.keys(keyItem.whyNotNotes).length > 0);

                        return (
                          <div
                            key={q.id || idx}
                            className={`p-3 rounded-xl bg-[#121C36] border flex items-start justify-between gap-3 text-xs ${
                              hasExplanation ? 'border-[#24315A]' : 'border-amber-500/40 bg-amber-500/5'
                            }`}
                          >
                            <div className="space-y-1.5 flex-1">
                              <h5 className="font-bold text-[#E6ECFA] flex items-baseline gap-1.5">
                                <span className="text-[#FFC700] font-mono">{idx + 1}.</span>
                                <span>{q.text}</span>
                              </h5>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                                {q.options.map((opt, oIdx) => {
                                  const isCorrect = correctIdx === oIdx;
                                  return (
                                    <div
                                      key={oIdx}
                                      className={`px-2 py-0.5 rounded flex items-center gap-1.5 ${
                                        isCorrect
                                          ? 'bg-emerald-950/40 text-emerald-300 font-bold border border-emerald-500/30'
                                          : 'text-[#9AA8C7]'
                                      }`}
                                    >
                                      <span className="font-mono">{String.fromCharCode(65 + oIdx)})</span>
                                      <span className="truncate">{opt}</span>
                                      {isCorrect && <Check className="w-3 h-3 text-emerald-400 ml-auto" />}
                                    </div>
                                  );
                                })}
                              </div>

                              {hasExplanation ? (
                                <div className="text-[10px] text-[#9AA8C7] bg-[#0A1224] p-2 rounded-lg border border-[#24315A]/70 space-y-1">
                                  <p className="whitespace-pre-line text-[#E6ECFA]">
                                    <strong className="text-[#FFC700]">Explanation: </strong>
                                    {keyItem.explanation}
                                  </p>
                                  {hasWhyNotNotes && (
                                    <div className="pt-1 border-t border-[#24315A]/60 space-y-0.5">
                                      {Object.entries(keyItem.whyNotNotes!).map(([k, note]) => (
                                        <p key={k} className="text-[#9AA8C7]">
                                          <strong className="text-[#60A5FA]">Why not {k}: </strong>
                                          {note}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px]">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span className="font-semibold">⚠️ No explanation provided for this question</span>
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveDraftQuestion(idx)}
                              title="Delete question"
                              className="p-1 rounded bg-[#0A1224] text-zinc-400 hover:text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-[#24315A] bg-[#0A1224]/90 flex items-center justify-between">
              <span className="text-xs text-[#9AA8C7]">
                {draftQuestions.length} question(s) prepared
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#121C36] hover:bg-[#1A2E63] text-xs font-semibold text-[#E6ECFA] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuiz}
                  disabled={savingQuiz}
                  className="px-5 py-1.5 rounded-xl bg-[#2F52FF] hover:bg-[#4364FF] disabled:opacity-50 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {savingQuiz ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{savingQuiz ? 'Saving...' : editingQuizId ? 'Update Quiz' : 'Save & Publish'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: RESULTS VIEW PER QUIZ                           */}
      {/* ======================================================== */}
      {showResultsModal && selectedQuizForResults && (
        <div className="fixed inset-0 z-50 bg-[#0A1224]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-[#121C36] border border-[#24315A] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Header */}
            <div className="p-4 border-b border-[#24315A] flex items-center justify-between bg-[#0A1224]/80">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#121C36] border border-[#FFC700]/50 flex items-center justify-center text-[#FFC700]">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-[#E6ECFA] flex items-center gap-2">
                    <span>{selectedQuizForResults.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
                      {selectedQuizForResults.courseCode}
                    </span>
                  </h3>
                  <p className="text-[10px] text-[#9AA8C7]">
                    Student submission records and grading metrics
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowResultsModal(false)}
                className="p-1.5 rounded-lg bg-[#121C36] text-[#9AA8C7] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* KPI STATS CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] text-center">
                  <span className="text-[10px] uppercase font-bold text-[#9AA8C7] block">Students Attempted</span>
                  <span className="text-xl font-heading font-extrabold text-[#E6ECFA] mt-0.5 block">
                    {resultsStats.totalStudents}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] text-center">
                  <span className="text-[10px] uppercase font-bold text-[#9AA8C7] block">Total Attempts</span>
                  <span className="text-xl font-heading font-extrabold text-[#60A5FA] mt-0.5 block">
                    {resultsStats.totalAttempts}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] text-center">
                  <span className="text-[10px] uppercase font-bold text-[#9AA8C7] block">Average Score</span>
                  <span className="text-xl font-heading font-extrabold text-[#FFC700] mt-0.5 block">
                    {resultsStats.avgScore} / {selectedQuizForResults.questionCount || 1}
                  </span>
                  <span className="text-[10px] text-[#9AA8C7]">({resultsStats.avgPct}%)</span>
                </div>

                <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] text-center">
                  <span className="text-[10px] uppercase font-bold text-[#9AA8C7] block">Highest Score</span>
                  <span className="text-xl font-heading font-extrabold text-emerald-400 mt-0.5 block">
                    {resultsStats.maxScore} / {selectedQuizForResults.questionCount || 1}
                  </span>
                </div>
              </div>

              {/* Action Bar & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="relative flex-1 max-w-sm">
                  <input
                    type="text"
                    value={resultsSearch}
                    onChange={e => setResultsSearch(e.target.value)}
                    placeholder="Search student by name or matric/JAMB..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                  />
                  <Search className="w-3.5 h-3.5 text-[#9AA8C7] absolute left-2.5 top-2.5" />
                </div>

                <button
                  type="button"
                  onClick={() => exportQuizResultsToCsv(selectedQuizForResults.title, selectedQuizForResults.courseCode, resultsAttempts)}
                  disabled={resultsAttempts.length === 0}
                  className="px-3.5 py-1.5 rounded-xl bg-[#0A1224] hover:bg-[#1A2E63] border border-[#2F52FF] text-[#E6ECFA] hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5 text-[#FFC700]" />
                  <span>Export to CSV</span>
                </button>
              </div>

              {/* Students Results Table */}
              {loadingResults ? (
                <div className="p-8 text-center text-xs text-[#9AA8C7]">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#FFC700] mx-auto mb-2" />
                  Loading attempt records...
                </div>
              ) : filteredResultsAttempts.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#9AA8C7]">
                  No student submission records found for this quiz yet.
                </div>
              ) : (
                <div className="rounded-xl border border-[#24315A] overflow-hidden bg-[#0A1224]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#121C36] text-[10px] text-[#9AA8C7] uppercase border-b border-[#24315A]">
                        <tr>
                          <th className="py-2.5 px-3">Student Name</th>
                          <th className="py-2.5 px-3">Matric / JAMB</th>
                          <th className="py-2.5 px-3">Score</th>
                          <th className="py-2.5 px-3">Percentage</th>
                          <th className="py-2.5 px-3">Attempts</th>
                          <th className="py-2.5 px-3">Submitted At</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#24315A]/60 font-sans">
                        {filteredResultsAttempts.map((att, aIdx) => {
                          const total = att.total || selectedQuizForResults.questionCount || 1;
                          const pct = Math.round((att.score / total) * 100);
                          const isHigh = pct >= 70;
                          const isMedium = pct >= 50 && pct < 70;
                          return (
                            <tr key={att.id || aIdx} className="hover:bg-[#121C36]/50">
                              <td className="py-2.5 px-3 font-bold text-[#E6ECFA]">
                                {att.studentName || 'Student'}
                              </td>
                              <td className="py-2.5 px-3 text-[#9AA8C7] font-mono text-[11px]">
                                {att.matricNumber || '—'}
                              </td>
                              <td className="py-2.5 px-3 font-extrabold text-[#E6ECFA]">
                                {att.score} / {total}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                                    isHigh
                                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'
                                      : isMedium
                                      ? 'bg-amber-950/60 text-amber-400 border border-amber-500/40'
                                      : 'bg-rose-950/60 text-rose-400 border border-rose-500/40'
                                  }`}
                                >
                                  {pct}%
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-[#9AA8C7]">
                                {att.attempts || 1}
                              </td>
                              <td className="py-2.5 px-3 text-[#9AA8C7] text-[11px]">
                                {att.submittedAt
                                  ? new Date(att.submittedAt).toLocaleDateString('en-GB', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAttempt(att)}
                                  title="Delete & reset student attempt"
                                  className="p-1 rounded-lg bg-[#0A1224] hover:bg-rose-950/60 border border-[#24315A] hover:border-rose-500/50 text-[#9AA8C7] hover:text-rose-400 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-[#24315A] bg-[#0A1224]/90 flex justify-end">
              <button
                type="button"
                onClick={() => setShowResultsModal(false)}
                className="px-4 py-1.5 rounded-xl bg-[#121C36] hover:bg-[#1A2E63] text-xs font-semibold text-[#E6ECFA]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
