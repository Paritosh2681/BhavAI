import {
  applicableBulkDiscount,
  minimumAllowedPrice,
  roundMoney,
  targetPrice,
  type PricingPolicy,
} from '@bhavai/shared';

export type ValidationCode =
  | 'VALID'
  | 'BELOW_MINIMUM'
  | 'ABOVE_LISTED'
  | 'QUANTITY_UNAVAILABLE'
  | 'BELOW_MIN_QUANTITY'
  | 'INVALID';

export type OfferCheck = {
  valid: boolean;
  code: ValidationCode;
  message: string;
  minimumAllowed: number;
  discountPercent: number;
  total: number;
  quantity: number;
  unitPrice: number;
};

export type SellerDecision =
  | { type: 'ACCEPT'; unitPrice: number; code: 'AT_OR_ABOVE_TARGET' | 'WITHIN_AUTHORITY' | 'AUTO_ACCEPT'; explanation: string }
  | { type: 'COUNTER'; unitPrice: number; code: 'COUNTER_OFFER'; explanation: string; minimumAllowed: number }
  | { type: 'REJECT'; unitPrice: null; code: 'BELOW_AUTHORITY' | 'ROUNDS_EXHAUSTED' | 'INVALID_OFFER'; explanation: string };

/**
 * Deterministic offer validation. The language model never decides whether a
 * price is acceptable; this function (and the database transaction around deal
 * acceptance) is the authority.
 */
export function validateOffer(input: {
  unitPrice: number;
  quantity: number;
  stock: number;
  policy: PricingPolicy;
}): OfferCheck {
  const { unitPrice, quantity, stock, policy } = input;
  const total = roundMoney(unitPrice * quantity);
  const minimumAllowed = minimumAllowedPrice(policy);
  const discountPercent = policy.listedPrice > 0 ? roundMoney(((policy.listedPrice - unitPrice) / policy.listedPrice) * 100) : 0;
  const base = { minimumAllowed, discountPercent, total, quantity, unitPrice };

  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return { ...base, valid: false, code: 'INVALID', message: 'Enter a valid price above zero.' };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ...base, valid: false, code: 'INVALID', message: 'Enter a whole quantity above zero.' };
  }
  if (quantity < policy.minimumQuantity) {
    return {
      ...base,
      valid: false,
      code: 'BELOW_MIN_QUANTITY',
      message: `This seller's minimum order is ${policy.minimumQuantity} units.`,
    };
  }
  if (quantity > stock) {
    return {
      ...base,
      valid: false,
      code: 'QUANTITY_UNAVAILABLE',
      message: `Only ${stock} units are available right now.`,
    };
  }
  if (unitPrice > policy.listedPrice) {
    return {
      ...base,
      valid: false,
      code: 'ABOVE_LISTED',
      message: 'The offer is above the listed price. Accept the listed price to order.',
    };
  }
  if (unitPrice < minimumAllowed) {
    return {
      ...base,
      valid: false,
      code: 'BELOW_MINIMUM',
      message: 'This offer is below the range the seller has authorised.',
    };
  }
  return {
    ...base,
    valid: true,
    code: 'VALID',
    message: 'Offer is within the seller’s authorised range.',
  };
}

export function requiresApproval(policy: PricingPolicy, unitPrice: number): boolean {
  if (policy.requireApprovalBelow === null) return false;
  return unitPrice < policy.requireApprovalBelow;
}

/**
 * Deterministic seller-agent policy. Opens at the seller's target (listed,
 * less any applicable bulk tier) and concedes toward — never below — the
 * authorised minimum as rounds elapse. Accepts immediately at or above target,
 * or when an explicit auto-accept threshold is met.
 */
