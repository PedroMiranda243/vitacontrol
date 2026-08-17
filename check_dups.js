const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Verificando Duplicatas por OS ---');
  const osDuplicates = await prisma.record.groupBy({
    by: ['os'],
    _count: { id: true },
    having: {
      id: { _count: { gt: 1 } }
    }
  });

  console.log(`Encontradas ${osDuplicates.length} OS com mais de 1 registro.`);
  for (const dup of osDuplicates) {
    console.log(`\nOS: ${dup.os} (Total: ${dup._count.id})`);
    const records = await prisma.record.findMany({
      where: { os: dup.os },
      orderBy: { createdAt: 'asc' }
    });
    records.forEach(r => {
      console.log(`  [${r.createdAt.toISOString()}] ID: ${r.id} | Paciente: ${r.descricao} | Exame: ${r.exame || 'N/A'} | Valor: R$${r.valor}`);
    });
  }

  console.log('\n--- Verificando Duplicatas por Paciente (Descricao) e Valor (sem contar mesma OS) ---');
  const pacDuplicates = await prisma.record.groupBy({
    by: ['descricao', 'dataLancamento', 'valor'],
    _count: { id: true },
    having: {
      id: { _count: { gt: 1 } }
    }
  });

  console.log(`Encontrados ${pacDuplicates.length} possíveis registros duplicados de paciente na mesma data e valor.`);
  for (const dup of pacDuplicates.slice(0, 10)) {
    console.log(`\nPaciente: ${dup.descricao} | Data: ${dup.dataLancamento.toISOString().split('T')[0]} | Valor: R$${dup.valor} (Total: ${dup._count.id})`);
    const records = await prisma.record.findMany({
      where: { 
        descricao: dup.descricao,
        dataLancamento: dup.dataLancamento,
        valor: dup.valor
      },
      orderBy: { createdAt: 'asc' }
    });
    records.forEach(r => {
      console.log(`  [${r.createdAt.toISOString()}] ID: ${r.id} | OS: ${r.os} | Exame: ${r.exame || 'N/A'}`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
