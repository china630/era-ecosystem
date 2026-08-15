"use strict";
const { scryptSync, randomBytes } = require("crypto");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const PASSWORD = "12345678";
function hash(pw){const salt=randomBytes(16).toString("hex");return `${salt}:${scryptSync(pw,salt,64).toString("hex")}`;}

const STAFF = [
 // reception
 { login:"xatire.elesgerova", fullName:"Xatirə Ələsgərova", role:"Manager",      dept:"Reception", title:"Rəhbər" },
 { login:"rehman.sirinov",    fullName:"Rəhman Şirinov",    role:"Manager",      dept:"Reception", title:"Nəzarətçi" },
 { login:"cenane.ibazade",    fullName:"Cənanə İbazadə",    role:"Manager",      dept:"Sales",     title:"Satış üzrə menecer" },
 { login:"afet.veliyeva",     fullName:"Afət Vəliyeva",     role:"Receptionist", dept:"Reception", title:"Qeydiyyatçı" },
 { login:"fuad.aslanov",      fullName:"Fuad Aslanov",      role:"Receptionist", dept:"Reception", title:"Qeydiyyatçı" },
 { login:"rufet.rzazade",     fullName:"Rüfət Rzazadə",     role:"Receptionist", dept:"Reception", title:"Qeydiyyatçı" },
 { login:"sexavet.emirov",    fullName:"Səxavət Əmirov",    role:"Receptionist", dept:"Reception", title:"Qeydiyyatçı" },
 { login:"polad.pasayev",     fullName:"Polad Paşayev",     role:"Receptionist", dept:"Reception", title:"Qeydiyyatçı" },
 // F&B (POS inside hotel-pms)
 { login:"anar.meherremov",   fullName:"Anar Məhərrəmov",   role:"Manager",      dept:"F&B", title:"İaşə üzrə menecer" },
 { login:"mursel.nebiyev",    fullName:"Mürsəl Nəbiyev",    role:"Manager",      dept:"F&B", title:"Restoran və bar nəzarətçisi" },
 { login:"resad.memmedov",    fullName:"Rəşad Məmmədov",    role:"Receptionist", dept:"F&B", title:"Baş ofisiant" },
];

async function main(){
  const roles=await prisma.role.findMany();
  const roleId=Object.fromEntries(roles.map(r=>[r.code,r.id]));
  const ph=hash(PASSWORD);
  let n=0;
  for(const s of STAFF){
    await prisma.user.upsert({
      where:{login:s.login},
      update:{fullName:s.fullName,passwordHash:ph,roleId:roleId[s.role],department:s.dept,status:"ACTIVE"},
      create:{login:s.login,email:s.login+"@nafta.local",fullName:s.fullName,passwordHash:ph,roleId:roleId[s.role],department:s.dept},
    });
    n++;
  }
  console.log("HOTEL STAFF OK", JSON.stringify({seeded:n, totalUsers:await prisma.user.count()}));
}
main().catch(e=>{console.error("ERR",e);process.exit(1);}).finally(()=>prisma.$disconnect());