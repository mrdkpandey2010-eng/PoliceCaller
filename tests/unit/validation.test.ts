import { describe, it, expect } from 'vitest';
import {
  EnglishNameSchema,
  PnoSchema,
  MobileSchema,
  validateExcelHeaders,
  ExcelRowSchema,
  RBAC,
  ROLES,
  AuthContext,
} from '../../packages/shared/src';

describe('Strict English-Only Structured Data Validation', () => {
  it('accepts valid English names with allowed punctuation', () => {
    expect(EnglishNameSchema.parse('Rajesh Kumar')).toBe('Rajesh Kumar');
    expect(EnglishNameSchema.parse('A.K. Singh')).toBe('A.K. Singh');
    expect(EnglishNameSchema.parse("O'Neil")).toBe("O'Neil");
    expect(EnglishNameSchema.parse('Mohd. Irfan-ul-Haq')).toBe('Mohd. Irfan-ul-Haq');
    expect(EnglishNameSchema.parse('  Vikram   Aditya  ')).toBe('Vikram Aditya');
  });

  it('rejects Hindi / Devanagari and non-Latin names with explicit error', () => {
    expect(() => EnglishNameSchema.parse('राजेश कुमार')).toThrowError(
      /Name must be entered in English letters only/
    );
    expect(() => EnglishNameSchema.parse('Rajesh कुमार')).toThrowError(
      /Name must be entered in English letters only/
    );
    expect(() => EnglishNameSchema.parse('李小龙')).toThrowError(
      /Name must be entered in English letters only/
    );
  });

  it('rejects names with numbers, emojis, and zero-width characters', () => {
    expect(() => EnglishNameSchema.parse('Inspector 007')).toThrowError();
    expect(() => EnglishNameSchema.parse('Rajesh 👮 Singh')).toThrowError();
    expect(() => EnglishNameSchema.parse('Rajesh\u200BKumar')).toThrowError();
  });

  it('validates PNO as a string of exactly 9 or 10 digits and preserves leading zeros (V4.6)', () => {
    expect(PnoSchema.parse('001234567')).toBe('001234567'); // 9 digits with leading zeros
    expect(PnoSchema.parse('0098765432')).toBe('0098765432'); // 10 digits with leading zeros
    expect(PnoSchema.parse('9876543210')).toBe('9876543210'); // 10 digits (gazetted officer PNO=mobile)
  });

  it('rejects scientific notation, decimals, non-digits, and invalid lengths (8, 11) in PNO (V4.6)', () => {
    expect(() => PnoSchema.parse('1.23E+07')).toThrowError();
    expect(() => PnoSchema.parse('123456.78')).toThrowError();
    expect(() => PnoSchema.parse('PNO123456')).toThrowError();
    expect(() => PnoSchema.parse('१२३४५६७८९')).toThrowError(); // Hindi numerals
    expect(() => PnoSchema.parse('12345678')).toThrowError(); // Length 8 (rejected)
    expect(() => PnoSchema.parse('12345678901')).toThrowError(); // Length 11 (rejected)
  });

  it('validates exactly 10-digit ASCII mobile numbers (V4.6)', () => {
    expect(MobileSchema.parse('9876543210')).toBe('9876543210');
    expect(MobileSchema.parse('6234567890')).toBe('6234567890');
    expect(MobileSchema.parse('7012345678')).toBe('7012345678');
    expect(MobileSchema.parse('1234567890')).toBe('1234567890'); // 10 digits
    expect(MobileSchema.parse('0012345678')).toBe('0012345678'); // 10 digits with leading zero
  });

  it('rejects invalid mobile numbers, country codes, spaces, or letters (V4.6)', () => {
    expect(() => MobileSchema.parse('+919876543210')).toThrowError();
    expect(() => MobileSchema.parse('98765 43210')).toThrowError();
    expect(() => MobileSchema.parse('987654321')).toThrowError(); // 9 digits
    expect(() => MobileSchema.parse('98765432101')).toThrowError(); // 11 digits
    expect(() => MobileSchema.parse('९८७६५४३२१०')).toThrowError(); // Devanagari digits
  });
});

