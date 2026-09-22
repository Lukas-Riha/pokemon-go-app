/* Vytaženo z pokemon_tracker_TEST.html (tools/slouc_test.py). */
/* Vzhledová vrstva appky. Zapéká se do testovací verze při buildu
   (tools/sync_reference.py --test). Engine se odsud NEUPRAVUJE — co chybí,
   doplní se do enginu jako pojmenované pole i s testem.
   Kontrakt: docs/ATLAS_KONTRAKT.md */
(function () {
  "use strict";
  if (!window.__pgo) return;
  document.body.classList.add("atlas-test");

  /* Obrázky se do appky nezapékají (třicet megabajtů). Když nejsou,
     vrstva musí pořád jít — chybí jen art u vybraného kusu. */
  window.ATLAS_ART = window.ATLAS_ART || {};

  /* Engine vrací `jenZnamka` (drží ho jen CUTE nebo 100 %) a plán kusu
     samostatnou funkcí. Vrstva čekala `cuteOnly` a `activePlan` přímo na
     vyhodnoceném kusu, tak se jí připraví obohacená KOPIE — do enginu se
     tím nesahá a jeho verdikty zůstávají jeho. */
  var puvodni = window.__pgo.getComputed;
  window.__pgo.getComputed = function () {
    var c = puvodni.apply(window.__pgo, arguments);
    var plany = {};
    try { plany = window.__pgo.planKusu(); } catch (e) { plany = {}; }
    var out = {};
    Object.keys(c).forEach(function (id) {
      var z = c[id], kopie = {};
      Object.keys(z).forEach(function (k) { kopie[k] = z[k]; });
      kopie.cuteOnly = !!z.jenZnamka && !!z.cute && !z.stoProcent;
      var plan=plany[id];
      kopie.activePlan = plan && !(z.validationIssues||[]).length ? Object.assign({},plan,{
        id:JSON.stringify([id,plan.row.forma,plan.row.level,plan.row.ivAtk,plan.row.ivDef,plan.row.ivSta,plan.cilJmeno,plan.uroven,plan.cena]),
        key:window.__pgo.dexKeyOf(plan.cilJmeno||plan.row.pokemon),
        league:(String(plan.role).match(/\b(LC|GL|UL|ML)\b/)||[])[1]||null
      }) : null;
      out[id] = kopie;
    });
    return out;
  };
})();

window.AtlasVerdict=c=>({
  label:c.validationIssues?.length?'Ověřit data':c.cuteOnly?'CUTE · sbírka':c.keep||'K posouzení',
  tone:c.validationIssues?.length||c.lucky?'warning':c.cuteOnly?'collection':['good','warning','critical'].includes(c.keepTone)?c.keepTone:c.keepGood?'good':'critical'
});
window.AtlasTags=(c,r={})=>'<span class="atlas-tag-typy">'+String(c.types||'').split(' / ').filter(t=>t&&t!=='–').map(t=>{const color=__pgo.typeColors()[t];return color?'<span class="d-type atlas-roster-type" style="background:'+color+'">'+__pgo.typIkona(t)+t+'</span>':''}).join('')+'</span>'+[['SH','SHADOW',r.forma==='Shadow'],['PU','PURIFIED',r.forma==='Purified'],['D','DMAX',c.dynamax],['C','CUTE',c.cute],['S','SHINY',c.shiny],['H','100%',c.stoProcent],['L2','LUCKY',c.lucky],['SKEN','POSLEDNÍ SKEN',c.posledniSken]].filter(([, ,enabled])=>enabled).map(([key,text])=>'<span class="rarity-chip r-'+key+' atlas-roster-tag">'+text+'</span>').join('')
  .replace(/^(.+)$/,'<span class="atlas-tag-vlastni">$1</span>');

window.AtlasRole=function(c){if(c.cuteOnly)return 'Osobní sbírka · bez investičního cíle';const roles=[];if(c.pvpRec&&!['Ne','–'].includes(c.pvpRec))roles.push(c.pvpRec);if(c.raidRec&&!['Ne','Slabý','Slabý útok','–'].includes(c.raidRec))roles.push('Raid · '+c.raidRec);if(c.gymRec&&!['Ne','Slabý','–'].includes(c.gymRec))roles.push('Gym · '+c.gymRec);return roles.join(' / ')||(c.megaKandidat?'Mega evoluce':'Sbírka a další využití');};
window.AtlasJourney=(c,r)=>{
 const p=c.activePlan,issues=c.validationIssues||[],missing=[];
 if(issues.length)missing.push('ověřit CP, level a IV');
 if([r.ivAtk,r.ivDef,r.ivSta].some(v=>v===''||v==null))missing.push('přesná IV');
 if(!r.fastMove)missing.push('rychlý útok');if(!r.charged1)missing.push('nabitý útok');if(!r.charged2)missing.push('údaj o druhém útoku');
 return {use:AtlasRole(c),step:issues.length?'Ověřit údaje':c.cuteOnly?'Ponechat pro radost':p?(p.evoluce?'Evoluce na '+p.cilJmeno+' → ':'')+(p.cena.dust>0?'Vylepšit na L'+p.uroven:'Ověřit útoky a podmínky cíle'):'Prohlédnout alternativní cíle',price:p?p.cena.dust.toLocaleString('cs-CZ')+' prachu · '+p.cena.candy+' candy · '+p.cena.xl+' XL (power-up do L'+p.uroven+')':'Bez vybraného cíle · cena neurčena',missing:missing.join(', ')||'Základní údaje vyplněné'};
};
window.AtlasJourneyHTML=(c,r,full=false)=>{const j=AtlasJourney(c,r),esc=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));return (full?[['Využití',j.use],['Potřebný krok',j.step],['Cena',j.price],['Chybějící údaje',j.missing]]:[['Krok',j.step],['Cena',j.price],['Chybí',j.missing]]).map(([label,value])=>'<span class="atlas-journey-item"><small>'+label+'</small><span>'+esc(value)+'</span></span>').join('')};

