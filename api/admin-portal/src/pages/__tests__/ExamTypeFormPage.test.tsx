/**
 * T241: ExamTypeFormPage component tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ExamTypeFormPage } from '../ExamTypeFormPage';

// Mock the api service
vi.mock('../../services/api', () => ({
  api: {
    getExamTypes: vi.fn(),
    createExamType: vi.fn(),
    updateExamType: vi.fn(),
  },
}));

import { api } from '../../services/api';

const mockExamType = {
  id: 'TEST-001',
  name: 'Test Certification',
  displayName: 'Test Cert',
  description: 'A test exam',
  domains: [{ id: 'domain-1', name: 'Domain One', weight: 100, questionCount: 65 }],
  passingScore: 70,
  timeLimit: 90,
  questionCount: 65,
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

function renderCreateForm() {
  return render(
    <MemoryRouter initialEntries={['/exam-types/new']}>
      <Routes>
        <Route path="/exam-types/new" element={<ExamTypeFormPage />} />
        <Route path="/exam-types" element={<div>Exam Types List</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderEditForm(id = 'TEST-001') {
  return render(
    <MemoryRouter initialEntries={[`/exam-types/${id}`]}>
      <Routes>
        <Route path="/exam-types/:id" element={<ExamTypeFormPage />} />
        <Route path="/exam-types" element={<div>Exam Types List</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ExamTypeFormPage — Create mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Create Exam Type" heading', () => {
    renderCreateForm();
    expect(screen.getByRole('heading', { name: /create exam type/i })).toBeInTheDocument();
  });

  it('renders all required form fields', () => {
    renderCreateForm();
    expect(screen.getByPlaceholderText(/e\.g\. CLF-C02/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/AWS Certified Cloud Practitioner/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/AWS Cloud Practitioner/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Brief description/i)).toBeInTheDocument();
  });

  it('renders submit button labeled "Create Exam Type"', () => {
    renderCreateForm();
    expect(screen.getByRole('button', { name: /create exam type/i })).toBeInTheDocument();
  });

  it('calls api.createExamType when form is submitted with valid data', async () => {
    (api.createExamType as ReturnType<typeof vi.fn>).mockResolvedValue(mockExamType);

    renderCreateForm();

    // Fill required fields
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. CLF-C02/i), {
      target: { value: 'TEST-001' },
    });
    fireEvent.change(screen.getByPlaceholderText(/AWS Certified Cloud Practitioner/i), {
      target: { value: 'Test Certification' },
    });
    fireEvent.change(screen.getByPlaceholderText(/AWS Cloud Practitioner/i), {
      target: { value: 'Test Cert' },
    });

    // Fix the domain: fill in the default empty domain
    const domainIdInputs = screen.getAllByPlaceholderText(/e\.g\. cloud-concepts/i);
    fireEvent.change(domainIdInputs[0], { target: { value: 'domain-1' } });
    const domainNameInputs = screen.getAllByPlaceholderText(/e\.g\. Cloud Concepts/i);
    fireEvent.change(domainNameInputs[0], { target: { value: 'Domain One' } });

    // Set weight to 100
    const weightInputs = screen.getAllByRole('spinbutton');
    // passingScore=70, timeLimit=90, questionCount=65, weight=0 (domain), questionCount=0 (domain)
    // Find weight input (value=0 in domains) - we need the domain weight
    const domainWeightInput = weightInputs.find(
      (el) => (el as HTMLInputElement).max === '100' && (el as HTMLInputElement).min === '0' && (el as HTMLInputElement).value === '0',
    );
    if (domainWeightInput) {
      fireEvent.change(domainWeightInput, { target: { value: '100' } });
    }

    fireEvent.submit(screen.getByRole('button', { name: /create exam type/i }).closest('form')!);

    await waitFor(() => {
      expect(api.createExamType).toHaveBeenCalled();
    });
  });

  it('shows validation error for ID when submitted without filling it', async () => {
    renderCreateForm();

    fireEvent.submit(screen.getByRole('button', { name: /create exam type/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/ID is required/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for Name when name is too short', async () => {
    renderCreateForm();

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. CLF-C02/i), {
      target: { value: 'X-01' },
    });
    // leave name empty / too short
    fireEvent.change(screen.getByPlaceholderText(/AWS Certified Cloud Practitioner/i), {
      target: { value: 'AB' },
    });

    fireEvent.submit(screen.getByRole('button', { name: /create exam type/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    });
  });

  it('shows domain weight validation error when weights do not sum to 100', async () => {
    renderCreateForm();

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. CLF-C02/i), {
      target: { value: 'TEST-001' },
    });
    fireEvent.change(screen.getByPlaceholderText(/AWS Certified Cloud Practitioner/i), {
      target: { value: 'Test Certification' },
    });
    fireEvent.change(screen.getByPlaceholderText(/AWS Cloud Practitioner/i), {
      target: { value: 'Test Cert' },
    });

    // Submit with default weight=0
    fireEvent.submit(screen.getByRole('button', { name: /create exam type/i }).closest('form')!);

    await waitFor(() => {
      // Validation error about domains (empty id/name or weight sum)
      expect(
        screen.getByText(/domain weights must sum to 100|All domains must have/i),
      ).toBeInTheDocument();
    });
  });
});

describe('ExamTypeFormPage — Edit mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getExamTypes as ReturnType<typeof vi.fn>).mockResolvedValue([mockExamType]);
  });

  it('renders "Edit Exam Type" heading after loading', async () => {
    renderEditForm();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /edit exam type/i })).toBeInTheDocument();
    });
  });

  it('pre-fills form fields with existing exam type data', async () => {
    renderEditForm();
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Certification')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Cert')).toBeInTheDocument();
    });
  });

  it('ID field is read-only in edit mode', async () => {
    renderEditForm();
    await waitFor(() => {
      const idInput = screen.getByDisplayValue('TEST-001');
      expect(idInput).toHaveAttribute('readOnly');
    });
  });

  it('calls api.updateExamType when saving in edit mode', async () => {
    (api.updateExamType as ReturnType<typeof vi.fn>).mockResolvedValue(mockExamType);
    renderEditForm();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /edit exam type/i })).toBeInTheDocument();
    });

    fireEvent.submit(screen.getByRole('button', { name: /save changes/i }).closest('form')!);

    await waitFor(() => {
      expect(api.updateExamType).toHaveBeenCalledWith('TEST-001', expect.any(Object));
    });
  });

  it('shows "Save Changes" button in edit mode', async () => {
    renderEditForm();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });
  });
});