export function sellerDecision(input: {
  offerUnitPrice: number;
  quantity: number;
  stock: number;
  policy: PricingPolicy;
  round: number;
}): SellerDecision & { check: OfferCheck } {
  const { offerUnitPrice, quantity, stock, policy, round } = input;
  const check = validateOffer({ unitPrice: offerUnitPrice, quantity, stock, policy });
  const minimumAllowed = minimumAllowedPrice(policy);
  const target = targetPrice(policy, quantity);

  if (check.code === 'ABOVE_LISTED' || check.code === 'INVALID') {
    return {
      type: 'REJECT',
      unitPrice: null,
      code: 'INVALID_OFFER',
      explanation: check.message,
      check,
    };
  }

  if (check.code === 'BELOW_MIN_QUANTITY' || check.code === 'QUANTITY_UNAVAILABLE') {
    return { type: 'REJECT', unitPrice: null, code: 'INVALID_OFFER', explanation: check.message, check };
  }

  if (offerUnitPrice >= target) {
    return {
      type: 'ACCEPT',
      unitPrice: roundMoney(offerUnitPrice),
      code: 'AT_OR_ABOVE_TARGET',
      explanation: 'The offer meets the seller’s target price for this quantity.',
      check,
    };
  }

  if (policy.autoAcceptThreshold !== null && offerUnitPrice >= policy.autoAcceptThreshold) {
    return {
      type: 'ACCEPT',
      unitPrice: roundMoney(offerUnitPrice),
      code: 'AUTO_ACCEPT',
      explanation: 'The offer clears the seller’s pre-approved auto-accept price.',
      check,
    };
  }

  if (check.valid && round >= policy.maxRounds) {
    return {
      type: 'ACCEPT',
      unitPrice: roundMoney(offerUnitPrice),
      code: 'WITHIN_AUTHORITY',
      explanation: 'Final round: the offer is within the seller’s authorised range.',
      check,
    };
  }

  if (check.code === 'BELOW_MINIMUM' && round >= policy.maxRounds) {
    return {
      type: 'REJECT',
      unitPrice: null,
      code: 'BELOW_AUTHORITY',
      explanation: 'The negotiation reached its final round without a price inside the seller’s authorised range.',
      check,
    };
  }

  // Concede from target toward the minimum as rounds progress.
  const progress = policy.maxRounds <= 1 ? 1 : Math.min(1, (round - 1) / (policy.maxRounds - 1));
  const opening = minimumAllowed + (target - minimumAllowed) * Math.pow(1 - progress, 1.45);
  let counter = roundMoney(Math.max(minimumAllowed, Math.min(target, opening)));

  // Never respond with a number at or below the buyer's own offer: accept it.
  if (counter <= offerUnitPrice) {
    return {
      type: 'ACCEPT',
      unitPrice: roundMoney(offerUnitPrice),
      code: 'WITHIN_AUTHORITY',
      explanation: 'The offer is at least the seller’s counter position, so the seller accepts.',
      check,
    };
  }

  if (policy.autoAcceptThreshold !== null) counter = Math.min(counter, policy.autoAcceptThreshold);
  counter = roundMoney(Math.min(policy.listedPrice, Math.max(minimumAllowed, counter)));

  const bulk = applicableBulkDiscount(quantity, policy.bulkDiscounts);
  const bulkNote = bulk ? ` A ${bulk.discountPercent}% tier applies at ${bulk.minimumQuantity}+ units.` : '';

  return {
    type: 'COUNTER',
    unitPrice: counter,
    code: 'COUNTER_OFFER',
    explanation: `The seller holds at ${counter.toFixed(2)} per unit for ${quantity} units.${bulkNote}`,
    minimumAllowed,
    check,
  };
}

/**
 * Buyer-agent bidding policy, constrained by the buyer's stated budget.
 * Returns the next buyer move. Never proposes a unit price above the budget.
 */
export type BuyerDecision =
  | { type: 'ACCEPT'; unitPrice: number; explanation: string }
  | { type: 'OFFER'; unitPrice: number; explanation: string }
  | { type: 'REJECT'; unitPrice: null; explanation: string };

export function buyerDecision(input: {
  listedPrice: number;
  sellerUnitPrice: number | null;
  quantity: number;
  budgetTotal: number | null;
  previousOwnOffer: number | null;
  round: number;
  maxRounds: number;
}): BuyerDecision {
  const { listedPrice, sellerUnitPrice, quantity, budgetTotal, previousOwnOffer, round, maxRounds } = input;
  const budgetUnit = budgetTotal ? roundMoney(budgetTotal / quantity) : listedPrice;
  const ceiling = roundMoney(Math.min(listedPrice, budgetUnit));

  if (sellerUnitPrice === null) {
    const opening = roundMoney(Math.max(0.01, Math.min(ceiling, listedPrice * 0.78)));
    return {
      type: 'OFFER',
      unitPrice: opening,
      explanation: `Opens at ${opening.toFixed(2)} per unit, inside the buyer's budget ceiling of ${ceiling.toFixed(2)}.`,
    };
  }

  if (sellerUnitPrice <= ceiling) {
    return {
      type: 'ACCEPT',
      unitPrice: roundMoney(sellerUnitPrice),
      explanation: `The counter at ${sellerUnitPrice.toFixed(2)} per unit fits the buyer's budget.`,
    };
  }

  const previous = previousOwnOffer ?? roundMoney(Math.min(ceiling, listedPrice * 0.78));

  if (round >= maxRounds) {
    return {
      type: 'REJECT',
      unitPrice: null,
      explanation: 'The seller’s price remains above the buyer’s budget at the final round.',
    };
  }

  // Move partway toward the seller, never past the buyer's ceiling.
  const raised = roundMoney(Math.min(ceiling, previous + (sellerUnitPrice - previous) * 0.5));
  if (raised <= previous) {
    return {
      type: 'REJECT',
      unitPrice: null,
      explanation: `The buyer's budget ceiling of ${ceiling.toFixed(2)} per unit is below the seller's counter.`,
    };
  }

  return {
    type: 'OFFER',
    unitPrice: raised,
    explanation: `Raises the offer to ${raised.toFixed(2)} per unit while staying inside the buyer's budget.`,
  };
}
