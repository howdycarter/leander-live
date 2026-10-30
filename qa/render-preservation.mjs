/** Local-only visual fixture: render actual React pages/CSS without scripts or hosting.
 * Does not send forms, start feeds, deploy, or replace the app's production runtime.
 */
import { createServer } from 'vite';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const out=process.argv[2] ?? path.join(root,'qa/rendered');
const server=await createServer({root,server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom',resolve:{alias:{'react-router-dom':path.join(root,'node_modules/react-router-dom/dist/index.mjs')}},ssr:{resolve:{conditions:['module-sync','import']}}});
try {
 const [router,state,chrome,pages]=await Promise.all(['/node_modules/react-router-dom/dist/index.mjs','/src/site/state.tsx','/src/site/chrome.tsx','/src/site/pages.tsx'].map(p=>server.ssrLoadModule(p)));
 const assets=await fs.readdir(path.join(root,'dist/assets'));
 const css=(await Promise.all(assets.filter(p=>p.endsWith('.css')).map(p=>fs.readFile(path.join(root,'dist/assets',p),'utf8')))).join('\n');
 await fs.mkdir(out,{recursive:true});
 for(const [name,url,Component] of [['home','/',pages.HomePage],['events','/events',pages.EventsPage]]){
  const body=renderToStaticMarkup(h(router.MemoryRouter,{initialEntries:[url]},h(state.SavedEventsProvider,null,h(state.SiteActionsProvider,null,h(router.Routes,null,h(router.Route,{element:h(chrome.SiteLayout)},h(router.Route,{path:'*',element:h(Component)})))))));
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="script-src 'none'; connect-src 'none'; form-action 'none'"><base href="https://leanderlive.com/"><title>Local visual fixture — ${name}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=Caveat:wght@600;700&display=swap"><style>${css}</style></head><body><div id="root">${body}</div></body></html>`;
  await fs.writeFile(path.join(out,`${name}.html`),html);
  console.log(name,html.length,'bytes');
 }
} finally {await server.close()}
