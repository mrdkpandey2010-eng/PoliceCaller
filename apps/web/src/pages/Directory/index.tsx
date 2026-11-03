import React, { useState, useEffect } from 'react';
import { SearchBar, ContactRow, Button, Badge } from '@police-directory/ui';
import {
  Filter,
  Star,
  RefreshCw,
  X,
  MapPin,
  Building,
  Award,
  Users,
  Shield,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Globe,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { ContactDetailModal } from './ContactDetailModal';
import { DirectoryStationsOffices } from './DirectoryStationsOffices';
import { DirectoryCoAdmins } from './DirectoryCoAdmins';
import { ContactDiaries } from '../Diaries/ContactDiaries';

export type DirectorySection = 'PERSONNEL' | 'STATIONS_OFFICES' | 'CO_ADMINS' | 'DIARIES';

export interface DirectoryProps {
  onOpenChat: (userId: string) => void;
  initialSection?: DirectorySection;
  onSectionChange?: (section: DirectorySection) => void;
}

export const Directory: React.FC<DirectoryProps> = ({
  onOpenChat,
  initialSection,
  onSectionChange,
}) => {
  const { user } = useAuth();
  const { language, t } = useLanguage();

  const [activeSection, setActiveSection] = useState<DirectorySection>(() => {
    if (initialSection) return initialSection;
    const hash = window.location.hash.toLowerCase();
    if (hash === '#stations' || hash === '#stations-offices') return 'STATIONS_OFFICES';
    if (hash === '#co-admins') return 'CO_ADMINS';
    if (hash === '#diaries') return 'DIARIES';
    const saved = sessionStorage.getItem('police_app_dir_section') as DirectorySection | null;
    return saved && ['PERSONNEL', 'STATIONS_OFFICES', 'CO_ADMINS', 'DIARIES'].includes(saved)
      ? saved
      : 'PERSONNEL';
  });

  const handleSectionSwitch = (sec: DirectorySection) => {
    setActiveSection(sec);
    onSectionChange?.(sec);
    sessionStorage.setItem('police_app_dir_section', sec);
  };

  // Personnel State
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [districts, setDistricts] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);

  // Requirement 6: Pagination State (Exactly 50 per page, max 200 records / max 4 pages)
  const limit = 50;
  const maxResults = 200;
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filter selections
  const [otherDistrict, setOtherDistrict] = useState<boolean>(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [selectedRank, setSelectedRank] = useState<string>('');
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);

  // Selected contact for detail view (V4.7 single-person detail modal)
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  // Load masters on mount
  useEffect(() => {
    api.getDistricts().then((res) => setDistricts(res.districts || []));
    api.getDesignations().then((res) => setDesignations(res.designations || []));
  }, []);

  // Update stations when district changes
  useEffect(() => {
    if (selectedDistrict) {
      api.getStations(selectedDistrict).then((res) => setStations(res.stations || []));
    } else {
      setStations([]);
      setSelectedStation('');
    }
  }, [selectedDistrict]);

  // Fetch contacts with pagination
  const fetchContacts = async (pageToFetch = page) => {
    setLoading(true);
    try {
      const isOther = Boolean(
        otherDistrict ||
        (selectedDistrict && user?.districtId && selectedDistrict !== user.districtId)
      );
      const res = await api.getContacts({
        q: searchQuery,
        districtId: selectedDistrict || undefined,
        otherDistrict: isOther ? 'true' : 'false',
        stationId: selectedStation && selectedStation !== '__ALL_STATIONS__' ? selectedStation : undefined,
        designationId: selectedRank && selectedRank !== '__ALL_RANKS__' ? selectedRank : undefined,
        favorites: favoritesOnly ? 'true' : undefined,
        page: pageToFetch,
        limit,
      });
      const returnedTotal = res.total ?? res.rawTotal ?? (res.contacts?.length || 0);
      const cappedTotal = Math.min(returnedTotal, maxResults);
      setContacts(res.contacts || []);
      setTotalCount(cappedTotal);
      setTotalPages(Math.min(Math.ceil(cappedTotal / limit) || 1, 4));
    } catch {
      setContacts([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'PERSONNEL') {
      fetchContacts(page);
    }
  }, [selectedDistrict, selectedStation, selectedRank, favoritesOnly, otherDistrict, page, activeSection]);

  const handleSearchSubmit = () => {
    setPage(1);
    fetchContacts(1);
  };

  const handleToggleFavorite = async (contactId: string) => {
    try {
      const res = await api.toggleFavorite(contactId);
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId ? { ...c, isFavorite: res.isFavorite } : c
        )
      );
      if (selectedContact && selectedContact.id === contactId) {
        setSelectedContact((prev: any) => prev ? { ...prev, isFavorite: res.isFavorite } : null);
      }
    } catch (err) {
      console.error('Failed to toggle favorite', err);
    }
  };

  const hasActiveFilters =
    Boolean(selectedDistrict) ||
    Boolean(selectedStation) ||
    Boolean(selectedRank) ||
    otherDistrict ||
    favoritesOnly;

  const clearAllFilters = () => {
    setSelectedDistrict('');
    setSelectedStation('');
    setSelectedRank('');
    setOtherDistrict(false);
    setFavoritesOnly(false);
    setSearchQuery('');
    setPage(1);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 pb-24 md:pb-8">
      {/* Directory Category Segment Switcher - Polished Glassmorphism */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-white/10 mb-4 overflow-x-auto scrollbar-none shadow-xs">
        <button
          onClick={() => handleSectionSwitch('PERSONNEL')}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            activeSection === 'PERSONNEL'
              ? 'bg-white/95 dark:bg-slate-800/95 text-[#17324F] dark:text-teal-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          {language === 'hi' ? 'कार्मिक निर्देशिका' : 'Personnel'}
        </button>

        <button
          onClick={() => handleSectionSwitch('STATIONS_OFFICES')}
          className={`flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            activeSection === 'STATIONS_OFFICES'
              ? 'bg-white/95 dark:bg-slate-800/95 text-[#17324F] dark:text-teal-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Building className="h-3.5 w-3.5" />
          {language === 'hi' ? 'थाना / कार्यालय' : 'Stations & Offices'}
        </button>

        <button
          onClick={() => handleSectionSwitch('CO_ADMINS')}
          className={`flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            activeSection === 'CO_ADMINS'
              ? 'bg-white/95 dark:bg-slate-800/95 text-[#17324F] dark:text-teal-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Shield className="h-3.5 w-3.5" />
          {language === 'hi' ? 'जिला को-एडमिन' : 'Co-Admins'}
        </button>

        <button
          onClick={() => handleSectionSwitch('DIARIES')}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            activeSection === 'DIARIES'
              ? 'bg-white/95 dark:bg-slate-800/95 text-[#17324F] dark:text-teal-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          {language === 'hi' ? 'डायरी व संदर्भ' : 'Diaries & Files'}
        </button>
      </div>

      {/* Render Selected View */}
      {activeSection === 'STATIONS_OFFICES' && (
        <DirectoryStationsOffices districts={districts} />
      )}

      {/* STRICT: Co-Admin Section Isolated & Untouched */}
      {activeSection === 'CO_ADMINS' && (
        <DirectoryCoAdmins districts={districts} onStartChat={onOpenChat} />
      )}

      {activeSection === 'DIARIES' && (
        <ContactDiaries districts={districts} currentUserRole={user?.role} />
      )}

      {activeSection === 'PERSONNEL' && (
        <>
          {/* Universal Search Bar */}
          <div className="mb-3">
            <SearchBar
              value={searchQuery}
              onChange={(val) => {
                setSearchQuery(val);
                setPage(1);
              }}
              onSubmit={handleSearchSubmit}
              onClear={() => {
                setSearchQuery('');
                setPage(1);
                fetchContacts(1);
              }}
              placeholder={t('directory.searchPlaceholder')}
            />
          </div>

          {/* Filter Chips / Action Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none text-xs">
            {/* In-Place Progressive Selector: जिला चुनें → थाना/कार्यालय चुनें → पद/रैंक चुनें */}
            {!selectedDistrict ? (
              <div className="relative shrink-0">
                <select
                  value=""
                  onChange={(e) => {
                    const distId = e.target.value;
                    if (distId) {
                      setSelectedDistrict(distId);
                      setSelectedStation('');
                      setSelectedRank('');
                      setPage(1);
                    }
                  }}
                  aria-label="जिला चुनें"
                  className="h-9 pl-3.5 pr-8 rounded-full border border-teal-500/40 bg-teal-50/80 dark:bg-teal-950/40 text-[#147D84] dark:text-teal-300 font-bold text-xs shadow-xs focus:ring-2 focus:ring-[#147D84] focus:outline-none cursor-pointer appearance-none backdrop-blur-md"
                >
                  <option value="" disabled>
                    {language === 'hi' ? 'जिला चुनें' : 'Select District'}
                  </option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">
                      {d.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#147D84] dark:text-teal-300 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : !selectedStation ? (
              <div className="relative shrink-0 animate-in fade-in">
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__CHANGE_DISTRICT__') {
                      setSelectedDistrict('');
                      setSelectedStation('');
                      setSelectedRank('');
                      setPage(1);
                    } else if (val) {
                      setSelectedStation(val);
                      setSelectedRank('');
                      setPage(1);
                    }
                  }}
                  aria-label="थाना/कार्यालय चुनें"
                  className="h-9 pl-3.5 pr-8 rounded-full border border-[#17324F]/40 dark:border-blue-400/40 bg-blue-50/80 dark:bg-slate-800/80 text-[#17324F] dark:text-blue-300 font-bold text-xs shadow-xs focus:ring-2 focus:ring-[#17324F] focus:outline-none cursor-pointer appearance-none backdrop-blur-md"
                >
                  <option value="" disabled>
                    {language === 'hi' ? 'थाना/कार्यालय चुनें' : 'Select Station/Office'}
                  </option>
                  <option value="__ALL_STATIONS__" className="font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900">
                    {language === 'hi' ? '-- सभी थाने व कार्यालय --' : '-- All Stations & Offices --'}
                  </option>
                  <option value="__CHANGE_DISTRICT__" className="font-bold text-amber-600 bg-white dark:bg-slate-900">
                    {language === 'hi' ? '← दूसरा जिला चुनें' : '← Change District'}
                  </option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">
                      {s.name} ({s.type === 'POLICE_STATION' ? 'थाना' : 'कार्यालय'})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#17324F] dark:text-blue-300 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : !selectedRank ? (
              <div className="relative shrink-0 animate-in fade-in">
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__CHANGE_STATION__') {
                      setSelectedStation('');
                      setSelectedRank('');
                      setPage(1);
                    } else if (val) {
                      setSelectedRank(val);
                      setPage(1);
                    }
                  }}
                  aria-label="पद/रैंक चुनें"
                  className="h-9 pl-3.5 pr-8 rounded-full border border-purple-500/40 bg-purple-50/80 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 font-bold text-xs shadow-xs focus:ring-2 focus:ring-purple-600 focus:outline-none cursor-pointer appearance-none backdrop-blur-md"
                >
                  <option value="" disabled>
                    {language === 'hi' ? 'पद/रैंक चुनें' : 'Select Rank/Post'}
                  </option>
                  <option value="__ALL_RANKS__" className="font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900">
                    {language === 'hi' ? '-- सभी पद व रैंक --' : '-- All Ranks & Posts --'}
                  </option>
                  <option value="__CHANGE_STATION__" className="font-bold text-amber-600 bg-white dark:bg-slate-900">
                    {language === 'hi' ? '← दूसरा थाना चुनें' : '← Change Station'}
                  </option>
                  {designations.map((des) => (
                    <option key={des.id} value={des.id} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">
                      {des.shortName ? `${des.name} (${des.shortName})` : des.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-purple-700 dark:text-purple-300 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <button
                onClick={clearAllFilters}
                className="h-9 px-3.5 rounded-full border border-emerald-500/40 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold text-xs shadow-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all shrink-0 flex items-center gap-1.5 backdrop-blur-md"
                title={language === 'hi' ? 'फ़िल्टर रीसेट करें' : 'Reset Filter'}
              >
                <span>{language === 'hi' ? '✓ फ़िल्टर लागू' : '✓ Filter Active'}</span>
                <RotateCcw className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              </button>
            )}

            <button
              onClick={() => {
                setFavoritesOnly(!favoritesOnly);
                setPage(1);
              }}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all shrink-0 min-h-[36px] ${
                favoritesOnly
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : 'border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-current' : ''}`} />
              {t('directory.favorites')}
            </button>

            {selectedDistrict && (
              <Badge variant="teal" size="sm" className="shrink-0 flex items-center gap-1 rounded-full">
                <MapPin className="w-3 h-3" />
                <span>{districts.find((d) => d.id === selectedDistrict)?.name}</span>
                <button
                  onClick={() => {
                    setSelectedDistrict('');
                    setSelectedStation('');
                    setSelectedRank('');
                    setPage(1);
                  }}
                  className="ml-1 hover:text-red-500 font-bold"
                  aria-label="Remove district filter"
                >
                  ×
                </button>
              </Badge>
            )}

            {selectedStation && (
              <Badge variant="primary" size="sm" className="shrink-0 flex items-center gap-1 rounded-full">
                <Building className="w-3 h-3" />
                <span>
                  {selectedStation === '__ALL_STATIONS__'
                    ? (language === 'hi' ? 'सभी थाने' : 'All Stations')
                    : stations.find((s) => s.id === selectedStation)?.name}
                </span>
                <button
                  onClick={() => {
                    setSelectedStation('');
                    setSelectedRank('');
                    setPage(1);
                  }}
                  className="ml-1 hover:text-red-500 font-bold"
                  aria-label="Remove station filter"
                >
                  ×
                </button>
              </Badge>
            )}

            {selectedRank && (
              <Badge variant="neutral" size="sm" className="shrink-0 flex items-center gap-1 rounded-full">
                <Shield className="w-3 h-3" />
                <span>
                  {selectedRank === '__ALL_RANKS__'
                    ? (language === 'hi' ? 'सभी पद' : 'All Ranks')
                    : designations.find((des) => des.id === selectedRank)?.name}
                </span>
                <button
                  onClick={() => {
                    setSelectedRank('');
                    setPage(1);
                  }}
                  className="ml-1 hover:text-red-500 font-bold"
                  aria-label="Remove rank filter"
                >
                  ×
                </button>
              </Badge>
            )}

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0 ml-auto"
              >
                {language === 'hi' ? 'साफ़ करें' : 'Clear All'}
              </button>
            )}
          </div>

          {/* Directory Contact List - STRICT CONSTRAINT: Contact card height, width & dimensions preserved */}
          <div className="space-y-2 mt-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <div className="w-8 h-8 border-3 border-[#17324F] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-500 font-medium">
                  {language === 'hi' ? 'निर्देशिका लोड हो रही है...' : 'Loading verified directory...'}
                </p>
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-200/80 dark:border-white/10">
                <Building className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {t('directory.noResults')}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Try adjusting your search query, selecting Other District, or clearing filters.
                </p>
              </div>
            ) : (
              contacts.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  showFullDetails={false}
                  onClick={() => setSelectedContact(contact)}
                />
              ))
            )}
          </div>

          {/* Server-Side Pagination Controls - Exactly 50/page, max 200 / 4 pages (Req 6.1 & 6.2) */}
          {!loading && totalCount > 0 && (
            <div className="mt-5 pt-3 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
              <div>
                Showing{' '}
                <strong className="text-slate-900 dark:text-white">
                  {(page - 1) * limit + 1}-{Math.min(page * limit, totalCount)}
                </strong>{' '}
                of <strong className="text-slate-900 dark:text-white">{totalCount}</strong> personnel
                {totalPages > 1 && (
                  <span className="ml-1 text-slate-400">
                    (Page {page} of {totalPages})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page <= 1}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-800 transition flex items-center gap-1 shadow-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`h-7 w-7 rounded-lg text-xs font-bold transition ${
                      page === p
                        ? 'bg-[#17324F] text-white shadow-xs'
                        : 'border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 shadow-xs'
                    }`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page >= totalPages}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-800 transition flex items-center gap-1 shadow-xs"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* V4.7 Single-Person Contact Detail Modal */}
      {selectedContact && (
        <ContactDetailModal
          isOpen={Boolean(selectedContact)}
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onOpenChat={(userId: string) => {
            setSelectedContact(null);
            onOpenChat(userId);
          }}
          onToggleFavorite={handleToggleFavorite}
        />
      )}
    </div>
  );
};
