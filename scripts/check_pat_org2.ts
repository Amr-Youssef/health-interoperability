import { prisma } from '../src/lib/prisma.js';
const patients=await prisma.patient.findMany({ take: 5, include: { identifiers: true, organizations: true } });
for(const pat of patients){
  console.log(pat.internal_id, pat.first_name, pat.source_system_id, pat.organizations.map(o=>o.organization_id+':'+o.active));
}
await prisma.$disconnect();