(() => {
  'use strict';
  const P=window.__pgo,$=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if(!P)return;
  const fmt=n=>new Intl.NumberFormat('cs-CZ').format(Number(n)||0);
  const paths={home:'M3 10 12 3l9 7v10h-6v-7H9v7H3Z',box:'M3 7h18v14H3ZM3 7l3-4h12l3 4M9 12h6',team:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6ZM9 12l2 2 4-4',invest:'M4 20h16M7 16v-5m5 5V7m5 9V3',calendar:'M4 5h16v16H4ZM8 3v4m8-4v4M4 10h16',arrow:'M4 12h16m-6-6 6 6-6 6',next:'m9 5 7 7-7 7',lock:'M5 10h14v11H5Zm3 0V6a4 4 0 0 1 8 0v4',settings:'M4 7h16M4 17h16M8 4v6m8 4v6',moon:'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z',spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',close:'m6 6 12 12M6 18 18 6',check:'m5 12 4 4L19 6'};
  const icon=k=>`<svg class="atlas-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[k]||paths.spark}"/></svg>`;
  const fallback='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="43" fill="#eaf0fa" stroke="#9bb2d4" stroke-width="3"/><path d="M17 60h86" stroke="#9bb2d4" stroke-width="3"/><circle cx="60" cy="60" r="12" fill="white" stroke="#9bb2d4" stroke-width="3"/></svg>');
  const art=r=>{const key=P.dexKeyOf(r.pokemon);if(/^(shellos|gastrodon)/i.test(key)){const t=document.createElement('template');t.innerHTML=P.atlasImage(r.pokemon);return t.content.querySelector('img')?.getAttribute('src')||fallback}return window.ATLAS_ART[key]||(/^pumpkaboo/i.test(r.pokemon)?window.ATLAS_ART['pumpkaboo-average']:null)||(/^shellos east sea/i.test(r.pokemon)?window.ATLAS_ART['shellos-eastsea']:null)||(()=>{const t=document.createElement('template');t.innerHTML=P.atlasImage(r.pokemon);return t.content.querySelector('img')?.getAttribute('src')})()||fallback;};
  document.addEventListener('error',e=>{const img=e.target;if(!img.matches?.('img[data-atlas-pokemon]'))return;const t=document.createElement('template');t.innerHTML=P.atlasImage(img.dataset.atlasPokemon);const native=t.content.querySelector('img'),urls=[native?.getAttribute('src'),...String(native?.dataset.zaloha||'').split('|'),fallback].filter(Boolean);const tried=JSON.parse(img.dataset.atlasTried||'[]');tried.push(img.src);img.dataset.atlasTried=JSON.stringify(tried);const next=urls.find(url=>!tried.includes(url));if(next)img.src=next;},true);
  const monImage=(r,extra='')=>{
    // Shiny a samice mají u PokeMiners vlastní soubor; zapečený obrázek druhu
    // variantu nezná, takže se u nich vezme značka přímo z enginu.
    // Zapečený obrázek druhu nezná varianty: shiny, samice ani brněného
    // Mewtwa. Pro ně se bere značka přímo z enginu.
    if((r.shiny==='Ano'||String(r.pohlavi||'').toLowerCase()==='samice'||/armored/i.test(r.pokemon||''))&&P.atlasObrazek){
      const html=P.atlasObrazek(r);
      if(html){const t=document.createElement('template');t.innerHTML=html;const im=t.content.querySelector('img');
        if(im){im.setAttribute('alt',r.pokemon||'');im.dataset.atlasPokemon=r.pokemon||'';if(extra)im.setAttribute('data-extra','1');return im.outerHTML}}
    }
    return `<img src="${art(r)}" alt="${esc(r.pokemon)}" data-atlas-pokemon="${esc(r.pokemon)}" loading="lazy" ${extra}>`;
  };
  window.AtlasMonImage=monImage;
  const groups={home:[],roster:[['roster','Moji Pokémoni']],teams:[['cheatCard','Týmy a souboje'],['rozpocetCard','Pokrytí rolí'],['typesCard','Typy a počasí'],['refCard','Žebříčky'],['prohlidkaCard','Hledat druh'],['friendCard','Výměna']],invest:[['dustCard','Investiční plán']],events:[['eventsCard','Kalendář'],['catchCard','Co chytat']],settings:[['settings-card','Nastavení'],['docsCard','Data a metodika']]};
  const nav=[['home','home','Přehled'],['roster','box','Pokémoni'],['teams','team','Týmy'],['invest','invest','Investice'],['events','calendar','Události']];
  const headings={home:['Tvůj box. Jasný plán.','Co ponechat, připravit a použít při příštím hraní.'],roster:['Moji Pokémoni','Co si necháváš a co pustit. Podrobnosti otevřeš u konkrétního kusu.'],teams:['Připraveni do boje','Týmy, role a pokrytí z tvého současného rosteru.'],invest:['Každý prach má svůj cíl','Naplánuj vylepšení podle svého rozpočtu.'],events:['Příležitosti pro tvůj box','Události, rotace a tipy na chytání.'],settings:['Data a pravidla','Profily, prahy a vysvětlení výpočtů.']};
  let view='home',route='roster',page=0,dialogId=null,previousFocus=null,refreshTimer=null,missingOnly=false,cache={rows:[],computed:{}};
  // Úplná tabulka se zrušila — dlaždice jsou jediný pohled na roster,
  // takže je `compact` natvrdo a uložená volba se ignoruje.
  let compact=true;
  // Tmavý režim je výchozí; světlý jen když si ho člověk přepnul.
  {let t='dark';try{if(localStorage.getItem('pgo_atlas_theme')==='light')t='light'}catch{}document.documentElement.dataset.theme=t}
  document.body.classList.toggle('atlas-compact',compact);
  // Odznáčky označené `data-atlas-test-badge` patří jen do testovací kopie —
  // v produkci by mátly, takže je rozsvítí až vlajka testovacího buildu.
  // (Texty samy tu schválně nejsou ani v komentáři: kontrola před nasazením
  //  hledá v souboru prostý výskyt, viz sync_reference.py.)
  if(window.__ATLAS_TEST_BUILD)requestAnimationFrame(()=>document.querySelectorAll('[data-atlas-test-badge]').forEach(e=>{e.hidden=false}));
  const navHTML=()=>nav.map(([g,i,t])=>`<button data-atlas-nav="${g}" aria-label="${t}">${icon(i)}<span>${t}</span></button>`).join('');
  const shell=document.createElement('div');shell.id='atlasShell';shell.innerHTML=`<aside class="atlas-side"><div class="atlas-brand"><span class="atlas-brand-mark">${icon('box')}</span><span>GO</span><span>Atlas</span></div><div class="atlas-nav-label">TVŮJ HERNÍ PLÁN</div><nav class="atlas-nav" aria-label="Hlavní navigace">${navHTML()}<button data-atlas-nav="settings">${icon('settings')}<span>Data a pravidla</span></button></nav><div class="atlas-side-foot"><span class="atlas-test-badge" data-atlas-test-badge hidden>TESTOVACÍ VERZE</span><p>Oddělené profily a zálohy.<br>Produkční roster se nemění.</p><strong id="atlasProfile"></strong><p id="atlasCount"></p></div></aside><header class="atlas-top"><div class="atlas-crumb">GO Atlas <b id="atlasCrumb">/ Přehled</b></div><div class="atlas-top-actions"><span class="atlas-test-badge atlas-status" data-atlas-test-badge hidden>LOKÁLNÍ TEST</span><button data-click="toggleImportBtn">${icon('upload')} Import CSV</button><button data-click="exportBtn">${icon('download')} Export</button><button class="atlas-icon-btn" data-atlas-action="theme" aria-label="Přepnout světlý nebo tmavý vzhled">${icon('moon')}</button><button class="atlas-icon-btn" data-atlas-nav="settings" aria-label="Nastavení">${icon('settings')}</button></div></header><nav class="atlas-bottom" aria-label="Mobilní navigace">${navHTML()}</nav><div class="atlas-modal" id="atlasModal" hidden><div class="atlas-backdrop" data-atlas-action="close"></div><section class="atlas-drawer" role="dialog" aria-modal="true" aria-labelledby="atlasDetailTitle"><div class="atlas-drawer-header"><span>KONKRÉTNÍ KUS · TVŮJ PLÁN</span><button data-atlas-action="close" aria-label="Zavřít detail">${icon('close')}</button></div><div id="atlasIdentity"></div><div class="atlas-detail-content" id="atlasDetailContent"></div><div style="padding:0 22px 28px"><button class="atlas-mini-btn" data-atlas-action="edit">Upravit údaje tohoto kusu ${icon('arrow')}</button></div></section></div>`;document.body.appendChild(shell);
  const heading=document.createElement('div');heading.id='atlasHeading';heading.className='atlas-heading';
  const subnav=document.createElement('nav');subnav.id='atlasSubnav';subnav.className='atlas-subnav';subnav.setAttribute('aria-label','Nástroje sekce');
  const home=document.createElement('section');home.id='atlasHome';
  const app=$('.app');app.prepend(heading,subnav,home);
  const rosterCard=$('.card.roster'),mode=document.createElement('div');mode.className='atlas-mode';mode.innerHTML='<div class="atlas-mode-controls"><label for="atlasSort">Řazení</label><select id="atlasSort" aria-label="Řazení stručného seznamu"><option value="">Původní řazení</option><optgroup label="Základní"><option value="pokemon:1">Jméno A–Z</option><option value="pokemon:-1">Jméno Z–A</option><option value="cp:-1">CP od nejvyššího</option><option value="cp:1">CP od nejnižšího</option><option value="ivPct:-1">IV od nejvyššího</option><option value="ivPct:1">IV od nejnižšího</option><option value="level:-1">Level od nejvyššího</option><option value="level:1">Level od nejnižšího</option></optgroup><optgroup label="Čas"><option value="scanDate:-1">Naposledy naskenované</option><option value="scanDate:1">Nejdéle nenaskenované</option><option value="catchDate:-1">Nejnověji chycené</option><option value="catchDate:1">Nejdéle chycené</option></optgroup><optgroup label="PvP ligy"><option value="pvpRec:1">Všechny ligy po pořadí</option><option value="liga:LC:1">Little Cup: nejlepší první</option><option value="liga:LC:-1">Little Cup: nejhorší první</option><option value="liga:GL:1">Great League: nejlepší první</option><option value="liga:GL:-1">Great League: nejhorší první</option><option value="liga:UL:1">Ultra League: nejlepší první</option><option value="liga:UL:-1">Ultra League: nejhorší první</option><option value="liga:ML:1">Master League: nejlepší první</option><option value="liga:ML:-1">Master League: nejhorší první</option></optgroup></select><button data-atlas-action="mode"></button></div>';
  const list=document.createElement('div');list.id='atlasRoster';list.className='atlas-roster';const table=$('#rosterTable').closest('.table-wrap');table.before(mode,list);
  function sync(g,r){view=g;route=r||route;document.body.dataset.atlasView=g;const [title,subtitle]=headings[g];heading.innerHTML=`<div><h1>${title}</h1><p>${subtitle}</p></div>${g==='home'?`<button class="atlas-cta" data-click="boxModeBtn">${icon('spark')} Projít box</button>`:''}`;subnav.innerHTML=groups[g].length>1?groups[g].map(([id,t])=>`<button data-atlas-route="${id}" class="${id===r?'active':''}" ${id===r?'aria-current="page"':''}>${t}</button>`).join(''):'';document.querySelectorAll('[data-atlas-nav]').forEach(b=>{b.classList.toggle('active',b.dataset.atlasNav===g);if(b.dataset.atlasNav===g)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});$('#atlasCrumb').textContent='/ '+(nav.find(n=>n[0]===g)?.[2]||'Data a pravidla');try{localStorage.setItem('pgo_atlas_view',g)}catch{}if(g==='home')renderHome();}
  function go(g,r){closeDetail();if(g==='home')sync('home');else window.__pgoZalozka(r||groups[g][0][0]);window.scrollTo({top:0,behavior:'instant'});}
  window.addEventListener('atlas:route',e=>{const g=Object.keys(groups).find(g=>groups[g].some(p=>p[0]===e.detail));if(g)sync(g,e.detail)});
  function role(c){return window.AtlasRole(c)}
  function decision(c){return window.AtlasVerdict(c).label;}
  function next(c,r){if(c.validationIssues?.length)return 'Ověřit CP, level a IV';if(c.cuteOnly)return 'Ponechat pro radost';if(!r.fastMove||!r.charged1)return 'Doplnit útoky';if(c.powerup&&c.powerup.startsWith('Ano'))return 'Otevřít plán vylepšení';if(c.evolve&&c.evolve.startsWith('Ano'))return 'Ověřit cestu evoluce';return 'Prohlédnout doporučení';}
  function rowHTML(r){const c=cache.computed[r.id]||{},iv=c.ivPct;return `<button class="atlas-row atlas-roster-tile" data-atlas-detail="${esc(r.id)}" aria-label="Detail ${esc(r.pokemon)}"><span class="atlas-tile-heading"><b>${esc(r.pokemon)}${r.star?' <span class="atlas-tile-star" aria-label="Označeno">★</span>':''}</b><span class="atlas-num"><small>CP</small>${fmt(r.cp)}</span></span><span class="atlas-poke">${monImage(r)}<span class="atlas-tile-info"><span class="atlas-tile-stats"><b>${iv==null?'IV neznámé':Math.round(iv*100)+' % IV'}</b><span>L${esc(r.level||'?')}</span></span><span class="atlas-tile-tags">${window.AtlasTags(c,r)}</span></span></span><span class="atlas-decision"><span class="atlas-pill" data-verdict="${window.AtlasVerdict(c).tone}">${decision(c)}</span>${(P.atlasDuvody&&P.atlasDuvody(c))||'<small>'+esc(role(c))+'</small>'}</span><span class="atlas-arrow" aria-hidden="true">${icon('next')}</span></button>`;}

  function renderedRows(){const ids=[...$('#tbody').querySelectorAll('tr[data-row-id]')].map(tr=>tr.dataset.rowId);const map=new Map(cache.rows.map(r=>[r.id,r]));return ids.map(id=>map.get(id)).filter(r=>r&&(!missingOnly||!r.fastMove||!r.charged1)&&(!window.AtlasRosterMatch||window.AtlasRosterMatch(r,cache.computed[r.id]||{})));}
  // Dlaždice se překreslovaly všechny při každé změně: u 400 kusů to bylo
  // 34 tisíc zásahů do DOMu na jedno kliknutí (třeba přepnutí značky) a mezi
  // kusy se pak „sekalo". Když se pořadí ani počet nezmění, vymění se jen ty
  // dlaždice, jejichž HTML je jiné — obvykle jedna nebo dvě.
  let posledniHtml = [], posledniPoradi = '';
  function renderRoster(){const rows=renderedRows(),scroll=list.scrollTop,first=new Map([...list.querySelectorAll('.atlas-roster-tile')].map(el=>[el.dataset.atlasDetail,el.getBoundingClientRect()]));const previousIds=[...first.keys()].join('|'),nextIds=rows.map(r=>String(r.id)).join('|');
  const noveHtml=rows.map(rowHTML);
  if(!missingOnly&&rows.length&&previousIds===nextIds&&posledniPoradi===nextIds
    &&posledniHtml.length===rows.length){
    const dlazdice=[...list.querySelectorAll('.atlas-roster-tile')];
    if(dlazdice.length===rows.length){
      const sablona=document.createElement('div');
      for(let i=0;i<rows.length;i++){
        if(noveHtml[i]===posledniHtml[i])continue;
        sablona.innerHTML=noveHtml[i];
        const nova=sablona.firstElementChild;
        if(nova)dlazdice[i].replaceWith(nova);
      }
      posledniHtml=noveHtml;list.scrollTop=scroll;
      if(P.srovnejDuvody)P.srovnejDuvody(list);
      return;
    }
  }
  posledniHtml=noveHtml;posledniPoradi=nextIds;
  list.innerHTML=`${missingOnly?'<div class="atlas-small-note">Pouze kusy bez úplných útoků · <button class="atlas-mini-btn" data-atlas-action="reset-list">Zrušit filtr útoků</button></div>':''}${noveHtml.join('')||'<div class="atlas-empty">Filtrům neodpovídá žádný Pokémon. Zkus zrušit hledání nebo změnit filtr.</div>'}`;list.scrollTop=previousIds===nextIds?scroll:0;
 if(previousIds!==nextIds&&first.size&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const viewport=list.getBoundingClientRect();list.querySelectorAll('.atlas-roster-tile').forEach(el=>{const before=first.get(el.dataset.atlasDetail),after=el.getBoundingClientRect();if(after.bottom<viewport.top||after.top>viewport.bottom)return;if(before&&before.bottom>=viewport.top&&before.top<=viewport.bottom){const x=before.left-after.left,y=before.top-after.top;if(x||y)el.animate([{transform:`translate(${x}px,${y}px)`},{transform:'translate(0,0)'}],{duration:260,easing:'cubic-bezier(.2,.7,.2,1)'})}else el.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:200,easing:'ease-out'})})}
 if(P.srovnejDuvody)P.srovnejDuvody(list);const sortState=P.snapshot(),sortValue=sortState.sortKey+':'+sortState.sortDir;$('#atlasSort').value=[...$('#atlasSort').options].some(o=>o.value===sortValue)?sortValue:'';}
  function renderHome(){if(window.AtlasRenderHome)window.AtlasRenderHome(home);posledniSkenKarta();}
  /* Poslední naskenovaný kus na Přehledu: štítek v rosteru se mezi stovkami
     dlaždic hledá dlouho, tohle je odpověď na „odkud mám dál skenovat". */
  function posledniSkenKarta(){
    home.querySelector('.atlas-posledni-sken')?.remove();
    const c=P.getComputed(),rows=P.getRows();
    const kus=rows.find(r=>c[r.id]&&c[r.id].posledniSken);
    if(!kus)return;
    const karta=document.createElement('section');karta.className='atlas-posledni-sken';
    karta.innerHTML=`<h3>Poslední skenovaný kus</h3>
      <div class="atlas-posledni-sken-telo">
        ${window.AtlasMonImage(kus)}
        <div><b>${esc(kus.pokemon)}</b><span>${esc(kus.cp?kus.cp+' CP':'')}${kus.scanDate?' · sken '+esc(kus.scanDate):''}</span>
        <p>Ve hře pokračuj od něj — co je za ním, appka ještě nevidí.</p></div>
        <button type="button" class="atlas-mini-btn">Otevřít kus</button>
      </div>`;
    karta.querySelector('button').addEventListener('click',()=>{go('roster');setTimeout(()=>openDetail(kus.id),260)});
    home.append(karta);
  }
  function refresh(){cache={rows:P.getRows(),computed:P.getComputed()};$('#atlasProfile').textContent=P.getProfile();$('#atlasCount').textContent=cache.rows.length+' Pokémonů · lokální profil';renderRoster();if(view==='home')renderHome();}
  // „48.0“ a „14.0“ ze skenu jako 48 a 14; IV procento (nebo rozsah ze skenu) za hodnotami IV.
  const cisloKusu=v=>v===''||v==null?'?':(isNaN(Number(v))?String(v):String(Number(v)));
  const ivKusu=id=>{const c=(P.getComputed()||{})[id]||{};const t=c.ivUncertain&&c.ivRange?c.ivRange:(c.ivPct==null?'':Math.round(c.ivPct*100)+' %');return t?' · '+esc(t):''};
  // Hlavička kusu (obrázek, jméno, CP, IV) — stejná v detailu i v čištění boxu.
  window.AtlasIdentitaHTML=(r,sNadpisem=true)=>`<div class="atlas-detail-identity"><span class="atlas-ident-obr">${monImage(r)}</span><div class="atlas-ident-text"><div class="atlas-eyebrow">${esc(r.forma||'Běžná forma')}${r.star?' · OZNAČENO ★':''}</div><h2${sNadpisem?' id="atlasDetailTitle"':''}${String(r.pokemon||'').length>13?' class="atlas-jmeno-dlouhe"':''}>${esc(r.pokemon)}</h2><p class="atlas-ident-radek">${fmt(r.cp)} CP · L${esc(cisloKusu(r.level))}${ivKusu(r.id)}</p></div></div>`;
  /* Hlavička se při listování překresluje celá, takže i obrázek dostal nový
     uzel — a ten problikne, i když je to ten samý druh. Když se adresa
     obrázku nemění, původní <img> se do nové hlavičky přesune. */
  function nahradIdentitu(r){
    const cil=$('#atlasIdentity');
    const stary=cil.querySelector('img');
    const sablona=document.createElement('div');
    sablona.innerHTML=window.AtlasIdentitaHTML(r);
    const novy=sablona.querySelector('img');
    if(stary&&novy&&stary.getAttribute('src')===novy.getAttribute('src')){
      novy.replaceWith(stary);
    }
    cil.replaceChildren(...sablona.childNodes);
  }

  function openDetail(id,retain=false){const r=P.getRows().find(r=>r.id===id);if(!r)return;if(!retain)previousFocus=document.activeElement;dialogId=id;nahradIdentitu(r);$('#atlasModal').hidden=false;P.atlasDetail(id,$('#atlasDetailContent'),closeDetail);document.body.style.overflow='hidden';if(!retain)$('.atlas-drawer-header button').focus();}
  function closeDetail(){if(!dialogId)return;dialogId=null;$('#atlasModal').hidden=true;$('#atlasDetailContent').innerHTML='';document.body.style.overflow='';previousFocus?.focus({preventScroll:true});}
  window.addEventListener('atlas:refresh-detail',()=>{refresh();if(dialogId)openDetail(dialogId,true)});
  function setCompact(value){compact=value;document.body.classList.toggle('atlas-compact',value);try{localStorage.setItem('pgo_atlas_compact',value?'1':'0')}catch{}renderRoster();}
  document.addEventListener('click',e=>{const el=e.target.closest('[data-atlas-nav],[data-atlas-route],[data-atlas-detail],[data-atlas-action],[data-atlas-page],[data-atlas-filter],[data-click]');if(!el)return;if(el.dataset.atlasNav){go(el.dataset.atlasNav);return}if(el.dataset.atlasRoute){go(view,el.dataset.atlasRoute);return}if(el.dataset.atlasDetail){openDetail(el.dataset.atlasDetail);return}if(el.dataset.atlasPage){page+=Number(el.dataset.atlasPage);renderRoster();list.scrollIntoView({block:'start'});return}if(el.dataset.atlasFilter){const f=el.dataset.atlasFilter;go('roster');$('#searchInput').value='';$('#searchInput').dispatchEvent(new Event('input',{bubbles:true}));$('#filterSelect').value=f==='missing'?'all':f;$('#filterSelect').dispatchEvent(new Event('change',{bubbles:true}));missingOnly=f==='missing';refresh();return}if(el.dataset.click){if(el.dataset.click==='toggleImportBtn')go('roster');$('#'+el.dataset.click)?.click();return}switch(el.dataset.atlasAction){case 'close':closeDetail();break;case 'mode':setCompact(!compact);break;case 'reset-list':missingOnly=false;renderRoster();break;case 'theme':{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=t;try{localStorage.setItem('pgo_atlas_theme',t)}catch{}break}case 'edit':{const id=dialogId;go('roster');missingOnly=false;$('#zrusitFiltry').click();setCompact(false);$('#viewSelect').value='all';$('#viewSelect').dispatchEvent(new Event('change',{bubbles:true}));const tr=$('#tbody').querySelector(`tr[data-row-id="${CSS.escape(id)}"]`);tr?.scrollIntoView({block:'center'});break}}});
  document.addEventListener('keydown',e=>{if(document.querySelector('.rucni-box:not([hidden])'))return;if(!dialogId)return;if(e.key==='Escape'){e.preventDefault();closeDetail()}if(e.key==='Tab'){const els=[...$('#atlasModal').querySelectorAll('button:not(:disabled),a,input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')].filter(el=>el.getClientRects().length),first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}});
  new MutationObserver(()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,50)}).observe($('#tbody'),{childList:true});
  $('#searchInput').addEventListener('input',()=>{page=0});$('#filterSelect').addEventListener('change',()=>{page=0;missingOnly=false});
  $('#atlasSort').addEventListener('change',e=>{const hodnota=e.target.value;if(!hodnota){page=0;P.atlasSort('',1);refresh();return}const dvojtecka=hodnota.lastIndexOf(':'),key=hodnota.slice(0,dvojtecka),dir=hodnota.slice(dvojtecka+1);page=0;P.atlasSort(key,Number(dir));refresh()});
  refresh();let start='home';try{start=localStorage.getItem('pgo_atlas_view')||'home'}catch{}go(headings[start]?start:'home');
  if(window.__atlasStorageUnavailable){const note=document.createElement('p');note.className='atlas-notice';note.textContent='Prohlížeč zablokoval ukládání. Data a změny si exportuj do souboru.';heading.after(note)}
  // Explicit local-only surface: production cloud controls retain their code,
  // but cannot be activated accidentally in the test design.
  $('#cloudCard')?.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
  window.__atlasTest={go,refresh,openDetail,closeDetail,setCompact,getDetailSequence:()=>renderedRows().map(r=>r.id),getState:()=>({view,route,page,dialogId,compact,rows:cache.rows.length})};
})();

