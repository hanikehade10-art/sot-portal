import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, sanitizeMatricId } from '../context/AuthContext';
import { db } from '../lib/firebase';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import {
  UserProfile,
  ContactMessage,
  AnnouncementItem,
  FaqItem,
  CourseItem,
  TimetableEntry,
  AcademicLevel
} from '../types';
import { SOT_DEPARTMENTS_LIST, INITIAL_ANNOUNCEMENTS } from '../data/departments';
import { INITIAL_COURSES, INITIAL_TIMETABLES } from '../data/coursesAndTimetables';
import {
  ShieldAlert,
  Users,
  MessageSquare,
  Bell,
  BarChart3,
  Search,
  Filter,
  Download,
  Trash2,
  Ban,
  CheckCircle,
  Mail,
  Plus,
  Edit2,
  X,
  Menu,
  LogOut,
  GraduationCap,
  Sparkles,
  AlertTriangle,
  Send,
  Eye,
  RefreshCw,
  Home,
  Bot,
  HelpCircle,
  BookOpen,
  Calendar,
  Clock,
  Award,
  Check,
  CheckSquare
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigateHome: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateHome }) => {
  const { user, profile, isAdmin, roleReadError, refreshProfile, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'messages' | 'announcements' | 'courses' | 'timetables' | 'faqs'>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data states
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(INITIAL_ANNOUNCEMENTS);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>(INITIAL_COURSES);
  const [timetables, setTimetables] = useState<TimetableEntry[]>(INITIAL_TIMETABLES);
  const [loading, setLoading] = useState(true);

  // Message reply drafts
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replySuccessMessage, setReplySuccessMessage] = useState<string | null>(null);

  // Course management states
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseDept, setCourseDept] = useState(SOT_DEPARTMENTS_LIST[0]);
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseLevel, setCourseLevel] = useState<AcademicLevel>('ND I');
  const [courseSemester, setCourseSemester] = useState<'1st Semester' | '2nd Semester'>('1st Semester');
  const [courseSearch, setCourseSearch] = useState('');
  const [courseDeptFilter, setCourseDeptFilter] = useState('All');
  const [courseLevelFilter, setCourseLevelFilter] = useState('All');

  // Timetable management states
  const [showTtModal, setShowTtModal] = useState(false);
  const [editingTtId, setEditingTtId] = useState<string | null>(null);
  const [ttDept, setTtDept] = useState(SOT_DEPARTMENTS_LIST[0]);
  const [ttLevel, setTtLevel] = useState<AcademicLevel>('ND I');
  const [ttDay, setTtDay] = useState('Monday');
  const [ttStartTime, setTtStartTime] = useState('08:00 AM');
  const [ttEndTime, setTtEndTime] = useState('10:00 AM');
  const [ttCourseCode, setTtCourseCode] = useState('');
  const [ttVenue, setTtVenue] = useState('Hall 1');
  const [ttType, setTtType] = useState<'class' | 'exam'>('class');
  const [ttDeptFilter, setTtDeptFilter] = useState('All');
  const [ttLevelFilter, setTtLevelFilter] = useState('All');
  const [ttTypeFilter, setTtTypeFilter] = useState<'All' | 'class' | 'exam'>('All');

  // FAQ modal & form
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');

  // Student filtering & search
  const [studentSearch, setStudentSearch] = useState('');
  const [studentDeptFilter, setStudentDeptFilter] = useState('All');

  // Message filtering
  const [messageTypeFilter, setMessageTypeFilter] = useState<string>('All');

  // Announcement modal / form
  const [showAnnModal, setShowAnnModal] = useState(false);
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annCategory, setAnnCategory] = useState<'Academic' | 'Student Notice' | 'Department' | 'General'>('General');
  const [annDepartment, setAnnDepartment] = useState('All');
  const [annUrgent, setAnnUrgent] = useState(false);

  // Load live data from Firestore (or fallback to local test records)
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Students
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        if (!usersSnap.empty) {
          const list: UserProfile[] = [];
          usersSnap.forEach(d => {
            const data = d.data() as UserProfile;
            list.push({ ...data, uid: d.id });
          });
          setStudents(list);
        } else {
          // If Firestore collection empty, check local test registry
          const localProfileRaw = localStorage.getItem('sot_local_profile');
          if (localProfileRaw) {
            setStudents([JSON.parse(localProfileRaw)]);
          } else if (profile) {
            setStudents([profile]);
          }
        }
      } catch (err) {
        console.warn('Admin user list note:', err);
        if (profile) setStudents([profile]);
      }

      // 2. Fetch Messages
      try {
        const msgSnap = await getDocs(collection(db, 'messages'));
        const msgList: ContactMessage[] = [];
        msgSnap.forEach(d => {
          msgList.push({ id: d.id, ...d.data() } as ContactMessage);
        });
        // Check local messages
        const localMsgs = JSON.parse(localStorage.getItem('sot_local_messages') || '[]');
        const combined = [...msgList, ...localMsgs];
        // Deduplicate
        const unique = Array.from(new Map(combined.map(m => [m.id, m])).values());
        setMessages(unique);
      } catch (err) {
        const localMsgs = JSON.parse(localStorage.getItem('sot_local_messages') || '[]');
        setMessages(localMsgs);
      }

      // 3. Fetch Announcements
      try {
        const annSnap = await getDocs(collection(db, 'announcements'));
        if (!annSnap.empty) {
          const annList: AnnouncementItem[] = [];
          annSnap.forEach(d => {
            annList.push({ id: d.id, ...d.data() } as AnnouncementItem);
          });
          setAnnouncements(annList);
        }
      } catch (err) {
        console.warn('Announcements fetch note:', err);
      }

      // 4. Fetch FAQs (Chatbot Knowledge Base)
      try {
        const faqSnap = await getDocs(collection(db, 'faqs'));
        const faqList: FaqItem[] = [];
        faqSnap.forEach(d => {
          faqList.push({ id: d.id, ...d.data() } as FaqItem);
        });
        setFaqs(faqList);
      } catch (err) {
        console.warn('FAQs fetch note:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Strict route guard check
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0A1224] text-[#E6ECFA] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-950/40 border border-rose-500/50 flex items-center justify-center text-rose-400 mb-4 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="font-display font-bold text-3xl mb-2">Restricted Access</h2>
        <p className="text-[#9AA8C7] max-w-md mb-4 text-sm">
          The Admin Portal is reserved strictly for designated student administrators. Your current account does not hold administrative clearance.
        </p>

        {roleReadError ? (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/70 border border-rose-500/60 text-xs text-rose-200 text-left max-w-md w-full space-y-2">
            <div className="font-semibold text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Role Read Error from Firestore:</span>
            </div>
            <p className="font-mono text-[11px] break-all">{roleReadError}</p>
            <button
              onClick={() => refreshProfile()}
              className="mt-2 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Reading Role</span>
            </button>
          </div>
        ) : (
          <div className="mb-6 p-3.5 rounded-xl bg-[#121C36] border border-[#24315A] text-xs text-[#9AA8C7] max-w-md w-full space-y-2">
            <p>
              Current account email: <strong className="text-[#E6ECFA]">{user?.email || 'Not logged in'}</strong>
            </p>
            <p>
              Detected role from profile: <strong className="text-[#FFC700] uppercase">{profile?.role || 'None'}</strong>
            </p>
            <button
              onClick={() => refreshProfile()}
              className="mt-1 px-3 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2545df] text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer mx-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Role from Firestore</span>
            </button>
          </div>
        )}

        <button
          onClick={onNavigateHome}
          className="px-6 py-3 rounded-xl bg-[#2F52FF] text-white font-semibold hover:bg-[#2545df] cursor-pointer"
        >
          Return to SOT Home
        </button>
      </div>
    );
  }

  // OVERVIEW STATS
  const totalStudents = students.length;
  const incompleteProfiles = students.filter(s => !s.profileComplete).length;
  const newSignupsThisWeek = students.filter(s => {
    if (!s.createdAt) return false;
    const diffDays = (Date.now() - new Date(s.createdAt).getTime()) / (1000 * 3600 * 24);
    return diffDays <= 7;
  }).length;

  // Department counts for bar chart
  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    SOT_DEPARTMENTS_LIST.forEach(d => { counts[d] = 0; });
    students.forEach(s => {
      if (s.department && counts[s.department] !== undefined) {
        counts[s.department]++;
      }
    });
    return counts;
  }, [students]);

  const maxDeptCount = Math.max(...Object.values(deptCounts), 1);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchDept = studentDeptFilter === 'All' || s.department === studentDeptFilter;
      const searchLower = studentSearch.toLowerCase();
      const matchSearch =
        (s.email && s.email.toLowerCase().includes(searchLower)) ||
        (s.fullName && s.fullName.toLowerCase().includes(searchLower)) ||
        (s.matricNumber && s.matricNumber.toLowerCase().includes(searchLower));
      return matchDept && matchSearch;
    });
  }, [students, studentDeptFilter, studentSearch]);

  // Export students to CSV
  const handleExportCSV = () => {
    const headers = ['UID', 'Full Name', 'Email', 'Department', 'Matric Number', 'Profile Complete', 'Role', 'Date Joined'];
    const rows = filteredStudents.map(s => [
      `"${s.uid || ''}"`,
      `"${s.fullName || ''}"`,
      `"${s.email || ''}"`,
      `"${s.department || 'N/A'}"`,
      `"${s.matricNumber || 'N/A'}"`,
      s.profileComplete ? 'Yes' : 'No',
      s.role,
      `"${s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'N/A'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SOT_Students_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Disable / Enable account
  const handleToggleDisable = async (student: UserProfile) => {
    const newStatus = !student.disabled;
    try {
      await updateDoc(doc(db, 'users', student.uid), { disabled: newStatus });
    } catch (e) {
      console.warn('Firestore update note:', e);
    }
    setStudents(prev => prev.map(s => s.uid === student.uid ? { ...s, disabled: newStatus } : s));
  };

  // Delete account and release their matric number reservation
  const handleDeleteStudent = async (uid: string) => {
    const studentToDelete = students.find(s => s.uid === uid);
    const matricToDelete = studentToDelete?.matricNumber?.trim().toUpperCase();

    // 1. Delete user from 'users' collection
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (e) {
      console.warn('Firestore delete user note:', e);
    }

    // 2. If student had a matricNumber, delete directly from 'matricNumbers' collection
    if (matricToDelete) {
      const matricDocId = sanitizeMatricId(matricToDelete);
      
      try {
        await deleteDoc(doc(db, 'matricNumbers', matricDocId));
      } catch (e) {
        console.warn('Firestore delete matricNumbers by doc id note:', e);
      }

      try {
        await deleteDoc(doc(db, 'matric_registry', matricDocId));
      } catch (e) {
        // ignore
      }

      // Also clean up local storage registry
      const localMatrics = JSON.parse(localStorage.getItem('sot_matric_registry') || '{}');
      if (localMatrics[matricToDelete]) {
        delete localMatrics[matricToDelete];
        localStorage.setItem('sot_matric_registry', JSON.stringify(localMatrics));
      }
    }

    // 3. Also query matricNumbers & matric_registry for any documents where uid == uid or userId == uid and delete them
    try {
      const q1 = query(collection(db, 'matricNumbers'), where('uid', '==', uid));
      const snap1 = await getDocs(q1);
      for (const d of snap1.docs) {
        await deleteDoc(d.ref).catch(() => {});
      }
    } catch (e) {
      // ignore
    }

    try {
      const q2 = query(collection(db, 'matricNumbers'), where('userId', '==', uid));
      const snap2 = await getDocs(q2);
      for (const d of snap2.docs) {
        await deleteDoc(d.ref).catch(() => {});
      }
    } catch (e) {
      // ignore
    }

    try {
      const q3 = query(collection(db, 'matric_registry'), where('uid', '==', uid));
      const snap3 = await getDocs(q3);
      for (const d of snap3.docs) {
        await deleteDoc(d.ref).catch(() => {});
      }
    } catch (e) {
      // ignore
    }

    // 4. Also clean up portal local storage completely
    try {
      const localMatrics = JSON.parse(localStorage.getItem('sot_matric_registry') || '{}');
      if (matricToDelete && localMatrics[matricToDelete]) {
        delete localMatrics[matricToDelete];
      }
      Object.keys(localMatrics).forEach(k => {
        if (localMatrics[k] === uid) delete localMatrics[k];
      });
      localStorage.setItem('sot_matric_registry', JSON.stringify(localMatrics));

      const localStudentsRaw = localStorage.getItem('sot_local_students');
      if (localStudentsRaw) {
        const localStudents = JSON.parse(localStudentsRaw);
        const filtered = localStudents.filter((s: any) => s.uid !== uid && (!matricToDelete || s.matricNumber !== matricToDelete));
        localStorage.setItem('sot_local_students', JSON.stringify(filtered));
      }
    } catch (e) {
      // ignore
    }

    // Update students list in local state
    setStudents(prev => prev.filter(s => s.uid !== uid));
  };

  // Messages management
  const filteredMessages = useMemo(() => {
    if (messageTypeFilter === 'All') return messages;
    return messages.filter(m => m.type === messageTypeFilter);
  }, [messages, messageTypeFilter]);

  const handleUpdateMessageStatus = async (id: string, newStatus: ContactMessage['status']) => {
    try {
      await updateDoc(doc(db, 'messages', id), { status: newStatus });
    } catch (e) {
      // update local
    }
    const updated = messages.map(m => m.id === id ? { ...m, status: newStatus } : m);
    setMessages(updated);
    localStorage.setItem('sot_local_messages', JSON.stringify(updated));
  };

  // Announcement Create/Edit
  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle || !annContent) return;

    if (editingAnnId) {
      // Update
      const updatedItem: AnnouncementItem = {
        id: editingAnnId,
        title: annTitle,
        content: annContent,
        category: annCategory,
        department: annDepartment,
        urgent: annUrgent,
        createdAt: new Date().toISOString(),
        author: profile?.fullName || 'Student Admin'
      };
      try {
        await updateDoc(doc(db, 'announcements', editingAnnId), updatedItem as any);
      } catch (e) {
        // local update
      }
      setAnnouncements(prev => prev.map(a => a.id === editingAnnId ? updatedItem : a));
    } else {
      // Create
      const newAnn: Omit<AnnouncementItem, 'id'> = {
        title: annTitle,
        content: annContent,
        category: annCategory,
        department: annDepartment,
        urgent: annUrgent,
        createdAt: new Date().toISOString(),
        author: profile?.fullName || 'Student Admin'
      };
      let newId = 'ann_' + Date.now();
      try {
        const ref = await addDoc(collection(db, 'announcements'), newAnn);
        newId = ref.id;
      } catch (e) {
        // fallback ID
      }
      setAnnouncements(prev => [{ ...newAnn, id: newId }, ...prev]);
    }

    setShowAnnModal(false);
    setEditingAnnId(null);
    setAnnTitle('');
    setAnnContent('');
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (e) {
      // local
    }
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  // FAQ Management for Chatbot Knowledge Base
  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;

    if (editingFaqId) {
      const updated: Partial<FaqItem> = {
        question: faqQuestion.trim(),
        answer: faqAnswer.trim(),
        updatedAt: new Date().toISOString()
      };
      try {
        await updateDoc(doc(db, 'faqs', editingFaqId), updated);
      } catch (err) {
        console.warn('FAQ update error:', err);
      }
      setFaqs(prev => prev.map(f => f.id === editingFaqId ? { ...f, ...updated } : f));
    } else {
      const newFaq = {
        question: faqQuestion.trim(),
        answer: faqAnswer.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      let newId = 'faq_' + Date.now();
      try {
        const ref = await addDoc(collection(db, 'faqs'), newFaq);
        newId = ref.id;
      } catch (err) {
        console.warn('FAQ create error:', err);
      }
      setFaqs(prev => [{ ...newFaq, id: newId }, ...prev]);
    }

    setShowFaqModal(false);
    setEditingFaqId(null);
    setFaqQuestion('');
    setFaqAnswer('');
  };

  const handleDeleteFaq = async (id: string) => {
    if (!confirm('Are you sure you want to delete this FAQ? SOT Assistant will no longer use this answer.')) return;
    try {
      await deleteDoc(doc(db, 'faqs', id));
    } catch (err) {
      console.warn('FAQ delete error:', err);
    }
    setFaqs(prev => prev.filter(f => f.id !== id));
  };

  const handleSeedDefaultFaqs = async () => {
    const defaults = [
      {
        question: 'How do I complete my profile registration?',
        answer: 'Sign-up has 2 steps: Step 1 asks for your email and password (minimum 8 characters). Step 2 prompts you to select one of the 7 SOT departments and enter your unique matriculation number. Once submitted, your profile is complete and you can access all dashboard features.'
      },
      {
        question: 'What are the 7 departments in the School of Technology?',
        answer: 'The School of Technology comprises 7 departments: 1. Agricultural Technology, 2. Computer Technology, 3. Food Technology, 4. Hospitality Management, 5. Leisure & Tourism Management, 6. Nutrition & Dietetics, and 7. Polymer & Textile Technology.'
      },
      {
        question: 'Is this portal official university administration?',
        answer: 'No. This portal is built and managed independently by students of the School of Technology, for students. It is a student-run resource and not an official university administrative channel.'
      },
      {
        question: 'What happens if I forget my password or get locked out?',
        answer: 'You can use the "Forgot your password?" option on the Log in window to receive a secure password reset link via email. Accounts are automatically locked for 15 minutes after 5 consecutive failed login attempts to protect student accounts.'
      }
    ];

    for (const item of defaults) {
      try {
        const ref = await addDoc(collection(db, 'faqs'), {
          ...item,
          createdAt: new Date().toISOString()
        });
        setFaqs(prev => [{ id: ref.id, ...item, createdAt: new Date().toISOString() }, ...prev]);
      } catch (err) {
        console.warn('Seed FAQ error:', err);
      }
    }
  };


  return (
    <div className="min-h-screen bg-[#0A1224] text-[#E6ECFA] flex flex-col md:flex-row">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between h-16 px-4 bg-[#0A1224] border-b border-[#24315A] sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#121C36] border border-[#FFC700]/40 flex items-center justify-center text-[#FFC700]">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-sm text-[#E6ECFA]">
            SOT Admin Portal
          </span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg bg-[#121C36] border border-[#24315A] text-[#9AA8C7]"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen w-72 bg-[#0A1224] border-r border-[#24315A] flex flex-col justify-between p-5 transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#24315A]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#121C36] border border-[#FFC700]/50 flex items-center justify-center text-[#FFC700] shadow-[0_0_15px_rgba(255,199,0,0.2)]">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <span className="font-display font-bold text-lg text-[#E6ECFA] block leading-tight">
                  Admin Desk<span className="text-[#FFC700]">.</span>
                </span>
                <span className="text-[10px] text-[#9AA8C7]">SOT Student Administration</span>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1 rounded-lg text-[#9AA8C7]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3 rounded-xl bg-[#121C36] border border-[#24315A]">
            <div className="text-[10px] font-bold text-[#FFC700] uppercase tracking-wider mb-1">
              Admin Credential
            </div>
            <div className="text-xs font-semibold text-[#E6ECFA] truncate">
              {user?.email}
            </div>
            <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Full Access Privileges</span>
            </div>
          </div>

          {/* Tabs */}
          <nav className="space-y-1.5">
            <button
              onClick={() => { setActiveTab('overview'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-[#FFC700]" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => { setActiveTab('students'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'students'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
              }`}
            >
              <Users className="w-4 h-4 text-[#FFC700]" />
              <div className="flex-1 flex items-center justify-between">
                <span>Students</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#121C36] text-[#E6ECFA]">
                  {students.length}
                </span>
              </div>
            </button>

            <button
              onClick={() => { setActiveTab('messages'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'messages'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-[#FFC700]" />
              <div className="flex-1 flex items-center justify-between">
                <span>Messages</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FFC700] text-[#0A1224] font-bold">
                  {messages.length}
                </span>
              </div>
            </button>

            <button
              onClick={() => { setActiveTab('announcements'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'announcements'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
              }`}
            >
              <Bell className="w-4 h-4 text-[#FFC700]" />
              <div className="flex-1 flex items-center justify-between">
                <span>Announcements</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#121C36] text-[#E6ECFA]">
                  {announcements.length}
                </span>
              </div>
            </button>

            <button
              onClick={() => { setActiveTab('faqs'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'faqs'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
              }`}
            >
              <Bot className="w-4 h-4 text-[#FFC700]" />
              <div className="flex-1 flex items-center justify-between">
                <span>Chatbot FAQs</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#121C36] text-[#E6ECFA]">
                  {faqs.length}
                </span>
              </div>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="space-y-2 pt-4 border-t border-[#24315A]">
          <button
            onClick={onNavigateHome}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36] cursor-pointer"
          >
            <Home className="w-3.5 h-3.5 text-[#FFC700]" />
            <span>Public Site</span>
          </button>
          <button
            onClick={() => { logout(); onNavigateHome(); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-950/20 cursor-pointer"
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

      {/* Main Workspace */}
      <main className="flex-1 min-w-0 p-5 sm:p-8 lg:p-10 space-y-8 overflow-y-auto">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#24315A]">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#9AA8C7]">
              <span>SOT Student Portal</span>
              <span>/</span>
              <span className="text-[#FFC700] font-semibold capitalize">{activeTab === 'faqs' ? 'Chatbot FAQs' : activeTab}</span>
            </div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#E6ECFA] mt-1">
              {activeTab === 'overview' && 'Portal Analytics & Overview'}
              {activeTab === 'students' && 'Registered Students Directory'}
              {activeTab === 'messages' && 'Student Inquiries, Complaints & Reviews'}
              {activeTab === 'announcements' && 'Publish & Manage Announcements'}
              {activeTab === 'faqs' && 'Chatbot Knowledge Base & FAQs'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="px-3.5 py-2 rounded-lg bg-[#121C36] border border-[#24315A] text-xs font-medium text-[#9AA8C7] hover:text-[#E6ECFA] flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 1. OVERVIEW                                              */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              
              <div className="p-5 rounded-2xl bg-[#121C36] border border-[#24315A]">
                <div className="flex items-center justify-between text-xs text-[#9AA8C7] font-semibold uppercase">
                  <span>Total Students</span>
                  <Users className="w-4 h-4 text-[#2F52FF]" />
                </div>
                <div className="mt-2 text-3xl font-display font-extrabold text-[#E6ECFA]">
                  {totalStudents}
                </div>
                <div className="text-xs text-[#9AA8C7] mt-1">Across 7 SOT departments</div>
              </div>

              <div className="p-5 rounded-2xl bg-[#121C36] border border-[#24315A]">
                <div className="flex items-center justify-between text-xs text-[#9AA8C7] font-semibold uppercase">
                  <span>New This Week</span>
                  <Sparkles className="w-4 h-4 text-[#FFC700]" />
                </div>
                <div className="mt-2 text-3xl font-display font-extrabold text-[#FFC700]">
                  {newSignupsThisWeek}
                </div>
                <div className="text-xs text-[#9AA8C7] mt-1">Recent registrations</div>
              </div>

              <div className="p-5 rounded-2xl bg-[#121C36] border border-[#24315A]">
                <div className="flex items-center justify-between text-xs text-[#9AA8C7] font-semibold uppercase">
                  <span>Incomplete Profiles</span>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="mt-2 text-3xl font-display font-extrabold text-amber-400">
                  {incompleteProfiles}
                </div>
                <div className="text-xs text-[#9AA8C7] mt-1">Pending Step 2 completion</div>
              </div>

              <div className="p-5 rounded-2xl bg-[#121C36] border border-[#24315A]">
                <div className="flex items-center justify-between text-xs text-[#9AA8C7] font-semibold uppercase">
                  <span>Total Messages</span>
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="mt-2 text-3xl font-display font-extrabold text-emerald-400">
                  {messages.length}
                </div>
                <div className="text-xs text-[#9AA8C7] mt-1">
                  {messages.filter(m => m.status === 'New').length} pending review
                </div>
              </div>

            </div>

            {/* Students Per Department Bar Chart */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-6">
              <div>
                <h3 className="font-display font-bold text-lg text-[#E6ECFA]">
                  Students Per Department
                </h3>
                <p className="text-xs text-[#9AA8C7]">Enrollment distribution across all 7 departments</p>
              </div>

              <div className="space-y-4">
                {Object.entries(deptCounts).map(([dept, count]) => {
                  const percentage = maxDeptCount > 0 ? (count / maxDeptCount) * 100 : 0;
                  return (
                    <div key={dept} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-[#E6ECFA]">{dept}</span>
                        <span className="text-[#FFC700] font-mono">{count} student{count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-[#0A1224] overflow-hidden p-0.5 border border-[#24315A]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#2F52FF] to-[#FFC700] transition-all duration-700"
                          style={{ width: `${Math.max(percentage, count > 0 ? 8 : 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* 2. STUDENTS TABLE                                        */}
        {/* ======================================================== */}
        {activeTab === 'students' && (
          <div className="space-y-5">
            
            {/* Filter and Search Bar */}
            <div className="p-4 rounded-xl bg-[#121C36] border border-[#24315A] flex flex-col md:flex-row items-center justify-between gap-4">
              
              <div className="w-full md:w-80 relative">
                <input
                  type="text"
                  placeholder="Search by name, email, matric..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/60 focus:outline-none focus:border-[#2F52FF]"
                />
                <Search className="w-4 h-4 text-[#9AA8C7] absolute left-3 top-2.5" />
              </div>

              <div className="w-full md:w-auto flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-[#9AA8C7]" />
                  <select
                    value={studentDeptFilter}
                    onChange={(e) => setStudentDeptFilter(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  >
                    <option value="All">All Departments</option>
                    {SOT_DEPARTMENTS_LIST.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 rounded-lg bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(255,199,0,0.2)]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export to CSV</span>
                </button>
              </div>

            </div>

            {/* Students Table */}
            <div className="rounded-2xl bg-[#121C36] border border-[#24315A] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0A1224] text-[#9AA8C7] uppercase font-bold tracking-wider border-b border-[#24315A]">
                    <tr>
                      <th className="py-3.5 px-4">Student</th>
                      <th className="py-3.5 px-4">Matric Number</th>
                      <th className="py-3.5 px-4">Department</th>
                      <th className="py-3.5 px-4">Date Joined</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#24315A]">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-[#9AA8C7]">
                          No students matched your query.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((s) => (
                        <tr key={s.uid} className="hover:bg-[#0A1224]/50 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-[#E6ECFA]">{s.fullName || 'Unnamed Student'}</div>
                            <div className="text-[11px] text-[#9AA8C7]">{s.email}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-[#FFC700]">
                            {s.matricNumber || <span className="text-[#9AA8C7] font-normal italic">Pending Step 2</span>}
                          </td>
                          <td className="py-3.5 px-4 text-[#E6ECFA]">
                            {s.department || <span className="text-[#9AA8C7] italic">Unassigned</span>}
                          </td>
                          <td className="py-3.5 px-4 text-[#9AA8C7]">
                            {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="py-3.5 px-4">
                            {s.disabled ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-500/30">
                                Disabled
                              </span>
                            ) : s.profileComplete ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/30">
                                Incomplete
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            <button
                              onClick={() => handleToggleDisable(s)}
                              title={s.disabled ? 'Re-enable account' : 'Disable account'}
                              className="p-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#9AA8C7] hover:text-[#FFC700] cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(s.uid)}
                              title="Delete account"
                              className="p-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#9AA8C7] hover:text-rose-400 cursor-pointer"
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

          </div>
        )}

        {/* ======================================================== */}
        {/* 3. MESSAGES (Complaints, Reviews, Enquiries)             */}
        {/* ======================================================== */}
        {activeTab === 'messages' && (
          <div className="space-y-5">
            
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {['All', 'Complaint', 'Review', 'Enquiry'].map(t => (
                  <button
                    key={t}
                    onClick={() => setMessageTypeFilter(t)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      messageTypeFilter === t
                        ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                        : 'bg-[#121C36] text-[#9AA8C7] border border-[#24315A]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <span className="text-xs text-[#9AA8C7]">
                Showing {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-4">
              {filteredMessages.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-[#121C36] border border-[#24315A] text-[#9AA8C7]">
                  No messages recorded in this category.
                </div>
              ) : (
                filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                          msg.type === 'Complaint'
                            ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                            : msg.type === 'Review'
                            ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                            : 'bg-blue-950 text-blue-300 border border-blue-500/40'
                        }`}>
                          {msg.type}
                        </span>

                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          msg.status === 'New'
                            ? 'bg-[#FFC700] text-[#0A1224]'
                            : msg.status === 'Read'
                            ? 'bg-[#2F52FF] text-white'
                            : 'bg-emerald-950 text-emerald-300'
                        }`}>
                          {msg.status}
                        </span>
                      </div>

                      <span className="text-xs font-mono text-[#9AA8C7]">
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-sm font-bold text-[#E6ECFA]">{msg.name}</div>
                      <div className="text-xs text-[#9AA8C7]">{msg.email}</div>
                    </div>

                    <p className="text-sm text-[#E6ECFA] bg-[#0A1224] p-4 rounded-xl border border-[#24315A] whitespace-pre-wrap leading-relaxed">
                      {msg.message}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-[#24315A]/60">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateMessageStatus(msg.id, 'Read')}
                          className="px-2.5 py-1 rounded bg-[#0A1224] border border-[#24315A] text-xs text-[#9AA8C7] hover:text-[#E6ECFA] cursor-pointer"
                        >
                          Mark Read
                        </button>
                        <button
                          onClick={() => handleUpdateMessageStatus(msg.id, 'Resolved')}
                          className="px-2.5 py-1 rounded bg-[#0A1224] border border-[#24315A] text-xs text-emerald-400 hover:border-emerald-500 cursor-pointer"
                        >
                          Mark Resolved
                        </button>
                      </div>

                      <a
                        href={`mailto:${msg.email}?subject=Re: SOT Student Portal Inquiry [${msg.type}]`}
                        className="px-3.5 py-1.5 rounded-lg bg-[#2F52FF] text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-[#2545df]"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Reply by Email</span>
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* 4. ANNOUNCEMENTS (Create, Edit, Delete)                   */}
        {/* ======================================================== */}
        {activeTab === 'announcements' && (
          <div className="space-y-5">
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9AA8C7]">
                Broadcast announcements to students of specific departments or all students.
              </span>
              <button
                onClick={() => {
                  setEditingAnnId(null);
                  setAnnTitle('');
                  setAnnContent('');
                  setAnnCategory('General');
                  setAnnDepartment('All');
                  setAnnUrgent(false);
                  setShowAnnModal(true);
                }}
                className="px-4 py-2 rounded-lg bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(255,199,0,0.2)]"
              >
                <Plus className="w-4 h-4" />
                <span>Create Announcement</span>
              </button>
            </div>

            <div className="space-y-4">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                        ann.urgent ? 'bg-rose-950 text-rose-300 border border-rose-500/40' : 'bg-[#0A1224] text-[#FFC700] border border-[#24315A]'
                      }`}>
                        {ann.category} {ann.urgent && '• URGENT'}
                      </span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#0A1224] text-[#9AA8C7] border border-[#24315A]">
                        Target: {ann.department}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingAnnId(ann.id);
                          setAnnTitle(ann.title);
                          setAnnContent(ann.content);
                          setAnnCategory(ann.category);
                          setAnnDepartment(ann.department);
                          setAnnUrgent(Boolean(ann.urgent));
                          setShowAnnModal(true);
                        }}
                        className="p-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#9AA8C7] hover:text-[#FFC700] cursor-pointer"
                        title="Edit Announcement"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        className="p-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#9AA8C7] hover:text-rose-400 cursor-pointer"
                        title="Delete Announcement"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-display font-bold text-lg text-[#E6ECFA]">
                    {ann.title}
                  </h3>

                  <p className="text-sm text-[#9AA8C7] leading-relaxed whitespace-pre-wrap">
                    {ann.content}
                  </p>

                  <div className="text-[11px] text-[#9AA8C7] pt-2 border-t border-[#24315A]/60 flex items-center justify-between">
                    <span>Published by {ann.author || 'Admin'}</span>
                    <span>{ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : ''}</span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* 5. CHATBOT FAQS (Knowledge Base Management)             */}
        {/* ======================================================== */}
        {activeTab === 'faqs' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-lg text-[#E6ECFA] flex items-center gap-2">
                  <Bot className="w-5 h-5 text-[#FFC700]" />
                  <span>SOT Assistant Knowledge Base</span>
                </h3>
                <p className="text-xs text-[#9AA8C7]">
                  These Q&As are loaded by SOT Assistant dynamically before replying to student queries.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {faqs.length === 0 && (
                  <button
                    onClick={handleSeedDefaultFaqs}
                    className="px-3.5 py-2 rounded-lg bg-[#121C36] border border-[#FFC700]/50 text-xs font-semibold text-[#FFC700] hover:bg-[#FFC700]/10 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Seed Common FAQs</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingFaqId(null);
                    setFaqQuestion('');
                    setFaqAnswer('');
                    setShowFaqModal(true);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(255,199,0,0.2)]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add FAQ Question</span>
                </button>
              </div>
            </div>

            {/* List of FAQs */}
            <div className="space-y-4">
              {faqs.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-[#121C36] border border-[#24315A] text-[#9AA8C7] space-y-3">
                  <Bot className="w-10 h-10 text-[#FFC700] mx-auto opacity-80" />
                  <p className="text-sm font-semibold text-[#E6ECFA]">No custom FAQs yet.</p>
                  <p className="text-xs max-w-md mx-auto">
                    The assistant currently relies on core department and portal knowledge. Add custom FAQs or seed default ones to expand its knowledge base!
                  </p>
                  <button
                    onClick={handleSeedDefaultFaqs}
                    className="mt-2 px-4 py-2 rounded-lg bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Populate Default FAQs</span>
                  </button>
                </div>
              ) : (
                faqs.map((faq, idx) => (
                  <div
                    key={faq.id || idx}
                    className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-[#0A1224] border border-[#FFC700]/30 flex items-center justify-center text-[#FFC700] shrink-0 mt-0.5">
                          <HelpCircle className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-display font-bold text-base text-[#E6ECFA]">
                            {faq.question}
                          </h4>
                          <span className="text-[10px] text-[#9AA8C7] font-mono">
                            FAQ #{idx + 1}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setEditingFaqId(faq.id);
                            setFaqQuestion(faq.question);
                            setFaqAnswer(faq.answer);
                            setShowFaqModal(true);
                          }}
                          className="p-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#9AA8C7] hover:text-[#FFC700] cursor-pointer"
                          title="Edit FAQ"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteFaq(faq.id)}
                          className="p-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#9AA8C7] hover:text-rose-400 cursor-pointer"
                          title="Delete FAQ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-[#E6ECFA] bg-[#0A1224] p-4 rounded-xl border border-[#24315A] leading-relaxed whitespace-pre-wrap">
                      {faq.answer}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-[#9AA8C7] pt-1">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Active in Chatbot Knowledge
                      </span>
                      <span>{faq.createdAt ? new Date(faq.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>

      {/* CREATE / EDIT ANNOUNCEMENT MODAL */}
      {showAnnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A1224]/85 backdrop-blur-md">
          <div className="relative w-full max-w-lg bg-[#121C36] border border-[#24315A] rounded-2xl p-6 sm:p-8 space-y-4 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <button
              onClick={() => setShowAnnModal(false)}
              className="absolute top-5 right-5 p-2 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#9AA8C7] hover:text-[#E6ECFA]"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-display font-bold text-xl text-[#E6ECFA]">
              {editingAnnId ? 'Edit Announcement' : 'Publish New Announcement'}
            </h3>

            <form onSubmit={handleSaveAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="e.g. Semester Registration Deadlines"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-sm text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">Category</label>
                  <select
                    value={annCategory}
                    onChange={(e) => setAnnCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none"
                  >
                    <option value="General">General</option>
                    <option value="Academic">Academic</option>
                    <option value="Student Notice">Student Notice</option>
                    <option value="Department">Department</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">Target Department</label>
                  <select
                    value={annDepartment}
                    onChange={(e) => setAnnDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none"
                  >
                    <option value="All">All Departments</option>
                    {SOT_DEPARTMENTS_LIST.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="urgentCheck"
                  checked={annUrgent}
                  onChange={(e) => setAnnUrgent(e.target.checked)}
                  className="rounded bg-[#0A1224] border-[#24315A] text-[#FFC700] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="urgentCheck" className="text-xs text-[#E6ECFA] cursor-pointer">
                  Mark as Urgent Notice
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">Content *</label>
                <textarea
                  required
                  rows={4}
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  placeholder="Write announcement body..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-sm text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAnnModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs text-[#9AA8C7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df]"
                >
                  {editingAnnId ? 'Save Changes' : 'Broadcast Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT FAQ MODAL */}
      {showFaqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A1224]/85 backdrop-blur-md">
          <div className="relative w-full max-w-lg bg-[#121C36] border border-[#24315A] rounded-2xl p-6 sm:p-8 space-y-4 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <button
              onClick={() => setShowFaqModal(false)}
              className="absolute top-5 right-5 p-2 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#9AA8C7] hover:text-[#E6ECFA]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0A1224] border border-[#FFC700]/40 flex items-center justify-center text-[#FFC700]">
                <Bot className="w-4 h-4" />
              </div>
              <h3 className="font-display font-bold text-xl text-[#E6ECFA]">
                {editingFaqId ? 'Edit Chatbot FAQ' : 'Add Chatbot FAQ Knowledge'}
              </h3>
            </div>

            <p className="text-xs text-[#9AA8C7]">
              SOT Assistant will consult this question and answer to respond accurately to student inquiries.
            </p>

            <form onSubmit={handleSaveFaq} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">
                  Question *
                </label>
                <input
                  type="text"
                  required
                  value={faqQuestion}
                  onChange={(e) => setFaqQuestion(e.target.value)}
                  placeholder="e.g. Where can I submit my student complaint or review?"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-sm text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9AA8C7] mb-1">
                  Answer *
                </label>
                <textarea
                  required
                  rows={4}
                  value={faqAnswer}
                  onChange={(e) => setFaqAnswer(e.target.value)}
                  placeholder="e.g. You can submit complaints or reviews via the Contact page link in the navigation menu..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-sm text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFaqModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs text-[#9AA8C7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] cursor-pointer"
                >
                  {editingFaqId ? 'Update FAQ' : 'Save & Publish FAQ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

