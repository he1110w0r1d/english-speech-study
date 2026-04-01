const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });
const prisma = new PrismaClient();

async function checkData() {
  console.log('--- Scanning Recent Sessions ---');
  
  const sessions = await prisma.practiceSession.findMany({
    orderBy: { startedAt: 'desc' },
    take: 3,
    include: { _count: { select: { turns: true } }, report: true }
  });
  
  if (sessions.length === 0) {
    console.warn('No sessions found at all.');
    return;
  }

  for (const s of sessions) {
    console.log(`\nSession ID: ${s.id}`);
    console.log(`Status: ${s.status}`);
    console.log(`StartedAt: ${s.startedAt}`);
    console.log(`Turns Count: ${s._count.turns}`);
    console.log(`Report Ready: ${s.report ? '✅ YES' : '❌ NO'}`);
    
    if (s._count.turns > 0) {
       const turns = await prisma.practiceTurn.findMany({
         where: { sessionId: s.id },
         orderBy: { turnIndex: 'asc' },
         take: 2
       });
       console.log('Sample content:', turns.map(t => t.transcript).join(' | '));
    }
  }
}

checkData()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
