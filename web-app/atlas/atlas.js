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

/* Barvu verdiktu urcuje ENGINE (`keepTone`). Vrstva ji uz nepreklapi kvuli
   znacce Lucky: kus, ktery drzi misto v rozpoctu, je zeleny — role vazi vic
   nez sleva na prach. Zlutou si lucky zaslouzi jen tam, kde ma jit pryc, a
   presne to engine sam nastavuje ("Zahodit – ale je Lucky"). */
window.AtlasVerdict=c=>({
  label:c.validationIssues?.length?'Ověřit data':c.cuteOnly?'CUTE · sbírka':c.keep||'K posouzení',
  tone:c.validationIssues?.length?'warning':c.cuteOnly?'collection':['good','warning','critical'].includes(c.keepTone)?c.keepTone:c.keepGood?'good':'critical'
});
window.AtlasPohlavi=(r={})=>{const g=__pgo.atlasPohlavi?__pgo.atlasPohlavi(r):null;
 return g?` <span class="atlas-pohlavi atlas-pohlavi-${g}" aria-label="${g==='f'?'Samice':'Samec'}">${g==='f'?'♀':'♂'}</span>`:''};
window.AtlasTags=(c,r={})=>'<span class="atlas-tag-typy">'+String(c.types||'').split(' / ').filter(t=>t&&t!=='–').map(t=>{const color=__pgo.typeColors()[t];return color?'<span class="d-type atlas-roster-type" style="background:'+color+'">'+__pgo.typIkona(t)+t+'</span>':''}).join('')+'</span>'+[['SH','SHADOW',r.forma==='Shadow'],['PU','PURIFIED',r.forma==='Purified'],['D','DMAX',c.dynamax],['C','CUTE',c.cute],['S','SHINY',c.shiny],['H','100%',c.stoProcent],['L2','LUCKY',c.lucky]].filter(([, ,enabled])=>enabled).map(([key,text])=>'<span class="rarity-chip r-'+key+' atlas-roster-tag">'+text+'</span>').join('')
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
    // Uz zmerene posazeni se vlozi rovnou do znacky. Bez toho se sprite
    // vykreslil nevystredeny a poskocil, jakmile dobehlo mereni — pri
    // prepinani kusu v cisteni to bylo videt u kazdeho.
    const adresa=art(r);
    const ram=P.atlasRamecek?P.atlasRamecek(adresa):null;
    const styl=ram?` style="transform:translate(${ram.x}%, ${ram.y}%) scale(${ram.s})"`:'';
    return `<img src="${adresa}" alt="${esc(r.pokemon)}" data-atlas-pokemon="${esc(r.pokemon)}" loading="lazy"${styl} ${extra}>`;
  };
  window.AtlasMonImage=monImage;
  const groups={home:[],roster:[['roster','Moji Pokémoni']],teams:[['cheatCard','Týmy a souboje'],['rozpocetCard','Pokrytí rolí'],['typesCard','Typy a počasí'],['refCard','Žebříčky'],['prohlidkaCard','Hledat druh'],['friendCard','Výměna']],invest:[['dustCard','Investiční plán']],events:[['eventsCard','Kalendář']],settings:[['settings-card','Nastavení'],['docsCard','Data a metodika']]};
  const nav=[['home','home','Přehled'],['roster','box','Pokémoni'],['events','calendar','Kalendář'],['teams','team','Týmy'],['invest','invest','Investice']];
  const headings={home:['Tvůj box. Jasný plán.','Co ponechat, připravit a použít při příštím hraní.'],roster:['Moji Pokémoni','Co si necháváš a co pustit. Podrobnosti otevřeš u konkrétního kusu.'],teams:['Připraveni do boje','Týmy, role a pokrytí z tvého současného rosteru.'],invest:['Každý prach má svůj cíl','Naplánuj vylepšení podle svého rozpočtu.'],events:['Kalendář akcí','Co zrovna běží, co začíná a kdy je spotlight nebo raid hodina.'],settings:['Data a pravidla','Profily, prahy a vysvětlení výpočtů.']};
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
  const shell=document.createElement('div');shell.id='atlasShell';shell.innerHTML=`<aside class="atlas-side"><div class="atlas-brand"><span class="atlas-brand-mark">${icon('box')}</span><span>GO</span><span>Atlas</span></div><div class="atlas-nav-label">TVŮJ HERNÍ PLÁN</div><nav class="atlas-nav" aria-label="Hlavní navigace">${navHTML()}<button data-atlas-nav="settings">${icon('settings')}<span>Data a pravidla</span></button></nav><div class="atlas-side-foot"><span class="atlas-test-badge" data-atlas-test-badge hidden>TESTOVACÍ VERZE</span><strong id="atlasProfile"></strong><p id="atlasCount"></p><p id="atlasVerze"></p></div></aside><header class="atlas-top"><div class="atlas-crumb">GO Atlas <span id="atlasCrumbVerze" class="atlas-verze-znacka"></span> <b id="atlasCrumb">/ Přehled</b></div><div class="atlas-top-actions"><span class="atlas-test-badge atlas-status" data-atlas-test-badge hidden>LOKÁLNÍ TEST</span><button data-click="novinkyBtn" title="Co se v appce změnilo v téhle verzi">${icon('spark')} Novinky</button><button data-click="toggleImportBtn">${icon('upload')} Import CSV</button><button data-click="exportBtn">${icon('download')} Export</button><button class="atlas-icon-btn" data-atlas-action="theme" aria-label="Přepnout světlý nebo tmavý vzhled">${icon('moon')}</button><button class="atlas-icon-btn" data-atlas-nav="settings" aria-label="Nastavení">${icon('settings')}</button></div></header><nav class="atlas-bottom" aria-label="Mobilní navigace">${navHTML()}</nav><div class="atlas-modal" id="atlasModal" hidden><div class="atlas-backdrop" data-atlas-action="close"></div><section class="atlas-drawer" role="dialog" aria-modal="true" aria-labelledby="atlasDetailTitle"><div class="atlas-drawer-header"><span>KONKRÉTNÍ KUS · TVŮJ PLÁN</span><button data-atlas-action="close" aria-label="Zavřít detail">${icon('close')}</button></div><div id="atlasIdentity"></div><div class="atlas-detail-content" id="atlasDetailContent"></div><div style="padding:0 22px 28px"><button class="atlas-mini-btn" data-atlas-action="edit">Upravit údaje tohoto kusu ${icon('arrow')}</button></div></section></div>`;document.body.appendChild(shell);
  const heading=document.createElement('div');heading.id='atlasHeading';heading.className='atlas-heading';
  const subnav=document.createElement('nav');subnav.id='atlasSubnav';subnav.className='atlas-subnav';subnav.setAttribute('aria-label','Nástroje sekce');
  const home=document.createElement('section');home.id='atlasHome';
  const app=$('.app');app.prepend(heading,subnav,home);
  const rosterCard=$('.card.roster'),mode=document.createElement('div');mode.className='atlas-mode';mode.innerHTML='<div class="atlas-mode-controls"><label for="atlasSort">Řazení</label><select id="atlasSort" aria-label="Řazení stručného seznamu"><option value="">Původní řazení</option><optgroup label="Základní"><option value="pokemon:1">Jméno A–Z</option><option value="pokemon:-1">Jméno Z–A</option><option value="cp:-1">CP od nejvyššího</option><option value="cp:1">CP od nejnižšího</option><option value="ivPct:-1">IV od nejvyššího</option><option value="ivPct:1">IV od nejnižšího</option><option value="level:-1">Level od nejvyššího</option><option value="level:1">Level od nejnižšího</option></optgroup><optgroup label="Čas"><option value="scanDate:-1">Naposledy naskenované</option><option value="scanDate:1">Nejdéle nenaskenované</option><option value="catchDate:-1">Nejnověji chycené</option><option value="catchDate:1">Nejdéle chycené</option></optgroup><optgroup label="PvP ligy"><option value="pvpRec:1">Všechny ligy po pořadí</option><option value="liga:LC:1">Little Cup: nejlepší první</option><option value="liga:LC:-1">Little Cup: nejhorší první</option><option value="liga:GL:1">Great League: nejlepší první</option><option value="liga:GL:-1">Great League: nejhorší první</option><option value="liga:UL:1">Ultra League: nejlepší první</option><option value="liga:UL:-1">Ultra League: nejhorší první</option><option value="liga:ML:1">Master League: nejlepší první</option><option value="liga:ML:-1">Master League: nejhorší první</option></optgroup></select><button data-atlas-action="mode"></button></div>';
  const list=document.createElement('div');list.id='atlasRoster';list.className='atlas-roster';const table=$('#rosterTable').closest('.table-wrap');table.before(mode,list);
  function sync(g,r){view=g;route=r||route;document.body.dataset.atlasView=g;const [title,subtitle]=headings[g];heading.innerHTML=`<div><h1>${title}</h1></div>${g==='home'?`<button class="atlas-cta" data-click="boxModeBtn">${icon('spark')} Projít pokémony</button>`:''}`;subnav.innerHTML=groups[g].length>1?groups[g].map(([id,t])=>`<button data-atlas-route="${id}" class="${id===r?'active':''}" ${id===r?'aria-current="page"':''}>${t}</button>`).join(''):'';document.querySelectorAll('[data-atlas-nav]').forEach(b=>{b.classList.toggle('active',b.dataset.atlasNav===g);if(b.dataset.atlasNav===g)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});$('#atlasCrumb').textContent='/ '+(nav.find(n=>n[0]===g)?.[2]||'Data a pravidla');/* Ukladat jen skupinu nestacilo: po obnoveni stranky se otevrela prvni
     polozka skupiny, takze z Vyhledavani se clovek probudil v Tahaku. */
  try{localStorage.setItem('pgo_atlas_view',g);
   if(route)localStorage.setItem('pgo_atlas_route',route)}catch{}if(g==='home')renderHome();}
  function go(g,r){closeDetail();if(g==='home')sync('home');else window.__pgoZalozka(r||groups[g][0][0]);window.scrollTo({top:0,behavior:'instant'});}
  window.addEventListener('atlas:route',e=>{const g=Object.keys(groups).find(g=>groups[g].some(p=>p[0]===e.detail));if(g)sync(g,e.detail)});
  function role(c){return window.AtlasRole(c)}
  function decision(c){return window.AtlasVerdict(c).label;}
  function next(c,r){if(c.validationIssues?.length)return 'Ověřit CP, level a IV';if(c.cuteOnly)return 'Ponechat pro radost';if(!r.fastMove||!r.charged1)return 'Doplnit útoky';if(c.powerup&&c.powerup.startsWith('Ano'))return 'Otevřít plán vylepšení';if(c.evolve&&c.evolve.startsWith('Ano'))return 'Ověřit cestu evoluce';return 'Prohlédnout doporučení';}
  function rowHTML(r){const c=cache.computed[r.id]||{},iv=c.ivPct;return `<button class="atlas-row atlas-roster-tile"${c.posledniSken?' data-sken="1"':''} data-atlas-detail="${esc(r.id)}" aria-label="Detail ${esc(r.pokemon)}"><span class="atlas-tile-heading"><b>${esc(P.atlasJmeno?P.atlasJmeno(r):r.pokemon)}${window.AtlasPohlavi(r)}</b><span class="atlas-num"><small>CP</small>${fmt(r.cp)}</span></span><span class="atlas-poke">${monImage(r)}<span class="atlas-tile-info"><span class="atlas-tile-stats"><b>${iv==null?'IV neznámé':Math.round(iv*100)+' % IV'}</b><span>L${esc(r.level||'?')}</span></span><span class="atlas-tile-tags">${c.counter&&c.counter.pct!=null?'<span class="rarity-chip atlas-proti-skore" title="Jak dobre se tenhle kus hodi proti vybranemu druhu. 100 % = nejlepsi, co mas.">'+Math.round(c.counter.pct*100)+' %</span>':''}${window.AtlasTags(c,r)}</span></span></span><span class="atlas-decision"><span class="atlas-pill" data-verdict="${window.AtlasVerdict(c).tone}">${decision(c)}</span>${(P.atlasDuvody&&P.atlasDuvody(c))||'<small>'+esc(role(c))+'</small>'}</span><span class="atlas-arrow" aria-hidden="true">${icon('next')}</span></button>`;}

  // Poradi bere appka primo z motoru (`atlasPoradi`). Radky tabulky jsou
  // jen zaloha pro pripad, ze by motor tu funkci jeste nemel.
  function renderedRows(){const ids=P.atlasPoradi?P.atlasPoradi():[...$('#tbody').querySelectorAll('tr[data-row-id]')].map(tr=>tr.dataset.rowId);const map=new Map(cache.rows.map(r=>[r.id,r]));return ids.map(id=>map.get(id)).filter(r=>r&&(!missingOnly||!r.fastMove||!r.charged1)&&(!window.AtlasRosterMatch||window.AtlasRosterMatch(r,cache.computed[r.id]||{})));}
  // Dlaždice se překreslovaly všechny při každé změně: u 400 kusů to bylo
  // 34 tisíc zásahů do DOMu na jedno kliknutí (třeba přepnutí značky) a mezi
  // kusy se pak „sekalo". Když se pořadí ani počet nezmění, vymění se jen ty
  // dlaždice, jejichž HTML je jiné — obvykle jedna nebo dvě.
  let posledniHtml = [], posledniPoradi = '';
  /* Rezim "protihraci": roster se seradi podle toho, jak se kusy hodi
     proti vybranemu druhu. Dokud o tom nic nestalo na obrazovce, vypadalo
     to, ze se jen necekane prehazelo poradi. */
  function vykresliProtiPruh(){
    const stav=P.atlasCounterStav?P.atlasCounterStav():null;
    let pruh=document.getElementById('atlasProtiPruh');
    if(!stav){if(pruh)pruh.remove();return}
    if(!pruh){
      pruh=document.createElement('div');pruh.id='atlasProtiPruh';
      pruh.className='atlas-proti-pruh';
      pruh.addEventListener('click',e=>{
        if(!e.target.closest('[data-proti-zrus]'))return;
        P.atlasCounterZrus&&P.atlasCounterZrus();
        refresh();
      });
      list.before(pruh);
    }
    pruh.innerHTML='<span><b>Proti '+esc(stav.jmeno)+'</b> ('+stav.typy.map(esc).join(' · ')
      +') — kusy jsou seřazené podle toho, jak se na něj hodí.</span>'
      +'<button type="button" data-proti-zrus>Zrušit</button>';
  }

  function renderRoster(){vykresliProtiPruh();const rows=renderedRows(),scroll=list.scrollTop,first=new Map([...list.querySelectorAll('.atlas-roster-tile')].map(el=>[el.dataset.atlasDetail,el.getBoundingClientRect()]));const previousIds=[...first.keys()].join('|'),nextIds=rows.map(r=>String(r.id)).join('|');
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
  // Behem cisteni boxu lezi panel pres celou stranku a roster pod nim neni
  // videt. Prekreslovat kvuli jedne znacce ctyri sta dlazdic stalo dlouhe
  // desetiny vteriny pri kazdem kliknuti — dozene se to pri zavreni panelu.
  let rosterDluh=false;
  const cisteniBezi=()=>{const b=document.getElementById('boxMode');return !!b&&!b.hidden};
  function refresh(){cache={rows:P.getRows(),computed:P.getComputed()};$('#atlasProfile').textContent=P.getProfile();$('#atlasCount').textContent=cache.rows.length+' Pokémonů · lokální profil';
    if(cisteniBezi()){rosterDluh=true;return}
    rosterDluh=false;renderRoster();if(view==='home')renderHome();}
  window.AtlasDoplnitRoster=()=>{if(rosterDluh)refresh()};
  // „48.0“ a „14.0“ ze skenu jako 48 a 14; IV procento (nebo rozsah ze skenu) za hodnotami IV.
  const cisloKusu=v=>v===''||v==null?'?':(isNaN(Number(v))?String(v):String(Number(v)));
  const ivKusu=id=>{const c=(P.getComputed()||{})[id]||{};const t=c.ivUncertain&&c.ivRange?c.ivRange:(c.ivPct==null?'':Math.round(c.ivPct*100)+' %');return t?' · '+esc(t):''};
  // Hlavička kusu (obrázek, jméno, CP, IV) — stejná v detailu i v čištění boxu.
  window.AtlasIdentitaHTML=(r,sNadpisem=true)=>`<div class="atlas-detail-identity"><span class="atlas-ident-obr">${monImage(r)}</span><div class="atlas-ident-text"><div class="atlas-eyebrow">${esc(r.forma||'Běžná forma')}</div><h2${sNadpisem?' id="atlasDetailTitle"':''}${(j=>j.length>16?' class="atlas-jmeno-dlouhe atlas-jmeno-velmi-dlouhe"'
      :j.length>11?' class="atlas-jmeno-dlouhe"':'')(String(r.pokemon||''))}>${esc(__pgo.atlasJmeno?__pgo.atlasJmeno(r):r.pokemon)}${window.AtlasPohlavi(r)}</h2><p class="atlas-ident-radek">${fmt(r.cp)} CP · L${esc(cisloKusu(r.level))}${ivKusu(r.id)}</p></div></div>`;
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
  // Cislo verze v pate: test ma vzdycky vyssi nez produkce, takze je hned
  // videt, ktera sestava je otevrena.
  // Cislo verze nahore v zahlavi i dole v pate. Nahore proto, ze pri
  // hlaseni chyby je videt na kazdem snimku obrazovky — bez nej se
  // neda poznat, jestli clovek kouka na novou verzi, nebo na tu, kterou
  // mu prohlizec drzi v mezipameti.
  if(P.verze){const v=P.verze();
    const pata=$('#atlasVerze');if(pata)pata.textContent='verze '+v;
    const hlava=$('#atlasCrumbVerze');if(hlava)hlava.textContent='v'+v;}
  refresh();let start='home',startRoute='';
  try{start=localStorage.getItem('pgo_atlas_view')||'home';
   startRoute=localStorage.getItem('pgo_atlas_route')||''}catch{}
  if(!headings[start])start='home';
  // Ulozena stranka plati jen tehdy, kdyz do te skupiny opravdu patri.
  if(!(groups[start]||[]).some(x=>x[0]===startRoute))startRoute='';
  go(start,startRoute||undefined);
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
    if(title){title.querySelectorAll('.d-flag,.sto-znacka').forEach(el=>{if(el.textContent.trim().toLowerCase()==='lucky')el.remove()});const lucky=document.createElement('button');lucky.type='button';lucky.className='atlas-lucky-tag'+(computed.lucky?' active':'');lucky.textContent='LUCKY';lucky.setAttribute('aria-label','Přepnout Lucky stav');lucky.setAttribute('aria-pressed',String(!!computed.lucky));lucky.addEventListener('click',()=>{const current=window.__pgo.getRows().find(r=>r.id===row.id);if(!current)return;current.forma=computed.lucky?'Normal':'Lucky';window.__pgo.prekreslit();window.__pgo.persistNow();window.dispatchEvent(new CustomEvent('atlas:refresh-detail'));});title.append(lucky);/* Automatické značky (LEG, MYT, UB, 100 %) patří až za osobní — jinak je legendární kus posune a oko je hledá pokaždé jinde. */title.querySelectorAll('.rarity-chip.r-L:not(.r-L2),.rarity-chip.r-M,.rarity-chip.r-U,.rarity-chip.r-H,.rarity-chip.r-DUP').forEach(el=>title.append(el));}
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
    /* V cisteni boxu zadna plachta detailu neni, takze `#atlasDetailContent`
       neexistuje — `host.querySelector` na nem spadl a tlacitko Upravit
       se tvarilo, ze nedela nic. */
    const plachtaOtevrena=!!document.querySelector('#atlasModal:not([hidden])');
    /* V cisteni boxu nema formular kam: vlozeny do sloupce s evoluci rozhodi
       celou radu a odsune zbytek stranky. Patri proto NAD cisteni jako
       modalni okno. V plachte detailu zustava vedle ni, jak bylo. */
    const vCisteni=!plachtaOtevrena&&!!document.querySelector('#boxMode:not([hidden])');
    const host=(plachtaOtevrena?document.querySelector('#atlasDetailContent'):null)
      ||document.querySelector('#boxMode .atlas-box-rozbor')
      ||document.querySelector('#atlasDetailContent')||document.body;
    document.getElementById('atlasRowEditor')?.remove();
    document.getElementById('atlasRowEditorDialog')?.remove();
    const form=document.createElement('form');form.id='atlasRowEditor';form.className='atlas-row-editor';
    const fields=[['pokemon','Pokémon','text'],['cp','CP','number',10,99999,1],['level','Level','number',1,50,.5],['ivAtk','IV útok','number',0,15,1],['ivDef','IV obrana','number',0,15,1],['ivSta','IV HP','number',0,15,1],['fastMove','Rychlý útok','text'],['charged1','Nabitý útok 1','text'],['charged2','Nabitý útok 2','text']];
    const forms=[...new Set([row.forma||'Normal','Normal','Lucky','Shadow','Purified'])];
    // Pohlaví se nabízí jen u druhů, kde se samec a samice liší vzhledem —
    // jinde by to byl údaj, který nic nezmění.
    const maPohlavi=P.maPohlaviRozdil?P.maPohlaviRozdil(row.pokemon):true;
    const pohlavi=[...new Set([row.pohlavi||'—','—','Samec','Samice'])];
    form.innerHTML='<div class="atlas-eyebrow">UPRAVUJEŠ JEDEN KUS</div><h3>'+esc(row.pokemon)+'</h3><div class="atlas-editor-grid">'+fields.map(([key,label,type,min,max,step])=>`<label>${label}<input name="${key}" type="${type}" value="${esc(row[key])}" ${min!=null?`min="${min}" max="${max}" step="${step}"`:''} ${key==='pokemon'?'required':''}></label>`).join('')+'<label>Stav / forma<select name="forma">'+forms.map(f=>`<option value="${esc(f)}" ${f===(row.forma||'Normal')?'selected':''}>${esc(f)}</option>`).join('')+'</select></label>'+(maPohlavi?'<label>Pohlaví<select name="pohlavi">'+pohlavi.map(f=>`<option value="${f==='—'?'':esc(f)}" ${f===(row.pohlavi||'—')?'selected':''}>${esc(f)}</option>`).join('')+'</select></label>':'')+'<label class="atlas-editor-note">Poznámka<textarea name="note">'+esc(row.note)+'</textarea></label></div>'+'<div class="atlas-editor-actions"><button type="submit" class="atlas-cta">Uložit</button><button type="button" class="atlas-mini-btn" data-editor-cancel>Zrušit</button><p role="status" id="atlasEditorStatus"></p></div>';
    // Útoky se vybírají stejným výběrem jako ve Vyhledávání (typ, síla, ★ elitní) — engine __pgoUtoky.vyber na dočasném objektu; hodnota jde do skrytého pole formuláře. Při změně druhu se výběr postaví znovu.
    /* Frustration (shadow) a Return (purified) nedava druh, ale STAV kusu — engine je do nabidky pridava podle `forma`. Bez nej v ni u shadow Reshirama Frustration chybel, prestoze ho ten kus ma. */
    const utoky={pokemon:row.pokemon,forma:row.forma||'',fastMove:row.fastMove||'',charged1:row.charged1||'',charged2:row.charged2||'',__docasny:true};const vyberUtoku=()=>{if(!window.__pgoUtoky)return;utoky.pokemon=form.elements.pokemon.value;utoky.forma=form.elements.forma?form.elements.forma.value:'';['fastMove','charged1','charged2'].forEach(k=>{const input=form.elements[k];let obal=form.querySelector('[data-utok-obal="'+k+'"]');if(!obal){obal=document.createElement('div');obal.className='atlas-utok-vyber';obal.dataset.utokObal=k;input.after(obal);input.type='hidden'}obal.innerHTML='';window.__pgoUtoky.vyber(obal,utoky,k,()=>{input.value=utoky[k]||''})})};vyberUtoku();form.elements.pokemon.addEventListener('change',vyberUtoku);if(form.elements.forma)form.elements.forma.addEventListener('change',vyberUtoku);
    /* Level se nezadava, dopocitava se z CP a IV. CP je funkce (staty druhu,
       IV, level) a nic jineho, takze level z nich vyjde zpetne — a zaroven
       to hlida, ze zadana kombinace ve hre vubec muze existovat. Kdyz na ni
       zadny level nesedi, pole zustane prazdne a pod formularem to stoji.
       Dva sousedni pul-levely muzou dat stejne CP (CP se zaokrouhluje dolu),
       proto se pripadne pise, ze je to na pul levelu.
       Mega forma ma vlastni staty, ktere levelZCP nezna — tam vyjde
       "neexistuje" a je to poctive: appka to CP dopocitat neumi. */
    const poleLevel=form.elements.level;
    if(poleLevel){
     poleLevel.readOnly=true;poleLevel.tabIndex=-1;
     poleLevel.classList.add('atlas-editor-dopocet');
     poleLevel.title='Dopočítá se z CP a IV — zadávat se nedá.';
    }
    let okno=null;
    /* Zavreni je na jednom miste: formular muze byt v plachte, vedle ni
       nebo v modalnim okne a kazda cesta ho musi uklidit stejne. */
    const zavrit=()=>{
     if(window.AtlasZavritNabidkuUtoku)window.AtlasZavritNabidkuUtoku();
     form.remove();
     if(okno){okno.remove();okno=null}
     document.body.classList.remove('atlas-edituje');
    };
    const hlaska=form.querySelector('[role=status]');
    const dopocitejLevel=()=>{
     if(!poleLevel||!P.levelZCP)return;
     const e=form.elements;
     const v=P.levelZCP(e.pokemon.value,e.cp.value,e.ivAtk.value,e.ivDef.value,e.ivSta.value);
     if(v){
      poleLevel.value=v.level;
      if(hlaska)hlaska.textContent=v.jednoznacne?'':
       'Level vychází na '+v.vse.join(' nebo ')+' — CP se ve hře zaokrouhluje dolů, '
       +'takže dva půl-levely dají totéž. Appka bere ten nižší.';
     }else{
      poleLevel.value='';
      if(hlaska)hlaska.textContent=(e.cp.value&&e.ivAtk.value!==''&&e.ivDef.value!==''
        &&e.ivSta.value!=='')
       ?'Takové CP s těmihle IV ve hře neexistuje — zkontroluj čísla.':'';
     }
    };
    ['pokemon','cp','ivAtk','ivDef','ivSta'].forEach(k=>{
     const el=form.elements[k];
     if(el){el.addEventListener('input',dopocitejLevel);el.addEventListener('change',dopocitejLevel)}
    });
    dopocitejLevel();
    const baseline=new Map([...form.elements].filter(e=>e.name).map(e=>[e.name,e.type==='checkbox'?e.checked:e.value]));
    form.querySelector('[data-editor-cancel]').addEventListener('click',()=>{zavrit();document.querySelector('.atlas-drawer-header button')?.focus()});
    form.addEventListener('submit',e=>{e.preventDefault();const current=P.getRows().find(r=>r.id===id);if(!current||profile!==P.getProfile()){form.querySelector('[role=status]').textContent='Kus nebo profil se změnil. Zavři detail a zkontroluj roster.';return}if(!form.reportValidity())return;
      for(const input of form.elements){if(!input.name)continue;const value=input.type==='checkbox'?input.checked:input.value;if(value!==baseline.get(input.name))current[input.name]=input.type==='checkbox'?(value?'Ano':'Ne'):value;}
      // Dalsi ulozeni uz nemelo co zapsat: porovnavalo se porad proti stavu,
      // ve kterem se formular otevrel. Kdo zmenil pohlavi a hned ho vratil
      // zpatky, dostal "ulozeno" a nezmenilo se nic. Vychozi stav se proto
      // posune na to, co se prave zapsalo — pole, ktera clovek nesahnul,
      // dal nic neprepisuji.
      P.prekreslit();P.persistNow();
      zavrit();
      window.dispatchEvent(new CustomEvent('atlas:refresh-detail'));
      const plocha2=document.querySelector('.atlas-drawer');if(plocha2)plocha2.scrollTop=0;
      document.querySelector('.atlas-drawer-header button')?.focus();
    });
    const plachta=document.getElementById('atlasModal'),plocha=document.querySelector('.atlas-drawer');
    const volno=plocha?Math.round(plocha.getBoundingClientRect().left):0;
    // Vedle plachty, ne v ní: detail se otevřením úprav nesmí posunout ani
    // zúžit. Když vedle místo není (úzké okno), zůstane úprava v detailu.
    const umistit=()=>{
      if(!form.isConnected){window.removeEventListener('resize',umistit);document.body.classList.remove('atlas-edituje');return}
      if(okno)return;
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
    if(vCisteni){
     /* Vlastni vrstva, ne nativni modal: ten se kresli nad vsim ostatnim
        vcetne rozbalene nabidky utoku (ta zije mimo formular, primo na
        strance), takze se nabidka schovala za ztmaveni a nesla z ni
        vybrat. */
     okno=document.createElement('div');
     okno.id='atlasRowEditorDialog';okno.className='atlas-edit-okno';
     okno.setAttribute('role','dialog');okno.setAttribute('aria-modal','true');
     okno.append(form);document.body.append(okno);
     /* Zkratky cisteni (D, P, sipky, Esc) chytaji klavesy na dokumentu.
        Co se pise sem, se k nim dostat nesmi — jinak by psani jmena
        rozhodovalo o kusech pod oknem. */
     okno.addEventListener('keydown',e=>{
      e.stopPropagation();
      if(e.key!=='Escape')return;
      /* Esc zavira nejdriv rozbalenou nabidku utoku, teprve pak okno —
         jinak by clovek prisel o rozepsanou upravu jen proto, ze chtel
         zavrit seznam. */
      if(window.AtlasZavritNabidkuUtoku&&window.AtlasZavritNabidkuUtoku())return;
      e.preventDefault();zavrit();
     });
     okno.addEventListener('click',e=>{if(e.target===okno)zavrit()});
    }else{
     host.prepend(form);       // ať je formulář v dokumentu, než se rozhodne, kam patří
     umistit();
     window.addEventListener('resize',umistit);
     if(!form.classList.contains('atlas-editor-vedle'))form.scrollIntoView({block:'start'});
    }
    document.body.classList.add('atlas-edituje');
    form.querySelector('[name="'+(field||'pokemon')+'"]').focus({preventScroll:true});
  };
  /* Simulace vylepšení.

     „Na jak silného ho dotáhnu a za co?" se dosud dalo zjistit jen tak, že
     si člověk vyrobil kopii kusu, vyvinul ji a vylepšil — a pak ji mazal.
     Tohle okno počítá totéž bez zásahu do rosteru: vybereš cílový druh
     (kus sám nebo to, čím se stane) a cílový level, a vedle stojí cena po
     půl levelech i dohromady.

     Nic se neukládá a nic se nepřepočítává podruhé: čísla dává engine
     (`atlasVylepseni`, `atlasEvoCena`), vrstva je jen kreslí. */
  const CISLO=n=>Number(n||0).toLocaleString('cs-CZ');

  window.AtlasSimulace=(id)=>{
    const P=window.__pgo,row=P.getRows().find(r=>r.id===id);
    if(!row)return;
    const esc2=s2=>String(s2??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const iv=[row.ivAtk,row.ivDef,row.ivSta].map(x=>x===''||x==null?null:Number(x));
    const odLevel=Number(row.level)||1;
    /* Kam se dá dojít: kus sám a druhy, kterými se může stát. Jiné formy
       (Zygarde) mezi ně nepatří — to není cesta vylepšením. */
    const strom=P.atlasEvoStrom?P.atlasEvoStrom(row.pokemon):null;
    const cile=[{klic:P.dexKeyOf(row.pokemon),jmeno:row.pokemon,evoluce:false}];
    if(strom)strom.stupne.forEach(patro=>patro.forEach(u=>{
      if(u.klic===cile[0].klic)return;
      if(P.atlasEvoCena&&P.atlasEvoCena(cile[0].klic,u.klic))
        cile.push({klic:u.klic,jmeno:u.jmeno,evoluce:true});
    }));
    /* Jine formy tehoz druhu (Zygarde). CP se spocitat da — staty forma ma —
       ale co prepnuti stoji, appka nevi, takze se o cene nic netvrdi. */
    const modelFormy=P.prohlidkaModel?P.prohlidkaModel(row.pokemon):null;
    const soucetStatu=jm=>{const st=P.atlasStaty?P.atlasStaty(jm):null;
     return st?st.utok+st.obrana+st.hp:0};
    ((modelFormy&&modelFormy.druhy)||[]).filter(x=>x.vztah==='forma')
     // Od nejslabsi formy po nejsilnejsi — jine poradi z dat neplyne.
     .sort((a2,b2)=>soucetStatu(a2.jmeno)-soucetStatu(b2.jmeno))
     .forEach(x=>{
      if(cile.some(c=>c.klic===x.klic))return;
      cile.push({klic:x.klic,jmeno:x.jmeno,forma:true});
     });
    let cilDruh=cile[0].jmeno,cilLevel=Math.min(50,Math.max(odLevel,40));
    document.getElementById('atlasSimOkno')?.remove();
    const okno=document.createElement('div');
    okno.id='atlasSimOkno';okno.className='atlas-edit-okno atlas-sim-okno';
    okno.setAttribute('role','dialog');okno.setAttribute('aria-modal','true');
    const zavrit=()=>{
     document.removeEventListener('keydown',escHlidac,true);
     okno.remove();document.body.classList.remove('atlas-edituje');
    };
    okno.addEventListener('click',e=>{if(e.target===okno)zavrit()});
    okno.addEventListener('keydown',e=>{
     e.stopPropagation();
     if(e.key==='Escape'){e.preventDefault();zavrit()}
    });
    /* Escape se musi chytit i tehdy, kdyz fokus zustal mimo okno — jinak ho
       dostane detail pod simulaci a zavre se spatna vrstva. Posloucha se
       v zachytne fazi, takze jsme na rade drive nez plachta. */
    const escHlidac=e=>{
     if(e.key!=='Escape'||!okno.isConnected)return;
     e.preventDefault();e.stopPropagation();
     zavrit();
    };
    document.addEventListener('keydown',escHlidac,true);

    function vykresli(){
      const v=P.atlasVylepseni
       ?P.atlasVylepseni(cilDruh,row.forma||'',odLevel,cilLevel,iv[0],iv[1],iv[2]):null;
      const jeForma=cile.some(c=>c.jmeno===cilDruh&&c.forma);
      const evo=!jeForma&&cilDruh!==cile[0].jmeno&&P.atlasEvoCena
       ?P.atlasEvoCena(cile[0].klic,P.dexKeyOf(cilDruh),null,null,row.forma||''):null;
      const bonbonyEvo=evo?evo.polozky.bonbony.hodnota:0;
      const predmety=evo&&evo.polozky.predmety.length?evo.polozky.predmety:[];
      const neuplne=evo&&!evo.uplne;
      const kroky=v?v.kroky:[];
      /* Kam az se da vylepsovat, aby kus neprerostl ligu. U jine formy nebo
         evoluce se pocita z jejich statu — po zmene uz je to jiny kus a
         strop plati pro nej. */
      const LIGY=[['Great League',1500],['Ultra League',2500]];
      const stropy=P.atlasStropLigy
       ?LIGY.map(([nazev,limit])=>{
         const st=P.atlasStropLigy(cilDruh,limit,iv[0],iv[1],iv[2]);
         return st?`${esc2(nazev)} (${CISLO(limit)}) do L${esc2(st.level)}`
          :`${esc2(nazev)}: nevejde se ani na L1`;
        }):[];
      const stropyHtml=stropy.length
       ?`<p class="atlas-sim-pozn">Strop ligy pro ${esc2(cilDruh)}: ${stropy.join(' · ')}.`
        +` Nad ním už tě liga nepustí — u jiné formy se počítá z jejích statů,`
        +` takže se hlídá, než formu přepneš.</p>`:'';
      const radky=kroky.map(k=>`<tr><td>L${esc2(k.z)} → L${esc2(k.na)}</td>`
        +`<td>${k.cp==null?'—':esc2(CISLO(k.cp))}</td>`
        +`<td>${esc2(CISLO(k.prach))}</td>`
        +`<td>${k.xl?esc2(CISLO(k.xl))+' XL':esc2(CISLO(k.bonbony))}</td>`
        +`<td>${esc2(CISLO(k.celkemPrach))}</td>`
        +`<td>${esc2(CISLO(k.celkemBonbony))}${k.celkemXl?' + '+esc2(CISLO(k.celkemXl))+' XL':''}</td></tr>`).join('');
      okno.innerHTML=`<section class="atlas-sim">
       <div class="atlas-eyebrow">SIMULACE — NIC SE NEULOŽÍ</div>
       <h3>${esc2(row.pokemon)} ${esc2(row.cp||'?')} CP · L${esc2(odLevel)}</h3>
       <p class="atlas-sim-pozn">Počítá se s IV tohohle kusu (${iv.map(x=>x==null?'?':x).join('/')}).
        Roster to nijak nemění — je to jen propočet.</p>
       <div class="atlas-sim-volby">
        <div><span>Co z něj bude</span><div class="atlas-sim-prepinac">`
        +cile.map(c=>`<button type="button" data-sim-druh="${esc2(c.jmeno)}"`
          +` aria-pressed="${c.jmeno===cilDruh}">${esc2(c.jmeno)}`
          +(c.evoluce?'<small>evoluce</small>'
            :c.forma?'<small>jiná forma</small>':'<small>beze změny</small>')+`</button>`).join('')
        +`</div></div>
        <div><span>Cílový level</span><div class="atlas-sim-prepinac">
         <button type="button" data-sim-krok="-0.5" aria-label="O půl levelu níž">−½</button>
         <b class="atlas-sim-level">L${esc2(cilLevel)}</b>
         <button type="button" data-sim-krok="0.5" aria-label="O půl levelu výš">+½</button>
         <button type="button" data-sim-level="40" aria-pressed="${cilLevel===40}">L40</button>
         <button type="button" data-sim-level="50" aria-pressed="${cilLevel===50}">L50</button>
        </div></div>
       </div>
       <div class="atlas-sim-souhrn">
        <div><span>CP po vylepšení</span><b>${v&&v.cpNa!=null?esc2(CISLO(v.cpNa)):'—'}</b>
         <i>z ${v&&v.cpOd!=null?esc2(CISLO(v.cpOd)):'—'} na L${esc2(odLevel)}</i></div>
        <div><span>Prach</span><b>${v?esc2(CISLO(v.prach)):'—'}</b>
         <i>${v&&v.nasobekPrachu!==1?esc2(v.duvodCeny||'jiná cena podle stavu kusu'):'běžná cena'}</i></div>
        <div><span>Bonbóny</span><b>${v?esc2(CISLO(v.bonbony+bonbonyEvo)):'—'}</b>
         <i>${bonbonyEvo?'z toho '+esc2(CISLO(bonbonyEvo))+' za evoluci':'jen vylepšení'}</i></div>
        <div><span>XL bonbóny</span><b>${v?esc2(CISLO(v.xl)):'—'}</b>
         <i>${v&&v.xl?'nad L40':'do L40 nejsou'}</i></div>
       </div>
       ${predmety.length?`<p class="atlas-sim-pozn">K evoluci je potřeba ${esc2(predmety.join(' · '))}.</p>`:''}
       ${stropyHtml}
       ${jeForma?`<p class="atlas-sim-pozn">Je to jiná forma téhož druhu, ne evoluce — CP se spočítat dá, ale co přepnutí formy stojí, appka z dat neví. V ceně je proto jen vylepšení.</p>`:''}
       ${neuplne?`<p class="atlas-sim-pozn atlas-evo-chybi">Součet není úplný — chybí: ${esc2(evo.chybi.join(', '))}.</p>`:''}
       ${radky?`<div class="atlas-sim-tabulka"><table>
        <thead><tr><th>Krok</th><th>CP</th><th>Prach</th><th>Bonbóny</th><th>Prach celkem</th><th>Bonbóny celkem</th></tr></thead>
        <tbody>${radky}</tbody></table></div>`
        :`<p class="atlas-sim-pozn">Na tomhle levelu už je — vyber vyšší cíl.</p>`}
       <div class="atlas-editor-actions"><button type="button" class="atlas-cta" data-sim-zavrit>Zavřít</button></div>
      </section>`;
      if(P.vystreditSprity)P.vystreditSprity(okno);
    }

    okno.addEventListener('click',e=>{
     const b=e.target.closest('button');if(!b)return;
     if(b.hasAttribute('data-sim-zavrit')){zavrit();return}
     if(b.dataset.simDruh){cilDruh=b.dataset.simDruh;vykresli();return}
     if(b.dataset.simLevel){cilLevel=Number(b.dataset.simLevel);vykresli();return}
     if(b.dataset.simKrok){
      cilLevel=Math.min(50,Math.max(odLevel,Math.round((cilLevel+Number(b.dataset.simKrok))*2)/2));
      vykresli();
     }
    });
    vykresli();
    document.body.append(okno);
    document.body.classList.add('atlas-edituje');
    okno.querySelector('button')?.focus();
  };

  // Rozbalena nabidka utoku zije mimo okno (position:fixed na <body>), takze
  // se zavrenim okna sama nezmizi — musi se zavrit rucne.
  function zavritNabidkuUtoku(){
    const U=window.__pgoUtoky;
    if(U&&U.jeOtevreno&&U.jeOtevreno()){U.zavritSeznam();return true}
    const zbytek=document.querySelector('.uv-seznam');
    if(zbytek){zbytek.remove();document.querySelectorAll('.uv-pole.otevreno')
      .forEach(el=>el.classList.remove('otevreno'));return true}
    return false;
  }
  window.AtlasZavritNabidkuUtoku=zavritNabidkuUtoku;
  // Pojistka pro vsechny ostatni cesty (Zrusit, Ulozit, krizek, prepnuti
  // kusu): kdyz pole, ze ktereho se nabidka rozbalila, zmizi ze stranky,
  // zavre se i nabidka. Jinak zustala viset nad prazdnym mistem.
  (function hlidatNabidku(){
    let cekani=0;
    new MutationObserver(()=>{
      if(!document.querySelector('.uv-seznam'))return;
      clearTimeout(cekani);
      cekani=setTimeout(()=>{
        const pole=document.querySelector('.uv-pole.otevreno');
        if(!pole||!pole.isConnected||!pole.getClientRects().length)zavritNabidkuUtoku();
      },0);
    }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class','style']});
  })();
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(zavritNabidkuUtoku()){e.preventDefault();e.stopImmediatePropagation();return}
    const editor=document.getElementById('atlasRowEditor');
    if(editor){e.preventDefault();e.stopImmediatePropagation();
      editor.querySelector('[data-editor-cancel]')?.click();return;}
    // Okno „Přidat pokémona" se zavírá Escapem jako každé jiné okno.
    const rucni=document.getElementById('rucniBox');
    if(rucni&&!rucni.hidden){
      e.preventDefault();e.stopImmediatePropagation();
      const zrusit=[...rucni.querySelectorAll('button')].find(b=>/Zrušit/.test(b.textContent));
      if(zrusit)zrusit.click();else rucni.hidden=true;
      return;
    }
  },true);
  document.addEventListener('click',e=>{const button=e.target.closest('[data-atlas-action="edit"]');if(!button)return;const id=window.__atlasTest.getState().dialogId;if(!id)return;e.preventDefault();e.stopImmediatePropagation();window.AtlasEditRow(id);},true);
  // Okno „Přidat pokémona": stejný výběr útoků jako v úpravě kusu.
  (function pridatSteJnyVyber(){
    const box=document.getElementById('rucniBox');
    if(!box||!window.__pgoUtoky)return;
    const pole={fastMove:'rbFast',charged1:'rbCh1',charged2:'rbCh2'};
    const docasny={pokemon:'',fastMove:'',charged1:'',charged2:'',__docasny:true};
    const postav=()=>{
      docasny.pokemon=(document.getElementById('rbName')||{}).value||'';
      Object.keys(pole).forEach(k=>{
        const input=document.getElementById(pole[k]);
        if(!input)return;
        let obal=box.querySelector('[data-utok-obal="'+k+'"]');
        if(!obal){obal=document.createElement('div');obal.className='atlas-utok-vyber';obal.dataset.utokObal=k;
          input.after(obal);input.type='hidden'}
        obal.innerHTML='';
        window.__pgoUtoky.vyber(obal,docasny,k,()=>{input.value=docasny[k]||''});
      });
    };
    const jmeno=document.getElementById('rbName');
    if(jmeno){jmeno.addEventListener('change',postav);jmeno.addEventListener('input',()=>{clearTimeout(postav.t);postav.t=setTimeout(postav,300)})}
    // „V gymu (h)" je pro kus, který si člověk opisuje z gymu — v běžném
    // přidávání jen mate. Zůstává v DOM (engine ho čte), jen se neukazuje.
    const hod=document.getElementById('rbHod');
    if(hod&&hod.closest('label'))hod.closest('label').hidden=true;
    new MutationObserver(()=>{if(!box.hidden)postav()}).observe(box,{attributes:true,attributeFilter:['hidden']});
  })();

  const footer=document.querySelector('.atlas-drawer>div:last-child button[data-atlas-action="edit"]');if(footer)footer.textContent='Upravit tohoto Pokémona →';
  // Odstranit kus jde i ručně — ale jen přes potvrzení, je to nevratné
  // (kus se zapíše mezi smazané, aby ho import nevrátil).
  window.AtlasSmazatKus=(id)=>{
    const row=P.getRows().find(r=>r.id===id);if(!row)return;
    P.potvrdit('Odstranit '+row.pokemon+(row.cp?' ('+row.cp+' CP)':'')+' z rosteru?'
      +'\n\nKus se zapíše mezi smazané, takže se při dalším importu nevrátí.',
      ()=>{if(P.smazatKus(id)){(document.querySelector('.atlas-drawer-header [data-atlas-action=close]')||document.querySelector('.atlas-drawer-header button'))?.click();
        window.dispatchEvent(new CustomEvent('atlas:refresh'))}},'Odstranit');
  };
  document.addEventListener('click',e=>{const b=e.target.closest('[data-atlas-action="smazat"]');if(!b)return;
    const id=window.__atlasTest.getState().dialogId;if(!id)return;
    e.preventDefault();e.stopImmediatePropagation();window.AtlasSmazatKus(id);},true);
})();

