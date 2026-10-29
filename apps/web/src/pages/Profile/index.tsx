import React, { useState, useEffect } from 'react';
import { Card, Avatar, Button, Input, Modal, Badge } from '@police-directory/ui';
import {
  LogOut,
  Moon,
  Sun,
  Globe,
  Smartphone,
  ArrowRightLeft,
  Shield,
  Trash2,
  Check,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const { isDarkMode, toggleTheme } = useTheme();

  const [devices, setDevices] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);

  // Transfer modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [destDistrict, setDestDistrict] = useState('');
  const [destStation, setDestStation] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);

  useEffect(() => {
    // Load active devices
    api.getDevices().then((res) => {
      // Filter own devices if regular user
      const list = res.devices ? res.devices.filter((d: any) => d.user_id === user?.id) : [];
      setDevices(list);
    }).catch(() => {});

    api.getDistricts().then((res) => setDistricts(res.districts || []));
  }, [user?.id]);

  useEffect(() => {
    if (destDistrict) {
      api.getStations(destDistrict).then((res) => setStations(res.stations || []));
    } else {
      setStations([]);
      setDestStation('');
    }
  }, [destDistrict]);

  const handleRevokeDevice = async (deviceId: string) => {
    try {
      await api.revokeDevice(deviceId);
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    } catch (err: any) {
      alert(err.message || 'Failed to revoke device');
    }
  };

  const handleRequestTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destDistrict || !destStation || !transferReason.trim()) return;

    setTransferSubmitting(true);
    try {
      const res = await api.createTransfer({
        destinationDistrictId: destDistrict,
        destinationStationId: destStation,
        reason: transferReason.trim(),
        orderReference: orderRef.trim() || undefined,
      });
      setTransferMessage(res.message);
      setShowTransferModal(false);
    } catch (err: any) {
      alert(err.message || 'Transfer request failed');
    } finally {
      setTransferSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-24 md:pb-8 space-y-4">
      {/* Profile Header Card */}
      <Card className="p-6 text-center sm:text-left sm:flex sm:items-center sm:gap-6 shadow-sm">
        <div className="flex justify-center sm:block mb-3 sm:mb-0">
          <Avatar
            src={user.photoUrl}
            name={user.fullName}
            size="xl"
            isOnline={true}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">
              {user.fullName}
            </h2>
            <Badge variant="teal" size="sm">
              {user.role}
            </Badge>
          </div>

          <p className="text-xs sm:text-sm font-semibold text-[#147D84] dark:text-teal-400">
            {user.designationName || 'Designation'} • {user.stationOfficeName || 'Station'}, {user.districtName || 'District'}
          </p>

          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
            <p>
              PNO: <strong className="font-mono text-slate-800 dark:text-slate-200">{user.pno}</strong>
            </p>
            <p>
              Mobile: <strong className="font-mono text-slate-800 dark:text-slate-200">{user.mobile}</strong>
            </p>
          </div>
        </div>

        <div className="mt-4 sm:mt-0 flex sm:flex-col gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTransferModal(true)}
            aria-label="Request transfer to another district or station"
            icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
            className="text-xs font-semibold rounded-xl"
          >
            Request Transfer
          </Button>
        </div>
      </Card>

      {transferMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
          <Check className="w-4 h-4 shrink-0" />
          <span>{transferMessage}</span>
        </div>
      )}

      {/* Preferences & Settings */}
      <Card className="p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          Preferences & Controls
        </h3>

        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Globe className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              UI Language ({language === 'en' ? 'English' : 'हिंदी'})
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            aria-label="Toggle UI language"
            className="text-xs font-bold rounded-lg px-3 py-1"
          >
            {language === 'en' ? 'हिंदी में बदलें' : 'Switch to English'}
          </Button>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Appearance ({isDarkMode ? 'Dark Navy' : 'Light'})
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            aria-label="Toggle dark mode theme"
            className="text-xs font-bold rounded-lg px-3 py-1"
          >
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </Button>
        </div>
      </Card>

      {/* Active Device Sessions */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active Device Sessions
          </h3>
          <span className="text-[11px] text-slate-500">Security Verified</span>
        </div>

        <div className="space-y-2">
          {devices.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Current browser session active.</p>
          ) : (
            devices.map((dev) => (
              <div
                key={dev.id}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80"
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-slate-500" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {dev.platform} • {dev.device_name || 'Standard Client'}
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Last seen: {new Date(dev.last_seen_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRevokeDevice(dev.id)}
                  aria-label="Revoke device session"
                  title="Remote Revoke"
                  className="w-8 h-8 rounded-full text-slate-400 hover:text-red-500 p-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Logout */}
      <div className="pt-2">
        <Button
          variant="danger"
          onClick={logout}
          aria-label="Log out of official police portal"
          icon={<LogOut className="w-4 h-4" />}
          className="w-full font-bold py-3 rounded-2xl shadow-sm"
        >
          {language === 'hi' ? 'सुरक्षित लॉग आउट' : 'Secure Logout'}
        </Button>
      </div>

      {/* Request Transfer Modal */}
      <Modal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        title="Request District / Office Transfer"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="ghost"
              onClick={() => setShowTransferModal(false)}
              aria-label="Cancel transfer request"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleRequestTransfer}
              loading={transferSubmitting}
              disabled={!destDistrict || !destStation || !transferReason.trim()}
              aria-label="Submit transfer request"
              className="bg-[#17324F] font-bold"
            >
              Submit Transfer Request
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-900 dark:text-blue-200 leading-relaxed font-medium">
            Transfer requests require single authorization from the <strong>Destination District Co-Admin</strong> or the <strong>Super Admin</strong>.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Destination District
            </label>
            <select
              value={destDistrict}
              onChange={(e) => setDestDistrict(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
              required
            >
              <option value="">Select Target District</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Destination Station / Office
            </label>
            <select
              value={destStation}
              onChange={(e) => setDestStation(e.target.value)}
              disabled={!destDistrict}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium disabled:opacity-50"
              required
            >
              <option value="">Select Target Station</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Departmental Order Reference (Optional)"
            value={orderRef}
            onChange={(e) => setOrderRef(e.target.value)}
            placeholder="e.g. PHQ-TRS-2026-908"
            englishOnlyNotice
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Justification / Reason
            </label>
            <textarea
              rows={3}
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="State the formal reasons for posting transfer..."
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#17324F]"
              required
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
