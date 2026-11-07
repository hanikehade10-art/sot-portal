import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <aside
      aria-label="Offline Mode Notice"
      className="sticky top-0 z-40 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-[#0A1224] px-4 py-2.5 shadow-lg border-b border-amber-400 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1 rounded-lg bg-[#0A1224]/15 shrink-0">
          <WifiOff className="w-4 h-4 text-[#0A1224]" />
        </div>
        <div className="text-xs font-semibold leading-tight truncate sm:whitespace-normal">
          <span className="font-bold">No internet connection.</span> You can still read cached course materials, but submitting quizzes and syncing leaderboard points requires internet.
        </div>
      </div>

      <button
        type="button"
        onClick={() => window.location.reload()}
        className="px-2.5 py-1 rounded-lg bg-[#0A1224] text-white hover:bg-[#121C36] text-[11px] font-bold shrink-0 flex items-center gap-1 transition-all cursor-pointer shadow-sm"
      >
        <RefreshCw className="w-3 h-3" />
        <span className="hidden sm:inline">Check Connection</span>
      </button>
    </aside>
  );
};
