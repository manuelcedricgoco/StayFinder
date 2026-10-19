// Seeds reference data (municipalities, amenities) and, optionally, the first ADMIN account.
// Run with: npm run db:seed   (safe to run again at any time)
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';
import { emailSchema, passwordSchema } from '../src/validators/auth.validators';
import { AMENITIES, MUNICIPALITIES, seedReferenceData } from './seedData';
import { seedDemoData } from './demoSeed';

dotenv.config();
const prisma = new PrismaClient();

async function seedAdmin() {
  const rawEmail = process.env.ADMIN_EMAIL?.trim();
  const rawPassword = process.env.ADMIN_PASSWORD;

  if (!rawEmail && !rawPassword) {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set in backend/.env - skipping the admin account.');
    return;
  }

  const name = process.env.ADMIN_NAME?.trim() || 'Administrator';
  const emailResult = emailSchema.safeParse(rawEmail ?? '');
  const passwordResult = passwordSchema.safeParse(rawPassword ?? '');

  if (!emailResult.success || !passwordResult.success) {
    console.error('Cannot create the admin. In backend/.env set:');
    console.error('  ADMIN_EMAIL=<a valid email>');
    console.error('  ADMIN_PASSWORD=<8+ characters with a letter and a number>');
    process.exitCode = 1;
    return;
  }

  const email = emailResult.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`A user with email ${email} already exists (role ${existing.role}). Nothing changed.`);
    return;
  }

  await prisma.user.create({
    data: { name, email, role: 'ADMIN', passwordHash: await hashPassword(passwordResult.data) },
  });
  console.log(`Admin account created for ${email}.`);
}

async function main() {
  await seedReferenceData(prisma);
  console.log(`Reference data ready: ${MUNICIPALITIES.length} municipalities, ${AMENITIES.length} amenities.`);
  await seedDemoData(prisma);
  await seedAdmin();
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
