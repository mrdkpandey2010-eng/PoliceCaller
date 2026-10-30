import React, { useState, useEffect } from 'react';
import { Card, Avatar, Button, Input, Modal, Badge } from '@police-directory/ui';
import { LogOut, ArrowRightLeft, Check } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const { language } = useLanguage();

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
    api.getDistricts().then((res) => setDistricts(res.districts || []));
  }, []);

  useEffect(() => {
    if (destDistrict) {
      api.getStations(destDistrict).then((res) => setStations(res.stations || []));
    } else {
      setStations([]);
      setDestStation('');
    }
  }, [destDistrict]);

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
