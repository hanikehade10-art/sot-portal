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
  Filter
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
  const { user } = useAuth();

  // Filter states
  const [deptFilter, setDeptFilter] = useState<string>(isRepMode && repDepartment ? repDepartment : 'All');
  const [levelFilter, setLevelFilter] = useState<string>('All');
  const [semesterFilter, setSemesterFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [pastQuestions, setPastQuestions] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
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

  // Status banners
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // In-app PDF Viewer Modal
  const [previewPdfUrl, setPreviewPdfUrl] = useState<{ title: string; url: string } | null>(null);

  // Real-time Firestore Listener
  useEffect(() => {
    setLoading(true);
    let q = query(collection(db, 'resources'));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: ResourceItem[] = [];
        snap.forEach((d) => {
          const data = d.data() as ResourceItem;
          if (data.type === 'Past Question' || data.category === 'Past Question') {
            // For Rep mode: restrict strictly to repDepartment
            if (isRepMode && repDepartment && data.department !== repDepartment) {
              return;
            }
            list.push({ ...data, id: d.id });
          }
        });
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setPastQuestions(list);
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

    // Convert Google Drive links to preview links
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
        setSaveSuccess('Past question updated successfully!');
      } else {
        payload.uploadedBy = user?.uid || 'admin';
        payload.uploadedByEmail = user?.email || '';
        payload.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'resources'), payload);
        setSaveSuccess('Past question saved and published successfully!');
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
      setSaveSuccess(`Deleted "${title}" successfully.`);
      if (onNotify) onNotify();
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      console.warn('Delete past question error:', err);
      setSaveError(err.message || 'Failed to delete past question.');
      setTimeout(() => setSaveError(null), 5000);
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
            Upload, edit, and manage standalone past questions for students across all departments and sessions.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 rounded-xl bg-[#FFC700] hover:bg-[#ffd233] text-[#0A1224] text-xs font-bold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,199,0,0.3)] cursor-pointer shrink-0 transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <UploadCloud className="w-4 h-4 text-[#0A1224]" />
          <span>Upload Past Question</span>
        </button>
      </div>

      {/* Global Success Banner */}
      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Global Error Banner */}
      {saveError && !showModal && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-3.5 rounded-xl bg-[#0F1E36] border border-[#1E2E52] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex-1 min-w-[200px] relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by course code, title, session..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/60 focus:outline-none focus:border-[#2F52FF]"
          />
          <Search className="w-3.5 h-3.5 text-[#9AA8C7] absolute left-2.5 top-2" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isRepMode && (
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none"
            >
              <option value="All">All Departments</option>
              {SOT_DEPARTMENTS_LIST.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none"
          >
            <option value="All">All Levels</option>
            {ACADEMIC_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>

          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none"
          >
            <option value="All">All Semesters</option>
            {SEMESTERS.map((sem) => (
              <option key={sem} value={sem}>
                {sem}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Past Questions Table */}
      <div className="rounded-xl bg-[#0F1E36] border border-[#1E2E52] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#070D1A] text-[#9AA8C7] uppercase font-bold tracking-wider border-b border-[#1E2E52]">
              <tr>
                <th className="py-2.5 px-3.5">Title &amp; Code</th>
                <th className="py-2.5 px-3.5">Department</th>
                <th className="py-2.5 px-3.5">Level &amp; Sem</th>
                <th className="py-2.5 px-3.5">Session</th>
                <th className="py-2.5 px-3.5">Link / Preview</th>
                <th className="py-2.5 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2E52]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#9AA8C7]">
                    Loading past questions...
                  </td>
                </tr>
              ) : filteredQuestions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#9AA8C7]">
                    No past questions match your filters. Tap "Upload Past Question" to add one.
                  </td>
                </tr>
              ) : (
                filteredQuestions.map((item) => (
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
                    <td className="py-2.5 px-3.5 text-right space-x-1.5">
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload / Edit Modal */}
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
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-[#9AA8C7] hover:text-white hover:bg-[#070D1A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saveError && (
              <div className="mt-3 p-3 rounded-lg bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            <form onSubmit={handleSavePastQuestion} className="space-y-3.5 mt-4">
              {/* Department */}
              <div>
                <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">
                  Department *
                </label>
                <select
                  disabled={isRepMode}
                  value={formDept}
                  onChange={(e) => setFormDept(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {SOT_DEPARTMENTS_LIST.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                {isRepMode && (
                  <p className="text-[10px] text-[#9AA8C7] mt-0.5">
                    Locked to your enrolled department as Course Representative.
                  </p>
                )}
              </div>

              {/* Level & Semester Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">
                    Level *
                  </label>
                  <select
                    value={formLevel}
                    onChange={(e) => setFormLevel(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  >
                    {ACADEMIC_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">
                    Semester *
                  </label>
                  <select
                    value={formSemester}
                    onChange={(e) => setFormSemester(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  >
                    {SEMESTERS.map((sem) => (
                      <option key={sem} value={sem}>
                        {sem}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. COM 111 First Semester Examination 2023/2024"
                  className="w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              {/* Course Code (Optional) & Session Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">
                    Course Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={formCourseCode}
                    onChange={(e) => setFormCourseCode(e.target.value.toUpperCase().replace(/\s+/g, ' '))}
                    placeholder="e.g. COM 111"
                    className="w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] uppercase placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">
                    Session / Year
                  </label>
                  <input
                    type="text"
                    value={formSession}
                    onChange={(e) => setFormSession(e.target.value)}
                    placeholder="e.g. 2023/2024"
                    className="w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>
              </div>

              {/* PDF Link */}
              <div>
                <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">
                  PDF or Document Link *
                </label>
                <input
                  type="url"
                  required
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/... or direct PDF link"
                  className="w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                />
                <p className="text-[10px] text-[#9AA8C7] mt-1">
                  Google Drive shareable links are automatically transformed into previewable PDF embeds.
                </p>
              </div>

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
