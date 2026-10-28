import React, { useState, useMemo } from 'react';
import { CourseItem, ResourceItem, BookmarkItem } from '../types';
import { normalizeCourseLevel, normalizeCourseSemester } from '../data/coursesAndTimetables';
import {
  BookOpen,
  FileText,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Search,
  Filter,
  Download,
  GraduationCap,
  Sparkles,
  ChevronRight,
  Layers,
  FolderOpen,
  HelpCircle,
  FileQuestion,
  UserCheck,
  Link2
} from 'lucide-react';

interface StudentResourcesViewProps {
  courses: CourseItem[];
  resources: ResourceItem[];
  userLevel?: string;
  department: string;
  isBookmarked: (type: 'course' | 'material' | 'announcement', id: string) => boolean;
  toggleBookmark: (item: Omit<BookmarkItem, 'createdAt'> & { createdAt?: string }) => void;
  bookmarks: BookmarkItem[];
  onNavigateLinks?: () => void;
}

type ResourceTab = 'courses' | 'materials' | 'past-questions' | 'bookmarks';

export const StudentResourcesView: React.FC<StudentResourcesViewProps> = ({
  courses,
  resources,
  userLevel,
  department,
  isBookmarked,
  toggleBookmark,
  bookmarks,
  onNavigateLinks
}) => {
  const [activeTab, setActiveTab] = useState<ResourceTab>('courses');

  // Pre-filter with student level if set, else 'All'
  const initialLevel = userLevel ? normalizeCourseLevel(userLevel) : 'All';
  const [levelFilter, setLevelFilter] = useState<string>(initialLevel);
  const [semesterFilter, setSemesterFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Expandable course state
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  // 1. FILTERED COURSES
  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      // Dept match
      if (c.department !== department) return false;

      // Level match
      if (levelFilter !== 'All') {
        if (normalizeCourseLevel(c.level) !== normalizeCourseLevel(levelFilter)) {
          return false;
        }
      }

      // Semester match
      if (semesterFilter !== 'All') {
        if (normalizeCourseSemester(c.semester) !== normalizeCourseSemester(semesterFilter)) {
          return false;
        }
      }

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inCode = c.code.toLowerCase().includes(q);
        const inTitle = c.title.toLowerCase().includes(q);
        const inDesc = (c.description || '').toLowerCase().includes(q);
        return inCode || inTitle || inDesc;
      }

      return true;
    });
  }, [courses, department, levelFilter, semesterFilter, searchQuery]);

  // Combined extracted materials list (from both CourseItem materials and Rep-uploaded ResourceItems)
  const allMaterials = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      courseCode: string;
      category: string;
      url: string;
      author?: string;
      level?: string;
      semester?: string;
      description?: string;
      source: 'course' | 'rep';
    }> = [];

    // Materials embedded in course items
    courses.forEach(c => {
      if (c.department === department && c.materials) {
        c.materials.forEach(m => {
          list.push({
            id: m.id || `mat_${c.code}_${m.title}`,
            title: m.title,
            courseCode: c.code,
            category: m.category,
            url: m.url,
            author: 'Faculty Department',
            level: c.level,
            semester: c.semester,
            description: c.title,
            source: 'course'
          });
        });
      }
    });

    // Materials uploaded by reps
    resources.forEach(r => {
      if (r.department === department) {
        list.push({
          id: r.id,
          title: r.title,
          courseCode: r.courseCode,
          category: r.category,
          url: r.url,
          author: r.uploadedByRole ? `${r.uploadedByRole} (${r.uploadedByEmail || 'Rep'})` : r.uploadedByEmail,
          level: r.level,
          semester: r.semester,
          description: r.description,
          source: 'rep'
        });
      }
    });

    return list;
  }, [courses, resources, department]);

  // 2. FILTERED MATERIALS (excluding Past Questions)
  const filteredMaterials = useMemo(() => {
    return allMaterials.filter(m => {
      if (m.category === 'Past Question') return false;

      if (levelFilter !== 'All') {
        if (normalizeCourseLevel(m.level) !== normalizeCourseLevel(levelFilter)) {
          return false;
        }
      }

      if (semesterFilter !== 'All') {
        if (normalizeCourseSemester(m.semester) !== normalizeCourseSemester(semesterFilter)) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.title.toLowerCase().includes(q) ||
          m.courseCode.toLowerCase().includes(q) ||
          (m.author || '').toLowerCase().includes(q) ||
          (m.description || '').toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [allMaterials, levelFilter, semesterFilter, searchQuery]);

  // 3. FILTERED PAST QUESTIONS
  const filteredPastQuestions = useMemo(() => {
    return allMaterials.filter(m => {
      if (m.category !== 'Past Question') return false;

      if (levelFilter !== 'All') {
        if (normalizeCourseLevel(m.level) !== normalizeCourseLevel(levelFilter)) {
          return false;
        }
      }

      if (semesterFilter !== 'All') {
        if (normalizeCourseSemester(m.semester) !== normalizeCourseSemester(semesterFilter)) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.title.toLowerCase().includes(q) ||
          m.courseCode.toLowerCase().includes(q) ||
          (m.author || '').toLowerCase().includes(q) ||
          (m.description || '').toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [allMaterials, levelFilter, semesterFilter, searchQuery]);

  // 4. BOOKMARKED RESOURCES
  const bookmarkedItems = useMemo(() => {
    return bookmarks.filter(b => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          b.title.toLowerCase().includes(q) ||
          (b.code || '').toLowerCase().includes(q) ||
          (b.category || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [bookmarks, searchQuery]);

  const openLink = (url?: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4">
      
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-[#E6ECFA] tracking-tight">
            Academic Resources
          </h2>
          <p className="text-xs text-[#9AA8C7]">
            {department} curriculum syllabus, course notes, and past examination papers.
          </p>
        </div>

        {/* Global Resource Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#9AA8C7] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search courses, notes, past questions..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#62759F] focus:outline-none focus:border-[#2F52FF] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#9AA8C7] hover:text-white"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0F1E36] border border-[#24315A] overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('courses')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'courses'
              ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
              : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-[#FFC700]" />
          <span>Courses ({filteredCourses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('materials')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'materials'
              ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
              : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-[#FFC700]" />
          <span>Materials ({filteredMaterials.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('past-questions')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'past-questions'
              ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
              : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
          }`}
        >
          <FileQuestion className="w-3.5 h-3.5 text-[#FFC700]" />
          <span>Past Questions ({filteredPastQuestions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('bookmarks')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'bookmarks'
              ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
              : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5 text-[#FFC700]" />
          <span>Bookmarks ({bookmarkedItems.length})</span>
        </button>

        {onNavigateLinks && (
          <button
            onClick={onNavigateLinks}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer text-[#9AA8C7] hover:text-[#FFC700] hover:bg-[#121C36] ml-auto border border-[#24315A]/60"
          >
            <Link2 className="w-3.5 h-3.5 text-[#FFC700]" />
            <span>Communities &amp; Links &rarr;</span>
          </button>
        )}
      </div>

      {/* Filter Row: Level & Semester */}
      {activeTab !== 'bookmarks' && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl bg-[#0F1E36]/60 border border-[#1F2C4C]">
          <div className="flex items-center gap-1.5 text-xs text-[#9AA8C7]">
            <Filter className="w-3.5 h-3.5 text-[#FFC700]" />
            <span className="font-semibold text-[#E6ECFA]">Filters:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Level Filter */}
            <div className="flex items-center gap-1 bg-[#121C36] p-0.5 rounded-lg border border-[#24315A] text-xs">
              <span className="text-[10px] uppercase font-bold text-[#9AA8C7] px-1.5">Level</span>
              {(['All', 'ND1', 'ND2', 'HND1', 'HND2'] as const).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setLevelFilter(lvl)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                    levelFilter === lvl
                      ? 'bg-[#2F52FF] text-white font-bold'
                      : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Semester Filter */}
            <div className="flex items-center gap-1 bg-[#121C36] p-0.5 rounded-lg border border-[#24315A] text-xs">
              <span className="text-[10px] uppercase font-bold text-[#9AA8C7] px-1.5">Semester</span>
              {[
                { id: 'All', label: 'All' },
                { id: 'First Semester', label: '1st Sem' },
                { id: 'Second Semester', label: '2nd Sem' }
              ].map(sem => (
                <button
                  key={sem.id}
                  onClick={() => setSemesterFilter(sem.id)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                    semesterFilter === sem.id
                      ? 'bg-[#2F52FF] text-white font-bold'
                      : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                  }`}
                >
                  {sem.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: COURSES                                           */}
      {/* ======================================================== */}
      {activeTab === 'courses' && (
        <div className="space-y-2.5">
          {filteredCourses.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#0F1E36] border border-[#24315A] space-y-2">
              <BookOpen className="w-8 h-8 text-[#9AA8C7] mx-auto opacity-40" />
              <p className="text-sm font-semibold text-[#E6ECFA]">No courses match your filter</p>
              <p className="text-xs text-[#9AA8C7]">
                Try switching the level ({levelFilter}) or semester ({semesterFilter}) filter above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredCourses.map(course => {
                const bookmarked = isBookmarked('course', course.id);
                const isExpanded = expandedCourseId === course.id;

                return (
                  <div
                    key={course.id}
                    className="p-3.5 rounded-xl bg-[#0F1E36] border border-[#1F2C4C] hover:border-[#2F52FF]/60 transition-all flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-[#2F52FF]/20 text-[#2F52FF] border border-[#2F52FF]/40 text-xs font-bold">
                            {course.code}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#121C36] text-[#9AA8C7] border border-[#24315A]">
                            {course.units} Units
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#121C36] text-[#FFC700] border border-[#24315A]">
                            {course.level} • {normalizeCourseSemester(course.semester) === 'First Semester' ? 'Sem 1' : 'Sem 2'}
                          </span>
                        </div>

                        {/* Bookmark Button */}
                        <button
                          onClick={() =>
                            toggleBookmark({
                              id: course.id,
                              type: 'course',
                              title: `${course.code}: ${course.title}`,
                              code: course.code,
                              category: course.type,
                              department: course.department
                            })
                          }
                          title={bookmarked ? 'Remove bookmark' : 'Bookmark course'}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                            bookmarked
                              ? 'bg-[#FFC700]/10 border-[#FFC700] text-[#FFC700]'
                              : 'bg-[#121C36] border-[#24315A] text-[#9AA8C7] hover:text-[#FFC700]'
                          }`}
                        >
                          {bookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <h3 className="font-display font-bold text-sm text-[#E6ECFA] leading-snug">
                        {course.title}
                      </h3>

                      {course.description && (
                        <p className={`text-xs text-[#9AA8C7] mt-1.5 ${isExpanded ? '' : 'line-clamp-2'}`}>
                          {course.description}
                        </p>
                      )}
                    </div>

                    {/* Materials accordion or preview */}
                    {course.materials && course.materials.length > 0 && (
                      <div className="pt-2.5 border-t border-[#1F2C4C] space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-[#9AA8C7]">
                          <span className="font-semibold text-[#E6ECFA] flex items-center gap-1.5">
                            <FolderOpen className="w-3 h-3 text-[#FFC700]" />
                            {course.materials.length} Resource{course.materials.length > 1 ? 's' : ''} Attached
                          </span>
                          <button
                            onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                            className="text-[#2F52FF] hover:underline text-[11px] font-medium cursor-pointer"
                          >
                            {isExpanded ? 'Hide' : 'View'}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="space-y-1.5 pt-1">
                            {course.materials.map((m, idx) => {
                              const matBookmarked = isBookmarked('material', m.id || `${course.code}_m_${idx}`);
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#121C36] border border-[#24315A] text-xs"
                                >
                                  <div className="min-w-0">
                                    <p className="text-[#E6ECFA] truncate font-medium">{m.title}</p>
                                    <span className="text-[10px] text-[#FFC700]">{m.category}</span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() =>
                                        toggleBookmark({
                                          id: m.id || `${course.code}_m_${idx}`,
                                          type: 'material',
                                          title: `${course.code} - ${m.title}`,
                                          code: course.code,
                                          category: m.category,
                                          link: m.url,
                                          department: course.department
                                        })
                                      }
                                      className={`p-1 rounded border transition-colors cursor-pointer ${
                                        matBookmarked
                                          ? 'border-[#FFC700] text-[#FFC700]'
                                          : 'border-[#24315A] text-[#9AA8C7] hover:text-[#FFC700]'
                                      }`}
                                    >
                                      {matBookmarked ? <BookmarkCheck className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
                                    </button>
                                    <button
                                      onClick={() => openLink(m.url)}
                                      className="p-1 rounded bg-[#2F52FF] text-white hover:bg-[#2544DD] cursor-pointer"
                                      title="Open Material"
                                    >
                                      <Download className="w-3 h-3" />
                                    </button>
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
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: MATERIALS (Lecture Notes, Textbooks, Slides)       */}
      {/* ======================================================== */}
      {activeTab === 'materials' && (
        <div className="space-y-2.5">
          {filteredMaterials.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#0F1E36] border border-[#24315A] space-y-2">
              <FileText className="w-8 h-8 text-[#9AA8C7] mx-auto opacity-40" />
              <p className="text-sm font-semibold text-[#E6ECFA]">No course materials found</p>
              <p className="text-xs text-[#9AA8C7]">No lecture notes or slides match the current filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredMaterials.map(item => {
                const bookmarked = isBookmarked('material', item.id);
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-[#0F1E36] border border-[#1F2C4C] hover:border-[#2F52FF]/60 transition-all flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-[#2F52FF]/20 text-[#2F52FF] border border-[#2F52FF]/40 text-xs font-bold">
                            {item.courseCode}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#121C36] text-[#FFC700] border border-[#24315A]">
                            {item.category}
                          </span>
                          {item.level && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#121C36] text-[#9AA8C7] border border-[#24315A]">
                              {item.level}
                            </span>
                          )}
                        </div>

                        {/* Bookmark Button */}
                        <button
                          onClick={() =>
                            toggleBookmark({
                              id: item.id,
                              type: 'material',
                              title: `${item.courseCode} - ${item.title}`,
                              code: item.courseCode,
                              category: item.category,
                              link: item.url,
                              department
                            })
                          }
                          title={bookmarked ? 'Remove bookmark' : 'Bookmark material'}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                            bookmarked
                              ? 'bg-[#FFC700]/10 border-[#FFC700] text-[#FFC700]'
                              : 'bg-[#121C36] border-[#24315A] text-[#9AA8C7] hover:text-[#FFC700]'
                          }`}
                        >
                          {bookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <h3 className="font-display font-bold text-sm text-[#E6ECFA] leading-snug">
                        {item.title}
                      </h3>

                      {item.author && (
                        <p className="text-[11px] text-[#9AA8C7] mt-1 flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-[#FFC700]" />
                          <span>Author / Source: {item.author}</span>
                        </p>
                      )}

                      {item.description && (
                        <p className="text-xs text-[#9AA8C7] mt-1.5 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#1F2C4C] flex items-center justify-end">
                      <button
                        onClick={() => openLink(item.url)}
                        className="px-3 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2544DD] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-[#FFC700]" />
                        <span>Download / View</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: PAST QUESTIONS                                    */}
      {/* ======================================================== */}
      {activeTab === 'past-questions' && (
        <div className="space-y-2.5">
          {filteredPastQuestions.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#0F1E36] border border-[#24315A] space-y-2">
              <FileQuestion className="w-8 h-8 text-[#9AA8C7] mx-auto opacity-40" />
              <p className="text-sm font-semibold text-[#E6ECFA]">No past questions available</p>
              <p className="text-xs text-[#9AA8C7]">No examination past questions found for this selection.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredPastQuestions.map(item => {
                const bookmarked = isBookmarked('material', item.id);
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-[#0F1E36] border border-[#1F2C4C] hover:border-[#FFC700]/60 transition-all flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-[#FFC700]/20 text-[#FFC700] border border-[#FFC700]/40 text-xs font-bold">
                            {item.courseCode}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#121C36] text-[#E6ECFA] border border-[#24315A]">
                            Past Exam Paper
                          </span>
                          {item.level && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#121C36] text-[#9AA8C7] border border-[#24315A]">
                              {item.level}
                            </span>
                          )}
                        </div>

                        {/* Bookmark Button */}
                        <button
                          onClick={() =>
                            toggleBookmark({
                              id: item.id,
                              type: 'material',
                              title: `${item.courseCode} - ${item.title}`,
                              code: item.courseCode,
                              category: 'Past Question',
                              link: item.url,
                              department
                            })
                          }
                          title={bookmarked ? 'Remove bookmark' : 'Bookmark past question'}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                            bookmarked
                              ? 'bg-[#FFC700]/10 border-[#FFC700] text-[#FFC700]'
                              : 'bg-[#121C36] border-[#24315A] text-[#9AA8C7] hover:text-[#FFC700]'
                          }`}
                        >
                          {bookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <h3 className="font-display font-bold text-sm text-[#E6ECFA] leading-snug">
                        {item.title}
                      </h3>

                      {item.author && (
                        <p className="text-[11px] text-[#9AA8C7] mt-1 flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-[#FFC700]" />
                          <span>Submitted: {item.author}</span>
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#1F2C4C] flex items-center justify-end">
                      <button
                        onClick={() => openLink(item.url)}
                        className="px-3 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2544DD] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-[#FFC700]" />
                        <span>Download Questions</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: BOOKMARKS                                         */}
      {/* ======================================================== */}
      {activeTab === 'bookmarks' && (
        <div className="space-y-2.5">
          {bookmarkedItems.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#0F1E36] border border-[#24315A] space-y-2">
              <Bookmark className="w-8 h-8 text-[#9AA8C7] mx-auto opacity-40" />
              <p className="text-sm font-semibold text-[#E6ECFA]">No bookmarked resources</p>
              <p className="text-xs text-[#9AA8C7]">
                Tap the bookmark icon on any course, lecture note, or past question to save it here for fast access!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {bookmarkedItems.map(item => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-[#0F1E36] border border-[#1F2C4C] flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[#121C36] text-[#FFC700] border border-[#24315A]">
                        {item.type}
                      </span>
                      {item.code && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#2F52FF]/20 text-[#2F52FF] font-bold">
                          {item.code}
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-xs text-[#E6ECFA] truncate">
                      {item.title}
                    </h4>
                    {item.link && (
                      <button
                        onClick={() => openLink(item.link)}
                        className="text-[11px] text-[#2F52FF] hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open Resource</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => toggleBookmark(item)}
                    title="Remove from bookmarks"
                    className="p-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-[#FFC700] hover:text-rose-400 hover:border-rose-400/40 cursor-pointer shrink-0"
                  >
                    <BookmarkCheck className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
