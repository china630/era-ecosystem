const fs = require('fs');
const html = fs.readFileSync('d:/My Projects/nafta/doc/.cache/pages/on-buro.html', 'utf8');
const popRe = /heading2"><span>([^<]+)<\/span>[\s\S]*?<ul>([\s\S]*?)<\/ul>/gi;
const out = [];
let m;
while ((m = popRe.exec(html)) !== null) {
  const title = m[1].trim();
  const lis = [...m[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map(x => x[1].replace(/<[^>]+>/g, '').trim())
    .filter(Boolean);
  if (lis.length) out.push({ title, bullets: lis });
}
fs.writeFileSync('d:/My Projects/nafta/doc/on-buro-features.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
