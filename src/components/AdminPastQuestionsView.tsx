import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { ResourceItem } from '../types';
import { SOT_DEPARTMENTS_LIST } from '../data/departments';
import { formatPdfUrl, getPdfDownloadUrl } from '../data/coursesAndTimetables';
import { dispatchPushNotification, getDepartmentTopicSlug } from '../lib/pushNotifications';
import { ShareButton } from './ShareButton';
import { logActivity } from '../lib/activityLogger';
import {
  FileText,
  UploadCloud,
  Search,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Download,
  Calendar,
  Filter,
  Lightbulb
} from 'lucide-react';

interface AdminPastQuestionsViewProps {
  isRepMode?: boolean;
  repDepartment?: string;
  onNotify?: () => void;
}

const ACADEMIC_LEVELS: Array<'ND1' | 'ND2' | 'HND1' | 'HND2'> = ['ND1', 'ND2', 'HND1', 'HND2'];
const SEMESTERS: Array<'First Semester' | 'Second Semester'> = ['First Semester', 'Second Semester'];

export const AdminPastQuestionsView: React.FC<AdminPastQuestionsViewProps> = ({
  isRepMode = false,
  repDepartment,
  onNotify
}) => {
  const { user, isAdmin } = useAuth();

  // Filter states
  const [deptFilter, setDeptFilter] = useState<string>(isRepMode && repDepartment ? repDepartment : 'All');
  const [levelFilter, setLevelFilter] = useState<string>('All');
  const [semesterFilter, setSemesterFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [pastQuestions, setPastQuestions] = useState<ResourceItem[]>([]);
  const [solutionsMap, setSolutionsMap] = useState<Record<string, ResourceItem>>({});
  const [loading, setLoading] = useState(true);

  // Past Question Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [formDept, setFormDept] = useState<string>(isRepMode && repDepartment ? repDepartment : SOT_DEPARTMENTS_LIST[0]);
  const [formLevel, setFormLevel] = useState<'ND1' | 'ND2' | 'HND1' | 'HND2'>('ND1');
  const [formSemester, setFormSemester] = useState<'First Semester' | 'Second Semester'>('First Semester');
  const [formTitle, setFormTitle] = useState('');
  const [formCourseCode, setFormCourseCode] = useState('');
  const [formSession, setFormSession] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [notifyStudents, setNotifyStudents] = useState(true);

  // Status banners
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // In-app PDF Viewer Modal
  const [previewPdfUrl, setPreviewPdfUrl] = useState<{ title: string; url: string } | null>(null);

  // Solution State & Modal
  const [solutionModalPq, setSolutionModalPq] = useState<ResourceItem | null>(null);
  const [editingSolutionId, setEditingSolutionId] = useState<string | null>(null);
  const [solutionType, setSolutionType] = useState<'text' | 'link'>('text');
  const [solutionText, setSolutionText] = useState('');
  const [solutionUrl, setSolutionUrl] = useState('');
  const [savingSolution, setSavingSolution] = useState(false);
  const [solutionError, setSolutionError] = useState<string | null>(null);

  // Solution Viewer Modal
  const [viewingSolution, setViewingSolution] = useState<{ pq: ResourceItem; solution: ResourceItem } | null>(null);

  // Real-time Firestore Listener
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'resources'));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const pqList: ResourceItem[] = [];
        const solMap: Record<string, ResourceItem> = {};

        snap.forEach((d) => {
          const data = d.data() as ResourceItem;
          if (data.type === 'Past Question' || data.category === 'Past Question') {
            if (isRepMode && repDepartment && data.department !== repDepartment) return;
            pqList.push({ ...data, id: d.id });
          } else if (data.type === 'Solution' || data.category === 'Solution') {
            if (data.pastQuestionId) {
              solMap[data.pastQuestionId] = { ...data, id: d.id };
            }
          }
        });

        pqList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setPastQuestions(pqList);
        setSolutionsMap(solMap);
        setLoading(false);
      },
      (err) => {
        console.warn('Admin past questions listener error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isRepMode, repDepartment]);

  // Filtered List
  const filteredQuestions = useMemo(() => {
    return pastQuestions.filter((item) => {
      const matchDept = deptFilter === 'All' || item.department === deptFilter;
      const matchLevel = levelFilter === 'All' || item.level === levelFilter;
      const matchSem = semesterFilter === 'All' || item.semester === semesterFilter;
      if (!matchDept || !matchLevel || !matchSem) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.title?.toLowerCase().includes(q) ||
        item.courseCode?.toLowerCase().includes(q) ||
        item.session?.toLowerCase().includes(q) ||
        item.department?.toLowerCase().includes(q)
      );
    });
  }, [pastQuestions, deptFilter, levelFilter, semesterFilter, searchQuery]);

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setFormDept(isRepMode && repDepartment ? repDepartment : SOT_DEPARTMENTS_LIST[0]);
    setFormLevel('ND1');
    setFormSemester('First Semester');
    setFormTitle('');
    setFormCourseCode('');
    setFormSession(`${new Date().getFullYear() - 1}/${new Date().getFullYear()}`);
    setFormUrl('');
    setSaveError(null);
    setShowModal(true);
  };

  const handleOpenEditModal = (item: ResourceItem) => {
    setEditingId(item.id);
    setFormDept(item.department);
    setFormLevel((item.level as any) || 'ND1');
    setFormSemester((item.semester as any) || 'First Semester');
    setFormTitle(item.title);
    setFormCourseCode(item.courseCode || '');
    setFormSession(item.session || item.year || '');
    setFormUrl(item.url);
    setSaveError(null);
    setShowModal(true);
  };

  const handleSavePastQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    const cleanTitle = formTitle.trim();
    const cleanUrl = formUrl.trim();

    if (!cleanTitle) {
      setSaveError('Please enter a title for the past question.');
      return;
    }
    if (!cleanUrl) {
      setSaveError('Please provide a PDF or document link.');
      return;
    }

    const formattedUrl = formatPdfUrl(cleanUrl);

    setSaving(true);
    try {
      const payload: any = {
        type: 'Past Question',
        category: 'Past Question',
        department: isRepMode && repDepartment ? repDepartment : formDept,
        level: formLevel,
        semester: formSemester,
        title: cleanTitle,
        courseCode: formCourseCode.trim().toUpperCase() || undefined,
        session: formSession.trim() || undefined,
        url: formattedUrl,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'resources', editingId), payload);
        if (user) {
          await logActivity({
            uid: user.uid,
            email: user.email || '',
            role: isAdmin ? 'Admin' : 'Rep',
            action: 'Updated',
            itemType: 'Past Question',
            title: cleanTitle
          });
        }
        setSaveSuccess('Past question updated successfully!');
      } else {
        payload.uploadedBy = user?.uid || 'admin';
        payload.uploadedByEmail = user?.email || '';
        payload.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'resources'), payload);
        if (user) {
          await logActivity({
            uid: user.uid,
            email: user.email || '',
            role: isAdmin ? 'Admin' : 'Rep',
            action: 'Created',
            itemType: 'Past Question',
            title: cleanTitle
          });
        }
        setSaveSuccess('Past question saved and published successfully!');

        // Dispatch push notification
        if (notifyStudents && user) {
          const targetDept = isRepMode && repDepartment ? repDepartment : formDept;
          const topic = `dept-${getDepartmentTopicSlug(targetDept)}-${formLevel.toLowerCase()}`;
          dispatchPushNotification(
            {
              topic,
              title: 'SOT: Past Question Added',
              body: `${formCourseCode ? formCourseCode.trim().toUpperCase() + ' - ' : ''}${cleanTitle} (${formSession || 'Past Question'})`,
              link: '/dashboard?tab=past-questions'
            },
            user
          ).catch((err) => console.warn('Push broadcast note:', err));
        }
      }

      setShowModal(false);
      if (onNotify) onNotify();
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      console.warn('Save past question error:', err);
      setSaveError(err.message || 'Failed to save past question. Please check rules and permissions.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${title}"?`)) return;

    try {
      await deleteDoc(doc(db, 'resources', id));
      if (user) {
        await logActivity({
          uid: user.uid,
          email: user.email || '',
          role: isAdmin ? 'Admin' : 'Rep',
          action: 'Deleted',
          itemType: 'Past Question',
          title
        });
      }
      setSaveSuccess(`Deleted "${title}" successfully.`);
      if (onNotify) onNotify();
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      console.warn('Delete past question error:', err);
      setSaveError(err.message || 'Failed to delete past question.');
      setTimeout(() => setSaveError(null), 5000);
    }
  };

  // Solution Handlers
  const handleOpenSolutionModal = (pq: ResourceItem, existing?: ResourceItem) => {
    setSolutionModalPq(pq);
    setSolutionError(null);
    if (existing) {
      setEditingSolutionId(existing.id);
      setSolutionType(existing.solutionType || (existing.content ? 'text' : 'link'));
      setSolutionText(existing.content || '');
      setSolutionUrl(existing.url || '');
    } else {
      setEditingSolutionId(null);
      setSolutionType('text');
      setSolutionText('');
      setSolutionUrl('');
    }
  };

  const handleSaveSolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solutionModalPq) return;
    setSolutionError(null);

    if (solutionType === 'text' && !solutionText.trim()) {
      setSolutionError('Please enter the solution text.');
      return;
    }
    if (solutionType === 'link' && !solutionUrl.trim()) {
      setSolutionError('Please provide a solution URL.');
      return;
    }

    setSavingSolution(true);
    const nowIso = new Date().toISOString();
    try {
      const formattedUrl = solutionType === 'link' ? formatPdfUrl(solutionUrl.trim()) : '';
      const payload: Partial<ResourceItem> = {
        type: 'Solution',
        category: 'Solution',
        pastQuestionId: solutionModalPq.id,
        department: solutionModalPq.department,
        level: solutionModalPq.level,
        semester: solutionModalPq.semester,
        courseCode: solutionModalPq.courseCode,
        title: `Solution: ${solutionModalPq.title}`,
        solutionType,
        content: solutionType === 'text' ? solutionText.trim() : '',
        url: formattedUrl,
        updatedAt: nowIso
      };

      if (editingSolutionId) {
        await updateDoc(doc(db, 'resources', editingSolutionId), payload);
        if (user) {
          await logActivity({
            uid: user.uid,
            email: user.email || '',
            role: isAdmin ? 'Admin' : 'Rep',
            action: 'Updated',
            itemType: 'Solution',
            title: `Solution for ${solutionModalPq.title}`
          });
        }
      } else {
        payload.uploadedBy = user?.uid || 'admin';
        payload.uploadedByEmail = user?.email || '';
        payload.uploadedByRole = isAdmin ? 'Admin' : 'Rep';
        payload.createdAt = nowIso;
        await addDoc(collection(db, 'resources'), payload);
        if (user) {
          await logActivity({
            uid: user.uid,
            email: user.email || '',
            role: isAdmin ? 'Admin' : 'Rep',
            action: 'Created',
            itemType: 'Solution',
            title: `Solution for ${solutionModalPq.title}`
          });
        }
      }

      setSolutionModalPq(null);
      setSaveSuccess('Solution saved successfully!');
      setTimeout(() => setSaveSuccess(null), 3500);
    } catch (err: any) {
      console.warn('Save solution error:', err);
      setSolutionError(err?.message || 'Could not save solution.');
    } finally {
      setSavingSolution(false);
    }
  };

  const handleDeleteSolution = async (solution: ResourceItem, pqTitle: string) => {
    if (!confirm('Permanently delete this solution?')) return;
    try {
      await deleteDoc(doc(db, 'resources', solution.id));
      if (user) {
        await logActivity({
          uid: user.uid,
          email: user.email || '',
          role: isAdmin ? 'Admin' : 'Rep',
          action: 'Deleted',
          itemType: 'Solution',
          title: `Solution for ${pqTitle}`
        });
      }
      setSaveSuccess('Solution removed successfully.');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      alert(`Could not delete solution: ${err?.message || err}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar with Prominent Upload Button */}
      <div className="p-4 rounded-2xl bg-[#0F1E36] border border-[#1E2E52] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h2 className="font-heading font-bold text-lg text-[#E6ECFA] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#FFC700]" />
            <span>Past Questions Management</span>
          </h2>
          <p className="text-xs text-[#9AA8C7]">
            Upload, edit, and manage standalone past questions and solutions for students across all departments and sessions.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 rounded-xl bg-[#2F52FF] hover:bg-[#2542D9] text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(47,82,255,0.4)] transition-all shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Past Question</span>
        </button>
      </div>

      {/* Success & Error Banners */}
      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-xs text-emerald-200 flex items-center justify-between shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{saveSuccess}</span>
          </div>
          <button onClick={() => setSaveSuccess(null)} className="text-emerald-400 hover:text-white">&times;</button>
        </div>
      )}

      {saveError && (
        <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-xs text-rose-200 flex items-center justify-between shadow-[0_0_15px_rgba(244,63,94,0.2)]">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold">{saveError}</span>
          </div>
          <button onClick={() => setSaveError(null)} className="text-rose-400 hover:text-white">&times;</button>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="p-3.5 rounded-2xl bg-[#0F1E36] border border-[#1E2E52] space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
          {/* Department Filter (Only for Admin; Rep is locked) */}
          {!isRepMode && (
            <div>
              <label className="block text-[10px] font-bold uppercase text-[#9AA8C7] mb-1">
                Department
              </label>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
              >
                <option value="All">All Departments</option>
                {SOT_DEPARTMENTS_LIST.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Level Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-[#9AA8C7] mb-1">
              Level
            </label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
            >
              <option value="All">All Levels</option>
              {ACADEMIC_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-[#9AA8C7] mb-1">
              Semester
            </label>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
            >
              <option value="All">All Semesters</option>
              {SEMESTERS.map((sem) => (
                <option key={sem} value={sem}>
                  {sem}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className={isRepMode ? 'sm:col-span-2' : ''}>
            <label className="block text-[10px] font-bold uppercase text-[#9AA8C7] mb-1">
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search title, course code, session..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
              />
              <Search className="w-3.5 h-3.5 text-[#9AA8C7] absolute left-2 top-2" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl bg-[#0F1E36] border border-[#1E2E52] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1E2E52] bg-[#070D1A]/60 text-[#9AA8C7] text-[11px]">
                <th className="py-3 px-3.5 font-semibold">Title / Course</th>
                <th className="py-3 px-3.5 font-semibold">Department</th>
                <th className="py-3 px-3.5 font-semibold">Level &amp; Sem</th>
                <th className="py-3 px-3.5 font-semibold">Session</th>
                <th className="py-3 px-3.5 font-semibold">Solution</th>
                <th className="py-3 px-3.5 font-semibold">Resource</th>
                <th className="py-3 px-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2E52]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#9AA8C7]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-[#FFC700]" />
                    <span>Loading past questions...</span>
                  </td>
                </tr>
              ) : filteredQuestions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#9AA8C7]">
                    No past questions found matching your filter selection.
                  </td>
                </tr>
              ) : (
                filteredQuestions.map((item) => {
                  const solution = solutionsMap[item.id];
                  return (
                    <tr key={item.id} className="hover:bg-[#070D1A]/50 transition-colors">
                      <td className="py-2.5 px-3.5">
                        <div className="font-semibold text-[#E6ECFA]">{item.title}</div>
                        {item.courseCode ? (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/30">
                            {item.courseCode}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#9AA8C7] italic">General Exam</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-[#E6ECFA]">
                        {item.department}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#121C36] text-[#E6ECFA] border border-[#1E2E52]">
                          {item.level} • {item.semester === 'First Semester' ? '1st Sem' : '2nd Sem'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-[#FFC700] font-mono">
                        {item.session || item.year || 'N/A'}
                      </td>

                      {/* Solution Section (Requirement 3) */}
                      <td className="py-2.5 px-3.5">
                        {solution ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingSolution({ pq: item, solution })}
                              className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 hover:bg-emerald-900/60 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>{solution.solutionType === 'link' ? 'Link' : 'Typed'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenSolutionModal(item, solution)}
                              className="p-1 text-[#9AA8C7] hover:text-[#FFC700]"
                              title="Edit solution"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSolution(solution, item.title)}
                              className="p-1 text-[#9AA8C7] hover:text-rose-400"
                              title="Delete solution"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenSolutionModal(item)}
                            className="px-2 py-0.5 rounded bg-[#070D1A] hover:bg-[#121C36] text-[#9AA8C7] hover:text-[#60A5FA] border border-[#1E2E52] text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3 text-[#FFC700]" />
                            <span>Add Solution</span>
                          </button>
                        )}
                      </td>

                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewPdfUrl({ title: item.title, url: formatPdfUrl(item.url) })}
                            className="px-2 py-1 rounded bg-[#2F52FF]/20 hover:bg-[#2F52FF] text-[#60A5FA] hover:text-white text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Preview</span>
                          </button>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded text-[#9AA8C7] hover:text-white"
                            title="Open original link"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </td>

                      <td className="py-2.5 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* WhatsApp / Web Share Button (Requirement 2) */}
                          <ShareButton
                            title={`${item.courseCode ? item.courseCode + ' ' : ''}${item.title}`}
                            itemType="past-question"
                            id={item.id}
                            textDetails={item.session ? `${item.session} Session` : undefined}
                            variant="icon"
                          />

                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-[#9AA8C7] hover:text-[#FFC700] cursor-pointer"
                            title="Edit past question"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.title)}
                            className="p-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-rose-400 hover:text-rose-300 hover:border-rose-500 cursor-pointer"
                            title="Delete past question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload / Edit Past Question Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/85 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-lg bg-[#0F1E36] border border-[#1E2E52] rounded-2xl p-5 sm:p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E2E52]">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#FFC700]" />
                <h3 className="font-heading font-bold text-base text-[#E6ECFA]">
                  {editingId ? 'Edit Past Question' : 'Upload Past Question'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-[#9AA8C7] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePastQuestion} className="space-y-3.5 mt-3 text-xs">
              {/* Department */}
              {!isRepMode ? (
                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                    Department *
                  </label>
                  <select
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  >
                    {SOT_DEPARTMENTS_LIST.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-[11px] text-[#9AA8C7]">
                  Target Department: <strong className="text-[#FFC700]">{repDepartment}</strong>
                </div>
              )}

              {/* Level & Semester */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                    Level *
                  </label>
                  <select
                    value={formLevel}
                    onChange={(e) => setFormLevel(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  >
                    {ACADEMIC_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                    Semester *
                  </label>
                  <select
                    value={formSemester}
                    onChange={(e) => setFormSemester(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  >
                    {SEMESTERS.map((sem) => (
                      <option key={sem} value={sem}>
                        {sem}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Course Code & Session */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                    Course Code <span className="text-[#9AA8C7]/60 lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. COM 111"
                    value={formCourseCode}
                    onChange={(e) => setFormCourseCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                    Academic Session *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2023/2024"
                    value={formSession}
                    onChange={(e) => setFormSession(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#FFC700] font-mono focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  Title / Examination Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Introduction to Programming 2023/2024 Exam"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              {/* PDF or Document Link */}
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  PDF or Document Link *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://drive.google.com/... or file URL"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                />
                <span className="text-[10px] text-[#9AA8C7]/70 mt-1 block">
                  Google Drive /view links are automatically converted to clean in-app /preview links.
                </span>
              </div>

              {/* Notify Students Checkbox */}
              {!editingId && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="pqNotify"
                    checked={notifyStudents}
                    onChange={(e) => setNotifyStudents(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#070D1A] border-[#1E2E52] text-[#2F52FF] cursor-pointer"
                  />
                  <label htmlFor="pqNotify" className="text-xs text-[#E6ECFA] cursor-pointer">
                    Notify students via phone push alert
                  </label>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#1E2E52]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#9AA8C7] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-[#FFC700] hover:bg-[#ffd233] text-[#0A1224] text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(255,199,0,0.3)]"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#0A1224]" />
                      <span>{editingId ? 'Save Changes' : 'Upload Past Question'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Solution Add / Edit Modal */}
      {solutionModalPq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/85 backdrop-blur-md">
          <div className="relative w-full max-w-lg bg-[#0F1E36] border border-[#1E2E52] rounded-2xl p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E2E52]">
              <div>
                <h3 className="font-heading font-bold text-sm text-[#E6ECFA] flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-[#FFC700]" />
                  <span>{editingSolutionId ? 'Edit Solution' : 'Add Solution'}</span>
                </h3>
                <p className="text-[11px] text-[#9AA8C7] truncate max-w-sm">
                  {solutionModalPq.title}
                </p>
              </div>
              <button
                onClick={() => setSolutionModalPq(null)}
                className="p-1 text-[#9AA8C7] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {solutionError && (
              <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-500/50 text-xs text-rose-200 mt-3">
                {solutionError}
              </div>
            )}

            <form onSubmit={handleSaveSolution} className="space-y-3.5 mt-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  Format
                </label>
                <div className="flex p-0.5 rounded-lg bg-[#070D1A] border border-[#1E2E52]">
                  <button
                    type="button"
                    onClick={() => setSolutionType('text')}
                    className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${
                      solutionType === 'text'
                        ? 'bg-[#2F52FF] text-white shadow-sm'
                        : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                    }`}
                  >
                    Typed Steps &amp; Working
                  </button>
                  <button
                    type="button"
                    onClick={() => setSolutionType('link')}
                    className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${
                      solutionType === 'link'
                        ? 'bg-[#2F52FF] text-white shadow-sm'
                        : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                    }`}
                  >
                    Link / External PDF
                  </button>
                </div>
              </div>

              {solutionType === 'text' ? (
                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                    Typed Solution *
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={solutionText}
                    onChange={(e) => setSolutionText(e.target.value)}
                    placeholder="Enter full step-by-step solutions, explanations, and answers for students..."
                    className="w-full px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                    Solution PDF / URL Link *
                  </label>
                  <input
                    type="url"
                    required
                    value={solutionUrl}
                    onChange={(e) => setSolutionUrl(e.target.value)}
                    placeholder="https://drive.google.com/... or solution PDF"
                    className="w-full px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1E2E52]">
                <button
                  type="button"
                  onClick={() => setSolutionModalPq(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#070D1A] text-[#9AA8C7] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSolution}
                  className="px-4 py-1.5 rounded-xl bg-[#2F52FF] hover:bg-[#2542D9] text-white font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingSolution && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{savingSolution ? 'Saving...' : editingSolutionId ? 'Update Solution' : 'Save Solution'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Solution Viewer Modal (Admin) */}
      {viewingSolution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#070D1A]/90 backdrop-blur-md">
          <div className="relative w-full max-w-xl bg-[#0A1224] border border-[#24315A] rounded-2xl flex flex-col overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#24315A]">
              <div>
                <span className="text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                  Solution Preview
                </span>
                <h3 className="font-heading font-bold text-sm text-[#E6ECFA] mt-1">
                  {viewingSolution.pq.title}
                </h3>
              </div>
              <button
                onClick={() => setViewingSolution(null)}
                className="p-1 rounded-lg text-[#9AA8C7] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {viewingSolution.solution.content ? (
              <div className="p-3.5 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] whitespace-pre-wrap max-h-80 overflow-y-auto">
                {viewingSolution.solution.content}
              </div>
            ) : null}

            {viewingSolution.solution.url ? (
              <div className="p-3 rounded-xl bg-[#070D1A] border border-[#1E2E52] flex items-center justify-between">
                <span className="text-xs text-[#9AA8C7]">External document link:</span>
                <a
                  href={viewingSolution.solution.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 rounded-lg bg-[#2F52FF] text-white text-xs font-bold flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open URL</span>
                </a>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* In-app PDF Viewer Modal */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#070D1A]/90 backdrop-blur-md">
          <div className="relative w-full max-w-4xl h-[90vh] bg-[#0A1224] border border-[#24315A] rounded-2xl flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <div className="p-3.5 bg-[#121C36] border-b border-[#24315A] flex items-center justify-between gap-3">
              <h3 className="font-heading font-bold text-sm text-[#E6ECFA] truncate">
                {previewPdfUrl.title}
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewPdfUrl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#121C36] hover:bg-[#1A2E63] text-[#E6ECFA] border border-[#24315A] text-xs font-semibold flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#FFC700]" />
                  <span>External</span>
                </a>
                <button
                  onClick={() => setPreviewPdfUrl(null)}
                  className="p-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#9AA8C7] hover:text-white hover:border-rose-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-[#070D1A]">
              <iframe
                src={previewPdfUrl.url}
                title={previewPdfUrl.title}
                className="w-full h-full border-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
