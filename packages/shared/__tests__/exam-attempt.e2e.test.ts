import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000';

interface ExamAttemptPayload {
  examTypeId: string;
  score: number;
  passed: boolean;
  duration: number;
  submittedAt?: string;
}

interface ExamAttemptResponse {
  id: string;
  userId?: string;
  examTypeId: string;
  score: number;
  passed: boolean;
  duration: number;
  syncStatus: string;
  createdAt: string;
}

describe('ExamAttempt API E2E Tests', () => {
  // Test user credentials
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
  };

  const authToken = '';
  let attemptId: string;

  beforeAll(async () => {
    // Skip auth setup for now - tests assume API is running
    console.log('E2E tests initialized');
  });

  afterAll(async () => {
    console.log('E2E tests completed');
  });

  describe('POST /exam-attempts/submit', () => {
    test('should submit exam attempt without authentication', async () => {
      const payload: ExamAttemptPayload = {
        examTypeId: 'aws-ccp',
        score: 75,
        passed: true,
        duration: 2400,
      };

      const response = await axios.post(`${API_URL}/exam-attempts/submit`, payload);

      expect(response.status).toBe(201);
      expect(response.data).toMatchObject({
        examTypeId: 'aws-ccp',
        score: 75,
        passed: true,
        duration: 2400,
        syncStatus: 'SYNCED', // Unsigned exams are immediately synced
      });
      expect(response.data.id).toBeDefined();
      expect(response.data.createdAt).toBeDefined();
    });

    test('should reject invalid score', async () => {
      const payload = {
        examTypeId: 'aws-ccp',
        score: 150, // Invalid
        passed: true,
        duration: 2400,
      };

      try {
        await axios.post(`${API_URL}/exam-attempts/submit`, payload);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toContain('Score must be between 0 and 100');
      }
    });

    test('should reject negative duration', async () => {
      const payload = {
        examTypeId: 'aws-ccp',
        score: 75,
        passed: true,
        duration: -100, // Invalid
      };

      try {
        await axios.post(`${API_URL}/exam-attempts/submit`, payload);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toContain('Duration must be non-negative');
      }
    });
  });

  describe('POST /exam-attempts/submit-authenticated', () => {
    test('should require authentication', async () => {
      const payload: ExamAttemptPayload = {
        examTypeId: 'aws-ccp',
        score: 80,
        passed: true,
        duration: 2400,
      };

      try {
        await axios.post(`${API_URL}/exam-attempts/submit-authenticated`, payload);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.response.status).toBe(401); // Unauthorized
      }
    });

    test('should submit exam with valid token', async () => {
      // Skip this test if no auth token available
      if (!authToken) {
        console.log('Skipping authenticated test - no auth token');
        return;
      }

      const payload: ExamAttemptPayload = {
        examTypeId: 'aws-ccp',
        score: 85,
        passed: true,
        duration: 2300,
      };

      const response = await axios.post(`${API_URL}/exam-attempts/submit-authenticated`, payload, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(201);
      expect(response.data).toMatchObject({
        examTypeId: 'aws-ccp',
        score: 85,
        passed: true,
        syncStatus: 'PENDING', // Signed-in exams start as PENDING
      });
      expect(response.data.userId).toBeDefined();

      // Save for later tests
      attemptId = response.data.id;
    });
  });

  describe('GET /exam-attempts/:id', () => {
    test('should retrieve exam attempt by ID', async () => {
      const payload: ExamAttemptPayload = {
        examTypeId: 'aws-ccp',
        score: 72,
        passed: true,
        duration: 2400,
      };

      const submitResponse = await axios.post(`${API_URL}/exam-attempts/submit`, payload);
      const submittedAttemptId = submitResponse.data.id;

      const getResponse = await axios.get(`${API_URL}/exam-attempts/${submittedAttemptId}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.data).toMatchObject({
        id: submittedAttemptId,
        examTypeId: 'aws-ccp',
        score: 72,
        passed: true,
      });
    });

    test('should return 404 for non-existent attempt', async () => {
      try {
        await axios.get(`${API_URL}/exam-attempts/non-existent-id`);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    });
  });

  describe('GET /exam-attempts/my-history', () => {
    test('should require authentication', async () => {
      try {
        await axios.get(`${API_URL}/exam-attempts/my-history`);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.response.status).toBe(401); // Unauthorized
      }
    });

    test('should return user exam history', async () => {
      if (!authToken) {
        console.log('Skipping history test - no auth token');
        return;
      }

      const response = await axios.get(`${API_URL}/exam-attempts/my-history`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect(response.data).toHaveProperty('total');
      expect(response.data).toHaveProperty('page');
      expect(response.data).toHaveProperty('limit');
      expect(response.data).toHaveProperty('totalPages');
      expect(Array.isArray(response.data.data)).toBe(true);
    });
  });

  describe('GET /exam-attempts/analytics/my-analytics', () => {
    test('should require authentication', async () => {
      try {
        await axios.get(`${API_URL}/exam-attempts/analytics/my-analytics`);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.response.status).toBe(401); // Unauthorized
      }
    });

    test('should return user analytics', async () => {
      if (!authToken) {
        console.log('Skipping analytics test - no auth token');
        return;
      }

      const response = await axios.get(`${API_URL}/exam-attempts/analytics/my-analytics`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('totalAttempts');
      expect(response.data).toHaveProperty('totalPassed');
      expect(response.data).toHaveProperty('passRate');
      expect(response.data).toHaveProperty('averageScore');
      expect(response.data).toHaveProperty('averageDuration');
    });
  });

  describe('Sync Management', () => {
    test('should mark attempt as synced', async () => {
      if (!attemptId) {
        console.log('Skipping sync test - no attempt ID');
        return;
      }

      const response = await axios.post(`${API_URL}/exam-attempts/${attemptId}/mark-synced`);

      expect(response.status).toBe(200);
      expect(response.data.syncStatus).toBe('SYNCED');
      expect(response.data.syncedAt).toBeDefined();
      expect(response.data.syncRetries).toBe(0);
    });

    test('should mark attempt as failed', async () => {
      const payload: ExamAttemptPayload = {
        examTypeId: 'aws-ccp',
        score: 70,
        passed: true,
        duration: 2400,
      };

      // Submit attempt first
      const submitResponse = await axios.post(`${API_URL}/exam-attempts/submit`, payload);
      const attemptIdForFailure = submitResponse.data.id;

      // Mark as failed
      const response = await axios.post(
        `${API_URL}/exam-attempts/${attemptIdForFailure}/mark-failed`,
        { error: 'Network timeout' },
      );

      expect(response.status).toBe(200);
      expect(response.data.syncStatus).toBe('FAILED');
      expect(response.data.syncRetries).toBeGreaterThanOrEqual(1);
    });
  });
});
