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
import { ContactPage } from './components/ContactPage';
import { DepartmentDetailPage } from './components/DepartmentDetailPage';
import { FAQPage, PrivacyPolicyPage, TermsPage, NotFoundPage } from './components/InfoPages';
import { Chatbot } from './components/Chatbot';
import { DepartmentItem } from './types';
import { DEPARTMENTS } from './data/departments';
import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import { SITE_CONFIG } from './config/site';

function AppContent() {
  const { user, profile, loading, authReady, isAdmin, roleReadError, refreshProfile } = useAuth();

  // View router
  const [currentView, setCurrentView] = useState<string>('landing');
  const [selectedDept, setSelectedDept] = useState<DepartmentItem | null>(null);

  // Auth modal management
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | 'step2' | 'forgot'>('login');
  const [initialDepartment, setInitialDepartment] = useState<string | undefined>(undefined);

  // Sync initial URL path
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/admin') {
      setCurrentView('admin');
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
    const targetPath = view === 'admin' ? '/admin' : view === 'contact' ? '/contact' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Route Guard Enforcement: If student profile is incomplete and user is not admin, prompt step 2
  useEffect(() => {
    if (authReady && user) {
      if (profile && !profile.profileComplete && !isAdmin && currentView !== 'admin') {
        setAuthModalMode('step2');
        setAuthModalOpen(true);
        if (currentView === 'dashboard') {
          setCurrentView('landing');
        }
      }
    }
  }, [authReady, user, profile, isAdmin, currentView]);

  // Admin route protection: Require login for /admin
  useEffect(() => {
    if (currentView === 'admin' && authReady) {
      if (!user) {
        setAuthModalMode('login');
        setAuthModalOpen(true);
      }
    }
  }, [currentView, user, authReady]);

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
      
      {/* Disclaimer Banner on all views */}
      <div className="bg-[#121C36] border-b border-[#24315A] px-4 py-2 text-center text-xs text-[#9AA8C7]">
        <span className="text-[#FFC700] font-semibold">{SITE_CONFIG.tagline}</span> — {SITE_CONFIG.disclaimer}
      </div>

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
      {currentView !== 'dashboard' && currentView !== 'admin' && (
        <Navbar
          currentView={currentView}
          onNavigate={(target) => {
            if (target === 'dashboard') {
              handleNavigateDashboard();
            } else if (target === 'admin') {
              navigateTo('admin');
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
            onNavigateAdmin={() => navigateTo('admin')}
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
        {currentView === 'privacy' && <PrivacyPolicyPage onNavigateHome={() => navigateTo('landing')} />}

        {/* 8. TERMS PAGE */}
        {currentView === 'terms' && <TermsPage onNavigateHome={() => navigateTo('landing')} />}

        {/* 9. NOT FOUND / 404 */}
        {currentView === '404' && <NotFoundPage onNavigateHome={() => navigateTo('landing')} />}

      </main>

      {/* FOOTER (Shown on public pages) */}
      {currentView !== 'dashboard' && currentView !== 'admin' && (
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
        onSuccessRedirect={() => {
          navigateTo('dashboard');
        }}
      />

      {/* SOT ASSISTANT AI HELPER CHATBOT */}
      <Chatbot />

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
