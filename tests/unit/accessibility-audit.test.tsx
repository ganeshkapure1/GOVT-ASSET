import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import axe from 'axe-core';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Drawer } from '@/components/ui/Drawer';
import { ReworkModal } from '@/components/ops/ReworkModal';
import { RejectModal } from '@/components/ops/RejectModal';
import { AssignModal } from '@/components/ops/AssignModal';
import { BeforeAfterCompare } from '@/components/ops/BeforeAfterCompare';
import { DisputeModal } from '@/components/citizen/DisputeModal';
import { FeedbackCard } from '@/components/citizen/FeedbackCard';
import { ComplaintDrawer } from '@/components/ops/ComplaintDrawer';

// Helper to run axe-core on rendered container with rules appropriate for jsdom
async function checkA11y(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      // In JSDOM, color-contrast cannot be reliably determined without full canvas rendering
      'color-contrast': { enabled: false },
      // JSDOM may not simulate full scroll viewport for region checks
      region: { enabled: false },
    },
  });

  const criticalOrSerious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );

  return {
    violations: results.violations,
    criticalOrSerious,
  };
}

describe('Accessibility Audit (WCAG 2.2 AA Compliance)', () => {
  describe('Design System Primitives A11y', () => {
    it('Input component has proper label, id association, and aria-describedby for errors', async () => {
      const { container } = render(
        <form>
          <Input
            label="Citizen Mobile Number"
            required
            helperText="10-digit Indian phone number"
            errorText="Invalid mobile phone format"
            placeholder="9876543210"
          />
        </form>
      );

      const input = screen.getByLabelText(/citizen mobile number/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby');

      const { criticalOrSerious } = await checkA11y(container);
      expect(criticalOrSerious).toEqual([]);
    });

    it('Textarea component has proper label and aria-describedby', async () => {
      const { container } = render(
        <form>
          <Textarea
            label="Grievance Landmark Description"
            required
            helperText="Provide detailed street or landmark info"
            placeholder="Near metro pillar 45..."
          />
        </form>
      );

      const textarea = screen.getByLabelText(/grievance landmark description/i);
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('required');

      const { criticalOrSerious } = await checkA11y(container);
      expect(criticalOrSerious).toEqual([]);
    });

    it('Button variants maintain proper accessible role and aria-busy when loading', async () => {
      const { container, rerender } = render(
        <Button variant="primary">Submit Civic Grievance</Button>
      );

      let btn = screen.getByRole('button', { name: /submit civic grievance/i });
      expect(btn).toBeInTheDocument();

      rerender(<Button isLoading>Submitting...</Button>);
      btn = screen.getByRole('button');
      expect(btn).toHaveAttribute('aria-busy', 'true');
      expect(btn).toBeDisabled();

      const { criticalOrSerious } = await checkA11y(container);
      expect(criticalOrSerious).toEqual([]);
    });

    it('Badges render accessible semantic text', () => {
      render(
        <div>
          <StatusBadge status="TRIAGED" />
          <PriorityBadge priority="P2_HIGH" />
        </div>
      );

      expect(screen.getByText('Triaged')).toBeInTheDocument();
      expect(screen.getByText('P2 - High')).toBeInTheDocument();
    });
  });

  describe('Modal & Dialog Primitives A11y', () => {
    it('Modal renders with role=dialog, aria-modal=true, and aria-labelledby', async () => {
      const { container } = render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Confirm Civic Action"
          description="This action will dispatch an inspection team."
        >
          <p>Dialog contents here.</p>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby');

      const { criticalOrSerious } = await checkA11y(container);
      expect(criticalOrSerious).toEqual([]);
    });

    it('Drawer renders with role=dialog, aria-modal=true, and accessible title', async () => {
      const { container } = render(
        <Drawer
          isOpen={true}
          onClose={vi.fn()}
          title="Work Order Details"
          subtitle="Reference BLR-2026-0001"
        >
          <p>Drawer contents here.</p>
        </Drawer>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');

      const { criticalOrSerious } = await checkA11y(container);
      expect(criticalOrSerious).toEqual([]);
    });
  });

  describe('Operations Workflow Components A11y', () => {
    it('ReworkModal has accessible form controls with valid label associations', async () => {
      const { container } = render(
        <ReworkModal
          isOpen={true}
          onClose={vi.fn()}
          complaintRef="BLR-2026-0042"
          onConfirmRework={vi.fn()}
        />
      );

      const textarea = screen.getByLabelText(/corrective instructions/i);
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('id');

      const { criticalOrSerious } = await checkA11y(container);
      expect(criticalOrSerious).toEqual([]);
    });

    it('RejectModal has accessible select dropdown and explanation textarea', async () => {
      const { container } = render(
        <RejectModal
          isOpen={true}
          onClose={vi.fn()}
          complaintRef="BLR-2026-0042"
          onConfirmRejection={vi.fn()}
        />
      );

      const select = screen.getByLabelText(/standardized reason code/i);
      expect(select).toBeInTheDocument();
      const textarea = screen.getByLabelText(/detailed justification/i);
      expect(textarea).toBeInTheDocument();

      const { criticalOrSerious } = await checkA11y(container);
      expect(criticalOrSerious).toEqual([]);
    });

    it('AssignModal has accessible crew selector and target deadline inputs', async () => {
      const mockWorkers = [
        { id: 'w-1', fullName: 'Ramesh Pawar', phoneNumber: '+91 9876543210' },
        { id: 'w-2', fullName: 'Suresh Patil', phoneNumber: '+91 9876543211' },
      ];

      const { container } = render(
        <AssignModal
          isOpen={true}
          onClose={vi.fn()}
          complaintRef="BLR-2026-0042"
          eligibleWorkers={mockWorkers}
          onConfirmAssignment={vi.fn()}
        />
      );

      const crewSelect = screen.getByLabelText(/field maintenance crew lead/i);
      expect(crewSelect).toBeInTheDocument();

      const deadlineInput = screen.getByLabelText(/target completion deadline/i);
      expect(deadlineInput).toBeInTheDocument();

      const notesTextarea = screen.getByLabelText(/internal instructions/i);
      expect(notesTextarea).toBeInTheDocument();

      const { criticalOrSerious } = await checkA11y(container);
      expect(criticalOrSerious).toEqual([]);
    });

    it('BeforeAfterCompare renders with accessible text alternatives and hidden decorative SVGs', async () => {
      const { container } = render(
        <BeforeAfterCompare
          beforeEvidence={[{ fileKey: 'before-pothole.jpg' }]}
          afterEvidence={[{ fileKey: 'after-repair.jpg' }]}
          beforeDesc="Deep road cavity approx 40cm wide."
          afterDesc="Filled with hot mix bitumen and compacted."
          landmark="100 Feet Road, Indiranagar"
          completedBy="Ramesh Pawar"
          completedAt="Today at 14:30"
          gpsDistanceText="GPS Geofence: 12m from complaint site (PASS)"
          isProximityVerified={true}
        />
      );

      expect(screen.getByText(/citizen "before" evidence/i)).toBeInTheDocument();
      expect(screen.getByText(/field crew "after" evidence/i)).toBeInTheDocument();
      expect(screen.getAllByText(/gps geofence: 12m from complaint site/i).length).toBeGreaterThan(0);

      const { criticalOrSerious } = await checkA11y(container);
      expect(criticalOrSerious).toEqual([]);
    });

    it('ComplaintDrawer renders accessible tab navigation and boundary notice', async () => {
      const mockComplaint = {
        id: 'c-101',
        ref: 'BLR-2026-0099',
        reporterName: 'Sunita Rao',
        category: 'Roads & Footpaths',
        department: 'Roads & Infrastructure',
        landmark: 'Near 12th Main Bus Stop, Indiranagar',
        status: 'SUBMITTED' as const,
        priority: 'P3_MEDIUM' as const,
        date: '28 Oct 2026',
        description: 'Large pothole in the left carriage lane.',
      };

      const { container } = render(
        <ComplaintDrawer
          isOpen={true}
          onClose={vi.fn()}
          complaint={mockComplaint}
          onValidate={vi.fn()}
          onOpenAssignModal={vi.fn()}
          onOpenRejectModal={vi.fn()}
        />
      );

      const tablist = screen.getByRole('tablist', { name: /complaint drawer navigation/i });
      expect(tablist).toBeInTheDocument();

      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(2);
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

      // Check synthetic boundary disclaimer presence
      expect(screen.getByText(/Boundary Notice:/i)).toBeInTheDocument();

      const { criticalOrSerious } = await checkA11y(container);
      expect(criticalOrSerious).toEqual([]);
    });
  });

  describe('Citizen Dispute & Feedback Components A11y', () => {
    it('DisputeModal renders accessible explanation input with policy notice', async () => {
      const { container } = render(
        <DisputeModal
          isOpen={true}
          onClose={vi.fn()}
          complaintId="c-123"
          referenceNumber="BLR-2026-0012"
          expectedVersion={3}
        />
      );

      const textarea = screen.getByLabelText(/detailed dispute explanation/i);
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('id', 'dispute-reason');

      const { criticalOrSerious } = await checkA11y(container);
      expect(criticalOrSerious).toEqual([]);
    });

    it('FeedbackCard renders accessible radiogroup for ratings and labeled comment field', async () => {
      const { container } = render(
        <FeedbackCard
          complaintId="c-123"
          referenceNumber="BLR-2026-0012"
          status="VERIFIED_RESOLVED"
        />
      );

      const radiogroup = screen.getByRole('radiogroup', { name: /resolution quality rating/i });
      expect(radiogroup).toBeInTheDocument();

      const stars = screen.getAllByRole('radio');
      expect(stars.length).toBe(5);

      const commentField = screen.getByLabelText(/additional comments/i);
      expect(commentField).toBeInTheDocument();

      const { criticalOrSerious } = await checkA11y(container);
      expect(criticalOrSerious).toEqual([]);
    });
  });
});
