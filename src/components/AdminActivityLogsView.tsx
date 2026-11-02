import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ActivityLog } from '../types';
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  User,
  PlusCircle,
  Edit,
  Trash2,
  FileText,
  Clock,
  Layers,
  FileQuestion,
  Megaphone,
  Link2,
  CheckCircle2
} from 'lucide-react';

export const AdminActivityLogsView: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [personFilter, setPersonFilter] = useState<string>('All');
  const [actionFilter, setActionFilter] = useState<'All' | 'Created' | 'Updated' | 'Deleted'>('All');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'activityLogs'), orderBy('createdAt', 'desc'), limit(250));
      const snap = await getDocs(q);
      const list: ActivityLog[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as any) });
      });
      setLogs(list);
    } catch (err: any) {
      console.warn('Activity logs fetch note:', err);
      setError(err?.message || 'Could not load activity logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Distinct persons (emails)
  const distinctPersons = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.email) set.add(l.email);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (personFilter !== 'All' && l.email !== personFilter) return false;
      if (actionFilter !== 'All' && l.action !== actionFilter) return false;
      if (dateFilter) {
        const logDateStr = l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 10) : '';
        if (logDateStr !== dateFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = l.title?.toLowerCase().includes(q);
        const matchType = l.itemType?.toLowerCase().includes(q);
        const matchEmail = l.email?.toLowerCase().includes(q);
        return matchTitle || matchType || matchEmail;
      }
      return true;
    });
  }, [logs, personFilter, actionFilter, dateFilter, searchQuery]);

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'Course':
        return <Layers className="w-3.5 h-3.5 text-[#2F52FF]" />;
      case 'Topic':
        return <FileText className="w-3.5 h-3.5 text-[#60A5FA]" />;
      case 'Past Question':
      case 'Solution':
        return <FileQuestion className="w-3.5 h-3.5 text-[#FFC700]" />;
      case 'Quiz':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Announcement':
        return <Megaphone className="w-3.5 h-3.5 text-amber-400" />;
      case 'Link':
        return <Link2 className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-[#9AA8C7]" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'Created':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <PlusCircle className="w-3 h-3 text-emerald-400" />
            <span>Created</span>
          </span>
        );
      case 'Updated':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/30 flex items-center gap-1">
            <Edit className="w-3 h-3 text-[#60A5FA]" />
            <span>Updated</span>
          </span>
        );
      case 'Deleted':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/60 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <Trash2 className="w-3 h-3 text-rose-400" />
            <span>Deleted</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0A1224] text-[#E6ECFA] border border-[#24315A]">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="p-4 rounded-2xl bg-[#0F1E36] border border-[#1E2E52] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#070D1A] border border-[#FFC700]/40 flex items-center justify-center text-[#FFC700]">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-[#E6ECFA] flex items-center gap-2">
              <span>Admin &amp; Rep Activity Log</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#121C36] text-[#FFC700] border border-[#24315A]">
                {filteredLogs.length} actions
              </span>
            </h2>
            <p className="text-xs text-[#9AA8C7]">
              Auditing records of who created, edited, or deleted courses, topics, past questions, solutions, quizzes, bulletins, and links.
            </p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-[#070D1A] hover:bg-[#121C36] border border-[#1E2E52] text-xs font-semibold text-[#E6ECFA] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#FFC700] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3.5 rounded-2xl bg-[#0F1E36] border border-[#1E2E52] space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
          {/* Person Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-[#9AA8C7] mb-1">
              Person
            </label>
            <select
              value={personFilter}
              onChange={(e) => setPersonFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
            >
              <option value="All">All Staff / Reps</option>
              {distinctPersons.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-[#9AA8C7] mb-1">
              Action
            </label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
            >
              <option value="All">All Actions</option>
              <option value="Created">Created</option>
              <option value="Updated">Updated</option>
              <option value="Deleted">Deleted</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-[#9AA8C7] mb-1">
              Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter('')}
                  className="absolute right-2 top-2 text-[10px] text-[#9AA8C7] hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-[#9AA8C7] mb-1">
              Search Title
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search action or item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
              />
              <Search className="w-3.5 h-3.5 text-[#9AA8C7] absolute left-2 top-2" />
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table / Cards */}
      {loading ? (
        <div className="p-12 text-center rounded-2xl bg-[#0F1E36] border border-[#1E2E52]">
          <RefreshCw className="w-6 h-6 animate-spin text-[#FFC700] mx-auto mb-2" />
          <p className="text-xs text-[#9AA8C7]">Loading activity logs...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
          {error}
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0F1E36] border border-[#1E2E52] space-y-2">
          <Activity className="w-8 h-8 text-[#9AA8C7]/50 mx-auto" />
          <h3 className="font-heading font-bold text-sm text-[#E6ECFA]">No Activity Records Found</h3>
          <p className="text-xs text-[#9AA8C7] max-w-sm mx-auto">
            {searchQuery || personFilter !== 'All' || actionFilter !== 'All' || dateFilter
              ? 'No activity entries matched the selected filters.'
              : 'Admin and course rep actions will be automatically logged here as they occur.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#0F1E36] border border-[#1E2E52] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1E2E52] bg-[#070D1A]/60 text-[#9AA8C7] text-[11px]">
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Person</th>
                  <th className="py-3 px-4 font-semibold">Action</th>
                  <th className="py-3 px-4 font-semibold">Item Type</th>
                  <th className="py-3 px-4 font-semibold">Item Title</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2E52]">
                {filteredLogs.map((log) => {
                  const dateObj = log.createdAt ? new Date(log.createdAt) : null;
                  const dateStr = dateObj
                    ? dateObj.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })
                    : 'Unknown';
                  const timeStr = dateObj
                    ? dateObj.toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : '';

                  return (
                    <tr key={log.id} className="hover:bg-[#070D1A]/40 transition-colors">
                      <td className="py-3 px-4 text-[#9AA8C7] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#FFC700]" />
                          <span className="font-medium text-[#E6ECFA]">{dateStr}</span>
                          <span className="text-[11px] text-[#9AA8C7]">({timeStr})</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#121C36] border border-[#24315A] flex items-center justify-center text-[10px] font-bold text-[#FFC700]">
                            {log.email?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <span className="font-semibold text-[#E6ECFA] block leading-tight">
                              {log.email}
                            </span>
                            <span className="text-[10px] text-[#60A5FA]">
                              {log.role || 'Staff'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-[11px] font-medium text-[#E6ECFA]">
                          {getItemIcon(log.itemType)}
                          <span>{log.itemType}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-[#E6ECFA] line-clamp-1">
                          {log.title}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
