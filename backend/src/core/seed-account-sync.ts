import { PrismaClient } from '@prisma/client';
import { argon2id, hash } from 'argon2';
import { z } from 'zod';

const accountSchema = z.object({
  email: z.email(),
  password: z.string().min(12),
});

export async function syncSeedAccountPasswords() {
  if (process.env.SYNC_SEED_ACCOUNT_PASSWORDS !== 'true') return;

  const db = new PrismaClient();
  try {
    for (const prefix of ['ADMIN', 'STAFF', 'CUSTOMER'] as const) {
      const account = accountSchema.parse({
        email: process.env[`SEED_${prefix}_EMAIL`],
        password: process.env[`SEED_${prefix}_PASSWORD`],
      });
      const passwordHash = await hash(account.password, {
        type: argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      });
      await db.user.updateMany({
        where: { email: account.email.toLowerCase() },
        data: { passwordHash },
      });
    }
    await db.session.deleteMany({
      where: { user: { email: { in: ['ADMIN', 'STAFF', 'CUSTOMER'].map((prefix) => process.env[`SEED_${prefix}_EMAIL`]!.toLowerCase()) } } },
    });
  } finally {
    await db.$disconnect();
  }
}
