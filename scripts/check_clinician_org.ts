import { prisma } from '../src/lib/prisma.js';
const clin=await prisma.user.findUnique({ where: { username: 'clinician' }, include: { organization: true } });
console.log('clinician org', clin?.organization_id, clin?.organization?.organization_name);
const orgId=clin?.organization_id;
const patients=await prisma.patient.findMany({ take: 20, include: { identifiers: true, organizations: true } });
for(const pat of patients){
  const linked = pat.organizations.some(o=>o.organization_id===orgId && o.active);
  const direct = pat.source_system_id===orgId;
  console.log(pat.internal_id, pat.first_name, 'linked', linked, 'direct', direct, 'source', pat.source_system_id);
}
await prisma.$disconnect();
