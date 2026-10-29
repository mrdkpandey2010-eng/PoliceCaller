import { Role, ROLES } from '../constants';

export interface AuthContext {
  userId: string;
  pno: string;
  role: Role;
  districtId: string;
  stationOfficeId: string;
  status: string;
}

export const RBAC = {
  canApproveUser(actor: AuthContext, targetDistrictId: string): boolean {
    if (actor.role === ROLES.SUPER_ADMIN) return true;
    if (actor.role === ROLES.DISTRICT_CO_ADMIN) {
      return actor.districtId === targetDistrictId;
    }
    return false;
  },

  canEditUser(actor: AuthContext, targetUserId: string, targetDistrictId: string): boolean {
    if (actor.role === ROLES.SUPER_ADMIN) return true;
    if (actor.role === ROLES.DISTRICT_CO_ADMIN) {
      return actor.districtId === targetDistrictId;
    }
    return actor.userId === targetUserId;
  },

  canResetPassword(actor: AuthContext, targetUserRole: Role, targetDistrictId: string): boolean {
    if (actor.role === ROLES.SUPER_ADMIN) return true;
    if (actor.role === ROLES.DISTRICT_CO_ADMIN) {
      // Co-Admin can only reset normal USERs in their own assigned district (never Co-Admin or Super Admin)
      return targetUserRole === ROLES.USER && actor.districtId === targetDistrictId;
    }
    return false;
  },

  canManageCoAdmins(actor: AuthContext): boolean {
    return actor.role === ROLES.SUPER_ADMIN;
  },

  /**
   * Transfer Approval Precedence Rule:
   * Single approval by Super Admin OR Destination district Co-Admin.
   * Source district Co-Admin cannot approve merely due to current district.
   */
  canApproveTransfer(actor: AuthContext, destinationDistrictId: string, sourceDistrictId: string): boolean {
    if (actor.role === ROLES.SUPER_ADMIN) return true;
    if (actor.role === ROLES.DISTRICT_CO_ADMIN) {
      // Destination Co-Admin is authorized
      if (actor.districtId === destinationDistrictId) return true;
      // Source Co-Admin is strictly forbidden if they do not match destination district
      return false;
    }
    return false;
  },

  canManageMasters(actor: AuthContext): boolean {
    return actor.role === ROLES.SUPER_ADMIN;
  },

  canConfigureBackups(actor: AuthContext): boolean {
    return actor.role === ROLES.SUPER_ADMIN;
  },

  canManagePolicies(actor: AuthContext): boolean {
    return actor.role === ROLES.SUPER_ADMIN;
  },

  canViewAllDeviceLogs(actor: AuthContext): boolean {
    return actor.role === ROLES.SUPER_ADMIN;
  },

  canPublishNotice(actor: AuthContext, targetScope: string, targetDistrictId?: string | null): boolean {
    if (actor.role === ROLES.SUPER_ADMIN) return true;
    if (actor.role === ROLES.DISTRICT_CO_ADMIN) {
      // Co-Admin can only publish to their OWN district users
      return targetScope === 'DISTRICT' && targetDistrictId === actor.districtId;
    }
    return false;
  },

  canExcelBulkImport(actor: AuthContext, targetDistrictId?: string | null): boolean {
    if (actor.role === ROLES.SUPER_ADMIN) return true;
    if (actor.role === ROLES.DISTRICT_CO_ADMIN) {
      return actor.districtId === targetDistrictId;
    }
    return false;
  },

  canAccessMessenger(actor: AuthContext): boolean {
    return actor.status === 'ACTIVE';
  },

  canAccessDirectory(actor: AuthContext): boolean {
    return actor.status === 'ACTIVE';
  },
};
