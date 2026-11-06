/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useEffect, useRef, useState } from 'react';
import { CourseItem, TopicItem, QuizItem, QuizAttempt } from '../types';
import { getYouTubeEmbedUrl } from '../data/coursesAndTimetables';
import { useAuth } from '../context/AuthContext';
import { logStudentActivity } from '../lib/studentActivity';
import { getCourseAccent } from '../config/courseAccents';
import { FormattedLessonNotes } from './FormattedLessonNotes';
import { LessonPdfViewer } from './LessonPdfViewer';
import { StudentQuizzesView } from './StudentQuizzesView';
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  FileQuestion,
  ExternalLink,
  BookOpen,
  Lightbulb,
  Play,
  Layers,
  ArrowRight,
  FileText,
  Type
} from 'lucide-react';
import { ShareButton } from './ShareButton';

interface StudentLessonViewProps {
  course: CourseItem;
  topic: TopicItem;
  allCourseTopics: TopicItem[];
  isCompleted: boolean;
  onToggleComplete: (topicId: string) => void;
  onSelectTopic: (topic: TopicItem) => void;
  onBackToCourse: () => void;
  onBackToCourses: () => void;
  onStartQuiz: (quizId: string) => void;
  onAskAiWithContext: (topic: TopicItem, course: CourseItem) => void;
  isBookmarked: (type: 'course' | 'topic' | 'material' | 'announcement', id: string) => boolean;
  toggleBookmark: (item: any) => void;
  linkedQuiz?: QuizItem | null;
  // All quizzes available in this department / course to discover any quizzes linked to this topic
  allQuizzes?: QuizItem[];
  // Student's existing quiz attempts map
  attemptsMap?: Record<string, QuizAttempt>;
}

