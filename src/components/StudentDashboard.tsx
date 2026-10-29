import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { DEPARTMENTS, INITIAL_ANNOUNCEMENTS } from '../data/departments';
import { DepartmentIcon } from './PublicLanding';
import { auth, db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, addDoc, query, where } from 'firebase/firestore';
import { AnnouncementItem, ContactMessage, TimetableEntry, CourseItem, CourseMaterial, ResourceItem, BookmarkItem } from '../types';
import { INITIAL_COURSES, INITIAL_TIMETABLES, normalizeCourseLevel, normalizeCourseSemester } from '../data/coursesAndTimetables';
import { AskAiView } from './AskAiView';
import { DailyStreakCard } from './DailyStreakCard';
import { StudentBookmarksView } from './StudentBookmarksView';
import { GpaCalculator } from './GpaCalculator';
import { StudyPlanner } from './StudyPlanner';
import { WhatsAppIcon } from './WhatsAppIcon';
import { StudentResourcesView } from './StudentResourcesView';
import { CommunitiesLinksView } from './CommunitiesLinksView';
import { NotificationsPopover, DashboardNotificationItem } from './NotificationsPopover';
import { PWAInstallRow } from './PWAInstallRow';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { LinkItem } from '../types';
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
  FolderOpen,
  Bookmark,
  BookmarkCheck,
  Flame,
  Trash2,
  Calculator,
  ListTodo,
  Link2,
  Pin,
  CheckCheck
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
  | 'resources'
  | 'department'
  | 'courses'
  | 'timetables'
  | 'announcements'
  | 'bookmarks'
  | 'links'
  | 'gpa'
  | 'study-planner'
  | 'my-messages'
  | 'rep-announcement'
  | 'ask-ai'
  | 'profile';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ACADEMIC_LEVELS = ['ND I', 'ND II', 'HND I', 'HND II'];

export function getLagosDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

export function getLagosYesterdayString(d: Date = new Date()): string {
  const yesterday = new Date(d.getTime() - 86400000);
  return getLagosDateString(yesterday);
}

export interface LagosGreetingResult {
  greeting: string;
  period: 'morning' | 'afternoon' | 'evening' | 'night';
  messages: string[];
}