(() => {
  const $=s=>document.querySelector(s),api=window.__atlasTest;
  const items=[['home',null,'Přehled'],['roster','roster','Pokémoni'],['events','eventsCard','Kalendář'],['teams','prohlidkaCard','Vyhledávání'],['invest','dustCard','Rozpočet'],['teams','cheatCard','Tahák'],['teams',null,'Bojové nástroje',[['rozpocetCard','Pokrytí rolí'],['typesCard','Typy a počasí'],['refCard','Žebříčky'],['friendCard','Výměna']]],['settings',null,'Data a pravidla',[['settings-card','Nastavení'],['docsCard','Metodika a zdroje']]]];
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
  function show(el){target=el;const template=document.createElement('template');template.innerHTML=el.dataset.tip||'';template.content.querySelectorAll('*').forEach(node=>{if(!['DIV','SPAN','B','STRONG','EM','I','BR','P','SMALL','UL','LI'].includes(node.tagName)){node.replaceWith(document.createTextNode(node.textContent));return}for(const attr of [...node.attributes]){if(attr.name!=='class'&&!(attr.name==='style'&&/^\s*(font-size|margin-top|padding-top|border-top|color)\s*:/i.test(attr.value)))node.removeAttribute(attr.name)}});tip.replaceChildren(template.content.cloneNode(true));tip.style.left='0px';tip.style.top='0px';tip.hidden=false;document.body.classList.add('atlas-evo-tip-open');el.setAttribute('aria-describedby',tip.id);const rect=el.getBoundingClientRect(),box=tip.getBoundingClientRect();let right=document.documentElement.clientWidth;for(let s=el.parentElement;s&&s!==document.body;s=s.parentElement){const cs=getComputedStyle(s);if(/(auto|scroll)/.test(cs.overflowY)&&s.scrollHeight>s.clientHeight){const sr=s.getBoundingClientRect();right=Math.min(right,sr.left+s.clientLeft+s.clientWidth);break}}// Bublina evolucni rady stoji VEDLE sloupce, ne nad nim a pod nim.
  // Bublina si bere kliky (da se v ni rolovat), takze kdyz prekryla
  // sousedni stupen, nesel uz kliknout ani najet — mys se k nemu nedostala.
  const sloupec=el.closest('.atlas-evolution-column');
  if(sloupec){
    const sr=sloupec.getBoundingClientRect();
    tip.style.left=Math.max(12,sr.left-box.width-14)+'px';
    tip.style.top=Math.max(12,Math.min(innerHeight-box.height-12,
      rect.top+rect.height/2-box.height/2))+'px';
    return;
  }
  tip.style.left=Math.max(12,Math.min(right-box.width-16,rect.left+rect.width/2-box.width/2))+'px';tip.style.top=Math.max(12,Math.min(innerHeight-box.height-12,rect.top>=box.height+12?rect.top-box.height-8:rect.bottom+8))+'px';}
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
  document.title=(window.__ATLAS_TEST_NAZEV||'')+'Pokémon GO Atlas';
  const copy={cheatCard:['Tahák do soubojů','Konkrétní soupeři a sestavy z tvých Pokémonů. Výsledky jsou modelové odhady.'],prohlidkaCard:['Vyhledávání Pokémonů','Najdi druh, jeho formy, ligy a evoluční možnosti.'],rozpocetCard:['Pokrytí rolí','Najdi slabá místa svého boxu a kandidáty na doplnění.'],typesCard:['Typy a počasí','Účinnost útoků, odolnosti a vliv počasí.'],refCard:['Žebříčky','Porovnej druhy podle role; konkrétní kus vyhodnoť v jeho detailu.'],friendCard:['Výměna','Porovnej svůj roster s druhým hráčem.'],eventsCard:['Kalendář událostí','Raidy a události podle zabudovaných dat. Ověř jejich datum aktualizace.'],catchCard:['Co chytat','Pokémoni a candy pro doplnění tvého boxu.'],'settings-card':['Nastavení','Přizpůsob prahy a pravidla doporučení.'],docsCard:['Metodika a zdroje','Význam výsledků, použitá data a omezení výpočtů.']};
  function heading(){const state=__atlasTest.getState(),entry=copy[state.route];document.body.dataset.atlasCurrentRoute=state.route;if(entry&&!['home','roster','invest'].includes(state.view)){$('#atlasHeading h1').textContent=entry[0];}}
  window.addEventListener('atlas:route',heading);heading();
  const toolbar=$('#addRowBtn').closest('.toolbar');if(toolbar){const bar=document.createElement('div');bar.className='atlas-roster-commandbar';toolbar.before(bar);
  // V liště příkazů má „projít box" stejnou podobu jako tlačítko u nadpisu.
  {const b=$('#boxModeBtn');if(b){b.classList.add('atlas-cta');b.innerHTML='<svg class="atlas-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></svg> Projít pokémony';}}for(const el of [$('#addRowBtn'),$('#boxModeBtn'),$('#searchInput'),$('.atlas-mode-controls'),$('#filterSelect'),$('#zrusitFiltry'),$('.atlas-roster-commands')])if(el)bar.append(el);}
  const applyTable=()=>{const computed=P.getComputed();$('#tbody').querySelectorAll('tr[data-row-id]').forEach(tr=>{const c=computed[tr.dataset.rowId],cell=tr.querySelector('[data-col="keep"]');if(!c||!cell)return;const v=AtlasVerdict(c);cell.dataset.atlasVerdict=v.tone;const badge=cell.querySelector('.badge');if(badge){badge.dataset.verdict=v.tone;badge.textContent=v.label;}})};
  new MutationObserver(applyTable).observe($('#tbody'),{childList:true});applyTable();
})();
(() => {
 const $=s=>document.querySelector(s),P=window.__pgo;
 const profile=$('#profilBtn'),commands=$('.atlas-roster-commands>div');if(profile&&commands)commands.append(profile);
 const view=$('#viewSelect');view.value='all';view.dispatchEvent(new Event('change',{bubbles:true}));view.hidden=true;
 $('#tbody').addEventListener('click',e=>{const row=e.target.closest('tr[data-row-id]');if(!row||e.target.closest('input,select,textarea,button,a,label'))return;e.stopImmediatePropagation();__atlasTest.openDetail(row.dataset.rowId)},true);
 const dialog=document.createElement('dialog');dialog.id='atlasImportDialog';dialog.className='atlas-import-dialog';dialog.setAttribute('aria-labelledby','atlasImportTitle');dialog.innerHTML='<header><div><h2 id="atlasImportTitle">Import rosteru</h2><p>Přetažhni soubor. Ukážu ti, co v něm je a co to s rosterem udělá.</p></div><button type="button" aria-label="Zavřít import">✕</button></header>';
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
 const fileCancel=$('#mapCancelBtn');fileCancel.textContent='Zrušit';fileCancel.addEventListener('click',()=>{$('#fileInput').value=''});
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
 /* Simulace vylepseni: "na jak silneho ho dotahnu a za co" bez vyrabeni
    pokusne kopie. Stoji vedle Upravit, protoze je to tataz otazka o tomhle
    kusu — jen "co kdyby" misto "oprav". */
 const sim=document.createElement('button');sim.id='atlasSimPokemon';sim.className='atlas-mini-btn';
 sim.textContent='Simulace vylepšení';
 sim.addEventListener('click',()=>{
  const id=window.__atlasTest&&window.__atlasTest.getState?window.__atlasTest.getState().dialogId:null;
  if(id&&window.AtlasSimulace)window.AtlasSimulace(id);
 });
 edit.before(sim);
 // Krizek patri za prikazy, ne pred ne — jinak si bral vlastni radek.
 close.parentElement.append(close);
 {const smaz=document.createElement('button');smaz.id='atlasSmazatPokemona';smaz.dataset.atlasAction='smazat';
  smaz.textContent='Odstranit';smaz.className='atlas-mini-btn atlas-smazat-btn';close.before(smaz);}
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
  /* Lista "ve hre jsem s nim neco udelal" patri v cisteni boxu nad
     evolucni radu. Driv se pripinala na mrizku rozboru pres `grid-area`,
     jenze ta oblast v mrizce neexistuje — prvek skoncil v implicitni stope
     nekde u hlavicky a podle sirky okna zmizel z dohledu. Ted sedi primo
     ve sloupci s evoluci, jako jeho prvni radek. */
  if(bar&&!vPlachte){
   /* Upravit kus je v plachte hned vedle techhle prikazu; v cisteni boxu
      chybelo uplne, prestoze je to tataz otazka ("tohle nesedi, oprav").
      Patri tam i na telefonu — tam se opravuje nejcasteji. */
   if(!bar.querySelector('[data-box-edit]')){
    const uprav=document.createElement('button');
    uprav.type='button';uprav.className='hra-btn';uprav.dataset.boxEdit='1';
    uprav.textContent='Upravit';
    uprav.title='Otevře úpravu tohohle kusu — CP, level, IV, útoky, forma.';
    uprav.addEventListener('click',()=>{window.AtlasEditRow&&window.AtlasEditRow(row.id)});
    bar.append(uprav);
   }
   /* Kam lista patri, zalezi na sirce okna: na sirokem nad evolucni radu,
      na telefonu do sloupce s verdiktem — rozbor se tam vubec nekresli a
      lista by v nem zmizela i s prikazy. */
   const siroke=window.innerWidth>900;
   const cil=siroke?document.querySelector('#boxMode .atlas-box-rozbor')
    :document.querySelector('#boxMode .bm-body');
   if(cil){
    document.querySelectorAll('#boxMode .bm-top .hra-pruh,#boxMode .atlas-box-rozbor .hra-pruh')
      .forEach(e=>{if(e!==bar)e.remove()});
    bar.classList.toggle('atlas-hra-nad-evoluci',siroke);
    if(siroke)cil.append(bar);
    else{
     const pod=cil.querySelector('.bm-why')||cil.querySelector('.bm-roles');
     if(pod)pod.before(bar);else cil.append(bar);
    }
   }
  }
  if(bar&&vPlachte){bar.setAttribute('aria-label','Zapsat změnu ve hře');bar.querySelectorAll('[aria-pressed]').forEach(b=>b.removeAttribute('aria-pressed'));const editBtn=$('#atlasEditPokemon');if(editBtn)editBtn.before(bar);else $('.atlas-drawer-header').append(bar)}
  // Souhrn keepSub vedle verdiktu už nepřidávat: verdikt v detailu má štítky důvodů a text je zdvojoval.
  // Vysvětlení verdiktu (d-why) opakuje bubliny štítků — když štítky jsou, přesune se do bubliny nadpisu verdiktu.
  // IV procento je nahoře u hodnot IV — poznámka pod pruhy pryč; ve stropu jen CP, level a pořadí kopie (proč je v bublině).
  container.querySelectorAll('[data-detail-section=stats] .d-box').forEach(box=>{const h=(box.querySelector('.d-box-h')||{}).textContent||'';if(/^IV/.test(h))box.querySelectorAll('.d-note').forEach(n=>n.remove());if(/^Strop/.test(h))box.querySelectorAll('.d-proc').forEach(n=>{const note=n.parentElement;if(n.textContent.trim())note.setAttribute('data-tip',n.textContent.trim());if(n.previousElementSibling&&n.previousElementSibling.tagName==='BR')n.previousElementSibling.remove();n.remove()})});
  // Typové pokrytí: „Výhoda" jako typy vpravo na řádku značek. V sekci dole
  // zůstane jen to, co se vyruší — zbytek se dal odvodit a jen zabíral místo.
  // Typy kusu dostanou pevne siroke misto. Druh s jednim typem ma misto
  // druheho chipu jen pomlcku, ta je uzsi — a vlastni znacky za ni se pri
  // prechodu na dalsi kus posunuly o par pixelu do strany.
  const titulekTypy=container.querySelector('.detail-title');
  if(titulekTypy&&!titulekTypy.querySelector('.atlas-typy-slot')){
    const typy=[];
    for(const el of titulekTypy.children){
      if(el.classList.contains('d-type'))typy.push(el);else break;
    }
    if(typy.length){
      const slot=document.createElement('span');slot.className='atlas-typy-slot';
      typy[0].before(slot);typy.forEach(el=>slot.append(el));
    }
  }
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
      vykricnik.setAttribute('aria-label','Útoky nejsou vyplněné');
      nadpis.append(vykricnik);
      // Jedna bublina na celou sekci — dvě hlášky o tomtéž si lezly do cesty.
      box.dataset.tip='Útoky nemáš vyplněné. Současnou bojovou připravenost'
        +' nelze plně vyhodnotit. Doplň útoky v úpravě pokémona nebo je znovu naskenuj.';
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
      /* Kdyz na dva sloty vychazi tataz nahrada, dostane ji ten utok, ktery
         ji potrebuje vic: cerveny (preucit) pred oranzovym (dobry). Driv
         rozhodovalo poradi v radku, takze navrh sebral ten lepsi z nich. */
      if(sTeckou){
       const poradi={preucit:0,dobry:1};
       jmena.map((jm,i)=>({jm,i,stav:stavUtoku(String(jm).trim())}))
        .filter(x=>poradi[x.stav]!==undefined)
        .sort((a2,b2)=>poradi[a2.stav]-poradi[b2.stav])
        .forEach(x=>{
         const cist=cisteJmeno(String(x.jm)).trim().toLowerCase();
         const zeSestavy=(doporucene&&doporucene.length)
          ?(x.i===0?doporucene.slice(0,1):doporucene.slice(1)):[];
         let kand=zeSestavy.find(y=>y&&y.toLowerCase()!==cist
           &&!jmena.some(z=>cisteJmeno(String(z)).trim().toLowerCase()===y.toLowerCase()));
         if(!kand)kand=nahrady.get(cist)||'';
         if(!kand)return;
         if(navrzeno.has(kand.toLowerCase()))return;
         navrzeno.add(kand.toLowerCase());
         prideleno.set(cist,kand);
        });
      }
      jmena.forEach((jm,i)=>{const radek=document.createElement('div');radek.className='atlas-utok-radek';
        if(!sTeckou){const mezera=document.createElement('i');mezera.className='atlas-utok-tecka atlas-utok-mezera';radek.append(mezera)}
        if(sTeckou){const tecka=document.createElement('i');tecka.className='atlas-utok-tecka';
          const stav=stavUtoku(String(jm).trim());tecka.dataset.stav=stav;
          tecka.dataset.tip={nej:'Nejlepší útok, jaký tenhle druh má.',dobry:'Použitelný, ale nejlepší to není.',preucit:'Slabý útok — stojí za přeučení.',nezna:'Kvalita útoku se nedá posoudit.'}[stav]||'';
          radek.append(tecka)}
        radek.append(chipUtoku(String(jm).trim(),i===0));
        if(sTeckou){
          const stav=stavUtoku(String(jm).trim());
          const cist=cisteJmeno(String(jm)).trim().toLowerCase();
          /* Čím ten útok nahradit. Nejdřív doporučená sestava (rychlý za
             rychlý, nabitý za nabitý), a když z ní nic nezbývá, vezme se
             náhrada od enginu — ta je i u oranžového útoku, kde dřív šipka
             nebyla a barva tím pádem neříkala, co s tím. */
          const lepsi=prideleno.get(cist)||'';
          // U `poEvoluci` engine rika "ted neprecuj" — sipka na lepsi utok
          // by mu primo odporovala.
          if(stav!=='nej'&&stav!=='poEvoluci'&&lepsi){
            const sip=document.createElement('em');sip.className='atlas-utok-lepsi';
            sip.textContent=lepsi;
            const proc=duvody.get(cist)||'';
            /* Elitni utok bezny TM nenauci. Bez teto vety to byla rada,
               ktera nejde splnit — a vedle ni stalo "tenhle nech". */
            const elitni=P.atlasElitniUtok?P.atlasElitniUtok(row.pokemon,lepsi):null;
            sip.dataset.tip=(proc?proc+' ':'')+'Lepší volba: '+lepsi
             +(elitni?' — jenže ten jde naučit jen elitním TM, běžný ho nedá.'
               :' — přeučení stojí TM.');
            if(elitni)sip.dataset.elitni='1';
            radek.append(sip);
          }
        }
        sloupec.append(radek)});
      radek.append(sloupec);box.append(radek);
    };
    // Mapa „jméno útoku → jak je dobrý" z útoků, které engine vypsal v detailu.
    const stavy=new Map(),duvody=new Map(),nahrady=new Map(),navrzeno=new Set(),prideleno=new Map();
    // Hodnocení i důvod má engine přímo v datech kusu — spolehlivější než
    // číst je ze značek, které si vrstva vzápětí přestavuje.
    if(c&&Array.isArray(c.utoky))c.utoky.forEach(u=>{
      if(u&&u.jm&&u.nahrada)nahrady.set(cisteJmeno(String(u.jm)).trim().toLowerCase(),u.nahrada);
      const k=cisteJmeno(u.jm||'').toLowerCase();
      if(!k)return;
      if(u.stav&&!stavy.has(k))stavy.set(k,u.stav);
      if(u.proc&&!duvody.has(k))duvody.set(k,u.proc);
    });
    // Bere se jen skutečné hodnocení útoku (engine značí čtyřmi stavy).
    // Dřív sem propadaly i jiné třídy (`d-move-poEvoluci`) a z tečky byl šedý
    // puntík bez významu. První nález vyhrává — ten patří kusu, ne jeho evoluci.
    const ZNAME=['nej','dobry','preucit','nezna','poEvoluci'];
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
    /* Druhy nabity utok. V lize je to jina hrozba a jiny typ poskozeni,
       takze se casto dokupuje; do raidu se skoro nevystreli, protoze deli
       energii. Ukazuje se jen tehdy, kdyz ho kus jeste nema a doporucena
       sestava ho ma — jinak by to byla rada do prazdna. */
    /* Jen u kusu, ktery nejakou ligu opravdu HRAJE. Druhy nabity utok stoji
       prach a bonbony, takze rada "dokup si ho" ma smysl u kusu, ktery ma
       v lize misto — ne u kazdeho, koho PvPoke nekde zna. */
    const hrajeLigu=!!(c&&(c.duvody||[]).some(d=>d&&d.druh==='pvp'));
    const ligove=(P.atlasDoporuceneUtoky?P.atlasDoporuceneUtoky(row):[])||[];
    if(hrajeLigu&&row.fastMove&&row.charged1&&!row.charged2&&ligove.length>2){
     const mam=[row.fastMove,row.charged1].map(x=>cisteJmeno(String(x)).trim().toLowerCase());
     const druhy=ligove.slice(2).find(x=>x&&mam.indexOf(String(x).toLowerCase())===-1);
     if(druhy){
      const radek=document.createElement('div');
      radek.className='atlas-sestava atlas-sestava-plus';
      radek.dataset.sestava='plus:'+String(druhy).toLowerCase();
      radek.dataset.tip='Druhý nabitý útok: '+druhy+'. V lize je to druhá hrozba '
       +'a jiný typ poškození, takže se vyplácí ho dokoupit — stojí prach a bonbóny '
       +'(kolik, řekne hra u toho kusu). Do raidu ho nepřidávej: dělí energii '
       +'a poškození za vteřinu tím klesne.';
      const popisek=document.createElement('small');
      popisek.className='atlas-sestava-kdy';popisek.textContent='+';
      radek.append(popisek);
      const sloupec=document.createElement('div');sloupec.className='atlas-sestava-utoky';
      const r2=document.createElement('div');r2.className='atlas-utok-radek';
      const mezera=document.createElement('i');
      mezera.className='atlas-utok-tecka atlas-utok-mezera';
      r2.append(mezera,chipUtoku(String(druhy).trim(),false));
      sloupec.append(r2);radek.append(sloupec);box.append(radek);
     }
    }
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
        // Kus, ktery utoky MA, uz doporuceni nese sipkou u svych vlastnich
        // utoku. Vypisovat pod tim jeste jednou nejlepsi sestavu tehoz druhu
        // byla cista duplikace — sest utoku misto dvou. Sestavy po evoluci
        // zustavaji, ty rikaji neco jineho.
        if(!/^Po evoluci/.test(h)&&row.fastMove&&row.charged1)return;
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
    if(veta&&!box.dataset.tip)box.setAttribute('data-tip',veta);
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
  container.querySelectorAll('.atlas-verdict-first .dv-radek,.d-verdict .dv-radek')
    .forEach(el=>{el.dataset.radku='1'});
  if(P.srovnejDuvody)requestAnimationFrame(()=>P.srovnejDuvody(container));
  // Po změně šířky okna se „+N" musí přepočítat — jinak zůstane schované
  // to, co se do širšího detailu už vejde (a naopak).
  if(P.srovnejDuvody&&!container.dataset.atlasSirka){
    container.dataset.atlasSirka='1';
    new ResizeObserver(()=>{clearTimeout(container.__t);
      container.__t=setTimeout(()=>{if(container.isConnected)P.srovnejDuvody(container)},80)})
      .observe(container);
  }
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
     const predchozi=body.querySelector('.atlas-box-rozbor');
     // Obrazek si necháme, pokud jde o tentyz sprite: novy uzel by se
     // nacital znovu a ikona pritom probliknout — nejdriv mala, pak
     // vystredena. Pri kliknuti na znacku se prekresluje cely rozbor,
     // takze to bylo videt pokazde.
     const staryObr=predchozi?predchozi.querySelector('.atlas-ident-obr img'):null;
     predchozi?.remove();
     if(!polozka)return;
     const host=document.createElement('div');host.className='atlas-box-rozbor';
     host.innerHTML=window.AtlasIdentitaHTML(polozka.row,false);
     const novyObr=host.querySelector('.atlas-ident-obr img');
     if(staryObr&&novyObr&&staryObr.getAttribute('src')===novyObr.getAttribute('src')){
       novyObr.replaceWith(staryObr);
     }
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
   /* Co si vrstva vlozi sama, observer ignoruje — jinak by se prestavoval
      porad dokola. Krome rozboru je to lista "ve hre jsem s nim neco
      udelal": na telefonu se stehuje sem, a bez teto vyjimky se prestavba
      volala donekonecna a stranka zamrzla. */
   const naseUzly=n=>n.nodeType===1&&n.classList
     &&(n.classList.contains('atlas-box-rozbor')||n.classList.contains('hra-pruh'));
   new MutationObserver(zaznamy=>{
     const jenNase=zaznamy.every(z=>[...z.addedNodes,...z.removedNodes].every(naseUzly));
     if(!jenNase&&!boxPrestavba)boxRozbor();
   }).observe(bmBody,{childList:true});
   window.addEventListener('atlas:refresh-detail',()=>{if(!document.getElementById('boxMode')?.hidden)boxRozbor()});
 }
 // Dokud je čištění boxu otevřené, stránka pod ním se nesmí rolovat —
 // vpravo svítil posuvník celé stránky.
 const boxPrepinac=document.getElementById('boxMode');
 if(boxPrepinac){
   // Hlida se JEN `hidden` a necte se `getComputedStyle`: pri prepinani kusu
   // se na panelu meni tridy porad dokola a kazda zmena tak vynutila prepocet
   // stylu cele stranky. Otevreni a zavreni jde vzdycky pres `hidden`.
   const zamek=()=>{const otevreno=!boxPrepinac.hidden;
     document.body.classList.toggle('atlas-box-otevreno',otevreno);
     // Po zavreni panelu se dozene to, co se pod nim nekreslilo. Hlida se
     // to tady, protoze `hidden` se meni pri KAZDE ceste ven z cisteni.
     if(!otevreno)window.AtlasDoplnitRoster?.();};
   new MutationObserver(zamek).observe(boxPrepinac,{attributes:true,attributeFilter:['hidden']});
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
 const image=name=>{const key=P.dexKeyOf(name),src=window.ATLAS_ART?.[key];if(src)return `<img src="${esc(src)}" alt="${esc(name)}" loading="lazy">`;const fallback=P.atlasImage(name)||'',id=fallback.match(/pm(\d+)\.icon\.png/);if(!id)return fallback;const original=fallback.match(/src="([^"]+)"/)?.[1]||'';return fallback.replace('<img ','<img data-overview-art="true" ').replace(/alt="[^"]*"/,`alt="${esc(name)}"`).replace(/src="[^"]*"/,`src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${Number(id[1])}.png"`).replace(/data-zaloha="([^"]*)"/,`data-zaloha="${original}|$1"`)};
 const sections={spawn:'Ve volné přírodě',raid:'Souboje',vejce:'Z vajec',vyzkum:'Výzkumy a odměny',bonus:'Bonusy',utoky:'Speciální útoky',shiny:'Shiny',novinky:'Další obsah akce'};
 let selected=day(new Date()),lastToday=selected,offset=0,events=[],root;
 const modal=document.createElement('dialog');modal.id='atlasEventDialog';modal.className='atlas-event-dialog';modal.setAttribute('aria-labelledby','atlasEventTitle');document.body.append(modal);
 function overlap(e,start,finish){const a=date(e[3]),b=end(e[4]);return !!(a&&b&&a<finish&&b>start)}
 function live(e){return overlap(e,new Date(),new Date(Date.now()+1))}
 // Druh, ktery akce doopravdy nese. Data ho maji pod nadpisem
 // "Featured Pokemon" (polozka s prinakem -1 je nadpis, 1 je pokemon),
 // takze se neni potreba dohadovat z nazvu. Bez tohohle vyslo u akce
 // "Phantump Catch Mastery" Cherubi a Drifloon — spawny ano, ale hlavni
 // druh akce ne.
 function featuredDruhy(e){
  const ven=[];
  for(const okno of (e[7]||[])){
   const bloky=okno&&okno[2];if(!bloky)continue;
   for(const klic of Object.keys(bloky)){
    const seznam=bloky[klic];if(!Array.isArray(seznam))continue;
    let bere=false;
    for(const polozka of seznam){
     if(!Array.isArray(polozka))continue;
     const text=String(polozka[0]||''),priznak=polozka[1];
     if(priznak===-1){bere=/featured\s+pok/i.test(text);continue}
     /* 0/1 je shiny, ne "je to druh". Hlavnim druhem akce je i ten, u nehoz
        shiny neni — drive takovy vypadl a akci reprezentoval nahodny spawn.
        Ze o druh jde, rozhoduje dex: textovy bonus se tim do seznamu
        nedostane. Forma zustava, jak ji uvadi zdroj. */
     if(bere&&text&&P.dexKeyOf&&P.dexKeyOf(text)&&!ven.includes(text))ven.push(text);
    }
   }
  }
  return ven;
 }
 function eventNames(e){const names=[...new Set((e[7]||[]).flatMap(w=>((w[2]?.raid?.length?w[2].raid:w[2]?.spawn)||[]).filter(x=>x[1]!==-1).map(x=>x[0])).concat((e[6]||[]).filter(x=>x[1]!==-1).map(x=>x[0])))];
  // Nejdriv hlavni druh z dat, az potom spawny. Poradi rozhoduje o tom,
  // ktery obrazek akci reprezentuje.
  featuredDruhy(e).reverse().forEach(name=>{
   if(!P.dexKeyOf(name)||!P.atlasImage(name))return;
   const i=names.indexOf(name);if(i>-1)names.splice(i,1);
   names.unshift(name);
  });
  // Sablona v nazvu je druha moznost — ridi se nazvem akce, ne jejim
  // typem: "Phantump Catch Mastery" ma typ "event", takze podle typu
  // se nepoznala. Jmeno se vzdycky overi proti dexu.
  if(/(Raid Hour|Spotlight Hour|Community Day(?: Classic)?|Catch Mastery|during Max Monday)$/i.test(String(e[0]))
    ||/raid-hour|spotlight|community-day|max-monday|catch-mastery/.test(e[1])){const stem=String(e[0]).replace(/ (?:Raid Hour|Spotlight Hour|Community Day(?: Classic)?|Catch Mastery|during Max Monday)$/i,'');stem.split(/,\s*(?:and\s+)?|\s+and\s+/).reverse().forEach(name=>{if(!names.includes(name)&&(window.ATLAS_ART?.[P.dexKeyOf(name)]||P.atlasImage(name)))names.unshift(name)})}return names.slice(0,3)}
 function bossCards(es){return es.flatMap(e=>{const names=eventNames(e);return (names.length?names:[null]).map(name=>`<button class="atlas-boss" data-event-index="${events.indexOf(e)}"><span class="atlas-boss-art">${name?image(name):'<span aria-hidden="true">◇</span>'}</span><b>${esc(name&&/^Shadow /.test(e[0])&&!/^Shadow /.test(name)?'Shadow '+name:name||e[0])}</b><small>${/^max-/.test(e[1])?'Max souboj':'Raid'} · ${format(e[4])}</small></button>`)}).join('')}
 /* Okno akce, ktere pro dany den plati. Akce mivaji vic casti a kazda
    svuj obsah — bonus z jineho okna by o tom dni lhal. Sdili to karta
    Prehledu i nahled v kalendari. */
 function oknoDne(e,d){const den=d||new Date();
  return (e[7]||[]).filter(w=>date(w[0])&&date(w[1]))
   .find(w=>date(w[0])<=den&&date(w[1])>den)||null}
 /* Cim je akce zajimava, jednou vetou. Poradi je dane tim, co clovek
    nejspis hleda: platny bonus, pak potvrzeny hlavni druh. Kdyz v datech
    nic takoveho neni, rekne se to — vymyslet se nic nesmi. */
 function prinos(e,d){
  const bloky=(oknoDne(e,d)||[])[2]||{};
  const veta=x=>Array.isArray(x)&&x[1]!==-1?String(x[0]||'').trim():'';
  const bonus=(bloky.bonus||[]).map(veta).filter(Boolean)[0];
  if(bonus)return bonus;
  const druhy=eventNames(e).filter(n=>P.dexKeyOf&&P.dexKeyOf(n));
  if(druhy.length)return druhy.slice(0,3).join(' · ');
  return 'Podrobnosti ve zdroji';
 }
 function card(e){
 const a=date(e[3]),b=end(e[4]),now=new Date(),tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1),afterTomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+2);
 const label=!a||!b?'Termín nepotvrzen':b<=now?'Ukončeno':a>now?(a>=tomorrow&&a<afterTomorrow?'Zítra':'Chystá se'):(b<=tomorrow?'Končí dnes':'Probíhá');
 const kind=/^max-/.test(e[1])?'max':/raid/.test(e[1])?'raid':/research|choose-your-path/.test(e[1])?'research':'event';
 const names=eventNames(e);
 const title=String(e[0]).replace(/ during Max Monday$/i,'').replace(/ in (?:5-star Raid Battles|Mega Raids|Shadow Raids)$/i,'').replace(/: The Series Celebration Event 2026$/i,'').replace(/Pokémon Horizons Bonus Timed Research/i,'Pokémon Horizons: bonusový výzkum');
 return `<button class="atlas-event-card" data-event-kind="${kind}" data-event-state="${b&&b<=tomorrow?'ending':a&&a>now?'upcoming':'live'}" data-event-index="${events.indexOf(e)}" title="${esc(e[0])}"><span class="atlas-event-visual"><span class="atlas-event-status">${label}</span><span class="atlas-event-art">${names.map(image).join('')||'<span class="atlas-event-bez-obrazku" aria-hidden="true">◇</span>'}</span></span><span class="atlas-event-copy"><span class="atlas-event-category">${{max:'Max souboje',raid:'Raidy',research:'Výzkum',event:'Událost'}[kind]}</span><h3>${esc(title)}</h3><span class="atlas-event-prinos">${esc(prinos(e))}</span><span class="atlas-event-date">${format(e[3])} → ${format(e[4])}</span><span class="atlas-event-link">Prohlédnout akci <span aria-hidden="true">→</span></span></span></button>`;
 }
 function list(items,kind){return `<div class="atlas-event-species">${items.map(([name,shiny])=>shiny===-1?`<h4>${esc(name)}</h4>`:`<div class="atlas-event-specimen">${['spawn','raid','vejce','shiny'].includes(kind)?image(name):''}<span>${esc(name)}${shiny===1?' <small>✦ shiny dostupné</small>':''}</span></div>`).join('')}</div>`}
 /* Stitky akce (Akce, Raidy, Jen v nekterych zemich) a veta o omezeni.
    Oboji je ze stranky zdroje; veta se neprekláda — co tam stoji, stoji tam
    anglicky, a prepsat ji za zdroj by znamenalo tvrdit neco jineho. */
 function stitkyAkce(e){
  const d=e&&e[8]||{};
  const stitky=(d.stitky||[]).map(([klic,popis])=>
   `<span class="atlas-event-stitek" data-stitek="${esc(klic)}">${esc(popis)}</span>`).join('');
  const omezeni=d.omezeni
   ?`<p class="atlas-event-omezeni">Omezení podle zdroje: ${esc(d.omezeni)}</p>`:'';
  return (stitky?`<div class="atlas-event-stitky">${stitky}</div>`:'')+omezeni;
 }

 function openEvent(i){const e=events[i];if(!e)return;const url=safeUrl(e[5]);modal.innerHTML=`<header><div><span class="atlas-eyebrow">TAHÁK AKCE</span><h2 id="atlasEventTitle">${esc(e[0])}</h2><p>${format(e[3])} — ${format(e[4])}</p>${stitkyAkce(e)}</div><button class="atlas-mini-btn" data-event-close aria-label="Zavřít detail akce">✕</button></header><div class="atlas-event-body">${(e[7]||[]).map(w=>`<section class="atlas-event-window"><p class="atlas-small-note">Platnost této části: ${format(w[0])} — ${format(w[1])}</p>${Object.entries(w[2]||{}).filter(([k,v])=>Array.isArray(v)&&v.length).map(([k,v])=>`<details open><summary>${esc(sections[k]||k)}</summary>${list(v,k)}</details>`).join('')}</section>`).join('')||'<p>Podrobný obsah není ve zdroji k dispozici.</p>'}<p class="atlas-small-note">Seznam popisuje obsah akce, nikoli živé spawny v okolí. Dostupné shiny neznamená zvýšenou šanci. Podmínky a zvláštní časová okna ověř ve zdroji.</p><div class="atlas-event-actions"><button class="atlas-mini-btn" data-event-teams>Otevřít Tahák soubojů</button>${url?`<a class="atlas-mini-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Zdroj akce ↗</a>`:''}</div></div>`;modal.showModal();}
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
 root.innerHTML=`<div class="atlas-overview"><div class="atlas-overview-intro"><span class="atlas-feed-note">Data: ${esc(stamp||'datum neznámé')}${stale?' · Aktualitu ověř ve zdroji':''}</span></div><section class="atlas-panel atlas-overview-calendar"><div class="atlas-panel-head"><h2>Dnes a brzy</h2><div><button class="atlas-mini-btn" data-overview-week="-7" aria-label="Předchozí týden">←</button> <button class="atlas-mini-btn" data-overview-today>Dnes</button> <button class="atlas-mini-btn" data-overview-week="7" aria-label="Další týden">→</button></div></div><div class="atlas-event-grid">${shown.slice(0,3).map(card).join('')||'<p class="atlas-empty">Pro tento den nemáme potvrzenou akci.</p>'}</div><div class="atlas-week">${days}</div>${shown.length>3?`<p class="atlas-small-note">${(n=>n===1?'Další 1 akci':n<=4?'Další '+n+' akce':'Dalších '+n+' akcí')(shown.length-3)} najdeš v úplném kalendáři.</p>`:''}<button class="atlas-mini-btn" data-atlas-nav="events">Celý kalendář →</button></section><div class="atlas-battle-columns">${[[raids,'Raidy'],[max,'Max souboje']].map(([es,title])=>`<section class="atlas-panel"><div class="atlas-panel-head"><h2>${title==='Max souboje'&&!maxLive.length&&max.length?'Nejbližší Max akce':title}</h2></div>${title==='Max souboje'&&!maxLive.length&&max.length?'<p class="atlas-small-note">Nejbližší potvrzená akce · pro dnešek nemáme potvrzený seznam bossů.</p>':''}<div class="atlas-boss-grid">${bossCards(es)||'<p class="atlas-empty">V datech není potvrzené aktuální okno. To neznamená, že žádné souboje neběží.</p>'}</div><p class="atlas-small-note">Dostupnost podle termínů akcí${stale?', data mohou být zastaralá':''}. Sestavu ověř v Taháku.</p><button class="atlas-mini-btn" data-overview-teams>Otevřít Tahák →</button></section>`).join('')}</div><section class="atlas-panel atlas-home-spawns"><div class="atlas-panel-head"><h2>Co teď potkáš</h2></div><p class="atlas-small-note">Platí časová a další omezení u jednotlivých skupin. Nejde o živou mapu okolí.</p>${spawns.map(({e,w})=>`<details class="atlas-spawn-preview"><summary>${esc(e[0])}</summary>${list(w[2].spawn,'spawn')}<button class="atlas-mini-btn" data-event-index="${events.indexOf(e)}">Podmínky a další obsah →</button></details>`).join('')||'<p class="atlas-empty">Nemáme potvrzený seznam spawnů pro právě probíhající časové okno.</p>'}</section><section class="atlas-panel atlas-home-plans"><div class="atlas-panel-head"><div><h2>Co připravit jako první</h2><p>První kroky v pořadí enginu. Dostupnost prachu a bonbónů si ověř.</p></div><button class="atlas-mini-btn" data-atlas-nav="invest">Celý plán →</button></div><div class="atlas-plan-preview">${plans.slice(0,2).map(p=>`<button class="atlas-plan-card" data-atlas-detail="${esc(p.row.id)}">${image(p.row.pokemon)}<div><h3>${esc(p.row.pokemon)}</h3><p>${esc(p.role||c[p.row.id]?.keepSub)}</p><b>${p.evoluce?'Evoluce a další krok':'Vylepšení'}${p.cilJmeno?' → '+esc(p.cilJmeno):''}</b><span class="atlas-plan-open">Otevřít Pokémona →</span></div></button>`).join('')||'<p class="atlas-empty">Engine nyní nenabízí ověřený investiční krok.</p>'}</div></section><section class="atlas-panel"><div class="atlas-panel-head"><h2>Před hraním</h2></div><div class="atlas-preflight"><button class="atlas-mini-btn" data-click="boxModeBtn">Projít pokémony</button><button class="atlas-mini-btn" data-atlas-filter="missing">Doplnit útoky · ${missing} kusů</button><button class="atlas-mini-btn" data-atlas-nav="events">Ověřit termíny a bonusy</button></div></section></div>`;
 const spawnPanel=root.querySelector('.atlas-home-spawns'),planPanel=root.querySelector('.atlas-home-plans');if(spawnPanel&&planPanel)planPanel.after(spawnPanel);
 const heading=document.querySelector('#atlasHeading');if(__atlasTest.getState().view==='home'){heading.querySelector('h1').textContent='Co dnes stojí za to'}
 window.AtlasDecorateHome?.();
 }
 window.AtlasRenderHome=render;
 window.AtlasEventUI={card:e=>card(e),image,format,open:i=>openEvent(i),names:eventNames,oknoDne,prinos};
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

/* Vyhledávání: hledání nahoru, údaje kusu do rozbalovátka, identita druhu
   s tím, co člověk chce vědět dřív, než se rozhodne jít na raid.

   Původně stránka začínala řadou devíti polí přes celou šířku a velkým
   prázdným panelem — devět stejně důležitě vypadajících okének, z nichž
   povinné je jedno. Teď se ptá na jednu věc a zbytek nabídne, až když je
   o něj zájem. Návrh A-013 od Astry. */
(() => {
 const $=s=>document.querySelector(s),P=window.__pgo;
 const karta=$('#prohlidkaCard');if(!karta)return;
 const mrizka=karta.querySelector('.proh-grid'),vysledek=$('#prohOut');
 const jmeno=$('#prohName');if(!mrizka||!vysledek||!jmeno)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

 /* Obrazek druhu v ramecku.

    Sprity z hry maji kazdy jinou pozici v pruhlednem platne a engine je
    dorovnava pres `transform` na samotnem <img> — posune ho a az o pulku
    zvetsi. Ramecek proto nesmi byt na obrazku: zvetseni by roztahlo i
    jeho pozadi a posun v procentech by se meril z jineho boxu, takze
    sprite vylezl z dlazdice a sedel nakrivo. Obal drzi rozmer, obrazek
    se v nem hybe. Stejne to ma identita kusu (`.atlas-ident-obr`). */
 const obrazekRam=(jmeno,trida,hotove,vzhled)=>hotove||P.atlasImage
  ?`<span class="atlas-obr-ram ${trida}">${hotove||P.atlasImage(jmeno,'',vzhled)}</span>`:'';

 /* Výsledková tabulka. Jedna role, jedna liga, jedna tabulka — dřív se
    všechny evoluce a všechny ligy skládaly pod sebe a v tom seznamu
    nešlo nic najít. Data dává engine (`prohlidkaModel`); vrstva z nich
    jen kreslí, nic nepočítá znovu. */
 const ROLE_POPIS={pvp:'PvP',raid:'Raidy',gym:'Gym',mega:'Mega',max:'Max'};
 /* Vlastni ikonky zalozek: `icon()` z hlavni vrstvy sem nedosahne (jiny
    uzaver) a ctyri cary staci. Navrh V2 od Astry. */
 const ROLE_IKONA={
  pvp:'M5 19 19 5M5 5l4 4m10 10-4-4',
  raid:'M12 3l7 7-7 11-7-11z',
  gym:'M7 21V4m0 1 11 3-11 3',
  mega:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
  max:'M12 3v18M4 8l8-5 8 5v8l-8 5-8-5Z'};
 const ikona=k=>`<svg class="atlas-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${ROLE_IKONA[k]}"/></svg>`;
 /* Klic ligy, kterou ma clovek vybranou — stejny, jakym ji zna engine. */
 let ligaKlicVModelu='great';
 let role='pvp',liga='great',shinyVic=false;
 /* Ke kteremu druhu patri to, co je zrovna v tabulce, a proc se pripadne
    ukazuje jina role, nez byla vybrana. Vysledek se prekresluje vickrat
    (engine si o tom rekne sam), takze si to hlaseni musi pamatovat —
    jinak probliklo a zmizelo. */
 let vysledekDruh=null,presunZprava='';
 /* Prepnuty shiny obrazek. Meni se JEN obrazek — jina barva neni jiny druh,
    takze cisla, poradi ani sestavy zustavaji. Po zmene druhu se vraci na
    bezny obrazek: shiny u predchoziho druhu o tomhle nic nerika. */
 let shinyObrazek=false,shinyDruh=null;
 /* Forma, ve ktere se druh zrovna prohlizi. Drzi ji text v poli, takze je
    jen jedno misto pravdy — prepinac pole prepise. */
 let formaStav='';
 /* Uz natazene shiny obrazky — at se to u tehoz druhu nedela pokazde znovu. */
 const shinyPredem=new Set();
 /* Evoluce a naklady (V3, sekce 6). `evoCil` je JEDNA vybrana cesta;
    bez ni se zadna cena neukazuje — soucet vsech osmi vetvi Eevee je
    cislo, ktere nikdo nikdy nezaplati. `evoDruh` hlida, ze vyber patri
    k pravé zobrazenemu druhu: po zmene hledani se zahodi. */
 let evoCil=null,evoMega=null,evoLevel=40,evoDruh=null;

 function vysledekBlok(){
  let el=karta.querySelector('.atlas-vysledky');
  if(!el){
   /* Dve karty vedle sebe, ne jedna: v navrhu ma kazda svuj ramecek
      a svou vysku. V jedne karte se tabulka natahovala na vysku
      evolucniho panelu a pod dvema radky zustavalo prazdno. */
   el=document.createElement('div');el.className='atlas-vysledky';
   panel('prehled').append(el);
  }
  return el;
 }

 /* Pas "CP pri 100 % IV" (V3, sekce 3).

    Pet bunek se stejnym vyznamem: kolik ma dokonaly kus na tom levelu.
    Vejce a raid maji tyz level schvalne — je to tyz vypocet ve dvou
    kontextech, ne dve ruzna cisla. Pas NERIKA, ze druh z toho zdroje
    prave pada; to plyne z rozpisu akci, ne z pokedexu. */
 /* Od nejnizsiho levelu po nejvyssi — cisla pak jdou vzestupne a da se
    v nich cist. Raid a vejce jsou tataz hodnota (oboji chytas na L20),
    takze stoji v jedne bunce; dve stejna cisla vedle sebe jen matla. */
 /* Ikonky pocasi. Ve hre je kazde pocasi obrazkem, takze samotny nazev
    u "Raid s pocasim" clovek hleda dvakrat. Kresli se stejne jako ostatni
    ikony vrstvy: tah, zadna vypln. */
 const POCASI_IKONA={
  'Jasno':'M12 5V2M12 22v-3M5 12H2M22 12h-3M6.3 6.3 4.2 4.2M19.8 19.8l-2.1-2.1M17.7 6.3l2.1-2.1M4.2 19.8l2.1-2.1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  'Polojasno':'M8 6a3.5 3.5 0 1 1 3.4 4.4M8 3.5V2M4.5 6H3M5.5 3.5 4.4 2.4M17 19H8a4 4 0 0 1 0-8 5 5 0 0 1 9.4 1.5A3.3 3.3 0 0 1 17 19Z',
  'Zataženo':'M17 18H8a4 4 0 0 1 0-8 5 5 0 0 1 9.4 1.5A3.3 3.3 0 0 1 17 18Z',
  'Déšť':'M17 15H8a4 4 0 0 1 0-8 5 5 0 0 1 9.4 1.5A3.3 3.3 0 0 1 17 15ZM9 18l-1 3M13 18l-1 3M17 18l-1 3',
  'Vítr':'M3 8h10a3 3 0 1 0-3-3M3 12h14a3 3 0 1 1-3 3M3 16h7',
  'Sníh':'M12 4v16M4.5 8l15 8M19.5 8l-15 8',
  'Mlha':'M3 9h18M5 13h14M3 17h12'};
 const pocasiChip=n=>`<span class="atlas-pocasi" title="${esc(n)}">`
  +`<svg class="atlas-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${POCASI_IKONA[n]||''}"/></svg>`
  +`${esc(n)}</span>`;

 const CP_BUNKY=[
  ['Výzkum · L15',15],
  ['Raid a vejce · L20',20],
  ['Raid s počasím · L25',25],
  ['Strop · L40',40]];
 function cpPasBlok(){
  let el=karta.querySelector('.atlas-cp-pas');
  if(!el){el=document.createElement('section');el.className='atlas-cp-pas'}
  const zalozky=karta.querySelector('.atlas-sekce');
  if(zalozky){if(el.nextElementSibling!==zalozky)zalozky.before(el)}
  else if(!el.parentElement)identita.after(el);
  return el;
 }
 function vykresliCpPas(d,pocasi){
  const el=cpPasBlok();
  if(!d){el.hidden=true;el.innerHTML='';return}
  el.hidden=false;
  const seznamPocasi=(pocasi||[]).filter(Boolean);
  const bunky=CP_BUNKY.map(([popis,lvl])=>{
   const cp=P.atlasCP?P.atlasCP(d.name,lvl):null;
   /* Popisek nad cislem a barevny prouzek vlevo — stejna karta jako
      "Na co je" v rozboru. Barva je u vsech stejna: jsou to referencni
      cisla, ne hodnoceni, a barva podle vyznamu by tu lhala. */
   const [co,kdy]=popis.split(' · ');
   /* U "Raid s pocasim" patri k cislu i to, PRI JAKEM pocasi plati —
      jinak je to cislo bez podminky. Stoji vedle nadpisu bunky, aby cislo
      a level zustaly na stejne vysce jako v ostatnich bunkach. */
   const pocasiHtml=lvl===25&&seznamPocasi.length
    ?`<span class="atlas-cp-pocasi">${seznamPocasi.map(pocasiChip).join('')}</span>`:'';
   return `<div class="atlas-cp-bunka"><span class="atlas-cp-hlava">${esc(co)}${pocasiHtml}</span>`
    +`<b>${cp==null?'—':cp}</b>`
    +`<i>${esc(kdy||'')}</i>`
    +(cp==null?'<small>staty téhle formy nemáme</small>':'')+`</div>`;
  }).join('');
  el.innerHTML=`<h4 class="atlas-cp-nadpis" id="atlasKotvaCisla" tabindex="-1">CP při 100 % IV</h4>`
   +`<div class="atlas-cp-mrizka">${bunky}</div>`;
 }

 /* Sekce jako zalozky.

    Drive to byl jeden dlouhy sloupec: vysledky, evoluce, rozbor a
    formular pod sebou, takze se ke konci clovek prorolovaval pres celou
    stranku. Ted se prepinaji zalozkami — stejnym ovladanim, jakym se uz
    prepinaji role uvnitr vysledku. Identita a pas CP zustavaji nad nimi,
    protoze plati pro vsechny sekce.

    Obsah se do zalozek PRESOUVA, nekopiruje: `#prohOut` i formular kusu
    nesou posluchace enginu a kopie by prestala zit. */
 const SEKCE=[
  ['prehled','Přehled'],
  ['typy','Typy'],
  ['evoluce','Evoluce'],
  ['rozbor','Rozbor'],
  ['kus','Můj kus']];
 let sekce='prehled';
 function sekceBlok(){
  let el=karta.querySelector('.atlas-sekce');
  if(!el){
   el=document.createElement('div');el.className='atlas-sekce';
   el.innerHTML='<div class="atlas-sekce-zalozky" role="tablist" aria-label="Části stránky"></div>'
    +SEKCE.map(([k])=>`<div class="atlas-sekce-panel" data-sekce="${k}" role="tabpanel" tabindex="-1"></div>`).join('');
   /* Jedna obsluha na cely blok: obsah sekci se prekresluje a posluchac
      poveseny na jednotlivych tlacitkach by se s nim ztratil. */
   el.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.sekcePrepnout){prepniSekci(b.dataset.sekcePrepnout);return}
    if(b.dataset.role){role=b.dataset.role;presunZprava='';
     vykresliVysledek();return}
    if(b.dataset.liga){liga=b.dataset.liga;ligaKlicVModelu=b.dataset.liga;
     presunZprava='';vykresliVysledek();return}
    /* Vyber cesty ve stromu. Mega je jina vec nez evoluce, takze se
       nevybiraji obe najednou. */
    if(b.dataset.evoCil){
     evoCil=evoCil===b.dataset.evoCil?null:b.dataset.evoCil;evoMega=null;
     vykresliVysledek();return}
    if(b.dataset.evoMega){
     evoMega=evoMega===b.dataset.evoMega?null:b.dataset.evoMega;evoCil=null;
     vykresliVysledek();return}
    if(b.dataset.evoLevel){evoLevel=Number(b.dataset.evoLevel);vykresliVysledek();return}
    /* Vyhledat jiny clanek rady: prepise se pole a pusti se tyz vypocet
       jako pri psani — vrstva si nic vlastniho nepocita. */
    if(b.dataset.evoHledat){
     jmeno.value=b.dataset.evoHledat;
     /* Napoveda jmen patri psani, ne klepnuti: druh uz je vybrany, takze
        by jen prekryla vysledek, ktery si clovek vyzadal. */
     jmeno.dataset.tiseVybrano='1';
     jmeno.dispatchEvent(new Event('input',{bubbles:true}));
     evoCil=null;evoMega=null;
     window.scrollTo({top:0,behavior:'smooth'});
     return}
    /* Jina forma je jiny druh se svymi staty — otevre se jako samostatne
       hledani, ne jako vetev teto stranky. */
    if(b.dataset.evoForma){
     jmeno.value=b.dataset.evoForma;
     jmeno.dispatchEvent(new Event('input',{bubbles:true}));
     jmeno.dispatchEvent(new Event('change',{bubbles:true}));
     return;
    }
    if(b.hasAttribute('data-zpet-vysledky')){prepniSekci('prehled');return}
    /* Counter mod pracuje s TVYM rosterem — appka zadny vlastni seznam
       protihracu nevymysli. Prazdny roster to rekne na miste. */
    if(b.hasAttribute('data-counter-rezim')){
     const jmenoDruhu=jmeno.value.trim();
     if(!P.getRows().length){
      b.insertAdjacentHTML('afterend',
       '<p class="atlas-typy-pozn" data-counter-hlaska>Nejdřív si naimportuj roster — '
       +'protihráče vybírá appka z toho, co máš ty.</p>');
      b.disabled=true;return;
     }
     window.__atlasTest&&window.__atlasTest.go('roster');
     const t=P.atlasProtiBossovi&&P.atlasProtiBossovi(jmenoDruhu);
     if(!t||!t.length)window.__atlasTest&&window.__atlasTest.go('teams','cheatCard');
     return;
    }
   });
   (karta.querySelector('.atlas-cp-pas')||identita).after(el);
  }
  return el;
 }
 function panel(k){return sekceBlok().querySelector('.atlas-sekce-panel[data-sekce="'+k+'"]')}
 function prepniSekci(k,tise){
  if(!SEKCE.some(([x])=>x===k))return;
  sekce=k;
  /* Zalozka "Muj kus" rezim ZAPINA, a to jen pri skutecnem kliknuti:
     `tise` znamena prekresleni, a to by rezim porad vracelo zpatky, i kdyz
     uz je formular prazdny. Vypina ho vymazani CP a IV, ne odchod ze
     zalozky — jinak by clovek o svuj kus prisel tim, ze se jde podivat
     do vysledku. */
  if(!tise&&k==='kus'&&rezim()!=='kus')prepni('kus');
  const el=sekceBlok();
  el.querySelectorAll('.atlas-sekce-panel').forEach(x=>{x.hidden=x.dataset.sekce!==k});
  el.querySelectorAll('[data-sekce-prepnout]').forEach(b=>{
   const je=b.dataset.sekcePrepnout===k;
   b.setAttribute('aria-selected',String(je));b.setAttribute('aria-pressed',String(je));
  });
  if(!tise){const x=panel(k);if(x)x.focus({preventScroll:true})}
 }
 /* Rozbor z enginu a formular kusu se PRESUNOU do svych zalozek. */
 /* Co v Rozboru nema byt: hlavicka s nazvem a rolemi (stoji uplne nahore
    v karte druhu) a zavirajici odstavce, ktere posilaly do zalozek, ktere
    jsou na dosah. Engine je kresli do sveho vystupu, vrstva je odebira. */
 function uklidRozbor(){
  const out=karta.querySelector('.proh-out');if(!out)return;
  out.querySelectorAll('.d-verdict-row,.proh-hint,.d-utoky-druh .d-note')
   .forEach(x=>x.remove());
 }
 function presunDoSekci(){
  const rozbor=panel('rozbor'),kus=panel('kus');
  if(rozbor&&vysledek.parentElement!==rozbor)rozbor.append(vysledek);
  /* Typove zasahy maji vlastni zalozku, takze v rozboru uz nestoji —
     ale musi se odsud dat dojit, jinak by to vypadalo, ze zmizely. */
  /* Odkaz na zalozku Typy tu byl, dokud zalozky nebyly videt. Ted stoji
     nad obsahem, takze veta jen opakovala, co je na obrazovce. */
  rozbor&&rozbor.querySelectorAll('.atlas-rozbor-pozn').forEach(x=>x.remove());
  if(kus&&udaje.parentElement!==kus){kus.append(udaje);udaje.open=true}
  /* V zalozce uz neni co schovavat: obsah zalozky se otevira zalozkou,
     druhe rozbalovatko nad nim bylo navic. */
  if(kus){udaje.open=true;udaje.classList.add('atlas-hledani-udaje-vzdy')}
  uklidRozbor();
 }
 function vykresliKotvy(je){
  const el=sekceBlok();
  el.hidden=!je;
  presunDoSekci();
  el.querySelector('.atlas-sekce-zalozky').innerHTML=SEKCE.map(([k,popis])=>
   '<button type="button" role="tab" data-sekce-prepnout="'+k+'" aria-selected="'+(sekce===k)+'"'
   +' aria-pressed="'+(sekce===k)+'"><span>'+esc(popis)+'</span></button>').join('');
  prepniSekci(sekce,true);
 }

 /* Typova stranka druhu (V3, sekce 5).

    Dve casti, protoze jsou to dve ruzne otazky: cim ho zasahnes (jeho
    obrana) a kam se hodi jeho utoky (jejich typy, ne jeho). Nasobky
    pocita engine na KOMBINACI typu — vlastni tabulku si vrstva nedela. */
 const TYP_SKUPINY=[
  [2.5,'Dvojnásobná slabina','slabina2'],
  [1.5,'Slabina','slabina'],
  [0.9,'Normální zásah','normal'],
  [0.5,'Odolnost','odolnost'],
  [0,'Dvojnásobná odolnost','odolnost2']];
 function skupinaNasobku(n){
  for(const [mez,popis,tr] of TYP_SKUPINY)if(n>=mez)return [popis,tr];
  return ['Dvojnásobná odolnost','odolnost2'];
 }
 function typChip(t){
  const barvy=P.typeColors?P.typeColors():{};
  return `<span class="d-type" style="background:${esc(barvy[t]||'')}">${P.typIkona?P.typIkona(t):''}${esc(t)}</span>`;
 }
 function vykresliTypy(d){
  const cil=panel('typy');if(!cil)return;
  const t=d&&P.atlasTypovka?P.atlasTypovka(d.name):null;
  if(!t){cil.innerHTML='';return}
  /* Radky se seskupi podle nasobku, at se to da precist bez pocitani. */
  const skupiny=new Map();
  t.obrana.forEach(x=>{
   const [popis,tr]=skupinaNasobku(x.nasobek);
   if(!skupiny.has(popis))skupiny.set(popis,{tr,nasobek:x.nasobek,typy:[]});
   skupiny.get(popis).typy.push(x.typ);
  });
  const obranaHtml=[...skupiny.entries()].map(([popis,v])=>
   `<div class="atlas-typy-radek" data-stupen="${v.tr}"><b>${esc(popis)}</b>`
   +`<span class="atlas-typy-nasobek">×${String(v.nasobek).replace('.',',')}</span>`
   +`<div class="atlas-typy-chipy">${v.typy.map(typChip).join('')}</div></div>`).join('');
  const u=t.utok;
  const utokHtml=u
   ?`<p class="atlas-typy-pozn">Počítá se z doporučené sestavy druhu: `
     +`<b>${esc(u.sestava.join(' + '))}</b> (${u.typy.map(esc).join(' · ')}).</p>`
     +(u.dvojity.length?`<div class="atlas-typy-radek" data-stupen="slabina2" data-bez-cisla="1"><b>Dvojnásobně zasáhne</b>`
       +`<div class="atlas-typy-chipy">${u.dvojity.map(x=>kombinaceChip(x.klic)).join('')}</div></div>`:'')
     +(u.vyhoda.length?`<div class="atlas-typy-radek" data-stupen="slabina" data-bez-cisla="1"><b>Má výhodu proti</b>`
       +`<div class="atlas-typy-chipy">${u.vyhoda.map(x=>kombinaceChip(x.klic)).join('')}</div></div>`:'')
     +(u.vyrusene.length?`<div class="atlas-typy-radek" data-stupen="normal" data-bez-cisla="1"><b>Výhoda se vyruší u</b>`
       +`<div class="atlas-typy-chipy">${u.vyrusene.map(x=>kombinaceChip(x.klic)).join('')}</div></div>`:'')
   :'<p class="atlas-typy-pozn">Doporučenou sestavu appka pro tenhle druh nemá, takže o jeho útocích nic netvrdí.</p>';
  cil.innerHTML=`<section class="atlas-typy">`
   +`<h4>Čím ho zasáhneš</h4>`
   +`<p class="atlas-typy-pozn">Násobky platí pro jeho kombinaci typů `
   +`(${t.typy.map(esc).join(' · ')}), ne pro každý typ zvlášť.</p>`
   +obranaHtml
   +`<h4 class="atlas-typy-druhy">Kam se hodí jeho útoky</h4>`
   +utokHtml
   +`<button type="button" class="atlas-typy-counter" data-counter-rezim>`
   +`Vybrat protihráče z mého rosteru</button>`
   +`</section>`;
 }


 /* Evoluce a naklady (V3, sekce 6).

    Vlevo strom cele rady, vpravo podrobnosti JEDNE vybrane cesty. Plna
    sipka je evoluce; mega visi na prerusovane vetvi zvlast, protoze to
    neni evoluce, ale docasna forma — a plati se energii, ne bonbony.

    Nic se tu nepocita: cestu, podminky i cenu dava engine
    (`atlasEvoStrom`, `atlasEvoCena`). Vrstva jen kresli. */
 const cislo=n=>Number(n||0).toLocaleString('cs-CZ');

 /* Veta o podminkach. Prazdny seznam sam o sobe nic nerika — proto se
    ptame enginu na STAV: „zadne" je overeny udaj, „nevime" je poctive
    priznani, ze data chybi. */
 function evoPodminkyVeta(h){
  if(h.stav==='jsou')return esc(h.podminky.join(' · '));
  if(h.stav==='zadne')return 'Kromě bonbónů nic dalšího — u téhle evoluce žádnou další podmínku data neuvádějí.';
  return 'O podmínkách téhle evoluce data nemáme. Ověř si je ve hře.';
 }

 function evoDlazdice(u,odKlic,dosazitelny){
  const zdroj=u.klic===odKlic,vybrany=u.klic===evoCil&&!evoMega;
  const vnitrek=obrazekRam(u.jmeno,'atlas-evo-obr')
   +`<b>${esc(u.popis)}</b>`
   +(zdroj?'<small>odsud</small>':dosazitelny?'':'<small>vyhledat</small>');
  if(dosazitelny)return `<button type="button" class="atlas-evo-dlazdice" data-evo-cil="${esc(u.klic)}" aria-pressed="${vybrany}">${vnitrek}</button>`;
  if(zdroj)return `<div class="atlas-evo-dlazdice" data-mimo="1" data-zdroj="1">${vnitrek}</div>`;
  /* Clanek, ze ktereho se k hledanemu druhu nedojde (je PRED nim nebo
     v jine vetvi), uz neni mrtvy obrazek: otevre se v hledani. Cesta
     a naklady se pocitaji jen dopredu, zpatky se evolvovat neda. */
  return `<button type="button" class="atlas-evo-dlazdice atlas-evo-jinam" data-mimo="1"`
   +` data-evo-hledat="${esc(u.jmeno)}" title="Vyhledat ${esc(u.popis)}">${vnitrek}</button>`;
 }

 function evoCenaHtml(c,odUzel,naJmeno,odLevel){
  const pol=c.polozky;
  const radek=(nazev,v,jednotka)=>`<div class="atlas-evo-radek"><dt>${esc(nazev)}</dt>`
   +`<dd>${v.znamo?esc(cislo(v.hodnota)+(jednotka?' '+jednotka:'')):'neznámo'}</dd></div>`;
  const predmety=pol.predmety.length
   ?`<div class="atlas-evo-radek"><dt>Předmět</dt><dd>${esc(pol.predmety.join(' · '))}</dd></div>`
   :'';
  const uroven=odLevel>=evoLevel
   ?`<p class="atlas-evo-pozn">Na L${esc(String(odLevel))} už je — vylepšení se do ceny nepočítá.</p>`:'';
  return `<h6 class="atlas-evo-nadpis">Co to stojí</h6><dl class="atlas-evo-cena">`
   +radek('Prach',pol.prach,'')
   +radek('Bonbóny',pol.bonbony,'')
   +(evoLevel>40||pol.xl.hodnota?radek('XL bonbóny',pol.xl,''):'')
   +predmety
   +`</dl>`
   +uroven
   +(c.uplne
     ?`<p class="atlas-evo-pozn">Bonbóny za evoluci i za vylepšení dohromady. XL se s běžnými nesčítají.</p>`
     :`<p class="atlas-evo-pozn atlas-evo-chybi">Součet není úplný — chybí: ${esc(c.chybi.join(', '))}.</p>`);
 }

 function evoluceHtml(m){
  const strom=P.atlasEvoStrom?P.atlasEvoStrom(m.jmeno):null;
  if(!strom)return '';
  /* Po zmene druhu nesmi zustat vybrana evoluce predchoziho — ukazovala
     by cenu cesty, ktera s tímhle druhem nesouvisi. */
  if(evoDruh!==strom.klic){evoDruh=strom.klic;evoCil=null;evoMega=null}
  const kusovy=window.__pgoProhlidkaRezim&&window.__pgoProhlidkaRezim()==='kus';
  const kus=window.__pgoProhlidkaKus&&window.__pgoProhlidkaKus();
  /* Kusovy rezim pocita od skutecneho levelu zadaneho kusu; druhovy je
     schvalne jen UKAZKA od L1 — appka netusi, co mas v inventari, a
     tvarit se, ze zna „tvoji cenu", by bylo vymysleni. */
  const odKlic=kusovy&&kus&&kus.klic?kus.klic:strom.klic;
  /* Level kusu se dopocitava z CP a IV — a kdyz spolu nesedi, nevyjde.
     Pak se pocita od L1 jako ukazka a rekne se to; tvarit se, ze L1 je
     level toho kusu, by byla lez. */
  const kusLevel=kusovy&&kus&&Number(kus.level)?Number(kus.level):null;
  const odLevel=kusLevel||1;
  /* Jine formy tehoz druhu (Zygarde 10 % / 50 % / Complete, Giratina,
     Deoxys). Nejsou to evoluce — meni se ve hre jinak a appka o tom, jak,
     nic nevi. Stoji proto bokem a jen odkazuji na svou stranku, kde ma
     kazda forma vlastni staty i poradi. */
  const formy=(m.druhy||[]).filter(x=>x.vztah==='forma');
  const formyHtml=formy.length
   ?`<div class="atlas-evo-mega atlas-evo-formy"><p class="atlas-evo-mega-popis">Jiné formy téhož druhu</p>`
    +`<div class="atlas-evo-mega-radek">`
    +formy.map(x=>`<button type="button" class="atlas-evo-dlazdice" data-forma="1"`
      +` data-evo-forma="${esc(x.jmeno)}">`
      +obrazekRam(x.jmeno,'atlas-evo-obr')
      +`<b>${esc(x.jmeno)}</b><small>otevřít</small></button>`).join('')
    +`</div>`
    +`<p class="atlas-evo-pozn">Každá forma má vlastní staty i pořadí. Evoluce to není`
    +` a jak se mezi nimi ve hře přepíná, appka z dat neví.</p></div>`
   :'';
  const jednoPatro=strom.stupne.length<2&&!strom.mega.length&&!formy.length;
  if(jednoPatro)return `<section class="atlas-evo"><p class="atlas-vysledek-prazdno">`
   +`Tenhle druh se nevyvíjí, mega formu nemá a jinou formu taky ne.</p></section>`;
  const dosazitelne={};
  strom.stupne.forEach(patro=>patro.forEach(u=>{
   dosazitelne[u.klic]=u.klic!==odKlic&&!!(P.atlasEvoCena&&P.atlasEvoCena(odKlic,u.klic));
  }));
  const stromHtml=strom.stupne.map((patro,i)=>
   (i?`<div class="atlas-evo-sipka" aria-hidden="true">↓</div>`:'')
   +`<div class="atlas-evo-patro"${patro.length>2?' data-mrizka="1"':''}>`
   +patro.map(u=>evoDlazdice(u,odKlic,dosazitelne[u.klic])).join('')
   +`</div>`).join('');
  const megaHtml=strom.mega.length
   ?`<div class="atlas-evo-mega"><p class="atlas-evo-mega-popis">Dočasná mega forma</p>`
    +`<div class="atlas-evo-mega-radek">`
    +strom.mega.map(x=>`<button type="button" class="atlas-evo-dlazdice" data-mega="1"`
      +` data-evo-mega="${esc(x.jmeno)}" aria-pressed="${evoMega===x.jmeno}">`
      +obrazekRam(x.jmeno,'atlas-evo-obr',x.obrazek)
      +`<b>${esc(x.jmeno)}</b></button>`).join('')
    +`</div></div>`
   :'';
  /* Podrobnosti vybrane cesty. Bez vyberu se necha prazdno s pokynem —
     nic se nedosazuje za cloveka. */
  let detail;
  if(evoMega){
   const mg=strom.mega.filter(x=>x.jmeno===evoMega)[0];
   detail=`<h5>${esc(mg.jmeno)}</h5>`
    +`<p class="atlas-evo-pozn">Dočasná forma na jeden boj, ne evoluce. `
    +`Kus zůstane tím, čím je, a mega energie se s bonbóny nesčítá.</p>`
    +`<dl class="atlas-evo-cena">`
    +`<div class="atlas-evo-radek"><dt>Mega energie poprvé</dt>`
    +`<dd>${mg.energiePoprve?esc(cislo(mg.energiePoprve)):'neznámo'}</dd></div>`
    +`<div class="atlas-evo-radek"><dt>Každá další proměna</dt>`
    +`<dd>${mg.energie?esc(cislo(mg.energie)):'neznámo'}</dd></div></dl>`;
  }else if(evoCil){
   const c=P.atlasEvoCena?P.atlasEvoCena(odKlic,evoCil,odLevel,evoLevel,''):null;
   if(!c)detail='<p class="atlas-evo-pozn">Tahle cesta z vybraného druhu nevede.</p>';
   else{
    const odUzel=strom.stupne.reduce((a,p2)=>a||p2.filter(u=>u.klic===odKlic)[0],null);
    const naUzel=strom.stupne.reduce((a,p2)=>a||p2.filter(u=>u.klic===evoCil)[0],null);
    detail=`<h5>${esc((odUzel?odUzel.popis:odKlic)+' L'+odLevel)} → `
     +`${esc((naUzel?naUzel.popis:evoCil)+' L'+evoLevel)}</h5>`
     +(kusLevel?''
       :`<p class="atlas-evo-pozn">${kusovy
         ?'Level kusu se z CP a IV spočítat nedá, tak je to ukázka od L1.'
         :'Ukázkový model od L1 — o tom, co máš v inventáři, appka nic neví.'}</p>`)
     +`<h6 class="atlas-evo-nadpis">Co to vyžaduje</h6>`
     +`<div class="atlas-evo-kroky">`
     +c.kroky.map(k=>`<div class="atlas-evo-krok">`
       +`<b>${esc(k.jmeno)}${k.bonbony?esc(' · '+cislo(k.bonbony)+' bonbónů'):''}</b>`
       +`<span>${evoPodminkyVeta(k)}</span>`
       +(k.bonusy.length?`<small>${esc(k.bonusy.join(' · '))}</small>`:'')
       +`</div>`).join('')
     +`</div>`
     +evoCenaHtml(c,odUzel,naUzel?naUzel.popis:evoCil,odLevel);
   }
  }else detail='<p class="atlas-evo-pozn" data-evo-vyzva>Vyber evoluci a cílový level.</p>';
  const levely=[40,50].map(l=>`<button type="button" data-evo-level="${l}"`
   +` aria-pressed="${evoLevel===l}">L${l}</button>`).join('');
  /* Vyhledat vybranou evoluci. Bez toho se dalo hledat jen to, co uz je
     v poli — a z Machopa se nedalo prejit na Machampa jinak nez ho
     vypsat rucne. */
  const cilUzel=evoCil?strom.stupne.reduce((a,p2)=>a||p2.filter(u=>u.klic===evoCil)[0],null):null;
  const hledatCil=cilUzel
   ?`<button type="button" class="atlas-evo-hledat" data-evo-hledat="${esc(cilUzel.jmeno)}">`
     +`Vyhledat ${esc(cilUzel.popis)}</button>`
   :'';
  return `<section class="atlas-evo">`
   +`<div class="atlas-evo-strom">${stromHtml}${megaHtml}${formyHtml}</div>`
   +`<div class="atlas-evo-detail"><div class="atlas-evo-hlava"><h4>Cesta a náklady</h4>`
   +hledatCil
   +`<div class="atlas-evo-levely" role="group" aria-label="Cílový level">${levely}</div></div>`
   +detail+`</div></section>`;
 }

 /* Co appka spocitala o zadanem kusu. Patri jen k radku hledaneho druhu:
    o evolucich zadny kus zadany neni. IV rank je poradi te kombinace IV
    mezi 4096 moznymi — ne poradi druhu v lize a ne pripravenost. */
 function kusBunka(r,vstupKlic){
  const k=window.__pgoProhlidkaKus&&window.__pgoProhlidkaKus();
  if(!k||r.klic!==vstupKlic)return '<td class="atlas-vysledek-nezname">—</td>';
  const casti=[];
  /* IV rank je vzdycky o JEDNE lize — o te, kterou ma clovek vybranou.
     Bez jejiho jmena by to bylo cislo, ktere tvrdi neco jineho, nez se
     zda. V rolich bez ligoveho limitu (Master, raidy, gym) se nepocita
     a nic se za nej nedosazuje. */
  const liga=role==='pvp'?ligaKlicVModelu:null;
  const rank=(liga&&k.iv&&P.atlasIvRank)
   ?P.atlasIvRank(k.jmeno,k.iv.a,k.iv.d,k.iv.s,liga):null;
  if(rank)casti.push(`IV <b>#${rank.rank}</b> z ${rank.z} · ${esc(rank.liga)}`);
  if(k.ivPct!=null)casti.push(`${k.ivPct} % IV`);
  if(!casti.length)return '<td class="atlas-vysledek-nezname">nedá se spočítat</td>';
  return `<td>${casti.join('<br>')}</td>`;
 }

 /* Kombinace dvou typu jako JEDEN stitek pulenky prebarveny: vlevo prvni
    typ, vpravo druhy. Dva samostatne ovaly vedle sebe by vypadaly jako dva
    ruzni protivnici, ne jako jedna dvojice. */
 function kombinaceChip(klic){
  const barvy=P.typeColors?P.typeColors():{};
  const casti=String(klic).split('/').map(x=>x.trim()).filter(Boolean);
  const ikona=t=>(P.typIkona?P.typIkona(t):'')+esc(t);
  if(casti.length<2)return `<span class="d-type atlas-typ-kombi" style="background:${esc(barvy[casti[0]]||'')}">${ikona(casti[0])}</span>`;
  /* Barva se riznе presne na delici care: kazda pulka ma vlastni pozadi.
     Prechod pres cely stitek rezal jinde, nez kde cara opravdu je. */
  return `<span class="d-type atlas-typ-kombi atlas-typ-kombi2">`
   +`<span style="background:${esc(barvy[casti[0]]||'#555')}">${ikona(casti[0])}</span>`
   +`<span style="background:${esc(barvy[casti[1]]||'#555')}">${ikona(casti[1])}</span></span>`;
 }

 /* Typy druhu jako barevne ovaly — stejne jako v identite a v rosteru.
    Radek tim rovnou rika, proti cemu se ten druh hodi. */
 function typyHtml(klic){
  const d=P.dexByKey?P.dexByKey(klic):null,barvy=P.typeColors?P.typeColors():{};
  return ((d&&d.types)||[]).map(t=>`<span class="d-type" style="background:${esc(barvy[t]||'')}">${P.typIkona?P.typIkona(t):''}${esc(t)}</span>`).join('');
 }

 /* Utok jako bublina s barvou typu — stejne jako v rozboru kusu.
    Typ se ptame enginu (`fastByNameOf` / `chargedByNameOf`); co nenajde,
    zustane textem. Nic se neodhaduje: sestava "mimo metu — sestavu appka
    nema" neni jmeno utoku a bublinu nedostane. */
 function utokChip(jmeno){
  const m=(P.fastByNameOf&&P.fastByNameOf(jmeno))||(P.chargedByNameOf&&P.chargedByNameOf(jmeno));
  if(!m||!m.type)return null;
  const barvy=P.typeColors?P.typeColors():{};
  return `<span class="atlas-utok-chip"><span class="atlas-utok-typ" `
   +`style="background:${esc(barvy[m.type]||'')}">${P.typIkona?P.typIkona(m.type):''}</span>`
   +`${esc(m.name)}</span>`;
 }
 function utokySestava(text){
  const casti=String(text).split(/\s*([+/])\s*/);
  const kusy=casti.map(c=>c==='+'||c==='/'
   ?`<span class="atlas-utok-spoj">${c}</span>`:utokChip(c.trim()));
  // Kdyz se nepozna ani jeden nazev, je to veta, ne sestava — necha se text.
  if(!kusy.some((x,i)=>x&&casti[i]!=='+'&&casti[i]!=='/'))return esc(text);
  return `<span class="atlas-utok-sada">`
   +kusy.map((x,i)=>x||esc(casti[i])).join('')+`</span>`;
 }

 /* Typ utocnika u raidu. Kdyz je to tyz typ, jaky druh sam ma, stoji
    vedle bubliny tehoz jmena dvakrat — to se vynecha. Jiny typ (druh mlati
    cizimi utoky) je naopak novy udaj a zustava. */
 /* U raidu se tyz druh objevi v kazdem typu, na ktery se hodi — bez
    oznaceni pak v tabulce stoji dva stejne vypadajici radky. Typ se proto
    u raidu pise vzdycky, jinde jen kdyz to NENI jeho vlastni typ. */
 function typNavic(r,vzdy){
  if(!r.typ)return '';
  const barvy=P.typeColors?P.typeColors():{};
  const d=P.dexByKey?P.dexByKey(r.klic):null;
  const vlastni=((d&&d.types)||[]).map(t=>String(t).toLowerCase());
  const vlastniTyp=vlastni.includes(String(r.typ).toLowerCase());
  if(vlastniTyp&&!vzdy)return '';
  return ` <span class="atlas-vysledek-role-typ d-type" style="background:${esc(barvy[r.typ]||'')}">`
   +`${P.typIkona?P.typIkona(r.typ):''}${esc(r.typ)}</span>`;
 }

 function radekHtml(r,vstupKlic){
  const poradi=r.rank==null
   ?`<span class="atlas-vysledek-nezname">${role==='pvp'
     ?'v téhle lize nemá pořadí':'v tomhle žebříčku není'}</span>`
   :`<b>#${r.rank}</b>${r.pct!=null?` <small>${r.pct} % nejlepšího</small>`:''}`;
  const utoky=r.utoky?utokySestava(r.utoky)
   :(r.priorita?`priorita do raidů: ${esc(r.priorita)}`
    :(r.jeMeta===false?'<span class="atlas-vysledek-nezname">mimo metu — sestavu appka nemá</span>'
     :'<span class="atlas-vysledek-nezname">sestavu appka nemá</span>'));
  /* U Max Battle je forma soucast radku: tyz druh stoji v jednom typu
     jednou jako Dynamax a jednou jako Gigantamax. */
  /* Forma jako stitek, ne jako text: DMAX uz appka pouziva u kusu, takze
     Gigantamax dostal stejny tvar o stupen sytejsi. V tabulce se to cte
     na prvni pohled. */
  const maxForma=r.maxForma
   ?` <span class="rarity-chip ${r.maxForma==='Gigantamax'?'r-GM':'r-D'} atlas-max-forma"`
    +` title="${esc(r.maxForma)}">${r.maxForma==='Gigantamax'?'GMAX':'DMAX'}</span>`
   :'';
  const znacka=(r.vztah==='vstup'?' <span class="atlas-vysledek-znacka">Hledaný druh</span>'
   :(r.vztah==='forma'?' <small>jiná forma</small>'
     :(r.vztah==='drive'?' <small>dřívější stupeň</small>':' <small>až po evoluci</small>')))+maxForma;
  const kusovy=window.__pgoProhlidkaRezim&&window.__pgoProhlidkaRezim()==='kus';
  /* Klepnuti na jmeno otevre ten druh v hledani. Driv jen zvyraznilo radek,
     coz nikam nevedlo — a oznaceni, ktere nic nedela, jen plete. */
  const jmenoHtml=r.vztah==='vstup'
   ?`<b>${esc(r.jmeno)}</b>`
   :`<button type="button" class="atlas-vysledek-jmeno" data-evo-hledat="${esc(r.jmeno)}"`
    +` title="Vyhledat ${esc(r.jmeno)}">${esc(r.jmeno)}</button>`;
  return `<tr data-klic="${esc(r.klic)}"${r.klic===vstupKlic?' class="je-vstup"':''}>`
   +`<td class="atlas-vysledek-druh">${obrazekRam(r.jmeno,'atlas-vysledek-obr')}`
    +`<span>${jmenoHtml}${znacka}${typNavic(r,role==='raid'||role==='max')}`
    /* V raidech se typ uz pise za jmenem (za ktery typ ten radek stoji),
       takze vlastni typy druhu by byly podruhe — u Centiskorche vysel
       "Bug Fire Bug". Jinde se typy hodi: rikaji, proti cemu se druh postavi. */
    +`<span class="atlas-vysledek-typy">${role==='raid'||role==='max'?'':typyHtml(r.klic)}</span></span></td>`
   +`<td>${poradi}</td><td>${utoky}</td>${kusovy?kusBunka(r,vstupKlic):''}`
   /* Misto holé sipky pojmenovany prikaz: samotna sipka nerikala, co udela,
      a zvyrazneni radku uz umi klepnuti na jmeno. U hledaneho druhu nic —
      hledat to, co uz je v poli, nema smysl. */
   +`<td class="atlas-vysledek-akce">${r.vztah==='vstup'?''
     :`<button type="button" class="atlas-vysledek-hledat" data-evo-hledat="${esc(r.jmeno)}">`
      +`Vyhledat ${esc(r.jmeno)}</button>`}</td></tr>`;
 }

 function vykresliVysledek(){
  const el=vysledekBlok(),hodnota=jmeno.value.trim();
  /* Prepnuti role nebo ligy prekresli celou tabulku a fokus by skoncil
     na tele stranky — dalsi tab by zacinal od zacatku. Tlacitko se proto
     po prekresleni najde znova podle toho, co dela. `preventScroll`:
     vraceni fokusu nesmi stranku posunout. */
  const aktivni=document.activeElement;
  const klicFokusu=aktivni&&el.contains(aktivni)
   ?(aktivni.dataset.role?'[data-role="'+aktivni.dataset.role+'"]'
     :aktivni.dataset.liga?'[data-liga="'+aktivni.dataset.liga+'"]'
     :null)
   :null;
  const m=hodnota&&P.prohlidkaModel?P.prohlidkaModel(hodnota):null;
  if(!m){el.hidden=true;el.innerHTML='';return}
  el.hidden=false;
  /* Novy druh a v zapamatovane roli o nem appka nic nema: misto prazdne
     tabulky se prepne tam, kde poradi opravdu je. Rucni volbu to nepresune
     — prepina se jen pri zmene druhu a rekne se, proc. */
  if(vysledekDruh!==m.klic){
   vysledekDruh=m.klic;presunZprava='';
   /* Prazdna je i tabulka, ve ktere sice radky jsou, ale nikdo v ni nema
      poradi — od te doby, co se ukazuje cela evolucni rada, takovy pripad
      existuje ("v tehle lize nema poradi" u vsech clanku). */
   const prazdna=k=>{const g=k==='pvp'?m.role.pvp[liga]:m.role[k];
    return !(g&&g.radky&&g.radky.some(r=>r.rank!=null))};
   if(prazdna(role)){
    const kandidati=[];
    if(role==='pvp')m.poradiLig.forEach(k=>kandidati.push(['pvp',k]));
    m.poradiLig.forEach(k=>{if(role!=='pvp')kandidati.push(['pvp',k])});
    ['raid','gym','mega','max'].forEach(k=>{if(k!==role)kandidati.push([k,null])});
    const nalez=kandidati.filter(([r,l])=>{
     const g=r==='pvp'?m.role.pvp[l]:m.role[r];
     // Stejne jako `prazdna`: radek bez poradi se nepocita, jinak by appka
     // "nasla" ligu, ve ktere taky nikdo z rady poradi nema.
     return g&&g.radky&&g.radky.some(x=>x.rank!=null);
    })[0];
    if(nalez){
     const puvodni=role==='pvp'?m.role.pvp[liga].nazev:ROLE_POPIS[role];
     role=nalez[0];if(nalez[1])liga=ligaKlicVModelu=nalez[1];
     presunZprava=`Pro ${puvodni} appka o tomhle druhu pořadí nemá — ukazuje se `
      +(role==='pvp'?m.role.pvp[liga].nazev:ROLE_POPIS[role])+'.';
    }
   }
  }
  const skupina=role==='pvp'?m.role.pvp[liga]:m.role[role];
  const radky=(skupina&&skupina.radky)||[];
  /* Nadpis rika, CO se pocita — ne ze to druh "hraje". Jestli ho hrat,
     plyne z poradi v tabulce, ne z nadpisu. */
  // Nadpis bere cely nazev role z modelu ("Max Battle"), ne zkratku ze zalozky.
  const nadpis=`Výsledky pro ${skupina&&skupina.nazev?skupina.nazev:ROLE_POPIS[role]}`;
  const kusovy=window.__pgoProhlidkaRezim&&window.__pgoProhlidkaRezim()==='kus';
  /* Zalozky roli a vyber ligy stoji v jednom radku: kdyz byly pod sebou,
     prepnuti z PvP na Raidy ten radek zrusilo a cela tabulka poskocila. */
  el.innerHTML=`<section class="atlas-vysledek"><div class="atlas-vysledek-hlava">`
   +`<div class="atlas-vysledek-ovladani" role="tablist" aria-label="Role">`
   +Object.keys(ROLE_POPIS).map(k=>`<button type="button" role="tab" data-role="${k}" aria-selected="${role===k}" aria-pressed="${role===k}">${ikona(k)}<span>${ROLE_POPIS[k]}</span></button>`).join('')
   +`</div>`
   +(role==='pvp'?`<div class="atlas-vysledek-ligy" role="group" aria-label="Liga">`
     +m.poradiLig.map(k=>`<button type="button" data-liga="${k}" aria-pressed="${liga===k}">${esc(m.role.pvp[k].nazev)}</button>`).join('')
     +`</div>`:'')
   +`</div>`
   +`<h4 class="atlas-vysledek-nadpis">${esc(nadpis)}</h4>`
   +`<div class="atlas-vysledek-telo">`
   +(radky.length
     ?`<table class="atlas-vysledek-tab"><thead><tr><th>Druh</th><th>Pořadí druhu</th><th>Doporučené útoky</th>${kusovy?'<th>Tvůj kus</th>':''}<th></th></tr></thead><tbody>`
      +radky.map(r=>radekHtml(r,m.klic)).join('')+`</tbody></table>`
     :`<p class="atlas-vysledek-prazdno">Pro tuhle roli appka o tomhle druhu žádné pořadí nemá.</p>`)
   +(presunZprava?`<p class="atlas-vysledek-presun">${esc(presunZprava)}</p>`:'')
   /* U shadow formy musi byt jasne, ktera cisla se tim zmenila a ktera ne. */
   +(role==='max'?`<p class="atlas-vysledek-presun">Pořadí i poškození počítá`
     +` <b>Pokémon GO Hub</b>, ne appka${(P.atlasDmaxZdroj&&P.atlasDmaxZdroj())
       ?' (staženo '+esc(P.atlasDmaxZdroj().datum)+')':''}.`
     +` Je to žebříček druhů — o tvých kusech nic neříká.</p>`:'')
   +(m.forma==='Shadow'?`<p class="atlas-vysledek-presun">${role==='pvp'
     ?'Pořadí je ze shadow žebříčku PvPoke — je to vlastní tabulka, ne přepočet běžné.'
     :'Tenhle žebříček appka počítá mezi běžnými formami, takže se do něj shadow nepromítá.'}</p>`:'')
   +`</div></section>`;
  /* Evoluce maji vlastni zalozku, takze uz nestoji vedle tabulky —
     tabulka tim dostala celou sirku a u druhu se dvema radky nezustava
     vedle ni prazdne misto. */
  const evoPanel=panel('evoluce');
  if(evoPanel){evoPanel.innerHTML=evoluceHtml(m);if(P.vystreditSprity)P.vystreditSprity(evoPanel)}
  if(P.vystreditSprity)P.vystreditSprity(el);
  if(klicFokusu){const znovu=el.querySelector(klicFokusu);if(znovu)znovu.focus({preventScroll:true})}
  vykresliKotvy(true);
 }

 // Počasí je v datech anglicky, protože tak se jmenuje v herním souboru.
 const POCASI_CZ={'Clear':'Jasno','Fog':'Mlha','Overcast':'Zataženo',
  'Partly Cloudy':'Polojasno','Rainy':'Déšť','Snow':'Sníh','Windy':'Vítr'};

 // --- záhlaví: jedno velké hledání a přepínač režimu ---------------------
 const hlava=document.createElement('div');hlava.className='atlas-hledani-hlava';
 hlava.innerHTML=`<div class="atlas-hledani-pole">
   <svg class="atlas-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 15l6 6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0"/></svg>
   <span data-hledani-slot></span>
   <button type="button" class="atlas-hledani-zrus" data-hledani-zrus aria-label="Vymazat hledání" hidden>✕</button>
  </div>
`;
 mrizka.before(hlava);
 // Pole se PŘESOUVÁ, ne kopíruje — engine na něm poslouchá a kopie by
 // vypadala funkčně, ale nic by nepočítala.
 const stitekJmena=jmeno.closest('label');
 hlava.querySelector('[data-hledani-slot]').append(jmeno);
 if(stitekJmena)stitekJmena.remove();
 jmeno.setAttribute('placeholder','Napiš druh, třeba Machamp');

 // --- údaje kusu do rozbalovátka ----------------------------------------
 karta.dataset.atlasHledani='1';
 const udaje=document.createElement('details');udaje.className='atlas-hledani-udaje';
 udaje.innerHTML='<summary><b>Údaje mého kusu</b><span>CP, IV a útoky · vyplň jen to, co znáš</span></summary>';
 mrizka.before(udaje);udaje.append(mrizka);
 // Tlacitko Vymazat sedi vedle mrizky, ne v ni — patri k udajum kusu,
 // takze jde do rozbalovatka s nimi.
 const akce=karta.querySelector('.actions');if(akce)udaje.append(akce);
 /* Cesta zpatky nahoru: formular stoji pod vysledky a evolucemi. */
 {const zpet=document.createElement('button');zpet.type='button';
  zpet.className='atlas-hledani-zpet';zpet.dataset.zpetVysledky='1';
  zpet.textContent='↑ Zpět na výsledky';udaje.append(zpet);}

 // --- identita druhu ----------------------------------------------------
 const identita=document.createElement('section');identita.className='atlas-hledani-identita';identita.hidden=true;
 udaje.before(identita);

 /* Rezim uz nema vlastni prepinac — rika ho zalozka: "Muj kus" znamena
    pocitat s udaji kusu, cokoli jineho znamena mluvit o druhu. */
 let rezimStav='druh';
 const rezim=()=>rezimStav;
 function prepni(k){
  rezimStav=k;
  udaje.open=k==='kus';
  karta.dataset.atlasRezim=k;
  /* Rezim rozhoduje o vypoctu, ne jen o nadpisu: v "Prozkoumat druh" se
     udaje kusu do vysledku neberou. Pocita to engine — vrstva mu jen
     rekne, co se ptame. V polich udaje zustanou pro navrat. */
  window.__pgoProhlidkaRezim&&window.__pgoProhlidkaRezim(k);
  vykresli();
  /* Prepnuti na vlastni kus rovnou otevre zalozku s formularem a zameri
     CP — jinak se zmeni rezim, ale na obrazovce se nic nestane. */
  if(k==='kus'){
   udaje.open=true;
   if(sekce!=='kus')prepniSekci('kus',true);
   const cp=document.getElementById('prohCp');
   if(cp)setTimeout(()=>cp.focus({preventScroll:true}),60);
  }
 }
 /* "Zpet na vysledky" z formulare kusu: bez nej se clovek musel
    prorolovat pres celou stranku zpatky nahoru. */
 function zpetNaVysledky(){
  const cil=karta.querySelector('.atlas-vysledky')||identita;
  const plynule=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  cil.scrollIntoView({block:'start',behavior:plynule?'smooth':'auto'});
 }
 udaje.addEventListener('click',e=>{
  if(e.target.closest('[data-zpet-vysledky]'))zpetNaVysledky();
 });
 /* O rezimu rozhoduji VYPLNENE UDAJE, ne to, na ktere zalozce clovek stoji.
    Zalozka ho zapne (otevre formular), ale kdyz se CP a IV vymazou, neni uz
    s cim pocitat a appka se vrati k druhu — jinak by sloupec "Tvuj kus"
    zustal viset prazdny. */
 const kusMaUdaje=()=>['prohCp','prohA','prohD','prohS']
  .some(id=>String((document.getElementById(id)||{}).value||'').trim()!=='');
 udaje.addEventListener('input',()=>{
  const chce=kusMaUdaje()?'kus':'druh';
  if(rezim()!==chce)prepni(chce);
 });

 hlava.addEventListener('click',e=>{
  const b=e.target.closest('[data-rezim]');if(b){prepni(b.dataset.rezim);return}
  if(e.target.closest('[data-hledani-zrus]')){
   jmeno.value='';jmeno.dispatchEvent(new Event('input',{bubbles:true}));
   jmeno.dispatchEvent(new Event('change',{bubbles:true}));jmeno.focus();
  }
 });

 /* Co appka o druhu ví dřív, než se člověk rozhodne jít na raid: jestli
    z něj může padnout shiny, jaké CP má dokonalý kus (běžně a v boostu)
    a jaké počasí ho boostuje. */
 function vykresli(){
  const syrove=jmeno.value.trim();
  /* Do pole se da napsat i forma ("Shadow Snorlax"). Co je druh a co forma,
     rozhoduje motor — vrstva si to necte po svem. */
  const rozklad=P.atlasRozlozFormu?P.atlasRozlozFormu(syrove):{jmeno:syrove,forma:''};
  const hodnota=rozklad.jmeno;
  formaStav=rozklad.forma||'';
  hlava.querySelector('[data-hledani-zrus]').hidden=!syrove;
  const zaznam=hodnota?P.dexEntry(hodnota):null;
  if(!zaznam){
   /* Prazdne pole = uklid. Rozepsany nebo prekleply text ale NENI duvod
      zahodit, co uz je na obrazovce: pri mazani "shadow " ze "shadow
      Snover" projde pole stavy, ktere zadnemu druhu neodpovidaji, a cela
      stranka by zablikala. */
   if(syrove)return;
   identita.hidden=true;identita.innerHTML='';vykresliCpPas(null);
   vykresliVysledek();vykresliKotvy(false);return}
  /* `dexEntry` u formy vrati spravne staty, ale `name` je jmeno ZAKLADNIHO
     druhu — "Muk (Alolan)" mel proto obrazek, CP i typovou stranku bezneho
     Muka. Dal se pracuje se jmenem formy, jak ho vede motor. */
  const model=P.prohlidkaModel?P.prohlidkaModel(syrove):null;
  const d=model&&model.jmeno&&model.jmeno!==zaznam.name
   ?Object.assign({},zaznam,{name:model.jmeno}):zaznam;
  const typy=(d.types||[]).filter(t=>t&&t!=='–');
  const barvy=P.typeColors()||{};
  const shiny=P.atlasShiny?P.atlasShiny(d.name):null;
  const cp20=P.atlasCP?P.atlasCP(d.name,20):null;
  const cp25=P.atlasCP?P.atlasCP(d.name,25):null;
  const pocasi=[...new Set(typy.map(t=>P.atlasPocasi?P.atlasPocasi(t):'').filter(Boolean))]
   .map(x=>POCASI_CZ[x]||x);
  const kusovy=rezim()==='kus';
  /* Shiny má tři stavy, ne dva: "ve hře zatím není" tvrdí něco o hře,
     "nevíme" o datech. A obecné shiny ANO neříká nic o tom, jestli shiny
     padá z raidu — u raidového úlovku se proto ptáme zvlášť. */
  const shinyStav=shiny?shiny.stav:'neověřeno';
  /* Čísla CP jsou referenční — o tom, jestli druh PRÁVĚ TEĎ v raidech je,
     rozhoduje rozpis akcí, ne pokédex. */
  /* Prostredni bunka navrhu: kde druh v appce stoji. Neni to hodnoceni
     vymyslene vrstvou — role se ctou z tehoz modelu jako tabulka. */
  const kdeStoji=(()=>{
   if(!model)return '';
   const ven=[];
   /* Samotny zaznam v zebricku nic nerika: Chandelure je v Great League
      #802 a to neni role, to je misto v poradi. Bere se proto stejny prah,
      jakym se ridi cely rozpocet — "do kolikateho mista brat druh vazne". */
   const prah=P.atlasRankLimit?P.atlasRankLimit():50;
   (model.poradiLig||[]).forEach(k=>{
    const lg=model.role.pvp[k];
    const radek=lg&&lg.radky.filter(r=>r.klic===model.klic)[0];
    if(radek&&radek.rank!=null&&radek.rank<=prah)ven.push({nazev:lg.nazev,rank:radek.rank});
   });
   // Od nejlepsiho poradi po nejhorsi — jinak to bylo poradi lig, ne sily.
   ven.sort((a,b2)=>a.rank-b2.rank);
   const vse=ven.map(x=>x.nazev);
   /* Raidy a gym nemaji poradi srovnatelne s ligou, takze stoji za nimi
      v poradi, v jakem se o nich mluvi jinde. */
   if(model.role.raid.radky.some(r=>r.klic===model.klic))vse.push('raidy');
   if(model.role.gym.radky.some(r=>r.klic===model.klic))vse.push('obrana gymu');
   /* Max Battle je jediny zebricek, ktery appka nepocita sama. Byt na nem
      znamena "patri mezi desitku na ten typ" — proto staci zminka s typem. */
   const dm=P.atlasDmax?P.atlasDmax(d.name):null;
   if(dm&&dm.role.length)vse.push('Max Battle ('+dm.role[0].typ+' #'+dm.role[0].poradi+')');
   return vse.length?vse.join(' · '):'';
  })();
  identita.hidden=false;
  vykresliCpPas(d,pocasi);
  vykresliTypy(d);
  if(shinyDruh!==d.name){shinyDruh=d.name;shinyObrazek=false}
  /* Shiny sprite se predem natahne do pameti prohlizece. Bez toho se po
     prepnuti na okamzik ukazala nahradni ikona, nez se obrazek stahl. */
  if(P.atlasImage&&!shinyObrazek){
   const html=P.atlasImage(d.name,'',{shiny:true})||'';
   const src=(html.match(/src="([^"]+)"/)||[])[1];
   if(src&&!shinyPredem.has(src)){shinyPredem.add(src);const i=new Image();i.src=src}
  }
  /* Prepinac se nabizi jen tam, kde shiny opravdu existuje. U "zatim ne"
     nebo "neoveureno" by slibil obrazek, ktery ve hre nikdo nema. */
  const shinyLze=shinyStav==='ano';
  const staty=P.atlasStaty?P.atlasStaty(d.name):null;
  const pruh=(popis,hodnota,max,tr)=>`<div class="atlas-staty-radek" data-stat="${tr}">`
   +`<span>${esc(popis)}</span><span class="atlas-staty-drah">`
   +`<i style="width:${Math.round(Math.min(1,hodnota/(max||1))*100)}%"></i></span>`
   +`<b>${hodnota}</b></div>`;
  identita.innerHTML=`<div class="atlas-hledani-kdo">
    <div class="atlas-hledani-obal">
     ${obrazekRam(d.name,'atlas-hledani-obr',null,shinyObrazek?{shiny:true}:null)}
     ${shinyLze?`<button type="button" class="atlas-shiny-prepinac" data-shiny-obrazek`
       +` aria-pressed="${shinyObrazek}">`
       +`✦ ${shinyObrazek?'Běžný':'Shiny'}</button>`:''}
    </div>
    <div>
     <h3>${esc(d.name)}</h3>
     ${P.atlasMaShadow&&P.atlasMaShadow(d.name)?`<div class="atlas-forma-prepinac" role="group" aria-label="Forma">`
       +`<button type="button" data-forma="" aria-pressed="${formaStav!=='Shadow'}">Běžný</button>`
       +`<button type="button" data-forma="Shadow" aria-pressed="${formaStav==='Shadow'}">Shadow</button>`
       +`</div>`:''}
     <div class="atlas-hledani-typy">${typy.map(t=>`<span class="d-type" style="background:${esc(barvy[t]||'')}">${P.typIkona?P.typIkona(t):''}${esc(t)}</span>`).join('')}</div>
     ${staty?`<div class="atlas-staty">`
       +pruh('Útok',staty.utok,staty.max.utok,'utok')
       +pruh('Obrana',staty.obrana,staty.max.obrana,'obrana')
       +pruh('HP',staty.hp,staty.max.hp,'hp')
       +`</div>`:''}
    </div>
   </div>
   <div class="atlas-hledani-kde">
    <span class="atlas-hledani-rezim-znacka">${kusovy?'Výpočet konkrétního kusu':'Hodnocení druhu'}</span>
    <b>${kdeStoji?esc(kdeStoji):'žádnou roli nezastane'}</b>
   </div>
   <dl class="atlas-hledani-fakta">
    <div data-shiny="${shinyStav}">
     <dt>Shiny</dt>
     <button type="button" class="atlas-hledani-shiny" data-shiny-vic aria-expanded="${shinyVic}">
      <span>${{ano:'✦ Shiny dostupné',ne:'Shiny zatím ne'}[shinyStav]||'Shiny neověřeno'}</span>
      <span class="atlas-hledani-shiny-sip" aria-hidden="true">›</span>
     </button>
     ${shinyVic?`<small>${esc({ano:shiny&&shiny.zdroje.length?'Odkud padá: '+shiny.zdroje.join(' · '):'zdroj neuveden',
       ne:'ve hře se zatím neobjevil'}[shinyStav]||'o tomhle druhu zdroj nic neříká')}</small>`:''}
    </div>
   </dl>`;
  /* Sprity z hry maji kazdy jinou pozici v pruhlednem platne; engine je
     umi vystredit, ale musi se mu o novem obrazku rict. Jinak sedi
     nakrivo a prelezaji ramecek. */
  if(P.vystreditSprity)P.vystreditSprity(identita);
  vykresliVysledek();
 }

 /* Zdroje shiny jsou o klik dal, jak je v navrhu; klik prekresli
    identitu, takze se posluchac vesi na cely blok, ne na tlacitko. */
 identita.addEventListener('click',e=>{
  if(e.target.closest('[data-shiny-vic]')){shinyVic=!shinyVic;vykresli();return}
  /* Meni se jen obrazek: zadne cislo, poradi ani sestava na barve nezalezi,
     takze se prekresli identita a nic jineho. */
  const fp=e.target.closest('[data-forma]');
  if(fp){
   /* Prepnuti prepise text v poli — ten je jediny zdroj pravdy o tom, co se
      hleda, takze se stav nemuze rozejit s tim, co je videt. */
   const zaklad=P.atlasRozlozFormu?P.atlasRozlozFormu(jmeno.value).jmeno:jmeno.value;
   const nova=fp.dataset.forma;
   jmeno.value=(nova?nova+' ':'')+zaklad;
   jmeno.dataset.tiseVybrano='1';
   jmeno.dispatchEvent(new Event('input',{bubbles:true}));
   return;
  }
  if(e.target.closest('[data-shiny-obrazek]')){shinyObrazek=!shinyObrazek;vykresli()}
 });
 ['input','change'].forEach(u=>jmeno.addEventListener(u,vykresli));
 /* Vybrany druh = hledani skoncilo. Kurzor v poli uz jen prekazi: nabidka
    pod nim prekryva obsah a prvni klik do stranky padne na ni, ne na to,
    kam clovek miril. Fokus proto jde z pole pryc, jakmile v nem stoji druh,
    ktery appka zna. */
 jmeno.addEventListener('change',()=>{
  const d=P.prohlidkaModel&&P.prohlidkaModel(jmeno.value.trim());
  if(d&&document.activeElement===jmeno)jmeno.blur();
 });
 // Engine si výsledek překresluje sám; identita se veze s ním.
 new MutationObserver(vykresli).observe(vysledek,{childList:true});
 prepni('druh');
})();

