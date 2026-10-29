import { z } from 'zod';
import {
  EnglishNameSchema,
  ASCII_CODE_REGEX,
  ASCII_NAME_REGEX,
} from './englishOnly';

export const CreateDistrictSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(ASCII_CODE_REGEX, 'Code must be uppercase English letters/digits (2-30 chars)'),
  name: EnglishNameSchema,
  zone: z.string().trim().regex(ASCII_NAME_REGEX, 'Zone must be in English letters only').optional().nullable(),
  range: z.string().trim().regex(ASCII_NAME_REGEX, 'Range must be in English letters only').optional().nullable(),
});

export const CreateStationOfficeSchema = z.object({
  districtId: z.string().min(1, 'District is required'),
  name: EnglishNameSchema,
  type: z.enum(['POLICE_STATION', 'CIRCLE_OFFICE', 'SP_OFFICE', 'LINE', 'TRAFFIC', 'OTHER']),
  address: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().regex(/^[0-9\-]{6,15}$/, 'Invalid phone number format').optional().nullable(),
});

export const CreateDesignationSchema = z.object({
  code: z.string().trim().regex(ASCII_CODE_REGEX, 'Code must be uppercase English letters/digits'),
  name: EnglishNameSchema,
  shortName: z.string().trim().regex(/^[A-Za-z0-9\/\. ]{1,20}$/, 'Short name must be English letters/numbers only'),
  rankOrder: z.number().int().min(1).max(999),
});
