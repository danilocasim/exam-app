#!/usr/bin/env node
// Transform exam question data into bundle JSON and seed TypeScript
const fs = require('fs');
const path = require('path');

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'exam-input.json'), 'utf-8'),
);

const categoryToDomain = {
  'CCP - Cloud Technology and Services': 'technology',
  'CCP - Security and Compliance': 'security',
  'CCP - Cloud Concepts': 'cloud-concepts',
  'CCP -  Billing, Pricing and Support': 'billing',
};

// Generate bundle JSON
const bundle = {
  version: 1,
  examTypeId: 'CLF-C02',
  generatedAt: '2026-02-12T00:00:00.000Z',
  questions: data.questions.map((q) => ({
    id: q.question_id,
    text: q.question_text,
    type: q.question_type.includes('TWO') ? 'MULTIPLE_CHOICE' : 'SINGLE_CHOICE',
    domain: categoryToDomain[q.category],
    difficulty: 'MEDIUM',
    options: q.choices.map((c) => ({
      id: c.label.toLowerCase(),
      text: c.text,
    })),
    correctAnswers: q.choices
      .filter((c) => c.is_correct)
      .map((c) => c.label.toLowerCase()),
    explanation: q.explanation,
    version: 1,
    createdAt: '2026-02-12T00:00:00.000Z',
    updatedAt: '2026-02-12T00:00:00.000Z',
  })),
};

// Write bundle
const bundlePath = path.join(
  __dirname,
  '..',
  'mobile',
  'assets',
  'questions',
  'clf-c02-bundle.json',
);
fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));
console.log(`✅ Wrote ${bundle.questions.length} questions to ${bundlePath}`);

// Count domains
const domainCounts = {};
bundle.questions.forEach((q) => {
  domainCounts[q.domain] = (domainCounts[q.domain] || 0) + 1;
});
console.log('Domain counts:', domainCounts);

// Generate seed TypeScript question data
const seedQuestions = data.questions.map((q) => {
  const type = q.question_type.includes('TWO')
    ? 'MULTIPLE_CHOICE'
    : 'SINGLE_CHOICE';
  const domain = categoryToDomain[q.category];
  const correctAnswers = q.choices
    .filter((c) => c.is_correct)
    .map((c) => c.label.toLowerCase());

  return {
    text: q.question_text,
    type,
    domain,
    difficulty: 'MEDIUM',
    options: q.choices.map((c) => ({
      id: c.label.toLowerCase(),
      text: c.text,
    })),
    correctAnswers,
    explanation: q.explanation,
  };
});

// Group by domain for seed file
const grouped = {};
seedQuestions.forEach((q) => {
  if (!grouped[q.domain]) grouped[q.domain] = [];
  grouped[q.domain].push(q);
});

// Write seed helper JSON (to be used by seed.ts)
const seedPath = path.join(__dirname, 'seed-questions.json');
fs.writeFileSync(seedPath, JSON.stringify(seedQuestions, null, 2));
console.log(`✅ Wrote seed questions to ${seedPath}`);
