"use strict";
const { createCipheriv, createHash, createHmac, randomBytes } = require("crypto");
const { PrismaClient } = require("@era365/database");
const mdmlib = require("@era365/mdm-database");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const ORG = "b07d5fc5-9544-467e-9ca1-22f99cc407c6";
const SCOPE = "cf4b7005-e7c5-4c13-8055-1e1bd728ff92";

function resolveKey(name){const raw=(process.env[name]||"").trim();if(raw){const b=Buffer.from(raw,"base64");if(b.length>=32)return createHash("sha256").update(b).digest();return createHash("sha256").update(raw).digest();}return createHash("sha256").update(name+":erafinance-dev-fallback").digest();}
function encryptText(v){const key=resolveKey("PII_ENCRYPTION_KEY");const iv=randomBytes(12);const c=createCipheriv("aes-256-gcm",key,iv);const ct=Buffer.concat([c.update(v,"utf8"),c.final()]);return ["v1",iv.toString("base64url"),ct.toString("base64url"),c.getAuthTag().toString("base64url")].join(".");}
function blindSurrogate(val){const key=resolveKey("PII_BLIND_INDEX_KEY");return createHmac("sha256",key).update(`id:ERA_SURROGATE:AZ:${val.trim()}`).digest("hex");}

// unit codes: KL=Klinika, RC=Resepşn, FB=F&B, AC=Mühasibatlıq
const STAFF = [
 ["Rəna Kəngərli","KL","Baş həkim"],
 ["Kəmaləddin Şahmuradov","KL","Terapevt"],
 ["Azadə Mustafayeva","KL","Terapevt"],
 ["Turxan Cəfərov","KL","Terapevt"],
 ["Salman Sadiqi","KL","Terapevt"],
 ["Leyla Həşimova","KL","Terapevt"],
 ["Rafiq Hüseynov","KL","Fizioterapevt"],
 ["Leyla Qasımova","KL","Tibb bacısı"],
 ["Turanə Məmmədzadə","KL","Kosmetoloq"],
 ["Kamil Məmmədov","AC","Baş mühasib"],
 ["Əhməd Əhmədov","AC","Mühasib"],
 ["Tofiq Məmmədli","AC","Mühasib"],
 ["Anar Məhərrəmov","FB","İaşə üzrə menecer"],
 ["Mürsəl Nəbiyev","FB","Restoran və bar nəzarətçisi"],
 ["Rəşad Məmmədov","FB","Baş ofisiant"],
 ["Xatirə Ələsgərova","RC","Rəhbər"],
 ["Rəhman Şirinov","RC","Nəzarətçi"],
 ["Cənanə İbazadə","RC","Satış üzrə menecer"],
 ["Afət Vəliyeva","RC","Qeydiyyatçı"],
 ["Fuad Aslanov","RC","Qeydiyyatçı"],
 ["Rüfət Rzazadə","RC","Qeydiyyatçı"],
 ["Səxavət Əmirov","RC","Qeydiyyatçı"],
 ["Polad Paşayev","RC","Qeydiyyatçı"],
];
const UNIT_NAME = { KL:"Klinika", RC:"Resepşn", FB:"F&B", AC:"Mühasibatlıq" };

async function main(){
  const cpPool=new Pool({connectionString:process.env.DATABASE_URL});
  const cp=new PrismaClient({adapter:new PrismaPg(cpPool)});
  const mdmPool=new Pool({connectionString:process.env.MDM_DATABASE_URL});
  const mdm=new mdmlib.PrismaClient({adapter:new PrismaPg(mdmPool)});
  try{
    const units=await cp.orgUnit.findMany({where:{workforceScopeId:SCOPE}});
    const unitByName=Object.fromEntries(units.map(u=>[u.name,u]));
    const positions=await cp.workforcePosition.findMany();
    function posId(orgUnitId,name){const p=positions.find(x=>x.orgUnitId===orgUnitId&&x.name===name);if(!p)throw new Error("no position "+name);return p.id;}

    let created=0, reused=0, emp=0;
    let idx=0;
    for(const [fullName,uc,posName] of STAFF){
      idx++;
      const unit=unitByName[UNIT_NAME[uc]];
      if(!unit)throw new Error("no unit "+UNIT_NAME[uc]);
      const surrogate="NAFTA-EMP-"+String(100+idx);
      const bi=blindSurrogate(surrogate);
      // find or create person via surrogate identifier
      let ident=await mdm.personIdentifier.findFirst({where:{type:"ERA_SURROGATE",issuingCountry:"AZ",blindIndex:bi}});
      let personId;
      if(ident){personId=ident.personId;reused++;
        await mdm.globalNaturalPerson.update({where:{id:personId},data:{fullNameCipher:encryptText(fullName)}});
      } else {
        const person=await mdm.globalNaturalPerson.create({data:{fullNameCipher:encryptText(fullName),nationality:"AZ",personSegment:"UNVERIFIED"}});
        personId=person.id;created++;
        await mdm.personIdentifier.create({data:{personId,type:"ERA_SURROGATE",issuingCountry:"AZ",valueCipher:encryptText(surrogate),blindIndex:bi,trust:"SELF_DECLARED",isPrimary:true}});
      }
      // access grant for NAFTA org
      await mdm.personAccessGrant.upsert({where:{personId_granteeOrgId:{personId,granteeOrgId:ORG}},create:{personId,granteeOrgId:ORG},update:{}});
      // employment (idempotent by person+org)
      const existing=await cp.workforceEmployment.findFirst({where:{organizationId:ORG,globalPersonId:personId}});
      if(!existing){
        await cp.workforceEmployment.create({data:{organizationId:ORG,workforceScopeId:SCOPE,orgUnitId:unit.id,positionId:posId(unit.id,posName),globalPersonId:personId,hireDate:new Date(Date.UTC(2024,idx%12,1+(idx%25))),status:"ACTIVE"}});
        emp++;
      }
    }
    console.log("EMPLOYMENTS OK",JSON.stringify({personsCreated:created,personsReused:reused,employmentsCreated:emp,totalEmployments:await cp.workforceEmployment.count(),totalPersons:await mdm.globalNaturalPerson.count()}));
  }catch(e){console.error("ERR",e);process.exit(1);}
  finally{await cp.$disconnect();await cpPool.end();await mdm.$disconnect();await mdmPool.end();}
}
main();