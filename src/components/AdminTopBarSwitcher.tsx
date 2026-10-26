import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, GraduationCap, Sparkles, ChevronRight } from 'lucide-react';

export type AdminViewMode = 'admin' | 'student' | 'rep';

interface AdminTopBarSwitcherProps {
  currentView: string;
  onSwitchView: (mode: AdminViewMode) => void;
}

export const AdminTopBarSwitcher: React.FC<AdminTopBarSwitcherProps> = ({
  currentView,
  onSwitchView
}) => {
  const { user } = useAuth();

  // Determine current active mode
  const activeMode: AdminViewMode =
    currentView === 'admin'
      ? 'admin'
      : currentView === 'rep'
      ? 'rep'
      : 'student';

  return (
    <div className="sticky top-0 z-50 w-full bg-[#070D1A] border-b border-[#24315A] text-[#E6ECFA] px-3 sm:px-6 py-2 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
        
        {/* Left: Admin Clearance Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-md bg-[#121C36] border border-[#FFC700]/50 flex items-center justify-center text-[#FFC700]">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-bold uppercase tracking-wider text-[#FFC700] text-[10px] bg-[#121C36] px-1.5 py-0.5 rounded border border-[#FFC700]/30">
              Admin Mode
            </span>
            <span className="text-[#9AA8C7] hidden md:inline truncate max-w-[200px]" title={user?.email || 'Admin'}>
              {user?.email || 'Admin Account'}
            </span>
          </div>
        </div>

        {/* Center / Right: 3-Option View Switcher */}
        <div className="flex items-center bg-[#0A1224] p-1 rounded-xl border border-[#24315A] shadow-inner">
          
          {/* 1. Admin */}
          <button
            type="button"
            onClick={() => onSwitchView('admin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMode === 'admin'
                ? 'bg-[#FFC700] text-[#0A1224] shadow-[0_0_12px_rgba(255,199,0,0.35)] scale-[1.02]'
                : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
            }`}
            title="Open Admin Dashboard (/admin)"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>

          {/* 2. Student view */}
          <button
            type="button"
            onClick={() => onSwitchView('student')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMode === 'student'
                ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.4)] scale-[1.02]'
                : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
            }`}
            title="Preview student dashboard and student pages (/dashboard)"
          >
            <GraduationCap className="w-3.5 h-3.5 text-[#FFC700]" />
            <span>Student view</span>
          </button>

          {/* 3. Rep view */}
          <button
            type="button"
            onClick={() => onSwitchView('rep')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMode === 'rep'
                ? 'bg-gradient-to-r from-[#2F52FF] to-[#1E3AB8] text-white border border-[#FFC700]/60 shadow-[0_0_12px_rgba(255,199,0,0.3)] scale-[1.02]'
                : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
            }`}
            title="Preview Course Rep desk (/rep)"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FFC700]" />
            <span>Rep view</span>
          </button>

        </div>

        {/* Right context hint */}
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-[#9AA8C7]">
          <span>Viewing as:</span>
          <span className="font-semibold text-[#E6ECFA]">
            {activeMode === 'admin'
              ? 'Administrator (/admin)'
              : activeMode === 'rep'
              ? 'Course Rep Desk (/rep)'
              : 'Student Portal (/dashboard)'}
          </span>
        </div>

      </div>
    </div>
  );
};