/* Hledání v rosteru: štítky se skládají do pole za sebe.

   Začneš psát „Ice", pole nabídne štítek Ice, klikneš — a štítek v poli
   zůstane jako kostička. Pak píšeš dál: další štítek nebo jméno druhu.
   Víc kostiček znamená PRŮNIK, tedy „tohle a zároveň tamto".

   Filtr samotný engine umí odjakživa, jen nabídka visela v hlavičce
   klasické tabulky — a tu vzhledová vrstva nezobrazuje. */
(() => {
 const $=s=>document.querySelector(s),P=window.__pgo;
 const pole=$('#searchInput');if(!pole||!P.atlasStitky)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 // Diakritika se při hledání ignoruje: „legendarni" musí najít „Legendární".
 const holy=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

 const vybrane=[];        // [{skupina:'znacka'|'duvod', klic, popis}]
 let zvyrazneny=-1;

 const obal=document.createElement('div');obal.className='atlas-hledani-roster';
 pole.replaceWith(obal);
 const kostky=document.createElement('span');kostky.className='atlas-hledani-kostky';
 obal.append(kostky,pole);
 // Nabidka visi na tele stranky, ne v liste: obal listy ma v rezimu
 // dlazdic `overflow:auto`, takze by ji orezal. Poloha se dopocitava
 // z pole, aby sedela pod nim.
 const navrhy=document.createElement('div');
 navrhy.className='atlas-navrhy';navrhy.hidden=true;navrhy.setAttribute('role','listbox');
 document.body.append(navrhy);
 function umisti(){
  const r=obal.getBoundingClientRect();
  navrhy.style.left=Math.round(r.left)+'px';
  navrhy.style.top=Math.round(r.bottom+5)+'px';
  navrhy.style.width=Math.round(Math.max(260,Math.min(r.width,420)))+'px';
 }
 pole.setAttribute('placeholder','Hledat pokémona');
 pole.setAttribute('autocomplete','off');

 function pouzij(){
  const znacky=vybrane.filter(x=>x.skupina==='znacka').map(x=>x.klic);
  const duvody=vybrane.filter(x=>x.skupina==='duvod').map(x=>x.klic);
  /* Stitek ligy nebo typu si nese vlastni poradi ("UL #1", "Fire 2/6"),
     takze uz sam rika, co je nahore. Razeni to potrebuje vedet: role by
     to prebila necim jinym a vypadalo by to, ze kliknuti nic nedela. */
  const radi=vybrane.some(x=>x.kat==='liga'||x.kat==='raid');
  // Razeni se ridi hledanym stitkem, takze o zmene musi vedet.
  window.dispatchEvent(new CustomEvent('atlas:stitky',{detail:{pocet:vybrane.length,radi:radi}}));
  // Víc štítků = průnik. „Ice a zároveň Gym" je otázka, kterou člověk má;
  // „Ice nebo Gym" skoro nikdy.
  P.atlasStitkyFiltr(znacky,duvody,true);
  window.__atlasTest?.refresh?.();
 }

 /* Stitek vypada stejne jako v detailu — barevny oval, ne holy text.
    Clovek tak v nabidce vidi presne to, co pak v rosteru najde. */
 function stitekHtml(x){
  const styl=x.barva?` style="border-color:${esc(x.barva)};background:color-mix(in srgb, ${esc(x.barva)} 24%, var(--surface-1))"`:'';
  return `<span class="${esc(x.trida||'dv-chip dv-role')}"${styl}>${esc(x.stitek||x.popis||x.klic)}</span>`;
 }
 function vykresliKostky(){
  kostky.innerHTML=vybrane.map((x,i)=>`<span class="atlas-kostka" data-i="${i}">${stitekHtml(x)}<button type="button" aria-label="Odebrat ${esc(x.stitek||x.popis)}">✕</button></span>`).join('');
  obal.classList.toggle('ma-kostky',vybrane.length>0);
 }

 /** Štítky, které se hodí na napsaný text a ještě nejsou v poli. */
 function najdi(text){
  const n=P.atlasStitky(),h=holy(text);
  if(!h)return [];
  const mam=new Set(vybrane.map(x=>x.skupina+':'+x.klic));
  const ven=[];
  n.znacky.forEach(z=>{
   // Hleda se podle ceskeho popisu i podle toho, co je na stitku videt.
   if((holy(z.popis).includes(h)||holy(z.stitek).includes(h))&&!mam.has('znacka:'+z.klic))
    ven.push({skupina:'znacka',klic:z.klic,popis:z.popis,stitek:z.stitek,
     trida:z.trida,pocet:z.pocet})});
  n.duvody.forEach(d=>{if(holy(d.klic).includes(h)&&!mam.has('duvod:'+d.klic))
   ven.push({skupina:'duvod',klic:d.klic,popis:d.klic,stitek:d.stitek,
    trida:d.trida,barva:d.barva,pocet:d.pocet,kat:d.kat})});
  // Co začíná napsaným textem, patří nahoru.
  // CUTE je zaroven znacka i stitek u verdiktu — v nabidce by byla dvakrat
  // a filtrovala by totez. Znacka je primejsi, takze vyhrava.
  const jmenaZnacek=new Set(ven.filter(x=>x.skupina==='znacka').map(x=>holy(x.stitek)));
  const bezDvojic=ven.filter(x=>x.skupina==='znacka'||!jmenaZnacek.has(holy(x.stitek)));
  // Stitek, ktery v rosteru nema ani jeden kus, nabizet nema smysl —
  // vybrat ho znamena prazdny roster.
  ven.length=0;bezDvojic.forEach(x=>{if(x.pocet>0)ven.push(x)});
  // Poradi je proste podle abecedy. Podle poctu to skakalo a neslo
  // odhadnout, kde co bude; A az Z je predvidatelne.
  ven.sort((a,b)=>String(a.stitek||a.popis).localeCompare(String(b.stitek||b.popis),'cs'));
  return ven.slice(0,8);
 }

 function zavri(){navrhy.hidden=true;zvyrazneny=-1;pole.setAttribute('aria-expanded','false')}

 function nabidni(){
  const seznam=najdi(pole.value);
  if(!seznam.length){zavri();return}
  navrhy.innerHTML=seznam.map((x,i)=>`<button type="button" role="option" data-navrh="${i}" aria-selected="${i===zvyrazneny}">
    ${stitekHtml(x)}<span class="atlas-navrh-pocet">${x.pocet}</span></button>`).join('');
  navrhy.__seznam=seznam;
  umisti();
  navrhy.hidden=false;pole.setAttribute('aria-expanded','true');
 }

 function pridej(x){
  vybrane.push(x);
  pole.value='';
  // Engine poslouchá na `input` — bez toho by mu v hledání zůstal text.
  pole.dispatchEvent(new Event('input',{bubbles:true}));
  vykresliKostky();zavri();pouzij();pole.focus();
 }

 pole.addEventListener('input',()=>{zvyrazneny=-1;nabidni()});
 pole.addEventListener('focus',nabidni);
 pole.addEventListener('keydown',e=>{
  const seznam=navrhy.__seznam||[];
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
   if(navrhy.hidden)nabidni();
   if(!seznam.length)return;
   e.preventDefault();
   zvyrazneny=(zvyrazneny+(e.key==='ArrowDown'?1:seznam.length-1))%seznam.length;
   nabidni();return;
  }
  if(e.key==='Enter'&&!navrhy.hidden&&seznam.length){
   e.preventDefault();pridej(seznam[Math.max(0,zvyrazneny)]);return;
  }
  if(e.key==='Escape'&&!navrhy.hidden){e.preventDefault();zavri();return}
  // Backspace v prázdném poli odebere poslední kostičku — jako v mailu.
  if(e.key==='Backspace'&&!pole.value&&vybrane.length){
   vybrane.pop();vykresliKostky();pouzij();
  }
 });
 navrhy.addEventListener('mousedown',e=>{
  const b=e.target.closest('[data-navrh]');if(!b)return;
  e.preventDefault();pridej((navrhy.__seznam||[])[Number(b.dataset.navrh)]);
 });
 kostky.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  vybrane.splice(Number(b.closest('.atlas-kostka').dataset.i),1);
  vykresliKostky();pouzij();pole.focus();
 });
 document.addEventListener('click',e=>{
  if(!obal.contains(e.target)&&!navrhy.contains(e.target))zavri();
 });
 window.addEventListener('scroll',()=>{if(!navrhy.hidden)umisti()},true);
 window.addEventListener('resize',()=>{if(!navrhy.hidden)umisti()});

 /* Stitek jde pridat i odjinud (kosticka "Posledni sken" u razeni). */
 window.AtlasHledaniPridej=klic=>{
  const n=P.atlasStitky();
  const z=n.znacky.find(x=>x.klic===klic);
  if(z){
   if(vybrane.some(x=>x.skupina==='znacka'&&x.klic===klic))return true;
   pridej({skupina:'znacka',klic:z.klic,popis:z.popis,stitek:z.stitek,
    trida:z.trida,pocet:z.pocet});
   return true;
  }
  const d=n.duvody.find(x=>x.klic===klic);
  if(!d)return false;
  if(vybrane.some(x=>x.skupina==='duvod'&&x.klic===klic))return true;
  pridej({skupina:'duvod',klic:d.klic,popis:d.klic,stitek:d.stitek,
   trida:d.trida,barva:d.barva,pocet:d.pocet,kat:d.kat});
  return true;
 };

 // „Zrušit filtry" má vyhodit i kostičky, jinak by zůstaly viset nad
 // rosterem, který už podle nich nefiltruje.
 $('#zrusitFiltry')?.addEventListener('click',()=>{
  if(!vybrane.length)return;
  vybrane.length=0;vykresliKostky();
 });
})();