/* Pure draft budget: integer dust only; no spending and no inferred inventory. */
globalThis.AtlasBudget = (() => {
  const amount = value => String(value ?? '').trim() !== '' && /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
  function calculate(plans, selected, balance, reserve) {
    balance = amount(balance); reserve = amount(reserve);
    const valid = plans.filter(p => p && p.id && Number.isSafeInteger(p.cena?.dust) && p.cena.dust >= 0);
    const chosen = valid.filter(p => selected.includes(p.id));
    const spent = chosen.reduce((sum,p) => sum + p.cena.dust, 0);
    const known = balance !== null && reserve !== null && Number.isSafeInteger(spent);
    const available = known ? Math.max(0,balance-reserve) : null;
    return {chosen,spent,known,available,remaining:known?balance-spent:null,shortfall:known?Math.max(0,spent+reserve-balance):null,within:known&&spent+reserve<=balance};
  }
  function fit(plans,balance,reserve) {
    const state=calculate(plans,[],balance,reserve);if(!state.known)return [];
    let remaining=state.available;
    return [...plans].sort((a,b)=>a.cena.dust-b.cena.dust||a.id.localeCompare(b.id)).filter(p=>{if(!Number.isSafeInteger(p.cena.dust)||p.cena.dust<=0||p.cena.dust>remaining)return false;remaining-=p.cena.dust;return true}).map(p=>p.id);
  }
  function matchesRole(plan,filter) {
    if(filter==='all')return true;
    const role=String(plan.role||'');
    if(filter.startsWith('league:'))return /^PvP\b/.test(role)&&(plan.league||role.match(/^PvP (LC|GL|UL|ML)(?:\s|$)/)?.[1])===filter.slice(7);
    return role===filter||role.startsWith(filter+' ');
  }
  return {amount,calculate,fit,matchesRole};
})();

(() => {
  'use strict';
  const P=window.__pgo,B=window.AtlasBudget,$=s=>document.querySelector(s),fmt=n=>new Intl.NumberFormat('cs-CZ').format(n),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const host=$('#dustCard');
  const legacy=document.createElement('details');legacy.className='atlas-budget-legacy';legacy.innerHTML='<summary>Podrobný model přínosu a plánování po krocích</summary>';
  [...host.children].filter(el=>el.tagName!=='SUMMARY').forEach(el=>legacy.append(el));host.append(legacy);
  const panel=document.createElement('div');panel.id='atlasBudget';host.insertBefore(panel,legacy);
  panel.innerHTML=`<div class="ab-layout"><div><section class="ab-wallet"><div class="atlas-eyebrow">01 / NASTAV SI HRANICE</div><h2>Tvůj prach. Tvoje rozhodnutí.</h2><p>Vyber nejbližší kroky vylepšení a ponech si rezervu na další hraní.</p><div class="ab-inputs"><label id="abBalanceLabel">Mám prachu</label><label>Chci si nechat rezervu<input id="abReserve" type="number" min="0" step="1" inputmode="numeric" placeholder="0"></label><label id="abLevelLabel">Nejvyšší cílový level</label></div><div id="abLimits"></div></section><section class="ab-candidates"><div class="ab-title"><div><div class="atlas-eyebrow">02 / VYBER VYLEPŠENÍ</div><h2>Co připravíš jako další?</h2></div><span id="abCandidateCount" class="atlas-pill"></span></div><div class="ab-tools"><label>Účel<select id="abRole"><option value="all">Všechny role</option><option value="PvP">PvP</option><option value="Raid">Raidy</option><option value="Gym">Obrana gymu</option></select></label><label>Řazení<select id="abSort"><option value="price">Nejnižší cena</option><option value="name">Jméno A–Z</option></select></label><button id="abFit" class="atlas-mini-btn">Vybrat nejlevnější do rozpočtu</button><button id="abClear" class="atlas-mini-btn">Zrušit výběr</button></div><p class="ab-caption">Výběr podle ceny není pořadí bojové síly. Každý kus má jeden nejbližší krok shodný s jeho detailem. Cena není cenou dokončení celé cesty.</p><div id="abCandidates"></div></section></div><aside class="ab-summary"><div class="atlas-eyebrow">03 / TVŮJ PLÁN</div><h2>Než utratíš prach</h2><div id="abTotals" aria-live="polite"></div><div class="ab-disclaimer"><strong>Cena zahrnuje power-upy</strong><p>Evoluce, druhý nabitý útok a TM jsou navíc. Zásoby candy a XL neznáme; ověř je pro každý kus. Výběrem se nic neodečítá ani nemění v rosteru.</p></div><div id="abSelected"></div></aside></div>`;
  $('#abRole option[value="PvP"]').textContent='PvP · všechny ligy';
  $('#abRole option[value="PvP"]').insertAdjacentHTML('afterend','<option value="league:LC">Little Cup · do 500 CP</option><option value="league:GL">Great League · do 1 500 CP</option><option value="league:UL">Ultra League · do 2 500 CP</option><option value="league:ML">Master League · bez CP limitu</option>');
  panel.querySelector('.ab-candidates > .ab-caption').append(' Filtr ligy vybírá aktivní cíle; nepřepíná kus na alternativní ligu. Little Cup zde neověřuje pravidla konkrétního poháru.');
  $('#abBalanceLabel').append($('#dustBudget'));$('#dustBudget').step='1';$('#dustBudget').setAttribute('inputmode','numeric');
  $('#abLevelLabel').append($('#cilLevel'));$('#abLimits').append($('#bezXL').closest('label'));
  legacy.querySelectorAll('.dust-input .hint,.dust-input label[for="dustBudget"],.dust-input label[for="cilLevel"]').forEach(el=>el.remove());
  let profile='',draft={reserve:'0',selected:[]},plans=[],rows=[],role='all',sort='price';
  const storageKey=()=> 'pgo_atlas_budget:'+P.getProfile();
  function save(){try{localStorage.setItem(storageKey(),JSON.stringify(draft))}catch{}}
  function filtered(){return plans.filter(p=>B.matchesRole(p,role)&&(!$('#bezXL').checked||p.cena.xl===0)).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'cs'):a.cena.dust-b.cena.dust||a.name.localeCompare(b.name,'cs'));}
  function render(){
    if(profile!==P.getProfile()){profile=P.getProfile();draft={reserve:'0',selected:[]};try{const d=JSON.parse(localStorage.getItem(storageKey()));if(d&&Array.isArray(d.selected))draft={reserve:String(d.reserve??'0'),selected:d.selected.filter(x=>typeof x==='string')}}catch{}$('#abReserve').value=draft.reserve;}
    rows=P.getRows();const computed=P.getComputed();plans=rows.flatMap(r=>{const c=computed[r.id],p=c?.activePlan;return p&&!c.validationIssues?.length&&p.cena.dust>0?[{...p,rowId:r.id,name:r.pokemon,level:r.level,currentCp:r.cp,moves:!!r.fastMove&&!!r.charged1}]:[]});
    const oldCount=draft.selected.length;draft.selected=draft.selected.filter(id=>plans.some(p=>p.id===id&&(!$('#bezXL').checked||p.cena.xl===0)));if(oldCount!==draft.selected.length)save();
    const state=B.calculate(plans,draft.selected,$('#dustBudget').value,draft.reserve),items=filtered();
    $('#abFit').disabled=!state.known;$('#abCandidateCount').textContent=items.length+' cílů';
    $('#abCandidates').innerHTML=items.map(p=>`<article class="ab-candidate ${draft.selected.includes(p.id)?'selected':''}"><label class="ab-pick"><input type="checkbox" data-budget-pick="${esc(p.id)}" ${draft.selected.includes(p.id)?'checked':''} aria-label="Zařadit ${esc(p.name)} do plánu"><span><strong>${esc(p.name)}</strong><small>${esc(p.role)} · L${esc(p.level)} → ${p.uroven}</small></span></label><div class="ab-target"><span>${esc(p.cilJmeno)} · <b>${fmt(p.cilCp)} CP</b></span><small>${p.evoluce?'Vyžaduje evoluci · ověř podmínky':p.nedotazeny?'Dílčí cíl · úplný cíl L'+p.fullLevel:'Cílový level pro tento plán'}${p.moves?'':' · doplň útoky'}</small></div><div class="ab-price"><strong>${fmt(p.cena.dust)}</strong><small>prach · power-up</small><span>${fmt(p.cena.candy)} candy · ${fmt(p.cena.xl)} XL</span></div><button class="atlas-mini-btn" data-atlas-detail="${esc(p.rowId)}">Detail →</button></article>`).join('')||'<div class="atlas-empty">Pro tento filtr není žádný placený cíl. Zkus jinou roli nebo ověř data a nastavení v detailu Pokémonů.</div>';
    $('#abTotals').innerHTML=`<div class="ab-total"><span>Power-upy · ${state.chosen.length} kusů</span><strong>${fmt(state.spent)}</strong><small>prachu ve výběru</small></div><div class="ab-line"><span>Prach k plánování</span><b>${state.known?fmt(state.available):'Nezadáno'}</b></div><div class="ab-line"><span>Zůstane po power-upech</span><b>${state.known?fmt(state.remaining):'Neznámé'}</b></div><div class="ab-line"><span>Tvoje rezerva</span><b>${B.amount(draft.reserve)!==null?fmt(Number(draft.reserve)):'Neplatná'}</b></div><p class="ab-status ${state.within?'ok':'attention'}">${!state.known?'Zadej nezáporný celý počet prachu a rezervu.':!state.within?'Chybí '+fmt(state.shortfall)+' prachu pro výběr a rezervu.':state.chosen.length?'Power-upy se vejdou. Ověř ještě ostatní náklady.':'Rozpočet je nastavený. Vyber svůj první cíl.'}</p>${oldCount!==draft.selected.length?'<p role="status">Změněné nebo neplatné cíle byly z výběru odebrány. Zkontroluj nové ceny.</p>':''}`;
    $('#abSelected').innerHTML=state.chosen.length?'<h3>Vybrané cíle</h3>'+state.chosen.map(p=>`<button data-atlas-detail="${esc(p.rowId)}" class="ab-chosen"><span>${esc(p.name)}<small>${esc(p.role)} · L${p.uroven}</small></span><b>${fmt(p.cena.dust)}</b></button>`).join(''):'<p class="ab-caption">Tady uvidíš svůj výběr. Plán se ukládá zvlášť pro každý testovací profil.</p>';
  }
  panel.addEventListener('change',e=>{if(e.target.dataset.budgetPick){const id=e.target.dataset.budgetPick;draft.selected=draft.selected.filter(x=>x!==id);if(e.target.checked)draft.selected.push(id);save();render()}if(e.target.id==='abRole'){role=e.target.value;render()}if(e.target.id==='abSort'){sort=e.target.value;render()}});
  $('#abReserve').addEventListener('input',e=>{draft.reserve=e.target.value;save();render()});
  $('#abFit').addEventListener('click',()=>{draft.selected=B.fit(filtered(),$('#dustBudget').value,draft.reserve);save();render()});
  $('#abClear').addEventListener('click',()=>{draft.selected=[];save();render()});
  ['dustBudget','cilLevel','bezXL'].forEach(id=>$('#'+id).addEventListener(id==='dustBudget'?'input':'change',()=>setTimeout(render,0)));
  let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(render,100)}).observe($('#tbody'),{childList:true});
  window.addEventListener('atlas:route',()=>render());render();window.__atlasBudget={render,getState:()=>B.calculate(plans,draft.selected,$('#dustBudget').value,draft.reserve)};
})();

(() => {
  const $=s=>document.querySelector(s);
  const copy={
    cheatCard:['Sestavit tým','Konkrétní soupeři a útoky tvých Pokémonů.','Porovnání je modelový odhad. Chybějící útoky a podmínky boje mohou změnit výsledek.'],
    rozpocetCard:['Najít slabé místo','Které role tvůj box pokrývá a kde hledat posilu.','Potenciální role může vyžadovat evoluci nebo změnu útoků. Není automaticky hotovým týmem.'],
    typesCard:['Vybrat správný typ','Účinnost útoků, odolnosti a vliv počasí.','V souboji rozhoduje typ konkrétního útoku, ne jen typ útočícího Pokémona.'],
    refCard:['Porovnat druhy','Referenční pořadí pro orientaci v možnostech.','Pořadí druhu není pravděpodobnost výhry. Pro investici otevři konkrétní kus a jeho plán.'],
    prohlidkaCard:['Prozkoumat Pokémona','Najdi druh a jeho možnosti před investicí.','Rozlišuj běžnou, regionální a Shadow formu. Jejich výsledky nejsou zaměnitelné.'],
    friendCard:['Připravit výměnu','Porovnej možnosti s druhým rosterem.','Po výměně se IV mění. Současný PvP výsledek proto není zaručeným výsledkem výměny.'],
    eventsCard:['Naplánovat hraní','Kalendář, raidoví bossové a rotace lig na jednom místě.','Kalendář vychází ze zabudovaných dat. Před plánováním ověř datum aktualizace a pravidla konkrétního poháru.'],
    catchCard:['Vybrat, co chytat','Doplň box nebo sbírej candy pro své cíle.','Dostupnost závisí na místě, čase a události. Počty candy v cílech neříkají, kolik jich už máš.'],
    'settings-card':['Přizpůsobit doporučení','Nastav hranice pro ponechání a plánování.','Změna prahů přepočítá doporučení. Změněné investiční cíle se z rozpracovaného výběru odeberou.'],
    docsCard:['Rozumět výsledkům','Zdroje dat, pravidla a vysvětlení výpočtů.','Přesná cena power-upu, podmíněná evoluce a odhad bojové síly jsou různé typy výsledků.']
  };
  const guide=document.createElement('section');guide.className='atlas-section-guide';guide.hidden=true;$('#atlasSubnav').after(guide);
  function refresh(){
    const state=window.__atlasTest.getState(),c=copy[state.route];guide.hidden=!c||['home','roster','invest'].includes(state.view);
    if(!guide.hidden){guide.innerHTML='<div class="atlas-eyebrow">'+({'teams':'BOJOVÝ PLÁN',events:'DALŠÍ HRANÍ',settings:'TVÉ NASTAVENÍ'}[state.view]||'')+'</div><h2>'+c[0]+'</h2><p>'+c[1]+'</p><div class="atlas-guide-note">'+c[2]+'</div>';}
    document.querySelectorAll('#atlasSubnav [data-atlas-route]').forEach(button=>{const item=copy[button.dataset.atlasRoute];if(item){button.textContent=item[0];button.title=item[1]}});
    // Group the existing independently rendered team sections; keep all native controls.
    const wrap=$('#cheatBody .cs-wrap');
    if(wrap&&!wrap.dataset.atlasGrouped){wrap.dataset.atlasGrouped='1';let group=null;[...wrap.children].forEach(el=>{if(el.matches('h2.cs-title')){group=document.createElement('details');group.className='atlas-team-group';group.open=!wrap.querySelector('.atlas-team-group');const title=document.createElement('summary');title.textContent=el.textContent;group.append(title);el.before(group);el.remove();}else if(group)group.append(el)})}
  }
  window.addEventListener('atlas:route',refresh);
  new MutationObserver(refresh).observe($('#cheatBody'),{childList:true});refresh();
})();

