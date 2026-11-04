import { describe, it, expect } from 'vitest';
import type { PricingPolicy } from '@bhavai/shared';
import { validateOffer, requiresApproval, sellerDecision, buyerDecision } from './engine.js';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function makePolicy(overrides: Partial<PricingPolicy> = {}): PricingPolicy {
  return {
    listedPrice: 100,
    floorPrice: 70,
    maxDiscountPercent: 30,
    minimumQuantity: 1,
    bulkDiscounts: [],
    maxRounds: 5,
    autoAcceptThreshold: null,
    requireApprovalBelow: null,
    ...overrides,
  };
}

/* ================================================================== */
/* validateOffer                                                       */
/* ================================================================== */

describe('validateOffer', () => {
  it('accepts a valid offer within the authorised range', () => {
    const result = validateOffer({ unitPrice: 80, quantity: 5, stock: 100, policy: makePolicy() });
    expect(result.valid).toBe(true);
    expect(result.code).toBe('VALID');
    expect(result.total).toBe(400);
    expect(result.discountPercent).toBe(20);
  });

  it('accepts an offer exactly at the floor price', () => {
    const result = validateOffer({ unitPrice: 70, quantity: 1, stock: 10, policy: makePolicy() });
    expect(result.valid).toBe(true);
    expect(result.code).toBe('VALID');
  });

  it('accepts an offer exactly at the listed price', () => {
    const result = validateOffer({ unitPrice: 100, quantity: 1, stock: 10, policy: makePolicy() });
    expect(result.valid).toBe(true);
    expect(result.code).toBe('VALID');
    expect(result.discountPercent).toBe(0);
  });

  it('rejects an offer below the minimum allowed price', () => {
    const result = validateOffer({ unitPrice: 60, quantity: 1, stock: 10, policy: makePolicy() });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('BELOW_MINIMUM');
  });

  it('uses the higher of floorPrice and discount-derived floor', () => {
    // maxDiscountPercent = 10 → discount floor = 90, floorPrice = 70 → minimum = 90
    const policy = makePolicy({ maxDiscountPercent: 10 });
    const result = validateOffer({ unitPrice: 85, quantity: 1, stock: 10, policy });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('BELOW_MINIMUM');
    expect(result.minimumAllowed).toBe(90);
  });

  it('rejects an offer above the listed price', () => {
    const result = validateOffer({ unitPrice: 110, quantity: 1, stock: 10, policy: makePolicy() });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('ABOVE_LISTED');
  });

  // --- Invalid numeric values ---

  it('rejects NaN unit price', () => {
    const result = validateOffer({ unitPrice: NaN, quantity: 1, stock: 10, policy: makePolicy() });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID');
  });

  it('rejects Infinity unit price', () => {
    const result = validateOffer({ unitPrice: Infinity, quantity: 1, stock: 10, policy: makePolicy() });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID');
  });

  it('rejects negative unit price', () => {
    const result = validateOffer({ unitPrice: -10, quantity: 1, stock: 10, policy: makePolicy() });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID');
  });

  it('rejects zero unit price', () => {
    const result = validateOffer({ unitPrice: 0, quantity: 1, stock: 10, policy: makePolicy() });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID');
  });

  it('rejects zero quantity', () => {
    const result = validateOffer({ unitPrice: 80, quantity: 0, stock: 10, policy: makePolicy() });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID');
  });

  it('rejects non-integer quantity', () => {
    const result = validateOffer({ unitPrice: 80, quantity: 2.5, stock: 10, policy: makePolicy() });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID');
  });

  it('rejects negative quantity', () => {
    const result = validateOffer({ unitPrice: 80, quantity: -3, stock: 10, policy: makePolicy() });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID');
  });

  // --- Quantity restrictions ---

  it('rejects quantity below the minimum order quantity', () => {
    const policy = makePolicy({ minimumQuantity: 10 });
    const result = validateOffer({ unitPrice: 80, quantity: 5, stock: 100, policy });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('BELOW_MIN_QUANTITY');
  });

  it('rejects quantity above stock', () => {
    const result = validateOffer({ unitPrice: 80, quantity: 50, stock: 10, policy: makePolicy() });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('QUANTITY_UNAVAILABLE');
  });

  it('accepts quantity exactly equal to stock', () => {
    const result = validateOffer({ unitPrice: 80, quantity: 10, stock: 10, policy: makePolicy() });
    expect(result.valid).toBe(true);
    expect(result.code).toBe('VALID');
  });

  it('accepts quantity exactly at minimum order quantity', () => {
    const policy = makePolicy({ minimumQuantity: 5 });
    const result = validateOffer({ unitPrice: 80, quantity: 5, stock: 100, policy });
    expect(result.valid).toBe(true);
    expect(result.code).toBe('VALID');
  });

  it('computes total correctly with rounding', () => {
    const result = validateOffer({ unitPrice: 79.99, quantity: 3, stock: 10, policy: makePolicy() });
    expect(result.total).toBe(239.97);
  });
});

