import { describe, it, expect } from 'vitest';
import type { RulesInput } from '@bhavai/shared';
import { assertRulesConsistent } from './products.js';

function rules(overrides: Partial<RulesInput> = {}): RulesInput {
  return {
    floorPrice: 70,
    maxDiscountPercent: 30,
    minimumQuantity: 1,
    bulkDiscounts: [],
    maxRounds: 5,
    autoAcceptThreshold: null,
    requireApprovalBelow: null,
    approvalRequired: false,
    ...overrides,
  };
}

describe('assertRulesConsistent', () => {
  it('accepts rules inside the listed price', () => {
    expect(() => assertRulesConsistent(rules(), 100)).not.toThrow();
  });

  it('rejects a floor above the new listed price', () => {
    expect(() => assertRulesConsistent(rules(), 60)).toThrow(/floor price cannot be above/i);
  });

  it('rejects a bulk tier discount above the maximum discount', () => {
    expect(() =>
      assertRulesConsistent(rules({ bulkDiscounts: [{ minimumQuantity: 10, discountPercent: 40 }] }), 100),
    ).toThrow(/bulk tier discount cannot exceed/i);
  });
});
