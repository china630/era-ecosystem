# -*- coding: utf-8 -*-
import io, os, json, collections
import openpyxl
REPO=r"d:\My Projects\era-ecosystem"
OUT=os.path.join(REPO,"era-hotel-pms","prisma","seed-data","nafta")
wb=openpyxl.load_workbook(r"C:\Users\ASUS G752VT\Downloads\EW\Rooms.xlsx",read_only=True,data_only=True)
ws=wb.worksheets[0]
TYPEMAP={"Standart Double":"STD-DBL","Standart Twin":"STD-TWN","Standart Triple":"STD-TRP","Junior Suit":"JS","Deluxe":"DLX"}
STATEMAP={"Clean":"CLEAN","Dirty":"DIRTY","Inspected":"INSPECTED","Occupied":"OCCUPIED"}
rooms=[]; tc=collections.Counter(); rawtypes=collections.Counter(); states=collections.Counter()
for i,r in enumerate(ws.iter_rows(values_only=True)):
    if i==0 or r[0] is None: continue
    no=str(r[0]).strip()
    rt=str(r[1]).strip() if r[1] else ""
    floor=int(r[3]) if r[3] is not None else 1
    state=str(r[5]).strip() if r[5] else ""
    bed=str(r[7]).strip() if len(r)>7 and r[7] else None
    deleted=bool(r[10]) if len(r)>10 and r[10] not in (None,"",False,"false","False") else False
    disabled=bool(r[11]) if len(r)>11 and r[11] not in (None,"",False,"false","False") else False
    rawtypes[rt]+=1; states[state]+=1
    code=TYPEMAP.get(rt)
    if not code: 
        continue
    tc[code]+=1
    rooms.append({"roomNumber":no,"typeCode":code,"floor":floor,
                  "status":STATEMAP.get(state,"AVAILABLE"),"bedType":bed,
                  "deleted":deleted,"disabled":disabled})
with io.open(os.path.join(OUT,"rooms.json"),"w",encoding="utf-8") as f:
    json.dump(rooms,f,ensure_ascii=False,indent=1)
print("total rooms:",len(rooms))
print("raw types:",dict(rawtypes))
print("mapped counts:",dict(tc))
print("states:",dict(states))
print("floors:",sorted(set(r["floor"] for r in rooms)))