import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Modal, Input } from '@police-directory/ui';
import { Bell, AlertTriangle, CheckCircle, Plus, Eye, Check } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { ROLES } from '@police-directory/shared';

export const Notices: React.FC = () => {
  const { user } = useAuth();
  const { language } = useLanguage();

  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeData, setComposeData] = useState({
    title: '',
    body: '',
    urgency: 'NORMAL',
    targetScope: user?.role === ROLES.SUPER_ADMIN ? 'STATEWIDE' : 'DISTRICT',
  });

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const res = await api.getNotices();
      setNotices(res.notices || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleOpenNotice = async (notice: any) => {
    if (!notice.isRead) {
      await api.markNoticeRead(notice.id);
      setNotices((prev) =>
        prev.map((n) => (n.id === notice.id ? { ...n, isRead: true } : n))
      );
    }
  };

  const handleAcknowledge = async (noticeId: string) => {
    try {
      await api.acknowledgeNotice(noticeId);
      setNotices((prev) =>
        prev.map((n) =>
          n.id === noticeId ? { ...n, isAcknowledged: true, isRead: true } : n
        )
      );
    } catch (err: any) {
      alert(err.message || 'Failed to acknowledge order');
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeData.title.trim() || !composeData.body.trim()) return;

    try {
      await api.publishNotice({
        ...composeData,
        targetDistrictId: user?.districtId,
      });
      setShowComposeModal(false);
      setComposeData({
        title: '',
        body: '',
        urgency: 'NORMAL',
        targetScope: user?.role === ROLES.SUPER_ADMIN ? 'STATEWIDE' : 'DISTRICT',
      });
      fetchNotices();
    } catch (err: any) {
      alert(err.message || 'Failed to publish notice');
    }
  };

  const canPublish = user?.role === ROLES.SUPER_ADMIN || user?.role === ROLES.DISTRICT_CO_ADMIN;

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            {language === 'hi' ? 'विभागीय आदेश एवं सूचनाएं' : 'Departmental Orders & Notices'}
          </h2>
          <p className="text-xs text-slate-500">
            {language === 'hi'
              ? 'आधिकारिक परिपत्र एवं अनुपालन आदेश'
              : 'Official circulars, duty rosters & compliance orders'}
          </p>
        </div>

        {canPublish && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowComposeModal(true)}
            aria-label="Publish new departmental notice"
            icon={<Plus className="w-4 h-4" />}
            className="rounded-xl font-bold bg-[#17324F]"
          >
            {language === 'hi' ? 'नया आदेश जारी करें' : 'Publish Order'}
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="w-8 h-8 border-3 border-[#17324F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notices.length === 0 ? (
          <Card className="text-center py-16">
            <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No orders or notices
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Official circulars from headquarters or district command will appear here.
            </p>
          </Card>
        ) : (
          notices.map((n) => {
            const urgencyBadge =
              n.urgency === 'CRITICAL'
                ? 'danger'
                : n.urgency === 'URGENT'
                ? 'warning'
                : 'primary';

            return (
              <Card
                key={n.id}
                onClick={() => handleOpenNotice(n)}
                className={`p-4 sm:p-5 transition-all ${
                  !n.isRead
                    ? 'border-l-4 border-l-[#147D84] bg-teal-50/20 dark:bg-teal-950/20'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={urgencyBadge} size="sm">
                      {n.urgency}
                    </Badge>
                    <Badge variant="neutral" size="sm">
                      {n.target_scope}
                    </Badge>
                    <span className="text-[11px] text-slate-400">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {n.isRead && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Eye className="w-3.5 h-3.5" /> Read
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-1.5">
                  {n.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed mb-4">
                  {n.body}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-[11px] text-slate-500">
                    Issued by: <strong className="text-slate-700 dark:text-slate-300">{n.publisherName} ({n.publisherRank})</strong>
                  </span>

                  {n.isAcknowledged ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      <Check className="w-4 h-4" /> Formally Acknowledged
                    </span>
                  ) : (
                    <Button
                      variant="teal"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAcknowledge(n.id);
                      }}
                      aria-label="Formally acknowledge departmental order"
                      icon={<CheckCircle className="w-3.5 h-3.5" />}
                      className="text-xs px-3 py-1 font-bold rounded-lg"
                    >
                      {language === 'hi' ? 'आदेश पावती दें' : 'Acknowledge Receipt'}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Compose Notice Modal */}
      <Modal
        isOpen={showComposeModal}
        onClose={() => setShowComposeModal(false)}
        title="Publish Departmental Notice / Order"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="ghost"
              onClick={() => setShowComposeModal(false)}
              aria-label="Cancel notice creation"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handlePublish}
              aria-label="Publish notice"
              className="bg-[#17324F] font-bold"
            >
              Publish Now
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            label="Notice / Order Subject"
            value={composeData.title}
            onChange={(e) => setComposeData({ ...composeData, title: e.target.value })}
            placeholder="e.g. VIP Route Security Protocol"
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Urgency Level
            </label>
            <select
              value={composeData.urgency}
              onChange={(e) => setComposeData({ ...composeData, urgency: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
            >
              <option value="NORMAL">NORMAL</option>
              <option value="URGENT">URGENT</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Order Content (Hindi/English permitted)
            </label>
            <textarea
              rows={5}
              value={composeData.body}
              onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
              placeholder="Enter comprehensive instructions, duty guidelines, and order references..."
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#17324F]"
              required
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
