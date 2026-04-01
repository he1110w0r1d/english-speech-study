const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
console.log('practiceSession:', typeof prisma.practiceSession);
console.log('Keys:', Object.keys(prisma).filter(k => !k.startsWith('_')));
