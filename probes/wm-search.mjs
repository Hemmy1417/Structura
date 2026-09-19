const q = process.argv.slice(2).join(" ");
const u = new URL("https://commons.wikimedia.org/w/api.php");
Object.entries({ action: "query", generator: "search", gsrsearch: `filetype:bitmap ${q}`, gsrnamespace: "6", gsrlimit: "8",
  prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "1024", format: "json", origin: "*" }).forEach(([k, v]) => u.searchParams.set(k, v));
const r = await fetch(u, { headers: { "user-agent": "structura-probe/0.1 (research)" } });
const j = await r.json();
for (const p of Object.values(j.query?.pages ?? {})) {
  const ii = p.imageinfo?.[0]; if (!ii) continue;
  const lic = ii.extmetadata?.LicenseShortName?.value ?? "?";
  console.log(`${p.title} | ${ii.width}x${ii.height} | ${lic} | ${ii.thumburl}`);
}
