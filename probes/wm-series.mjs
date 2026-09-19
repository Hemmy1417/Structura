const u = new URL("https://commons.wikimedia.org/w/api.php");
Object.entries({ action: "query", generator: "search", gsrsearch: `intitle:"Thai House"`, gsrnamespace: "6", gsrlimit: "50",
  prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: "1024", format: "json", origin: "*" }).forEach(([k, v]) => u.searchParams.set(k, v));
const j = await (await fetch(u, { headers: { "user-agent": "structura-probe/0.1 (research)" } })).json();
const rows = Object.values(j.query?.pages ?? {}).map((p) => {
  const ii = p.imageinfo?.[0] ?? {};
  return `${p.title.replace("File:", "")} | ${ii.extmetadata?.DateTimeOriginal?.value?.replace(/<[^>]+>/g, "") ?? "?"} | ${ii.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, "").trim() ?? "?"} | ${ii.extmetadata?.LicenseShortName?.value}`;
});
console.log(rows.sort().join("\n"));
