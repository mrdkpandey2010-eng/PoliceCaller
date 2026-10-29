import { z } from 'zod';
import {
  EnglishNameSchema,
  PnoSchema,
  MobileSchema,
  WhatsAppSchema,
  EmailSchema,
  PasswordSchema,
} from './englishOnly';

export const LoginSchema = z.object({
  pno: PnoSchema,
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  pno: PnoSchema,
  fullName: EnglishNameSchema,
  designationId: z.string().min(1, 'Designation selection is required'),
  districtId: z.string().min(1, 'District selection is required'),
  stationOfficeId: z.string().min(1, 'Station/Office selection is required'),
  mobile: MobileSchema,
  whatsapp: WhatsAppSchema,
  email: EmailSchema,
  password: PasswordSchema,
  photoUrl: z.string().optional().nullable(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const ProfileUpdateSchema = z.object({
  whatsapp: WhatsAppSchema,
  email: EmailSchema,
  notificationPref: z.string().optional(),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: PasswordSchema,
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