(() => {
  window.AtlasEnhanceDetail=(container,row,computed)=>{
    // Listování a hlavička plachty patří jen detailu; v čištění boxu se
    // používá ten samý rozbor, ale listuje se tlačítky boxu.
    const vPlachte=!!container.closest('#atlasModal');
    if(vPlachte)document.querySelector('.atlas-detail-paging')?.remove();
    const api=window.__atlasTest;
    let ids=api.getDetailSequence();if(!ids.includes(row.id))ids=window.__pgo.getRows().map(r=>r.id);
    const index=ids.indexOf(row.id),paging=document.createElement('nav');paging.className='atlas-detail-paging';paging.setAttribute('aria-label','Procházení Pokémonů');
    for(const [step,label] of [[-1,'← Předchozí'],[1,'Další →']]){const button=document.createElement('button');button.className='atlas-mini-btn';button.textContent=label;button.disabled=!ids[index+step];button.dataset.detailStep=step;button.addEventListener('click',(ev)=>{api.openDetail(ids[index+step],true);document.querySelector('.atlas-drawer').scrollTop=0;
      // Fokus se přesouvá jen při skutečném kliknutí. Při listování klávesou
      // by kolem tlačítka svítil rámeček, který uživatel nevyvolal.
      if(ev&&ev.detail>0){const next=document.querySelector('[data-detail-step="'+step+'"]');(next&&!next.disabled?next:document.querySelector('.atlas-drawer-header button')).focus({preventScroll:true})}});paging.append(button);}
    const position=document.createElement('span');position.textContent=(index+1)+' / '+ids.length;paging.firstChild.after(position);
    if(vPlachte)document.querySelector('.atlas-drawer-header').append(paging);
    const main=container.querySelector('.detail-main');if(!main){const edit=document.createElement('button');edit.className='atlas-mini-btn';edit.textContent='Opravit údaje tohoto kusu';edit.addEventListener('click',()=>window.AtlasEditRow(row.id));container.append(edit);return;}
    main.classList.add('atlas-detail-modern');
    const title=main.querySelector('.detail-title');
    if(title){const typy=[...title.querySelectorAll('.d-type')];for(let i=typy.length;i<2;i++){const mezera=document.createElement('span');mezera.className='d-type atlas-typ-mezera';mezera.setAttribute('aria-hidden','true');mezera.textContent='—';const posledni=title.querySelectorAll('.d-type');if(posledni.length)posledni[posledni.length-1].after(mezera);else title.prepend(mezera)}}
    if(title){title.setAttribute('aria-label','Vlastnosti a osobní značky');title.querySelector('.d-name')?.remove();title.querySelectorAll('button:not(.detail-close)').forEach(button=>button.setAttribute('aria-pressed',String(!button.classList.contains('vypnuto'))));}
    if(title){title.querySelectorAll('.d-flag,.sto-znacka').forEach(el=>{if(el.textContent.trim().toLowerCase()==='lucky')el.remove()});const lucky=document.createElement('button');lucky.type='button';lucky.className='atlas-lucky-tag'+(computed.lucky?' active':'');lucky.textContent='LUCKY';lucky.setAttribute('aria-label','Přepnout Lucky stav');lucky.setAttribute('aria-pressed',String(!!computed.lucky));lucky.addEventListener('click',()=>{const current=window.__pgo.getRows().find(r=>r.id===row.id);if(!current)return;current.forma=computed.lucky?'Normal':'Lucky';window.__pgo.prekreslit();window.__pgo.persistNow();window.dispatchEvent(new CustomEvent('atlas:refresh-detail'));});title.append(lucky);/* Automatické značky (LEG, MYT, UB, 100 %) patří až za osobní — jinak je legendární kus posune a oko je hledá pokaždé jinde. */title.querySelectorAll('.rarity-chip.r-L:not(.r-L2),.rarity-chip.r-M,.rarity-chip.r-U,.rarity-chip.r-H').forEach(el=>title.append(el));}
    const sections=[];let active=null;
    [...main.children].forEach(el=>{
      if(el.matches('.d-sec-h')){
        const key=el.dataset.sekce,group=document.createElement('details');group.className='atlas-detail-section';group.dataset.detailSection=key;
        const summary=document.createElement('summary');summary.textContent=({ligy:'Ligy a alternativní cíle',coted:'Doporučené kroky',naco:'Herní využití',proti:'Typové pokrytí',utoky:'Útoky a připravenost'})[key]||el.textContent;
        group.append(summary);el.before(group);el.remove();active=group;sections.push(group);group.open=['utoky','sestavy','ligy','naco','coted'].includes(key);
      }else if(active)active.append(el);
    });
    const stats=main.querySelector(':scope > .d-grid');if(stats){const group=document.createElement('details');group.className='atlas-detail-section';group.dataset.detailSection='stats';group.innerHTML='<summary>Statistiky, IV a strop CP</summary>';stats.before(group);group.append(stats);sections.push(group);}
    const moves=sections.find(s=>s.dataset.detailSection==='utoky');
    if(moves){const notice=document.createElement('p');notice.className='atlas-move-status';notice.textContent=!row.fastMove||!row.charged1?'Chybí rychlý nebo nabitý útok. Současnou bojovou připravenost nelze plně vyhodnotit.':!row.charged2?'Rychlý a první nabitý útok jsou zadané. Druhý nabitý útok není uvedený; zkontroluj požadavky svého cíle.':'Všechny tři útoky jsou zadané. Jejich vhodnost závisí na cíli a soupeři.';moves.querySelector('summary').after(notice);const edit=document.createElement('button');edit.className='atlas-mini-btn';edit.dataset.atlasAction='edit';edit.textContent='Upravit údaje a útoky →';const first=main.querySelector('.atlas-detail-section');if(first)first.before(moves);}
    for(const key of ['ligy','naco','stats','utoky','sestavy','coted','proti']){const section=sections.find(s=>s.dataset.detailSection===key);if(section){if(key==='stats')section.open=true;main.append(section);}}
    const verdict=main.querySelector('.d-verdict-row');if(verdict){verdict.classList.add('atlas-verdict-first');container.prepend(verdict);const potize=computed.validationIssues||[];if(potize.length){const box=verdict.querySelector('.d-verdict')||verdict;box.setAttribute('data-tip','<div class="tip-hlava">Ověřit data</div>'+potize.map(x=>'<div class="tip-radek">'+String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>').join('')+'<div class="tip-pozn">Dokud údaje nesedí, je zbytek rozboru jen odhad.</div>');}}
    if(verdict){const v=window.AtlasVerdict(computed);verdict.dataset.verdict=v.tone;const label=verdict.querySelector('.d-verdict>b');if(label)label.textContent=v.label;}
    const evo=container.querySelector(':scope > :not(.atlas-plan-summary):not(.detail-main):not(.atlas-verdict-first)');
    if(evo){const group=document.createElement('details');group.className='atlas-detail-section atlas-evolution-column';group.open=true;
      group.addEventListener('toggle',()=>{if(!group.open)group.open=true});group.innerHTML='<summary>Evoluční řada</summary>';evo.before(group);group.append(evo);evo.querySelectorAll('.d-evo-kus').forEach(kus=>{const im=kus.querySelector('img');if(im&&!(im.parentElement&&im.parentElement.classList.contains('atlas-evo-ram'))){const ram=document.createElement('span');ram.className='atlas-evo-ram';im.replaceWith(ram);ram.append(im)}if(kus.querySelector('.atlas-evo-popis'))return;const popis=document.createElement('span');popis.className='atlas-evo-popis';const zbytek=[...kus.childNodes].filter(n=>!(n.nodeType===1&&n.classList&&n.classList.contains('atlas-evo-ram')));zbytek.forEach(n=>popis.append(n));kus.append(popis)});const grid=document.createElement('div');grid.className='atlas-detail-columns';const column=document.createElement('div');column.className='atlas-detail-column';const children=[...container.children];container.prepend(grid);grid.append(column,group);children.filter(el=>el!==group).forEach(el=>column.append(el));}
    container.querySelectorAll('.d-evo-kus[data-tip]').forEach(el=>{el.tabIndex=0;const image=el.querySelector('img'),art=window.ATLAS_ART[window.__pgo.dexKeyOf(el.dataset.druh)];if(image&&art&&!/^(shellos|gastrodon)/i.test(el.dataset.druh)){image.removeAttribute('onerror');image.src=art;image.style.display=''};});
  };
})();

(() => {
  const P=window.__pgo,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.AtlasEditRow=(id,field)=>{
    const row=P.getRows().find(r=>r.id===id),profile=P.getProfile();if(!row)return;
    const host=document.querySelector('#atlasDetailContent');host.querySelector('#atlasRowEditor')?.remove();
    const form=document.createElement('form');form.id='atlasRowEditor';form.className='atlas-row-editor';
    const fields=[['pokemon','Pokémon','text'],['cp','CP','number',10,99999,1],['level','Level','number',1,50,.5],['ivAtk','IV útok','number',0,15,1],['ivDef','IV obrana','number',0,15,1],['ivSta','IV HP','number',0,15,1],['fastMove','Rychlý útok','text'],['charged1','Nabitý útok 1','text'],['charged2','Nabitý útok 2','text']];
    const forms=[...new Set([row.forma||'Normal','Normal','Lucky','Shadow','Purified'])];
    // Pohlaví se nabízí jen u druhů, kde se samec a samice liší vzhledem —
    // jinde by to byl údaj, který nic nezmění.
    const maPohlavi=P.maPohlaviRozdil?P.maPohlaviRozdil(row.pokemon):true;
    const pohlavi=[...new Set([row.pohlavi||'—','—','Samec','Samice'])];
    form.innerHTML='<div class="atlas-eyebrow">UPRAVUJEŠ JEDEN KUS</div><h3>'+esc(row.pokemon)+'</h3><div class="atlas-editor-grid">'+fields.map(([key,label,type,min,max,step])=>`<label>${label}<input name="${key}" type="${type}" value="${esc(row[key])}" ${min!=null?`min="${min}" max="${max}" step="${step}"`:''} ${key==='pokemon'?'required':''}></label>`).join('')+'<label>Stav / forma<select name="forma">'+forms.map(f=>`<option value="${esc(f)}" ${f===(row.forma||'Normal')?'selected':''}>${esc(f)}</option>`).join('')+'</select></label>'+(maPohlavi?'<label>Pohlaví<select name="pohlavi">'+pohlavi.map(f=>`<option value="${f==='—'?'':esc(f)}" ${f===(row.pohlavi||'—')?'selected':''}>${esc(f)}</option>`).join('')+'</select></label>':'')+'<label class="atlas-editor-note">Poznámka<textarea name="note">'+esc(row.note)+'</textarea></label></div>'+'<div class="atlas-editor-actions"><button type="submit" class="atlas-cta">Uložit</button><button type="button" class="atlas-mini-btn" data-editor-cancel>Zrušit</button><p role="status" id="atlasEditorStatus"></p></div>';
    // Útoky se vybírají stejným výběrem jako ve Vyhledávání (typ, síla, ★ elitní) — engine __pgoUtoky.vyber na dočasném objektu; hodnota jde do skrytého pole formuláře. Při změně druhu se výběr postaví znovu.
    const utoky={pokemon:row.pokemon,fastMove:row.fastMove||'',charged1:row.charged1||'',charged2:row.charged2||'',__docasny:true};const vyberUtoku=()=>{if(!window.__pgoUtoky)return;utoky.pokemon=form.elements.pokemon.value;['fastMove','charged1','charged2'].forEach(k=>{const input=form.elements[k];let obal=form.querySelector('[data-utok-obal="'+k+'"]');if(!obal){obal=document.createElement('div');obal.className='atlas-utok-vyber';obal.dataset.utokObal=k;input.after(obal);input.type='hidden'}obal.innerHTML='';window.__pgoUtoky.vyber(obal,utoky,k,()=>{input.value=utoky[k]||''})})};vyberUtoku();form.elements.pokemon.addEventListener('change',vyberUtoku);
    const baseline=new Map([...form.elements].filter(e=>e.name).map(e=>[e.name,e.type==='checkbox'?e.checked:e.value]));
    form.querySelector('[data-editor-cancel]').addEventListener('click',()=>{form.remove();document.body.classList.remove('atlas-edituje');document.querySelector('.atlas-drawer-header button')?.focus()});
    form.addEventListener('submit',e=>{e.preventDefault();const current=P.getRows().find(r=>r.id===id);if(!current||profile!==P.getProfile()){form.querySelector('[role=status]').textContent='Kus nebo profil se změnil. Zavři detail a zkontroluj roster.';return}if(!form.reportValidity())return;
      for(const input of form.elements){if(!input.name)continue;const value=input.type==='checkbox'?input.checked:input.value;if(value!==baseline.get(input.name))current[input.name]=input.type==='checkbox'?(value?'Ano':'Ne'):value;}
      P.prekreslit();P.persistNow();document.body.classList.remove('atlas-edituje');window.dispatchEvent(new CustomEvent('atlas:refresh-detail'));document.querySelector('.atlas-drawer').scrollTop=0;
    });
    const plachta=document.getElementById('atlasModal'),plocha=document.querySelector('.atlas-drawer');
    const volno=plocha?Math.round(plocha.getBoundingClientRect().left):0;
    // Vedle plachty, ne v ní: detail se otevřením úprav nesmí posunout ani
    // zúžit. Když vedle místo není (úzké okno), zůstane úprava v detailu.
    const umistit=()=>{
      if(!form.isConnected){window.removeEventListener('resize',umistit);document.body.classList.remove('atlas-edituje');return}
      const plocha=document.querySelector('.atlas-drawer');
      const misto=plocha?Math.round(plocha.getBoundingClientRect().left):0;
      if(!plachta||misto<300){                       // úzké okno: zpátky do detailu
        form.classList.remove('atlas-editor-vedle');form.removeAttribute('style');
        if(form.parentElement!==host)host.prepend(form);
        return;
      }
      const hlavicka=document.querySelector('.atlas-drawer .atlas-detail-identity');
      const sirka=Math.min(400,misto-16);
      form.classList.add('atlas-editor-vedle');
      form.style.width=sirka+'px';
      form.style.left=Math.max(8,misto-sirka)+'px';
      form.style.top=Math.max(12,Math.round(hlavicka?hlavicka.getBoundingClientRect().top:92))+'px';
      if(form.parentElement!==plachta)plachta.append(form);
    };
    host.prepend(form);        // ať je formulář v dokumentu, než se rozhodne, kam patří
    umistit();
    document.body.classList.add('atlas-edituje');
    window.addEventListener('resize',umistit);
    if(!form.classList.contains('atlas-editor-vedle'))form.scrollIntoView({block:'start'});
    form.querySelector('[name="'+(field||'pokemon')+'"]').focus({preventScroll:true});
  };
  document.addEventListener('click',e=>{const button=e.target.closest('[data-atlas-action="edit"]');if(!button)return;const id=window.__atlasTest.getState().dialogId;if(!id)return;e.preventDefault();e.stopImmediatePropagation();window.AtlasEditRow(id);},true);
  const footer=document.querySelector('.atlas-drawer>div:last-child button[data-atlas-action="edit"]');if(footer)footer.textContent='Upravit tohoto Pokémona →';
  // Odstranit kus jde i ručně — ale jen přes potvrzení, je to nevratné
  // (kus se zapíše mezi smazané, aby ho import nevrátil).
  window.AtlasSmazatKus=(id)=>{
    const row=P.getRows().find(r=>r.id===id);if(!row)return;
    P.potvrdit('Odstranit '+row.pokemon+(row.cp?' ('+row.cp+' CP)':'')+' z rosteru?'
      +'\n\nKus se zapíše mezi smazané, takže se při dalším importu nevrátí.',
      ()=>{if(P.smazatKus(id)){document.querySelector('.atlas-drawer-header button')?.click();
        window.dispatchEvent(new CustomEvent('atlas:refresh'))}},'Odstranit');
  };
  document.addEventListener('click',e=>{const b=e.target.closest('[data-atlas-action="smazat"]');if(!b)return;
    const id=window.__atlasTest.getState().dialogId;if(!id)return;
    e.preventDefault();e.stopImmediatePropagation();window.AtlasSmazatKus(id);},true);
})();

(() => {
  const $=s=>document.querySelector(s),api=window.__atlasTest;
  const items=[['home',null,'Přehled'],['roster','roster','Pokémoni'],['invest','dustCard','Rozpočet'],['teams','prohlidkaCard','Vyhledávání'],['teams','cheatCard','Tahák'],['teams',null,'Bojové nástroje',[['rozpocetCard','Pokrytí rolí'],['typesCard','Typy a počasí'],['refCard','Žebříčky'],['friendCard','Výměna']]],['events',null,'Události',[['eventsCard','Kalendář'],['catchCard','Co chytat']]],['settings',null,'Data a pravidla',[['settings-card','Nastavení'],['docsCard','Metodika a zdroje']]]];
  const glyph=key=>'<svg class="atlas-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="'+({home:'M3 10 12 3l9 7v10h-6v-7H9v7H3Z',roster:'M3 7h18v14H3ZM3 7l3-4h12l3 4M9 12h6',invest:'M4 20h16M7 16v-5m5 5V7m5 9V3',prohlidkaCard:'M15 15l6 6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',cheatCard:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6ZM9 12l2 2 4-4',events:'M4 5h16v16H4ZM8 3v4m8-4v4M4 10h16',settings:'M4 7h16M4 17h16M8 4v6m8 4v6'}[key]||'M5 5h14v14H5ZM9 9h6M9 13h6')+'"/></svg>';
  const symbol=glyph('tools');
  const button=(group,route,label)=>`<button data-menu-group="${group}" ${route?`data-menu-route="${route}"`:''}>${glyph(['prohlidkaCard','cheatCard'].includes(route)?route:group)}<span>${label}</span></button>`;
  const nav=$('.atlas-side .atlas-nav');nav.innerHTML=items.map(([group,route,label,children])=>children?`<details class="atlas-menu-group"><summary>${symbol}<span>${label}</span></summary><div>${children.map(([id,text])=>button(group,id,text)).join('')}</div></details>`:button(group,route,label)).join('');
  const trigger=document.createElement('button');trigger.className='atlas-menu-trigger atlas-mini-btn';trigger.setAttribute('aria-label','Otevřít hlavní menu');trigger.setAttribute('aria-expanded','false');trigger.innerHTML='☰';$('.atlas-top').prepend(trigger);
  const backdrop=document.createElement('button');backdrop.className='atlas-menu-backdrop';backdrop.setAttribute('aria-label','Zavřít hlavní menu');document.body.append(backdrop);
  function close(){document.body.classList.remove('atlas-menu-open');trigger.setAttribute('aria-expanded','false')}
  trigger.addEventListener('click',()=>{const open=document.body.classList.toggle('atlas-menu-open');trigger.setAttribute('aria-expanded',String(open));if(open)nav.querySelector('button').focus()});backdrop.addEventListener('click',close);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('atlas-menu-open')){close();trigger.focus()}});
  nav.addEventListener('click',e=>{const target=e.target.closest('[data-menu-group]');if(!target)return;api.go(target.dataset.menuGroup,target.dataset.menuRoute);close();sync()});
  function sync(){const state=api.getState();nav.querySelectorAll('[data-menu-group]').forEach(b=>{const active=b.dataset.menuRoute?b.dataset.menuRoute===state.route&&state.view!=='home':state.view===b.dataset.menuGroup;b.classList.toggle('active',active);if(active){b.setAttribute('aria-current','page');const group=b.closest('details');if(group)group.open=true}else b.removeAttribute('aria-current')});if(state.route==='prohlidkaCard'&&state.view==='teams'){$('#atlasHeading h1').textContent='Vyhledávání Pokémonů';$('#atlasCrumb').textContent='/ Vyhledávání'}if(state.route==='cheatCard'&&state.view==='teams'){$('#atlasHeading h1').textContent='Tahák do soubojů';$('#atlasCrumb').textContent='/ Tahák'}}
  window.addEventListener('atlas:route',sync);document.addEventListener('click',e=>{if(e.target.closest('[data-atlas-nav]'))sync()});sync();
  // Keep original button handlers and confirmations, only move the controls.
  const toolbar=$('#addRowBtn')?.parentElement;if(toolbar){const menu=document.createElement('details');menu.className='atlas-roster-commands';menu.innerHTML='<summary>Správa rosteru ▾</summary><div></div>';toolbar.append(menu);for(const id of ['toggleImportBtn','exportBtn','backupBtn','backupNowBtn','starKeepersBtn','clearUnstarredBtn','clearBtn','forgetDiscardedBtn']){const el=$('#'+id);if(el){menu.lastChild.append(el);
    // Import a export mají vlastní tlačítka nahoře v liště. Tady zůstávají
    // jen schované, aby na ně horní tlačítka měla kam klikat.
    if(id==='toggleImportBtn'||id==='exportBtn')el.hidden=true}}const umistit=()=>{const panel=menu.lastElementChild,sum=menu.querySelector('summary');if(!panel||!sum)return;if(!menu.open)return;const r=sum.getBoundingClientRect();panel.style.top=Math.round(r.bottom+6)+'px';panel.style.left=Math.round(Math.min(r.left,window.innerWidth-260))+'px';panel.style.minWidth=Math.round(Math.max(r.width,230))+'px'};menu.addEventListener('toggle',umistit);menu.querySelector('summary').addEventListener('pointerdown',()=>{if(!menu.open)requestAnimationFrame(umistit)});window.addEventListener('resize',umistit);window.addEventListener('scroll',umistit,true);document.addEventListener('click',e=>{if(!menu.contains(e.target))menu.open=false});menu.addEventListener('click',e=>{if(e.target.closest('button'))menu.open=false});}
})();

(() => {
  const tip=document.createElement('div');tip.className='atlas-evo-tooltip tip-bublina vidno';tip.id='atlasEvoTooltip';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.append(tip);let target=null;
  function hide(){tip.hidden=true;target?.removeAttribute('aria-describedby');target=null;document.body.classList.remove('atlas-evo-tip-open')}
  function show(el){target=el;const template=document.createElement('template');template.innerHTML=el.dataset.tip||'';template.content.querySelectorAll('*').forEach(node=>{if(!['DIV','SPAN','B','STRONG','EM','I','BR','P','SMALL','UL','LI'].includes(node.tagName)){node.replaceWith(document.createTextNode(node.textContent));return}for(const attr of [...node.attributes]){if(attr.name!=='class'&&!(attr.name==='style'&&/^\s*(font-size|margin-top|padding-top|border-top|color)\s*:/i.test(attr.value)))node.removeAttribute(attr.name)}});tip.replaceChildren(template.content.cloneNode(true));tip.style.left='0px';tip.style.top='0px';tip.hidden=false;document.body.classList.add('atlas-evo-tip-open');el.setAttribute('aria-describedby',tip.id);const rect=el.getBoundingClientRect(),box=tip.getBoundingClientRect();let right=document.documentElement.clientWidth;for(let s=el.parentElement;s&&s!==document.body;s=s.parentElement){const cs=getComputedStyle(s);if(/(auto|scroll)/.test(cs.overflowY)&&s.scrollHeight>s.clientHeight){const sr=s.getBoundingClientRect();right=Math.min(right,sr.left+s.clientLeft+s.clientWidth);break}}tip.style.left=Math.max(12,Math.min(right-box.width-16,rect.left+rect.width/2-box.width/2))+'px';tip.style.top=Math.max(12,Math.min(innerHeight-box.height-12,rect.top>=box.height+12?rect.top-box.height-8:rect.bottom+8))+'px';}
  document.addEventListener('pointerover',e=>{const el=e.target.closest('#atlasModal .d-evo-kus[data-tip]');if(el&&el!==target)show(el)});
  document.addEventListener('pointerout',e=>{if(target&&target.contains(e.target)&&!target.contains(e.relatedTarget)&&!tip.contains(e.relatedTarget))hide()});
  document.addEventListener('focusin',e=>{const el=e.target.closest('#atlasModal .d-evo-kus[data-tip]');if(el)show(el)});
  document.addEventListener('focusout',e=>{if(target&&target.contains(e.target))hide()});
  document.addEventListener('click',e=>{const el=e.target.closest('#atlasModal .d-evo-kus[data-tip]');if(el){show(el);if(!el.classList.contains('evo-klikaci'))e.stopPropagation()}else if(!tip.contains(e.target))hide()},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});window.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);
})();

(() => {
  const P=window.__pgo,$=s=>document.querySelector(s);
  $('.atlas-brand').innerHTML='<span class="atlas-ball-logo" aria-hidden="true"><i></i></span><span class="atlas-brand-name">Pokémon GO<strong>Atlas</strong></span>';
  document.title='[TEST] Pokémon GO Atlas';
  const copy={cheatCard:['Tahák do soubojů','Konkrétní soupeři a sestavy z tvých Pokémonů. Výsledky jsou modelové odhady.'],prohlidkaCard:['Vyhledávání Pokémonů','Najdi druh, jeho formy, ligy a evoluční možnosti.'],rozpocetCard:['Pokrytí rolí','Najdi slabá místa svého boxu a kandidáty na doplnění.'],typesCard:['Typy a počasí','Účinnost útoků, odolnosti a vliv počasí.'],refCard:['Žebříčky','Porovnej druhy podle role; konkrétní kus vyhodnoť v jeho detailu.'],friendCard:['Výměna','Porovnej svůj roster s druhým hráčem.'],eventsCard:['Kalendář událostí','Raidy a události podle zabudovaných dat. Ověř jejich datum aktualizace.'],catchCard:['Co chytat','Pokémoni a candy pro doplnění tvého boxu.'],'settings-card':['Nastavení','Přizpůsob prahy a pravidla doporučení.'],docsCard:['Metodika a zdroje','Význam výsledků, použitá data a omezení výpočtů.']};
  function heading(){const state=__atlasTest.getState(),entry=copy[state.route];document.body.dataset.atlasCurrentRoute=state.route;if(entry&&!['home','roster','invest'].includes(state.view)){$('#atlasHeading h1').textContent=entry[0];$('#atlasHeading p').textContent=entry[1];}}
  window.addEventListener('atlas:route',heading);heading();
  const toolbar=$('#addRowBtn').closest('.toolbar');if(toolbar){const bar=document.createElement('div');bar.className='atlas-roster-commandbar';toolbar.before(bar);
  // V liště příkazů má „projít box" stejnou podobu jako tlačítko u nadpisu.
  {const b=$('#boxModeBtn');if(b){b.classList.add('atlas-cta');b.innerHTML='<svg class="atlas-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></svg> Projít box';}}for(const el of [$('#addRowBtn'),$('#boxModeBtn'),$('#searchInput'),$('.atlas-mode-controls'),$('#filterSelect'),$('#zrusitFiltry'),$('.atlas-roster-commands')])if(el)bar.append(el);}
  const applyTable=()=>{const computed=P.getComputed();$('#tbody').querySelectorAll('tr[data-row-id]').forEach(tr=>{const c=computed[tr.dataset.rowId],cell=tr.querySelector('[data-col="keep"]');if(!c||!cell)return;const v=AtlasVerdict(c);cell.dataset.atlasVerdict=v.tone;const badge=cell.querySelector('.badge');if(badge){badge.dataset.verdict=v.tone;badge.textContent=v.label;}})};
  new MutationObserver(applyTable).observe($('#tbody'),{childList:true});applyTable();
})();
(() => {
 const $=s=>document.querySelector(s),P=window.__pgo;
 const profile=$('#profilBtn'),commands=$('.atlas-roster-commands>div');if(profile&&commands)commands.append(profile);
 const view=$('#viewSelect');view.value='all';view.dispatchEvent(new Event('change',{bubbles:true}));view.hidden=true;
 $('#tbody').addEventListener('click',e=>{const row=e.target.closest('tr[data-row-id]');if(!row||e.target.closest('input,select,textarea,button,a,label'))return;e.stopImmediatePropagation();__atlasTest.openDetail(row.dataset.rowId)},true);
 const dialog=document.createElement('dialog');dialog.id='atlasImportDialog';dialog.className='atlas-import-dialog';dialog.setAttribute('aria-labelledby','atlasImportTitle');dialog.innerHTML='<header><div><h2 id="atlasImportTitle">Import rosteru</h2><p>Vyber soubor, zkontroluj náhled a rozhodni, jak data přidat.</p></div><button type="button" aria-label="Zavřít import">✕</button></header>';
 document.body.append(dialog);const box=$('#importBox');dialog.append(box);
 function close(){ $('#cancelImportBtn').click();if(dialog.open)dialog.close(); }
 dialog.querySelector('header button').addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
 document.addEventListener('click',e=>{if(!e.target.closest('#toggleImportBtn,[data-click="toggleImportBtn"]'))return;e.preventDefault();e.stopImmediatePropagation();box.classList.add('open');dialog.showModal()},true);
 new MutationObserver(()=>{if(!box.classList.contains('open')&&dialog.open)dialog.close()}).observe(box,{attributes:true,attributeFilter:['class']});
})();
(() => {
 const $=s=>document.querySelector(s);
 // Keep the native file-cancel handler: it discards only the pending preview.
 $('#cancelImportBtn').hidden=true;
 const fileCancel=$('#mapCancelBtn');fileCancel.textContent='Zrušit vybraný soubor';fileCancel.addEventListener('click',()=>{$('#fileInput').value=''});
 // Souhrnný box Využití/Krok/Cena/Chybí v detailu už není — opakoval verdikt a doporučený krok.
 const warning=$('#zalWarn'),rosterBar=$('#addRowBtn')?.parentElement;if(warning&&rosterBar){rosterBar.after(warning)}
 let editing=false;const edit=document.createElement('button');edit.id='atlasTableEdit';edit.className='atlas-mini-btn';edit.textContent='Zapnout editaci tabulky';$('.atlas-mode-controls').append(edit);
 function readonly(){document.body.classList.toggle('atlas-table-readonly',!editing);$('#tbody').querySelectorAll('input,select,textarea').forEach(input=>{let text=input.nextElementSibling;if(!text?.classList.contains('atlas-read-value')){text=document.createElement('span');text.className='atlas-read-value';input.after(text)}text.textContent=input.type==='checkbox'?(input.checked?'Ano':'Ne'):input.tagName==='SELECT'?(input.selectedOptions[0]?.textContent||'—'):(input.value||'—')})}
 edit.addEventListener('click',()=>{editing=!editing;edit.textContent=editing?'Dokončit editaci':'Zapnout editaci tabulky';edit.setAttribute('aria-pressed',String(editing));readonly()});new MutationObserver(readonly).observe($('#tbody'),{childList:true});readonly();
})();
(() => {
 const name=document.querySelector('#prohName');
 name.addEventListener('change',()=>{document.querySelectorAll('.druh-napoveda').forEach(panel=>panel.hidden=true)});
 const openState=new Map();
 function foldTeams(){
  const root=document.querySelector('#cheatBody');
  const leagues=root.querySelector('.cs-ligy');
  if(leagues&&!leagues.dataset.atlasSeparated){leagues.dataset.atlasSeparated='1';const parent=leagues.closest('.atlas-team-group');const group=document.createElement('details');group.className='atlas-team-group atlas-league-group';group.innerHTML='<summary>Ligy</summary>';if(parent)parent.after(group);else leagues.before(group);group.append(leagues)}
  const fold=(el,heading,key)=>{if(!heading||el.dataset.atlasFolded)return;el.dataset.atlasFolded='1';const d=document.createElement('details');d.className='atlas-team-item';d.open=openState.get(key)||false;const summary=document.createElement('summary');summary.append(heading);d.append(summary);while(el.firstChild)d.append(el.firstChild);el.append(d);d.addEventListener('toggle',()=>openState.set(key,d.open));};
  root.querySelectorAll('.cs-type').forEach(el=>{const heading=el.querySelector(':scope>.cs-boss-hlava,:scope>.cs-type-name');fold(el,heading,'boss:'+heading?.textContent)});
  root.querySelectorAll('.cs-liga').forEach(el=>{const heading=el.querySelector(':scope>.cs-title');fold(el,heading,'league:'+heading?.textContent)});
  root.querySelectorAll('.atlas-team-group').forEach(group=>{if(!group.querySelector(':scope>summary')?.textContent.includes('gym'))return;group.querySelectorAll(':scope>.cs-flat>li').forEach(el=>{const title=el.querySelector(':scope>b');if(!title||el.dataset.atlasFolded)return;const heading=document.createElement('span');heading.append(title);const cp=el.querySelector(':scope>.cs-cp');if(cp)heading.append(cp);fold(el,heading,'gym:'+heading.textContent)})});
 }
 new MutationObserver(foldTeams).observe(document.querySelector('#cheatBody'),{childList:true});window.addEventListener('atlas:route',foldTeams);foldTeams();
})();
(() => {
 const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 $('.atlas-drawer>div:last-child button[data-atlas-action="edit"]')?.parentElement.remove();
 const close=$('.atlas-drawer-header [data-atlas-action="close"]'),edit=document.createElement('button');edit.id='atlasEditPokemon';edit.dataset.atlasAction='edit';edit.textContent='Upravit tohoto Pokémona';edit.className='atlas-mini-btn';close.before(edit);
 {const smaz=document.createElement('button');smaz.id='atlasSmazatPokemona';smaz.dataset.atlasAction='smazat';
  smaz.textContent='Odstranit';smaz.className='atlas-mini-btn atlas-smazat-btn';smaz.title='Odstranit tenhle kus z rosteru';close.before(smaz);}
 const dialog=$('#atlasImportDialog'),box=$('#importBox');let approved=false;
 window.AtlasReplaceApproved=()=>{const result=approved;approved=false;return result};
 window.AtlasAskReplace=()=>{if(dialog.querySelector('.atlas-replace-confirm'))return;const panel=document.createElement('section');panel.className='atlas-replace-confirm';panel.innerHTML='<h3>Nahradit současný roster?</h3><p>Roster bude nahrazen vybraným skenem podle nastavených voleb ochrany vzácných kusů. Předchozí stav zůstane v historii aplikace.</p><div class="atlas-result-actions"><button data-confirm-replace>Nahradit roster</button><button data-cancel-replace>Zpět k importu</button></div>';box.before(panel);box.hidden=true;panel.querySelector('[data-cancel-replace]').onclick=()=>{panel.remove();box.hidden=false};panel.querySelector('[data-confirm-replace]').onclick=()=>{panel.remove();box.hidden=false;approved=true;$('#mapReplaceBtn').click()};panel.querySelector('[data-cancel-replace]').focus()};
 window.AtlasImportDone=(data,message)=>{
  window.__atlasLastImport=data;box.classList.add('open');box.hidden=true;dialog.classList.add('atlas-import-complete');if(!dialog.open)dialog.showModal();
  $('#atlasImportTitle').textContent='Import dokončen';dialog.querySelector('header p').textContent='Změny jsou uložené. Rozbal kategorii a zkontroluj konkrétní kusy.';
  const m=data.merge,a=m?.atlasAudit||{},result=document.createElement('section');result.className='atlas-import-result';
  const groups=m?[['Aktualizované',a.updated||[]],['Nově přidané',a.added||[]],['Vylepšené',a.powered||[]],['Vyvinuté',a.evolved||[]],['Sken je nezachytil',(m.mimoSken||[]).map(after=>({after}))],['Odebrané',(data.removed||[]).map(after=>({after}))]]:[['Načtené ze souboru',data.imported.map(after=>({after}))],['Zachované vzácné kusy',data.retained.map(after=>({after}))]];
  result.innerHTML='<div class="atlas-import-stats">'+(m?[['Aktualizováno',m.updated],['Nových',m.added],['Vylepšených',m.poweredUp],['Vyvinutých',m.evolved]]:[['Načteno',data.imported.length],['Zachováno',data.retained.length]]).map(([label,n])=>'<div><strong>'+n+'</strong><span>'+label+'</span></div>').join('')+'</div><p class="atlas-result-note">Vylepšené a vyvinuté kusy jsou součástí aktualizovaných. Nezachycené kusy se samy nemažou; rozhoduje volba celého boxu.</p>'+groups.map(([label,items])=>'<details class="atlas-import-group"><summary>'+esc(label)+'<span>'+items.length+'</span></summary>'+(items.length?'<div class="atlas-import-tiles">'+items.map(({before,after:r})=>'<div class="atlas-import-tile">'+(window.AtlasMonImage?window.AtlasMonImage(r):'')+'<div class="atlas-import-tile-txt"><strong>'+esc(r.pokemon)+'</strong><span>'+(before&&before.pokemon!==r.pokemon?esc(before.pokemon)+' → '+esc(r.pokemon)+' · ':'')+(before&&String(before.cp||'')!==String(r.cp||'')?esc(String(before.cp||'?'))+' → ':'')+esc(String(r.cp||'?'))+' CP'+(r.level?' · L'+esc(String(r.level)):'')+'</span></div></div>').join('')+'</div>':'<p>Žádný kus v této kategorii.</p>')+'</details>').join('')+'<details class="atlas-import-group"><summary>Podrobné hlášení importu</summary><p class="atlas-import-message">'+esc(message)+'</p></details><div class="atlas-result-actions"><button data-result-done>Přejít do rosteru</button></div>';
  dialog.querySelectorAll('.atlas-import-result').forEach(e=>e.remove());dialog.append(result);result.querySelector('[data-result-done]').onclick=()=>{dialog.close();__atlasTest.go('roster')};dialog.scrollTop=0;dialog.querySelector('header button').focus({preventScroll:true});
 };
 dialog.addEventListener('close',()=>{dialog.querySelector('.atlas-import-result')?.remove();dialog.querySelector('.atlas-replace-confirm')?.remove();box.hidden=false;dialog.classList.remove('atlas-import-complete');$('#atlasImportTitle').textContent='Import rosteru';dialog.querySelector('header p').textContent='Vyber soubor, zkontroluj náhled a rozhodni, jak data přidat.'});
})();
(() => {
 const $=s=>document.querySelector(s),P=window.__pgo,old=window.AtlasEnhanceDetail;
 window.AtlasEnhanceDetail=(container,row,c)=>{
  old(container,row,c);const vPlachte=!!container.closest('#atlasModal');
  // Obrázky sousedních kusů se přednačtou — při rychlém listování se pak
  // kreslí hned, ne až po stažení.
  try{
    const vsechny=P.getRows(),i=vsechny.findIndex(x=>x.id===row.id);
    [i-1,i+1,i+2].forEach(j=>{const r2=vsechny[j];if(!r2)return;
      const html=P.atlasObrazek?P.atlasObrazek(r2):'';const m=/src="([^"]+)"/.exec(html||'');
      if(m){const im=new Image();im.decoding='async';im.src=m[1]}});
  }catch(e){}
  // Obrázek v hlavičce kreslí vrstva sama, takže se o vystředění v rámečku
  // musí říct — jinak sedí ikona nakřivo (u Machopa dole, u Abry nahoře).
  try{const hl=document.querySelector(vPlachte?'.atlas-drawer .atlas-detail-identity':'#boxMode .atlas-detail-identity');if(hl&&P.vystreditSprity)P.vystreditSprity(hl)}catch(e){}if(vPlachte)$('.atlas-drawer-header .hra-pruh')?.remove();const bar=container.querySelector('.hra-pruh');
  // V čištění boxu patří lišta „ve hře jsem s ním něco udělal" nahoru k postupu.
  if(bar&&!vPlachte&&window.innerWidth>650){const rozbor=document.querySelector('#boxMode .atlas-box-rozbor');if(rozbor){document.querySelectorAll('#boxMode .bm-top .hra-pruh,#boxMode .atlas-box-rozbor>.hra-pruh').forEach(e=>e.remove());bar.classList.add('atlas-hra-nad-evoluci');rozbor.append(bar)}}
  if(bar&&vPlachte){bar.setAttribute('aria-label','Zapsat změnu ve hře');bar.querySelectorAll('[aria-pressed]').forEach(b=>b.removeAttribute('aria-pressed'));const editBtn=$('#atlasEditPokemon');if(editBtn)editBtn.before(bar);else $('.atlas-drawer-header').append(bar)}
  // Souhrn keepSub vedle verdiktu už nepřidávat: verdikt v detailu má štítky důvodů a text je zdvojoval.
  // Vysvětlení verdiktu (d-why) opakuje bubliny štítků — když štítky jsou, přesune se do bubliny nadpisu verdiktu.
  // IV procento je nahoře u hodnot IV — poznámka pod pruhy pryč; ve stropu jen CP, level a pořadí kopie (proč je v bublině).
  container.querySelectorAll('[data-detail-section=stats] .d-box').forEach(box=>{const h=(box.querySelector('.d-box-h')||{}).textContent||'';if(/^IV/.test(h))box.querySelectorAll('.d-note').forEach(n=>n.remove());if(/^Strop/.test(h))box.querySelectorAll('.d-proc').forEach(n=>{const note=n.parentElement;if(n.textContent.trim())note.setAttribute('data-tip',n.textContent.trim());if(n.previousElementSibling&&n.previousElementSibling.tagName==='BR')n.previousElementSibling.remove();n.remove()})});
  // Typové pokrytí: „Výhoda" jako typy vpravo na řádku značek. V sekci dole
  // zůstane jen to, co se vyruší — zbytek se dal odvodit a jen zabíral místo.
  const pokryti=container.querySelector('.d-pokryti'),titulek=container.querySelector('.detail-title');
  if(pokryti&&titulek){
    const typy=[];
    pokryti.querySelectorAll('.d-pokryti-radek:not(.d-pokryti-pozor)').forEach(r=>{r.querySelectorAll('.pk-typ').forEach(t=>{if(!typy.some(x=>x.textContent===t.textContent))typy.push(t)});r.remove()});
    titulek.querySelector('.atlas-vyhoda')?.remove();
    titulek.querySelector('.atlas-vyhoda-vic')?.remove();
    if(typy.length){const obal=document.createElement('span');obal.className='atlas-vyhoda';obal.setAttribute('data-tip','Proti těmto typům je jeho útok silný. Dvojtyp s jedním z nich schytá 1,6×, se dvěma z nich 2,56× — kde to druhý typ vyruší, je v Typovém pokrytí.');obal.innerHTML='<small>silný proti</small>';typy.forEach(t=>obal.append(t));titulek.append(obal);
      // Značky a „silný proti" musí zůstat na jednom řádku. Když se přestanou
      // vejít, schová se tolik typů, kolik je potřeba, a přibude „+N".
      const vejdeSe=()=>{const prvni=titulek.querySelector('.d-type,.rarity-chip');
        return !prvni||Math.abs(obal.getBoundingClientRect().top-prvni.getBoundingClientRect().top)<8};
      const srovnat=()=>{
        const vsechny=[...obal.querySelectorAll('.pk-typ')];
        vsechny.forEach(t=>{t.hidden=false});
        obal.querySelector('.atlas-vyhoda-vic')?.remove();
        if(vejdeSe())return;
        const vic=document.createElement('em');vic.className='atlas-vyhoda-vic';obal.append(vic);
        let schovano=0;
        const popis=obal.querySelector('small');
        if(popis)popis.hidden=false;
        for(let i=vsechny.length-1;i>=0;i--){
          vsechny[i].hidden=true;schovano++;
          vic.textContent='+'+schovano;
          vic.title=vsechny.filter(t=>t.hidden).map(t=>t.textContent.trim()).join(', ');
          if(vejdeSe())break;
        }
        // Pořád se to nevejde? Jde stranou i popisek „silný proti" — na jeden
        // řádek se to vejít MUSÍ, dvouřádkový titulek posouvá celý detail.
        if(!vejdeSe()&&popis){popis.hidden=true;vic.title='silný proti: '+vic.title}
      };
      requestAnimationFrame(srovnat);
      if(window.ResizeObserver){const ro=new ResizeObserver(()=>{if(obal.isConnected)srovnat();else ro.disconnect()});ro.observe(titulek)}
    }
    pokryti.closest('details')?.remove();
  }
  const hostitel=container.closest('#atlasModal, .atlas-box-rozbor')||document;
  const identita=hostitel.querySelector('.atlas-detail-identity');
  // Útoky a nejlepší sestava taky do hlavičky — pod sebou vedle jména, ať se
  // kvůli nim nemusí rolovat dolů. Věty (stav útoků, procento movesetu,
  // „evolucí se útoky losují znovu") jsou v bublinách.
  const utokySekce=container.querySelector('[data-detail-section=utoky]'),sestavySekce=container.querySelector('[data-detail-section=sestavy]');
  let utokyBox=null;
  if(utokySekce&&identita){
    identita.querySelector('.atlas-ident-utoky')?.remove();
    const box=document.createElement('section');box.className='atlas-ident-utoky';
    const nadpis=document.createElement('div');nadpis.className='d-box-h';nadpis.textContent='Útoky';
    // Kus bez vyplněných útoků: u nadpisu se rozsvítí vykřičník. Bez něj se
    // dalo snadno přehlédnout, že appka u toho kusu nic nezná — a rady se
    // pak počítaly z nejlepší možné sestavy, ne z jeho skutečné.
    if(!row.fastMove||!row.charged1){
      const vykricnik=document.createElement('span');vykricnik.className='atlas-utoky-chybi';
      vykricnik.textContent='!';
      vykricnik.title='Útoky nemáš vyplněné — appka počítá z nejlepší možné sestavy druhu.'
        +' Doplň je v úpravě kusu nebo naskenuj Calcy.';
      nadpis.append(vykricnik);
    }
    box.append(nadpis);
    const stav=utokySekce.querySelector('.atlas-move-status'),moves=utokySekce.querySelector('.d-moves');
    const cisteJmeno=s=>String(s).replace(/\s*\(Elite TM\)\s*/i,'').trim();
    const chipUtoku=(jmeno,rychly)=>{const cist=cisteJmeno(jmeno);const m=rychly?(P.fastByNameOf?P.fastByNameOf(cist):null):(P.chargedByNameOf?P.chargedByNameOf(cist):null);
      const el=document.createElement('span');el.className='d-move';
      const typ=document.createElement('span');typ.className='d-type';
      if(m){const barva=(P.typeColors()||{})[m.type];if(barva)typ.style.background=barva;typ.innerHTML=(P.typIkona?P.typIkona(m.type):'')+m.type}else typ.textContent='?';
      const jm=document.createElement('span');jm.className='d-move-jm';jm.textContent=jmeno;
      el.append(typ,jm);return el};
    // Jeden řádek = popisek („má" / „teď" / „po evo") a pod ním jednotlivé
    // útoky pod sebou. Dvojice vedle sebe se do sloupce nevešla a ustřihávala
    // se; takhle je popisek i začátek útoků vždycky na stejné svislici.
    const uz=new Set();
    const pridej=(kdy,jmena,tip)=>{
      const cista=jmena.map(cisteJmeno).filter(Boolean);
      if(!cista.length)return;
      const klic=cista.join(' + ').toLowerCase();
      if(uz.has(klic))return;
      uz.add(klic);
      const radek=document.createElement('div');radek.className='atlas-sestava';radek.dataset.sestava=klic;
      if(tip)radek.setAttribute('data-tip',tip);
      const popisek=document.createElement('small');popisek.className='atlas-sestava-kdy';popisek.textContent=kdy;radek.append(popisek);
      const sloupec=document.createElement('div');sloupec.className='atlas-sestava-utoky';
      const sTeckou=kdy==='má';
      jmena.forEach((jm,i)=>{const radek=document.createElement('div');radek.className='atlas-utok-radek';
        if(!sTeckou){const mezera=document.createElement('i');mezera.className='atlas-utok-tecka atlas-utok-mezera';radek.append(mezera)}
        if(sTeckou){const tecka=document.createElement('i');tecka.className='atlas-utok-tecka';
          const stav=stavUtoku(String(jm).trim());tecka.dataset.stav=stav;
          tecka.title={nej:'Nejlepší útok, jaký tenhle druh má.',dobry:'Použitelný, ale nejlepší to není.',preucit:'Slabý útok — stojí za přeučení.',nezna:'Kvalita útoku se nedá posoudit.'}[stav]||'';
          radek.append(tecka)}
        radek.append(chipUtoku(String(jm).trim(),i===0));
        if(sTeckou&&doporucene&&doporucene.length){
          const stav=stavUtoku(String(jm).trim());
          const cist=cisteJmeno(String(jm)).trim().toLowerCase();
          // Rychlý útok se mění za rychlý, nabitý za nabitý.
          const nabidka=i===0?doporucene.slice(0,1):doporucene.slice(1);
          const lepsi=nabidka.find(x=>x&&x.toLowerCase()!==cist&&!jmena.some(y=>cisteJmeno(String(y)).trim().toLowerCase()===x.toLowerCase()));
          if(stav!=='nej'&&lepsi){
            const sip=document.createElement('em');sip.className='atlas-utok-lepsi';
            sip.textContent='→ '+lepsi;
            const proc=duvody.get(cist)||'';
            sip.title=(proc?proc+' ':'')+'Lepší volba: '+lepsi+' — přeučení stojí TM.';
            radek.append(sip);
          }
        }
        sloupec.append(radek)});
      radek.append(sloupec);box.append(radek);
    };
    // Mapa „jméno útoku → jak je dobrý" z útoků, které engine vypsal v detailu.
    const stavy=new Map(),duvody=new Map();
    // Hodnocení i důvod má engine přímo v datech kusu — spolehlivější než
    // číst je ze značek, které si vrstva vzápětí přestavuje.
    if(c&&Array.isArray(c.utoky))c.utoky.forEach(u=>{
      const k=cisteJmeno(u.jm||'').toLowerCase();
      if(!k)return;
      if(u.stav&&!stavy.has(k))stavy.set(k,u.stav);
      if(u.proc&&!duvody.has(k))duvody.set(k,u.proc);
    });
    // Bere se jen skutečné hodnocení útoku (engine značí čtyřmi stavy).
    // Dřív sem propadaly i jiné třídy (`d-move-poEvoluci`) a z tečky byl šedý
    // puntík bez významu. První nález vyhrává — ten patří kusu, ne jeho evoluci.
    const ZNAME=['nej','dobry','preucit','nezna'];
    (moves?moves.querySelectorAll('.d-move'):[]).forEach(el=>{
      const jm=(el.querySelector('.d-move-jm')||{}).textContent||'';
      if(!jm)return;
      const klic=cisteJmeno(jm).toLowerCase();
      if(stavy.has(klic))return;
      const tr=[...el.classList].map(c=>c.replace('d-move-','')).find(c=>ZNAME.indexOf(c)!==-1);
      if(tr)stavy.set(klic,tr);
      const proc=el.getAttribute('title')||'';
      if(proc&&!duvody.has(klic))duvody.set(klic,proc);
    });
    const stavUtoku=jm=>stavy.get(cisteJmeno(jm).toLowerCase())||'nej';
    // Nejlepší sestava pro TEĎEJŠÍ formu — z ní se bere, na co přeučit.
    let doporucene=null;
    if(sestavySekce){
      const prvni=[...sestavySekce.querySelectorAll('.d-sestavy > div')]
        .find(d=>!/^Po evoluci/.test(((d.querySelector('.d-role-h')||{}).textContent||'')));
      const v=prvni?((prvni.querySelector('.d-role-v')||{}).textContent||''):'';
      if(v)doporucene=v.split(' + ').map(x=>cisteJmeno(x).trim()).filter(Boolean);
    }
    // Kus bez ligové role žádnou „nejlepší sestavu" v detailu nemá —
    // engine ji ale zná jako `movesBest` (sestava druhu, kterým je teď).
    if((!doporucene||!doporucene.length)&&c&&c.movesBest){
      doporucene=String(c.movesBest).replace(/\s*\(Elite TM\)/ig,'').split(/\s*\+\s*/)
        .map(x=>cisteJmeno(x).trim()).filter(Boolean);
    }
    const why=moves?moves.querySelector('.d-why'):null;
    const veta=[stav?stav.textContent.trim():'',why?why.textContent.trim():''].filter(Boolean).join(' ');
    if(why)why.remove();
    // Nejdřív co kus doopravdy má, pak co by mít měl.
    if(row.fastMove&&row.charged1)pridej('má',[row.fastMove,row.charged1,row.charged2].filter(Boolean),'Útoky, které kus má ve hře.');
    // Po očištění se Frustration mění na Return — jiný útok si shadow kus
    // nechá. Ukazuje se jen u shadow kusů, kterých se to týká.
    if(row.forma==='Shadow'&&row.fastMove&&row.charged1){
      const po=[row.fastMove,row.charged1,row.charged2].filter(Boolean)
        .map(x=>/frustration/i.test(String(x))?'Return':x);
      if(po.some((x,i)=>x!==[row.fastMove,row.charged1,row.charged2].filter(Boolean)[i]))
        pridej('po očištění',po,'Co bude mít po očištění: Frustration se mění na Return (jde přeučit jen očistou nebo během akce Team GO Rocket).');
    }
    if(sestavySekce){
      [...sestavySekce.querySelectorAll('.d-sestavy > div')].forEach(d=>{
        const h=(d.querySelector('.d-role-h')||{}).textContent||'',v=(d.querySelector('.d-role-v')||{}).textContent||'',pop=(d.querySelector('.d-role-p')||{}).textContent||'';
        if(!v)return;
        // U větvené řady (Eevee) „po evo" neřeklo, o kterou formu jde.
        const cil=/^Po evoluci na\s+(.+?)\s*$/.exec(h);
        pridej(/^Po evoluci/.test(h)?(cil?cil[1]:'po evo'):(row.pokemon||'teď'),v.split(' + '),(h?h+' — ':'')+(pop||'Nejlepší sestava.'));
      });
    }
    if(!box.querySelector('.d-move')&&moves){
      // Kus bez útoků a bez ligové sestavy: engine nabízí nejlepší možnou
      // sestavu jedním chipem („Force Palm + Aura Sphere (Elite TM)").
      const text=[...moves.querySelectorAll('.d-move-jm')].map(e=>e.textContent).find(x=>/\s\+\s/.test(x));
      if(text)pridej(row.pokemon||'teď',text.split(' + '),'Nejlepší možná sestava tohohle druhu — útoky kusu zatím nemáš vyplněné.');
      else box.append(moves);
    }
    if(veta)box.setAttribute('data-tip',veta);
    utokyBox=box;
    utokySekce.remove();sestavySekce?.remove();
  }
  // Ligy jsou hlavní tabulka detailu — nesbalují se a jmenují se prostě „Ligy".
  const ligySekce=container.querySelector('[data-detail-section=ligy]');
  if(ligySekce&&ligySekce.tagName==='DETAILS'){
    const sek=document.createElement('section');sek.className=ligySekce.className;sek.dataset.detailSection='ligy';
    const nadpis=document.createElement('div');nadpis.className='atlas-sekce-nadpis';nadpis.textContent='Ligy';sek.append(nadpis);
    [...ligySekce.children].forEach(ch=>{if(ch.tagName!=='SUMMARY')sek.append(ch)});
    ligySekce.replaceWith(sek);
  }
  // Herní využití bez rámečku sekce — jen čtyři bubliny, text zarovnaný nahoru.
  const nacoSekce=container.querySelector('[data-detail-section=naco]');
  if(nacoSekce){const role=nacoSekce.querySelector('.d-roles');if(role){role.classList.add('atlas-vyuziti');nacoSekce.before(role)}nacoSekce.remove()}
  // Statistiky, IV a strop CP do hlavičky vedle jména a obrázku; sekce dole odpadá.
  const statsSekce=container.querySelector('[data-detail-section=stats]');if(statsSekce&&identita){identita.querySelector('.atlas-ident-stats')?.remove();const mrizka=statsSekce.querySelector('.d-grid');if(mrizka){mrizka.classList.add('atlas-ident-stats');mrizka.querySelectorAll('.d-box-h').forEach(h=>{if(/^IV/.test(h.textContent))h.textContent='IV';else{const m=/^Staty na levelu\s+([\d.]+)/i.exec(h.textContent);if(m)h.textContent='Staty L'+m[1]}});identita.append(mrizka)}statsSekce.remove()}
  if(utokyBox&&identita)identita.append(utokyBox);
  if(vPlachte)document.querySelectorAll('.atlas-detail-paging [data-detail-step]').forEach(b=>{b.title=b.dataset.detailStep==='1'?'Další kus (→ nebo D)':'Předchozí kus (← nebo A)'});
  // Doporučený krok vedle verdiktu místo vlastní sekce dole.
  // Štítky důvodů drží jeden řádek: co se nevejde, schová engine pod „+N"
  // (stejná mechanika jako v dlaždicích rosteru).
  container.querySelectorAll('.atlas-verdict-first .d-duvody,.d-verdict .d-duvody')
    .forEach(el=>{el.dataset.radku='1'});
  if(P.srovnejDuvody)requestAnimationFrame(()=>P.srovnejDuvody(container));
  const verd=container.querySelector('.atlas-verdict-first'),coted=container.querySelector('[data-detail-section=coted]');if(verd){const radek=document.createElement('div');radek.className='atlas-verdict-radek';verd.before(radek);radek.append(verd);const akce=coted&&coted.querySelector('.d-roles-akce');if(akce){const krok=document.createElement('section');krok.className='atlas-krok';krok.setAttribute('aria-label','Doporučený krok');krok.append(akce);radek.append(krok)}}coted?.remove();
  const why=container.querySelector('.atlas-verdict-first .d-why');if(why){const hlava=container.querySelector('.atlas-verdict-first .d-verdict>b');if(hlava&&why.textContent.trim())hlava.setAttribute('data-tip',why.textContent.trim());why.remove();}
 };
 // Šipky ←/→ a písmena A/D listují otevřeným detailem. Ne při psaní do pole a ne, když je nad detailem jiný dialog.
 document.addEventListener('keydown',e=>{const m=$('#atlasModal');if(!m||m.hidden||e.altKey||e.ctrlKey||e.metaKey)return;const t=e.target;if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))return;if(['hraBox','rucniBox','doplnitBox'].some(x=>{const d=document.getElementById(x);return d&&!d.hidden}))return;if(document.getElementById('atlasRowEditor'))return;const k=e.key.length===1?e.key.toLowerCase():e.key;const step=k==='ArrowRight'||k==='d'?1:(k==='ArrowLeft'||k==='a'?-1:0);if(!step)return;const b=document.querySelector('.atlas-detail-paging [data-detail-step="'+step+'"]');if(b&&!b.disabled){e.preventDefault();b.click()}});
 // Čištění boxu ukazuje přesně ten samý rozbor jako detail kusu. Engine si
 // do panelu kreslí svoje zjednodušené bloky (jméno, verdikt, věta, role,
 // ligy) — ty se schovají a místo nich se vloží hlavička + rozbor z enginu.
 let boxPrestavba=false;
 let boxEvoKlic=null,boxEvoUzel=null;
 function boxPrepocetPruh(){
   // Hlášky panelu (přepočet, vrácení, vypadlí) stojí nad tlačítky mimo tok,
   // takže se kvůli nim nikdy nehne rozbor ani evoluční řada.
   const akce=document.getElementById('bmActions');if(!akce)return null;
   let stoh=akce.querySelector('.atlas-box-hlasky');
   if(!stoh){
     stoh=document.createElement('div');stoh.className='atlas-box-hlasky';
     akce.insertBefore(stoh,akce.firstChild);
     ['bmVypadli','bmVraceni'].forEach(id=>{const e=document.getElementById(id);if(e)stoh.append(e)});
   }
   let pruh=stoh.querySelector('.atlas-box-prepocet');
   if(!pruh){pruh=document.createElement('div');pruh.className='atlas-box-prepocet';stoh.insertBefore(pruh,stoh.firstChild)}
   return pruh;
 }
 function boxRozbor(){
   const body=$('#bmBody');if(!body||boxPrestavba)return;
   const stav=P.boxStav?P.boxStav():null,seznam=P.bmSeznam?P.bmSeznam():[];
   const polozka=stav&&stav.index<seznam.length?seznam[stav.index]:null;
   boxPrestavba=true;
   try{
     body.querySelector('.atlas-box-rozbor')?.remove();
     if(!polozka)return;
     const host=document.createElement('div');host.className='atlas-box-rozbor';
     host.innerHTML=window.AtlasIdentitaHTML(polozka.row,false);
     const obsah=document.createElement('div');obsah.className='atlas-box-obsah';host.append(obsah);
     body.append(host);
     P.atlasDetail(polozka.row.id,obsah);
     // Ve verdiktu je místo na dva řádky štítků — schovávat je do „+N" bylo
    // zbytečné a první řádek se navíc posouval nahoru.
    host.querySelectorAll('.atlas-verdict-first .dv-radek,.d-verdict .dv-radek').forEach(r2=>r2.setAttribute('data-radku','2'));
    if(P.srovnejDuvody)requestAnimationFrame(()=>P.srovnejDuvody(host));
     // Evoluční řada je v boxu vlastní sloupec panelu — vedle hlavičky
     // i obsahu, aby mohla být velká a šla odshora až dolů.
     // Obrázky v evoluční řadě při přechodu mezi kusy problikávaly: nové
     // <img> se načítá znovu. Když je řada úplně stejná (dva kusy téhož
     // druhu), použije se znovu původní uzel s už načtenými obrázky.
     const evo=obsah.querySelector('.atlas-evolution-column');
     if(evo){const klic=[...evo.querySelectorAll('.d-evo-kus')]
       .map(k=>(k.getAttribute('data-druh')||'')+(k.classList.contains('tady')?'*':'')).join('>');
       if(boxEvoKlic===klic&&boxEvoUzel){evo.remove();host.append(boxEvoUzel)}
       else{boxEvoKlic=klic;boxEvoUzel=evo;host.append(evo)}}
     // Místo pro dva typy je vždycky stejné, jinak značky poskakují podle toho,
     // jestli má kus jeden typ nebo dva.
     // Hláška o přepočtu seděla nahoře v obsahu a posunula všechno pod sebou.
     // Patří nad tlačítka, kde je na ni vyhrazené místo pořád stejně velké.
     const pruh=boxPrepocetPruh();
     if(pruh){const zprava=document.querySelector('#bmBody .bm-prepocet');pruh.innerHTML='';if(zprava)pruh.append(zprava)}
     const titulek=obsah.querySelector('.detail-title');
     if(titulek){const typy=[...titulek.querySelectorAll('.d-type')];for(let i=typy.length;i<2;i++){const mezera=document.createElement('span');mezera.className='d-type atlas-typ-mezera';mezera.setAttribute('aria-hidden','true');mezera.textContent='—';const posledni=titulek.querySelectorAll('.d-type');if(posledni.length)posledni[posledni.length-1].after(mezera);else titulek.prepend(mezera)}}
   }finally{boxPrestavba=false}
 }
 const bmBody=$('#bmBody');
 if(bmBody){
   // Vlastní vložený rozbor observer ignoruje — jinak by se přestavoval pořád dokola.
   new MutationObserver(zaznamy=>{
     const jenNase=zaznamy.every(z=>[...z.addedNodes,...z.removedNodes].every(n=>n.nodeType===1&&n.classList&&n.classList.contains('atlas-box-rozbor')));
     if(!jenNase&&!boxPrestavba)boxRozbor();
   }).observe(bmBody,{childList:true});
   window.addEventListener('atlas:refresh-detail',()=>{if(!document.getElementById('boxMode')?.hidden)boxRozbor()});
 }
 // Dokud je čištění boxu otevřené, stránka pod ním se nesmí rolovat —
 // vpravo svítil posuvník celé stránky.
 const boxPrepinac=document.getElementById('boxMode');
 if(boxPrepinac){
   const zamek=()=>{const otevreno=!boxPrepinac.hidden&&getComputedStyle(boxPrepinac).display!=='none';document.body.classList.toggle('atlas-box-otevreno',otevreno)};
   new MutationObserver(zamek).observe(boxPrepinac,{attributes:true,attributeFilter:['hidden','style','class']});
   zamek();
 }
 window.AtlasFocusRow=id=>{if(!P.getRows().some(r=>r.id===id))return false;__atlasTest.go('roster');__atlasTest.refresh();__atlasTest.openDetail(id);return true};
 const bulk=$('#doplnitBtn');if(bulk)$('.atlas-roster-commandbar').insertBefore(bulk,$('.atlas-roster-commands'));
 for(const id of ['hraBox','rucniBox','doplnitBox']){
  const box=$('#'+id);if(!box)continue;document.body.append(box);box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label',({hraBox:'Zapsat změnu ve hře',rucniBox:'Přidat Pokémona',doplnitBox:'Doplnit útoky'})[id]);let previous=null;
  let previousRow=null;
  box.addEventListener('keydown',e=>{if(e.key!=='Escape'||document.querySelector('.uv-seznam:not([hidden]),.druh-napoveda:not([hidden])'))return;e.preventDefault();e.stopImmediatePropagation();if(id==='hraBox')P.hraZavri();else $('#'+(id==='rucniBox'?'rbCancel':'duZavrit')).click()},true);
  new MutationObserver(()=>{if(!box.hidden){previous=document.activeElement;previousRow=__atlasTest.getState().dialogId;document.body.style.overflow='hidden';requestAnimationFrame(()=>box.querySelector('input:not(:disabled):not([type=hidden]),select:not(:disabled),button:not(:disabled)')?.focus({preventScroll:true}))}else{document.body.style.overflow=$('#atlasModal').hidden?'':'hidden';if(previousRow!==__atlasTest.getState().dialogId&&!$('#atlasModal').hidden)$('#atlasEditPokemon')?.focus({preventScroll:true});else if(previous?.isConnected)previous.focus({preventScroll:true})}}).observe(box,{attributes:true,attributeFilter:['hidden']});
  box.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const items=[...box.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea')].filter(el=>el.getClientRects().length);if(!items.length)return;if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus()}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus()}});
 }
})();

