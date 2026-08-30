import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkData() {
  console.log('\n=== قاعدة البيانات ===\n');
  
  const users = await prisma.user.findMany({ include: { role: true, organization: true } });
  console.log(`👤 المستخدمون: ${users.length}`);
  users.forEach(u => console.log(`   - ${u.username} (${u.role.role_code})`));
  
  const roles = await prisma.role.findMany();
  console.log(`\n🔐 الأدوار: ${roles.length}`);
  roles.forEach(r => console.log(`   - ${r.role_code}: ${r.role_name}`));
  
  const orgs = await prisma.organization.findMany();
  console.log(`\n🏛️ المنظمات: ${orgs.length}`);
  orgs.forEach(o => console.log(`   - ${o.organization_name} (${o.organization_type})`));
  
  const concepts = await prisma.terminologyConcept.findMany();
  console.log(`\n📚 مفاهيم المصطلحات: ${concepts.length}`);
  
  const mappings = await prisma.terminologyMapping.findMany();
  console.log(`📊 تعيينات المصطلحات: ${mappings.length}\n`);
  
  await prisma.$disconnect();
}

checkData().catch(e => {
  console.error(e);
  process.exit(1);
});
