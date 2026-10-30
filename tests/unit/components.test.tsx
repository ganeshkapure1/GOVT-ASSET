import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';
import { StatusBadge, PriorityBadge, SLAHealthBadge, Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Drawer } from '@/components/ui/Drawer';

describe('Design System Primitives (Phase 1)', () => {
  // 1. Button Primitive Tests
  describe('Button Component', () => {
    it('renders button with label and responds to click', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Submit Report</Button>);

      const btn = screen.getByRole('button', { name: /submit report/i });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders all documented variants correctly', () => {
      const { rerender } = render(<Button variant="primary">Primary</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-brand-blue');

      rerender(<Button variant="danger">Danger</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-danger-700');

      rerender(<Button variant="outline">Outline</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-white');
    });

    it('handles disabled state and prevents clicks', () => {
      const handleClick = vi.fn();
      render(<Button disabled onClick={handleClick}>Disabled</Button>);

      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('handles loading state with spinner and aria-busy', () => {
      render(<Button isLoading>Saving</Button>);

      const btn = screen.getByRole('button');
      expect(btn).toHaveAttribute('aria-busy', 'true');
      expect(btn).toBeDisabled();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  // 2. Badge Primitive Tests
  describe('StatusBadge and PriorityBadge Components', () => {
    it('renders correct labels for complaint statuses', () => {
      const { rerender } = render(<StatusBadge status="SUBMITTED" />);
      expect(screen.getByText('Submitted')).toBeInTheDocument();

      rerender(<StatusBadge status="IN_PROGRESS" />);
      expect(screen.getByText('In Progress')).toBeInTheDocument();

      rerender(<StatusBadge status="VERIFIED_RESOLVED" />);
      expect(screen.getByText('Resolved')).toBeInTheDocument();

      rerender(<StatusBadge status="REJECTED_INVALID" />);
      expect(screen.getByText('Rejected')).toBeInTheDocument();
    });

    it('renders priority badges with appropriate severity classes', () => {
      const { rerender } = render(<PriorityBadge priority="P1" />);
      expect(screen.getByText('P1 - Critical')).toHaveClass('bg-danger-700');

      rerender(<PriorityBadge priority="P2" />);
      expect(screen.getByText('P2 - High')).toHaveClass('text-orange-700');

      rerender(<PriorityBadge priority="P3" />);
      expect(screen.getByText('P3 - Medium')).toHaveClass('text-amber-700');
    });

    it('renders SLA health indicators', () => {
      render(<SLAHealthBadge health="AT_RISK" remainingTime="2h 15m" />);
      expect(screen.getByText(/At Risk \(2h 15m\)/)).toBeInTheDocument();
    });
  });

  // 3. Form Input Primitives
  describe('Input and Textarea Components', () => {
    it('associates input label and input correctly via id', () => {
      render(<Input label="Citizen Mobile Number" id="mobile-input" required />);

      const label = screen.getByText(/citizen mobile number/i);
      const input = screen.getByLabelText(/citizen mobile number/i);

      expect(label).toHaveAttribute('for', 'mobile-input');
      expect(input).toBeRequired();
    });

    it('renders error state with aria-invalid and alert role', () => {
      render(
        <Input
          label="Landmark"
          errorText="Landmark must be at least 10 characters."
        />
      );

      const input = screen.getByLabelText(/landmark/i);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      const errorMsg = screen.getByRole('alert');
      expect(errorMsg).toHaveTextContent('Landmark must be at least 10 characters.');
    });

    it('renders textarea with live character counter', () => {
      render(
        <Textarea
          label="Defect Description"
          showCount
          maxLength={500}
          defaultValue="A deep pothole on main road."
        />
      );

      expect(screen.getByText('28 / 500')).toBeInTheDocument();
    });
  });

  // 4. Modal and Drawer Dialog Primitives
  describe('Modal and Drawer Components', () => {
    it('renders modal dialog when open with ARIA attributes and closes on button click', () => {
      const handleClose = vi.fn();
      render(
        <Modal
          isOpen={true}
          onClose={handleClose}
          title="Confirm Ticket Rejection"
          description="Citizen will be notified with the documented reason."
        >
          <p>Please enter reason below</p>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(screen.getByText('Confirm Ticket Rejection')).toBeInTheDocument();

      const closeBtn = screen.getByLabelText(/close dialog/i);
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('closes modal on Escape key press', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Escape Test Dialog">
          <p>Testing keyboard interaction</p>
        </Modal>
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('renders Drawer when open and triggers close on Escape', () => {
      const handleClose = vi.fn();
      render(
        <Drawer
          isOpen={true}
          onClose={handleClose}
          title="Complaint Detail Review"
          subtitle="GOV-2026-00482"
        >
          <div>Drawer Content Body</div>
        </Drawer>
      );

      const drawer = screen.getByRole('dialog');
      expect(drawer).toBeInTheDocument();
      expect(screen.getByText('GOV-2026-00482')).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not render modal content when isOpen is false', () => {
      render(
        <Modal isOpen={false} onClose={() => {}} title="Closed Modal">
          <p>Hidden Content</p>
        </Modal>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
