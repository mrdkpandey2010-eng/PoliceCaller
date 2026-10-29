import React, { useState, useEffect } from 'react';
import { SearchBar, ContactRow, Button, Badge } from '@police-directory/ui';
import { Filter, Star, RefreshCw, X, MapPin, Building, Award } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

export interface DirectoryProps {
  onOpenChat: (userId: string) => void;
}

export const Directory: React.FC<DirectoryProps> = ({ onOpenChat }) => {
  const { language, t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [districts, setDistricts] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);

  // Filter selections
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [selectedRank, setSelectedRank] = useState<string>('');
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);
  const [showFilterSheet, setShowFilterSheet] = useState<boolean>(false);

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

  // Fetch contacts
  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await api.getContacts({
        q: searchQuery,
        districtId: selectedDistrict,
        stationId: selectedStation,
        designationId: selectedRank,
        favorites: favoritesOnly ? 'true' : undefined,
      });
      setContacts(res.contacts || []);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [selectedDistrict, selectedStation, selectedRank, favoritesOnly]);

  const handleSearchSubmit = () => {
    fetchContacts();
  };

  const handleToggleFavorite = async (contactId: string) => {
    try {
      const res = await api.toggleFavorite(contactId);
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId ? { ...c, isFavorite: res.isFavorite } : c
        )
      );
    } catch (err) {
      console.error('Failed to toggle favorite', err);
    }
  };

  const hasActiveFilters =
    Boolean(selectedDistrict) ||
    Boolean(selectedStation) ||
    Boolean(selectedRank) ||
    favoritesOnly;

  const clearAllFilters = () => {
    setSelectedDistrict('');
    setSelectedStation('');
    setSelectedRank('');
    setFavoritesOnly(false);
    setSearchQuery('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 pb-24 md:pb-8">
      {/* Universal Search Bar */}
      <div className="mb-3">
        <SearchBar
          value={searchQuery}
          onChange={(val) => setSearchQuery(val)}
          onSubmit={handleSearchSubmit}
          onClear={() => {
            setSearchQuery('');
            fetchContacts();
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
          aria-label="Toggle directory filter bottom sheet"
          icon={<Filter className="w-3.5 h-3.5" />}
          className="rounded-full shrink-0"
        >
          {language === 'hi' ? 'फ़िल्टर' : 'Filters'}
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-[#147D84] ml-1" />
          )}
        </Button>

        <button
          onClick={() => setFavoritesOnly(!favoritesOnly)}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all shrink-0 min-h-[36px] ${
            favoritesOnly
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-current' : ''}`} />
          {t('directory.favorites')}
        </button>

        {selectedDistrict && (
          <Badge variant="teal" size="sm" className="shrink-0 flex items-center gap-1 rounded-full">
            <MapPin className="w-3 h-3" />
            {districts.find((d) => d.id === selectedDistrict)?.name}
            <button
              onClick={() => setSelectedDistrict('')}
              className="ml-1 hover:text-red-500"
              aria-label="Remove district filter"
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

      {/* Cascading Filter Sheet / Drawer */}
      {showFilterSheet && (
        <div className="mb-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              {language === 'hi' ? 'विभागीय फ़िल्टर' : 'Departmental Cascading Filters'}
            </span>
            <button
              onClick={() => setShowFilterSheet(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {language === 'hi' ? 'जनपद (75 आधिकारिक)' : 'District (75 Official)'}
              </label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
              >
                <option value="">{t('directory.allDistricts')}</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {language === 'hi' ? 'थाना / कार्यालय' : 'Station / Office'}
              </label>
              <select
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                disabled={!selectedDistrict}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium disabled:opacity-50"
              >
                <option value="">{t('directory.allStations')}</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {language === 'hi' ? 'पद / रैंक' : 'Designation / Rank'}
              </label>
              <select
                value={selectedRank}
                onChange={(e) => setSelectedRank(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
              >
                <option value="">{t('directory.allRanks')}</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.shortName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Directory Contact List */}
      <div className="space-y-2 mt-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-8 h-8 border-3 border-[#17324F] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500 font-medium">
              {language === 'hi' ? 'निर्देशिका लोड हो रही है...' : 'Loading verified directory...'}
            </p>
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800">
            <Building className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {t('directory.noResults')}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your search query or cascading district filters.
            </p>
          </div>
        ) : (
          contacts.map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              onMessageClick={(id) => onOpenChat(id)}
              onToggleFavorite={handleToggleFavorite}
            />
          ))
        )}
      </div>
    </div>
  );
};
