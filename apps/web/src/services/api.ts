const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') + '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('police_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP error ${res.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  lookupIdentifier: (identifier: string) =>
    request('/auth/lookup', { method: 'POST', body: JSON.stringify({ identifier }) }),

  login: (credentials: { pno?: string; mobile?: string; identifier?: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),

  register: (userData: any) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  me: () => request('/auth/me'),

  acceptTerms: (version: string) =>
    request('/auth/terms/accept', { method: 'POST', body: JSON.stringify({ version }) }),

  updateNotificationPref: (status: 'GRANTED' | 'DENIED' | 'UNSUPPORTED') =>
    request('/auth/notification-pref', { method: 'POST', body: JSON.stringify({ status }) }),

  // Directory
  getContacts: (params: Record<string, any> = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, String(v));
      }
    });
    return request(`/directory?${searchParams.toString()}`);
  },

  toggleFavorite: (targetUserId: string) =>
    request(`/directory/favorites/${targetUserId}/toggle`, { method: 'POST' }),

  getRecentSearches: () => request('/directory/recent-searches'),

  clearRecentSearches: () => request('/directory/recent-searches', { method: 'DELETE' }),

  // Chat
  getConversations: () => request('/chat/conversations'),

  createConversation: (payload: { type: 'DIRECT' | 'GROUP'; participantId?: string; groupTitle?: string; memberIds?: string[] }) =>
    request('/chat/conversations', { method: 'POST', body: JSON.stringify(payload) }),

  getMessages: (conversationId: string) => request(`/chat/messages/${conversationId}`),

  sendMessage: (payload: { conversationId: string; content: string; messageType?: string }) =>
    request('/chat/messages', { method: 'POST', body: JSON.stringify(payload) }),

  deleteForMe: (messageId: string) =>
    request(`/chat/messages/${messageId}/delete-for-me`, { method: 'POST' }),

  deleteConversationForMe: (conversationId: string) =>
    request(`/chat/conversations/${conversationId}/delete-for-me`, { method: 'POST' }),

  pingPresence: () => request('/chat/presence/heartbeat', { method: 'POST' }),

  getUserPresence: (userId: string) => request(`/chat/presence/${userId}`),

  broadcastTyping: (conversationId: string) =>
    request('/chat/typing', { method: 'POST', body: JSON.stringify({ conversationId }) }),

  getTypingUsers: (conversationId: string) => request(`/chat/typing/${conversationId}`),

  getConversationMembers: (conversationId: string) =>
    request(`/chat/conversations/${conversationId}/members`),

  leaveConversation: (conversationId: string) =>
    request(`/chat/conversations/${conversationId}/leave`, { method: 'POST' }),

  // Notices
  getNotices: () => request('/notices'),

  publishNotice: (notice: any) => request('/notices', { method: 'POST', body: JSON.stringify(notice) }),

  markNoticeRead: (noticeId: string) =>
    request(`/notices/${noticeId}/read`, { method: 'POST' }),

  acknowledgeNotice: (noticeId: string) =>
    request(`/notices/${noticeId}/acknowledge`, { method: 'POST' }),

  getNoticeReport: (noticeId: string) => request(`/notices/${noticeId}/report`),

  // Transfers
  getTransfers: () => request('/transfers'),

  createTransfer: (payload: any) =>
    request('/transfers', { method: 'POST', body: JSON.stringify(payload) }),

  reviewTransfer: (payload: { transferId: string; action: 'APPROVE' | 'REJECT'; rejectionReason?: string }) =>
    request('/transfers/review', { method: 'POST', body: JSON.stringify(payload) }),

  // Admin
  getMetrics: () => request('/admin/metrics'),

  getPendingUsers: () => request('/admin/pending-users'),

  reviewUser: (payload: { targetUserId: string; action: 'APPROVE' | 'REJECT'; rejectionReason?: string }) =>
    request('/admin/review-user', { method: 'POST', body: JSON.stringify(payload) }),

  getUsers: (params: Record<string, any> = {}) => {
    const searchParams = new URLSearchParams(params as any);
    return request(`/admin/users?${searchParams.toString()}`);
  },

  setUserStatus: (userId: string, status: 'ACTIVE' | 'INACTIVE') =>
    request(`/admin/users/${userId}/status`, { method: 'POST', body: JSON.stringify({ status }) }),

  updateUserDetails: (userId: string, data: { fullName?: string; mobile?: string; designationId?: string; whatsapp?: string; email?: string }) =>
    request(`/admin/users/${userId}/details`, { method: 'PUT', body: JSON.stringify(data) }),

  resetUserPassword: (userId: string, newPassword?: string) =>
    request(`/admin/users/${userId}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),

  getCoAdmins: () => request('/admin/coadmins'),

  assignCoAdmin: (userId: string) =>
    request(`/admin/coadmins/${userId}/assign`, { method: 'POST' }),

  getDevices: () => request('/admin/devices'),

  revokeDevice: (deviceId: string) =>
    request(`/admin/devices/${deviceId}/revoke`, { method: 'POST' }),

  getAuditLogs: () => request('/admin/audit-logs'),

  getBackupStatus: () => request('/admin/backup/status'),

  triggerBackup: () => request('/admin/backup/trigger', { method: 'POST' }),

  restoreBackup: (backupJobId: string) =>
    request('/admin/backup/restore-rehearsal', { method: 'POST', body: JSON.stringify({ backupJobId }) }),

  // Excel
  excelDryRun: (payload: { fileName: string; headers: string[]; rows: any[] }) =>
    request('/admin/excel/dry-run', { method: 'POST', body: JSON.stringify(payload) }),

  excelCommit: (payload: { jobId: string; validRows: any[] }) =>
    request('/admin/excel/commit', { method: 'POST', body: JSON.stringify(payload) }),

  excelRollback: (jobId: string) =>
    request('/admin/excel/rollback', { method: 'POST', body: JSON.stringify({ jobId }) }),

  // Masters
  getDistricts: () => request('/masters/districts'),

  getStations: (districtId?: string) =>
    request(`/masters/stations${districtId ? `?districtId=${districtId}` : ''}`),

  getDesignations: () => request('/masters/designations'),

  getPolicies: (type: string = 'TERMS') => request(`/masters/policies?type=${type}`),
};
