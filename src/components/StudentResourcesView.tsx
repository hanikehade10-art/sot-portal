import React, { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { CourseItem, TopicItem, ResourceItem, BookmarkItem } from '../types';
import {
  normalizeCourseLevel,
  normalizeCourseSemester,
  formatPdfUrl,
  getPdfDownloadUrl,
  getYouTubeEmbedUrl
} from '../data/coursesAndTimetables';
import {
  BookOpen,
  FileText,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Search,
  Download,
  ChevronRight,
  ChevronDown,
  Layers,
  FolderOpen,
  FileQuestion,
  Video,
  Play,
  ArrowLeft,
  X,
  Eye,
  CheckCircle2,
  Sparkles,
  Link2,
  Clock,
  Lock
} from 'lucide-react';
import { ShareButton } from './ShareButton';
import { StudentLessonView } from './StudentLessonView';
import { StudentQuizzesView } from './StudentQuizzesView';
import { QuizItem, UserProfile, QuizAttempt } from '../types';
import { logStudentActivity } from '../lib/studentActivity';
import { getCourseAccent } from '../config/courseAccents';

interface StudentResourcesViewProps {
  courses: CourseItem[];
  resources: ResourceItem[];
  userLevel?: string;
  department: string;
  isBookmarked: (type: any, id: string) => boolean;
  toggleBookmark: (item: any) => void;
  bookmarks: BookmarkItem[];
  onNavigateLinks?: () => void;
  studentProfile?: UserProfile | null;
  onUpdateCompletedTopics?: (completed: string[]) => void;
  onUpdateLastTopic?: (last: { topicId: string; topicTitle: string; courseId: string; courseCode: string; courseTitle: string }) => void;
  onTakeQuiz?: (quizId: string) => void;
  onAskAiAboutTopic?: (contextText: string, topicTitle: string) => void;
  initialCourseId?: string | null;
  initialTopicId?: string | null;
}

type MainResourceTab = 'courses' | 'past-questions' | 'bookmarks';
type CourseDetailTab = 'topics' | 'materials';

const ACADEMIC_LEVELS: Array<'ND1' | 'ND2' | 'HND1' | 'HND2'> = ['ND1', 'ND2', 'HND1', 'HND2'];
const SEMESTERS: Array<'First Semester' | 'Second Semester'> = ['First Semester', 'Second Semester'];

export const StudentResourcesView: React.FC<StudentResourcesViewProps> = ({
  courses: initialCourses,
  resources: initialResources,
  userLevel,
  department,
  isBookmarked,
  toggleBookmark,
  bookmarks,
  onNavigateLinks,
  studentProfile,
  onUpdateCompletedTopics,
  onUpdateLastTopic,
  onTakeQuiz,
  onAskAiAboutTopic,
  initialCourseId,
  initialTopicId
}) => {
  const [activeTab, setActiveTab] = useState<MainResourceTab>('courses');

  // Level & Semester selectors (defaulting to student's level)
  const defaultLevel = userLevel ? normalizeCourseLevel(userLevel) : 'ND1';
  const [selectedLevel, setSelectedLevel] = useState<'ND1' | 'ND2' | 'HND1' | 'HND2'>(defaultLevel);
  const [selectedSemester, setSelectedSemester] = useState<'First Semester' | 'Second Semester'>('First Semester');
  const [searchQuery, setSearchQuery] = useState('');

  // Course Detail state (when a course is opened)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(initialCourseId || null);
  const [courseDetailTab, setCourseDetailTab] = useState<CourseDetailTab>('topics');
  const [expandedTopicIds, setExpandedTopicIds] = useState<Record<string, boolean>>({});
  const [curriculumQuizState, setCurriculumQuizState] = useState<{ quizId: string; topicTitle: string; topicId: string } | null>(null);

  // Lesson View state (interactive lesson experience)
  const [selectedLessonTopic, setSelectedLessonTopic] = useState<TopicItem | null>(null);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);

  // Past Questions tab course filter
  const [pqCourseFilter, setPqCourseFilter] = useState<string>('All');

  // Real-time synced data from Firestore
  const [courses, setCourses] = useState<CourseItem[]>(initialCourses);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>(initialResources);

  // In-App PDF Viewer Modal state
  const [viewerItem, setViewerItem] = useState<{
    title: string;
    url: string;
    courseCode?: string;
    type?: string;
  } | null>(null);

  // Sync userLevel when it updates
  useEffect(() => {
    if (userLevel) {
      setSelectedLevel(normalizeCourseLevel(userLevel));
    }
  }, [userLevel]);

  // Real-time listener for department courses
  useEffect(() => {
    if (!department) return;
    const q = query(collection(db, 'courses'), where('department', '==', department));
    const unsub = onSnapshot(q, (snap) => {
      const list: CourseItem[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...(d.data() as any) });
      });
      setCourses(list);
    }, (err) => {
      console.warn('Courses listener notice:', err);
    });
    return () => unsub();
  }, [department]);

  // Real-time listener for department topics
  useEffect(() => {
    if (!department) return;
    const q = query(collection(db, 'topics'), where('department', '==', department));
    const unsub = onSnapshot(q, (snap) => {
      const list: TopicItem[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...(d.data() as any) });
      });
      list.sort((a, b) => (a.order || 0) - (b.order || 0));
      setTopics(list);
    }, (err) => {
      console.warn('Topics listener notice:', err);
    });
    return () => unsub();
  }, [department]);

  // Real-time listener for department resources
  useEffect(() => {
    if (!department) return;
    const q = query(collection(db, 'resources'), where('department', '==', department));
    const unsub = onSnapshot(q, (snap) => {
      const list: ResourceItem[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...(d.data() as any) });
      });
      setResources(list);
    }, (err) => {
      console.warn('Resources listener notice:', err);
    });
    return () => unsub();
  }, [department]);

  // Real-time listener for department quizzes (for lesson quiz linking)
  useEffect(() => {
    if (!department) return;
    const q = query(collection(db, 'quizzes'), where('department', '==', department));
    const unsub = onSnapshot(q, (snap) => {
      const list: QuizItem[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...(d.data() as any) });
      });
      setQuizzes(list);
    }, (err) => {
      console.warn('Quizzes listener notice:', err);
    });
    return () => unsub();
  }, [department]);

  // Student's quiz attempts map
  const [attemptsMap, setAttemptsMap] = useState<Record<string, QuizAttempt>>({});
  useEffect(() => {
    if (!studentProfile?.uid) return;
    const attQuery = query(collection(db, 'quizAttempts'), where('uid', '==', studentProfile.uid));
    const unsub = onSnapshot(attQuery, (snap) => {
      const map: Record<string, QuizAttempt> = {};
      snap.forEach(d => {
        const data = d.data() as QuizAttempt;
        map[data.quizId] = data;
      });
      setAttemptsMap(map);
    }, (err) => {
      console.warn('Attempts listener notice:', err);
    });
    return () => unsub();
  }, [studentProfile?.uid]);

  // Handle deep-link props (initialCourseId, initialTopicId)
  useEffect(() => {
    if (initialCourseId) {
      setSelectedCourseId(initialCourseId);
    }
  }, [initialCourseId]);

  useEffect(() => {
    if (initialTopicId && topics.length > 0) {
      const found = topics.find(t => t.id === initialTopicId);
      if (found) {
        setSelectedCourseId(found.courseId);
        setSelectedLessonTopic(found);
      }
    }
  }, [initialTopicId, topics]);

  // Completed topics helper
  const completedTopicsList = useMemo(() => {
    return studentProfile?.completedTopics || [];
  }, [studentProfile?.completedTopics]);

  const handleToggleTopicCompleted = (topicId: string) => {
    const isCurrently = completedTopicsList.includes(topicId);
    const updated = isCurrently
      ? completedTopicsList.filter(id => id !== topicId)
      : [...completedTopicsList, topicId];
    onUpdateCompletedTopics?.(updated);
  };

  const handleOpenLesson = (topic: TopicItem, course: CourseItem) => {
    setSelectedLessonTopic(topic);
    onUpdateLastTopic?.({
      topicId: topic.id,
      topicTitle: topic.title,
      courseId: course.id,
      courseCode: course.code,
      courseTitle: course.title
    });
  };
  // Filtered courses for active Level and Semester
  const filteredSemesterCourses = useMemo(() => {
    return courses.filter(c => {
      const matchDept = c.department === department;
      const matchLevel = normalizeCourseLevel(c.level) === selectedLevel;
      const matchSem = normalizeCourseSemester(c.semester) === selectedSemester;
      return matchDept && matchLevel && matchSem;
    });
  }, [courses, department, selectedLevel, selectedSemester]);

  // Search-filtered courses
  const displayedCourses = useMemo(() => {
    if (!searchQuery.trim()) return filteredSemesterCourses;
    const q = searchQuery.toLowerCase();

    return filteredSemesterCourses.filter(c => {
      const matchCode = c.code.toLowerCase().includes(q);
      const matchTitle = c.title.toLowerCase().includes(q);
      // Also match if any topic title matches
      const hasMatchingTopic = topics.some(t => t.courseId === c.id && t.title.toLowerCase().includes(q));
      // Also match if any resource title matches
      const hasMatchingResource = resources.some(
        r => (r.courseId === c.id || r.courseCode === c.code) && r.title.toLowerCase().includes(q)
      );
      return matchCode || matchTitle || hasMatchingTopic || hasMatchingResource;
    });
  }, [filteredSemesterCourses, searchQuery, topics, resources]);

  // Selected Course Object
  const selectedCourse = useMemo(() => {
    if (!selectedCourseId) return null;
    return courses.find(c => c.id === selectedCourseId) || null;
  }, [courses, selectedCourseId]);

  // Topics for the selected course
  const courseTopics = useMemo(() => {
    if (!selectedCourseId) return [];
    return topics
      .filter(t => t.courseId === selectedCourseId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [topics, selectedCourseId]);

  // Resources for the selected course
  const courseResources = useMemo(() => {
    if (!selectedCourseId || !selectedCourse) return [];
    return resources.filter(r => {
      return r.courseId === selectedCourseId || (r.courseCode && r.courseCode === selectedCourse.code);
    });
  }, [resources, selectedCourseId, selectedCourse]);

  // Past Questions specifically for the selected course
  const coursePastQuestions = useMemo(() => {
    return courseResources.filter(r => r.type === 'Past Question' || r.category === 'Past Question');
  }, [courseResources]);

  // Materials for the selected course (not tied to a specific topic, or all materials)
  const courseMaterials = useMemo(() => {
    return courseResources.filter(r => {
      const isPQ = r.type === 'Past Question' || r.category === 'Past Question';
      return !isPQ && !r.topicId;
    });
  }, [courseResources]);

  // All Past Questions for this department, filtered by Level and Semester
  const allDepartmentPastQuestions = useMemo(() => {
    return resources.filter(r => {
      const matchDept = r.department === department;
      const isPQ = r.type === 'Past Question' || r.category === 'Past Question';
      const matchLevel = normalizeCourseLevel(r.level) === selectedLevel;
      const matchSem = normalizeCourseSemester(r.semester) === selectedSemester;
      return matchDept && isPQ && matchLevel && matchSem;
    });
  }, [resources, department, selectedLevel, selectedSemester]);

  // Filtered department past questions (with course filter and search)
  const displayedDepartmentPastQuestions = useMemo(() => {
    return allDepartmentPastQuestions.filter(r => {
      if (pqCourseFilter !== 'All') {
        const matchCourse = r.courseId === pqCourseFilter || r.courseCode === pqCourseFilter;
        if (!matchCourse) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.title.toLowerCase().includes(q) ||
          (r.courseCode && r.courseCode.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [allDepartmentPastQuestions, pqCourseFilter, searchQuery]);

  // Real counts for the 3 main tabs
  const coursesCount = filteredSemesterCourses.length;
  const pastQuestionsCount = allDepartmentPastQuestions.length;
  const bookmarksCount = bookmarks.length;

  // Topic expansion toggle
  const toggleTopicExpand = (topicId: string) => {
    setExpandedTopicIds(prev => ({
      ...prev,
      [topicId]: !prev[topicId]
    }));
  };

  // Helper to get resources belonging to a topic
  const getTopicItems = (topicId: string) => {
    return courseResources.filter(r => r.topicId === topicId);
  };

  // -------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* ========================================================= */}
      {/* TOP CONTROLS: LEVEL, SEMESTER & SEARCH                    */}
      {/* ========================================================= */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Department Label */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#FFC700] block">
              Curriculum &amp; Learning Hub
            </span>
            <h2 className="font-heading font-bold text-base sm:text-lg text-[#E6ECFA]">
              {department}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* Level Selector */}
            <div className="flex items-center gap-1 bg-[#0A1224] p-1 rounded-xl border border-[#24315A]">
              {ACADEMIC_LEVELS.map(lvl => (
                <button
                  key={lvl}
                  onClick={() => {
                    setSelectedLevel(lvl);
                    setSelectedCourseId(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedLevel === lvl
                      ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.4)]'
                      : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Semester Selector */}
            <div className="flex items-center gap-1 bg-[#0A1224] p-1 rounded-xl border border-[#24315A]">
              {SEMESTERS.map(sem => (
                <button
                  key={sem}
                  onClick={() => {
                    setSelectedSemester(sem);
                    setSelectedCourseId(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedSemester === sem
                      ? 'bg-[#FFC700] text-[#0A1224] shadow-[0_0_12px_rgba(255,199,0,0.3)]'
                      : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                  }`}
                >
                  {sem === 'First Semester' ? '1st Sem' : '2nd Sem'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#9AA8C7] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search courses, topics, past questions and notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#62759F] focus:outline-none focus:border-[#2F52FF] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-[#9AA8C7] hover:text-white"
            >
              &times;
            </button>
          )}
        </div>

        {/* MAIN 3 TABS: Courses, Past Questions, Bookmarks */}
        <div className="flex items-center gap-2 pt-1 border-t border-[#24315A]/60 overflow-x-auto">
          {/* Tab 1: Courses */}
          <button
            onClick={() => {
              setActiveTab('courses');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'courses'
                ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                : 'bg-[#0A1224] text-[#9AA8C7] hover:text-[#E6ECFA] border border-[#24315A]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-[#FFC700]" />
            <span>Courses</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              activeTab === 'courses' ? 'bg-[#0A1224] text-[#FFC700]' : 'bg-[#121C36] text-[#E6ECFA]'
            }`}>
              {coursesCount}
            </span>
          </button>

          {/* Tab 2: Past Questions */}
          <button
            onClick={() => {
              setActiveTab('past-questions');
              setSelectedCourseId(null);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'past-questions'
                ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                : 'bg-[#0A1224] text-[#9AA8C7] hover:text-[#E6ECFA] border border-[#24315A]'
            }`}
          >
            <FileQuestion className="w-3.5 h-3.5 text-[#FFC700]" />
            <span>Past Questions</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              activeTab === 'past-questions' ? 'bg-[#0A1224] text-[#FFC700]' : 'bg-[#121C36] text-[#E6ECFA]'
            }`}>
              {pastQuestionsCount}
            </span>
          </button>

          {/* Tab 3: Bookmarks */}
          <button
            onClick={() => {
              setActiveTab('bookmarks');
              setSelectedCourseId(null);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'bookmarks'
                ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                : 'bg-[#0A1224] text-[#9AA8C7] hover:text-[#E6ECFA] border border-[#24315A]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-[#FFC700]" />
            <span>Bookmarks</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              activeTab === 'bookmarks' ? 'bg-[#0A1224] text-[#FFC700]' : 'bg-[#121C36] text-[#E6ECFA]'
            }`}>
              {bookmarksCount}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW 1: COURSES TAB                                       */}
      {/* ========================================================= */}
      {activeTab === 'courses' && (
        <div>
          {/* CASE 1C: INTERACTIVE LESSON PAGE OPENED */}
          {selectedCourse && selectedLessonTopic ? (
            <StudentLessonView
              course={selectedCourse}
              topic={selectedLessonTopic}
              allCourseTopics={courseTopics}
              isCompleted={completedTopicsList.includes(selectedLessonTopic.id)}
              onToggleComplete={handleToggleTopicCompleted}
              onSelectTopic={(t) => handleOpenLesson(t, selectedCourse)}
              onBackToCourse={() => setSelectedLessonTopic(null)}
              onBackToCourses={() => {
                setSelectedLessonTopic(null);
                setSelectedCourseId(null);
              }}
              onStartQuiz={(quizId) => onTakeQuiz?.(quizId)}
              onAskAiWithContext={(top, crs) =>
                onAskAiAboutTopic?.(
                  top.notes || top.summary || top.title,
                  `${crs.code}: ${top.title}`
                )
              }
              isBookmarked={isBookmarked}
              toggleBookmark={toggleBookmark}
              linkedQuiz={
                selectedLessonTopic.linkedQuizId
                  ? quizzes.find(q => q.id === selectedLessonTopic.linkedQuizId)
                  : null
              }
              allQuizzes={quizzes}
              attemptsMap={attemptsMap}
            />
          ) : !selectedCourse ? (
            /* CASE 1A: NO COURSE OPENED -> CLEAN LIST OF COURSES WITH PROGRESS RINGS */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#9AA8C7] px-1">
                <span>
                  Showing courses for <strong className="text-[#FFC700]">{selectedLevel} • {selectedSemester}</strong>
                </span>
                <span>{displayedCourses.length} {displayedCourses.length === 1 ? 'course' : 'courses'}</span>
              </div>

              {displayedCourses.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#121C36] border border-[#24315A] text-center space-y-2">
                  <BookOpen className="w-8 h-8 text-[#FFC700] mx-auto opacity-70" />
                  <p className="font-heading font-bold text-sm text-[#E6ECFA]">
                    No courses found for {selectedLevel} ({selectedSemester})
                  </p>
                  <p className="text-xs text-[#9AA8C7] max-w-sm mx-auto">
                    {searchQuery
                      ? 'Try clearing your search query to see all semester courses.'
                      : 'Courses for this academic level will appear here once uploaded by administration.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayedCourses.map(course => {
                    const courseAccent = getCourseAccent(course.accentColor);
                    const courseTopicsList = topics.filter(t => t.courseId === course.id);
                    const courseCompletedTopics = courseTopicsList.filter(t => completedTopicsList.includes(t.id));
                    const progressPct = courseTopicsList.length > 0
                      ? Math.round((courseCompletedTopics.length / courseTopicsList.length) * 100)
                      : 0;
                    const isStarted = progressPct > 0;
                    const bookmarked = isBookmarked('course', course.id);

                    return (
                      <div
                        key={course.id}
                        onClick={() => {
                          setSelectedCourseId(course.id);
                          setCourseDetailTab('topics');
                        }}
                        className={`rounded-2xl bg-[#111A2E] border border-[#24315A] ${courseAccent.borderHover} transition-all cursor-pointer group flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-[0_8px_25px_rgba(47,82,255,0.15)] hover:scale-[1.01]`}
                      >
                        {/* Course Card Original Cover */}
                        {course.coverImageUrl ? (
                          <div
                            className="relative h-28 w-full bg-cover bg-center overflow-hidden border-b border-[#24315A]/60"
                            style={{ backgroundImage: `url(${course.coverImageUrl})` }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-t from-[#111A2E] via-[#111A2E]/60 to-transparent" />
                            <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between">
                              <span className={`px-2.5 py-0.5 rounded-md ${courseAccent.badgeBg} ${courseAccent.badgeText} border ${courseAccent.badgeBorder} text-xs font-mono font-black shadow-sm`}>
                                {course.code}
                              </span>
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <span className="px-2 py-0.5 rounded bg-[#0B1220]/80 text-[#E8EEF8] border border-[#24315A] text-[10px] font-bold">
                                  {course.units || 3} Units
                                </span>
                                <button
                                  onClick={() => toggleBookmark({
                                    id: course.id,
                                    type: 'course',
                                    title: `${course.code}: ${course.title}`,
                                    code: course.code,
                                    department: course.department
                                  })}
                                  className={`p-1 rounded-lg border transition-all cursor-pointer ${
                                    bookmarked
                                      ? 'bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15]/50'
                                      : 'bg-[#0B1220]/80 text-[#9FB0C8] border-[#24315A] hover:text-[#FACC15]'
                                  }`}
                                  title={bookmarked ? 'Remove bookmark' : 'Bookmark this course'}
                                >
                                  {bookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className={`relative h-28 w-full bg-gradient-to-br ${courseAccent.coverGradient} p-3.5 flex flex-col justify-between border-b border-[#24315A]/60 overflow-hidden`}>
                            <div className="flex items-center justify-between relative z-10">
                              <span className={`px-2.5 py-0.5 rounded-md ${courseAccent.badgeBg} ${courseAccent.badgeText} border ${courseAccent.badgeBorder} text-xs font-mono font-black`}>
                                {course.code}
                              </span>
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <span className="px-2 py-0.5 rounded bg-[#0B1220]/70 text-[#E8EEF8] border border-[#24315A] text-[10px] font-bold">
                                  {course.units || 3} Units
                                </span>
                                <button
                                  onClick={() => toggleBookmark({
                                    id: course.id,
                                    type: 'course',
                                    title: `${course.code}: ${course.title}`,
                                    code: course.code,
                                    department: course.department
                                  })}
                                  className={`p-1 rounded-lg border transition-all cursor-pointer ${
                                    bookmarked
                                      ? 'bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15]/50'
                                      : 'bg-[#0B1220]/70 text-[#9FB0C8] border-[#24315A] hover:text-[#FACC15]'
                                  }`}
                                  title={bookmarked ? 'Remove bookmark' : 'Bookmark this course'}
                                >
                                  {bookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                            <div className="flex items-end justify-between relative z-10">
                              <div className={`w-8 h-8 rounded-xl ${courseAccent.iconBg} border ${courseAccent.badgeBorder} flex items-center justify-center`}>
                                <BookOpen className="w-4 h-4" />
                              </div>
                              <span className="font-mono text-2xl font-black text-white/10 select-none tracking-widest">
                                {course.code}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Card Body */}
                        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-[#9FB0C8]">
                              <span className="flex items-center gap-1 font-medium text-[#60A5FA]">
                                <Layers className="w-3.5 h-3.5 text-[#2F52FF]" />
                                <span>{courseTopicsList.length} {courseTopicsList.length === 1 ? 'topic' : 'topics'}</span>
                              </span>
                              <span>{courseCompletedTopics.length} of {courseTopicsList.length} complete</span>
                            </div>

                            <h3 className="font-heading font-black text-sm sm:text-base text-[#E8EEF8] group-hover:text-white transition-colors line-clamp-2 leading-snug">
                              {course.title}
                            </h3>
                          </div>

                          {/* Progress Bar & Action Button */}
                          <div className="space-y-2.5 pt-2 border-t border-[#24315A]/60">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-[#9FB0C8]">Progress</span>
                                <span className={`font-bold ${courseAccent.accentText}`}>{progressPct}%</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-[#0B1220] overflow-hidden border border-[#24315A]/50">
                                <div
                                  className={`h-full rounded-full bg-gradient-to-r ${courseAccent.progressGradient} transition-all duration-300`}
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] text-[#9FB0C8]">
                                {course.semester}
                              </span>
                              <button
                                type="button"
                                className={`px-3 py-1.5 rounded-xl ${courseAccent.buttonBg} text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all`}
                              >
                                <span>{isStarted ? 'Continue' : 'Start learning'}</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* CASE 1B: COURSE PAGE OPENED -> TABS: TOPICS & MATERIALS */
            (() => {
              const courseAccent = getCourseAccent(selectedCourse.accentColor);
              const courseCompletedTopics = courseTopics.filter(t => completedTopicsList.includes(t.id));
              const allTopicsDone = courseTopics.length > 0 && courseCompletedTopics.length === courseTopics.length;
              const coursePct = courseTopics.length > 0
                ? Math.round((courseCompletedTopics.length / courseTopics.length) * 100)
                : 0;

              // Quizzes linked to this course (scope === 'course' or matches courseId/courseCode)
              const linkedCourseQuizzes = quizzes.filter(q => {
                if (q.scope === 'course') {
                  return q.courseId === selectedCourse.id || q.courseCode === selectedCourse.code;
                }
                return false;
              });

              // Check if in-place curriculum quiz is open
              if (curriculumQuizState) {
                return (
                  <div className="space-y-4">
                    {/* Back arrow returns to curriculum */}
                    <div className="p-3.5 rounded-2xl bg-[#111A2E] border border-[#24315A] flex items-center justify-between">
                      <button
                        onClick={() => setCurriculumQuizState(null)}
                        className="inline-flex items-center gap-2 text-xs font-bold text-[#FACC15] hover:underline cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to {selectedCourse.code} curriculum</span>
                      </button>
                      <span className="text-[11px] text-[#9FB0C8]">
                        {selectedCourse.code} • {curriculumQuizState.topicTitle}
                      </span>
                    </div>

                    <StudentQuizzesView
                      studentDepartment={selectedCourse.department || department}
                      studentLevel={selectedCourse.level || userLevel || 'ND1'}
                      studentName={studentProfile?.fullName || auth.currentUser?.displayName || 'Student'}
                      matricNumber={studentProfile?.matricNumber || ''}
                      uid={studentProfile?.uid || auth.currentUser?.uid || ''}
                      initialQuizId={curriculumQuizState.quizId}
                      topicTitle={curriculumQuizState.topicTitle}
                      onBackToTopic={() => setCurriculumQuizState(null)}
                      onTopicCompleted={() => {
                        if (!completedTopicsList.includes(curriculumQuizState.topicId)) {
                          handleToggleTopicCompleted(curriculumQuizState.topicId);
                        }
                      }}
                      isBookmarked={(type, id) => isBookmarked(type as any, id)}
                      toggleBookmark={async (item) => { toggleBookmark(item); }}
                    />
                  </div>
                );
              }

              const totalEstimatedMinutes = courseTopics.reduce((acc, t) => acc + (t.estimatedMinutes || 15), 0);
              const totalHours = Math.floor(totalEstimatedMinutes / 60);
              const totalMins = totalEstimatedMinutes % 60;
              const timeString = totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins} mins`;

              return (
                <div className="space-y-5">
                  {/* Back Navigation Bar */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        setSelectedLessonTopic(null);
                        setSelectedCourseId(null);
                        setCurriculumQuizState(null);
                      }}
                      className="inline-flex items-center gap-2 text-xs font-bold text-[#FACC15] hover:text-[#fde047] transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to all courses</span>
                    </button>

                    <button
                      onClick={() => toggleBookmark({
                        id: selectedCourse.id,
                        type: 'course',
                        title: `${selectedCourse.code}: ${selectedCourse.title}`,
                        code: selectedCourse.code,
                        department: selectedCourse.department
                      })}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        isBookmarked('course', selectedCourse.id)
                          ? 'bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15]/50'
                          : 'bg-[#111A2E] text-[#9FB0C8] border-[#24315A] hover:text-[#FFFFFF]'
                      }`}
                    >
                      {isBookmarked('course', selectedCourse.id) ? (
                        <>
                          <BookmarkCheck className="w-3.5 h-3.5" />
                          <span>Bookmarked</span>
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-3.5 h-3.5" />
                          <span>Bookmark Course</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* COVER BANNER WITH CODE, TITLE, UNITS, TOPIC COUNT, TOTAL TIME & PROGRESS RING */}
                  <div className={`p-6 sm:p-7 rounded-2xl bg-[#111A2E] border border-[#24315A] shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden`}>
                    {selectedCourse.coverImageUrl && (
                      <div
                        className="absolute inset-0 bg-cover bg-center opacity-15 pointer-events-none"
                        style={{ backgroundImage: `url(${selectedCourse.coverImageUrl})` }}
                      />
                    )}
                    <div className="space-y-2.5 flex-1 relative z-10">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className={`font-mono font-black text-2xl sm:text-3xl tracking-tight text-[#FFFFFF]`}>
                          {selectedCourse.code}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-md ${courseAccent.badgeBg} ${courseAccent.badgeText} border ${courseAccent.badgeBorder} text-xs font-bold`}>
                          {selectedCourse.units || 3} Credit Units
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-[#16223A] text-[#9FB0C8] border border-[#24315A] text-xs font-medium">
                          {courseTopics.length} {courseTopics.length === 1 ? 'topic' : 'topics'}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-[#16223A] text-[#FACC15] border border-[#24315A] text-xs font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{timeString} total time</span>
                        </span>
                      </div>

                      <h2 className="font-heading font-black text-xl sm:text-2xl text-[#E8EEF8] leading-snug">
                        {selectedCourse.title}
                      </h2>

                      <p className="text-xs text-[#9FB0C8]">
                        {selectedCourse.department} • {selectedCourse.level} • {selectedCourse.semester}
                      </p>
                    </div>

                    {/* Circular Progress Ring */}
                    <div className="flex items-center gap-4 bg-[#16223A] border border-[#24315A] p-3.5 rounded-2xl shrink-0 relative z-10">
                      <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                          <path
                            className="text-[#0B1220]"
                            strokeWidth="3.5"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="transition-all duration-700 ease-out"
                            stroke={courseAccent.stroke}
                            strokeDasharray={`${coursePct}, 100`}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <span className="absolute text-xs font-mono font-black text-[#FFFFFF]">
                          {coursePct}%
                        </span>
                      </div>

                      <div className="text-left">
                        <span className="text-[10px] uppercase font-bold text-[#9FB0C8] tracking-wider block">
                          Syllabus Mastery
                        </span>
                        <span className="font-heading font-extrabold text-sm text-[#E8EEF8] block">
                          {courseCompletedTopics.length} of {courseTopics.length} done
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ABOUT THIS COURSE */}
                  <div className="p-5 rounded-2xl bg-[#111A2E] border border-[#24315A] space-y-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <BookOpen className={`w-4 h-4 ${courseAccent.accentText}`} />
                      <h3 className="font-heading font-bold text-sm text-[#E8EEF8]">
                        About this course
                      </h3>
                    </div>
                    <p className="text-xs sm:text-[13px] text-[#9FB0C8] leading-relaxed">
                      {selectedCourse.about || `Official syllabus curriculum and study modules for ${selectedCourse.code} (${selectedCourse.title}) in the Department of ${selectedCourse.department}. Complete topics sequentially and verify your progress with quizzes.`}
                    </p>
                  </div>

                  {/* Course Tabs: Topics vs Materials */}
                  <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#111A2E] border border-[#24315A] w-fit">
                    <button
                      onClick={() => setCourseDetailTab('topics')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                        courseDetailTab === 'topics'
                          ? `${courseAccent.buttonBg} text-white shadow-sm`
                          : 'text-[#9FB0C8] hover:text-[#E8EEF8]'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Syllabus Topics ({courseTopics.length})</span>
                    </button>

                    <button
                      onClick={() => setCourseDetailTab('materials')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                        courseDetailTab === 'materials'
                          ? `${courseAccent.buttonBg} text-white shadow-sm`
                          : 'text-[#9FB0C8] hover:text-[#E8EEF8]'
                      }`}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Course Materials ({courseMaterials.length})</span>
                    </button>
                  </div>

                  {/* TAB 1: TOPICS (NUMBERED CARDS WITH COMPLETED TICK & ESTIMATED TIME) */}
                  {courseDetailTab === 'topics' && (
                    <div className="space-y-4">
                      {courseTopics.length === 0 ? (
                        <div className="p-8 rounded-2xl bg-[#111A2E] border border-[#24315A] text-center space-y-2">
                          <Layers className="w-8 h-8 text-[#FACC15] mx-auto opacity-70" />
                          <p className="font-heading font-bold text-sm text-[#E8EEF8]">
                            No syllabus topics added for this course yet
                          </p>
                          <p className="text-xs text-[#9FB0C8]">
                            Detailed lecture topics, video tutorials and notes will appear here once published.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {courseTopics.map((topic, idx) => {
                            const items = getTopicItems(topic.id);
                            const isExpanded = expandedTopicIds[topic.id] !== false;
                            const topicBookmarked = isBookmarked('topic', topic.id);
                            const isTopicDone = completedTopicsList.includes(topic.id);

                            return (
                              <div
                                key={topic.id}
                                className={`rounded-2xl bg-[#16223A] border transition-all shadow-sm ${
                                  isTopicDone
                                    ? 'border-emerald-500/50 bg-[#16253c]'
                                    : 'border-[#24315A] hover:border-[#384a75]'
                                }`}
                              >
                                {/* Topic Card Header */}
                                <div
                                  onClick={() => handleOpenLesson(topic, selectedCourse)}
                                  className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer"
                                >
                                  <div className="flex items-center gap-3.5 min-w-0">
                                    {/* Number / Completed Tick */}
                                    <div
                                      className={`w-8 h-8 rounded-xl font-mono font-black text-xs flex items-center justify-center shrink-0 border transition-colors ${
                                        isTopicDone
                                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                          : 'bg-[#111A2E] border-[#24315A] text-[#9FB0C8]'
                                      }`}
                                    >
                                      {isTopicDone ? '✓' : idx + 1}
                                    </div>

                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-heading font-bold text-sm sm:text-base text-[#E8EEF8] hover:text-[#FFFFFF] transition-colors leading-snug">
                                          {topic.title}
                                        </h4>
                                        {topic.levelTag && (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/40">
                                            {topic.levelTag}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2.5 mt-1 text-xs text-[#9FB0C8] flex-wrap">
                                        <span className="flex items-center gap-1">
                                          <Clock className="w-3 h-3 text-[#FACC15]" />
                                          <span>{topic.estimatedMinutes || 15} mins read</span>
                                        </span>
                                        {isTopicDone && (
                                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                                            <span>• Completed</span>
                                          </span>
                                        )}
                                        {topic.notesPdfUrl && (
                                          <span className="text-teal-400 font-semibold">• PDF Handout</span>
                                        )}
                                        {topic.videoUrl && (
                                          <span className="text-rose-400 font-semibold">• Video lecture</span>
                                        )}
                                        {topic.linkedQuizId && (
                                          <span className="text-[#FACC15] font-semibold">• Topic Quiz</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => toggleTopicExpand(topic.id)}
                                      className="p-1.5 text-[#9FB0C8] hover:text-[#E8EEF8] cursor-pointer"
                                      title="Toggle details"
                                    >
                                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </div>

                                {/* Expanded Content Row: Two Big Buttons + Handouts */}
                                {isExpanded && (() => {
                                  const topicLinkedQuiz = topic.linkedQuizId
                                    ? quizzes.find(q => q.id === topic.linkedQuizId)
                                    : quizzes.find(q => q.scope === 'topic' && q.topicId === topic.id);

                                  return (
                                    <div className="px-4 pb-4 pt-2 border-t border-[#24315A]/60 space-y-3">
                                      {/* Two Big Action Buttons */}
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenLesson(topic, selectedCourse)}
                                          className={`w-full py-2.5 px-4 rounded-xl ${courseAccent.buttonBg} text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer`}
                                        >
                                          <BookOpen className="w-4 h-4 text-[#FACC15]" />
                                          <span>Study content</span>
                                        </button>

                                        {topicLinkedQuiz && (
                                          <button
                                            type="button"
                                            onClick={() => setCurriculumQuizState({
                                              quizId: topicLinkedQuiz.id,
                                              topicTitle: topic.title,
                                              topicId: topic.id
                                            })}
                                            className="w-full py-2.5 px-4 rounded-xl bg-[#FACC15] hover:bg-[#ffd233] text-[#0A1224] font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                                          >
                                            <FileQuestion className="w-4 h-4 text-[#0A1224]" />
                                            <span>Quiz ({topicLinkedQuiz.questionCount || topicLinkedQuiz.questions?.length || 0} Qs)</span>
                                          </button>
                                        )}
                                      {items.length > 0 && (
                                        <div className="space-y-1.5 pt-1">
                                          <span className="text-[10px] font-bold text-[#9FB0C8] uppercase tracking-wider block">
                                            Topic Study Handouts &amp; Materials:
                                          </span>
                                          <div className="space-y-1.5">
                                            {items.map(item => {
                                              const isPdf = item.url.toLowerCase().includes('.pdf') || item.url.includes('drive.google.com');
                                              return (
                                                <div
                                                  key={item.id}
                                                  className="p-2.5 rounded-xl bg-[#0B1220] border border-[#24315A] flex items-center justify-between gap-2 text-xs"
                                                >
                                                  <div className="flex items-center gap-2 min-w-0">
                                                    <FileText className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                                                    <span className="text-[#E8EEF8] truncate">{item.title}</span>
                                                  </div>
                                                  <div className="flex items-center gap-2 shrink-0">
                                                    {isPdf && (
                                                      <button
                                                        type="button"
                                                        onClick={() => setViewerItem({
                                                          title: item.title,
                                                          url: item.url,
                                                          courseCode: selectedCourse.code,
                                                          type: item.type || 'Lecture Note'
                                                        })}
                                                        className="px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-semibold cursor-pointer"
                                                      >
                                                        Preview
                                                      </button>
                                                    )}
                                                    <a
                                                      href={item.url}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      className="text-[#60A5FA] hover:underline text-[11px] flex items-center gap-1"
                                                    >
                                                      <span>Open</span>
                                                      <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* STICKY BOTTOM BAR: "x of y topics complete" & Continue button */}
                      <div className="sticky bottom-3 z-30 p-3.5 sm:p-4 rounded-2xl bg-[#0B1220]/95 backdrop-blur-md border border-[#24315A] shadow-2xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl ${courseAccent.badgeBg} ${courseAccent.badgeText} border ${courseAccent.badgeBorder} flex items-center justify-center font-mono font-bold text-xs shrink-0`}>
                            {courseCompletedTopics.length}/{courseTopics.length}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs sm:text-sm font-bold text-[#E8EEF8] block truncate">
                              {courseCompletedTopics.length} of {courseTopics.length} topics complete
                            </span>
                            <span className="text-[11px] text-[#9FB0C8]">
                              {coursePct}% syllabus finished
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const nextTopicToStudy = courseTopics.find(t => !completedTopicsList.includes(t.id)) || courseTopics[0];
                            if (nextTopicToStudy) {
                              handleOpenLesson(nextTopicToStudy, selectedCourse);
                            }
                          }}
                          className={`px-5 py-2.5 rounded-xl ${courseAccent.buttonBg} text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-lg transition-all hover:scale-[1.02] shrink-0`}
                        >
                          <span>{courseCompletedTopics.length === 0 ? 'Start Learning' : 'Continue'}</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* COURSE QUIZ CARD AT END OF COURSE TOPICS */}
                      {linkedCourseQuizzes.length > 0 && (
                        <div className="pt-4 border-t border-[#24315A] space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#FACC15]" />
                            <h3 className="font-heading font-black text-base text-[#FFFFFF]">
                              Comprehensive Course Quizzes
                            </h3>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {linkedCourseQuizzes.map(quiz => {
                              const isLocked = (quiz.unlockAfterTopicsComplete !== false) && !allTopicsDone;
                              const attempt = attemptsMap[quiz.id];

                              return (
                                <div
                                  key={quiz.id}
                                  className={`p-5 rounded-2xl border transition-all ${
                                    isLocked
                                      ? 'bg-[#0B1220] border-[#24315A]/60 opacity-80'
                                      : 'bg-[#16223A] border-teal-500/60 shadow-md'
                                  }`}
                                >
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-mono font-bold text-xs text-[#FACC15]">
                                        Course Quiz
                                      </span>
                                      {isLocked && (
                                        <span className="px-2 py-0.5 rounded bg-[#111A2E] text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                                          Locked
                                        </span>
                                      )}
                                    </div>

                                    <h4 className="font-heading font-bold text-sm text-[#E8EEF8]">
                                      {quiz.title}
                                    </h4>

                                    <p className="text-xs text-[#9FB0C8]">
                                      {quiz.questionCount || quiz.questions?.length || 0} questions • Passing: {quiz.passingScore || 70}%
                                    </p>
                                  </div>

                                  <div className="pt-3 mt-3 border-t border-[#24315A]/60 flex items-center justify-between">
                                    {isLocked ? (
                                      <span className="text-xs text-amber-300 font-medium">
                                        Complete all topics to unlock
                                      </span>
                                    ) : (
                                      <span className="text-xs text-teal-400 font-medium">
                                        {attempt ? `Best: ${attempt.bestScore}/${attempt.total}` : 'Unlocked! Ready to take'}
                                      </span>
                                    )}

                                    <button
                                      disabled={isLocked}
                                      onClick={() => onTakeQuiz?.(quiz.id)}
                                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                        isLocked
                                          ? 'bg-[#111A2E] text-[#9FB0C8] border border-[#24315A] cursor-not-allowed'
                                          : `${courseAccent.buttonBg} text-white shadow-md`
                                      }`}
                                    >
                                      {attempt ? 'Take Again' : 'Start Course Quiz'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: COURSE MATERIALS */}
                  {courseDetailTab === 'materials' && (
                    <div className="space-y-3">
                      {courseMaterials.length === 0 ? (
                        <div className="p-8 rounded-2xl bg-[#111A2E] border border-[#24315A] text-center space-y-2">
                          <FolderOpen className="w-8 h-8 text-[#FACC15] mx-auto opacity-70" />
                          <p className="font-heading font-bold text-sm text-[#E8EEF8]">
                            No general course materials uploaded yet
                          </p>
                          <p className="text-xs text-[#9FB0C8]">
                            Handouts and general lecture files not tied to a single topic will appear here.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {courseMaterials.map(mat => {
                            const isMatBookmarked = isBookmarked('material', mat.id);
                            const isPdf = mat.url.toLowerCase().includes('.pdf') || mat.url.includes('drive.google.com');

                            return (
                              <div
                                key={mat.id}
                                className="p-4 rounded-xl bg-[#16223A] border border-[#24315A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="font-heading font-bold text-xs sm:text-sm text-[#E8EEF8] truncate">
                                      {mat.title}
                                    </h4>
                                    <p className="text-[10px] text-[#9FB0C8]">
                                      {mat.courseCode || selectedCourse.code} • {mat.type || 'Handout'}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                  <button
                                    onClick={() => toggleBookmark({
                                      id: mat.id,
                                      type: 'material',
                                      title: mat.title,
                                      code: selectedCourse.code,
                                      link: mat.url
                                    })}
                                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                      isMatBookmarked
                                        ? 'bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15]/50'
                                        : 'bg-[#111A2E] text-[#9FB0C8] border-[#24315A] hover:text-[#FACC15]'
                                    }`}
                                    title={isMatBookmarked ? 'Remove bookmark' : 'Bookmark material'}
                                  >
                                    {isMatBookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                                  </button>

                                  {isPdf && (
                                    <button
                                      onClick={() => setViewerItem({
                                        title: mat.title,
                                        url: mat.url,
                                        courseCode: selectedCourse.code,
                                        type: mat.type || 'Course Material'
                                      })}
                                      className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Preview</span>
                                    </button>
                                  )}

                                  <a
                                    href={mat.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3 py-1.5 rounded-lg bg-[#111A2E] border border-[#24315A] text-[#E8EEF8] hover:text-white text-xs font-semibold flex items-center gap-1"
                                  >
                                    <span>Open</span>
                                    <ExternalLink className="w-3.5 h-3.5 text-[#9FB0C8]" />
                                  </a>

                                  {isPdf && (
                                    <a
                                      href={getPdfDownloadUrl(mat.url)}
                                      target="_blank"
                                      rel="noreferrer"
                                      download
                                      className="p-1.5 rounded-lg bg-[#111A2E] border border-[#24315A] text-[#FACC15] hover:bg-[#FACC15]/10"
                                      title="Download PDF"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: DEPARTMENT PAST QUESTIONS TAB                     */}
      {/* ========================================================= */}
      {activeTab === 'past-questions' && (
        <div className="space-y-3">
          {/* Filter Bar by Course */}
          <div className="p-3.5 rounded-xl bg-[#121C36] border border-[#24315A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#9AA8C7] shrink-0">Filter by Course:</span>
              <select
                value={pqCourseFilter}
                onChange={(e) => setPqCourseFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
              >
                <option value="All">All Courses ({selectedLevel})</option>
                {filteredSemesterCourses.map(c => (
                  <option key={c.id} value={c.code}>{c.code}: {c.title}</option>
                ))}
              </select>
            </div>

            <span className="text-xs text-[#9AA8C7]">
              Showing <strong className="text-[#FFC700]">{displayedDepartmentPastQuestions.length}</strong> past exam questions
            </span>
          </div>

          {displayedDepartmentPastQuestions.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#121C36] border border-[#24315A] text-center space-y-2">
              <FileQuestion className="w-8 h-8 text-[#FFC700] mx-auto opacity-70" />
              <p className="font-heading font-bold text-sm text-[#E6ECFA]">
                No past questions found for {selectedLevel} ({selectedSemester})
              </p>
              <p className="text-xs text-[#9AA8C7]">
                Past questions submitted for {department} will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayedDepartmentPastQuestions.map(pq => {
                const isPqBookmarked = isBookmarked('material', pq.id);

                return (
                  <div
                    key={pq.id}
                    className="p-3.5 rounded-xl bg-[#121C36] border border-[#24315A] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                        <FileQuestion className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-heading font-bold text-xs sm:text-sm text-[#E6ECFA] truncate">
                          {pq.title}
                        </h4>
                        <p className="text-[10px] text-[#9AA8C7]">
                          <strong className="text-[#FFC700]">{pq.courseCode || 'Course'}</strong> • {pq.level} • {pq.semester}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <button
                        onClick={() => toggleBookmark({
                          id: pq.id,
                          type: 'material',
                          title: pq.title,
                          code: pq.courseCode,
                          link: pq.url
                        })}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          isPqBookmarked
                            ? 'bg-[#FFC700]/20 text-[#FFC700] border-[#FFC700]/50'
                            : 'bg-[#0A1224] text-[#9AA8C7] border-[#24315A] hover:text-[#FFC700]'
                        }`}
                        title={isPqBookmarked ? 'Remove bookmark' : 'Bookmark past question'}
                      >
                        {isPqBookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => {
                          if (studentProfile?.uid) {
                            logStudentActivity({
                              uid: studentProfile.uid,
                              name: studentProfile.fullName || 'Student',
                              department: pq.department || studentProfile.department,
                              level: pq.level || studentProfile.level,
                              type: 'past question opened',
                              title: `${pq.courseCode ? pq.courseCode + ' ' : ''}${pq.title}`
                            });
                          }
                          setViewerItem({
                            title: pq.title,
                            url: pq.url,
                            courseCode: pq.courseCode,
                            type: 'Past Question'
                          });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>

                      <a
                        href={pq.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          if (studentProfile?.uid) {
                            logStudentActivity({
                              uid: studentProfile.uid,
                              name: studentProfile.fullName || 'Student',
                              department: pq.department || studentProfile.department,
                              level: pq.level || studentProfile.level,
                              type: 'past question opened',
                              title: `${pq.courseCode ? pq.courseCode + ' ' : ''}${pq.title}`
                            });
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] hover:text-white text-xs font-semibold flex items-center gap-1"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3.5 h-3.5 text-[#9AA8C7]" />
                      </a>

                      <a
                        href={getPdfDownloadUrl(pq.url)}
                        target="_blank"
                        rel="noreferrer"
                        download
                        onClick={() => {
                          if (studentProfile?.uid) {
                            logStudentActivity({
                              uid: studentProfile.uid,
                              name: studentProfile.fullName || 'Student',
                              department: pq.department || studentProfile.department,
                              level: pq.level || studentProfile.level,
                              type: 'past question opened',
                              title: `${pq.courseCode ? pq.courseCode + ' ' : ''}${pq.title}`
                            });
                          }
                        }}
                        className="p-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#FFC700] hover:bg-[#FFC700]/10"
                        title="Download PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 3: BOOKMARKS TAB                                     */}
      {/* ========================================================= */}
      {activeTab === 'bookmarks' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#9AA8C7] px-1">
            <span>Saved Courses, Topics, Notes and Past Questions</span>
            <span>{bookmarks.length} {bookmarks.length === 1 ? 'item' : 'items'}</span>
          </div>

          {bookmarks.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#121C36] border border-[#24315A] text-center space-y-2">
              <Bookmark className="w-8 h-8 text-[#FFC700] mx-auto opacity-70" />
              <p className="font-heading font-bold text-sm text-[#E6ECFA]">
                No items saved to your bookmarks yet
              </p>
              <p className="text-xs text-[#9AA8C7] max-w-sm mx-auto">
                Tap the bookmark ribbon icon on any course, syllabus topic, video tutorial, or PDF note to keep it handy here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {bookmarks.map((bm, idx) => (
                <div
                  key={bm.id || idx}
                  className="p-3.5 rounded-xl bg-[#121C36] border border-[#24315A] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#FFC700]/20 text-[#FFC700] flex items-center justify-center shrink-0">
                      {bm.type === 'course' ? (
                        <BookOpen className="w-4 h-4" />
                      ) : bm.type === 'topic' ? (
                        <Layers className="w-4 h-4" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
                          {bm.type}
                        </span>
                        {bm.code && (
                          <span className="text-xs font-bold text-[#60A5FA]">
                            {bm.code}
                          </span>
                        )}
                      </div>
                      <h4 className="font-heading font-semibold text-xs sm:text-sm text-[#E6ECFA] truncate mt-0.5">
                        {bm.title}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {/* If Course, tap to open */}
                    {bm.type === 'course' && (
                      <button
                        onClick={() => {
                          setSelectedCourseId(bm.id);
                          setActiveTab('courses');
                          setCourseDetailTab('topics');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <span>Open Course</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}

                    {/* If link or file URL */}
                    {(bm.link || bm.url) && (
                      <>
                        <button
                          onClick={() => setViewerItem({
                            title: bm.title,
                            url: bm.link || bm.url || '',
                            courseCode: bm.code,
                            type: bm.type
                          })}
                          className="px-3 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>
                        <a
                          href={bm.link || bm.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] hover:text-white"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}

                    <button
                      onClick={() => toggleBookmark(bm)}
                      className="p-1.5 rounded-lg bg-rose-950/40 text-rose-300 hover:text-white border border-rose-500/30 cursor-pointer"
                      title="Remove bookmark"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* IN-APP PDF VIEWER MODAL                                   */}
      {/* ========================================================= */}
      {viewerItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#070D1A]/90 backdrop-blur-sm">
          <div className="w-full max-w-4xl h-[88vh] rounded-2xl bg-[#0F1E36] border border-[#1E2E52] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-3.5 bg-[#070D1A] border-b border-[#1E2E52]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#FFC700]/20 text-[#FFC700] flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading font-bold text-xs sm:text-sm text-[#E6ECFA] truncate">
                    {viewerItem.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-[#9AA8C7]">
                    {viewerItem.courseCode && <span className="font-bold text-[#FFC700]">{viewerItem.courseCode}</span>}
                    <span>•</span>
                    <span>{viewerItem.type || 'Document'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={viewerItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] text-xs font-semibold hover:text-white flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#FFC700]" />
                  <span className="hidden sm:inline">Open in New Tab</span>
                </a>

                <a
                  href={getPdfDownloadUrl(viewerItem.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="px-2.5 py-1.5 rounded-lg bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] flex items-center gap-1 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </a>

                <button
                  onClick={() => setViewerItem(null)}
                  className="p-1.5 rounded-lg text-[#9AA8C7] hover:text-white hover:bg-[#1E2E52] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Embedded Iframe */}
            <div className="flex-1 bg-[#0A1224] relative">
              <iframe
                src={formatPdfUrl(viewerItem.url)}
                title={viewerItem.title}
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
