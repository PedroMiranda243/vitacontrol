const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.uploadLog.findMany({ orderBy: { createdAt: 'desc' }, take: 2 });
  console.log('Recent Logs:');
  logs.forEach(l => console.log(`  [${l.createdAt.toISOString()}] ${l.tipo} - ${l.fileName} (${l.recordCount} records)`));

  if (logs.length > 0 && logs[0].tipo === 'OS' && logs[0].fileName === 'upload-os.jpg' && logs[0].recordCount === 33) {
    const logCreatedAt = logs[0].createdAt;
    console.log(`\nFound target log. Deleting records created within 1 minute of ${logCreatedAt.toISOString()}...`);
    
    // Find boundary times
    const start = new Date(logCreatedAt.getTime() - 60000);
    const end = new Date(logCreatedAt.getTime() + 60000);
    
    const count = await prisma.record.count({
      where: {
        createdAt: {
          gte: start,
          lte: end
        }
      }
    });

    console.log(`Found ${count} records matching the timeframe.`);
    
    // Execute Deletion
    if (count > 0) {
      console.log('Deleting records...');
      const deletedRecords = await prisma.record.deleteMany({
        where: {
          createdAt: {
            gte: start,
            lte: end
          }
        }
      });
      console.log(`Deleted ${deletedRecords.count} records.`);

      console.log('Deleting upload log...');
      await prisma.uploadLog.delete({
        where: { id: logs[0].id }
      });
      console.log('Upload log deleted successfully. Revert complete!');
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
