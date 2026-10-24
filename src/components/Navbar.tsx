import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, Menu, X, LogOut, LayoutDashboard, ShieldAlert, MessageSquare, ShieldCheck, HelpCircle } from 'lucide-react';
import { SITE_CONFIG } from '../config/site';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  openLogin: () => void;
  openSignUp: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  openLogin,
  openSignUp
}) => {
  const { user, profile, isAdmin, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (target: string) => {
    onNavigate(target);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0A1224]/90 backdrop-blur-md border-b border-[#24315A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Wordmark */}
          <button
            onClick={() => handleNav('landing')}
            className="flex items-center gap-3.5 group text-left transition-opacity hover:opacity-90 cursor-pointer"
          >
            <div className="w-11 h-11 rounded-xl bg-[#121C36] border border-[#24315A] flex items-center justify-center text-[#FFC700] shadow-[0_0_15px_rgba(255,199,0,0.15)] group-hover:border-[#2F52FF] group-hover:shadow-[0_0_20px_rgba(47,82,255,0.25)] transition-all">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-2xl tracking-tight text-[#E6ECFA]">
                  SOT<span className="text-[#FFC700]">.</span>
                </span>
                <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded bg-[#121C36] text-[#FFC700] border border-[#FFC700]/30">
                  Student Portal
                </span>
              </div>
              <p className="text-xs text-[#9AA8C7] font-medium tracking-wide">
                {SITE_CONFIG.tagline}
              </p>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-7">
            <button
              onClick={() => handleNav('landing')}
              className={`text-sm font-medium transition-colors cursor-pointer ${
                currentView === 'landing' ? 'text-[#FFC700]' : 'text-[#E6ECFA] hover:text-[#FFC700]'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => handleNav('departments')}
              className={`text-sm font-medium transition-colors cursor-pointer ${
                currentView === 'departments' ? 'text-[#FFC700]' : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
              }`}
            >
              Departments
            </button>
            <button
              onClick={() => handleNav('contact')}
              className={`text-sm font-medium transition-colors cursor-pointer ${
                currentView === 'contact' ? 'text-[#FFC700]' : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
              }`}
            >
              Contact Desk
            </button>
            <button
              onClick={() => handleNav('faq')}
              className={`text-sm font-medium transition-colors cursor-pointer ${
                currentView === 'faq' ? 'text-[#FFC700]' : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
              }`}
            >
              FAQs
            </button>
          </nav>

          {/* Action CTAs & Auth Controls */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                {/* Admin button if admin */}
                {isAdmin && (
                  <button
                    onClick={() => handleNav('admin')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      currentView === 'admin'
                        ? 'bg-[#FFC700] text-[#0A1224] border-[#FFC700] shadow-[0_0_15px_rgba(255,199,0,0.3)]'
                        : 'bg-[#121C36] text-[#FFC700] border-[#FFC700]/40 hover:bg-[#FFC700] hover:text-[#0A1224]'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Admin Dashboard</span>
                  </button>
                )}

                {/* Dashboard button for completed student or admin */}
                {profile?.profileComplete || isAdmin ? (
                  <button
                    onClick={() => handleNav('dashboard')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                      currentView === 'dashboard'
                        ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                        : 'bg-[#121C36] text-[#E6ECFA] border border-[#24315A] hover:border-[#2F52FF]'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4 text-[#FFC700]" />
                    Student Portal
                  </button>
                ) : (
                  <button
                    onClick={() => handleNav('step2')}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold bg-[#FFC700] text-[#0A1224] hover:bg-[#ffcf22] cursor-pointer animate-pulse"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Complete Step 2</span>
                  </button>
                )}

                <button
                  onClick={() => logout()}
                  title="Log out"
                  className="p-2.5 rounded-lg bg-[#121C36] border border-[#24315A] text-[#9AA8C7] hover:text-rose-400 hover:border-rose-500/40 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={openLogin}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium bg-[#121C36] text-[#E6ECFA] border border-[#24315A] hover:border-[#2F52FF] hover:text-white transition-all cursor-pointer"
                >
                  Log in
                </button>
                <button
                  onClick={openSignUp}
                  className="px-5 py-2.5 rounded-lg text-sm font-bold bg-[#FFC700] text-[#0A1224] hover:bg-[#ffd233] transition-all shadow-[0_0_20px_rgba(255,199,0,0.3)] hover:scale-[1.02] cursor-pointer"
                >
                  Sign up
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Trigger */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-[#121C36] border border-[#24315A] text-[#E6ECFA]"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0A1224] border-b border-[#24315A] px-4 pt-3 pb-6 space-y-4 shadow-2xl">
          <div className="flex flex-col space-y-2">
            <button
              onClick={() => handleNav('landing')}
              className="text-left px-3 py-2 rounded-lg text-sm font-medium text-[#E6ECFA] hover:bg-[#121C36]"
            >
              Home
            </button>
            <button
              onClick={() => handleNav('departments')}
              className="text-left px-3 py-2 rounded-lg text-sm font-medium text-[#9AA8C7] hover:bg-[#121C36] hover:text-[#E6ECFA]"
            >
              Departments
            </button>
            <button
              onClick={() => handleNav('contact')}
              className="text-left px-3 py-2 rounded-lg text-sm font-medium text-[#9AA8C7] hover:bg-[#121C36] hover:text-[#E6ECFA]"
            >
              Contact Desk
            </button>
            <button
              onClick={() => handleNav('faq')}
              className="text-left px-3 py-2 rounded-lg text-sm font-medium text-[#9AA8C7] hover:bg-[#121C36] hover:text-[#E6ECFA]"
            >
              FAQs
            </button>
          </div>

          <div className="pt-3 border-t border-[#24315A] flex flex-col gap-2.5">
            {user ? (
              <>
                {isAdmin && (
                  <button
                    onClick={() => handleNav('admin')}
                    className="w-full py-2.5 rounded-lg text-xs font-bold bg-[#FFC700] text-[#0A1224] flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Admin Dashboard</span>
                  </button>
                )}
                {profile?.profileComplete || isAdmin ? (
                  <button
                    onClick={() => handleNav('dashboard')}
                    className="w-full py-2.5 rounded-lg text-xs font-bold bg-[#2F52FF] text-white flex items-center justify-center gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4 text-[#FFC700]" />
                    <span>Go to Student Portal</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleNav('step2')}
                    className="w-full py-2.5 rounded-lg text-xs font-bold bg-[#FFC700] text-[#0A1224]"
                  >
                    Complete Step 2 (Department & Matric)
                  </button>
                )}
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="w-full py-2 rounded-lg text-xs font-medium bg-[#121C36] text-[#9AA8C7] border border-[#24315A]"
                >
                  Log out ({user.email})
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { openLogin(); setMobileMenuOpen(false); }}
                  className="w-full py-2.5 rounded-lg text-sm font-medium bg-[#121C36] text-[#E6ECFA] border border-[#24315A]"
                >
                  Log in
                </button>
                <button
                  onClick={() => { openSignUp(); setMobileMenuOpen(false); }}
                  className="w-full py-2.5 rounded-lg text-sm font-bold bg-[#FFC700] text-[#0A1224]"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
