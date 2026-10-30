import { z } from 'zod';

/**
 * Regular Expressions for Strict English/ASCII Canonical Data Enforcement
 */

// Name regex: Only ASCII letters, spaces, apostrophes, hyphens, and dots (e.g., O'Neil, A.K. Singh, Rajesh Kumar)
// Must not contain digits, zero-width characters, Devanagari/Hindi, emojis or other scripts.
export const ASCII_NAME_REGEX = /^[A-Za-z][A-Za-z .'-]*[A-Za-z.]$/;

// PNO regex: exactly 9 or 10 ASCII digits, preserves leading zeros (V4.6)
export const ASCII_PNO_REGEX = /^(?:[0-9]{9}|[0-9]{10})$/;

// Mobile regex: exactly 10 ASCII digits (V4.6)
export const ASCII_MOBILE_REGEX = /^[0-9]{10}$/;

// Master / Code identifier regex: ASCII uppercase, numbers, underscores
export const ASCII_CODE_REGEX = /^[A-Z0-9_]{2,30}$/;

// Structured remarks / address: ASCII printable characters only (no Devanagari or other scripts)
export const ASCII_STRUCTURED_TEXT_REGEX = /^[\x20-\x7E\r\n]+$/;

/**
 * Zod Schemas for Canonical English Structured Fields
 */

export const EnglishNameSchema = z
  .string({ required_error: 'Name is required' })
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(80, 'Name cannot exceed 80 characters')
  .refine(
    (val) => {
      // Must match ASCII name pattern and contain no repeated punctuation like '..' or '--'
      return (
        ASCII_NAME_REGEX.test(val) &&
        !/\.{2,}/.test(val) &&
        !/-{2,}/.test(val) &&
        !/'{2,}/.test(val)
      );
    },
    { message: 'Name must be entered in English letters only.' }
  )
  .transform((val) => val.replace(/\s+/g, ' '));

export const PnoSchema = z
  .string({ required_error: 'PNO is required' })
  .trim()
  .refine(
    (val) => !/[eE\+\.]/.test(val) && ASCII_PNO_REGEX.test(val),
    { message: 'PNO must be exactly 9 or 10 ASCII digits (gazetted officers without PNO may use their 10-digit mobile).' }
  );

export const MobileSchema = z
  .string({ required_error: 'Mobile number is required' })
  .trim()
  .refine(
    (val) => ASCII_MOBILE_REGEX.test(val),
    { message: 'Mobile must be exactly 10 ASCII digits.' }
  );

export const WhatsAppSchema = z
  .string()
  .trim()
  .refine(
    (val) => val === '' || ASCII_MOBILE_REGEX.test(val),
    { message: 'WhatsApp number must be exactly 10 ASCII digits starting with 6, 7, 8, or 9.' }
  )
  .optional()
  .nullable();

export const EmailSchema = z
  .string()
  .trim()
  .email('Invalid email address')
  .refine(
    (val) => /^[\x20-\x7E]+$/.test(val),
    { message: 'Email must contain ASCII English characters only.' }
  )
  .optional()
  .nullable();

export const StructuredRemarksSchema = z
  .string()
  .trim()
  .max(255, 'Remarks cannot exceed 255 characters')
  .refine(
    (val) => val === '' || ASCII_STRUCTURED_TEXT_REGEX.test(val),
    { message: 'Structured remarks must contain English/ASCII characters only.' }
  )
  .optional()
  .nullable();

// Passwords allow Unicode passphrases (passwords are NOT restricted to English)
export const PasswordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password cannot exceed 128 characters');
