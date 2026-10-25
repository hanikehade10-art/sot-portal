import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { DEPARTMENTS, INITIAL_ANNOUNCEMENTS } from '../data/departments';
import { DepartmentIcon } from './PublicLanding';
import { auth, db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, addDoc, query, where } from 'firebase/firestore';
import { AnnouncementItem, ContactMessage, TimetableEntry, CourseItem, CourseMaterial, ResourceItem } from '../types';
import { INITIAL_COURSES, INITIAL_TIMETABLES, normalizeCourseLevel, normalizeCourseSemester } from '../data/coursesAndTimetables';
import { AskAiView } from './AskAiView';
import {
  LayoutDashboard,
  Building2,
  Bell,
  User,
  LogOut,
  GraduationCap,
  Menu,
  X,
  ShieldCheck,
  Calendar,
  Lock,
  QrCode,
  FileText,
  KeyRound,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Sparkles,
  AlertCircle,
  Clock,
  ShieldAlert,
  RefreshCw,
  MessageSquare,
  Send,
  Layers,
  Megaphone,
  CheckCircle,
  Eye,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  FolderOpen
} from 'lucide-react';
import { SITE_CONFIG } from '../config/site';

interface StudentDashboardProps {
  onNavigateHome: () => void;
  onNavigateContact: () => void;
  onNavigateAdmin?: () => void;
  onNavigateRep?: () => void;
}

