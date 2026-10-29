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
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '@police-directory/shared';
import { ExcelImport } from './ExcelImport';

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

  // Password reset modal state
  const [resetModalUserId, setResetModalUserId] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

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
  }, []);

  const loadTabContent = async (tab: string) => {
    setActiveTab(tab);
    try {
      if (tab === 'approvals') {
        const res = await api.getPendingUsers();
        setPendingUsers(res.pendingUsers || []);
      } else if (tab === 'users') {
        const res = await api.getUsers();
        setUsersList(res.users || []);
      } else if (tab === 'transfers') {
        const res = await api.getTransfers();
        setTransfers(res.transfers || []);
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
      }
    } catch (err) {
      console.error(err);
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

  const handleReviewTransfer = async (transferId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      await api.reviewTransfer({ transferId, action });
      loadTabContent('transfers');
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

        {/* Super Admin Privileged Tabs */}
        {isSuperAdmin && (
          <>
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
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Personnel Directory Administration
          </h3>
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold text-slate-500 uppercase">
                <tr>
                  <th className="p-3">PNO</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Designation</th>
                  <th className="p-3">District & Station</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {usersList.map((u) => (
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
                      <Badge variant={u.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
                        {u.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right space-x-1">
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

      {/* Tab: Transfers Review */}
      {activeTab === 'transfers' && (
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 rounded-xl text-xs text-blue-900 dark:text-blue-200 font-medium">
            Transfer Approval Precedence: Either the <strong>Destination District Co-Admin</strong> or the <strong>Super Admin</strong> may approve a transfer into the destination post.
          </div>

          {transfers.length === 0 ? (
            <Card className="p-8 text-center text-slate-400 text-xs">
              No transfer requests in this queue.
            </Card>
          ) : (
            transfers.map((tr) => (
              <Card key={tr.id} className="p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {tr.userName} ({tr.userDesignation})
                    </h4>
                    <span className="text-xs font-mono text-slate-400">PNO: {tr.userPno}</span>
                    <Badge variant={tr.status === 'APPROVED' ? 'success' : tr.status === 'REJECTED' ? 'danger' : 'warning'} size="sm">
                      {tr.status}
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    Route: <strong className="text-slate-800 dark:text-slate-200">{tr.sourceStationName}, {tr.sourceDistrictName}</strong> ➔ <strong className="text-[#147D84]">{tr.destinationStationName}, {tr.destinationDistrictName}</strong>
                  </p>

                  <p className="text-xs text-slate-500 mt-0.5">
                    Reason: {tr.reason} {tr.order_reference ? `(Ref: ${tr.order_reference})` : ''}
                  </p>
                </div>

                {tr.status === 'PENDING' && (
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
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {/* Tab: Excel Bulk Import */}
      {activeTab === 'excel' && <ExcelImport />}

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
    </div>
  );
};
