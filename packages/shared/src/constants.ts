export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  DISTRICT_CO_ADMIN: 'DISTRICT_CO_ADMIN',
  USER: 'USER',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const USER_STATUS = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  REJECTED: 'REJECTED',
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const TRANSFER_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type TransferStatus = (typeof TRANSFER_STATUS)[keyof typeof TRANSFER_STATUS];

export const NOTICE_URGENCY = {
  NORMAL: 'NORMAL',
  URGENT: 'URGENT',
  CRITICAL: 'CRITICAL',
} as const;

export type NoticeUrgency = (typeof NOTICE_URGENCY)[keyof typeof NOTICE_URGENCY];

export const NOTICE_SCOPE = {
  STATEWIDE: 'STATEWIDE',
  DISTRICT: 'DISTRICT',
  CO_ADMINS: 'CO_ADMINS',
  CUSTOM: 'CUSTOM',
} as const;

export type NoticeScope = (typeof NOTICE_SCOPE)[keyof typeof NOTICE_SCOPE];

export const DESIGN_TOKENS = {
  colors: {
    primaryNavy: '#17324F',
    deepNavy: '#10243B',
    accentTeal: '#147D84',
    subtleKhaki: '#C3A35E',
    khakiHover: '#A68538',
    surfaceLight: '#F8FAFC',
    cardLight: '#FFFFFF',
    borderLight: '#E2E8F0',
    textMain: '#0F172A',
    textMuted: '#64748B',
  },
  touchTargetMin: '44px',
};
