import React, { useState, useEffect } from 'react';
import { SearchBar, Badge } from '@police-directory/ui';
import { Building, Phone, MapPin, ChevronLeft, ChevronRight, Globe, X, ExternalLink, ShieldCheck, Mail, UserCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

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

  // Requirement 8: Pagination State (Exactly 50 per page, max 200 records / max 4 pages)
  const pageSize = 50;
  const maxResults = 200;
  const maxPages = 4;
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // UP Police Official Portal Live Details Modal State
  const [liveModalOpen, setLiveModalOpen] = useState(false);
  const [activeStation, setActiveStation] = useState<any | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveData, setLiveData] = useState<any | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  const handleOpenLiveModal = async (station: any) => {
    setActiveStation(station);
    setLiveModalOpen(true);
    setLiveLoading(true);
    setLiveError(null);
    setLiveData(null);

    try {
      const res: any = await api.getLiveThanaDetails(station.id);
      if (res.success && res.liveData) {
        setLiveData(res.liveData);
      } else if (res.fallback || res.message) {
        setLiveError(res.message || 'पोर्टल से लाइव विवरण प्राप्त नहीं हो सका।');
      } else {
        setLiveError('पोर्टल से डेटा लोड करने में त्रुटि हुई।');
      }
    } catch (err: any) {
      setLiveError(err.message || 'उत्तर प्रदेश पुलिस पोर्टल अस्थायी रूप से अनुपलब्ध है।');
    } finally {
      setLiveLoading(false);
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
                  {item.type === 'POLICE_STATION' && (
                    <button
                      type="button"
                      onClick={() => handleOpenLiveModal(item)}
                      className="inline-flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded-xl bg-blue-50/90 dark:bg-blue-950/70 hover:bg-blue-100 dark:hover:bg-blue-900/80 text-[#17324F] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 text-[11px] font-semibold transition-all shadow-2xs shrink-0"
                      title="UP Police पोर्टल से लाइव विवरण देखें"
                    >
                      <Globe className="w-3 h-3 text-[#147D84] shrink-0" />
                      <span className="hidden sm:inline">लाइव स्थिति</span>
                      <span className="sm:hidden">लाइव</span>
                    </button>
                  )}
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

      {/* UP Police Official Portal Live Details Modal */}
      {liveModalOpen && activeStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                    {activeStation.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-[#147D84]" />
                  <span>जनपद: {activeStation.districtName}</span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-[#147D84] font-medium">UP Police Portal Live</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLiveModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 flex-1">
              {liveLoading ? (
                <div className="py-12 text-center space-y-3">
                  <span className="w-8 h-8 border-3 border-[#17324F] border-t-transparent rounded-full animate-spin inline-block" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    उत्तर प्रदेश पुलिस पोर्टल से लाइव विवरण लोड हो रहा है...
                  </p>
                  <p className="text-[11px] text-slate-400">
                    आधिकारिक डेटा: Know Your Police Station (uppolice.gov.in)
                  </p>
                </div>
              ) : liveError ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800 dark:text-amber-200">
                      <p className="font-bold">पोर्टल सूचना</p>
                      <p className="mt-0.5 text-[11px]">{liveError}</p>
                    </div>
                  </div>

                  {activeStation.phone && (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        डेटाबेस में सत्यापित थाना संपर्क नंबर:
                      </p>
                      <a
                        href={`tel:${activeStation.phone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span className="font-mono">{activeStation.phone}</span>
                      </a>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleOpenLiveModal(activeStation)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      पुनः प्रयास करें
                    </button>
                  </div>
                </div>
              ) : liveData ? (
                <div className="space-y-3.5">
                  {/* Station Incharge (SHO/SO) Card */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#147D84]" />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          प्रभारी निरीक्षक / थानाध्यक्ष (SHO / SO)
                        </h4>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                        {liveData.shoDesignation || 'SHO'}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {liveData.shoName || 'नाम पोर्टल पर उपलब्ध नहीं'}
                        </span>
                      </div>

                      <div className="flex items-center flex-wrap gap-2 pt-1">
                        {liveData.shoCug && (
                          <a
                            href={`tel:${liveData.shoCug}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
                            title="SHO CUG पर कॉल करें"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span className="font-mono">{liveData.shoCug}</span>
                            <span className="text-[10px] font-normal opacity-90">(CUG)</span>
                          </a>
                        )}

                        {liveData.landline && liveData.landline !== '-' && (
                          <a
                            href={`tel:${liveData.landline}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                            title="लैंडलाइन / अन्य नंबर"
                          >
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span className="font-mono">{liveData.landline}</span>
                          </a>
                        )}
                      </div>

                      {liveData.shoEmail && (
                        <div className="pt-1">
                          <a
                            href={`mailto:${liveData.shoEmail}`}
                            className="inline-flex items-center gap-1 text-[11px] text-[#147D84] hover:underline"
                          >
                            <Mail className="w-3 h-3" />
                            <span className="font-mono">{liveData.shoEmail}</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Circle Officer (CO / ACP) Card */}
                  {(liveData.coName || liveData.coCug || liveData.circleName) && (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-[#17324F] dark:text-blue-400" />
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                            क्षेत्राधिकारी / सहायक पुलिस आयुक्त (CO / ACP)
                          </h4>
                        </div>
                        {liveData.circleName && (
                          <span className="text-[10px] text-slate-500 font-medium truncate max-w-[150px]">
                            {liveData.circleName}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {liveData.coName || 'नाम पोर्टल पर उपलब्ध नहीं'}
                        </p>

                        <div className="flex items-center flex-wrap gap-2 pt-1">
                          {liveData.coCug && (
                            <a
                              href={`tel:${liveData.coCug}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition"
                              title="CO/ACP CUG पर कॉल करें"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span className="font-mono">{liveData.coCug}</span>
                              <span className="text-[10px] font-normal opacity-90">(CO CUG)</span>
                            </a>
                          )}

                          {liveData.coEmail && (
                            <a
                              href={`mailto:${liveData.coEmail}`}
                              className="inline-flex items-center gap-1 text-[11px] text-[#147D84] hover:underline"
                            >
                              <Mail className="w-3 h-3" />
                              <span className="font-mono">{liveData.coEmail}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Jurisdiction Area */}
                  {liveData.jurisdiction && (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          थाना क्षेत्राधिकार (Jurisdiction)
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap">
                        {liveData.jurisdiction}
                      </p>
                    </div>
                  )}

                  {/* Footer note */}
                  <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      स्रोत: uppolice.gov.in
                    </span>
                    <a
                      href="https://uppolice.gov.in"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-[#147D84] hover:underline"
                    >
                      <span>पोर्टल खोलें</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/40 flex justify-end">
              <button
                type="button"
                onClick={() => setLiveModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#17324F] text-white text-xs font-bold hover:bg-[#1f4063] transition shadow-xs"
              >
                बंद करें (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
