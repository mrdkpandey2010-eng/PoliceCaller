import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Input, Modal } from '@police-directory/ui';
import {
  Users,
  UserCheck,
  ArrowRightLeft,
  ShieldAlert,
  Database,
  Smartphone,
  FileSpreadsheet,
  Check,
  X,
  History,
  KeyRound,
  Download,
  RotateCcw,
  Search,
  Edit2,
  UserPlus,
  UserX,
  ShieldCheck,
  Building2,
  MessageSquarePlus,
  Star,
  Phone,
  Plus,
  MapPin,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '@police-directory/shared';
import { ExcelImport } from './ExcelImport';
import { MasterDataManagement } from './MasterData/MasterDataManagement';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;

  const [activeTab, setActiveTab] = useState<string>('metrics');
  const [metrics, setMetrics] = useState<any | null>(null);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [coAdmins, setCoAdmins] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [backupStatus, setBackupStatus] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Real-time Feedbacks state (Requirement 1)
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // Stations & Offices Command Tab state (Co-Admin & Super Admin)
  const [adminStations, setAdminStations] = useState<any[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [stationSearch, setStationSearch] = useState('');
  const [editingStation, setEditingStation] = useState<any | null>(null);
  const [newStationPhone, setNewStationPhone] = useState('');
  const [savingStationPhone, setSavingStationPhone] = useState(false);
  const [addOfficeModalOpen, setAddOfficeModalOpen] = useState(false);
  const [newOfficeName, setNewOfficeName] = useState('');
  const [newOfficeType, setNewOfficeType] = useState('CIRCLE_OFFICE');
  const [newOfficePhone, setNewOfficePhone] = useState('');
  const [newOfficeAddress, setNewOfficeAddress] = useState('');
  const [newOfficeDistrictId, setNewOfficeDistrictId] = useState('');
  const [addingOffice, setAddingOffice] = useState(false);
  const [allDistricts, setAllDistricts] = useState<any[]>([]);

  // Super Admin Control: Co-Admin Excel Bulk Import toggle (Requirement 5)
  const [coAdminExcelEnabled, setCoAdminExcelEnabled] = useState<boolean>(true);
  const [togglingExcel, setTogglingExcel] = useState<boolean>(false);

  // Password reset modal state
  const [resetModalUserId, setResetModalUserId] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Edit user details modal state
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editDesignationId, setEditDesignationId] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [designations, setDesignations] = useState<any[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Co-Admins management state
  const [coAdminsSearch, setCoAdminsSearch] = useState('');
  const [appointModalOpen, setAppointModalOpen] = useState(false);
  const [appointSearchQuery, setAppointSearchQuery] = useState('');
  const [appointCandidates, setAppointCandidates] = useState<any[]>([]);
  const [appointSearching, setAppointSearching] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [appointSubmitting, setAppointSubmitting] = useState(false);
  const [revokeConfirmUser, setRevokeConfirmUser] = useState<any | null>(null);
  const [revokeSubmitting, setRevokeSubmitting] = useState(false);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await api.getMetrics();
      setMetrics(res.metrics);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    api
      .getCoAdminExcelImportSetting()
      .then((res) => {
        if (res && typeof res.enabled === 'boolean') {
          setCoAdminExcelEnabled(res.enabled);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleCoAdminExcel = async () => {
    setTogglingExcel(true);
    try {
      const next = !coAdminExcelEnabled;
      const res = await api.setCoAdminExcelImportSetting({ enabled: next });
      setCoAdminExcelEnabled(res.enabled);
    } catch (err: any) {
      alert(err.message || 'Failed to update Excel import permission.');
    } finally {
      setTogglingExcel(false);
    }
  };

  const loadTabContent = async (tab: string) => {
    setActiveTab(tab);
    try {
      if (tab === 'approvals') {
        const res = await api.getPendingUsers();
        setPendingUsers(res.pendingUsers || []);
      } else if (tab === 'users') {
        const [usersRes, desigRes] = await Promise.all([
          api.getUsers(),
          designations.length === 0 ? api.getDesignations() : Promise.resolve({ designations }),
        ]);
        setUsersList(usersRes.users || []);
        if (desigRes?.designations) {
          setDesignations(desigRes.designations);
        }
      } else if (tab === 'transfers') {
        const res = await api.getTransfers({ status: 'PENDING' });
        const pending = (res.transfers || []).filter((tr: any) => tr.status === 'PENDING');
        setTransfers(pending);
      } else if (tab === 'coadmins' && isSuperAdmin) {
        const res = await api.getCoAdmins();
        setCoAdmins(res.coAdmins || []);
      } else if (tab === 'devices' && isSuperAdmin) {
        const res = await api.getDevices();
        setDevices(res.devices || []);
      } else if (tab === 'audit' && isSuperAdmin) {
        const res = await api.getAuditLogs();
        setAuditLogs(res.auditLogs || []);
      } else if (tab === 'backup' && isSuperAdmin) {
        const res = await api.getBackupStatus();
        setBackupStatus(res.latestBackup);
      } else if (tab === 'feedbacks') {
        setFeedbackLoading(true);
        try {
          const res = await api.getFeedbacks();
          setFeedbacks(res.feedbacks || []);
        } finally {
          setFeedbackLoading(false);
        }
      } else if (tab === 'stations') {
        setStationsLoading(true);
        try {
          const [stnRes, distRes] = await Promise.all([
            api.getStations({
              districtId: isSuperAdmin ? undefined : user?.districtId,
              all: true,
            }),
            allDistricts.length === 0 ? api.getDistricts() : Promise.resolve({ districts: allDistricts }),
          ]);
          setAdminStations(stnRes.stations || []);
          if (distRes?.districts) {
            setAllDistricts(distRes.districts);
          }
        } finally {
          setStationsLoading(false);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveStationPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStation) return;
    if (!/^[0-9\-+\s]{6,15}$/.test(newStationPhone.trim())) {
      alert('Please enter a valid phone number (6-15 digits/standard format).');
      return;
    }
    setSavingStationPhone(true);
    try {
      await api.updateStationPhone(editingStation.id, newStationPhone.trim());
      setAdminStations((prev) =>
        prev.map((s) => (s.id === editingStation.id ? { ...s, phone: newStationPhone.trim() } : s))
      );
      setEditingStation(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update phone number');
    } finally {
      setSavingStationPhone(false);
    }
  };

  const handleCreateOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOfficeName.trim()) {
      alert('Office Name is required.');
      return;
    }
    const targetDist = isSuperAdmin ? newOfficeDistrictId || user?.districtId : user?.districtId;
    if (!targetDist) {
      alert('District is required.');
      return;
    }
    setAddingOffice(true);
    try {
      await api.createStation({
        districtId: targetDist,
        name: newOfficeName.trim(),
        type: newOfficeType,
        phone: newOfficePhone.trim() || undefined,
        address: newOfficeAddress.trim() || undefined,
      });
      alert('New Departmental Office created successfully.');
      setAddOfficeModalOpen(false);
      setNewOfficeName('');
      setNewOfficePhone('');
      setNewOfficeAddress('');
      loadTabContent('stations');
    } catch (err: any) {
      alert(err.message || 'Failed to create office');
    } finally {
      setAddingOffice(false);
    }
  };

  const handleResolveFeedback = async (feedbackId: string, status: 'REVIEWED' | 'RESOLVED') => {
    try {
      await api.updateFeedbackStatus(feedbackId, { status });
      setFeedbacks((prev) =>
        prev.map((f) => (f.id === feedbackId ? { ...f, status } : f))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update feedback status');
    }
  };

  const handleReviewUser = async (targetUserId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      await api.reviewUser({ targetUserId, action });
      setPendingUsers((prev) => prev.filter((u) => u.id !== targetUserId));
      fetchOverview();
    } catch (err: any) {
      alert(err.message || 'Review failed');
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.setUserStatus(userId, newStatus);
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
      );
      fetchOverview();
    } catch (err: any) {
      alert(err.message || 'Status change failed');
    }
  };

  const handleOpenEditModal = (u: any) => {
    setEditingUser(u);
    setEditFullName(u.fullName || '');
    setEditMobile(u.mobile || '');
    setEditDesignationId(u.designationId || '');
    setEditEmail(u.email || '');
  };

  const handleSaveUserDetails = async () => {
    if (!editingUser) return;
    if (!/^[6-9]\d{9}$/.test(editMobile.trim())) {
      alert('Mobile Number must be a valid 10-digit Indian mobile number.');
      return;
    }
    if (isSuperAdmin && !/^[a-zA-Z\s.]+$/.test(editFullName.trim())) {
      alert('Full Name must contain English letters only.');
      return;
    }
    setEditSaving(true);
    try {
      const payload: any = {
        mobile: editMobile.trim(),
      };
      if (isSuperAdmin) {
        payload.fullName = editFullName.trim();
        payload.designationId = editDesignationId || undefined;
        payload.email = editEmail.trim() || undefined;
      }

      await api.updateUserDetails(editingUser.id, payload);
      const targetDesig = designations.find((d) => d.id === editDesignationId);
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                mobile: editMobile.trim(),
                fullName: isSuperAdmin ? editFullName.trim() : u.fullName,
                designationId: isSuperAdmin ? editDesignationId : u.designationId,
                designationName: isSuperAdmin && targetDesig ? targetDesig.name : u.designationName,
                email: isSuperAdmin ? editEmail.trim() || u.email : u.email,
              }
            : u
        )
      );
      setEditingUser(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update user details');
    } finally {
      setEditSaving(false);
    }
  };

  const handleSearchAppointCandidates = async (query: string) => {
    setAppointSearchQuery(query);
    if (!query.trim()) {
      setAppointCandidates([]);
      return;
    }
    setAppointSearching(true);
    try {
      const res = await api.getUsers({ search: query.trim() });
      const eligible = (res.users || []).filter(
        (u: any) => u.role !== ROLES.SUPER_ADMIN && u.role !== ROLES.DISTRICT_CO_ADMIN && u.status === 'ACTIVE'
      );
      setAppointCandidates(eligible);
    } catch (err) {
      console.error(err);
    } finally {
      setAppointSearching(false);
    }
  };

  const handleAppointCoAdmin = async () => {
    if (!selectedCandidate) return;
    setAppointSubmitting(true);
    try {
      const res = await api.assignCoAdmin(selectedCandidate.id);
      alert(res.message || `${selectedCandidate.fullName} appointed as District Co-Admin.`);
      setAppointModalOpen(false);
      setSelectedCandidate(null);
      setAppointSearchQuery('');
      setAppointCandidates([]);
      loadTabContent('coadmins');
      if (activeTab === 'users') {
        loadTabContent('users');
      }
      fetchOverview();
    } catch (err: any) {
      alert(err.message || 'Failed to appoint District Co-Admin.');
    } finally {
      setAppointSubmitting(false);
    }
  };

  const handleRevokeCoAdmin = async () => {
    if (!revokeConfirmUser) return;
    setRevokeSubmitting(true);
    try {
      const res = await api.revokeCoAdmin(revokeConfirmUser.id);
      alert(res.message || 'District Co-Admin privileges revoked.');
      setRevokeConfirmUser(null);
      loadTabContent('coadmins');
      if (activeTab === 'users') {
        loadTabContent('users');
      }
      fetchOverview();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke District Co-Admin privileges.');
    } finally {
      setRevokeSubmitting(false);
    }
  };

  const handleReviewTransfer = async (transferId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      await api.reviewTransfer({ transferId, action });
      setTransfers((prev) => prev.filter((t) => t.id !== transferId));
      fetchOverview();
    } catch (err: any) {
      alert(err.message || 'Transfer review failed');
    }
  };

  const handleTriggerBackup = async () => {
    try {
      const res = await api.triggerBackup();
      if (res.success) {
        alert('6-Hour scheduled backup triggered and validated successfully.');
        setBackupStatus(res.result);
      }
    } catch (err: any) {
      alert(err.message || 'Backup trigger failed');
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to revoke this active device session?')) return;
    try {
      const res = await api.revokeDevice(deviceId);
      if (res.success) {
        alert(res.message || 'Device and active session revoked.');
        loadTabContent('devices');
      } else {
        alert(res.error || 'Failed to revoke device session.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to revoke device session.');
    }
  };

  const handleAdminResetPassword = async () => {
    if (!resetModalUserId || !newPasswordInput.trim()) return;
    try {
      const res = await api.resetUserPassword(resetModalUserId, newPasswordInput.trim());
      setResetSuccessMessage(res.message);
      setNewPasswordInput('');
    } catch (err: any) {
      alert(err.message || 'Reset password failed');
    }
  };

  const filteredUsers = usersList.filter((u) => {
    // Requirement 3: Super Admin card must NOT be visible in Co-Admin's control tab personnel records
    if (!isSuperAdmin && u.role === ROLES.SUPER_ADMIN) return false;
    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      u.pno?.toLowerCase().includes(q) ||
      u.fullName?.toLowerCase().includes(q) ||
      u.mobile?.toLowerCase().includes(q) ||
      u.designationName?.toLowerCase().includes(q) ||
      u.stationOfficeName?.toLowerCase().includes(q)
    );
  });

  const filteredCoAdmins = coAdmins.filter((ca) => {
    if (!coAdminsSearch.trim()) return true;
    const q = coAdminsSearch.toLowerCase();
    return (
      ca.fullName?.toLowerCase().includes(q) ||
      ca.pno?.toLowerCase().includes(q) ||
      ca.districtName?.toLowerCase().includes(q) ||
      ca.mobile?.toLowerCase().includes(q) ||
      ca.designationName?.toLowerCase().includes(q)
    );
  });

  const filteredStations = adminStations.filter((stn) => {
    if (!stationSearch.trim()) return true;
    const q = stationSearch.toLowerCase();
    return (
      stn.name?.toLowerCase().includes(q) ||
      stn.type?.toLowerCase().includes(q) ||
      stn.phone?.toLowerCase().includes(q) ||
      stn.districtName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 pb-24 md:pb-8 space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              {isSuperAdmin ? 'Statewide Administration' : `${user?.districtName || 'District'} Command Console`}
            </h1>
            <Badge variant={isSuperAdmin ? 'khaki' : 'teal'} size="sm">
              {isSuperAdmin ? 'Super Admin' : 'District Co-Admin'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Role-Scoped Administration • Canonical English Data Enforcement
          </p>
        </div>
      </div>

      {/* Admin Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none text-xs border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`px-3 py-2 rounded-xl font-bold transition-colors shrink-0 ${
            activeTab === 'metrics'
              ? 'bg-[#17324F] text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Metrics Overview
        </button>
        <button
          onClick={() => loadTabContent('approvals')}
          className={`px-3 py-2 rounded-xl font-bold transition-colors shrink-0 flex items-center gap-1.5 ${
            activeTab === 'approvals'
              ? 'bg-[#17324F] text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Pending Approvals
          {metrics?.pendingUsers > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center">
              {metrics.pendingUsers}
            </span>
          )}
        </button>
        <button
          onClick={() => loadTabContent('users')}
          className={`px-3 py-2 rounded-xl font-bold transition-colors shrink-0 ${
            activeTab === 'users'
              ? 'bg-[#17324F] text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Personnel Records
        </button>
        <button
          onClick={() => loadTabContent('stations')}
          className={`px-3 py-2 rounded-xl font-bold transition-colors shrink-0 flex items-center gap-1.5 ${
            activeTab === 'stations'
              ? 'bg-[#17324F] text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Building2 className="w-3.5 h-3.5 text-[#147D84]" />
          Stations & Offices
        </button>
        <button
          onClick={() => loadTabContent('transfers')}
          className={`px-3 py-2 rounded-xl font-bold transition-colors shrink-0 ${
            activeTab === 'transfers'
              ? 'bg-[#17324F] text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Transfers Review
        </button>
        <button
          onClick={() => loadTabContent('feedbacks')}
          className={`px-3 py-2 rounded-xl font-bold transition-colors shrink-0 flex items-center gap-1.5 ${
            activeTab === 'feedbacks'
              ? 'bg-[#17324F] text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <MessageSquarePlus className="w-3.5 h-3.5 text-[#147D84]" />
          User Feedbacks
          {feedbacks.filter((f) => f.status === 'PENDING').length > 0 && (
            <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] flex items-center justify-center font-mono">
              {feedbacks.filter((f) => f.status === 'PENDING').length}
            </span>
          )}
        </button>
        {(isSuperAdmin || coAdminExcelEnabled) && (
          <button
            onClick={() => setActiveTab('excel')}
            className={`px-3 py-2 rounded-xl font-bold transition-colors shrink-0 flex items-center gap-1 ${
              activeTab === 'excel'
                ? 'bg-[#17324F] text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel Bulk Import
          </button>
        )}

        {/* Super Admin Privileged Tabs */}
        {isSuperAdmin && (
          <>
            <button
              onClick={() => setActiveTab('masters')}
              className={`px-3 py-2 rounded-xl font-bold transition-colors shrink-0 flex items-center gap-1.5 ${
                activeTab === 'masters'
                  ? 'bg-[#17324F] text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-[#147D84]" />
              Master Data
            </button>
            <button
              onClick={() => loadTabContent('coadmins')}
              className={`px-3 py-2 rounded-xl font-bold transition-colors shrink-0 ${
                activeTab === 'coadmins'
                  ? 'bg-[#17324F] text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Co-Admins
            </button>
            <button
              onClick={() => loadTabContent('devices')}
              className={`px-3 py-2 rounded-xl font-bold transition-colors shrink-0 ${
                activeTab === 'devices'
                  ? 'bg-[#17324F] text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Device Logs
            </button>
            <button
              onClick={() => loadTabContent('audit')}
              className={`px-3 py-2 rounded-xl font-bold transition-colors shrink-0 ${
                activeTab === 'audit'
                  ? 'bg-[#17324F] text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Audit Trail
            </button>
            <button
              onClick={() => loadTabContent('backup')}
              className={`px-3 py-2 rounded-xl font-bold transition-colors shrink-0 ${
                activeTab === 'backup'
                  ? 'bg-[#17324F] text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              6-Hr Backups
            </button>
          </>
        )}
      </div>

      {/* Tab: Metrics Overview */}
      {activeTab === 'metrics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Personnel
              </span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {metrics?.totalUsers ?? '...'}
              </p>
            </Card>
            <Card className="p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                Active Approved
              </span>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {metrics?.activeUsers ?? '...'}
              </p>
            </Card>
            <Card className="p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
                Pending Approval
              </span>
              <p className="text-2xl font-black text-amber-500 mt-1">
                {metrics?.pendingUsers ?? '...'}
              </p>
            </Card>
            <Card className="p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {isSuperAdmin ? 'Total Districts' : 'Pending Transfers'}
              </span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {isSuperAdmin ? metrics?.totalDistricts ?? 75 : metrics?.pendingTransfers ?? 0}
              </p>
            </Card>
          </div>

          {/* Super Admin Control: Co-Admin Excel Bulk Import Toggle (Requirement 5) */}
          {isSuperAdmin && (
            <Card className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 flex items-center justify-center text-[#147D84]">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      Co-Admin Excel Bulk Import Control (एक्सेल बल्क इम्पोर्ट नियंत्रण)
                      <Badge variant={coAdminExcelEnabled ? 'success' : 'neutral'} size="sm">
                        {coAdminExcelEnabled ? 'Visible to Co-Admins' : 'Hidden from Co-Admins'}
                      </Badge>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Toggle whether District Co-Admins can view and use the Excel Bulk Import tool in their district command consoles.
                    </p>
                  </div>
                </div>
                <Button
                  aria-label="Toggle Excel bulk import visibility for Co-Admins"
                  onClick={handleToggleCoAdminExcel}
                  disabled={togglingExcel}
                  variant={coAdminExcelEnabled ? 'danger' : 'primary'}
                  size="sm"
                  className="font-bold text-xs"
                >
                  {togglingExcel
                    ? 'Updating...'
                    : coAdminExcelEnabled
                    ? 'Hide from Co-Admins (छिपाएं)'
                    : 'Show to Co-Admins (दिखाएं)'}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab: Pending Approvals */}
      {activeTab === 'approvals' && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Pending Registrations Review
          </h3>
          {pendingUsers.length === 0 ? (
            <Card className="p-8 text-center text-slate-400 text-xs">
              No registration requests pending review in your district scope.
            </Card>
          ) : (
            pendingUsers.map((u) => (
              <Card key={u.id} className="p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {u.fullName}
                    </h4>
                    <span className="text-xs font-mono font-semibold text-slate-500">
                      PNO: {u.pno}
                    </span>
                  </div>
                  <p className="text-xs text-[#147D84] font-medium mt-0.5">
                    {u.designationName} • {u.stationOfficeName}, {u.districtName}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">
                    Mobile: {u.mobile} {u.email ? `• ${u.email}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleReviewUser(u.id, 'REJECT')}
                    aria-label={`Reject registration for ${u.fullName}`}
                    className="text-xs px-3 py-1 font-bold"
                  >
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleReviewUser(u.id, 'APPROVE')}
                    aria-label={`Approve registration for ${u.fullName}`}
                    className="bg-[#17324F] text-xs px-4 py-1 font-bold"
                  >
                    Approve
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Tab: Users Management */}
      {activeTab === 'users' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Personnel Directory Administration ({filteredUsers.length} records)
            </h3>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by PNO, Name, Mobile..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#147D84]"
              />
            </div>
          </div>
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold text-slate-500 uppercase">
                <tr>
                  <th className="p-3">PNO</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Designation</th>
                  <th className="p-3">District & Station</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {u.pno}
                    </td>
                    <td className="p-3 font-medium text-slate-900 dark:text-white">
                      {u.fullName}
                    </td>
                    <td className="p-3 font-semibold text-[#147D84]">
                      {u.designationName}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">
                      {u.stationOfficeName}, {u.districtName}
                    </td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                      {u.mobile}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={u.role === ROLES.SUPER_ADMIN ? 'khaki' : u.role === ROLES.DISTRICT_CO_ADMIN ? 'teal' : 'neutral'}
                        size="sm"
                      >
                        {u.role === ROLES.SUPER_ADMIN ? 'Super Admin' : u.role === ROLES.DISTRICT_CO_ADMIN ? 'Co-Admin' : 'Officer'}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={u.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
                        {u.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      {isSuperAdmin && u.role === ROLES.USER && u.status === 'ACTIVE' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCandidate(u);
                            setAppointModalOpen(true);
                          }}
                          aria-label={`Appoint ${u.fullName} as District Co-Admin`}
                          className="text-[11px] px-2 py-1 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40 font-medium"
                        >
                          Make Co-Admin
                        </Button>
                      )}
                      {isSuperAdmin && u.role === ROLES.DISTRICT_CO_ADMIN && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setRevokeConfirmUser(u)}
                          aria-label={`Revoke Co-Admin role from ${u.fullName}`}
                          className="text-[11px] px-2 py-1 font-medium"
                        >
                          Revoke Co-Admin
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditModal(u)}
                        aria-label={`Edit details for ${u.fullName}`}
                        className="text-[11px] px-2 py-1"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setResetModalUserId(u.id);
                          setResetSuccessMessage(null);
                        }}
                        aria-label={`Reset password for ${u.fullName}`}
                        className="text-[11px] px-2 py-1"
                      >
                        Reset PW
                      </Button>
                      <Button
                        variant={u.status === 'ACTIVE' ? 'danger' : 'primary'}
                        size="sm"
                        onClick={() => handleToggleUserStatus(u.id, u.status)}
                        aria-label={`Toggle active status for ${u.fullName}`}
                        className="text-[11px] px-2 py-1"
                      >
                        {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Transfers Review (Requirement 4: Clean queue, no completed logs) */}
      {activeTab === 'transfers' && (
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-900 dark:text-blue-200 font-medium">
            Transfer Approval Precedence: Either the <strong>Destination District Co-Admin</strong> or the <strong>Super Admin</strong> may approve a transfer into the destination post. Approved and rejected requests are automatically removed from this review queue to maintain a clean workspace.
          </div>

          {transfers.filter((tr) => tr.status === 'PENDING').length === 0 ? (
            <Card className="p-8 text-center text-slate-400 text-xs">
              No pending transfer requests in this review queue. All transfer reviews are up to date.
            </Card>
          ) : (
            transfers
              .filter((tr) => tr.status === 'PENDING')
              .map((tr) => (
                <Card key={tr.id} className="p-4 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {tr.userName} ({tr.userDesignation})
                      </h4>
                      <span className="text-xs font-mono text-slate-400">PNO: {tr.userPno}</span>
                      <Badge variant="warning" size="sm">
                        PENDING
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      Route: <strong className="text-slate-800 dark:text-slate-200">{tr.sourceStationName}, {tr.sourceDistrictName}</strong> ➔ <strong className="text-[#147D84]">{tr.destinationStationName}, {tr.destinationDistrictName}</strong>
                    </p>

                    <p className="text-xs text-slate-500 mt-0.5">
                      Reason: {tr.reason} {tr.order_reference ? `(Ref: ${tr.order_reference})` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleReviewTransfer(tr.id, 'REJECT')}
                      aria-label="Reject transfer request"
                      className="text-xs font-bold"
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleReviewTransfer(tr.id, 'APPROVE')}
                      aria-label="Approve transfer request"
                      className="bg-[#17324F] text-xs font-bold"
                    >
                      Approve & Post
                    </Button>
                  </div>
                </Card>
              ))
          )}
        </div>
      )}

      {/* Tab: Real-Time User Feedbacks (Requirement 1) */}
      {activeTab === 'feedbacks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquarePlus className="w-4 h-4 text-[#147D84]" />
                User Real-Time Feedbacks & Grievances (अधिकारी प्रतिपुष्टि व सुझाव)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isSuperAdmin
                  ? 'Statewide Officer Feedback: Review suggestions, bug reports, and data corrections from all 75 districts.'
                  : `District Command Feedback: Review input and contact correction requests from ${user?.districtName || 'your district'} personnel.`}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTabContent('feedbacks')}
              disabled={feedbackLoading}
              aria-label="Refresh feedbacks"
              className="text-xs font-bold"
            >
              Refresh Feedbacks
            </Button>
          </div>

          {feedbackLoading ? (
            <div className="flex justify-center py-12">
              <span className="w-6 h-6 border-2 border-[#17324F] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : feedbacks.length === 0 ? (
            <Card className="p-8 text-center text-slate-400 text-xs">
              No feedback or grievance records found in your administrative scope.
            </Card>
          ) : (
            <div className="space-y-3">
              {feedbacks.map((fb) => (
                <Card key={fb.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            fb.category === 'BUG_REPORT'
                              ? 'danger'
                              : fb.category === 'DATA_CORRECTION'
                              ? 'warning'
                              : fb.category === 'SUGGESTION'
                              ? 'teal'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {fb.category.replace('_', ' ')}
                        </Badge>
                        <Badge
                          variant={
                            fb.status === 'RESOLVED'
                              ? 'success'
                              : fb.status === 'REVIEWED'
                              ? 'primary'
                              : 'warning'
                          }
                          size="sm"
                        >
                          {fb.status}
                        </Badge>
                        <div className="flex items-center gap-0.5 ml-2">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                s <= fb.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-200 dark:text-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">
                        {fb.subject}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">
                        {fb.message}
                      </p>
                    </div>

                    <div className="text-right text-xs shrink-0">
                      <span className="text-slate-400 text-[11px] font-mono block">
                        {new Date(fb.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="text-slate-500 font-medium">
                      By: <strong className="text-slate-800 dark:text-slate-200">{fb.userName}</strong> ({fb.designationShort || 'Officer'} • PNO: <span className="font-mono">{fb.userPno}</span>) • {fb.stationOfficeName}, {fb.districtName}
                    </div>

                    {fb.status === 'PENDING' && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolveFeedback(fb.id, 'REVIEWED')}
                          aria-label="Mark feedback as reviewed"
                          className="text-xs font-semibold"
                        >
                          Mark Reviewed
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleResolveFeedback(fb.id, 'RESOLVED')}
                          aria-label="Resolve feedback"
                          className="bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white"
                        >
                          Resolve & Complete
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Stations & Departmental Offices Command */}
      {activeTab === 'stations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#147D84]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  District Stations & Offices Command (थाना एवं कार्यालय प्रबंधन)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isSuperAdmin
                  ? 'Statewide Directory: Manage official contact numbers and departmental offices across all districts.'
                  : `District Administration: Manage contact numbers for Thanas and departmental offices in ${user?.districtName || 'your district'}, or establish new departmental offices.`}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setNewOfficeName('');
                setNewOfficePhone('');
                setNewOfficeAddress('');
                setNewOfficeType('CIRCLE_OFFICE');
                setNewOfficeDistrictId(user?.districtId || '');
                setAddOfficeModalOpen(true);
              }}
              aria-label="Add new office"
              className="bg-[#17324F] text-xs font-bold shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add New Office (नया कार्यालय जोड़ें)
            </Button>
          </div>

          {/* Search bar & count */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Thana, Office, Type or Phone..."
                value={stationSearch}
                onChange={(e) => setStationSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#147D84]"
              />
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Showing <strong className="text-slate-900 dark:text-white font-mono">{filteredStations.length}</strong> of{' '}
              <strong className="text-slate-900 dark:text-white font-mono">{adminStations.length}</strong> units
            </div>
          </div>

          {stationsLoading ? (
            <Card className="p-8 text-center text-slate-400 text-xs">
              Loading stations and offices data...
            </Card>
          ) : filteredStations.length === 0 ? (
            <Card className="p-8 text-center text-slate-400 text-xs">
              No police stations or departmental offices found.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredStations.map((stn) => (
                <Card
                  key={stn.id}
                  className="p-4 flex flex-col justify-between border border-slate-200 dark:border-slate-800 hover:shadow-sm transition-shadow rounded-2xl bg-white dark:bg-slate-900"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {stn.name}
                        </h4>
                        {stn.districtName && (
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            {stn.districtName}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={stn.type === 'POLICE_STATION' ? 'khaki' : 'teal'}
                        className="text-[10px] uppercase font-mono px-2 py-0.5"
                      >
                        {stn.type === 'POLICE_STATION'
                          ? 'थाना'
                          : stn.type === 'CIRCLE_OFFICE'
                          ? 'CO Office'
                          : stn.type === 'SP_OFFICE'
                          ? 'SP Office'
                          : stn.type === 'LINE'
                          ? 'Police Lines'
                          : stn.type === 'TRAFFIC'
                          ? 'Traffic'
                          : 'Office'}
                      </Badge>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        {stn.phone ? (
                          <a
                            href={`tel:${stn.phone}`}
                            className="font-mono font-bold text-slate-800 dark:text-slate-200 hover:text-teal-600"
                          >
                            {stn.phone}
                          </a>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No phone registered</span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingStation(stn);
                          setNewStationPhone(stn.phone || '');
                        }}
                        aria-label={`Edit number for ${stn.name}`}
                        className="text-[11px] px-2.5 py-1 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 flex items-center gap-1 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit Number
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Excel Bulk Import (Requirement 5) */}
      {activeTab === 'excel' && (isSuperAdmin || coAdminExcelEnabled) && <ExcelImport />}
      {activeTab === 'excel' && !isSuperAdmin && !coAdminExcelEnabled && (
        <Card className="p-8 text-center text-slate-500 text-xs">
          Excel Bulk Import has been disabled by the State Super Admin.
        </Card>
      )}

      {/* Privileged Tab: District Co-Admins Management (Super Admin Exclusive Tool) */}
      {activeTab === 'coadmins' && isSuperAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#147D84]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  District Co-Admin Command Oversight (जिला को-एडमिन प्रबंधन)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Super Admin Authority: Appoint, monitor, and revoke District Co-Admin administrative authority across all 75 Uttar Pradesh districts.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setSelectedCandidate(null);
                setAppointSearchQuery('');
                setAppointCandidates([]);
                setAppointModalOpen(true);
              }}
              aria-label="Appoint new district co-admin"
              className="bg-[#17324F] text-xs font-bold shadow-sm flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              Appoint New Co-Admin
            </Button>
          </div>

          {/* Search Bar & Summary */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Currently appointed: <strong className="text-slate-900 dark:text-white font-mono">{filteredCoAdmins.length}</strong> Co-Admin(s)
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Co-Admins by Name, PNO, District..."
                value={coAdminsSearch}
                onChange={(e) => setCoAdminsSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#147D84]"
              />
            </div>
          </div>

          {/* Co-Admins Table */}
          {filteredCoAdmins.length === 0 ? (
            <Card className="p-8 text-center text-slate-400 text-xs space-y-2">
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                {coAdminsSearch.trim() ? 'No Co-Admins match your search criteria.' : 'No District Co-Admins currently appointed.'}
              </p>
              <p className="text-[11px] text-slate-400">
                Click <strong>"Appoint New Co-Admin"</strong> above to appoint an officer to manage district approvals and rosters.
              </p>
            </Card>
          ) : (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="p-3">Assigned District</th>
                    <th className="p-3">PNO</th>
                    <th className="p-3">Officer Name</th>
                    <th className="p-3">Designation</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Administrative Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCoAdmins.map((ca) => (
                    <tr key={ca.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3">
                        <Badge variant="teal" size="sm" className="font-bold">
                          {ca.districtName || 'Unassigned'}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {ca.pno}
                      </td>
                      <td className="p-3 font-medium text-slate-900 dark:text-white">
                        {ca.fullName}
                      </td>
                      <td className="p-3 text-[#147D84] font-medium">
                        {ca.designationName || 'Officer'}
                      </td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                        {ca.mobile}
                      </td>
                      <td className="p-3">
                        <Badge variant={ca.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
                          {ca.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setRevokeConfirmUser(ca)}
                          aria-label={`Revoke Co-Admin role from ${ca.fullName}`}
                          className="text-[11px] px-3 py-1 font-bold inline-flex items-center gap-1 ml-auto"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          Revoke Co-Admin
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Super Admin Privileged Tab: Master Data Management */}
      {activeTab === 'masters' && isSuperAdmin && <MasterDataManagement />}

      {/* Privileged Tab: 6-Hour Automated Backups */}
      {activeTab === 'backup' && isSuperAdmin && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Automated 6-Hour Cloud Backup & Integrity
              </h3>
              <p className="text-xs text-slate-500">
                Cloudflare D1 Snapshot • Private R2 Archive • SHA-256 Checksum Verified
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleTriggerBackup}
              aria-label="Trigger manual backup snapshot"
              icon={<Database className="w-3.5 h-3.5" />}
              className="bg-[#17324F] text-xs font-bold"
            >
              Run Backup Now
            </Button>
          </div>

          {backupStatus && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  Last Backup Job:
                </span>
                <Badge variant={backupStatus.status === 'SUCCESS' ? 'success' : 'danger'} size="sm">
                  {backupStatus.status}
                </Badge>
              </div>
              <p>
                Job ID: <strong className="font-mono text-slate-800 dark:text-slate-200">{backupStatus.id}</strong>
              </p>
              <p>
                Storage Path: <strong className="font-mono text-slate-800 dark:text-slate-200">{backupStatus.storage_path}</strong>
              </p>
              <p>
                SHA-256 Checksum: <strong className="font-mono text-slate-800 dark:text-slate-200 break-all">{backupStatus.checksum}</strong>
              </p>
              <p>
                D1 Records Archived: <strong className="font-bold text-[#147D84]">{backupStatus.d1_records_count}</strong>
              </p>
              <p className="text-[11px] text-slate-400">
                Completed: {new Date(backupStatus.completed_at || backupStatus.created_at).toLocaleString()}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Super Admin Privileged Tab: Device Management & Realistic Diagnostics (V4.9) */}
      {activeTab === 'devices' && isSuperAdmin && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-teal-600" />
                Active Device Logs & Diagnostics
              </h3>
              <p className="text-xs text-slate-500">
                Authorized device sessions, network IP, client browser, notifications, and telemetry
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full">
              {devices.length} Registered Sessions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Personnel</th>
                  <th className="py-2.5 px-3">Platform & Browser</th>
                  <th className="py-2.5 px-3">Observed IP</th>
                  <th className="py-2.5 px-3">Push & Battery</th>
                  <th className="py-2.5 px-3">Locale</th>
                  <th className="py-2.5 px-3">Last Seen</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No active device sessions found.
                    </td>
                  </tr>
                ) : (
                  devices.map((dev: any) => (
                    <tr key={dev.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {dev.userName || 'Unknown'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          PNO: {dev.userPno} • {dev.userDistrict}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {dev.platform || 'Web'} • {dev.device_name || 'Generic Device'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {dev.browser_name || 'Standard Browser'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                        {dev.ip_address || 'Not recorded'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              dev.notification_state === 'GRANTED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : dev.notification_state === 'DENIED'
                                ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            Push: {dev.notification_state || 'DEFAULT'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Battery: {dev.battery_level ? `${dev.battery_level}%` : 'Unavailable'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {dev.locale || 'en-IN'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {new Date(dev.last_seen_at || dev.created_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant={dev.is_active ? 'success' : 'neutral'} size="sm">
                          {dev.is_active ? 'Active' : 'Revoked'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {dev.is_active ? (
                          <Button
                            variant="danger"
                            size="sm"
                            aria-label="Revoke device session"
                            onClick={() => handleRevokeDevice(dev.id)}
                            className="text-[11px] py-1 px-2.5"
                          >
                            Revoke
                          </Button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Terminated</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Super Admin Privileged Tab: Audit Trail (V4.9) */}
      {activeTab === 'audit' && isSuperAdmin && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="h-4 w-4 text-teal-600" />
                Immutable Audit Trail
              </h3>
              <p className="text-xs text-slate-500">
                Server-side tamper-resistant record of privileged administrative actions
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full">
              {auditLogs.length} Events Logged
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target Entity</th>
                  <th className="py-2.5 px-3">District Scope</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-sans text-xs">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 text-slate-500">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {log.actor_pno || 'System'}
                        </span>
                        <span className="text-slate-400 text-[10px] ml-1">
                          ({log.actor_role || 'SERVER'})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-teal-700 dark:text-teal-400">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 12)}...)` : ''}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-300">
                        {log.district_scope || 'Statewide'}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <Badge variant={log.status === 'SUCCESS' ? 'success' : 'danger'} size="sm">
                          {log.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Password Reset Modal */}
      <Modal
        isOpen={Boolean(resetModalUserId)}
        onClose={() => setResetModalUserId(null)}
        title="Administrative Password Reset"
        maxWidth="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="ghost"
              onClick={() => setResetModalUserId(null)}
              aria-label="Close modal"
            >
              Close
            </Button>
            <Button
              variant="primary"
              onClick={handleAdminResetPassword}
              disabled={!newPasswordInput.trim()}
              aria-label="Confirm password reset"
              className="bg-[#17324F] font-bold"
            >
              Set New Password
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {resetSuccessMessage ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
              {resetSuccessMessage}
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                Enter a new secure password (min 8 characters). Active sessions for this user will be revoked immediately upon reset.
              </p>
              <Input
                label="New Password"
                type="password"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="••••••••"
                required
              />
            </>
          )}
        </div>
      </Modal>

      {/* Edit User Details Modal */}
      <Modal
        isOpen={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title={`Edit Personnel Details (PNO: ${editingUser?.pno})`}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="ghost"
              onClick={() => setEditingUser(null)}
              disabled={editSaving}
              aria-label="Cancel editing"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveUserDetails}
              disabled={editSaving || !editFullName.trim() || !editMobile.trim()}
              aria-label="Save user details"
              className="bg-[#17324F] font-bold"
            >
              {editSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200">
            <strong>Immutable Identifier:</strong> PNO (<code>{editingUser?.pno}</code>) is permanent and cannot be modified.
            {!isSuperAdmin && (
              <span className="block mt-1 text-slate-600 dark:text-slate-400 font-medium">
                Note: District Co-Admins are strictly authorized to edit officer contact numbers only.
              </span>
            )}
          </div>

          <div>
            <Input
              label={`Full Name (English letters only) ${!isSuperAdmin ? '(Read-Only for Co-Admin)' : '*'}`}
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              placeholder="e.g. Inspector Ramesh Kumar"
              englishOnlyNotice
              disabled={!isSuperAdmin}
              required={isSuperAdmin}
            />
          </div>

          <div>
            <Input
              label="Mobile Number (10 digits) *"
              value={editMobile}
              onChange={(e) => setEditMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="9876543210"
              maxLength={10}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Designation / Rank {!isSuperAdmin && '(Read-Only for Co-Admin)'}
            </label>
            <select
              value={editDesignationId}
              onChange={(e) => setEditDesignationId(e.target.value)}
              disabled={!isSuperAdmin}
              className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-sm transition-colors duration-150 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#17324F] ${
                !isSuperAdmin ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''
              }`}
            >
              {designations.length === 0 ? (
                <option value="" disabled>
                  No designations available — contact Super Admin
                </option>
              ) : (
                <>
                  <option value="">Select Designation...</option>
                  {/* Preserve historical/inactive designation of editing user if not in active list */}
                  {editingUser?.designationId &&
                    !designations.some((d) => d.id === editingUser.designationId) && (
                      <option key={editingUser.designationId} value={editingUser.designationId}>
                        {editingUser.designationName || editingUser.designationId} (Historical / Inactive)
                      </option>
                    )}
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.shortName ? `(${d.shortName})` : ''}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div>
            <Input
              label={`Official Email ${!isSuperAdmin ? '(Read-Only for Co-Admin)' : '(Optional)'}`}
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="officer@uppolice.gov.in"
              disabled={!isSuperAdmin}
            />
          </div>
        </div>
      </Modal>

      {/* Appoint District Co-Admin Modal */}
      <Modal
        isOpen={appointModalOpen}
        onClose={() => {
          if (!appointSubmitting) {
            setAppointModalOpen(false);
            setSelectedCandidate(null);
          }
        }}
        title="Appoint District Co-Admin (को-एडमिन नियुक्ति)"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="ghost"
              onClick={() => {
                setAppointModalOpen(false);
                setSelectedCandidate(null);
              }}
              disabled={appointSubmitting}
              aria-label="Cancel appointment"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAppointCoAdmin}
              disabled={!selectedCandidate || appointSubmitting}
              aria-label="Confirm appointment"
              className="bg-[#17324F] font-bold"
            >
              {appointSubmitting ? 'Appointing...' : 'Confirm Appointment'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-900 dark:text-blue-200">
            <strong>Super Admin Authority:</strong> Appoint any active, verified police personnel as District Co-Admin. They will receive administrative authority over their assigned district.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Search Personnel (by PNO or Name)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Type PNO or English Name to search..."
                value={appointSearchQuery}
                onChange={(e) => handleSearchAppointCandidates(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#147D84]"
              />
            </div>
          </div>

          {appointSearching && (
            <p className="text-xs text-slate-400 text-center py-2">Searching eligible personnel...</p>
          )}

          {appointCandidates.length > 0 && !selectedCandidate && (
            <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
              {appointCandidates.map((cand) => (
                <div
                  key={cand.id}
                  className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                  onClick={() => setSelectedCandidate(cand)}
                >
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                      {cand.fullName}
                    </h5>
                    <p className="text-[11px] text-slate-500 font-mono">
                      PNO: {cand.pno} • {cand.designationName || 'Officer'} • District: {cand.districtName}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[11px] px-2 py-1 text-teal-700 dark:text-teal-300"
                    aria-label={`Select ${cand.fullName}`}
                  >
                    Select
                  </Button>
                </div>
              ))}
            </div>
          )}

          {selectedCandidate && (
            <div className="p-4 bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-teal-900 dark:text-teal-200 text-sm">
                  Selected Candidate
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCandidate(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline font-semibold"
                >
                  Change Selection
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-slate-700 dark:text-slate-300">
                <p>Officer Name: <strong>{selectedCandidate.fullName}</strong></p>
                <p>PNO: <strong className="font-mono">{selectedCandidate.pno}</strong></p>
                <p>Designation: <strong>{selectedCandidate.designationName || 'Officer'}</strong></p>
                <p>Command District: <strong className="text-[#147D84]">{selectedCandidate.districtName}</strong></p>
              </div>
              <p className="text-[11px] text-teal-800 dark:text-teal-300 mt-2 font-medium">
                Upon confirmation, this officer will be granted District Co-Admin authority over <strong>{selectedCandidate.districtName}</strong>.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Revoke Co-Admin Confirmation Modal */}
      <Modal
        isOpen={Boolean(revokeConfirmUser)}
        onClose={() => {
          if (!revokeSubmitting) {
            setRevokeConfirmUser(null);
          }
        }}
        title="Revoke District Co-Admin Role (को-एडमिन पद से हटाएं)"
        maxWidth="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="ghost"
              onClick={() => setRevokeConfirmUser(null)}
              disabled={revokeSubmitting}
              aria-label="Cancel revocation"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRevokeCoAdmin}
              disabled={revokeSubmitting}
              aria-label="Confirm revoke role"
              className="font-bold"
            >
              {revokeSubmitting ? 'Revoking...' : 'Confirm Revocation'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-900 dark:text-red-200">
            <strong>Revocation Notice:</strong> You are about to revoke District Co-Admin privileges for:
            <div className="mt-2 font-semibold">
              {revokeConfirmUser?.fullName} (PNO: <code>{revokeConfirmUser?.pno}</code>)
            </div>
            <div className="text-[11px] text-red-700 dark:text-red-300 mt-1">
              District: <strong>{revokeConfirmUser?.districtName}</strong>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            This officer will immediately revert to a standard <strong>USER</strong> role and lose all access to:
          </p>
          <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
            <li>Reviewing and approving district registration requests</li>
            <li>Approving destination district transfers</li>
            <li>Managing district personnel directory rosters</li>
          </ul>
        </div>
      </Modal>

      {/* Edit Station / Office Contact Phone Modal */}
      <Modal
        isOpen={Boolean(editingStation)}
        onClose={() => {
          if (!savingStationPhone) setEditingStation(null);
        }}
        title="Edit Contact Number (थाना / कार्यालय संपर्क नंबर बदलें)"
        maxWidth="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="ghost"
              onClick={() => setEditingStation(null)}
              disabled={savingStationPhone}
              aria-label="Cancel editing"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveStationPhone}
              disabled={savingStationPhone}
              aria-label="Save phone number"
              className="bg-[#17324F] font-bold"
            >
              {savingStationPhone ? 'Saving...' : 'Save Number'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveStationPhone} className="space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              {editingStation?.name}
            </div>
            <div className="text-slate-500">
              Type:{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {editingStation?.type}
              </span>{' '}
              • District:{' '}
              <span className="font-semibold text-[#147D84]">
                {editingStation?.districtName || user?.districtName}
              </span>
            </div>
          </div>

          <div>
            <Input
              label="Official Contact Number (CUG / Landline / Mobile)"
              type="text"
              value={newStationPhone}
              onChange={(e) => setNewStationPhone(e.target.value)}
              placeholder="e.g. 05222200000 or 9454400000"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Enter 6-15 digit official number or STD code. This number will be displayed on the directory for all police personnel.
            </p>
          </div>
        </form>
      </Modal>

      {/* Add New Departmental Office Modal */}
      <Modal
        isOpen={addOfficeModalOpen}
        onClose={() => {
          if (!addingOffice) setAddOfficeModalOpen(false);
        }}
        title="Add New Departmental Office (नया कार्यालय जोड़ें)"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="ghost"
              onClick={() => setAddOfficeModalOpen(false)}
              disabled={addingOffice}
              aria-label="Cancel adding office"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateOffice}
              disabled={addingOffice}
              aria-label="Create Office"
              className="bg-[#17324F] font-bold"
            >
              {addingOffice ? 'Creating...' : 'Create Office'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateOffice} className="space-y-4">
          <div className="p-3 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-xl text-xs text-teal-900 dark:text-teal-200">
            <strong>Co-Admin / Super Admin Authority:</strong> Establish new departmental branches, circle offices, police lines sections, or specialized units in your jurisdiction. Police Station (थाना) establishment is regulated at the State Headquarters level.
          </div>

          {isSuperAdmin && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Command District *
              </label>
              <select
                value={newOfficeDistrictId}
                onChange={(e) => setNewOfficeDistrictId(e.target.value)}
                required
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#17324F]"
              >
                <option value="">Select District...</option>
                {allDistricts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.stateCode})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Input
              label="Office Name (कार्यालय का नाम) *"
              type="text"
              value={newOfficeName}
              onChange={(e) => setNewOfficeName(e.target.value)}
              placeholder="e.g. Circle Office Sadar, Cyber Cell, Traffic Branch"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Classification / Office Type *
            </label>
            <select
              value={newOfficeType}
              onChange={(e) => setNewOfficeType(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#17324F]"
            >
              <option value="CIRCLE_OFFICE">Circle Office / CO (सर्किल / वृत्ताधिकारी कार्यालय)</option>
              <option value="SP_OFFICE">SP Office / Branch (पुलिस अधीक्षक कार्यालय / शाखा)</option>
              <option value="LINE">Police Lines / Reserve (रिजर्व पुलिस लाइन्स / गणना)</option>
              <option value="TRAFFIC">Traffic Police Branch (यातायात पुलिस इकाई)</option>
              <option value="OTHER">Other Departmental Unit / Special Cell (अन्य / विशेष शाखा)</option>
            </select>
          </div>

          <div>
            <Input
              label="Official Contact Number (Optional)"
              type="text"
              value={newOfficePhone}
              onChange={(e) => setNewOfficePhone(e.target.value)}
              placeholder="e.g. 05222200000 or 9454400000"
            />
          </div>

          <div>
            <Input
              label="Location / Office Address (Optional)"
              type="text"
              value={newOfficeAddress}
              onChange={(e) => setNewOfficeAddress(e.target.value)}
              placeholder="e.g. Collectorate Compound / Police Lines Road"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