type TabType =
  | 'overview'
  | 'department'
  | 'courses'
  | 'timetables'
  | 'announcements'
  | 'my-messages'
  | 'rep-announcement'
  | 'ask-ai'
  | 'profile';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ACADEMIC_LEVELS = ['ND I', 'ND II', 'HND I', 'HND II'];

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  onNavigateHome,
  onNavigateContact,
  onNavigateAdmin,
  onNavigateRep
}) => {
  const { user, profile, isAdmin, roleReadError, refreshProfile, logout, updateStudentProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Department uploaded resources from Course Reps
  const [deptResources, setDeptResources] = useState<ResourceItem[]>([]);

  // Profile edit states (Full Name and Password only; matric is locked)
  const [editFullName, setEditFullName] = useState(profile?.fullName || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Live Announcements
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(INITIAL_ANNOUNCEMENTS);
  const [annFilter, setAnnFilter] = useState('All');

  // Timetables
  const [timetables, setTimetables] = useState<TimetableEntry[]>(INITIAL_TIMETABLES);
  const [ttLevelFilter, setTtLevelFilter] = useState<string>('All');
  const [ttTypeTab, setTtTypeTab] = useState<'class' | 'exam'>('class');

  // Department Courses for Student's own department
  const [courses, setCourses] = useState<CourseItem[]>(INITIAL_COURSES);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseLevel, setCourseLevel] = useState<'ND1' | 'ND2' | 'HND1' | 'HND2'>('ND1');
  const [courseSemester, setCourseSemester] = useState<'First Semester' | 'Second Semester'>('First Semester');
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [courseSearchQuery, setCourseSearchQuery] = useState('');

  // Student's tracked messages (Complaints / Enquiries / Reviews)
  const [myMessages, setMyMessages] = useState<ContactMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Course Rep Announcement Posting Form
  const [repTitle, setRepTitle] = useState('');
  const [repContent, setRepContent] = useState('');
  const [repCategory, setRepCategory] = useState<'Academic' | 'Student Notice' | 'Department' | 'General'>('Department');
  const [repUrgent, setRepUrgent] = useState(false);
  const [repPosting, setRepPosting] = useState(false);
  const [repSuccess, setRepSuccess] = useState<string | null>(null);
  const [repError, setRepError] = useState<string | null>(null);

  const isRep = profile?.role === 'rep';
  const studentDept = profile?.department || 'Computer Technology';

  useEffect(() => {
    if (profile?.fullName) {
      setEditFullName(profile.fullName);
    }
  }, [profile]);

  // Fetch announcements
  const fetchAnnouncements = async () => {
    try {
      const snap = await getDocs(collection(db, 'announcements'));
      if (!snap.empty) {
        const list: AnnouncementItem[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() } as AnnouncementItem);
        });
        setAnnouncements(list);
      }
    } catch (err) {
      // fallback to INITIAL_ANNOUNCEMENTS
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // Fetch Timetables for student's department
  useEffect(() => {
    const fetchTimetables = async () => {
      try {
        const q = query(collection(db, 'timetables'), where('department', '==', studentDept));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const list: TimetableEntry[] = [];
          snap.forEach(d => {
            list.push({ id: d.id, ...d.data() } as TimetableEntry);
          });
          setTimetables(list);
        } else {
          const defaults = INITIAL_TIMETABLES.filter(t => t.department === studentDept);
          setTimetables(defaults.length > 0 ? defaults : INITIAL_TIMETABLES);
        }
      } catch (err) {
        const defaults = INITIAL_TIMETABLES.filter(t => t.department === studentDept);
        setTimetables(defaults.length > 0 ? defaults : INITIAL_TIMETABLES);
      }
    };

    fetchTimetables();
  }, [studentDept]);

  // Fetch Courses for student's department
  useEffect(() => {
    const fetchCourses = async () => {
      setLoadingCourses(true);
      try {
        const q = query(collection(db, 'courses'), where('department', '==', studentDept));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const list: CourseItem[] = [];
          snap.forEach(d => {
            const data = d.data();
            list.push({
              id: d.id,
              department: data.department || studentDept,
              code: data.code || '',
              title: data.title || '',
              level: data.level || 'ND1',
              semester: data.semester || 'First Semester',
              units: typeof data.units === 'number' ? data.units : 3,
              type: data.type === 'Elective' ? 'Elective' : 'Core',
              description: data.description || '',
              materials: Array.isArray(data.materials) ? data.materials : [],
              createdAt: data.createdAt,
              updatedAt: data.updatedAt
            } as CourseItem);
          });
          setCourses(list);
        } else {
          const defaults = INITIAL_COURSES.filter(c => c.department === studentDept);
          setCourses(defaults.length > 0 ? defaults : INITIAL_COURSES);
        }
      } catch (err) {
        const defaults = INITIAL_COURSES.filter(c => c.department === studentDept);
        setCourses(defaults.length > 0 ? defaults : INITIAL_COURSES);
      } finally {
        setLoadingCourses(false);
      }
    };

    fetchCourses();
  }, [studentDept]);

  // Fetch materials uploaded to "resources" collection for this department
  useEffect(() => {
    const fetchResources = async () => {
      try {
        const q = query(collection(db, 'resources'), where('department', '==', studentDept));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as ResourceItem[];
          setDeptResources(list);
        } else {
          setDeptResources([]);
        }
      } catch (err) {
        console.warn('Student resources fetch notice:', err);
      }
    };

    fetchResources();
  }, [studentDept]);

  // Filtered courses for student's active level & semester
  const studentFilteredCourses = courses.filter(c => {
    const matchDept = c.department === studentDept;
    const matchLevel = normalizeCourseLevel(c.level) === courseLevel;
    const matchSem = normalizeCourseSemester(c.semester) === courseSemester;
    if (!matchDept || !matchLevel || !matchSem) return false;
    if (courseSearchQuery.trim()) {
      const q = courseSearchQuery.toLowerCase();
      return c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q);
    }
    return true;
  });

  // Filtered rep materials for student's active level & semester
  const studentFilteredResources = deptResources.filter(r => {
    const matchDept = r.department === studentDept;
    const matchLevel = normalizeCourseLevel(r.level) === courseLevel;
    const matchSem = normalizeCourseSemester(r.semester) === courseSemester;
    if (!matchDept || !matchLevel || !matchSem) return false;
    if (courseSearchQuery.trim()) {
      const q = courseSearchQuery.toLowerCase();
      return (
        r.courseCode.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Fetch student's own messages
  const fetchMyMessages = async () => {
    if (!user?.uid) return;
    setLoadingMessages(true);
    try {
      const msgs: ContactMessage[] = [];
      try {
        const q = query(collection(db, 'messages'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        snap.forEach(d => {
          msgs.push({ id: d.id, ...d.data() } as ContactMessage);
        });
      } catch (e) {
        // Query might be denied if no index, fall back to local
      }

      // Check local storage for messages with this user id or email
      const localMsgs = JSON.parse(localStorage.getItem('sot_local_messages') || '[]');
      const userLocalMsgs = localMsgs.filter((m: any) =>
        m.userId === user.uid || m.uid === user.uid || (m.email && user.email && m.email.toLowerCase() === user.email.toLowerCase())
      );

      const combined = [...msgs, ...userLocalMsgs];
      const unique = Array.from(new Map(combined.map(m => [m.id, m])).values());
      // Sort newest first
      unique.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setMyMessages(unique);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'my-messages') {
      fetchMyMessages();
    }
  }, [activeTab, user?.uid]);

  // Filter announcements for student (matches 'All' or student's department)
  const relevantAnnouncements = announcements.filter(a => {
    const matchDept = a.department === 'All' || a.department === profile?.department;
    const matchCategory = annFilter === 'All' || a.category === annFilter;
    return matchDept && matchCategory;
  });

  // Calculate unread announcements count
  const lastSeenIso = profile?.lastSeenAnnouncements;
  const lastSeenMs = lastSeenIso ? new Date(lastSeenIso).getTime() : 0;
  const unreadAnnouncementsCount = announcements.filter(a => {
    const matchDept = a.department === 'All' || a.department === profile?.department;
    const annTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    return matchDept && annTime > lastSeenMs;
  }).length;

  // Mark announcements as seen
  const markAnnouncementsSeen = async () => {
    const nowIso = new Date().toISOString();
    if (auth.currentUser) {
      try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          lastSeenAnnouncements: nowIso
        });
      } catch (err) {
        // ignore
      }
    }
    if (profile) {
      const updated = { ...profile, lastSeenAnnouncements: nowIso };
      localStorage.setItem('sot_local_profile', JSON.stringify(updated));
    }
  };

  const handleOpenAnnouncements = () => {
    setActiveTab('announcements');
    setSidebarOpen(false);
    markAnnouncementsSeen();
  };

  const studentDepartment = DEPARTMENTS.find((d) => d.name === profile?.department) || DEPARTMENTS[1];

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (newPassword && newPassword.length < 8) {
      setProfileError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setProfileError('New password and confirmation do not match.');
      return;
    }

    setProfileSaving(true);
    try {
      await updateStudentProfile(editFullName, newPassword || undefined);
      setProfileSuccess('Profile records updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: any) {
      setProfileError(err.message || 'Could not update profile information.');
    } finally {
      setProfileSaving(false);
    }
  };

  // Course Rep Announcement Submit
  const handleRepPostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setRepError(null);
    setRepSuccess(null);

    if (!repTitle.trim() || !repContent.trim()) {
      setRepError('Please provide both announcement title and bulletin details.');
      return;
    }

    setRepPosting(true);
    const newAnn: Omit<AnnouncementItem, 'id'> = {
      title: repTitle.trim(),
      content: repContent.trim(),
      category: repCategory,
      department: studentDept, // STRICTLY LOCKED to own department
      urgent: repUrgent,
      author: `${profile?.fullName || 'Student'} (Course Rep)`,
      createdAt: new Date().toISOString()
    };

    try {
      try {
        const docRef = await addDoc(collection(db, 'announcements'), newAnn);
        setAnnouncements(prev => [{ id: docRef.id, ...newAnn }, ...prev]);
      } catch (err: any) {
        console.warn('Firestore announcement save note:', err);
        // Fallback local
        const localAnn = { id: 'ann_' + Date.now(), ...newAnn };
        setAnnouncements(prev => [localAnn, ...prev]);
      }

      setRepSuccess(`Announcement broadcast successfully to all students in ${studentDept}!`);
      setRepTitle('');
      setRepContent('');
      setRepUrgent(false);
      setTimeout(() => setRepSuccess(null), 4000);
      fetchAnnouncements();
    } catch (err: any) {
      setRepError(err?.message || 'Failed to publish announcement.');
    } finally {
      setRepPosting(false);
    }
  };

  // Filtered Timetable entries for student's department
  const relevantTimetables = timetables.filter(t => {
    const matchDept = t.department === studentDept;
    const matchType = t.type === ttTypeTab;
    const matchLevel = ttLevelFilter === 'All' || t.level === ttLevelFilter;
    return matchDept && matchType && matchLevel;
  });

  return (
    <div className="min-h-screen bg-[#0A1224] text-[#E6ECFA] flex flex-col md:flex-row">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between h-16 px-4 bg-[#0A1224] border-b border-[#24315A] sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#121C36] border border-[#24315A] flex items-center justify-center text-[#FFC700]">
            <GraduationCap className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-sm text-[#E6ECFA]">
            SOT Student Desk
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Bell Icon with Unread Count */}
          <button
            onClick={handleOpenAnnouncements}
            title="Announcements"
            className="relative p-2 rounded-lg bg-[#121C36] border border-[#24315A] text-[#9AA8C7] hover:text-[#FFC700] cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {unreadAnnouncementsCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-bold text-[10px] animate-pulse">
                {unreadAnnouncementsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg bg-[#121C36] border border-[#24315A] text-[#9AA8C7]"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen w-72 bg-[#0A1224] border-r border-[#24315A] flex flex-col justify-between p-5 transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="space-y-5 overflow-y-auto pr-1">
          <div className="flex items-center justify-between pb-3 border-b border-[#24315A]">
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-3 text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-[#121C36] border border-[#24315A] flex items-center justify-center text-[#FFC700] group-hover:border-[#2F52FF] transition-colors">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <span className="font-display font-bold text-lg text-[#E6ECFA] block leading-tight">
                  SOT<span className="text-[#FFC700]">.</span>
                </span>
                <span className="text-[10px] text-[#9AA8C7]">{SITE_CONFIG.tagline}</span>
              </div>
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1 rounded-lg text-[#9AA8C7]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Student / Rep / Admin Status Card */}
          <div className="p-3.5 rounded-xl bg-[#121C36] border border-[#24315A]">
            <div className="text-[10px] font-bold text-[#FFC700] uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>
                {isAdmin ? 'Administrator' : isRep ? 'Course Representative' : 'Student Account'}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                isAdmin ? 'bg-[#FFC700] text-[#0A1224]' : isRep ? 'bg-[#2F52FF] text-white' : 'bg-[#0A1224] text-[#9AA8C7]'
              }`}>
                {profile?.role || 'student'}
              </span>
            </div>
            <div className="text-xs font-semibold text-[#E6ECFA] truncate">
              {profile?.fullName || user?.email}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono text-[#9AA8C7]">
              <span className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-[#FFC700]' : isRep ? 'bg-[#2F52FF]' : 'bg-emerald-400'}`} />
              <span>{isAdmin ? 'CLEARANCE: ADMIN' : (profile?.matricNumber || 'MATRIC PENDING')}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => { setActiveTab('overview'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-[#FFC700]" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => { setActiveTab('department'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'department'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
              }`}
            >
              <Building2 className="w-4 h-4 text-[#FFC700]" />
              <span>My Department</span>
            </button>

            {/* Courses Tab */}
            <button
              onClick={() => { setActiveTab('courses'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'courses'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
              }`}
            >
              <div className="flex items-center gap-3">
                <BookOpen className="w-4 h-4 text-[#FFC700]" />
                <span>Courses</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#121C36] text-[#9AA8C7] border border-[#24315A]">
                {courses.length}
              </span>
            </button>

            {/* Timetables Tab (NEW) */}
            <button
              onClick={() => { setActiveTab('timetables'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'timetables'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
              }`}
            >
              <Calendar className="w-4 h-4 text-[#FFC700]" />
              <span>Timetables</span>
            </button>

            {/* Announcements Tab with unread counter */}
            <button
              onClick={handleOpenAnnouncements}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'announcements'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
              }`}
            >
              <Bell className="w-4 h-4 text-[#FFC700]" />
              <div className="flex-1 flex items-center justify-between">
                <span>Announcements</span>
                {unreadAnnouncementsCount > 0 ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-600 text-white font-extrabold animate-pulse">
                    {unreadAnnouncementsCount} new
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#121C36] text-[#9AA8C7] border border-[#24315A]">
                    {relevantAnnouncements.length}
                  </span>
                )}
              </div>
            </button>

            {/* Complaint Tracking / My Messages Tab (NEW) */}
            <button
              onClick={() => { setActiveTab('my-messages'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'my-messages'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-[#FFC700]" />
              <span>My Messages</span>
            </button>

            {/* Course Rep Announcement Post Tab (ONLY visible if role === 'rep') */}
            {isRep && (
              <button
                onClick={() => { setActiveTab('rep-announcement'); setSidebarOpen(false); }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer border ${
                  activeTab === 'rep-announcement'
                    ? 'bg-gradient-to-r from-[#2F52FF] to-[#1E3AB8] text-white border-[#FFC700] shadow-[0_0_15px_rgba(255,199,0,0.3)]'
                    : 'bg-[#121C36]/80 text-[#FFC700] border-[#FFC700]/40 hover:bg-[#121C36]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Megaphone className="w-4 h-4 text-[#FFC700]" />
                  <span>Post Announcement</span>
                </div>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#FFC700] text-[#0A1224]">
                  Rep
                </span>
              </button>
            )}

            {/* Ask AI Sidebar Page Link */}
            <button
              onClick={() => { setActiveTab('ask-ai'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'ask-ai'
                  ? 'bg-gradient-to-r from-[#2F52FF] to-[#1E3AB8] text-white shadow-[0_0_20px_rgba(47,82,255,0.45)] border border-[#FFC700]/50'
                  : 'text-[#E6ECFA] hover:text-white hover:bg-[#121C36]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-[#FFC700]" />
                <span>Ask AI</span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFC700] text-[#0A1224]">
                TUTOR
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('profile'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
              }`}
            >
              <User className="w-4 h-4 text-[#FFC700]" />
              <span>Profile Settings</span>
            </button>

            {/* Course Rep Desk Sidebar Navigation Link (Reps Only - reps NEVER see admin link) */}
            {isRep && (
              <button
                onClick={() => {
                  if (onNavigateRep) {
                    onNavigateRep();
                  } else {
                    window.location.href = '/rep';
                  }
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer bg-gradient-to-r from-[#2F52FF]/25 to-[#121C36] border border-[#FFC700]/50 text-[#FFC700] hover:bg-[#2F52FF]/35 hover:shadow-[0_0_15px_rgba(255,199,0,0.25)] group"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-[#FFC700] group-hover:scale-110 transition-transform" />
                  <span>Course Rep Desk</span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#FFC700] text-[#0A1224]">
                  Rep
                </span>
              </button>
            )}

            {/* Admin Dashboard Sidebar Navigation Link (Admins Only) */}
            {isAdmin && (
              <button
                onClick={() => {
                  if (onNavigateAdmin) {
                    onNavigateAdmin();
                  } else {
                    window.location.href = '/admin';
                  }
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer bg-gradient-to-r from-[#2F52FF]/20 to-[#FFC700]/15 border border-[#FFC700]/50 text-[#FFC700] hover:bg-[#FFC700]/20 hover:border-[#FFC700] hover:shadow-[0_0_15px_rgba(255,199,0,0.25)] group"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-[#FFC700] group-hover:scale-110 transition-transform" />
                  <span>Admin Dashboard</span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#FFC700] text-[#0A1224]">
                  Admin
                </span>
              </button>
            )}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="space-y-1.5 pt-3 border-t border-[#24315A]">
          <button
            onClick={onNavigateContact}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36] cursor-pointer"
          >
            <span>Student Helpdesk Form</span>
          </button>
          <button
            onClick={onNavigateHome}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36] cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#FFC700]" />
            <span>Public Site</span>
          </button>
          <button
            onClick={() => { logout(); onNavigateHome(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-950/20 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-[#0A1224]/80 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Main Content Workspace */}
      <main className="flex-1 min-w-0 p-5 sm:p-8 lg:p-10 space-y-8 overflow-y-auto">
        
        {/* Visible Role Read Error Banner if role couldn't be read */}
        {roleReadError && (
          <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-500/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-rose-100 font-semibold block text-sm">
                  Failed to Read User Role from Firestore
                </strong>
                <p className="font-mono text-[11px] text-rose-300 mt-0.5 break-all">
                  {roleReadError}
                </p>
              </div>
            </div>
            <button
              onClick={() => refreshProfile()}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shrink-0 cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Reading Role</span>
            </button>
          </div>
        )}
        
        {/* TOP BAR WITH NOTIFICATION BELL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#24315A]">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#9AA8C7]">
              <span>School of Technology</span>
              <span>/</span>
              <span className="text-[#FFC700] font-semibold capitalize">
                {activeTab === 'rep-announcement' ? 'Course Rep Announcement' : activeTab === 'my-messages' ? 'Complaint & Message Tracking' : activeTab}
              </span>
            </div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#E6ECFA] mt-1">
              {activeTab === 'overview' && 'Student Portal Overview'}
              {activeTab === 'department' && 'My Enrolled Department'}
              {activeTab === 'courses' && 'Department Courses & Learning Materials'}
              {activeTab === 'timetables' && 'Department Timetables & Exam Schedules'}
              {activeTab === 'announcements' && 'Student Bulletins & Notices'}
              {activeTab === 'my-messages' && 'My Complaints & Message Tracking'}
              {activeTab === 'rep-announcement' && 'Course Representative Bulletin Desk'}
              {activeTab === 'ask-ai' && 'Ask AI: Academic Tutor & Portal Assistant'}
              {activeTab === 'profile' && 'Student Profile Settings'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* ANNOUNCEMENT NOTIFICATIONS BELL ICON */}
            <button
              onClick={handleOpenAnnouncements}
              title={`Announcements (${unreadAnnouncementsCount} unread)`}
              className="relative p-2.5 rounded-xl bg-[#121C36] border border-[#24315A] text-[#9AA8C7] hover:text-[#FFC700] hover:border-[#2F52FF] transition-all cursor-pointer group shadow-[0_0_15px_rgba(0,0,0,0.2)]"
            >
              <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
              {unreadAnnouncementsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-rose-600 text-white font-extrabold text-[10px] shadow-[0_0_10px_rgba(225,29,72,0.8)] border border-[#0A1224] animate-bounce">
                  {unreadAnnouncementsCount}
                </span>
              )}
            </button>

            <div className="px-3.5 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs font-medium text-[#E6ECFA] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{isRep ? 'Course Rep Clearance' : 'Student Verified Session'}</span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* VIEW 1: OVERVIEW                                         */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            
            {/* Student Profile Welcome Card */}
            <div className="relative p-6 sm:p-8 rounded-2xl bg-[#121C36] border border-[#24315A] shadow-[0_0_30px_rgba(47,82,255,0.1)] overflow-hidden">
              <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                
                <div className="space-y-3 max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A1224] border border-[#24315A] text-xs font-semibold text-[#FFC700]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#FFC700]" />
                    <span>{isRep ? 'Designated Department Course Representative' : 'Verified Registered Student'}</span>
                  </div>

                  <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-[#E6ECFA]">
                    Welcome, <span className="text-[#FFC700] break-all">{profile?.fullName || user?.email}</span>
                  </h2>

                  <p className="text-sm text-[#9AA8C7] leading-relaxed">
                    Access your departmental lecture timetables, exam lists, track your submitted helpdesk complaints, and consult the AI Study Helper.
                  </p>

                  <div className="pt-2 flex flex-wrap items-center gap-3 text-xs">
                    <div className="px-3.5 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA]">
                      <span className="text-[#9AA8C7] mr-1.5">Department:</span>
                      <strong className="text-[#FFC700]">{profile?.department || 'Unassigned'}</strong>
                    </div>

                    <div className="px-3.5 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] font-mono text-[#E6ECFA]">
                      <span className="text-[#9AA8C7] mr-1.5">Matric No:</span>
                      <strong className="text-[#2F52FF]">{profile?.matricNumber || 'PENDING'}</strong>
                    </div>

                    {isRep && (
                      <div className="px-3.5 py-1.5 rounded-lg bg-[#2F52FF]/20 border border-[#2F52FF] text-[#E6ECFA] font-bold">
                        Role: <span className="text-[#FFC700]">Course Representative</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Digital Student Card Preview */}
                <div className="w-full lg:w-72 p-5 rounded-xl bg-[#0A1224] border border-[#24315A] shadow-inner space-y-4 shrink-0">
                  <div className="flex items-center justify-between border-b border-[#24315A]/70 pb-3">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-[#FFC700]" />
                      <span className="font-display font-bold text-xs tracking-wider text-[#E6ECFA]">
                        {isRep ? 'REP PASS' : 'STUDENT PASS'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                      ACTIVE
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-semibold text-[#9AA8C7]">Matriculation Code</div>
                    <div className="font-mono text-sm font-bold text-[#FFC700] tracking-wider">
                      {profile?.matricNumber}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-semibold text-[#9AA8C7]">Department</div>
                    <div className="text-xs font-semibold text-[#E6ECFA]">
                      {profile?.department}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              
              {/* Courses Card */}
              <div className="p-5 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700]">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h3 className="font-display font-bold text-base text-[#E6ECFA]">
                    Department Courses
                  </h3>
                  <p className="text-xs text-[#9AA8C7] leading-relaxed">
                    Check curriculum units, syllabus outlines, and access lecture notes and past questions for {studentDept}.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('courses')}
                  className="py-2.5 px-4 rounded-xl bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] transition-all cursor-pointer"
                >
                  Explore Courses &rarr;
                </button>
              </div>
              
              {/* Timetables Card */}
              <div className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700]">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h3 className="font-display font-bold text-lg text-[#E6ECFA]">
                    Department Timetable
                  </h3>
                  <p className="text-xs text-[#9AA8C7] leading-relaxed">
                    Check your lecture hours, laboratory venues, and upcoming examination dates for {studentDept}.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('timetables')}
                  className="py-2.5 px-4 rounded-xl bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] transition-all cursor-pointer"
                >
                  View Weekly Schedule &rarr;
                </button>
              </div>

              {/* Announcements Card */}
              <div className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700]">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-lg text-[#E6ECFA]">
                      Announcements
                    </h3>
                    {unreadAnnouncementsCount > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white">
                        {unreadAnnouncementsCount} unread
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#9AA8C7] leading-relaxed">
                    Faculty bulletins, class notices, and urgent departmental alerts for {studentDept}.
                  </p>
                </div>
                <button
                  onClick={handleOpenAnnouncements}
                  className="py-2.5 px-4 rounded-xl bg-[#0A1224] border border-[#24315A] text-[#FFC700] text-xs font-bold hover:border-[#FFC700] transition-all cursor-pointer"
                >
                  Read Bulletins &rarr;
                </button>
              </div>

              {/* Complaint Tracking Card */}
              <div className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700]">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <h3 className="font-display font-bold text-lg text-[#E6ECFA]">
                    My Complaints & Enquiries
                  </h3>
                  <p className="text-xs text-[#9AA8C7] leading-relaxed">
                    Track complaints or enquiries you submitted to the student desk, and view official admin replies.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('my-messages')}
                  className="py-2.5 px-4 rounded-xl bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] text-xs font-bold hover:border-[#2F52FF] transition-all cursor-pointer"
                >
                  Track My Messages &rarr;
                </button>
              </div>

            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: MY DEPARTMENT                                    */}
        {/* ======================================================== */}
        {activeTab === 'department' && (
          <div className="space-y-6">
            <div className="p-7 sm:p-8 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700]">
                  <DepartmentIcon name={studentDepartment.iconName} className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
                    {studentDepartment.shortCode}
                  </span>
                  <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-[#E6ECFA] mt-1">
                    {studentDepartment.name}
                  </h2>
                </div>
              </div>

              <p className="text-base text-[#E6ECFA] leading-relaxed max-w-3xl">
                {studentDepartment.oneLiner}
              </p>

              <p className="text-sm text-[#9AA8C7] leading-relaxed max-w-3xl">
                {studentDepartment.description}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4">
                <h3 className="text-sm font-bold text-[#FFC700] uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  <span>Program Focus Areas</span>
                </h3>
                <div className="space-y-2.5">
                  {studentDepartment.programFocus.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded bg-[#121C36] text-[#FFC700] font-bold flex items-center justify-center text-[11px]">
                        {idx + 1}
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4">
                <h3 className="text-sm font-bold text-[#FFC700] uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Career Pathways</span>
                </h3>
                <div className="space-y-2.5">
                  {studentDepartment.careerProspects.map((cp, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#2F52FF] shrink-0" />
                      <span>{cp}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW: DEPARTMENT COURSES & MATERIALS                     */}
        {/* ======================================================== */}
        {activeTab === 'courses' && (
          <div className="space-y-6">
            
            {/* Header and Controls */}
            <div className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#0A1224] border border-[#24315A] text-xs font-semibold text-[#FFC700] mb-1">
                    <BookOpen className="w-3.5 h-3.5 text-[#FFC700]" />
                    <span>Department Curriculum</span>
                  </div>
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-[#E6ECFA]">
                    {studentDept} Courses
                  </h2>
                  <p className="text-xs text-[#9AA8C7] mt-0.5">
                    Curriculum outline and digital study materials exclusively for students of {studentDept}.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Level Picker (ND1, ND2, HND1, HND2) */}
                  <div className="flex items-center gap-1 bg-[#0A1224] p-1 rounded-xl border border-[#24315A]">
                    {(['ND1', 'ND2', 'HND1', 'HND2'] as const).map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => { setCourseLevel(lvl); setExpandedCourseId(null); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          courseLevel === lvl
                            ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.4)]'
                            : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>

                  {/* Semester Toggle (First / Second) */}
                  <div className="flex items-center gap-1 bg-[#0A1224] p-1 rounded-xl border border-[#24315A]">
                    {(['First Semester', 'Second Semester'] as const).map(sem => (
                      <button
                        key={sem}
                        onClick={() => { setCourseSemester(sem); setExpandedCourseId(null); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          courseSemester === sem
                            ? 'bg-[#FFC700] text-[#0A1224] shadow-[0_0_12px_rgba(255,199,0,0.3)]'
                            : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                        }`}
                      >
                        {sem === 'First Semester' ? 'First Semester' : 'Second Semester'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Search within filtered courses */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#24315A]">
                <div className="relative w-full sm:w-80">
                  <input
                    type="text"
                    placeholder="Search courses by code or title..."
                    value={courseSearchQuery}
                    onChange={(e) => setCourseSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/60 focus:outline-none focus:border-[#2F52FF]"
                  />
                  <Search className="w-4 h-4 text-[#9AA8C7] absolute left-3 top-2.5" />
                </div>

                <div className="text-xs text-[#9AA8C7] font-mono">
                  Showing <strong className="text-[#FFC700]">{studentFilteredCourses.length}</strong> {studentFilteredCourses.length === 1 ? 'course' : 'courses'} for {courseLevel} • {courseSemester}
                </div>
              </div>
            </div>

            {/* Courses List */}
            {loadingCourses ? (
              <div className="p-12 text-center text-xs text-[#9AA8C7] bg-[#121C36] rounded-2xl border border-[#24315A]">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#FFC700] mb-2" />
                <span>Loading your department courses...</span>
              </div>
            ) : studentFilteredCourses.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-[#121C36] border border-[#24315A] text-[#9AA8C7] space-y-2">
                <BookOpen className="w-10 h-10 text-[#FFC700] mx-auto opacity-70" />
                <h3 className="font-display font-bold text-base text-[#E6ECFA]">No Courses Listed Yet</h3>
                <p className="text-xs max-w-md mx-auto">
                  No courses are currently published for {studentDept} ({courseLevel} - {courseSemester}). Check back shortly or contact your Course Representative.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {studentFilteredCourses.map(course => {
                  const isExpanded = expandedCourseId === course.id;
                  const materialsCount = course.materials ? course.materials.length : 0;

                  return (
                    <div
                      key={course.id}
                      className="rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF]/60 transition-all overflow-hidden"
                    >
                      {/* Course Row Header (Tappable) */}
                      <button
                        type="button"
                        onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                        className="w-full p-5 sm:p-6 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer focus:outline-none group"
                      >
                        <div className="space-y-1.5 flex-1 pr-4">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-[#0A1224] text-[#FFC700] border border-[#24315A] group-hover:border-[#FFC700]/60 transition-colors">
                              {course.code}
                            </span>
                            <span className="text-xs font-mono font-bold text-[#9AA8C7]">
                              {course.units} {course.units === 1 ? 'Unit' : 'Units'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              course.type === 'Core'
                                ? 'bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/40'
                                : 'bg-[#0A1224] text-[#9AA8C7] border border-[#24315A]'
                            }`}>
                              {course.type}
                            </span>
                            {materialsCount > 0 && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                                {materialsCount} {materialsCount === 1 ? 'resource' : 'resources'}
                              </span>
                            )}
                          </div>

                          <h3 className="font-display font-bold text-base sm:text-lg text-[#E6ECFA] group-hover:text-white transition-colors">
                            {course.title}
                          </h3>

                          {course.description && !isExpanded && (
                            <p className="text-xs text-[#9AA8C7] line-clamp-1">
                              {course.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                          <span className="text-xs font-semibold text-[#2F52FF] group-hover:text-[#60A5FA] flex items-center gap-1">
                            <span>{isExpanded ? 'Hide Details' : 'View Materials'}</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </span>
                        </div>
                      </button>

                      {/* Course Expanded Details & Learning Materials */}
                      {isExpanded && (
                        <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-1 border-t border-[#24315A]/60 space-y-4 bg-[#0A1224]/40">
                          
                          {/* Syllabus Description */}
                          {course.description && (
                            <div className="space-y-1">
                              <span className="text-[11px] font-bold text-[#FFC700] uppercase tracking-wider block">
                                Course Outline & Summary
                              </span>
                              <p className="text-xs sm:text-sm text-[#E6ECFA] leading-relaxed whitespace-pre-wrap p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A]">
                                {course.description}
                              </p>
                            </div>
                          )}

                          {/* Learning Materials Section */}
                          <div className="space-y-2.5">
                            <span className="text-[11px] font-bold text-[#FFC700] uppercase tracking-wider block">
                              Digital Learning Materials ({materialsCount})
                            </span>

                            {materialsCount === 0 ? (
                              <div className="p-4 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#9AA8C7] italic">
                                No lecture notes, past questions, or video tutorials uploaded yet for this course.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {course.materials!.map((mat, idx) => (
                                  <a
                                    key={mat.id || idx}
                                    href={mat.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A] hover:border-[#2F52FF] transition-all flex items-start justify-between gap-3 group/link cursor-pointer"
                                  >
                                    <div className="space-y-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                          mat.category === 'Lecture Note'
                                            ? 'bg-blue-950 text-blue-300 border border-blue-500/30'
                                            : mat.category === 'Past Question'
                                            ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                                            : mat.category === 'Video'
                                            ? 'bg-purple-950 text-purple-300 border border-purple-500/30'
                                            : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                        }`}>
                                          {mat.category}
                                        </span>
                                      </div>
                                      <h4 className="font-semibold text-xs text-[#E6ECFA] group-hover/link:text-[#FFC700] transition-colors truncate">
                                        {mat.title}
                                      </h4>
                                      <span className="text-[10px] text-[#9AA8C7] block truncate font-mono">
                                        {mat.url}
                                      </span>
                                    </div>

                                    <div className="p-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-[#9AA8C7] group-hover/link:text-[#FFC700] group-hover/link:border-[#FFC700]/50 shrink-0 mt-1">
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </div>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Course Rep Uploaded Materials for this Course */}
                          {(() => {
                            const matchingRepResources = studentFilteredResources.filter(
                              r => r.courseCode.toUpperCase() === course.code.toUpperCase()
                            );
                            if (matchingRepResources.length === 0) return null;
                            return (
                              <div className="space-y-2.5 pt-3 border-t border-[#24315A]/60">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-[#FFC700] uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-[#FFC700]" />
                                    <span>Course Rep Uploads for {course.code} ({matchingRepResources.length})</span>
                                  </span>
                                  <span className="text-[10px] text-[#9AA8C7]">
                                    Verified Department Materials
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {matchingRepResources.map((res) => (
                                    <a
                                      key={res.id}
                                      href={res.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-3.5 rounded-xl bg-[#0A1224] border border-[#2F52FF]/50 hover:border-[#FFC700] transition-all flex items-start justify-between gap-3 group/link cursor-pointer shadow-[0_0_12px_rgba(47,82,255,0.15)]"
                                    >
                                      <div className="space-y-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#FFC700] text-[#0A1224]">
                                            Course Rep
                                          </span>
                                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#121C36] text-[#60A5FA] border border-[#2F52FF]/30">
                                            {res.category}
                                          </span>
                                          <span className="text-[10px] text-[#9AA8C7] font-mono">
                                            {new Date(res.createdAt).toLocaleDateString()}
                                          </span>
                                        </div>
                                        <h4 className="font-semibold text-xs text-[#E6ECFA] group-hover/link:text-[#FFC700] transition-colors truncate">
                                          {res.title}
                                        </h4>
                                        {res.description && (
                                          <p className="text-[11px] text-[#9AA8C7] line-clamp-1">
                                            {res.description}
                                          </p>
                                        )}
                                        <span className="text-[10px] text-[#2F52FF] block truncate font-mono">
                                          {res.url}
                                        </span>
                                      </div>
                                      <div className="p-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-[#FFC700] shrink-0 mt-1">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}

            {/* Course Rep Materials Card for this Level and Semester */}
            <div className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#24315A]">
                <div>
                  <h3 className="font-display font-bold text-base text-[#E6ECFA] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#FFC700]" />
                    <span>Course Rep Study Materials ({courseLevel} • {courseSemester})</span>
                  </h3>
                  <p className="text-xs text-[#9AA8C7] mt-0.5">
                    Lecture notes, past questions, and assignment guides uploaded by your departmental Course Representative.
                  </p>
                </div>
                <span className="text-xs font-mono text-[#FFC700] font-bold">
                  {studentFilteredResources.length} {studentFilteredResources.length === 1 ? 'upload' : 'uploads'}
                </span>
              </div>

              {studentFilteredResources.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#9AA8C7] italic">
                  No materials uploaded yet by Course Reps for {courseLevel} - {courseSemester}.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {studentFilteredResources.map(res => (
                    <a
                      key={res.id}
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 rounded-xl bg-[#0A1224] border border-[#24315A] hover:border-[#2F52FF] transition-all flex items-start justify-between gap-3 group cursor-pointer"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#121C36] text-[#FFC700] border border-[#FFC700]/30">
                            {res.courseCode}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#FFC700] text-[#0A1224]">
                            Course Rep
                          </span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#121C36] text-[#60A5FA] border border-[#2F52FF]/30">
                            {res.category}
                          </span>
                          <span className="text-[10px] text-[#9AA8C7] font-mono">
                            {new Date(res.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="font-semibold text-xs sm:text-sm text-[#E6ECFA] group-hover:text-[#FFC700] transition-colors truncate">
                          {res.title}
                        </h4>
                        {res.description && (
                          <p className="text-xs text-[#9AA8C7] line-clamp-1">
                            {res.description}
                          </p>
                        )}
                        <span className="text-[10px] text-[#2F52FF] hover:underline block truncate font-mono">
                          {res.url}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-[#121C36] border border-[#24315A] text-[#9AA8C7] group-hover:text-[#FFC700] group-hover:border-[#FFC700]/50 shrink-0 mt-1">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: TIMETABLES (Classes & Exams for own department)  */}
        {/* ======================================================== */}
        {activeTab === 'timetables' && (
          <div className="space-y-6">
            
            {/* Header and Controls */}
            <div className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-[#FFC700] uppercase tracking-wider block">
                  Department Schedule
                </span>
                <h2 className="font-display font-bold text-xl text-[#E6ECFA] mt-0.5">
                  {studentDept} Timetable
                </h2>
                <p className="text-xs text-[#9AA8C7] mt-0.5">
                  Filtered exclusively for students of {studentDept}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Schedule Type Switcher */}
                <div className="bg-[#0A1224] p-1 rounded-xl border border-[#24315A] flex items-center">
                  <button
                    onClick={() => setTtTypeTab('class')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      ttTypeTab === 'class'
                        ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.4)]'
                        : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                    }`}
                  >
                    Weekly Classes
                  </button>
                  <button
                    onClick={() => setTtTypeTab('exam')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      ttTypeTab === 'exam'
                        ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.4)]'
                        : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                    }`}
                  >
                    Exam Timetable
                  </button>
                </div>

                {/* Level Filter */}
                <div className="flex items-center gap-1 bg-[#0A1224] p-1 rounded-xl border border-[#24315A]">
                  <button
                    onClick={() => setTtLevelFilter('All')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      ttLevelFilter === 'All' ? 'bg-[#121C36] text-[#FFC700]' : 'text-[#9AA8C7]'
                    }`}
                  >
                    All Levels
                  </button>
                  {ACADEMIC_LEVELS.map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => setTtLevelFilter(lvl)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                        ttLevelFilter === lvl ? 'bg-[#121C36] text-[#FFC700]' : 'text-[#9AA8C7]'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Timetable Content */}
            {ttTypeTab === 'class' ? (
              // Weekly Class Timetable grouped by Day
              <div className="space-y-6">
                {DAYS_OF_WEEK.map(day => {
                  const dayEntries = relevantTimetables.filter(t => t.day === day);
                  if (dayEntries.length === 0) return null;

                  return (
                    <div key={day} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-md bg-[#2F52FF]" />
                        <h3 className="font-display font-bold text-base text-[#E6ECFA]">
                          {day}
                        </h3>
                        <span className="text-xs text-[#9AA8C7]">({dayEntries.length} lectures)</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {dayEntries.map(entry => (
                          <div
                            key={entry.id}
                            className="p-4 rounded-xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] transition-colors space-y-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
                                {entry.courseCode}
                              </span>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#0A1224] text-[#9AA8C7] border border-[#24315A]">
                                {entry.level}
                              </span>
                            </div>

                            <div className="space-y-1 text-xs">
                              <div className="flex items-center gap-2 text-[#E6ECFA] font-semibold">
                                <Clock className="w-3.5 h-3.5 text-[#2F52FF]" />
                                <span>{entry.startTime} – {entry.endTime}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[#9AA8C7]">
                                <Building2 className="w-3.5 h-3.5 text-[#FFC700]" />
                                <span>Venue: <strong className="text-[#E6ECFA]">{entry.venue}</strong></span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {relevantTimetables.length === 0 && (
                  <div className="p-12 text-center rounded-2xl bg-[#121C36] border border-[#24315A] text-[#9AA8C7]">
                    No class timetable entries found for {studentDept} ({ttLevelFilter}).
                  </div>
                )}
              </div>
            ) : (
              // Exam Timetable List
              <div className="space-y-4">
                {relevantTimetables.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-[#121C36] border border-[#24315A] text-[#9AA8C7]">
                    No examination timetable scheduled yet for {studentDept} ({ttLevelFilter}).
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {relevantTimetables.map(entry => (
                      <div
                        key={entry.id}
                        className="p-5 rounded-2xl bg-[#121C36] border border-[#FFC700]/30 shadow-[0_0_20px_rgba(255,199,0,0.06)] space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-1 rounded bg-[#0A1224] text-[#FFC700] font-mono text-xs font-bold border border-[#24315A]">
                            {entry.courseCode}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40 text-[10px] font-extrabold uppercase">
                            Examination
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                          <div className="p-2.5 rounded-lg bg-[#0A1224] border border-[#24315A]">
                            <span className="text-[#9AA8C7] block text-[10px] uppercase font-bold">Exam Date &amp; Day</span>
                            <span className="text-[#E6ECFA] font-semibold">{entry.date || entry.day}</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-[#0A1224] border border-[#24315A]">
                            <span className="text-[#9AA8C7] block text-[10px] uppercase font-bold">Duration</span>
                            <span className="text-[#E6ECFA] font-semibold">{entry.startTime} – {entry.endTime}</span>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs flex items-center justify-between">
                          <span className="text-[#9AA8C7]">Assigned Examination Hall:</span>
                          <strong className="text-[#FFC700]">{entry.venue}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 4: ANNOUNCEMENTS                                    */}
        {/* ======================================================== */}
        {activeTab === 'announcements' && (
          <div className="space-y-6">
            
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {['All', 'Academic', 'Student Notice', 'Department', 'General'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setAnnFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      annFilter === cat
                        ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                        : 'bg-[#121C36] text-[#9AA8C7] border border-[#24315A]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <span className="text-xs text-[#9AA8C7]">
                Targeted for: <strong className="text-[#FFC700]">{profile?.department}</strong> &amp; All Students
              </span>
            </div>

            <div className="space-y-4">
              {relevantAnnouncements.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-[#121C36] border border-[#24315A] text-[#9AA8C7]">
                  No announcements found for this filter.
                </div>
              ) : (
                relevantAnnouncements.map((ann) => {
                  const isUnread = ann.createdAt && new Date(ann.createdAt).getTime() > lastSeenMs;
                  return (
                    <div
                      key={ann.id}
                      className={`p-6 rounded-2xl bg-[#121C36] border space-y-3 transition-colors ${
                        isUnread ? 'border-[#FFC700] shadow-[0_0_20px_rgba(255,199,0,0.15)]' : 'border-[#24315A] hover:border-[#2F52FF]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                            ann.urgent ? 'bg-rose-950 text-rose-300 border border-rose-500/40' : 'bg-[#0A1224] text-[#FFC700] border border-[#24315A]'
                          }`}>
                            {ann.category} {ann.urgent && '• URGENT'}
                          </span>
                          {isUnread && (
                            <span className="px-2 py-0.5 rounded-full bg-[#FFC700] text-[#0A1224] text-[10px] font-extrabold uppercase">
                              New
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-[#9AA8C7]">
                          {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : ''}
                        </span>
                      </div>

                      <h3 className="font-display font-bold text-lg text-[#E6ECFA]">
                        {ann.title}
                      </h3>

                      <p className="text-sm text-[#9AA8C7] leading-relaxed whitespace-pre-wrap">
                        {ann.content}
                      </p>

                      <div className="text-[11px] text-[#9AA8C7] pt-2 border-t border-[#24315A]/60 flex items-center justify-between">
                        <span>Broadcast by: <strong className="text-[#E6ECFA]">{ann.author || 'Student Administration'}</strong></span>
                        <span className="font-mono text-[#FFC700]">Audience: {ann.department}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 5: MY MESSAGES & COMPLAINT TRACKING                 */}
        {/* ======================================================== */}
        {activeTab === 'my-messages' && (
          <div className="space-y-6">
            
            <div className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-[#FFC700] uppercase tracking-wider block">
                  Support Desk
                </span>
                <h2 className="font-display font-bold text-xl text-[#E6ECFA] mt-0.5">
                  My Complaints &amp; Enquiries
                </h2>
                <p className="text-xs text-[#9AA8C7] mt-0.5">
                  Track the real-time status and administrator replies to tickets submitted from the contact desk.
                </p>
              </div>

              <button
                onClick={onNavigateContact}
                className="px-4 py-2.5 rounded-xl bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(47,82,255,0.3)] shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit New Ticket</span>
              </button>
            </div>

            {loadingMessages ? (
              <div className="p-12 text-center text-xs text-[#9AA8C7] animate-pulse">
                Loading your submitted messages...
              </div>
            ) : myMessages.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-[#121C36] border border-[#24315A] space-y-3">
                <MessageSquare className="w-10 h-10 text-[#FFC700] mx-auto opacity-60" />
                <h3 className="font-display font-bold text-base text-[#E6ECFA]">
                  No Submitted Messages Yet
                </h3>
                <p className="text-xs text-[#9AA8C7] max-w-sm mx-auto">
                  Whenever you submit a Complaint, Enquiry, or Review from the Contact page while logged in, you can track its progress and read administrator replies here.
                </p>
                <button
                  onClick={onNavigateContact}
                  className="mt-2 px-5 py-2 rounded-xl bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] cursor-pointer"
                >
                  Go to Contact Desk
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myMessages.map(msg => (
                  <div
                    key={msg.id}
                    className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4 shadow-[0_0_20px_rgba(0,0,0,0.2)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#24315A] pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                          msg.type === 'Complaint' ? 'bg-rose-950 text-rose-300 border border-rose-500/40' :
                          msg.type === 'Enquiry' ? 'bg-blue-950 text-blue-300 border border-blue-500/40' :
                          'bg-amber-950 text-amber-300 border border-amber-500/40'
                        }`}>
                          {msg.type}
                        </span>

                        {/* Status Badge */}
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                          msg.status === 'Resolved' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' :
                          msg.status === 'Read' ? 'bg-sky-950 text-sky-300 border border-sky-500/40' :
                          'bg-amber-950 text-amber-300 border border-amber-500/40'
                        }`}>
                          {msg.status === 'Resolved' ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> :
                           msg.status === 'Read' ? <Eye className="w-3.5 h-3.5 text-sky-400" /> :
                           <Clock className="w-3.5 h-3.5 text-amber-400" />}
                          <span>Status: {msg.status}</span>
                        </span>
                      </div>

                      <span className="text-xs font-mono text-[#9AA8C7]">
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}
                      </span>
                    </div>

                    {/* Student's Original Message */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#9AA8C7]">
                        Your Submission:
                      </div>
                      <p className="text-xs sm:text-sm text-[#E6ECFA] leading-relaxed whitespace-pre-wrap bg-[#0A1224] p-3.5 rounded-xl border border-[#24315A]">
                        {msg.message}
                      </p>
                    </div>

                    {/* Admin Reply Section */}
                    {msg.adminReply ? (
                      <div className="p-4 rounded-xl bg-gradient-to-r from-[#2F52FF]/15 to-[#FFC700]/10 border border-[#FFC700]/50 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-[#FFC700]">
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-[#FFC700]" />
                            <span>Administrator Response</span>
                          </span>
                          {msg.repliedAt && (
                            <span className="text-[11px] font-mono text-[#9AA8C7]">
                              {new Date(msg.repliedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-[#E6ECFA] leading-relaxed whitespace-pre-wrap">
                          {msg.adminReply}
                        </p>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-[#0A1224]/60 border border-[#24315A] text-xs text-[#9AA8C7] flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Awaiting administrator response. Your ticket is currently queued with the student desk committee.</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 6: POST ANNOUNCEMENT (COURSE REPS ONLY)             */}
        {/* ======================================================== */}
        {activeTab === 'rep-announcement' && isRep && (
          <div className="space-y-6 max-w-3xl">
            
            <div className="p-6 rounded-2xl bg-gradient-to-r from-[#121C36] to-[#1E3AB8]/30 border border-[#FFC700]/40 space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFC700] text-[#0A1224] text-[10px] font-extrabold uppercase">
                <Megaphone className="w-3.5 h-3.5" />
                <span>Department Representative Privilege</span>
              </div>
              <h2 className="font-display font-bold text-2xl text-[#E6ECFA]">
                Broadcast Announcement for {studentDept}
              </h2>
              <p className="text-xs text-[#9AA8C7]">
                As an accredited Course Representative, announcements you submit here will be broadcast exclusively to all students in <strong>{studentDept}</strong>.
              </p>
            </div>

            {repError && (
              <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/60 text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{repError}</span>
              </div>
            )}

            {repSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/60 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{repSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRepPostAnnouncement} className="p-7 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-5">
              
              {/* Department Lock Notice */}
              <div>
                <label className="block text-xs font-semibold text-[#9AA8C7] mb-1.5">
                  Target Department (Locked by Clearance)
                </label>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[#0A1224] border border-[#24315A] text-sm text-[#FFC700] font-semibold">
                  <Lock className="w-4 h-4 text-[#FFC700]" />
                  <span>{studentDept}</span>
                  <span className="text-[10px] text-[#9AA8C7] ml-auto font-normal font-mono">Department Locked</span>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-[#9AA8C7] mb-1.5">
                  Announcement Title *
                </label>
                <input
                  type="text"
                  required
                  value={repTitle}
                  onChange={(e) => setRepTitle(e.target.value)}
                  placeholder="e.g. Rescheduled Lab Session for ND II COM212"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0A1224] border border-[#24315A] text-sm text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              {/* Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#9AA8C7] mb-1.5">
                    Category *
                  </label>
                  <select
                    value={repCategory}
                    onChange={(e: any) => setRepCategory(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs font-semibold text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  >
                    <option value="Department">Department</option>
                    <option value="Academic">Academic</option>
                    <option value="Student Notice">Student Notice</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-[#E6ECFA]">
                    <input
                      type="checkbox"
                      checked={repUrgent}
                      onChange={(e) => setRepUrgent(e.target.checked)}
                      className="w-4 h-4 rounded text-[#2F52FF] focus:ring-0 bg-[#0A1224] border-[#24315A]"
                    />
                    <span className="text-rose-400">Mark as Urgent Notice</span>
                  </label>
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-semibold text-[#9AA8C7] mb-1.5">
                  Notice Details / Message *
                </label>
                <textarea
                  required
                  rows={6}
                  value={repContent}
                  onChange={(e) => setRepContent(e.target.value)}
                  placeholder="Type the full announcement details here. Be clear about dates, venue changes, or lecturer instructions..."
                  className="w-full px-4 py-3 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs sm:text-sm text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF] leading-relaxed"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={repPosting}
                  className="px-7 py-3 rounded-xl bg-[#FFC700] text-[#0A1224] font-extrabold text-xs hover:bg-[#ffd233] transition-all cursor-pointer shadow-[0_0_20px_rgba(255,199,0,0.3)] disabled:opacity-50 flex items-center gap-2"
                >
                  <Megaphone className="w-4 h-4" />
                  <span>{repPosting ? 'Publishing Notice...' : 'Publish to Department'}</span>
                </button>
              </div>
            </form>

          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 7: PROFILE SETTINGS                                 */}
        {/* ======================================================== */}
        {activeTab === 'profile' && (
          <div className="space-y-6 max-w-2xl">
            
            <div className="p-7 sm:p-8 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-6">
              
              <div className="flex items-center justify-between border-b border-[#24315A] pb-4">
                <div>
                  <h3 className="font-display font-bold text-xl text-[#E6ECFA]">
                    Student Profile Settings
                  </h3>
                  <p className="text-xs text-[#9AA8C7]">
                    You can update your display name and password. Matric numbers cannot be modified.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                  Verified
                </span>
              </div>

              {profileError && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              {profileSuccess && (
                <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/50 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              <form onSubmit={handleProfileSave} className="space-y-5">
                
                {/* Email (Read-only) */}
                <div>
                  <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">
                    Registered Email (Read-Only)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={profile?.email || user?.email || ''}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-sm text-[#9AA8C7] cursor-not-allowed opacity-80"
                  />
                </div>

                {/* Matric Number (Permanently Locked / Immutable as required) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#9AA8C7]">
                      Matriculation Number (Permanent)
                    </label>
                    <span className="text-[10px] font-mono text-[#FFC700] px-2 py-0.5 rounded bg-[#0A1224] border border-[#24315A]">
                      Locked &amp; Immutable
                    </span>
                  </div>
                  <input
                    type="text"
                    disabled
                    value={profile?.matricNumber || 'NOT ASSIGNED'}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-sm font-mono font-bold text-[#FFC700] cursor-not-allowed opacity-80"
                  />
                  <p className="text-[11px] text-[#9AA8C7] mt-1">
                    Matric numbers are unique and cannot be updated once saved. Contact the student desk if your record contains an error.
                  </p>
                </div>

                {/* Department (Read-only) */}
                <div>
                  <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">
                    Enrolled Department
                  </label>
                  <input
                    type="text"
                    disabled
                    value={profile?.department || 'Unassigned'}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-sm text-[#E6ECFA] cursor-not-allowed opacity-80"
                  />
                </div>

                {/* Full Name (Editable) */}
                <div>
                  <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">
                    Student Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    placeholder="Enter your official full name"
                    className="w-full px-4 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-sm text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>

                {/* Password Change (Optional) */}
                <div className="pt-2 border-t border-[#24315A] space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFC700]">
                    Change Account Password (Optional)
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                        New Password (min 8 chars)
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Leave blank to keep current"
                        className="w-full px-3.5 py-2 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full px-3.5 py-2 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#FFC700] text-[#0A1224] hover:bg-[#ffd233] transition-all cursor-pointer shadow-[0_0_15px_rgba(255,199,0,0.2)] disabled:opacity-50"
                  >
                    {profileSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                  </button>
                </div>
              </form>

            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 8: ASK AI (Full Page Workspace)                    */}
        {/* ======================================================== */}
        {activeTab === 'ask-ai' && (
          <AskAiView />
        )}

      </main>

    </div>
  );
};
