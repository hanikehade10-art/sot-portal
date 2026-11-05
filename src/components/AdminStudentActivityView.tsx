/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, StudentActivityItem, QuizItem, QuizAttempt } from '../types';
import { formatRelativeTime, formatExactDate } from '../lib/studentActivity';
import {
  Users,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  FileQuestion,
  Download,
  Calendar,
  Layers,
  Smartphone,
  Monitor,
  Activity,
  Award,
  ChevronRight,
  X,
  RefreshCw,
  BookOpen,
  LogIn,
  LogOut,
  Eye,
  Check,
  AlertTriangle
} from 'lucide-react';

export const AdminStudentActivityView: React.FC = () => {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [activityLogs, setActivityLogs] = useState<StudentActivityItem[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view tab: 'students' or 'per-quiz'
  const [currentTab, setCurrentTab] = useState<'students' | 'per-quiz'>('students');

  // Filters for Students Table
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [selectedLevel, setSelectedLevel] = useState<string>('All');
  const [filterNeverLoggedIn, setFilterNeverLoggedIn] = useState(false);
  const [filterInactive7Days, setFilterInactive7Days] = useState(false);

  // Exact date popover tracking (student id -> boolean)
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // Drilldown Modal for selected student
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);

  // Per-Quiz Analytics selection
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');

  // 1. Subscribe to Firestore data
  useEffect(() => {
    // Users collection
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list: UserProfile[] = [];
      snap.forEach(d => {
        const data = d.data() as UserProfile;
        // Include only student accounts (or all non-admin)
        if (data.role !== 'admin') {
          list.push({ ...data, uid: d.id });
        }
      });
      setStudents(list);
    }, (err) => console.warn('Error reading users for activity tracking:', err));

    // Student Activity collection (limit to last 2000 events for high performance)
    const qActivity = query(collection(db, 'studentActivity'), orderBy('createdAt', 'desc'), limit(2000));
    const unsubActivity = onSnapshot(qActivity, (snap) => {
      const list: StudentActivityItem[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as StudentActivityItem);
      });
      setActivityLogs(list);
    }, (err) => console.warn('Error reading studentActivity:', err));

    // Quizzes collection
    const unsubQuizzes = onSnapshot(collection(db, 'quizzes'), (snap) => {
      const list: QuizItem[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as QuizItem);
      });
      setQuizzes(list);
      if (list.length > 0 && !selectedQuizId) {
        setSelectedQuizId(list[0].id);
      }
    }, (err) => console.warn('Error reading quizzes:', err));

    // Quiz Attempts collection
    const unsubAttempts = onSnapshot(collection(db, 'quizAttempts'), (snap) => {
      const list: QuizAttempt[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as QuizAttempt);
      });
      setQuizAttempts(list);
      setLoading(false);
    }, (err) => {
      console.warn('Error reading quizAttempts:', err);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubActivity();
      unsubQuizzes();
      unsubAttempts();
    };
  }, []);

  // Compute student activity map (uid -> latest activity event)
  const studentLatestActivityMap = useMemo(() => {
    const map: Record<string, StudentActivityItem> = {};
    activityLogs.forEach(log => {
      if (!map[log.uid]) {
        map[log.uid] = log;
      }
    });
    return map;
  }, [activityLogs]);

  // Compute student quiz stats (uid -> { attemptsCount, avgScore, attemptsList })
  const studentQuizStatsMap = useMemo(() => {
    const map: Record<string, { attemptsCount: number; avgScore: number; attempts: QuizAttempt[] }> = {};

    quizAttempts.forEach(att => {
      if (!map[att.uid]) {
        map[att.uid] = { attemptsCount: 0, avgScore: 0, attempts: [] };
      }
      map[att.uid].attempts.push(att);
      map[att.uid].attemptsCount += 1;
    });

    Object.keys(map).forEach(uid => {
      const atts = map[uid].attempts;
      if (atts.length > 0) {
        const totalPct = atts.reduce((sum, a) => {
          const pct = typeof a.percentage === 'number'
            ? a.percentage
            : (a.total > 0 ? Math.round((a.score / a.total) * 100) : 0);
          return sum + pct;
        }, 0);
        map[uid].avgScore = Math.round(totalPct / atts.length);
      }
    });

    return map;
  }, [quizAttempts]);

  // ---------------------------------------------------------------------------
  // TOP STATS CARDS
  // ---------------------------------------------------------------------------
  const nowMs = Date.now();
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const todayDateString = new Date().toDateString();

  // 1. Online Now (active in the last 5 minutes)
  const onlineNowCount = useMemo(() => {
    return students.filter(s => {
      if (!s.lastActiveAt) return false;
      const t = new Date(s.lastActiveAt).getTime();
      return !isNaN(t) && nowMs - t <= FIVE_MINUTES_MS;
    }).length;
  }, [students, nowMs]);

  // 2. Logged In Today
  const loggedInTodayCount = useMemo(() => {
    return students.filter(s => {
      if (!s.lastLoginAt) return false;
      const d = new Date(s.lastLoginAt);
      return !isNaN(d.getTime()) && d.toDateString() === todayDateString;
    }).length;
  }, [students, todayDateString]);

  // 3. Active This Week (last 7 days)
  const activeThisWeekCount = useMemo(() => {
    return students.filter(s => {
      const activeTime = s.lastActiveAt ? new Date(s.lastActiveAt).getTime() : 0;
      const loginTime = s.lastLoginAt ? new Date(s.lastLoginAt).getTime() : 0;
      const mostRecent = Math.max(activeTime, loginTime);
      return mostRecent > 0 && nowMs - mostRecent <= SEVEN_DAYS_MS;
    }).length;
  }, [students, nowMs]);

  // 4. Quizzes Taken Today
  const quizzesTakenTodayCount = useMemo(() => {
    return quizAttempts.filter(att => {
      const t = att.submittedAt ? new Date(att.submittedAt) : null;
      return t && !isNaN(t.getTime()) && t.toDateString() === todayDateString;
    }).length;
  }, [quizAttempts, todayDateString]);

  // ---------------------------------------------------------------------------
  // FILTERED STUDENTS LIST
  // ---------------------------------------------------------------------------
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      if (s.department) set.add(s.department);
    });
    return Array.from(set).sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (student.fullName || '').toLowerCase();
        const email = (student.email || '').toLowerCase();
        const matric = (student.matricNumber || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !matric.includes(q)) {
          return false;
        }
      }

      // Department
      if (selectedDept !== 'All' && student.department !== selectedDept) {
        return false;
      }

      // Level
      if (selectedLevel !== 'All' && student.level !== selectedLevel) {
        return false;
      }

      // Filter: Never logged in
      if (filterNeverLoggedIn) {
        const hasNeverLoggedIn = !student.lastLoginAt || (student.loginCount || 0) === 0;
        if (!hasNeverLoggedIn) return false;
      }

      // Filter: Inactive for 7 days
      if (filterInactive7Days) {
        const activeTime = student.lastActiveAt ? new Date(student.lastActiveAt).getTime() : 0;
        const loginTime = student.lastLoginAt ? new Date(student.lastLoginAt).getTime() : 0;
        const mostRecent = Math.max(activeTime, loginTime);
        const isInactive = mostRecent === 0 || nowMs - mostRecent > SEVEN_DAYS_MS;
        if (!isInactive) return false;
      }

      return true;
    });
  }, [students, searchQuery, selectedDept, selectedLevel, filterNeverLoggedIn, filterInactive7Days, nowMs]);

  // ---------------------------------------------------------------------------
  // PER QUIZ ANALYTICS
  // ---------------------------------------------------------------------------
  const activeQuiz = useMemo(() => {
    return quizzes.find(q => q.id === selectedQuizId) || quizzes[0] || null;
  }, [quizzes, selectedQuizId]);

  // Attempts specifically for active quiz
  const activeQuizAttempts = useMemo(() => {
    if (!activeQuiz) return [];
    return quizAttempts.filter(a => a.quizId === activeQuiz.id);
  }, [activeQuiz, quizAttempts]);

  // Eligible students for this quiz (matching department and optionally level)
  const eligibleStudents = useMemo(() => {
    if (!activeQuiz) return [];
    return students.filter(s => {
      if (s.department && activeQuiz.department && activeQuiz.department !== 'All') {
        if (s.department.toLowerCase() !== activeQuiz.department.toLowerCase()) return false;
      }
      if (s.level && activeQuiz.level && activeQuiz.level !== 'All') {
        if (s.level !== activeQuiz.level) return false;
      }
      return true;
    });
  }, [activeQuiz, students]);

  // Students who took it vs who has not
  const { studentsTaken, studentsNotTaken } = useMemo(() => {
    const takenUids = new Set(activeQuizAttempts.map(a => a.uid));
    const taken: Array<{ student: UserProfile; attempt: QuizAttempt }> = [];
    const notTaken: UserProfile[] = [];

    // Map taken
    activeQuizAttempts.forEach(att => {
      const studentObj = students.find(s => s.uid === att.uid) || {
        uid: att.uid,
        fullName: att.studentName || 'Student',
        email: '',
        matricNumber: att.matricNumber || '',
        department: att.department,
        profileComplete: true,
        role: 'student' as const
      };
      taken.push({ student: studentObj, attempt: att });
    });

    // Determine who has not from eligible students
    eligibleStudents.forEach(s => {
      if (!takenUids.has(s.uid)) {
        notTaken.push(s);
      }
    });

    return { studentsTaken: taken, studentsNotTaken: notTaken };
  }, [activeQuizAttempts, eligibleStudents, students]);

  const quizPassRate = useMemo(() => {
    if (activeQuizAttempts.length === 0) return 0;
    const passedCount = activeQuizAttempts.filter(a => a.passed).length;
    return Math.round((passedCount / activeQuizAttempts.length) * 100);
  }, [activeQuizAttempts]);

  const quizAvgScore = useMemo(() => {
    if (activeQuizAttempts.length === 0) return 0;
    const totalPct = activeQuizAttempts.reduce((sum, a) => {
      const pct = typeof a.percentage === 'number'
        ? a.percentage
        : (a.total > 0 ? Math.round((a.score / a.total) * 100) : 0);
      return sum + pct;
    }, 0);
    return Math.round(totalPct / activeQuizAttempts.length);
  }, [activeQuizAttempts]);

  // CSV Export for the selected quiz
  const handleExportQuizCsv = () => {
    if (!activeQuiz) return;

    const headers = [
      'Student Name',
      'Matric Number',
      'Email',
      'Department',
      'Level',
      'Status',
      'Score',
      'Total Questions',
      'Percentage (%)',
      'Passed',
      'Attempts Count',
      'Submitted At'
    ];

    const rows: string[][] = [];

    // Add students who took the quiz
    studentsTaken.forEach(({ student, attempt }) => {
      rows.push([
        `"${(student.fullName || attempt.studentName || 'Student').replace(/"/g, '""')}"`,
        `"${(student.matricNumber || attempt.matricNumber || '').replace(/"/g, '""')}"`,
        `"${(student.email || '').replace(/"/g, '""')}"`,
        `"${(student.department || attempt.department || '').replace(/"/g, '""')}"`,
        `"${(student.level || '').replace(/"/g, '""')}"`,
        '"Completed"',
        String(attempt.score ?? 0),
        String(attempt.total ?? 0),
        `${attempt.percentage ?? 0}%`,
        attempt.passed ? '"Passed"' : '"Failed"',
        String(attempt.attempts ?? 1),
        `"${formatExactDate(attempt.submittedAt)}"`
      ]);
    });

    // Add students who have not taken it
    studentsNotTaken.forEach((student) => {
      rows.push([
        `"${(student.fullName || 'Student').replace(/"/g, '""')}"`,
        `"${(student.matricNumber || '').replace(/"/g, '""')}"`,
        `"${(student.email || '').replace(/"/g, '""')}"`,
        `"${(student.department || '').replace(/"/g, '""')}"`,
        `"${(student.level || '').replace(/"/g, '""')}"`,
        '"Not Taken"',
        '"-"',
        `"${activeQuiz.questionCount || (activeQuiz.questions?.length || 0)}"`,
        '"-"',
        '"-"',
        '"0"',
        '"-"'
      ]);
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanQuizTitle = (activeQuiz.courseCode + '_' + activeQuiz.title).replace(/[^a-zA-Z0-9_-]/g, '_');
    link.setAttribute('download', `Quiz_Results_${cleanQuizTitle}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper for timeline badges
  const renderEventTypeBadge = (type: string) => {
    switch (type) {
      case 'login':
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
            <LogIn className="w-3 h-3" />
            <span>Login</span>
          </span>
        );
      case 'logout':
        return (
          <span className="px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/30 text-[10px] font-bold flex items-center gap-1">
            <LogOut className="w-3 h-3" />
            <span>Logout</span>
          </span>
        );
      case 'lesson opened':
        return (
          <span className="px-2 py-0.5 rounded-full bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/40 text-[10px] font-bold flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            <span>Lesson Opened</span>
          </span>
        );
      case 'topic completed':
        return (
          <span className="px-2 py-0.5 rounded-full bg-[#FFC700]/20 text-[#FFC700] border border-[#FFC700]/40 text-[10px] font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Topic Completed</span>
          </span>
        );
      case 'quiz started':
        return (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Quiz Started</span>
          </span>
        );
      case 'quiz submitted':
        return (
          <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold flex items-center gap-1">
            <Award className="w-3 h-3" />
            <span>Quiz Submitted</span>
          </span>
        );
      case 'past question opened':
        return (
          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold flex items-center gap-1">
            <Eye className="w-3 h-3" />
            <span>Past Question</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-[#121C36] text-[#9AA8C7] border border-[#24315A] text-[10px] font-bold">
            {type}
          </span>
        );
    }
  };

  // Helper for device icon
  const renderDeviceBadge = (device?: string) => {
    if (device === 'Android') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-[10px] text-emerald-400 font-semibold" title="Device: Android">
          <Smartphone className="w-3 h-3" />
          <span>Android</span>
        </span>
      );
    }
    if (device === 'iPhone') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-950/40 border border-sky-500/30 text-[10px] text-sky-400 font-semibold" title="Device: iPhone">
          <Smartphone className="w-3 h-3" />
          <span>iPhone</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#070D1A] border border-[#1E2E52] text-[10px] text-[#9AA8C7] font-semibold" title="Device: Desktop">
        <Monitor className="w-3 h-3" />
        <span>Desktop</span>
      </span>
    );
  };

  // Student timeline events for the drilldown modal
  const selectedStudentTimeline = useMemo(() => {
    if (!selectedStudent) return [];
    return activityLogs.filter(log => log.uid === selectedStudent.uid);
  }, [selectedStudent, activityLogs]);

  // Student quiz attempts for the drilldown modal
  const selectedStudentAttempts = useMemo(() => {
    if (!selectedStudent) return [];
    return quizAttempts.filter(a => a.uid === selectedStudent.uid);
  }, [selectedStudent, quizAttempts]);

  return (
    <div className="space-y-5 pb-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-[#0F1E36] border border-[#1E2E52]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFC700]" />
            <h2 className="font-heading font-extrabold text-base sm:text-lg text-[#E6ECFA]">
              Student Activity & Engagement
            </h2>
          </div>
          <p className="text-xs text-[#9AA8C7] mt-0.5">
            Real-time attendance, active sessions, syllabus lesson engagement and quiz completion metrics.
          </p>
        </div>

        {/* Tab Switcher: Students vs Per Quiz */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#070D1A] border border-[#1E2E52] self-start md:self-auto">
          <button
            onClick={() => setCurrentTab('students')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'students'
                ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.4)]'
                : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
            }`}
          >
            Students Activity ({students.length})
          </button>
          <button
            onClick={() => setCurrentTab('per-quiz')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'per-quiz'
                ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.4)]'
                : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
            }`}
          >
            Per Quiz Analytics
          </button>
        </div>
      </div>

      {/* TOP 4 STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Online Now */}
        <div className="p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52] space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9AA8C7]">
              Online Now
            </span>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          </div>
          <div className="font-heading font-black text-2xl sm:text-3xl text-emerald-400">
            {onlineNowCount}
          </div>
          <p className="text-[10px] text-[#9AA8C7]">
            Active within the last 5 minutes
          </p>
        </div>

        {/* Card 2: Logged In Today */}
        <div className="p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9AA8C7]">
              Logged In Today
            </span>
            <LogIn className="w-4 h-4 text-[#FFC700]" />
          </div>
          <div className="font-heading font-black text-2xl sm:text-3xl text-[#FFC700]">
            {loggedInTodayCount}
          </div>
          <p className="text-[10px] text-[#9AA8C7]">
            Distinct students signed in today
          </p>
        </div>

        {/* Card 3: Active This Week */}
        <div className="p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9AA8C7]">
              Active This Week
            </span>
            <Activity className="w-4 h-4 text-[#60A5FA]" />
          </div>
          <div className="font-heading font-black text-2xl sm:text-3xl text-[#60A5FA]">
            {activeThisWeekCount}
          </div>
          <p className="text-[10px] text-[#9AA8C7]">
            Seen in the last 7 calendar days
          </p>
        </div>

        {/* Card 4: Quizzes Taken Today */}
        <div className="p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9AA8C7]">
              Quizzes Taken Today
            </span>
            <Award className="w-4 h-4 text-purple-400" />
          </div>
          <div className="font-heading font-black text-2xl sm:text-3xl text-purple-400">
            {quizzesTakenTodayCount}
          </div>
          <p className="text-[10px] text-[#9AA8C7]">
            Total submissions scored today
          </p>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* VIEW 1: STUDENTS ACTIVITY TABLE                                      */}
      {/* ===================================================================== */}
      {currentTab === 'students' && (
        <div className="space-y-3">
          {/* Filter Bar */}
          <div className="p-3.5 rounded-2xl bg-[#0F1E36] border border-[#1E2E52] space-y-3">
            <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#9AA8C7]" />
                <input
                  type="text"
                  placeholder="Search student by name, matric number, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              {/* Department Dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                >
                  <option value="All">All Departments</option>
                  {departmentsList.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>

                {/* Level Dropdown */}
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                >
                  <option value="All">All Levels</option>
                  <option value="ND1">ND1</option>
                  <option value="ND2">ND2</option>
                  <option value="HND1">HND1</option>
                  <option value="HND2">HND2</option>
                </select>
              </div>
            </div>

            {/* Quick Checkbox Filters */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#1E2E52]/60 text-xs">
              <span className="text-[11px] font-semibold text-[#9AA8C7] flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-[#FFC700]" />
                <span>Quick Filters:</span>
              </span>

              <label className="flex items-center gap-1.5 cursor-pointer select-none text-[#E6ECFA]">
                <input
                  type="checkbox"
                  checked={filterNeverLoggedIn}
                  onChange={(e) => setFilterNeverLoggedIn(e.target.checked)}
                  className="rounded bg-[#070D1A] border-[#1E2E52] text-[#2F52FF] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="text-xs">Never logged in</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none text-[#E6ECFA]">
                <input
                  type="checkbox"
                  checked={filterInactive7Days}
                  onChange={(e) => setFilterInactive7Days(e.target.checked)}
                  className="rounded bg-[#070D1A] border-[#1E2E52] text-[#2F52FF] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="text-xs">Inactive for 7 days</span>
              </label>

              {(filterNeverLoggedIn || filterInactive7Days || selectedDept !== 'All' || selectedLevel !== 'All' || searchQuery) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedDept('All');
                    setSelectedLevel('All');
                    setFilterNeverLoggedIn(false);
                    setFilterInactive7Days(false);
                  }}
                  className="text-xs text-[#60A5FA] hover:underline cursor-pointer ml-auto"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-2xl bg-[#0F1E36] border border-[#1E2E52] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#070D1A] border-b border-[#1E2E52] text-[#9AA8C7] text-[11px]">
                    <th className="py-3 px-3.5 font-bold">Student</th>
                    <th className="py-3 px-3.5 font-bold">Dept & Level</th>
                    <th className="py-3 px-3.5 font-bold">Last Login</th>
                    <th className="py-3 px-3.5 font-bold text-center">Logins</th>
                    <th className="py-3 px-3.5 font-bold">Last Activity</th>
                    <th className="py-3 px-3.5 font-bold text-center">Quizzes</th>
                    <th className="py-3 px-3.5 font-bold text-center">Avg Score</th>
                    <th className="py-3 px-3.5 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2E52]/60">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#9AA8C7]">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#2F52FF]" />
                        <span>Loading student activity...</span>
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#9AA8C7] italic">
                        No students match the current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(student => {
                      const latestAct = studentLatestActivityMap[student.uid];
                      const quizStats = studentQuizStatsMap[student.uid];
                      const isDateExpanded = expandedDates[student.uid];

                      // Check online status (< 5 mins)
                      const isOnline = student.lastActiveAt
                        ? nowMs - new Date(student.lastActiveAt).getTime() <= FIVE_MINUTES_MS
                        : false;

                      return (
                        <tr
                          key={student.uid}
                          onClick={() => setSelectedStudent(student)}
                          className="hover:bg-[#121C36] transition-colors cursor-pointer group"
                        >
                          {/* 1. Student Name & Matric */}
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-400' : 'bg-slate-600'}`} title={isOnline ? 'Active now' : 'Offline'} />
                              <div>
                                <div className="font-bold text-[#E6ECFA] group-hover:text-white flex items-center gap-1.5">
                                  <span>{student.fullName || 'Student'}</span>
                                  {renderDeviceBadge(student.lastDevice)}
                                </div>
                                <div className="text-[11px] text-[#9AA8C7] flex items-center gap-2 mt-0.5">
                                  <span className="font-mono text-[#FFC700]">{student.matricNumber || 'No Matric'}</span>
                                  <span>•</span>
                                  <span className="truncate max-w-[140px]">{student.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Department & Level */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="text-[#E6ECFA] font-medium">{student.department || 'General'}</div>
                            <div className="text-[10px] text-[#FFC700] font-bold">{student.level || 'ND1'}</div>
                          </td>

                          {/* 3. Last Login (Tap to reveal exact date) */}
                          <td
                            className="py-3 px-3.5 whitespace-nowrap"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedDates(prev => ({ ...prev, [student.uid]: !prev[student.uid] }));
                            }}
                          >
                            <div className="cursor-pointer" title="Tap to toggle exact date">
                              <span className="text-[#E6ECFA] font-semibold underline decoration-dotted underline-offset-2">
                                {formatRelativeTime(student.lastLoginAt)}
                              </span>
                              {isDateExpanded && (
                                <div className="text-[10px] text-[#60A5FA] font-mono mt-0.5">
                                  {formatExactDate(student.lastLoginAt)}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* 4. Login Count */}
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-[#070D1A] border border-[#1E2E52] text-[#E6ECFA] font-bold text-[11px]">
                              {student.loginCount || 0}
                            </span>
                          </td>

                          {/* 5. Last Activity */}
                          <td className="py-3 px-3.5 max-w-[200px]">
                            {latestAct ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  {renderEventTypeBadge(latestAct.type)}
                                  <span className="text-[10px] text-[#9AA8C7]">
                                    {formatRelativeTime(latestAct.createdAt)}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#E6ECFA] truncate font-medium">
                                  {latestAct.title}
                                </p>
                              </div>
                            ) : (
                              <span className="text-[#9AA8C7] italic text-[11px]">No activity logged</span>
                            )}
                          </td>

                          {/* 6. Quizzes Taken */}
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              (quizStats?.attemptsCount || 0) > 0
                                ? 'bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/40'
                                : 'bg-[#070D1A] text-[#9AA8C7] border border-[#1E2E52]'
                            }`}>
                              {quizStats?.attemptsCount || 0}
                            </span>
                          </td>

                          {/* 7. Average Score */}
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            {(quizStats?.attemptsCount || 0) > 0 ? (
                              <span className={`font-bold text-xs ${
                                (quizStats?.avgScore || 0) >= 70
                                  ? 'text-emerald-400'
                                  : (quizStats?.avgScore || 0) >= 50
                                  ? 'text-[#FFC700]'
                                  : 'text-rose-400'
                              }`}>
                                {quizStats?.avgScore}%
                              </span>
                            ) : (
                              <span className="text-[#9AA8C7] text-xs">-</span>
                            )}
                          </td>

                          {/* 8. Action button */}
                          <td className="py-3 px-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedStudent(student)}
                              className="px-2.5 py-1 rounded-lg bg-[#2F52FF]/20 hover:bg-[#2F52FF] text-[#60A5FA] hover:text-white transition-all text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>Timeline</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 2: PER QUIZ ANALYTICS                                           */}
      {/* ===================================================================== */}
      {currentTab === 'per-quiz' && (
        <div className="space-y-4">
          {/* Quiz Selector & Summary Banner */}
          <div className="p-4 rounded-2xl bg-[#0F1E36] border border-[#1E2E52] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E2E52]">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#9AA8C7] mb-1">
                  Select Quiz for Analysis
                </label>
                <select
                  value={selectedQuizId}
                  onChange={(e) => setSelectedQuizId(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs font-bold text-[#FFC700] focus:outline-none focus:border-[#2F52FF] min-w-[280px]"
                >
                  {quizzes.map(q => (
                    <option key={q.id} value={q.id}>
                      {q.courseCode}: {q.title} ({q.department} • {q.level})
                    </option>
                  ))}
                </select>
              </div>

              {/* CSV Export Button */}
              <button
                onClick={handleExportQuizCsv}
                disabled={!activeQuiz}
                className="px-4 py-2 rounded-xl bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(47,82,255,0.4)] flex items-center gap-2 cursor-pointer self-start sm:self-auto disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-[#FFC700]" />
                <span>Export Results (CSV)</span>
              </button>
            </div>

            {/* Quiz Performance Metrics */}
            {activeQuiz ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#070D1A] border border-[#1E2E52] space-y-0.5">
                  <span className="text-[10px] text-[#9AA8C7] font-semibold uppercase">Completed</span>
                  <div className="font-heading font-black text-xl text-emerald-400">
                    {studentsTaken.length} <span className="text-xs font-normal text-[#9AA8C7]">students</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#070D1A] border border-[#1E2E52] space-y-0.5">
                  <span className="text-[10px] text-[#9AA8C7] font-semibold uppercase">Pending / Not Taken</span>
                  <div className="font-heading font-black text-xl text-amber-400">
                    {studentsNotTaken.length} <span className="text-xs font-normal text-[#9AA8C7]">students</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#070D1A] border border-[#1E2E52] space-y-0.5">
                  <span className="text-[10px] text-[#9AA8C7] font-semibold uppercase">Average Score</span>
                  <div className="font-heading font-black text-xl text-[#FFC700]">
                    {quizAvgScore}%
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#070D1A] border border-[#1E2E52] space-y-0.5">
                  <span className="text-[10px] text-[#9AA8C7] font-semibold uppercase">Passing Rate</span>
                  <div className="font-heading font-black text-xl text-[#60A5FA]">
                    {quizPassRate}%
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-[#9AA8C7]">
                No quiz selected or no quizzes available in the database.
              </div>
            )}
          </div>

          {/* Table: Who took it & Who has not */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Column: Who Took It */}
            <div className="rounded-2xl bg-[#0F1E36] border border-[#1E2E52] overflow-hidden shadow-sm">
              <div className="p-3.5 bg-[#070D1A] border-b border-[#1E2E52] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-xs text-[#E6ECFA]">
                    Completed Submissions ({studentsTaken.length})
                  </span>
                </div>
                <span className="text-[10px] text-[#9AA8C7]">Scores &amp; Time</span>
              </div>

              <div className="max-h-[500px] overflow-y-auto divide-y divide-[#1E2E52]/60">
                {studentsTaken.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#9AA8C7] italic">
                    No student has submitted this quiz yet.
                  </div>
                ) : (
                  studentsTaken.map(({ student, attempt }) => (
                    <div key={attempt.id} className="p-3 hover:bg-[#121C36] transition-colors flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-xs text-[#E6ECFA]">
                          {student.fullName || attempt.studentName || 'Student'}
                        </div>
                        <div className="text-[10px] text-[#9AA8C7] font-mono mt-0.5">
                          {student.matricNumber || attempt.matricNumber || 'No Matric'} • {formatRelativeTime(attempt.submittedAt)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="font-mono font-bold text-xs text-[#FFC700]">
                            {attempt.score}/{attempt.total}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            attempt.passed
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}>
                            {attempt.percentage ?? (attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0)}%
                          </span>
                        </div>
                        <div className="text-[10px] text-[#9AA8C7] mt-0.5">
                          Attempt #{attempt.attempts || 1}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Who Has Not */}
            <div className="rounded-2xl bg-[#0F1E36] border border-[#1E2E52] overflow-hidden shadow-sm">
              <div className="p-3.5 bg-[#070D1A] border-b border-[#1E2E52] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-xs text-[#E6ECFA]">
                    Eligible Students Pending ({studentsNotTaken.length})
                  </span>
                </div>
                <span className="text-[10px] text-[#9AA8C7]">Target Dept/Level</span>
              </div>

              <div className="max-h-[500px] overflow-y-auto divide-y divide-[#1E2E52]/60">
                {studentsNotTaken.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#9AA8C7] italic">
                    All eligible students have taken this quiz!
                  </div>
                ) : (
                  studentsNotTaken.map(student => (
                    <div key={student.uid} className="p-3 hover:bg-[#121C36] transition-colors flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-xs text-[#E6ECFA]">
                          {student.fullName || 'Student'}
                        </div>
                        <div className="text-[10px] text-[#9AA8C7] font-mono mt-0.5">
                          {student.matricNumber || 'No Matric'} • {student.department || 'General'} ({student.level || 'ND1'})
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-semibold">
                          Not Taken
                        </span>
                        <div className="text-[10px] text-[#9AA8C7] mt-0.5">
                          Last seen: {formatRelativeTime(student.lastActiveAt || student.lastLoginAt)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STUDENT TIMELINE & QUIZ DRILLDOWN MODAL                               */}
      {/* ===================================================================== */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-[#0F1E36] border border-[#1E2E52] p-5 shadow-2xl flex flex-col space-y-4">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-[#1E2E52]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-extrabold text-base text-[#E6ECFA]">
                    {selectedStudent.fullName || 'Student Activity Timeline'}
                  </h3>
                  {renderDeviceBadge(selectedStudent.lastDevice)}
                </div>
                <div className="text-xs text-[#9AA8C7] flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-[#FFC700] font-mono font-bold">{selectedStudent.matricNumber || 'No Matric'}</span>
                  <span>•</span>
                  <span>{selectedStudent.department} ({selectedStudent.level})</span>
                  <span>•</span>
                  <span>{selectedStudent.email}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1 rounded-lg text-[#9AA8C7] hover:text-white hover:bg-[#1E2E52] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Metrics Header inside modal */}
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-center text-xs">
              <div>
                <span className="text-[10px] text-[#9AA8C7] block">Total Logins</span>
                <span className="font-bold text-[#E6ECFA]">{selectedStudent.loginCount || 0} times</span>
              </div>
              <div>
                <span className="text-[10px] text-[#9AA8C7] block">Last Login</span>
                <span className="font-bold text-[#FFC700]">{formatRelativeTime(selectedStudent.lastLoginAt)}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#9AA8C7] block">Quizzes Taken</span>
                <span className="font-bold text-purple-400">{selectedStudentAttempts.length} quizzes</span>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* SECTION A: EVENT TIMELINE (NEWEST FIRST) */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFC700] mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Activity Timeline (Newest First)</span>
                </h4>

                {selectedStudentTimeline.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#9AA8C7] italic text-center">
                    No discrete events recorded yet for this student.
                  </div>
                ) : (
                  <div className="relative pl-4 border-l-2 border-[#1E2E52] space-y-3 my-2">
                    {selectedStudentTimeline.map((item, idx) => (
                      <div key={item.id || idx} className="relative group">
                        {/* Bullet Dot */}
                        <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#2F52FF] border-2 border-[#0F1E36]" />

                        <div className="p-2.5 rounded-xl bg-[#070D1A] border border-[#1E2E52] hover:border-[#2F52FF]/60 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {renderEventTypeBadge(item.type)}
                              <span className="font-semibold text-xs text-[#E6ECFA]">
                                {item.title}
                              </span>
                            </div>
                            <span className="text-[10px] text-[#9AA8C7] whitespace-nowrap">
                              {formatRelativeTime(item.createdAt)}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#60A5FA] font-mono mt-1">
                            {formatExactDate(item.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION B: QUIZ ATTEMPTS HISTORY */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#60A5FA] mb-2 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" />
                  <span>Quiz Submissions History</span>
                </h4>

                {selectedStudentAttempts.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#9AA8C7] italic text-center">
                    This student has not submitted any quizzes yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedStudentAttempts.map(att => {
                      const quiz = quizzes.find(q => q.id === att.quizId);
                      return (
                        <div
                          key={att.id}
                          className="p-3 rounded-xl bg-[#070D1A] border border-[#1E2E52] flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="font-bold text-[#E6ECFA]">
                              {quiz?.courseCode || 'Quiz'}: {quiz?.title || att.quizId}
                            </div>
                            <div className="text-[10px] text-[#9AA8C7] mt-0.5">
                              Submitted: {formatExactDate(att.submittedAt)}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="flex items-center gap-1.5 justify-end">
                              <span className="font-mono font-bold text-xs text-[#FFC700]">
                                {att.score}/{att.total}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                att.passed
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              }`}>
                                {att.passed ? 'PASSED' : 'FAILED'} ({att.percentage ?? 0}%)
                              </span>
                            </div>
                            <span className="text-[10px] text-[#9AA8C7]">
                              Attempts: {att.attempts || 1}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-[#1E2E52] flex justify-end">
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-1.5 rounded-lg border border-[#1E2E52] text-xs font-semibold text-[#9AA8C7] hover:text-[#E6ECFA] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
