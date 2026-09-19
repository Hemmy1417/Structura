import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const files = process.argv.slice(2);
const u = new URL("https://commons.wikimedia.org/w/api.php");
Object.entries({ action: "query", titles: files.map((f) => `File:${f}`).join("|"), prop: "imageinfo", iiprop: "url|size", iiurlwidth: "1024", format: "json", origin: "*" }).forEach(([k, v]) => u.searchParams.set(k, v));
const j = await (await fetch(u, { headers: { "user-agent": "structura-probe/0.1 (research)" } })).json();
for (const p of Object.values(j.query.pages)) {
  const ii = p.imageinfo[0];
  const url = ii.thumburl.split("?")[0];
  const shas = []; let hdr = {}; let len = 0; let buf;
  for (let i = 0; i < 2; i++) {
    const r = await fetch(url, { headers: { "user-agent": "structura-probe/0.1 (research)" } });
    buf = Buffer.from(await r.arrayBuffer()); len = buf.length;
    shas.push(createHash("sha256").update(buf).digest("hex"));
    hdr = { status: r.status, type: r.headers.get("content-type"), cors: r.headers.get("access-control-allow-origin") };
  }
  const name = p.title.replace("File:", "").replace(/[^A-Za-z0-9.]+/g, "_");
  writeFileSync(`img/${name}`, buf);
  console.log(JSON.stringify({ file: p.title.replace("File:", ""), url, bytes: len, stable: shas[0] === shas[1], sha256: shas[0], ...hdr }));
}
