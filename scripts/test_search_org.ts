import { prisma } from '../src/lib/prisma.js';
const orgId='906f40a1-9b90-48fc-bfdd-38f832586d36';
const where:any={ OR: [{ source_system_id: orgId }, { organizations: { some: { organization_id: orgId, active: true } } }] };
console.log('where', JSON.stringify(where, null, 2));
const count=await prisma.patient.count({ where });
console.log('count', count);
const rows=await prisma.patient.findMany({ where, include: { identifiers: true }, take: 5 });
console.log(rows.map(r=> r.internal_id + ' ' + r.source_system_id));
await prisma.$disconnect();
