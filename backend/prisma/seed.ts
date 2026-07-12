import { PrismaClient, UserRole, StaffRole, QueueStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedDemoInsidePatrons(
  barId: string,
  prefix: string,
  partySizes: number[],
  passwordHash: string,
) {
  const names = [
    'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery',
    'Sam', 'Jamie', 'Cameron', 'Dakota', 'Reese', 'Skyler', 'Peyton', 'Sawyer',
    'Hayden', 'Emerson', 'Rowan', 'Sage', 'Phoenix', 'River', 'Kai', 'Finley',
  ];

  const userData = partySizes.map((size, i) => {
    const email = `${prefix}-demo-${String(i + 1).padStart(3, '0')}@barlink.com`;
    const name = `${names[i % names.length]} ${String.fromCharCode(65 + (i % 26))}.`;
    return {
      email,
      displayName: name,
      passwordHash,
      role: UserRole.PATRON,
    };
  });

  await prisma.user.createMany({ data: userData, skipDuplicates: true });

  const created = await prisma.user.findMany({
    where: { email: { in: userData.map((u) => u.email) } },
    select: { id: true, email: true },
  });

  const emailToId = new Map(created.map((u) => [u.email, u.id]));
  const now = new Date();

  const profileData = userData.map((u, i) => {
    const gender = Math.random() < 0.5 ? 'male' : 'female';
    const age = Math.floor(Math.random() * 23) + 18;
    return {
      userId: emailToId.get(u.email)!,
      photoUrl: `https://i.pravatar.cc/150?u=${encodeURIComponent(u.email)}`,
      bio: `Here for the ${barId === 'bar-001' ? 'live music' : 'rooftop vibes'}.`,
      gender,
      age,
      openToChat: Math.random() > 0.7,
    };
  });

  await prisma.profile.createMany({ data: profileData, skipDuplicates: true });

  const queueData = userData.map((u, i) => ({
    userId: emailToId.get(u.email)!,
    barId,
    partySize: partySizes[i],
    position: 0,
    status: QueueStatus.INSIDE,
    qrCode: `qr-${prefix}-${String(i + 1).padStart(3, '0')}`,
    joinedAt: now,
    admittedAt: now,
  }));

  await prisma.queueEntry.createMany({ data: queueData, skipDuplicates: true });
}

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@barlink.com' },
    update: {},
    create: {
      email: 'admin@barlink.com',
      displayName: 'Admin User',
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const staffUser = await prisma.user.upsert({
    where: { email: 'staff@barlink.com' },
    update: {},
    create: {
      email: 'staff@barlink.com',
      displayName: 'Door Staff',
      passwordHash,
      role: UserRole.STAFF,
    },
  });

  const patron = await prisma.user.upsert({
    where: { email: 'patron@barlink.com' },
    update: {},
    create: {
      email: 'patron@barlink.com',
      displayName: 'Test Patron',
      passwordHash,
      role: UserRole.PATRON,
    },
  });

  const bar1 = await prisma.bar.upsert({
    where: { id: 'bar-001' },
    update: {},
    create: {
      id: 'bar-001',
      name: 'The Rusty Anchor',
      description: 'A lively waterfront bar with live music every Friday.',
      address: '123 Harbor Blvd, Miami, FL',
      latitude: 25.7617,
      longitude: -80.1918,
      maxCapacity: 150,
      currentCount: 45,
      isActive: true,
      openTime: '18:00',
      closeTime: '02:00',
      coverCharge: 10,
      promos: ['Happy Hour 6-8pm', 'Ladies Night Thursday'],
    },
  });

  const bar2 = await prisma.bar.upsert({
    where: { id: 'bar-002' },
    update: {},
    create: {
      id: 'bar-002',
      name: 'Neon Lounge',
      description: 'Upscale cocktail bar with a rooftop terrace.',
      address: '456 Brickell Ave, Miami, FL',
      latitude: 25.7589,
      longitude: -80.1954,
      maxCapacity: 80,
      currentCount: 72,
      isActive: true,
      openTime: '20:00',
      closeTime: '04:00',
      coverCharge: 20,
      promos: ['Buy 2 Get 1 Free cocktails'],
    },
  });

  await prisma.barStaff.upsert({
    where: { userId_barId: { userId: staffUser.id, barId: bar1.id } },
    update: {},
    create: {
      userId: staffUser.id,
      barId: bar1.id,
      role: StaffRole.DOORSTAFF,
    },
  });

  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  await prisma.deal.upsert({
    where: { id: 'deal-rusty-1' },
    update: {},
    create: {
      id: 'deal-rusty-1',
      barId: bar1.id,
      title: '🍺 Happy Hour Drafts',
      description: 'All domestic drafts $3 until 8pm.',
      startsAt: new Date(now.setHours(18, 0, 0, 0)),
      endsAt: new Date(now.setHours(20, 0, 0, 0)),
      isActive: true,
    },
  });

  await prisma.deal.upsert({
    where: { id: 'deal-rusty-2' },
    update: {},
    create: {
      id: 'deal-rusty-2',
      barId: bar1.id,
      title: '🍷 Wine Wednesday',
      description: 'Half off all glasses of wine.',
      startsAt: new Date(now.setHours(18, 0, 0, 0)),
      endsAt: new Date(now.setHours(23, 59, 0, 0)),
      isActive: true,
    },
  });

  await prisma.deal.upsert({
    where: { id: 'deal-neon-1' },
    update: {},
    create: {
      id: 'deal-neon-1',
      barId: bar2.id,
      title: '🍸 Rooftop Cocktails',
      description: 'Signature cocktails 2-for-1 on the terrace.',
      startsAt: new Date(now.setHours(20, 0, 0, 0)),
      endsAt: inOneHour,
      isActive: true,
    },
  });

  await prisma.deal.upsert({
    where: { id: 'deal-neon-2' },
    update: {},
    create: {
      id: 'deal-neon-2',
      barId: bar2.id,
      title: '🥃 Bourbon Night',
      description: 'Premium bourbon flights 25% off.',
      startsAt: tomorrow,
      endsAt: new Date(tomorrow.getTime() + 4 * 60 * 60 * 1000),
      isActive: true,
    },
  });

  await prisma.profile.upsert({
    where: { userId: patron.id },
    update: {},
    create: {
      userId: patron.id,
      photoUrl: 'https://i.pravatar.cc/150?u=patron',
      bio: 'Here for the live music and good vibes. Open to meeting new people!',
      gender: 'female',
      age: 27,
      openToChat: true,
    },
  });

  const patron2 = await prisma.user.upsert({
    where: { email: 'patron2@barlink.com' },
    update: {},
    create: {
      email: 'patron2@barlink.com',
      displayName: 'Mia T.',
      passwordHash,
      role: UserRole.PATRON,
    },
  });

  await prisma.profile.upsert({
    where: { userId: patron2.id },
    update: {},
    create: {
      userId: patron2.id,
      photoUrl: 'https://i.pravatar.cc/150?u=mia',
      bio: 'Cocktail lover, rooftop fan. Say hi!',
      gender: 'female',
      age: 24,
      openToChat: true,
    },
  });

  const patron3 = await prisma.user.upsert({
    where: { email: 'patron3@barlink.com' },
    update: {},
    create: {
      email: 'patron3@barlink.com',
      displayName: 'Jake R.',
      passwordHash,
      role: UserRole.PATRON,
    },
  });

  await prisma.profile.upsert({
    where: { userId: patron3.id },
    update: {},
    create: {
      userId: patron3.id,
      photoUrl: 'https://i.pravatar.cc/150?u=jake',
      bio: 'Visiting from out of town. Show me the local spots.',
      gender: 'male',
      age: 29,
      openToChat: true,
    },
  });

  // Seeded demo crowd for The Rusty Anchor: 45 people total
  // 15 generated parties (41 people) + 3 named patrons (1+2+1 = 4 people)
  await seedDemoInsidePatrons(
    bar1.id,
    'rusty',
    [...Array(13).fill(3), 1, 1],
    passwordHash,
  );

  await prisma.queueEntry.createMany({
    data: [
      {
        userId: patron.id,
        barId: bar1.id,
        partySize: 1,
        position: 0,
        status: QueueStatus.INSIDE,
        qrCode: 'qr-patron-001',
        joinedAt: new Date(),
        admittedAt: new Date(),
      },
      {
        userId: patron2.id,
        barId: bar1.id,
        partySize: 2,
        position: 0,
        status: QueueStatus.INSIDE,
        qrCode: 'qr-patron2-001',
        joinedAt: new Date(),
        admittedAt: new Date(),
      },
      {
        userId: patron3.id,
        barId: bar1.id,
        partySize: 1,
        position: 0,
        status: QueueStatus.INSIDE,
        qrCode: 'qr-patron3-001',
        joinedAt: new Date(),
        admittedAt: new Date(),
      },
    ],
  });

  // Seeded demo crowd for Neon Lounge: 72 people total (24 parties of 3)
  await seedDemoInsidePatrons(bar2.id, 'neon', Array(24).fill(3), passwordHash);

  console.log('Seed complete:', { admin, staffUser, patron, bar1, bar2 });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
