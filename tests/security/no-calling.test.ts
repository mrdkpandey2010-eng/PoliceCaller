import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Security & Compliance: Absolute Absence of In-App Calling & Hide Phone', () => {
  const rootDir = path.resolve(__dirname, '../../');

  function scanDirectory(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (['node_modules', '.git', 'dist', 'build', '.system_generated'].includes(file)) continue;
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDirectory(fullPath, fileList);
      } else if (/\.(ts|tsx|js|jsx|json|sql|xml|html|md)$/.test(file)) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  const allFiles = scanDirectory(rootDir);

  it('contains zero WebRTC, STUN/TURN, RTCPeerConnection or audio recording APIs in application code', () => {
    const forbiddenPatterns = [
      /\bRTCPeerConnection\b/,
      /\bgetUserMedia\b/,
      /\bstun:/i,
      /\bturn:/i,
      /\bnavigator\.mediaDevices\b/,
      /\bcallTimer\b/i,
      /\bvoiceCall\b/i,
      /\bvideoCall\b/i,
    ];

    const sourceFiles = allFiles.filter(f => 
      !f.includes('tests\\security\\no-calling.test.ts') && 
      !f.includes('tests/security/no-calling.test.ts') &&
      !f.includes('.md')
    );

    for (const filePath of sourceFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        const match = content.match(pattern);
        expect(
          match,
          `Forbidden in-app calling pattern ${pattern} found in ${filePath}`
        ).toBeNull();
      }
    }
  });

  it('contains zero Hide_Phone fields or masking toggles in database schema and validators', () => {
    const migrationFile = path.join(rootDir, 'db/migrations/0001_initial_schema.sql');
    const migrationContent = fs.readFileSync(migrationFile, 'utf-8');
    expect(migrationContent.toLowerCase()).not.toContain('hide_phone');
    expect(migrationContent.toLowerCase()).not.toContain('hidephone');

    const sharedIndex = path.join(rootDir, 'packages/shared/src/index.ts');
    const sharedContent = fs.readFileSync(sharedIndex, 'utf-8');
    expect(sharedContent.toLowerCase()).not.toContain('hide_phone');
  });

  it('confirms bottom navigation contains only Directory, Chats, Notices, Profile, and optional Admin tabs (NO Calls tab)', () => {
    const bottomNavFile = path.join(rootDir, 'packages/ui/src/components/BottomNav.tsx');
    const content = fs.readFileSync(bottomNavFile, 'utf-8');
    expect(content.toLowerCase()).not.toContain("'calls'");
    expect(content.toLowerCase()).not.toContain('"calls"');
    expect(content).toContain("'directory'");
    expect(content).toContain("'chats'");
    expect(content).toContain("'notices'");
    expect(content).toContain("'profile'");
  });
});
