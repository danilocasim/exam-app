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
    ...((options.headers as Record<string, string>) || {}),
  };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
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
  explanationBlocks?: ExplanationBlock[] | null;
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
  explanationBlocks?: ExplanationBlock[] | null;
}

/**
 * Structured explanation block for rich content
 */
export interface ExplanationBlock {
  type: 'paragraph' | 'link' | 'image' | 'bullet_list' | 'code' | 'separator';
  content: string;
  meta?: {
    alt?: string;
    caption?: string;
    width?: number;
    height?: number;
    listItems?: string[];
    label?: string;
  };
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

// ---------------------------------------------------------------------------
// Bulk Import types
// ---------------------------------------------------------------------------

export interface BulkImportQuestionItem {
  text: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  domain: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  options: QuestionOption[];
  correctAnswers: string[];
  explanation: string;
  explanationBlocks?: ExplanationBlock[] | null;
}

export interface BulkImportPayload {
  examTypeId: string;
  questions: BulkImportQuestionItem[];
}

export interface ImportValidationError {
  questionIndex: number;
  field: string;
  message: string;
}

export interface ImportDuplicateInfo {
  questionIndex: number;
  reason: 'DUPLICATE_IN_FILE' | 'DUPLICATE_IN_DB';
  text: string;
  conflictsWithIndex?: number;
}

export interface BulkImportValidationResult {
  valid: boolean;
  summary: {
    total: number;
    errors: number;
    duplicatesInFile: number;
    duplicatesInDb: number;
  };
  errors: ImportValidationError[];
  duplicates: ImportDuplicateInfo[];
}

export interface BulkImportResult {
  imported: number;
  examTypeId: string;
  questionIds: string[];
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

export interface ExamTypeDomainInput {
  id: string;
  name: string;
  weight: number;
  questionCount: number;
}

export interface CreateExamTypeInput {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  domains: ExamTypeDomainInput[];
  passingScore: number;
  timeLimit: number;
  questionCount: number;
}

export interface UpdateExamTypeInput {
  name: string;
  displayName: string;
  description?: string;
  domains: ExamTypeDomainInput[];
  passingScore: number;
  timeLimit: number;
  questionCount: number;
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

  createExamType(input: CreateExamTypeInput) {
    return request<ExamType>('/admin/exam-types', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateExamType(id: string, input: UpdateExamTypeInput) {
    return request<ExamType>(`/admin/exam-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  toggleExamType(id: string) {
    return request<ExamType>(`/admin/exam-types/${id}`, {
      method: 'PATCH',
    });
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

  // -------------------------------------------------------------------------
  // Bulk Import
  // -------------------------------------------------------------------------

  /**
   * Validate a parsed JSON import payload without persisting anything.
   * Returns a detailed validation result including errors and duplicates.
   */
  validateBulkImport(payload: BulkImportPayload) {
    return request<BulkImportValidationResult>('/admin/questions/bulk-import/validate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Import questions atomically. Fails with 422 if validation fails.
   */
  bulkImport(payload: BulkImportPayload) {
    return request<BulkImportResult>('/admin/questions/bulk-import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Download the annotated JSON template for a given exam type.
   * Returns the raw JSON string (already formatted with documentation).
   */
  getBulkImportTemplateUrl(examTypeId?: string): string {
    const base = `${API_BASE_URL}/admin/questions/bulk-import/template`;
    return examTypeId ? `${base}?examTypeId=${encodeURIComponent(examTypeId)}` : base;
  },

  /**
   * Upload an explanation image
   */
  async uploadExplanationImage(
    file: File,
  ): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${API_BASE_URL}/admin/uploads/explanation-image`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Upload failed: ${res.status}`);
    }

    return res.json();
  },

  /**
   * Delete an explanation image from S3
   */
  async deleteExplanationImage(filename: string): Promise<void> {
    return request<void>(
      `/admin/uploads/explanation-image/${encodeURIComponent(filename)}`,
      {
        method: 'DELETE',
      },
    );
  },
};
