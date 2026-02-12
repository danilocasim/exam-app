/**
 * T080: AdminQuestion response DTO
 * Matches contracts/api.yaml AdminQuestion schema
 */
export class AdminUserDto {
  id: string;
  email: string;
  name: string;
}

export class AdminQuestionOptionDto {
  id: string;
  text: string;
}

export class AdminQuestionDto {
  id: string;
  examTypeId: string;
  text: string;
  type: string;
  domain: string;
  difficulty: string;
  options: AdminQuestionOptionDto[];
  correctAnswers: string[];
  explanation: string;
  status: string;
  version: number;
  createdBy: AdminUserDto | null;
  approvedBy: AdminUserDto | null;
  approvedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Paginated question list response
 * Matches contracts/api.yaml AdminQuestionListResponse
 */
export class AdminQuestionListResponseDto {
  questions: AdminQuestionDto[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Admin stats response
 * Matches contracts/api.yaml AdminStats
 */
export class AdminStatsDto {
  totalQuestions: number;
  byStatus: {
    draft: number;
    pending: number;
    approved: number;
    archived: number;
  };
  byDomain: Record<string, number>;
}
