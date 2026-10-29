import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { SOT_DEPARTMENTS_LIST } from '../data/departments';
import {
  CourseSheetItem,
  CourseSheetLevel,
  CourseSheetSemester,
  ResourceCategory
} from '../types';
import {
  getCourseSheetDocId,
  formatPdfUrl,
  getPdfDownloadUrl
} from '../data/coursesAndTimetables';
import {
  FileText,
  CheckCircle2,
  Plus,
  ExternalLink,
  Download,
  Trash2,
  RefreshCw,
  Eye,
  X,
  UploadCloud,
  Link as LinkIcon,
  AlertCircle,
  HelpCircle,
  Layers
} from 'lucide-react';

const LEVELS: CourseSheetLevel[] = ['ND1', 'ND2', 'HND1', 'HND2'];
const SEMESTERS: CourseSheetSemester[] = ['First', 'Second'];

export const AdminCoursePdfsView: React.FC = () => {
  const [sheets, setSheets] = useState<Record<string, CourseSheetItem>>({});
  const [loading, setLoading] = useState(true);

  // Selected cell for Modal
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<CourseSheetLevel>('ND1');
  const [selectedSem, setSelectedSem] = useState<CourseSheetSemester>('First');
  const [showManageModal, setShowManageModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewSheet, setPreviewSheet] = useState<CourseSheetItem | null>(null);

  // Modal Form State
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formFileName, setFormFileName] = useState('');
  const [formType, setFormType] = useState<ResourceCategory>('Course Outline');
  const [formCourseCode, setFormCourseCode] = useState('');
  const [isReplacing, setIsReplacing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);

  // Real-time listener for courseSheets collection
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'courseSheets'),
      (snapshot) => {
        const map: Record<string, CourseSheetItem> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Omit<CourseSheetItem, 'id'>;
          map[docSnap.id] = {
            id: docSnap.id,
            ...data
          };
        });
        setSheets(map);
        setLoading(false);
      },
      (error) => {
        console.warn('courseSheets onSnapshot error:', error);
        setSaveError('Failed to sync course sheets: ' + error.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const openUploadNew = () => {
    setSelectedDept(SOT_DEPARTMENTS_LIST[0]);
    setSelectedLevel('ND1');
    setSelectedSem('First');
    setFormTitle('');
    setFormUrl('');
    setFormFileName('');
    setFormCourseCode('');
    setFormType('Course Outline');
    setIsReplacing(true);
    setSaveSuccess(null);
    setSaveError(null);
    setStorageNotice(null);
    setShowManageModal(true);
  };

  const openManageCell = (dept: string, level: CourseSheetLevel, sem: CourseSheetSemester) => {
    setSelectedDept(dept);
    setSelectedLevel(level);
    setSelectedSem(sem);
    setSaveSuccess(null);
    setSaveError(null);
    setStorageNotice(null);
    setFormCourseCode('');
    setFormType('Course Outline');

    const docId = getCourseSheetDocId(dept, level, sem);
    const existing = sheets[docId];

    if (existing) {
      setFormTitle(existing.title);
      setFormUrl(existing.url);
      setFormFileName(existing.fileName);
      setIsReplacing(false);
    } else {
      setFormTitle(`${dept} ${level} ${sem} Semester Course Outline`);
      setFormUrl('');
      setFormFileName(`${dept}_${level}_${sem}.pdf`);
      setIsReplacing(true);
    }

    setShowManageModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStorageNotice(null);
    setFormFileName(file.name);

    try {
      // Attempt to dynamically load firebase/storage
      const storageModule = await import('firebase/storage');
      const { getStorage, ref, uploadBytes, getDownloadURL } = storageModule;
      const storage = getStorage();

      if (!storage) {
        throw new Error('Firebase Storage is not configured in this applet.');
      }

      const docId = selectedDept && selectedLevel && selectedSem
        ? getCourseSheetDocId(selectedDept, selectedLevel, selectedSem)
        : 'course_sheet';

      const fileRef = ref(storage, `courseSheets/${docId}/${Date.now()}_${file.name}`);
      setSaving(true);
      const snapshot = await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      setFormUrl(downloadUrl);
      setSaving(false);
      setSaveSuccess('PDF file uploaded successfully! Click "Save Course PDF" to confirm.');
    } catch (err: any) {
      setSaving(false);
      console.warn('Direct upload notice:', err);
      setStorageNotice(
        'Direct Firebase Storage upload is not available for this project. Please upload your PDF to Google Drive or any host, make it viewable, and paste the share link below.'
      );
    }
  };

  const handleSaveSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept) return;

    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    const trimmedUrl = formUrl.trim();
    if (!trimmedUrl) {
      setSaveError('Please enter a valid PDF link (e.g. Google Drive link or direct file URL).');
      setSaving(false);
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      setSaveError('Please enter a valid web link (e.g. https://drive.google.com/file/d/...).');
      setSaving(false);
      return;
    }

    const formattedUrl = formatPdfUrl(trimmedUrl);
    const now = new Date().toISOString();
    const courseCodeVal = formCourseCode.trim() ? formCourseCode.trim().toUpperCase() : '';

    try {
      if (formType === 'Course Outline') {
        const docId = getCourseSheetDocId(selectedDept, selectedLevel, selectedSem);
        const payload: Omit<CourseSheetItem, 'id'> = {
          department: selectedDept,
          level: selectedLevel,
          semester: selectedSem,
          title: formTitle.trim() || `${selectedDept} ${selectedLevel} ${selectedSem} Semester Course Outline`,
          url: formattedUrl,
          fileName: formFileName.trim() || `${selectedDept}_${selectedLevel}_${selectedSem}.pdf`,
          uploadedBy: auth.currentUser?.email || auth.currentUser?.uid || 'Admin',
          createdAt: now
        };
        await setDoc(doc(db, 'courseSheets', docId), payload);

        // Also sync to resources so it appears under Courses tab
        await addDoc(collection(db, 'resources'), {
          department: selectedDept,
          level: selectedLevel,
          semester: selectedSem === 'First' ? 'First Semester' : 'Second Semester',
          courseCode: courseCodeVal,
          title: formTitle.trim() || `${selectedDept} ${selectedLevel} ${selectedSem} Semester Course Outline`,
          category: 'Course Outline',
          url: formattedUrl,
          description: `${selectedDept} ${selectedLevel} ${selectedSem} Semester Course Outline`,
          uploadedBy: auth.currentUser?.uid || 'admin',
          uploadedByEmail: auth.currentUser?.email || 'admin@portal',
          uploadedByRole: 'Admin',
          createdAt: now,
          updatedAt: now
        });
      } else {
        // Other types saved directly to resources, where Type decides where it shows
        await addDoc(collection(db, 'resources'), {
          department: selectedDept,
          level: selectedLevel,
          semester: selectedSem === 'First' ? 'First Semester' : 'Second Semester',
          courseCode: courseCodeVal,
          title: formTitle.trim(),
          category: formType,
          url: formattedUrl,
          description: '',
          uploadedBy: auth.currentUser?.uid || 'admin',
          uploadedByEmail: auth.currentUser?.email || 'admin@portal',
          uploadedByRole: 'Admin',
          createdAt: now,
          updatedAt: now
        });
      }

      setSaveSuccess('Saved successfully! The item is now live in the student portal.');
      setIsReplacing(false);
      setTimeout(() => {
        setSaveSuccess(null);
      }, 4000);
    } catch (err: any) {
      console.error('Error saving:', err);
      setSaveError(err.message || 'Failed to save item to Firestore.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSheet = async () => {
    if (!selectedDept) return;
    const docId = getCourseSheetDocId(selectedDept, selectedLevel, selectedSem);

    if (!window.confirm(`Are you sure you want to delete the course PDF for ${selectedDept} (${selectedLevel} ${selectedSem} Sem)?`)) {
      return;
    }

    setDeleting(true);
    setSaveError(null);
    try {
      await deleteDoc(doc(db, 'courseSheets', docId));
      setSaveSuccess('Course outline deleted successfully.');
      setIsReplacing(true);
      setFormUrl('');
      setFormTitle(`${selectedDept} ${selectedLevel} ${selectedSem} Semester Course Outline`);
      setTimeout(() => {
        setShowManageModal(false);
        setSaveSuccess(null);
      }, 1500);
    } catch (err: any) {
      setSaveError('Failed to delete course outline: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const currentDocId = selectedDept ? getCourseSheetDocId(selectedDept, selectedLevel, selectedSem) : '';
  const currentSheet = selectedDept ? sheets[currentDocId] : null;

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Page Intro */}
      <div className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFC700] text-[#0A1224] text-[10px] font-extrabold uppercase mb-1">
            <FileText className="w-3.5 h-3.5" />
            <span>Course Outlines</span>
          </div>
          <h2 className="font-display font-bold text-2xl text-[#E6ECFA]">
            Department Course Outlines &amp; Materials
          </h2>
          <p className="text-xs text-[#9AA8C7] mt-0.5">
            Manage course outlines, lecture notes, and past questions for each of the 6 departments across ND I, ND II, HND I, and HND II.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
          <span className="text-xs text-[#9AA8C7] px-3 py-1.5 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
            <span>{Object.keys(sheets).length} / 48 Outlines Active</span>
          </span>

          <button
            type="button"
            onClick={openUploadNew}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2F52FF] hover:bg-[#2542D9] text-white font-bold text-xs shadow-[0_0_15px_rgba(47,82,255,0.4)] transition-all cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-[#FFC700]" />
            <span>Upload</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center text-xs text-[#9AA8C7] animate-pulse">
          Loading course sheets matrix...
        </div>
      ) : (
        <div className="space-y-6">
          {SOT_DEPARTMENTS_LIST.map((dept) => {
            // Count uploaded sheets for this department
            const deptCount = LEVELS.reduce((acc, lvl) => {
              return acc + SEMESTERS.filter(sem => !!sheets[getCourseSheetDocId(dept, lvl, sem)]).length;
            }, 0);

            return (
              <div
                key={dept}
                className="p-5 sm:p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#24315A] pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FFC700]" />
                    <h3 className="font-display font-bold text-base sm:text-lg text-[#E6ECFA]">
                      {dept}
                    </h3>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#0A1224] border border-[#24315A] text-[#9AA8C7]">
                    <strong className="text-[#FFC700]">{deptCount}</strong> / 8 Uploaded
                  </span>
                </div>

                {/* Grid of 4 Levels × 2 Semesters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
                  {LEVELS.map((level) => (
                    <div
                      key={level}
                      className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-2"
                    >
                      <div className="text-xs font-bold uppercase tracking-wider text-[#FFC700] border-b border-[#24315A]/70 pb-1 flex items-center justify-between">
                        <span>{level}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-0.5">
                        {SEMESTERS.map((sem) => {
                          const docId = getCourseSheetDocId(dept, level, sem);
                          const sheet = sheets[docId];
                          const hasPdf = !!sheet;

                          return (
                            <button
                              key={sem}
                              type="button"
                              onClick={() => openManageCell(dept, level, sem)}
                              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between h-20 ${
                                hasPdf
                                  ? 'bg-emerald-950/20 border-emerald-500/50 hover:border-emerald-400 hover:bg-emerald-950/40'
                                  : 'bg-[#121C36]/50 border-dashed border-[#24315A] hover:border-[#2F52FF] hover:bg-[#121C36]'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="text-[10px] font-bold text-[#9AA8C7]">
                                  {sem === 'First' ? '1st Sem' : '2nd Sem'}
                                </span>
                                {hasPdf ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                ) : (
                                  <Plus className="w-3.5 h-3.5 text-[#62759F] shrink-0" />
                                )}
                              </div>

                              <div className="w-full">
                                {hasPdf ? (
                                  <span className="text-[11px] font-semibold text-emerald-300 block truncate leading-tight">
                                    {sheet.title}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-[#62759F] italic block">
                                    Empty
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: MANAGE COURSE PDF (UPLOAD / REPLACE / VIEW / DELETE) */}
      {/* ======================================================== */}
      {showManageModal && selectedDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-[#121C36] border border-[#24315A] p-6 space-y-5 shadow-2xl my-8">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#24315A] pb-3">
              <div>
                <span className="text-xs font-bold text-[#FFC700] uppercase tracking-wider block">
                  Course PDF Management
                </span>
                <h3 className="font-display font-bold text-lg text-[#E6ECFA] mt-0.5">
                  {selectedDept}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-[#9AA8C7]">
                  <span className="px-2 py-0.5 rounded bg-[#0A1224] text-[#E6ECFA] font-bold border border-[#24315A]">
                    {selectedLevel}
                  </span>
                  <span>•</span>
                  <span className="px-2 py-0.5 rounded bg-[#0A1224] text-[#E6ECFA] font-bold border border-[#24315A]">
                    {selectedSem} Semester
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowManageModal(false)}
                className="p-1.5 rounded-lg text-[#9AA8C7] hover:text-white hover:bg-[#0A1224] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notifications / Alerts */}
            {saveSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/70 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">{saveSuccess}</span>
              </div>
            )}

            {saveError && (
              <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/70 text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-semibold">{saveError}</span>
              </div>
            )}

            {storageNotice && (
              <div className="p-3.5 rounded-xl bg-amber-950/70 border border-amber-500/60 text-xs text-amber-200 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{storageNotice}</span>
              </div>
            )}

            {/* Existing PDF Status Card */}
            {currentSheet && !isReplacing && (
              <div className="p-4 rounded-xl bg-[#0A1224] border border-emerald-500/40 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-950/50 text-emerald-400 border border-emerald-500/40">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#E6ECFA]">
                        {currentSheet.title}
                      </h4>
                      <p className="text-[11px] text-[#9AA8C7]">
                        File: {currentSheet.fileName} • Uploaded by {currentSheet.uploadedBy}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                    Active
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#24315A]">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewSheet(currentSheet);
                      setShowPreviewModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#2F52FF] text-white text-xs font-semibold hover:bg-[#2545df] cursor-pointer flex items-center gap-1.5 shadow-[0_0_12px_rgba(47,82,255,0.3)]"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View inside App</span>
                  </button>

                  <a
                    href={currentSheet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-[#121C36] text-[#E6ECFA] border border-[#24315A] hover:border-[#2F52FF] text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#FFC700]" />
                    <span>Open External</span>
                  </a>

                  <a
                    href={getPdfDownloadUrl(currentSheet.url)}
                    download={currentSheet.fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-[#121C36] text-[#E6ECFA] border border-[#24315A] hover:border-[#FFC700] text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-[#FFC700]" />
                    <span>Download</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setIsReplacing(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] cursor-pointer ml-auto"
                  >
                    Replace PDF
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteSheet}
                    disabled={deleting}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/80 text-rose-300 border border-rose-500/40 hover:bg-rose-900 text-xs font-bold cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{deleting ? 'Deleting...' : 'Delete'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Upload or Replace Form */}
            {(isReplacing || !currentSheet) && (
              <form onSubmit={handleSaveSheet} className="space-y-4">
                
                {/* Department, Level, Semester Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#0A1224] border border-[#24315A]">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                      Department
                    </label>
                    <select
                      value={selectedDept || ''}
                      onChange={(e) => setSelectedDept(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                    >
                      {SOT_DEPARTMENTS_LIST.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                      Level
                    </label>
                    <select
                      value={selectedLevel}
                      onChange={(e) => setSelectedLevel(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                    >
                      {LEVELS.map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                      Semester
                    </label>
                    <select
                      value={selectedSem}
                      onChange={(e) => setSelectedSem(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                    >
                      {SEMESTERS.map(s => (
                        <option key={s} value={s}>{s} Semester</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Course Code (Optional) & Type */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">
                      Course Code <span className="text-[10px] text-[#9AA8C7]/60 lowercase">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formCourseCode}
                      onChange={(e) => setFormCourseCode(e.target.value)}
                      placeholder="e.g. COM 111"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs sm:text-sm text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">
                      Type
                    </label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs sm:text-sm text-[#FFC700] font-semibold focus:outline-none focus:border-[#2F52FF]"
                    >
                      <option value="Course Outline">Course Outline</option>
                      <option value="Lecture Note">Lecture Note</option>
                      <option value="Past Question">Past Question</option>
                      <option value="Video">Video</option>
                      <option value="Other">Other</option>
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
                    placeholder="e.g. Computer Technology ND1 First Semester Course Outline"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs sm:text-sm text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>

                {/* PDF Link Input */}
                <div>
                  <label className="block text-xs font-semibold text-[#9AA8C7] mb-1 flex items-center justify-between">
                    <span>PDF Document Link (Google Drive or Direct URL) *</span>
                    <span className="text-[10px] text-[#FFC700]">Converts /view to /preview</span>
                  </label>
                  <div className="relative">
                    <LinkIcon className="w-4 h-4 text-[#9AA8C7] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      required
                      value={formUrl}
                      onChange={(e) => {
                        setFormUrl(e.target.value);
                        setSaveError(null);
                      }}
                      placeholder="https://drive.google.com/file/d/..."
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                    />
                  </div>
                  <p className="text-[11px] text-[#9AA8C7] mt-1">
                    Paste any viewable Google Drive link, OneDrive link, or direct HTTPS PDF link. Google Drive links will automatically be converted to embedded preview links.
                  </p>
                </div>

                {/* File Upload Option */}
                <div className="p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#E6ECFA] flex items-center gap-1.5">
                      <UploadCloud className="w-4 h-4 text-[#FFC700]" />
                      <span>Upload Local PDF File</span>
                    </label>
                    <span className="text-[10px] text-[#9AA8C7]">Optional (if storage available)</span>
                  </div>

                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-[#9AA8C7] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#2F52FF] file:text-white hover:file:bg-[#2545df] file:cursor-pointer"
                  />
                </div>

                {/* File Name */}
                <div>
                  <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">
                    Display File Name
                  </label>
                  <input
                    type="text"
                    value={formFileName}
                    onChange={(e) => setFormFileName(e.target.value)}
                    placeholder="e.g. COM_ND1_First_Semester.pdf"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-[#24315A]">
                  {currentSheet && (
                    <button
                      type="button"
                      onClick={() => setIsReplacing(false)}
                      className="px-4 py-2 rounded-xl text-xs text-[#9AA8C7] hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setShowManageModal(false)}
                      className="px-4 py-2 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#9AA8C7] hover:text-white cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2 rounded-xl bg-[#2F52FF] hover:bg-[#2542D9] text-white text-xs font-bold transition-all cursor-pointer shadow-[0_0_15px_rgba(47,82,255,0.4)] disabled:opacity-50 flex items-center gap-2"
                    >
                      {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>{saving ? 'Saving...' : 'Upload & Save'}</span>
                    </button>
                  </div>
                </div>

              </form>
            )}

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: IN-APP PDF VIEWER                                */}
      {/* ======================================================== */}
      {showPreviewModal && previewSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-5xl h-[90vh] rounded-2xl bg-[#121C36] border border-[#24315A] flex flex-col overflow-hidden shadow-2xl">
            
            {/* Viewer Header */}
            <div className="p-4 bg-[#0A1224] border-b border-[#24315A] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/30">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#E6ECFA] truncate">
                    {previewSheet.title}
                  </h4>
                  <p className="text-[11px] text-[#9AA8C7]">
                    {previewSheet.department} • {previewSheet.level} • {previewSheet.semester} Semester
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={previewSheet.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#121C36] text-xs text-[#FFC700] border border-[#24315A] hover:border-[#FFC700] flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Open</span>
                </a>
                <a
                  href={getPdfDownloadUrl(previewSheet.url)}
                  download={previewSheet.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#2F52FF] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1.5 rounded-lg text-[#9AA8C7] hover:text-white hover:bg-[#121C36] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Viewer Body (Embedded Iframe) */}
            <div className="flex-1 bg-[#0A1224] relative">
              <iframe
                src={formatPdfUrl(previewSheet.url)}
                title={previewSheet.title}
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
