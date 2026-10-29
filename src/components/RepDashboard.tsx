import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { ResourceItem, ResourceCategory, AnnouncementItem, AcademicLevel, CourseItem } from '../types';
import {
  INITIAL_COURSES,
  normalizeCourseLevel,
  normalizeCourseSemester,
  formatPdfUrl,
  getCourseSheetDocId
} from '../data/coursesAndTimetables';
import { PWAInstallRow } from './PWAInstallRow';
import {
  LayoutDashboard,
  UploadCloud,
  Megaphone,
  FolderOpen,
  ArrowLeft,
  LogOut,
  Sparkles,
  ExternalLink,
  Edit2,
  Trash2,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  BookOpen,
  Calendar,
  FileText,
  Video,
  FileCheck,
  Tag,
  Menu
} from 'lucide-react';

interface RepDashboardProps {
  onNavigateStudentPortal: () => void;
  onNavigateHome: () => void;
}

type RepTab = 'overview' | 'upload' | 'announcement' | 'my-uploads';

const ACADEMIC_LEVELS: Array<'ND1' | 'ND2' | 'HND1' | 'HND2'> = ['ND1', 'ND2', 'HND1', 'HND2'];
const SEMESTERS: Array<'First Semester' | 'Second Semester'> = ['First Semester', 'Second Semester'];
const RESOURCE_CATEGORIES: ResourceCategory[] = [
  'Course Outline',
  'Lecture Note',
  'Past Question',
  'Video',
  'Other'
];