export const StudentLessonView: React.FC<StudentLessonViewProps> = ({
  course,
  topic,
  allCourseTopics,
  isCompleted,
  onToggleComplete,
  onSelectTopic,
  onBackToCourse,
  onBackToCourses,
  onStartQuiz,
  onAskAiWithContext,
  isBookmarked,
  toggleBookmark,
  linkedQuiz,
  allQuizzes = [],
  attemptsMap = {}
}) => {
  const { user, profile } = useAuth();
  const loggedTopicRef = useRef<string | null>(null);

  // Course accent theme (palette: Teal, Emerald, Indigo, Sky, Amber, Rose)
  const theme = useMemo(() => getCourseAccent(course.accentColor), [course.accentColor]);

  // Persistent Font Size: 17px default, range 15 to 22
  const [fontSize, setFontSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sot_study_font_size');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 15 && parsed <= 24) return parsed;
      }
    } catch {}
    return 18;
  });

  const handleIncreaseFont = () => {
    setFontSize(prev => {
      const next = Math.min(23, prev + 1);
      try {
        localStorage.setItem('sot_study_font_size', String(next));
      } catch {}
      return next;
    });
  };

  const handleDecreaseFont = () => {
    setFontSize(prev => {
      const next = Math.max(15, prev - 1);
      try {
        localStorage.setItem('sot_study_font_size', String(next));
      } catch {}
      return next;
    });
  };

  // Active in-place topic quiz session
  const [activeTopicQuizId, setActiveTopicQuizId] = useState<string | null>(null);

  // Discover all quizzes linked to this topic
  const topicQuizzes = useMemo(() => {
    const list: QuizItem[] = [];
    // 1. Check allQuizzes for quizzes scoped/linked to this topic
    allQuizzes.forEach(q => {
      const isTopicMatch =
        (q.scope === 'topic' && q.topicId === topic.id) ||
        (q.topicId === topic.id) ||
        (topic.linkedQuizId === q.id);
      if (isTopicMatch && !list.some(existing => existing.id === q.id)) {
        list.push(q);
      }
    });

    // 2. Also include linkedQuiz prop if not already in list
    if (linkedQuiz && !list.some(existing => existing.id === linkedQuiz.id)) {
      list.push(linkedQuiz);
    }

    return list;
  }, [allQuizzes, topic.id, topic.linkedQuizId, linkedQuiz]);

  // Check if student has passed any topic quiz
  const hasPassedAnyTopicQuiz = useMemo(() => {
    return topicQuizzes.some(q => {
      const att = attemptsMap[q.id];
      if (!att) return false;
      const passReq = q.passingScore || 70;
      const pct = att.percentage ?? (att.total ? Math.round((att.score / att.total) * 100) : 0);
      return pct >= passReq || att.passed;
    });
  }, [topicQuizzes, attemptsMap]);

  // Content Tabs if both typed notes and a PDF exist: 'notes' | 'pdf'
  const hasNotes = Boolean(topic.notes && topic.notes.trim());
  const hasPdf = Boolean(topic.notesPdfUrl && topic.notesPdfUrl.trim());

  const [activeContentTab, setActiveContentTab] = useState<'notes' | 'pdf'>(() => {
    if (!hasNotes && hasPdf) return 'pdf';
    return 'notes';
  });

  // Reset tab when topic changes
  useEffect(() => {
    if (!hasNotes && hasPdf) {
      setActiveContentTab('pdf');
    } else {
      setActiveContentTab('notes');
    }
    setActiveTopicQuizId(null);
  }, [topic.id, hasNotes, hasPdf]);

  // Log "lesson opened" event strictly once per topic visit
  useEffect(() => {
    if (user?.uid && topic?.id && loggedTopicRef.current !== topic.id) {
      loggedTopicRef.current = topic.id;
      logStudentActivity({
        uid: user.uid,
        name: profile?.fullName || user.displayName || 'Student',
        department: course.department || profile?.department,
        level: course.level || profile?.level,
        type: 'lesson opened',
        title: `${course.code}: ${topic.title}`
      });
    }
  }, [topic?.id, user?.uid, course, profile]);

  const handleToggleCompleteWrapper = () => {
    if (!isCompleted && user?.uid) {
      logStudentActivity({
        uid: user.uid,
        name: profile?.fullName || user.displayName || 'Student',
        department: course.department || profile?.department,
        level: course.level || profile?.level,
        type: 'topic completed',
        title: `${course.code}: ${topic.title}`
      });
    }
    onToggleComplete(topic.id);
  };

  // Sort course topics sequentially
  const sortedTopics = useMemo(() => {
    return [...allCourseTopics].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [allCourseTopics]);

  const currentIndex = sortedTopics.findIndex(t => t.id === topic.id);
  const totalTopics = sortedTopics.length > 0 ? sortedTopics.length : 1;
  const currentStep = currentIndex >= 0 ? currentIndex + 1 : 1;
  const progressPercent = Math.round((currentStep / totalTopics) * 100);

  // Next and Previous topics
  const nextTopic = currentIndex >= 0 && currentIndex + 1 < sortedTopics.length
    ? sortedTopics[currentIndex + 1]
    : null;
  const prevTopic = currentIndex > 0 ? sortedTopics[currentIndex - 1] : null;

  // Video embed url
  const ytEmbedUrl = topic.videoUrl ? getYouTubeEmbedUrl(topic.videoUrl) : null;
  const hasVideo = Boolean(topic.videoUrl && topic.videoUrl.trim());
  const topicBookmarked = isBookmarked('topic', topic.id);

  // If in-place quiz is active, render StudentQuizzesView right inside this topic flow!
  if (activeTopicQuizId) {
    return (
      <div className="space-y-4">
        {/* Back arrow returns to topic */}
        <div className="p-3.5 rounded-2xl bg-[#111A2E] border border-[#24315A] flex items-center justify-between">
          <button
            onClick={() => setActiveTopicQuizId(null)}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#FACC15] hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Topic: {topic.title}</span>
          </button>
          <span className="text-[11px] text-[#9FB0C8]">
            {course.code} • Topic Quiz Flow
          </span>
        </div>

        <StudentQuizzesView
          studentDepartment={course.department || profile?.department || ''}
          studentLevel={course.level || profile?.level || 'ND1'}
          studentName={profile?.fullName || user?.displayName || 'Student'}
          matricNumber={profile?.matricNumber || ''}
          uid={user?.uid || ''}
          initialQuizId={activeTopicQuizId}
          topicTitle={topic.title}
          onBackToTopic={() => setActiveTopicQuizId(null)}
          onTopicCompleted={() => {
            if (!isCompleted) {
              onToggleComplete(topic.id);
            }
          }}
          isBookmarked={(type, id) => isBookmarked(type as any, id)}
          toggleBookmark={async (item) => { toggleBookmark(item); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ========================================================= */}
      {/* 1. BREADCRUMB & BACK NAVIGATION                           */}
      {/* ========================================================= */}
      <div className="p-3.5 rounded-2xl bg-[#111A2E] border border-[#24315A] space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Back button */}
          <button
            onClick={onBackToCourse}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FACC15] hover:text-[#fde047] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to {course.code}</span>
          </button>

          {/* Controls: A- / A+ Font Size & Quick Bookmark & Share */}
          <div className="flex items-center gap-2">
            {/* Font size adjustment */}
            <div className="flex items-center bg-[#0B1220] border border-[#24315A] rounded-xl px-1 py-0.5 text-xs">
              <button
                onClick={handleDecreaseFont}
                className="px-2 py-1 text-[#9FB0C8] hover:text-[#FFFFFF] cursor-pointer font-bold transition-colors"
                title="Decrease reading text size"
              >
                A-
              </button>
              <span className="px-1 text-[11px] font-mono text-[#FACC15] select-none">
                {fontSize}px
              </span>
              <button
                onClick={handleIncreaseFont}
                className="px-2 py-1 text-[#9FB0C8] hover:text-[#FFFFFF] cursor-pointer font-bold transition-colors"
                title="Increase reading text size"
              >
                A+
              </button>
            </div>

            <ShareButton
              title={`${course.code}: ${topic.title}`}
              itemType="topic"
              code={course.code}
              id={topic.id}
              textDetails={`Syllabus Topic #${topic.order || currentStep} of ${course.code}`}
              variant="icon"
            />
            <button
              onClick={() => toggleBookmark({
                id: topic.id,
                type: 'topic',
                title: `${course.code}: ${topic.title}`,
                code: course.code,
                department: course.department
              })}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                topicBookmarked
                  ? 'bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15]/50'
                  : 'bg-[#0B1220] text-[#9FB0C8] border-[#24315A] hover:text-[#FACC15]'
              }`}
              title={topicBookmarked ? 'Remove bookmark' : 'Bookmark topic'}
            >
              {topicBookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Breadcrumb path: Courses > Course > Topic */}
        <div className="flex items-center gap-1.5 text-[11px] text-[#9FB0C8] truncate">
          <button
            onClick={onBackToCourses}
            className="hover:text-[#E8EEF8] hover:underline cursor-pointer truncate"
          >
            Courses
          </button>
          <ChevronRight className="w-3 h-3 text-[#9FB0C8]/60 shrink-0" />
          <button
            onClick={onBackToCourse}
            className={`${theme.accentText} font-semibold hover:underline cursor-pointer truncate`}
          >
            {course.code}
          </button>
          <ChevronRight className="w-3 h-3 text-[#9FB0C8]/60 shrink-0" />
          <span className="text-[#E8EEF8] font-bold truncate">
            {topic.title}
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. TOPIC TITLE & PROGRESS BAR                             */}
      {/* ========================================================= */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#111A2E] border border-[#24315A] space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-md ${theme.badgeBg} ${theme.badgeText} border ${theme.badgeBorder} text-xs font-bold`}>
              {course.code}
            </span>
            {topic.levelTag && (
              <span className="px-2 py-0.5 rounded-md bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/40 text-xs font-bold">
                {topic.levelTag}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-[#9FB0C8]">
              <Clock className="w-3.5 h-3.5 text-[#FACC15]" />
              <span>{topic.estimatedMinutes || 15} mins read</span>
            </span>
          </div>

          {isCompleted && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Completed</span>
            </span>
          )}
        </div>

        <h1 className="font-heading font-black text-xl sm:text-2xl text-[#FFFFFF] leading-snug">
          {topic.title}
        </h1>

        {/* Progress bar ("Topic 2 of 6") */}
        <div className="space-y-1.5 pt-2 border-t border-[#24315A]/60">
          <div className="flex items-center justify-between text-xs">
            <span className={`font-bold ${theme.accentText}`}>
              Topic {currentStep} of {totalTopics}
            </span>
            <span className="text-[#9FB0C8]">
              {progressPercent}% of syllabus
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#0B1220] overflow-hidden border border-[#24315A]/60">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${theme.progressGradient} transition-all duration-300`}
              style={{ width: `${Math.max(progressPercent, 4)}%` }}
            />
          </div>
        </div>

        {/* Ask AI quick action */}
        <div className="pt-1 flex flex-wrap items-center gap-2">
          <button
            onClick={() => onAskAiWithContext(topic, course)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#2F52FF] to-[#1E3A8A] hover:from-[#2545df] hover:to-[#172554] text-white text-xs font-bold shadow-[0_0_15px_rgba(47,82,255,0.35)] flex items-center gap-2 cursor-pointer transition-all border border-[#60A5FA]/30"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FACC15]" />
            <span>Ask AI about this topic</span>
          </button>
        </div>
      </div>

      {/* What You'll Learn Box */}
      {topic.whatYoullLearn && topic.whatYoullLearn.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#111A2E] border border-[#24315A] space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-xl ${theme.badgeBg} ${theme.accentText} border ${theme.badgeBorder} flex items-center justify-center`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h3 className="font-heading font-bold text-sm text-[#E8EEF8]">
              What you&apos;ll learn
            </h3>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {topic.whatYoullLearn.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-[#E8EEF8] leading-relaxed">
                <span className={`w-1.5 h-1.5 rounded-full ${theme.accentBg} mt-1.5 shrink-0`} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Before You Begin Box */}
      {topic.beforeYouBegin && topic.beforeYouBegin.trim() && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#16223A] border border-[#FACC15]/40 space-y-2 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#FACC15] shrink-0" />
            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-[#FACC15]">
              Before you begin
            </h4>
          </div>
          <p className="text-xs sm:text-[13px] text-[#E8EEF8] leading-relaxed pl-6">
            {topic.beforeYouBegin}
          </p>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. VIDEO SECTION (IF ANY)                                 */}
      {/* ========================================================= */}
      {hasVideo && (
        <div className="rounded-2xl bg-[#111A2E] border border-[#24315A] overflow-hidden shadow-sm">
          <div className="p-3.5 bg-[#0B1220] border-b border-[#24315A] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <Play className="w-3.5 h-3.5 fill-current" />
              </div>
              <span className="font-heading font-bold text-xs text-[#E8EEF8]">
                Video Tutorial &amp; Lecture
              </span>
            </div>
            {topic.videoUrl && (
              <a
                href={topic.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#60A5FA] hover:underline flex items-center gap-1"
              >
                <span>Open in YouTube</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <div className="relative w-full aspect-video bg-black">
            {ytEmbedUrl ? (
              <iframe
                src={ytEmbedUrl}
                title={`${topic.title} video lecture`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-2">
                <Play className="w-8 h-8 text-[#FACC15]" />
                <a
                  href={topic.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`px-4 py-2 rounded-xl ${theme.buttonBg} text-white text-xs font-bold transition-colors`}
                >
                  Watch Lecture Video
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. NOTES OR PDF (WITH TABS IF BOTH EXIST)                  */}
      {/* ========================================================= */}
      <div className="space-y-3">
        {/* If both typed notes and a PDF exist, show two tabs */}
        {hasNotes && hasPdf && (
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#111A2E] border border-[#24315A] w-fit">
            <button
              onClick={() => setActiveContentTab('notes')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeContentTab === 'notes'
                  ? `${theme.buttonBg} text-white shadow-sm`
                  : 'text-[#9FB0C8] hover:text-[#E8EEF8]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Study Notes</span>
            </button>
            <button
              onClick={() => setActiveContentTab('pdf')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeContentTab === 'pdf'
                  ? `${theme.buttonBg} text-white shadow-sm`
                  : 'text-[#9FB0C8] hover:text-[#E8EEF8]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Notes PDF</span>
            </button>
          </div>
        )}

        {/* View 4A: Typed Notes */}
        {((activeContentTab === 'notes' && hasNotes) || (!hasPdf && hasNotes) || (!hasNotes && !hasPdf)) && (
          <div className="p-6 sm:p-8 rounded-2xl bg-[#111A2E] border border-[#24315A] shadow-sm">
            <FormattedLessonNotes
              notes={topic.notes || ''}
              theme={theme}
              fontSize={fontSize}
            />
          </div>
        )}

        {/* View 4B: In-App PDF Viewer */}
        {((activeContentTab === 'pdf' && hasPdf) || (!hasNotes && hasPdf)) && topic.notesPdfUrl && (
          <LessonPdfViewer
            pdfUrl={topic.notesPdfUrl}
            topicTitle={topic.title}
          />
        )}
      </div>

      {/* ========================================================= */}
      {/* 5. SUMMARY BOX / KEY TAKEAWAYS                            */}
      {/* ========================================================= */}
      {topic.summary && topic.summary.trim() && (
        <div className="p-5 sm:p-6 rounded-2xl bg-[#16223A] border-2 border-[#FACC15]/60 shadow-[0_0_20px_rgba(250,204,21,0.12)] space-y-2.5 max-w-[760px] mx-auto">
          <div className="flex items-center gap-2 text-[#FACC15]">
            <Lightbulb className="w-5 h-5 shrink-0" />
            <h3 className="font-heading font-extrabold text-sm text-[#FACC15] uppercase tracking-wider">
              Topic Summary &amp; Key Takeaways
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-[#E8EEF8] leading-relaxed whitespace-pre-wrap pl-1">
            {topic.summary}
          </p>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. FURTHER READING LIST                                   */}
      {/* ========================================================= */}
      {topic.furtherReading && topic.furtherReading.length > 0 && (
        <div className="p-5 rounded-2xl bg-[#111A2E] border border-[#24315A] space-y-3.5 max-w-[760px] mx-auto shadow-sm">
          <div className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-[#60A5FA]" />
            <h3 className="font-heading font-bold text-sm text-[#E8EEF8]">
              Further Reading &amp; External References
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {topic.furtherReading.map((item, idx) => (
              <a
                key={idx}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="p-3.5 rounded-xl bg-[#0B1220] border border-[#24315A] hover:border-teal-500 text-left transition-all cursor-pointer group flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#E8EEF8] group-hover:text-white truncate">
                    {item.title || item.url}
                  </p>
                  <p className="text-[10px] text-[#9FB0C8] truncate">
                    {item.url}
                  </p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[#9FB0C8] group-hover:text-teal-400 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. TOPIC QUIZ SECTION                                     */}
      {/* ========================================================= */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#16223A] border-2 border-teal-500/50 shadow-md space-y-4 max-w-[760px] mx-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
              <h3 className="font-heading font-black text-base sm:text-lg text-[#FFFFFF]">
                Topic Quiz
              </h3>
            </div>
            <p className="text-xs text-[#9FB0C8]">
              {topicQuizzes.length > 0
                ? `Test your mastery of this syllabus topic. Quizzes open right here in the topic.`
                : `No specific quiz is linked to this topic yet. You can mark this topic complete below.`}
            </p>
          </div>
        </div>

        {topicQuizzes.length > 0 ? (
          <div className="space-y-3 pt-1">
            {topicQuizzes.map(quiz => {
              const attempt = attemptsMap[quiz.id];
              const hasTaken = Boolean(attempt);
              const maxAttempts = quiz.attemptsAllowed || 0;
              const usedAttempts = attempt?.attempts || 0;
              const attemptsLeft = maxAttempts > 0 ? Math.max(0, maxAttempts - usedAttempts) : 'Unlimited';
              const passReq = quiz.passingScore || 70;
              const isPassed = hasTaken && (
                attempt.passed ||
                ((attempt.bestScore / (attempt.total || 1)) >= (passReq / 100))
              );

              return (
                <div
                  key={quiz.id}
                  className="p-4 rounded-xl bg-[#0B1220] border border-[#24315A] hover:border-teal-500/60 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-heading font-bold text-sm text-[#E8EEF8]">
                        {quiz.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2.5 mt-1 text-[11px] text-[#9FB0C8]">
                        <span>{quiz.questionCount || quiz.questions?.length || 0} questions</span>
                        <span>•</span>
                        <span>{quiz.timeLimit ? `${quiz.timeLimit} mins` : 'Untimed'}</span>
                        <span>•</span>
                        <span>Passing: {passReq}%</span>
                        <span>•</span>
                        <span>Attempts left: <strong className="text-[#E8EEF8]">{attemptsLeft}</strong></span>
                      </div>
                    </div>

                    {hasTaken && (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full self-start sm:self-auto ${
                        isPassed
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        Best: {attempt.bestScore}/{attempt.total} ({attempt.percentage || 0}%)
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#24315A]/60 flex items-center justify-between">
                    <span className="text-[11px] text-[#9FB0C8]">
                      {isPassed
                        ? '✓ Topic quiz passed!'
                        : hasTaken
                        ? 'Try again to improve your score'
                        : 'Practice test for this syllabus topic'}
                    </span>

                    <button
                      onClick={() => setActiveTopicQuizId(quiz.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm flex items-center gap-1.5 ${
                        isPassed
                          ? 'bg-[#111A2E] text-teal-300 border border-teal-500/50 hover:bg-teal-500/20'
                          : `${theme.buttonBg} text-white`
                      }`}
                    >
                      <span>{hasTaken ? 'Retake Quiz' : 'Start Quiz'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[#0B1220] border border-[#24315A] text-xs text-[#9FB0C8] italic">
            No quiz is linked to this topic. You can proceed with the syllabus notes.
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 8. MARK AS COMPLETE CARD                                  */}
      {/* ========================================================= */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#111A2E] border border-[#24315A] shadow-sm max-w-[760px] mx-auto space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-heading font-extrabold text-base text-[#FFFFFF] flex items-center gap-2">
              <span>Finished this topic?</span>
              {isCompleted && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 text-[10px] font-bold">
                  ✓ Completed
                </span>
              )}
            </h3>
            <p className="text-xs text-[#9FB0C8] mt-0.5">
              {topic.requireQuizToComplete && !hasPassedAnyTopicQuiz && !isCompleted
                ? 'Admin setting: Passing the topic quiz is required to complete this topic.'
                : 'Mark this syllabus item as completed to update your course progress.'}
            </p>
          </div>

          <button
            onClick={handleToggleCompleteWrapper}
            disabled={topic.requireQuizToComplete && !hasPassedAnyTopicQuiz && !isCompleted}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
              isCompleted
                ? 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : `${theme.buttonBg} text-white shadow-md`
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isCompleted ? 'Marked Done' : 'Mark as complete'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 9. PREVIOUS AND NEXT TOPIC CARDS                          */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-[760px] mx-auto pt-2">
        {prevTopic ? (
          <button
            onClick={() => onSelectTopic(prevTopic)}
            className="p-4 rounded-xl bg-[#111A2E] border border-[#24315A] hover:border-teal-500 text-left transition-all cursor-pointer group flex items-center gap-3"
          >
            <ArrowLeft className="w-4 h-4 text-[#9FB0C8] group-hover:text-white shrink-0 group-hover:-translate-x-0.5 transition-transform" />
            <div className="min-w-0">
              <span className="text-[10px] text-[#9FB0C8] uppercase font-bold block">
                Previous Topic
              </span>
              <p className="text-xs font-bold text-[#E8EEF8] truncate group-hover:text-white">
                {prevTopic.order || currentIndex}. {prevTopic.title}
              </p>
            </div>
          </button>
        ) : (
          <div className="p-4 rounded-xl bg-[#0B1220]/60 border border-[#24315A]/40 text-xs text-[#9FB0C8]/60 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span>This is the first topic in the syllabus</span>
          </div>
        )}

        {nextTopic ? (
          <button
            onClick={() => onSelectTopic(nextTopic)}
            className={`p-4 rounded-xl bg-[#111A2E] border border-[#24315A] ${theme.borderHover} text-right transition-all cursor-pointer group flex items-center justify-end gap-3 sm:col-start-2`}
          >
            <div className="min-w-0">
              <span className={`text-[10px] ${theme.accentText} uppercase font-bold block`}>
                Next Topic &rarr;
              </span>
              <p className="text-xs font-bold text-[#E8EEF8] truncate group-hover:text-white">
                {nextTopic.order || currentIndex + 2}. {nextTopic.title}
              </p>
            </div>
            <ArrowRight className={`w-4 h-4 ${theme.accentText} group-hover:text-white shrink-0 group-hover:translate-x-0.5 transition-transform`} />
          </button>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-center justify-between sm:col-start-2">
            <span>🎉 End of syllabus for {course.code}!</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
        )}
      </div>
    </div>
  );
};