/* Overview: dated event data, never live spawn or readiness claims. */
(() => {
 const P=window.__pgo,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const day=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 const date=s=>{if(!s)return null;const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(s)?s+'T00:00':s);return Number.isNaN(+d)?null:d};
 const end=s=>{const d=date(s);if(d&&/^\d{4}-\d{2}-\d{2}$/.test(s))d.setDate(d.getDate()+1);return d};
 const format=s=>{const d=date(s);return d?d.toLocaleString('cs-CZ',{day:'numeric',month:'numeric',...(/T/.test(s)?{hour:'2-digit',minute:'2-digit'}:{})}):'Termín nepotvrzen'};
 const safeUrl=s=>{try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}};
 const image=name=>{const key=P.dexKeyOf(name),src=window.ATLAS_ART?.[key];return src?`<img src="${esc(src)}" alt="${esc(name)}" loading="lazy">`:P.atlasImage(name)};
 const sections={spawn:'Ve volné přírodě',raid:'Souboje',vejce:'Z vajec',vyzkum:'Výzkumy a odměny',bonus:'Bonusy',utoky:'Speciální útoky',shiny:'Shiny',novinky:'Další obsah akce'};
 let selected=day(new Date()),lastToday=selected,offset=0,events=[],root;
 const modal=document.createElement('dialog');modal.id='atlasEventDialog';modal.className='atlas-event-dialog';modal.setAttribute('aria-labelledby','atlasEventTitle');document.body.append(modal);
 function overlap(e,start,finish){const a=date(e[3]),b=end(e[4]);return !!(a&&b&&a<finish&&b>start)}
 function live(e){return overlap(e,new Date(),new Date(Date.now()+1))}
 function eventNames(e){return [...new Set((e[7]||[]).flatMap(w=>((w[2]?.raid?.length?w[2].raid:w[2]?.spawn)||[]).filter(x=>x[1]!==-1).map(x=>x[0])).concat((e[6]||[]).filter(x=>x[1]!==-1).map(x=>x[0])))].slice(0,3)}
 function bossCards(es){return es.flatMap(e=>{const names=eventNames(e);return (names.length?names:[null]).map(name=>`<button class="atlas-boss" data-event-index="${events.indexOf(e)}"><span class="atlas-boss-art">${name?image(name):'<span aria-hidden="true">◇</span>'}</span><b>${esc(name&&/^Shadow /.test(e[0])&&!/^Shadow /.test(name)?'Shadow '+name:name||e[0])}</b><small>${/^max-/.test(e[1])?'Max souboj':'Raid'} · ${format(e[4])}</small></button>`)}).join('')}
 function card(e){
 const a=date(e[3]),b=end(e[4]),now=new Date(),tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1),afterTomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+2);
 const label=!a||!b?'Termín nepotvrzen':b<=now?'Ukončeno':a>now?(a>=tomorrow&&a<afterTomorrow?'Zítra':'Chystá se'):(b<=tomorrow?'Končí dnes':'Probíhá');
 const kind=/^max-/.test(e[1])?'max':/raid/.test(e[1])?'raid':/research/.test(e[1])?'research':'event';
 const names=eventNames(e);
 const title=String(e[0]).replace(/ during Max Monday$/i,'').replace(/ in (?:5-star Raid Battles|Mega Raids|Shadow Raids)$/i,'').replace(/: The Series Celebration Event 2026$/i,'').replace(/Pokémon Horizons Bonus Timed Research/i,'Pokémon Horizons: bonusový výzkum');
 return `<button class="atlas-event-card" data-event-kind="${kind}" data-event-state="${b&&b<=tomorrow?'ending':a&&a>now?'upcoming':'live'}" data-event-index="${events.indexOf(e)}" title="${esc(e[0])}"><span class="atlas-event-visual"><span class="atlas-event-status">${label}</span><span class="atlas-event-art">${names.map(image).join('')}</span></span><span class="atlas-event-copy"><span class="atlas-event-category">${{max:'Max souboje',raid:'Raidy',research:'Výzkum',event:'Událost'}[kind]}</span><h3>${esc(title)}</h3><span class="atlas-event-date">${format(e[3])} → ${format(e[4])}</span><span class="atlas-event-link">Prohlédnout akci <span aria-hidden="true">→</span></span></span></button>`;
 }
 function list(items,kind){return `<div class="atlas-event-species">${items.map(([name,shiny])=>shiny===-1?`<h4>${esc(name)}</h4>`:`<div class="atlas-event-specimen">${['spawn','raid','vejce','shiny'].includes(kind)?image(name):''}<span>${esc(name)}${shiny===1?' <small>✦ shiny dostupné</small>':''}</span></div>`).join('')}</div>`}
 function openEvent(i){const e=events[i];if(!e)return;const url=safeUrl(e[5]);modal.innerHTML=`<header><div><span class="atlas-eyebrow">TAHÁK AKCE</span><h2 id="atlasEventTitle">${esc(e[0])}</h2><p>${format(e[3])} — ${format(e[4])}</p></div><button class="atlas-mini-btn" data-event-close aria-label="Zavřít detail akce">✕</button></header><div class="atlas-event-body">${(e[7]||[]).map(w=>`<section class="atlas-event-window"><p class="atlas-small-note">Platnost této části: ${format(w[0])} — ${format(w[1])}</p>${Object.entries(w[2]||{}).filter(([k,v])=>Array.isArray(v)&&v.length).map(([k,v])=>`<details open><summary>${esc(sections[k]||k)}</summary>${list(v,k)}</details>`).join('')}</section>`).join('')||'<p>Podrobný obsah není ve zdroji k dispozici.</p>'}<p class="atlas-small-note">Seznam popisuje obsah akce, nikoli živé spawny v okolí. Dostupné shiny neznamená zvýšenou šanci. Podmínky a zvláštní časová okna ověř ve zdroji.</p><div class="atlas-event-actions"><button class="atlas-mini-btn" data-event-teams>Otevřít Tahák soubojů</button>${url?`<a class="atlas-mini-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Zdroj akce ↗</a>`:''}</div></div>`;modal.showModal();}
 modal.addEventListener('click',e=>{if(e.target.closest('[data-event-close]'))modal.close();if(e.target.closest('[data-event-teams]')){modal.close();__atlasTest.go('teams','cheatCard')}});
 // Keep Escape in the native modal; it must not reach the underlying Pokémon drawer.
 modal.addEventListener('keydown',e=>e.stopPropagation());
 function render(target){const today=day(new Date());if(lastToday!==today&&offset===0&&selected===lastToday)selected=today;lastToday=today;root=target;const data=P.eventsData()||{};events=data.events||[];const now=new Date(),start=date(selected),finish=new Date(start);finish.setDate(finish.getDate()+1);
 const horizon=new Date(finish);if(selected===today)horizon.setDate(horizon.getDate()+7);
 const shown=events.filter(e=>overlap(e,start,horizon)&&!['season','raid-battles'].includes(e[1])).sort((a,b)=>(+end(a[4])<Date.now())-(+end(b[4])<Date.now())||+end(a[4])-+end(b[4])||String(a[0]).localeCompare(b[0]));
 const raids=events.filter(e=>live(e)&&e[1]==='raid-battles'),maxLive=events.filter(e=>live(e)&&/^max-/.test(e[1]));
 const max=maxLive.length?maxLive:events.filter(e=>/^max-/.test(e[1])&&date(e[3])>now&&end(e[4])>date(e[3])).sort((a,b)=>+date(a[3])-+date(b[3])).slice(0,1);
 const stamp=data._meta?.stazeno||P.dataInfo?.events,age=date(stamp),stale=!age||now-age>48*60*60*1000;
 const days=Array.from({length:7},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset+i),n=new Date(d);n.setDate(n.getDate()+1);const count=events.filter(e=>!['season','raid-battles'].includes(e[1])&&overlap(e,d,n)).length;return `<button data-overview-day="${day(d)}" aria-pressed="${selected===day(d)}"><span>${d.toLocaleDateString('cs-CZ',{weekday:'short'})}</span><b>${d.getDate()}. ${d.getMonth()+1}.</b><small>${count} ${count>=1&&count<=4?'akce':'akcí'}</small></button>`}).join('');
 const activeWindows=events.filter(live).flatMap(e=>(e[7]||[]).filter(w=>overlap(['','','',w[0],w[1]],now,new Date(+now+1))).map(w=>({e,w})));
 const spawns=activeWindows.filter(x=>x.w[2]?.spawn?.length).slice(0,3);
 const c=P.getComputed(),rows=P.getRows(),seen=new Set();const plans=P.prachovyPlan().filter(p=>{const id=p.row?.id;if(!id||seen.has(id)||c[id]?.validationIssues?.length||c[id]?.jeRezerva||c[id]?.jenZnamka)return false;seen.add(id);return true}).slice(0,3);
 const missing=rows.filter(r=>!r.fastMove||!r.charged1).length;
 root.innerHTML=`<div class="atlas-overview"><div class="atlas-overview-intro"><span class="atlas-feed-note">Data: ${esc(stamp||'datum neznámé')}${stale?' · Aktualitu ověř ve zdroji':''}</span></div><section class="atlas-panel atlas-overview-calendar"><div class="atlas-panel-head"><h2>Dnes a brzy</h2><div><button class="atlas-mini-btn" data-overview-week="-7" aria-label="Předchozí týden">←</button> <button class="atlas-mini-btn" data-overview-today>Dnes</button> <button class="atlas-mini-btn" data-overview-week="7" aria-label="Další týden">→</button></div></div><div class="atlas-event-grid">${shown.slice(0,3).map(card).join('')||'<p class="atlas-empty">Pro tento den nemáme potvrzenou akci.</p>'}</div><div class="atlas-week">${days}</div>${shown.length>3?`<p class="atlas-small-note">${(n=>n===1?'Další 1 akci':n<=4?'Další '+n+' akce':'Dalších '+n+' akcí')(shown.length-3)} najdeš v úplném kalendáři.</p>`:''}<button class="atlas-mini-btn" data-atlas-nav="events">Celý kalendář →</button></section><div class="atlas-battle-columns">${[[raids,'Raidy'],[max,'Max souboje']].map(([es,title])=>`<section class="atlas-panel"><div class="atlas-panel-head"><h2>${title}</h2></div>${title==='Max souboje'&&!maxLive.length&&max.length?'<p class="atlas-small-note">Nejbližší potvrzená akce · pro dnešek nemáme potvrzený seznam bossů.</p>':''}<div class="atlas-boss-grid">${bossCards(es)||'<p class="atlas-empty">V datech není potvrzené aktuální okno. To neznamená, že žádné souboje neběží.</p>'}</div><p class="atlas-small-note">Dostupnost podle termínů akcí${stale?', data mohou být zastaralá':''}. Sestavu ověř v Taháku.</p><button class="atlas-mini-btn" data-overview-teams>Otevřít Tahák →</button></section>`).join('')}</div><section class="atlas-panel atlas-home-spawns"><div class="atlas-panel-head"><h2>Co teď potkáš</h2></div><p class="atlas-small-note">Platí časová a další omezení u jednotlivých skupin. Nejde o živou mapu okolí.</p>${spawns.map(({e,w})=>`<details class="atlas-spawn-preview"><summary>${esc(e[0])}</summary>${list(w[2].spawn,'spawn')}<button class="atlas-mini-btn" data-event-index="${events.indexOf(e)}">Podmínky a další obsah →</button></details>`).join('')||'<p class="atlas-empty">Nemáme potvrzený seznam spawnů pro právě probíhající časové okno.</p>'}</section><section class="atlas-panel atlas-home-plans"><div class="atlas-panel-head"><div><h2>Co připravit jako první</h2><p>První kroky v pořadí enginu. Dostupnost prachu a bonbónů si ověř.</p></div><button class="atlas-mini-btn" data-atlas-nav="invest">Celý plán →</button></div><div class="atlas-plan-preview">${plans.slice(0,2).map(p=>`<button class="atlas-plan-card" data-atlas-detail="${esc(p.row.id)}">${image(p.row.pokemon)}<div><h3>${esc(p.row.pokemon)}</h3><p>${esc(p.role||c[p.row.id]?.keepSub)}</p><b>${p.evoluce?'Evoluce a další krok':'Vylepšení'}${p.cilJmeno?' → '+esc(p.cilJmeno):''}</b><span class="atlas-plan-open">Otevřít Pokémona →</span></div></button>`).join('')||'<p class="atlas-empty">Engine nyní nenabízí ověřený investiční krok.</p>'}</div></section><section class="atlas-panel"><div class="atlas-panel-head"><h2>Před hraním</h2></div><div class="atlas-preflight"><button class="atlas-mini-btn" data-click="boxModeBtn">Projít box</button><button class="atlas-mini-btn" data-atlas-filter="missing">Doplnit útoky · ${missing} kusů</button><button class="atlas-mini-btn" data-atlas-nav="events">Ověřit termíny a bonusy</button></div></section></div>`;
 const spawnPanel=root.querySelector('.atlas-home-spawns'),planPanel=root.querySelector('.atlas-home-plans');if(spawnPanel&&planPanel)planPanel.after(spawnPanel);
 const heading=document.querySelector('#atlasHeading');if(__atlasTest.getState().view==='home'){heading.querySelector('h1').textContent='Co dnes stojí za to';heading.querySelector('p').textContent='Události, souboje a další krok pro tvůj box.'}
 }
 window.AtlasRenderHome=render;
 document.querySelector('#atlasHome').addEventListener('click',e=>{const el=e.target.closest('button');if(!el)return;if(el.hasAttribute('data-event-index'))openEvent(Number(el.dataset.eventIndex));if(el.dataset.overviewDay){selected=el.dataset.overviewDay;render(root);root.querySelector(`[data-overview-day="${selected}"]`)?.focus({preventScroll:true})}if(el.dataset.overviewWeek){offset+=Number(el.dataset.overviewWeek);const d=new Date();d.setDate(d.getDate()+offset);selected=day(d);render(root)}if(el.hasAttribute('data-overview-today')){offset=0;selected=day(new Date());render(root)}if(el.hasAttribute('data-overview-teams'))__atlasTest.go('teams','cheatCard')});
 render(document.querySelector('#atlasHome'));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!modal.open&&__atlasTest.getState().view==='home')render(root)});
 setInterval(()=>{if(!document.hidden&&!modal.open&&__atlasTest.getState().view==='home'&&!root.contains(document.activeElement))render(root)},60000);
})();

