import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ResourceItem, BookmarkItem } from '../types';
import {
  normalizeCourseLevel,
  normalizeCourseSemester,
  formatPdfUrl,
  getPdfDownloadUrl
} from '../data/coursesAndTimetables';
import {
  FileText,
  Search,
  Download,
  Eye,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  ArrowLeft,
  X,
  FileQuestion,
  Calendar,
  Layers
} from 'lucide-react';

interface StudentPastQuestionsViewProps {
  department: string;
  userLevel?: string;
  isInner?: boolean;
  onBack?: () => void;
  isBookmarked: (type: any, id: string) => boolean;
  toggleBookmark: (item: any) => void;
}

const ACADEMIC_LEVELS: Array<'ND1' | 'ND2' | 'HND1' | 'HND2'> = ['ND1', 'ND2', 'HND1', 'HND2'];
const SEMESTERS: Array<'First Semester' | 'Second Semester'> = ['First Semester', 'Second Semester'];

export const StudentPastQuestionsView: React.FC<StudentPastQuestionsViewProps> = ({
  department,
  userLevel,
  isInner = false,
  onBack,
  isBookmarked,
  toggleBookmark
}) => {
  const defaultLevel = userLevel ? normalizeCourseLevel(userLevel) : 'ND1';
  const [selectedLevel, setSelectedLevel] = useState<'ND1' | 'ND2' | 'HND1' | 'HND2'>(defaultLevel);
  const [selectedSemester, setSelectedSemester] = useState<'First Semester' | 'Second Semester'>('First Semester');
  const [searchQuery, setSearchQuery] = useState('');

  // Firestore resources of type 'Past Question'
  const [pastQuestions, setPastQuestions] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // In-App PDF viewer modal state
  const [viewerItem, setViewerItem] = useState<{
    title: string;
    url: string;
    courseCode?: string;
    session?: string;
  } | null>(null);

  // Sync userLevel when changed
  useEffect(() => {
    if (userLevel) {
      setSelectedLevel(normalizeCourseLevel(userLevel));
    }
  }, [userLevel]);

  // Firestore real-time listener for department past questions
  useEffect(() => {
    if (!department) return;
    setLoading(true);

    const q = query(
      collection(db, 'resources'),
      where('department', '==', department)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: ResourceItem[] = [];
        snap.forEach((d) => {
          const data = d.data() as ResourceItem;
          // Filter strictly for Past Questions (standalone, no courseId required)
          if (data.type === 'Past Question' || data.category === 'Past Question') {
            list.push({ ...data, id: d.id });
          }
        });
        // Sort newest first
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setPastQuestions(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Past questions listener notice:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [department]);

  // Filtered by selected Level, Semester, and search query
  const filteredList = useMemo(() => {
    return pastQuestions.filter((item) => {
      const matchLevel = normalizeCourseLevel(item.level) === selectedLevel;
      const matchSem = normalizeCourseSemester(item.semester) === selectedSemester;
      if (!matchLevel || !matchSem) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchCode = item.courseCode?.toLowerCase().includes(q);
      const matchSession = item.session?.toLowerCase().includes(q) || item.year?.toLowerCase().includes(q);
      return matchTitle || matchCode || matchSession;
    });
  }, [pastQuestions, selectedLevel, selectedSemester, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Top Bar (Inner View has blue back arrow, Root view has clean title) */}
      {isInner && (
        <div className="flex items-center justify-between pb-2 border-b border-[#24315A]">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-[#2F52FF] hover:text-[#5271FF] font-semibold text-sm transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-5 h-5 text-[#2F52FF] group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-[#E6ECFA] font-bold text-base font-heading">
              Past Questions
            </span>
          </button>
          <span className="text-xs text-[#FFC700] font-semibold px-2.5 py-0.5 rounded-full bg-[#121C36] border border-[#24315A]">
            {filteredList.length} available
          </span>
        </div>
      )}

      {/* Filter Toolbar: 1st Sem / 2nd Sem Switch & Level Dropdown */}
      <div className="p-3.5 rounded-xl bg-[#121C36] border border-[#24315A] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* 1st Sem | 2nd Sem Switch */}
          <div className="flex items-center p-1 rounded-lg bg-[#0A1224] border border-[#24315A] w-full sm:w-auto">
            {SEMESTERS.map((sem) => {
              const label = sem === 'First Semester' ? '1st Sem' : '2nd Sem';
              const active = selectedSemester === sem;
              return (
                <button
                  key={sem}
                  type="button"
                  onClick={() => setSelectedSemester(sem)}
                  className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.4)]'
                      : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Level Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#9AA8C7] font-semibold shrink-0">Level:</span>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs font-bold text-[#FFC700] focus:outline-none focus:border-[#2F52FF] cursor-pointer"
            >
              {ACADEMIC_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search past questions by course or title..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/60 focus:outline-none focus:border-[#2F52FF]"
          />
          <Search className="w-4 h-4 text-[#9AA8C7] absolute left-3 top-2.5" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-[#9AA8C7] hover:text-[#E6ECFA]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Past Questions List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-[#9AA8C7]">
          Loading past questions...
        </div>
      ) : filteredList.length === 0 ? (
        <div className="p-10 rounded-2xl bg-[#121C36] border border-[#24315A] text-center space-y-2">
          <FileQuestion className="w-10 h-10 text-[#9AA8C7]/50 mx-auto" />
          <h4 className="text-sm font-bold text-[#E6ECFA]">No past questions yet</h4>
          <p className="text-xs text-[#9AA8C7] max-w-sm mx-auto">
            No past questions uploaded for {selectedLevel} ({selectedSemester === 'First Semester' ? '1st Sem' : '2nd Sem'}). Check back soon or contact your Course Rep.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {filteredList.map((item) => {
            const bookmarked = isBookmarked('material', item.id);
            const previewUrl = formatPdfUrl(item.url);
            const downloadUrl = getPdfDownloadUrl(item.url);

            return (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF]/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-sm"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.courseCode && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/30">
                        {item.courseCode}
                      </span>
                    )}
                    {(item.session || item.year) && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFC700]/15 text-[#FFC700] border border-[#FFC700]/30 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{item.session || item.year} Session</span>
                      </span>
                    )}
                    <span className="px-1.5 py-0.2 rounded text-[10px] text-[#9AA8C7] bg-[#0A1224] border border-[#24315A]">
                      {item.level} • {normalizeCourseSemester(item.semester) === 'First Semester' ? '1st Sem' : '2nd Sem'}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-[#E6ECFA] group-hover:text-white transition-colors truncate">
                    {item.title}
                  </h4>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Bookmark Button */}
                  <button
                    type="button"
                    onClick={() =>
                      toggleBookmark({
                        id: item.id,
                        type: 'material',
                        title: item.title,
                        category: 'Past Question',
                        url: item.url,
                        courseCode: item.courseCode
                      })
                    }
                    className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                      bookmarked
                        ? 'bg-[#FFC700]/20 text-[#FFC700] border-[#FFC700]/40'
                        : 'bg-[#0A1224] text-[#9AA8C7] border-[#24315A] hover:text-[#FFC700]'
                    }`}
                    title={bookmarked ? 'Remove bookmark' : 'Bookmark past question'}
                  >
                    {bookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                  </button>

                  {/* Open Preview Button */}
                  <button
                    type="button"
                    onClick={() =>
                      setViewerItem({
                        title: item.title,
                        url: previewUrl,
                        courseCode: item.courseCode,
                        session: item.session || item.year
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2542D9] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Open</span>
                  </button>

                  {/* Download Button */}
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-[#0A1224] hover:bg-[#1A2E63] text-[#E6ECFA] border border-[#24315A] hover:border-[#2F52FF] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
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

      {/* In-App PDF Viewer Modal with Open and Download */}
      {viewerItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#070D1A]/90 backdrop-blur-md">
          <div className="relative w-full max-w-4xl h-[90vh] bg-[#0A1224] border border-[#24315A] rounded-2xl flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            {/* Modal Header */}
            <div className="p-3.5 bg-[#121C36] border-b border-[#24315A] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {viewerItem.courseCode && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-[#2F52FF] text-white">
                      {viewerItem.courseCode}
                    </span>
                  )}
                  {viewerItem.session && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFC700]/20 text-[#FFC700]">
                      {viewerItem.session} Session
                    </span>
                  )}
                </div>
                <h3 className="font-heading font-bold text-sm text-[#E6ECFA] truncate mt-0.5">
                  {viewerItem.title}
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={viewerItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#121C36] hover:bg-[#1A2E63] text-[#E6ECFA] border border-[#24315A] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#FFC700]" />
                  <span className="hidden sm:inline">External</span>
                </a>
                <a
                  href={getPdfDownloadUrl(viewerItem.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2542D9] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setViewerItem(null)}
                  className="p-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#9AA8C7] hover:text-white hover:border-rose-500 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Embedded PDF iframe */}
            <div className="flex-1 bg-[#070D1A] relative">
              <iframe
                src={viewerItem.url}
                title={viewerItem.title}
                className="w-full h-full border-none"
                allow="autoplay"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
