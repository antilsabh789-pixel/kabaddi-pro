// Run this on Railway Console after deploying:
// node -e "process.chdir('/app/artifacts/api-server');const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.update({where:{phone:'+919996121950'},data:{isAdmin:true}}).then(u=>{console.log('Admin set:',u.phone,u.isAdmin);p.$disconnect();}).catch(e=>{console.error(e.message);p.$disconnect();});"