/* ================================================================== */
/* requiresApproval                                                    */
/* ================================================================== */

describe('requiresApproval', () => {
  it('returns false when requireApprovalBelow is null', () => {
    expect(requiresApproval(makePolicy(), 50)).toBe(false);
  });

  it('returns true when unit price is below the threshold', () => {
    expect(requiresApproval(makePolicy({ requireApprovalBelow: 80 }), 75)).toBe(true);
  });

  it('returns false when unit price equals the threshold', () => {
    expect(requiresApproval(makePolicy({ requireApprovalBelow: 80 }), 80)).toBe(false);
  });

  it('returns false when unit price is above the threshold', () => {
    expect(requiresApproval(makePolicy({ requireApprovalBelow: 80 }), 90)).toBe(false);
  });
});

/* ================================================================== */
/* sellerDecision                                                      */
/* ================================================================== */

describe('sellerDecision', () => {
  it('accepts an offer at or above the target price', () => {
    const result = sellerDecision({
      offerUnitPrice: 100,
      quantity: 1,
      stock: 10,
      policy: makePolicy(),
      round: 1,
    });
    expect(result.type).toBe('ACCEPT');
    expect(result.code).toBe('AT_OR_ABOVE_TARGET');
    expect(result.unitPrice).toBe(100);
  });

  it('accepts an offer that clears autoAcceptThreshold', () => {
    const policy = makePolicy({ autoAcceptThreshold: 85 });
    const result = sellerDecision({
      offerUnitPrice: 86,
      quantity: 1,
      stock: 10,
      policy,
      round: 1,
    });
    expect(result.type).toBe('ACCEPT');
    expect(result.code).toBe('AUTO_ACCEPT');
  });

  it('rejects an invalid offer (above listed)', () => {
    const result = sellerDecision({
      offerUnitPrice: 110,
      quantity: 1,
      stock: 10,
      policy: makePolicy(),
      round: 1,
    });
    expect(result.type).toBe('REJECT');
    expect(result.code).toBe('INVALID_OFFER');
  });

  it('rejects when quantity is below minimum', () => {
    const policy = makePolicy({ minimumQuantity: 10 });
    const result = sellerDecision({
      offerUnitPrice: 80,
      quantity: 5,
      stock: 100,
      policy,
      round: 1,
    });
    expect(result.type).toBe('REJECT');
    expect(result.code).toBe('INVALID_OFFER');
  });

  it('rejects when quantity exceeds stock', () => {
    const result = sellerDecision({
      offerUnitPrice: 80,
      quantity: 100,
      stock: 10,
      policy: makePolicy(),
      round: 1,
    });
    expect(result.type).toBe('REJECT');
    expect(result.code).toBe('INVALID_OFFER');
  });

  it('counters when the offer is valid but below target in early round', () => {
    const result = sellerDecision({
      offerUnitPrice: 72,
      quantity: 1,
      stock: 10,
      policy: makePolicy(),
      round: 1,
    });
    expect(result.type).toBe('COUNTER');
    expect(result.code).toBe('COUNTER_OFFER');
    expect(result.unitPrice).toBeGreaterThanOrEqual(70);
    expect(result.unitPrice).toBeLessThanOrEqual(100);
  });

  it('accepts a valid offer at the final round', () => {
    const result = sellerDecision({
      offerUnitPrice: 75,
      quantity: 1,
      stock: 10,
      policy: makePolicy({ maxRounds: 3 }),
      round: 3,
    });
    expect(result.type).toBe('ACCEPT');
    expect(result.code).toBe('WITHIN_AUTHORITY');
  });

  it('rejects a below-minimum offer even at the final round', () => {
    const result = sellerDecision({
      offerUnitPrice: 60,
      quantity: 1,
      stock: 10,
      policy: makePolicy({ maxRounds: 3 }),
      round: 3,
    });
    expect(result.type).toBe('REJECT');
    expect(result.code).toBe('BELOW_AUTHORITY');
  });

  it('accepts when the counter would be at or below the buyer offer', () => {
    // At final rounds the counter converges to minimumAllowed; if buyer >= that, accept
    const result = sellerDecision({
      offerUnitPrice: 75,
      quantity: 1,
      stock: 10,
      policy: makePolicy({ maxRounds: 5 }),
      round: 4,
    });
    // The seller should accept because the internal counter ≤ buyer offer
    expect(result.type).toBe('ACCEPT');
    expect(result.code).toBe('WITHIN_AUTHORITY');
  });

  it('includes the check object in the result', () => {
    const result = sellerDecision({
      offerUnitPrice: 80,
      quantity: 1,
      stock: 10,
      policy: makePolicy(),
      round: 1,
    });
    expect(result.check).toBeDefined();
    expect(result.check.unitPrice).toBe(80);
  });

  it('applies bulk discount to the target price', () => {
    const policy = makePolicy({
      bulkDiscounts: [{ minimumQuantity: 10, discountPercent: 10 }],
    });
    // Target = 100 * (1 - 10/100) = 90. Offer at 90 → accept.
    const result = sellerDecision({
      offerUnitPrice: 90,
      quantity: 10,
      stock: 100,
      policy,
      round: 1,
    });
    expect(result.type).toBe('ACCEPT');
    expect(result.code).toBe('AT_OR_ABOVE_TARGET');
  });

  it('uses the best applicable bulk tier', () => {
    const policy = makePolicy({
      bulkDiscounts: [
        { minimumQuantity: 5, discountPercent: 5 },
        { minimumQuantity: 20, discountPercent: 15 },
      ],
    });
    // quantity=25 → best tier is 15%, target = 100 * 0.85 = 85
    const result = sellerDecision({
      offerUnitPrice: 85,
      quantity: 25,
      stock: 100,
      policy,
      round: 1,
    });
    expect(result.type).toBe('ACCEPT');
    expect(result.code).toBe('AT_OR_ABOVE_TARGET');
  });
});

