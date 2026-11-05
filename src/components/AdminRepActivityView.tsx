import React, { useState, useMemo } from 'react';
import { UserProfile, ResourceItem, AnnouncementItem, SotDepartmentName, ResourceCategory } from '../types';
import { SOT_DEPARTMENTS_CONFIG } from '../config/site';
import {
  Users,
  Megaphone,
  FolderOpen,
  Calendar,
  Clock,
  Search,
  Filter,
  UserCheck,
  UserX,
  UserPlus,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Tag,
  ArrowRight,
  ShieldCheck,
  Building2,
  Mail,
  RefreshCw
} from 'lucide-react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db, safeUpdateDoc as updateDoc, cleanFirestoreData } from '../lib/firebase';

interface AdminRepActivityViewProps {
  students: UserProfile[];
  resources: ResourceItem[];
  announcements: AnnouncementItem[];
  onRefresh: () => Promise<void>;
  onStudentUpdated?: (updated: UserProfile) => void;
}

export interface CombinedFeedItem {
  id: string;
  type: 'material' | 'announcement';
  title: string;
  department: string;
  repEmail: string;
  repName: string;
  repUid: string;
  createdAt: string;
  // Specific fields
  courseCode?: string;
  category?: string;
  url?: string;
  description?: string;
  content?: string;
  urgent?: boolean;
}

