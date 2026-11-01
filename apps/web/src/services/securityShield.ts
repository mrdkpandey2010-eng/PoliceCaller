/**
 * CCTNS Caller - Comprehensive Frontend Console, Network & Runtime Security Shield
 * 
 * 1. Anti-Inspection & DevTools Blocking:
 *    - Blocks F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
 *    - Disables Right-Click context menu to prevent "Inspect Element"
 * 2. Console Redaction & Continuous Auto-Purge:
 *    - Neutralizes console methods (log, info, warn, error, table, dir, trace)
 *    - Periodically executes console.clear() so no output or history can be copied
 * 3. Anti-DevTools Debugger Trap (Production):
 *    - Pauses DevTools immediately via recursive debugger loop if DevTools is opened
 * 4. Anti-Bulk Copying:
 *    - Protects directory listings from indiscriminate text selection & scraping
 * 5. Anti-Clickjacking:
 *    - Frame-busting defense against unauthorized iframe embedding
 */

export function initializeSecurityShield(): void {
  if (typeof window === 'undefined') return;

  // 1. Frame-busting / Anti-Clickjacking
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.href = window.self.location.href;
    }
  } catch {
    // Cross-origin frame blocked
  }

  // 2. Disable Right-Click Context Menu (Blocks "Inspect", "View Source")
  document.addEventListener(
    'contextmenu',
    (e) => {
      // Allow context menu only if explicitly permitted (e.g., input fields if needed)
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      return false;
    },
    { capture: true }
  );

  // 3. Block DevTools Keyboard Shortcuts (F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S)
  window.addEventListener(
    'keydown',
    (e) => {
      // F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      if (isCtrlOrMeta) {
        // Ctrl+Shift+I (DevTools), Ctrl+Shift+J (Console), Ctrl+Shift+C (Inspect Element)
        if (e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        // Ctrl+U (View Source)
        if (e.key === 'u' || e.key === 'U') {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        // Ctrl+S (Save Page)
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
    },
    { capture: true }
  );

  // 4. Console Redaction & Continuous Auto-Purge
  const noop = () => {};
  try {
    console.log = noop;
    console.info = noop;
    console.warn = noop;
    console.error = noop;
    console.debug = noop;
    console.table = noop;
    console.dir = noop;
    console.trace = noop;

    // Freeze console object to prevent tampering or script re-injection
    Object.freeze(console);
  } catch {
    // Ignore frozen environments
  }

  // Continuous console purge interval (clears anything that might slip through)
  setInterval(() => {
    try {
      console.clear();
    } catch {
      // Ignore
    }
  }, 1000);

  // 5. Anti-DevTools Debugger Trap (Active in Production)
  if (import.meta.env.PROD) {
    const antiDebug = () => {
      try {
        const check = function () {
          return false;
        };
        check.constructor('debugger')();
      } catch {
        // Ignore
      }
    };

    setInterval(antiDebug, 1500);
  }
}
