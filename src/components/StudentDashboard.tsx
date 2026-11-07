import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { DEPARTMENTS, INITIAL_ANNOUNCEMENTS } from '../data/departments';
import {
  auth,
  db,
  safeUpdateDoc as updateDoc,
  safeAddDoc as addDoc,
  cleanFirestoreData
} from '../lib/firebase';
import {
  collection,
  getDocs,
  doc,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import {
  AnnouncementItem,
  ContactMessage,
  TimetableEntry,
  CourseItem,
  CourseMaterial,
  ResourceItem,
  BookmarkItem,
  TopicItem,
  QuizItem,
  QuizAttempt
} from '../types';
import { getCourseAccent } from '../config/courseAccents';
import {
  INITIAL_COURSES,
  INITIAL_TIMETABLES,
  normalizeCourseLevel,
  normalizeCourseSemester,
  formatPdfUrl,
  getPdfDownloadUrl
} from '../data/coursesAndTimetables';
import { AskAiView } from './AskAiView';
import { DailyStreakCard } from './DailyStreakCard';
import { StudentBookmarksView } from './StudentBookmarksView';
import { GpaCalculator } from './GpaCalculator';
import { StudyPlanner } from './StudyPlanner';
import { WhatsAppIcon } from './WhatsAppIcon';
import { StudentResourcesView } from './StudentResourcesView';
import { StudentPastQuestionsView } from './StudentPastQuestionsView';
import { StudentQuizzesView } from './StudentQuizzesView';
import { StudentMockCbtView } from './StudentMockCbtView';
import { CommunitiesLinksView } from './CommunitiesLinksView';
import { NotificationsPopover, DashboardNotificationItem } from './NotificationsPopover';
import { PWAInstallRow } from './PWAInstallRow';
import { StudentBadgesView } from './StudentBadgesView';
import { WeeklyLeaderboardView } from './WeeklyLeaderboardView';
import { BadgeUnlockedModal } from './BadgeUnlockedModal';
import { OfflineBanner } from './OfflineBanner';
import { checkAndAwardBadges } from '../lib/badges';
import { setLeaderboardOptInStatus } from '../utils/leaderboard';
import { BadgeItem } from '../types';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { LinkItem } from '../types';
import {
  subscribeToPhoneNotifications,
  unsubscribeFromPhoneNotifications
} from '../lib/pushNotifications';
import {
  LayoutDashboard,
  Building2,
  Bell,
  User,
  LogOut,
  GraduationCap,
  X,
  Loader2,
  ShieldCheck,
  Calendar,
  Lock,
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
  CheckCheck,
  FileBadge2,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  FileQuestion,
  Download,
  Trophy,
  Award
} from 'lucide-react';
import { ShareButton } from './ShareButton';
import { SITE_CONFIG } from '../config/site';

interface StudentDashboardProps {
  onNavigateHome: () => void;
  onNavigateContact: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateAdmin?: () => void;
  onNavigateRep?: () => void;
}

type TabType =
  | 'overview'
  | 'courses'
  | 'past-questions'
  | 'quizzes'
  | 'mock-cbt'
  | 'badges'
  | 'leaderboard'
  | 'ask-ai'
  | 'profile'
  | 'timetables'
  | 'announcements'
  | 'gpa'
  | 'study-planner'
  | 'bookmarks'
  | 'links'
  | 'my-messages'
  | 'rep-announcement';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ACADEMIC_LEVELS = ['ND1', 'ND2', 'HND1', 'HND2'] as const;

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
        "Review today's classes and syllabus topics.",
        "Check your lecture schedule and plan your day.",
        "Great morning to learn something new. Stay focused!"
      ]
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      greeting: 'Good afternoon',
      period: 'afternoon',
      messages: [
        "Powering through lectures and practicals.",
        "Catch up on course handouts and assignments.",
        "Stay hydrated and keep up your academic momentum!"
      ]
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      greeting: 'Good evening',
      period: 'evening',
      messages: [
        "Time to review today's lecture notes and topics.",
        "Glance over tomorrow's timetable and prepare.",
        "Evenings are prime time for past questions revision."
      ]
    };
  } else {
    return {
      greeting: 'Good night',
      period: 'night',
      messages: [
        "Rest well and recharge for tomorrow's academic goals.",
        "A peaceful night's rest is part of smart study preparation."
      ]
    };
  }
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  onNavigateHome,
  onNavigateContact,
  onNavigatePrivacy,
  onNavigateAdmin,
  onNavigateRep
}) => {
  const { user, profile, isAdmin, isRep, roleReadError, refreshProfile, logout, updateStudentProfile, upgradeJambToMatric } = useAuth();
  const { settings } = useSiteSettings();

  // Active navigation state
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isInner, setIsInner] = useState<boolean>(false);
  const [innerTitle, setInnerTitle] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Logout confirmation sheet
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Badges & Leaderboard states
  const [recentlyAwardedBadge, setRecentlyAwardedBadge] = useState<BadgeItem | null>(null);
  const [leaderboardOptInSaving, setLeaderboardOptInSaving] = useState(false);

  // Student Department is AUTOMATIC - strictly locked to enrolled department
  const studentDept = profile?.department || 'Computer Technology';
  const studentInitial = (profile?.fullName || user?.email || 'S').charAt(0).toUpperCase();

  const handleToggleLeaderboardOptIn = async () => {
    if (!user?.uid || leaderboardOptInSaving) return;
    setLeaderboardOptInSaving(true);
    const nextVal = !Boolean(profile?.showOnLeaderboard);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        showOnLeaderboard: nextVal
      });
      await setLeaderboardOptInStatus({
        uid: user.uid,
        department: studentDept,
        fullName: profile?.fullName,
        optIn: nextVal
      });
      await refreshProfile();
    } catch (err) {
      console.warn('Failed to update leaderboard preference:', err);
    } finally {
      setLeaderboardOptInSaving(false);
    }
  };

  // Home Filters: Defaults to student's level and 1st semester
  const defaultLevel = profile?.level ? normalizeCourseLevel(profile.level) : 'ND1';
  const [homeLevelFilter, setHomeLevelFilter] = useState<'ND1' | 'ND2' | 'HND1' | 'HND2'>(defaultLevel);
  const [homeSemesterFilter, setHomeSemesterFilter] = useState<'First Semester' | 'Second Semester' | 'All'>('First Semester');
  const [homeSearchQuery, setHomeSearchQuery] = useState('');

  // Core Data
  const [courses, setCourses] = useState<CourseItem[]>(INITIAL_COURSES);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [deptResources, setDeptResources] = useState<ResourceItem[]>([]);
  const [timetables, setTimetables] = useState<TimetableEntry[]>(INITIAL_TIMETABLES);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(INITIAL_ANNOUNCEMENTS);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [deptQuizzes, setDeptQuizzes] = useState<QuizItem[]>([]);
  const [studentQuizAttempts, setStudentQuizAttempts] = useState<QuizAttempt[]>([]);
  const [studentActivities, setStudentActivities] = useState<Array<{ id: string; type: string; title: string; timestamp?: string }>>([]);
  const [myMessages, setMyMessages] = useState<ContactMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Notifications State
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsLastSeen, setNotificationsLastSeen] = useState<string>(() => {
    return (profile as any)?.notificationsLastSeen || localStorage.getItem('sot_notifications_last_seen') || '';
  });

  // Profile Edit State
  const [editFullName, setEditFullName] = useState(profile?.fullName || '');
  const [editLevel, setEditLevel] = useState<string>(profile?.level || 'ND1');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // JAMB -> Matric Upgrade state
  const [upgradeMatricInput, setUpgradeMatricInput] = useState('');
  const [upgradeSaving, setUpgradeSaving] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState<string | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  // Bookmark Toast
  const [bookmarkToast, setBookmarkToast] = useState<string | null>(null);

  // Course & Lesson Resume State
  const [resumeCourseId, setResumeCourseId] = useState<string | null>(null);
  const [resumeTopicId, setResumeTopicId] = useState<string | null>(null);
  const [aiPromptContext, setAiPromptContext] = useState<string | null>(null);

  const handleUpdateCompletedTopics = async (completed: string[]) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        completedTopics: completed
      });
      await refreshProfile();
    } catch (err) {
      console.warn('Failed to save completedTopics:', err);
    }
  };

  const handleUpdateLastTopic = async (last: {
    topicId: string;
    topicTitle: string;
    courseId: string;
    courseCode: string;
    courseTitle: string;
  }) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        lastTopic: last
      });
      await refreshProfile();
    } catch (err) {
      console.warn('Failed to save lastTopic:', err);
    }
  };

  const handleResumeLastTopic = (lastTopic: {
    courseId: string;
    topicId: string;
    courseCode?: string;
    courseTitle?: string;
    topicTitle?: string;
  }) => {
    setResumeCourseId(lastTopic.courseId);
    setResumeTopicId(lastTopic.topicId);
    setActiveTab('courses');
    setIsInner(true);
    setInnerTitle(lastTopic.courseCode || 'Course');
  };

  const handleAskAiAboutTopic = (contextText: string, topicTitle: string) => {
    setAiPromptContext(
      `Regarding the syllabus topic "${topicTitle}":\n\n${contextText}\n\nPlease explain the core concepts and give me practical polytechnic exam tips on this.`
    );
    setActiveTab('ask-ai');
    setIsInner(true);
    setInnerTitle('Ask AI');
  };

  // Phone Push Notifications State
  const [phoneNotificationsEnabled, setPhoneNotificationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('sot_phone_notifications_enabled') === 'true';
  });
  const [phoneNotificationsLoading, setPhoneNotificationsLoading] = useState(false);
  const [phoneNotificationFeedback, setPhoneNotificationFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleTogglePhoneNotifications = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const shouldEnable = e.target.checked;
    setPhoneNotificationFeedback(null);
    setPhoneNotificationsLoading(true);

    try {
      if (shouldEnable) {
        if (!user) throw new Error('Please sign in to enable push notifications.');
        await subscribeToPhoneNotifications(user, profile?.department, profile?.level);
        setPhoneNotificationsEnabled(true);
        setPhoneNotificationFeedback({
          type: 'success',
          message: 'Phone notifications enabled! You will receive timely alerts for your department.'
        });
      } else {
        await unsubscribeFromPhoneNotifications(user, profile?.department, profile?.level);
        setPhoneNotificationsEnabled(false);
        setPhoneNotificationFeedback({
          type: 'success',
          message: 'Phone notifications turned off.'
        });
      }
    } catch (err: any) {
      setPhoneNotificationsEnabled(!shouldEnable);
      setPhoneNotificationFeedback({
        type: 'error',
        message: err.message || 'Failed to update phone notification settings.'
      });
    } finally {
      setPhoneNotificationsLoading(false);
    }
  };

  // Timetable sub-filter
  const [ttTypeTab, setTtTypeTab] = useState<'class' | 'exam'>('class');
  const [ttLevelFilter, setTtLevelFilter] = useState<string>(defaultLevel);

  // Rep Announcement Post state
  const [repTitle, setRepTitle] = useState('');
  const [repContent, setRepContent] = useState('');
  const [repCategory, setRepCategory] = useState<'Academic' | 'Student Notice' | 'Department' | 'General'>('Academic');
  const [repUrgent, setRepUrgent] = useState(false);
  const [repPinned, setRepPinned] = useState(false);
  const [repPosting, setRepPosting] = useState(false);
  const [repSuccess, setRepSuccess] = useState<string | null>(null);
  const [repError, setRepError] = useState<string | null>(null);

  // In-app PDF Viewer Modal (for search results or quick opens)
  const [quickPdfViewer, setQuickPdfViewer] = useState<{ title: string; url: string; courseCode?: string } | null>(null);

  // Dynamic Lagos Greeting
  const [lagosGreetingData, setLagosGreetingData] = useState<LagosGreetingResult>(() => getLagosPeriodGreeting());

  useEffect(() => {
    const updateGreeting = () => {
      setLagosGreetingData(getLagosPeriodGreeting());
    };
    const interval = setInterval(updateGreeting, 60000);
    return () => clearInterval(interval);
  }, []);

  // Update default level filter when profile loads
  useEffect(() => {
    if (profile?.level) {
      const norm = normalizeCourseLevel(profile.level);
      setHomeLevelFilter(norm);
      setTtLevelFilter(norm);
      setEditLevel(norm);
    }
    if (profile?.fullName) {
      setEditFullName(profile.fullName);
    }
  }, [profile?.level, profile?.fullName]);

  // -------------------------------------------------------------
  // BROWSER HISTORY INTEGRATION
  // -------------------------------------------------------------
  useEffect(() => {
    // Check if opened via push notification deep link (e.g. ?tab=announcements or ?tab=past-questions)
    const urlParams = new URLSearchParams(window.location.search);
    const targetTab = urlParams.get('tab') as TabType | null;

    if (targetTab) {
      const innerTitles: Partial<Record<TabType, string>> = {
        timetables: 'Timetable',
        announcements: 'Announcements',
        gpa: 'GPA Calculator',
        'study-planner': 'Study Planner',
        bookmarks: 'Saved Items',
        links: 'Communities & Links',
        'my-messages': 'My Messages'
      };
      const isInnerTab = Boolean(innerTitles[targetTab]);
      setActiveTab(targetTab);
      setIsInner(isInnerTab);
      if (isInnerTab && innerTitles[targetTab]) {
        setInnerTitle(innerTitles[targetTab]!);
      }
      window.history.replaceState({ sotStudentNav: true, tab: targetTab, isInner: isInnerTab, innerTitle: innerTitles[targetTab] || '' }, '');
    } else if (!window.history.state || !window.history.state.sotStudentNav) {
      // Initialize history state on mount
      window.history.replaceState({ sotStudentNav: true, tab: 'overview', isInner: false }, '');
    }

    // Check if there is a pending deep link from a shared link (e.g. ?open=quiz|past-question|announcement|course)
    try {
      const pendingRaw = sessionStorage.getItem('sot_deep_link');
      if (pendingRaw) {
        sessionStorage.removeItem('sot_deep_link');
        const dl = JSON.parse(pendingRaw);
        if (dl.open === 'quiz') {
          setActiveTab('quizzes');
          setIsInner(false);
          window.history.replaceState({ sotStudentNav: true, tab: 'quizzes', isInner: false }, '');
        } else if (dl.open === 'past-question') {
          setActiveTab('past-questions');
          setIsInner(false);
          window.history.replaceState({ sotStudentNav: true, tab: 'past-questions', isInner: false }, '');
        } else if (dl.open === 'announcement') {
          setActiveTab('announcements');
          setIsInner(true);
          setInnerTitle('Announcements');
          window.history.replaceState({ sotStudentNav: true, tab: 'announcements', isInner: true, innerTitle: 'Announcements' }, '');
        } else if (dl.open === 'course') {
          setActiveTab('courses');
          setIsInner(false);
          window.history.replaceState({ sotStudentNav: true, tab: 'courses', isInner: false }, '');
        }
      }
    } catch (e) {
      console.warn('Pending deep link parsing error:', e);
    }

    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      if (state && state.sotStudentNav) {
        setActiveTab(state.tab || 'overview');
        setSelectedCourseId(state.courseId || null);
        setInnerTitle(state.innerTitle || '');
        setIsInner(!!state.isInner);
      } else {
        // Back to home overview root
        setActiveTab('overview');
        setSelectedCourseId(null);
        setInnerTitle('');
        setIsInner(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToTab = (tab: TabType, title?: string, isInnerScreen = false, courseId?: string) => {
    window.history.pushState(
      {
        sotStudentNav: true,
        tab,
        isInner: isInnerScreen,
        innerTitle: title || '',
        courseId: courseId || null
      },
      ''
    );
    setActiveTab(tab);
    setInnerTitle(title || '');
    setIsInner(isInnerScreen);
    setSelectedCourseId(courseId || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToBottomTab = (tab: TabType) => {
    window.history.pushState(
      { sotStudentNav: true, tab, isInner: false },
      ''
    );
    setActiveTab(tab);
    setSelectedCourseId(null);
    setInnerTitle('');
    setIsInner(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoBack = () => {
    if (window.history.state && window.history.state.sotStudentNav) {
      window.history.back();
    } else {
      setActiveTab('overview');
      setSelectedCourseId(null);
      setInnerTitle('');
      setIsInner(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleConfirmLogout = async () => {
    try {
      if (user) {
        await unsubscribeFromPhoneNotifications(user, profile?.department, profile?.level).catch(() => {});
      }
      sessionStorage.clear();
      localStorage.removeItem('sot_local_user');
      localStorage.removeItem('sot_local_profile');
      localStorage.removeItem('sot_admin_view_choice');
      localStorage.removeItem('sot_notifications_last_seen');
      localStorage.removeItem('sot_daily_ai_timestamps');
      localStorage.removeItem('sot_ai_chat_session');
      localStorage.removeItem('sot_fcm_token');
      localStorage.removeItem('sot_phone_notifications_enabled');
      await logout();
    } catch (err) {
      console.warn('Logout error:', err);
    } finally {
      setShowLogoutConfirm(false);
      onNavigateHome();
    }
  };

  // -------------------------------------------------------------
  // FIRESTORE LISTENERS (STRICTLY AUTOMATIC TO STUDENT'S DEPARTMENT)
  // -------------------------------------------------------------
  // Courses
  useEffect(() => {
    if (!studentDept) return;
    const q = query(collection(db, 'courses'), where('department', '==', studentDept));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: CourseItem[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        setCourses(list);
      },
      (err) => console.warn('Courses listener note:', err)
    );
    return () => unsub();
  }, [studentDept]);

  // Topics
  useEffect(() => {
    if (!studentDept) return;
    const q = query(collection(db, 'topics'), where('department', '==', studentDept));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: TopicItem[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        list.sort((a, b) => (a.order || 0) - (b.order || 0));
        setTopics(list);
      },
      (err) => console.warn('Topics listener note:', err)
    );
    return () => unsub();
  }, [studentDept]);

  // Resources (Notes, Videos, Past Questions, Links)
  useEffect(() => {
    if (!studentDept) return;
    const q = query(collection(db, 'resources'), where('department', '==', studentDept));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: ResourceItem[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        setDeptResources(list);
      },
      (err) => console.warn('Resources listener note:', err)
    );
    return () => unsub();
  }, [studentDept]);

  // Timetables
  useEffect(() => {
    if (!studentDept) return;
    const q = query(collection(db, 'timetables'), where('department', '==', studentDept));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: TimetableEntry[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        setTimetables(list);
      },
      (err) => console.warn('Timetables listener note:', err)
    );
    return () => unsub();
  }, [studentDept]);

  // Announcements (Dept & All)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'announcements'), (snap) => {
      const list: AnnouncementItem[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as any) });
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setAnnouncements(list);
    });
    return () => unsub();
  }, []);

  // Links
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'links'), (snap) => {
      const list: LinkItem[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as any) });
      });
      setLinks(list);
    });
    return () => unsub();
  }, []);

  // Department Quizzes (Published only)
  useEffect(() => {
    if (!studentDept) return;
    const q = query(
      collection(db, 'quizzes'),
      where('department', '==', studentDept),
      where('published', '==', true)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: QuizItem[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        setDeptQuizzes(list);
      },
      (err) => console.warn('Quizzes listener note:', err)
    );
    return () => unsub();
  }, [studentDept]);

  // Student Quiz Attempts
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'quizAttempts'),
      where('uid', '==', user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: QuizAttempt[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        setStudentQuizAttempts(list);
      },
      (err) => console.warn('Quiz attempts listener note:', err)
    );
    return () => unsub();
  }, [user?.uid]);

  // Student Activity (Recent actions)
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'studentActivity'),
      where('uid', '==', user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Array<{ id: string; type: string; title: string; timestamp?: string }> = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        list.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        setStudentActivities(list.slice(0, 10));
      },
      (err) => console.warn('Student activity listener note:', err)
    );
    return () => unsub();
  }, [user?.uid]);

  // Student's Messages
  const fetchMyMessages = async () => {
    if (!user?.uid) return;
    setLoadingMessages(true);
    try {
      const msgs: ContactMessage[] = [];
      try {
        const q = query(collection(db, 'messages'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        snap.forEach((d) => msgs.push({ id: d.id, ...d.data() } as ContactMessage));
      } catch (e) {}

      const localMsgs = JSON.parse(localStorage.getItem('sot_local_messages') || '[]');
      const userLocalMsgs = localMsgs.filter(
        (m: any) =>
          m.userId === user.uid ||
          m.uid === user.uid ||
          (m.email && user.email && m.email.toLowerCase() === user.email.toLowerCase())
      );

      const combined = [...msgs, ...userLocalMsgs];
      const unique = Array.from(new Map(combined.map((m) => [m.id, m])).values());
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

  // Daily Streak Africa/Lagos
  useEffect(() => {
    if (!user?.uid || !profile) return;
    const todayLagos = getLagosDateString();
    const yesterdayLagos = getLagosYesterdayString();

    if (profile.lastActiveDate === todayLagos) return;

    let nextStreak = 1;
    if (profile.lastActiveDate === yesterdayLagos) {
      nextStreak = (profile.streakCount || 0) + 1;
    }

    const nextLongest = Math.max(profile.longestStreak || 0, nextStreak);

    updateDoc(doc(db, 'users', user.uid), {
      streakCount: nextStreak,
      longestStreak: nextLongest,
      lastActiveDate: todayLagos
    })
      .then(async () => {
        await refreshProfile();
        if (nextStreak >= 7 || nextLongest >= 7) {
          try {
            const unlocked = await checkAndAwardBadges({
              uid: user.uid,
              currentBadges: profile.badges,
              streakCount: nextStreak,
              longestStreak: nextLongest
            });
            if (unlocked.length > 0) {
              setRecentlyAwardedBadge(unlocked[0]);
            }
          } catch {}
        }
      })
      .catch(() => {});
  }, [user?.uid, profile?.lastActiveDate]);

  // Bookmarks Helper
  const isBookmarked = (type: string, id: string): boolean => {
    return (profile?.bookmarks || []).some((b) => b.type === type && b.id === id);
  };

  const toggleBookmark = async (item: Omit<BookmarkItem, 'createdAt'> & { createdAt?: string }) => {
    if (!user?.uid) return;
    const current = profile?.bookmarks || [];
    const exists = current.some((b) => b.type === item.type && b.id === item.id);

    let updatedList: BookmarkItem[] = [];
    if (exists) {
      updatedList = current.filter((b) => !(b.type === item.type && b.id === item.id));
      setBookmarkToast(`Removed "${item.title}" from bookmarks.`);
    } else {
      if (current.length >= 100) {
        setBookmarkToast('Bookmark limit reached (100 items max).');
        return;
      }
      const newItem: BookmarkItem = {
        ...item,
        createdAt: item.createdAt || new Date().toISOString()
      };
      updatedList = [newItem, ...current];
      setBookmarkToast(`Saved "${item.title}" to bookmarks!`);
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), { bookmarks: updatedList });
      await refreshProfile();
    } catch (err) {
      console.warn('Bookmarks save error:', err);
    }
  };

  useEffect(() => {
    if (bookmarkToast) {
      const timer = setTimeout(() => setBookmarkToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [bookmarkToast]);

  // Announcements filtered for student's department & urgent/pinned
  const relevantAnnouncements = useMemo(() => {
    return announcements.filter((a) => a.department === 'All' || a.department === studentDept);
  }, [announcements, studentDept]);

  const pinnedAnnouncement = useMemo(() => {
    return relevantAnnouncements.find((a) => a.pinned);
  }, [relevantAnnouncements]);

  const unreadAnnouncementsCount = useMemo(() => {
    if (!notificationsLastSeen) return relevantAnnouncements.length;
    const lastSeenTime = new Date(notificationsLastSeen).getTime();
    return relevantAnnouncements.filter((a) => new Date(a.createdAt || 0).getTime() > lastSeenTime).length;
  }, [relevantAnnouncements, notificationsLastSeen]);

  // Notifications Popover Items
  const dashboardNotifications: DashboardNotificationItem[] = useMemo(() => {
    const list: DashboardNotificationItem[] = [];
    relevantAnnouncements.slice(0, 10).forEach((a) => {
      list.push({
        id: a.id,
        type: 'announcement',
        title: a.title,
        subtitle: a.content.slice(0, 100) + '...',
        timeStr: a.createdAt ? new Date(a.createdAt).toLocaleDateString() : 'Recent',
        timestamp: new Date(a.createdAt || 0).getTime(),
        isUnread: !notificationsLastSeen || new Date(a.createdAt || 0).getTime() > new Date(notificationsLastSeen).getTime(),
        actionTab: 'announcements',
        badge: a.category || 'Notice',
        isPinned: a.pinned
      });
    });
    return list;
  }, [relevantAnnouncements, notificationsLastSeen]);

  const unreadNotificationsCount = unreadAnnouncementsCount;

  const handleMarkAllNotificationsRead = async () => {
    const nowIso = new Date().toISOString();
    setNotificationsLastSeen(nowIso);
    localStorage.setItem('sot_notifications_last_seen', nowIso);
    if (user?.uid) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { notificationsLastSeen: nowIso });
      } catch (e) {}
    }
  };

  // -------------------------------------------------------------
  // HOME SEARCH (REAL-TIME INSTANT SEARCH RESPECTING LEVEL & SEMESTER)
  // -------------------------------------------------------------
  const homeSearchResults = useMemo(() => {
    if (!homeSearchQuery.trim()) return null;
    const q = homeSearchQuery.toLowerCase().trim();

    // Matching Courses
    const matchedCourses = courses.filter((c) => {
      const matchDept = c.department === studentDept;
      const matchLvl = normalizeCourseLevel(c.level) === homeLevelFilter;
      const matchSem = homeSemesterFilter === 'All' || normalizeCourseSemester(c.semester) === homeSemesterFilter;
      const matchQ = c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q);
      return matchDept && matchLvl && matchSem && matchQ;
    });

    // Matching Topics
    const matchedTopics = topics.filter((t) => {
      const matchDept = t.department === studentDept;
      const matchLvl = normalizeCourseLevel(t.level) === homeLevelFilter;
      const matchSem = homeSemesterFilter === 'All' || normalizeCourseSemester(t.semester) === homeSemesterFilter;
      const matchQ = t.title.toLowerCase().includes(q);
      return matchDept && matchLvl && matchSem && matchQ;
    });

    // Matching Past Questions
    const matchedPastQuestions = deptResources.filter((r) => {
      const isPq = r.type === 'Past Question' || r.category === 'Past Question';
      const matchDept = r.department === studentDept;
      const matchLvl = normalizeCourseLevel(r.level) === homeLevelFilter;
      const matchSem = homeSemesterFilter === 'All' || normalizeCourseSemester(r.semester) === homeSemesterFilter;
      const matchQ =
        r.title?.toLowerCase().includes(q) ||
        r.courseCode?.toLowerCase().includes(q) ||
        r.session?.toLowerCase().includes(q);
      return isPq && matchDept && matchLvl && matchSem && matchQ;
    });

    // Matching Notes / Videos / Other Materials
    const matchedMaterials = deptResources.filter((r) => {
      const isPq = r.type === 'Past Question' || r.category === 'Past Question';
      if (isPq) return false;
      const matchDept = r.department === studentDept;
      const matchLvl = normalizeCourseLevel(r.level) === homeLevelFilter;
      const matchSem = homeSemesterFilter === 'All' || normalizeCourseSemester(r.semester) === homeSemesterFilter;
      const matchQ =
        r.title?.toLowerCase().includes(q) ||
        r.courseCode?.toLowerCase().includes(q) ||
        r.category?.toLowerCase().includes(q);
      return matchDept && matchLvl && matchSem && matchQ;
    });

    return {
      courses: matchedCourses.slice(0, 5),
      topics: matchedTopics.slice(0, 5),
      pastQuestions: matchedPastQuestions.slice(0, 5),
      materials: matchedMaterials.slice(0, 5)
    };
  }, [homeSearchQuery, courses, topics, deptResources, studentDept, homeLevelFilter, homeSemesterFilter]);

  // -------------------------------------------------------------
  // LEARNING HUB STATS & MEMOS
  // -------------------------------------------------------------
  const enrolledCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchDept = c.department === studentDept;
      const matchLvl = normalizeCourseLevel(c.level) === homeLevelFilter;
      const matchSem = homeSemesterFilter === 'All' || normalizeCourseSemester(c.semester) === homeSemesterFilter;
      return matchDept && matchLvl && matchSem;
    });
  }, [courses, studentDept, homeLevelFilter, homeSemesterFilter]);

  const completedTopicsList = useMemo(() => profile?.completedTopics || [], [profile]);

  const completedTopicsCount = useMemo(() => {
    const enrolledCourseIds = new Set(enrolledCourses.map(c => c.id));
    const relevantTopics = topics.filter(t => enrolledCourseIds.has(t.courseId));
    return relevantTopics.filter(t => completedTopicsList.includes(t.id)).length;
  }, [enrolledCourses, topics, completedTopicsList]);

  const averageProgressPct = useMemo(() => {
    if (enrolledCourses.length === 0) return 0;
    let totalPct = 0;
    let count = 0;
    enrolledCourses.forEach(c => {
      const cTopics = topics.filter(t => t.courseId === c.id);
      if (cTopics.length === 0) return;
      const done = cTopics.filter(t => completedTopicsList.includes(t.id)).length;
      totalPct += Math.round((done / cTopics.length) * 100);
      count++;
    });
    return count > 0 ? Math.round(totalPct / count) : 0;
  }, [enrolledCourses, topics, completedTopicsList]);

  const attemptsQuizIds = useMemo(() => new Set(studentQuizAttempts.map(a => a.quizId)), [studentQuizAttempts]);

  const upcomingQuizzes = useMemo(() => {
    return deptQuizzes
      .filter(q => {
        return normalizeCourseLevel(q.level) === homeLevelFilter;
      })
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [deptQuizzes, homeLevelFilter]);

  const quizzesWaitingCount = useMemo(() => {
    return upcomingQuizzes.filter(q => !attemptsQuizIds.has(q.id)).length;
  }, [upcomingQuizzes, attemptsQuizIds]);

  const myCoursesPreview = useMemo(() => enrolledCourses.slice(0, 3), [enrolledCourses]);

  const recentActivityCombined = useMemo(() => {
    const list: Array<{ id: string; type: 'topic' | 'quiz'; title: string; subtitle: string; timestamp?: string }> = [];

    // Add from studentActivities
    studentActivities.forEach(a => {
      list.push({
        id: a.id,
        type: a.type.includes('quiz') ? 'quiz' : 'topic',
        title: a.title,
        subtitle: a.type === 'topic completed' ? 'Completed topic' : a.type === 'lesson opened' ? 'Opened topic' : a.type,
        timestamp: a.timestamp
      });
    });

    // Add from quiz attempts if not already present
    studentQuizAttempts.forEach(qa => {
      const matchedQuiz = deptQuizzes.find(q => q.id === qa.quizId);
      const quizTitle = qa.quizTitle || matchedQuiz?.title || 'Quiz';
      const courseCode = qa.courseCode || matchedQuiz?.courseCode || 'Quiz';
      const timestamp = qa.completedAt || qa.submittedAt || qa.updatedAt;
      if (!list.some(item => item.title.includes(quizTitle))) {
        list.push({
          id: qa.id,
          type: 'quiz',
          title: `${courseCode}: ${quizTitle}`,
          subtitle: `Scored ${qa.score}% (${qa.passed ? 'Passed' : 'Needs practice'})`,
          timestamp
        });
      }
    });

    list.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    return list.slice(0, 5);
  }, [studentActivities, studentQuizAttempts, deptQuizzes]);

  // Handle Profile Save
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
        await updateDoc(doc(db, 'users', user.uid), {
          level: editLevel
        });
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

  // JAMB -> Matric Upgrade
  const handleUpgradeMatric = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpgradeError(null);
    setUpgradeSuccess(null);
    const clean = upgradeMatricInput.trim().toUpperCase().replace(/\s+/g, '');
    if (!clean) {
      setUpgradeError('Please enter your official matriculation number.');
      return;
    }
    const matricRegex = /^[A-Z0-9_\-\/]{4,30}$/;
    if (!matricRegex.test(clean)) {
      setUpgradeError('Matric number format must be 4 to 30 characters (e.g. F/ND/25/3210001).');
      return;
    }

    setUpgradeSaving(true);
    try {
      await upgradeJambToMatric(clean);
      setUpgradeSuccess(`Matriculation number "${clean}" saved successfully! Your profile is now permanent.`);
      setUpgradeMatricInput('');
      setTimeout(() => setUpgradeSuccess(null), 5000);
    } catch (err: any) {
      setUpgradeError(err.message || 'Failed to update matric number. Please check your connection.');
    } finally {
      setUpgradeSaving(false);
    }
  };

  // Rep Announcement Post
  const handleRepPostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setRepError(null);
    setRepSuccess(null);

    if (!repTitle.trim() || !repContent.trim()) {
      setRepError('Please provide both announcement title and bulletin details.');
      return;
    }

    setRepPosting(true);
    try {
      const newAnn = {
        title: repTitle.trim(),
        content: repContent.trim(),
        category: repCategory,
        department: studentDept,
        urgent: repUrgent,
        pinned: repPinned,
        author: `${profile?.fullName || 'Student'} (Course Rep)`,
        uploadedBy: user?.uid || '',
        uploadedByEmail: user?.email || '',
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'announcements'), newAnn);
      setRepSuccess('Department bulletin published successfully!');
      setRepTitle('');
      setRepContent('');
      setTimeout(() => setRepSuccess(null), 4000);
    } catch (err: any) {
      setRepError(err?.message || 'Failed to publish announcement.');
    } finally {
      setRepPosting(false);
    }
  };

  // Get Page Title for Header
  const getTabTitle = (tab: TabType): string => {
    switch (tab) {
      case 'overview':
        return 'Home';
      case 'courses':
        return 'Courses';
      case 'past-questions':
        return 'Past Questions';
      case 'quizzes':
        return 'Quizzes';
      case 'mock-cbt':
        return 'Mock CBT Exam';
      case 'badges':
        return 'My Badges';
      case 'leaderboard':
        return 'Department Leaderboard';
      case 'ask-ai':
        return 'Ask AI';
      case 'profile':
        return 'Profile';
      case 'timetables':
        return 'Timetable';
      case 'announcements':
        return 'Announcements';
      case 'gpa':
        return 'GPA Calculator';
      case 'study-planner':
        return 'Study Planner';
      case 'bookmarks':
        return 'Saved';
      case 'links':
        return 'Communities & Links';
      case 'my-messages':
        return 'My Messages';
      case 'rep-announcement':
        return 'Post Announcement';
      default:
        return 'SOT Portal';
    }
  };

  return (
    <div className="min-h-screen bg-[#0A1224] text-[#E6ECFA] flex flex-col pb-24 max-w-2xl mx-auto w-full px-3.5 sm:px-5">
      {/* Offline Mode Banner */}
      <OfflineBanner />

      {/* Badge Unlocked Celebration Modal */}
      <BadgeUnlockedModal
        badge={recentlyAwardedBadge}
        onClose={() => setRecentlyAwardedBadge(null)}
        onViewAllBadges={() => navigateToTab('badges', 'My Badges', true)}
      />

      {/* ======================================================== */}
      {/* TOP HEADER: Shows Blue Back Arrow on any Inner Page      */}
      {/* ======================================================== */}
      {isInner ? (
        <header className="sticky top-0 z-30 bg-[#0A1224]/95 backdrop-blur-md border-b border-[#24315A] -mx-3.5 sm:-mx-5 px-3.5 sm:px-5 py-3 flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={handleGoBack}
            className="flex items-center gap-2 text-[#2F52FF] hover:text-[#5271FF] font-bold text-sm transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-5 h-5 text-[#2F52FF] group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-[#E6ECFA] font-bold text-base font-heading">
              {innerTitle || getTabTitle(activeTab)}
            </span>
          </button>

          {/* Quick Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notifications"
              className="relative p-2 rounded-xl bg-[#121C36] border border-[#24315A] text-[#9AA8C7] hover:text-[#FFC700] transition-colors cursor-pointer"
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
                navigateToTab(tab as any, getTabTitle(tab as any), true);
              }}
            />
          </div>
        </header>
      ) : activeTab !== 'overview' ? (
        /* Root Bottom Tab Header (no back arrow) */
        <header className="sticky top-0 z-30 bg-[#0A1224]/95 backdrop-blur-md border-b border-[#24315A] -mx-3.5 sm:-mx-5 px-3.5 sm:px-5 py-3 flex items-center justify-between mb-4">
          <h2 className="font-heading font-bold text-lg text-[#E6ECFA]">
            {getTabTitle(activeTab)}
          </h2>
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notifications"
              className="relative p-2 rounded-xl bg-[#121C36] border border-[#24315A] text-[#9AA8C7] hover:text-[#FFC700] transition-colors cursor-pointer"
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
                navigateToTab(tab as any, getTabTitle(tab as any), true);
              }}
            />
          </div>
        </header>
      ) : null}

      {/* Toast Notification */}
      {bookmarkToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-[#121C36] border border-[#2F52FF] text-xs font-semibold text-[#E6ECFA] shadow-[0_0_20px_rgba(47,82,255,0.4)] flex items-center gap-2">
          <BookmarkCheck className="w-4 h-4 text-[#FFC700]" />
          <span>{bookmarkToast}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 space-y-4">
        {/* ======================================================== */}
        {/* VIEW 1: HOME (COMPACT & CLEAN)                           */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-4 pt-2">
            {/* Top Bar for Home: Notification Bell & Logo */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#121C36] border border-[#24315A] flex items-center justify-center text-[#FFC700]">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <span className="font-heading font-bold text-sm text-[#E6ECFA]">
                  SOT Student Desk
                </span>
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  title="Notifications"
                  className="relative p-2 rounded-xl bg-[#121C36] border border-[#24315A] text-[#9AA8C7] hover:text-[#FFC700] transition-colors cursor-pointer"
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
                    navigateToTab(tab as any, getTabTitle(tab as any), true);
                  }}
                />
              </div>
            </div>

            {/* 1. GREETING CARD */}
            <div className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] shadow-sm space-y-3">
              <div>
                <h1 className="font-heading font-bold text-lg text-[#E6ECFA] flex items-center gap-1.5">
                  <span>{lagosGreetingData.greeting},</span>
                  <span className="text-[#FFC700]">
                    {profile?.fullName ? profile.fullName.trim().split(' ')[0] : 'Student'}
                  </span>
                </h1>
                <p className="text-[11px] text-[#9AA8C7] mt-0.5">
                  Welcome to your department study dashboard.
                </p>
              </div>

              {/* Department & Level Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
                  {studentDept}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0A1224] text-[#60A5FA] border border-[#24315A]">
                  {homeLevelFilter}
                </span>
              </div>

              {/* 1st Sem | 2nd Sem | All Switch and Level Dropdown */}
              <div className="pt-2 border-t border-[#24315A]/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="flex items-center p-0.5 rounded-lg bg-[#0A1224] border border-[#24315A]">
                  {(['First Semester', 'Second Semester', 'All'] as const).map((sem) => (
                    <button
                      key={sem}
                      type="button"
                      onClick={() => setHomeSemesterFilter(sem)}
                      className={`flex-1 sm:flex-initial px-3 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                        homeSemesterFilter === sem
                          ? 'bg-[#2F52FF] text-white shadow-sm'
                          : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                      }`}
                    >
                      {sem === 'First Semester' ? '1st Sem' : sem === 'Second Semester' ? '2nd Sem' : 'All'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-[11px] text-[#9AA8C7] font-semibold">Level:</span>
                  <select
                    value={homeLevelFilter}
                    onChange={(e) => setHomeLevelFilter(e.target.value as any)}
                    className="px-2.5 py-1 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs font-bold text-[#FFC700] focus:outline-none focus:border-[#2F52FF] cursor-pointer"
                  >
                    {ACADEMIC_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. SEARCH BAR ("Search courses, topics, past questions") */}
            <div className="relative">
              <input
                type="text"
                value={homeSearchQuery}
                onChange={(e) => setHomeSearchQuery(e.target.value)}
                placeholder="Search courses, topics, past questions"
                className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/60 focus:outline-none focus:border-[#2F52FF] focus:ring-1 focus:ring-[#2F52FF]/40 shadow-sm"
              />
              <Search className="w-4 h-4 text-[#9AA8C7] absolute left-3 top-3" />
              {homeSearchQuery && (
                <button
                  onClick={() => setHomeSearchQuery('')}
                  className="absolute right-3 top-3 text-[#9AA8C7] hover:text-[#E6ECFA]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>


            {/* INSTANT SEARCH RESULTS OVERLAY */}
            {homeSearchResults && (
              <div className="p-3.5 rounded-2xl bg-[#0A1224] border border-[#2F52FF]/50 shadow-xl space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#FFC700]">
                  <span>Instant Results for "{homeSearchQuery}"</span>
                  <button
                    onClick={() => setHomeSearchQuery('')}
                    className="text-[#9AA8C7] hover:text-white"
                  >
                    Clear
                  </button>
                </div>

                {homeSearchResults.courses.length === 0 &&
                homeSearchResults.topics.length === 0 &&
                homeSearchResults.pastQuestions.length === 0 &&
                homeSearchResults.materials.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#9AA8C7]">
                    No courses, topics, or past questions match "{homeSearchQuery}" in {homeLevelFilter} ({homeSemesterFilter === 'All' ? 'All Semesters' : homeSemesterFilter}).
                  </div>
                ) : (
                  <div className="space-y-3 text-xs divide-y divide-[#24315A]/60">
                    {/* Courses Group */}
                    {homeSearchResults.courses.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] uppercase font-bold text-[#60A5FA]">
                          Courses ({homeSearchResults.courses.length})
                        </span>
                        {homeSearchResults.courses.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              navigateToTab('courses', `${c.code}: ${c.title}`, true, c.id);
                              setHomeSearchQuery('');
                            }}
                            className="p-2 rounded-lg bg-[#121C36] hover:bg-[#1A2E63] flex items-center justify-between cursor-pointer transition-colors"
                          >
                            <div className="truncate pr-2">
                              <span className="font-bold text-[#FFC700] mr-2">{c.code}</span>
                              <span className="text-[#E6ECFA]">{c.title}</span>
                            </div>
                            <span className="text-[10px] text-[#9AA8C7] shrink-0">{c.units} units</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Topics Group */}
                    {homeSearchResults.topics.length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <span className="text-[10px] uppercase font-bold text-[#FFC700]">
                          Topics ({homeSearchResults.topics.length})
                        </span>
                        {homeSearchResults.topics.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => {
                              navigateToTab('courses', t.title, true, t.courseId);
                              setHomeSearchQuery('');
                            }}
                            className="p-2 rounded-lg bg-[#121C36] hover:bg-[#1A2E63] flex items-center justify-between cursor-pointer transition-colors"
                          >
                            <span className="truncate text-[#E6ECFA] font-medium">{t.title}</span>
                            <span className="text-[10px] text-[#2F52FF] font-semibold shrink-0">Open Topic &rarr;</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Past Questions Group */}
                    {homeSearchResults.pastQuestions.length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <span className="text-[10px] uppercase font-bold text-amber-400">
                          Past Questions ({homeSearchResults.pastQuestions.length})
                        </span>
                        {homeSearchResults.pastQuestions.map((pq) => (
                          <div
                            key={pq.id}
                            onClick={() => {
                              setQuickPdfViewer({
                                title: pq.title,
                                url: formatPdfUrl(pq.url),
                                courseCode: pq.courseCode
                              });
                            }}
                            className="p-2 rounded-lg bg-[#121C36] hover:bg-[#1A2E63] flex items-center justify-between cursor-pointer transition-colors"
                          >
                            <div className="truncate pr-2">
                              {pq.courseCode && (
                                <span className="font-bold text-[#FFC700] mr-2">{pq.courseCode}</span>
                              )}
                              <span className="text-[#E6ECFA]">{pq.title}</span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[#2F52FF] text-white font-bold shrink-0">
                              Preview
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Materials Group */}
                    {homeSearchResults.materials.length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <span className="text-[10px] uppercase font-bold text-emerald-400">
                          Materials ({homeSearchResults.materials.length})
                        </span>
                        {homeSearchResults.materials.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => {
                              if (m.url.toLowerCase().includes('.pdf') || m.url.includes('drive.google.com')) {
                                setQuickPdfViewer({
                                  title: m.title,
                                  url: formatPdfUrl(m.url),
                                  courseCode: m.courseCode
                                });
                              } else {
                                window.open(m.url, '_blank');
                              }
                            }}
                            className="p-2 rounded-lg bg-[#121C36] hover:bg-[#1A2E63] flex items-center justify-between cursor-pointer transition-colors"
                          >
                            <span className="truncate text-[#E6ECFA] font-medium">{m.title}</span>
                            <span className="text-[10px] text-[#9AA8C7] shrink-0">{m.type || m.category || 'File'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3. ROUNDED SQUARE TILES & MOCK CBT - REPLACES THE MENU */}
            {!homeSearchQuery && (
              <div className="space-y-4">
                {/* Featured Mock CBT Banner */}
                <div
                  onClick={() => navigateToTab('mock-cbt', 'Mock CBT Exam', true)}
                  className="p-4 rounded-2xl bg-gradient-to-r from-[#121C36] via-[#16254a] to-[#121C36] border border-[#FFC700]/40 hover:border-[#FFC700] shadow-[0_0_20px_rgba(255,199,0,0.12)] flex items-center justify-between gap-3 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-[#FFC700]/15 border border-[#FFC700]/40 text-[#FFC700] flex items-center justify-center shrink-0">
                      <Clock className="w-6 h-6 text-[#FFC700]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-extrabold text-xs sm:text-sm text-[#E6ECFA] group-hover:text-white">
                          Practice Mock CBT Exam
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-[#FFC700] text-[#0A1224] font-black text-[9px] uppercase tracking-wider">
                          New
                        </span>
                      </div>
                      <p className="text-[11px] text-[#9AA8C7] truncate">
                        Timed test simulation with 20, 40, or 60 questions &amp; full review
                      </p>
                    </div>
                  </div>
                  <div className="hidden xs:flex items-center gap-1 text-xs font-bold text-[#FFC700] shrink-0 group-hover:translate-x-1 transition-transform">
                    <span>Start</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Tile: Mock CBT */}
                  <div
                    onClick={() => navigateToTab('mock-cbt', 'Mock CBT Exam', true)}
                    className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#FFC700] flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(255,199,0,0.2)] hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden"
                  >
                    <span className="absolute top-2 right-2 px-1.5 py-0.2 rounded-full bg-[#FFC700]/20 text-[#FFC700] border border-[#FFC700]/40 font-extrabold text-[8px] uppercase tracking-wider">
                      Timed
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700] group-hover:border-[#FFC700] transition-colors">
                      <Clock className="w-5 h-5 text-[#FFC700]" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-[#E6ECFA] group-hover:text-white">
                        Mock CBT
                      </h4>
                      <p className="text-[10px] text-[#9AA8C7]">Timed exam drill</p>
                    </div>
                  </div>

                  {/* Tile 1: Courses */}
                  <div
                    onClick={() => navigateToTab('courses', 'Courses', true)}
                    className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(47,82,255,0.2)] hover:scale-[1.02] active:scale-[0.98] group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#2F52FF] group-hover:border-[#2F52FF] transition-colors">
                      <BookOpen className="w-5 h-5 text-[#2F52FF]" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-[#E6ECFA] group-hover:text-white">
                        Courses
                      </h4>
                      <p className="text-[10px] text-[#9AA8C7]">Topics &amp; notes</p>
                    </div>
                  </div>

                  {/* Tile 2: Past Questions */}
                  <div
                    onClick={() => navigateToTab('past-questions', 'Past Questions', true)}
                    className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#FFC700] flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(255,199,0,0.15)] hover:scale-[1.02] active:scale-[0.98] group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700] group-hover:border-[#FFC700] transition-colors">
                      <FileText className="w-5 h-5 text-[#FFC700]" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-[#E6ECFA] group-hover:text-white">
                        Past Questions
                      </h4>
                      <p className="text-[10px] text-[#9AA8C7]">Exams &amp; sessions</p>
                    </div>
                  </div>

                  {/* Tile: Quizzes */}
                  <div
                    onClick={() => navigateToTab('quizzes', 'Quizzes', true)}
                    className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(47,82,255,0.2)] hover:scale-[1.02] active:scale-[0.98] group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#2F52FF] group-hover:border-[#2F52FF] transition-colors">
                      <FileQuestion className="w-5 h-5 text-[#2F52FF]" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-[#E6ECFA] group-hover:text-white">
                        Quizzes
                      </h4>
                      <p className="text-[10px] text-[#9AA8C7]">Practice &amp; tests</p>
                    </div>
                  </div>

                  {/* Tile 3: Timetable */}
                  <div
                    onClick={() => navigateToTab('timetables', 'Timetable', true)}
                    className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(47,82,255,0.2)] hover:scale-[1.02] active:scale-[0.98] group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#2F52FF] group-hover:border-[#2F52FF] transition-colors">
                      <Calendar className="w-5 h-5 text-[#2F52FF]" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-[#E6ECFA] group-hover:text-white">
                        Timetable
                      </h4>
                      <p className="text-[10px] text-[#9AA8C7]">Classes &amp; exams</p>
                    </div>
                  </div>

                  {/* Tile 4: Announcements */}
                  <div
                    onClick={() => navigateToTab('announcements', 'Announcements', true)}
                    className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#FFC700] flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(255,199,0,0.15)] hover:scale-[1.02] active:scale-[0.98] group relative"
                  >
                    {unreadAnnouncementsCount > 0 && (
                      <span className="absolute top-2.5 right-2.5 px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-extrabold text-[9px]">
                        {unreadAnnouncementsCount} new
                      </span>
                    )}
                    <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700] group-hover:border-[#FFC700] transition-colors">
                      <Bell className="w-5 h-5 text-[#FFC700]" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-[#E6ECFA] group-hover:text-white">
                        Announcements
                      </h4>
                      <p className="text-[10px] text-[#9AA8C7]">Bulletins &amp; notices</p>
                    </div>
                  </div>

                  {/* Tile 5: GPA Calculator */}
                  <div
                    onClick={() => navigateToTab('gpa', 'GPA Calculator', true)}
                    className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(47,82,255,0.2)] hover:scale-[1.02] active:scale-[0.98] group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#2F52FF] group-hover:border-[#2F52FF] transition-colors">
                      <Calculator className="w-5 h-5 text-[#2F52FF]" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-[#E6ECFA] group-hover:text-white">
                        GPA Calculator
                      </h4>
                      <p className="text-[10px] text-[#9AA8C7]">Track your target GPA</p>
                    </div>
                  </div>

                  {/* Tile 6: Study Planner */}
                  <div
                    onClick={() => navigateToTab('study-planner', 'Study Planner', true)}
                    className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#FFC700] flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(255,199,0,0.15)] hover:scale-[1.02] active:scale-[0.98] group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700] group-hover:border-[#FFC700] transition-colors">
                      <ListTodo className="w-5 h-5 text-[#FFC700]" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-[#E6ECFA] group-hover:text-white">
                        Study Planner
                      </h4>
                      <p className="text-[10px] text-[#9AA8C7]">To-dos &amp; assignments</p>
                    </div>
                  </div>

                  {/* Tile 7: Saved */}
                  <div
                    onClick={() => navigateToTab('bookmarks', 'Saved Items', true)}
                    className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(47,82,255,0.2)] hover:scale-[1.02] active:scale-[0.98] group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#2F52FF] group-hover:border-[#2F52FF] transition-colors">
                      <Bookmark className="w-5 h-5 text-[#2F52FF]" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-[#E6ECFA] group-hover:text-white">
                        Saved
                      </h4>
                      <p className="text-[10px] text-[#9AA8C7]">Bookmarks &amp; pins</p>
                    </div>
                  </div>

                  {/* Tile 8: Communities & Links */}
                  <div
                    onClick={() => navigateToTab('links', 'Communities & Links', true)}
                    className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#FFC700] flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(255,199,0,0.15)] hover:scale-[1.02] active:scale-[0.98] group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700] group-hover:border-[#FFC700] transition-colors">
                      <Link2 className="w-5 h-5 text-[#FFC700]" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-[#E6ECFA] group-hover:text-white">
                        Communities &amp; Links
                      </h4>
                      <p className="text-[10px] text-[#9AA8C7]">Groups &amp; resources</p>
                    </div>
                  </div>

                  {/* Tile 9: My Messages */}
                  <div
                    onClick={() => navigateToTab('my-messages', 'My Messages', true)}
                    className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(47,82,255,0.2)] hover:scale-[1.02] active:scale-[0.98] group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#2F52FF] group-hover:border-[#2F52FF] transition-colors">
                      <MessageSquare className="w-5 h-5 text-[#2F52FF]" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-[#E6ECFA] group-hover:text-white">
                        My Messages
                      </h4>
                      <p className="text-[10px] text-[#9AA8C7]">Inquiries &amp; replies</p>
                    </div>
                  </div>

                  {/* Tile 10: Ask AI */}
                  <div
                    onClick={() => navigateToTab('ask-ai', 'Ask AI Study Helper', true)}
                    className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#FFC700] flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(255,199,0,0.15)] hover:scale-[1.02] active:scale-[0.98] group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700] group-hover:border-[#FFC700] transition-colors">
                      <Sparkles className="w-5 h-5 text-[#FFC700]" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-[#E6ECFA] group-hover:text-white">
                        Ask AI
                      </h4>
                      <p className="text-[10px] text-[#9AA8C7]">Smart study assistant</p>
                    </div>
                  </div>

                  {/* Tile 11: Weekly Leaderboard */}
                  <div
                    onClick={() => navigateToTab('leaderboard', 'Department Leaderboard', true)}
                    className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#FFC700] flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(255,199,0,0.15)] hover:scale-[1.02] active:scale-[0.98] group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700] group-hover:border-[#FFC700] transition-colors">
                      <Trophy className="w-5 h-5 text-[#FFC700]" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-[#E6ECFA] group-hover:text-white">
                        Leaderboard
                      </h4>
                      <p className="text-[10px] text-[#9AA8C7]">Weekly Top 10</p>
                    </div>
                  </div>

                  {/* Tile 12: My Badges */}
                  <div
                    onClick={() => navigateToTab('badges', 'My Badges', true)}
                    className="p-4 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(47,82,255,0.2)] hover:scale-[1.02] active:scale-[0.98] group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#2F52FF] group-hover:border-[#2F52FF] transition-colors">
                      <Award className="w-5 h-5 text-[#2F52FF]" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-[#E6ECFA] group-hover:text-white">
                        My Badges
                      </h4>
                      <p className="text-[10px] text-[#9AA8C7]">
                        {(profile?.badges || []).length}/4 unlocked
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. PINNED ANNOUNCEMENT ROW (IF ANY) */}
                {pinnedAnnouncement && (
                  <div
                    onClick={() => navigateToTab('announcements', 'Announcements', true)}
                    className="p-3 rounded-xl bg-[#121C36] border border-[#FFC700]/40 flex items-center justify-between gap-2.5 cursor-pointer hover:border-[#FFC700] transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Pin className="w-4 h-4 text-[#FFC700] shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-[#FFC700] font-bold uppercase tracking-wider block">
                          Pinned Notice
                        </span>
                        <p className="text-xs font-semibold text-[#E6ECFA] truncate">
                          {pinnedAnnouncement.title}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <ShareButton
                        title={pinnedAnnouncement.title}
                        itemType="announcement"
                        id={pinnedAnnouncement.id}
                        textDetails={pinnedAnnouncement.category}
                        variant="compact"
                      />
                      <span className="text-[11px] font-bold text-[#2F52FF] hover:underline flex items-center gap-1">
                        Read &rarr;
                      </span>
                    </div>
                  </div>
                )}

                {/* 5. "MY COURSES" (FIRST 3 COURSES FOR LEVEL & SEMESTER) */}
                <div className="p-3.5 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading font-bold text-xs text-[#E6ECFA]">
                      My Courses ({myCoursesPreview.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => navigateToTab('courses', 'Courses', false)}
                      className="text-[11px] text-[#FFC700] font-semibold hover:underline cursor-pointer"
                    >
                      Browse all &rarr;
                    </button>
                  </div>

                  {myCoursesPreview.length === 0 ? (
                    <p className="text-xs text-[#9AA8C7] py-2 text-center">
                      No courses found for {homeLevelFilter} ({homeSemesterFilter}).
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {myCoursesPreview.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => navigateToTab('courses', `${c.code}: ${c.title}`, true, c.id)}
                          className="p-2.5 rounded-xl bg-[#0A1224] border border-[#24315A] hover:border-[#2F52FF] flex items-center justify-between gap-2 cursor-pointer transition-colors"
                        >
                          <div className="min-w-0 truncate">
                            <span className="font-mono font-bold text-[#FFC700] text-xs mr-2">{c.code}</span>
                            <span className="text-xs text-[#E6ECFA] truncate">{c.title}</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#121C36] text-[#9AA8C7] border border-[#24315A] shrink-0 font-medium">
                            {c.units} units
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 6. SLIM STREAK CARD */}
                <DailyStreakCard
                  streakCount={profile?.streakCount || 0}
                  longestStreak={profile?.longestStreak || 0}
                  lastActiveDate={profile?.lastActiveDate}
                />

                {/* 7. SLIM WHATSAPP "JOIN" ROW */}
                {settings.whatsappChannelUrl && (
                  <a
                    href={settings.whatsappChannelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl bg-[#0A1224] border border-[#25D366]/40 hover:border-[#25D366] flex items-center justify-between gap-2.5 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#25D366]/20 flex items-center justify-center text-[#25D366] shrink-0">
                        <WhatsAppIcon className="w-4 h-4 fill-current" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-heading font-bold text-xs text-[#E6ECFA] truncate">
                          Join Our WhatsApp Channel
                        </h4>
                        <p className="text-[10px] text-[#9AA8C7]">
                          Official updates &amp; student notifications
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-[#25D366] text-black font-bold text-xs shrink-0 flex items-center gap-1">
                      <span>Join</span>
                      <ExternalLink className="w-3 h-3 text-black" />
                    </span>
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: COURSES TAB (Topics & Notes, NO Past Questions)  */}
        {/* ======================================================== */}
        {activeTab === 'courses' && (
          <StudentResourcesView
            courses={courses}
            resources={deptResources}
            userLevel={homeLevelFilter}
            department={studentDept}
            isBookmarked={isBookmarked}
            toggleBookmark={toggleBookmark}
            bookmarks={profile?.bookmarks || []}
            onNavigateLinks={() => navigateToTab('links', 'Communities & Links', true)}
            studentProfile={profile}
            onUpdateCompletedTopics={handleUpdateCompletedTopics}
            onUpdateLastTopic={handleUpdateLastTopic}
            onTakeQuiz={() => {
              navigateToTab('quizzes', 'Practice Quizzes', true);
            }}
            onAskAiAboutTopic={handleAskAiAboutTopic}
            initialCourseId={resumeCourseId}
            initialTopicId={resumeTopicId}
          />
        )}

        {/* ======================================================== */}
        {/* VIEW 3: PAST QUESTIONS TAB (STANDALONE, NOT UNDER COURSE) */}
        {/* ======================================================== */}
        {activeTab === 'past-questions' && (
          <StudentPastQuestionsView
            department={studentDept}
            userLevel={homeLevelFilter}
            isInner={isInner}
            onBack={handleGoBack}
            isBookmarked={isBookmarked}
            toggleBookmark={toggleBookmark}
          />
        )}

        {/* ======================================================== */}
        {/* VIEW 4: ASK AI (Smart Assistant)                        */}
        {/* ======================================================== */}
        {activeTab === 'ask-ai' && (
          <AskAiView
            initialPrompt={aiPromptContext}
            onClearInitialPrompt={() => setAiPromptContext(null)}
          />
        )}

        {/* ======================================================== */}
        {/* VIEW 5: PROFILE (Student Info, Install App & Log Out)    */}
        {/* ======================================================== */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            {/* Student ID & Credential Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-3">
              <div className="flex items-center justify-between border-b border-[#24315A] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#2F52FF] text-white flex items-center justify-center font-bold text-base shadow-sm">
                    {studentInitial}
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-sm sm:text-base text-[#E6ECFA]">
                      {profile?.fullName || user?.email}
                    </h3>
                    <p className="text-[11px] text-[#9AA8C7]">{profile?.email || user?.email}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                  Active
                </span>
              </div>

              {/* Identification details: Dept, Level, ID */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[#0A1224] border border-[#24315A]">
                  <span className="text-[10px] text-[#9AA8C7] block">Department</span>
                  <span className="font-bold text-[#E6ECFA] truncate block">{studentDept}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#0A1224] border border-[#24315A]">
                  <span className="text-[10px] text-[#9AA8C7] block">Academic Level</span>
                  <span className="font-bold text-[#FFC700] block">{profile?.level || 'ND1'}</span>
                </div>
              </div>

              {/* ID: Permanent Matric or Temporary JAMB */}
              <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] font-semibold text-[#9AA8C7]">
                    {profile?.matricNumber ? 'Matriculation Number' : 'JAMB Registration Number'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    profile?.matricNumber
                      ? 'bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/30'
                      : 'bg-[#FFC700]/20 text-[#FFC700] border border-[#FFC700]/30'
                  }`}>
                    {profile?.matricNumber ? 'Permanent' : 'Temporary ID'}
                  </span>
                </div>
                <div className="font-mono font-bold text-sm text-[#FFC700]">
                  {profile?.matricNumber || profile?.jambNumber || 'NOT ASSIGNED'}
                </div>

                {/* If JAMB, show "Add your matric number when you get it" notice */}
                {!profile?.matricNumber && profile?.jambNumber && (
                  <div className="pt-2 border-t border-[#24315A] space-y-2">
                    <div className="flex items-start gap-2">
                      <FileBadge2 className="w-4 h-4 text-[#FFC700] shrink-0 mt-0.5" />
                      <p className="text-[11px] text-[#9AA8C7]">
                        <strong className="text-[#E6ECFA]">Add your matric number when you get it:</strong> Once assigned, save it below to make your profile permanent.
                      </p>
                    </div>

                    {upgradeError && (
                      <div className="p-2 rounded bg-rose-950/50 border border-rose-500/50 text-[11px] text-rose-200">
                        {upgradeError}
                      </div>
                    )}
                    {upgradeSuccess && (
                      <div className="p-2 rounded bg-emerald-950/50 border border-emerald-500/50 text-[11px] text-emerald-200">
                        {upgradeSuccess}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={upgradeMatricInput}
                        onChange={(e) => setUpgradeMatricInput(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                        placeholder="e.g. F/ND/25/3210001"
                        maxLength={30}
                        disabled={upgradeSaving}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] uppercase placeholder-[#9AA8C7]/50 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleUpgradeMatric}
                        disabled={upgradeSaving || !upgradeMatricInput.trim()}
                        className="px-3.5 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2542D9] text-white text-xs font-bold disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {upgradeSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Settings Form */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4">
              <h3 className="font-heading font-bold text-sm text-[#E6ECFA]">
                Update Profile &amp; Password
              </h3>

              {profileError && (
                <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              {profileSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-500/50 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              <form onSubmit={handleProfileSave} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[#9AA8C7] mb-1 font-semibold">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>

                <div>
                  <label className="block text-[#9AA8C7] mb-1 font-semibold">Level</label>
                  <select
                    value={editLevel}
                    onChange={(e) => setEditLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  >
                    {ACADEMIC_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[#9AA8C7] mb-1 font-semibold">New Password (optional)</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="w-full px-3 py-2 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#9AA8C7] mb-1 font-semibold">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full px-3 py-2 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="px-4 py-2 rounded-lg bg-[#FFC700] hover:bg-[#ffd233] text-[#0A1224] font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {profileSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>

              {/* Phone Notifications Switch */}
              <div className="pt-3 border-t border-[#24315A] space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#2F52FF]/20 text-[#60A5FA] flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-[#E6ECFA]">Phone notifications</h4>
                      <p className="text-[11px] text-[#9AA8C7] leading-tight">
                        Receive instant phone alerts for announcements, past questions, and lecture changes.
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={phoneNotificationsEnabled}
                      disabled={phoneNotificationsLoading}
                      onChange={handleTogglePhoneNotifications}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#0A1224] border border-[#24315A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#24315A] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2F52FF] peer-checked:border-[#2F52FF] disabled:opacity-50" />
                  </label>
                </div>

                {phoneNotificationsLoading && (
                  <div className="flex items-center gap-2 text-[11px] text-[#FFC700]">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Configuring phone notifications...</span>
                  </div>
                )}

                {phoneNotificationFeedback && (
                  <div
                    className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                      phoneNotificationFeedback.type === 'success'
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {phoneNotificationFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    )}
                    <span>{phoneNotificationFeedback.message}</span>
                  </div>
                )}
              </div>

              {/* Leaderboard Participation Switch (Requirement: OPT-IN, off by default, first name only) */}
              <div className="pt-3 border-t border-[#24315A] space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#FFC700]/15 text-[#FFC700] flex items-center justify-center shrink-0">
                      <Trophy className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-[#E6ECFA]">Show me on the leaderboard</h4>
                      <p className="text-[11px] text-[#9AA8C7] leading-tight">
                        Display your first name on the weekly departmental leaderboard. Emails, matric numbers, and JAMB registration numbers are never shown.
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={Boolean(profile?.showOnLeaderboard)}
                      disabled={leaderboardOptInSaving}
                      onChange={handleToggleLeaderboardOptIn}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#0A1224] border border-[#24315A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#24315A] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFC700] peer-checked:border-[#FFC700] disabled:opacity-50" />
                  </label>
                </div>

                {leaderboardOptInSaving && (
                  <div className="flex items-center gap-2 text-[11px] text-[#FFC700]">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating leaderboard preference...</span>
                  </div>
                )}
              </div>

              {/* Install SOT App (PWA) */}
              <div className="pt-3 border-t border-[#24315A]">
                <PWAInstallRow />
              </div>

              {/* Privacy Policy & Data Rights (Requirement 1) */}
              <div className="pt-3 border-t border-[#24315A] flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-[#9AA8C7]">
                  <ShieldCheck className="w-4 h-4 text-[#FFC700]" />
                  <span>Privacy Policy &amp; Data Rights</span>
                </div>
                <button
                  type="button"
                  onClick={onNavigatePrivacy}
                  className="text-xs font-semibold text-[#FFC700] hover:underline cursor-pointer"
                >
                  View Policy &rarr;
                </button>
              </div>
            </div>

            {/* Red Outlined Full-Width Log Out Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full py-3 px-4 rounded-xl border border-rose-500/50 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 hover:border-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm group"
              >
                <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 6: TIMETABLE                                        */}
        {/* ======================================================== */}
        {activeTab === 'timetables' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#121C36] border border-[#24315A] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center p-0.5 rounded-lg bg-[#0A1224] border border-[#24315A]">
                <button
                  type="button"
                  onClick={() => setTtTypeTab('class')}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                    ttTypeTab === 'class'
                      ? 'bg-[#2F52FF] text-white shadow-sm'
                      : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                  }`}
                >
                  Classes
                </button>
                <button
                  type="button"
                  onClick={() => setTtTypeTab('exam')}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                    ttTypeTab === 'exam'
                      ? 'bg-[#2F52FF] text-white shadow-sm'
                      : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                  }`}
                >
                  Exams
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#9AA8C7] font-semibold">Level:</span>
                <select
                  value={ttLevelFilter}
                  onChange={(e) => setTtLevelFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs font-bold text-[#FFC700] focus:outline-none"
                >
                  {ACADEMIC_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Timetable Items */}
            {timetables
              .filter(
                (t) =>
                  t.department === studentDept &&
                  t.type === ttTypeTab &&
                  t.level === ttLevelFilter
              ).length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#121C36] border border-[#24315A] text-center space-y-2">
                <Calendar className="w-8 h-8 text-[#9AA8C7]/50 mx-auto" />
                <h4 className="text-sm font-bold text-[#E6ECFA]">No timetable posted</h4>
                <p className="text-xs text-[#9AA8C7]">
                  No {ttTypeTab} timetable currently active for {ttLevelFilter} in {studentDept}.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {timetables
                  .filter(
                    (t) =>
                      t.department === studentDept &&
                      t.type === ttTypeTab &&
                      t.level === ttLevelFilter
                  )
                  .map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-[#121C36] border border-[#24315A] flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#FFC700] mr-2">{t.courseCode}</span>
                        <span className="text-[#E6ECFA] font-medium">{t.venue}</span>
                        <div className="text-[11px] text-[#9AA8C7] mt-0.5">
                          {t.day} • {t.startTime} - {t.endTime}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0A1224] text-[#60A5FA] border border-[#24315A]">
                        {t.type}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 7: ANNOUNCEMENTS                                    */}
        {/* ======================================================== */}
        {activeTab === 'announcements' && (
          <div className="space-y-3">
            {relevantAnnouncements.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#121C36] border border-[#24315A] text-center text-xs text-[#9AA8C7]">
                No announcements currently posted for your department.
              </div>
            ) : (
              relevantAnnouncements.map((a) => (
                <div
                  key={a.id}
                  className="p-3.5 rounded-xl bg-[#121C36] border border-[#24315A] space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
                      {a.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#9AA8C7]">
                        {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}
                      </span>
                      <ShareButton
                        title={a.title}
                        itemType="announcement"
                        id={a.id}
                        textDetails={a.category}
                        variant="compact"
                      />
                    </div>
                  </div>
                  <h4 className="font-heading font-bold text-sm text-[#E6ECFA]">{a.title}</h4>
                  <p className="text-xs text-[#9AA8C7] leading-relaxed">{a.content}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 8: GPA CALCULATOR                                   */}
        {/* ======================================================== */}
        {activeTab === 'gpa' && <GpaCalculator />}

        {/* ======================================================== */}
        {/* VIEW 9: STUDY PLANNER                                    */}
        {/* ======================================================== */}
        {activeTab === 'study-planner' && <StudyPlanner />}

        {/* ======================================================== */}
        {/* VIEW 10: SAVED / BOOKMARKS                               */}
        {/* ======================================================== */}
        {activeTab === 'bookmarks' && (
          <StudentBookmarksView
            bookmarks={profile?.bookmarks || []}
            onRemove={(item) => toggleBookmark(item)}
            onNavigateCourses={() => navigateToTab('courses', 'Courses', false)}
            onNavigateAnnouncements={() => navigateToTab('announcements', 'Announcements', true)}
          />
        )}

        {/* ======================================================== */}
        {/* VIEW 11: COMMUNITIES & LINKS                             */}
        {/* ======================================================== */}
        {activeTab === 'links' && <CommunitiesLinksView />}

        {/* ======================================================== */}
        {/* VIEW 12: MY MESSAGES                                     */}
        {/* ======================================================== */}
        {activeTab === 'my-messages' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1">
              <h3 className="font-heading font-bold text-sm text-[#E6ECFA]">
                Submitted Messages &amp; Inquiries
              </h3>
              <button
                onClick={onNavigateContact}
                className="text-xs text-[#FFC700] font-semibold hover:underline cursor-pointer"
              >
                Send New Message &rarr;
              </button>
            </div>

            {loadingMessages ? (
              <div className="p-8 text-center text-xs text-[#9AA8C7]">Loading messages...</div>
            ) : myMessages.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#121C36] border border-[#24315A] text-center space-y-2">
                <MessageSquare className="w-8 h-8 text-[#9AA8C7]/50 mx-auto" />
                <h4 className="text-sm font-bold text-[#E6ECFA]">No messages sent yet</h4>
                <p className="text-xs text-[#9AA8C7]">
                  Have a complaint or enquiry? Reach out through the Contact Desk.
                </p>
              </div>
            ) : (
              myMessages.map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 rounded-xl bg-[#121C36] border border-[#24315A] space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#FFC700]">{m.type}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        m.status === 'Resolved'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                  <p className="text-[#E6ECFA] font-medium">{m.message}</p>
                  {m.adminReply && (
                    <div className="p-2.5 rounded-lg bg-[#0A1224] border border-emerald-500/40 text-[11px] text-emerald-200 mt-2 space-y-1">
                      <span className="font-bold block text-emerald-400">Desk Reply:</span>
                      <p>{m.adminReply}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW: QUIZZES                                            */}
        {/* ======================================================== */}
        {activeTab === 'quizzes' && (
          <StudentQuizzesView
            studentDepartment={studentDept}
            studentLevel={profile?.level || 'ND1'}
            studentName={profile?.fullName}
            matricNumber={profile?.matricNumber || profile?.jambNumber}
            uid={user?.uid || ''}
            onBackToHome={handleGoBack}
            isBookmarked={isBookmarked}
            toggleBookmark={toggleBookmark}
            bookmarks={profile?.bookmarks || []}
            profile={profile}
            onBadgeUnlocked={(badge) => setRecentlyAwardedBadge(badge)}
          />
        )}

        {/* ======================================================== */}
        {/* VIEW: MOCK CBT EXAM                                      */}
        {/* ======================================================== */}
        {activeTab === 'mock-cbt' && (
          <StudentMockCbtView
            studentDepartment={studentDept}
            studentLevel={profile?.level || 'ND1'}
            studentName={profile?.fullName}
            matricNumber={profile?.matricNumber || profile?.jambNumber}
            uid={user?.uid || ''}
            courses={courses}
            quizzes={deptQuizzes}
            onBackToHome={handleGoBack}
            onOpenCourses={() => navigateToTab('courses', 'Courses', true)}
            profile={profile}
            onBadgeUnlocked={(badge) => setRecentlyAwardedBadge(badge)}
          />
        )}

        {/* ======================================================== */}
        {/* VIEW: MY BADGES (Achievements)                           */}
        {/* ======================================================== */}
        {activeTab === 'badges' && (
          <StudentBadgesView
            profile={profile}
            onBackToHome={handleGoBack}
            onOpenQuizzes={() => navigateToTab('quizzes', 'Quizzes', true)}
          />
        )}

        {/* ======================================================== */}
        {/* VIEW: DEPARTMENT LEADERBOARD                             */}
        {/* ======================================================== */}
        {activeTab === 'leaderboard' && (
          <WeeklyLeaderboardView
            studentDepartment={studentDept}
            profile={profile}
            uid={user?.uid || ''}
            onBackToHome={handleGoBack}
            onOpenProfile={() => navigateToBottomTab('profile')}
            onOpenQuizzes={() => navigateToTab('quizzes', 'Quizzes', true)}
            onRefreshProfile={refreshProfile}
          />
        )}
      </main>

      {/* ======================================================== */}
      {/* BOTTOM TAB BAR (ONLY 5 TABS: Home, Courses, Past Qs,     */}
      {/* Ask AI, Profile)                                         */}
      {/* ======================================================== */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0A1224]/95 backdrop-blur-md border-t border-[#24315A] px-2 py-1.5 flex items-center justify-around safe-area-pb">
        {/* 1. Home */}
        <button
          onClick={() => navigateToBottomTab('overview')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'overview' ? 'text-[#FFC700] font-bold' : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'overview' ? 'bg-[#2F52FF]/25 text-[#FFC700]' : ''}`}>
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Home</span>
        </button>

        {/* 2. Courses */}
        <button
          onClick={() => navigateToBottomTab('courses')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'courses' ? 'text-[#FFC700] font-bold' : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'courses' ? 'bg-[#2F52FF]/25 text-[#FFC700]' : ''}`}>
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Courses</span>
        </button>

        {/* 3. Past Questions */}
        <button
          onClick={() => navigateToBottomTab('past-questions')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'past-questions' ? 'text-[#FFC700] font-bold' : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'past-questions' ? 'bg-[#2F52FF]/25 text-[#FFC700]' : ''}`}>
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Past Questions</span>
        </button>

        {/* 4. Ask AI */}
        <button
          onClick={() => navigateToBottomTab('ask-ai')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'ask-ai' ? 'text-[#FFC700] font-bold' : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'ask-ai' ? 'bg-[#2F52FF]/25 text-[#FFC700]' : ''}`}>
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Ask AI</span>
        </button>

        {/* 5. Profile */}
        <button
          onClick={() => navigateToBottomTab('profile')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'profile' ? 'text-[#FFC700] font-bold' : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'profile' ? 'bg-[#2F52FF]/25 text-[#FFC700]' : ''}`}>
            <User className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Profile</span>
        </button>
      </nav>

      {/* Logout Confirmation Sheet */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-[#070D1A]/85 backdrop-blur-sm">
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

      {/* Quick PDF Viewer Modal */}
      {quickPdfViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#070D1A]/90 backdrop-blur-md">
          <div className="relative w-full max-w-4xl h-[90vh] bg-[#0A1224] border border-[#24315A] rounded-2xl flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <div className="p-3.5 bg-[#121C36] border-b border-[#24315A] flex items-center justify-between gap-3">
              <div className="min-w-0">
                {quickPdfViewer.courseCode && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-[#2F52FF] text-white mr-2">
                    {quickPdfViewer.courseCode}
                  </span>
                )}
                <h3 className="font-heading font-bold text-sm text-[#E6ECFA] truncate inline-block">
                  {quickPdfViewer.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={quickPdfViewer.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#121C36] hover:bg-[#1A2E63] text-[#E6ECFA] border border-[#24315A] text-xs font-semibold flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#FFC700]" />
                  <span className="hidden sm:inline">External</span>
                </a>
                <a
                  href={getPdfDownloadUrl(quickPdfViewer.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2542D9] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setQuickPdfViewer(null)}
                  className="p-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#9AA8C7] hover:text-white hover:border-rose-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-[#070D1A]">
              <iframe
                src={quickPdfViewer.url}
                title={quickPdfViewer.title}
                className="w-full h-full border-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
