import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { lookupComplaint } from '@/lib/tracking';
import TrackComplaintPage from '@/app/(citizen)/track/page';

// Mock next/navigation
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/track',
}));

describe('Complaint Tracking Logic & Lookup (Bug Fix Verification)', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. UNIT TESTS: Exact Matching Lookup Engine (src/lib/tracking.ts)
  // =========================================================================
  describe('lookupComplaint helper function', () => {
    it('returns the exact complaint and full timeline for a valid reference', () => {
      const complaint = lookupComplaint('GOV-2026-00482');

      expect(complaint).not.toBeNull();
      expect(complaint?.ref).toBe('GOV-2026-00482');
      expect(complaint?.title).toBe('Deep Pothole on Main Arterial Road (Opp. Krishna Hospital)');
      expect(complaint?.department).toBe('Road Maintenance (PWD)');
      expect(complaint?.ward).toBe('Kothrud, Pune');
      expect(complaint?.priority).toBe('P1');
      expect(complaint?.status).toBe('IN_PROGRESS');
      expect(complaint?.reporterMasked).toBe('+91 ******4819');
      expect(complaint?.timeline.length).toBeGreaterThanOrEqual(4);
      expect(complaint?.timeline[0].title).toBe('Complaint Submitted');
    });

    it('handles case-insensitivity and leading/trailing whitespace', () => {
      const lowerCase = lookupComplaint('gov-2026-00482');
      expect(lowerCase).not.toBeNull();
      expect(lowerCase?.ref).toBe('GOV-2026-00482');

      const padded = lookupComplaint('   GOV-2026-00482   ');
      expect(padded).not.toBeNull();
      expect(padded?.ref).toBe('GOV-2026-00482');
    });

    it('returns null for an invalid or non-existent reference (never returns a default or fallback)', () => {
      expect(lookupComplaint('INVALID-12345')).toBeNull();
      expect(lookupComplaint('GOV-9999-99999')).toBeNull();
      expect(lookupComplaint('NOT-A-COMPLAINT')).toBeNull();
    });

    it('returns null for empty, whitespace, null, or undefined inputs', () => {
      expect(lookupComplaint('')).toBeNull();
      expect(lookupComplaint('   ')).toBeNull();
      expect(lookupComplaint(null)).toBeNull();
      expect(lookupComplaint(undefined)).toBeNull();
    });

    it('returns distinct data for different valid references without cross-talk', () => {
      const pothole = lookupComplaint('GOV-2026-00482');
      const light = lookupComplaint('GOV-2026-00483');

      expect(pothole?.category).toBe('Damaged Roads & Potholes');
      expect(light?.category).toBe('Streetlights & Electrical');
      expect(pothole?.department).toBe('Road Maintenance (PWD)');
      expect(light?.department).toBe('Electrical Department');
    });
  });

  // =========================================================================
  // 2. COMPONENT INTEGRATION TESTS: TrackComplaintPage UI
  // =========================================================================
  describe('TrackComplaintPage Component', () => {
    it('displays idle state with prompt when loaded without any query parameter', () => {
      render(<TrackComplaintPage />);

      expect(screen.getByText(/ready to track your civic grievance/i)).toBeInTheDocument();
      expect(screen.queryByTestId('complaint-details-card')).not.toBeInTheDocument();
      expect(screen.queryByTestId('complaint-not-found-card')).not.toBeInTheDocument();
    });

    it('A valid reference returns the matching complaint and timeline', () => {
      render(<TrackComplaintPage />);

      const input = screen.getByLabelText(/complaint reference number/i);
      const submitBtn = screen.getByRole('button', { name: /look up reference/i });

      fireEvent.change(input, { target: { value: 'GOV-2026-00482' } });
      fireEvent.click(submitBtn);

      // Verify complaint details card is visible with exact data
      const detailsCard = screen.getByTestId('complaint-details-card');
      expect(detailsCard).toBeInTheDocument();
      expect(detailsCard).toHaveTextContent('GOV-2026-00482');
      expect(detailsCard).toHaveTextContent('Deep Pothole on Main Arterial Road');
      expect(detailsCard).toHaveTextContent('Kothrud, Pune');
      expect(detailsCard).toHaveTextContent('Road Maintenance (PWD)');
      expect(detailsCard).toHaveTextContent('+91 ******4819');

      // Verify timeline steps are present
      expect(detailsCard).toHaveTextContent(/Milestone Timeline/i);
      expect(detailsCard).toHaveTextContent('Complaint Submitted');
      expect(detailsCard).toHaveTextContent('Work Order Dispatched to Field Crew');

      // Ensure "Not Found" card is not rendered
      expect(screen.queryByTestId('complaint-not-found-card')).not.toBeInTheDocument();
    });

    it('An invalid reference returns no complaint details and displays a not-found message', () => {
      render(<TrackComplaintPage />);

      const input = screen.getByLabelText(/complaint reference number/i);
      const submitBtn = screen.getByRole('button', { name: /look up reference/i });

      fireEvent.change(input, { target: { value: 'INVALID-12345' } });
      fireEvent.click(submitBtn);

      // Verify "Complaint Not Found" card is displayed
      const notFoundCard = screen.getByTestId('complaint-not-found-card');
      expect(notFoundCard).toBeInTheDocument();
      expect(notFoundCard).toHaveTextContent('Complaint Not Found');
      expect(notFoundCard).toHaveTextContent(/No complaint record exists matching the reference number/i);
      expect(notFoundCard).toHaveTextContent('INVALID-12345');

      // Crucial: Ensure NO complaint details or timeline of another citizen are displayed
      expect(screen.queryByTestId('complaint-details-card')).not.toBeInTheDocument();
      expect(screen.queryByText(/Deep Pothole on Main Arterial Road/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Ward 28 - Kothrud/)).not.toBeInTheDocument();
      expect(screen.queryByText('+91 ******4819')).not.toBeInTheDocument();
      expect(screen.queryByText(/Milestone Timeline/i)).not.toBeInTheDocument();
    });

    it('Searching for a valid reference and then an invalid reference clears previous complaint details', () => {
      render(<TrackComplaintPage />);

      const input = screen.getByLabelText(/complaint reference number/i);
      const submitBtn = screen.getByRole('button', { name: /look up reference/i });

      // 1. Search valid reference first
      fireEvent.change(input, { target: { value: 'GOV-2026-00482' } });
      fireEvent.click(submitBtn);

      expect(screen.getByTestId('complaint-details-card')).toBeInTheDocument();
      expect(screen.getByText(/Deep Pothole on Main Arterial Road/)).toBeInTheDocument();

      // 2. Immediately search invalid reference
      fireEvent.change(input, { target: { value: 'INVALID-12345' } });
      fireEvent.click(submitBtn);

      // 3. Verify previous complaint details and timeline were completely wiped
      expect(screen.queryByTestId('complaint-details-card')).not.toBeInTheDocument();
      expect(screen.queryByText(/Deep Pothole on Main Arterial Road/)).not.toBeInTheDocument();
      expect(screen.queryByText('+91 ******4819')).not.toBeInTheDocument();
      expect(screen.queryByText(/Milestone Timeline/i)).not.toBeInTheDocument();

      // 4. Verify Not Found is displayed with the searched reference
      const notFoundCard = screen.getByTestId('complaint-not-found-card');
      expect(notFoundCard).toBeInTheDocument();
      expect(notFoundCard).toHaveTextContent('INVALID-12345');
    });

    it('Handles empty input and whitespace safely by clearing previous details and displaying validation error', () => {
      render(<TrackComplaintPage />);

      const input = screen.getByLabelText(/complaint reference number/i);
      const submitBtn = screen.getByRole('button', { name: /look up reference/i });

      // 1. Load a valid complaint first
      fireEvent.change(input, { target: { value: 'GOV-2026-00482' } });
      fireEvent.click(submitBtn);
      expect(screen.getByTestId('complaint-details-card')).toBeInTheDocument();

      // 2. Submit whitespace-only input
      fireEvent.change(input, { target: { value: '     ' } });
      fireEvent.click(submitBtn);

      // 3. Verify previous complaint details are cleared and validation error appears
      expect(screen.queryByTestId('complaint-details-card')).not.toBeInTheDocument();
      expect(screen.queryByText(/Deep Pothole on Main Arterial Road/)).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Please Enter a Reference Number/i)).toBeInTheDocument();
    });

    it('Loads matching complaint directly when URL query parameter ?ref= is provided on initial load', () => {
      mockSearchParams = new URLSearchParams('ref=GOV-2026-00483');

      render(<TrackComplaintPage />);

      // Should automatically load streetlight complaint details
      const detailsCard = screen.getByTestId('complaint-details-card');
      expect(detailsCard).toBeInTheDocument();
      expect(detailsCard).toHaveTextContent('GOV-2026-00483');
      expect(detailsCard).toHaveTextContent(/Dark Streetlight Junction Outside City Dispensary/);
      expect(detailsCard).toHaveTextContent('Electrical Department');
    });

    it('Displays Not Found immediately if URL query parameter ?ref= contains an invalid reference', () => {
      mockSearchParams = new URLSearchParams('ref=NON-EXISTENT-REF');

      render(<TrackComplaintPage />);

      const notFoundCard = screen.getByTestId('complaint-not-found-card');
      expect(notFoundCard).toBeInTheDocument();
      expect(notFoundCard).toHaveTextContent('NON-EXISTENT-REF');
      expect(screen.queryByTestId('complaint-details-card')).not.toBeInTheDocument();
    });

    it('Clicking sample reference chip switches to that exact complaint and updates details', () => {
      render(<TrackComplaintPage />);

      // Initially idle
      expect(screen.getByText(/ready to track your civic grievance/i)).toBeInTheDocument();

      // Click the GOV-2026-00483 sample chip
      const sampleChip = screen.getByRole('button', { name: /GOV-2026-00483/i });
      fireEvent.click(sampleChip);

      const detailsCard = screen.getByTestId('complaint-details-card');
      expect(detailsCard).toBeInTheDocument();
      expect(detailsCard).toHaveTextContent('GOV-2026-00483');
      expect(detailsCard).toHaveTextContent(/Dark Streetlight Junction/i);
    });
  });
});
