import React, { useRef, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  X,
  Megaphone,
  BookOpen,
  Calendar,
  Link2,
  ListTodo,
  ExternalLink,
  Pin
} from 'lucide-react';

export interface DashboardNotificationItem {
  id: string;
  type: 'announcement' | 'material' | 'course' | 'timetable' | 'link' | 'todo';
  title: string;
  subtitle: string;
  timeStr: string;
  timestamp: number;
  isUnread: boolean;
  actionTab: any;
  badge: string;
  isPinned?: boolean;
}

interface NotificationsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: DashboardNotificationItem[];
  unreadCount: number;
  onMarkAllAsRead: () => void;
  onSelectNotification: (actionTab: any) => void;
}

export const NotificationsPopover: React.FC<NotificationsPopoverProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAllAsRead,
  onSelectNotification
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getItemIcon = (type: DashboardNotificationItem['type']) => {
    switch (type) {
      case 'announcement':
        return <Megaphone className="w-3.5 h-3.5 text-[#FFC700]" />;
      case 'material':
        return <BookOpen className="w-3.5 h-3.5 text-[#2F52FF]" />;
      case 'course':
        return <BookOpen className="w-3.5 h-3.5 text-indigo-400" />;
      case 'timetable':
        return <Calendar className="w-3.5 h-3.5 text-amber-400" />;
      case 'link':
        return <Link2 className="w-3.5 h-3.5 text-[#25D366]" />;
      case 'todo':
        return <ListTodo className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-[#9AA8C7]" />;
    }
  };

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl bg-[#0D162B] border border-[#24315A] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="p-3.5 bg-[#121C36] border-b border-[#24315A] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#2F52FF]/20 text-[#FFC700] flex items-center justify-center">
            <Bell className="w-3.5 h-3.5" />
          </div>
          <h3 className="font-heading font-bold text-xs text-[#E6ECFA]">
            Notifications
          </h3>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-bold text-[10px]">
              {unreadCount} new
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-[11px] font-semibold text-[#FFC700] hover:text-[#ffd233] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <CheckCheck className="w-3 h-3" />
              <span>Mark all read</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#9AA8C7] hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Notification Items List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-[#24315A]/60">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#9AA8C7]">
            <Bell className="w-6 h-6 mx-auto mb-2 text-[#9AA8C7]/50" />
            <p className="font-semibold text-[#E6ECFA]">You're all caught up!</p>
            <p className="text-[11px] mt-0.5">No new announcements, uploads, or pending tasks.</p>
          </div>
        ) : (
          notifications.slice(0, 15).map((item) => (
            <div
              key={item.id}
              onClick={() => {
                onSelectNotification(item.actionTab);
                onClose();
              }}
              className={`p-3 transition-colors cursor-pointer flex items-start gap-2.5 ${
                item.isUnread ? 'bg-[#121C36]/70 hover:bg-[#162347]' : 'hover:bg-[#121C36]/30'
              }`}
            >
              <div className="p-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] shrink-0 mt-0.5">
                {getItemIcon(item.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase flex items-center gap-1 ${
                      item.isPinned
                        ? 'bg-[#FFC700]/20 text-[#FFC700] border border-[#FFC700]/30'
                        : item.isUnread
                        ? 'bg-[#2F52FF]/20 text-[#60A5FA]'
                        : 'bg-[#121C36] text-[#9AA8C7]'
                    }`}
                  >
                    {item.isPinned && <Pin className="w-2.5 h-2.5 fill-[#FFC700]" />}
                    {item.badge}
                  </span>
                  <span className="text-[10px] text-[#9AA8C7]/70 whitespace-nowrap">
                    {item.timeStr}
                  </span>
                </div>

                <h4 className="text-xs font-semibold text-[#E6ECFA] line-clamp-1 leading-snug">
                  {item.title}
                </h4>
                <p className="text-[11px] text-[#9AA8C7] line-clamp-1 mt-0.5">
                  {item.subtitle}
                </p>
              </div>

              {item.isUnread && (
                <span className="w-2 h-2 rounded-full bg-[#FFC700] shrink-0 mt-2" />
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-2 bg-[#0A1224] border-t border-[#24315A] text-center">
          <span className="text-[10px] text-[#9AA8C7]">
            Showing recent school updates &amp; academic alerts
          </span>
        </div>
      )}
    </div>
  );
};
