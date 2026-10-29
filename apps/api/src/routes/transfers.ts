import { Hono } from 'hono';
import crypto from 'node:crypto';
import { D1Database } from '../db/d1-adapter';
import { AuthenticatedUser } from '../services/auth';
import { logAuditEvent } from '../services/audit';
import {
  CreateTransferSchema,
  ReviewTransferSchema,
  RBAC,
  ROLES,
} from '@police-directory/shared';

export function createTransfersRouter(db: D1Database) {
  const router = new Hono<{
    Variables: {
      user?: AuthenticatedUser;
    };
  }>();

  // POST /api/transfers - Create transfer request
  router.post('/', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    try {
      const body = await c.req.json();
      const validated = CreateTransferSchema.parse(body);

      // Verify destination district exists
      const destDistrict = await db
        .prepare('SELECT id, name FROM districts WHERE id = ?')
        .bind(validated.destinationDistrictId)
        .first();

      if (!destDistrict) {
        return c.json({ error: 'Selected destination district does not exist.' }, 400);
      }

      // Verify destination station exists
      const destStation = await db
        .prepare('SELECT id, name FROM stations_offices WHERE id = ? AND district_id = ?')
        .bind(validated.destinationStationId, validated.destinationDistrictId)
        .first();

      if (!destStation) {
        return c.json({ error: 'Selected destination station does not exist in this district.' }, 400);
      }

      // Check for an existing pending transfer for this user
      const existingPending = await db
        .prepare(`SELECT id FROM transfer_requests WHERE user_id = ? AND status = 'PENDING'`)
        .bind(user.id)
        .first();

      if (existingPending) {
        return c.json(
          { error: 'You already have an active pending transfer request.' },
          409
        );
      }

      const transferId = `trf_${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO transfer_requests 
           (id, user_id, source_district_id, source_station_id, destination_district_id, destination_station_id, reason, order_reference, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`
        )
        .bind(
          transferId,
          user.id,
          user.districtId,
          user.stationOfficeId,
          validated.destinationDistrictId,
          validated.destinationStationId,
          validated.reason,
          validated.orderReference || null,
          now,
          now
        )
        .run();

      await logAuditEvent(db, {
        actor: user,
        action: 'CREATE_TRANSFER_REQUEST',
        entityType: 'TRANSFER',
        entityId: transferId,
        districtScope: validated.destinationDistrictId,
        afterState: {
          destinationDistrictId: validated.destinationDistrictId,
          destinationStationId: validated.destinationStationId,
          reason: validated.reason,
        },
      });

      return c.json({
        success: true,
        message: 'Transfer request submitted. Awaiting approval from Destination Co-Admin or Super Admin.',
        transferId,
      });
    } catch (err: any) {
      if (err.errors) {
        return c.json({ error: 'Validation failed', details: err.errors }, 422);
      }
      return c.json({ error: err.message || 'Failed to submit transfer request.' }, 400);
    }
  });

  // GET /api/transfers - List transfers scoped by role
  router.get('/', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    let sql = `
      SELECT 
        tr.*,
        u.full_name as userName, u.pno as userPno,
        des.name as userDesignation,
        d_src.name as sourceDistrictName,
        s_src.name as sourceStationName,
        d_dest.name as destinationDistrictName,
        s_dest.name as destinationStationName,
        approver.full_name as approverName
      FROM transfer_requests tr
      JOIN users u ON tr.user_id = u.id
      JOIN designations des ON u.designation_id = des.id
      JOIN districts d_src ON tr.source_district_id = d_src.id
      JOIN stations_offices s_src ON tr.source_station_id = s_src.id
      JOIN districts d_dest ON tr.destination_district_id = d_dest.id
      JOIN stations_offices s_dest ON tr.destination_station_id = s_dest.id
      LEFT JOIN users approver ON tr.approved_by = approver.id
    `;

    const params: any[] = [];

    if (user.role === ROLES.SUPER_ADMIN) {
      // Super Admin sees all statewide
    } else if (user.role === ROLES.DISTRICT_CO_ADMIN) {
      // Co-Admin sees transfers involving their district (either incoming as destination or outgoing as source)
      sql += ` WHERE tr.destination_district_id = ? OR tr.source_district_id = ?`;
      params.push(user.districtId, user.districtId);
    } else {
      // Regular user sees only own transfer requests
      sql += ` WHERE tr.user_id = ?`;
      params.push(user.id);
    }

    sql += ` ORDER BY tr.created_at DESC LIMIT 100`;

    const { results } = await db.prepare(sql).bind(...params).all();
    return c.json({ success: true, transfers: results });
  });

  // POST /api/transfers/review - Approve or Reject Transfer
  // Single Approver Precedence: Super Admin OR Destination Co-Admin
  router.post('/review', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    try {
      const body = await c.req.json();
      const { transferId, action, rejectionReason } = ReviewTransferSchema.parse(body);

      const transfer = await db
        .prepare(`SELECT * FROM transfer_requests WHERE id = ?`)
        .bind(transferId)
        .first<any>();

      if (!transfer) {
        return c.json({ error: 'Transfer request not found.' }, 404);
      }

      if (transfer.status !== 'PENDING') {
        return c.json({ error: `Transfer is already ${transfer.status.toLowerCase()}.` }, 409);
      }

      // Check RBAC: Can the actor approve this transfer?
      const canApprove = RBAC.canApproveTransfer(
        user,
        transfer.destination_district_id,
        transfer.source_district_id
      );

      if (!canApprove) {
        return c.json(
          {
            error:
              'Forbidden: Only the Super Admin or the Destination District Co-Admin can approve this transfer. Source District Co-Admin is not authorized.',
          },
          403
        );
      }

      const now = new Date().toISOString();
      const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

      if (action === 'APPROVE') {
        // Atomic update of user's posting and transfer request
        await db
          .prepare(
            `UPDATE users 
             SET district_id = ?, station_office_id = ?, updated_at = ?
             WHERE id = ?`
          )
          .bind(
            transfer.destination_district_id,
            transfer.destination_station_id,
            now,
            transfer.user_id
          )
          .run();

        await db
          .prepare(
            `UPDATE transfer_requests
             SET status = 'APPROVED', approved_by = ?, updated_at = ?
             WHERE id = ?`
          )
          .bind(user.id, now, transferId)
          .run();

        await logAuditEvent(db, {
          actor: user,
          action: 'APPROVE_TRANSFER',
          entityType: 'TRANSFER',
          entityId: transferId,
          districtScope: transfer.destination_district_id,
          beforeState: {
            districtId: transfer.source_district_id,
            stationId: transfer.source_station_id,
          },
          afterState: {
            districtId: transfer.destination_district_id,
            stationId: transfer.destination_station_id,
          },
        });

        return c.json({
          success: true,
          message: 'Transfer approved and user posting updated atomically.',
          status: 'APPROVED',
        });
      } else {
        await db
          .prepare(
            `UPDATE transfer_requests
             SET status = 'REJECTED', approved_by = ?, rejection_reason = ?, updated_at = ?
             WHERE id = ?`
          )
          .bind(user.id, rejectionReason || 'Rejected by administration', now, transferId)
          .run();

        await logAuditEvent(db, {
          actor: user,
          action: 'REJECT_TRANSFER',
          entityType: 'TRANSFER',
          entityId: transferId,
          districtScope: transfer.destination_district_id,
          afterState: { rejectionReason },
        });

        return c.json({
          success: true,
          message: 'Transfer request rejected.',
          status: 'REJECTED',
        });
      }
    } catch (err: any) {
      if (err.errors) {
        return c.json({ error: 'Validation failed', details: err.errors }, 422);
      }
      return c.json({ error: err.message || 'Failed to review transfer.' }, 400);
    }
  });

  return router;
}
