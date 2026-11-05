import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, sanitizeMatricId, sanitizeJambId } from '../context/AuthContext';
import { db } from '../lib/firebase';
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import {
  UserProfile,
  ContactMessage,
  AnnouncementItem,
  FaqItem,
  CourseItem,
  CourseMaterial,
  CourseMaterialCategory,
  ResourceCategory,
  ResourceItem,
  TimetableEntry,
  GradingScaleEntry
} from '../types';
import { SOT_DEPARTMENTS_LIST, INITIAL_ANNOUNCEMENTS } from '../data/departments';
import {
  INITIAL_COURSES,
  INITIAL_TIMETABLES,
  normalizeCourseLevel,
  normalizeCourseSemester,
  formatPdfUrl
} from '../data/coursesAndTimetables';
import { DEFAULT_GRADING_SCALE } from '../config/gradingScale';
import { WhatsAppIcon } from './WhatsAppIcon';
import { WhatsAppChannelButton } from './WhatsAppChannelButton';
import { PWAInstallRow } from './PWAInstallRow';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Calendar,
  Bell,
  MessageSquare,
  Bot,
  Search,
  Plus,
  Trash2,
  Edit2,
  X,
  Menu,
  LogOut,
  RefreshCw,
  Download,
  ShieldCheck,
  Ban,
  Mail,
  Layers,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  Home,
  Send,
  CheckCircle,
  Sparkles,
  FolderOpen,
  ExternalLink,
  Megaphone,
  Settings,
  Activity,
  Link2,
  Pin,
  PinOff,
  FileText,
  UploadCloud,
  CheckCircle2,
  FileQuestion
} from 'lucide-react';
import { AdminRepActivityView } from './AdminRepActivityView';
import { AdminLinksView } from './AdminLinksView';
import { AdminCoursesManager } from './AdminCoursesManager';
import { AdminPastQuestionsView } from './AdminPastQuestionsView';
import { AdminQuizzesView } from './AdminQuizzesView';
import { AdminActivityLogsView } from './AdminActivityLogsView';
import { AdminStudentActivityView } from './AdminStudentActivityView';
import { logActivity } from '../lib/activityLogger';
import {
  dispatchPushNotification,
  getDepartmentTopicSlug,
  unsubscribeFromPhoneNotifications
} from '../lib/pushNotifications';

interface AdminDashboardProps {
  onNavigateHome: () => void;
}

type AdminTab =
  | 'overview'
  | 'students'
  | 'student-activity'
  | 'rep-activity'
  | 'courses'
  | 'past-questions'
  | 'quizzes'
  | 'timetables'
  | 'announcements'
  | 'messages'
  | 'faqs'
  | 'links'
  | 'activity'
  | 'settings';

