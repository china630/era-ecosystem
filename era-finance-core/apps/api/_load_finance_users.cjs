"use strict";
const { createCipheriv, createHash, randomBytes } = require("crypto");
const { PrismaClient } = require("@erafinance/database");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const ORG = "b07d5fc5-9544-467e-9ca1-22f99cc407c6";
const HASH = "$2b$10$UxPr74XSdbchDe4wJDi7S.Xpvl0DexW4ccFClvpIwX.s7pvgRjSga"; // bcrypt("12345678")

function resolveKey(name){const raw=(process.env[name]||"").trim();if(raw){const b=Buffer.from(raw,"base64");if(b.length>=32)return createHash("sha256").update(b).digest();return createHash("sha256").update(raw).digest();}const fb=process.env.JWT_SECRET||"erafinance-dev-fallback";return createHash("sha256").update(name+":"+fb).digest();}
function encryptText(v){const key=resolveKey("PII_ENCRYPTION_KEY");const iv=randomBytes(12);const c=createCipheriv("aes-256-gcm",key,iv);const ct=Buffer.concat([c.update(v,"utf8"),c.final()]);return ["v1",iv.toString("base64url"),ct.toString("base64url"),c.getAuthTag().toString("base64url")].join(".");}

const USERS = [
 { email:"kamil.mammadov@nafta.local", first:"Kamil", last:"Məmmədov", role:"ADMIN" },
 { email:"ahmed.ahmadov@nafta.local",  first:"Əhməd", last:"Əhmədov", role:"ACCOUNTANT" },
 { email:"tofiq.mammadli@nafta.local", first:"Tofiq", last:"Məmmədli", role:"ACCOUNTANT" },
];

async function main(){
  const pool=new Pool({connectionString:process.env.DATABASE_URL});
  const p=new PrismaClient({adapter:new PrismaPg(pool)});
  try{
    let created=0, mem=0;
    for(const u of USERS){
      const full=`${u.first} ${u.last}`.trim();
      const user=await p.user.upsert({
        where:{email:u.email},
        create:{email:u.email,passwordHash:HASH,locale:"AZ",isSuperAdmin:false,
          firstNameCipher:encryptText(u.first),lastNameCipher:encryptText(u.last),fullNameCipher:encryptText(full)},
        update:{passwordHash:HASH,firstNameCipher:encryptText(u.first),lastNameCipher:encryptText(u.last),fullNameCipher:encryptText(full)},
      });
      created++;
      await p.organizationMembership.upsert({
        where:{userId_organizationId:{userId:user.id,organizationId:ORG}},
        create:{userId:user.id,organizationId:ORG,role:u.role},
        update:{role:u.role,deletedAt:null},
      });
      mem++;
    }
    console.log("FINANCE LOGINS OK",JSON.stringify({usersUpserted:created,membershipsUpserted:mem,totalUsers:await p.user.count(),naftaMemberships:await p.organizationMembership.count({where:{organizationId:ORG}})}));
  }catch(e){console.error("ERR",e);process.exit(1);}
  finally{await p.$disconnect();await pool.end();}
}
main();