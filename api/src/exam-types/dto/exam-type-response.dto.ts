export class ExamDomainDto {
  id: string;
  name: string;
  weight: number;
  questionCount: number;
}

export class ExamTypeResponseDto {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  domains: ExamDomainDto[];
  passingScore: number;
  timeLimit: number;
  questionCount: number;
  isActive: boolean;
}
