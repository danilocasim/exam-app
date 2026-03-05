import type { AppConfig } from '@exam-app/shared';

export const APP_CONFIG: AppConfig = {
  examTypeId: 'CLF-C02',
  appName: 'Dojo Exam CLFC02',
  branding: { primaryColor: '#232F3E' }, // AWS dark (Squid Ink)
  subscriptionSkus: {
    monthly: 'monthly_clf_c02',
    quarterly: 'quarterly_clf_c02',
    annual: 'annual_clf_c02',
  },
  androidPackageName: 'com.danilocasim.dojoexam.clfc02',
};
