import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { QuestionStatus, QuestionType, Difficulty, Prisma } from '@prisma/client';
import type {
  BulkImportQuestionsDto,
  BulkImportQuestionItemDto,
  BulkImportValidationResult,
  BulkImportResult,
  ImportValidationError,
  ImportDuplicateInfo,
} from '../dto/bulk-import-questions.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize question text for deduplication: trim + collapse whitespace + lowercase */
function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** SHA-256 hash of normalized text (first 16 hex chars) — used for fast set lookups */
function hashText(normalized: string): string {
  return createHash('sha256').update(normalized, 'utf8').digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Validation helpers (pure, no I/O)
// ---------------------------------------------------------------------------

function validateQuestionItem(
  q: BulkImportQuestionItemDto,
  index: number,
): ImportValidationError[] {
  const errs: ImportValidationError[] = [];

  // Cross-field: correctAnswers must all exist in options
  const optionIds = new Set((q.options ?? []).map((o) => o.id));
  for (const ans of q.correctAnswers ?? []) {
    if (!optionIds.has(ans)) {
      errs.push({
        questionIndex: index,
        field: 'correctAnswers',
        message: `Correct answer "${ans}" does not match any option id`,
      });
    }
  }

  // TRUE_FALSE must have exactly 2 options
  if (q.type === 'TRUE_FALSE' && (q.options ?? []).length !== 2) {
    errs.push({
      questionIndex: index,
      field: 'options',
      message: 'TRUE_FALSE questions must have exactly 2 options',
    });
  }

  // SINGLE_CHOICE must have exactly 1 correct answer
  if (q.type === 'SINGLE_CHOICE' && (q.correctAnswers ?? []).length > 1) {
    errs.push({
      questionIndex: index,
      field: 'correctAnswers',
      message: 'SINGLE_CHOICE questions must have exactly 1 correct answer',
    });
  }

  // Option ids must be unique within the question
  const optionIdList = (q.options ?? []).map((o) => o.id);
  const uniqueOptionIds = new Set(optionIdList);
  if (uniqueOptionIds.size !== optionIdList.length) {
    errs.push({
      questionIndex: index,
      field: 'options',
      message: 'Option ids must be unique within a question',
    });
  }

  return errs;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class BulkImportService {
  private readonly logger = new Logger(BulkImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Public: validate (dry-run, no DB writes)
  // -------------------------------------------------------------------------

  /**
   * Validate the import payload without persisting anything.
   * Performs:
   *  1. Per-question cross-field validation (class-validator already did structural checks)
   *  2. Within-file duplicate detection (normalized text)
   *  3. Database duplicate detection (single bulk query, excluding ARCHIVED)
   */
  async validate(
    dto: BulkImportQuestionsDto,
  ): Promise<BulkImportValidationResult> {
    // Verify the exam type exists
    const examType = await this.prisma.examType.findUnique({
      where: { id: dto.examTypeId },
    });
    if (!examType) {
      throw new NotFoundException(`Exam type '${dto.examTypeId}' not found`);
    }

    const errors: ImportValidationError[] = [];
    const duplicates: ImportDuplicateInfo[] = [];

    // ---- 1. Per-question cross-field validation ----------------------------
    for (let i = 0; i < dto.questions.length; i++) {
      const errs = validateQuestionItem(dto.questions[i], i);
      errors.push(...errs);
    }

    // ---- 2. Within-file duplicate detection --------------------------------
    // Map: normalizedText → first index seen
    const seenInFile = new Map<string, number>();
    const normalizedTexts: string[] = [];

    for (let i = 0; i < dto.questions.length; i++) {
      const norm = normalizeText(dto.questions[i].text ?? '');
      normalizedTexts.push(norm);

      const firstIdx = seenInFile.get(norm);
      if (firstIdx !== undefined) {
        duplicates.push({
          questionIndex: i,
          reason: 'DUPLICATE_IN_FILE',
          text: dto.questions[i].text,
          conflictsWithIndex: firstIdx,
        });
      } else {
        seenInFile.set(norm, i);
      }
    }

    // ---- 3. Database duplicate detection -----------------------------------
    // Unique set of normalized texts from this upload (skip already-in-file-dupes)
    const uniqueNormsToCheck = [...seenInFile.keys()];

    if (uniqueNormsToCheck.length > 0) {
      // Fetch all non-archived question texts for this exam type in one query.
      // We compare normalized versions after fetching (no DB function for this).
      // For up to 500 questions this is perfectly efficient.
      const existingQuestions = await this.prisma.question.findMany({
        where: {
          examTypeId: dto.examTypeId,
          status: { not: QuestionStatus.ARCHIVED },
        },
        select: { text: true },
      });

      const dbNormSet = new Set(existingQuestions.map((q) => normalizeText(q.text)));

      const uniqueNormSet = new Set(uniqueNormsToCheck);
      for (let i = 0; i < dto.questions.length; i++) {
        const norm = normalizedTexts[i];
        // Skip if already flagged as in-file duplicate (avoid double-reporting)
        if (
          duplicates.some(
            (d) => d.questionIndex === i && d.reason === 'DUPLICATE_IN_FILE',
          )
        ) {
          continue;
        }
        if (dbNormSet.has(norm)) {
          duplicates.push({
            questionIndex: i,
            reason: 'DUPLICATE_IN_DB',
            text: dto.questions[i].text,
          });
          // Remove from uniqueNormSet so we don't flag further duplicates of the same text
          uniqueNormSet.delete(norm);
        }
      }
    }

    const duplicatesInFile = duplicates.filter(
      (d) => d.reason === 'DUPLICATE_IN_FILE',
    ).length;
    const duplicatesInDb = duplicates.filter(
      (d) => d.reason === 'DUPLICATE_IN_DB',
    ).length;
    const valid = errors.length === 0 && duplicates.length === 0;

    return {
      valid,
      summary: {
        total: dto.questions.length,
        errors: errors.length,
        duplicatesInFile,
        duplicatesInDb,
      },
      errors,
      duplicates,
    };
  }

  // -------------------------------------------------------------------------
  // Public: import (validate + atomic DB insert)
  // -------------------------------------------------------------------------

  /**
   * Validate and atomically insert all questions in a single Prisma transaction.
   * If validation fails, throws UnprocessableEntityException — nothing is inserted.
   */
  async importQuestions(
    dto: BulkImportQuestionsDto,
    adminId: string,
  ): Promise<BulkImportResult> {
    // Always re-validate on the server — never trust client-side validation alone
    const validation = await this.validate(dto);

    if (!validation.valid) {
      throw new UnprocessableEntityException({
        message: 'Import failed validation. Fix all errors and duplicates before importing.',
        validation,
      });
    }

    // Atomic transaction: create all questions or none
    const createdIds = await this.prisma.$transaction(
      async (tx) => {
        const ids: string[] = [];

        for (const q of dto.questions) {
          const created = await tx.question.create({
            data: {
              examTypeId: dto.examTypeId,
              text: q.text,
              type: q.type as QuestionType,
              domain: q.domain,
              difficulty: q.difficulty as Difficulty,
              options: q.options as unknown as Prisma.InputJsonValue,
              correctAnswers: q.correctAnswers,
              explanation: q.explanation,
              explanationBlocks: q.explanationBlocks
                ? (q.explanationBlocks as unknown as Prisma.InputJsonValue)
                : undefined,
              status: QuestionStatus.DRAFT,
              createdById: adminId,
            },
            select: { id: true },
          });
          ids.push(created.id);
        }

        return ids;
      },
      {
        // Allow up to 500 questions; default timeout is 5 s — increase for large imports
        timeout: 30_000,
        maxWait: 5_000,
      },
    );

    this.logger.log(
      `Bulk import: ${createdIds.length} questions created for exam type ` +
        `'${dto.examTypeId}' by admin ${adminId}`,
    );

    return {
      imported: createdIds.length,
      examTypeId: dto.examTypeId,
      questionIds: createdIds,
    };
  }

  // -------------------------------------------------------------------------
  // Public: generate a downloadable JSON template
  // -------------------------------------------------------------------------

  /**
   * Returns a well-documented template JSON string the admin can download,
   * optionally pre-filled with the real domain IDs from the exam type.
   */
  async getTemplate(examTypeId?: string): Promise<string> {
    let domains: string[] = ['domain-id-1', 'domain-id-2'];

    if (examTypeId) {
      const examType = await this.prisma.examType.findUnique({
        where: { id: examTypeId },
        select: { domains: true },
      });
      if (examType?.domains) {
        const raw = examType.domains as Array<{ id: string; name: string }>;
        domains = raw.map((d) => d.id);
      }
    }

    const exampleDomain = domains[0] ?? 'domain-id-1';

    const template = {
      _instructions: [
        'Remove all keys that start with _ before uploading.',
        'examTypeId must exactly match an existing exam type ID.',
        'Maximum 500 questions per upload.',
        'All questions are imported as DRAFT — review and approve them individually.',
      ],
      examTypeId: examTypeId ?? 'CLF-C02',
      _fieldReference: {
        text: 'string — min 20 chars. The full question stem.',
        type: 'SINGLE_CHOICE | MULTIPLE_CHOICE | TRUE_FALSE',
        domain: `string — one of: ${domains.join(', ')}`,
        difficulty: 'EASY | MEDIUM | HARD',
        options: 'array of { id: string, text: string } — min 2 items. Option ids must be unique.',
        correctAnswers:
          'array of option ids — must reference valid option ids. SINGLE_CHOICE allows exactly 1.',
        explanation: 'string — min 50 chars. Full explanation shown after answering.',
        explanationBlocks: '(optional) array of structured blocks for rich explanations.',
      },
      _commonMistakes: [
        'correctAnswers values must match option ids exactly (case-sensitive).',
        'TRUE_FALSE questions require exactly 2 options.',
        'SINGLE_CHOICE questions require exactly 1 correct answer.',
        'Duplicate question text (even with different casing/spacing) will be rejected.',
        'explanation must be at least 50 characters.',
      ],
      questions: [
        {
          _comment: 'Example 1: SINGLE_CHOICE with 4 options',
          text: 'What does Amazon S3 stand for in the context of AWS cloud services?',
          type: 'SINGLE_CHOICE',
          domain: exampleDomain,
          difficulty: 'EASY',
          options: [
            { id: 'a', text: 'Simple Storage Service' },
            { id: 'b', text: 'Scalable Storage System' },
            { id: 'c', text: 'Secure Storage Service' },
            { id: 'd', text: 'Standard Storage Solution' },
          ],
          correctAnswers: ['a'],
          explanation:
            'Amazon S3 stands for Simple Storage Service. It is an object storage ' +
            'service that offers industry-leading scalability, data availability, ' +
            'security, and performance. Customers of all sizes and industries can ' +
            'use it to store and protect any amount of data for a range of use cases.',
        },
        {
          _comment: 'Example 2: MULTIPLE_CHOICE — multiple correct answers allowed',
          text: 'Which of the following are valid AWS compute services? Select TWO.',
          type: 'MULTIPLE_CHOICE',
          domain: domains[1] ?? exampleDomain,
          difficulty: 'MEDIUM',
          options: [
            { id: 'a', text: 'Amazon EC2' },
            { id: 'b', text: 'Amazon RDS' },
            { id: 'c', text: 'AWS Lambda' },
            { id: 'd', text: 'Amazon S3' },
          ],
          correctAnswers: ['a', 'c'],
          explanation:
            'Amazon EC2 (Elastic Compute Cloud) and AWS Lambda are both compute services. ' +
            'EC2 provides resizable virtual server instances, while Lambda is a serverless ' +
            'compute service. Amazon RDS is a database service and Amazon S3 is object storage — ' +
            'neither is a compute service.',
        },
        {
          _comment: 'Example 3: TRUE_FALSE — exactly 2 options required',
          text: 'Amazon S3 is a fully managed relational database service offered by AWS.',
          type: 'TRUE_FALSE',
          domain: exampleDomain,
          difficulty: 'EASY',
          options: [
            { id: 'true', text: 'True' },
            { id: 'false', text: 'False' },
          ],
          correctAnswers: ['false'],
          explanation:
            'This statement is FALSE. Amazon S3 is an object storage service, not a relational ' +
            'database. AWS offers Amazon RDS (Relational Database Service) and Amazon Aurora ' +
            'for managed relational databases. S3 stores data as objects within buckets and ' +
            'is designed for unstructured data like images, videos, backups, and documents.',
        },
      ],
    };

    return JSON.stringify(template, null, 2);
  }
}
