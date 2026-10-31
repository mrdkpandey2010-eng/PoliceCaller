import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Phone, MessageSquare, Copy, Check, Shield, Search, MapPin, Building, AlertCircle } from 'lucide-react';

interface CoAdmin {
  id: string;
  pno: string;
  fullName: string;
  mobile: string;
  email?: string;
  districtId: string;
  districtName: string;
  designationName?: string;
  designationShort?: string;
  stationOfficeName?: string;
}

interface District {
  id: string;
  name: string;
}

interface DirectoryCoAdminsProps {
  districts: District[];
  onStartChat?: (userId: string) => void;
}

export const DirectoryCoAdmins: React.FC<DirectoryCoAdminsProps> = ({ districts, onStartChat }) => {
  const [coAdmins, setCoAdmins] = useState<CoAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [copiedPno, setCopiedPno] = useState<string | null>(null);

  const fetchCoAdmins = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.searchCoAdmins({
        q: searchQuery.trim() || undefined,
        districtId: selectedDistrict || undefined,
      });
      if (res.success && res.coAdmins) {
        setCoAdmins(res.coAdmins);
      } else {
        setCoAdmins([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load District Co-Admins.');
      setCoAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoAdmins();
  }, [selectedDistrict]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCoAdmins();
  };

  const handleCopyNumber = (num: string, pno: string) => {
    if (!num) return;
    navigator.clipboard.writeText(num);
    setCopiedPno(pno);
    setTimeout(() => setCopiedPno(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Search and District Filter Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Co-Admins by name, PNO, phone, district..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 dark:bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-teal-700 transition"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
            Filter District:
          </label>
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="w-full py-1.5 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white"
          >
            <option value="">All Districts ({districts.length})</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status Indicators */}
      {loading && (
        <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400 animate-pulse">
          Searching District Co-Admins...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && coAdmins.length === 0 && (
        <div className="py-10 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-500">
          <Shield className="h-8 w-8 mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-medium">No District Co-Admins found</p>
          <p className="text-xs text-slate-400 mt-1">Try selecting a different district or adjusting search criteria</p>
        </div>
      )}

      {/* Co-Admin Cards: Max 8 by default, strictly selected district when filtered */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(selectedDistrict ? coAdmins.filter((a) => a.districtId === selectedDistrict) : coAdmins.slice(0, 8)).map((admin) => (
          <div
            key={admin.id}
            className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-base">
                    {admin.fullName}
                  </h4>
                  <p className="text-xs text-teal-700 dark:text-teal-400 font-medium mt-0.5">
                    {admin.designationName || 'District Co-Admin'}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300">
                  <Shield className="h-3 w-3" />
                  CO-ADMIN
                </span>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>District: <strong className="text-slate-800 dark:text-slate-100">{admin.districtName}</strong></span>
                </div>
                {admin.stationOfficeName && (
                  <div className="flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>Station/Office: {admin.stationOfficeName}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-mono text-[11px]">PNO:</span>
                  <span className="font-mono">{admin.pno}</span>
                </div>
              </div>
            </div>

            {/* Contact Actions */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {admin.mobile ? (
                  <>
                    <span className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                      {admin.mobile}
                    </span>
                    <button
                      onClick={() => handleCopyNumber(admin.mobile, admin.pno)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                      title="Copy Mobile"
                      aria-label="Copy Mobile Number"
                    >
                      {copiedPno === admin.pno ? (
                        <Check className="h-3.5 w-3.5 text-teal-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-slate-400 italic">Not available</span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {admin.mobile && (
                  <a
                    href={`tel:${admin.mobile}`}
                    className="p-2 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 rounded-lg transition"
                    title={`Call ${admin.fullName}`}
                    aria-label={`Call ${admin.fullName} on phone dialer`}
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                )}
                {onStartChat && (
                  <button
                    onClick={() => onStartChat(admin.id)}
                    className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition"
                    title={`Message ${admin.fullName}`}
                    aria-label={`Start chat with ${admin.fullName}`}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
