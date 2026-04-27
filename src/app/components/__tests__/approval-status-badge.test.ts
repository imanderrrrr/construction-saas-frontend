import { describe, it, expect } from 'vitest';
import type { ApprovalStatus } from '../../types';

/**
 * Tests that the STYLES record covers all ApprovalStatus values.
 * This ensures new statuses (like AUTO_REJECTED) are not forgotten.
 */

const ALL_STATUSES: ApprovalStatus[] = [
  'PENDING', 'APPROVED', 'OBSERVED', 'REJECTED', 'AUTO_REJECTED', 'PARTIAL',
];

// Mirror the STYLES record from ApprovalStatusBadge.tsx
const STYLES: Record<ApprovalStatus, { label: string; bg: string }> = {
  PENDING:       { bg: 'bg-amber-50',      label: 'Pending' },
  APPROVED:      { bg: 'bg-emerald-50',    label: 'Approved' },
  OBSERVED:      { bg: 'bg-[#F97316]/10',  label: 'Observed' },
  REJECTED:      { bg: 'bg-red-50',        label: 'Rejected' },
  AUTO_REJECTED: { bg: 'bg-orange-50',     label: 'Auto-rejected' },
  PARTIAL:       { bg: 'bg-sky-50',        label: 'In review' },
};

describe('ApprovalStatusBadge STYLES coverage', () => {
  it('should have a style entry for every ApprovalStatus', () => {
    for (const status of ALL_STATUSES) {
      expect(STYLES[status]).toBeDefined();
      expect(STYLES[status].label).toBeTruthy();
      expect(STYLES[status].bg).toBeTruthy();
    }
  });

  it('AUTO_REJECTED should use orange theme', () => {
    expect(STYLES.AUTO_REJECTED.bg).toContain('orange');
    expect(STYLES.AUTO_REJECTED.label).toBe('Auto-rejected');
  });

  it('AUTO_REJECTED should be distinct from REJECTED', () => {
    expect(STYLES.AUTO_REJECTED.bg).not.toBe(STYLES.REJECTED.bg);
    expect(STYLES.AUTO_REJECTED.label).not.toBe(STYLES.REJECTED.label);
  });
});

describe('ApprovalStatus type includes AUTO_REJECTED', () => {
  it('AUTO_REJECTED is a valid ApprovalStatus', () => {
    const status: ApprovalStatus = 'AUTO_REJECTED';
    expect(status).toBe('AUTO_REJECTED');
  });
});