// Resize reason chips with the responsive roster tiles, without touching the engine.
(() => {const root=document.querySelector('#atlasRoster');let width=0;new ResizeObserver(entries=>{const next=entries[0].contentRect.width;if(next===width)return;width=next;requestAnimationFrame(()=>window.__pgo.srovnejDuvody(root))}).observe(root)})();

// Keep roster controls still; only the complete tile collection scrolls.
(() => {const list=document.querySelector('#atlasRoster'),panel=list.parentElement,controls=document.createElement('div');controls.className='atlas-roster-fixed-controls';while(panel.firstChild&&panel.firstChild!==list)controls.append(panel.firstChild);panel.insertBefore(controls,list);list.setAttribute('aria-label','Seznam Pokémonů');list.tabIndex=0;
const fit=()=>{if(document.body.dataset.atlasView!=='roster'||!document.body.classList.contains('atlas-compact'))return;const top=panel.getBoundingClientRect().top;panel.style.setProperty('--atlas-roster-height',Math.max(220,innerHeight-top-(innerWidth<=650?80:18))+'px')};window.addEventListener('resize',fit);window.addEventListener('atlas:route',()=>requestAnimationFrame(fit));new MutationObserver(()=>requestAnimationFrame(fit)).observe(document.body,{attributes:true,attributeFilter:['class','data-atlas-view']});fit();})();
