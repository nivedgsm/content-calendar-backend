import { PrismaClient, Role, Platform, ContentType, ContentStatus } from '@prisma/client';
import { hashPassword } from '../src/password';
const prisma = new PrismaClient();
async function main() {
  const demoPassword = process.env.DEMO_ADMIN_PASSWORD;
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('Set DEMO_ADMIN_PASSWORD to a value of at least 12 characters before seeding demo data.');
  }
  const hash = await hashPassword(demoPassword);
  const agency = await prisma.agency.upsert({where:{id:'demo-agency'},update:{},create:{id:'demo-agency',name:'Studio North'}});
  const admin = await prisma.user.upsert({where:{email:'admin@contentflow.local'},update:{},create:{name:'Agency Admin',email:'admin@contentflow.local',passwordHash:hash,role:Role.ADMIN,agencyId:agency.id}});
  const clients = [
    {name:'Godzone Foreign Studies',brandName:'Godzone',industry:'Education',color:'#7567F8',email:'hello@godzone.example'},
    {name:'Nizamia Public School',brandName:'Nizamia',industry:'Education',color:'#16A38A',email:'office@nizamia.example'},
    {name:'Faith Centre',brandName:'Faith Centre',industry:'Church',color:'#E59B43',email:'media@faithcentre.example'}
  ];
  for (const c of clients) {
    const client = await prisma.client.upsert({where:{id:c.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')},update:{},create:{id:c.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),...c,agencyId:agency.id}});
    const count = await prisma.content.count({where:{clientId:client.id}});
    if (!count) for (let i=0;i<5;i++) await prisma.content.create({data:{title:['Brand introduction','Behind the scenes','Student success story','Weekly inspiration','Upcoming event'][i],date:new Date(Date.now()+((i+1)*86400000)),type:[ContentType.POST,ContentType.REEL,ContentType.CAROUSEL,ContentType.STORY,ContentType.REEL][i],platform:Platform.INSTAGRAM,status:i===0?ContentStatus.FOR_REVIEW:ContentStatus.PLANNED,theme:'Monthly brand storytelling',clientId:client.id,assigneeId:admin.id}});
  }
}
main().finally(()=>prisma.$disconnect());
