import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { DEPARTMENTS, INITIAL_ANNOUNCEMENTS } from '../data/departments';
import { DepartmentIcon } from './PublicLanding';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { AnnouncementItem } from '../types';
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
  RefreshCw
} from 'lucide-react';
import { SITE_CONFIG } from '../config/site';

interface StudentDashboardProps {
  onNavigateHome: () => void;
  onNavigateContact: () => void;
  onNavigateAdmin?: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  onNavigateHome,
  onNavigateContact,
  onNavigateAdmin
}) => {
  const { user, profile, isAdmin, roleReadError, refreshProfile, logout, updateStudentProfile, sendPasswordReset } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'department' | 'announcements' | 'ask-ai' | 'profile'>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  useEffect(() => {
    if (profile?.fullName) {
      setEditFullName(profile.fullName);
    }
  }, [profile]);

  // Fetch announcements from Firestore or fallback
  useEffect(() => {
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
    fetchAnnouncements();
  }, []);

  // Filter announcements for student (matches 'All' or student's department)
  const relevantAnnouncements = announcements.filter(a => {
    const matchDept = a.department === 'All' || a.department === profile?.department;
    const matchCategory = annFilter === 'All' || a.category === annFilter;
    return matchDept && matchCategory;
  });

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

          {/* Student / Admin Status Card */}
          <div className="p-3.5 rounded-xl bg-[#121C36] border border-[#24315A]">
            <div className="text-[10px] font-bold text-[#FFC700] uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>{isAdmin ? 'Administrator' : 'Student Account'}</span>
              {isAdmin && (
                <span className="px-1.5 py-0.5 rounded bg-[#FFC700] text-[#0A1224] text-[9px] font-extrabold uppercase">
                  Admin
                </span>
              )}
            </div>
            <div className="text-xs font-semibold text-[#E6ECFA] truncate">
              {profile?.fullName || user?.email}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono text-[#9AA8C7]">
              <span className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-[#FFC700]' : 'bg-emerald-400'}`} />
              <span>{isAdmin ? 'CLEARANCE: ADMIN' : (profile?.matricNumber || 'MATRIC PENDING')}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
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
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FFC700] text-[#0A1224] font-bold">
                  {relevantAnnouncements.length}
                </span>
              </div>
            </button>

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

            {/* Admin Dashboard Sidebar Navigation Link */}
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
        <div className="space-y-2 pt-4 border-t border-[#24315A]">
          <button
            onClick={onNavigateContact}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36] cursor-pointer"
          >
            <span>Student Helpdesk Form</span>
          </button>
          <button
            onClick={onNavigateHome}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36] cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#FFC700]" />
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
        
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#24315A]">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#9AA8C7]">
              <span>School of Technology</span>
              <span>/</span>
              <span className="text-[#FFC700] font-semibold capitalize">{activeTab}</span>
            </div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#E6ECFA] mt-1">
              {activeTab === 'overview' && 'Student Portal Overview'}
              {activeTab === 'department' && 'My Enrolled Department'}
              {activeTab === 'announcements' && 'Student Bulletins & Notices'}
              {activeTab === 'ask-ai' && 'Ask AI: Academic Tutor & Portal Assistant'}
              {activeTab === 'profile' && 'Student Profile Settings'}
            </h1>
          </div>

          <div className="px-3.5 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs font-medium text-[#E6ECFA] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Student Verified Session</span>
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
                    <span>Verified Registered Student</span>
                  </div>

                  <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-[#E6ECFA]">
                    Welcome, <span className="text-[#FFC700] break-all">{profile?.fullName || user?.email}</span>
                  </h2>

                  <p className="text-sm text-[#9AA8C7] leading-relaxed">
                    Welcome to your student portal dashboard. Stay up to date with departmental announcements and access peer tutoring notices.
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
                  </div>
                </div>

                {/* Digital Student Card Preview */}
                <div className="w-full lg:w-72 p-5 rounded-xl bg-[#0A1224] border border-[#24315A] shadow-inner space-y-4 shrink-0">
                  <div className="flex items-center justify-between border-b border-[#24315A]/70 pb-3">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-[#FFC700]" />
                      <span className="font-display font-bold text-xs tracking-wider text-[#E6ECFA]">
                        STUDENT PASS
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
                    <div className="text-xs font-medium text-[#E6ECFA] line-clamp-1">
                      {profile?.department}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[10px] text-[#9AA8C7] border-t border-[#24315A]/60">
                    <span>{SITE_CONFIG.tagline}</span>
                    <QrCode className="w-4 h-4 text-[#2F52FF]" />
                  </div>
                </div>

              </div>
            </div>

            {/* ASK AI SPOTLIGHT CARD */}
            <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#121C36] via-[#0E1830] to-[#121C36] border border-[#2F52FF]/40 shadow-[0_4px_25px_rgba(47,82,255,0.15)] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2F52FF] to-[#FFC700] p-0.5 shrink-0 shadow-[0_0_15px_rgba(47,82,255,0.4)]">
                  <div className="w-full h-full bg-[#0A1224] rounded-[10px] flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-[#FFC700]" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-base text-[#E6ECFA]">
                      Ask AI: Academic Tutor &amp; Portal Guide
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFC700] text-[#0A1224] uppercase tracking-wider">
                      Upgrade
                    </span>
                  </div>
                  <p className="text-xs text-[#9AA8C7] mt-0.5">
                    Switch between <strong>Study Helper</strong> (concepts, examples, and revision tailored for {profile?.department || 'your department'}) and <strong>Portal Help</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  onClick={() => setActiveTab('ask-ai')}
                  className="px-4 py-2 rounded-xl bg-[#2F52FF] text-white text-xs font-semibold hover:bg-[#2545df] transition-all cursor-pointer shadow-[0_0_15px_rgba(47,82,255,0.3)] flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#FFC700]" />
                  <span>Open Ask AI Page</span>
                </button>
              </div>
            </div>

            {/* Placeholder Panels: Announcements Preview & Department Notice */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <div className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700]">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base text-[#E6ECFA]">
                        Latest Bulletins
                      </h3>
                      <p className="text-xs text-[#9AA8C7]">Recent student updates</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('announcements')}
                    className="text-xs font-semibold text-[#FFC700] hover:underline cursor-pointer"
                  >
                    View All &rarr;
                  </button>
                </div>

                <div className="space-y-3 pt-2">
                  {relevantAnnouncements.slice(0, 3).map((ann) => (
                    <div
                      key={ann.id}
                      className="p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-1 hover:border-[#2F52FF] transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-[#FFC700]">{ann.category}</span>
                        <span className="text-[#9AA8C7]">{ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : ''}</span>
                      </div>
                      <h4 className="text-xs font-semibold text-[#E6ECFA] line-clamp-1">
                        {ann.title}
                      </h4>
                      <p className="text-xs text-[#9AA8C7] line-clamp-2">
                        {ann.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Department Overview Card */}
              <div className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700]">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-[#E6ECFA]">
                      Department Overview
                    </h3>
                    <p className="text-xs text-[#9AA8C7]">{studentDepartment.name}</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-2 text-xs">
                  <p className="text-[#E6ECFA] font-medium leading-relaxed">
                    {studentDepartment.oneLiner}
                  </p>
                  <p className="text-[#9AA8C7]">
                    Curriculum syllabi and course materials are maintained through this portal.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('department')}
                    className="w-full py-2.5 rounded-xl bg-[#2F52FF] text-white text-xs font-semibold hover:bg-[#2545df] cursor-pointer"
                  >
                    View Complete Department Information
                  </button>
                </div>
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

            <div className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] text-center space-y-2">
              <div className="text-xs uppercase font-bold text-[#FFC700]">Department Workstations</div>
              <div className="text-sm font-semibold text-[#E6ECFA]">{studentDepartment.facilityNotice}</div>
              <p className="text-xs text-[#9AA8C7]">
                Practical schedules and room allocation lists will be posted by your student department representative.
              </p>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: ANNOUNCEMENTS (Logged-in students)                */}
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
                Targeted for: {profile?.department} & All Students
              </span>
            </div>

            <div className="space-y-4">
              {relevantAnnouncements.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-[#121C36] border border-[#24315A] text-[#9AA8C7]">
                  No announcements found for this filter.
                </div>
              ) : (
                relevantAnnouncements.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-3 hover:border-[#2F52FF] transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                        ann.urgent ? 'bg-rose-950 text-rose-300 border border-rose-500/40' : 'bg-[#0A1224] text-[#FFC700] border border-[#24315A]'
                      }`}>
                        {ann.category} {ann.urgent && '• URGENT'}
                      </span>
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
                      <span>Broadcast by: {ann.author || 'Student Administration'}</span>
                      <span className="font-mono text-[#FFC700]">Audience: {ann.department}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 4: PROFILE SETTINGS                                 */}
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
        {/* VIEW 5: ASK AI (Full Page Workspace)                    */}
        {/* ======================================================== */}
        {activeTab === 'ask-ai' && (
          <AskAiView />
        )}

      </main>

    </div>
  );
};
