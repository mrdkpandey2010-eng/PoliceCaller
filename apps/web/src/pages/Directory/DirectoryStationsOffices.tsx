import React, { useState, useEffect } from 'react';
import { SearchBar, Button, Badge, Modal, Input } from '@police-directory/ui';
import { Building, Phone, MapPin, Filter, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '@police-directory/shared';

export interface DirectoryStationsOfficesProps {
  districts: any[];
}

export const DirectoryStationsOffices: React.FC<DirectoryStationsOfficesProps> = ({ districts }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [otherDistrict, setOtherDistrict] = useState<boolean>(false);
  const [selectedType, setSelectedType] = useState<'POLICE_STATION' | 'OFFICE' | ''>('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Station Phone Editing (Co-Admin district scope & Super Admin)
  const [editingStation, setEditingStation] = useState<any | null>(null);
  const [newStationPhone, setNewStationPhone] = useState<string>('');
  const [savingPhone, setSavingPhone] = useState<boolean>(false);

  // Requirement 8: Pagination State (Exactly 50 per page, max 200 records / max 4 pages)
  const pageSize = 50;
  const maxResults = 200;
  const maxPages = 4;
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const handleOpenEditPhone = (stn: any) => {
    setEditingStation(stn);
    setNewStationPhone(stn.phone || '');
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStation) return;
    if (!/^[0-9\-+\s()]{6,20}$/.test(newStationPhone.trim())) {
      alert('कृपया एक वैध फ़ोन नंबर दर्ज करें (6-20 अंक/मानक फ़ोन स्वरूप)। / Please enter a valid phone number.');
      return;
    }
    setSavingPhone(true);
    try {
      await api.updateStationPhone(editingStation.id, newStationPhone.trim());
      setItems((prev) =>
        prev.map((s) => (s.id === editingStation.id ? { ...s, phone: newStationPhone.trim() } : s))
      );
      setEditingStation(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update phone number');
    } finally {
      setSavingPhone(false);
    }
  };

  const fetchItems = async (pageToFetch: number = page) => {
    setLoading(true);
    try {
      const isAll = selectedDistrict === 'ALL';
      const districtParam = isAll ? undefined : (selectedDistrict || undefined);
      const isOther = isAll || Boolean(selectedDistrict && user?.districtId && selectedDistrict !== user.districtId);

      const res: any = await api.searchStationsOffices({
        q: searchQuery,
        districtId: districtParam,
        otherDistrict: isOther ? true : undefined,
        type: selectedType || undefined,
        page: pageToFetch,
        limit: pageSize,
      });

      const returnedItems = res.stationsOffices || [];
      setItems(returnedItems);

      const serverTotal = typeof res.total === 'number' ? res.total : returnedItems.length;
      const cappedTotal = Math.min(serverTotal, maxResults);
      setTotalCount(cappedTotal);

      const calculatedPages = Math.min(
        res.totalPages || Math.ceil(cappedTotal / pageSize) || 1,
        maxPages
      );
      setTotalPages(calculatedPages);
    } catch {
      setItems([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchItems(1);
  }, [selectedDistrict, selectedType]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    fetchItems(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchSubmit = () => {
    setPage(1);
    fetchItems(1);
  };

  const handleClearFilters = () => {
    setSelectedDistrict('');
    setSelectedType('');
    setSearchQuery('');
    setPage(1);
    fetchItems(1);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChange={(val) => setSearchQuery(val)}
        onSubmit={handleSearchSubmit}
        onClear={() => {
          setSearchQuery('');
          setPage(1);
          fetchItems(1);
        }}
        placeholder="Search police station or office by name, district, or phone..."
      />

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {/* District Select */}
        <select
          value={selectedDistrict}
          onChange={(e) => {
            setSelectedDistrict(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by district"
          className="h-9 px-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-[#147D84]/30"
        >
          <option value="">
            {user?.districtId
              ? `My District Only (गृह जनपद)`
              : 'All Districts (75 Districts)'}
          </option>
          <option value="ALL">All Districts (सभी 75 जनपद)</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* Unit Type Segmented Control */}
        <div className="flex items-center gap-1 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md p-1 rounded-xl border border-slate-200/80 dark:border-white/10">
          <button
            onClick={() => {
              setSelectedType('');
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              selectedType === ''
                ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Units
          </button>
          <button
            onClick={() => {
              setSelectedType('POLICE_STATION');
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              selectedType === 'POLICE_STATION'
                ? 'bg-white dark:bg-slate-900 shadow-xs text-[#147D84]'
                : 'text-slate-500 hover:text-[#147D84]'
            }`}
          >
            Police Stations
          </button>
          <button
            onClick={() => {
              setSelectedType('OFFICE');
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              selectedType === 'OFFICE'
                ? 'bg-white dark:bg-slate-900 shadow-xs text-[#17324F]'
                : 'text-slate-500 hover:text-[#17324F]'
            }`}
          >
            Offices & Units
          </button>
        </div>

        {(selectedDistrict || selectedType || searchQuery) && (
          <button
            onClick={handleClearFilters}
            className="text-xs font-semibold text-slate-400 hover:text-red-500 ml-auto transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="w-6 h-6 border-2 border-[#17324F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-white/10 p-6 shadow-xs">
            <Building className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No police stations or offices found
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Try selecting &quot;अन्य जनपद (Other District)&quot; or broadening your search keyword.
            </p>
          </div>
        ) : (
          <>
            {items.map((item) => (
              <div
                key={item.id}
                className="px-3.5 py-2.5 sm:px-4 sm:py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs hover:border-[#147D84]/40 hover:shadow-sm transition-all flex items-center justify-between gap-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {item.name}
                    </h4>
                    <Badge variant={item.type === 'POLICE_STATION' ? 'teal' : 'primary'} size="sm" className="shrink-0 text-[10px] px-1.5 py-0.2">
                      {item.type === 'POLICE_STATION' ? 'थाना' : 'कार्यालय'}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-[#147D84] shrink-0" />
                    <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">{item.districtName}</span>
                    {item.address && <span className="truncate text-slate-400">• {item.address}</span>}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.phone ? (
                    <a
                      href={`tel:${item.phone}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors shrink-0"
                      aria-label={`Call ${item.name} at ${item.phone}`}
                      title={`Call ${item.phone}`}
                    >
                      <Phone className="w-3 h-3 shrink-0" />
                      <span className="font-mono text-xs">{item.phone}</span>
                    </a>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400 italic px-2 py-1">
                      Not available
                    </span>
                  )}

                  {/* Co-Admin & Super Admin Phone Edit Action */}
                  {(user?.role === ROLES.SUPER_ADMIN ||
                    (user?.role === ROLES.DISTRICT_CO_ADMIN &&
                      String(user?.districtId || '').trim().toLowerCase() === String(item.districtId || '').trim().toLowerCase())) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditPhone(item)}
                      aria-label={`Edit contact number for ${item.name}`}
                      className="text-xs px-2 py-1 text-[#147D84] border-[#147D84]/40 hover:bg-[#147D84]/10 font-bold shrink-0"
                    >
                      <Edit2 className="w-3 h-3 mr-1 inline" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {/* Pagination Controls (Requirement 8.3 & 8.4: 50 per page, max 200, max 4 pages) */}
            {totalCount > 0 && (
              <div className="mt-5 pt-3 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
                <div>
                  Showing{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)}
                  </strong>{' '}
                  of <strong className="text-slate-900 dark:text-white">{totalCount}</strong> stations/offices
                  {totalPages > 1 && (
                    <span className="ml-1 text-slate-400">
                      (Page {page} of {totalPages})
                    </span>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handlePageChange(Math.max(page - 1, 1))}
                      disabled={page <= 1}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Prev
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => handlePageChange(p)}
                        className={`h-7 w-7 rounded-lg text-xs font-bold transition ${
                          page === p
                            ? 'bg-[#17324F] text-white shadow-xs'
                            : 'border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    ))}

                    <button
                      onClick={() => handlePageChange(Math.min(page + 1, totalPages))}
                      disabled={page >= totalPages}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1"
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Station Phone Modal */}
      <Modal
        isOpen={Boolean(editingStation)}
        onClose={() => setEditingStation(null)}
        title={`Edit Contact Number: ${editingStation?.name}`}
      >
        <form onSubmit={handleSavePhone} className="space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-slate-400 font-mono text-[10px] block uppercase">UNIT & DISTRICT</span>
            <p className="font-bold text-slate-900 dark:text-white">
              {editingStation?.name} ({editingStation?.type === 'POLICE_STATION' ? 'Police Station' : 'Office'})
            </p>
            <p className="text-slate-500 mt-0.5">District: {editingStation?.districtName}</p>
          </div>

          <Input
            label="Official Contact Number (Phone / Mobile) *"
            value={newStationPhone}
            onChange={(e) => setNewStationPhone(e.target.value)}
            placeholder="e.g. 0522-2200000 or 9454400000"
            required
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingStation(null)}
              disabled={savingPhone}
              aria-label="Cancel editing"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={savingPhone || !newStationPhone.trim()}
              aria-label="Save contact number"
              className="bg-[#17324F] font-bold"
            >
              {savingPhone ? 'Saving...' : 'Save Number'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
