const titles = process.argv.slice(2).map((t) => `File:${t}`);
const u = new URL("https://commons.wikimedia.org/w/api.php");
Object.entries({ action: "query", titles: titles.join("|"), prop: "imageinfo", iiprop: "url|extmetadata",
  format: "json", origin: "*" }).forEach(([k, v]) => u.searchParams.set(k, v));
const j = await (await fetch(u, { headers: { "user-agent": "structura-probe/0.1 (research)" } })).json();
const strip = (s) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
for (const p of Object.values(j.query.pages)) {
  const ii = p.imageinfo?.[0]; const m = ii?.extmetadata ?? {};
  console.log(JSON.stringify({ title: p.title, page: ii?.descriptionurl, artist: strip(m.Artist?.value),
    license: strip(m.LicenseShortName?.value), license_url: m.LicenseUrl?.value ?? "", date: strip(m.DateTimeOriginal?.value) }));
}
