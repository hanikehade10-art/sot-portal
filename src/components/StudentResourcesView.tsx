import React, { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  CourseItem,
  ResourceItem,
  BookmarkItem,
  CourseSheetItem,
  CourseSheetLevel,
  CourseSheetSemester
} from '../types';
import {
  normalizeCourseLevel,
  normalizeCourseSemester,
  getCourseSheetDocId,
  formatPdfUrl,
  getPdfDownloadUrl
} from '../data/coursesAndTimetables';
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
  Link2,
  Eye,
  X
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

  // Course Outlines & Sheets State
  const defaultSheetLevel: CourseSheetLevel = userLevel ? normalizeCourseLevel(userLevel) : 'ND1';
  const [sheetLevel, setSheetLevel] = useState<CourseSheetLevel>(defaultSheetLevel);
  const [sheetSem, setSheetSem] = useState<CourseSheetSemester>('First');
  const [courseSheets, setCourseSheets] = useState<Record<string, CourseSheetItem>>({});
  const [loadingSheets, setLoadingSheets] = useState(true);
  const [selectedOutlineId, setSelectedOutlineId] = useState<string | null>(null);

  // In-App PDF Viewer Modal state
  const [viewerItem, setViewerItem] = useState<{ title: string; url: string; courseCode?: string; category?: string } | null>(null);

  // Sync sheetLevel when userLevel changes
  useEffect(() => {
    if (userLevel) {
      setSheetLevel(normalizeCourseLevel(userLevel));
    }
  }, [userLevel]);

  // Real-time listener for department courseSheets
  useEffect(() => {
    if (!department) return;
    setLoadingSheets(true);
    const q = query(collection(db, 'courseSheets'), where('department', '==', department));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const map: Record<string, CourseSheetItem> = {};
        snapshot.forEach((docSnap) => {
          map[docSnap.id] = { id: docSnap.id, ...(docSnap.data() as Omit<CourseSheetItem, 'id'>) };
        });
        setCourseSheets(map);
        setLoadingSheets(false);
      },
      (error) => {
        console.warn('courseSheets onSnapshot error:', error);
        setLoadingSheets(false);
      }
    );
    return () => unsub();
  }, [department]);

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

  // Course Outlines list (from courseSheets + resources where category === 'Course Outline')
  const departmentOutlines = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      courseCode: string;
      category: 'Course Outline';
      url: string;
      fileName: string;
      level: string;
      semester: string;
      author?: string;
      createdAt?: string;
    }> = [];

    // 1. From courseSheets
    Object.values(courseSheets).forEach(sheet => {
      if (sheet.department === department && sheet.url) {
        list.push({
          id: sheet.id,
          title: sheet.title || `${department} ${sheet.level} ${sheet.semester} Semester Course Outline`,
          courseCode: 'OUTLINE',
          category: 'Course Outline',
          url: sheet.url,
          fileName: sheet.fileName || `${department}_${sheet.level}_${sheet.semester}.pdf`,
          level: sheet.level,
          semester: sheet.semester === 'First' ? 'First Semester' : sheet.semester === 'Second' ? 'Second Semester' : sheet.semester,
          author: sheet.uploadedBy,
          createdAt: sheet.createdAt
        });
      }
    });

    // 2. From resources where category === 'Course Outline'
    resources.forEach(r => {
      if (r.department === department && r.category === 'Course Outline') {
        const duplicate = list.some(item => item.url === r.url || item.id === r.id);
        if (!duplicate) {
          list.push({
            id: r.id,
            title: r.title,
            courseCode: r.courseCode || 'OUTLINE',
            category: 'Course Outline',
            url: r.url,
            fileName: `${r.title}.pdf`,
            level: r.level,
            semester: r.semester,
            author: r.uploadedByRole ? `${r.uploadedByRole} (${r.uploadedByEmail || ''})` : r.uploadedByEmail,
            createdAt: r.createdAt
          });
        }
      }
    });

    return list;
  }, [courseSheets, resources, department]);

  // Outlines matching student's active sheetLevel & sheetSem
  const currentOutlines = useMemo(() => {
    return departmentOutlines.filter(item => {
      const matchLvl = normalizeCourseLevel(item.level) === normalizeCourseLevel(sheetLevel);
      const matchSem = normalizeCourseSemester(item.semester) === normalizeCourseSemester(sheetSem);
      if (!matchLvl || !matchSem) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.courseCode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [departmentOutlines, sheetLevel, sheetSem, searchQuery]);

  // 2. FILTERED MATERIALS (excluding Past Questions AND Course Outlines)
  const filteredMaterials = useMemo(() => {
    return allMaterials.filter(m => {
      if (m.category === 'Past Question' || m.category === 'Course Outline') return false;

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
            {department} course outlines, lecture notes, and past examination papers.
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
          <span>Courses ({currentOutlines.length})</span>
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

      {/* Filter Row: Level & Semester (for Materials & Past Questions) */}
      {activeTab !== 'bookmarks' && activeTab !== 'courses' && (
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
      {/* TAB 1: COURSES (Course Outline for Department & Level)   */}
      {/* ======================================================== */}
      {activeTab === 'courses' && (() => {
        const activeOutline = (selectedOutlineId && currentOutlines.find(o => o.id === selectedOutlineId)) || currentOutlines[0];
        const isSheetBookmarked = activeOutline ? isBookmarked('material', activeOutline.id) : false;

        return (
          <div className="space-y-4">
            
            {/* Level & Semester Selectors Bar */}
            <div className="p-4 rounded-2xl bg-[#0F1E36] border border-[#1F2C4C] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/30 text-[10px] font-bold uppercase mb-1">
                    <FileText className="w-3 h-3 text-[#FFC700]" />
                    <span>Course Outline</span>
                  </div>
                  <h3 className="font-display font-bold text-base sm:text-lg text-[#E6ECFA]">
                    {department} Course Outline
                  </h3>
                  <p className="text-xs text-[#9AA8C7]">
                    Course outline and curriculum guide for {department}.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#121C36] text-[#FFC700] border border-[#24315A]">
                    {sheetLevel} • {sheetSem} Semester
                  </span>
                </div>
              </div>

              {/* Selectors Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1F2C4C]">
                
                {/* Level Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#9AA8C7]">Level:</span>
                  <div className="flex items-center gap-1 bg-[#121C36] p-1 rounded-xl border border-[#24315A]">
                    {(['ND1', 'ND2', 'HND1', 'HND2'] as const).map(lvl => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => {
                          setSheetLevel(lvl);
                          setSelectedOutlineId(null);
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          sheetLevel === lvl
                            ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.4)]'
                            : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0A1224]'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Semester Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#9AA8C7]">Semester:</span>
                  <div className="flex items-center gap-1 bg-[#121C36] p-1 rounded-xl border border-[#24315A]">
                    {(['First', 'Second'] as const).map(sem => (
                      <button
                        key={sem}
                        type="button"
                        onClick={() => {
                          setSheetSem(sem);
                          setSelectedOutlineId(null);
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          sheetSem === sem
                            ? 'bg-[#FFC700] text-[#0A1224] shadow-[0_0_12px_rgba(255,199,0,0.3)]'
                            : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0A1224]'
                        }`}
                      >
                        {sem === 'First' ? '1st Semester' : '2nd Semester'}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Multiple outlines selector if > 1 */}
            {currentOutlines.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto p-2 rounded-xl bg-[#0F1E36] border border-[#1F2C4C] no-scrollbar">
                <span className="text-[11px] text-[#9AA8C7] font-semibold shrink-0">Available Outlines ({currentOutlines.length}):</span>
                {currentOutlines.map(outline => (
                  <button
                    key={outline.id}
                    onClick={() => setSelectedOutlineId(outline.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      activeOutline?.id === outline.id
                        ? 'bg-[#2F52FF] text-white shadow-[0_0_10px_rgba(47,82,255,0.4)]'
                        : 'bg-[#121C36] text-[#9AA8C7] hover:text-[#E6ECFA] border border-[#24315A]'
                    }`}
                  >
                    {outline.courseCode && outline.courseCode !== 'OUTLINE' && (
                      <span className="text-[#FFC700] mr-1">[{outline.courseCode}]</span>
                    )}
                    <span>{outline.title}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Content: Loading / PDF Viewer / Not uploaded yet */}
            {loadingSheets ? (
              <div className="p-16 text-center text-xs text-[#9AA8C7] rounded-2xl bg-[#0F1E36] border border-[#1F2C4C] animate-pulse">
                Checking course curriculum database...
              </div>
            ) : activeOutline ? (
              <div className="space-y-3">
                
                {/* Header Action Bar */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-[#0F1E36] border border-[#1F2C4C] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-500/40">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-sm sm:text-base text-[#E6ECFA] leading-tight">
                        {activeOutline.title}
                      </h4>
                      <p className="text-[11px] text-[#9AA8C7] mt-0.5">
                        {activeOutline.fileName} • {activeOutline.createdAt ? new Date(activeOutline.createdAt).toLocaleDateString() : 'Recently uploaded'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                    {/* Bookmark */}
                    <button
                      type="button"
                      onClick={() =>
                        toggleBookmark({
                          id: activeOutline.id,
                          type: 'material',
                          title: activeOutline.title,
                          category: 'Course Outline',
                          link: activeOutline.url,
                          department
                        })
                      }
                      title={isSheetBookmarked ? 'Remove Bookmark' : 'Bookmark Outline'}
                      className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                        isSheetBookmarked
                          ? 'bg-[#FFC700]/20 border-[#FFC700] text-[#FFC700]'
                          : 'bg-[#121C36] border-[#24315A] text-[#9AA8C7] hover:text-[#FFC700]'
                      }`}
                    >
                      {isSheetBookmarked ? (
                        <BookmarkCheck className="w-4 h-4 fill-[#FFC700]" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>

                    {/* Open Button */}
                    <a
                      href={activeOutline.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-[#121C36] text-[#E6ECFA] border border-[#24315A] hover:border-[#2F52FF] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#FFC700]" />
                      <span>Open</span>
                    </a>

                    {/* Download Button */}
                    <a
                      href={getPdfDownloadUrl(activeOutline.url)}
                      download={activeOutline.fileName}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-[#2F52FF] text-white hover:bg-[#2545df] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-[0_0_15px_rgba(47,82,255,0.3)]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>

                {/* Embedded In-App PDF Viewer */}
                <div className="w-full h-[650px] sm:h-[750px] rounded-2xl overflow-hidden border border-[#24315A] bg-[#0A1224] shadow-2xl relative">
                  <iframe
                    src={formatPdfUrl(activeOutline.url)}
                    title={activeOutline.title}
                    className="w-full h-full border-0"
                    allow="autoplay"
                  />
                </div>

              </div>
            ) : (
              /* Friendly Empty State */
              <div className="p-12 sm:p-16 text-center rounded-2xl bg-[#0F1E36] border border-[#1F2C4C] space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700] mx-auto opacity-75">
                  <FileText className="w-7 h-7" />
                </div>
                <h4 className="font-display font-bold text-lg text-[#E6ECFA]">
                  Not uploaded yet
                </h4>
                <p className="text-xs text-[#9AA8C7] max-w-md mx-auto leading-relaxed">
                  No course outline has been uploaded yet for <strong className="text-[#FFC700]">{department}</strong> ({sheetLevel} - {sheetSem} Semester).
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSheetSem(sheetSem === 'First' ? 'Second' : 'First');
                      setSelectedOutlineId(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#121C36] border border-[#24315A] text-xs font-semibold text-[#E6ECFA] hover:border-[#2F52FF] cursor-pointer"
                  >
                    Check {sheetSem === 'First' ? '2nd Semester' : '1st Semester'} &rarr;
                  </button>
                </div>
              </div>
            )}

          </div>
        );
      })()}

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

                    <div className="pt-2 border-t border-[#1F2C4C] flex items-center justify-end gap-2 flex-wrap">
                      <button
                        onClick={() => setViewerItem(item)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#121C36] hover:bg-[#2F52FF] text-[#E6ECFA] hover:text-white border border-[#24315A] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="View PDF inside app"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#FFC700]" />
                        <span>View</span>
                      </button>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-[#121C36] hover:bg-[#1E2E52] text-[#9AA8C7] hover:text-[#E6ECFA] border border-[#24315A] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Open external link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open</span>
                      </a>
                      <a
                        href={getPdfDownloadUrl(item.url)}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2544DD] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-[0_0_10px_rgba(47,82,255,0.3)]"
                      >
                        <Download className="w-3.5 h-3.5 text-[#FFC700]" />
                        <span>Download</span>
                      </a>
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

                    <div className="pt-2 border-t border-[#1F2C4C] flex items-center justify-end gap-2 flex-wrap">
                      <button
                        onClick={() => setViewerItem(item)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#121C36] hover:bg-[#2F52FF] text-[#E6ECFA] hover:text-white border border-[#24315A] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="View PDF inside app"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#FFC700]" />
                        <span>View</span>
                      </button>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-[#121C36] hover:bg-[#1E2E52] text-[#9AA8C7] hover:text-[#E6ECFA] border border-[#24315A] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open</span>
                      </a>
                      <a
                        href={getPdfDownloadUrl(item.url)}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2544DD] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-[0_0_10px_rgba(47,82,255,0.3)]"
                      >
                        <Download className="w-3.5 h-3.5 text-[#FFC700]" />
                        <span>Download</span>
                      </a>
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
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          onClick={() => setViewerItem({ title: item.title, url: item.link || '', courseCode: item.code, category: item.category })}
                          className="text-[11px] text-[#FFC700] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View in App</span>
                        </button>
                        <span className="text-[#62759F]">•</span>
                        <button
                          onClick={() => openLink(item.link)}
                          className="text-[11px] text-[#2F52FF] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Open</span>
                        </button>
                      </div>
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

      {/* ======================================================== */}
      {/* IN-APP PDF VIEWER MODAL                                  */}
      {/* ======================================================== */}
      {viewerItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#070D1A]/90 backdrop-blur-md">
          <div className="relative w-full max-w-5xl h-[90vh] bg-[#0A1224] border border-[#24315A] rounded-2xl flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.9)]">
            {/* Modal Header */}
            <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-[#0F1E36] border-b border-[#24315A] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-[#2F52FF]/20 text-[#2F52FF] border border-[#2F52FF]/30 shrink-0">
                  <FileText className="w-4 h-4 text-[#FFC700]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {viewerItem.courseCode && viewerItem.courseCode !== 'OUTLINE' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#2F52FF]/20 text-[#2F52FF] border border-[#2F52FF]/30">
                        {viewerItem.courseCode}
                      </span>
                    )}
                    <h3 className="font-display font-bold text-xs sm:text-sm text-[#E6ECFA] truncate">
                      {viewerItem.title}
                    </h3>
                  </div>
                  {viewerItem.category && (
                    <span className="text-[10px] text-[#9AA8C7]">
                      {viewerItem.category}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={viewerItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#121C36] text-[#E6ECFA] border border-[#24315A] hover:border-[#2F52FF] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#FFC700]" />
                  <span className="hidden sm:inline">Open</span>
                </a>

                <a
                  href={getPdfDownloadUrl(viewerItem.url)}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2542D9] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-[0_0_12px_rgba(47,82,255,0.4)]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </a>

                <button
                  type="button"
                  onClick={() => setViewerItem(null)}
                  className="p-1.5 rounded-lg text-[#9AA8C7] hover:text-white hover:bg-[#121C36] cursor-pointer ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body / Iframe */}
            <div className="flex-1 w-full bg-[#070D1A] relative">
              <iframe
                src={formatPdfUrl(viewerItem.url)}
                title={viewerItem.title}
                className="w-full h-full border-0"
                allow="autoplay"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
