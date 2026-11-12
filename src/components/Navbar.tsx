import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, Menu, X, LogOut, LayoutDashboard, ShieldAlert, MessageSquare, ShieldCheck, HelpCircle, Sparkles } from 'lucide-react';
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
  const { user, profile, isAdmin, isRep, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNav = (target: string) => {
    onNavigate(target);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-2 sm:top-4 z-40 w-full px-3 sm:px-6 transition-all duration-300 pointer-events-none">
      <div
        className={`max-w-6xl mx-auto rounded-2xl border transition-all duration-300 pointer-events-auto backdrop-blur-md ${
          isScrolled
            ? 'bg-[#0A1224]/85 border-[#2F52FF]/35 shadow-[0_12px_36px_rgba(0,0,0,0.6)] py-2 sm:py-2.5 px-4 sm:px-6 scale-[0.985]'
            : 'bg-[#0A1224]/70 border-[#24315A]/80 shadow-[0_8px_24px_rgba(0,0,0,0.35)] py-3 sm:py-3.5 px-4 sm:px-7 scale-100'
        }`}
      >
        <div className="flex items-center justify-between">
          
          {/* Logo & Wordmark */}
          <button
            onClick={() => handleNav('landing')}
            className="flex items-center gap-2.5 sm:gap-3 group text-left transition-opacity hover:opacity-90 cursor-pointer"
          >
            <div
              className={`rounded-xl bg-[#121C36] border border-[#24315A] flex items-center justify-center text-[#FFC700] shadow-[0_0_15px_rgba(255,199,0,0.15)] group-hover:border-[#2F52FF] group-hover:shadow-[0_0_20px_rgba(47,82,255,0.25)] transition-all ${
                isScrolled ? 'w-9 h-9' : 'w-10 h-10'
              }`}
            >
              <GraduationCap className={isScrolled ? 'w-5 h-5' : 'w-5.5 h-5.5'} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-display font-extrabold text-xl sm:text-2xl tracking-tight text-[#E6ECFA]">
                  SOT<span className="text-[#FFC700]">.</span>
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold tracking-widest uppercase px-1.5 sm:px-2 py-0.5 rounded bg-[#121C36] text-[#FFC700] border border-[#FFC700]/30">
                  Student Portal
                </span>
              </div>
            </div>
          </button>

          {/* Menu Trigger (Only SOT logo and menu icon on header) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] text-[#E6ECFA] hover:text-white transition-all cursor-pointer shadow-sm focus:outline-none"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              title={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-[#FFC700]" /> : <Menu className="w-5 h-5 text-[#E6ECFA]" />}
            </button>
          </div>

        </div>
      </div>

      {/* Header Menu Drawer (Opens when menu icon is clicked) */}
      {mobileMenuOpen && (
        <div className="mt-2 max-w-6xl mx-auto rounded-2xl bg-[#0A1224]/95 border border-[#24315A] backdrop-blur-xl px-5 pt-3 pb-5 space-y-4 shadow-2xl pointer-events-auto animate-page-enter">
          <div className="flex flex-col space-y-1 sm:space-y-1.5">
            <button
              onClick={() => handleNav('landing')}
              className={`text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                currentView === 'landing' ? 'bg-[#121C36] text-[#FFC700]' : 'text-[#E6ECFA] hover:bg-[#121C36]'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => {
                if (currentView === 'landing') {
                  const el = document.getElementById('departments');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  setMobileMenuOpen(false);
                } else {
                  handleNav('departments');
                }
              }}
              className="text-left px-3 py-2 rounded-xl text-sm font-medium text-[#9AA8C7] hover:bg-[#121C36] hover:text-[#E6ECFA] transition-colors cursor-pointer"
            >
              Departments
            </button>
            <button
              onClick={() => {
                if (currentView === 'landing') {
                  const el = document.getElementById('how-it-works');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  setMobileMenuOpen(false);
                } else {
                  handleNav('how-it-works');
                }
              }}
              className="text-left px-3 py-2 rounded-xl text-sm font-medium text-[#9AA8C7] hover:bg-[#121C36] hover:text-[#E6ECFA] transition-colors cursor-pointer"
            >
              How it works
            </button>
            <button
              onClick={() => {
                if (currentView === 'landing') {
                  const el = document.getElementById('faq');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  setMobileMenuOpen(false);
                } else {
                  handleNav('faq');
                }
              }}
              className="text-left px-3 py-2 rounded-xl text-sm font-medium text-[#9AA8C7] hover:bg-[#121C36] hover:text-[#E6ECFA] transition-colors cursor-pointer"
            >
              FAQs
            </button>
            <button
              onClick={() => {
                if (currentView === 'landing') {
                  const el = document.getElementById('contact');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  setMobileMenuOpen(false);
                } else {
                  handleNav('contact');
                }
              }}
              className="text-left px-3 py-2 rounded-xl text-sm font-medium text-[#9AA8C7] hover:bg-[#121C36] hover:text-[#E6ECFA] transition-colors cursor-pointer"
            >
              Contact Desk
            </button>
          </div>

          {/* Menu Footer */}
          <div className="pt-3 border-t border-[#24315A]/70 flex flex-col gap-2.5">
            {user ? (
              <>
                {isAdmin && (
                  <button
                    onClick={() => handleNav('admin')}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#FFC700] text-[#0A1224] flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:bg-[#ffd233]"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Admin Dashboard</span>
                  </button>
                )}
                {isRep && (
                  <button
                    onClick={() => handleNav('rep')}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#2F52FF] to-[#1E3AB8] text-white border border-[#FFC700]/50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Sparkles className="w-4 h-4 text-[#FFC700]" />
                    <span>Course Rep Desk</span>
                  </button>
                )}
                {profile?.profileComplete || isAdmin ? (
                  <button
                    onClick={() => handleNav('dashboard')}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#2F52FF] hover:bg-[#2545df] text-white flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <LayoutDashboard className="w-4 h-4 text-[#FFC700]" />
                    <span>Go to Student Portal</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleNav('step2')}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#FFC700] text-[#0A1224] cursor-pointer"
                  >
                    Complete Step 2 (Department & Matric)
                  </button>
                )}
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="w-full py-2 rounded-xl text-xs font-medium bg-[#121C36] hover:bg-rose-950/40 text-[#9AA8C7] hover:text-rose-300 border border-[#24315A] hover:border-rose-500/40 transition-colors cursor-pointer"
                >
                  Log out ({user.email})
                </button>
              </>
            ) : (
              /* Plain text link 'Student Login' at the bottom of the menu for returning students */
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => {
                    openLogin();
                    setMobileMenuOpen(false);
                  }}
                  className="text-xs text-[#9AA8C7] hover:text-[#FFC700] hover:underline transition-colors py-1 cursor-pointer font-medium"
                >
                  Student Login
                </button>
                <span className="text-[11px] text-[#9AA8C7]/60">
                  Returning student?
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
