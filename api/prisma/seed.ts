import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/cloudprep';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // Create AWS Certified Cloud Practitioner (CLF-C02) exam type
  const clfC02 = await prisma.examType.upsert({
    where: { id: 'CLF-C02' },
    update: {},
    create: {
      id: 'CLF-C02',
      name: 'AWS Certified Cloud Practitioner',
      displayName: 'AWS CLF-C02',
      description:
        'The AWS Certified Cloud Practitioner (CLF-C02) validates foundational, high-level understanding of AWS Cloud, services, and terminology.',
      domains: [
        {
          id: 'cloud-concepts',
          name: 'Cloud Concepts',
          weight: 24,
          questionCount: 16,
        },
        {
          id: 'security',
          name: 'Security and Compliance',
          weight: 30,
          questionCount: 20,
        },
        {
          id: 'technology',
          name: 'Cloud Technology and Services',
          weight: 34,
          questionCount: 22,
        },
        {
          id: 'billing',
          name: 'Billing, Pricing, and Support',
          weight: 12,
          questionCount: 7,
        },
      ],
      passingScore: 72,
      timeLimit: 90,
      questionCount: 65,
      isActive: true,
    },
  });

  console.log(`✅ Created exam type: ${clfC02.name} (${clfC02.id})`);

  // Create initial SyncVersion for CLF-C02
  await prisma.syncVersion.upsert({
    where: { examTypeId: 'CLF-C02' },
    update: {},
    create: {
      examTypeId: 'CLF-C02',
      version: 1,
    },
  });

  console.log('✅ Created sync version for CLF-C02');

  // Create sample admin user (password: admin123)
  const bcrypt = await import('bcrypt');
  const passwordHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.admin.upsert({
    where: { email: 'admin@cloudprep.io' },
    update: {},
    create: {
      email: 'admin@cloudprep.io',
      passwordHash,
      name: 'CloudPrep Admin',
    },
  });

  console.log(`✅ Created admin user: ${admin.email}`);

  // Load questions from seed data file
  const seedQuestionsPath = path.join(__dirname, 'seed-questions.json');
  const seedQuestionsRaw = fs.readFileSync(seedQuestionsPath, 'utf-8');
  const seedQuestions: Array<{
    text: string;
    type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
    domain: string;
    difficulty: string;
    options: { id: string; text: string }[];
    correctAnswers: string[];
    explanation: string;
  }> = JSON.parse(seedQuestionsRaw);

  // Clear existing questions first
  await prisma.question.deleteMany({
    where: { examTypeId: 'CLF-C02' },
  });

  const now = new Date();
  for (const q of seedQuestions) {
    await prisma.question.create({
      data: {
        examTypeId: 'CLF-C02',
        text: q.text,
        type: q.type,
        domain: q.domain,
        difficulty: q.difficulty as 'EASY' | 'MEDIUM' | 'HARD',
        options: q.options,
        correctAnswers: q.correctAnswers,
        explanation: q.explanation,
        status: 'APPROVED',
        createdById: admin.id,
        approvedById: admin.id,
        approvedAt: now,
      },
    });
  }

  console.log(`✅ Created ${seedQuestions.length} questions`);

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
