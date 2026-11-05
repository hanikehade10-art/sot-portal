import React, { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy
} from 'firebase/firestore';
import { db, auth, safeAddDoc, safeUpdateDoc, cleanFirestoreData } from '../lib/firebase';
import { LinkItem, LinkCategory } from '../types';
import { SOT_DEPARTMENTS_LIST } from '../data/departments';
import { dispatchPushNotification, getDepartmentTopicSlug } from '../lib/pushNotifications';
import {
  Link2,
  Plus,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Sparkles
} from 'lucide-react';

const CATEGORIES: LinkCategory[] = [
  'WhatsApp Groups',
  'Registration',
  'Associations',
  'Other'
];

export const AdminLinksView: React.FC = () => {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | LinkCategory>('All');
  const [saving, setSaving] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<LinkCategory>('WhatsApp Groups');
  const [formUrl, setFormUrl] = useState('');
  const [formButtonText, setFormButtonText] = useState('Join Group');
  const [formAudience, setFormAudience] = useState<string>('All');
  const [formActive, setFormActive] = useState(true);
  const [formOrder, setFormOrder] = useState(0);
  const [notifyStudents, setNotifyStudents] = useState(true);

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'links'), orderBy('order', 'asc'));
      const snap = await getDocs(q);
      const list: LinkItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          name: data.name || '',
          description: data.description || '',
          category: (data.category as LinkCategory) || 'Other',
          url: data.url || '',
          buttonText: data.buttonText || 'Open',
          audience: data.audience || 'All',
          active: data.active !== false,
          order: typeof data.order === 'number' ? data.order : 0,
          createdAt: data.createdAt || ''
        });
      });
      setLinks(list);
    } catch (err) {
      console.warn('Error loading links for admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setFormCategory('WhatsApp Groups');
    setFormUrl('');
    setFormButtonText('Join Group');
    setFormAudience('All');
    setFormActive(true);
    setFormOrder(links.length + 1);
    setNotifyStudents(true);
    setShowModal(true);
  };

  const handleOpenEdit = (item: LinkItem) => {
    setEditingId(item.id);
    setFormName(item.name);
    setFormDescription(item.description);
    setFormCategory(item.category);
    setFormUrl(item.url);
    setFormButtonText(item.buttonText);
    setFormAudience(item.audience);
    setFormActive(item.active);
    setFormOrder(item.order);
    setShowModal(true);
  };

  const handleCategoryChange = (cat: LinkCategory) => {
    setFormCategory(cat);
    if (!editingId) {
      if (cat === 'WhatsApp Groups') setFormButtonText('Join Group');
      else if (cat === 'Registration') setFormButtonText('Open Portal');
      else if (cat === 'Associations') setFormButtonText('Join Association');
      else setFormButtonText('Open');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formUrl.trim()) return;

    setSaving(true);
    const payload = {
      name: formName.trim(),
      description: formDescription.trim(),
      category: formCategory,
      url: formUrl.trim(),
      buttonText: formButtonText.trim() || 'Open',
      audience: formAudience,
      active: formActive,
      order: Number(formOrder) || 0,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingId) {
        await safeUpdateDoc(doc(db, 'links', editingId), cleanFirestoreData(payload));
        setLinks((prev) =>
          prev.map((l) => (l.id === editingId ? { ...l, ...payload } : l))
        );
      } else {
        const fullPayload = {
          ...payload,
          createdAt: new Date().toISOString()
        };
        const ref = await safeAddDoc(collection(db, 'links'), cleanFirestoreData(fullPayload));
        setLinks((prev) => [...prev, { id: ref?.id || ('link_' + Date.now()), ...fullPayload }]);

        if (formActive && notifyStudents) {
          const topic = formAudience === 'All' ? 'all' : `dept-${getDepartmentTopicSlug(formAudience)}`;
          await dispatchPushNotification(
            {
              topic,
              title: 'New Community Link',
              body: `${formName.trim()}: ${formDescription.trim() || 'New student link available'}`,
              link: '/dashboard?tab=links'
            },
            auth.currentUser
          );
        }
      }
      setShowModal(false);
      setEditingId(null);
    } catch (err: any) {
      alert(`Could not save link: ${err?.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Permanently delete link "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'links', id));
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch (err: any) {
      alert(`Could not delete: ${err?.message || err}`);
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      await safeUpdateDoc(doc(db, 'links', id), { active: !current });
      setLinks((prev) =>
        prev.map((l) => (l.id === id ? { ...l, active: !current } : l))
      );
    } catch (err: any) {
      alert(`Could not update status: ${err?.message || err}`);
    }
  };

  const handleReorder = async (id: string, dir: 'up' | 'down') => {
    const sorted = [...links].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((l) => l.id === id);
    if (idx < 0) return;
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === sorted.length - 1) return;

    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    const currentItem = sorted[idx];
    const swapItem = sorted[swapIdx];

    const currentOrder = currentItem.order;
    const swapOrder = swapItem.order === currentOrder ? (dir === 'up' ? currentOrder - 1 : currentOrder + 1) : swapItem.order;

    try {
      await Promise.all([
        safeUpdateDoc(doc(db, 'links', currentItem.id), { order: swapOrder }),
        safeUpdateDoc(doc(db, 'links', swapItem.id), { order: currentOrder })
      ]);
      setLinks((prev) =>
        prev
          .map((l) => {
            if (l.id === currentItem.id) return { ...l, order: swapOrder };
            if (l.id === swapItem.id) return { ...l, order: currentOrder };
            return l;
          })
          .sort((a, b) => a.order - b.order)
      );
    } catch (err: any) {
      console.warn('Reorder failed:', err);
    }
  };

  const handleSeedDefaults = async () => {
    if (!confirm('Add verified default community links to get started?')) return;
    setSaving(true);
    const defaults = [
      {
        name: 'SOT General WhatsApp Community',
        description: 'Official student broadcast and discussion channel for all School of Technology departments.',
        category: 'WhatsApp Groups' as LinkCategory,
        url: 'https://chat.whatsapp.com/',
        buttonText: 'Join Community',
        audience: 'All',
        active: true,
        order: 1,
        createdAt: new Date().toISOString()
      },
      {
        name: 'Computer Technology Class Forum',
        description: 'Coding updates, project teams, lab schedules, and exam discussions for ND & HND students.',
        category: 'WhatsApp Groups' as LinkCategory,
        url: 'https://chat.whatsapp.com/',
        buttonText: 'Join Group',
        audience: 'Computer Technology',
        active: true,
        order: 2,
        createdAt: new Date().toISOString()
      },
      {
        name: 'Student Portal Course Registration',
        description: 'Official polytechnic portal for semester course registration, fee receipts, and biodata.',
        category: 'Registration' as LinkCategory,
        url: 'https://portal.polytechnic.edu.ng',
        buttonText: 'Open Portal',
        audience: 'All',
        active: true,
        order: 3,
        createdAt: new Date().toISOString()
      },
      {
        name: 'NACOSS SOT Chapter',
        description: 'National Association of Computer Science and Technology Students hub and mentorship network.',
        category: 'Associations' as LinkCategory,
        url: 'https://nacoss.org.ng',
        buttonText: 'Join Hub',
        audience: 'Computer Technology',
        active: true,
        order: 4,
        createdAt: new Date().toISOString()
      }
    ];

    for (const d of defaults) {
      try {
        const ref = await safeAddDoc(collection(db, 'links'), cleanFirestoreData(d));
        setLinks((prev) => [...prev, { id: ref?.id || ('link_' + Math.random()), ...d }]);
      } catch (e) {
        console.warn('Seed link error:', e);
      }
    }
    setSaving(false);
  };

  const filteredLinks = links.filter((l) => {
    if (categoryFilter !== 'All' && l.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.audience.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl bg-[#0F1E36] border border-[#1E2E52]">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-[#FFC700]" />
            <h3 className="font-heading font-bold text-base text-[#E6ECFA]">
              Links & Communities Directory
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#121C36] text-[#FFC700] font-bold border border-[#FFC700]/30">
              {links.length} total
            </span>
          </div>
          <p className="text-xs text-[#9AA8C7] mt-1">
            Manage WhatsApp group links, registration portals, and student associations.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {links.length === 0 && (
            <button
              onClick={handleSeedDefaults}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs font-semibold text-[#FFC700] hover:border-[#FFC700] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Seed Defaults</span>
            </button>
          )}

          <button
            onClick={fetchLinks}
            title="Refresh links"
            className="p-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-[#9AA8C7] hover:text-[#E6ECFA]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#FFC700]' : ''}`} />
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-1.5 rounded-xl bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold transition-all shadow-[0_0_12px_rgba(47,82,255,0.3)] flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Link</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#9AA8C7] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search links by name, URL, or audience..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/60 focus:outline-none focus:border-[#2F52FF]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setCategoryFilter('All')}
            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
              categoryFilter === 'All'
                ? 'bg-[#2F52FF] text-white'
                : 'bg-[#0F1E36] text-[#9AA8C7] border border-[#1E2E52] hover:text-white'
            }`}
          >
            All ({links.length})
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-[#2F52FF] text-white'
                  : 'bg-[#0F1E36] text-[#9AA8C7] border border-[#1E2E52] hover:text-white'
              }`}
            >
              {cat} ({links.filter((l) => l.category === cat).length})
            </button>
          ))}
        </div>
      </div>

      {/* Links Compact Table */}
      <div className="rounded-2xl bg-[#0F1E36] border border-[#1E2E52] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1E2E52] text-[#9AA8C7] text-[11px] bg-[#070D1A]/50">
                <th className="py-2.5 px-3 font-semibold w-16">Order</th>
                <th className="py-2.5 px-3 font-semibold">Title & Details</th>
                <th className="py-2.5 px-3 font-semibold">Category</th>
                <th className="py-2.5 px-3 font-semibold">Audience</th>
                <th className="py-2.5 px-3 font-semibold">Button</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2E52]/60">
              {filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[#9AA8C7]">
                    {links.length === 0 ? 'No links created yet. Click "Add Link" or "Seed Defaults".' : 'No links match your search.'}
                  </td>
                </tr>
              ) : (
                filteredLinks.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-[#070D1A]/40 transition-colors">
                    {/* Order & Reorder */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-[#FFC700] w-4">{item.order}</span>
                        <div className="flex flex-col">
                          <button
                            onClick={() => handleReorder(item.id, 'up')}
                            className="text-[#9AA8C7] hover:text-[#FFC700] p-0.5 cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="w-2.5 h-2.5" />
                          </button>
                          <button
                            onClick={() => handleReorder(item.id, 'down')}
                            className="text-[#9AA8C7] hover:text-[#FFC700] p-0.5 cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Name & URL */}
                    <td className="py-2.5 px-3 max-w-xs">
                      <div className="font-bold text-[#E6ECFA] truncate">{item.name}</div>
                      {item.description && (
                        <div className="text-[11px] text-[#9AA8C7] truncate max-w-sm">
                          {item.description}
                        </div>
                      )}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#2F52FF] hover:underline flex items-center gap-1 mt-0.5 truncate max-w-xs"
                      >
                        <span className="truncate">{item.url}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    </td>

                    {/* Category */}
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#070D1A] border border-[#1E2E52] text-[#E6ECFA]">
                        {item.category}
                      </span>
                    </td>

                    {/* Audience */}
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          item.audience === 'All'
                            ? 'bg-[#121C36] text-[#9AA8C7] border border-[#1E2E52]'
                            : 'bg-[#2F52FF]/20 text-[#FFC700] border border-[#FFC700]/30'
                        }`}
                      >
                        {item.audience}
                      </span>
                    </td>

                    {/* Button Text */}
                    <td className="py-2.5 px-3">
                      <span className="text-[11px] text-[#9AA8C7] font-medium">
                        "{item.buttonText}"
                      </span>
                    </td>

                    {/* Active Toggle */}
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => handleToggleActive(item.id, item.active)}
                        className="flex items-center gap-1.5 cursor-pointer group"
                      >
                        {item.active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/40">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-900 text-zinc-400 border border-zinc-700">
                            <XCircle className="w-3 h-3" />
                            Hidden
                          </span>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1 rounded text-[#9AA8C7] hover:text-[#FFC700] hover:bg-[#070D1A] cursor-pointer"
                          title="Edit Link"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="p-1 rounded text-[#9AA8C7] hover:text-rose-400 hover:bg-[#070D1A] cursor-pointer"
                          title="Delete Link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add / Edit Link */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#0A1224] border border-[#1F2C4C] rounded-2xl p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#1F2C4C]">
              <h3 className="font-heading font-bold text-sm text-[#E6ECFA] flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#FFC700]" />
                {editingId ? 'Edit Link' : 'Add Community or Essential Link'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#9AA8C7] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">
                  Link / Community Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. SOT General WhatsApp Group"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">
                  Short Description
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Announcements, study materials, and timetable updates"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => handleCategoryChange(e.target.value as LinkCategory)}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">
                    Target Audience *
                  </label>
                  <select
                    value={formAudience}
                    onChange={(e) => setFormAudience(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none"
                  >
                    <option value="All">All Students</option>
                    {SOT_DEPARTMENTS_LIST.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">
                  Destination URL *
                </label>
                <input
                  type="url"
                  required
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://chat.whatsapp.com/... or https://..."
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#FFC700] focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">
                    Button Label
                  </label>
                  <input
                    type="text"
                    value={formButtonText}
                    onChange={(e) => setFormButtonText(e.target.value)}
                    placeholder="e.g. Join Group"
                    className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#9AA8C7] mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formOrder}
                    onChange={(e) => setFormOrder(Number(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="linkActiveCheck"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="rounded bg-[#070D1A] border-[#1E2E52] text-[#2F52FF]"
                />
                <label htmlFor="linkActiveCheck" className="text-xs text-[#E6ECFA] cursor-pointer">
                  Active (visible to students in Communities & Links page)
                </label>
              </div>

              {!editingId && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="linkNotifyCheck"
                    checked={notifyStudents}
                    onChange={(e) => setNotifyStudents(e.target.checked)}
                    className="rounded bg-[#070D1A] border-[#1E2E52] text-[#2F52FF]"
                  />
                  <label htmlFor="linkNotifyCheck" className="text-xs text-[#E6ECFA] cursor-pointer">
                    Notify students (Push notification to {formAudience === 'All' ? 'all students' : formAudience})
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#1F2C4C]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#9AA8C7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] cursor-pointer flex items-center gap-1.5"
                >
                  {saving && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>{editingId ? 'Update Link' : 'Save Link'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
