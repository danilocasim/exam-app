/**
 * T093: API service with JWT interceptor
 * All admin API calls go through this service
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Endpoint usage: no /api prefix
function getToken(): string | null {
  return localStorage.getItem('admin_token');
}

function clearAuth() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  window.location.href = '/portal/login';
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Use API_BASE_URL for all requests
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const res = await fetch(fullUrl, { ...options, headers });

  if (res.status === 401) {
    clearAuth();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Types matching API contract ---

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface AdminQuestion {
  id: string;
  examTypeId: string;
  text: string;
  type: string;
  domain: string;
  difficulty: string;
  options: QuestionOption[];
  correctAnswers: string[];
  explanation: string;
  status: string;
  version: number;
  createdBy: AdminUser | null;
  approvedBy: AdminUser | null;
  approvedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminQuestionListResponse {
  questions: AdminQuestion[];
  total: number;
  page: number;
  totalPages: number;
}

export interface QuestionInput {
  examTypeId: string;
  text: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  domain: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  options: QuestionOption[];
  correctAnswers: string[];
  explanation: string;
}

export interface ExamType {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  domains: {
    id: string;
    name: string;
    weight: number;
    questionCount: number;
  }[];
  passingScore: number;
  timeLimit: number;
  questionCount: number;
  isActive: boolean;
}

export interface AdminStats {
  totalQuestions: number;
  byStatus: {
    draft: number;
    pending: number;
    approved: number;
    archived: number;
  };
  byDomain: Record<string, number>;
}

// --- API functions ---

export const api = {
  // Auth
  login(email: string, password: string) {
    return request<{ token: string; admin: AdminUser }>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Exam Types
  getExamTypes() {
    return request<ExamType[]>('/admin/exam-types');
  },

  // Stats
  getStats(examTypeId?: string) {
    const params = examTypeId ? `?examTypeId=${examTypeId}` : '';
    return request<AdminStats>(`/admin/stats${params}`);
  },

  // Questions
  getQuestions(params: {
    examTypeId: string;
    status?: string;
    domain?: string;
    difficulty?: string;
    page?: number;
    limit?: number;
  }) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') search.set(k, String(v));
    });
    return request<AdminQuestionListResponse>(
      `/admin/questions?${search.toString()}`,
    );
  },

  getQuestion(id: string) {
    return request<AdminQuestion>(`/admin/questions/${id}`);
  },

  createQuestion(input: QuestionInput) {
    return request<AdminQuestion>('/admin/questions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateQuestion(id: string, input: QuestionInput) {
    return request<AdminQuestion>(`/admin/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  approveQuestion(id: string) {
    return request<AdminQuestion>(`/admin/questions/${id}/approve`, {
      method: 'POST',
    });
  },

  archiveQuestion(id: string) {
    return request<AdminQuestion>(`/admin/questions/${id}/archive`, {
      method: 'POST',
    });
  },

  restoreQuestion(id: string) {
    return request<AdminQuestion>(`/admin/questions/${id}/restore`, {
      method: 'POST',
    });
  },
};
