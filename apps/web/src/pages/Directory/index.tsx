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
  const [showFilterSheet, setShowFilterSheet] = useState<boolean>(false);
  const [filterStep, setFilterStep] = useState<1 | 2 | 3>(1);

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
        stationId: selectedStation || undefined,
        designationId: selectedRank || undefined,
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
    setFilterStep(1);
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
            <Button
              variant={showFilterSheet ? 'teal' : 'outline'}
              size="sm"
              onClick={() => setShowFilterSheet(!showFilterSheet)}
              aria-label="Toggle directory filter"
              icon={<Filter className="w-3.5 h-3.5" />}
              className="rounded-full shrink-0 shadow-xs"
            >
              {language === 'hi' ? 'डायनामिक फ़िल्टर' : 'Filter'}
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-[#147D84] ml-1" />
              )}
            </Button>

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
                    setFilterStep(1);
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
                <span>{stations.find((s) => s.id === selectedStation)?.name}</span>
                <button
                  onClick={() => {
                    setSelectedStation('');
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
                <span>{designations.find((des) => des.id === selectedRank)?.name}</span>
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

          {/* Unified Dynamic Filter Box (Requirement 2) - Frosted Glass */}
          {showFilterSheet && (
            <div className="mb-4 p-4 bg-white/85 dark:bg-slate-900/85 backdrop-blur-lg rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-lg space-y-3 animate-in fade-in transition-all">
              {/* Header with Title and Reset */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#17324F] dark:text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-[#147D84]" />
                    <span>{language === 'hi' ? 'डायनामिक विभागीय फ़िल्टर' : 'Departmental Filter'}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="text-xs font-semibold text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{language === 'hi' ? 'रीसेट करें' : 'Reset'}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowFilterSheet(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
                    aria-label="Close filter"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress Breadcrumbs Bar */}
              <div className="flex items-center gap-1.5 text-xs overflow-x-auto pb-1 scrollbar-none">
                {/* Step 1 Pill */}
                <button
                  type="button"
                  onClick={() => setFilterStep(1)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition-all ${
                    filterStep === 1
                      ? 'bg-[#17324F] text-white shadow-xs'
                      : selectedDistrict
                      ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <span>1. जनपद</span>
                  {selectedDistrict && (
                    <span className="ml-1 text-[11px] font-normal truncate max-w-[90px]">
                      ({districts.find((d) => d.id === selectedDistrict)?.name || 'चयनित'})
                    </span>
                  )}
                </button>

                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

                {/* Step 2 Pill */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedDistrict) setFilterStep(2);
                  }}
                  disabled={!selectedDistrict}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition-all ${
                    filterStep === 2
                      ? 'bg-[#17324F] text-white shadow-xs'
                      : selectedStation
                      ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30'
                      : selectedDistrict
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      : 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  <span>2. थाना/कार्यालय</span>
                  {selectedStation && (
                    <span className="ml-1 text-[11px] font-normal truncate max-w-[90px]">
                      ({stations.find((s) => s.id === selectedStation)?.name || 'चयनित'})
                    </span>
                  )}
                </button>

                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

                {/* Step 3 Pill */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedDistrict) setFilterStep(3);
                  }}
                  disabled={!selectedDistrict}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition-all ${
                    filterStep === 3
                      ? 'bg-[#17324F] text-white shadow-xs'
                      : selectedRank
                      ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30'
                      : selectedDistrict
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      : 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  <span>3. पद/रैंक</span>
                  {selectedRank && (
                    <span className="ml-1 text-[11px] font-normal truncate max-w-[90px]">
                      ({designations.find((des) => des.id === selectedRank)?.name || 'चयनित'})
                    </span>
                  )}
                </button>
              </div>

              {/* Dynamic Filter Content Area */}
              <div className="pt-2">
                {/* STEP 1: District Selection */}
                {filterStep === 1 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#147D84]" />
                        <span>{language === 'hi' ? 'चरण 1: जनपद चुनें (75 आधिकारिक जनपद)' : 'Step 1: Select District'}</span>
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {language === 'hi' ? 'जनपद चुनने पर अगले चरण खुलेंगे' : 'Select district to proceed'}
                      </span>
                    </div>

                    <select
                      value={selectedDistrict}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedDistrict(val);
                        setSelectedStation('');
                        setSelectedRank('');
                        setPage(1);
                        if (val) {
                          setFilterStep(2);
                        }
                      }}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-[#147D84]/30"
                    >
                      <option value="">
                        {language === 'hi' ? '-- जनपद चुनें (Select District) --' : '-- Select District --'}
                      </option>
                      {districts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* STEP 2: Station / Office Selection */}
                {filterStep === 2 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setFilterStep(1)}
                        className="text-xs font-bold text-[#147D84] hover:text-[#17324F] dark:hover:text-teal-300 flex items-center gap-1"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>{language === 'hi' ? 'पीछे (जनपद)' : 'Back to District'}</span>
                      </button>
                      <span className="text-[11px] font-semibold text-slate-500">
                        जनपद: <strong className="text-slate-800 dark:text-slate-200">{districts.find((d) => d.id === selectedDistrict)?.name}</strong>
                      </span>
                    </div>

                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 pt-1">
                      <Building className="w-3.5 h-3.5 text-[#147D84]" />
                      <span>{language === 'hi' ? 'चरण 2: थाना या कार्यालय चुनें' : 'Step 2: Select Station / Office'}</span>
                    </label>

                    <select
                      value={selectedStation}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedStation(val);
                        setPage(1);
                        setFilterStep(3);
                      }}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-[#147D84]/30"
                    >
                      <option value="">
                        {language === 'hi' ? '-- सभी थाने व कार्यालय (All Stations/Offices) --' : '-- All Stations/Offices --'}
                      </option>
                      {stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setFilterStep(3)}
                        className="text-xs text-[#147D84] hover:underline font-semibold flex items-center gap-1"
                      >
                        <span>{language === 'hi' ? 'पद/रैंक विकल्प पर जाएँ →' : 'Proceed to Rank Selection →'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Rank / Designation Selection */}
                {filterStep === 3 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setFilterStep(2)}
                        className="text-xs font-bold text-[#147D84] hover:text-[#17324F] dark:hover:text-teal-300 flex items-center gap-1"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>{language === 'hi' ? 'पीछे (थाना/कार्यालय)' : 'Back to Station'}</span>
                      </button>
                      <span className="text-[11px] font-semibold text-slate-500 truncate max-w-[200px]">
                        {stations.find((s) => s.id === selectedStation)?.name || districts.find((d) => d.id === selectedDistrict)?.name}
                      </span>
                    </div>

                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 pt-1">
                      <Shield className="w-3.5 h-3.5 text-[#147D84]" />
                      <span>{language === 'hi' ? 'चरण 3: पद या रैंक चुनें' : 'Step 3: Select Rank / Designation'}</span>
                    </label>

                    <select
                      value={selectedRank}
                      onChange={(e) => {
                        setSelectedRank(e.target.value);
                        setPage(1);
                      }}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-[#147D84]/30"
                    >
                      <option value="">
                        {language === 'hi' ? '-- सभी पद व रैंक (All Ranks) --' : '-- All Ranks/Designations --'}
                      </option>
                      {designations.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.shortName ? `${d.name} (${d.shortName})` : d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

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
