import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Android Capacitor Native Manifest Compliance', () => {
  const manifestPath = path.resolve(__dirname, '../../android/app/src/main/AndroidManifest.xml');

  it('contains verified non-calling network and notification permissions', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const content = fs.readFileSync(manifestPath, 'utf-8');

    expect(content).toContain('android.permission.INTERNET');
    expect(content).toContain('android.permission.ACCESS_NETWORK_STATE');
    expect(content).toContain('android.permission.POST_NOTIFICATIONS');
  });

  it('strictly excludes calling, recording, and dialer permissions from AndroidManifest.xml', () => {
    const content = fs.readFileSync(manifestPath, 'utf-8');

    // Forbidden permissions
    const forbidden = [
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.CALL_PHONE',
      'android.permission.READ_PHONE_STATE',
      'android.permission.PROCESS_OUTGOING_CALLS',
      'android.permission.CAPTURE_AUDIO_OUTPUT',
    ];

    for (const perm of forbidden) {
      expect(
        content.includes(`<uses-permission android:name="${perm}" />`),
        `Disallowed calling permission ${perm} found in AndroidManifest.xml`
      ).toBe(false);
    }
  });
});
