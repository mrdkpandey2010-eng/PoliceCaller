import { describe, it, expect, beforeEach } from 'vitest';
import { LocalD1Database } from '../../apps/api/src/db/d1-adapter';
import { applyMigrations } from '../../apps/api/src/db';
import { createApp } from '../../apps/api/src';
import { createSession } from '../../apps/api/src/services/auth';

describe('Realtime Chat & Delete-for-Me Integration Suite', () => {
  let db: LocalD1Database;
  let app: any;
  let user1Token: string;
  let user2Token: string;
  let outsiderToken: string;

  beforeEach(async () => {
    db = new LocalD1Database(':memory:');
    await applyMigrations(db);
    app = createApp(db);

    // Seed 3 users
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES 
         ('usr_chat_1', '00101010', 'Inspector Alok', 'desig_insp', 'dist_lucknow', 'stn_lko_hazratganj', '9800000001', 'ACTIVE', 'USER', 'hash'),
         ('usr_chat_2', '00202020', 'SI Neha Sharma', 'desig_si', 'dist_lucknow', 'stn_lko_hazratganj', '9800000002', 'ACTIVE', 'USER', 'hash'),
         ('usr_outsider', '00303030', 'Outsider Officer', 'desig_const', 'dist_varanasi', 'stn_vns_cantt', '9800000003', 'ACTIVE', 'USER', 'hash')`
      )
      .run();

    user1Token = (await createSession(db, 'usr_chat_1')).token;
    user2Token = (await createSession(db, 'usr_chat_2')).token;
    outsiderToken = (await createSession(db, 'usr_outsider')).token;
  });

  it('creates 1-to-1 conversation and group chat', async () => {
    // 1-to-1 conversation
    const directRes = await app.request('/api/chat/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        type: 'DIRECT',
        participantId: 'usr_chat_2',
      }),
    });

    expect(directRes.status).toBe(200);
    const directData = await directRes.json();
    expect(directData.success).toBe(true);
    expect(directData.conversationId).toBeDefined();

    // Group chat
    const groupRes = await app.request('/api/chat/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        type: 'GROUP',
        groupTitle: 'Hazratganj Crime Branch',
        memberIds: ['usr_chat_2'],
      }),
    });

    expect(groupRes.status).toBe(200);
    const groupData = await groupRes.json();
    expect(groupData.success).toBe(true);
    expect(groupData.conversationId).toBeDefined();
  });

  it('sends messages with monotonic sequence and allows Hindi text', async () => {
    // 1. Create conversation
    const convRes = await app.request('/api/chat/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        type: 'DIRECT',
        participantId: 'usr_chat_2',
      }),
    });
    const { conversationId } = await convRes.json();

    // 2. User 1 sends message in English
    const msg1Res = await app.request('/api/chat/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        conversationId,
        content: 'Please submit the case diary by 4 PM.',
      }),
    });
    expect(msg1Res.status).toBe(200);
    const msg1Data = await msg1Res.json();
    expect(msg1Data.message.sequenceNum).toBe(1);

    // 3. User 2 replies in Hindi (Hindi text is permitted in chat message bodies)
    const msg2Res = await app.request('/api/chat/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user2Token}`,
      },
      body: JSON.stringify({
        conversationId,
        content: 'जी महोदय, केस डायरी तैयार है और समय पर भेज दी जाएगी।',
      }),
    });
    expect(msg2Res.status).toBe(200);
    const msg2Data = await msg2Res.json();
    expect(msg2Data.message.sequenceNum).toBe(2);
    expect(msg2Data.message.content).toContain('केस डायरी तैयार है');
  });

  it('implements per-user Delete-for-Me without removing message for counterparty', async () => {
    // 1. Setup conversation and send a message
    const convRes = await app.request('/api/chat/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        type: 'DIRECT',
        participantId: 'usr_chat_2',
      }),
    });
    const { conversationId } = await convRes.json();

    const sendRes = await app.request('/api/chat/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        conversationId,
        content: 'Confidential patrol route note.',
      }),
    });
    const { message } = await sendRes.json();
    const messageId = message.id;

    // Both users can see the message initially
    const user1MessagesBefore = await (
      await app.request(`/api/chat/messages/${conversationId}`, {
        headers: { Authorization: `Bearer ${user1Token}` },
      })
    ).json();
    expect(user1MessagesBefore.messages.some((m: any) => m.id === messageId)).toBe(true);

    const user2MessagesBefore = await (
      await app.request(`/api/chat/messages/${conversationId}`, {
        headers: { Authorization: `Bearer ${user2Token}` },
      })
    ).json();
    expect(user2MessagesBefore.messages.some((m: any) => m.id === messageId)).toBe(true);

    // 2. User 1 performs "Delete for Me"
    const deleteRes = await app.request(`/api/chat/messages/${messageId}/delete-for-me`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    expect(deleteRes.status).toBe(200);

    // 3. User 1 CANNOT see the message anymore
    const user1MessagesAfter = await (
      await app.request(`/api/chat/messages/${conversationId}`, {
        headers: { Authorization: `Bearer ${user1Token}` },
      })
    ).json();
    expect(user1MessagesAfter.messages.some((m: any) => m.id === messageId)).toBe(false);

    // 4. User 2 STILL SEES the message! (Critical test: data is preserved for counterparty)
    const user2MessagesAfter = await (
      await app.request(`/api/chat/messages/${conversationId}`, {
        headers: { Authorization: `Bearer ${user2Token}` },
      })
    ).json();
    expect(user2MessagesAfter.messages.some((m: any) => m.id === messageId)).toBe(true);
  });

  it('denies outsider access to conversation history', async () => {
    const convRes = await app.request('/api/chat/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        type: 'DIRECT',
        participantId: 'usr_chat_2',
      }),
    });
    const { conversationId } = await convRes.json();

    const outsiderRes = await app.request(`/api/chat/messages/${conversationId}`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    expect(outsiderRes.status).toBe(403);
  });
});
