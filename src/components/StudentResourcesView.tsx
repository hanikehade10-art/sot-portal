import React, { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
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
  Link2
} from 'lucide-react';
import { ShareButton } from './ShareButton';

interface StudentResourcesViewProps {
  courses: CourseItem[];
  resources: ResourceItem[];
  userLevel?: string;
  department: string;
  isBookmarked: (type: any, id: string) => boolean;
  toggleBookmark: (item: any) => void;
  bookmarks: BookmarkItem[];
  onNavigateLinks?: () => void;
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
  onNavigateLinks
}) => {
  const [activeTab, setActiveTab] = useState<MainResourceTab>('courses');

  // Level & Semester selectors (defaulting to student's level)
  const defaultLevel = userLevel ? normalizeCourseLevel(userLevel) : 'ND1';
  const [selectedLevel, setSelectedLevel] = useState<'ND1' | 'ND2' | 'HND1' | 'HND2'>(defaultLevel);
  const [selectedSemester, setSelectedSemester] = useState<'First Semester' | 'Second Semester'>('First Semester');
  const [searchQuery, setSearchQuery] = useState('');

  // Course Detail state (when a course is opened)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courseDetailTab, setCourseDetailTab] = useState<CourseDetailTab>('topics');
  const [expandedTopicIds, setExpandedTopicIds] = useState<Record<string, boolean>>({});

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

  // -------------------------------------------------------------
  // COMPUTED LISTS & TAB COUNTS
  // -------------------------------------------------------------
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
          {/* CASE 1A: NO COURSE OPENED -> CLEAN LIST OF COURSES */}
          {!selectedCourse ? (
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
                    const courseTopicsList = topics.filter(t => t.courseId === course.id);
                    const coursePQsCount = resources.filter(
                      r => (r.courseId === course.id || r.courseCode === course.code) &&
                           (r.type === 'Past Question' || r.category === 'Past Question')
                    ).length;
                    const bookmarked = isBookmarked('course', course.id);

                    return (
                      <div
                        key={course.id}
                        onClick={() => {
                          setSelectedCourseId(course.id);
                          setCourseDetailTab('topics');
                        }}
                        className="p-4 rounded-xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] transition-all cursor-pointer group flex flex-col justify-between space-y-3 shadow-sm hover:shadow-[0_4px_20px_rgba(47,82,255,0.12)]"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-heading font-extrabold text-sm text-[#FFC700] tracking-wide">
                              {course.code}
                            </span>
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <span className="px-2 py-0.5 rounded bg-[#0A1224] border border-[#24315A] text-[10px] font-bold text-[#E6ECFA]">
                                {course.units || 3} Units
                              </span>
                              <ShareButton
                                title={`${course.code}: ${course.title}`}
                                itemType="course"
                                code={course.code}
                                id={course.id}
                                textDetails={`${course.units || 3} Units`}
                                variant="icon"
                              />
                              <button
                                onClick={() => toggleBookmark({
                                  id: course.id,
                                  type: 'course',
                                  title: `${course.code}: ${course.title}`,
                                  code: course.code,
                                  department: course.department
                                })}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  bookmarked
                                    ? 'bg-[#FFC700]/20 text-[#FFC700] border-[#FFC700]/50'
                                    : 'bg-[#0A1224] text-[#9AA8C7] border-[#24315A] hover:text-[#FFC700]'
                                }`}
                                title={bookmarked ? 'Remove bookmark' : 'Bookmark this course'}
                              >
                                {bookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          <h3 className="font-heading font-bold text-sm text-[#E6ECFA] group-hover:text-white transition-colors line-clamp-2">
                            {course.title}
                          </h3>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#24315A]/60 text-xs text-[#9AA8C7]">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-[11px] font-medium text-[#60A5FA]">
                              <Layers className="w-3 h-3 text-[#2F52FF]" />
                              <span>{courseTopicsList.length} {courseTopicsList.length === 1 ? 'Topic' : 'Topics'}</span>
                            </span>
                            {coursePQsCount > 0 && (
                              <span className="text-[11px] text-amber-300">
                                • {coursePQsCount} PQ
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-semibold text-[#FFC700] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            <span>Open</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* CASE 1B: COURSE PAGE OPENED -> TABS: TOPICS, PAST QUESTIONS, MATERIALS */
            <div className="space-y-4">
              {/* Back Bar & Course Header */}
              <div className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedCourseId(null)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FFC700] hover:underline cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
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
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                      isBookmarked('course', selectedCourse.id)
                        ? 'bg-[#FFC700]/20 text-[#FFC700] border-[#FFC700]/50'
                        : 'bg-[#0A1224] text-[#9AA8C7] border-[#24315A] hover:text-white'
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

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-black text-lg text-[#FFC700]">
                      {selectedCourse.code}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/40 text-xs font-bold">
                      {selectedCourse.units || 3} Credit Units
                    </span>
                  </div>
                  <h2 className="font-heading font-bold text-base sm:text-lg text-[#E6ECFA] mt-0.5">
                    {selectedCourse.title}
                  </h2>
                  <p className="text-xs text-[#9AA8C7] mt-1">
                    {selectedCourse.department} • {selectedCourse.level} • {selectedCourse.semester}
                  </p>
                </div>

                {/* Internal Course Tabs: Topics, Materials */}
                <div className="flex items-center gap-2 pt-2 border-t border-[#24315A]/60">
                  <button
                    onClick={() => setCourseDetailTab('topics')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      courseDetailTab === 'topics'
                        ? 'bg-[#2F52FF] text-white shadow-[0_0_10px_rgba(47,82,255,0.4)]'
                        : 'bg-[#0A1224] text-[#9AA8C7] hover:text-[#E6ECFA]'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Topics ({courseTopics.length})</span>
                  </button>

                  <button
                    onClick={() => setCourseDetailTab('materials')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      courseDetailTab === 'materials'
                        ? 'bg-[#2F52FF] text-white shadow-[0_0_10px_rgba(47,82,255,0.4)]'
                        : 'bg-[#0A1224] text-[#9AA8C7] hover:text-[#E6ECFA]'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Materials ({courseMaterials.length})</span>
                  </button>
                </div>
              </div>

              {/* TAB 1: TOPICS (EXPANDABLE LIST WITH VIDEOS, NOTES & LINKS) */}
              {courseDetailTab === 'topics' && (
                <div className="space-y-3">
                  {courseTopics.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[#121C36] border border-[#24315A] text-center space-y-2">
                      <Layers className="w-8 h-8 text-[#FFC700] mx-auto opacity-70" />
                      <p className="font-heading font-bold text-sm text-[#E6ECFA]">
                        No syllabus topics added for this course yet
                      </p>
                      <p className="text-xs text-[#9AA8C7]">
                        Detailed lecture topics, video tutorials and notes will appear here once published.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {courseTopics.map((topic, idx) => {
                        const items = getTopicItems(topic.id);
                        const isExpanded = expandedTopicIds[topic.id] !== false; // default expanded
                        const topicBookmarked = isBookmarked('topic', topic.id);

                        return (
                          <div
                            key={topic.id}
                            className="rounded-xl bg-[#121C36] border border-[#24315A] overflow-hidden transition-all shadow-sm"
                          >
                            {/* Topic Card Header */}
                            <div
                              onClick={() => toggleTopicExpand(topic.id)}
                              className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#1A2E63]/40 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="w-6 h-6 rounded-md bg-[#0A1224] border border-[#24315A] text-[#FFC700] font-bold text-xs flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <h4 className="font-heading font-bold text-sm text-[#E6ECFA] truncate">
                                  {topic.title}
                                </h4>
                              </div>

                              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <span className="text-[11px] text-[#9AA8C7] hidden sm:inline">
                                  {items.length} {items.length === 1 ? 'item' : 'items'}
                                </span>

                                <button
                                  onClick={() => toggleBookmark({
                                    id: topic.id,
                                    type: 'topic',
                                    title: topic.title,
                                    code: selectedCourse.code,
                                    department: selectedCourse.department
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

                                <button
                                  onClick={() => toggleTopicExpand(topic.id)}
                                  className="p-1 text-[#9AA8C7] hover:text-[#E6ECFA]"
                                >
                                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>

                            {/* Expanded Topic Items */}
                            {isExpanded && (
                              <div className="px-3.5 pb-3.5 pt-1 border-t border-[#24315A]/60 space-y-2.5 bg-[#0A1224]/50">
                                {items.length === 0 ? (
                                  <p className="text-xs text-[#9AA8C7] py-2 text-center">
                                    Notes and video resources for this topic will be uploaded soon.
                                  </p>
                                ) : (
                                  <div className="space-y-2.5">
                                    {items.map(item => {
                                      const isItemBookmarked = isBookmarked('material', item.id);
                                      const ytEmbed = item.type === 'Video' ? getYouTubeEmbedUrl(item.url) : null;
                                      const isPdf = item.type === 'Note' || item.url.toLowerCase().includes('.pdf') || item.url.includes('drive.google.com');

                                      return (
                                        <div
                                          key={item.id}
                                          className="p-3 rounded-lg bg-[#121C36] border border-[#24315A] space-y-2"
                                        >
                                          {/* Item Title & Actions */}
                                          <div className="flex items-start sm:items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                              {item.type === 'Video' ? (
                                                <div className="w-6 h-6 rounded bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                                                  <Video className="w-3.5 h-3.5" />
                                                </div>
                                              ) : item.type === 'Note' ? (
                                                <div className="w-6 h-6 rounded bg-[#FFC700]/20 text-[#FFC700] flex items-center justify-center shrink-0">
                                                  <FileText className="w-3.5 h-3.5" />
                                                </div>
                                              ) : (
                                                <div className="w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                                  <Link2 className="w-3.5 h-3.5" />
                                                </div>
                                              )}

                                              <div>
                                                <p className="font-heading font-semibold text-xs text-[#E6ECFA] line-clamp-1">
                                                  {item.title}
                                                </p>
                                                <span className="text-[10px] text-[#9AA8C7]">
                                                  {item.type || 'Resource'}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                              {/* Bookmark Item */}
                                              <button
                                                onClick={() => toggleBookmark({
                                                  id: item.id,
                                                  type: 'material',
                                                  title: item.title,
                                                  code: selectedCourse.code,
                                                  link: item.url
                                                })}
                                                className={`p-1 rounded border transition-all cursor-pointer ${
                                                  isItemBookmarked
                                                    ? 'bg-[#FFC700]/20 text-[#FFC700] border-[#FFC700]/50'
                                                    : 'bg-[#0A1224] text-[#9AA8C7] border-[#24315A] hover:text-[#FFC700]'
                                                }`}
                                                title={isItemBookmarked ? 'Remove bookmark' : 'Bookmark item'}
                                              >
                                                {isItemBookmarked ? <BookmarkCheck className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
                                              </button>

                                              {/* If PDF, open in-app viewer modal */}
                                              {isPdf && (
                                                <button
                                                  onClick={() => setViewerItem({
                                                    title: item.title,
                                                    url: item.url,
                                                    courseCode: selectedCourse.code,
                                                    type: item.type || 'Lecture Note'
                                                  })}
                                                  className="px-2 py-1 rounded bg-[#2F52FF] hover:bg-[#2545df] text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                                >
                                                  <Eye className="w-3 h-3" />
                                                  <span>Preview</span>
                                                </button>
                                              )}

                                              {/* Open Link / File in new tab */}
                                              <a
                                                href={item.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-2 py-1 rounded bg-[#0A1224] hover:bg-[#1A2E63] border border-[#24315A] text-[#E6ECFA] text-[11px] font-semibold flex items-center gap-1"
                                              >
                                                <span>Open</span>
                                                <ExternalLink className="w-3 h-3 text-[#9AA8C7]" />
                                              </a>

                                              {/* Download button for files */}
                                              {isPdf && (
                                                <a
                                                  href={getPdfDownloadUrl(item.url)}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  download
                                                  className="p-1 rounded bg-[#0A1224] hover:bg-[#1A2E63] border border-[#24315A] text-[#FFC700]"
                                                  title="Download file"
                                                >
                                                  <Download className="w-3 h-3" />
                                                </a>
                                              )}
                                            </div>
                                          </div>

                                          {/* Embedded YouTube Player if YouTube Link */}
                                          {ytEmbed && (
                                            <div className="w-full aspect-video rounded-lg overflow-hidden bg-black/60 border border-[#24315A] shadow-md mt-2">
                                              <iframe
                                                src={ytEmbed}
                                                title={item.title}
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                                className="w-full h-full border-0"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: COURSE MATERIALS */}
              {courseDetailTab === 'materials' && (
                <div className="space-y-3">
                  {courseMaterials.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[#121C36] border border-[#24315A] text-center space-y-2">
                      <FolderOpen className="w-8 h-8 text-[#FFC700] mx-auto opacity-70" />
                      <p className="font-heading font-bold text-sm text-[#E6ECFA]">
                        No general course materials uploaded yet
                      </p>
                      <p className="text-xs text-[#9AA8C7]">
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
                            className="p-3.5 rounded-xl bg-[#121C36] border border-[#24315A] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-[#2F52FF]/20 text-[#60A5FA] flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-heading font-bold text-xs sm:text-sm text-[#E6ECFA] truncate">
                                  {mat.title}
                                </h4>
                                <p className="text-[10px] text-[#9AA8C7]">
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
                                    ? 'bg-[#FFC700]/20 text-[#FFC700] border-[#FFC700]/50'
                                    : 'bg-[#0A1224] text-[#9AA8C7] border-[#24315A] hover:text-[#FFC700]'
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
                                  className="px-3 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Preview</span>
                                </button>
                              )}

                              <a
                                href={mat.url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] hover:text-white text-xs font-semibold flex items-center gap-1"
                              >
                                <span>Open</span>
                                <ExternalLink className="w-3.5 h-3.5 text-[#9AA8C7]" />
                              </a>

                              {isPdf && (
                                <a
                                  href={getPdfDownloadUrl(mat.url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  download
                                  className="p-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#FFC700] hover:bg-[#FFC700]/10"
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
                        onClick={() => setViewerItem({
                          title: pq.title,
                          url: pq.url,
                          courseCode: pq.courseCode,
                          type: 'Past Question'
                        })}
                        className="px-3 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>

                      <a
                        href={pq.url}
                        target="_blank"
                        rel="noreferrer"
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
