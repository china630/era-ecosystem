# -*- coding: utf-8 -*-
import os, io, json, csv, re
REPO = r"d:\My Projects\era-ecosystem"
OUT = os.path.join(REPO, "era-clinic", "prisma", "seed-data", "nafta")
WO = r"C:\Users\ASUS G752VT\Downloads\WO"

TR = {"ə":"e","Ə":"E","ç":"c","Ç":"C","ş":"s","Ş":"S","ğ":"g","Ğ":"G","ı":"i","İ":"I","ö":"o","Ö":"O","ü":"u","Ü":"U"}
def slug(s):
    s = "".join(TR.get(ch, ch) for ch in s).upper()
    return re.sub(r"[^A-Z0-9]+","-",s).strip("-")[:40]

practitioners = [
 {"code":"DR-01","fullName":"Rəna Kəngərli","specialty":"Baş həkim"},
 {"code":"DR-02","fullName":"Kəmaləddin Şahmuradov","specialty":"Terapevt"},
 {"code":"DR-03","fullName":"Azadə Mustafayeva","specialty":"Terapevt"},
 {"code":"DR-04","fullName":"Turxan Cəfərov","specialty":"Terapevt"},
 {"code":"DR-05","fullName":"Salman Sadiqi","specialty":"Terapevt"},
 {"code":"DR-06","fullName":"Leyla Həşimova","specialty":"Terapevt"},
 {"code":"DR-07","fullName":"Rafiq Hüseynov","specialty":"Fizioterapevt"},
 {"code":"NR-01","fullName":"Leyla Qasımova","specialty":"Senior Nurse"},
 {"code":"CS-01","fullName":"Turanə Məmmədzadə","specialty":"Kosmetoloq"},
]
with io.open(os.path.join(OUT,"practitioners.json"),"w",encoding="utf-8") as f:
    json.dump(practitioners,f,ensure_ascii=False,indent=1)

# lab tests from analizler.csv (comma-separated, quoted)
labs=[]
with io.open(os.path.join(WO,"analizler.csv"),"r",encoding="utf-8-sig") as f:
    rd=csv.reader(f)
    header=next(rd)
    for row in rd:
        if len(row)<6 or not row[1].strip(): continue
        name=row[1].strip()
        try: price=float(row[5])
        except: price=0
        labs.append({"code":"LAB-"+slug(name)[:36],"name":name,"price":price})
# dedupe by code
seen={}
for l in labs: seen[l["code"]]=l
labs=sorted(seen.values(),key=lambda x:x["code"])
with io.open(os.path.join(OUT,"lab-tests.json"),"w",encoding="utf-8") as f:
    json.dump(labs,f,ensure_ascii=False,indent=1)

print("practitioners",len(practitioners),"labs",len(labs))