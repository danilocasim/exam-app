// Axios API client with base URL config
//
// NOTE: `import type` only — no runtime import of axios at module level.
// Axios's browser platform module accesses `FormData` as a value, which
// doesn't exist in Hermes until React Native polyfills run. Using require()
// inside functions defers Axios loading until after polyfills are ready.
import type { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { API_CONFIG } from '../config';
import { setupApiInterceptors } from './api-interceptor';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const getAxios = () => require('axios') as typeof import('axios');

/**
 * API error response structure (matches backend ErrorResponse DTO)
 */
export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
  timestamp?: string;
  path?: string;
}

/**
 * Type guard to check if error is an API error
 */
export const isApiError = (error: unknown): error is AxiosError<ApiError> => {
  return getAxios().isAxiosError(error) && (error as AxiosError).response?.data !== undefined;
};

/**
 * Create configured Axios instance
 */
const createApiClient = (): AxiosInstance => {
  const axios = getAxios();
  const client = axios.create({
    baseURL: API_CONFIG.BASE_URL,
    timeout: API_CONFIG.TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  // Request interceptor for logging (development only)
  client.interceptors.request.use(
    (config) => {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  // Response interceptor for error handling
  client.interceptors.response.use(
    (response) => {
      return response;
    },
    (error: AxiosError<ApiError>) => {
      if (__DEV__) {
        console.error('[API Error]', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
        });
      }
      return Promise.reject(error);
    },
  );

  // Setup auth interceptors (token injection, refresh on 401)
  setupApiInterceptors(client);

  return client;
};

/**
 * Lazy singleton — defers axios.create() until first API call so that
 * React Native polyfills (FormData, XMLHttpRequest, etc.) are ready.
 */
let _client: AxiosInstance | null = null;
const getClient = (): AxiosInstance => {
  if (!_client) _client = createApiClient();
  return _client;
};

/**
 * API client instance — proxy that defers creation until first use.
 */
export const apiClient = new Proxy({} as AxiosInstance, {
  get(_, prop) {
    return (getClient() as Record<string, unknown>)[prop as string];
  },
});

/**
 * Export as 'api' for use in other services (especially auth-service)
 */
export const api = apiClient;

/**
 * Generic GET request
 */
export const get = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  const response = await getClient().get<T>(url, config);
  return response.data;
};

/**
 * Generic POST request
 */
export const post = async <T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig,
): Promise<T> => {
  const response = await getClient().post<T>(url, data, config);
  return response.data;
};

/**
 * Generic PUT request
 */
export const put = async <T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig,
): Promise<T> => {
  const response = await getClient().put<T>(url, data, config);
  return response.data;
};

/**
 * Generic DELETE request
 */
export const del = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  const response = await getClient().delete<T>(url, config);
  return response.data;
};

// Export types for use in other services
export type { AxiosInstance, AxiosRequestConfig, AxiosError };
