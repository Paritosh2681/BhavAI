import { hashPassword, newId } from '../utils/crypto.js';
import { getDb } from './index.js';
import { logger } from '../utils/logger.js';

/**
 * Demo data is explicitly labelled as sample everywhere it surfaces. It seeds
 * negotiations, one accepted cross-border deal with NO payment, and one
 * domestic manual-settlement order. It never marks a payment completed, so no
 * metric implies money moved.
 */

const DEMO_PASSWORD = 'BhavAI!2026';
const SELLER_EMAIL = 'seller@bhavai.demo';
const BUYER_US_EMAIL = 'alex@bhavai.demo';
const BUYER_IN_EMAIL = 'priya@bhavai.demo';
const MEERA_EMAIL = 'meera@bhavai.demo';

type ProductSeed = {
  id: string;
  name: string;
  description: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  rule: {
    floor: number;
    maxDiscount: number;
    minQty: number;
    bulk: Array<{ minimumQuantity: number; discountPercent: number }>;
    maxRounds: number;
    autoAccept: number | null;
    approvalBelow: number | null;
    approvalRequired: boolean;
  };
};

export async function seedDemoData(): Promise<{ seeded: boolean; reason?: string }> {
  const db = await getDb();
  const existing = await db.query(`SELECT id FROM users WHERE email = $1`, [SELLER_EMAIL]);
  if (existing[0]) return { seeded: false, reason: 'Demo accounts already exist.' };

  const now = Date.now();
  const day = 86_400_000;
  const at = (daysAgo: number, hour = 11) => {
    const d = new Date(now - daysAgo * day);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  };

  const sellerUser = newId();
  const sellerId = newId();
  const alexUser = newId();
  const alexBuyer = newId();
  const priyaUser = newId();
  const priyaBuyer = newId();
  const meeraUser = newId();
  const meeraSeller = newId();
  const passwordHash = hashPassword(DEMO_PASSWORD);

  const aaranyaProducts: ProductSeed[] = [
    {
      id: newId(),
      name: 'Hand-cast Brass Diya',
      description:
        'A small oil lamp cast by hand in Moradabad, with a warm antiqued finish. Each piece is slightly different. Sold individually; wick not included.',
      sku: 'DIYA-001',
      category: 'Home & Decor',
      price: 12,
      stock: 120,
      unit: 'piece',
      rule: {
        floor: 9.6,
        maxDiscount: 20,
        minQty: 5,
        bulk: [
          { minimumQuantity: 20, discountPercent: 5 },
          { minimumQuantity: 50, discountPercent: 10 },
        ],
        maxRounds: 5,
        autoAccept: 11.4,
        approvalBelow: 10.2,
        approvalRequired: false,
      },
    },
    {
      id: newId(),
      name: 'Brass Incense Holder',
      description:
        'A minimal, weighted brass holder for incense sticks with a removable ash tray. Cast and finished by the same workshop as our diyas.',
      sku: 'INC-002',
      category: 'Home & Decor',
      price: 18,
      stock: 80,
      unit: 'piece',
      rule: {
        floor: 14,
        maxDiscount: 18,
        minQty: 4,
        bulk: [{ minimumQuantity: 24, discountPercent: 8 }],
        maxRounds: 4,
        autoAccept: 16.5,
        approvalBelow: 15,
        approvalRequired: false,
      },
    },
    {
      id: newId(),
      name: 'Hammered Brass Bowl',
      description:
        'A medium serving bowl with a hand-hammered surface and food-safe lacquer. Suitable for dry snacks and display. Diameter 18 cm.',
      sku: 'BOWL-003',
      category: 'Kitchen & Dining',
      price: 24,
      stock: 60,
      unit: 'piece',
      rule: {
        floor: 19,
        maxDiscount: 20,
        minQty: 4,
        bulk: [{ minimumQuantity: 20, discountPercent: 10 }],
        maxRounds: 5,
        autoAccept: 21.5,
        approvalBelow: null,
        approvalRequired: false,
      },
    },
    {
      id: newId(),
      name: 'Amber Glass Lantern',
      description:
        'A mouth-blown amber glass lantern with a brass frame. Designed for tea lights and warm evening light. Ships in recycled protective packaging.',
      sku: 'LANT-004',
      category: 'Home & Decor',
      price: 35,
      stock: 40,
      unit: 'piece',
      rule: {
        floor: 28,
        maxDiscount: 18,
        minQty: 2,
        bulk: [{ minimumQuantity: 12, discountPercent: 7 }],
        maxRounds: 5,
        autoAccept: 32,
        approvalBelow: 29.5,
        approvalRequired: true,
      },
    },
  ];

  const meeraProducts: ProductSeed[] = [
    {
      id: newId(),
      name: 'Handwoven Cotton Stole',
      description:
        'A light cotton stole woven on a pit loom in Kutch, with a natural-dye border. Breathable, reversible and finished by hand.',
      sku: 'STOLE-101',
      category: 'Textiles',
      price: 1450,
      stock: 50,
      unit: 'piece',
      rule: {
        floor: 1150,
        maxDiscount: 20,
        minQty: 5,
        bulk: [{ minimumQuantity: 12, discountPercent: 8 }],
        maxRounds: 4,
        autoAccept: 1320,
        approvalBelow: 1220,
        approvalRequired: false,
      },
    },
    {
      id: newId(),
      name: 'Block-print Table Runner',
      description:
        'A cotton table runner block-printed by hand with a repeating indigo motif. 180 × 35 cm. Machine washable on a gentle cycle.',
      sku: 'RUN-102',
      category: 'Home & Decor',
      price: 980,
      stock: 35,
      unit: 'piece',
      rule: {
        floor: 780,
        maxDiscount: 20,
        minQty: 4,
        bulk: [{ minimumQuantity: 15, discountPercent: 10 }],
        maxRounds: 4,
        autoAccept: 900,
        approvalBelow: null,
        approvalRequired: false,
      },
    },
    {
      id: newId(),
      name: 'Indigo Cushion Cover Set',
      description:
        'A set of two indigo cushion covers in handloom cotton, with concealed zips. Covers only; inserts not included. 45 × 45 cm.',
      sku: 'CUSH-103',
      category: 'Home & Decor',
      price: 1250,
      stock: 60,
      unit: 'set',
      rule: {
        floor: 990,
        maxDiscount: 20,
        minQty: 3,
        bulk: [{ minimumQuantity: 10, discountPercent: 12 }],
        maxRounds: 5,
        autoAccept: 1150,
        approvalBelow: null,
        approvalRequired: false,
      },
    },
  ];

  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO users (id, email, password_hash, name, role, country, currency, created_at)
       VALUES ($1,$2,$3,$4,'SELLER','IN','USD',$5), ($6,$7,$8,$9,'BUYER','US','USD',$10),
              ($11,$12,$13,$14,'BUYER','IN','INR',$15), ($16,$17,$18,$19,'SELLER','IN','INR',$20)`,
      [
        sellerUser, SELLER_EMAIL, passwordHash, 'Aaranya Crafts', at(40),
        alexUser, BUYER_US_EMAIL, passwordHash, 'Alex Rivera', at(30),
        priyaUser, BUYER_IN_EMAIL, passwordHash, 'Priya Nair', at(28),
        meeraUser, MEERA_EMAIL, passwordHash, 'Meera Textiles', at(38),
      ],
    );

    await tx.query(
      `INSERT INTO sellers (id, user_id, business_name, country, currency, store_slug, description, active, onboarding_complete, rules_confirmed, created_at, updated_at)
       VALUES ($1,$2,'Aaranya Crafts','IN','USD','aaranya-crafts',
               'Small-batch brass and glass objects made with a family workshop in Moradabad. We ship worldwide from Jaipur and negotiate fairly on volume orders.',TRUE,TRUE,TRUE,$3,$3),
              ($4,$5,'Meera Textiles','IN','INR','meera-textiles',
               'Handloom textiles from Kutch and Jaipur. Direct relationships with weaving families, natural dyes and small production runs. Domestic orders settle directly.',TRUE,TRUE,TRUE,$6,$6)`,
      [sellerId, sellerUser, at(39), meeraSeller, meeraUser, at(37)],
    );

    await tx.query(
      `INSERT INTO buyers (id, user_id, company_name, country, currency, preferences, created_at)
       VALUES ($1,$2,'Rivera Studio','US','USD','Boutique retail buyer focused on handmade homeware. Prefers consolidated volume orders.',$3),
              ($4,$5,'Nair Home','IN','INR','Independent homeware store in Bengaluru. Domestic settlement by bank transfer.',$6)`,
      [alexBuyer, alexUser, at(29), priyaBuyer, priyaUser, at(27)],
    );

    for (const product of [...aaranyaProducts, ...meeraProducts]) {
      const seller = aaranyaProducts.includes(product) ? sellerId : meeraSeller;
      await tx.query(
        `INSERT INTO products (id, seller_id, name, description, sku, category, images, listed_price, currency, stock, unit, country_of_origin, active, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'[]'::jsonb,$7,$8,$9,$10,'IN',TRUE,$11,$11)`,
        [
          product.id,
          seller,
          product.name,
          product.description,
          product.sku,
          product.category,
          product.price,
          aaranyaProducts.includes(product) ? 'USD' : 'INR',
          product.stock,
          product.unit,
          at(35),
        ],
      );
      await tx.query(
        `INSERT INTO seller_rules (id, seller_id, product_id, floor_price, max_discount_percent, minimum_quantity, bulk_discounts, max_rounds, auto_accept_threshold, require_approval_below, approval_required, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12)`,
        [
          newId(),
          seller,
          product.id,
          product.rule.floor,
          product.rule.maxDiscount,
          product.rule.minQty,
          JSON.stringify(product.rule.bulk),
          product.rule.maxRounds,
          product.rule.autoAccept,
          product.rule.approvalBelow,
          product.rule.approvalRequired,
          at(34),
        ],
      );
    }

    const diya = aaranyaProducts[0]!;
    const lantern = aaranyaProducts[3]!;
    const stole = meeraProducts[0]!;
    const runner = meeraProducts[1]!;

    /* ---------------- sample 1: cross-border, agreed, no payment ---------------- */
    const neg1 = newId();
    const deal1 = newId();
    await tx.query(
      `INSERT INTO negotiations (id, buyer_id, seller_id, product_id, status, requested_quantity, currency, listed_price,
        budget_total, market_type, rounds_used, max_rounds, agent_mode, last_actor, is_sample, expires_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'AGREED',20,'USD',12,210,'CROSS_BORDER',3,5,'POLICY','BUYER_AGENT',TRUE,$5,$6,$7)`,
      [neg1, alexBuyer, sellerId, diya.id, at(2), at(6), at(3)],
    );

    const offers1: Array<[string, string, 'BUYER_AGENT' | 'SELLER_AGENT', number, number, string, string, 'OFFER' | 'ACCEPTANCE', Date]> = [
      [newId(), neg1, 'BUYER_AGENT', 9.4, 188, 'Offering 9.40 per unit for 20 units.', 'Opens at 9.40 per unit, inside the buyer’s budget ceiling of 10.50.', 'OFFER', at(6)],
      [newId(), neg1, 'SELLER_AGENT', 11.4, 228, 'Countering at 11.40 per unit.', 'The seller holds at 11.40 per unit for 20 units. A 5% tier applies at 20+ units.', 'OFFER', at(5)],
      [newId(), neg1, 'BUYER_AGENT', 10.4, 208, 'Offering 10.40 per unit for 20 units.', 'Raises the offer to 10.40 per unit while staying inside the buyer’s budget.', 'OFFER', at(4)],
      [newId(), neg1, 'SELLER_AGENT', 11, 220, 'Accepted at 11.00 per unit.', 'The offer clears the seller’s pre-approved auto-accept price.', 'ACCEPTANCE', at(3)],
    ];
    for (let i = 0; i < offers1.length; i += 1) {
      const [oid, nid, actor, unit, total, message, explanation, kind, when] = offers1[i]!;
      await tx.query(
        `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round, created_at)
         VALUES ($1,$2,$3,'POLICY',$4,$5,20,'VALID',$6,$7,$8,$9,$10)`,
        [oid, nid, actor, unit, total, kind, message, explanation, i < 2 ? 1 : i, when],
      );
    }
    await tx.query(
      `INSERT INTO deals (id, negotiation_id, agreed_unit_price, agreed_quantity, total_amount, currency, status, market_type, is_sample, accepted_at, buyer_confirmed_at, created_at)
       VALUES ($1,$2,11,20,220,'USD','ACCEPTED','CROSS_BORDER',TRUE,$3,$3,$3)`,
      [deal1, neg1, at(3)],
    );

    /* ---------------- sample 2: cross-border, open, no deal ---------------- */
    const neg2 = newId();
    await tx.query(
      `INSERT INTO negotiations (id, buyer_id, seller_id, product_id, status, requested_quantity, currency, listed_price,
        budget_total, market_type, rounds_used, max_rounds, agent_mode, last_actor, is_sample, expires_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'OPEN',6,'USD',35,190,'CROSS_BORDER',1,5,'POLICY','SELLER_AGENT',TRUE,$5,$6,$7)`,
      [neg2, alexBuyer, sellerId, lantern.id, at(-2), at(1), at(0)],
    );
    await tx.query(
      `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round, created_at)
       VALUES ($1,$2,'BUYER_AGENT','POLICY',27.3,163.8,6,'VALID','OFFER','Offering 27.30 per unit for 6 units.','Opens at 27.30 per unit, inside the buyer’s budget ceiling of 31.67.',1,$3),
              ($4,$2,'SELLER_AGENT','POLICY',32.55,195.3,6,'VALID','OFFER','Countering at 32.55 per unit.','The seller holds at 32.55 per unit for 6 units.',1,$5)`,
      [newId(), neg2, at(1), newId(), at(0)],
    );

    /* ---------------- sample 3: domestic manual settlement order ---------------- */
    const neg3 = newId();
    const deal3 = newId();
    const order3 = newId();
    const payment3 = newId();
    await tx.query(
      `INSERT INTO negotiations (id, buyer_id, seller_id, product_id, status, requested_quantity, currency, listed_price,
        budget_total, market_type, rounds_used, max_rounds, agent_mode, last_actor, is_sample, expires_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'AGREED',12,'INR',1450,15600,'DOMESTIC',2,4,'POLICY','BUYER_AGENT',TRUE,$5,$6,$7)`,
      [neg3, priyaBuyer, meeraSeller, stole.id, at(-3), at(8), at(6)],
    );
    await tx.query(
      `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round, created_at)
       VALUES ($1,$2,'BUYER_AGENT','POLICY',1160,13920,12,'VALID','OFFER','Offering ₹1,160.00 per unit for 12 units.','Opens at 1,160.00 per unit, inside the buyer’s budget ceiling of 1,300.00.',1,$3),
              ($4,$2,'SELLER_AGENT','POLICY',1334,16008,12,'VALID','OFFER','Countering at ₹1,334.00 per unit.','The seller holds at 1,334.00 per unit for 12 units. An 8% tier applies at 12+ units.',2,$5),
              ($6,$2,'BUYER_AGENT','POLICY',1250,15000,12,'VALID','ACCEPTANCE','Accepted at ₹1,250.00 per unit.','The counter at 1,250.00 per unit fits the buyer’s budget.',2,$7)`,
      [newId(), neg3, at(8), newId(), at(7), newId(), at(6)],
    );
    await tx.query(
      `INSERT INTO deals (id, negotiation_id, agreed_unit_price, agreed_quantity, total_amount, currency, status, market_type, is_sample, accepted_at, buyer_confirmed_at, created_at)
       VALUES ($1,$2,1250,12,15000,'INR','CONSUMED','DOMESTIC',TRUE,$3,$3,$3)`,
      [deal3, neg3, at(6)],
    );
    await tx.query(
      `INSERT INTO orders (id, deal_id, seller_id, buyer_id, payment_provider, external_order_id, market_type, status, payment_state,
        total_amount, currency, settlement_note, is_sample, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'MANUAL',NULL,'DOMESTIC','SETTLEMENT_PENDING','CREATED',15000,'INR',
        'Sample order. India domestic settlement is agreed off-platform; BhavAI has not received or verified funds.',TRUE,$5,$5)`,
      [order3, deal3, meeraSeller, priyaBuyer, at(6)],
    );
    await tx.query(
      `INSERT INTO payments (id, order_id, provider, provider_order_id, provider_capture_id, amount, currency, status, approval_url, payload, created_at, updated_at)
       VALUES ($1,$2,'MANUAL',NULL,NULL,15000,'INR','CREATED',NULL,'{"mode":"manual_off_platform","sample":true}'::jsonb,$3,$3)`,
      [payment3, order3, at(6)],
    );

    /* ---------------- sample 4: domestic open negotiation ---------------- */
    const neg4 = newId();
    await tx.query(
      `INSERT INTO negotiations (id, buyer_id, seller_id, product_id, status, requested_quantity, currency, listed_price,
        budget_total, market_type, rounds_used, max_rounds, agent_mode, last_actor, is_sample, expires_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'OPEN',6,'INR',980,5400,'DOMESTIC',1,4,'POLICY','SELLER_AGENT',TRUE,$5,$6,$7)`,
      [neg4, priyaBuyer, meeraSeller, runner.id, at(4), at(2), at(1)],
    );
    await tx.query(
      `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round, created_at)
       VALUES ($1,$2,'BUYER_AGENT','POLICY',790,4740,6,'VALID','OFFER','Offering ₹790.00 per unit for 6 units.','Opens at 790.00 per unit, inside the buyer’s budget ceiling of 900.00.',1,$3)`,
      [newId(), neg4, at(2)],
    );
  });

  logger.info('demo_seeded', {
    sellers: ['aaranya-crafts', 'meera-textiles'],
    accounts: [SELLER_EMAIL, BUYER_US_EMAIL, BUYER_IN_EMAIL, MEERA_EMAIL],
  });
  return { seeded: true };
}

export const DEMO_ACCOUNTS = {
  password: DEMO_PASSWORD,
  seller: SELLER_EMAIL,
  buyerUS: BUYER_US_EMAIL,
  buyerIN: BUYER_IN_EMAIL,
  sellerIN: MEERA_EMAIL,
};
