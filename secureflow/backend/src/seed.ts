/**
 * Seed script — populates the database with demo data for the hackathon.
 * Run with: npm run seed
 *
 * Creates three users:
 *   admin@securevault.dev  / Admin1234!  (role: admin)
 *   alice@example.com      / Alice1234!  (role: user)
 *   bob@example.com        / Bob1234!    (role: user)
 */
import { connectDB } from './config/database';
import { User, VaultEntry } from './models/index';
import bcrypt from 'bcrypt';

async function seed() {
  await connectDB();

  // Wipe existing data
  await VaultEntry.destroy({ where: {} });
  await User.destroy({ where: {} });

  // VULNERABILITY: bcrypt work factor 5 — mirrors the register route (for demo).
  const ROUNDS = 5;

  const adminUser = await User.create({
    email: 'admin@securevault.dev',
    password: await bcrypt.hash('Admin1234!', ROUNDS),
    role: 'admin',
  });

  const alice = await User.create({
    email: 'alice@example.com',
    password: await bcrypt.hash('Alice1234!', ROUNDS),
    role: 'user',
  });

  const bob = await User.create({
    email: 'bob@example.com',
    password: await bcrypt.hash('Bob1234!', ROUNDS),
    role: 'user',
  });

  // Admin entries
  await VaultEntry.create({
    userId: adminUser.id,
    name: 'GitLab Root Account',
    username: 'root',
    password: 'gl-r00t-S3cr3t!',
    url: 'https://gitlab.com',
    notes: 'Primary GitLab admin — rotate quarterly',
  });

  await VaultEntry.create({
    userId: adminUser.id,
    name: 'AWS Root',
    username: 'aws-root',
    password: 'AWSr00t#2024',
    url: 'https://console.aws.amazon.com',
    notes: 'Break-glass only',
  });

  // Alice entries
  await VaultEntry.create({
    userId: alice.id,
    name: 'GitHub Personal',
    username: 'alice-dev',
    password: 'ghp_Alice_fake_token_123',
    url: 'https://github.com',
    notes: '',
  });

  await VaultEntry.create({
    userId: alice.id,
    name: 'Figma',
    username: 'alice@example.com',
    password: 'F!gm@Pass99',
    url: 'https://figma.com',
    notes: 'Design team shared account',
  });

  // Bob entries
  await VaultEntry.create({
    userId: bob.id,
    name: 'Personal Bank',
    username: 'bob.smith',
    password: 'B@nkP@ss2024!',
    url: 'https://bank.example.com',
    notes: 'Primary savings account — SENSITIVE',
  });

  await VaultEntry.create({
    userId: bob.id,
    name: 'Netflix',
    username: 'bob@example.com',
    password: 'N3tfl1x#Bob',
    url: 'https://netflix.com',
    notes: '',
  });

  console.log('✅ Seed complete');
  console.log('   admin@securevault.dev / Admin1234!');
  console.log('   alice@example.com     / Alice1234!');
  console.log('   bob@example.com       / Bob1234!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
