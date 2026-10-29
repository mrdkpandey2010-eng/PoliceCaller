import { z } from 'zod';
import { StructuredRemarksSchema } from './englishOnly';

export const CreateTransferSchema = z.object({
  destinationDistrictId: z.string().min(1, 'Destination district is required'),
  destinationStationId: z.string().min(1, 'Destination station/office is required'),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(300),
  orderReference: StructuredRemarksSchema,
});

export type CreateTransferInput = z.infer<typeof CreateTransferSchema>;

export const ReviewTransferSchema = z.object({
  transferId: z.string().min(1, 'Transfer ID is required'),
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().trim().max(300).optional().nullable(),
});

export type ReviewTransferInput = z.infer<typeof ReviewTransferSchema>;
