/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error('ADMIN_EMAIL и ADMIN_PASSWORD обязательны');
  process.exit(1);
}

const prisma = new PrismaClient();

(async () => {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: 'owner',
      tenantId: null,
      status: 'active',
      twoFaEnabled: false,
      twoFaSecret: null,
    },
    create: {
      email,
      passwordHash,
      role: 'owner',
      status: 'active',
      tenantId: null,
    },
  });

  console.log('OK: admin created');
  console.log('  id:', user.id);
  console.log('  email:', user.email);
  console.log('  role:', user.role);
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