/* Razeni jako stitky, ne jako roletka o tricet polozkach.

   Vyber razeni mel tri skupiny a pres dvacet radku; devadesat procent
   casu z nich clovek chce ctyri. Bezne razeni je proto videt rovnou
   jako kosticky, zbytek (cas, ligy) zustava v roletce vedle.

   Roletka `#atlasSort` zustava v dokumentu a je porad zdrojem pravdy —
   kosticky do ni jen zapisuji a poslou `change`, takze obsluha vrstvy
   i engine zustavaji jedno misto. */
(() => {
 const $=s=>document.querySelector(s);
 const sel=$('#atlasSort'),P=window.__pgo;if(!sel)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

 /* Razeni, ktera stoji za to mit po ruce. Cas a ligy odpadly: ligy nesou
    stitky v hledacim poli a podle casu se neradilo prakticky nikdy.
    Vychozi je CP od nejvyssiho — to clovek chce videt nejcasteji. */
 const VYCHOZI='cp:-1';
 const RYCHLE=[
  ['cp:-1','CP ↓','CP od nejvyššího'],
  ['cp:1','CP ↑','CP od nejnižšího'],
  ['pokemon:1','A–Z','Jméno od A do Z'],
  ['pokemon:-1','Z–A','Jméno od Z do A'],
  ['ivPct:-1','IV ↓','IV od nejvyššího'],
  ['ivPct:1','IV ↑','IV od nejnižšího'],
  ['level:-1','L ↓','Level od nejvyššího'],
  ['level:1','L ↑','Level od nejnižšího']
 ];

 const obal=document.createElement('div');obal.className='atlas-razeni';
 sel.before(obal);
 const rychle=document.createElement('div');rychle.className='atlas-razeni-rychle';
 rychle.setAttribute('role','group');rychle.setAttribute('aria-label','Řazení');
 obal.append(rychle);
 // Zbytek (cas, PvP ligy) zustava v roletce — jen zmensene a s popiskem.
 obal.append(sel);
 sel.classList.add('atlas-razeni-vic');

 const znam=new Set(RYCHLE.map(x=>x[0]));
 // Roletka zustava zdrojem pravdy, ale uz se neukazuje: vsechno, co
 // z ni zbylo, maji kosticky nebo stitky v hledacim poli.
 sel.hidden=true;
 let aktivni=sel.value;
 let podleStitku=false;

 /* Role: cela skupina najednou, vcetne vlastniho poradi. Stitek umi jednu
    ligu nebo jeden typ; tohle je "ukaz mi vsechny, kdo hraji PvP". */
 const ROLE=[
  ['pvp','PvP','Všechny ligy — od Little Cupu po Master, v lize podle pořadí'],
  ['raid','Raid','Všichni raidoví útočníci — typy podle abecedy, v typu podle pořadí'],
  ['gym','Gym','Kdo drží místo mezi gymovými obránci'],
  ['mega','Mega','Kdo má mega formu — podle typu megy, v typu nejdřív ten, komu ji rozpočet dal']
 ];
 rychle.innerHTML=RYCHLE.map(([val,popis,tip])=>
  `<button type="button" data-razeni="${esc(val)}" data-tip="${esc(tip)}" aria-pressed="false">${esc(popis)}</button>`).join('')
  +ROLE.map(([klic,popis,tip])=>
  `<button type="button" class="atlas-razeni-role" data-role="${esc(klic)}" data-tip="${esc(tip)}" aria-pressed="false">${esc(popis)}</button>`).join('')
  // Posledni sken neni razeni, ale vyber jednoho kusu — prida stitek do
  // hledaciho pole, at se filtruje jedinym zpusobem.
  +`<button type="button" class="atlas-razeni-sken" data-sken="1"
    data-tip="Ukáže poslední naskenovaný kus — odsud pokračuj">Poslední sken</button>`;
 let role='',stitekRadi=false;

 function nastav(hodnota){
  aktivni=hodnota;
  sel.value=hodnota;
  sel.dispatchEvent(new Event('change',{bubbles:true}));
  sync();
 }

 function sync(){
  rychle.querySelectorAll('[data-razeni]').forEach(b=>{
   // Kdyz radi hledany stitek nebo role, nema byt vybrane zadne z techhle.
   b.setAttribute('aria-pressed',String(!podleStitku&&!role&&b.dataset.razeni===aktivni));
  });
  rychle.querySelectorAll('[data-role]').forEach(b=>{
   b.setAttribute('aria-pressed',String(b.dataset.role===role));
   /* Kdyz je v poli stitek ligy nebo typu, uz je serazeno od nejlepsiho
      a role by to jen prebila. Zasedle je to poctivejsi nez tlacitko,
      po kterem se zda, ze se nic nestalo. */
   b.disabled=stitekRadi;
   b.title=stitekRadi?'Štítek v hledání už řadí od nejlepšího — role by to přebila':'';
  });
  obal.classList.toggle('podle-stitku',podleStitku||!!role);
 }

 rychle.addEventListener('click',e=>{
  if(e.target.closest('[data-sken]')){
   window.AtlasHledaniPridej&&window.AtlasHledaniPridej('SKEN');
   return;
  }
  const r=e.target.closest('[data-role]');
  if(r){
   // Druhe kliknuti roli vypne.
   role=role===r.dataset.role?'':r.dataset.role;
   P.atlasRole&&P.atlasRole(role);
   /* Role si nese vlastni poradi, takze zadne jine razeni nema byt
      aktivni. Po vypnuti se vraci to, co platilo pred ni: kdyz je v poli
      stitek, radi zas on — ne CP. */
   if(role)nastav(''); else nastav(podleStitku?'':VYCHOZI);
   window.__atlasTest?.refresh?.();
   return;
  }
  const b=e.target.closest('[data-razeni]');if(!b)return;
  // Rucni volba ma prednost pred razenim podle stitku i role.
  podleStitku=false;
  if(role){role='';P.atlasRole&&P.atlasRole('')}
  nastav(b.dataset.razeni);
 });
 sel.addEventListener('change',()=>{aktivni=sel.value;sync()});

 /* Kdyz se v hledacim poli objevi stitek, radi se podle nej: engine to
    dela sam pri "puvodnim razeni", takze se na nej prepne a zadna
    kosticka neni vybrana. Po odebrani stitku se vrati vychozi CP. */
 $('#zrusitFiltry')?.addEventListener('click',()=>{
  if(!role)return;
  role='';nastav(VYCHOZI);
 });

 window.addEventListener('atlas:stitky',e=>{
  const maStitky=!!(e.detail&&e.detail.pocet);
  const radi=!!(e.detail&&e.detail.radi);
  if(radi!==stitekRadi){
   stitekRadi=radi;
   // Stitek s poradim roli vypina — dve razeni najednou nedavaji smysl.
   if(radi&&role){role='';P.atlasRole&&P.atlasRole('')}
  }
  if(maStitky===podleStitku){sync();return}
  podleStitku=maStitky;
  nastav(maStitky?'':VYCHOZI);
 });

 // Vychozi razeni: CP od nejvyssiho. "Puvodni poradi" uz volba neni.
 if(!znam.has(aktivni))nastav(VYCHOZI); else sync();
})();

/* Hlidac nove verze. Engine se pta `verze.json`, jestli vedle nej nelezi
   novejsi appka, a az na to prijde, sam se obnovi — ale ne driv, nez ma
   clovek dodelano. O svych oknech engine nevi, tahle je jeho seznamu
   pripise vrstva. Veta zni "Pockam, <tohle> — o nic neprijdes." */
(()=>{const P=window.__pgo;if(!P||!P.zaneprazdneniPridat)return;
 P.zaneprazdneniPridat(()=>{
  if(document.querySelector('#atlasRowEditor'))return 'dokud upravuješ kus';
  const imp=document.getElementById('atlasImportDialog');
  if(imp&&imp.open)return 'dokud máš rozdělaný import';
  if(document.querySelector('#atlasModal:not([hidden])'))return 'dokud máš otevřený detail kusu';
  if(document.getElementById('novinkyOkno'))return 'dokud čteš novinky';
  return '';
 });
})();
