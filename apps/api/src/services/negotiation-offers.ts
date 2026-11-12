import { formatMoney, roundMoney, type OfferInput } from '@bhavai/shared';
import { getDb } from '../db/index.js';
import { newId } from '../utils/crypto.js';
import { badRequest, conflict } from '../utils/errors.js';
import { money } from '../utils/http.js';
import type { AuthContext, BuyerRow } from '../middleware/auth.js';
import { mapProduct, mapRules, policyFromRules } from './products.js';
import { validateOffer } from '../pricing/engine.js';
import { getNegotiationDetail } from './negotiation.js';
import { audit } from './audit.js';

/**
 * A human/buyer-agent submitted counter. The seller engine is not run here;
 * the client (or MCP tool) advances the seller turn explicitly with /step.
 */
export async function submitBuyerOffer(
  negotiationId: string,
  auth: AuthContext & { buyer: BuyerRow },
  input: OfferInput,
) {
  const db = await getDb();

  const created = await db.transaction(async (tx) => {
    const rows = await tx.query(
      `SELECT n.*, p.currency AS product_currency FROM negotiations n
       JOIN products p ON p.id = n.product_id
       WHERE n.id = $1 AND n.buyer_id = $2 FOR UPDATE OF n`,
      [negotiationId, auth.buyer.id],
    );
    const neg = rows[0];
    if (!neg) throw badRequest('Negotiation not found for this buyer.');
    if (neg.status !== 'OPEN') throw conflict('This negotiation is no longer open.');
    if (new Date(String(neg.expires_at)).getTime() < Date.now()) {
      await tx.query(`UPDATE negotiations SET status = 'EXPIRED' WHERE id = $1`, [negotiationId]);
      throw conflict('This negotiation has expired.');
    }
    if (Number(neg.requested_quantity) !== input.quantity) {
      throw badRequest(`This negotiation is for ${neg.requested_quantity} units.`);
    }

    const last = await tx.query(
      `SELECT submitted_by, kind FROM offers WHERE negotiation_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [negotiationId],
    );
    if (last[0] && last[0].submitted_by === 'BUYER_AGENT' && last[0].kind === 'OFFER') {
      throw conflict('The seller agent has not responded to the previous offer yet.');
    }

    const productRows = await tx.query(`SELECT * FROM products WHERE id = $1 FOR UPDATE`, [neg.product_id]);
    const rulesRows = await tx.query(`SELECT * FROM seller_rules WHERE product_id = $1`, [neg.product_id]);
    if (!rulesRows[0]) throw conflict('Pricing rules are missing for this product.');
    const product = mapProduct(productRows[0]);
    const rules = mapRules(rulesRows[0]);
    const policy = policyFromRules(rules, product);
    const check = validateOffer({
      unitPrice: input.unitPrice,
      quantity: input.quantity,
      stock: product.stock,
      policy,
    });

    // A human counter is a move inside the current buyer round, not a new
    // exchange. Only agent rounds advance rounds_used, so repeated or invalid
    // submissions can never exhaust the agent round budget.
    const round = Math.max(1, Number(neg.rounds_used));

    const offerId = newId();
    await tx.query(
      `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round)
       VALUES ($1,$2,'BUYER',$3,$4,$5,$6,$7,'OFFER',$8,$9,$10)`,
      [
        offerId,
        negotiationId,
        'HUMAN',
        input.unitPrice,
        money(input.unitPrice * input.quantity),
        input.quantity,
        check.code,
        input.message || `Buyer offered ${formatMoney(input.unitPrice, product.currency)} per unit.`,
        check.valid ? 'Submitted by the buyer within the seller’s authorised range.' : check.message,
        round,
      ],
    );
    await tx.query(
      `UPDATE negotiations SET last_actor = 'BUYER', updated_at = NOW() WHERE id = $1`,
      [negotiationId],
    );

    return {
      offerId,
      unitPrice: roundMoney(input.unitPrice),
      quantity: input.quantity,
      currency: product.currency,
      round,
      productName: product.name,
      valid: check.valid,
    };
  });

  // Optional language polish; never changes the submitted number.
  if (!created.valid) {
    await audit({
      actor: { id: auth.user.id, role: 'BUYER' },
      action: 'offer.submitted_outside_range',
      resourceType: 'negotiation',
      resourceId: negotiationId,
      metadata: { unitPrice: created.unitPrice, quantity: created.quantity },
    });
  }

  return getNegotiationDetail(negotiationId, auth);
}
