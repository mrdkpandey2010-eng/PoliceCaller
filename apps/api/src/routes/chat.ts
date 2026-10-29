import { Hono } from 'hono';
import crypto from 'node:crypto';
import { D1Database } from '../db/d1-adapter';
import { AuthenticatedUser } from '../services/auth';

export function createChatRouter(db: D1Database) {
  const router = new Hono<{
    Variables: {
      user?: AuthenticatedUser;
    };
  }>();

  // GET /api/chat/conversations - List user's conversations
  router.get('/conversations', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const sql = `
      SELECT 
        c.id, c.type, c.title, c.updated_at as updatedAt,
        cm.role as memberRole,
        last_m.id as lastMessageId,
        last_m.content as lastMessageContent,
        last_m.created_at as lastMessageTime,
        last_m.sender_id as lastMessageSenderId,
        sender.full_name as lastMessageSenderName,
        (
          SELECT count(*) 
          FROM messages m 
          WHERE m.conversation_id = c.id 
            AND m.id > IFNULL(cm.last_read_message_id, '')
            AND m.sender_id != ?
            AND NOT EXISTS (
              SELECT 1 FROM user_message_visibility v 
              WHERE v.message_id = m.id AND v.user_id = ? AND v.is_hidden = 1
            )
        ) as unreadCount,
        CASE 
          WHEN c.type = 'DIRECT' THEN (
            SELECT u2.full_name 
            FROM conversation_members cm2 
            JOIN users u2 ON cm2.user_id = u2.id 
            WHERE cm2.conversation_id = c.id AND cm2.user_id != ? 
            LIMIT 1
          )
          ELSE c.title 
        END as displayName,
        CASE 
          WHEN c.type = 'DIRECT' THEN (
            SELECT u2.photo_url 
            FROM conversation_members cm2 
            JOIN users u2 ON cm2.user_id = u2.id 
            WHERE cm2.conversation_id = c.id AND cm2.user_id != ? 
            LIMIT 1
          )
          ELSE NULL 
        END as displayPhoto,
        CASE 
          WHEN c.type = 'DIRECT' THEN (
            SELECT des2.name 
            FROM conversation_members cm2 
            JOIN users u2 ON cm2.user_id = u2.id 
            JOIN designations des2 ON u2.designation_id = des2.id
            WHERE cm2.conversation_id = c.id AND cm2.user_id != ? 
            LIMIT 1
          )
          ELSE 'Group' 
        END as displaySubtitle
      FROM conversation_members cm
      JOIN conversations c ON cm.conversation_id = c.id
      LEFT JOIN messages last_m ON last_m.id = (
        SELECT m2.id 
        FROM messages m2 
        WHERE m2.conversation_id = c.id 
          AND NOT EXISTS (
            SELECT 1 FROM user_message_visibility v 
            WHERE v.message_id = m2.id AND v.user_id = ? AND v.is_hidden = 1
          )
        ORDER BY m2.sequence_num DESC 
        LIMIT 1
      )
      LEFT JOIN users sender ON last_m.sender_id = sender.id
      WHERE cm.user_id = ?
      ORDER BY c.updated_at DESC
    `;

    const { results } = await db
      .prepare(sql)
      .bind(user.id, user.id, user.id, user.id, user.id, user.id, user.id)
      .all();

    return c.json({ success: true, conversations: results });
  });

  // POST /api/chat/conversations - Start or find direct chat or create group
  router.post('/conversations', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    try {
      const body = await c.req.json();
      const { type, participantId, groupTitle, memberIds } = body;

      if (type === 'DIRECT') {
        if (!participantId) {
          return c.json({ error: 'participantId is required for direct conversation.' }, 400);
        }

        // Check if direct conversation already exists between these two users
        const existingSql = `
          SELECT c.id 
          FROM conversations c
          JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
          JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
          WHERE c.type = 'DIRECT'
          LIMIT 1
        `;

        const existing = await db.prepare(existingSql).bind(user.id, participantId).first<any>();
        if (existing) {
          return c.json({ success: true, conversationId: existing.id, isNew: false });
        }

        const convId = `conv_${crypto.randomUUID()}`;
        const now = new Date().toISOString();

        await db
          .prepare(
            `INSERT INTO conversations (id, type, created_by, created_at, updated_at) VALUES (?, 'DIRECT', ?, ?, ?)`
          )
          .bind(convId, user.id, now, now)
          .run();

        await db
          .prepare(
            `INSERT INTO conversation_members (id, conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, 'MEMBER', ?)`
          )
          .bind(`cm_${crypto.randomUUID()}`, convId, user.id, now)
          .run();

        await db
          .prepare(
            `INSERT INTO conversation_members (id, conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, 'MEMBER', ?)`
          )
          .bind(`cm_${crypto.randomUUID()}`, convId, participantId, now)
          .run();

        return c.json({ success: true, conversationId: convId, isNew: true });
      } else if (type === 'GROUP') {
        if (!groupTitle || groupTitle.trim().length < 2) {
          return c.json({ error: 'Group title must be at least 2 characters.' }, 400);
        }

        const convId = `grp_${crypto.randomUUID()}`;
        const now = new Date().toISOString();

        await db
          .prepare(
            `INSERT INTO conversations (id, type, title, created_by, created_at, updated_at) VALUES (?, 'GROUP', ?, ?, ?, ?)`
          )
          .bind(convId, groupTitle.trim(), user.id, now, now)
          .run();

        // Add creator as ADMIN
        await db
          .prepare(
            `INSERT INTO conversation_members (id, conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, 'ADMIN', ?)`
          )
          .bind(`cm_${crypto.randomUUID()}`, convId, user.id, now)
          .run();

        // Add initial members
        const members: string[] = Array.isArray(memberIds) ? memberIds : [];
        for (const mId of members) {
          if (mId !== user.id) {
            await db
              .prepare(
                `INSERT INTO conversation_members (id, conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, 'MEMBER', ?)`
              )
              .bind(`cm_${crypto.randomUUID()}`, convId, mId, now)
              .run();
          }
        }

        return c.json({ success: true, conversationId: convId, isNew: true });
      }

      return c.json({ error: 'Invalid conversation type' }, 400);
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to create conversation' }, 400);
    }
  });

  // GET /api/chat/messages/:conversationId - Paginated message history
  router.get('/messages/:conversationId', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const convId = c.req.param('conversationId');
    const limit = Math.min(Number(c.req.query('limit')) || 50, 100);

    // Verify membership
    const membership = await db
      .prepare('SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?')
      .bind(convId, user.id)
      .first();

    if (!membership) {
      return c.json({ error: 'Access denied: You are not a participant in this conversation.' }, 403);
    }

    // Select messages excluding user's "Delete for Me" tombstones
    const sql = `
      SELECT 
        m.id, m.conversation_id as conversationId, m.sender_id as senderId,
        m.sequence_num as sequenceNum, m.content, m.message_type as messageType,
        m.attachment_url as attachmentUrl, m.created_at as createdAt,
        u.full_name as senderName, des.short_name as senderRank
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      JOIN designations des ON u.designation_id = des.id
      WHERE m.conversation_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM user_message_visibility v 
          WHERE v.message_id = m.id AND v.user_id = ? AND v.is_hidden = 1
        )
      ORDER BY m.sequence_num ASC
      LIMIT ?
    `;

    const { results } = await db.prepare(sql).bind(convId, user.id, limit).all();

    // Update last_read_message_id for current user
    if (results.length > 0) {
      const lastMsg = results[results.length - 1];
      await db
        .prepare(
          `UPDATE conversation_members 
           SET last_read_message_id = ?, last_read_at = ? 
           WHERE conversation_id = ? AND user_id = ?`
        )
        .bind(lastMsg.id, new Date().toISOString(), convId, user.id)
        .run();
    }

    return c.json({ success: true, messages: results });
  });

  // POST /api/chat/messages - Send message
  router.post('/messages', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    try {
      const body = await c.req.json();
      const { conversationId, content, messageType = 'TEXT', attachmentUrl } = body;

      if (!conversationId || !content || content.trim().length === 0) {
        return c.json({ error: 'Conversation ID and content are required.' }, 400);
      }

      // Verify membership
      const membership = await db
        .prepare('SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?')
        .bind(conversationId, user.id)
        .first();

      if (!membership) {
        return c.json({ error: 'Forbidden: You are not a member of this conversation.' }, 403);
      }

      // Get next sequence number
      const seqRow = await db
        .prepare(
          `SELECT IFNULL(MAX(sequence_num), 0) + 1 as nextSeq FROM messages WHERE conversation_id = ?`
        )
        .bind(conversationId)
        .first<any>();

      const nextSeq = seqRow?.nextSeq || 1;
      const messageId = `msg_${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO messages 
           (id, conversation_id, sender_id, sequence_num, content, message_type, attachment_url, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(messageId, conversationId, user.id, nextSeq, content.trim(), messageType, attachmentUrl || null, now)
        .run();

      // Update conversation updated_at
      await db
        .prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`)
        .bind(now, conversationId)
        .run();

      return c.json({
        success: true,
        message: {
          id: messageId,
          conversationId,
          senderId: user.id,
          senderName: user.fullName,
          sequenceNum: nextSeq,
          content: content.trim(),
          messageType,
          attachmentUrl,
          createdAt: now,
        },
      });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to send message.' }, 400);
    }
  });

  // POST /api/chat/messages/:messageId/delete-for-me
  // Implements per-user tombstone without affecting counterparty or group members
  router.post('/messages/:messageId/delete-for-me', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const messageId = c.req.param('messageId');

    const msg = await db
      .prepare('SELECT conversation_id FROM messages WHERE id = ?')
      .bind(messageId)
      .first<any>();

    if (!msg) {
      return c.json({ error: 'Message not found.' }, 404);
    }

    const tombstoneId = `vis_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO user_message_visibility (id, user_id, message_id, is_hidden, hidden_at)
         VALUES (?, ?, ?, 1, ?)
         ON CONFLICT(user_id, message_id) DO UPDATE SET is_hidden = 1, hidden_at = excluded.hidden_at`
      )
      .bind(tombstoneId, user.id, messageId, now)
      .run();

    return c.json({ success: true, message: 'Message deleted for you.' });
  });

  return router;
}
