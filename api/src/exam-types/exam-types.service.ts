import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExamTypeResponseDto, ExamDomainDto } from './dto';

@Injectable()
export class ExamTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string): Promise<ExamTypeResponseDto> {
    const examType = await this.prisma.examType.findUnique({
      where: { id },
    });

    if (!examType) {
      throw new NotFoundException(`Exam type '${id}' not found`);
    }

    if (!examType.isActive) {
      throw new NotFoundException(`Exam type '${id}' is not active`);
    }

    return {
      id: examType.id,
      name: examType.name,
      displayName: examType.displayName,
      description: examType.description,
      domains: examType.domains as unknown as ExamDomainDto[],
      passingScore: examType.passingScore,
      timeLimit: examType.timeLimit,
      questionCount: examType.questionCount,
      isActive: examType.isActive,
    };
  }
}