describe('Excel Header and Row Validation', () => {
  it('accepts correct English headers', () => {
    const validHeaders = ['PNO', 'Name', 'Post', 'District', 'Office', 'Phone', 'WhatsApp', 'Email', 'Status', 'Remarks'];
    const result = validateExcelHeaders(validHeaders);
    expect(result.valid).toBe(true);
    expect(result.missingHeaders).toHaveLength(0);
  });

  it('rejects missing or non-English headers or forbidden columns', () => {
    const invalidHeaders = ['PNO', 'नाम', 'Post', 'District'];
    const result = validateExcelHeaders(invalidHeaders);
    expect(result.valid).toBe(false);

    const forbiddenHeaders = ['PNO', 'Name', 'Post', 'District', 'Office', 'Phone', 'WhatsApp', 'Email', 'Status', 'Remarks', 'Hide_Phone'];
    const forbiddenResult = validateExcelHeaders(forbiddenHeaders);
    expect(forbiddenResult.valid).toBe(false);
  });

  it('validates a correct Excel row', () => {
    const row = {
      PNO: '009876543',
      Name: 'Ajay Pratap Singh',
      Post: 'Inspector',
      District: 'Lucknow',
      Office: 'PS Hazratganj',
      Phone: '9876543210',
      WhatsApp: '9876543210',
      Email: 'ajay.singh@uppolice.gov.in',
      Status: 'ACTIVE',
      Remarks: 'Verified service record',
    };
    const parsed = ExcelRowSchema.parse(row);
    expect(parsed.PNO).toBe('009876543');
    expect(parsed.Name).toBe('Ajay Pratap Singh');
  });

  it('rejects Excel row with Devanagari name or scientific notation PNO', () => {
    const badRow = {
      PNO: '1.23E+07',
      Name: 'अजय प्रताप सिंह',
      Post: 'Inspector',
      District: 'Lucknow',
      Office: 'PS Hazratganj',
      Phone: '9876543210',
      Status: 'ACTIVE',
    };
    expect(() => ExcelRowSchema.parse(badRow)).toThrowError();
  });
});

describe('Authoritative RBAC Matrix & Transfer Precedence', () => {
  const superAdmin: AuthContext = {
    userId: 'usr_super',
    pno: '00000001',
    role: ROLES.SUPER_ADMIN,
    districtId: 'dist_lucknow',
    stationOfficeId: 'stn_lko_sp_office',
    status: 'ACTIVE',
  };

  const lkoCoAdmin: AuthContext = {
    userId: 'usr_co_lko',
    pno: '00000002',
    role: ROLES.DISTRICT_CO_ADMIN,
    districtId: 'dist_lucknow',
    stationOfficeId: 'stn_lko_sp_office',
    status: 'ACTIVE',
  };

  const vnsCoAdmin: AuthContext = {
    userId: 'usr_co_vns',
    pno: '00000003',
    role: ROLES.DISTRICT_CO_ADMIN,
    districtId: 'dist_varanasi',
    stationOfficeId: 'stn_vns_sp_office',
    status: 'ACTIVE',
  };

  const regularUser: AuthContext = {
    userId: 'usr_user_1',
    pno: '00000004',
    role: ROLES.USER,
    districtId: 'dist_lucknow',
    stationOfficeId: 'stn_lko_hazratganj',
    status: 'ACTIVE',
  };

  it('Super Admin has statewide permissions', () => {
    expect(RBAC.canApproveUser(superAdmin, 'dist_varanasi')).toBe(true);
    expect(RBAC.canManageCoAdmins(superAdmin)).toBe(true);
    expect(RBAC.canManageMasters(superAdmin)).toBe(true);
    expect(RBAC.canConfigureBackups(superAdmin)).toBe(true);
    expect(RBAC.canApproveTransfer(superAdmin, 'dist_varanasi', 'dist_lucknow')).toBe(true);
  });

  it('Co-Admin is strictly scoped to own district', () => {
    expect(RBAC.canApproveUser(lkoCoAdmin, 'dist_lucknow')).toBe(true);
    expect(RBAC.canApproveUser(lkoCoAdmin, 'dist_varanasi')).toBe(false);
    expect(RBAC.canManageCoAdmins(lkoCoAdmin)).toBe(false);
    expect(RBAC.canManageMasters(lkoCoAdmin)).toBe(false);
    expect(RBAC.canConfigureBackups(lkoCoAdmin)).toBe(false);
  });

  it('Transfer precedence: Destination Co-Admin CAN approve, Source Co-Admin CANNOT', () => {
    // User moving from Lucknow to Varanasi:
    // Source: dist_lucknow, Destination: dist_varanasi
    
    // Destination Co-Admin (Varanasi) CAN approve
    expect(RBAC.canApproveTransfer(vnsCoAdmin, 'dist_varanasi', 'dist_lucknow')).toBe(true);
    
    // Source Co-Admin (Lucknow) CANNOT approve
    expect(RBAC.canApproveTransfer(lkoCoAdmin, 'dist_varanasi', 'dist_lucknow')).toBe(false);
    
    // Super Admin CAN approve
    expect(RBAC.canApproveTransfer(superAdmin, 'dist_varanasi', 'dist_lucknow')).toBe(true);
    
    // Regular user CANNOT approve
    expect(RBAC.canApproveTransfer(regularUser, 'dist_varanasi', 'dist_lucknow')).toBe(false);
  });
});
