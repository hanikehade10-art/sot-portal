/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { CourseItem, TopicItem, QuizItem, BookmarkItem } from '../types';
import { getYouTubeEmbedUrl } from '../data/coursesAndTimetables';
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
  RotateCcw,
  Layers,
  ArrowRight
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
}

/**
 * Clean renderer for lesson notes with numbered headings, bold styling, and bullet points
 */
const LessonNotesRenderer: React.FC<{ notes: string }> = ({ notes }) => {
  const blocks = useMemo(() => {
    if (!notes || !notes.trim()) return [];
    return notes.split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean);
  }, [notes]);

  if (blocks.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#9AA8C7] italic">
        Detailed lesson notes for this syllabus topic will be uploaded soon.
      </div>
    );
  }

  // Helper to render bold markup **text** safely
  const renderFormattedInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={i} className="text-[#E6ECFA] font-bold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-4 text-xs sm:text-sm text-[#CDD7EC] leading-relaxed">
      {blocks.map((block, idx) => {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

        // Check if block is a heading (e.g. "# Heading", "## Heading", "1. Title", "Section 1:")
        const isHeading =
          /^(?:#+\s*|\d+[\.\)]\s+|Section\s+\d+[\:\.\-]\s*)/i.test(lines[0]) &&
          lines.length === 1;

        if (isHeading) {
          const cleanHeading = lines[0].replace(/^#+\s*/, '');
          return (
            <div key={idx} className="pt-2 border-b border-[#24315A]/70 pb-1.5">
              <h3 className="font-heading font-extrabold text-sm sm:text-base text-[#FFC700] tracking-wide flex items-center gap-2">
                <span className="w-1.5 h-3.5 bg-[#2F52FF] rounded-full inline-block" />
                <span>{cleanHeading}</span>
              </h3>
            </div>
          );
        }

        // Check if block is a bullet list
        const isBulletList = lines.every(l => /^[-*•]\s+/.test(l));
        if (isBulletList) {
          return (
            <ul key={idx} className="space-y-1.5 pl-4 sm:pl-5 list-disc marker:text-[#FFC700]">
              {lines.map((line, lineIdx) => {
                const cleaned = line.replace(/^[-*•]\s+/, '');
                return (
                  <li key={lineIdx} className="pl-1">
                    {renderFormattedInline(cleaned)}
                  </li>
                );
              })}
            </ul>
          );
        }

        // Standard paragraph
        return (
          <div key={idx} className="space-y-1.5">
            {lines.map((line, lIdx) => (
              <p key={lIdx}>
                {renderFormattedInline(line)}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
};

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
  linkedQuiz
}) => {
  // Sort course topics sequentially
  const sortedTopics = useMemo(() => {
    return [...allCourseTopics].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [allCourseTopics]);

  const currentIndex = sortedTopics.findIndex(t => t.id === topic.id);
  const totalTopics = sortedTopics.length > 0 ? sortedTopics.length : 1;
  const currentStep = currentIndex >= 0 ? currentIndex + 1 : 1;
  const progressPercent = Math.round((currentStep / totalTopics) * 100);

  // Next topic in syllabus
  const nextTopic = currentIndex >= 0 && currentIndex + 1 < sortedTopics.length
    ? sortedTopics[currentIndex + 1]
    : null;

  // Previous topic
  const prevTopic = currentIndex > 0 ? sortedTopics[currentIndex - 1] : null;

  // Video embed url
  const ytEmbedUrl = topic.videoUrl ? getYouTubeEmbedUrl(topic.videoUrl) : null;
  const hasVideo = Boolean(topic.videoUrl && topic.videoUrl.trim());

  const topicBookmarked = isBookmarked('topic', topic.id);

  return (
    <div className="space-y-4 pb-8">
      {/* 1. BREADCRUMB & BACK NAVIGATION */}
      <div className="p-3.5 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Back button */}
          <button
            onClick={onBackToCourse}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FFC700] hover:text-[#ffd633] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to {course.code}</span>
          </button>

          {/* Quick bookmark & Share */}
          <div className="flex items-center gap-1.5">
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
                  ? 'bg-[#FFC700]/20 text-[#FFC700] border-[#FFC700]/50'
                  : 'bg-[#0A1224] text-[#9AA8C7] border-[#24315A] hover:text-[#FFC700]'
              }`}
              title={topicBookmarked ? 'Remove bookmark' : 'Bookmark topic'}
            >
              {topicBookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Breadcrumb path: Courses > Course > Topic */}
        <div className="flex items-center gap-1.5 text-[11px] text-[#9AA8C7] truncate">
          <button
            onClick={onBackToCourses}
            className="hover:text-[#E6ECFA] hover:underline cursor-pointer truncate"
          >
            Courses
          </button>
          <ChevronRight className="w-3 h-3 text-[#9AA8C7]/60 shrink-0" />
          <button
            onClick={onBackToCourse}
            className="text-[#60A5FA] font-semibold hover:underline cursor-pointer truncate"
          >
            {course.code}
          </button>
          <ChevronRight className="w-3 h-3 text-[#9AA8C7]/60 shrink-0" />
          <span className="text-[#E6ECFA] font-bold truncate">
            {topic.title}
          </span>
        </div>

        {/* Progress bar ("Topic 2 of 6") */}
        <div className="space-y-1.5 pt-1 border-t border-[#24315A]/60">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#FFC700] font-bold">
              Topic {currentStep} of {totalTopics}
            </span>
            <span className="text-[#9AA8C7]">
              {progressPercent}% of syllabus
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#0A1224] overflow-hidden border border-[#24315A]/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2F52FF] to-[#FFC700] transition-all duration-300"
              style={{ width: `${Math.max(progressPercent, 4)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. TOPIC TITLE & ACTION HEADER */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-3.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/40 text-[10px] font-bold">
              {course.code}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-[#9AA8C7]">
              <Clock className="w-3.5 h-3.5 text-[#FFC700]" />
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

        <h1 className="font-heading font-extrabold text-base sm:text-xl text-[#E6ECFA] leading-snug">
          {topic.title}
        </h1>

        {/* "Ask AI about this topic" Primary Action */}
        <div className="pt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => onAskAiWithContext(topic, course)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#2F52FF] to-[#1E3A8A] hover:from-[#2545df] hover:to-[#172554] text-white text-xs font-bold shadow-[0_0_15px_rgba(47,82,255,0.35)] flex items-center gap-2 cursor-pointer transition-all border border-[#60A5FA]/30"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FFC700]" />
            <span>Ask AI about this topic</span>
          </button>

          <button
            onClick={() => onToggleComplete(topic.id)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isCompleted
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30'
                : 'bg-[#0A1224] text-[#E6ECFA] border-[#24315A] hover:border-[#FFC700]'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${isCompleted ? 'text-emerald-400' : 'text-[#9AA8C7]'}`} />
            <span>{isCompleted ? 'Marked Complete' : 'Mark as complete'}</span>
          </button>
        </div>
      </div>

      {/* 3. VIDEO SECTION (YOUTUBE EMBED OR DIRECT VIDEO) */}
      {hasVideo && (
        <div className="rounded-2xl bg-[#121C36] border border-[#24315A] overflow-hidden shadow-sm">
          <div className="p-3.5 bg-[#0A1224] border-b border-[#24315A] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <Play className="w-3.5 h-3.5 fill-current" />
              </div>
              <span className="font-heading font-bold text-xs text-[#E6ECFA]">
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
                <Play className="w-8 h-8 text-[#FFC700]" />
                <a
                  href={topic.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] transition-colors"
                >
                  Watch Lecture Video
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TOPIC NOTES & SECTION HEADINGS */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-[#24315A] pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#FFC700]" />
            <h2 className="font-heading font-extrabold text-sm sm:text-base text-[#E6ECFA]">
              Lesson Notes &amp; Syllabus Study
            </h2>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#0A1224] border border-[#24315A] text-[#9AA8C7]">
            Official Handout
          </span>
        </div>

        <LessonNotesRenderer notes={topic.notes || ''} />
      </div>

      {/* 5. HIGHLIGHTED SUMMARY BOX */}
      {topic.summary && topic.summary.trim() && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#121C36] to-[#0A1224] border-2 border-[#FFC700]/50 shadow-[0_0_20px_rgba(255,199,0,0.12)] space-y-2.5">
          <div className="flex items-center gap-2 text-[#FFC700]">
            <Lightbulb className="w-5 h-5 shrink-0" />
            <h3 className="font-heading font-extrabold text-sm text-[#FFC700] uppercase tracking-wider">
              Topic Summary &amp; Key Takeaways
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-[#E6ECFA] leading-relaxed whitespace-pre-wrap pl-1">
            {topic.summary}
          </p>
        </div>
      )}

      {/* 6. FURTHER READING LIST */}
      {topic.furtherReading && topic.furtherReading.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-[#60A5FA]" />
            <h3 className="font-heading font-bold text-sm text-[#E6ECFA]">
              Further Reading &amp; External References
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {topic.furtherReading.map((item, idx) => (
              <a
                key={idx}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] hover:border-[#2F52FF] text-left transition-all cursor-pointer group flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#E6ECFA] group-hover:text-white truncate">
                    {item.title || item.url}
                  </p>
                  <p className="text-[10px] text-[#9AA8C7] truncate">
                    {item.url}
                  </p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[#9AA8C7] group-hover:text-[#60A5FA] shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 7. "FINISHED THIS TOPIC?" CARD */}
      <div className="p-5 rounded-2xl bg-[#0F1C38] border-2 border-[#2F52FF]/60 shadow-[0_0_25px_rgba(47,82,255,0.2)] space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-heading font-extrabold text-base text-[#E6ECFA] flex items-center gap-2">
              <span>Finished this topic?</span>
              {isCompleted && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 text-[10px] font-bold">
                  ✓ Done
                </span>
              )}
            </h3>
            <p className="text-xs text-[#9AA8C7] mt-0.5">
              Test your understanding with the topic quiz and mark this syllabus item as completed.
            </p>
          </div>

          <button
            onClick={() => onToggleComplete(topic.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              isCompleted
                ? 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : 'bg-[#2F52FF] text-white hover:bg-[#2545df] shadow-[0_0_12px_rgba(47,82,255,0.35)]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isCompleted ? 'Marked Done' : 'Mark as complete'}</span>
          </button>
        </div>

        {/* Linked Quiz Option */}
        {linkedQuiz && (
          <div className="pt-3 border-t border-[#24315A] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FFC700]/20 text-[#FFC700] flex items-center justify-center shrink-0">
                <FileQuestion className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#E6ECFA]">
                  {linkedQuiz.title}
                </p>
                <p className="text-[10px] text-[#9AA8C7]">
                  {linkedQuiz.questionCount} Questions • Passing: {linkedQuiz.passingScore || 70}%
                </p>
              </div>
            </div>

            <button
              onClick={() => onStartQuiz(linkedQuiz.id)}
              className="px-4 py-2 rounded-xl bg-[#FFC700] hover:bg-[#ffd633] text-[#0A1224] text-xs font-black shadow-[0_0_15px_rgba(255,199,0,0.3)] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <span>Take Quiz</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 8. "NEXT TOPIC" & PREVIOUS TOPIC NAVIGATION CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {prevTopic ? (
          <button
            onClick={() => onSelectTopic(prevTopic)}
            className="p-3.5 rounded-xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] text-left transition-all cursor-pointer group flex items-center gap-2.5"
          >
            <ArrowLeft className="w-4 h-4 text-[#9AA8C7] group-hover:text-white shrink-0 group-hover:-translate-x-0.5 transition-transform" />
            <div className="min-w-0">
              <span className="text-[10px] text-[#9AA8C7] uppercase font-bold block">
                Previous Topic
              </span>
              <p className="text-xs font-bold text-[#E6ECFA] truncate group-hover:text-white">
                {prevTopic.order || currentIndex}. {prevTopic.title}
              </p>
            </div>
          </button>
        ) : (
          <div className="p-3.5 rounded-xl bg-[#0A1224]/50 border border-[#24315A]/40 text-xs text-[#9AA8C7]/60 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span>This is the first topic in the syllabus</span>
          </div>
        )}

        {nextTopic ? (
          <button
            onClick={() => onSelectTopic(nextTopic)}
            className="p-3.5 rounded-xl bg-[#121C36] border border-[#24315A] hover:border-[#FFC700] text-right transition-all cursor-pointer group flex items-center justify-end gap-2.5 sm:col-start-2"
          >
            <div className="min-w-0">
              <span className="text-[10px] text-[#FFC700] uppercase font-bold block">
                Next Topic &rarr;
              </span>
              <p className="text-xs font-bold text-[#E6ECFA] truncate group-hover:text-white">
                {nextTopic.order || currentIndex + 2}. {nextTopic.title}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-[#FFC700] group-hover:text-white shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </button>
        ) : (
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-center justify-between sm:col-start-2">
            <span>🎉 End of syllabus for {course.code}!</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
        )}
      </div>
    </div>
  );
};
