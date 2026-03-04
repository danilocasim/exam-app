import { Controller, Get, Header } from '@nestjs/common';

@Controller()
export class LegalController {
  @Get('privacy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getPrivacyPolicy(): string {
    const lastUpdated = 'March 4, 2026';
    const contactEmail = 'danilocasim@gmail.com';
    const developerName = 'Danilo Casim';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — Dojo Exam</title>
  <style>
    :root { --bg: #f8fafc; --card: #ffffff; --text: #1e293b; --muted: #64748b; --accent: #232F3E; --border: #e2e8f0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif; background: var(--bg); color: var(--text); line-height: 1.7; }
    .container { max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
    header { text-align: center; margin-bottom: 2.5rem; padding-bottom: 1.5rem; border-bottom: 2px solid var(--accent); }
    header h1 { font-size: 1.75rem; color: var(--accent); margin-bottom: 0.25rem; }
    header p { color: var(--muted); font-size: 0.9rem; }
    h2 { font-size: 1.2rem; color: var(--accent); margin: 2rem 0 0.75rem; }
    p, li { font-size: 0.95rem; margin-bottom: 0.5rem; }
    ul { padding-left: 1.5rem; margin-bottom: 1rem; }
    li { margin-bottom: 0.35rem; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; margin-top: 1rem; }
    table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); }
    th { background: var(--bg); font-weight: 600; color: var(--accent); }
    footer { text-align: center; margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.85rem; }
    a { color: var(--accent); }
    @media (prefers-color-scheme: dark) {
      :root { --bg: #0f172a; --card: #1e293b; --text: #e2e8f0; --muted: #94a3b8; --accent: #60a5fa; --border: #334155; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Privacy Policy</h1>
      <p>Dojo Exam — AWS Certification Prep Apps</p>
      <p>Last updated: ${lastUpdated}</p>
    </header>

    <div class="card">
      <h2>1. Introduction</h2>
      <p>${developerName} ("we", "us", "our") built the Dojo Exam family of mobile applications ("App") as commercial applications. This Privacy Policy explains how we collect, use, and protect your information when you use our App.</p>
    </div>

    <div class="card">
      <h2>2. Information We Collect</h2>
      <p>We minimize data collection. The App is <strong>offline-first</strong> — most data stays on your device.</p>

      <h3 style="font-size:1rem; margin-top:1rem; margin-bottom:0.5rem;">2.1 Information you provide</h3>
      <table>
        <tr><th>Data</th><th>When</th><th>Purpose</th></tr>
        <tr><td>Google account (name, email, profile photo)</td><td>When you sign in with Google</td><td>Account management &amp; cloud sync</td></tr>
      </table>
      <p style="margin-top:0.5rem;">Google Sign-In is <strong>optional</strong>. The App is fully functional without signing in.</p>

      <h3 style="font-size:1rem; margin-top:1rem; margin-bottom:0.5rem;">2.2 Information collected automatically</h3>
      <table>
        <tr><th>Data</th><th>Purpose</th><th>Shared?</th></tr>
        <tr><td>Exam scores, answers &amp; history</td><td>Track your study progress</td><td>Only if you opt into cloud sync</td></tr>
        <tr><td>Study statistics (exams taken, time spent)</td><td>Performance analytics</td><td>Only if you opt into cloud sync</td></tr>
        <tr><td>Study streak data</td><td>Daily streak tracking</td><td>Only if you opt into cloud sync</td></tr>
        <tr><td>Play Integrity token (one-time)</td><td>Device verification</td><td>Sent to our server once</td></tr>
        <tr><td>Subscription status</td><td>Feature access control</td><td>Managed by Google Play</td></tr>
      </table>

      <h3 style="font-size:1rem; margin-top:1rem; margin-bottom:0.5rem;">2.3 Information we do NOT collect</h3>
      <ul>
        <li>Device identifiers, IMEI, or advertising IDs</li>
        <li>Location data</li>
        <li>Contacts, photos, files, or messages</li>
        <li>Browsing or search history</li>
        <li>Health, financial, or biometric data</li>
        <li>Crash logs or performance diagnostics</li>
      </ul>
    </div>

    <div class="card">
      <h2>3. How We Use Your Information</h2>
      <ul>
        <li><strong>Account management:</strong> Identify you across devices when signed in</li>
        <li><strong>Cloud sync:</strong> Synchronize exam history, stats, and streaks across your devices</li>
        <li><strong>Device verification:</strong> Confirm the App is running on a genuine, unmodified device (via Google Play Integrity API)</li>
        <li><strong>Subscription management:</strong> Verify premium access status</li>
      </ul>
      <p>We do <strong>not</strong> use your data for advertising, profiling, or selling to third parties.</p>
    </div>

    <div class="card">
      <h2>4. Data Storage &amp; Security</h2>
      <ul>
        <li><strong>On-device:</strong> Study data is stored locally in SQLite on your device</li>
        <li><strong>Cloud (optional):</strong> If you sign in and enable sync, your exam history, stats, and streaks are stored on our server (PostgreSQL hosted on Neon)</li>
        <li><strong>Encryption:</strong> All data transmitted between the App and our servers uses TLS/HTTPS encryption</li>
        <li><strong>Server infrastructure:</strong> Our backend is hosted on Railway with secure environment variables</li>
      </ul>
    </div>

    <div class="card">
      <h2>5. Third-Party Services</h2>
      <p>The App uses the following third-party services:</p>
      <ul>
        <li><strong>Google Sign-In</strong> — Authentication (<a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google Privacy Policy</a>)</li>
        <li><strong>Google Play Integrity API</strong> — Device verification</li>
        <li><strong>Google Play Billing</strong> — Subscription purchases (<a href="https://payments.google.com/payments/apis-secure/get_legal_document?ldo=0&ldt=privacynotice" target="_blank" rel="noopener">Google Payments Privacy Notice</a>)</li>
      </ul>
      <p>We do <strong>not</strong> use any third-party analytics, advertising, or tracking SDKs.</p>
    </div>

    <div class="card">
      <h2>6. Data Retention &amp; Deletion</h2>
      <ul>
        <li><strong>On-device data</strong> is deleted when you uninstall the App or clear app data</li>
        <li><strong>Cloud data</strong> is retained as long as your account is active</li>
        <li>You may request deletion of all your cloud data by contacting us at <a href="mailto:${contactEmail}">${contactEmail}</a></li>
        <li>We will process deletion requests within 30 days</li>
      </ul>
    </div>

    <div class="card">
      <h2>7. Children's Privacy</h2>
      <p>The App is designed for adults (18+) preparing for professional AWS certification exams. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal data, please contact us and we will promptly delete it.</p>
    </div>

    <div class="card">
      <h2>8. Your Rights</h2>
      <p>Depending on your jurisdiction, you may have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you</li>
        <li>Request correction of inaccurate data</li>
        <li>Request deletion of your data</li>
        <li>Withdraw consent for cloud sync at any time (sign out in the App)</li>
      </ul>
    </div>

    <div class="card">
      <h2>9. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last updated" date. Continued use of the App after changes constitutes acceptance of the revised policy.</p>
    </div>

    <div class="card">
      <h2>10. Contact Us</h2>
      <p>If you have questions about this Privacy Policy or wish to exercise your data rights, contact us at:</p>
      <p><strong>Email:</strong> <a href="mailto:${contactEmail}">${contactEmail}</a></p>
      <p><strong>Developer:</strong> ${developerName}</p>
    </div>

    <footer>
      <p>&copy; ${new Date().getFullYear()} ${developerName}. All rights reserved.</p>
    </footer>
  </div>
</body>
</html>`;
  }

  @Get('delete-account')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getDeleteAccount(): string {
    const contactEmail = 'danilocasim@gmail.com';
    const developerName = 'Danilo Casim';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Delete Your Account — Dojo Exam</title>
  <style>
    :root { --bg: #f8fafc; --card: #ffffff; --text: #1e293b; --muted: #64748b; --accent: #232F3E; --border: #e2e8f0; --red: #dc2626; --red-bg: #fef2f2; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif; background: var(--bg); color: var(--text); line-height: 1.7; }
    .container { max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
    header { text-align: center; margin-bottom: 2.5rem; padding-bottom: 1.5rem; border-bottom: 2px solid var(--accent); }
    header h1 { font-size: 1.75rem; color: var(--accent); margin-bottom: 0.25rem; }
    header p { color: var(--muted); font-size: 0.9rem; }
    h2 { font-size: 1.2rem; color: var(--accent); margin: 1.5rem 0 0.75rem; }
    p, li { font-size: 0.95rem; margin-bottom: 0.5rem; }
    ul, ol { padding-left: 1.5rem; margin-bottom: 1rem; }
    li { margin-bottom: 0.5rem; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; margin-top: 1rem; }
    .steps { counter-reset: step; list-style: none; padding-left: 0; }
    .steps li { counter-increment: step; padding-left: 2.5rem; position: relative; margin-bottom: 1rem; }
    .steps li::before { content: counter(step); position: absolute; left: 0; top: 0; width: 1.75rem; height: 1.75rem; background: var(--accent); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.85rem; }
    .warning { background: var(--red-bg); border: 1px solid var(--red); border-radius: 8px; padding: 1.25rem; margin-top: 1rem; }
    .warning strong { color: var(--red); }
    table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); }
    th { background: var(--bg); font-weight: 600; color: var(--accent); }
    .deleted { color: var(--red); }
    .retained { color: #16a34a; }
    .btn { display: inline-block; background: var(--accent); color: white; padding: 0.75rem 2rem; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 1rem; margin-top: 0.5rem; }
    .btn:hover { opacity: 0.9; }
    footer { text-align: center; margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.85rem; }
    a { color: var(--accent); }
    @media (prefers-color-scheme: dark) {
      :root { --bg: #0f172a; --card: #1e293b; --text: #e2e8f0; --muted: #94a3b8; --accent: #60a5fa; --border: #334155; --red: #f87171; --red-bg: #1c1917; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Delete Your Account</h1>
      <p>Dojo Exam — AWS Certification Prep Apps</p>
    </header>

    <div class="card">
      <h2>How to Request Account Deletion</h2>
      <p>If you have signed in with Google in any Dojo Exam app and would like your account and associated cloud data deleted, follow these steps:</p>

      <ol class="steps">
        <li><strong>Send an email</strong> to <a href="mailto:${contactEmail}?subject=Account%20Deletion%20Request%20%E2%80%94%20Dojo%20Exam&body=Hi%2C%0A%0AI%20would%20like%20to%20request%20deletion%20of%20my%20Dojo%20Exam%20account%20and%20all%20associated%20data.%0A%0AGoogle%20account%20email%20used%20in%20the%20app%3A%20%5Byour%20email%5D%0A%0AThank%20you.">${contactEmail}</a> with the subject line <strong>"Account Deletion Request — Dojo Exam"</strong>.</li>
        <li><strong>Include the Google account email address</strong> you used to sign in to the app so we can locate your account.</li>
        <li><strong>We will confirm</strong> your request via email and process the deletion within <strong>30 days</strong>.</li>
        <li><strong>You will receive a confirmation email</strong> once your data has been permanently deleted.</li>
      </ol>

      <p style="margin-top: 1rem;">
        <a class="btn" href="mailto:${contactEmail}?subject=Account%20Deletion%20Request%20%E2%80%94%20Dojo%20Exam&body=Hi%2C%0A%0AI%20would%20like%20to%20request%20deletion%20of%20my%20Dojo%20Exam%20account%20and%20all%20associated%20data.%0A%0AGoogle%20account%20email%20used%20in%20the%20app%3A%20%5Byour%20email%5D%0A%0AThank%20you.">Request Account Deletion</a>
      </p>
    </div>

    <div class="card">
      <h2>What Data Is Deleted</h2>
      <p>When your account is deleted, the following data is <strong>permanently removed</strong> from our servers:</p>

      <table>
        <tr><th>Data</th><th>Action</th></tr>
        <tr><td>Google profile information (name, email, photo)</td><td class="deleted">Permanently deleted</td></tr>
        <tr><td>Exam attempt history &amp; scores</td><td class="deleted">Permanently deleted</td></tr>
        <tr><td>Study statistics</td><td class="deleted">Permanently deleted</td></tr>
        <tr><td>Study streak data</td><td class="deleted">Permanently deleted</td></tr>
        <tr><td>Play Integrity verification record</td><td class="deleted">Permanently deleted</td></tr>
        <tr><td>User account record</td><td class="deleted">Permanently deleted</td></tr>
      </table>

      <p style="margin-top: 1rem;"><strong>No data is retained</strong> after deletion. Your entire account record and all associated data are permanently removed from our database.</p>
    </div>

    <div class="card">
      <h2>On-Device Data</h2>
      <p>Data stored locally on your device (exam history, study progress, cached questions) is <strong>not affected</strong> by a server-side account deletion. To remove on-device data:</p>
      <ul>
        <li><strong>Uninstall the app</strong>, or</li>
        <li>Go to your device <strong>Settings → Apps → Dojo Exam → Clear Data</strong></li>
      </ul>
    </div>

    <div class="card">
      <h2>Subscriptions</h2>
      <p>Deleting your account does <strong>not</strong> automatically cancel active subscriptions. To avoid further charges:</p>
      <ul>
        <li>Open the <strong>Google Play Store</strong> app</li>
        <li>Tap your <strong>profile icon → Payments &amp; subscriptions → Subscriptions</strong></li>
        <li>Find <strong>Dojo Exam</strong> and tap <strong>Cancel subscription</strong></li>
      </ul>
      <p>Please cancel your subscription <strong>before</strong> requesting account deletion.</p>
    </div>

    <div class="warning">
      <p><strong>⚠ This action is irreversible.</strong> Once your account is deleted, all cloud-synced data is permanently removed and cannot be recovered. If you sign in again after deletion, a new account will be created with no previous data.</p>
    </div>

    <div class="card">
      <h2>Contact</h2>
      <p>For questions about account deletion, email us at <a href="mailto:${contactEmail}">${contactEmail}</a>.</p>
      <p>See our <a href="/privacy">Privacy Policy</a> for more details on how we handle your data.</p>
    </div>

    <footer>
      <p>&copy; ${new Date().getFullYear()} ${developerName}. All rights reserved.</p>
    </footer>
  </div>
</body>
</html>`;
  }
}
