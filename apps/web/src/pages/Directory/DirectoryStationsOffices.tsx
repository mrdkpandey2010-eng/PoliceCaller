import React, { useState, useEffect } from 'react';
import { SearchBar, Button, Badge } from '@police-directory/ui';
import { Building, Phone, MapPin, Filter, X } from 'lucide-react';
import { api } from '../../services/api';

export interface DirectoryStationsOfficesProps {
  districts: any[];
}

export const DirectoryStationsOffices: React.FC<DirectoryStationsOfficesProps> = ({ districts }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedType, setSelectedType] = useState<'POLICE_STATION' | 'OFFICE' | ''>('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.searchStationsOffices({
        q: searchQuery,
        districtId: selectedDistrict || undefined,
        type: selectedType || undefined,
      });
      setItems(res.stationsOffices || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [selectedDistrict, selectedType]);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChange={(val) => setSearchQuery(val)}
        onSubmit={fetchItems}
        onClear={() => {
          setSearchQuery('');
          fetchItems();
        }}
        placeholder="Search police station or office by name, district, or phone..."
      />

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          value={selectedDistrict}
          onChange={(e) => setSelectedDistrict(e.target.value)}
          aria-label="Filter by district"
          className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
        >
          <option value="">All Districts (75 Districts)</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setSelectedType('')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              selectedType === '' ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-500'
            }`}
          >
            All Units
          </button>
          <button
            onClick={() => setSelectedType('POLICE_STATION')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              selectedType === 'POLICE_STATION' ? 'bg-white dark:bg-slate-900 shadow-xs text-[#147D84]' : 'text-slate-500'
            }`}
          >
            Police Stations
          </button>
          <button
            onClick={() => setSelectedType('OFFICE')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              selectedType === 'OFFICE' ? 'bg-white dark:bg-slate-900 shadow-xs text-[#17324F]' : 'text-slate-500'
            }`}
          >
            Offices & Units
          </button>
        </div>

        {(selectedDistrict || selectedType || searchQuery) && (
          <button
            onClick={() => {
              setSelectedDistrict('');
              setSelectedType('');
              setSearchQuery('');
              fetchItems();
            }}
            className="text-xs font-semibold text-slate-400 hover:text-red-500 ml-auto"
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
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6">
            <Building className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No police stations or offices found</p>
            <p className="text-xs text-slate-400 mt-1">Try selecting another district or broadening your search keyword.</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {item.name}
                  </h4>
                  <Badge variant={item.type === 'POLICE_STATION' ? 'teal' : 'primary'} size="sm">
                    {item.type === 'POLICE_STATION' ? 'Police Station' : item.type.replace('_', ' ')}
                  </Badge>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#147D84]" />
                  <span>District: <strong className="text-slate-700 dark:text-slate-300">{item.districtName}</strong></span>
                  {item.address && <span className="truncate ml-1">• {item.address}</span>}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {item.phone ? (
                  <a
                    href={`tel:${item.phone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span className="font-mono">{item.phone}</span>
                  </a>
                ) : (
                  <span className="text-xs font-medium text-slate-400 italic">
                    Not available
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
