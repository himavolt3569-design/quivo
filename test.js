const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.$queryRawUnsafe("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'shop_qr_token_len'");
  console.log(res);
}

main().catch(console.error).finally(() => process.exit(0));
