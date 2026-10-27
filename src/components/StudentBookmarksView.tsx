import React, { useState, useMemo } from 'react';
import { BookmarkItem } from '../types';
import {
  Bookmark,
  BookmarkCheck,
  Search,
  Trash2,
  ExternalLink,
  BookOpen,
  FileText,
  Bell,
  Sparkles,
  ArrowRight,
  Filter
} from 'lucide-react';

interface StudentBookmarksViewProps {
  bookmarks: BookmarkItem[];
  onRemove: (item: BookmarkItem) => void;
  onNavigateCourses: () => void;
  onNavigateAnnouncements: () => void;
}

export const StudentBookmarksView: React.FC<StudentBookmarksViewProps> = ({
  bookmarks,
  onRemove,
  onNavigateCourses,
  onNavigateAnnouncements
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'course' | 'material' | 'announcement'>('all');

  const counts = useMemo(() => {
    return {
      all: bookmarks.length,
      course: bookmarks.filter(b => b.type === 'course').length,
      material: bookmarks.filter(b => b.type === 'material').length,
      announcement: bookmarks.filter(b => b.type === 'announcement').length
    };
  }, [bookmarks]);

  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter(item => {
      const matchType = activeSubTab === 'all' || item.type === activeSubTab;
      if (!matchType) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        (item.code && item.code.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.department && item.department.toLowerCase().includes(q))
      );
    });
  }, [bookmarks, activeSubTab, searchQuery]);

  return (
    <div className="space-y-6">
      
      {/* Header and Capacity Pill */}
      <div className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#0A1224] border border-[#24315A] text-xs font-semibold text-[#FFC700] mb-1">
              <Bookmark className="w-3.5 h-3.5 text-[#FFC700]" />
              <span>Personal Saved Items</span>
            </div>
            <h2 className="font-display font-bold text-xl sm:text-2xl text-[#E6ECFA]">
              My Bookmarks
            </h2>
            <p className="text-xs text-[#9AA8C7] mt-0.5">
              Saved courses, lecture materials, and announcements follow your student profile across any device.
            </p>
          </div>

          {/* 100 Item Capacity Meter */}
          <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] min-w-[220px] space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#9AA8C7] font-medium">Storage Capacity</span>
              <span className=" font-bold text-[#FFC700]">
                {bookmarks.length} / 100 items
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#121C36] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  bookmarks.length >= 90
                    ? 'bg-rose-500'
                    : bookmarks.length >= 70
                    ? 'bg-[#FFC700]'
                    : 'bg-[#2F52FF]'
                }`}
                style={{ width: `${Math.min(100, (bookmarks.length / 100) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-[#9AA8C7]/70 block text-right ">
              {100 - bookmarks.length} slots remaining
            </span>
          </div>
        </div>

        {/* Sub-tabs and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#24315A]">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'All Items', count: counts.all },
              { id: 'course', label: 'Courses', count: counts.course },
              { id: 'material', label: 'Materials', count: counts.material },
              { id: 'announcement', label: 'Announcements', count: counts.announcement }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === tab.id
                    ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                    : 'bg-[#0A1224] text-[#9AA8C7] hover:text-[#E6ECFA] border border-[#24315A]'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeSubTab === tab.id ? 'bg-white/20 text-white' : 'bg-[#121C36] text-[#FFC700]'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Filter bookmarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
            />
            <Search className="w-4 h-4 text-[#9AA8C7] absolute left-3 top-2.5" />
          </div>
        </div>
      </div>

      {/* Bookmarks List or Empty State */}
      {filteredBookmarks.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#0A1224] border border-[#FFC700]/40 text-[#FFC700] flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(255,199,0,0.15)]">
            <Bookmark className="w-8 h-8 opacity-75" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="font-display font-bold text-lg text-[#E6ECFA]">
              {searchQuery ? 'No Matching Bookmarks Found' : 'No Bookmarks Saved Yet'}
            </h3>
            <p className="text-xs text-[#9AA8C7] leading-relaxed">
              {searchQuery
                ? `No saved items match "${searchQuery}". Try a different keyword or reset filters.`
                : 'Tap the bookmark icon on any course, past question, lecture note, or announcement to quickly save it here for instant access.'}
            </p>
          </div>
          {!searchQuery && (
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={onNavigateCourses}
                className="px-4 py-2 rounded-xl bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] transition-all cursor-pointer flex items-center gap-2"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Browse Courses</span>
              </button>
              <button
                onClick={onNavigateAnnouncements}
                className="px-4 py-2 rounded-xl bg-[#0A1224] border border-[#24315A] text-[#FFC700] text-xs font-bold hover:border-[#FFC700] transition-all cursor-pointer flex items-center gap-2"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>View Bulletins</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBookmarks.map((item) => {
            return (
              <div
                key={`${item.type}-${item.id}`}
                className="p-4 sm:p-5 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF]/60 transition-all flex flex-col justify-between gap-4 group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        item.type === 'course'
                          ? 'bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/40'
                          : item.type === 'material'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                      }`}>
                        {item.type}
                      </span>

                      {item.code && (
                        <span className=" text-[10px] font-bold px-2 py-0.5 rounded bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
                          {item.code}
                        </span>
                      )}

                      {item.category && (
                        <span className="text-[10px] text-[#9AA8C7] px-2 py-0.5 rounded bg-[#0A1224] border border-[#24315A]">
                          {item.category}
                        </span>
                      )}
                    </div>

                    {/* Remove Bookmark Button */}
                    <button
                      onClick={() => onRemove(item)}
                      title="Remove bookmark"
                      className="p-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#9AA8C7] hover:text-rose-400 hover:border-rose-500/40 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h3 className="font-semibold text-sm text-[#E6ECFA] group-hover:text-white transition-colors leading-snug">
                    {item.title}
                  </h3>

                  {item.department && (
                    <div className="text-[11px] text-[#9AA8C7]">
                      Department: <strong className="text-[#E6ECFA]">{item.department}</strong>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#24315A]/70 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-[#9AA8C7] ">
                    Saved: {new Date(item.createdAt).toLocaleDateString()}
                  </span>

                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F52FF] text-white font-bold text-xs hover:bg-[#2545df] transition-all cursor-pointer shadow-[0_0_10px_rgba(47,82,255,0.25)]"
                    >
                      <span>Open Link</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : item.type === 'course' ? (
                    <button
                      onClick={onNavigateCourses}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#FFC700] font-bold text-xs hover:border-[#FFC700] transition-all cursor-pointer"
                    >
                      <span>Go to Courses</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  ) : (
                    <button
                      onClick={onNavigateAnnouncements}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#FFC700] font-bold text-xs hover:border-[#FFC700] transition-all cursor-pointer"
                    >
                      <span>View Bulletin</span>
                      <ArrowRight className="w-3 h-3" />
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
