import { describe, it, expect } from 'vitest';
import {
  DISPUTE_WINDOW_DAYS,
  DISPUTE_WINDOW_MS,
} from '@/server/complaint-service';
import {
  AUTO_CLOSE_WINDOW_DAYS,
  AUTO_CLOSE_WINDOW_MS,
  isEligibleForAutoClosure,
} from '@/server/auto-close';
import { canTransition } from '@/server/fsm';

describe('Phase 7: Citizen Dispute & Auto-Closure Policy (Unit)', () => {
  const BASE_TIME = new Date('2026-10-20T10:00:00.000Z');

  describe('1. 7-Calendar-Day Dispute Window Calculations', () => {
    it('defines standard 7 calendar days in milliseconds', () => {
      expect(DISPUTE_WINDOW_DAYS).toBe(7);
      expect(DISPUTE_WINDOW_MS).toBe(7 * 24 * 60 * 60 * 1000);
      expect(DISPUTE_WINDOW_MS).toBe(604800000);
    });

    it('accepts dispute submitted well within the 7-day window (e.g. Day 3)', () => {
      const resolvedAt = BASE_TIME;
      const disputeTime = new Date(resolvedAt.getTime() + 3 * 24 * 60 * 60 * 1000);
      const elapsed = disputeTime.getTime() - resolvedAt.getTime();
      expect(elapsed).toBeLessThan(DISPUTE_WINDOW_MS);
    });

    it('accepts dispute submitted immediately before the 7-day cutoff (Day 6, 23h 59m 59s)', () => {
      const resolvedAt = BASE_TIME;
      const disputeTime = new Date(resolvedAt.getTime() + DISPUTE_WINDOW_MS - 1000);
      const elapsed = disputeTime.getTime() - resolvedAt.getTime();
      expect(elapsed).toBeLessThan(DISPUTE_WINDOW_MS);
      expect(elapsed <= DISPUTE_WINDOW_MS).toBe(true);
    });

    it('accepts dispute submitted exactly at the 7-day boundary (Day 7, 00h 00m 00s)', () => {
      const resolvedAt = BASE_TIME;
      const disputeTime = new Date(resolvedAt.getTime() + DISPUTE_WINDOW_MS);
      const elapsed = disputeTime.getTime() - resolvedAt.getTime();
      expect(elapsed <= DISPUTE_WINDOW_MS).toBe(true);
    });

    it('rejects dispute submitted immediately after the 7-day cutoff (7 days + 1 second)', () => {
      const resolvedAt = BASE_TIME;
      const disputeTime = new Date(resolvedAt.getTime() + DISPUTE_WINDOW_MS + 1000);
      const elapsed = disputeTime.getTime() - resolvedAt.getTime();
      expect(elapsed > DISPUTE_WINDOW_MS).toBe(true);
    });

    it('rejects dispute submitted long after the cutoff (e.g. Day 10)', () => {
      const resolvedAt = BASE_TIME;
      const disputeTime = new Date(resolvedAt.getTime() + 10 * 24 * 60 * 60 * 1000);
      const elapsed = disputeTime.getTime() - resolvedAt.getTime();
      expect(elapsed > DISPUTE_WINDOW_MS).toBe(true);
    });
  });

  describe('2. Auto-Closure Eligibility Function (isEligibleForAutoClosure)', () => {
    it('defines 7-day auto-closure window matching dispute policy', () => {
      expect(AUTO_CLOSE_WINDOW_DAYS).toBe(7);
      expect(AUTO_CLOSE_WINDOW_MS).toBe(604800000);
    });

    it('returns false if complaint was resolved 6 days ago (within dispute window)', () => {
      const resolvedAt = BASE_TIME;
      const now = new Date(resolvedAt.getTime() + 6 * 24 * 60 * 60 * 1000);
      expect(isEligibleForAutoClosure(resolvedAt, now)).toBe(false);
    });

    it('returns false immediately before the 7-day boundary (6 days 23 hours)', () => {
      const resolvedAt = BASE_TIME;
      const now = new Date(resolvedAt.getTime() + DISPUTE_WINDOW_MS - 1000);
      expect(isEligibleForAutoClosure(resolvedAt, now)).toBe(false);
    });

    it('returns true exactly at the 7-day boundary (7.0 days)', () => {
      const resolvedAt = BASE_TIME;
      const now = new Date(resolvedAt.getTime() + DISPUTE_WINDOW_MS);
      expect(isEligibleForAutoClosure(resolvedAt, now)).toBe(true);
    });

    it('returns true after the 7-day boundary (8 days)', () => {
      const resolvedAt = BASE_TIME;
      const now = new Date(resolvedAt.getTime() + 8 * 24 * 60 * 60 * 1000);
      expect(isEligibleForAutoClosure(resolvedAt, now)).toBe(true);
    });
  });

  describe('3. State Machine Transitions for Dispute & Auto-Close', () => {
    it('allows CITIZEN to transition VERIFIED_RESOLVED -> DISPUTED_REOPENED', () => {
      expect(canTransition('VERIFIED_RESOLVED', 'DISPUTED_REOPENED', 'CITIZEN')).toBe(true);
    });

    it('allows PLATFORM_ADMIN to transition VERIFIED_RESOLVED -> DISPUTED_REOPENED', () => {
      expect(canTransition('VERIFIED_RESOLVED', 'DISPUTED_REOPENED', 'PLATFORM_ADMIN')).toBe(true);
    });

    it('blocks FIELD_WORKER or OFFICER from transitioning to DISPUTED_REOPENED', () => {
      expect(canTransition('VERIFIED_RESOLVED', 'DISPUTED_REOPENED', 'FIELD_WORKER')).toBe(false);
      expect(canTransition('VERIFIED_RESOLVED', 'DISPUTED_REOPENED', 'OFFICER')).toBe(false);
    });

    it('allows PLATFORM_ADMIN to transition VERIFIED_RESOLVED -> CLOSED (auto-close daemon)', () => {
      expect(canTransition('VERIFIED_RESOLVED', 'CLOSED', 'PLATFORM_ADMIN')).toBe(true);
    });

    it('blocks transitioning to CLOSED from non-resolved states like IN_PROGRESS or SUBMITTED', () => {
      expect(canTransition('IN_PROGRESS', 'CLOSED', 'PLATFORM_ADMIN')).toBe(false);
      expect(canTransition('SUBMITTED', 'CLOSED', 'PLATFORM_ADMIN')).toBe(false);
      expect(canTransition('WORK_COMPLETED', 'CLOSED', 'PLATFORM_ADMIN')).toBe(false);
    });

    it('blocks transitioning to DISPUTED_REOPENED from non-resolved states', () => {
      expect(canTransition('SUBMITTED', 'DISPUTED_REOPENED', 'CITIZEN')).toBe(false);
      expect(canTransition('IN_PROGRESS', 'DISPUTED_REOPENED', 'CITIZEN')).toBe(false);
      expect(canTransition('WORK_COMPLETED', 'DISPUTED_REOPENED', 'CITIZEN')).toBe(false);
      expect(canTransition('CLOSED', 'DISPUTED_REOPENED', 'CITIZEN')).toBe(false);
    });
  });
});
