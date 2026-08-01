/* eslint-disable @typescript-eslint/no-require-imports */
// Создание тестовых пользователей — запуск: docker compose exec -T api node prisma/seed-inline.cjs
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const { randomBytes } = require('crypto');

const QA_PASSWORD = process.env.SEED_PASSWORD || 'Test1234!';
const prisma = new PrismaClient();

async function upsertUser({ email, password, role, tenantId = null }) {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  return prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role,
      tenantId,
      status: 'active',
      twoFaEnabled: false,
      twoFaSecret: null,
    },
    create: { email, passwordHash, role, tenantId, status: 'active' },
  });
}

async function main() {
  const startTariff = await prisma.tariff.findFirst({
    where: { name: 'Start', isActive: true },
  });

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 7);

  await upsertUser({
    email: 'admin@chat24ai.local',
    password: QA_PASSWORD,
    role: 'owner',
    tenantId: null,
  });

  let tenant = await prisma.tenant.findFirst({ where: { name: 'Demo Company QA' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Demo Company QA',
        status: 'active',
        trialEndsAt,
        tariffId: startTariff?.id,
      },
    });
  }

  const clientUser = await upsertUser({
    email: 'client@demo.local',
    password: QA_PASSWORD,
    role: 'client',
    tenantId: tenant.id,
  });

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { ownerUserId: clientUser.id },
  });

  console.log('OK: users created');
  console.log('  Admin:  admin@chat24ai.local / ' + QA_PASSWORD);
  console.log('  Client: client@demo.local / ' + QA_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
