import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Input, Modal } from '@police-directory/ui';
import {
  MapPin,
  Building2,
  Briefcase,
  Award,
  Plus,
  AlignLeft,
  FileSpreadsheet,
  RotateCcw,
  Search,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Trash2,
  Edit2,
  Download,
  Filter,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../../../services/api';

type MasterTab = 'districts' | 'stations' | 'offices' | 'designations';

export const MasterDataManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MasterTab>('districts');
  const [districts, setDistricts] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');

  // Modals state
  const [addOneModalOpen, setAddOneModalOpen] = useState(false);
  const [bulkPasteModalOpen, setBulkPasteModalOpen] = useState(false);
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Single Item Form State
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formZone, setFormZone] = useState('');
  const [formRange, setFormRange] = useState('');
  const [formDistrictId, setFormDistrictId] = useState('');
  const [formType, setFormType] = useState('POLICE_STATION');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formShortName, setFormShortName] = useState('');
  const [formRankOrder, setFormRankOrder] = useState<number>(99);
  const [formSaving, setFormSaving] = useState(false);

  // Bulk Paste State
  const [bulkDistrictId, setBulkDistrictId] = useState('');
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any | null>(null);
  const [commitLoading, setCommitLoading] = useState(false);

  // Excel/CSV State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelParsing, setExcelParsing] = useState(false);
  const [excelRows, setExcelRows] = useState<any[]>([]);
  const [excelDryRunResult, setExcelDryRunResult] = useState<any | null>(null);
  const [excelCommitLoading, setExcelCommitLoading] = useState(false);

  // Rollback / History State
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  // Load Reference Districts
  const loadDistricts = async () => {
    try {
      const res = await api.getDistricts({ all: true });
      setDistricts(res.districts || []);
      if (!bulkDistrictId && res.districts?.length > 0) {
        setBulkDistrictId(res.districts[0].id);
      }
    } catch (err) {
      console.error('Failed to load districts', err);
    }
  };

  const loadTabData = async (tab: MasterTab = activeTab) => {
    setLoading(true);
    try {
      if (tab === 'districts') {
        const res = await api.getDistricts({ all: true });
        setDistricts(res.districts || []);
      } else if (tab === 'stations') {
        const res = await api.getStations({ all: true, type: 'POLICE_STATION', districtId: districtFilter || undefined });
        setStations(res.stations || []);
      } else if (tab === 'offices') {
        const res = await api.getStations({ all: true, type: 'OFFICE', districtId: districtFilter || undefined });
        setOffices(res.stations || []);
      } else if (tab === 'designations') {
        const res = await api.getDesignations({ all: true });
        setDesignations(res.designations || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDistricts();
  }, []);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, districtFilter]);

  // Toggle Active/Inactive
  const handleToggleActive = async (id: string) => {
    try {
      if (activeTab === 'districts') {
        await api.toggleDistrictActive(id);
      } else if (activeTab === 'stations' || activeTab === 'offices') {
        await api.toggleStationActive(id);
      } else if (activeTab === 'designations') {
        await api.toggleDesignationActive(id);
      }
      loadTabData(activeTab);
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  // Safe Delete
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? If personnel or records reference this entity, deletion will be blocked.`)) {
      return;
    }
    try {
      if (activeTab === 'districts') {
        await api.deleteDistrict(id);
      } else if (activeTab === 'stations' || activeTab === 'offices') {
        await api.deleteStation(id);
      } else if (activeTab === 'designations') {
        await api.deleteDesignation(id);
      }
      alert(`"${name}" was successfully deleted.`);
      loadTabData(activeTab);
    } catch (err: any) {
      alert(err.message || 'Cannot delete record.');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setFormName(item.name || '');
    setFormCode(item.code || '');
    setFormZone(item.zone || '');
    setFormRange(item.range || '');
    setFormDistrictId(item.districtId || '');
    setFormType(item.type || 'POLICE_STATION');
    setFormPhone(item.phone || '');
    setFormAddress(item.address || '');
    setFormShortName(item.shortName || '');
    setFormRankOrder(item.rankOrder || 99);
    setAddOneModalOpen(true);
  };

  const handleOpenAddOne = () => {
    setEditingItem(null);
    setFormName('');
    setFormCode('');
    setFormZone('');
    setFormRange('');
    setFormDistrictId(bulkDistrictId || districts[0]?.id || '');
    setFormType(activeTab === 'offices' ? 'SP_OFFICE' : 'POLICE_STATION');
    setFormPhone('');
    setFormAddress('');
    setFormShortName('');
    setFormRankOrder(99);
    setAddOneModalOpen(true);
  };

  // Save Single Form (Add or Edit)
  const handleSaveSingle = async () => {
    if (!formName.trim()) {
      alert('Name is required.');
      return;
    }
    setFormSaving(true);
    try {
      if (activeTab === 'districts') {
        if (editingItem) {
          await api.updateDistrict(editingItem.id, {
            name: formName.trim(),
            code: formCode.trim().toUpperCase(),
            zone: formZone.trim() || undefined,
            range: formRange.trim() || undefined,
          });
        } else {
          await api.createDistrict({
            name: formName.trim(),
            code: (formCode || formName.slice(0, 4)).trim().toUpperCase(),
            zone: formZone.trim() || undefined,
            range: formRange.trim() || undefined,
          });
        }
      } else if (activeTab === 'stations' || activeTab === 'offices') {
        if (editingItem) {
          await api.updateStation(editingItem.id, {
            name: formName.trim(),
            type: formType,
            address: formAddress.trim() || undefined,
            phone: formPhone.trim() || undefined,
          });
        } else {
          if (!formDistrictId) {
            alert('Please select a parent district.');
            setFormSaving(false);
            return;
          }
          await api.createStation({
            districtId: formDistrictId,
            name: formName.trim(),
            type: formType,
            address: formAddress.trim() || undefined,
            phone: formPhone.trim() || undefined,
          });
        }
      } else if (activeTab === 'designations') {
        if (editingItem) {
          await api.updateDesignation(editingItem.id, {
            name: formName.trim(),
            code: formCode.trim().toUpperCase(),
            shortName: (formShortName || formName.slice(0, 10)).trim(),
            rankOrder: Number(formRankOrder) || 99,
          });
        } else {
          await api.createDesignation({
            name: formName.trim(),
            code: (formCode || formName.slice(0, 6)).trim().toUpperCase(),
            shortName: (formShortName || formName.slice(0, 10)).trim(),
            rankOrder: Number(formRankOrder) || 99,
          });
        }
      }

      setAddOneModalOpen(false);
      loadTabData(activeTab);
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    } finally {
      setFormSaving(false);
    }
  };

  // Bulk Paste: Dry Run
  const handleBulkPasteDryRun = async () => {
    if (!bulkPasteText.trim()) {
      alert('Please paste at least one line of text.');
      return;
    }
    if ((activeTab === 'stations' || activeTab === 'offices') && !bulkDistrictId) {
      alert('Please select a parent district first.');
      return;
    }

    setDryRunLoading(true);
    setDryRunResult(null);
    try {
      const res = await api.masterBulkDryRun({
        entityType: activeTab === 'districts' ? 'DISTRICT' : activeTab === 'stations' ? 'POLICE_STATION' : activeTab === 'offices' ? 'OFFICE' : 'DESIGNATION',
        districtId: bulkDistrictId || undefined,
        rawLines: bulkPasteText,
        skipExisting: true,
      });
      setDryRunResult(res);
    } catch (err: any) {
      alert(err.message || 'Dry-run failed');
    } finally {
      setDryRunLoading(false);
    }
  };

  // Bulk Paste: Commit Valid Rows
  const handleBulkPasteCommit = async () => {
    if (!dryRunResult || !dryRunResult.previewRows) return;
    const validRows = dryRunResult.previewRows.filter((r: any) => r.status === 'VALID');
    if (validRows.length === 0) {
      alert('No valid rows available to commit.');
      return;
    }

    setCommitLoading(true);
    try {
      const res = await api.masterBulkCommit({
        entityType: activeTab === 'districts' ? 'DISTRICT' : activeTab === 'stations' ? 'POLICE_STATION' : activeTab === 'offices' ? 'OFFICE' : 'DESIGNATION',
        districtId: bulkDistrictId || undefined,
        rows: validRows,
        fileName: `Pasted Batch (${validRows.length} items)`,
      });

      alert(res.message || `Successfully committed ${res.createdCount} record(s).`);
      setBulkPasteModalOpen(false);
      setBulkPasteText('');
      setDryRunResult(null);
      loadTabData(activeTab);
    } catch (err: any) {
      alert(err.message || 'Commit failed');
    } finally {
      setCommitLoading(false);
    }
  };

  // Excel/CSV: File selection & parse
  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFile(file);
    setExcelParsing(true);
    setExcelDryRunResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', raw: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const rawJson = XLSX.utils.sheet_to_json<any>(sheet, { raw: false });
      if (!rawJson || rawJson.length === 0) {
        throw new Error('Spreadsheet has no data rows.');
      }

      setExcelRows(rawJson);

      // Trigger automatic dry-run
      const res = await api.masterBulkDryRun({
        entityType: activeTab === 'districts' ? 'DISTRICT' : activeTab === 'stations' ? 'POLICE_STATION' : activeTab === 'offices' ? 'OFFICE' : 'DESIGNATION',
        districtId: bulkDistrictId || undefined,
        rows: rawJson,
        skipExisting: true,
      });

      setExcelDryRunResult(res);
    } catch (err: any) {
      alert(err.message || 'Failed to parse file');
      setExcelFile(null);
    } finally {
      setExcelParsing(false);
    }
  };

  // Excel/CSV: Commit
  const handleExcelCommit = async () => {
    if (!excelDryRunResult?.previewRows) return;
    const validRows = excelDryRunResult.previewRows.filter((r: any) => r.status === 'VALID');
    if (validRows.length === 0) {
      alert('No valid rows to commit.');
      return;
    }

    setExcelCommitLoading(true);
    try {
      const res = await api.masterBulkCommit({
        entityType: activeTab === 'districts' ? 'DISTRICT' : activeTab === 'stations' ? 'POLICE_STATION' : activeTab === 'offices' ? 'OFFICE' : 'DESIGNATION',
        districtId: bulkDistrictId || undefined,
        rows: validRows,
        fileName: excelFile?.name || 'Excel Bulk Import',
      });

      alert(res.message || 'Successfully committed spreadsheet rows.');
      setExcelModalOpen(false);
      setExcelFile(null);
      setExcelRows([]);
      setExcelDryRunResult(null);
      loadTabData(activeTab);
    } catch (err: any) {
      alert(err.message || 'Commit failed');
    } finally {
      setExcelCommitLoading(false);
    }
  };

  // Download Template
  const handleDownloadTemplate = () => {
    let headers: string[][] = [];
    let filename = '';

    if (activeTab === 'districts') {
      headers = [
        ['District Name', 'Code', 'Zone', 'Range'],
        ['Varanasi', 'VNS', 'Varanasi Zone', 'Varanasi Range'],
        ['Kanpur Nagar', 'KPN', 'Kanpur Zone', 'Kanpur Range'],
        ['Prayagraj', 'PRY', 'Prayagraj Zone', 'Prayagraj Range'],
      ];
      filename = 'Districts_Master_Template.xlsx';
    } else if (activeTab === 'stations') {
      headers = [
        ['District Name or ID', 'Police Station Name', 'Code', 'Phone', 'Address'],
        ['Lucknow', 'PS Hazratganj', 'HZG', '05222238491', 'Hazratganj, Lucknow'],
        ['Lucknow', 'PS Gomti Nagar', 'GMN', '05222728192', 'Gomti Nagar, Lucknow'],
        ['Varanasi', 'PS Cantt', 'CNT', '05422501234', 'Cantt, Varanasi'],
      ];
      filename = 'Police_Stations_Template.xlsx';
    } else if (activeTab === 'offices') {
      headers = [
        ['District Name or ID', 'Office Name', 'Office Type', 'Phone', 'Address'],
        ['Lucknow', 'SP City Office Lucknow', 'SP_OFFICE', '05222200100', 'Police Line, Lucknow'],
        ['Lucknow', 'Reserve Police Line', 'LINE', '05222200101', 'Mahanagar, Lucknow'],
        ['Lucknow', 'Hazratganj Circle Office', 'CIRCLE_OFFICE', '05222238492', 'Hazratganj, Lucknow'],
      ];
      filename = 'Offices_Units_Template.xlsx';
    } else if (activeTab === 'designations') {
      headers = [
        ['Designation Name', 'Short Name', 'Rank Order', 'Code'],
        ['Inspector General of Police', 'IG', '3', 'IG'],
        ['Deputy Inspector General of Police', 'DIG', '4', 'DIG'],
        ['Inspector of Police', 'Inspector', '9', 'INSP'],
        ['Sub-Inspector of Police', 'SI', '10', 'SI'],
      ];
      filename = 'Designations_Template.xlsx';
    }

    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, filename);
  };

  // Open History / Rollback
  const handleOpenHistory = async () => {
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const res = await api.getMasterImportHistory();
      setHistoryList(res.history || []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRollbackJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to rollback this import? Unreferenced records will be safely deleted.')) {
      return;
    }
    setRollingBackId(jobId);
    try {
      const res = await api.masterBulkRollback(jobId);
      alert(res.message || 'Rollback completed.');
      const hist = await api.getMasterImportHistory();
      setHistoryList(hist.history || []);
      loadTabData(activeTab);
    } catch (err: any) {
      alert(err.message || 'Rollback failed.');
    } finally {
      setRollingBackId(null);
    }
  };

  // Current Tab items and filtering
  const getCurrentItems = () => {
    let list: any[] = [];
    if (activeTab === 'districts') list = districts;
    else if (activeTab === 'stations') list = stations;
    else if (activeTab === 'offices') list = offices;
    else if (activeTab === 'designations') list = designations;

    return list.filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.name?.toLowerCase().includes(q) ||
        item.code?.toLowerCase().includes(q) ||
        item.districtName?.toLowerCase().includes(q) ||
        item.shortName?.toLowerCase().includes(q)
      );
    });
  };

  const currentItems = getCurrentItems();

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#147D84]" />
            Master Data Administration (राज्यव्यापी मास्टर डेटा नियंत्रण)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Super Admin Exclusive: Districts, Police Stations (Thana), Offices/Units & Designations. Populates registration and directory filters.
          </p>
        </div>

        {/* Global Master Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            aria-label="Download template"
            className="text-xs font-semibold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenHistory}
            aria-label="View import rollback history"
            className="text-xs font-semibold flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            Rollback History
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setExcelFile(null);
              setExcelRows([]);
              setExcelDryRunResult(null);
              setExcelModalOpen(true);
            }}
            aria-label="Excel CSV bulk import"
            className="text-xs font-semibold flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Excel / CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBulkPasteText('');
              setDryRunResult(null);
              setBulkPasteModalOpen(true);
            }}
            aria-label="Add multiple by pasting lines"
            className="text-xs font-semibold flex items-center gap-1.5"
          >
            <AlignLeft className="w-3.5 h-3.5 text-[#147D84]" />
            Paste Multiple
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddOne}
            aria-label="Add single master record"
            className="bg-[#17324F] text-xs font-bold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add One
          </Button>
        </div>
      </div>

      {/* 4 Dedicated Master Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          onClick={() => setActiveTab('districts')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            activeTab === 'districts'
              ? 'bg-[#17324F] text-white border-[#17324F] shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <MapPin className="w-4 h-4 opacity-80" />
            <span className="text-[11px] font-mono font-bold opacity-75">{districts.length}</span>
          </div>
          <div className="text-xs font-black">Districts (जिले)</div>
          <p className="text-[10px] opacity-75 truncate">75 UP Revenue Districts</p>
        </button>

        <button
          onClick={() => setActiveTab('stations')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            activeTab === 'stations'
              ? 'bg-[#17324F] text-white border-[#17324F] shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <Building2 className="w-4 h-4 opacity-80" />
            <span className="text-[11px] font-mono font-bold opacity-75">{stations.length}</span>
          </div>
          <div className="text-xs font-black">Police Stations (थाने)</div>
          <p className="text-[10px] opacity-75 truncate">Operational Thanas</p>
        </button>

        <button
          onClick={() => setActiveTab('offices')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            activeTab === 'offices'
              ? 'bg-[#17324F] text-white border-[#17324F] shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <Briefcase className="w-4 h-4 opacity-80" />
            <span className="text-[11px] font-mono font-bold opacity-75">{offices.length}</span>
          </div>
          <div className="text-xs font-black">Offices / Units (कार्यालय)</div>
          <p className="text-[10px] opacity-75 truncate">SP Offices, Lines, Circles</p>
        </button>

        <button
          onClick={() => setActiveTab('designations')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            activeTab === 'designations'
              ? 'bg-[#17324F] text-white border-[#17324F] shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <Award className="w-4 h-4 opacity-80" />
            <span className="text-[11px] font-mono font-bold opacity-75">{designations.length}</span>
          </div>
          <div className="text-xs font-black">Designations (पद/रैंक)</div>
          <p className="text-[10px] opacity-75 truncate">Hierarchy & Rank Order</p>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {/* District Filter for Stations and Offices */}
          {(activeTab === 'stations' || activeTab === 'offices') && (
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#147D84]"
              >
                <option value="">All Districts (Statewide)</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <span className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-900 dark:text-white font-mono">{currentItems.length}</strong> record(s)
          </span>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#147D84]"
          />
        </div>
      </div>

      {/* Table Data View */}
      {loading ? (
        <Card className="p-8 text-center text-slate-400 text-xs">Loading master records...</Card>
      ) : currentItems.length === 0 ? (
        <Card className="p-8 text-center text-slate-400 text-xs space-y-2">
          <p className="font-semibold text-slate-600 dark:text-slate-300">No master records found.</p>
          <p className="text-[11px] text-slate-400">
            Use <strong>"Add One"</strong>, <strong>"Paste Multiple"</strong>, or <strong>"Excel / CSV"</strong> above to populate.
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold text-slate-500 uppercase">
              <tr>
                <th className="p-3">Code / ID</th>
                <th className="p-3">Canonical English Name</th>
                {activeTab === 'districts' && <th className="p-3">Zone & Range</th>}
                {(activeTab === 'stations' || activeTab === 'offices') && (
                  <>
                    <th className="p-3">District</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Contact</th>
                  </>
                )}
                {activeTab === 'designations' && (
                  <>
                    <th className="p-3">Short Name</th>
                    <th className="p-3">Rank Order</th>
                  </>
                )}
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {currentItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                    {item.code || item.id}
                  </td>
                  <td className="p-3 font-semibold text-slate-900 dark:text-white">
                    {item.name}
                  </td>
                  {activeTab === 'districts' && (
                    <td className="p-3 text-slate-500">
                      {item.zone ? `${item.zone} Zone` : '—'} {item.range ? `• ${item.range} Range` : ''}
                    </td>
                  )}
                  {(activeTab === 'stations' || activeTab === 'offices') && (
                    <>
                      <td className="p-3">
                        <Badge variant="teal" size="sm">
                          {item.districtName}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="neutral" size="sm">
                          {item.type}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-slate-500">
                        {item.phone || '—'}
                      </td>
                    </>
                  )}
                  {activeTab === 'designations' && (
                    <>
                      <td className="p-3 font-semibold text-[#147D84]">
                        {item.shortName}
                      </td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                        Rank #{item.rankOrder}
                      </td>
                    </>
                  )}
                  <td className="p-3">
                    <Badge variant={item.isActive === 1 || item.isActive ? 'success' : 'neutral'} size="sm">
                      {item.isActive === 1 || item.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="p-3 text-right space-x-1 whitespace-nowrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(item)}
                      aria-label={`Edit ${item.name}`}
                      className="text-[11px] px-2 py-1"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant={item.isActive === 1 || item.isActive ? 'danger' : 'primary'}
                      size="sm"
                      onClick={() => handleToggleActive(item.id)}
                      aria-label={`Toggle active for ${item.name}`}
                      className="text-[11px] px-2 py-1 font-medium"
                    >
                      {item.isActive === 1 || item.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item.id, item.name)}
                      aria-label={`Delete ${item.name}`}
                      className="text-[11px] px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* MODAL 1: ADD ONE / EDIT MODAL                                    */}
      {/* ---------------------------------------------------------------- */}
      <Modal
        isOpen={addOneModalOpen}
        onClose={() => setAddOneModalOpen(false)}
        title={editingItem ? `Edit ${editingItem.name}` : `Add New ${activeTab === 'districts' ? 'District' : activeTab === 'stations' ? 'Police Station' : activeTab === 'offices' ? 'Office/Unit' : 'Designation'}`}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="ghost" onClick={() => setAddOneModalOpen(false)} disabled={formSaving} aria-label="Cancel">
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveSingle} disabled={formSaving || !formName.trim()} aria-label="Save" className="bg-[#17324F] font-bold">
              {formSaving ? 'Saving...' : 'Save Record'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-900 dark:text-blue-200">
            <strong>English Canonical Rule:</strong> Names must be entered in English/ASCII letters.
          </div>

          {(activeTab === 'stations' || activeTab === 'offices') && !editingItem && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Parent District *
              </label>
              <select
                value={formDistrictId}
                onChange={(e) => setFormDistrictId(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#147D84]"
              >
                <option value="">Select District...</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Input
              label="Canonical English Name *"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={activeTab === 'districts' ? 'e.g. Varanasi' : activeTab === 'stations' ? 'e.g. PS Hazratganj' : activeTab === 'offices' ? 'e.g. SP City Office' : 'e.g. Inspector of Police'}
              englishOnlyNotice
              required
            />
          </div>

          {activeTab !== 'stations' && activeTab !== 'offices' && (
            <div>
              <Input
                label="Official Code (Optional)"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                placeholder="e.g. VNS, INSP"
              />
            </div>
          )}

          {activeTab === 'districts' && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Zone (Optional)"
                value={formZone}
                onChange={(e) => setFormZone(e.target.value)}
                placeholder="e.g. Varanasi Zone"
              />
              <Input
                label="Range (Optional)"
                value={formRange}
                onChange={(e) => setFormRange(e.target.value)}
                placeholder="e.g. Varanasi Range"
              />
            </div>
          )}

          {(activeTab === 'stations' || activeTab === 'offices') && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Entity Classification Type
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#147D84]"
                >
                  <option value="POLICE_STATION">Police Station (थाना)</option>
                  <option value="SP_OFFICE">SP / SSP / Commissionerate Office</option>
                  <option value="CIRCLE_OFFICE">Circle Office (CO / DSP)</option>
                  <option value="LINE">Reserve Police Line</option>
                  <option value="TRAFFIC">Traffic Unit / Thana</option>
                  <option value="OTHER">Other Departmental Unit</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Official Landline / Phone"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="0522-2238491"
                />
                <Input
                  label="Office Address"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="e.g. Hazratganj, Lucknow"
                />
              </div>
            </>
          )}

          {activeTab === 'designations' && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Short Name / Abbr *"
                value={formShortName}
                onChange={(e) => setFormShortName(e.target.value)}
                placeholder="e.g. Inspector, DSP, SI"
                required
              />
              <Input
                label="Rank Order (1=DGP, 13=Constable) *"
                type="number"
                value={String(formRankOrder)}
                onChange={(e) => setFormRankOrder(Number(e.target.value) || 99)}
                required
              />
            </div>
          )}
        </div>
      </Modal>

      {/* ---------------------------------------------------------------- */}
      {/* MODAL 2: BULK PASTE MODAL (10, 50, 100+ LINES AT ONCE)          */}
      {/* ---------------------------------------------------------------- */}
      <Modal
        isOpen={bulkPasteModalOpen}
        onClose={() => setBulkPasteModalOpen(false)}
        title={`Paste Multiple ${activeTab === 'districts' ? 'Districts' : activeTab === 'stations' ? 'Police Stations' : activeTab === 'offices' ? 'Offices' : 'Designations'}`}
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              onClick={() => {
                setBulkPasteText('');
                setDryRunResult(null);
              }}
              disabled={dryRunLoading || commitLoading}
              aria-label="Clear paste"
            >
              Clear
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setBulkPasteModalOpen(false)}
                disabled={dryRunLoading || commitLoading}
                aria-label="Cancel"
              >
                Cancel
              </Button>
              {!dryRunResult ? (
                <Button
                  variant="primary"
                  onClick={handleBulkPasteDryRun}
                  disabled={dryRunLoading || !bulkPasteText.trim()}
                  aria-label="Preview Dry Run"
                  className="bg-[#17324F] font-bold"
                >
                  {dryRunLoading ? 'Validating...' : 'Dry Run Preview'}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleBulkPasteCommit}
                  disabled={commitLoading || dryRunResult.summary.validCount === 0}
                  aria-label="Save Valid Rows"
                  className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                >
                  {commitLoading ? 'Saving...' : `Save ${dryRunResult.summary.validCount} Valid Records`}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Parent District Selector for Stations and Offices */}
          {(activeTab === 'stations' || activeTab === 'offices') && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Target Parent District for this Batch *
              </label>
              <select
                value={bulkDistrictId}
                onChange={(e) => {
                  setBulkDistrictId(e.target.value);
                  setDryRunResult(null);
                }}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-sm font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#147D84]"
              >
                <option value="">Select District...</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Paste Names (One English Name Per Line)
            </label>
            <textarea
              rows={8}
              value={bulkPasteText}
              onChange={(e) => {
                setBulkPasteText(e.target.value);
                setDryRunResult(null);
              }}
              placeholder={
                activeTab === 'stations'
                  ? 'PS Hazratganj\nPS Gomti Nagar\nPS Mahanagar\nPS Alambagh\nPS Hussainganj'
                  : activeTab === 'districts'
                  ? 'Varanasi\nPrayagraj\nGorakhpur\nKanpur Nagar'
                  : activeTab === 'offices'
                  ? 'SP City Office\nReserve Police Line\nCrime Branch Unit\nTraffic Lines'
                  : 'Director General of Police\nInspector General of Police\nInspector of Police'
              }
              className="w-full p-3 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#147D84]"
            />
          </div>

          {/* Dry Run Preview Summary & Table */}
          {dryRunResult && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="font-bold text-slate-900 dark:text-white">Validation Results:</span>
                <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
                  <Badge variant="success">Valid: {dryRunResult.summary.validCount}</Badge>
                  <Badge variant="warning">Already Exists: {dryRunResult.summary.alreadyExistsCount}</Badge>
                  <Badge variant="neutral">Duplicates in Batch: {dryRunResult.summary.duplicateInFileCount}</Badge>
                  {dryRunResult.summary.invalidCount > 0 && (
                    <Badge variant="danger">Invalid: {dryRunResult.summary.invalidCount}</Badge>
                  )}
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {dryRunResult.previewRows.map((r: any, idx: number) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-slate-400 mr-2">#{r.rowIndex}</span>
                      <strong className="text-slate-800 dark:text-slate-200">{r.canonicalValue}</strong>
                      {r.districtName && (
                        <span className="text-[11px] text-slate-400 ml-2">({r.districtName})</span>
                      )}
                      {r.error && <p className="text-[11px] text-red-500 mt-0.5">{r.error}</p>}
                    </div>
                    <Badge
                      variant={
                        r.status === 'VALID'
                          ? 'success'
                          : r.status === 'ALREADY_EXISTS'
                          ? 'warning'
                          : 'danger'
                      }
                      size="sm"
                    >
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ---------------------------------------------------------------- */}
      {/* MODAL 3: EXCEL / CSV BULK IMPORT MODAL                           */}
      {/* ---------------------------------------------------------------- */}
      <Modal
        isOpen={excelModalOpen}
        onClose={() => setExcelModalOpen(false)}
        title={`Excel / CSV Import (${activeTab.toUpperCase()})`}
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="ghost" onClick={() => setExcelModalOpen(false)} disabled={excelCommitLoading} aria-label="Cancel">
              Cancel
            </Button>
            {excelDryRunResult && (
              <Button
                variant="primary"
                onClick={handleExcelCommit}
                disabled={excelCommitLoading || excelDryRunResult.summary.validCount === 0}
                aria-label="Commit valid rows"
                className="bg-emerald-600 hover:bg-emerald-700 font-bold"
              >
                {excelCommitLoading ? 'Committing...' : `Commit ${excelDryRunResult.summary.validCount} Valid Records`}
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Download Standard Template</p>
              <p className="text-[11px] text-slate-500">Includes official columns and sample rows.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              aria-label="Download template"
              className="text-xs font-semibold flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              Download .xlsx
            </Button>
          </div>

          {(activeTab === 'stations' || activeTab === 'offices') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Target District (if not specified per row)
              </label>
              <select
                value={bulkDistrictId}
                onChange={(e) => setBulkDistrictId(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#147D84]"
              >
                <option value="">Use per-row district</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select .XLSX or .CSV File
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleExcelFileSelect}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#17324F] file:text-white hover:file:bg-slate-800 cursor-pointer"
            />
          </div>

          {excelParsing && <p className="text-xs text-slate-400">Parsing and running validation check...</p>}

          {excelDryRunResult && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="font-bold text-slate-900 dark:text-white">Validation Summary:</span>
                <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
                  <Badge variant="success">Valid: {excelDryRunResult.summary.validCount}</Badge>
                  <Badge variant="warning">Already Exists: {excelDryRunResult.summary.alreadyExistsCount}</Badge>
                  <Badge variant="neutral">Duplicates in File: {excelDryRunResult.summary.duplicateInFileCount}</Badge>
                  {excelDryRunResult.summary.invalidCount > 0 && (
                    <Badge variant="danger">Invalid: {excelDryRunResult.summary.invalidCount}</Badge>
                  )}
                  {excelDryRunResult.summary.unknownDistrictCount > 0 && (
                    <Badge variant="danger">Unknown District: {excelDryRunResult.summary.unknownDistrictCount}</Badge>
                  )}
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {excelDryRunResult.previewRows.map((r: any, idx: number) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-slate-400 mr-2">#{r.rowIndex}</span>
                      <strong className="text-slate-800 dark:text-slate-200">{r.canonicalValue}</strong>
                      {r.districtName && (
                        <span className="text-[11px] text-slate-400 ml-2">District: {r.districtName}</span>
                      )}
                      {r.error && <p className="text-[11px] text-red-500 mt-0.5">{r.error}</p>}
                    </div>
                    <Badge
                      variant={
                        r.status === 'VALID'
                          ? 'success'
                          : r.status === 'ALREADY_EXISTS'
                          ? 'warning'
                          : 'danger'
                      }
                      size="sm"
                    >
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ---------------------------------------------------------------- */}
      {/* MODAL 4: ROLLBACK & IMPORT HISTORY MODAL                         */}
      {/* ---------------------------------------------------------------- */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Master Bulk Import History & Rollback"
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-end w-full">
            <Button variant="ghost" onClick={() => setHistoryModalOpen(false)} aria-label="Close">
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Super Admin Authority: You can rollback previous master bulk import batches. Records referenced by active personnel or transfers are protected from deletion.
          </p>

          {historyLoading ? (
            <p className="text-xs text-slate-400 py-4 text-center">Loading import history...</p>
          ) : historyList.length === 0 ? (
            <Card className="p-8 text-center text-slate-400 text-xs">No bulk master import jobs found.</Card>
          ) : (
            <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {historyList.map((job) => (
                <div key={job.id} className="p-3.5 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 dark:text-white">{job.file_name}</h4>
                      <Badge
                        variant={job.status === 'COMMITTED' ? 'success' : job.status === 'ROLLED_BACK' ? 'danger' : 'neutral'}
                        size="sm"
                      >
                        {job.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Job ID: <span className="font-mono">{job.id}</span> • Admin: {job.adminName || 'Super Admin'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Records Created: <strong className="text-[#147D84]">{job.created_count}</strong> • Total Rows: {job.total_rows} • Date: {new Date(job.created_at).toLocaleString()}
                    </p>
                  </div>

                  {job.status === 'COMMITTED' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRollbackJob(job.id)}
                      disabled={rollingBackId === job.id}
                      aria-label="Rollback this import"
                      className="text-xs font-bold"
                    >
                      {rollingBackId === job.id ? 'Rolling back...' : 'Rollback Batch'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
