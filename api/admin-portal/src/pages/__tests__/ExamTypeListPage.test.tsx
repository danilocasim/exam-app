/**
 * T241: ExamTypeListPage component tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ExamTypeListPage } from '../ExamTypeListPage';

// Mock the api service
vi.mock('../../services/api', () => ({
  api: {
    getExamTypes: vi.fn(),
    toggleExamType: vi.fn(),
  },
}));

import { api } from '../../services/api';

const mockActiveExamType = {
  id: 'CLF-C02',
  name: 'AWS Certified Cloud Practitioner',
  displayName: 'AWS Cloud Practitioner (CLF-C02)',
  description: 'Entry-level AWS certification',
  domains: [
    { id: 'cloud-concepts', name: 'Cloud Concepts', weight: 24, questionCount: 16 },
    { id: 'security', name: 'Security', weight: 30, questionCount: 20 },
  ],
  passingScore: 70,
  timeLimit: 90,
  questionCount: 65,
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockInactiveExamType = {
  ...mockActiveExamType,
  id: 'SAA-C03',
  name: 'AWS Solutions Architect Associate',
  displayName: 'AWS Solutions Architect (SAA-C03)',
  isActive: false,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/exam-types']}>
      <ExamTypeListPage />
    </MemoryRouter>,
  );
}

describe('ExamTypeListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── renders table rows ───────────────────────────────────────────────────────

  it('renders the Exam Types heading', async () => {
    (api.getExamTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderPage();
    expect(screen.getByRole('heading', { name: /exam types/i })).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    (api.getExamTypes as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders a table row for each exam type', async () => {
    (api.getExamTypes as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockActiveExamType,
      mockInactiveExamType,
    ]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('CLF-C02')).toBeInTheDocument();
      expect(screen.getByText('SAA-C03')).toBeInTheDocument();
    });
  });

  it('displays exam type displayName and name in each row', async () => {
    (api.getExamTypes as ReturnType<typeof vi.fn>).mockResolvedValue([mockActiveExamType]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('AWS Cloud Practitioner (CLF-C02)')).toBeInTheDocument();
      expect(screen.getByText('AWS Certified Cloud Practitioner')).toBeInTheDocument();
    });
  });

  it('shows "Active" badge for active exam types', async () => {
    (api.getExamTypes as ReturnType<typeof vi.fn>).mockResolvedValue([mockActiveExamType]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('shows "Inactive" badge for inactive exam types', async () => {
    (api.getExamTypes as ReturnType<typeof vi.fn>).mockResolvedValue([mockInactiveExamType]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  it('shows empty state when no exam types exist', async () => {
    (api.getExamTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no exam types found/i)).toBeInTheDocument();
    });
  });

  it('shows correct domain count in the Domains column', async () => {
    (api.getExamTypes as ReturnType<typeof vi.fn>).mockResolvedValue([mockActiveExamType]);
    renderPage();

    await waitFor(() => {
      // mockActiveExamType has 2 domains
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  // ── deactivate toggle calls API ──────────────────────────────────────────────

  it('shows "Deactivate" button for active exam type', async () => {
    (api.getExamTypes as ReturnType<typeof vi.fn>).mockResolvedValue([mockActiveExamType]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument();
    });
  });

  it('shows "Reactivate" button for inactive exam type', async () => {
    (api.getExamTypes as ReturnType<typeof vi.fn>).mockResolvedValue([mockInactiveExamType]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reactivate/i })).toBeInTheDocument();
    });
  });

  it('opens ConfirmDialog when Deactivate is clicked', async () => {
    (api.getExamTypes as ReturnType<typeof vi.fn>).mockResolvedValue([mockActiveExamType]);
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: /deactivate/i }));
    fireEvent.click(screen.getByRole('button', { name: /deactivate/i }));

    await waitFor(() => {
      expect(screen.getByText(/deactivate exam type/i)).toBeInTheDocument();
    });
  });

  it('calls api.toggleExamType with the exam type id after confirming', async () => {
    const toggled = { ...mockActiveExamType, isActive: false };
    (api.getExamTypes as ReturnType<typeof vi.fn>).mockResolvedValue([mockActiveExamType]);
    (api.toggleExamType as ReturnType<typeof vi.fn>).mockResolvedValue(toggled);

    renderPage();

    await waitFor(() => screen.getByRole('button', { name: /deactivate/i }));
    fireEvent.click(screen.getByRole('button', { name: /deactivate/i }));

    // ConfirmDialog appears — click the confirm button (last of two "Deactivate" buttons)
    await waitFor(() => screen.getByText(/deactivate exam type/i));
    const deactivateBtns = screen.getAllByRole('button', { name: /^deactivate$/i });
    fireEvent.click(deactivateBtns[deactivateBtns.length - 1]);

    await waitFor(() => {
      expect(api.toggleExamType).toHaveBeenCalledWith('CLF-C02');
    });
  });

  it('cancelling the ConfirmDialog does NOT call api.toggleExamType', async () => {
    (api.getExamTypes as ReturnType<typeof vi.fn>).mockResolvedValue([mockActiveExamType]);
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: /deactivate/i }));
    fireEvent.click(screen.getByRole('button', { name: /deactivate/i }));

    await waitFor(() => screen.getByText(/deactivate exam type/i));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(api.toggleExamType).not.toHaveBeenCalled();
  });

  it('shows record count summary at the bottom', async () => {
    (api.getExamTypes as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockActiveExamType,
      mockInactiveExamType,
    ]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/2 exam types/i)).toBeInTheDocument();
    });
  });
});
