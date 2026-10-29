import { Role, UserStatus, TransferStatus, NoticeUrgency, NoticeScope } from '../constants';

export interface User {
  id: string;
  pno: string;
  fullName: string;
  designationId: string;
  designationName?: string;
  designationShort?: string;
  districtId: string;
  districtName?: string;
  stationOfficeId: string;
  stationOfficeName?: string;
  mobile: string;
  whatsapp?: string | null;
  email?: string | null;
  status: UserStatus;
  photoUrl?: string | null;
  role: Role;
  mfaEnabled: boolean;
  termsAcceptedVersion?: string | null;
  termsAcceptedAt?: string | null;
  notificationPref?: string;
  createdAt: string;
  updatedAt: string;
}

export interface District {
  id: string;
  code: string;
  name: string;
  zone?: string | null;
  range?: string | null;
  isActive: boolean;
}

export interface StationOffice {
  id: string;
  districtId: string;
  name: string;
  type: 'POLICE_STATION' | 'CIRCLE_OFFICE' | 'SP_OFFICE' | 'LINE' | 'TRAFFIC' | 'OTHER';
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
}

export interface Designation {
  id: string;
  code: string;
  name: string;
  shortName: string;
  rankOrder: number;
  isActive: boolean;
}

export interface TransferRequest {
  id: string;
  userId: string;
  userName?: string;
  userPno?: string;
  userDesignation?: string;
  sourceDistrictId: string;
  sourceDistrictName?: string;
  sourceStationId: string;
  sourceStationName?: string;
  destinationDistrictId: string;
  destinationDistrictName?: string;
  destinationStationId: string;
  destinationStationName?: string;
  reason: string;
  orderReference?: string | null;
  status: TransferStatus;
  approvedBy?: string | null;
  approverName?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Policy {
  id: string;
  version: string;
  titleEn: string;
  titleHi: string;
  contentEn: string;
  contentHi: string;
  type: 'TERMS' | 'PRIVACY' | 'DISCLAIMER' | 'SECURITY';
  isActive: boolean;
  publishedAt: string;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  urgency: NoticeUrgency;
  targetScope: NoticeScope;
  targetDistrictId?: string | null;
  targetDistrictName?: string | null;
  attachmentUrl?: string | null;
  isPublished: boolean;
  publishedBy: string;
  publisherName?: string;
  publishedRole?: string;
  expiresAt?: string | null;
  createdAt: string;
  isRead?: boolean;
  readAt?: string | null;
  isAcknowledged?: boolean;
  acknowledgedAt?: string | null;
}

export interface Conversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  title?: string | null;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: Message | null;
  unreadCount?: number;
  members?: ConversationMember[];
}

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  userName: string;
  userRank: string;
  userDistrict: string;
  role: 'MEMBER' | 'ADMIN';
  joinedAt: string;
  lastReadMessageId?: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  senderPno?: string;
  sequenceNum: number;
  content: string;
  messageType: 'TEXT' | 'IMAGE' | 'DOCUMENT';
  attachmentUrl?: string | null;
  attachmentMeta?: string | null;
  isDeleted: boolean;
  createdAt: string;
  deliveredTo?: string[];
  readBy?: string[];
}

export interface DeviceSession {
  id: string;
  userId: string;
  platform: 'ANDROID' | 'WEB' | 'IOS';
  deviceName?: string | null;
  osVersion?: string | null;
  appVersion?: string | null;
  pushToken?: string | null;
  isActive: boolean;
  lastSeenAt: string;
  createdAt: string;
  isCurrentSession?: boolean;
}

export interface AuditLogEntry {
  id: string;
  actorId?: string;
  actorPno?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  districtScope?: string;
  beforeStateJson?: string;
  afterStateJson?: string;
  ipAddress?: string;
  status: string;
  createdAt: string;
}

export interface ExcelImportJob {
  id: string;
  adminId: string;
  districtId?: string | null;
  fileName: string;
  status: 'PARSED' | 'PREVIEW' | 'COMMITTED' | 'ROLLED_BACK' | 'FAILED';
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  rejectedCount: number;
  errorReport?: string | null;
  createdAt: string;
  committedAt?: string | null;
}

export interface ExcelImportRowPreview {
  rowIndex: number;
  pno: string;
  name: string;
  post: string;
  district: string;
  office: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  status: string;
  remarks?: string;
  isValid: boolean;
  errors: string[];
}
