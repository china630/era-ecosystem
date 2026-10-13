"""Dump every text line of an XBT-10 PDF as JSONL (page, y, spans with size/bold/x).

Usage: python pdf-lines.py <book.pdf> <out.jsonl>   (requires PyMuPDF)
"""
import json
import sys

import fitz

src, out = sys.argv[1], sys.argv[2]
doc = fitz.open(src)
with open(out, "w", encoding="utf-8", newline="\n") as fh:
    for pno, page in enumerate(doc):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [
                    {
                        "t": s["text"],
                        "sz": round(s["size"], 1),
                        "b": bool(s["flags"] & 16) or "Bold" in s["font"],
                        "x": round(s["bbox"][0], 1),
                        "x1": round(s["bbox"][2], 1),
                    }
                    for s in line["spans"]
                    if s["text"].strip()
                ]
                if not spans:
                    continue
                fh.write(json.dumps({"p": pno + 1, "y": round(line["bbox"][1], 1), "s": spans}, ensure_ascii=False) + "\n")
print(src, "pages", doc.page_count)
