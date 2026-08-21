"use strict";
const { scryptSync, randomBytes } = require("crypto");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const PASSWORD = "12345678";
function hash(pw){const salt=randomBytes(16).toString("hex");return `${salt}:${scryptSync(pw,salt,64).toString("hex")}`;}

// practitionerCode -> {login, role}
const STAFF = [
 { code:"DR-01", login:"rena.kengerli",       role:"DOCTOR" },
 { code:"DR-02", login:"kamaleddin.sahmuradov",role:"DOCTOR" },
 { code:"DR-03", login:"azade.mustafayeva",   role:"DOCTOR" },
 { code:"DR-04", login:"turxan.ceferov",      role:"DOCTOR" },
 { code:"DR-05", login:"salman.sadiqi",       role:"DOCTOR" },
 { code:"DR-06", login:"leyla.hesimova",      role:"DOCTOR" },
 { code:"DR-07", login:"rafiq.huseynov",      role:"DOCTOR" },
 { code:"NR-01", login:"leyla.qasimova",      role:"NURSE" },
 { code:"CS-01", login:"turane.memmedzade",   role:"DOCTOR" },
];

async function main(){
  const roles={};
  for(const rc of [["CLINIC_ADMIN","Clinic administrator"],["RECEPTION","Reception"],["DOCTOR","Doctor"],["NURSE","Nurse"],["LAB_TECH","Lab technician"]]){
    const r=await prisma.role.upsert({where:{code:rc[0]},update:{name:rc[1]},create:{code:rc[0],name:rc[1],permissionsJson:"[]"}});
    roles[rc[0]]=r.id;
  }
  const ph=hash(PASSWORD);
  let n=0;
  for(const s of STAFF){
    const pr=await prisma.practitioner.findUnique({where:{code:s.code}});
    if(!pr){console.log("skip missing practitioner",s.code);continue;}
    const u=await prisma.user.upsert({
      where:{login:s.login},
      update:{fullName:pr.fullName,passwordHash:ph,roleId:roles[s.role],status:"ACTIVE"},
      create:{login:s.login,email:s.login+"@nafta.local",fullName:pr.fullName,passwordHash:ph,roleId:roles[s.role],status:"ACTIVE"},
    });
    const staffKind = s.role === "NURSE" ? "NURSE" : s.role === "LAB_TECH" ? "LAB" : "DOCTOR";
    await prisma.practitioner.update({where:{id:pr.id},data:{userId:u.id, staffKind}});
    n++;
  }
  // generic clinic reception login
  await prisma.user.upsert({
    where:{login:"reception"},
    update:{passwordHash:ph,roleId:roles.RECEPTION,status:"ACTIVE"},
    create:{login:"reception",email:"reception@nafta.local",fullName:"Clinic Reception",passwordHash:ph,roleId:roles.RECEPTION,status:"ACTIVE"},
  });
  console.log("CLINIC STAFF OK", JSON.stringify({staffLinked:n, totalUsers:await prisma.user.count(), roles:await prisma.role.count()}));
}
main().catch(e=>{console.error("ERR",e);process.exit(1);}).finally(()=>prisma.$disconnect());