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

  /**
   * T267: Per-app subscription product IDs matching Google Play Console configuration.
   * Pattern: {plan}_{exam_type_lowercase_underscored}
   */
  subscriptionSkus: {
    monthly: string;
    quarterly: string;
    annual: string;
  };

  /**
   * Android package name for server-side subscription verification.
   * Must match the "package" field in app.json (e.g. "com.danilocasim.dojoexam.clfc02").
   */
  androidPackageName: string;
}
