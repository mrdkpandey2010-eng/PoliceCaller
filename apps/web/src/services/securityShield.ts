/**
 * CCTNS Caller - Comprehensive Frontend Console & Runtime Security Shield
 * 1. Self-XSS Mitigation: Warns users against pasting malicious payloads into DevTools console.
 * 2. Console Redaction: Neutralizes console leaks in production.
 * 3. Anti-Clickjacking: Defends against framing by unauthorized origins.
 */

export function initializeSecurityShield(): void {
  if (typeof window === 'undefined') return;

  // 1. Frame-busting / Anti-Clickjacking check
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.href = window.self.location.href;
    }
  } catch {
    // Cross-origin frame blocked
  }

  // 2. Self-XSS Protection Warning Banner
  const bannerStyle =
    'color: #ef4444; font-size: 26px; font-weight: 900; -webkit-text-stroke: 1px black; padding: 4px;';
  const textStyle = 'color: #f59e0b; font-size: 14px; font-weight: 700; line-height: 1.5;';
  const hintStyle = 'color: #94a3b8; font-size: 12px; font-style: italic;';

  try {
    console.clear();
    console.log('%c🛑 सुरक्षा चेतावनी / SECURITY WARNING!', bannerStyle);
    console.log(
      '%cयह कंसोल केवल अधिकृत सॉफ्टवेयर डेवलपर्स के लिए आरक्षित है।\nयदि किसी अज्ञात व्यक्ति ने आपसे यहां कोई कोड कॉपी-पेस्ट करने को कहा है, तो यह आपकी पुलिस आईडी व डेटा हैक करने का प्रयास (Self-XSS Attack) हो सकता है।\n\nDO NOT enter or paste code in this console. It may compromise your departmental account.',
      textStyle
    );
    console.log('%cउत्तर प्रदेश पुलिस • CCTNS Caller पोर्टल सुरक्षित एवं एन्क्रिप्टेड है।', hintStyle);
  } catch {
    // Ignore environment restrictions
  }

  // 3. In production, redact console.log & console.info to prevent data exposure
  if (import.meta.env.PROD) {
    const noop = () => {};
    try {
      console.log = noop;
      console.info = noop;
      console.debug = noop;
      console.dir = noop;
      console.trace = noop;
    } catch {
      // Ignore frozen console
    }
  }
}
