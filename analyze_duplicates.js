const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Finding OS with multiple records...');
  
  // Find OS with more than 1 record
  const duplicates = await prisma.record.groupBy({
    by: ['os'],
    _count: {
      id: true
    },
    having: {
      id: {
        _count: {
          gt: 1
        }
      }
    }
  });

  console.log(`Found ${duplicates.length} OS numbers with multiple records.`);

  let deletedCount = 0;

  for (const dup of duplicates) {
    const records = await prisma.record.findMany({
      where: { os: dup.os },
      orderBy: { createdAt: 'asc' }
    });
    
    // Keep the first one, delete the rest
    const [keep, ...toDelete] = records;
    
    for (const record of toDelete) {
      await prisma.record.delete({
        where: { id: record.id }
      });
      deletedCount++;
    }
  }

  console.log(`\nSuccess! Deleted ${deletedCount} duplicate records.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
