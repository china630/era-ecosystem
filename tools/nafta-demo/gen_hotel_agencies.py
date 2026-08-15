# -*- coding: utf-8 -*-
import os, io, json, re
import openpyxl
REPO=r"d:\My Projects\era-ecosystem"
OUT=os.path.join(REPO,"era-hotel-pms","prisma","seed-data","nafta")
TR={"ə":"e","Ə":"E","ç":"c","Ç":"C","ş":"s","Ş":"S","ğ":"g","Ğ":"G","ı":"i","İ":"I","ö":"o","Ö":"O","ü":"u","Ü":"U"}
def slug(s):
    s="".join(TR.get(c,c) for c in s).upper()
    return re.sub(r"[^A-Z0-9]+","-",s).strip("-")[:36]
wb=openpyxl.load_workbook(r"C:\Users\ASUS G752VT\Downloads\EW\Travel Agencies.xlsx",read_only=True,data_only=True)
ws=wb.worksheets[0]
ags=[]; seen=set()
for i,r in enumerate(ws.iter_rows(values_only=True)):
    if i==0 or r[0] is None: continue
    full=str(r[0]).strip()
    group=str(r[1]).strip() if len(r)>1 and r[1] else full
    rate=str(r[3]).strip() if len(r)>3 and r[3] else None
    grey=str(r[9]).strip().lower()=="true" if len(r)>9 and r[9] is not None else False
    code="AG-"+slug(full)
    if code in seen: 
        code=code+"-"+str(len(ags))
    seen.add(code)
    ags.append({"code":code,"name":full,"group":group,"rateCode":rate,"greyList":grey})
with io.open(os.path.join(OUT,"agencies.json"),"w",encoding="utf-8") as f:
    json.dump(ags,f,ensure_ascii=False,indent=1)
print("agencies",len(ags))