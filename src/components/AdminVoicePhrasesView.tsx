import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  orderBy,
  getDocs,
  limit,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UnrecognizedVoicePhraseItem } from '../types';
import {
  Mic,
  Search,
  RefreshCw,
  Trash2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Filter
} from 'lucide-react';

interface PhraseGroup {
  key: string;
  normalizedPhrase: string;
  pageContext: string;
  count: number;
  latestAt: string;
  samplePhrases: string[];
  docIds: string[];
}

export const AdminVoicePhrasesView: React.FC = () => {
  const [phrases, setPhrases] = useState<UnrecognizedVoicePhraseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contextFilter, setContextFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grouped' | 'recent'>('grouped');
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState<{
    title: string;
    docIds: string[];
  } | null>(null);

  const fetchPhrases = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, 'unrecognizedVoicePhrases'),
        orderBy('createdAt', 'desc'),
        limit(300)
      );
      const snap = await getDocs(q);
      const list: UnrecognizedVoicePhraseItem[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as any) });
      });
      setPhrases(list);
    } catch (err: any) {
      console.warn('Voice phrases fetch notice:', err);
      setError(err?.message || 'Could not load unrecognized voice phrases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhrases();
  }, []);

  const distinctContexts = useMemo(() => {
    const set = new Set<string>();
    phrases.forEach((p) => {
      if (p.pageContext) set.add(p.pageContext);
    });
    return Array.from(set).sort();
  }, [phrases]);

  const filteredPhrases = useMemo(() => {
    return phrases.filter((p) => {
      if (contextFilter !== 'All' && p.pageContext !== contextFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          (p.phrase || '').toLowerCase().includes(q) ||
          (p.normalizedPhrase || '').toLowerCase().includes(q) ||
          (p.pageContext || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [phrases, contextFilter, searchQuery]);

  const groupedPhrases = useMemo<PhraseGroup[]>(() => {
    const map = new Map<string, PhraseGroup>();
    filteredPhrases.forEach((p) => {
      const normKey = `${p.pageContext || 'other'}::${(p.normalizedPhrase || p.phrase || '').toLowerCase().trim()}`;
      const existing = map.get(normKey);
      if (existing) {
        existing.count += 1;
        existing.docIds.push(p.id);
        if (p.phrase && !existing.samplePhrases.includes(p.phrase) && existing.samplePhrases.length < 4) {
          existing.samplePhrases.push(p.phrase);
        }
        if (p.createdAt > existing.latestAt) {
          existing.latestAt = p.createdAt;
        }
      } else {
        map.set(normKey, {
          key: normKey,
          normalizedPhrase: p.normalizedPhrase || p.phrase || '',
          pageContext: p.pageContext || 'other',
          count: 1,
          latestAt: p.createdAt || '',
          samplePhrases: p.phrase ? [p.phrase] : [],
          docIds: [p.id]
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.latestAt.localeCompare(a.latestAt);
    });
  }, [filteredPhrases]);

  const handleDeleteDocIds = async (docIds: string[]) => {
    if (docIds.length === 0) return;
    setDeletingIds(new Set(docIds));
    try {
      await Promise.all(
        docIds.map((id) => deleteDoc(doc(db, 'unrecognizedVoicePhrases', id)))
      );
      const idSet = new Set(docIds);
      setPhrases((prev) => prev.filter((p) => !idSet.has(p.id)));
    } catch (err: any) {
      setError(`Could not delete phrases: ${err?.message || err}`);
    } finally {
      setDeletingIds(new Set());
      setConfirmBulkDelete(null);
    }
  };

  const handleCopySummary = async () => {
    const lines = groupedPhrases.map(
      (g) => `[${g.pageContext}] (${g.count}x) "${g.samplePhrases[0] || g.normalizedPhrase}"`
    );
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2500);
    } catch {
      // ignore clipboard restriction
    }
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return 'Unknown time';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-base sm:text-lg text-[#E6ECFA] flex items-center gap-2">
            <Mic className="w-5 h-5 text-[#FFC700]" />
            <span>Voice Phrases Not Understood</span>
          </h3>
          <p className="text-xs text-[#9AA8C7] mt-0.5">
            Opt-in anonymous phrases spoken by students that did not match a command, so you can expand synonyms later.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopySummary}
            disabled={groupedPhrases.length === 0}
            className="min-h-[40px] px-3 py-2 rounded-xl bg-[#0F1E36] border border-[#1E2E52] hover:border-[#FFC700] text-xs font-semibold text-[#E6ECFA] flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            {copiedNotice ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-[#FFC700]" />
                <span>Copy List</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={fetchPhrases}
            className="min-h-[40px] px-3 py-2 rounded-xl bg-[#0F1E36] border border-[#1E2E52] hover:border-[#2F52FF] text-xs font-semibold text-[#E6ECFA] flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-[#FFC700] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {filteredPhrases.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setConfirmBulkDelete({
                  title: `Delete ${filteredPhrases.length} visible voice phrase logs?`,
                  docIds: filteredPhrases.map((p) => p.id)
                })
              }
              className="min-h-[40px] px-3 py-2 rounded-xl bg-rose-950/60 border border-rose-500/40 hover:bg-rose-900/60 text-xs font-bold text-rose-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Shown</span>
            </button>
          )}
        </div>
      </div>

      {/* Privacy Guarantee Banner */}
      <div className="p-3.5 rounded-xl bg-[#0F1E36] border border-emerald-500/30 flex items-start gap-2.5 text-xs text-[#9AA8C7]">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <span>
          <strong className="text-emerald-300">Privacy-First Logging:</strong> Only opt-in unrecognized phrase text and screen context are stored here. Audio recordings, student names, matric numbers, and user IDs are never saved.
        </span>
      </div>

      {/* Filter Controls */}
      <div className="p-3.5 rounded-2xl bg-[#0F1E36] border border-[#1E2E52] grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#9AA8C7] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search spoken phrases..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#FFC700] shrink-0" />
          <select
            value={contextFilter}
            onChange={(e) => setContextFilter(e.target.value)}
            aria-label="Filter by page context"
            className="w-full px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
          >
            <option value="All">All Page Contexts ({phrases.length})</option>
            {distinctContexts.map((ctx) => (
              <option key={ctx} value={ctx}>
                {ctx}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-1.5 bg-[#070D1A] p-1 rounded-xl border border-[#1E2E52]">
          <button
            type="button"
            onClick={() => setViewMode('grouped')}
            className={`py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              viewMode === 'grouped' ? 'bg-[#2F52FF] text-white' : 'text-[#9AA8C7] hover:text-white'
            }`}
          >
            Grouped ({groupedPhrases.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('recent')}
            className={`py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              viewMode === 'recent' ? 'bg-[#2F52FF] text-white' : 'text-[#9AA8C7] hover:text-white'
            }`}
          >
            Recent ({filteredPhrases.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="p-8 rounded-2xl bg-[#0F1E36] border border-[#1E2E52] text-center text-xs text-[#9AA8C7]">
          Loading unrecognized voice phrases...
        </div>
      ) : filteredPhrases.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#0F1E36] border border-[#1E2E52] text-center space-y-2">
          <Mic className="w-8 h-8 text-[#FFC700]/60 mx-auto" />
          <div className="text-sm font-bold text-[#E6ECFA]">No unrecognized voice phrases yet</div>
          <p className="text-xs text-[#9AA8C7] max-w-md mx-auto">
            When students opt into &ldquo;Help Improve Voice Assistant&rdquo; in Accessibility Settings, any phrase the assistant cannot understand will appear here without personal info.
          </p>
        </div>
      ) : viewMode === 'grouped' ? (
        <div className="space-y-2.5">
          {groupedPhrases.map((g) => (
            <div
              key={g.key}
              className="p-4 rounded-2xl bg-[#0F1E36] border border-[#1E2E52] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-[#2F52FF]/20 border border-[#2F52FF]/40 text-[11px] font-bold text-[#60A5FA]">
                    {g.pageContext}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#FFC700]/15 border border-[#FFC700]/40 text-[11px] font-bold text-[#FFC700]">
                    {g.count}x
                  </span>
                  <span className="text-[11px] text-[#9AA8C7] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDateTime(g.latestAt)}
                  </span>
                </div>

                <div className="text-sm font-bold text-[#E6ECFA] break-words">
                  &ldquo;{g.samplePhrases[0] || g.normalizedPhrase}&rdquo;
                </div>

                {g.samplePhrases.length > 1 && (
                  <p className="text-xs text-[#9AA8C7]">
                    Also heard: {g.samplePhrases.slice(1).map((s) => `"${s}"`).join(', ')}
                  </p>
                )}

                <p className="text-[11px] text-[#9AA8C7]/80">
                  Normalized: <code className="text-[#FFC700] bg-[#070D1A] px-1.5 py-0.5 rounded">{g.normalizedPhrase || '(empty)'}</code>
                </p>
              </div>

              <button
                type="button"
                disabled={g.docIds.some((id) => deletingIds.has(id))}
                onClick={() => handleDeleteDocIds(g.docIds)}
                aria-label={`Mark resolved and delete ${g.samplePhrases[0]}`}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-[#070D1A] border border-[#1E2E52] hover:border-rose-400 text-xs font-semibold text-rose-300 flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Resolve / Delete</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPhrases.map((p) => (
            <div
              key={p.id}
              className="p-3.5 rounded-xl bg-[#0F1E36] border border-[#1E2E52] flex items-center justify-between gap-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-[#2F52FF]/20 text-[#60A5FA] font-bold">
                    {p.pageContext}
                  </span>
                  <span className="text-[#9AA8C7]">{formatDateTime(p.createdAt)}</span>
                </div>
                <div className="text-sm font-semibold text-[#E6ECFA] break-words">
                  &ldquo;{p.phrase}&rdquo;
                </div>
              </div>

              <button
                type="button"
                disabled={deletingIds.has(p.id)}
                onClick={() => handleDeleteDocIds([p.id])}
                aria-label={`Delete phrase ${p.phrase}`}
                className="p-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] hover:border-rose-400 text-rose-300 shrink-0 cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmBulkDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#0E1A38] border border-[#24315A] p-5 space-y-4">
            <h4 className="font-heading font-bold text-base text-[#E6ECFA]">
              Confirm Clear Voice Logs
            </h4>
            <p className="text-xs text-[#9AA8C7]">{confirmBulkDelete.title}</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(null)}
                className="py-2.5 rounded-xl bg-[#121C36] border border-[#24315A] text-xs font-semibold text-[#E6ECFA] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteDocIds(confirmBulkDelete.docIds)}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white cursor-pointer"
              >
                Delete Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