export const AdminRepActivityView: React.FC<AdminRepActivityViewProps> = ({
  students,
  resources,
  announcements,
  onRefresh,
  onStudentUpdated
}) => {
  // -------------------------------------------------------------
  // 1. REPS LIST COMPUTATION
  // -------------------------------------------------------------
  const reps = useMemo(() => {
    return students.filter(s => {
      const roleStr = typeof s.role === 'string' ? s.role.replace(/\s+/g, '').toLowerCase() : '';
      return roleStr === 'rep';
    });
  }, [students]);

  // Map each rep's uploads, announcements and last active date
  const repStats = useMemo(() => {
    return reps.map(rep => {
      const repEmail = (rep.email || '').toLowerCase().trim();
      const repUid = rep.uid;

      // Filter resources
      const repUploads = resources.filter(r => {
        const upUid = r.uploadedBy;
        const upEmail = (r.uploadedByEmail || '').toLowerCase().trim();
        return (repUid && upUid === repUid) || (repEmail && upEmail === repEmail);
      });

      // Filter announcements
      const repAnnouncements = announcements.filter(a => {
        const upUid = (a as any).uploadedBy;
        const upEmail = ((a as any).uploadedByEmail || '').toLowerCase().trim();
        const authorLower = (a.author || '').toLowerCase();
        const isAuthorRep = authorLower.includes('rep') || (rep.fullName && authorLower.includes(rep.fullName.toLowerCase()));
        return (repUid && upUid === repUid) || (repEmail && upEmail === repEmail) || (isAuthorRep && a.department === rep.department);
      });

      // Find last activity date
      const allTimestamps: number[] = [
        ...repUploads.map(r => new Date(r.createdAt || 0).getTime()),
        ...repAnnouncements.map(a => new Date(a.createdAt || 0).getTime())
      ].filter(t => !isNaN(t) && t > 0);

      const lastActivityTimestamp = allTimestamps.length > 0 ? Math.max(...allTimestamps) : null;
      const lastActivityDate = lastActivityTimestamp ? new Date(lastActivityTimestamp).toISOString() : null;

      return {
        rep,
        uploadsCount: repUploads.length,
        announcementsCount: repAnnouncements.length,
        totalActions: repUploads.length + repAnnouncements.length,
        lastActivityDate
      };
    });
  }, [reps, resources, announcements]);

  // -------------------------------------------------------------
  // 2. COMBINED ACTIVITY FEED
  // -------------------------------------------------------------
  const allFeedItems = useMemo<CombinedFeedItem[]>(() => {
    const items: CombinedFeedItem[] = [];

    // Add materials
    resources.forEach(r => {
      // Find matching rep if any
      const matchingRep = reps.find(
        rep => rep.uid === r.uploadedBy || (rep.email && r.uploadedByEmail && rep.email.toLowerCase() === r.uploadedByEmail.toLowerCase())
      );

      items.push({
        id: r.id,
        type: 'material',
        title: r.title,
        department: r.department,
        repEmail: r.uploadedByEmail || matchingRep?.email || 'rep@sot.edu',
        repName: matchingRep?.fullName || (r.uploadedByRole ? `${r.uploadedByRole}` : 'Course Rep'),
        repUid: r.uploadedBy || matchingRep?.uid || '',
        createdAt: r.createdAt,
        courseCode: r.courseCode,
        category: r.category,
        url: r.url,
        description: r.description
      });
    });

    // Add announcements
    announcements.forEach(a => {
      const authorLower = (a.author || '').toLowerCase();
      const isRepPost = authorLower.includes('rep') || Boolean((a as any).uploadedByEmail) || reps.some(r => r.uid === (a as any).uploadedBy);

      // Only include rep posts in rep activity
      if (isRepPost) {
        const matchingRep = reps.find(
          rep => rep.uid === (a as any).uploadedBy || (rep.email && (a as any).uploadedByEmail && rep.email.toLowerCase() === (a as any).uploadedByEmail.toLowerCase())
        );

        items.push({
          id: a.id,
          type: 'announcement',
          title: a.title,
          department: a.department,
          repEmail: (a as any).uploadedByEmail || matchingRep?.email || (a.author || 'Course Rep'),
          repName: matchingRep?.fullName || a.author || 'Course Rep',
          repUid: (a as any).uploadedBy || matchingRep?.uid || '',
          createdAt: a.createdAt,
          category: a.category,
          content: a.content,
          urgent: a.urgent
        });
      }
    });

    // Sort newest first
    items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return items;
  }, [resources, announcements, reps]);

  // -------------------------------------------------------------
  // FILTERS
  // -------------------------------------------------------------
  const [filterRep, setFilterRep] = useState<string>('All');
  const [filterDept, setFilterDept] = useState<string>('All');
  const [filterType, setFilterType] = useState<'All' | 'material' | 'announcement'>('All');
  const [filterDate, setFilterDate] = useState<'All' | 'today' | 'week' | 'month'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFeed = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const oneWeekMs = 7 * oneDayMs;
    const oneMonthMs = 30 * oneDayMs;

    return allFeedItems.filter(item => {
      // Rep filter
      if (filterRep !== 'All') {
        const matchUid = item.repUid === filterRep;
        const matchEmail = item.repEmail.toLowerCase() === filterRep.toLowerCase();
        if (!matchUid && !matchEmail) return false;
      }

      // Department filter
      if (filterDept !== 'All' && item.department !== filterDept) {
        return false;
      }

      // Type filter
      if (filterType !== 'All' && item.type !== filterType) {
        return false;
      }

      // Date filter
      if (filterDate !== 'All') {
        const itemTime = new Date(item.createdAt || 0).getTime();
        const diff = now - itemTime;
        if (filterDate === 'today' && diff > oneDayMs) return false;
        if (filterDate === 'week' && diff > oneWeekMs) return false;
        if (filterDate === 'month' && diff > oneMonthMs) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchEmail = item.repEmail.toLowerCase().includes(q);
        const matchName = item.repName.toLowerCase().includes(q);
        const matchDept = item.department.toLowerCase().includes(q);
        const matchCode = item.courseCode ? item.courseCode.toLowerCase().includes(q) : false;
        return matchTitle || matchEmail || matchName || matchDept || matchCode;
      }

      return true;
    });
  }, [allFeedItems, filterRep, filterDept, filterType, filterDate, searchQuery]);

  // -------------------------------------------------------------
  // APPOINT REP MODAL
  // -------------------------------------------------------------
  const [showAppointModal, setShowAppointModal] = useState(false);
  const [selectedStudentUid, setSelectedStudentUid] = useState<string>('');
  const [appointSuccess, setAppointSuccess] = useState<string | null>(null);
  const [appointError, setAppointError] = useState<string | null>(null);
  const [appointSaving, setAppointSaving] = useState(false);

  // Eligible non-admin students
  const nonRepStudents = useMemo(() => {
    return students.filter(s => {
      const roleStr = typeof s.role === 'string' ? s.role.replace(/\s+/g, '').toLowerCase() : '';
      return roleStr !== 'admin' && roleStr !== 'rep';
    });
  }, [students]);

  const handleMakeRep = async (targetStudent: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', targetStudent.uid), {
        role: 'rep',
        updatedAt: new Date().toISOString()
      });
      if (onStudentUpdated) {
        onStudentUpdated({ ...targetStudent, role: 'rep' });
      }
      await onRefresh();
    } catch (e: any) {
      alert(`Could not appoint course rep: ${e.message || e}`);
    }
  };

  const handleRemoveRep = async (repStudent: UserProfile) => {
    if (!confirm(`Remove Course Representative role from ${repStudent.fullName || repStudent.email}? They will return to standard student access.`)) {
      return;
    }
    try {
      await updateDoc(doc(db, 'users', repStudent.uid), {
        role: 'student',
        updatedAt: new Date().toISOString()
      });
      if (onStudentUpdated) {
        onStudentUpdated({ ...repStudent, role: 'student' });
      }
      await onRefresh();
    } catch (e: any) {
      alert(`Could not remove rep role: ${e.message || e}`);
    }
  };

  const handleConfirmAppoint = async (e: React.FormEvent) => {
    e.preventDefault();
    setAppointError(null);
    setAppointSuccess(null);

    if (!selectedStudentUid) {
      setAppointError('Please select a student to appoint as Course Representative.');
      return;
    }

    const target = students.find(s => s.uid === selectedStudentUid);
    if (!target) {
      setAppointError('Student not found.');
      return;
    }

    setAppointSaving(true);
    try {
      await updateDoc(doc(db, 'users', target.uid), {
        role: 'rep',
        updatedAt: new Date().toISOString()
      });
      setAppointSuccess(`Appointed ${target.fullName || target.email} as Course Rep for ${target.department || 'their department'}!`);
      if (onStudentUpdated) {
        onStudentUpdated({ ...target, role: 'rep' });
      }
      await onRefresh();
      setTimeout(() => {
        setShowAppointModal(false);
        setAppointSuccess(null);
        setSelectedStudentUid('');
      }, 1200);
    } catch (e: any) {
      setAppointError(e.message || 'Failed to appoint rep.');
    } finally {
      setAppointSaving(false);
    }
  };

  // -------------------------------------------------------------
  // ITEM DETAIL / EDIT / DELETE MODAL
  // -------------------------------------------------------------
  const [selectedItem, setSelectedItem] = useState<CombinedFeedItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editCourseCode, setEditCourseCode] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editUrgent, setEditUrgent] = useState(false);
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleOpenItem = (item: CombinedFeedItem) => {
    setSelectedItem(item);
    setIsEditing(false);
    setActionError(null);
    setEditTitle(item.title);
    setEditUrl(item.url || '');
    setEditCategory(item.category || '');
    setEditCourseCode(item.courseCode || '');
    setEditDescription(item.description || '');
    setEditContent(item.content || '');
    setEditUrgent(Boolean(item.urgent));
  };

  const handleSaveEdit = async () => {
    if (!selectedItem) return;
    setActionSaving(true);
    setActionError(null);

    const now = new Date().toISOString();
    try {
      if (selectedItem.type === 'material') {
        const docRef = doc(db, 'resources', selectedItem.id);
        await updateDoc(docRef, {
          title: editTitle.trim(),
          url: editUrl.trim(),
          category: editCategory as ResourceCategory,
          courseCode: editCourseCode.trim().toUpperCase(),
          description: editDescription.trim(),
          updatedAt: now
        });
      } else {
        const docRef = doc(db, 'announcements', selectedItem.id);
        await updateDoc(docRef, {
          title: editTitle.trim(),
          content: editContent.trim(),
          category: editCategory,
          urgent: editUrgent,
          updatedAt: now
        });
      }

      await onRefresh();
      setIsEditing(false);
      setSelectedItem(prev =>
        prev
          ? {
              ...prev,
              title: editTitle.trim(),
              url: editUrl.trim(),
              category: editCategory,
              courseCode: editCourseCode.trim().toUpperCase(),
              description: editDescription.trim(),
              content: editContent.trim(),
              urgent: editUrgent
            }
          : null
      );
    } catch (e: any) {
      setActionError(e.message || 'Failed to update item.');
    } finally {
      setActionSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    if (!confirm(`Permanently delete this ${selectedItem.type} "${selectedItem.title}"?`)) {
      return;
    }

    setActionSaving(true);
    setActionError(null);
    try {
      const collectionName = selectedItem.type === 'material' ? 'resources' : 'announcements';
      await deleteDoc(doc(db, collectionName, selectedItem.id));
      await onRefresh();
      setSelectedItem(null);
    } catch (e: any) {
      setActionError(e.message || 'Failed to delete item.');
    } finally {
      setActionSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* ========================================================= */}
      {/* SECTION 1: COMPACT LIST OF ALL REPS                       */}
      {/* ========================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0F1E36] border border-[#1E2E52] space-y-4 shadow-xl">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#070D1A] border border-[#FFC700]/40 flex items-center justify-center text-[#FFC700] shadow-[0_0_15px_rgba(255,199,0,0.15)]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-base text-[#E6ECFA]">
                  Course Representatives
                </h3>
                <span className="text-xs  font-bold px-2 py-0.5 rounded-full bg-[#121C36] text-[#FFC700] border border-[#FFC700]/30">
                  {reps.length} {reps.length === 1 ? 'Rep' : 'Reps'}
                </span>
              </div>
              <p className="text-xs text-[#9AA8C7]">
                Student representatives authorized to upload department learning materials and post bulletins.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setShowAppointModal(true);
              setAppointSuccess(null);
              setAppointError(null);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(255,199,0,0.25)] transition-all shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Appoint / Make Rep</span>
          </button>
        </div>

        {/* Reps Cards / Compact Table */}
        {repStats.length === 0 ? (
          <div className="py-8 text-center bg-[#070D1A]/60 rounded-xl border border-[#1E2E52] p-6 space-y-2">
            <Users className="w-8 h-8 text-[#9AA8C7] mx-auto opacity-60" />
            <h4 className="font-semibold text-sm text-[#E6ECFA]">No Course Representatives Appointed Yet</h4>
            <p className="text-xs text-[#9AA8C7] max-w-md mx-auto">
              You can promote any registered student to a Course Representative using the button above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {repStats.map(({ rep, uploadsCount, announcementsCount, lastActivityDate }) => (
              <div
                key={rep.uid}
                className="p-3.5 rounded-xl bg-[#070D1A] border border-[#1E2E52] hover:border-[#2F52FF]/60 transition-all flex flex-col justify-between space-y-3 group"
              >
                <div>
                  {/* Top Bar: Department & Badge */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#121C36] text-[#FFC700] border border-[#FFC700]/30 truncate">
                      {rep.department || 'General SOT'}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-[#2F52FF] text-white">
                      Rep
                    </span>
                  </div>

                  {/* Name & Email */}
                  <h4 className="font-display font-bold text-sm text-[#E6ECFA] truncate group-hover:text-[#FFC700] transition-colors" title={rep.fullName || 'Student Rep'}>
                    {rep.fullName || 'Unnamed Student Rep'}
                  </h4>
                  <div className="text-[11px] text-[#9AA8C7]  truncate mt-0.5 flex items-center gap-1">
                    <Mail className="w-3 h-3 shrink-0" />
                    <span className="truncate">{rep.email}</span>
                  </div>
                  {rep.matricNumber && (
                    <div className="text-[10px]  text-[#FFC700] mt-0.5">
                      Matric: {rep.matricNumber}
                    </div>
                  )}
                </div>

                {/* Metrics: Uploads, Announcements, Last Activity */}
                <div className="pt-2 border-t border-[#1E2E52] space-y-1.5">
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-1.5 rounded-lg bg-[#0F1E36] border border-[#1E2E52]">
                      <div className="text-[10px] text-[#9AA8C7]">Uploads</div>
                      <div className=" font-bold text-xs text-[#E6ECFA]">{uploadsCount}</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-[#0F1E36] border border-[#1E2E52]">
                      <div className="text-[10px] text-[#9AA8C7]">Bulletins</div>
                      <div className=" font-bold text-xs text-[#E6ECFA]">{announcementsCount}</div>
                    </div>
                  </div>

                  <div className="text-[10px] text-[#9AA8C7] flex items-center justify-between px-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#FFC700]" />
                      <span>Last Activity:</span>
                    </span>
                    <span className=" text-[#E6ECFA]">
                      {lastActivityDate
                        ? new Date(lastActivityDate).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        : 'No uploads yet'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons: Make Rep / Remove Rep */}
                <div className="pt-1 flex items-center justify-between gap-2 border-t border-[#1E2E52]/60">
                  <button
                    onClick={() => {
                      setFilterRep(rep.uid);
                      const feedEl = document.getElementById('rep-activity-feed-section');
                      if (feedEl) feedEl.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="text-[11px] text-[#60A5FA] hover:text-[#93C5FD] font-semibold cursor-pointer"
                  >
                    View Posts →
                  </button>

                  <button
                    onClick={() => handleRemoveRep(rep)}
                    className="px-2.5 py-1 rounded-lg bg-rose-950/50 hover:bg-rose-900/70 border border-rose-500/40 text-rose-300 text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                    title="Revoke course representative role"
                  >
                    <UserX className="w-3 h-3" />
                    <span>Remove Rep</span>
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>

      {/* ========================================================= */}
      {/* SECTION 2: COMBINED ACTIVITY FEED (NEWEST FIRST)          */}
      {/* ========================================================= */}
      <div id="rep-activity-feed-section" className="space-y-4">
        
        {/* Controls & Filters Bar */}
        <div className="p-4 rounded-2xl bg-[#0F1E36] border border-[#1E2E52] space-y-3.5 shadow-xl">
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-base text-[#E6ECFA]">
                  Combined Rep Activity Feed
                </h3>
                <span className="text-xs  font-bold px-2 py-0.5 rounded-full bg-[#070D1A] text-[#FFC700] border border-[#1E2E52]">
                  {filteredFeed.length} {filteredFeed.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <p className="text-xs text-[#9AA8C7]">
                Live timeline of all course materials and announcements published by Course Representatives.
              </p>
            </div>

            {/* Quick search input */}
            <div className="relative w-full lg:w-72">
              <input
                type="text"
                placeholder="Search title, rep email, course code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/60 focus:outline-none focus:border-[#2F52FF]"
              />
              <Search className="w-3.5 h-3.5 text-[#9AA8C7] absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Filters Sub-row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-[#1E2E52]">
            
            {/* 1. Filter by Rep */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#9AA8C7] uppercase tracking-wider block">Rep</label>
              <select
                value={filterRep}
                onChange={(e) => setFilterRep(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
              >
                <option value="All">All Course Reps</option>
                {reps.map(r => (
                  <option key={r.uid} value={r.uid}>
                    {r.fullName || r.email} ({r.department?.split(' ')[0] || 'Rep'})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Filter by Department */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#9AA8C7] uppercase tracking-wider block">Department</label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
              >
                <option value="All">All 6 Departments</option>
                {SOT_DEPARTMENTS_CONFIG.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* 3. Filter by Type */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#9AA8C7] uppercase tracking-wider block">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
              >
                <option value="All">All Types</option>
                <option value="material">Materials Only</option>
                <option value="announcement">Announcements Only</option>
              </select>
            </div>

            {/* 4. Filter by Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#9AA8C7] uppercase tracking-wider block">Date</label>
              <select
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
              >
                <option value="All">All Time</option>
                <option value="today">Today</option>
                <option value="week">Past 7 Days</option>
                <option value="month">Past 30 Days</option>
              </select>
            </div>

          </div>

        </div>

        {/* FEED ITEMS LIST */}
        <div className="space-y-3">
          {filteredFeed.length === 0 ? (
            <div className="py-12 text-center bg-[#0F1E36] rounded-2xl border border-[#1E2E52] p-8 space-y-2">
              <FolderOpen className="w-10 h-10 text-[#FFC700] mx-auto opacity-70" />
              <h4 className="font-semibold text-base text-[#E6ECFA]">No Activity Found</h4>
              <p className="text-xs text-[#9AA8C7] max-w-md mx-auto">
                No course materials or announcements match your current filter selection.
              </p>
            </div>
          ) : (
            filteredFeed.map(item => (
              <div
                key={`${item.type}_${item.id}`}
                onClick={() => handleOpenItem(item)}
                className="p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52] hover:border-[#2F52FF] transition-all cursor-pointer space-y-2.5 group hover:shadow-[0_0_20px_rgba(47,82,255,0.2)]"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {item.type === 'material' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#2F52FF] text-white">
                        <FolderOpen className="w-3 h-3" />
                        <span>MATERIAL</span>
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                        item.urgent
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'bg-[#FFC700] text-[#0A1224]'
                      }`}>
                        <Megaphone className="w-3 h-3" />
                        <span>ANNOUNCEMENT {item.urgent && '• URGENT'}</span>
                      </span>
                    )}

                    <span className="text-[10px]  px-2 py-0.5 rounded bg-[#070D1A] text-[#FFC700] border border-[#1E2E52]">
                      {item.department}
                    </span>

                    {item.courseCode && (
                      <span className="text-[10px]  font-bold px-2 py-0.5 rounded bg-[#070D1A] text-[#E6ECFA] border border-[#1E2E52]">
                        {item.courseCode}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[10px]  text-[#9AA8C7]">
                    <Clock className="w-3 h-3 text-[#FFC700]" />
                    <span>
                      {new Date(item.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>

                {/* Title & Content Preview */}
                <div>
                  <h4 className="font-display font-bold text-sm text-[#E6ECFA] group-hover:text-[#FFC700] transition-colors">
                    {item.title}
                  </h4>
                  {item.type === 'material' && item.description && (
                    <p className="text-xs text-[#9AA8C7] line-clamp-1 mt-0.5">
                      {item.description}
                    </p>
                  )}
                  {item.type === 'announcement' && item.content && (
                    <p className="text-xs text-[#9AA8C7] line-clamp-2 mt-0.5 whitespace-pre-wrap">
                      {item.content}
                    </p>
                  )}
                </div>

                {/* Footer: Rep details + Tap to inspect hint */}
                <div className="pt-2 border-t border-[#1E2E52]/60 flex items-center justify-between text-xs text-[#9AA8C7]">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#9AA8C7]">Posted by:</span>
                    <strong className="text-[#E6ECFA] text-xs">{item.repName}</strong>
                    <span className="text-[11px]  text-[#60A5FA]">({item.repEmail})</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-[#FFC700] font-semibold group-hover:translate-x-1 transition-transform">
                    <span>Inspect & Manage</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>

              </div>
            ))
          )}
        </div>

      </div>

      {/* ========================================================= */}
      {/* MODAL 1: APPOINT / MAKE COURSE REP                        */}
      {/* ========================================================= */}
      {showAppointModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#0A1224] border border-[#24315A] p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-[#24315A] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#121C36] border border-[#FFC700]/50 flex items-center justify-center text-[#FFC700]">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-[#E6ECFA]">Appoint Course Representative</h3>
                  <p className="text-xs text-[#9AA8C7]">Grant course rep capabilities to a verified student.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAppointModal(false)}
                className="p-1 rounded-lg text-[#9AA8C7] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {appointSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{appointSuccess}</span>
              </div>
            )}

            {appointError && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{appointError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmAppoint} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#E6ECFA]">Select Student</label>
                <select
                  value={selectedStudentUid}
                  onChange={(e) => setSelectedStudentUid(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  required
                >
                  <option value="">-- Choose a student --</option>
                  {nonRepStudents.map(s => (
                    <option key={s.uid} value={s.uid}>
                      {s.fullName || s.email} | {s.department || 'No dept'} | {s.matricNumber || 'No matric'}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#9AA8C7]">
                  Showing students with role "student". The chosen student will receive Course Rep upload and announcement publishing permissions for their department.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#24315A]">
                <button
                  type="button"
                  onClick={() => setShowAppointModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#9AA8C7] hover:text-[#E6ECFA]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={appointSaving}
                  className="px-5 py-2.5 rounded-xl bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {appointSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                  <span>Appoint as Rep</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: INSPECT / EDIT / DELETE FEED ITEM                */}
      {/* ========================================================= */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[#0A1224] border border-[#24315A] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#24315A] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#121C36] border border-[#2F52FF] flex items-center justify-center text-[#FFC700]">
                  {selectedItem.type === 'material' ? <FolderOpen className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-[#E6ECFA]">
                    {isEditing ? `Edit ${selectedItem.type === 'material' ? 'Material' : 'Announcement'}` : `${selectedItem.type === 'material' ? 'Learning Material' : 'Department Bulletin'} Details`}
                  </h3>
                  <p className="text-xs text-[#9AA8C7]">
                    Published by {selectedItem.repName} ({selectedItem.repEmail})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded-lg text-[#9AA8C7] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Read-Only Inspection View */}
            {!isEditing ? (
              <div className="space-y-4 text-xs">
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-[#121C36] border border-[#24315A]">
                    <span className="text-[#9AA8C7] text-[10px] block">Department</span>
                    <strong className="text-[#FFC700] text-xs">{selectedItem.department}</strong>
                  </div>

                  <div className="p-3 rounded-xl bg-[#121C36] border border-[#24315A]">
                    <span className="text-[#9AA8C7] text-[10px] block">Date Published</span>
                    <strong className="text-[#E6ECFA] text-xs ">
                      {new Date(selectedItem.createdAt).toLocaleDateString()}
                    </strong>
                  </div>

                  {selectedItem.courseCode && (
                    <div className="p-3 rounded-xl bg-[#121C36] border border-[#24315A]">
                      <span className="text-[#9AA8C7] text-[10px] block">Course Code</span>
                      <strong className="text-[#E6ECFA] text-xs ">{selectedItem.courseCode}</strong>
                    </div>
                  )}

                  {selectedItem.category && (
                    <div className="p-3 rounded-xl bg-[#121C36] border border-[#24315A]">
                      <span className="text-[#9AA8C7] text-[10px] block">Category</span>
                      <strong className="text-[#E6ECFA] text-xs">{selectedItem.category}</strong>
                    </div>
                  )}

                  {selectedItem.type === 'announcement' && (
                    <div className="p-3 rounded-xl bg-[#121C36] border border-[#24315A]">
                      <span className="text-[#9AA8C7] text-[10px] block">Priority</span>
                      <strong className={selectedItem.urgent ? 'text-rose-400 font-bold' : 'text-[#E6ECFA]'}>
                        {selectedItem.urgent ? 'URGENT' : 'Standard'}
                      </strong>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-[#070D1A] border border-[#24315A] space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#9AA8C7]">Title</span>
                  <div className="text-sm font-semibold text-[#E6ECFA]">{selectedItem.title}</div>
                </div>

                {selectedItem.type === 'material' && selectedItem.url && (
                  <div className="p-4 rounded-xl bg-[#070D1A] border border-[#24315A] space-y-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#9AA8C7]">Resource Link</span>
                    <div className="flex items-center justify-between gap-2">
                      <span className=" text-xs text-[#60A5FA] truncate">{selectedItem.url}</span>
                      <a
                        href={selectedItem.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 rounded-lg bg-[#2F52FF] text-white text-[11px] font-bold flex items-center gap-1 shrink-0 hover:bg-[#2545df]"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open Link</span>
                      </a>
                    </div>
                  </div>
                )}

                {selectedItem.type === 'material' && selectedItem.description && (
                  <div className="p-4 rounded-xl bg-[#070D1A] border border-[#24315A] space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#9AA8C7]">Description</span>
                    <p className="text-xs text-[#E6ECFA] leading-relaxed">{selectedItem.description}</p>
                  </div>
                )}

                {selectedItem.type === 'announcement' && selectedItem.content && (
                  <div className="p-4 rounded-xl bg-[#070D1A] border border-[#24315A] space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#9AA8C7]">Bulletin Details</span>
                    <p className="text-xs text-[#E6ECFA] leading-relaxed whitespace-pre-wrap">{selectedItem.content}</p>
                  </div>
                )}

                {/* Actions Row */}
                <div className="flex items-center justify-between pt-4 border-t border-[#24315A]">
                  <button
                    onClick={handleDeleteItem}
                    disabled={actionSaving}
                    className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Item</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 rounded-xl bg-[#2F52FF] hover:bg-[#2545df] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Content</span>
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              /* Inline Edit Form */
              <div className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#E6ECFA]">Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>

                {selectedItem.type === 'material' ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[#E6ECFA]">Course Code</label>
                        <input
                          type="text"
                          value={editCourseCode}
                          onChange={(e) => setEditCourseCode(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] uppercase focus:outline-none focus:border-[#2F52FF]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[#E6ECFA]">Category</label>
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                        >
                          <option value="Lecture Note">Lecture Note</option>
                          <option value="Past Question">Past Question</option>
                          <option value="Video">Video</option>
                          <option value="Assignment">Assignment</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#E6ECFA]">Resource Link (URL)</label>
                      <input
                        type="url"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#E6ECFA]">Description</label>
                      <textarea
                        rows={3}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#E6ECFA]">Bulletin Content</label>
                      <textarea
                        rows={4}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="urgentCheckbox"
                        checked={editUrgent}
                        onChange={(e) => setEditUrgent(e.target.checked)}
                        className="rounded bg-[#121C36] border-[#24315A] text-rose-500"
                      />
                      <label htmlFor="urgentCheckbox" className="text-xs text-[#E6ECFA] font-medium">
                        Mark as Urgent Bulletin
                      </label>
                    </div>
                  </>
                )}

                {/* Edit Form Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#24315A]">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#9AA8C7] hover:text-[#E6ECFA]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={actionSaving}
                    className="px-5 py-2.5 rounded-xl bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {actionSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>Save Changes</span>
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
