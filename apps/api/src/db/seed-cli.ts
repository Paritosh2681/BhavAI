import 'dotenv/config';
import { migrate } from './migrate.js';
import { seedDemoData, DEMO_ACCOUNTS } from './seed.js';
import { closeDb } from './index.js';

async function main() {
  await migrate();
  const result = await seedDemoData();
  console.log(result.seeded ? 'Demo data seeded.' : `Demo data skipped: ${result.reason}`);
  console.log('Accounts:', DEMO_ACCOUNTS);
  await closeDb();
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