/* ================================================================== */
/* buyerDecision                                                       */
/* ================================================================== */

describe('buyerDecision', () => {
  it('opens with a first offer at ~78% of listed price when no seller price given', () => {
    const result = buyerDecision({
      listedPrice: 100,
      sellerUnitPrice: null,
      quantity: 1,
      budgetTotal: null,
      previousOwnOffer: null,
      round: 1,
      maxRounds: 5,
    });
    expect(result.type).toBe('OFFER');
    expect(result.unitPrice).toBe(78);
  });

  it('accepts when the seller counter is within budget', () => {
    const result = buyerDecision({
      listedPrice: 100,
      sellerUnitPrice: 80,
      quantity: 1,
      budgetTotal: 90,
      previousOwnOffer: 78,
      round: 2,
      maxRounds: 5,
    });
    expect(result.type).toBe('ACCEPT');
    expect(result.unitPrice).toBe(80);
  });

  it('rejects at the final round when the seller price exceeds the budget', () => {
    const result = buyerDecision({
      listedPrice: 100,
      sellerUnitPrice: 95,
      quantity: 1,
      budgetTotal: 80,
      previousOwnOffer: 78,
      round: 5,
      maxRounds: 5,
    });
    expect(result.type).toBe('REJECT');
    expect(result.unitPrice).toBeNull();
  });

  it('raises the offer toward the seller when budget allows', () => {
    const result = buyerDecision({
      listedPrice: 100,
      sellerUnitPrice: 90,
      quantity: 1,
      budgetTotal: 85,
      previousOwnOffer: 78,
      round: 2,
      maxRounds: 5,
    });
    expect(result.type).toBe('OFFER');
    expect(result.unitPrice).toBeGreaterThan(78);
    expect(result.unitPrice).toBeLessThanOrEqual(85);
  });

  it('never offers above the listed price', () => {
    const result = buyerDecision({
      listedPrice: 50,
      sellerUnitPrice: null,
      quantity: 1,
      budgetTotal: 200,
      previousOwnOffer: null,
      round: 1,
      maxRounds: 5,
    });
    expect(result.type).toBe('OFFER');
    expect(result.unitPrice).toBeLessThanOrEqual(50);
  });

  it('never offers above the per-unit budget', () => {
    const result = buyerDecision({
      listedPrice: 100,
      sellerUnitPrice: null,
      quantity: 2,
      budgetTotal: 100,       // $50 per unit budget
      previousOwnOffer: null,
      round: 1,
      maxRounds: 5,
    });
    expect(result.type).toBe('OFFER');
    expect(result.unitPrice).toBeLessThanOrEqual(50);
  });

  it('rejects when the raised offer cannot exceed the previous offer', () => {
    // Seller counter is above budget ceiling → raised ≤ previous
    const result = buyerDecision({
      listedPrice: 100,
      sellerUnitPrice: 95,
      quantity: 1,
      budgetTotal: 78,
      previousOwnOffer: 78,
      round: 2,
      maxRounds: 5,
    });
    expect(result.type).toBe('REJECT');
    expect(result.unitPrice).toBeNull();
  });

  it('uses listed price as ceiling when budgetTotal is null', () => {
    const result = buyerDecision({
      listedPrice: 100,
      sellerUnitPrice: 95,
      quantity: 1,
      budgetTotal: null,
      previousOwnOffer: 78,
      round: 2,
      maxRounds: 5,
    });
    // ceiling = listedPrice = 100, seller counter 95 ≤ 100 → accept
    expect(result.type).toBe('ACCEPT');
    expect(result.unitPrice).toBe(95);
  });

  it('opening never goes below 0.01', () => {
    const result = buyerDecision({
      listedPrice: 0.005,
      sellerUnitPrice: null,
      quantity: 1,
      budgetTotal: null,
      previousOwnOffer: null,
      round: 1,
      maxRounds: 5,
    });
    expect(result.type).toBe('OFFER');
    expect(result.unitPrice).toBeGreaterThanOrEqual(0.01);
  });
});