export function getLagosPeriodGreeting(): LagosGreetingResult {
  const now = new Date();
  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).format(now);
  const hour = parseInt(timeStr.split(':')[0], 10);

  if (hour >= 5 && hour < 12) {
    return {
      greeting: 'Good morning',
      period: 'morning',
      messages: [
        "Ready for a productive day ahead? Review today's classes and syllabus.",
        "Start early, finish strong! Check your lecture timetable.",
        "Great morning to learn something new. Stay focused today!"
      ]
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      greeting: 'Good afternoon',
      period: 'afternoon',
      messages: [
        "Keep up the academic momentum! Take a short study break between lectures.",
        "Afternoon check-in: Catch up on course notes, handouts and assignments.",
        "Powering through the day. Stay hydrated and focused!"
      ]
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      greeting: 'Good evening',
      period: 'evening',
      messages: [
        "Time to wind down lectures and review today's notes.",
        "Solid work today. Glance over tomorrow's class schedule.",
        "Evenings are prime time for revising key concepts and past questions."
      ]
    };
  } else {
    return {
      greeting: 'Good night',
      period: 'night',
      messages: [
        "Rest well and recharge for tomorrow's academic goals.",
        "Late night study session? Keep it calm and get enough sleep.",
        "A peaceful night's rest is part of smart exam preparation."
      ]
    };
  }
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  onNavigateHome,
  onNavigateContact,
  onNavigateAdmin,
  onNavigateRep
}) => {
  const { user, profile, isAdmin, roleReadError, refreshProfile, logout, updateStudentProfile } = useAuth();
  const { settings } = useSiteSettings();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  // Bookmarks toast
  const [bookmarkToast, setBookmarkToast] = useState<string | null>(null);

  // Daily Streak check in Africa/Lagos timezone
  useEffect(() => {
    if (!user?.uid || !profile) return;
    const todayLagos = getLagosDateString();
    const yesterdayLagos = getLagosYesterdayString();

    if (profile.lastActiveDate === todayLagos) {
      return; // Already recorded activity today
    }

    let nextStreak = 1;
    if (profile.lastActiveDate === yesterdayLagos) {
      nextStreak = (profile.streakCount || 0) + 1;
    } else {
      nextStreak = 1;
    }

    const nextLongest = Math.max(profile.longestStreak || 0, nextStreak);

    updateDoc(doc(db, 'users', user.uid), {
      streakCount: nextStreak,
      longestStreak: nextLongest,
      lastActiveDate: todayLagos
    }).then(() => {
      refreshProfile();
    }).catch(err => {
      console.warn('Streak update note:', err);
    });
  }, [user?.uid, profile?.lastActiveDate]);

  // Bookmarks helper functions
  const isBookmarked = (type: 'course' | 'material' | 'announcement', id: string): boolean => {
    return (profile?.bookmarks || []).some(b => b.type === type && b.id === id);
  };

  const toggleBookmark = async (item: Omit<BookmarkItem, 'createdAt'> & { createdAt?: string }) => {
    if (!user?.uid) return;
    const current = profile?.bookmarks || [];
    const exists = current.some(b => b.type === item.type && b.id === item.id);
    let updatedList: BookmarkItem[];

    if (exists) {
      updatedList = current.filter(b => !(b.type === item.type && b.id === item.id));
      setBookmarkToast(`Removed "${item.title}" from bookmarks.`);
    } else {
      if (current.length >= 100) {
        setBookmarkToast('Bookmark limit reached (100 items max). Remove older bookmarks to add new ones.');
        return;
      }
      const newItem: BookmarkItem = {
        ...item,
        createdAt: item.createdAt || new Date().toISOString()
      };
      updatedList = [newItem, ...current];
      setBookmarkToast(`Saved "${item.title}" to your bookmarks!`);
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        bookmarks: updatedList
      });
      await refreshProfile();
    } catch (err) {
      console.warn('Bookmarks save error:', err);
    }
  };

  useEffect(() => {
    if (bookmarkToast) {
      const timer = setTimeout(() => setBookmarkToast(null), 3200);
      return () => clearTimeout(timer);
    }
  }, [bookmarkToast]);

  // Department uploaded resources from Course Reps
  const [deptResources, setDeptResources] = useState<ResourceItem[]>([]);

  // Communities & Links State
  const [links, setLinks] = useState<LinkItem[]>([]);

  // Comprehensive Notifications State
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsLastSeen, setNotificationsLastSeen] = useState<string>(() => {
    return (profile as any)?.notificationsLastSeen || localStorage.getItem('sot_notifications_last_seen') || '';
  });

  // Course Rep Announcement Pinned State
  const [repPinned, setRepPinned] = useState(false);

  // Profile edit states (Full Name, Level, Password)
  const [editFullName, setEditFullName] = useState(profile?.fullName || '');
  const [editLevel, setEditLevel] = useState<string>(profile?.level || 'ND1');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Home Dynamic Greeting with Lagos time auto-update
  const [lagosGreetingData, setLagosGreetingData] = useState<LagosGreetingResult>(() => getLagosPeriodGreeting());
  const [greetingMsgIdx, setGreetingMsgIdx] = useState(0);

  useEffect(() => {
    const updateGreeting = () => {
      const updated = getLagosPeriodGreeting();
      setLagosGreetingData(updated);
      setGreetingMsgIdx(prev => (prev + 1) % updated.messages.length);
    };
    const interval = setInterval(updateGreeting, 60000);
    return () => clearInterval(interval);
  }, []);

  // Universal Search on Home
  const [homeSearchQuery, setHomeSearchQuery] = useState('');

  // Live Announcements
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(INITIAL_ANNOUNCEMENTS);
  const [annFilter, setAnnFilter] = useState('All');

  // Timetables
  const [timetables, setTimetables] = useState<TimetableEntry[]>(INITIAL_TIMETABLES);
  const [ttLevelFilter, setTtLevelFilter] = useState<string>(profile?.level ? normalizeCourseLevel(profile.level) : 'All');
  const [ttTypeTab, setTtTypeTab] = useState<'class' | 'exam'>('class');

  // Department Courses for Student's own department
  const [courses, setCourses] = useState<CourseItem[]>(INITIAL_COURSES);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseLevel, setCourseLevel] = useState<'ND1' | 'ND2' | 'HND1' | 'HND2'>(
    profile?.level ? normalizeCourseLevel(profile.level) : 'ND1'
  );
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
    if (profile?.level) {
      setEditLevel(profile.level);
      setTtLevelFilter(profile.level);
      setCourseLevel(normalizeCourseLevel(profile.level));
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
          setTimetables([]);
        }
      } catch (err) {
        console.warn('Timetables load note:', err);
        setTimetables([]);
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
          setCourses([]);
        }
      } catch (err) {
        console.warn('Courses load note:', err);
        setCourses([]);
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

  // Fetch Communities & Links
  useEffect(() => {
    const fetchLinks = async () => {
      try {
        const snap = await getDocs(collection(db, 'links'));
        if (!snap.empty) {
          const list: LinkItem[] = [];
          snap.forEach(d => {
            list.push({ id: d.id, ...d.data() } as LinkItem);
          });
          setLinks(list);
        }
      } catch (e) {
        console.warn('Links fetch error:', e);
      }
    };
    fetchLinks();
  }, []);

  // Filter announcements for student (matches 'All' or student's department)
  // Max 3 pinned announcements appear first
  const relevantAnnouncements = useMemo(() => {
    const matched = announcements.filter(a => {
      const matchDept = a.department === 'All' || a.department === profile?.department;
      const matchCategory = annFilter === 'All' || a.category === annFilter;
      return matchDept && matchCategory;
    });

    const pinned = matched.filter(a => a.pinned).slice(0, 3);
    const nonPinned = matched.filter(a => !pinned.some(p => p.id === a.id));
    return [...pinned, ...nonPinned];
  }, [announcements, profile?.department, annFilter]);

  // Home announcements: pinned announcements first, then latest, max 2 items
  const homeAnnouncements = useMemo(() => {
    const matched = announcements.filter(a => a.department === 'All' || a.department === (profile?.department || studentDept));
    const pinned = matched.filter(a => a.pinned);
    const nonPinned = matched.filter(a => !a.pinned);
    return [...pinned, ...nonPinned].slice(0, 2);
  }, [announcements, profile?.department, studentDept]);

  // Next exam calculation for the timetable card
  const nextExamInfo = useMemo(() => {
    const todayStr = getLagosDateString();
    const todayDate = new Date(todayStr);
    const examEntries = timetables
      .filter(t => t.department === studentDept && t.type === 'exam' && !!t.date)
      .map(t => {
        const examDate = new Date(t.date!);
        const diffMs = examDate.getTime() - todayDate.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return { entry: t, diffDays };
      })
      .filter(e => e.diffDays >= 0)
      .sort((a, b) => a.diffDays - b.diffDays);
    return examEntries[0] || null;
  }, [timetables, studentDept]);

  // Comprehensive notifications aggregation (Announcements, Materials, Past Questions, Courses, Timetables, Links, Study Tasks)
  const lastSeenIso = notificationsLastSeen || (profile as any)?.notificationsLastSeen;
  const lastSeenMs = lastSeenIso ? new Date(lastSeenIso).getTime() : 0;

  const dashboardNotifications: DashboardNotificationItem[] = useMemo(() => {
    const items: DashboardNotificationItem[] = [];

    // 1. Announcements
    announcements.forEach(a => {
      const matchDept = a.department === 'All' || a.department === profile?.department;
      if (matchDept) {
        const ts = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        items.push({
          id: 'ann_' + a.id,
          type: 'announcement',
          title: a.title,
          subtitle: `${a.department === 'All' ? 'School-Wide' : a.department} • ${a.category}`,
          timeStr: a.createdAt ? new Date(a.createdAt).toLocaleDateString() : 'Recent',
          timestamp: ts,
          isUnread: ts > lastSeenMs,
          actionTab: 'announcements',
          badge: a.pinned ? 'Pinned Notice' : 'Notice',
          isPinned: Boolean(a.pinned)
        });
      }
    });

    // 2. Learning Materials & Past Questions (resources)
    deptResources.forEach(r => {
      const ts = r.createdAt ? new Date(r.createdAt).getTime() : 0;
      items.push({
        id: 'mat_' + r.id,
        type: 'material',
        title: `${r.courseCode}: ${r.title}`,
        subtitle: `New ${r.category} for ${r.level} • ${r.semester}`,
        timeStr: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'Recent',
        timestamp: ts,
        isUnread: ts > lastSeenMs,
        actionTab: 'resources',
        badge: r.category
      });
    });

    // 3. Courses
    courses.forEach(c => {
      if (c.createdAt && c.department === profile?.department) {
        const ts = new Date(c.createdAt).getTime();
        items.push({
          id: 'crs_' + c.id,
          type: 'course',
          title: `${c.code}: ${c.title}`,
          subtitle: `Enrolled Course • ${c.level} ${c.semester}`,
          timeStr: new Date(c.createdAt).toLocaleDateString(),
          timestamp: ts,
          isUnread: ts > lastSeenMs,
          actionTab: 'resources',
          badge: 'Course'
        });
      }
    });

    // 4. Timetables
    timetables.forEach(t => {
      if (t.createdAt && t.department === profile?.department) {
        const ts = new Date(t.createdAt).getTime();
        items.push({
          id: 'tt_' + t.id,
          type: 'timetable',
          title: `${t.type === 'exam' ? 'Exam' : 'Class'}: ${t.courseCode}`,
          subtitle: `${t.day} • ${t.startTime} (${t.venue})`,
          timeStr: new Date(t.createdAt).toLocaleDateString(),
          timestamp: ts,
          isUnread: ts > lastSeenMs,
          actionTab: 'timetables',
          badge: t.type === 'exam' ? 'Exam Timetable' : 'Timetable'
        });
      }
    });

    // 5. Links & Communities
    links.forEach(l => {
      if (l.active !== false && (l.audience === 'All' || l.audience === profile?.department)) {
        const ts = l.createdAt ? new Date(l.createdAt).getTime() : 0;
        items.push({
          id: 'lnk_' + l.id,
          type: 'link',
          title: l.name,
          subtitle: `${l.category} • ${l.audience}`,
          timeStr: l.createdAt ? new Date(l.createdAt).toLocaleDateString() : 'Recent',
          timestamp: ts,
          isUnread: ts > lastSeenMs,
          actionTab: 'links',
          badge: 'Community'
        });
      }
    });

    // 6. To-Do Reminders (due today, due tomorrow, overdue)
    const todayStr = getLagosDateString();
    const tomorrowStr = getLagosDateString(new Date(Date.now() + 86400000));
    (profile?.studyPlanner || []).forEach(task => {
      if (!task.done && task.dueDate) {
        let badge = 'Task';
        let isUrgent = false;
        if (task.dueDate === todayStr) {
          badge = 'Due Today';
          isUrgent = true;
        } else if (task.dueDate === tomorrowStr) {
          badge = 'Due Tomorrow';
          isUrgent = true;
        } else if (task.dueDate < todayStr) {
          badge = 'Overdue Task';
          isUrgent = true;
        }
        if (isUrgent) {
          items.push({
            id: 'task_' + task.id,
            type: 'todo',
            title: task.title,
            subtitle: `${task.courseCode ? `${task.courseCode} • ` : ''}Due: ${task.dueDate}`,
            timeStr: badge,
            timestamp: Date.now() + (badge === 'Overdue Task' ? 1000 : 500),
            isUnread: true,
            actionTab: 'study-planner',
            badge
          });
        }
      }
    });

    items.sort((a, b) => b.timestamp - a.timestamp);
    return items;
  }, [announcements, deptResources, courses, timetables, links, profile?.studyPlanner, profile?.department, lastSeenMs]);

  const unreadNotificationsCount = useMemo(() => {
    return dashboardNotifications.filter(n => n.isUnread).length;
  }, [dashboardNotifications]);

  const unreadAnnouncementsCount = useMemo(() => {
    return relevantAnnouncements.filter(a => a.createdAt && new Date(a.createdAt).getTime() > lastSeenMs).length;
  }, [relevantAnnouncements, lastSeenMs]);

  // Mark all notifications as seen
  const handleMarkAllNotificationsRead = async () => {
    const nowIso = new Date().toISOString();
    setNotificationsLastSeen(nowIso);
    localStorage.setItem('sot_notifications_last_seen', nowIso);
    if (auth.currentUser) {
      try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          notificationsLastSeen: nowIso,
          lastSeenAnnouncements: nowIso
        });
      } catch (err) {
        // ignore
      }
    }
    if (profile) {
      const updated = { ...profile, notificationsLastSeen: nowIso, lastSeenAnnouncements: nowIso };
      localStorage.setItem('sot_local_profile', JSON.stringify(updated));
    }
  };

  const handleOpenAnnouncements = () => {
    setActiveTab('announcements');
    setSidebarOpen(false);
    handleMarkAllNotificationsRead();
  };

  const studentDepartment = DEPARTMENTS.find((d) => d.name === profile?.department) || DEPARTMENTS[1];

  const studentFirstName = useMemo(() => {
    if (profile?.fullName?.trim()) {
      return profile.fullName.trim().split(' ')[0];
    }
    if (user?.email) {
      const namePart = user.email.split('@')[0];
      return namePart.charAt(0).toUpperCase() + namePart.slice(1);
    }
    return 'Student';
  }, [profile?.fullName, user?.email]);

  const studentInitial = useMemo(() => {
    if (profile?.fullName?.trim()) {
      return profile.fullName.trim().charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'S';
  }, [profile?.fullName, user?.email]);

  // Universal Search across Courses, Materials, Past Questions, and Announcements
  const universalSearchResults = useMemo(() => {
    if (!homeSearchQuery.trim()) return null;
    const q = homeSearchQuery.toLowerCase();

    const matchedCourses = courses.filter(
      c => c.department === studentDept && (c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
    );

    const matchedMaterials: Array<{ id: string; title: string; courseCode: string; category: string; url: string }> = [];
    courses.forEach(c => {
      if (c.department === studentDept && c.materials) {
        c.materials.forEach((m, idx) => {
          if (m.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) {
            matchedMaterials.push({
              id: m.id || `${c.code}_${idx}`,
              title: m.title,
              courseCode: c.code,
              category: m.category,
              url: m.url
            });
          }
        });
      }
    });

    deptResources.forEach(r => {
      if (r.department === studentDept && (r.title.toLowerCase().includes(q) || r.courseCode.toLowerCase().includes(q))) {
        matchedMaterials.push({
          id: r.id,
          title: r.title,
          courseCode: r.courseCode,
          category: r.category,
          url: r.url
        });
      }
    });

    const matchedAnnouncements = relevantAnnouncements.filter(
      a => a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)
    );

    return {
      courses: matchedCourses.slice(0, 4),
      materials: matchedMaterials.slice(0, 4),
      announcements: matchedAnnouncements.slice(0, 3)
    };
  }, [homeSearchQuery, courses, deptResources, relevantAnnouncements, studentDept]);

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
      if (user?.uid) {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            level: editLevel
          });
        } catch (e) {
          console.warn('Level save error:', e);
        }
      }
      await updateStudentProfile(editFullName, newPassword || undefined);
      await refreshProfile();
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
    const newAnn = {
      title: repTitle.trim(),
      content: repContent.trim(),
      category: repCategory,
      department: studentDept, // STRICTLY LOCKED to own department
      urgent: repUrgent,
      pinned: repPinned,
      author: `${profile?.fullName || 'Student'} (Course Rep)`,
      uploadedBy: user?.uid || '',
      uploadedByEmail: user?.email || '',
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
      setRepPinned(false);
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
    <div className="min-h-screen bg-[#0A1224] text-[#E6ECFA] flex flex-col md:flex-row pb-20 md:pb-0">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between h-14 px-4 bg-[#0A1224] border-b border-[#24315A] sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#121C36] border border-[#24315A] flex items-center justify-center text-[#FFC700]">
            <GraduationCap className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-sm text-[#E6ECFA]">
            SOT Student Desk
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell Dropdown (Single Bell) */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notifications"
              className="relative p-2 rounded-xl bg-[#121C36] border border-[#24315A] text-[#9AA8C7] hover:text-[#FFC700] cursor-pointer transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-bold text-[9px] animate-pulse">
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            <NotificationsPopover
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
              notifications={dashboardNotifications}
              unreadCount={unreadNotificationsCount}
              onMarkAllAsRead={handleMarkAllNotificationsRead}
              onSelectNotification={(tab) => {
                setActiveTab(tab);
                setSidebarOpen(false);
              }}
            />
          </div>

          {/* Student Avatar Icon */}
          <button
            onClick={() => setActiveTab('profile')}
            title="Profile & Settings"
            className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-[#2F52FF] text-white border-[#FFC700] ring-2 ring-[#FFC700]/30 shadow-sm'
                : 'bg-[#121C36] text-[#FFC700] border-[#24315A] hover:border-[#2F52FF]'
            }`}
          >
            {studentInitial}
          </button>
        </div>
      </div>

      {/* Desktop Sidebar Navigation (Hidden for students on mobile in favor of bottom tab bar) */}
      <aside
        className="hidden md:flex md:sticky top-0 z-40 h-screen w-72 bg-[#0A1224] border-r border-[#24315A] flex-col justify-between p-5"
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
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px]  text-[#9AA8C7]">
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
              onClick={() => { setActiveTab('resources'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'resources' || activeTab === 'courses'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
              }`}
            >
              <div className="flex items-center gap-3">
                <BookOpen className="w-4 h-4 text-[#FFC700]" />
                <span>Academic Resources</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#121C36] text-[#9AA8C7] border border-[#24315A]">
                {courses.length}
              </span>
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

            {/* Bookmarks Tab */}
            <button
              onClick={() => { setActiveTab('bookmarks'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'bookmarks'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Bookmark className="w-4 h-4 text-[#FFC700]" />
                <span>Bookmarks</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#121C36] text-[#FFC700] border border-[#24315A] font-bold">
                {(profile?.bookmarks || []).length}
              </span>
            </button>

            {/* Communities & Links Tab */}
            <button
              onClick={() => { setActiveTab('links'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'links'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Link2 className="w-4 h-4 text-[#FFC700]" />
                <span>Communities &amp; Links</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#121C36] text-[#25D366] border border-[#24315A] font-bold">
                Hub
              </span>
            </button>

            {/* GPA / CGPA Calculator Tab */}
            <button
              onClick={() => { setActiveTab('gpa'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'gpa'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Calculator className="w-4 h-4 text-[#FFC700]" />
                <span>GPA Calculator</span>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FFC700]/20 text-[#FFC700] border border-[#FFC700]/30">
                4.00
              </span>
            </button>

            {/* Study Planner Tab */}
            <button
              onClick={() => { setActiveTab('study-planner'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'study-planner'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
              }`}
            >
              <div className="flex items-center gap-3">
                <ListTodo className="w-4 h-4 text-[#FFC700]" />
                <span>Study Planner</span>
              </div>
              {(profile?.studyPlanner || []).filter(t => !t.done).length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  {(profile?.studyPlanner || []).filter(t => !t.done).length}
                </span>
              )}
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

            {/* Course Rep Desk Sidebar Navigation Link (Reps and Admins) */}
            {(isRep || isAdmin) && (
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
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-950/20 cursor-pointer transition-colors"
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
                <p className=" text-[11px] text-rose-300 mt-0.5 break-all">
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
        
        {/* PAGE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#24315A]">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-[#9AA8C7]">
              <span>School of Technology</span>
              <span>/</span>
              <span className="text-[#FFC700] font-semibold capitalize">
                {activeTab === 'rep-announcement' ? 'Course Rep Announcement' : activeTab === 'my-messages' ? 'Complaint & Message Tracking' : activeTab === 'gpa' ? 'GPA Calculator' : activeTab === 'study-planner' ? 'Study Planner' : activeTab === 'links' ? 'Communities & Links' : activeTab}
              </span>
            </div>
            <h1 className="font-heading font-bold text-xl sm:text-[22px] text-[#E6ECFA] mt-0.5">
              {activeTab === 'overview' && 'Student Portal Overview'}
              {activeTab === 'department' && 'My Enrolled Department'}
              {activeTab === 'resources' && 'Curriculum & Study Materials'}
              {activeTab === 'courses' && 'Department Courses & Learning Materials'}
              {activeTab === 'timetables' && 'Department Timetables & Exam Schedules'}
              {activeTab === 'announcements' && 'Student Bulletins & Notices'}
              {activeTab === 'bookmarks' && 'My Bookmarked Items'}
              {activeTab === 'links' && 'Communities & Essential Links'}
              {activeTab === 'gpa' && 'GPA & CGPA Calculator'}
              {activeTab === 'study-planner' && 'Study Planner & To-Dos'}
              {activeTab === 'my-messages' && 'My Complaints & Message Tracking'}
              {activeTab === 'rep-announcement' && 'Course Representative Bulletin Desk'}
              {activeTab === 'ask-ai' && 'Ask AI Academic Tutor'}
              {activeTab === 'profile' && 'Student Profile Settings'}
            </h1>
          </div>

          {/* Desktop Top Bar: Single Bell + Avatar */}
          <div className="hidden md:flex items-center gap-2.5">
            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                title="Notifications"
                className="relative p-2 rounded-xl bg-[#121C36] border border-[#24315A] text-[#9AA8C7] hover:text-[#FFC700] cursor-pointer transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-bold text-[9px] animate-pulse">
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </span>
                )}
              </button>

              <NotificationsPopover
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
                notifications={dashboardNotifications}
                unreadCount={unreadNotificationsCount}
                onMarkAllAsRead={handleMarkAllNotificationsRead}
                onSelectNotification={(tab) => {
                  setActiveTab(tab);
                  setSidebarOpen(false);
                }}
              />
            </div>

            {/* Student Avatar */}
            <button
              onClick={() => setActiveTab('profile')}
              title="Profile & Settings"
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-[#2F52FF] text-white border-[#FFC700]'
                  : 'bg-[#121C36] text-[#E6ECFA] border-[#24315A] hover:border-[#2F52FF]'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-[#0A1224] text-[#FFC700] font-bold text-xs flex items-center justify-center border border-[#FFC700]/30">
                {studentInitial}
              </div>
              <span className="text-xs font-semibold max-w-[120px] truncate">{studentFirstName}</span>
            </button>
          </div>
        </div>

        {/* Global Bookmarks Toast Alert */}
        {bookmarkToast && (
          <div className="p-3 rounded-xl bg-[#121C36] border border-[#FFC700]/50 text-xs text-[#E6ECFA] flex items-center justify-between shadow-[0_4px_20px_rgba(255,199,0,0.2)]">
            <div className="flex items-center gap-2.5">
              <BookmarkCheck className="w-4 h-4 text-[#FFC700] shrink-0" />
              <span>{bookmarkToast}</span>
            </div>
            <button
              onClick={() => setActiveTab('bookmarks')}
              className="text-[#FFC700] font-bold hover:underline ml-3 shrink-0 cursor-pointer"
            >
              View Bookmarks &rarr;
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 1: OVERVIEW (Simplified Student Home)                */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-2 sm:space-y-2.5 max-w-2xl mx-auto">

            {/* 1. Compact Greeting Card */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-[#0E1A38] via-[#12224A] to-[#1A2E63] border border-[#24315A] shadow-[0_4px_20px_rgba(47,82,255,0.12)] space-y-2.5">
              <div>
                <h2 className="font-heading font-bold text-base sm:text-lg text-[#E6ECFA] tracking-tight flex items-center gap-1.5">
                  <span>{lagosGreetingData.greeting}, {studentFirstName}!</span>
                  {lagosGreetingData.period === 'morning' && <span className="text-amber-400">☀️</span>}
                  {lagosGreetingData.period === 'afternoon' && <span className="text-[#FFC700]">⛅</span>}
                  {lagosGreetingData.period === 'evening' && <span className="text-indigo-400">🌅</span>}
                  {lagosGreetingData.period === 'night' && <span className="text-blue-300">🌙</span>}
                </h2>
                <p className="text-xs text-[#9AA8C7] mt-0.5">
                  {lagosGreetingData.messages[greetingMsgIdx % lagosGreetingData.messages.length]}
                </p>
              </div>

              {/* Department & Level Chips + GPA & Tasks Shortcuts */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#24315A]/60 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-[#0A1224]/80 border border-[#24315A] text-[#FFC700] text-[11px] font-semibold flex items-center gap-1">
                    <GraduationCap className="w-3 h-3 text-[#FFC700]" />
                    <span>{profile?.department || studentDept}</span>
                  </span>

                  {(profile?.level || editLevel) && (
                    <span className="px-2 py-0.5 rounded-md bg-[#2F52FF]/20 border border-[#2F52FF]/40 text-[#E6ECFA] text-[11px] font-semibold flex items-center gap-1">
                      <span className="text-[10px] text-[#FFC700] uppercase font-bold">Level:</span>
                      <span>{profile?.level || editLevel}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  <button
                    onClick={() => setActiveTab('gpa')}
                    className="px-2.5 py-0.5 rounded-md bg-[#0A1224]/80 border border-[#24315A] hover:border-[#FFC700] text-[#FFC700] text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Calculator className="w-3 h-3" />
                    <span>GPA</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('study-planner')}
                    className="px-2.5 py-0.5 rounded-md bg-[#0A1224]/80 border border-[#24315A] hover:border-[#2F52FF] text-[#60A5FA] text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <ListTodo className="w-3 h-3" />
                    <span>Tasks</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Universal Search Bar */}
            <div className="relative">
              <div className="relative">
                <Search className="w-4 h-4 text-[#9AA8C7] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={homeSearchQuery}
                  onChange={e => setHomeSearchQuery(e.target.value)}
                  placeholder="Search courses, notes, past questions"
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#62759F] focus:outline-none focus:border-[#2F52FF] transition-all"
                />
                {homeSearchQuery && (
                  <button
                    onClick={() => setHomeSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-[#9AA8C7] hover:text-white"
                  >
                    &times;
                  </button>
                )}
              </div>

              {/* Universal Search Results Popover */}
              {universalSearchResults && (
                <div className="mt-2 p-3 rounded-xl bg-[#0F1E36] border border-[#24315A] shadow-2xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-[#9AA8C7] pb-1 border-b border-[#1F2C4C]">
                    <span>Results for &ldquo;{homeSearchQuery}&rdquo;</span>
                    <button
                      onClick={() => setHomeSearchQuery('')}
                      className="text-xs text-[#9AA8C7] hover:text-white cursor-pointer"
                    >
                      Close
                    </button>
                  </div>

                  {universalSearchResults.courses.length === 0 &&
                   universalSearchResults.materials.length === 0 &&
                   universalSearchResults.announcements.length === 0 ? (
                    <p className="text-xs text-[#9AA8C7] py-2 text-center">
                      No matches found. Try searching by course code (e.g. COM 111) or title.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {universalSearchResults.courses.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase font-bold text-[#FFC700] mb-1">Courses</p>
                          <div className="space-y-1">
                            {universalSearchResults.courses.map((c: CourseItem) => (
                              <button
                                key={c.id}
                                onClick={() => { setActiveTab('resources'); setHomeSearchQuery(''); }}
                                className="w-full text-left p-2 rounded-lg bg-[#121C36] hover:bg-[#1A2E63] text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors"
                              >
                                <span className="font-semibold text-[#E6ECFA] truncate">{c.code}: {c.title}</span>
                                <span className="text-[10px] text-[#FFC700] shrink-0">{c.units} Units &rarr;</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {universalSearchResults.materials.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase font-bold text-[#2F52FF] mb-1">Materials &amp; Past Questions</p>
                          <div className="space-y-1">
                            {universalSearchResults.materials.map((m: { id: string; title: string; courseCode: string; category: string; url: string }) => (
                              <div
                                key={m.id}
                                className="p-2 rounded-lg bg-[#121C36] text-xs flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <p className="font-medium text-[#E6ECFA] truncate">{m.title}</p>
                                  <span className="text-[10px] text-[#9AA8C7]">{m.courseCode} • {m.category}</span>
                                </div>
                                {m.url && (
                                  <a
                                    href={m.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-0.5 rounded bg-[#2F52FF] text-white text-[10px] font-semibold shrink-0 hover:bg-[#2544DD]"
                                  >
                                    Open
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {universalSearchResults.announcements.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase font-bold text-emerald-400 mb-1">Announcements</p>
                          <div className="space-y-1">
                            {universalSearchResults.announcements.map((a: AnnouncementItem) => (
                              <button
                                key={a.id}
                                onClick={() => { setActiveTab('announcements'); setHomeSearchQuery(''); }}
                                className="w-full text-left p-2 rounded-lg bg-[#121C36] hover:bg-[#1A2E63] text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors"
                              >
                                <span className="font-semibold text-[#E6ECFA] truncate">{a.title}</span>
                                <span className="text-[10px] text-emerald-400 shrink-0">View &rarr;</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Slim One-Row Streak Card */}
            <DailyStreakCard
              streakCount={profile?.streakCount || 1}
              longestStreak={profile?.longestStreak || profile?.streakCount || 1}
              lastActiveDate={profile?.lastActiveDate}
            />

            {/* 4. Announcements (Pinned first, max 2 items, single compact row with See All) */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-[#121C36] border border-[#24315A] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#E6ECFA]">
                  <Bell className="w-3.5 h-3.5 text-[#FFC700]" />
                  <span>Announcements</span>
                  {unreadAnnouncementsCount > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-600 text-white">
                      {unreadAnnouncementsCount}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleOpenAnnouncements}
                  className="text-[11px] font-semibold text-[#FFC700] hover:underline cursor-pointer"
                >
                  See all &rarr;
                </button>
              </div>

              {homeAnnouncements.length === 0 ? (
                <p className="text-xs text-[#9AA8C7]">No announcements posted yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {homeAnnouncements.map((a) => (
                    <button
                      key={a.id}
                      onClick={handleOpenAnnouncements}
                      className="w-full text-left p-2 rounded-lg bg-[#0A1224]/70 hover:bg-[#1A2E63] border border-[#24315A]/60 flex items-center justify-between gap-2 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {a.pinned && (
                          <Pin className="w-3 h-3 text-[#FFC700] fill-[#FFC700] shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-[#E6ECFA] truncate group-hover:text-white">
                          {a.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#FFC700] shrink-0 font-medium">Read &rarr;</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Today's Timetable (Compact card with today's classes and next exam line) */}
            {(() => {
              const todayLagosDay = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Africa/Lagos',
                weekday: 'long'
              }).format(new Date());

              const todayClasses = timetables.filter(t =>
                t.department === studentDept &&
                t.day === todayLagosDay &&
                t.type === 'class'
              );

              return (
                <div className="p-3 sm:p-3.5 rounded-xl bg-[#121C36] border border-[#24315A] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#E6ECFA] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#FFC700]" />
                      <span>Today ({todayLagosDay})</span>
                    </span>
                    <button
                      onClick={() => setActiveTab('timetables')}
                      className="text-[11px] font-semibold text-[#FFC700] hover:underline cursor-pointer"
                    >
                      Full timetable &rarr;
                    </button>
                  </div>

                  {todayClasses.length === 0 ? (
                    <p className="text-xs text-[#9AA8C7]">No classes scheduled today.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {todayClasses.map(c => (
                        <div
                          key={c.id}
                          className="p-2 rounded-lg bg-[#0A1224]/70 border border-[#24315A]/60 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-[#FFC700] truncate">{c.courseCode}</span>
                            <span className="text-[#9AA8C7] truncate text-[11px]">• {c.venue}</span>
                          </div>
                          <span className="text-[10px] font-semibold text-[#E6ECFA] shrink-0 bg-[#2F52FF]/20 px-2 py-0.5 rounded border border-[#2F52FF]/30">
                            {c.startTime}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Next exam integrated line */}
                  {nextExamInfo && (
                    <div className="pt-2 border-t border-[#24315A]/60 flex items-center justify-between text-[11px]">
                      <span className="text-[#9AA8C7] flex items-center gap-1.5 truncate">
                        <Clock className="w-3 h-3 text-[#FFC700] shrink-0" />
                        <span className="truncate">
                          {nextExamInfo.diffDays === 0
                            ? `Next exam today (${nextExamInfo.entry.courseCode})`
                            : nextExamInfo.diffDays === 1
                            ? `Next exam tomorrow (${nextExamInfo.entry.courseCode})`
                            : `Next exam in ${nextExamInfo.diffDays} days (${nextExamInfo.entry.courseCode})`}
                        </span>
                      </span>
                      <button
                        onClick={() => setActiveTab('timetables')}
                        className="text-[#60A5FA] hover:underline font-medium shrink-0 ml-2 cursor-pointer"
                      >
                        View
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 6. Slim One-Row "Join our WhatsApp channel" button (only if link saved in Settings) */}
            {settings.whatsappChannelUrl && (
              <a
                href={settings.whatsappChannelUrl.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full p-2.5 sm:p-3 rounded-xl bg-[#121C36] border border-[#25D366]/40 hover:border-[#25D366] text-[#E6ECFA] hover:text-white flex items-center justify-between gap-2.5 transition-all cursor-pointer shadow-sm group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(37,211,102,0.4)]">
                    <WhatsAppIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-xs font-semibold truncate">
                    Join our WhatsApp channel
                  </span>
                </div>
                <span className="text-[11px] font-bold text-[#25D366] flex items-center gap-1 shrink-0 group-hover:translate-x-0.5 transition-transform">
                  <span>Join</span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              </a>
            )}

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
                  <span className="text-xs  font-bold px-2 py-0.5 rounded bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
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
        {(activeTab === 'resources' || activeTab === 'courses') && (
          <StudentResourcesView
            courses={courses}
            resources={deptResources}
            userLevel={profile?.level || editLevel}
            department={studentDept}
            isBookmarked={isBookmarked}
            toggleBookmark={toggleBookmark}
            bookmarks={profile?.bookmarks || []}
            onNavigateLinks={() => setActiveTab('links')}
          />
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
                              <span className=" text-xs font-extrabold px-2.5 py-1 rounded bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
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
                          <span className="px-2.5 py-1 rounded bg-[#0A1224] text-[#FFC700]  text-xs font-bold border border-[#24315A]">
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
                        ann.pinned
                          ? 'border-[#FFC700]/70 bg-gradient-to-r from-[#121C36] via-[#121C36] to-[#FFC700]/5 shadow-[0_0_20px_rgba(255,199,0,0.1)]'
                          : isUnread
                          ? 'border-[#FFC700] shadow-[0_0_20px_rgba(255,199,0,0.15)]'
                          : 'border-[#24315A] hover:border-[#2F52FF]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {ann.pinned && (
                            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#FFC700] text-[#0A1224] flex items-center gap-1 shadow-sm">
                              <Pin className="w-3 h-3 fill-[#0A1224]" />
                              <span>PINNED</span>
                            </span>
                          )}
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
                        <div className="flex items-center gap-3">
                          <span className="text-xs  text-[#9AA8C7]">
                            {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              toggleBookmark({
                                id: ann.id,
                                type: 'announcement',
                                title: ann.title,
                                category: ann.category,
                                department: ann.department
                              });
                            }}
                            title={isBookmarked('announcement', ann.id) ? 'Remove Bookmark' : 'Bookmark Announcement'}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isBookmarked('announcement', ann.id)
                                ? 'bg-[#FFC700]/20 border-[#FFC700] text-[#FFC700]'
                                : 'bg-[#0A1224] border-[#24315A] text-[#9AA8C7] hover:text-[#FFC700]'
                            }`}
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked('announcement', ann.id) ? 'fill-[#FFC700]' : ''}`} />
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
                        <span>Broadcast by: <strong className="text-[#E6ECFA]">{ann.author || 'Student Administration'}</strong></span>
                        <span className=" text-[#FFC700]">Audience: {ann.department}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW: BOOKMARKS                                          */}
        {/* ======================================================== */}
        {activeTab === 'bookmarks' && (
          <StudentBookmarksView
            bookmarks={profile?.bookmarks || []}
            onRemove={(item) => toggleBookmark(item)}
            onNavigateCourses={() => setActiveTab('courses')}
            onNavigateAnnouncements={() => setActiveTab('announcements')}
          />
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

                      <span className="text-xs  text-[#9AA8C7]">
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
                            <span className="text-[11px]  text-[#9AA8C7]">
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
                  <span className="text-[10px] text-[#9AA8C7] ml-auto font-normal ">Department Locked</span>
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

                <div className="flex items-center gap-5 pt-6 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#E6ECFA]">
                    <input
                      type="checkbox"
                      checked={repUrgent}
                      onChange={(e) => setRepUrgent(e.target.checked)}
                      className="w-4 h-4 rounded text-[#2F52FF] focus:ring-0 bg-[#0A1224] border-[#24315A]"
                    />
                    <span className="text-rose-400">Mark as Urgent Notice</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#E6ECFA]">
                    <input
                      type="checkbox"
                      checked={repPinned}
                      onChange={(e) => setRepPinned(e.target.checked)}
                      className="w-4 h-4 rounded text-[#FFC700] focus:ring-0 bg-[#0A1224] border-[#24315A]"
                    />
                    <span className="text-[#FFC700] flex items-center gap-1 font-bold">
                      <Pin className="w-3.5 h-3.5 fill-[#FFC700]" />
                      <span>Pin Announcement</span>
                    </span>
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
                    <span className="text-[10px]  text-[#FFC700] px-2 py-0.5 rounded bg-[#0A1224] border border-[#24315A]">
                      Locked &amp; Immutable
                    </span>
                  </div>
                  <input
                    type="text"
                    disabled
                    value={profile?.matricNumber || 'NOT ASSIGNED'}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-sm  font-bold text-[#FFC700] cursor-not-allowed opacity-80"
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

                {/* Academic Level (Optional) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#9AA8C7]">
                      Academic Level (Optional)
                    </label>
                    <span className="text-[10px] text-[#FFC700] px-2 py-0.5 rounded bg-[#0A1224] border border-[#24315A]">
                      Auto-filters Resources &amp; Timetables
                    </span>
                  </div>
                  <select
                    value={editLevel}
                    onChange={(e) => setEditLevel(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs font-semibold text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF] cursor-pointer"
                  >
                    <option value="ND1">ND I (National Diploma 1)</option>
                    <option value="ND2">ND II (National Diploma 2)</option>
                    <option value="HND1">HND I (Higher National Diploma 1)</option>
                    <option value="HND2">HND II (Higher National Diploma 2)</option>
                  </select>
                  <p className="text-[11px] text-[#9AA8C7] mt-1">
                    When configured, your course materials and timetables default to your current academic level.
                  </p>
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

              {/* Install SOT App (PWA) under Profile Settings */}
              <div className="pt-4 border-t border-[#24315A]">
                <PWAInstallRow />
              </div>

            </div>

            {/* Very bottom of Profile Page: Full-Width Outlined Red Log out button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full py-3.5 px-4 rounded-xl border border-rose-500/50 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 hover:border-rose-400 font-bold text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-sm group"
              >
                <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                <span>Log out</span>
              </button>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 8: ASK AI (Full Page Workspace)                    */}
        {/* ======================================================== */}
        {activeTab === 'ask-ai' && (
          <AskAiView />
        )}

        {/* ======================================================== */}
        {/* VIEW 9: GPA / CGPA CALCULATOR                            */}
        {/* ======================================================== */}
        {activeTab === 'gpa' && (
          <GpaCalculator />
        )}

        {/* ======================================================== */}
        {/* VIEW 10: STUDY PLANNER                                   */}
        {/* ======================================================== */}
        {activeTab === 'study-planner' && (
          <StudyPlanner />
        )}

        {/* ======================================================== */}
        {/* VIEW 11: COMMUNITIES & LINKS                             */}
        {/* ======================================================== */}
        {activeTab === 'links' && (
          <CommunitiesLinksView />
        )}

      </main>

      {/* Mobile Bottom Tab Bar (Students: Home, Resources, Timetable, Ask AI, Profile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A1224]/95 backdrop-blur-md border-t border-[#24315A] px-2 py-1.5 flex items-center justify-around safe-area-pb">
        {/* 1. Home */}
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'text-[#FFC700] font-bold'
              : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'overview' ? 'bg-[#2F52FF]/25 text-[#FFC700]' : ''}`}>
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Home</span>
        </button>

        {/* 2. Resources */}
        <button
          onClick={() => setActiveTab('resources')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'resources' || activeTab === 'courses' || activeTab === 'bookmarks'
              ? 'text-[#FFC700] font-bold'
              : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'resources' || activeTab === 'courses' || activeTab === 'bookmarks' ? 'bg-[#2F52FF]/25 text-[#FFC700]' : ''}`}>
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Resources</span>
        </button>

        {/* 3. Timetable */}
        <button
          onClick={() => setActiveTab('timetables')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'timetables'
              ? 'text-[#FFC700] font-bold'
              : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'timetables' ? 'bg-[#2F52FF]/25 text-[#FFC700]' : ''}`}>
            <Calendar className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Timetable</span>
        </button>

        {/* 4. Ask AI */}
        <button
          onClick={() => setActiveTab('ask-ai')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'ask-ai'
              ? 'text-[#FFC700] font-bold'
              : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'ask-ai' ? 'bg-[#2F52FF]/25 text-[#FFC700]' : ''}`}>
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Ask AI</span>
        </button>

        {/* 5. Links */}
        <button
          onClick={() => setActiveTab('links')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'links'
              ? 'text-[#FFC700] font-bold'
              : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'links' ? 'bg-[#2F52FF]/25 text-[#FFC700]' : ''}`}>
            <Link2 className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Links</span>
        </button>
      </nav>

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