const ACADEMIC_LEVELS: Array<'ND1' | 'ND2' | 'HND1' | 'HND2'> = ['ND1', 'ND2', 'HND1', 'HND2'];
const SEMESTERS: Array<'First Semester' | 'Second Semester'> = ['First Semester', 'Second Semester'];
const MATERIAL_CATEGORIES: CourseMaterialCategory[] = ['Lecture Note', 'Past Question', 'Video', 'Other'];
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface BatchCourseRow {
  code: string;
  title: string;
  units: number;
  type: 'Core' | 'Elective';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateHome }) => {
  const { user, profile, isAdmin, roleReadError, refreshProfile, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Core Data Collections
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>(INITIAL_COURSES);
  const [timetables, setTimetables] = useState<TimetableEntry[]>(INITIAL_TIMETABLES);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(INITIAL_ANNOUNCEMENTS);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);

  // -------------------------------------------------------------
  // MATERIALS & REP UPLOADS STATE
  // -------------------------------------------------------------
  const [materialsSubTab, setMaterialsSubTab] = useState<'materials' | 'announcements'>('materials');
  const [materialsDeptFilter, setMaterialsDeptFilter] = useState<string>('All');
  const [materialsSearch, setMaterialsSearch] = useState('');

  // Admin Upload Material Modal state
  const [showMaterialUploadModal, setShowMaterialUploadModal] = useState(false);
  const [uploadDept, setUploadDept] = useState<string>(SOT_DEPARTMENTS_LIST[0]);
  const [uploadLevel, setUploadLevel] = useState<'ND1' | 'ND2' | 'HND1' | 'HND2'>('ND1');
  const [uploadSem, setUploadSem] = useState<'First Semester' | 'Second Semester'>('First Semester');
  const [uploadCourseCode, setUploadCourseCode] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState<ResourceCategory>('Course Outline');
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadSaving, setUploadSaving] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotify, setUploadNotify] = useState(true);

  // -------------------------------------------------------------
  // COURSES MANAGEMENT STATE
  // -------------------------------------------------------------
  const [courseDeptFilter, setCourseDeptFilter] = useState<string>(SOT_DEPARTMENTS_LIST[0]);
  const [courseLevelFilter, setCourseLevelFilter] = useState<'ND1' | 'ND2' | 'HND1' | 'HND2'>('ND1');
  const [courseSemesterFilter, setCourseSemesterFilter] = useState<'First Semester' | 'Second Semester'>('First Semester');
  const [courseSearch, setCourseSearch] = useState('');

  // Course Side Panel (Drawer)
  const [showCourseDrawer, setShowCourseDrawer] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [formDept, setFormDept] = useState<string>(SOT_DEPARTMENTS_LIST[0]);
  const [formLevel, setFormLevel] = useState<'ND1' | 'ND2' | 'HND1' | 'HND2'>('ND1');
  const [formSemester, setFormSemester] = useState<'First Semester' | 'Second Semester'>('First Semester');
  const [formCode, setFormCode] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formUnits, setFormUnits] = useState<number | string>(3);
  const [formType, setFormType] = useState<'Core' | 'Elective'>('Core');
  const [formDescription, setFormDescription] = useState('');
  const [formMaterials, setFormMaterials] = useState<CourseMaterial[]>([]);
  const [courseSaveError, setCourseSaveError] = useState<string | null>(null);
  const [courseSaving, setCourseSaving] = useState(false);

  // Material item mini-form inside Course Side Panel
  const [matTitle, setMatTitle] = useState('');
  const [matUrl, setMatUrl] = useState('');
  const [matCategory, setMatCategory] = useState<CourseMaterialCategory>('Lecture Note');

  // Batch Courses Modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchRows, setBatchRows] = useState<BatchCourseRow[]>([
    { code: '', title: '', units: 3, type: 'Core' },
    { code: '', title: '', units: 3, type: 'Core' },
    { code: '', title: '', units: 3, type: 'Core' }
  ]);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  // -------------------------------------------------------------
  // STUDENTS STATE
  // -------------------------------------------------------------
  const [studentSearch, setStudentSearch] = useState('');
  const [studentDeptFilter, setStudentDeptFilter] = useState<string>('All');
  const [studentIdFilter, setStudentIdFilter] = useState<'All' | 'matric' | 'jamb'>('All');
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [isCreatingStudent, setIsCreatingStudent] = useState(false);
  const [editingStudent, setEditingStudent] = useState<UserProfile | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentEmail, setEditStudentEmail] = useState('');
  const [editStudentDept, setEditStudentDept] = useState<string>(SOT_DEPARTMENTS_LIST[0]);
  const [editStudentLevel, setEditStudentLevel] = useState('ND1');
  const [editStudentMatric, setEditStudentMatric] = useState('');
  const [editStudentJamb, setEditStudentJamb] = useState('');
  const [editStudentRole, setEditStudentRole] = useState<'student' | 'rep' | 'admin'>('student');
  const [editStudentDisabled, setEditStudentDisabled] = useState(false);
  const [studentSaving, setStudentSaving] = useState(false);
  const [studentModalError, setStudentModalError] = useState<string | null>(null);
  const [studentSuccessMessage, setStudentSuccessMessage] = useState<string | null>(null);

  // -------------------------------------------------------------
  // TIMETABLES STATE
  // -------------------------------------------------------------
  const [ttDeptFilter, setTtDeptFilter] = useState<string>(SOT_DEPARTMENTS_LIST[0]);
  const [ttLevelFilter, setTtLevelFilter] = useState<'ND1' | 'ND2' | 'HND1' | 'HND2'>('ND1');
  const [ttTypeTab, setTtTypeTab] = useState<'class' | 'exam'>('class');
  const [showTtModal, setShowTtModal] = useState(false);
  const [editingTtId, setEditingTtId] = useState<string | null>(null);
  const [ttFormDept, setTtFormDept] = useState<string>(SOT_DEPARTMENTS_LIST[0]);
  const [ttFormLevel, setTtFormLevel] = useState<string>('ND1');
  const [ttFormDay, setTtFormDay] = useState<string>('Monday');
  const [ttFormStartTime, setTtFormStartTime] = useState<string>('08:00 AM');
  const [ttFormEndTime, setTtFormEndTime] = useState<string>('10:00 AM');
  const [ttFormCourseCode, setTtFormCourseCode] = useState<string>('');
  const [ttFormVenue, setTtFormVenue] = useState<string>('Hall 1');
  const [ttFormType, setTtFormType] = useState<'class' | 'exam'>('class');
  const [ttFormDate, setTtFormDate] = useState<string>('');
  const [ttSaving, setTtSaving] = useState(false);
  const [ttError, setTtError] = useState<string | null>(null);
  const [ttNotify, setTtNotify] = useState(true);

  // -------------------------------------------------------------
  // MESSAGES STATE
  // -------------------------------------------------------------
  const [messageTypeFilter, setMessageTypeFilter] = useState<string>('All');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replySavingId, setReplySavingId] = useState<string | null>(null);
  const [replyNotification, setReplyNotification] = useState<string | null>(null);

  // -------------------------------------------------------------
  // ANNOUNCEMENTS STATE
  // -------------------------------------------------------------
  const [showAnnModal, setShowAnnModal] = useState(false);
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annCategory, setAnnCategory] = useState<'Academic' | 'Student Notice' | 'Department' | 'General'>('General');
  const [annDepartment, setAnnDepartment] = useState('All');
  const [annUrgent, setAnnUrgent] = useState(false);
  const [annPinned, setAnnPinned] = useState(false);
  const [annNotify, setAnnNotify] = useState(true);

  // -------------------------------------------------------------
  // FAQS STATE
  // -------------------------------------------------------------
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');

  // -------------------------------------------------------------
  // SETTINGS STATE (WhatsApp Channel Link, AI Limit & Grading Scale)
  // -------------------------------------------------------------
  const [whatsappLink, setWhatsappLink] = useState('');
  const [aiDailyLimit, setAiDailyLimit] = useState<number>(60);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('We are currently performing scheduled maintenance. SOT Portal services will resume shortly.');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [adminGradingScale, setAdminGradingScale] = useState<GradingScaleEntry[]>(DEFAULT_GRADING_SCALE);
  const [savingScale, setSavingScale] = useState(false);
  const [scaleSuccess, setScaleSuccess] = useState<string | null>(null);
  const [scaleError, setScaleError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleConfirmLogout = async () => {
    try {
      await unsubscribeFromPhoneNotifications(user, profile?.department, profile?.level).catch(() => {});
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
  // DATA FETCHING
  // -------------------------------------------------------------
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Students
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        if (!usersSnap.empty) {
          const list: UserProfile[] = [];
          usersSnap.forEach(d => {
            list.push({ ...d.data(), uid: d.id } as UserProfile);
          });
          setStudents(list);
        } else {
          const localProfileRaw = localStorage.getItem('sot_local_profile');
          if (localProfileRaw) {
            setStudents([JSON.parse(localProfileRaw)]);
          } else if (profile) {
            setStudents([profile]);
          }
        }
      } catch (err) {
        console.warn('Students load note:', err);
        if (profile) setStudents([profile]);
      }

      // 2. Fetch Courses
      try {
        const coursesSnap = await getDocs(collection(db, 'courses'));
        if (!coursesSnap.empty) {
          const list: CourseItem[] = [];
          coursesSnap.forEach(d => {
            const data = d.data();
            list.push({
              id: d.id,
              department: data.department || SOT_DEPARTMENTS_LIST[0],
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
      }

      // 3. Fetch Timetables
      try {
        const ttSnap = await getDocs(collection(db, 'timetables'));
        if (!ttSnap.empty) {
          const list: TimetableEntry[] = [];
          ttSnap.forEach(d => {
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

      // 4. Fetch Messages
      try {
        const msgSnap = await getDocs(collection(db, 'messages'));
        const msgList: ContactMessage[] = [];
        msgSnap.forEach(d => {
          msgList.push({ id: d.id, ...d.data() } as ContactMessage);
        });
        const localMsgs = JSON.parse(localStorage.getItem('sot_local_messages') || '[]');
        const combined = [...msgList, ...localMsgs];
        const unique = Array.from(new Map(combined.map(m => [m.id, m])).values());
        unique.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setMessages(unique);
      } catch (err) {
        const localMsgs = JSON.parse(localStorage.getItem('sot_local_messages') || '[]');
        setMessages(localMsgs);
      }

      // 5. Fetch Announcements
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
        console.warn('Announcements load note:', err);
      }

      // 6. Fetch FAQs
      try {
        const faqSnap = await getDocs(collection(db, 'faqs'));
        const faqList: FaqItem[] = [];
        faqSnap.forEach(d => {
          faqList.push({ id: d.id, ...d.data() } as FaqItem);
        });
        setFaqs(faqList);
      } catch (err) {
        console.warn('FAQs load note:', err);
      }

      // 7. Fetch Resources (Uploaded Materials)
      try {
        const resSnap = await getDocs(collection(db, 'resources'));
        if (!resSnap.empty) {
          const resList: ResourceItem[] = [];
          resSnap.forEach(d => {
            resList.push({ id: d.id, ...d.data() } as ResourceItem);
          });
          resList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          setResources(resList);
        } else {
          setResources([]);
        }
      } catch (err) {
        console.warn('Resources load note:', err);
      }

      // 8. Fetch Site Settings (WhatsApp Channel URL, AI Limit & Maintenance Mode)
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'site'));
        if (settingsSnap.exists()) {
          const sData = settingsSnap.data();
          if (sData.whatsappChannelUrl) {
            setWhatsappLink(sData.whatsappChannelUrl);
          }
          if (sData.aiDailyLimit !== undefined) {
            setAiDailyLimit(Number(sData.aiDailyLimit) || 60);
          }
          if (sData.maintenanceMode !== undefined) {
            setMaintenanceMode(Boolean(sData.maintenanceMode));
          }
          if (sData.maintenanceMessage !== undefined) {
            setMaintenanceMessage(String(sData.maintenanceMessage));
          }
        }
      } catch (err) {
        console.warn('Settings fetch note:', err);
      }

      // 9. Fetch Grading Scale
      try {
        const scaleSnap = await getDoc(doc(db, 'settings', 'grading_scale'));
        if (scaleSnap.exists()) {
          const scData = scaleSnap.data();
          if (Array.isArray(scData.scale) && scData.scale.length > 0) {
            setAdminGradingScale(scData.scale);
          }
        }
      } catch (err) {
        console.warn('Grading scale fetch note:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess(null);
    setSettingsError(null);
    try {
      const cleanUrl = whatsappLink.trim();
      const limitVal = Number(aiDailyLimit) || 60;
      await setDoc(doc(db, 'settings', 'site'), {
        whatsappChannelUrl: cleanUrl,
        aiDailyLimit: limitVal,
        maintenanceMode: Boolean(maintenanceMode),
        maintenanceMessage: maintenanceMessage.trim(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await logActivity(
        user,
        profile?.role || 'admin',
        'Updated',
        'Settings',
        `Portal settings (Maintenance: ${maintenanceMode ? 'Active' : 'Off'})`
      );

      setSettingsSuccess('Portal settings updated successfully!');
    } catch (err: any) {
      console.error('Settings save error:', err);
      setSettingsError(err.message || 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveGradingScale = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingScale(true);
    setScaleSuccess(null);
    setScaleError(null);
    try {
      await setDoc(doc(db, 'settings', 'grading_scale'), {
        scale: adminGradingScale,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setScaleSuccess('Academic grading scale saved successfully! All student GPA calculators are now synchronized.');
    } catch (err: any) {
      console.error('Grading scale save error:', err);
      setScaleError(err.message || 'Failed to save grading scale.');
    } finally {
      setSavingScale(false);
    }
  };

  const handleUpdateScaleRow = (index: number, field: keyof GradingScaleEntry, val: any) => {
    setAdminGradingScale(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleResetDefaultScale = () => {
    if (confirm('Reset grading scale to default NBTE standard?')) {
      setAdminGradingScale(DEFAULT_GRADING_SCALE);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // -------------------------------------------------------------
  // ACCESS GUARD
  // -------------------------------------------------------------
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#070D1A] text-[#E6ECFA] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-950/50 border border-rose-500/50 flex items-center justify-center text-rose-400 mb-4 shadow-[0_0_25px_rgba(244,63,94,0.3)]">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="font-display font-bold text-2xl text-[#E6ECFA] mb-2">Admin Clearance Required</h2>
        <p className="text-[#9AA8C7] max-w-md mb-4 text-xs leading-relaxed">
          The Admin Portal is restricted to authorized SOT student administrators. Your current account does not have admin permissions.
        </p>

        {roleReadError ? (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/70 border border-rose-500/60 text-xs text-rose-200 text-left max-w-md w-full space-y-2">
            <div className="font-semibold text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Role Read Error:</span>
            </div>
            <p className=" text-[11px] break-all">{roleReadError}</p>
            <button
              onClick={() => refreshProfile()}
              className="mt-2 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Reading Clearance</span>
            </button>
          </div>
        ) : (
          <div className="mb-6 p-3.5 rounded-xl bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#9AA8C7] max-w-md w-full space-y-1.5">
            <p>Signed in as: <strong className="text-[#E6ECFA]">{user?.email || 'Guest'}</strong></p>
            <p>Assigned role: <strong className="text-[#FFC700] uppercase">{profile?.role || 'student'}</strong></p>
            <button
              onClick={() => refreshProfile()}
              className="mt-2 px-3 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2545df] text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer mx-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-check Firestore Role</span>
            </button>
          </div>
        )}

        <button
          onClick={onNavigateHome}
          className="px-5 py-2.5 rounded-xl bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] cursor-pointer"
        >
          Return to Portal Home
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------
  // COMPUTED STATS (Overview)
  // -------------------------------------------------------------
  const totalStudents = students.length;
  const totalReps = students.filter(s => s.role === 'rep').length;
  const pendingMessages = messages.filter(m => m.status === 'New').length;
  const totalCourses = courses.length;

  const deptStudentCounts = useMemo(() => {
    const map: Record<string, number> = {};
    SOT_DEPARTMENTS_LIST.forEach(d => { map[d] = 0; });
    students.forEach(s => {
      if (s.department && map[s.department] !== undefined) {
        map[s.department]++;
      }
    });
    return map;
  }, [students]);

  const maxDeptCount = Math.max(...Object.values(deptStudentCounts), 1);

  // -------------------------------------------------------------
  // FILTERED COURSES
  // -------------------------------------------------------------
  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      const matchDept = c.department === courseDeptFilter;
      const matchLevel = normalizeCourseLevel(c.level) === courseLevelFilter;
      const matchSemester = normalizeCourseSemester(c.semester) === courseSemesterFilter;

      if (!matchDept || !matchLevel || !matchSemester) return false;

      if (courseSearch.trim()) {
        const q = courseSearch.toLowerCase();
        const codeMatch = c.code.toLowerCase().includes(q);
        const titleMatch = c.title.toLowerCase().includes(q);
        return codeMatch || titleMatch;
      }
      return true;
    });
  }, [courses, courseDeptFilter, courseLevelFilter, courseSemesterFilter, courseSearch]);

  // Open Course Drawer for Add
  const handleOpenAddCourse = () => {
    setEditingCourseId(null);
    setFormDept(courseDeptFilter);
    setFormLevel(courseLevelFilter);
    setFormSemester(courseSemesterFilter);
    setFormCode('');
    setFormTitle('');
    setFormUnits(3);
    setFormType('Core');
    setFormDescription('');
    setFormMaterials([]);
    setMatTitle('');
    setMatUrl('');
    setMatCategory('Lecture Note');
    setCourseSaveError(null);
    setShowCourseDrawer(true);
  };

  // Open Course Drawer for Edit
  const handleOpenEditCourse = (course: CourseItem) => {
    setEditingCourseId(course.id);
    setFormDept(course.department);
    setFormLevel(normalizeCourseLevel(course.level));
    setFormSemester(normalizeCourseSemester(course.semester));
    setFormCode(course.code);
    setFormTitle(course.title);
    setFormUnits(typeof course.units === 'number' ? course.units : 3);
    setFormType(course.type || 'Core');
    setFormDescription(course.description || '');
    setFormMaterials(course.materials ? [...course.materials] : []);
    setMatTitle('');
    setMatUrl('');
    setMatCategory('Lecture Note');
    setCourseSaveError(null);
    setShowCourseDrawer(true);
  };

  // Add Material to draft
  const handleAddMaterialToDraft = () => {
    if (!matTitle.trim() || !matUrl.trim()) return;
    const newMat: CourseMaterial = {
      id: 'mat_' + Date.now(),
      title: matTitle.trim(),
      url: matUrl.trim(),
      category: matCategory
    };
    setFormMaterials(prev => [...prev, newMat]);
    setMatTitle('');
    setMatUrl('');
  };

  const handleRemoveMaterialFromDraft = (index: number) => {
    setFormMaterials(prev => prev.filter((_, idx) => idx !== index));
  };

  // Save Single Course (Add or Edit)
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setCourseSaveError(null);

    if (!formCode.trim() || !formTitle.trim()) {
      setCourseSaveError('Course code and title are required.');
      return;
    }

    const parsedUnits = typeof formUnits === 'number' ? formUnits : parseInt(String(formUnits).trim(), 10);
    if (isNaN(parsedUnits) || parsedUnits < 1 || parsedUnits > 6) {
      setCourseSaveError('Course units must be a whole number between 1 and 6.');
      return;
    }
    const finalUnits = Math.round(parsedUnits);

    setCourseSaving(true);
    const coursePayload = {
      department: formDept,
      level: formLevel,
      semester: formSemester,
      code: formCode.trim().toUpperCase(),
      title: formTitle.trim(),
      units: finalUnits,
      type: formType,
      description: formDescription.trim(),
      materials: formMaterials,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingCourseId) {
        try {
          await updateDoc(doc(db, 'courses', editingCourseId), coursePayload);
        } catch (dbErr: any) {
          console.warn('Firestore course update fallback:', dbErr);
        }
        setCourses(prev =>
          prev.map(c => (c.id === editingCourseId ? { id: editingCourseId, ...coursePayload } : c))
        );
      } else {
        let newId = 'c_' + Date.now();
        try {
          const docRef = await addDoc(collection(db, 'courses'), {
            ...coursePayload,
            createdAt: new Date().toISOString()
          });
          newId = docRef.id;
        } catch (dbErr: any) {
          console.warn('Firestore course add fallback:', dbErr);
        }
        setCourses(prev => [{ id: newId, ...coursePayload, createdAt: new Date().toISOString() }, ...prev]);
      }

      setShowCourseDrawer(false);
      setEditingCourseId(null);
    } catch (err: any) {
      setCourseSaveError(err?.message || 'Failed to save course. Please verify network/permissions.');
    } finally {
      setCourseSaving(false);
    }
  };

  // Delete Course
  const handleDeleteCourse = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to delete course ${code}?`)) return;
    try {
      await deleteDoc(doc(db, 'courses', id));
    } catch (err) {
      console.warn('Firestore course delete fallback:', err);
    }
    setCourses(prev => prev.filter(c => c.id !== id));
  };

  // Batch Add Courses
  const handleAddBatchRow = () => {
    setBatchRows(prev => [...prev, { code: '', title: '', units: 3, type: 'Core' }]);
  };

  const handleRemoveBatchRow = (idx: number) => {
    setBatchRows(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateBatchRow = (idx: number, field: keyof BatchCourseRow, value: any) => {
    setBatchRows(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleSaveBatchCourses = async () => {
    setBatchError(null);
    const validRows = batchRows.filter(r => r.code.trim() && r.title.trim());

    if (validRows.length === 0) {
      setBatchError('Please fill in at least one course with both Code and Title.');
      return;
    }

    setBatchSaving(true);
    try {
      const createdItems: CourseItem[] = [];
      for (const row of validRows) {
        const payload = {
          department: courseDeptFilter,
          level: courseLevelFilter,
          semester: courseSemesterFilter,
          code: row.code.trim().toUpperCase(),
          title: row.title.trim(),
          units: Number(row.units) || 3,
          type: row.type,
          description: '',
          materials: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        let newId = 'c_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        try {
          const ref = await addDoc(collection(db, 'courses'), payload);
          newId = ref.id;
        } catch (e) {
          // Local fallback
        }
        createdItems.push({ id: newId, ...payload });
      }

      setCourses(prev => [...createdItems, ...prev]);
      setShowBatchModal(false);
      setBatchRows([
        { code: '', title: '', units: 3, type: 'Core' },
        { code: '', title: '', units: 3, type: 'Core' }
      ]);
    } catch (err: any) {
      setBatchError(err?.message || 'Failed to save batch courses.');
    } finally {
      setBatchSaving(false);
    }
  };

  // -------------------------------------------------------------
  // STUDENTS MANAGEMENT
  // -------------------------------------------------------------
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchDept = studentDeptFilter === 'All' || s.department === studentDeptFilter;
      const matchIdType =
        studentIdFilter === 'All' ||
        (studentIdFilter === 'jamb'
          ? (s.idType === 'jamb' || (!!s.jambNumber && !s.matricNumber))
          : (s.idType === 'matric' || !!s.matricNumber));
      const q = studentSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.fullName && s.fullName.toLowerCase().includes(q)) ||
        (s.matricNumber && s.matricNumber.toLowerCase().includes(q)) ||
        (s.jambNumber && s.jambNumber.toLowerCase().includes(q));
      return matchDept && matchIdType && matchSearch;
    });
  }, [students, studentDeptFilter, studentIdFilter, studentSearch]);

  const handleToggleRepRole = async (student: UserProfile) => {
    const newRole: 'student' | 'rep' = student.role === 'rep' ? 'student' : 'rep';
    try {
      await updateDoc(doc(db, 'users', student.uid), { role: newRole });
    } catch (e) {
      console.warn('Firestore rep role update note:', e);
    }
    setStudents(prev => prev.map(s => (s.uid === student.uid ? { ...s, role: newRole } : s)));
  };

  const handleToggleDisable = async (student: UserProfile) => {
    const newStatus = !student.disabled;
    try {
      await updateDoc(doc(db, 'users', student.uid), { disabled: newStatus });
    } catch (e) {
      console.warn('Firestore disable status note:', e);
    }
    setStudents(prev => prev.map(s => (s.uid === student.uid ? { ...s, disabled: newStatus } : s)));
  };

  const handleDeleteStudent = async (uid: string) => {
    if (!confirm('Permanently delete this student account and release their ID registration?')) return;
    const target = students.find(s => s.uid === uid);
    const matric = target?.matricNumber?.trim().toUpperCase();
    const jamb = target?.jambNumber?.trim().toUpperCase();

    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (e) {}

    if (matric) {
      const matricDocId = sanitizeMatricId(matric);
      try {
        await deleteDoc(doc(db, 'matricNumbers', matricDocId));
      } catch (e) {}
      try {
        await deleteDoc(doc(db, 'matric_registry', matricDocId));
      } catch (e) {}
    }

    if (jamb) {
      const jambDocId = `JAMB_${sanitizeJambId(jamb)}`;
      try {
        await deleteDoc(doc(db, 'matricNumbers', jambDocId));
      } catch (e) {}
      try {
        await deleteDoc(doc(db, 'matric_registry', jambDocId));
      } catch (e) {}
    }

    setStudents(prev => prev.filter(s => s.uid !== uid));
  };

  const handleOpenCreateStudent = () => {
    setIsCreatingStudent(true);
    setEditingStudent(null);
    setEditStudentName('');
    setEditStudentEmail('');
    setEditStudentDept(studentDeptFilter !== 'All' ? studentDeptFilter : SOT_DEPARTMENTS_LIST[0]);
    setEditStudentLevel('ND1');
    setEditStudentMatric('');
    setEditStudentJamb('');
    setEditStudentRole('student');
    setEditStudentDisabled(false);
    setStudentModalError(null);
    setShowEditStudentModal(true);
  };

  const handleOpenEditStudent = (student: UserProfile) => {
    setIsCreatingStudent(false);
    setEditingStudent(student);
    setEditStudentName(student.fullName || '');
    setEditStudentEmail(student.email || '');
    setEditStudentDept(student.department || SOT_DEPARTMENTS_LIST[0]);
    setEditStudentLevel(student.level || 'ND1');
    setEditStudentMatric(student.matricNumber || '');
    setEditStudentJamb(student.jambNumber || '');
    setEditStudentRole((student.role as any) || 'student');
    setEditStudentDisabled(Boolean(student.disabled));
    setStudentModalError(null);
    setShowEditStudentModal(true);
  };

  const handleSaveStudentProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudentName.trim()) {
      setStudentModalError('Student full name is required.');
      return;
    }
    if (isCreatingStudent && !editStudentEmail.trim()) {
      setStudentModalError('Email address is required.');
      return;
    }

    setStudentSaving(true);
    setStudentModalError(null);

    const prevMatric = editingStudent?.matricNumber?.trim().toUpperCase();
    const newMatric = editStudentMatric.trim().toUpperCase();
    const prevJamb = editingStudent?.jambNumber?.trim().toUpperCase();
    const newJamb = editStudentJamb.trim().toUpperCase();
    const nowIso = new Date().toISOString();

    const targetUid = isCreatingStudent
      ? 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
      : editingStudent!.uid;

    const profileData: Partial<UserProfile> = {
      uid: targetUid,
      fullName: editStudentName.trim(),
      email: isCreatingStudent ? editStudentEmail.trim().toLowerCase() : (editingStudent?.email || editStudentEmail.trim().toLowerCase()),
      department: editStudentDept,
      level: editStudentLevel,
      matricNumber: newMatric || undefined,
      jambNumber: newJamb || undefined,
      idType: newMatric ? 'matric' : newJamb ? 'jamb' : undefined,
      role: editStudentRole,
      disabled: editStudentDisabled,
      profileComplete: true,
      updatedAt: nowIso
    };

    try {
      if (isCreatingStudent) {
        await setDoc(doc(db, 'users', targetUid), {
          ...profileData,
          createdAt: nowIso
        });
        setStudents(prev => [{ ...profileData, createdAt: nowIso } as UserProfile, ...prev]);
      } else {
        await updateDoc(doc(db, 'users', targetUid), profileData);
        setStudents(prev =>
          prev.map(s => (s.uid === targetUid ? ({ ...s, ...profileData } as UserProfile) : s))
        );
      }

      // Sync matric registration
      if (prevMatric && prevMatric !== newMatric) {
        const oldMatricDocId = sanitizeMatricId(prevMatric);
        await deleteDoc(doc(db, 'matricNumbers', oldMatricDocId)).catch(() => {});
        await deleteDoc(doc(db, 'matric_registry', oldMatricDocId)).catch(() => {});
      }
      if (newMatric && newMatric !== prevMatric) {
        const newMatricDocId = sanitizeMatricId(newMatric);
        const matricPayload = {
          uid: targetUid,
          userId: targetUid,
          department: editStudentDept,
          matricNumber: newMatric,
          createdAt: nowIso
        };
        await setDoc(doc(db, 'matricNumbers', newMatricDocId), matricPayload, { merge: true }).catch(() => {});
        await setDoc(doc(db, 'matric_registry', newMatricDocId), matricPayload, { merge: true }).catch(() => {});
      }

      // Sync JAMB registration
      if (prevJamb && prevJamb !== newJamb) {
        const oldJambDocId = `JAMB_${sanitizeJambId(prevJamb)}`;
        await deleteDoc(doc(db, 'matricNumbers', oldJambDocId)).catch(() => {});
        await deleteDoc(doc(db, 'matric_registry', oldJambDocId)).catch(() => {});
      }
      if (newJamb && newJamb !== prevJamb) {
        const newJambDocId = `JAMB_${sanitizeJambId(newJamb)}`;
        const jambPayload = {
          uid: targetUid,
          userId: targetUid,
          department: editStudentDept,
          jambNumber: newJamb,
          createdAt: nowIso
        };
        await setDoc(doc(db, 'matricNumbers', newJambDocId), jambPayload, { merge: true }).catch(() => {});
        await setDoc(doc(db, 'matric_registry', newJambDocId), jambPayload, { merge: true }).catch(() => {});
      }

      setShowEditStudentModal(false);
      setEditingStudent(null);
      setStudentSuccessMessage(
        isCreatingStudent
          ? `Student profile created successfully!`
          : `Student profile updated successfully!`
      );
      setTimeout(() => setStudentSuccessMessage(null), 3500);
    } catch (err: any) {
      console.error('Failed to save student profile:', err);
      setStudentModalError(err.message || 'Failed to save student profile to Firestore.');
    } finally {
      setStudentSaving(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['UID', 'Full Name', 'Email', 'Department', 'ID Type', 'Student ID', 'Role', 'Status', 'Date Joined'];
    const rows = filteredStudents.map(s => [
      `"${s.uid || ''}"`,
      `"${s.fullName || ''}"`,
      `"${s.email || ''}"`,
      `"${s.department || 'N/A'}"`,
      `"${s.matricNumber ? 'Matric' : s.jambNumber ? 'JAMB' : 'N/A'}"`,
      `"${s.matricNumber || s.jambNumber || 'N/A'}"`,
      s.role,
      s.disabled ? 'Disabled' : s.profileComplete ? 'Active' : 'Incomplete',
      `"${s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'N/A'}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `SOT_Students_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // -------------------------------------------------------------
  // TIMETABLES MANAGEMENT
  // -------------------------------------------------------------
  const filteredTimetables = useMemo(() => {
    return timetables.filter(t => {
      const matchDept = t.department === ttDeptFilter;
      const matchLevel = normalizeCourseLevel(t.level) === ttLevelFilter;
      const matchType = t.type === ttTypeTab;
      return matchDept && matchLevel && matchType;
    });
  }, [timetables, ttDeptFilter, ttLevelFilter, ttTypeTab]);

  const handleOpenAddTt = () => {
    setEditingTtId(null);
    setTtFormDept(ttDeptFilter);
    setTtFormLevel(ttLevelFilter);
    setTtFormDay('Monday');
    setTtFormStartTime('08:00 AM');
    setTtFormEndTime('10:00 AM');
    setTtFormCourseCode('');
    setTtFormVenue('Hall 1');
    setTtFormType(ttTypeTab);
    setTtFormDate('');
    setTtNotify(true);
    setTtError(null);
    setShowTtModal(true);
  };

  const handleOpenEditTt = (entry: TimetableEntry) => {
    setEditingTtId(entry.id);
    setTtFormDept(entry.department);
    setTtFormLevel(normalizeCourseLevel(entry.level));
    setTtFormDay(entry.day || 'Monday');
    setTtFormStartTime(entry.startTime);
    setTtFormEndTime(entry.endTime);
    setTtFormCourseCode(entry.courseCode);
    setTtFormVenue(entry.venue);
    setTtFormType(entry.type);
    setTtFormDate(entry.date || '');
    setTtError(null);
    setShowTtModal(true);
  };

  const handleSaveTt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ttFormCourseCode.trim() || !ttFormVenue.trim()) {
      setTtError('Course code and venue are required.');
      return;
    }

    setTtSaving(true);
    const payload: Omit<TimetableEntry, 'id'> = {
      department: ttFormDept,
      level: ttFormLevel,
      day: ttFormDay,
      startTime: ttFormStartTime,
      endTime: ttFormEndTime,
      courseCode: ttFormCourseCode.trim().toUpperCase(),
      venue: ttFormVenue.trim(),
      type: ttFormType,
      date: ttFormDate || undefined,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingTtId) {
        try {
          await updateDoc(doc(db, 'timetables', editingTtId), payload as any);
        } catch (e) {}
        setTimetables(prev => prev.map(t => (t.id === editingTtId ? { id: editingTtId, ...payload } : t)));
      } else {
        let newId = 'tt_' + Date.now();
        try {
          const ref = await addDoc(collection(db, 'timetables'), {
            ...payload,
            createdAt: new Date().toISOString()
          });
          newId = ref.id;
        } catch (e) {}
        setTimetables(prev => [{ id: newId, ...payload, createdAt: new Date().toISOString() }, ...prev]);

        if (ttNotify) {
          const topic = `dept-${getDepartmentTopicSlug(ttFormDept)}-${ttFormLevel.toLowerCase()}`;
          await dispatchPushNotification(
            {
              topic,
              title: `New Timetable Entry: ${ttFormCourseCode.trim().toUpperCase()}`,
              body: `${ttFormDay} ${ttFormStartTime} - ${ttFormEndTime} at ${ttFormVenue.trim()}`,
              link: '/dashboard?tab=timetables'
            },
            user
          );
        }
      }

      await logActivity(
        user,
        profile?.role || 'admin',
        editingTtId ? 'Updated' : 'Created',
        'Timetable',
        `${payload.courseCode} (${payload.day} ${payload.startTime} - ${payload.endTime})`
      );

      setShowTtModal(false);
      setEditingTtId(null);
    } catch (err: any) {
      setTtError(err?.message || 'Failed to save timetable entry.');
    } finally {
      setTtSaving(false);
    }
  };

  const handleDeleteTt = async (id: string) => {
    if (!confirm('Are you sure you want to delete this timetable entry?')) return;
    const targetTt = timetables.find(t => t.id === id);
    try {
      await deleteDoc(doc(db, 'timetables', id));
    } catch (e) {}
    setTimetables(prev => prev.filter(t => t.id !== id));
    await logActivity(
      user,
      profile?.role || 'admin',
      'Deleted',
      'Timetable',
      targetTt?.courseCode ? `${targetTt.courseCode} (${targetTt.day})` : 'Timetable Entry'
    );
  };

  // -------------------------------------------------------------
  // MESSAGES MANAGEMENT
  // -------------------------------------------------------------
  const filteredMessages = useMemo(() => {
    if (messageTypeFilter === 'All') return messages;
    return messages.filter(m => m.type === messageTypeFilter);
  }, [messages, messageTypeFilter]);

  const handleUpdateMessageStatus = async (id: string, newStatus: ContactMessage['status']) => {
    try {
      await updateDoc(doc(db, 'messages', id), { status: newStatus });
    } catch (e) {}
    const updated = messages.map(m => (m.id === id ? { ...m, status: newStatus } : m));
    setMessages(updated);
    localStorage.setItem('sot_local_messages', JSON.stringify(updated));
  };

  const handleSaveReply = async (msg: ContactMessage) => {
    const draft = replyDrafts[msg.id];
    if (!draft || !draft.trim()) return;

    setReplySavingId(msg.id);
    const nowIso = new Date().toISOString();
    try {
      try {
        await updateDoc(doc(db, 'messages', msg.id), {
          adminReply: draft.trim(),
          repliedAt: nowIso,
          status: 'Resolved'
        });
      } catch (e) {}

      const updated = messages.map(m =>
        m.id === msg.id ? { ...m, adminReply: draft.trim(), repliedAt: nowIso, status: 'Resolved' as const } : m
      );
      setMessages(updated);
      localStorage.setItem('sot_local_messages', JSON.stringify(updated));

      setReplyNotification(`Reply recorded and message marked Resolved for ${msg.name}!`);
      setTimeout(() => setReplyNotification(null), 4000);
    } finally {
      setReplySavingId(null);
    }
  };

  const handleDeleteMessage = async (id: string, name?: string) => {
    if (!confirm(`Permanently delete this message from ${name || 'user'}?`)) return;
    try {
      await deleteDoc(doc(db, 'messages', id));
    } catch (e: any) {
      console.warn('Delete message error:', e);
    }
    const updated = messages.filter(m => m.id !== id);
    setMessages(updated);
    localStorage.setItem('sot_local_messages', JSON.stringify(updated));
  };

  const handleClearReply = async (msg: ContactMessage) => {
    if (!confirm(`Clear recorded official reply for ${msg.name}?`)) return;
    try {
      await updateDoc(doc(db, 'messages', msg.id), {
        adminReply: '',
        repliedAt: null,
        status: 'Read'
      });
    } catch (e) {}
    const updated = messages.map(m =>
      m.id === msg.id ? { ...m, adminReply: undefined, repliedAt: undefined, status: 'Read' as const } : m
    );
    setMessages(updated);
    localStorage.setItem('sot_local_messages', JSON.stringify(updated));
  };

  // -------------------------------------------------------------
  // ANNOUNCEMENTS MANAGEMENT
  // -------------------------------------------------------------
  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;

    const payload = {
      title: annTitle.trim(),
      content: annContent.trim(),
      category: annCategory,
      department: annDepartment,
      urgent: annUrgent,
      pinned: annPinned,
      author: profile?.fullName || 'Student Admin',
      updatedAt: new Date().toISOString()
    };

    if (editingAnnId) {
      try {
        await updateDoc(doc(db, 'announcements', editingAnnId), payload as any);
      } catch (e) {}
      setAnnouncements(prev =>
        prev.map(a => (a.id === editingAnnId ? ({ ...a, ...payload } as AnnouncementItem) : a))
      );
    } else {
      let newId = 'ann_' + Date.now();
      try {
        const ref = await addDoc(collection(db, 'announcements'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        newId = ref.id;
      } catch (e) {}
      setAnnouncements(prev => [
        { id: newId, ...payload, createdAt: new Date().toISOString() } as AnnouncementItem,
        ...prev
      ]);

      if (annNotify) {
        const topic = annDepartment === 'All' ? 'all' : `dept-${getDepartmentTopicSlug(annDepartment)}`;
        await dispatchPushNotification(
          {
            topic,
            title: annUrgent ? `🚨 Announcement: ${annTitle.trim()}` : `Announcement: ${annTitle.trim()}`,
            body: annContent.trim().slice(0, 120),
            link: '/dashboard?tab=announcements'
          },
          user
        );
      }
    }

    await logActivity(
      user,
      profile?.role || 'admin',
      editingAnnId ? 'Updated' : 'Created',
      'Announcement',
      annTitle.trim()
    );

    setShowAnnModal(false);
    setEditingAnnId(null);
  };

  const handleTogglePinAnnouncement = async (id: string, currentPinned?: boolean) => {
    const newPinned = !currentPinned;
    try {
      await updateDoc(doc(db, 'announcements', id), { pinned: newPinned });
    } catch (e) {
      console.warn('Could not update pin state:', e);
    }
    setAnnouncements(prev => prev.map(a => (a.id === id ? { ...a, pinned: newPinned } : a)));
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    const targetAnn = announcements.find(a => a.id === id);
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (e) {}
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    await logActivity(
      user,
      profile?.role || 'admin',
      'Deleted',
      'Announcement',
      targetAnn?.title || 'Announcement'
    );
  };

  // -------------------------------------------------------------
  // FAQS MANAGEMENT
  // -------------------------------------------------------------
  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;

    if (editingFaqId) {
      const payload = {
        question: faqQuestion.trim(),
        answer: faqAnswer.trim(),
        updatedAt: new Date().toISOString()
      };
      try {
        await updateDoc(doc(db, 'faqs', editingFaqId), payload);
      } catch (e) {}
      setFaqs(prev => prev.map(f => (f.id === editingFaqId ? { ...f, ...payload } : f)));
    } else {
      const payload = {
        question: faqQuestion.trim(),
        answer: faqAnswer.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      let newId = 'faq_' + Date.now();
      try {
        const ref = await addDoc(collection(db, 'faqs'), payload);
        newId = ref.id;
      } catch (e) {}
      setFaqs(prev => [{ id: newId, ...payload }, ...prev]);
    }

    setShowFaqModal(false);
    setEditingFaqId(null);
  };

  const handleDeleteFaq = async (id: string) => {
    if (!confirm('Are you sure you want to delete this FAQ entry?')) return;
    try {
      await deleteDoc(doc(db, 'faqs', id));
    } catch (e) {}
    setFaqs(prev => prev.filter(f => f.id !== id));
  };

  const handleSeedDefaultFaqs = async () => {
    const defaults = [
      {
        question: 'How do I access my department courses and lecture materials?',
        answer: 'Navigate to the Courses page on your student dashboard. Select your current academic level (ND1, ND2, HND1, or HND2) and semester to view all enrolled courses, descriptions, syllabus topics, and links to lecture notes, past questions, and video crash courses.'
      },
      {
        question: 'How can I submit a complaint or enquiry to the student desk?',
        answer: 'Visit the Contact page from the top navigation. Enter your name, email, select Complaint, Enquiry, or Review, and describe your request. If signed in, your submission is tracked in the "My Messages" tab where you can monitor admin replies.'
      },
      {
        question: 'Who posts departmental bulletins and notices?',
        answer: 'Bulletins are posted by designated faculty administrators and appointed Course Representatives. Reps can publish announcements tailored specifically to their own academic department.'
      }
    ];

    for (const item of defaults) {
      try {
        const ref = await addDoc(collection(db, 'faqs'), {
          ...item,
          createdAt: new Date().toISOString()
        });
        setFaqs(prev => [{ id: ref.id, ...item, createdAt: new Date().toISOString() }, ...prev]);
      } catch (e) {}
    }
  };

  // -------------------------------------------------------------
  // MATERIALS & REP UPLOADS MANAGEMENT
  // -------------------------------------------------------------
  const repAnnouncements = useMemo(() => {
    return announcements.filter(a => (a.author || '').toLowerCase().includes('rep'));
  }, [announcements]);

  const filteredResources = useMemo(() => {
    return resources.filter(r => {
      const matchDept = materialsDeptFilter === 'All' || r.department === materialsDeptFilter;
      if (!matchDept) return false;
      if (materialsSearch.trim()) {
        const q = materialsSearch.toLowerCase();
        return (
          r.title.toLowerCase().includes(q) ||
          (r.courseCode ? r.courseCode.toLowerCase().includes(q) : false) ||
          (r.uploadedByEmail && r.uploadedByEmail.toLowerCase().includes(q)) ||
          (r.category ? r.category.toLowerCase().includes(q) : false)
        );
      }
      return true;
    });
  }, [resources, materialsDeptFilter, materialsSearch]);

  const filteredRepAnnouncements = useMemo(() => {
    return repAnnouncements.filter(a => {
      const matchDept = materialsDeptFilter === 'All' || a.department === materialsDeptFilter;
      if (!matchDept) return false;
      if (materialsSearch.trim()) {
        const q = materialsSearch.toLowerCase();
        return a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
      }
      return true;
    });
  }, [repAnnouncements, materialsDeptFilter, materialsSearch]);

  const handleAdminUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);

    if (!uploadTitle.trim()) {
      setUploadError('Title is required.');
      return;
    }
    if (!uploadUrl.trim()) {
      setUploadError('PDF or file link is required.');
      return;
    }

    try {
      new URL(uploadUrl.trim());
    } catch {
      setUploadError('Please provide a valid web link (e.g. Google Drive link or direct file URL).');
      return;
    }

    setUploadSaving(true);
    const now = new Date().toISOString();
    const formattedUrl = formatPdfUrl(uploadUrl.trim());
    const courseCodeVal = uploadCourseCode.trim() ? uploadCourseCode.trim().toUpperCase() : '';

    const payload: Omit<ResourceItem, 'id'> = {
      department: uploadDept,
      level: uploadLevel,
      semester: uploadSem,
      courseCode: courseCodeVal,
      title: uploadTitle.trim(),
      category: uploadType,
      url: formattedUrl,
      description: uploadDescription.trim(),
      uploadedBy: user?.uid || 'admin',
      uploadedByEmail: user?.email || 'admin@portal',
      uploadedByRole: 'Admin',
      createdAt: now,
      updatedAt: now
    };

    try {
      const docRef = await addDoc(collection(db, 'resources'), payload);
      const newRes: ResourceItem = {
        id: docRef.id,
        ...payload
      };
      setResources(prev => [newRes, ...prev]);

      if (uploadNotify) {
        const topic = `dept-${getDepartmentTopicSlug(uploadDept)}-${uploadLevel.toLowerCase()}`;
        await dispatchPushNotification(
          {
            topic,
            title: `New ${uploadType}: ${courseCodeVal || uploadTitle.trim()}`,
            body: `${uploadTitle.trim()} (${uploadDept} ${uploadLevel})`,
            link: '/dashboard?tab=courses'
          },
          user
        );
      }

      await logActivity(
        user,
        profile?.role || 'admin',
        'Created',
        'Resource',
        `${uploadDept} ${uploadLevel}: ${uploadTitle.trim()}`
      );

      setUploadSuccess('Saved successfully! Item is now live in the student portal.');
      setUploadTitle('');
      setUploadCourseCode('');
      setUploadUrl('');
      setUploadDescription('');
      setTimeout(() => {
        setShowMaterialUploadModal(false);
        setUploadSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error('Failed to upload material:', err);
      setUploadError(err.message || 'Failed to save material to Firestore.');
    } finally {
      setUploadSaving(false);
    }
  };

  const handleDeleteUploadedResource = async (id: string, title: string) => {
    if (!confirm(`Permanently delete uploaded material "${title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'resources', id));
      setResources(prev => prev.filter(r => r.id !== id));
      await logActivity(
        user,
        profile?.role || 'admin',
        'Deleted',
        'Resource',
        title
      );
    } catch (e: any) {
      alert(`Could not delete material: ${e.message || e}`);
    }
  };

  const handleDeleteRepAnnouncement = async (id: string, title: string) => {
    if (!confirm(`Permanently delete rep announcement "${title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      await logActivity(
        user,
        profile?.role || 'admin',
        'Deleted',
        'Announcement',
        title
      );
    } catch (e: any) {
      alert(`Could not delete announcement: ${e.message || e}`);
    }
  };

  // Nav tab titles
  const tabTitles: Record<AdminTab, string> = {
    overview: 'Overview',
    students: 'Students',
    'student-activity': 'Student Activity',
    'rep-activity': 'Rep Activity',
    courses: 'Courses',
    'past-questions': 'Past Questions',
    quizzes: 'Quizzes',
    timetables: 'Timetables',
    announcements: 'Announcements',
    messages: 'Messages',
    faqs: 'Chatbot FAQs',
    links: 'Links & Communities',
    activity: 'Activity Log',
    settings: 'Settings'
  };

  // -------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#070D1A] text-[#E6ECFA] flex flex-col md:flex-row font-sans selection:bg-[#2F52FF] selection:text-white">
      
      {/* Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between h-14 px-4 bg-[#0A1224] border-b border-[#1F2C4C] sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#121C36] border border-[#FFC700]/50 flex items-center justify-center text-[#FFC700]">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-display font-bold text-xs text-[#E6ECFA] block leading-tight">SOT Admin</span>
            <span className="text-[10px] text-[#FFC700] font-semibold">{tabTitles[activeTab]}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            title="Refresh data"
            className="p-1.5 rounded-lg bg-[#121C36] border border-[#1F2C4C] text-[#9AA8C7] hover:text-[#E6ECFA]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#FFC700]' : ''}`} />
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg bg-[#121C36] border border-[#1F2C4C] text-[#9AA8C7]"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Slim Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen w-60 bg-[#0A1224] border-r border-[#1F2C4C] flex flex-col justify-between p-3.5 transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="space-y-4">
          
          {/* Logo / Brand Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#1F2C4C]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#121C36] border border-[#FFC700]/50 flex items-center justify-center text-[#FFC700] shadow-[0_0_12px_rgba(255,199,0,0.15)]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="font-display font-bold text-sm text-[#E6ECFA] block leading-tight">
                  SOT Admin<span className="text-[#FFC700]">.</span>
                </span>
                <span className="text-[10px] text-[#9AA8C7]">Administration Desk</span>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1 text-[#9AA8C7] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Admin Credentials Badge */}
          <div className="px-2.5 py-2 rounded-lg bg-[#0F1E36] border border-[#1F2C4C] text-[11px]">
            <div className="text-[9px] font-bold text-[#FFC700] uppercase tracking-wider mb-0.5">
              Authorized Session
            </div>
            <div className="text-xs font-semibold text-[#E6ECFA] truncate" title={user?.email || ''}>
              {profile?.fullName || user?.email}
            </div>
            <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 ">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Full Clearance</span>
            </div>
          </div>

          {/* Sidebar Nav Items */}
          <nav className="space-y-1">
            
            {/* 1. Overview */}
            <button
              onClick={() => { setActiveTab('overview'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-[#FFC700]" />
              <span>Overview</span>
            </button>

            {/* 2. Students */}
            <button
              onClick={() => { setActiveTab('students'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'students'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-[#FFC700]" />
                <span>Students</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#121C36] text-[#E6ECFA]">
                {students.length}
              </span>
            </button>

            {/* 2.2 Student Activity Tracking */}
            <button
              onClick={() => { setActiveTab('student-activity'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'student-activity'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-[#FFC700]" />
                <span>Student Activity</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40">
                Live
              </span>
            </button>

            {/* 2.5 Rep Activity */}
            <button
              onClick={() => { setActiveTab('rep-activity'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'rep-activity'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-[#FFC700]" />
                <span>Rep Activity</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#121C36] text-[#FFC700] font-bold">
                {totalReps}
              </span>
            </button>

            {/* 3. Courses */}
            <button
              onClick={() => { setActiveTab('courses'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'courses'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-[#FFC700]" />
                <span>Courses & Topics</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#121C36] text-[#E6ECFA]">
                {courses.length}
              </span>
            </button>

            {/* 3.5. Past Questions */}
            <button
              onClick={() => { setActiveTab('past-questions'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'past-questions'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-[#FFC700]" />
                <span>Past Questions</span>
              </div>
            </button>

            {/* Quizzes */}
            <button
              onClick={() => { setActiveTab('quizzes'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'quizzes'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileQuestion className="w-4 h-4 text-[#FFC700]" />
                <span>Quizzes</span>
              </div>
            </button>

            {/* 4. Timetables */}
            <button
              onClick={() => { setActiveTab('timetables'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'timetables'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-[#FFC700]" />
                <span>Timetables</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#121C36] text-[#E6ECFA]">
                {timetables.length}
              </span>
            </button>

            {/* 5. Announcements */}
            <button
              onClick={() => { setActiveTab('announcements'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'announcements'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-[#FFC700]" />
                <span>Announcements</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#121C36] text-[#E6ECFA]">
                {announcements.length}
              </span>
            </button>

            {/* 6. Messages */}
            <button
              onClick={() => { setActiveTab('messages'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'messages'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-[#FFC700]" />
                <span>Messages</span>
              </div>
              {pendingMessages > 0 ? (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#FFC700] text-[#0A1224] font-bold">
                  {pendingMessages}
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#121C36] text-[#9AA8C7]">
                  {messages.length}
                </span>
              )}
            </button>

            {/* 7. Chatbot FAQs */}
            <button
              onClick={() => { setActiveTab('faqs'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'faqs'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Bot className="w-4 h-4 text-[#FFC700]" />
                <span>Chatbot FAQs</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#121C36] text-[#E6ECFA]">
                {faqs.length}
              </span>
            </button>

            {/* 7.5 Links & Communities */}
            <button
              onClick={() => { setActiveTab('links'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'links'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Link2 className="w-4 h-4 text-[#FFC700]" />
                <span>Links & Hubs</span>
              </div>
            </button>

            {/* 7.8 Activity Log */}
            <button
              onClick={() => { setActiveTab('activity'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'activity'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-[#FFC700]" />
                <span>Activity Log</span>
              </div>
            </button>

            {/* 8. Settings */}
            <button
              onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.35)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-[#FFC700]" />
                <span>Settings</span>
              </div>
              {whatsappLink.trim() && (
                <span className="w-2 h-2 rounded-full bg-[#25D366]" />
              )}
            </button>

          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="space-y-1.5 pt-3 border-t border-[#1F2C4C]">
          <PWAInstallRow compact className="mb-2" />
          <button
            onClick={onNavigateHome}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0F1E36] cursor-pointer"
          >
            <Home className="w-3.5 h-3.5 text-[#FFC700]" />
            <span>Public Website</span>
          </button>
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

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-[#070D1A]/80 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        
        {/* Slim Desktop Top Bar */}
        <header className="hidden md:flex items-center justify-between h-14 px-6 bg-[#0A1224] border-b border-[#1F2C4C] sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#9AA8C7]">Admin Desk</span>
            <span className="text-[#1F2C4C]">/</span>
            <span className="text-[#FFC700] font-semibold">{tabTitles[activeTab]}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              title="Refresh Firestore Data"
              className="px-2.5 py-1.5 rounded-lg bg-[#0F1E36] border border-[#1F2C4C] text-xs text-[#9AA8C7] hover:text-[#E6ECFA] flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#FFC700]' : ''}`} />
              <span>Refresh</span>
            </button>

            <div className="flex items-center gap-2 pl-3 border-l border-[#1F2C4C]">
              <div className="w-7 h-7 rounded-full bg-[#121C36] border border-[#FFC700]/60 flex items-center justify-center text-[#FFC700] text-xs font-bold ">
                {(profile?.fullName?.[0] || user?.email?.[0] || 'A').toUpperCase()}
              </div>
              <div className="text-left text-xs leading-tight">
                <div className="font-semibold text-[#E6ECFA] max-w-[150px] truncate">
                  {profile?.fullName || user?.email}
                </div>
                <div className="text-[10px] text-[#FFC700] uppercase font-bold">Admin</div>
              </div>
            </div>
          </div>
        </header>

        {/* Global notification if any */}
        {replyNotification && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/50 px-4 py-2 text-xs text-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2 max-w-4xl mx-auto">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{replyNotification}</span>
            </div>
            <button onClick={() => setReplyNotification(null)} className="text-emerald-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Workspace Content */}
        <main className="flex-1 p-4 sm:p-5 lg:p-6 overflow-y-auto space-y-5">

          {/* ======================================================== */}
          {/* TAB 1: OVERVIEW                                          */}
          {/* ======================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              
              {/* Stat Cards - Compact */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                
                <div className="p-3.5 sm:p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52]">
                  <div className="flex items-center justify-between text-[11px] text-[#9AA8C7] font-semibold uppercase">
                    <span>Students</span>
                    <Users className="w-3.5 h-3.5 text-[#2F52FF]" />
                  </div>
                  <div className="mt-1.5 text-2xl font-display font-extrabold text-[#E6ECFA]">
                    {totalStudents}
                  </div>
                  <div className="text-[10px] text-[#9AA8C7] mt-0.5">{totalReps} course reps assigned</div>
                </div>

                <div className="p-3.5 sm:p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52]">
                  <div className="flex items-center justify-between text-[11px] text-[#9AA8C7] font-semibold uppercase">
                    <span>Courses</span>
                    <BookOpen className="w-3.5 h-3.5 text-[#FFC700]" />
                  </div>
                  <div className="mt-1.5 text-2xl font-display font-extrabold text-[#FFC700]">
                    {totalCourses}
                  </div>
                  <div className="text-[10px] text-[#9AA8C7] mt-0.5">Across 6 departments</div>
                </div>

                <div className="p-3.5 sm:p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52]">
                  <div className="flex items-center justify-between text-[11px] text-[#9AA8C7] font-semibold uppercase">
                    <span>Timetables</span>
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="mt-1.5 text-2xl font-display font-extrabold text-emerald-400">
                    {timetables.length}
                  </div>
                  <div className="text-[10px] text-[#9AA8C7] mt-0.5">Classes & exam schedules</div>
                </div>

                <div className="p-3.5 sm:p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52]">
                  <div className="flex items-center justify-between text-[11px] text-[#9AA8C7] font-semibold uppercase">
                    <span>Pending Inquiries</span>
                    <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="mt-1.5 text-2xl font-display font-extrabold text-amber-400">
                    {pendingMessages}
                  </div>
                  <div className="text-[10px] text-[#9AA8C7] mt-0.5">{messages.length} total messages</div>
                </div>

              </div>

              {/* Department Enrollment Distribution & Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                
                {/* Department Enrollment Bar Breakdown */}
                <div className="lg:col-span-2 p-4 sm:p-5 rounded-xl bg-[#0F1E36] border border-[#1E2E52] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display font-bold text-sm text-[#E6ECFA]">Student Enrollment by Department</h3>
                      <p className="text-[11px] text-[#9AA8C7]">Distribution of verified registered students</p>
                    </div>
                    <span className="text-xs  text-[#FFC700] font-bold">{totalStudents} Total</span>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {Object.entries(deptStudentCounts).map(([dept, count]) => {
                      const pct = maxDeptCount > 0 ? (count / maxDeptCount) * 100 : 0;
                      return (
                        <div key={dept} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#E6ECFA] truncate pr-2">{dept}</span>
                            <span className="text-[#FFC700]  text-[11px] shrink-0 font-bold">
                              {count} {count === 1 ? 'student' : 'students'}
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-[#070D1A] overflow-hidden p-0.5 border border-[#1E2E52]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#2F52FF] to-[#FFC700] transition-all duration-500"
                              style={{ width: `${Math.max(pct, count > 0 ? 8 : 2)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Admin Actions */}
                <div className="p-4 sm:p-5 rounded-xl bg-[#0F1E36] border border-[#1E2E52] flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-display font-bold text-sm text-[#E6ECFA]">Quick Desk Actions</h3>
                    <p className="text-[11px] text-[#9AA8C7] leading-relaxed">
                      Instant links to frequently updated departmental systems.
                    </p>

                    <div className="space-y-2 pt-2">
                      <button
                        onClick={() => setActiveTab('courses')}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] hover:border-[#2F52FF] text-left text-xs font-semibold text-[#E6ECFA] transition-colors cursor-pointer group"
                      >
                        <span className="flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-[#FFC700]" />
                          <span>Curriculum & Learning Materials</span>
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[#9AA8C7] group-hover:text-white" />
                      </button>

                      <button
                        onClick={() => setActiveTab('timetables')}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] hover:border-[#2F52FF] text-left text-xs font-semibold text-[#E6ECFA] transition-colors cursor-pointer group"
                      >
                        <span className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-[#FFC700]" />
                          <span>Class & Exam Timetables</span>
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[#9AA8C7] group-hover:text-white" />
                      </button>

                      <button
                        onClick={() => setActiveTab('messages')}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] hover:border-[#2F52FF] text-left text-xs font-semibold text-[#E6ECFA] transition-colors cursor-pointer group"
                      >
                        <span className="flex items-center gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                          <span>Review Student Complaints ({pendingMessages})</span>
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[#9AA8C7] group-hover:text-white" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#1E2E52] text-[10px] text-[#9AA8C7] flex items-center justify-between">
                    <span>Connected to Firestore</span>
                    <span className="text-emerald-400  flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Online
                    </span>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: COURSES, TOPICS & MATERIALS (AdminCoursesManager) */}
          {/* ======================================================== */}
          {activeTab === 'courses' && (
            <AdminCoursesManager onNotify={fetchData} />
          )}

          {/* ======================================================== */}
          {/* TAB 2.5: PAST QUESTIONS                                  */}
          {/* ======================================================== */}
          {activeTab === 'past-questions' && (
            <AdminPastQuestionsView onNotify={fetchData} />
          )}

          {/* ======================================================== */}
          {/* TAB: QUIZZES                                             */}
          {/* ======================================================== */}
          {activeTab === 'quizzes' && (
            <AdminQuizzesView
              adminUid={user?.uid || ''}
              adminName={profile?.fullName || 'Administrator'}
              isRepMode={false}
            />
          )}

          {/* ======================================================== */}
          {/* TAB 3: STUDENTS DIRECTORY                                */}
          {/* ======================================================== */}
          {activeTab === 'students' && (
            <div className="space-y-4">
              
              <div className="p-3.5 rounded-xl bg-[#0F1E36] border border-[#1E2E52] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="w-full sm:w-72 relative">
                  <input
                    type="text"
                    placeholder="Search by name, email, matric or JAMB..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/60 focus:outline-none focus:border-[#2F52FF]"
                  />
                  <Search className="w-3.5 h-3.5 text-[#9AA8C7] absolute left-2.5 top-2" />
                </div>

                <div className="w-full sm:w-auto flex flex-wrap items-center gap-2.5">
                  <select
                    value={studentDeptFilter}
                    onChange={(e) => setStudentDeptFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none"
                  >
                    <option value="All">All Departments</option>
                    {SOT_DEPARTMENTS_LIST.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>

                  <select
                    value={studentIdFilter}
                    onChange={(e) => setStudentIdFilter(e.target.value as any)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none"
                  >
                    <option value="All">All IDs (Matric &amp; JAMB)</option>
                    <option value="matric">Matric Students Only</option>
                    <option value="jamb">JAMB Students Only</option>
                  </select>

                  <button
                    onClick={handleOpenCreateStudent}
                    className="px-3 py-1.5 rounded-lg bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(47,82,255,0.3)] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Student</span>
                  </button>

                  <button
                    onClick={handleExportCSV}
                    className="px-3 py-1.5 rounded-lg bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(255,199,0,0.2)]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {studentSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{studentSuccessMessage}</span>
                </div>
              )}

              <div className="rounded-xl bg-[#0F1E36] border border-[#1E2E52] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#070D1A] text-[#9AA8C7] uppercase font-bold tracking-wider border-b border-[#1E2E52]">
                      <tr>
                        <th className="py-2.5 px-3.5">Student</th>
                        <th className="py-2.5 px-3.5">Matric / JAMB ID</th>
                        <th className="py-2.5 px-3.5">Department</th>
                        <th className="py-2.5 px-3.5">Role</th>
                        <th className="py-2.5 px-3.5">Status</th>
                        <th className="py-2.5 px-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E2E52]">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-[#9AA8C7]">
                            No students match your query.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map(student => (
                          <tr key={student.uid} className="hover:bg-[#070D1A]/50 transition-colors">
                            <td className="py-2.5 px-3.5">
                              <div className="font-semibold text-[#E6ECFA]">{student.fullName || 'Unnamed Student'}</div>
                              <div className="text-[11px] text-[#9AA8C7]">{student.email}</div>
                            </td>
                            <td className="py-2.5 px-3.5 font-bold">
                              {student.matricNumber ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/40">
                                    Matric
                                  </span>
                                  <span className="text-[#FFC700] font-mono">{student.matricNumber}</span>
                                </div>
                              ) : student.jambNumber ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-[#FFC700]/20 text-[#FFC700] border border-[#FFC700]/40">
                                    JAMB
                                  </span>
                                  <span className="text-[#FFC700] font-mono">{student.jambNumber}</span>
                                </div>
                              ) : (
                                <span className="text-[#9AA8C7] font-normal italic">Pending</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 text-[#E6ECFA]">
                              {student.department || <span className="text-[#9AA8C7] italic">Unassigned</span>}
                            </td>
                            <td className="py-2.5 px-3.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                student.role === 'admin'
                                  ? 'bg-[#FFC700] text-[#0A1224]'
                                  : student.role === 'rep'
                                  ? 'bg-[#2F52FF] text-white'
                                  : 'bg-[#070D1A] text-[#9AA8C7] border border-[#1E2E52]'
                              }`}>
                                {student.role || 'student'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5">
                              {student.disabled ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-500/30">
                                  Disabled
                                </span>
                              ) : student.profileComplete ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                                  Active
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/30">
                                  Incomplete
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 text-right space-x-1.5">
                              {/* Edit Student Button */}
                              <button
                                onClick={() => handleOpenEditStudent(student)}
                                title="Edit student profile"
                                className="p-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-[#9AA8C7] hover:text-[#FFC700] hover:border-[#FFC700]/50 cursor-pointer transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Make / Remove Course Rep Button */}
                              {student.role !== 'admin' && (
                                <button
                                  onClick={() => handleToggleRepRole(student)}
                                  className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                    student.role === 'rep'
                                      ? 'bg-amber-950 text-amber-300 border border-amber-500/40 hover:bg-amber-900/60'
                                      : 'bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/40 hover:bg-[#2F52FF] hover:text-white'
                                  }`}
                                  title={student.role === 'rep' ? 'Remove course rep status' : 'Promote student to course representative'}
                                >
                                  {student.role === 'rep' ? 'Remove Rep' : 'Make Course Rep'}
                                </button>
                              )}

                              <button
                                onClick={() => handleToggleDisable(student)}
                                title={student.disabled ? 'Re-enable account' : 'Disable account'}
                                className="p-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-[#9AA8C7] hover:text-[#FFC700] cursor-pointer"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(student.uid)}
                                title="Delete student record"
                                className="p-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-[#9AA8C7] hover:text-rose-400 cursor-pointer"
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
          {/* TAB: STUDENT ACTIVITY & ENGAGEMENT                       */}
          {/* ======================================================== */}
          {activeTab === 'student-activity' && (
            <AdminStudentActivityView />
          )}

          {/* ======================================================== */}
          {/* TAB: REP ACTIVITY (Reps directory & Combined feed)       */}
          {/* ======================================================== */}
          {activeTab === 'rep-activity' && (
            <AdminRepActivityView
              students={students}
              resources={resources}
              announcements={announcements}
              onRefresh={fetchData}
              onStudentUpdated={(updated) => {
                setStudents(prev => prev.map(s => s.uid === updated.uid ? updated : s));
              }}
            />
          )}

          {/* ======================================================== */}
          {/* TAB 4: TIMETABLES                                        */}
          {/* ======================================================== */}
          {activeTab === 'timetables' && (
            <div className="space-y-4">
              
              <div className="p-3.5 rounded-xl bg-[#0F1E36] border border-[#1E2E52] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <select
                    value={ttDeptFilter}
                    onChange={(e) => setTtDeptFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA]"
                  >
                    {SOT_DEPARTMENTS_LIST.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1 bg-[#070D1A] p-1 rounded-lg border border-[#1E2E52]">
                    {ACADEMIC_LEVELS.map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => setTtLevelFilter(lvl)}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                          ttLevelFilter === lvl ? 'bg-[#2F52FF] text-white' : 'text-[#9AA8C7]'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 bg-[#070D1A] p-1 rounded-lg border border-[#1E2E52]">
                    <button
                      onClick={() => setTtTypeTab('class')}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                        ttTypeTab === 'class' ? 'bg-[#FFC700] text-[#0A1224]' : 'text-[#9AA8C7]'
                      }`}
                    >
                      Class Schedule
                    </button>
                    <button
                      onClick={() => setTtTypeTab('exam')}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                        ttTypeTab === 'exam' ? 'bg-[#FFC700] text-[#0A1224]' : 'text-[#9AA8C7]'
                      }`}
                    >
                      Exam Timetable
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleOpenAddTt}
                  className="px-3.5 py-1.5 rounded-lg bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(47,82,255,0.3)] self-end sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Timetable Entry</span>
                </button>
              </div>

              <div className="rounded-xl bg-[#0F1E36] border border-[#1E2E52] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#070D1A] text-[#9AA8C7] uppercase font-bold tracking-wider border-b border-[#1E2E52]">
                      <tr>
                        <th className="py-2.5 px-3.5">Day / Date</th>
                        <th className="py-2.5 px-3.5">Time Interval</th>
                        <th className="py-2.5 px-3.5">Course Code</th>
                        <th className="py-2.5 px-3.5">Venue</th>
                        <th className="py-2.5 px-3.5">Type</th>
                        <th className="py-2.5 px-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E2E52]">
                      {filteredTimetables.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-[#9AA8C7]">
                            No timetable entries recorded for {ttDeptFilter} ({ttLevelFilter} - {ttTypeTab}).
                          </td>
                        </tr>
                      ) : (
                        filteredTimetables.map(entry => (
                          <tr key={entry.id} className="hover:bg-[#070D1A]/50 transition-colors">
                            <td className="py-2.5 px-3.5 font-semibold text-[#E6ECFA]">
                              {entry.day} {entry.date ? `(${entry.date})` : ''}
                            </td>
                            <td className="py-2.5 px-3.5  text-[#9AA8C7]">
                              {entry.startTime} – {entry.endTime}
                            </td>
                            <td className="py-2.5 px-3.5  font-bold text-[#FFC700]">
                              {entry.courseCode}
                            </td>
                            <td className="py-2.5 px-3.5 text-[#E6ECFA]">
                              {entry.venue}
                            </td>
                            <td className="py-2.5 px-3.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                entry.type === 'exam'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                                  : 'bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/40'
                              }`}>
                                {entry.type === 'exam' ? 'EXAM' : 'CLASS'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 text-right space-x-1.5">
                              <button
                                onClick={() => handleOpenEditTt(entry)}
                                className="p-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-[#9AA8C7] hover:text-[#FFC700] cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTt(entry.id)}
                                className="p-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-[#9AA8C7] hover:text-rose-400 cursor-pointer"
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
          {/* TAB 5: ANNOUNCEMENTS                                     */}
          {/* ======================================================== */}
          {activeTab === 'announcements' && (
            <div className="space-y-4">
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9AA8C7]">
                  Broadcast departmental bulletins or school-wide alerts.
                </span>
                <button
                  onClick={() => {
                    setEditingAnnId(null);
                    setAnnTitle('');
                    setAnnContent('');
                    setAnnCategory('General');
                    setAnnDepartment('All');
                    setAnnUrgent(false);
                    setAnnPinned(false);
                    setShowAnnModal(true);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(255,199,0,0.25)]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Announcement</span>
                </button>
              </div>

              <div className="space-y-3">
                {[...announcements]
                  .sort((a, b) => {
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                  })
                  .map(ann => (
                  <div key={ann.id} className="p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52] space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {ann.pinned && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFC700]/20 text-[#FFC700] border border-[#FFC700]/40 flex items-center gap-1">
                            <Pin className="w-3 h-3 fill-[#FFC700]" />
                            Pinned
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ann.urgent ? 'bg-rose-950 text-rose-300 border border-rose-500/40' : 'bg-[#070D1A] text-[#FFC700] border border-[#1E2E52]'
                        }`}>
                          {ann.category} {ann.urgent && '• URGENT'}
                        </span>
                        <span className="text-[10px]  px-2 py-0.5 rounded bg-[#070D1A] text-[#9AA8C7] border border-[#1E2E52]">
                          Target: {ann.department}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleTogglePinAnnouncement(ann.id, ann.pinned)}
                          title={ann.pinned ? "Unpin announcement" : "Pin announcement to top"}
                          className={`p-1.5 rounded-lg border text-xs cursor-pointer flex items-center gap-1 transition-colors ${
                            ann.pinned
                              ? 'bg-[#FFC700]/20 text-[#FFC700] border-[#FFC700]/40'
                              : 'bg-[#070D1A] border-[#1E2E52] text-[#9AA8C7] hover:text-[#FFC700]'
                          }`}
                        >
                          <Pin className={`w-3.5 h-3.5 ${ann.pinned ? 'fill-[#FFC700]' : ''}`} />
                          <span className="text-[10px] hidden sm:inline">{ann.pinned ? 'Pinned' : 'Pin'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingAnnId(ann.id);
                            setAnnTitle(ann.title);
                            setAnnContent(ann.content);
                            setAnnCategory(ann.category);
                            setAnnDepartment(ann.department);
                            setAnnUrgent(Boolean(ann.urgent));
                            setAnnPinned(Boolean(ann.pinned));
                            setShowAnnModal(true);
                          }}
                          className="p-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-[#9AA8C7] hover:text-[#FFC700] cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          className="p-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-[#9AA8C7] hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="font-display font-bold text-sm text-[#E6ECFA]">{ann.title}</h4>
                    <p className="text-xs text-[#9AA8C7] whitespace-pre-wrap leading-relaxed">{ann.content}</p>

                    <div className="text-[10px] text-[#9AA8C7] pt-1 border-t border-[#1E2E52]/60 flex items-center justify-between">
                      <span>Posted by {ann.author || 'Admin'}</span>
                      <span>{ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 6: MESSAGES & COMPLAINTS TRACKING                    */}
          {/* ======================================================== */}
          {activeTab === 'messages' && (
            <div className="space-y-4">
              
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#0F1E36] border border-[#1E2E52]">
                <div className="flex items-center gap-1.5">
                  {['All', 'Complaint', 'Review', 'Enquiry'].map(t => (
                    <button
                      key={t}
                      onClick={() => setMessageTypeFilter(t)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                        messageTypeFilter === t
                          ? 'bg-[#2F52FF] text-white shadow-[0_0_10px_rgba(47,82,255,0.4)]'
                          : 'bg-[#070D1A] text-[#9AA8C7] border border-[#1E2E52]'
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

              <div className="space-y-3">
                {filteredMessages.length === 0 ? (
                  <div className="p-10 text-center rounded-xl bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#9AA8C7]">
                    No messages recorded in this category.
                  </div>
                ) : (
                  filteredMessages.map(msg => (
                    <div key={msg.id} className="p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52] space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            msg.type === 'Complaint'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                              : msg.type === 'Review'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              : 'bg-blue-950 text-blue-300 border border-blue-500/40'
                          }`}>
                            {msg.type}
                          </span>

                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            msg.status === 'New'
                              ? 'bg-[#FFC700] text-[#0A1224]'
                              : msg.status === 'Read'
                              ? 'bg-[#2F52FF] text-white'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {msg.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px]  text-[#9AA8C7]">
                            {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}
                          </span>
                          <button
                            onClick={() => handleDeleteMessage(msg.id, msg.name)}
                            title="Delete message"
                            className="p-1 rounded-md bg-[#070D1A] border border-[#1E2E52] text-[#9AA8C7] hover:text-rose-400 hover:border-rose-500/50 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-[#E6ECFA]">{msg.name}</div>
                        <div className="text-[11px] text-[#9AA8C7]">{msg.email}</div>
                      </div>

                      <p className="text-xs text-[#E6ECFA] bg-[#070D1A] p-3 rounded-lg border border-[#1E2E52] whitespace-pre-wrap leading-relaxed">
                        {msg.message}
                      </p>

                      {/* Display existing admin reply */}
                      {msg.adminReply && (
                        <div className="p-3 rounded-lg bg-[#121C36] border border-emerald-500/30 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              <span>Official Admin Reply (Recorded)</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleClearReply(msg)}
                              title="Clear official reply"
                              className="text-[10px] text-[#9AA8C7] hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Clear</span>
                            </button>
                          </div>
                          <p className="text-xs text-[#E6ECFA] whitespace-pre-wrap">{msg.adminReply}</p>
                          {msg.repliedAt && (
                            <div className="text-[9px] text-[#9AA8C7] ">
                              Replied on {new Date(msg.repliedAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Status Buttons & Reply Form */}
                      <div className="space-y-2 pt-2 border-t border-[#1E2E52]/60">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-[#9AA8C7] mr-1">Set status:</span>
                            {(['New', 'Read', 'Resolved'] as const).map(st => (
                              <button
                                key={st}
                                onClick={() => handleUpdateMessageStatus(msg.id, st)}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                                  msg.status === st
                                    ? 'bg-[#2F52FF] text-white font-bold'
                                    : 'bg-[#070D1A] text-[#9AA8C7] border border-[#1E2E52] hover:text-[#E6ECFA]'
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>

                          <a
                            href={`mailto:${msg.email}?subject=Re: SOT Student Portal [${msg.type}]`}
                            className="px-2.5 py-1 rounded bg-[#070D1A] border border-[#1E2E52] text-[11px] text-[#9AA8C7] hover:text-[#FFC700] flex items-center gap-1"
                          >
                            <Mail className="w-3 h-3" />
                            <span>Open Mail Client</span>
                          </a>
                        </div>

                        {/* In-app Reply Draft Box */}
                        <div className="flex gap-2 pt-1">
                          <input
                            type="text"
                            placeholder={msg.adminReply ? "Update official reply..." : "Type official admin reply for student..."}
                            value={replyDrafts[msg.id] ?? (msg.adminReply || '')}
                            onChange={(e) => setReplyDrafts({ ...replyDrafts, [msg.id]: e.target.value })}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                          />
                          <button
                            onClick={() => handleSaveReply(msg)}
                            disabled={replySavingId === msg.id}
                            className="px-3 py-1.5 rounded-lg bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] cursor-pointer flex items-center gap-1 shrink-0"
                          >
                            <Send className="w-3 h-3" />
                            <span>{replySavingId === msg.id ? 'Saving...' : 'Send Reply'}</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  ))
                )}
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 7: CHATBOT FAQS                                      */}
          {/* ======================================================== */}
          {activeTab === 'faqs' && (
            <div className="space-y-4">
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-sm text-[#E6ECFA]">SOT Assistant Knowledge Base</h3>
                  <p className="text-[11px] text-[#9AA8C7]">
                    Dynamic Q&A context ingested by the AI assistant when answering student queries.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {faqs.length === 0 && (
                    <button
                      onClick={handleSeedDefaultFaqs}
                      className="px-3 py-1.5 rounded-lg bg-[#0F1E36] border border-[#FFC700]/50 text-xs font-semibold text-[#FFC700] hover:bg-[#FFC700]/10 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Seed Defaults</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingFaqId(null);
                      setFaqQuestion('');
                      setFaqAnswer('');
                      setShowFaqModal(true);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(255,199,0,0.25)]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add FAQ</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {faqs.map((faq, idx) => (
                  <div key={faq.id || idx} className="p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52] space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded bg-[#070D1A] border border-[#FFC700]/40 flex items-center justify-center text-[#FFC700] text-[10px]  shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <h4 className="font-semibold text-xs text-[#E6ECFA]">{faq.question}</h4>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setEditingFaqId(faq.id);
                            setFaqQuestion(faq.question);
                            setFaqAnswer(faq.answer);
                            setShowFaqModal(true);
                          }}
                          className="p-1 rounded-md bg-[#070D1A] border border-[#1E2E52] text-[#9AA8C7] hover:text-[#FFC700] cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteFaq(faq.id)}
                          className="p-1 rounded-md bg-[#070D1A] border border-[#1E2E52] text-[#9AA8C7] hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-[#9AA8C7] bg-[#070D1A] p-3 rounded-lg border border-[#1E2E52] whitespace-pre-wrap leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 7.5: LINKS & COMMUNITIES                             */}
          {/* ======================================================== */}
          {activeTab === 'links' && <AdminLinksView />}

          {/* ======================================================== */}
          {/* TAB: ACTIVITY LOGS                                       */}
          {/* ======================================================== */}
          {activeTab === 'activity' && <AdminActivityLogsView />}

          {/* ======================================================== */}
          {/* TAB 8: SETTINGS (WHATSAPP CHANNEL LINK & AI LIMIT)       */}
          {/* ======================================================== */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h3 className="font-display font-bold text-base text-[#E6ECFA]">Portal Settings</h3>
                <p className="text-xs text-[#9AA8C7] mt-0.5">
                  Configure portal-wide communication channels, social links, and external services.
                </p>
              </div>

              {settingsSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{settingsSuccess}</span>
                </div>
              )}

              {settingsError && (
                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{settingsError}</span>
                </div>
              )}

              <div className="p-6 rounded-2xl bg-[#0F1E36] border border-[#1E2E52] space-y-5">
                <div className="flex items-center gap-3 border-b border-[#1E2E52] pb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(37,211,102,0.3)]">
                    <WhatsAppIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#E6ECFA]">WhatsApp Channel Link</h4>
                    <p className="text-xs text-[#9AA8C7]">
                      Broadcast link for real-time timetable changes, exam alerts, and student bulletins.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#9AA8C7] mb-1.5">
                      WhatsApp channel link
                    </label>
                    <input
                      type="url"
                      value={whatsappLink}
                      onChange={(e) => setWhatsappLink(e.target.value)}
                      placeholder="e.g. https://whatsapp.com/channel/0029Va..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/40 focus:outline-none focus:border-[#2F52FF] focus:ring-1 focus:ring-[#2F52FF]"
                    />
                    <p className="text-[11px] text-[#9AA8C7] mt-1.5 leading-relaxed">
                      Saved to Firestore document <code className="text-[#FFC700] bg-[#070D1A] px-1 py-0.5 rounded">settings/site</code>. When configured, a <strong className="text-[#25D366]">"Join our SOT WhatsApp Channel"</strong> button is shown on the landing page, footer, student dashboard, and contact page. If left empty, the button is hidden.
                    </p>
                  </div>

                  {/* Ask AI Daily Limit per Student */}
                  <div className="pt-4 border-t border-[#1E2E52]/70">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Sparkles className="w-4 h-4 text-[#FFC700]" />
                      <label className="text-xs font-semibold text-[#E6ECFA]">
                        Ask AI Daily Message Limit per Student
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={5}
                        max={300}
                        value={aiDailyLimit}
                        onChange={(e) => setAiDailyLimit(Number(e.target.value) || 60)}
                        className="w-28 px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#FFC700] font-bold focus:outline-none focus:border-[#2F52FF]"
                      />
                      <span className="text-xs text-[#9AA8C7]">
                        messages per student per day (default 60)
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9AA8C7] mt-1.5 leading-relaxed">
                      Configures the daily AI study and portal assistance quota for all students. Saved in <code className="text-[#FFC700] bg-[#070D1A] px-1 py-0.5 rounded">settings/site</code> (<code className="text-[#FFC700] bg-[#070D1A] px-1 py-0.5 rounded">aiDailyLimit</code>).
                    </p>
                  </div>

                  {/* Maintenance Mode Configuration */}
                  <div className="pt-4 border-t border-[#1E2E52]/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`w-4 h-4 ${maintenanceMode ? 'text-[#FFC700]' : 'text-[#9AA8C7]'}`} />
                          <label className="text-xs font-bold text-[#E6ECFA] cursor-pointer" htmlFor="maintenanceModeSwitch">
                            Maintenance Mode
                          </label>
                        </div>
                        <p className="text-[11px] text-[#9AA8C7]">
                          Display a slim yellow maintenance banner to students across all pages. Admins are not blocked.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          id="maintenanceModeSwitch"
                          type="checkbox"
                          checked={maintenanceMode}
                          onChange={(e) => setMaintenanceMode(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#070D1A] border border-[#1E2E52] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[#0A1224] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#9AA8C7] peer-checked:after:bg-[#0A1224] peer-checked:bg-[#FFC700] after:border after:rounded-full after:h-5 after:w-5 after:transition-all" />
                      </label>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <label className="block text-[11px] font-semibold text-[#9AA8C7]">
                        Maintenance banner message:
                      </label>
                      <textarea
                        rows={2}
                        value={maintenanceMessage}
                        onChange={(e) => setMaintenanceMessage(e.target.value)}
                        placeholder="e.g. We are currently performing scheduled maintenance. SOT Portal services will resume shortly."
                        className="w-full px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/40 focus:outline-none focus:border-[#2F52FF]"
                      />
                      <p className="text-[10px] text-[#9AA8C7]">
                        Saved in <code className="text-[#FFC700] bg-[#070D1A] px-1 py-0.5 rounded">settings/site</code> (<code className="text-[#FFC700] bg-[#070D1A] px-1 py-0.5 rounded">maintenanceMode</code>, <code className="text-[#FFC700] bg-[#070D1A] px-1 py-0.5 rounded">maintenanceMessage</code>).
                      </p>
                    </div>
                  </div>

                  {/* Live preview */}
                  {whatsappLink.trim() && (
                    <div className="p-4 rounded-xl bg-[#070D1A] border border-[#1E2E52] space-y-2">
                      <span className="text-[10px] font-bold text-[#FFC700] uppercase tracking-wider block">
                        Live Preview (Green WhatsApp Branding)
                      </span>
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <WhatsAppChannelButton url={whatsappLink.trim()} variant="solid" />
                        <WhatsAppChannelButton url={whatsappLink.trim()} variant="outline" />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1E2E52]">
                    {whatsappLink.trim() && (
                      <button
                        type="button"
                        onClick={() => setWhatsappLink('')}
                        className="px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#9AA8C7] hover:text-white cursor-pointer"
                      >
                        Clear Link
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="px-5 py-2.5 rounded-xl bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] transition-all shadow-[0_0_15px_rgba(255,199,0,0.25)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {savingSettings ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Save Settings</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* CARD 2: ACADEMIC GRADING SCALE CONFIGURATION */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#0F1E36] border border-[#1F2C4C] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E2E52] pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#070D1A] border border-[#1E2E52] flex items-center justify-center text-[#FFC700] shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#E6ECFA]">Academic Grading Scale (GPA / CGPA)</h4>
                      <p className="text-xs text-[#9AA8C7]">
                        Define letter grades, percentage boundaries, and grade points for student GPA calculation.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetDefaultScale}
                    className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] hover:border-[#FFC700] text-xs font-semibold text-[#FFC700] transition-all cursor-pointer"
                  >
                    Reset to Default Scale
                  </button>
                </div>

                {scaleSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-500/50 text-xs text-emerald-200 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{scaleSuccess}</span>
                  </div>
                )}

                {scaleError && (
                  <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{scaleError}</span>
                  </div>
                )}

                <form onSubmit={handleSaveGradingScale} className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#1E2E52] text-[#9AA8C7] text-[11px]">
                          <th className="pb-2 font-semibold">Grade</th>
                          <th className="pb-2 font-semibold">Min Score (%)</th>
                          <th className="pb-2 font-semibold">Max Score (%)</th>
                          <th className="pb-2 font-semibold">Grade Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E2E52]">
                        {adminGradingScale.map((row, idx) => (
                          <tr key={idx} className="hover:bg-[#070D1A]/50">
                            <td className="py-2.5 font-bold text-[#FFC700]">
                              {row.grade}
                            </td>
                            <td className="py-2.5">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={row.minScore}
                                onChange={(e) => handleUpdateScaleRow(idx, 'minScore', Number(e.target.value))}
                                className="w-20 px-2.5 py-1 rounded bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                              />
                            </td>
                            <td className="py-2.5">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={row.maxScore}
                                onChange={(e) => handleUpdateScaleRow(idx, 'maxScore', Number(e.target.value))}
                                className="w-20 px-2.5 py-1 rounded bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                              />
                            </td>
                            <td className="py-2.5">
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                max={5}
                                value={row.points}
                                onChange={(e) => handleUpdateScaleRow(idx, 'points', parseFloat(e.target.value) || 0)}
                                className="w-24 px-2.5 py-1 rounded bg-[#070D1A] border border-[#1E2E52] text-xs font-bold text-[#60A5FA] focus:outline-none focus:border-[#2F52FF]"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#1E2E52]">
                    <span className="text-[11px] text-[#9AA8C7]">
                      Saved to Firestore document <code className="text-[#FFC700] bg-[#070D1A] px-1 py-0.5 rounded">settings/grading_scale</code>
                    </span>

                    <button
                      type="submit"
                      disabled={savingScale}
                      className="px-5 py-2.5 rounded-xl bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] transition-all shadow-[0_0_15px_rgba(47,82,255,0.3)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {savingScale ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving Scale...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Save Grading Scale</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ======================================================== */}
      {/* SIDE PANEL: ADD / EDIT COURSE DRAWER                     */}
      {/* ======================================================== */}
      {showCourseDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setShowCourseDrawer(false)}
            className="fixed inset-0 bg-[#070D1A]/75 backdrop-blur-sm transition-opacity"
          />

          {/* Side Drawer Panel */}
          <div className="relative w-full sm:max-w-md md:max-w-lg bg-[#0A1224] border-l border-[#1F2C4C] h-full shadow-2xl flex flex-col z-10 overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#0F1E36] border-b border-[#1F2C4C]">
              <div>
                <h3 className="font-display font-bold text-sm text-[#E6ECFA]">
                  {editingCourseId ? 'Edit Course' : 'Add New Course'}
                </h3>
                <span className="text-[10px] text-[#9AA8C7]">
                  {formDept} • {formLevel} • {formSemester}
                </span>
              </div>
              <button
                onClick={() => setShowCourseDrawer(false)}
                className="p-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-[#9AA8C7] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveCourse} className="flex-1 overflow-y-auto p-5 space-y-4">
              
              {courseSaveError && (
                <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-500/50 text-xs text-rose-200">
                  {courseSaveError}
                </div>
              )}

              {/* Department */}
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">Department</label>
                <select
                  value={formDept}
                  onChange={(e) => setFormDept(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                >
                  {SOT_DEPARTMENTS_LIST.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Level and Semester */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">Level</label>
                  <select
                    value={formLevel}
                    onChange={(e) => setFormLevel(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  >
                    {ACADEMIC_LEVELS.map(lvl => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">Semester</label>
                  <select
                    value={formSemester}
                    onChange={(e) => setFormSemester(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  >
                    {SEMESTERS.map(sem => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Course Code & Units */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. COM 124"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#FFC700]  font-bold focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">Units (1 to 6) *</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    step={1}
                    required
                    value={formUnits}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setFormUnits('');
                      } else {
                        const num = parseInt(val, 10);
                        if (!isNaN(num)) {
                          setFormUnits(Math.min(6, Math.max(1, num)));
                        }
                      }
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>
              </div>

              {/* Course Title */}
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  Course Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Data Structures & Algorithms"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] font-medium focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              {/* Type (Core / Elective) */}
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">Type</label>
                <div className="flex gap-2">
                  {(['Core', 'Elective'] as const).map(t => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setFormType(t)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        formType === t
                          ? 'bg-[#2F52FF] text-white'
                          : 'bg-[#070D1A] border border-[#1E2E52] text-[#9AA8C7]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description (Optional) */}
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  Description / Syllabus Summary (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Overview of core curriculum topics, prerequisites, and learning outcomes..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              {/* LEARNING MATERIALS BUILDER */}
              <div className="pt-3 border-t border-[#1E2E52] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#FFC700] uppercase tracking-wider">
                    Learning Materials ({formMaterials.length})
                  </span>
                  <span className="text-[10px] text-[#9AA8C7]">Drive, YouTube, Docs, etc.</span>
                </div>

                {/* Materials Mini Form */}
                <div className="p-3 rounded-lg bg-[#070D1A] border border-[#1E2E52] space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Material title (e.g. Past Questions PDF)"
                        value={matTitle}
                        onChange={(e) => setMatTitle(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-md bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none"
                      />
                    </div>
                    <div>
                      <select
                        value={matCategory}
                        onChange={(e) => setMatCategory(e.target.value as any)}
                        className="w-full px-2 py-1.5 rounded-md bg-[#0F1E36] border border-[#1E2E52] text-[11px] text-[#E6ECFA] focus:outline-none"
                      >
                        {MATERIAL_CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="Resource URL (e.g. https://drive.google.com/...)"
                      value={matUrl}
                      onChange={(e) => setMatUrl(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-md bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#E6ECFA]  focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddMaterialToDraft}
                      disabled={!matTitle.trim() || !matUrl.trim()}
                      className="px-3 py-1.5 rounded-md bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      + Add Material
                    </button>
                  </div>
                </div>

                {/* List of Added Materials */}
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {formMaterials.length === 0 ? (
                    <div className="text-[11px] text-[#9AA8C7] italic py-1">
                      No materials added to this course yet.
                    </div>
                  ) : (
                    formMaterials.map((mat, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-[#0F1E36] border border-[#1E2E52] text-xs"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#070D1A] text-[#FFC700] border border-[#1E2E52]">
                              {mat.category}
                            </span>
                            <span className="font-semibold text-[#E6ECFA] truncate">{mat.title}</span>
                          </div>
                          <a
                            href={mat.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-[#2F52FF] hover:underline truncate block "
                          >
                            {mat.url}
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterialFromDraft(idx)}
                          className="p-1 rounded text-[#9AA8C7] hover:text-rose-400 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-[#1E2E52] flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCourseDrawer(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#9AA8C7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={courseSaving}
                  className="px-4 py-1.5 rounded-lg bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] cursor-pointer flex items-center gap-1.5 shadow-[0_0_12px_rgba(47,82,255,0.4)]"
                >
                  {courseSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingCourseId ? 'Save Changes' : 'Create Course'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: BATCH ADD MULTIPLE COURSES                        */}
      {/* ======================================================== */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-[#0A1224] border border-[#1F2C4C] rounded-2xl p-5 sm:p-6 space-y-4 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between pb-3 border-b border-[#1F2C4C]">
              <div>
                <h3 className="font-display font-bold text-sm text-[#E6ECFA] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#FFC700]" />
                  <span>Batch Add Courses</span>
                </h3>
                <span className="text-[11px] text-[#9AA8C7]">
                  Adding to <strong className="text-[#FFC700]">{courseDeptFilter}</strong> • {courseLevelFilter} • {courseSemesterFilter}
                </span>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="p-1 rounded-lg text-[#9AA8C7] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {batchError && (
              <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-500/50 text-xs text-rose-200">
                {batchError}
              </div>
            )}

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {batchRows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-[#0F1E36] border border-[#1E2E52]">
                  <span className="text-[10px] text-[#9AA8C7]  w-4">{idx + 1}.</span>
                  <input
                    type="text"
                    placeholder="Code (e.g. COM 111)"
                    value={row.code}
                    onChange={(e) => handleUpdateBatchRow(idx, 'code', e.target.value)}
                    className="w-28 px-2 py-1 rounded bg-[#070D1A] border border-[#1E2E52] text-xs text-[#FFC700]  font-bold focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Title (e.g. Digital Logic)"
                    value={row.title}
                    onChange={(e) => handleUpdateBatchRow(idx, 'title', e.target.value)}
                    className="flex-1 px-2.5 py-1 rounded bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none"
                  />
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={row.units}
                    onChange={(e) => handleUpdateBatchRow(idx, 'units', Number(e.target.value) || 1)}
                    className="w-14 px-1.5 py-1 rounded bg-[#070D1A] border border-[#1E2E52] text-xs text-center  text-[#E6ECFA] focus:outline-none"
                    title="Units"
                  />
                  <select
                    value={row.type}
                    onChange={(e) => handleUpdateBatchRow(idx, 'type', e.target.value)}
                    className="w-20 px-1 py-1 rounded bg-[#070D1A] border border-[#1E2E52] text-[11px] text-[#E6ECFA] focus:outline-none"
                  >
                    <option value="Core">Core</option>
                    <option value="Elective">Elective</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemoveBatchRow(idx)}
                    className="p-1 text-[#9AA8C7] hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#1F2C4C]">
              <button
                type="button"
                onClick={handleAddBatchRow}
                className="px-3 py-1.5 rounded-lg bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#FFC700] font-semibold hover:border-[#FFC700] cursor-pointer"
              >
                + Add Row
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#9AA8C7]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveBatchCourses}
                  disabled={batchSaving}
                  className="px-4 py-1.5 rounded-lg bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] cursor-pointer flex items-center gap-1.5"
                >
                  {batchSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save All Courses</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADMIN UPLOAD MATERIAL / RESOURCE                  */}
      {/* ======================================================== */}
      {showMaterialUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/85 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-[#0A1224] border border-[#1F2C4C] rounded-2xl p-5 sm:p-6 space-y-4 shadow-[0_0_50px_rgba(0,0,0,0.85)] my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#1F2C4C]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#2F52FF]/20 text-[#2F52FF] border border-[#2F52FF]/30">
                  <UploadCloud className="w-5 h-5 text-[#FFC700]" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-[#E6ECFA]">
                    Upload Material
                  </h3>
                  <p className="text-[11px] text-[#9AA8C7]">
                    Upload course outlines, lecture notes, or past questions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMaterialUploadModal(false)}
                className="p-1 rounded-lg text-[#9AA8C7] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleAdminUploadMaterial} className="space-y-3.5">
              {/* Department */}
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] uppercase mb-1">
                  Department
                </label>
                <select
                  value={uploadDept}
                  onChange={(e) => setUploadDept(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                >
                  {SOT_DEPARTMENTS_LIST.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Level & Semester */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] uppercase mb-1">
                    Level
                  </label>
                  <select
                    value={uploadLevel}
                    onChange={(e) => setUploadLevel(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  >
                    <option value="ND1">ND1</option>
                    <option value="ND2">ND2</option>
                    <option value="HND1">HND1</option>
                    <option value="HND2">HND2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] uppercase mb-1">
                    Semester
                  </label>
                  <select
                    value={uploadSem}
                    onChange={(e) => setUploadSem(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  >
                    <option value="First Semester">First Semester</option>
                    <option value="Second Semester">Second Semester</option>
                  </select>
                </div>
              </div>

              {/* Course Code (Optional) & Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] uppercase mb-1">
                    Course Code <span className="text-[10px] text-[#9AA8C7]/60 lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. COM 111"
                    value={uploadCourseCode}
                    onChange={(e) => setUploadCourseCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] uppercase mb-1">
                    Type
                  </label>
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value as ResourceCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#FFC700] font-semibold focus:outline-none focus:border-[#2F52FF]"
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
                <label className="block text-[11px] font-semibold text-[#9AA8C7] uppercase mb-1">
                  Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Introduction to Programming Lecture Notes"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              {/* PDF or File Link */}
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] uppercase mb-1">
                  PDF or File Link <span className="text-rose-400">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://drive.google.com/... or file URL (auto-converted to preview)"
                  value={uploadUrl}
                  onChange={(e) => setUploadUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                />
                <span className="text-[10px] text-[#9AA8C7]/80 mt-1 block">
                  Google Drive /view links are automatically converted to in-app /preview links.
                </span>
              </div>

              {/* Description (Optional) */}
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] uppercase mb-1">
                  Description / Note <span className="text-[10px] text-[#9AA8C7]/60 lowercase">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief note or instructions for students..."
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="uploadNotifyAdmin"
                  checked={uploadNotify}
                  onChange={(e) => setUploadNotify(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#070D1A] border-[#1E2E52] text-[#2F52FF] cursor-pointer"
                />
                <label htmlFor="uploadNotifyAdmin" className="text-xs text-[#E6ECFA] cursor-pointer">
                  Notify students (Push notification to {uploadDept} {uploadLevel})
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1F2C4C]">
                <button
                  type="button"
                  onClick={() => setShowMaterialUploadModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#9AA8C7] hover:text-[#E6ECFA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadSaving}
                  className="px-5 py-2 rounded-xl bg-[#2F52FF] hover:bg-[#2542D9] text-white text-xs font-bold shadow-[0_0_15px_rgba(47,82,255,0.4)] flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {uploadSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{uploadSaving ? 'Saving...' : 'Upload Material'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD / EDIT TIMETABLE ENTRY                        */}
      {/* ======================================================== */}
      {showTtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#0A1224] border border-[#1F2C4C] rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#1F2C4C]">
              <h3 className="font-display font-bold text-sm text-[#E6ECFA]">
                {editingTtId ? 'Edit Timetable Entry' : 'Add Timetable Entry'}
              </h3>
              <button onClick={() => setShowTtModal(false)} className="text-[#9AA8C7] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {ttError && (
              <div className="p-2 rounded bg-rose-950/70 border border-rose-500/50 text-xs text-rose-200">
                {ttError}
              </div>
            )}

            <form onSubmit={handleSaveTt} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">Type</label>
                  <select
                    value={ttFormType}
                    onChange={(e) => setTtFormType(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA]"
                  >
                    <option value="class">Class</option>
                    <option value="exam">Exam</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">Level</label>
                  <select
                    value={ttFormLevel}
                    onChange={(e) => setTtFormLevel(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA]"
                  >
                    {ACADEMIC_LEVELS.map(lvl => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">Department</label>
                <select
                  value={ttFormDept}
                  onChange={(e) => setTtFormDept(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA]"
                >
                  {SOT_DEPARTMENTS_LIST.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">Day of Week</label>
                  <select
                    value={ttFormDay}
                    onChange={(e) => setTtFormDay(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA]"
                  >
                    {DAYS_OF_WEEK.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">Specific Date (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 15th Nov"
                    value={ttFormDate}
                    onChange={(e) => setTtFormDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">Start Time</label>
                  <input
                    type="text"
                    required
                    placeholder="08:00 AM"
                    value={ttFormStartTime}
                    onChange={(e) => setTtFormStartTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] "
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">End Time</label>
                  <input
                    type="text"
                    required
                    placeholder="10:00 AM"
                    value={ttFormEndTime}
                    onChange={(e) => setTtFormEndTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] "
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">Course Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. COM 111"
                    value={ttFormCourseCode}
                    onChange={(e) => setTtFormCourseCode(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#FFC700]  font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">Venue *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hall 1"
                    value={ttFormVenue}
                    onChange={(e) => setTtFormVenue(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA]"
                  />
                </div>
              </div>

              {!editingTtId && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="ttNotifyAdmin"
                    checked={ttNotify}
                    onChange={(e) => setTtNotify(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#070D1A] border-[#1E2E52] text-[#2F52FF] cursor-pointer"
                  />
                  <label htmlFor="ttNotifyAdmin" className="text-xs text-[#E6ECFA] cursor-pointer">
                    Notify students (Push notification to {ttFormDept} {ttFormLevel})
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#1F2C4C]">
                <button
                  type="button"
                  onClick={() => setShowTtModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#9AA8C7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ttSaving}
                  className="px-4 py-1.5 rounded-lg bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] cursor-pointer"
                >
                  {ttSaving ? 'Saving...' : editingTtId ? 'Update Entry' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE / EDIT ANNOUNCEMENT                        */}
      {/* ======================================================== */}
      {showAnnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#0A1224] border border-[#1F2C4C] rounded-2xl p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#1F2C4C]">
              <h3 className="font-display font-bold text-sm text-[#E6ECFA]">
                {editingAnnId ? 'Edit Announcement' : 'Publish Announcement'}
              </h3>
              <button onClick={() => setShowAnnModal(false)} className="text-[#9AA8C7] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAnnouncement} className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="e.g. Matriculation Ceremony Timings"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">Category</label>
                  <select
                    value={annCategory}
                    onChange={(e) => setAnnCategory(e.target.value as any)}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA]"
                  >
                    <option value="General">General</option>
                    <option value="Academic">Academic</option>
                    <option value="Student Notice">Student Notice</option>
                    <option value="Department">Department</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">Target Department</label>
                  <select
                    value={annDepartment}
                    onChange={(e) => setAnnDepartment(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA]"
                  >
                    <option value="All">All Departments</option>
                    {SOT_DEPARTMENTS_LIST.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="annUrgentAdmin"
                    checked={annUrgent}
                    onChange={(e) => setAnnUrgent(e.target.checked)}
                    className="rounded bg-[#070D1A] border-[#1E2E52] text-[#FFC700]"
                  />
                  <label htmlFor="annUrgentAdmin" className="text-xs text-[#E6ECFA] cursor-pointer">
                    Mark as Urgent Alert
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="annPinnedAdmin"
                    checked={annPinned}
                    onChange={(e) => setAnnPinned(e.target.checked)}
                    className="rounded bg-[#070D1A] border-[#1E2E52] text-[#FFC700]"
                  />
                  <label htmlFor="annPinnedAdmin" className="text-xs text-[#E6ECFA] cursor-pointer flex items-center gap-1">
                    <Pin className="w-3 h-3 text-[#FFC700]" />
                    <span>Pin to Top</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">Content *</label>
                <textarea
                  required
                  rows={4}
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  placeholder="Type bulletin text..."
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA]"
                />
              </div>

              {!editingAnnId && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="annNotifyAdmin"
                    checked={annNotify}
                    onChange={(e) => setAnnNotify(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#070D1A] border-[#1E2E52] text-[#2F52FF] cursor-pointer"
                  />
                  <label htmlFor="annNotifyAdmin" className="text-xs text-[#E6ECFA] cursor-pointer">
                    Notify students (Push notification to {annDepartment === 'All' ? 'all students' : annDepartment})
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#1F2C4C]">
                <button
                  type="button"
                  onClick={() => setShowAnnModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#9AA8C7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] cursor-pointer"
                >
                  {editingAnnId ? 'Update' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CHATBOT FAQ                                       */}
      {/* ======================================================== */}
      {showFaqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#0A1224] border border-[#1F2C4C] rounded-2xl p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#1F2C4C]">
              <h3 className="font-display font-bold text-sm text-[#E6ECFA]">
                {editingFaqId ? 'Edit Chatbot FAQ' : 'Add Chatbot FAQ'}
              </h3>
              <button onClick={() => setShowFaqModal(false)} className="text-[#9AA8C7] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFaq} className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">Question *</label>
                <input
                  type="text"
                  required
                  value={faqQuestion}
                  onChange={(e) => setFaqQuestion(e.target.value)}
                  placeholder="e.g. Where can I download lecture notes?"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">Answer *</label>
                <textarea
                  required
                  rows={4}
                  value={faqAnswer}
                  onChange={(e) => setFaqAnswer(e.target.value)}
                  placeholder="Provide detailed answer..."
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#1F2C4C]">
                <button
                  type="button"
                  onClick={() => setShowFaqModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#9AA8C7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#FFC700] text-[#0A1224] text-xs font-bold hover:bg-[#ffd233] cursor-pointer"
                >
                  {editingFaqId ? 'Update FAQ' : 'Save FAQ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT / CREATE STUDENT PROFILE */}
      {showEditStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/80 backdrop-blur-sm">
          <div className="bg-[#0F1E36] border border-[#1E2E52] rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E2E52]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#070D1A] border border-[#2F52FF]/50 flex items-center justify-center text-[#2F52FF]">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-[#E6ECFA]">
                    {isCreatingStudent ? 'Add New Student Record' : 'Edit Student Profile'}
                  </h3>
                  <p className="text-[11px] text-[#9AA8C7]">
                    {isCreatingStudent
                      ? 'Create and authorize a student account in the SOT portal'
                      : `Update credentials and clearance for ${editingStudent?.email || 'student'}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditStudentModal(false)}
                className="text-[#9AA8C7] hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {studentModalError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{studentModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveStudentProfile} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  placeholder="e.g. Samuel Adekunle"
                  className="w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  disabled={!isCreatingStudent}
                  value={editStudentEmail}
                  onChange={(e) => setEditStudentEmail(e.target.value)}
                  placeholder="student@example.com"
                  className={`w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF] ${
                    !isCreatingStudent ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                />
                {!isCreatingStudent && (
                  <p className="text-[10px] text-[#9AA8C7]/70 mt-1">
                    Email is linked to Firebase Authentication and cannot be changed here.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                    Department *
                  </label>
                  <select
                    value={editStudentDept}
                    onChange={(e) => setEditStudentDept(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none"
                  >
                    {SOT_DEPARTMENTS_LIST.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                    Academic Level *
                  </label>
                  <select
                    value={editStudentLevel}
                    onChange={(e) => setEditStudentLevel(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none"
                  >
                    {ACADEMIC_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                    Matriculation Number
                  </label>
                  <input
                    type="text"
                    value={editStudentMatric}
                    onChange={(e) => setEditStudentMatric(e.target.value)}
                    placeholder="e.g. F/HD/23/3210001"
                    className="w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#FFC700] font-mono placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                    JAMB Registration No.
                  </label>
                  <input
                    type="text"
                    value={editStudentJamb}
                    onChange={(e) => setEditStudentJamb(e.target.value)}
                    placeholder="e.g. 202412345678AB"
                    className="w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#FFC700] font-mono placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                    Portal Clearance / Role
                  </label>
                  <select
                    value={editStudentRole}
                    onChange={(e) => setEditStudentRole(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none font-bold"
                  >
                    <option value="student">Student (Standard)</option>
                    <option value="rep">Course Representative</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] cursor-pointer hover:border-[#2F52FF]/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={editStudentDisabled}
                      onChange={(e) => setEditStudentDisabled(e.target.checked)}
                      className="rounded bg-[#070D1A] border-[#1E2E52] text-rose-500 focus:ring-0"
                    />
                    <span className="text-[11px] font-semibold text-rose-300">
                      Disable Account
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1E2E52]">
                <button
                  type="button"
                  onClick={() => setShowEditStudentModal(false)}
                  className="px-3.5 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#9AA8C7] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={studentSaving}
                  className="px-5 py-2 rounded-lg bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] cursor-pointer transition-colors shadow-[0_0_12px_rgba(47,82,255,0.4)] disabled:opacity-50"
                >
                  {studentSaving
                    ? 'Saving Profile...'
                    : isCreatingStudent
                    ? 'Create Student'
                    : 'Save Changes'}
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
