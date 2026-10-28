import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { LinkItem, LinkCategory } from '../types';
import {
  ExternalLink,
  Search,
  MessageCircle,
  FileCheck,
  Users,
  Compass,
  Filter,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

const CATEGORIES: { label: string; value: 'All' | LinkCategory }[] = [
  { label: 'All Links', value: 'All' },
  { label: 'WhatsApp Groups', value: 'WhatsApp Groups' },
  { label: 'Registration & Portals', value: 'Registration' },
  { label: 'Associations', value: 'Associations' },
  { label: 'Other', value: 'Other' }
];

export const CommunitiesLinksView: React.FC = () => {
  const { profile } = useAuth();
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | LinkCategory>('All');
  const [filterAudienceOnly, setFilterAudienceOnly] = useState(true);

  const studentDept = profile?.department || '';

  useEffect(() => {
    try {
      const q = query(collection(db, 'links'), orderBy('order', 'asc'));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const list: LinkItem[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              name: data.name || 'Untitled Link',
              description: data.description || '',
              category: (data.category as LinkCategory) || 'Other',
              url: data.url || '#',
              buttonText: data.buttonText || 'Open',
              audience: data.audience || 'All',
              active: data.active !== false,
              order: typeof data.order === 'number' ? data.order : 0,
              createdAt: data.createdAt || ''
            });
          });
          setLinks(list);
          setLoading(false);
        },
        (err) => {
          console.warn('Error fetching links from firestore:', err);
          setLoading(false);
        }
      );
      return () => unsub();
    } catch (err) {
      console.warn('Links listener init error:', err);
      setLoading(false);
    }
  }, []);

  // Filter links
  const filteredLinks = links.filter((item) => {
    if (!item.active) return false;

    // Audience filter: if toggled, show 'All' + student's own department
    if (filterAudienceOnly && studentDept) {
      const isForStudent =
        item.audience === 'All' ||
        item.audience.toLowerCase().trim() === studentDept.toLowerCase().trim();
      if (!isForStudent) return false;
    }

    // Category filter
    if (selectedCategory !== 'All' && item.category !== selectedCategory) {
      return false;
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchDept = item.audience.toLowerCase().includes(q);
      const matchCat = item.category.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchDept && !matchCat) return false;
    }

    return true;
  });

  // Group by category if viewing 'All' and not searching
  const groupedCategories: LinkCategory[] = [
    'WhatsApp Groups',
    'Registration',
    'Associations',
    'Other'
  ];

  const getCategoryIcon = (cat: LinkCategory) => {
    switch (cat) {
      case 'WhatsApp Groups':
        return <MessageCircle className="w-4 h-4 text-[#25D366]" />;
      case 'Registration':
        return <FileCheck className="w-4 h-4 text-[#FFC700]" />;
      case 'Associations':
        return <Users className="w-4 h-4 text-[#2F52FF]" />;
      default:
        return <Compass className="w-4 h-4 text-[#9AA8C7]" />;
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header Banner */}
      <div className="rounded-xl bg-gradient-to-r from-[#121C36] via-[#101A38] to-[#162347] border border-[#24315A] p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#2F52FF]/20 text-[#FFC700] border border-[#FFC700]/30">
                Hub & Networks
              </span>
              {studentDept && (
                <span className="text-xs text-[#9AA8C7] flex items-center gap-1 truncate">
                  <CheckCircle2 className="w-3 h-3 text-[#2F52FF]" />
                  {studentDept}
                </span>
              )}
            </div>
            <h1 className="font-heading font-bold text-lg sm:text-xl text-[#E6ECFA]">
              Communities & Essential Links
            </h1>
            <p className="text-xs text-[#9AA8C7] mt-0.5">
              Verified WhatsApp class groups, faculty associations, and student registration portals.
            </p>
          </div>

          {/* Audience Filter Toggle */}
          {studentDept && (
            <button
              onClick={() => setFilterAudienceOnly(!filterAudienceOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer self-start sm:self-auto shrink-0 ${
                filterAudienceOnly
                  ? 'bg-[#2F52FF]/20 text-[#FFC700] border-[#FFC700]/40'
                  : 'bg-[#0A1224] text-[#9AA8C7] border-[#24315A] hover:text-[#E6ECFA]'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{filterAudienceOnly ? 'My Dept + General' : 'Showing All Depts'}</span>
            </button>
          )}
        </div>

        {/* Search & Category Pills */}
        <div className="mt-3.5 pt-3 border-t border-[#24315A]/60 flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9AA8C7] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search groups, links, or portals..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/60 focus:outline-none focus:border-[#2F52FF]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.value
                    ? 'bg-[#2F52FF] text-white shadow-sm'
                    : 'bg-[#0A1224] text-[#9AA8C7] border border-[#24315A] hover:text-[#E6ECFA]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-8 text-center text-xs text-[#9AA8C7] rounded-xl bg-[#0D162B] border border-[#24315A]">
          Loading verified communities...
        </div>
      ) : filteredLinks.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-[#0D162B] border border-[#24315A]">
          <div className="w-10 h-10 rounded-full bg-[#121C36] border border-[#24315A] flex items-center justify-center mx-auto mb-2 text-[#9AA8C7]">
            <Compass className="w-5 h-5 text-[#FFC700]" />
          </div>
          <h3 className="font-heading font-bold text-sm text-[#E6ECFA]">No links found</h3>
          <p className="text-xs text-[#9AA8C7] mt-1 max-w-sm mx-auto">
            {search
              ? `No links matched "${search}". Try searching another keyword or clearing filters.`
              : 'No community links are listed under this category yet.'}
          </p>
          {(search || selectedCategory !== 'All' || !filterAudienceOnly) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedCategory('All');
                setFilterAudienceOnly(true);
              }}
              className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2F52FF] text-white hover:bg-[#2544D6] transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : selectedCategory === 'All' && !search.trim() ? (
        // Grouped view by category
        <div className="space-y-5">
          {groupedCategories.map((category) => {
            const catItems = filteredLinks.filter((l) => l.category === category);
            if (catItems.length === 0) return null;

            return (
              <div key={category} className="space-y-2.5">
                <div className="flex items-center gap-2 px-1">
                  {getCategoryIcon(category)}
                  <h2 className="font-heading font-bold text-sm text-[#E6ECFA]">
                    {category}
                  </h2>
                  <span className="text-[11px] font-semibold text-[#9AA8C7] px-1.5 py-0.2 rounded bg-[#121C36] border border-[#24315A]">
                    {catItems.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {catItems.map((item) => (
                    <LinkCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Flat filtered grid
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filteredLinks.map((item) => (
            <LinkCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};

const LinkCard: React.FC<{ item: LinkItem }> = ({ item }) => {
  const isWhatsApp = item.category === 'WhatsApp Groups' || item.url.includes('chat.whatsapp.com') || item.url.includes('wa.me');

  return (
    <div className="rounded-xl bg-[#0D162B] border border-[#24315A] hover:border-[#2F52FF]/60 p-3.5 flex flex-col justify-between transition-all duration-200 group">
      <div>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
              item.audience === 'All'
                ? 'bg-[#121C36] text-[#9AA8C7] border-[#24315A]'
                : 'bg-[#2F52FF]/15 text-[#FFC700] border-[#FFC700]/30'
            }`}
          >
            {item.audience === 'All' ? 'All Students' : item.audience}
          </span>

          <span className="text-[10px] text-[#9AA8C7] font-medium">
            {item.category}
          </span>
        </div>

        <h3 className="font-heading font-bold text-sm text-[#E6ECFA] group-hover:text-[#FFC700] transition-colors leading-snug">
          {item.name}
        </h3>

        {item.description && (
          <p className="text-xs text-[#9AA8C7] mt-1 leading-relaxed line-clamp-2">
            {item.description}
          </p>
        )}
      </div>

      <div className="mt-3 pt-2.5 border-t border-[#24315A]/60 flex items-center justify-between">
        <span className="text-[11px] text-[#9AA8C7]/70 truncate max-w-[130px]">
          {new URL(item.url.startsWith('http') ? item.url : `https://${item.url}`).hostname.replace('www.', '')}
        </span>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
            isWhatsApp
              ? 'bg-[#25D366] hover:bg-[#20ba59] text-[#0A1224] font-bold'
              : 'bg-[#2F52FF] hover:bg-[#2544D6] text-white'
          }`}
        >
          <span>{item.buttonText || (isWhatsApp ? 'Join Group' : 'Open')}</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
