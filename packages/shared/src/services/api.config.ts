// API configuration for mobile app
// Selects API URL based on environment

const DEV_API_URL = 'https://exam-app-production-9181.up.railway.app';
const PROD_API_URL = 'https://exam-app-production-9181.up.railway.app'; // Replace with actual Railway URL

export const API_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;

// Optionally, export a function for dynamic selection if needed
export function getApiUrl() {
  return __DEV__ ? DEV_API_URL : PROD_API_URL;
}

// Endpoint usage: no /api prefix
export const EXAM_TYPE_ENDPOINT = (id: string) => `${API_URL}/exam-types/${id}`;
export const HEALTH_ENDPOINT = `${API_URL}/health`;
