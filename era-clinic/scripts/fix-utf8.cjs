const fs = require("fs");
const files = process.argv.slice(2);
for (const f of files) {
  let b = fs.readFileSync(f);
  if (b[1] === 0) {
    fs.writeFileSync(f, Buffer.from(b.toString("utf16le").replace(/^\uFEFF/, ""), "utf8"));
    console.log("converted", f);
  } else {
    console.log("utf8", f);
  }
}
