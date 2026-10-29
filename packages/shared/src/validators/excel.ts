import { z } from 'zod';
import {
  EnglishNameSchema,
  PnoSchema,
  MobileSchema,
  WhatsAppSchema,
  EmailSchema,
  StructuredRemarksSchema,
} from './englishOnly';

export const EXCEL_EXPECTED_HEADERS = [
  'PNO',
  'Name',
  'Post',
  'District',
  'Office',
  'Phone',
  'WhatsApp',
  'Email',
  'Status',
  'Remarks',
] as const;

export const ExcelRowSchema = z.object({
  PNO: PnoSchema,
  Name: EnglishNameSchema,
  Post: z.string().trim().min(1, 'Post/Designation is required'),
  District: z.string().trim().min(1, 'District is required'),
  Office: z.string().trim().min(1, 'Office/Station is required'),
  Phone: MobileSchema,
  WhatsApp: WhatsAppSchema,
  Email: EmailSchema,
  Status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING', 'REJECTED']).default('ACTIVE'),
  Remarks: StructuredRemarksSchema,
});

export type ExcelRowData = z.infer<typeof ExcelRowSchema>;

export function validateExcelHeaders(headers: string[]): { valid: boolean; missingHeaders: string[]; unexpectedHeaders: string[] } {
  const normalizedActual = headers.map(h => h.trim());
  const expectedSet = new Set<string>(EXCEL_EXPECTED_HEADERS);
  const actualSet = new Set<string>(normalizedActual);

  const missingHeaders = EXCEL_EXPECTED_HEADERS.filter(h => !actualSet.has(h));
  const unexpectedHeaders = normalizedActual.filter(h => !expectedSet.has(h as any));

  // Also check if any header contains non-ASCII characters
  const nonEnglishHeaders = normalizedActual.filter(h => /[^\x20-\x7E]/.test(h));
  if (nonEnglishHeaders.length > 0) {
    return {
      valid: false,
      missingHeaders,
      unexpectedHeaders: [...unexpectedHeaders, ...nonEnglishHeaders.map(h => `Non-English header: ${h}`)],
    };
  }

  // Reject if Hide_Phone or Password appears
  if (actualSet.has('Hide_Phone') || actualSet.has('Password') || actualSet.has('password')) {
    return {
      valid: false,
      missingHeaders,
      unexpectedHeaders: ['Disallowed column detected: Passwords and Hide_Phone must never be in Excel imports.'],
    };
  }

  return {
    valid: missingHeaders.length === 0,
    missingHeaders,
    unexpectedHeaders,
  };
}
