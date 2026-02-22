/**
 * AppConfig — per-app configuration injected at build time.
 * Each app in apps/{exam-id}/ provides this via its own .env / app.config.ts.
 */
export interface AppConfig {
  /** Exam type identifier matching ExamType.id in the backend (e.g. 'CLF-C02') */
  examTypeId: string;

  /** Human-readable app name shown in the UI */
  appName: string;

  /** Optional branding overrides */
  branding?: {
    primaryColor?: string;
  };
}