export const RepDashboard: React.FC<RepDashboardProps> = ({
  onNavigateStudentPortal,
  onNavigateHome
}) => {
  const { user, profile, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<RepTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleConfirmLogout = async () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem('sot_local_user');
      localStorage.removeItem('sot_local_profile');
      localStorage.removeItem('sot_admin_view_choice');
      localStorage.removeItem('sot_notifications_last_seen');
      localStorage.removeItem('sot_daily_ai_timestamps');
      localStorage.removeItem('sot_ai_chat_session');
      await logout();
    } catch (err) {
      console.warn('Logout error:', err);
    } finally {
      setShowLogoutConfirm(false);
      onNavigateHome();
    }
  };

  // Rep's locked department
  const repDepartment = profile?.department || 'Computer Technology';

  // Data states
  const [myResources, setMyResources] = useState<ResourceItem[]>([]);
  const [myAnnouncements, setMyAnnouncements] = useState<AnnouncementItem[]>([]);

  // -------------------------------------------------------------
  // FORM: UPLOAD RESOURCE
  // -------------------------------------------------------------
  const [uploadLevel, setUploadLevel] = useState<'ND1' | 'ND2' | 'HND1' | 'HND2'>('ND1');
  const [uploadSemester, setUploadSemester] = useState<'First Semester' | 'Second Semester'>('First Semester');
  const [uploadCourseCode, setUploadCourseCode] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState<ResourceCategory>('Lecture Note');
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadSaving, setUploadSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // -------------------------------------------------------------
  // FORM: POST ANNOUNCEMENT
  // -------------------------------------------------------------
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annUrgent, setAnnUrgent] = useState(false);
  const [annSaving, setAnnSaving] = useState(false);
  const [annError, setAnnError] = useState<string | null>(null);
  const [annSuccess, setAnnSuccess] = useState<string | null>(null);

  // -------------------------------------------------------------
  // EDIT MODAL (FOR RESOURCES OR ANNOUNCEMENTS)
  // -------------------------------------------------------------
  const [editingResource, setEditingResource] = useState<ResourceItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editCategory, setEditCategory] = useState<ResourceCategory>('Lecture Note');
  const [editDescription, setEditDescription] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Filter in My Uploads
  const [uploadsSubTab, setUploadsSubTab] = useState<'materials' | 'announcements'>('materials');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Rep's data from Firestore
  const fetchRepData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Fetch resources
      const resQuery = query(
        collection(db, 'resources'),
        where('uploadedBy', '==', user.uid)
      );
      const resSnap = await getDocs(resQuery).catch(() => null);

      if (resSnap && !resSnap.empty) {
        const items = resSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as ResourceItem[];
        setMyResources(items);
      } else {
        // Fallback: fetch all for this department and filter by uploadedBy
        const deptResQuery = query(
          collection(db, 'resources'),
          where('department', '==', repDepartment)
        );
        const deptSnap = await getDocs(deptResQuery).catch(() => null);
        if (deptSnap && !deptSnap.empty) {
          const items = deptSnap.docs
            .map(d => ({ id: d.id, ...(d.data() as any) }))
            .filter(item => item.uploadedBy === user.uid) as ResourceItem[];
          setMyResources(items);
        } else {
          setMyResources([]);
        }
      }

      // 2. Fetch announcements for this department posted by this user or tagged with rep's name
      const annSnap = await getDocs(collection(db, 'announcements')).catch(() => null);
      if (annSnap && !annSnap.empty) {
        const authorMatch = profile?.fullName ? profile.fullName.toLowerCase() : '';
        const emailMatch = user.email ? user.email.toLowerCase() : '';
        const items = annSnap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) }))
          .filter(a => {
            const author = (a.author || '').toLowerCase();
            const dept = a.department || '';
            const isMyDept = dept === repDepartment || dept === 'All';
            const isMine =
              author.includes('rep') &&
              (isMyDept ||
                (authorMatch && author.includes(authorMatch)) ||
                (emailMatch && author.includes(emailMatch)));
            return isMine;
          }) as AnnouncementItem[];
        setMyAnnouncements(items);
      } else {
        setMyAnnouncements([]);
      }
    } catch (err) {
      console.warn('Rep data fetch notice:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepData();
  }, [user, repDepartment]);

  const [deptCourses, setDeptCourses] = useState<CourseItem[]>([]);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'courses'), where('department', '==', repDepartment)));
        if (!snap.empty) {
          setDeptCourses(snap.docs.map(d => ({ id: d.id, ...d.data() } as CourseItem)));
        } else {
          setDeptCourses([]);
        }
      } catch (e) {
        setDeptCourses([]);
      }
    };
    fetchCourses();
  }, [repDepartment]);

  // Suggested course codes for rep's department
  const suggestedCourseCodes = useMemo(() => {
    const matched = deptCourses.filter(
      c =>
        c.department === repDepartment &&
        normalizeCourseLevel(c.level) === uploadLevel &&
        normalizeCourseSemester(c.semester) === uploadSemester
    );
    return matched.map(c => ({ code: c.code, title: c.title }));
  }, [deptCourses, repDepartment, uploadLevel, uploadSemester]);

  // Handle Upload Submission
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);

    if (!uploadTitle.trim() || !uploadUrl.trim()) {
      setUploadError('Material title and resource URL are required.');
      return;
    }

    // Basic URL check
    try {
      new URL(uploadUrl.trim());
    } catch {
      setUploadError('Please provide a valid web link (e.g. https://drive.google.com/... or direct file link)');
      return;
    }

    setUploadSaving(true);
    const now = new Date().toISOString();
    const formattedUrl = formatPdfUrl(uploadUrl.trim());
    const courseCodeVal = uploadCourseCode.trim() ? uploadCourseCode.trim().toUpperCase() : '';

    const payload = {
      department: repDepartment,
      level: uploadLevel,
      semester: uploadSemester,
      courseCode: courseCodeVal,
      title: uploadTitle.trim(),
      category: uploadCategory,
      url: formattedUrl,
      description: uploadDescription.trim(),
      uploadedBy: user?.uid || '',
      uploadedByEmail: user?.email || '',
      uploadedByRole: 'Course Rep',
      createdAt: now,
      updatedAt: now
    };

    try {
      const docRef = await addDoc(collection(db, 'resources'), payload);
      const newResource: ResourceItem = {
        id: docRef.id,
        ...payload
      };
      setMyResources(prev => [newResource, ...prev]);

      // If category is Course Outline, sync to courseSheets as well
      if (uploadCategory === 'Course Outline') {
        const sheetLevel = normalizeCourseLevel(uploadLevel);
        const sheetSem = uploadSemester.includes('First') ? 'First' : 'Second';
        const docId = getCourseSheetDocId(repDepartment, sheetLevel, sheetSem);
        setDoc(doc(db, 'courseSheets', docId), {
          department: repDepartment,
          level: sheetLevel,
          semester: sheetSem,
          title: uploadTitle.trim(),
          url: formattedUrl,
          fileName: `${repDepartment}_${sheetLevel}_${sheetSem}.pdf`,
          uploadedBy: user?.email || 'Course Rep',
          createdAt: now
        }, { merge: true }).catch(() => {});
      }

      setUploadSuccess(`Saved successfully! "${uploadTitle.trim()}" published to ${repDepartment} students.`);
      // Reset form
      setUploadTitle('');
      setUploadCourseCode('');
      setUploadUrl('');
      setUploadDescription('');
      setTimeout(() => setUploadSuccess(null), 5000);
    } catch (err: any) {
      console.error('Resource upload failed:', err);
      setUploadError(err.message || 'Failed to upload material to Firestore. Please check your network and rules.');
    } finally {
      setUploadSaving(false);
    }
  };

  // Handle Post Announcement
  const handleAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnnError(null);
    setAnnSuccess(null);

    if (!annTitle.trim() || !annMessage.trim()) {
      setAnnError('Announcement title and message content are required.');
      return;
    }

    setAnnSaving(true);
    const repAuthor = profile?.fullName
      ? `${profile.fullName} (Course Rep)`
      : `Course Rep (${repDepartment})`;

    const now = new Date().toISOString();
    const payload = {
      title: annTitle.trim(),
      content: annMessage.trim(),
      category: 'Department',
      department: repDepartment,
      urgent: annUrgent,
      author: repAuthor,
      uploadedBy: user?.uid || '',
      uploadedByEmail: user?.email || '',
      createdAt: now
    };

    try {
      const docRef = await addDoc(collection(db, 'announcements'), payload);
      const newAnn: AnnouncementItem = {
        id: docRef.id,
        ...payload
      } as any;
      setMyAnnouncements(prev => [newAnn, ...prev]);
      setAnnSuccess('Announcement posted successfully to your department board!');
      setAnnTitle('');
      setAnnMessage('');
      setAnnUrgent(false);
      setTimeout(() => setAnnSuccess(null), 5000);
    } catch (err: any) {
      console.error('Post announcement failed:', err);
      setAnnError(err.message || 'Failed to post announcement. Reps can only publish for their own department.');
    } finally {
      setAnnSaving(false);
    }
  };

  // Delete Resource
  const handleDeleteResource = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'resources', id));
      setMyResources(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      alert(`Could not delete material: ${err.message || err}`);
    }
  };

  // Delete Announcement
  const handleDeleteAnnouncement = async (id: string, title: string) => {
    if (!window.confirm(`Delete announcement "${title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
      setMyAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      alert(`Could not delete announcement: ${err.message || err}`);
    }
  };

  // Open Edit Modal
  const handleOpenEditResource = (item: ResourceItem) => {
    setEditingResource(item);
    setEditTitle(item.title);
    setEditUrl(item.url);
    setEditCategory(item.category);
    setEditDescription(item.description || '');
    setEditError(null);
  };

  // Save Edit
  const handleSaveEditResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResource) return;

    if (!editTitle.trim() || !editUrl.trim()) {
      setEditError('Title and URL are required.');
      return;
    }

    setEditSaving(true);
    try {
      const updatedFields = {
        title: editTitle.trim(),
        url: editUrl.trim(),
        category: editCategory,
        description: editDescription.trim(),
        updatedAt: new Date().toISOString()
      };
      await updateDoc(doc(db, 'resources', editingResource.id), updatedFields);
      setMyResources(prev =>
        prev.map(r => (r.id === editingResource.id ? { ...r, ...updatedFields } : r))
      );
      setEditingResource(null);
    } catch (err: any) {
      setEditError(err.message || 'Failed to save changes.');
    } finally {
      setEditSaving(false);
    }
  };

  // Filtered lists for My Uploads
  const filteredMaterials = useMemo(() => {
    if (!searchQuery.trim()) return myResources;
    const q = searchQuery.toLowerCase();
    return myResources.filter(
      r =>
        r.title.toLowerCase().includes(q) ||
        r.courseCode.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
    );
  }, [myResources, searchQuery]);

  const filteredAnnouncements = useMemo(() => {
    if (!searchQuery.trim()) return myAnnouncements;
    const q = searchQuery.toLowerCase();
    return myAnnouncements.filter(
      a => a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)
    );
  }, [myAnnouncements, searchQuery]);

  return (
    <div className="min-h-screen bg-[#070D1A] text-[#E6ECFA] flex flex-col md:flex-row font-sans">
      
      {/* Mobile Top Header */}
      <header className="md:hidden bg-[#0A1224] border-b border-[#1F2C4C] p-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#121C36] border border-[#FFC700]/50 flex items-center justify-center text-[#FFC700]">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-display font-bold text-xs text-[#E6ECFA] block leading-tight">
              SOT Rep Desk<span className="text-[#FFC700]">.</span>
            </span>
            <span className="text-[10px] text-[#9AA8C7] truncate block max-w-[150px]">
              {repDepartment}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRepData}
            className="p-1.5 rounded-lg bg-[#121C36] border border-[#1F2C4C] text-[#9AA8C7]"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#FFC700]' : ''}`} />
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg bg-[#121C36] border border-[#1F2C4C] text-[#9AA8C7]"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Slim Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen w-64 bg-[#0A1224] border-r border-[#1F2C4C] flex flex-col justify-between p-3.5 transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="space-y-4">
          
          {/* Logo / Brand Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#1F2C4C]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#121C36] border border-[#FFC700]/60 flex items-center justify-center text-[#FFC700] shadow-[0_0_12px_rgba(255,199,0,0.15)]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="font-display font-bold text-sm text-[#E6ECFA] block leading-tight">
                  Course Rep<span className="text-[#FFC700]">.</span>
                </span>
                <span className="text-[10px] text-[#9AA8C7]">Department Liaison Desk</span>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1 text-[#9AA8C7] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Rep Department & Clearance Badge */}
          <div className="px-3 py-2.5 rounded-xl bg-[#0F1E36] border border-[#1F2C4C] text-[11px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-[#FFC700] uppercase tracking-wider">
                Assigned Department
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-[#2F52FF] text-white">
                REP
              </span>
            </div>
            <div className="text-xs font-bold text-[#E6ECFA] truncate" title={repDepartment}>
              {repDepartment}
            </div>
            <div className="text-[10px] text-[#9AA8C7] truncate" title={profile?.fullName || user?.email || ''}>
              {profile?.fullName || user?.email}
            </div>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1">
            {/* 1. Overview */}
            <button
              onClick={() => { setActiveTab('overview'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-[#FFC700]" />
              <span>Overview</span>
            </button>

            {/* 2. Upload Materials */}
            <button
              onClick={() => { setActiveTab('upload'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36]'
              }`}
            >
              <UploadCloud className="w-4 h-4 text-[#FFC700]" />
              <span>Upload Materials</span>
            </button>

            {/* 3. Post Announcement */}
            <button
              onClick={() => { setActiveTab('announcement'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'announcement'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36]'
              }`}
            >
              <Megaphone className="w-4 h-4 text-[#FFC700]" />
              <span>Post Announcement</span>
            </button>

            {/* 4. My Uploads */}
            <button
              onClick={() => { setActiveTab('my-uploads'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'my-uploads'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FolderOpen className="w-4 h-4 text-[#FFC700]" />
                <span>My Uploads</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#121C36] text-[#E6ECFA]">
                {myResources.length + myAnnouncements.length}
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom Sidebar Controls */}
        <div className="space-y-2 pt-3 border-t border-[#1F2C4C]">
          <PWAInstallRow compact className="mb-2" />
          
          {/* Back to Student Portal Link */}
          <button
            onClick={onNavigateStudentPortal}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold bg-[#0F1E36] hover:bg-[#152544] text-[#E6ECFA] border border-[#1F2C4C] hover:border-[#2F52FF] transition-all cursor-pointer group"
          >
            <span className="flex items-center gap-2">
              <ArrowLeft className="w-3.5 h-3.5 text-[#FFC700] group-hover:-translate-x-0.5 transition-transform" />
              <span>Student Pages</span>
            </span>
            <span className="text-[10px] text-[#9AA8C7]">&rarr;</span>
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full py-2.5 px-3 rounded-xl border border-rose-500/50 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 hover:border-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm group"
          >
            <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Main Rep Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Slim Top Bar (Desktop) */}
        <div className="hidden md:flex items-center justify-between px-6 py-3 bg-[#0A1224] border-b border-[#1F2C4C] sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-[#E6ECFA] uppercase tracking-wider">
              {activeTab === 'overview' && 'Course Rep Overview'}
              {activeTab === 'upload' && 'Upload Learning Materials'}
              {activeTab === 'announcement' && 'Post Department Announcement'}
              {activeTab === 'my-uploads' && 'My Published Uploads'}
            </span>
            <span className="text-xs text-[#9AA8C7]">•</span>
            <span className="text-xs text-[#FFC700] ">{repDepartment}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('upload')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2542D9] text-white font-bold text-xs shadow-[0_0_12px_rgba(47,82,255,0.4)] cursor-pointer transition-all"
            >
              <UploadCloud className="w-3.5 h-3.5 text-[#FFC700]" />
              <span>Upload</span>
            </button>

            <button
              onClick={fetchRepData}
              disabled={loading}
              className="p-1.5 rounded-lg bg-[#0F1E36] border border-[#1F2C4C] text-[#9AA8C7] hover:text-[#E6ECFA] cursor-pointer"
              title="Refresh Firestore Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#FFC700]' : ''}`} />
            </button>

            <button
              onClick={onNavigateStudentPortal}
              className="px-3 py-1 rounded-lg bg-[#0F1E36] border border-[#1F2C4C] hover:border-[#2F52FF] text-xs font-semibold text-[#E6ECFA] flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#FFC700]" />
              <span>Back to Student Portal</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 max-w-5xl w-full mx-auto space-y-6">
          
          {/* ======================================================== */}
          {/* VIEW 1: OVERVIEW                                         */}
          {/* ======================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Department Banner Card */}
              <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#0F1E36] to-[#121C36] border border-[#1E2E52] space-y-3 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#070D1A] border border-[#FFC700]/40 text-[10px] font-bold text-[#FFC700] uppercase tracking-wider">
                      <Sparkles className="w-3 h-3 text-[#FFC700]" />
                      <span>Official Department Liaison</span>
                    </div>
                    <h2 className="font-display font-bold text-xl sm:text-2xl text-[#E6ECFA]">
                      {repDepartment}
                    </h2>
                    <p className="text-xs text-[#9AA8C7] max-w-xl">
                      Welcome, <strong className="text-white">{profile?.fullName || user?.email}</strong>. As course rep, your published notes, lecture past questions, and departmental notices appear live to all students in {repDepartment}.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <button
                      onClick={() => setActiveTab('upload')}
                      className="px-3.5 py-2 rounded-xl bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] flex items-center gap-1.5 shadow-[0_0_12px_rgba(47,82,255,0.3)] cursor-pointer"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Upload Material</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('announcement')}
                      className="px-3.5 py-2 rounded-xl bg-[#070D1A] border border-[#FFC700]/50 text-[#FFC700] text-xs font-bold hover:bg-[#FFC700]/10 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Megaphone className="w-3.5 h-3.5" />
                      <span>Post Notice</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 3 Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* 1. Department Name */}
                <div className="p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52] space-y-1">
                  <div className="text-[10px] font-bold text-[#9AA8C7] uppercase tracking-wider flex items-center justify-between">
                    <span>Assigned Department</span>
                    <BookOpen className="w-3.5 h-3.5 text-[#FFC700]" />
                  </div>
                  <div className="text-base font-bold text-[#E6ECFA] truncate">
                    {repDepartment}
                  </div>
                  <div className="text-[10px] text-emerald-400  flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Authorized Course Rep
                  </div>
                </div>

                {/* 2. Materials Uploaded */}
                <div className="p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52] space-y-1">
                  <div className="text-[10px] font-bold text-[#9AA8C7] uppercase tracking-wider flex items-center justify-between">
                    <span>Materials Uploaded</span>
                    <FolderOpen className="w-3.5 h-3.5 text-[#2F52FF]" />
                  </div>
                  <div className="text-2xl font-display font-extrabold text-[#FFC700]">
                    {myResources.length}
                  </div>
                  <div className="text-[10px] text-[#9AA8C7]">
                    Published in "resources" collection
                  </div>
                </div>

                {/* 3. Announcements Posted */}
                <div className="p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52] space-y-1">
                  <div className="text-[10px] font-bold text-[#9AA8C7] uppercase tracking-wider flex items-center justify-between">
                    <span>Announcements Posted</span>
                    <Megaphone className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-2xl font-display font-extrabold text-[#E6ECFA]">
                    {myAnnouncements.length}
                  </div>
                  <div className="text-[10px] text-[#9AA8C7]">
                    Broadcast to {repDepartment} students
                  </div>
                </div>

              </div>

              {/* Recent Uploads Preview */}
              <div className="p-5 rounded-2xl bg-[#0F1E36] border border-[#1E2E52] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-sm text-[#E6ECFA] flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-[#FFC700]" />
                    <span>Recent Published Materials</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('my-uploads')}
                    className="text-xs text-[#2F52FF] hover:underline cursor-pointer"
                  >
                    View All ({myResources.length}) &rarr;
                  </button>
                </div>

                {myResources.length === 0 ? (
                  <div className="py-8 text-center text-[#9AA8C7] space-y-2">
                    <UploadCloud className="w-8 h-8 text-[#FFC700] mx-auto opacity-70" />
                    <p className="text-xs">No learning materials uploaded yet.</p>
                    <button
                      onClick={() => setActiveTab('upload')}
                      className="px-3.5 py-1.5 rounded-lg bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Upload First Note / Past Question</span>
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-[#1E2E52]">
                    {myResources.slice(0, 4).map(res => (
                      <div key={res.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className=" font-bold text-[#FFC700]">{res.courseCode}</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#070D1A] text-[#9AA8C7] border border-[#1E2E52]">
                              {res.category}
                            </span>
                            <span className="text-[10px] text-[#9AA8C7]">{res.level} • {res.semester}</span>
                          </div>
                          <div className="font-semibold text-[#E6ECFA] truncate mt-0.5">{res.title}</div>
                        </div>

                        <a
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-md bg-[#070D1A] border border-[#1E2E52] text-[#2F52FF] hover:border-[#2F52FF] flex items-center gap-1 text-[11px] shrink-0"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 2: UPLOAD MATERIALS                                 */}
          {/* ======================================================== */}
          {activeTab === 'upload' && (
            <div className="space-y-5">
              
              <div className="p-5 sm:p-6 rounded-2xl bg-[#0F1E36] border border-[#1E2E52] space-y-4">
                <div>
                  <h3 className="font-display font-bold text-base sm:text-lg text-[#E6ECFA] flex items-center gap-2">
                    <UploadCloud className="w-5 h-5 text-[#FFC700]" />
                    <span>Upload Learning Material</span>
                  </h3>
                  <p className="text-xs text-[#9AA8C7] mt-0.5">
                    Share digital lecture slides, past exams, assignment guidelines, or tutorial videos for your department.
                  </p>
                </div>

                {uploadSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-xs text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{uploadSuccess}</span>
                  </div>
                )}

                {uploadError && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  
                  {/* Department (Read Only / Locked) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#9AA8C7] uppercase tracking-wider flex items-center justify-between">
                      <span>Department (Locked to your profile)</span>
                      <span className="text-[10px] text-emerald-400 ">Verified Course Rep</span>
                    </label>
                    <input
                      type="text"
                      disabled
                      value={repDepartment}
                      className="w-full px-3 py-2 rounded-xl bg-[#070D1A]/80 border border-[#1E2E52] text-xs font-bold text-[#FFC700] cursor-not-allowed"
                    />
                  </div>

                  {/* Level & Semester Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Level Tabs */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#9AA8C7] uppercase tracking-wider block">
                        Academic Level
                      </label>
                      <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-[#070D1A] border border-[#1E2E52]">
                        {ACADEMIC_LEVELS.map(lvl => (
                          <button
                            type="button"
                            key={lvl}
                            onClick={() => setUploadLevel(lvl)}
                            className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                              uploadLevel === lvl
                                ? 'bg-[#2F52FF] text-white shadow-[0_0_10px_rgba(47,82,255,0.4)]'
                                : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Semester Toggle */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#9AA8C7] uppercase tracking-wider block">
                        Semester
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#070D1A] border border-[#1E2E52]">
                        {SEMESTERS.map(sem => (
                          <button
                            type="button"
                            key={sem}
                            onClick={() => setUploadSemester(sem)}
                            className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                              uploadSemester === sem
                                ? 'bg-[#FFC700] text-[#0A1224] shadow-[0_0_10px_rgba(255,199,0,0.3)]'
                                : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                            }`}
                          >
                            {sem}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Course Code & Category */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    
                    {/* Course Code */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#9AA8C7] uppercase tracking-wider block">
                        Course Code <span className="text-[10px] text-[#9AA8C7]/60 font-normal lowercase">(optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. COM 111 (or leave blank)"
                        value={uploadCourseCode}
                        onChange={(e) => setUploadCourseCode(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#FFC700]  font-bold focus:outline-none focus:border-[#2F52FF]"
                      />

                      {/* Course suggestions chips */}
                      {suggestedCourseCodes.length > 0 && (
                        <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-[#9AA8C7]">Suggest:</span>
                          {suggestedCourseCodes.slice(0, 4).map(sc => (
                            <button
                              type="button"
                              key={sc.code}
                              onClick={() => {
                                setUploadCourseCode(sc.code);
                                if (!uploadTitle) setUploadTitle(`${sc.code} ${sc.title}`);
                              }}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-[#070D1A] border border-[#1E2E52] text-[#E6ECFA] hover:border-[#FFC700] cursor-pointer"
                            >
                              {sc.code}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Category */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-bold text-[#9AA8C7] uppercase tracking-wider block">
                        Category
                      </label>
                      <select
                        value={uploadCategory}
                        onChange={(e) => setUploadCategory(e.target.value as ResourceCategory)}
                        className="w-full px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                      >
                        {RESOURCE_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                  </div>

                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#9AA8C7] uppercase tracking-wider block">
                      Material Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 2024 Past Questions with Solutions / Complete Lecture Slides"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                    />
                  </div>

                  {/* Resource Link (URL) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#9AA8C7] uppercase tracking-wider flex items-center justify-between">
                      <span>Resource Link (URL)</span>
                      <span className="text-[10px] text-[#9AA8C7]">Google Drive, YouTube, OneDrive, GitHub</span>
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://drive.google.com/file/d/... or https://youtube.com/..."
                      value={uploadUrl}
                      onChange={(e) => setUploadUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA]  focus:outline-none focus:border-[#2F52FF]"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#9AA8C7] uppercase tracking-wider block">
                      Optional Short Description / Instructions
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Add brief details for students, e.g. 'Covers Modules 1 through 4 for upcoming mid-semester assessment.'"
                      value={uploadDescription}
                      onChange={(e) => setUploadDescription(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={uploadSaving}
                      className="px-5 py-2.5 rounded-xl bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(47,82,255,0.4)] transition-all"
                    >
                      {uploadSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>Publish Material to Students</span>
                    </button>
                  </div>

                </form>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 3: POST ANNOUNCEMENT                                */}
          {/* ======================================================== */}
          {activeTab === 'announcement' && (
            <div className="space-y-5">
              
              <div className="p-5 sm:p-6 rounded-2xl bg-[#0F1E36] border border-[#1E2E52] space-y-4">
                <div>
                  <h3 className="font-display font-bold text-base sm:text-lg text-[#E6ECFA] flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-[#FFC700]" />
                    <span>Post Department Announcement</span>
                  </h3>
                  <p className="text-xs text-[#9AA8C7] mt-0.5">
                    Announce urgent class venue changes, lecture times, project deadlines, or exam reminders for <strong className="text-[#FFC700]">{repDepartment}</strong>.
                  </p>
                </div>

                {annSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-xs text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{annSuccess}</span>
                  </div>
                )}

                {annError && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{annError}</span>
                  </div>
                )}

                <form onSubmit={handleAnnouncementSubmit} className="space-y-4">
                  
                  {/* Target Audience (Locked to own department) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#9AA8C7] uppercase tracking-wider flex items-center justify-between">
                      <span>Broadcast Audience (Locked)</span>
                      <span className="text-[10px] text-[#FFC700]">Rep Security Rule Enforced</span>
                    </label>
                    <input
                      type="text"
                      disabled
                      value={`${repDepartment} Students Only`}
                      className="w-full px-3 py-2 rounded-xl bg-[#070D1A]/80 border border-[#1E2E52] text-xs font-bold text-[#FFC700] cursor-not-allowed"
                    />
                  </div>

                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#9AA8C7] uppercase tracking-wider block">
                      Announcement Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Urgent: COM 112 Lecture Hall Moved to LT2"
                      value={annTitle}
                      onChange={(e) => setAnnTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                    />
                  </div>

                  {/* Message Content */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#9AA8C7] uppercase tracking-wider block">
                      Announcement Message
                    </label>
                    <textarea
                      rows={5}
                      required
                      placeholder="Write your notice here. Provide time, venue, course code, lecturer guidance, or instructions for your classmates..."
                      value={annMessage}
                      onChange={(e) => setAnnMessage(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                    />
                  </div>

                  {/* Urgent Alert Checkbox */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="annUrgent"
                      checked={annUrgent}
                      onChange={(e) => setAnnUrgent(e.target.checked)}
                      className="w-4 h-4 rounded bg-[#070D1A] border-[#1E2E52] text-[#2F52FF] focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="annUrgent" className="text-xs text-[#E6ECFA] cursor-pointer">
                      Mark as <strong className="text-rose-400">Urgent Notice</strong> (Highlights badge for students)
                    </label>
                  </div>

                  {/* Submit */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={annSaving}
                      className="px-5 py-2.5 rounded-xl bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(255,199,0,0.3)] transition-all"
                    >
                      {annSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>Post Department Announcement</span>
                    </button>
                  </div>

                </form>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 4: MY UPLOADS                                       */}
          {/* ======================================================== */}
          {activeTab === 'my-uploads' && (
            <div className="space-y-5">
              
              {/* Header and Filter Row */}
              <div className="p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52] flex flex-col sm:flex-row items-center justify-between gap-3">
                
                {/* Sub-tab switcher: Materials vs Announcements */}
                <div className="flex items-center gap-1 bg-[#070D1A] p-1 rounded-lg border border-[#1E2E52] w-full sm:w-auto">
                  <button
                    onClick={() => setUploadsSubTab('materials')}
                    className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      uploadsSubTab === 'materials'
                        ? 'bg-[#2F52FF] text-white shadow-[0_0_10px_rgba(47,82,255,0.4)]'
                        : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                    }`}
                  >
                    Materials ({myResources.length})
                  </button>
                  <button
                    onClick={() => setUploadsSubTab('announcements')}
                    className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      uploadsSubTab === 'announcements'
                        ? 'bg-[#FFC700] text-[#0A1224] shadow-[0_0_10px_rgba(255,199,0,0.3)]'
                        : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                    }`}
                  >
                    Announcements ({myAnnouncements.length})
                  </button>
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Filter by title, code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/60 focus:outline-none focus:border-[#2F52FF]"
                  />
                  <Search className="w-3.5 h-3.5 text-[#9AA8C7] absolute left-2.5 top-2" />
                </div>

              </div>

              {/* Materials Table */}
              {uploadsSubTab === 'materials' && (
                <div className="rounded-xl bg-[#0F1E36] border border-[#1E2E52] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#070D1A] text-[#9AA8C7] uppercase font-bold tracking-wider border-b border-[#1E2E52]">
                        <tr>
                          <th className="py-2.5 px-3.5">Course</th>
                          <th className="py-2.5 px-3.5">Title & Resource URL</th>
                          <th className="py-2.5 px-3.5">Level / Semester</th>
                          <th className="py-2.5 px-3.5">Category</th>
                          <th className="py-2.5 px-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E2E52]">
                        {filteredMaterials.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-10 text-center text-[#9AA8C7]">
                              <div className="space-y-2">
                                <FolderOpen className="w-7 h-7 text-[#FFC700] mx-auto opacity-70" />
                                <div className="text-sm font-semibold text-[#E6ECFA]">No materials found</div>
                                <p className="text-[11px]">You haven't uploaded any resources yet or search returned 0 items.</p>
                                <button
                                  onClick={() => setActiveTab('upload')}
                                  className="px-3 py-1.5 rounded-lg bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] cursor-pointer inline-flex items-center gap-1.5"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Upload New Material</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredMaterials.map(item => (
                            <tr key={item.id} className="hover:bg-[#070D1A]/50 transition-colors">
                              <td className="py-2.5 px-3.5  font-bold text-[#FFC700]">
                                {item.courseCode}
                              </td>
                              <td className="py-2.5 px-3.5">
                                <div className="font-semibold text-[#E6ECFA]">{item.title}</div>
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-[#2F52FF] hover:underline  truncate max-w-xs block mt-0.5"
                                >
                                  {item.url}
                                </a>
                              </td>
                              <td className="py-2.5 px-3.5 text-[#E6ECFA]">
                                <span className="font-bold">{item.level}</span> • <span className="text-[#9AA8C7]">{item.semester}</span>
                              </td>
                              <td className="py-2.5 px-3.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#070D1A] text-[#FFC700] border border-[#1E2E52]">
                                  {item.category}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 text-right space-x-1.5">
                                <button
                                  onClick={() => handleOpenEditResource(item)}
                                  className="p-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-[#9AA8C7] hover:text-[#FFC700] cursor-pointer"
                                  title="Edit material"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteResource(item.id, item.title)}
                                  className="p-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-[#9AA8C7] hover:text-rose-400 cursor-pointer"
                                  title="Delete material"
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
              )}

              {/* Announcements Table */}
              {uploadsSubTab === 'announcements' && (
                <div className="rounded-xl bg-[#0F1E36] border border-[#1E2E52] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#070D1A] text-[#9AA8C7] uppercase font-bold tracking-wider border-b border-[#1E2E52]">
                        <tr>
                          <th className="py-2.5 px-3.5">Date</th>
                          <th className="py-2.5 px-3.5">Title & Message</th>
                          <th className="py-2.5 px-3.5">Department</th>
                          <th className="py-2.5 px-3.5">Type</th>
                          <th className="py-2.5 px-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E2E52]">
                        {filteredAnnouncements.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-10 text-center text-[#9AA8C7]">
                              <div className="space-y-2">
                                <Megaphone className="w-7 h-7 text-[#FFC700] mx-auto opacity-70" />
                                <div className="text-sm font-semibold text-[#E6ECFA]">No announcements found</div>
                                <p className="text-[11px]">You haven't posted any announcements yet.</p>
                                <button
                                  onClick={() => setActiveTab('announcement')}
                                  className="px-3 py-1.5 rounded-lg bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] cursor-pointer inline-flex items-center gap-1.5"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Post Notice</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredAnnouncements.map(ann => (
                            <tr key={ann.id} className="hover:bg-[#070D1A]/50 transition-colors">
                              <td className="py-2.5 px-3.5  text-[10px] text-[#9AA8C7] whitespace-nowrap">
                                {new Date(ann.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-2.5 px-3.5 max-w-sm">
                                <div className="font-semibold text-[#E6ECFA] flex items-center gap-2">
                                  <span>{ann.title}</span>
                                  {ann.urgent && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-600 text-white">
                                      URGENT
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[#9AA8C7] line-clamp-1 mt-0.5">
                                  {ann.content}
                                </div>
                              </td>
                              <td className="py-2.5 px-3.5 text-[#FFC700] font-semibold">
                                {ann.department}
                              </td>
                              <td className="py-2.5 px-3.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#121C36] text-[#60A5FA] border border-[#2F52FF]/30">
                                  {ann.category}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 text-right">
                                <button
                                  onClick={() => handleDeleteAnnouncement(ann.id, ann.title)}
                                  className="p-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-[#9AA8C7] hover:text-rose-400 cursor-pointer"
                                  title="Delete announcement"
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
              )}

            </div>
          )}

        </div>

      </main>

      {/* ======================================================== */}
      {/* EDIT MATERIAL MODAL                                      */}
      {/* ======================================================== */}
      {editingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#0A1224] border border-[#1F2C4C] rounded-2xl p-5 sm:p-6 space-y-4 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between pb-3 border-b border-[#1F2C4C]">
              <div>
                <h3 className="font-display font-bold text-sm text-[#E6ECFA] flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-[#FFC700]" />
                  <span>Edit Material: {editingResource.courseCode}</span>
                </h3>
                <span className="text-[11px] text-[#9AA8C7]">
                  {editingResource.department} • {editingResource.level}
                </span>
              </div>
              <button
                onClick={() => setEditingResource(null)}
                className="p-1 rounded-lg text-[#9AA8C7] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-500/50 text-xs text-rose-200">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEditResource} className="space-y-3.5">
              
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#9AA8C7] uppercase tracking-wider block">
                  Material Title
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#9AA8C7] uppercase tracking-wider block">
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as ResourceCategory)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none"
                >
                  {RESOURCE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#9AA8C7] uppercase tracking-wider block">
                  Resource URL
                </label>
                <input
                  type="url"
                  required
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA]  focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#9AA8C7] uppercase tracking-wider block">
                  Short Description
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#1F2C4C]">
                <button
                  type="button"
                  onClick={() => setEditingResource(null)}
                  className="px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#9AA8C7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-1.5 rounded-lg bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] cursor-pointer flex items-center gap-1.5"
                >
                  {editSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Small Confirmation Sheet: "Log out of SOT?" */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-[#070D1A]/80 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-2xl bg-[#0E1A38] border border-[#24315A] shadow-[0_10px_40px_rgba(0,0,0,0.6)] p-5 space-y-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-[#E6ECFA]">
                  Log out of SOT?
                </h3>
                <p className="text-xs text-[#9AA8C7]">
                  Your session and chat history on this device will be cleared.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full py-2.5 px-4 rounded-xl border border-[#24315A] bg-[#121C36] hover:bg-[#1A2E63] text-[#E6ECFA] font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-[0_0_15px_rgba(225,29,72,0.3)]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
