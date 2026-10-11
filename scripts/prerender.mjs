import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import React from "react";
import { renderToString } from "react-dom/server";
import { GuidePage, isCurrentGuideEvent } from "../.prerender/GuidePage.js";
const records = JSON.parse(readFileSync(new URL("../src/data/guide.json", import.meta.url), "utf8"));
const shell = readFileSync("dist/index.html", "utf8");
const escapeHtml = value => value.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const now = Date.now();
const pages = [{path:"/",title:"Leander Live | Local events and business growth",event:null}, ...records.map(event=>({path:`/events/${event.slug}/`,title:`${event.title} | Leander Live`,event}))];
for (const page of pages) {
  const body = renderToString(React.createElement(GuidePage,{path:page.path,now}));
  const canonical = `https://leanderlive.co${page.path}`;
  const stale = page.event && !isCurrentGuideEvent(page.event, now);
  const schema = page.event && !stale ? `<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"Event",name:page.event.title,description:page.event.description,startDate:page.event.startsAt,endDate:page.event.endsAt,eventStatus:"https://schema.org/EventScheduled",eventAttendanceMode:"https://schema.org/OfflineEventAttendanceMode",url:canonical,location:{"@type":"Place",name:page.event.venue,address:page.event.address}}).replace(/</g,"\\u003c")}</script>` : "";
  const html = shell.replace(/<title>.*?<\/title>/,`<title>${escapeHtml(page.title)}</title>`).replace('<div id="root"></div>',`<div id="root">${body}</div>`).replace('</head>',`<link rel="canonical" href="${canonical}">${stale ? '<meta name="robots" content="noindex,follow">' : ''}${schema}</head>`);
  const dir = `dist${page.path}`;mkdirSync(dir,{recursive:true});writeFileSync(`${dir}index.html`,html);
}
writeFileSync("dist/sitemap.xml",`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.filter(p=>!p.event||isCurrentGuideEvent(p.event,now)).map(p=>`<url><loc>https://leanderlive.co${p.path}</loc></url>`).join('')}</urlset>`);
writeFileSync("dist/robots.txt","User-agent: *\nAllow: /\nSitemap: https://leanderlive.co/sitemap.xml\n");
console.log(`Prerendered ${pages.length} source-linked pages.`);
