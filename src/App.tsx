/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AiChatProvider } from './context/AiChatContext';
import { Navbar } from './components/Navbar';
import { PublicLanding } from './components/PublicLanding';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { StudentDashboard } from './components/StudentDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { RepDashboard } from './components/RepDashboard';
import { ContactPage } from './components/ContactPage';
import { DepartmentDetailPage } from './components/DepartmentDetailPage';
import { FAQPage, PrivacyPolicyPage, TermsPage, NotFoundPage } from './components/InfoPages';
import { DepartmentItem } from './types';
import { DEPARTMENTS } from './data/departments';
import { AlertTriangle, RefreshCw, ShieldAlert, WifiOff, Info } from 'lucide-react';
import { SITE_CONFIG } from './config/site';
import { AdminTopBarSwitcher, AdminViewMode } from './components/AdminTopBarSwitcher';
import { useSiteSettings } from './hooks/useSiteSettings';
import { useOnlineStatus } from './hooks/useOnlineStatus';

function AppContent() {
  const { user, profile, loading, authReady, isAdmin, isRep, roleReadError, refreshProfile } = useAuth();
  const { settings } = useSiteSettings();
  const isOnline = useOnlineStatus();

  // View router
  const [currentView, setCurrentView] = useState<string>('landing');
  const [selectedDept, setSelectedDept] = useState<DepartmentItem | null>(null);

  // Auth modal management
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | 'step2' | 'forgot'>('login');
  const [initialDepartment, setInitialDepartment] = useState<string | undefined>(undefined);

  // Deep Link Ingestion: ?open=quiz|past-question|announcement|course
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const open = params.get('open');
      if (open) {
        const id = params.get('id');
        const code = params.get('code');
        sessionStorage.setItem('sot_deep_link', JSON.stringify({ open, id, code }));
        if (user && (profile?.profileComplete || isAdmin)) {
          navigateTo('dashboard');
        } else if (!user) {
          setAuthModalMode('login');
          setAuthModalOpen(true);
        }
      }
    } catch (e) {
      console.warn('Deep link handling notice:', e);
    }
  }, [user, profile, isAdmin]);

  // Sync initial URL path
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/admin') {
      setCurrentView('admin');
    } else if (path === '/rep') {
      setCurrentView('rep');
    } else if (path === '/dashboard') {
      setCurrentView('dashboard');
    } else if (path === '/contact') {
      setCurrentView('contact');
    } else if (path === '/faq') {
      setCurrentView('faq');
    } else if (path === '/privacy') {
      setCurrentView('privacy');
    } else if (path === '/terms') {
      setCurrentView('terms');
    }
  }, []);

  // Update browser history when view changes
  const navigateTo = (view: string) => {
    setCurrentView(view);
    const targetPath =
      view === 'admin'
        ? '/admin'
        : view === 'rep'
        ? '/rep'
        : view === 'dashboard'
        ? '/dashboard'
        : view === 'contact'
        ? '/contact'
        : view === 'faq'
        ? '/faq'
        : view === 'privacy'
        ? '/privacy'
        : view === 'terms'
        ? '/terms'
        : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // For Admins: Keep view choice active and persist after refreshing
  useEffect(() => {
    if (authReady && isAdmin) {
      const path = window.location.pathname;
      const savedChoice = localStorage.getItem('sot_admin_view_choice') as AdminViewMode | null;
      if (path === '/admin') {
        localStorage.setItem('sot_admin_view_choice', 'admin');
      } else if (path === '/rep') {
        localStorage.setItem('sot_admin_view_choice', 'rep');
      } else if (path === '/dashboard') {
        localStorage.setItem('sot_admin_view_choice', 'student');
      } else if (path === '/' && savedChoice) {
        if (savedChoice === 'admin') {
          navigateTo('admin');
        } else if (savedChoice === 'rep') {
          navigateTo('rep');
        } else if (savedChoice === 'student') {
          navigateTo('dashboard');
        }
      }
    }
  }, [authReady, isAdmin]);

  const handleAdminSwitchView = (mode: AdminViewMode) => {
    localStorage.setItem('sot_admin_view_choice', mode);
    if (mode === 'admin') {
      navigateTo('admin');
    } else if (mode === 'rep') {
      navigateTo('rep');
    } else {
      navigateTo('dashboard');
    }
  };

  // Route Guard Enforcement: If student profile is incomplete and user is not admin, prompt step 2
  useEffect(() => {
    if (authReady && user) {
      if (profile && !profile.profileComplete && !isAdmin && currentView !== 'admin' && currentView !== 'rep') {
        setAuthModalMode('step2');
        setAuthModalOpen(true);
        if (currentView === 'dashboard') {
          setCurrentView('landing');
        }
      }
    }
  }, [authReady, user, profile, isAdmin, currentView]);

  // LOGGED-IN STUDENTS: If already logged in, skip landing page and open Home dashboard straight away
  useEffect(() => {
    if (authReady && user && currentView === 'landing') {
      const path = window.location.pathname;
      const isPublicDoc = path === '/contact' || path === '/faq' || path === '/privacy' || path === '/terms';
      if (!isPublicDoc) {
        if (isAdmin) {
          const savedChoice = localStorage.getItem('sot_admin_view_choice') as AdminViewMode | null;
          if (savedChoice === 'admin') {
            navigateTo('admin');
          } else if (savedChoice === 'rep') {
            navigateTo('rep');
          } else {
            navigateTo('dashboard');
          }
        } else if (profile?.profileComplete || isRep) {
          navigateTo('dashboard');
        } else if (profile && !profile.profileComplete) {
          setAuthModalMode('step2');
          setAuthModalOpen(true);
        }
      }
    }
  }, [authReady, user, profile, isAdmin, isRep, currentView]);

  // Admin route protection: Require login and strict admin role for /admin
  useEffect(() => {
    if (currentView === 'admin' && authReady) {
      if (!user) {
        setAuthModalMode('login');
        setAuthModalOpen(true);
      } else if (!isAdmin && !roleReadError) {
        // Eject non-admins only if role was read without errors
        if (isRep) {
          navigateTo('rep');
        } else {
          navigateTo('dashboard');
        }
      }
    }
  }, [currentView, user, authReady, isAdmin, isRep, roleReadError]);

  // Rep route protection: Require login and rep or admin role for /rep
  useEffect(() => {
    if (currentView === 'rep' && authReady) {
      if (!user) {
        setAuthModalMode('login');
        setAuthModalOpen(true);
      } else if (!isRep && !isAdmin) {
        navigateTo('dashboard');
      }
    }
  }, [currentView, user, authReady, isRep, isAdmin]);

  const handleOpenLogin = () => {
    setAuthModalMode('login');
    setAuthModalOpen(true);
  };

  const handleOpenSignUp = (prefillDept?: string) => {
    if (prefillDept) {
      setInitialDepartment(prefillDept);
    }
    setAuthModalMode('signup');
    setAuthModalOpen(true);
  };

  const handleNavigateDashboard = () => {
    if (!user) {
      handleOpenLogin();
      return;
    }
    if (profile && !profile.profileComplete && !isAdmin) {
      setAuthModalMode('step2');
      setAuthModalOpen(true);
      return;
    }
    navigateTo('dashboard');
  };

  const handleSelectDepartment = (dept: DepartmentItem) => {
    setSelectedDept(dept);
    navigateTo('department-detail');
  };

  // Initial loading state
  if (loading && !authReady) {
    return (
      <div className="min-h-screen bg-[#0A1224] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-xl bg-[#121C36] border border-[#24315A] flex items-center justify-center text-[#FFC700] mb-4 shadow-[0_0_20px_rgba(47,82,255,0.2)]">
          <RefreshCw className="w-6 h-6 animate-spin text-[#FFC700]" />
        </div>
        <p className="text-sm font-semibold text-[#E6ECFA] tracking-wide">
          Loading SOT Student Portal...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A1224] text-[#E6ECFA] flex flex-col selection:bg-[#2F52FF] selection:text-white">
      
      {/* Admin Top Bar View Switcher (Admin Only: Admin | Student view | Rep view) */}
      {isAdmin && (
        <AdminTopBarSwitcher
          currentView={currentView}
          onSwitchView={handleAdminSwitchView}
        />
      )}



      {/* Maintenance Mode Top Banner (Requirement 5) */}
      {settings.maintenanceMode && (
        <div className="bg-[#FFC700] text-[#0A1224] px-4 py-1.5 text-xs font-bold flex items-center justify-center gap-2 z-50 shadow-md">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#0A1224]" />
          <span>
            {isAdmin ? '[Admin Notice] Maintenance Mode is ON for students: ' : ''}
            {settings.maintenanceMessage?.trim() || 'Portal maintenance is currently active. Some updates may take longer to reflect.'}
          </span>
        </div>
      )}

      {/* Offline Mode Alert Badge / Notice (Requirement 4) */}
      {!isOnline && (
        <div className="bg-[#121C36] border-b border-[#24315A] text-[#9AA8C7] px-4 py-1.5 text-xs flex items-center justify-between z-50">
          <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-[#FFC700] text-[10px] font-extrabold uppercase tracking-wider border border-[#FFC700]/30 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFC700] animate-pulse" />
              Offline
            </span>
            <span className="text-xs text-[#E6ECFA]">
              Offline mode active: cached screens are available. <strong>Note:</strong> Google Drive files still need an internet connection.
            </span>
          </div>
        </div>
      )}

      {/* Global Role Read Error Alert Banner */}
      {roleReadError && (
        <div className="bg-rose-950/90 border-b border-rose-500/60 px-4 py-2.5 text-xs text-rose-200 flex items-center justify-between z-50">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Firestore Role Read Error:</strong> {roleReadError}
            </span>
          </div>
          <button
            onClick={() => refreshProfile()}
            className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Global Incomplete Profile Alert for Non-Admin Students */}
      {user && profile && !profile.profileComplete && !isAdmin && (
        <div className="bg-amber-950/60 border-b border-[#FFC700]/50 px-4 py-2.5 text-xs text-[#E6ECFA] flex items-center justify-between z-40">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <AlertTriangle className="w-4 h-4 text-[#FFC700] shrink-0" />
            <span>
              <strong>Incomplete Profile:</strong> Please select your department and enter your matric number to activate your dashboard.
            </span>
          </div>
          <button
            onClick={() => {
              setAuthModalMode('step2');
              setAuthModalOpen(true);
            }}
            className="px-3 py-1 rounded bg-[#FFC700] text-[#0A1224] font-bold text-xs hover:bg-[#ffd233] cursor-pointer shrink-0"
          >
            Finish Step 2
          </button>
        </div>
      )}

      {/* NAVIGATION BAR (Shown on public and content pages) */}
      {currentView !== 'dashboard' && currentView !== 'admin' && currentView !== 'rep' && (
        <Navbar
          currentView={currentView}
          onNavigate={(target) => {
            if (target === 'dashboard') {
              handleNavigateDashboard();
            } else if (target === 'admin') {
              navigateTo('admin');
            } else if (target === 'rep') {
              navigateTo('rep');
            } else if (target === 'departments') {
              navigateTo('landing');
              setTimeout(() => {
                const el = document.getElementById('departments');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            } else if (target === 'step2') {
              setAuthModalMode('step2');
              setAuthModalOpen(true);
            } else {
              navigateTo(target);
            }
          }}
          openLogin={handleOpenLogin}
          openSignUp={() => handleOpenSignUp()}
        />
      )}

      {/* VIEW ROUTING */}
      <main className="flex-1">
        
        {/* 1. STUDENT DASHBOARD (Protected) */}
        {currentView === 'dashboard' && user && (profile?.profileComplete || isAdmin) ? (
          <StudentDashboard
            onNavigateHome={() => navigateTo('landing')}
            onNavigateContact={() => navigateTo('contact')}
            onNavigatePrivacy={() => navigateTo('privacy')}
            onNavigateAdmin={() => navigateTo('admin')}
            onNavigateRep={() => navigateTo('rep')}
          />
        ) : currentView === 'dashboard' ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#121C36] border border-[#FFC700] flex items-center justify-center text-[#FFC700] mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="font-display font-bold text-2xl">Profile Incomplete</h2>
            <p className="text-sm text-[#9AA8C7] max-w-md mx-auto">
              Please enter your department and matriculation number to access your student dashboard.
            </p>
            <button
              onClick={() => {
                setAuthModalMode('step2');
                setAuthModalOpen(true);
              }}
              className="px-6 py-2.5 rounded-xl bg-[#FFC700] text-[#0A1224] font-bold text-xs hover:bg-[#ffd233] cursor-pointer"
            >
              Finish Step 2
            </button>
          </div>
        ) : null}

        {/* 2. ADMIN DASHBOARD (Protected, Admin Only) */}
        {currentView === 'admin' && (
          <AdminDashboard onNavigateHome={() => navigateTo('landing')} />
        )}

        {/* 2.5 COURSE REP DASHBOARD (Protected, Reps Only) */}
        {currentView === 'rep' && user && (isRep || isAdmin) && (
          <RepDashboard
            onNavigateStudentPortal={() => navigateTo('dashboard')}
            onNavigateHome={() => navigateTo('landing')}
          />
        )}

        {/* 3. PUBLIC LANDING */}
        {currentView === 'landing' && (
          <PublicLanding
            openSignUp={() => handleOpenSignUp()}
            openLogin={handleOpenLogin}
            onSelectDepartment={handleSelectDepartment}
            onNavigateContact={() => navigateTo('contact')}
            onNavigateFaq={() => navigateTo('faq')}
          />
        )}

        {/* 4. DEPARTMENT DETAIL PAGE */}
        {currentView === 'department-detail' && selectedDept && (
          <DepartmentDetailPage
            department={selectedDept}
            onBack={() => navigateTo('landing')}
            onJoinDepartment={(deptName) => handleOpenSignUp(deptName)}
          />
        )}

        {/* 5. CONTACT PAGE */}
        {currentView === 'contact' && <ContactPage />}

        {/* 6. FAQ PAGE */}
        {currentView === 'faq' && <FAQPage onNavigateHome={() => navigateTo('landing')} />}

        {/* 7. PRIVACY POLICY */}
        {currentView === 'privacy' && (
          <PrivacyPolicyPage
            onNavigateHome={() => navigateTo('landing')}
            onNavigateContact={() => navigateTo('contact')}
          />
        )}

        {/* 8. TERMS PAGE */}
        {currentView === 'terms' && <TermsPage onNavigateHome={() => navigateTo('landing')} />}

        {/* 9. NOT FOUND / 404 */}
        {currentView === '404' && <NotFoundPage onNavigateHome={() => navigateTo('landing')} />}

      </main>

      {/* FOOTER (Shown on public pages) */}
      {currentView !== 'dashboard' && currentView !== 'admin' && currentView !== 'rep' && (
        <Footer
          onDepartmentClick={(deptId) => {
            const found = DEPARTMENTS.find(d => d.id === deptId);
            if (found) {
              handleSelectDepartment(found);
            } else {
              navigateTo('landing');
            }
          }}
          openSignUp={() => handleOpenSignUp()}
          onNavigateContact={() => navigateTo('contact')}
          onNavigateFaq={() => navigateTo('faq')}
          onNavigatePrivacy={() => navigateTo('privacy')}
          onNavigateTerms={() => navigateTo('terms')}
        />
      )}

      {/* AUTH MODAL */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        initialDepartment={initialDepartment}
        onSuccessRedirect={(role) => {
          if (role === 'admin' || isAdmin) {
            localStorage.setItem('sot_admin_view_choice', 'admin');
            navigateTo('admin');
          } else if (role === 'rep' || isRep) {
            navigateTo('rep');
          } else {
            navigateTo('dashboard');
          }
        }}
      />

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AiChatProvider>
        <AppContent />
      </AiChatProvider>
    </AuthProvider>
  );
}
