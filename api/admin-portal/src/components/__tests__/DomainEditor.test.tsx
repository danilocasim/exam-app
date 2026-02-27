/**
 * T241: DomainEditor component tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DomainEditor } from '../DomainEditor';
import type { ExamTypeDomainInput } from '../../services/api';

const makeDomain = (overrides: Partial<ExamTypeDomainInput> = {}): ExamTypeDomainInput => ({
  id: 'domain-1',
  name: 'Cloud Concepts',
  weight: 100,
  questionCount: 26,
  ...overrides,
});

describe('DomainEditor', () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  // ── renders domains ─────────────────────────────────────────────────────────

  it('renders a single domain row with its name and weight', () => {
    render(<DomainEditor domains={[makeDomain()]} onChange={onChange} />);
    expect(screen.getByDisplayValue('Cloud Concepts')).toBeInTheDocument();
    expect(screen.getByDisplayValue('domain-1')).toBeInTheDocument();
  });

  it('renders multiple domain rows', () => {
    const domains = [
      makeDomain({ id: 'd1', name: 'Domain A', weight: 60, questionCount: 39 }),
      makeDomain({ id: 'd2', name: 'Domain B', weight: 40, questionCount: 26 }),
    ];
    render(<DomainEditor domains={domains} onChange={onChange} />);
    expect(screen.getByDisplayValue('Domain A')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Domain B')).toBeInTheDocument();
  });

  it('shows Weight: 100/100 badge when weight is valid', () => {
    render(<DomainEditor domains={[makeDomain({ weight: 100 })]} onChange={onChange} />);
    expect(screen.getByText('Weight: 100/100')).toBeInTheDocument();
  });

  it('shows empty-state message when domains array is empty', () => {
    render(<DomainEditor domains={[]} onChange={onChange} />);
    expect(screen.getByText(/No domains added/i)).toBeInTheDocument();
  });

  // ── add domain ──────────────────────────────────────────────────────────────

  it('calls onChange with a new empty domain appended when "+ Add Domain" is clicked', () => {
    const domains = [makeDomain()];
    render(<DomainEditor domains={domains} onChange={onChange} />);

    fireEvent.click(screen.getByText('+ Add Domain'));

    expect(onChange).toHaveBeenCalledOnce();
    const updated: ExamTypeDomainInput[] = onChange.mock.calls[0][0];
    expect(updated).toHaveLength(2);
    expect(updated[1]).toEqual({ id: '', name: '', weight: 0, questionCount: 0 });
  });

  // ── remove domain ───────────────────────────────────────────────────────────

  it('Remove button is disabled when there is only one domain', () => {
    render(<DomainEditor domains={[makeDomain()]} onChange={onChange} />);
    const removeBtn = screen.getByRole('button', { name: /remove/i });
    expect(removeBtn).toBeDisabled();
  });

  it('calls onChange without the removed domain after confirmation', () => {
    const domains = [
      makeDomain({ id: 'd1', name: 'Domain A', weight: 60, questionCount: 39 }),
      makeDomain({ id: 'd2', name: 'Domain B', weight: 40, questionCount: 26 }),
    ];
    // Confirm the window.confirm dialog
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<DomainEditor domains={domains} onChange={onChange} />);
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(removeButtons[0]);

    expect(onChange).toHaveBeenCalledOnce();
    const updated: ExamTypeDomainInput[] = onChange.mock.calls[0][0];
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe('d2');
  });

  it('does NOT call onChange when remove confirmation is cancelled', () => {
    const domains = [
      makeDomain({ id: 'd1', name: 'A', weight: 60, questionCount: 39 }),
      makeDomain({ id: 'd2', name: 'B', weight: 40, questionCount: 26 }),
    ];
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<DomainEditor domains={domains} onChange={onChange} />);
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(removeButtons[0]);

    expect(onChange).not.toHaveBeenCalled();
  });

  // ── weight validation display ────────────────────────────────────────────────

  it('shows warning message when weights do not sum to 100', () => {
    const domains = [
      makeDomain({ id: 'd1', name: 'A', weight: 60, questionCount: 39 }),
      makeDomain({ id: 'd2', name: 'B', weight: 30, questionCount: 26 }),
    ];
    render(<DomainEditor domains={domains} onChange={onChange} />);
    expect(screen.getByText(/weights must sum to exactly 100/i)).toBeInTheDocument();
    expect(screen.getByText('Weight: 90/100')).toBeInTheDocument();
  });

  it('does NOT show warning when weights sum to exactly 100', () => {
    render(<DomainEditor domains={[makeDomain({ weight: 100 })]} onChange={onChange} />);
    expect(screen.queryByText(/weights must sum/i)).not.toBeInTheDocument();
  });

  // ── field updates ────────────────────────────────────────────────────────────

  it('calls onChange with updated domain name when name input changes', () => {
    render(<DomainEditor domains={[makeDomain()]} onChange={onChange} />);
    const nameInput = screen.getByDisplayValue('Cloud Concepts');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });

    expect(onChange).toHaveBeenCalledOnce();
    const updated: ExamTypeDomainInput[] = onChange.mock.calls[0][0];
    expect(updated[0].name).toBe('New Name');
  });
});
