import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/cloudprep';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // Create AWS Cloud Practitioner exam type
  const awsCcp = await prisma.examType.upsert({
    where: { id: 'aws-ccp' },
    update: {},
    create: {
      id: 'aws-ccp',
      name: 'AWS Certified Cloud Practitioner',
      displayName: 'AWS CCP',
      description:
        'The AWS Certified Cloud Practitioner validates foundational, high-level understanding of AWS Cloud, services, and terminology.',
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
          name: 'Technology',
          weight: 34,
          questionCount: 22,
        },
        {
          id: 'billing',
          name: 'Billing and Pricing',
          weight: 12,
          questionCount: 7,
        },
      ],
      passingScore: 70,
      timeLimit: 90,
      questionCount: 65,
      isActive: true,
    },
  });

  console.log(`✅ Created exam type: ${awsCcp.name} (${awsCcp.id})`);

  // Create initial SyncVersion for AWS CCP
  await prisma.syncVersion.upsert({
    where: { examTypeId: 'aws-ccp' },
    update: {},
    create: {
      examTypeId: 'aws-ccp',
      version: 1,
    },
  });

  console.log('✅ Created sync version for aws-ccp');

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

  // Create sample questions
  const sampleQuestions = [
    {
      examTypeId: 'aws-ccp',
      text: 'Which AWS service provides a fully managed NoSQL database service that supports key-value and document data models?',
      type: 'SINGLE_CHOICE' as const,
      domain: 'technology',
      difficulty: 'EASY' as const,
      options: [
        { id: 'a', text: 'Amazon RDS' },
        { id: 'b', text: 'Amazon DynamoDB' },
        { id: 'c', text: 'Amazon Redshift' },
        { id: 'd', text: 'Amazon Aurora' },
      ],
      correctAnswers: ['b'],
      explanation:
        'Amazon DynamoDB is a fully managed NoSQL database service that provides fast and predictable performance with seamless scalability. It supports both key-value and document data structures.',
      status: 'APPROVED' as const,
      createdById: admin.id,
      approvedById: admin.id,
      approvedAt: new Date(),
    },
    {
      examTypeId: 'aws-ccp',
      text: 'Which of the following are benefits of cloud computing? (Select TWO)',
      type: 'MULTIPLE_CHOICE' as const,
      domain: 'cloud-concepts',
      difficulty: 'EASY' as const,
      options: [
        { id: 'a', text: 'Trade variable expense for capital expense' },
        { id: 'b', text: 'Benefit from massive economies of scale' },
        { id: 'c', text: 'Stop guessing about capacity' },
        { id: 'd', text: 'Increase speed and agility' },
        { id: 'e', text: 'Increase data center staffing' },
      ],
      correctAnswers: ['b', 'c'],
      explanation:
        'Cloud computing benefits include economies of scale (AWS can achieve lower costs due to size) and eliminating capacity guessing (you can scale up or down as needed). Trading capital expense for variable expense is a benefit, but the option states the opposite.',
      status: 'APPROVED' as const,
      createdById: admin.id,
      approvedById: admin.id,
      approvedAt: new Date(),
    },
    {
      examTypeId: 'aws-ccp',
      text: 'Which AWS service is used to automate infrastructure provisioning using code?',
      type: 'SINGLE_CHOICE' as const,
      domain: 'technology',
      difficulty: 'MEDIUM' as const,
      options: [
        { id: 'a', text: 'AWS CloudFormation' },
        { id: 'b', text: 'AWS Config' },
        { id: 'c', text: 'AWS CloudTrail' },
        { id: 'd', text: 'AWS Systems Manager' },
      ],
      correctAnswers: ['a'],
      explanation:
        'AWS CloudFormation enables you to model and provision AWS resources using infrastructure as code. You can use templates to describe all the AWS resources needed for your application.',
      status: 'APPROVED' as const,
      createdById: admin.id,
      approvedById: admin.id,
      approvedAt: new Date(),
    },
  ];

  for (const question of sampleQuestions) {
    await prisma.question.create({
      data: question,
    });
  }

  console.log(`✅ Created ${sampleQuestions.length} sample questions`);

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
