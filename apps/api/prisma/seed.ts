import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

const QA_PASSWORD = process.env.SEED_PASSWORD ?? 'Test1234!';

const ACCOUNTS = {
  admin: 'admin@chat24ai.local',
  client: 'client@demo.local',
} as const;

async function upsertUser(params: {
  email: string;
  password: string;
  role: 'owner' | 'client';
  tenantId?: string | null;
}) {
  const passwordHash = await argon2.hash(params.password, {
    type: argon2.argon2id,
  });

  return prisma.user.upsert({
    where: { email: params.email },
    update: {
      passwordHash,
      role: params.role,
      tenantId: params.tenantId ?? null,
      status: 'active',
      twoFaEnabled: false,
      twoFaSecret: null,
    },
    create: {
      email: params.email,
      passwordHash,
      role: params.role,
      tenantId: params.tenantId ?? null,
      status: 'active',
    },
  });
}

async function main() {
  const startTariff = await prisma.tariff.findFirst({
    where: { name: 'Start', isActive: true },
  });

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 7);

  await upsertUser({
    email: ACCOUNTS.admin,
    password: QA_PASSWORD,
    role: 'owner',
    tenantId: null,
  });

  let tenant = await prisma.tenant.findFirst({
    where: { name: 'Demo Company QA' },
  });

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
    email: ACCOUNTS.client,
    password: QA_PASSWORD,
    role: 'client',
    tenantId: tenant.id,
  });

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { ownerUserId: clientUser.id },
  });

  const existingSub = await prisma.subscription.findFirst({
    where: { tenantId: tenant.id },
  });

  if (!existingSub && startTariff) {
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        tariffId: startTariff.id,
        status: 'trialing',
        currentPeriodEnd: trialEndsAt,
      },
    });
  }

  let source = await prisma.source.findFirst({
    where: { tenantId: tenant.id, name: 'Демо-сайт' },
  });

  if (!source) {
    source = await prisma.source.create({
      data: {
        tenantId: tenant.id,
        name: 'Демо-сайт',
        type: 'website',
        status: 'active',
        widgetKey: `wk_${randomBytes(12).toString('hex')}`,
        configJson: {
          appearance: { primaryColor: '#4f46e5' },
          personalization: { botName: 'Ассистент' },
        },
      },
    });
  }

  let pipeline = await prisma.pipeline.findFirst({
    where: { tenantId: tenant.id, isDefault: true },
  });

  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: 'Основная воронка',
        isDefault: true,
        statuses: {
          create: [
            { name: 'Новый', sortOrder: 0, color: '#3b82f6' },
            { name: 'В работе', sortOrder: 1, color: '#f59e0b' },
            { name: 'Успех', sortOrder: 2, color: '#22c55e' },
          ],
        },
      },
    });
  }

  console.log('QA seed complete:');
  console.log(`  Admin:  ${ACCOUNTS.admin} / ${QA_PASSWORD}`);
  console.log(`  Client: ${ACCOUNTS.client} / ${QA_PASSWORD}`);
  console.log(`  Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`  Source: ${source.name} (widgetKey=${source.widgetKey})`);
  console.log(`  Pipeline: ${pipeline.name} (${pipeline.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
