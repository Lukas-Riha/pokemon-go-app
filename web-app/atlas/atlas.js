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
window.AtlasTags=(c,r={})=>String(c.types||'').split(' / ').filter(t=>t&&t!=='–').map(t=>{const color=__pgo.typeColors()[t];return color?'<span class="d-type atlas-roster-type" style="background:'+color+'">'+__pgo.typIkona(t)+t+'</span>':''}).join('')+[['L2','LUCKY',c.lucky],['SH','SHADOW',r.forma==='Shadow'],['PU','PURIFIED',r.forma==='Purified'],['D','DMAX',c.dynamax],['S','SHINY',c.shiny],['C','CUTE',c.cute],['H','100%',c.stoProcent]].filter(([, ,enabled])=>enabled).map(([key,text])=>'<span class="rarity-chip r-'+key+' atlas-roster-tag">'+text+'</span>').join('');

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
  const art=r=>{const key=P.dexKeyOf(r.pokemon);return window.ATLAS_ART[key]||(/^pumpkaboo/i.test(r.pokemon)?window.ATLAS_ART['pumpkaboo-average']:null)||(/^shellos east sea/i.test(r.pokemon)?window.ATLAS_ART['shellos-eastsea']:null)||(()=>{const t=document.createElement('template');t.innerHTML=P.atlasImage(r.pokemon);return t.content.querySelector('img')?.getAttribute('src')})()||fallback;};
  document.addEventListener('error',e=>{const img=e.target;if(!img.matches?.('img[data-atlas-pokemon]'))return;const t=document.createElement('template');t.innerHTML=P.atlasImage(img.dataset.atlasPokemon);const native=t.content.querySelector('img'),urls=[native?.getAttribute('src'),native?.dataset.zaloha,fallback].filter(Boolean);const tried=JSON.parse(img.dataset.atlasTried||'[]');tried.push(img.src);img.dataset.atlasTried=JSON.stringify(tried);const next=urls.find(url=>!tried.includes(url));if(next)img.src=next;},true);
  const monImage=(r,extra='')=>`<img src="${art(r)}" alt="${esc(r.pokemon)}" data-atlas-pokemon="${esc(r.pokemon)}" loading="lazy" ${extra}>`;
  const groups={home:[],roster:[['roster','Moji Pokémoni']],teams:[['cheatCard','Týmy a souboje'],['rozpocetCard','Pokrytí rolí'],['typesCard','Typy a počasí'],['refCard','Žebříčky'],['prohlidkaCard','Hledat druh'],['friendCard','Výměna']],invest:[['dustCard','Investiční plán']],events:[['eventsCard','Kalendář'],['catchCard','Co chytat']],settings:[['settings-card','Nastavení'],['docsCard','Data a metodika']]};
  const nav=[['home','home','Přehled'],['roster','box','Pokémoni'],['teams','team','Týmy'],['invest','invest','Investice'],['events','calendar','Události']];
  const headings={home:['Tvůj box. Jasný plán.','Co ponechat, připravit a použít při příštím hraní.'],roster:['Moji Pokémoni','Doporučení a další krok. Podrobnosti otevřeš u konkrétního kusu.'],teams:['Připraveni do boje','Týmy, role a pokrytí z tvého současného rosteru.'],invest:['Každý prach má svůj cíl','Naplánuj vylepšení podle svého rozpočtu.'],events:['Příležitosti pro tvůj box','Události, rotace a tipy na chytání.'],settings:['Data a pravidla','Profily, prahy a vysvětlení výpočtů.']};
  let view='home',route='roster',page=0,dialogId=null,previousFocus=null,refreshTimer=null,missingOnly=false,cache={rows:[],computed:{}};
  let compact=true;try{compact=localStorage.getItem('pgo_test_atlas_compact')!=='0'}catch{}
  document.body.classList.toggle('atlas-compact',compact);
  const navHTML=()=>nav.map(([g,i,t])=>`<button data-atlas-nav="${g}" aria-label="${t}">${icon(i)}<span>${t}</span></button>`).join('');
  const shell=document.createElement('div');shell.id='atlasShell';shell.innerHTML=`<aside class="atlas-side"><div class="atlas-brand"><span class="atlas-brand-mark">${icon('box')}</span><span>GO</span><span>Atlas</span></div><div class="atlas-nav-label">TVŮJ HERNÍ PLÁN</div><nav class="atlas-nav" aria-label="Hlavní navigace">${navHTML()}<button data-atlas-nav="settings">${icon('settings')}<span>Data a pravidla</span></button></nav><div class="atlas-side-foot"><span class="atlas-test-badge">TESTOVACÍ VERZE</span><p>Oddělené profily a zálohy.<br>Produkční roster se nemění.</p><strong id="atlasProfile"></strong><p id="atlasCount"></p></div></aside><header class="atlas-top"><div class="atlas-crumb">GO Atlas <b id="atlasCrumb">/ Přehled</b></div><div class="atlas-top-actions"><span class="atlas-test-badge atlas-status">LOKÁLNÍ TEST</span><button data-click="toggleImportBtn">${icon('upload')} Import CSV</button><button data-click="exportBtn">${icon('download')} Export</button><button class="atlas-icon-btn" data-atlas-action="theme" aria-label="Přepnout světlý nebo tmavý vzhled">${icon('moon')}</button><button class="atlas-icon-btn" data-atlas-nav="settings" aria-label="Nastavení">${icon('settings')}</button></div></header><nav class="atlas-bottom" aria-label="Mobilní navigace">${navHTML()}</nav><div class="atlas-modal" id="atlasModal" hidden><div class="atlas-backdrop" data-atlas-action="close"></div><section class="atlas-drawer" role="dialog" aria-modal="true" aria-labelledby="atlasDetailTitle"><div class="atlas-drawer-header"><span>KONKRÉTNÍ KUS · TVŮJ PLÁN</span><button data-atlas-action="close" aria-label="Zavřít detail">${icon('close')}</button></div><div id="atlasIdentity"></div><div class="atlas-detail-content" id="atlasDetailContent"></div><div style="padding:0 22px 28px"><button class="atlas-mini-btn" data-atlas-action="edit">Upravit údaje tohoto kusu ${icon('arrow')}</button></div></section></div>`;document.body.appendChild(shell);
  const heading=document.createElement('div');heading.id='atlasHeading';heading.className='atlas-heading';
  const subnav=document.createElement('nav');subnav.id='atlasSubnav';subnav.className='atlas-subnav';subnav.setAttribute('aria-label','Nástroje sekce');
  const home=document.createElement('section');home.id='atlasHome';
  const app=$('.app');app.prepend(heading,subnav,home);
  const rosterCard=$('.card.roster'),mode=document.createElement('div');mode.className='atlas-mode';mode.innerHTML='<span>Zobrazení rosteru</span><div class="atlas-mode-controls"><label for="atlasSort">Řazení</label><select id="atlasSort" aria-label="Řazení stručného seznamu"><option value="">Původní řazení</option><option value="pokemon:1">Jméno A–Z</option><option value="cp:-1">Nejvyšší CP</option><option value="ivPct:-1">Nejvyšší IV</option><option value="pvpRec:1">PvP liga a pořadí</option></select><button data-atlas-action="mode"></button></div>';
  const list=document.createElement('div');list.id='atlasRoster';list.className='atlas-roster';const table=$('#rosterTable').closest('.table-wrap');table.before(mode,list);
  function sync(g,r){view=g;route=r||route;document.body.dataset.atlasView=g;const [title,subtitle]=headings[g];heading.innerHTML=`<div><div class="atlas-eyebrow">GO ATLAS · TESTOVACÍ VERZE</div><h1>${title}</h1><p>${subtitle}</p></div>${['home','roster'].includes(g)?`<button class="atlas-cta" data-click="boxModeBtn">${icon('spark')} Projít box</button>`:''}`;subnav.innerHTML=groups[g].length>1?groups[g].map(([id,t])=>`<button data-atlas-route="${id}" class="${id===r?'active':''}" ${id===r?'aria-current="page"':''}>${t}</button>`).join(''):'';document.querySelectorAll('[data-atlas-nav]').forEach(b=>{b.classList.toggle('active',b.dataset.atlasNav===g);if(b.dataset.atlasNav===g)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});$('#atlasCrumb').textContent='/ '+(nav.find(n=>n[0]===g)?.[2]||'Data a pravidla');try{localStorage.setItem('pgo_test_atlas_view',g)}catch{}if(g==='home')renderHome();}
  function go(g,r){closeDetail();if(g==='home')sync('home');else window.__pgoZalozka(r||groups[g][0][0]);window.scrollTo({top:0,behavior:'instant'});}
  window.addEventListener('atlas:route',e=>{const g=Object.keys(groups).find(g=>groups[g].some(p=>p[0]===e.detail));if(g)sync(g,e.detail)});
  function role(c){return window.AtlasRole(c)}
  function decision(c){return window.AtlasVerdict(c).label;}
  function next(c,r){if(c.validationIssues?.length)return 'Ověřit CP, level a IV';if(c.cuteOnly)return 'Ponechat pro radost';if(!r.fastMove||!r.charged1)return 'Doplnit útoky';if(c.powerup&&c.powerup.startsWith('Ano'))return 'Otevřít plán vylepšení';if(c.evolve&&c.evolve.startsWith('Ano'))return 'Ověřit cestu evoluce';return 'Prohlédnout doporučení';}
  function rowHTML(r){const c=cache.computed[r.id]||{},iv=c.ivPct;return `<button class="atlas-row" data-atlas-detail="${esc(r.id)}" aria-label="Detail ${esc(r.pokemon)}"><span class="atlas-poke">${monImage(r)}<span><b>${esc(r.pokemon)}${r.star?' <span aria-label="Označeno">★</span>':''}${window.AtlasTags(c,r)}</b><small><span class="atlas-level">L${esc(r.level||'?')}</span><span>${iv==null?'IV neznámé':Math.round(iv*100)+' % IV'}</span></small></span></span><span class="atlas-num">${fmt(r.cp)}<small>CP</small></span><span class="atlas-decision"><span class="atlas-pill" data-verdict="${window.AtlasVerdict(c).tone}">${decision(c)}</span><small>${esc(role(c))}</small></span><span class="atlas-next">${window.AtlasJourneyHTML(c,r)}</span><span class="atlas-arrow">${icon('next')}</span></button>`;}
  function renderedRows(){const ids=[...$('#tbody').querySelectorAll('tr[data-row-id]')].map(tr=>tr.dataset.rowId);const map=new Map(cache.rows.map(r=>[r.id,r]));return ids.map(id=>map.get(id)).filter(r=>r&&(!missingOnly||!r.fastMove||!r.charged1)&&(!window.AtlasRosterMatch||window.AtlasRosterMatch(r,cache.computed[r.id]||{})));}
  function renderRoster(){const rows=renderedRows(),pages=Math.max(1,Math.ceil(rows.length/24));page=Math.min(page,pages-1);list.innerHTML=`${missingOnly?'<div class="atlas-small-note">Pouze kusy bez úplných útoků · <button class="atlas-mini-btn" data-atlas-action="reset-list">Zrušit filtr útoků</button></div>':''}<div class="atlas-list-head"><span>POKÉMON</span><span>SÍLA</span><span>DOPORUČENÍ</span><span>DALŠÍ KROK</span><span></span></div>${rows.slice(page*24,page*24+24).map(rowHTML).join('')||'<div class="atlas-empty">Filtrům neodpovídá žádný Pokémon. Zkus zrušit hledání nebo změnit filtr.</div>'}<div class="atlas-pagination"><span>${rows.length?page*24+1:0}–${Math.min(rows.length,(page+1)*24)} z ${rows.length} kusů</span><div><button class="atlas-mini-btn" data-atlas-page="-1" ${page===0?'disabled':''} aria-label="Předchozí stránka">←</button><button class="atlas-mini-btn" data-atlas-page="1" ${page===pages-1?'disabled':''} aria-label="Další stránka">→</button></div></div>`;const sortState=P.snapshot(),sortValue=sortState.sortKey+':'+sortState.sortDir;$('#atlasSort').value=[...$('#atlasSort').options].some(o=>o.value===sortValue)?sortValue:'';mode.querySelector('button').textContent=compact?'Úplná tabulka':'Stručné karty';}
  function renderHome(){const rows=cache.rows,c=cache.computed,missing=rows.filter(r=>!r.fastMove||!r.charged1).length,keepers=rows.filter(r=>c[r.id]?.keepGood&&!c[r.id]?.validationIssues?.length),up=rows.filter(r=>c[r.id]?.powerup?.startsWith('Ano'));const featured=rows.find(r=>c[r.id]?.ivPct===1)||keepers[0]||rows[0];const focus=[...keepers].sort((a,b)=>(c[b.id]?.ivPct||0)-(c[a.id]?.ivPct||0)).slice(0,5);home.innerHTML=`<div class="atlas-stats">${[[rows.length,'Pokémonů v boxu','Tvoje aktuální testovací data','box','all'],[keepers.length,'Ponechat podle enginu','Stejné vyhodnocení jako v detailu','check','keep'],[up.length,'K vylepšení','Otevři konkrétní cestu a cenu','invest','powerup'],[missing,'Doplnit útoky','Připravenost není totéž co potenciál','spark','missing']].map(([n,t,s,i,f])=>`<button class="atlas-stat" data-atlas-filter="${f}"><span>${t}${icon(i)}</span><strong>${n}</strong><small>${s}</small></button>`).join('')}</div><div class="atlas-dashboard"><div>${featured?`<section class="atlas-feature"><div><div class="atlas-eyebrow">KUS, KTERÝ STOJÍ ZA POZORNOST</div><h2>${esc(featured.pokemon)}.<br>${c[featured.id]?.ivPct===1?'Dokonalé IV.':'Prozkoumej jeho potenciál.'}</h2><p>${esc(role(c[featured.id]||{}))}. Podívej se na doporučení, cenu a další kroky.</p><button data-atlas-detail="${esc(featured.id)}">Prohlédnout kus ${icon('arrow')}</button></div>${monImage(featured)}</section>`:''}<section class="atlas-panel"><div class="atlas-panel-head"><div><h2>Na co se zaměřit</h2><p>Ponechané kusy s vysokými IV. Nejde o pořadí výdajů.</p></div><button class="atlas-mini-btn" data-atlas-nav="invest">Plán ${icon('arrow')}</button></div>${focus.map(rowHTML).join('')||'<div class="atlas-empty">Načti roster a začni jeho vyhodnocením.</div>'}<div class="atlas-small-note"><button class="atlas-mini-btn" data-atlas-nav="roster">Všichni Pokémoni ${icon('arrow')}</button></div></section></div><aside class="atlas-aside"><section class="atlas-panel"><div class="atlas-panel-head"><h2>Raidové pokrytí</h2></div><div class="atlas-coverage">${['Psychic','Ghost','Fighting','Steel','Water'].map(t=>{const n=rows.filter(r=>c[r.id]?.raid?.includes(t)).length;return `<div class="atlas-cover-row"><div><span>${t}</span><span>${n} kandidátů</span></div><div class="atlas-track"><i style="width:${Math.min(100,n/6*100)}%"></i></div></div>`}).join('')}</div><div class="atlas-small-note">Potenciální role podle produkčního enginu; může zahrnovat evoluci a ideální útoky. Současné sestavy a podmínky otevři v Týmech.</div></section><section class="atlas-panel"><div class="atlas-panel-head"><h2>Před dalším hraním</h2></div><div class="atlas-task">${icon('spark')}<div><strong>${missing} kusů čeká na útoky</strong>Doplň je v detailu nebo úplné tabulce.</div></div><div class="atlas-task">${icon('lock')}<div><strong>${rows.filter(r=>r.star).length} označených hvězdičkou</strong>Značka a doporučení enginu jsou odlišné údaje.</div></div><div class="atlas-task">${icon('calendar')}<div><strong>Ověř aktuální události</strong>Pravidla lig a dostupnost útoků se mohou měnit.</div></div></section></aside></div>`;}
  function refresh(){cache={rows:P.getRows(),computed:P.getComputed()};$('#atlasProfile').textContent=P.getProfile();$('#atlasCount').textContent=cache.rows.length+' Pokémonů · lokální profil';renderRoster();if(view==='home')renderHome();}
  function openDetail(id,retain=false){const r=P.getRows().find(r=>r.id===id);if(!r)return;if(!retain)previousFocus=document.activeElement;dialogId=id;$('#atlasIdentity').innerHTML=`<div class="atlas-detail-identity">${monImage(r)}<div><div class="atlas-eyebrow">${esc(r.forma||'Běžná forma')}${r.star?' · OZNAČENO ★':''}</div><h2 id="atlasDetailTitle">${esc(r.pokemon)}</h2><p>${fmt(r.cp)} CP · L${esc(r.level||'?')}</p><p>IV ${esc(r.ivAtk===''||r.ivAtk==null?'?':r.ivAtk)} / ${esc(r.ivDef===''||r.ivDef==null?'?':r.ivDef)} / ${esc(r.ivSta===''||r.ivSta==null?'?':r.ivSta)}</p></div></div>`;$('#atlasModal').hidden=false;P.atlasDetail(id,$('#atlasDetailContent'),closeDetail);document.body.style.overflow='hidden';if(!retain)$('.atlas-drawer-header button').focus();}
  function closeDetail(){if(!dialogId)return;dialogId=null;$('#atlasModal').hidden=true;$('#atlasDetailContent').innerHTML='';document.body.style.overflow='';previousFocus?.focus({preventScroll:true});}
  window.addEventListener('atlas:refresh-detail',()=>{refresh();if(dialogId)openDetail(dialogId,true)});
  function setCompact(value){compact=value;document.body.classList.toggle('atlas-compact',value);try{localStorage.setItem('pgo_test_atlas_compact',value?'1':'0')}catch{}renderRoster();}
  document.addEventListener('click',e=>{const el=e.target.closest('[data-atlas-nav],[data-atlas-route],[data-atlas-detail],[data-atlas-action],[data-atlas-page],[data-atlas-filter],[data-click]');if(!el)return;if(el.dataset.atlasNav){go(el.dataset.atlasNav);return}if(el.dataset.atlasRoute){go(view,el.dataset.atlasRoute);return}if(el.dataset.atlasDetail){openDetail(el.dataset.atlasDetail);return}if(el.dataset.atlasPage){page+=Number(el.dataset.atlasPage);renderRoster();list.scrollIntoView({block:'start'});return}if(el.dataset.atlasFilter){const f=el.dataset.atlasFilter;go('roster');$('#searchInput').value='';$('#searchInput').dispatchEvent(new Event('input',{bubbles:true}));$('#filterSelect').value=f==='missing'?'all':f;$('#filterSelect').dispatchEvent(new Event('change',{bubbles:true}));missingOnly=f==='missing';refresh();return}if(el.dataset.click){if(el.dataset.click==='toggleImportBtn')go('roster');$('#'+el.dataset.click)?.click();return}switch(el.dataset.atlasAction){case 'close':closeDetail();break;case 'mode':setCompact(!compact);break;case 'reset-list':missingOnly=false;renderRoster();break;case 'theme':{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=t;try{localStorage.setItem('pgo_test_atlas_theme',t)}catch{}break}case 'edit':{const id=dialogId;go('roster');missingOnly=false;$('#zrusitFiltry').click();setCompact(false);$('#viewSelect').value='all';$('#viewSelect').dispatchEvent(new Event('change',{bubbles:true}));const tr=$('#tbody').querySelector(`tr[data-row-id="${CSS.escape(id)}"]`);tr?.scrollIntoView({block:'center'});break}}});
  document.addEventListener('keydown',e=>{if(!dialogId)return;if(e.key==='Escape'){e.preventDefault();closeDetail()}if(e.key==='Tab'){const els=[...$('#atlasModal').querySelectorAll('button:not(:disabled),a,input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')].filter(el=>el.getClientRects().length),first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}});
  new MutationObserver(()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,50)}).observe($('#tbody'),{childList:true});
  $('#searchInput').addEventListener('input',()=>{page=0});$('#filterSelect').addEventListener('change',()=>{page=0;missingOnly=false});
  $('#atlasSort').addEventListener('change',e=>{if(!e.target.value)return;const [key,dir]=e.target.value.split(':');page=0;P.atlasSort(key,Number(dir));refresh()});
  refresh();let start='home';try{start=localStorage.getItem('pgo_test_atlas_view')||'home'}catch{}go(headings[start]?start:'home');
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
  const storageKey=()=> 'pgo_test_atlas_budget:'+P.getProfile();
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
    document.querySelector('.atlas-detail-paging')?.remove();
    const api=window.__atlasTest;
    let ids=api.getDetailSequence();if(!ids.includes(row.id))ids=window.__pgo.getRows().map(r=>r.id);
    const index=ids.indexOf(row.id),paging=document.createElement('nav');paging.className='atlas-detail-paging';paging.setAttribute('aria-label','Procházení Pokémonů');
    for(const [step,label] of [[-1,'← Předchozí'],[1,'Další →']]){const button=document.createElement('button');button.className='atlas-mini-btn';button.textContent=label;button.disabled=!ids[index+step];button.dataset.detailStep=step;button.addEventListener('click',()=>{api.openDetail(ids[index+step],true);document.querySelector('.atlas-drawer').scrollTop=0;const next=document.querySelector('[data-detail-step="'+step+'"]');(next&&!next.disabled?next:document.querySelector('.atlas-drawer-header button')).focus({preventScroll:true})});paging.append(button);}
    const position=document.createElement('span');position.textContent=(index+1)+' / '+ids.length;paging.firstChild.after(position);
    document.querySelector('.atlas-drawer-header').append(paging);
    const main=container.querySelector('.detail-main');if(!main){const edit=document.createElement('button');edit.className='atlas-mini-btn';edit.textContent='Opravit údaje tohoto kusu';edit.addEventListener('click',()=>window.AtlasEditRow(row.id));container.append(edit);return;}
    main.classList.add('atlas-detail-modern');
    const title=main.querySelector('.detail-title');
    if(title){title.setAttribute('aria-label','Vlastnosti a osobní značky');title.querySelector('.d-name')?.remove();title.querySelectorAll('button:not(.detail-close)').forEach(button=>button.setAttribute('aria-pressed',String(!button.classList.contains('vypnuto'))));}
    if(title){title.querySelectorAll('.d-flag,.sto-znacka').forEach(el=>{if(el.textContent.trim().toLowerCase()==='lucky')el.remove()});const lucky=document.createElement('button');lucky.type='button';lucky.className='atlas-lucky-tag'+(computed.lucky?' active':'');lucky.textContent='LUCKY';lucky.setAttribute('aria-label','Přepnout Lucky stav');lucky.setAttribute('aria-pressed',String(!!computed.lucky));lucky.addEventListener('click',()=>{const current=window.__pgo.getRows().find(r=>r.id===row.id);if(!current)return;current.forma=computed.lucky?'Normal':'Lucky';window.__pgo.prekreslit();window.__pgo.persistNow();window.dispatchEvent(new CustomEvent('atlas:refresh-detail'));});title.append(lucky);}
    const sections=[];let active=null;
    [...main.children].forEach(el=>{
      if(el.matches('.d-sec-h')){
        const key=el.dataset.sekce,group=document.createElement('details');group.className='atlas-detail-section';group.dataset.detailSection=key;
        const summary=document.createElement('summary');summary.textContent=({ligy:'Ligy a alternativní cíle',coted:'Doporučené kroky',naco:'Herní využití',proti:'Typové pokrytí',utoky:'Útoky a připravenost'})[key]||el.textContent;
        group.append(summary);el.before(group);el.remove();active=group;sections.push(group);group.open=['utoky','ligy','naco','coted'].includes(key);
      }else if(active)active.append(el);
    });
    const stats=main.querySelector(':scope > .d-grid');if(stats){const group=document.createElement('details');group.className='atlas-detail-section';group.dataset.detailSection='stats';group.innerHTML='<summary>Statistiky, IV a strop CP</summary>';stats.before(group);group.append(stats);sections.push(group);}
    const moves=sections.find(s=>s.dataset.detailSection==='utoky');
    if(moves){const notice=document.createElement('p');notice.className='atlas-move-status';notice.textContent=!row.fastMove||!row.charged1?'Chybí rychlý nebo nabitý útok. Současnou bojovou připravenost nelze plně vyhodnotit.':!row.charged2?'Rychlý a první nabitý útok jsou zadané. Druhý nabitý útok není uvedený; zkontroluj požadavky svého cíle.':'Všechny tři útoky jsou zadané. Jejich vhodnost závisí na cíli a soupeři.';moves.querySelector('summary').after(notice);const edit=document.createElement('button');edit.className='atlas-mini-btn';edit.dataset.atlasAction='edit';edit.textContent='Upravit údaje a útoky →';const first=main.querySelector('.atlas-detail-section');if(first)first.before(moves);}
    for(const key of ['ligy','naco','stats','utoky','coted','proti']){const section=sections.find(s=>s.dataset.detailSection===key);if(section){if(key==='stats')section.open=true;main.append(section);}}
    const verdict=main.querySelector('.d-verdict-row');if(verdict){verdict.classList.add('atlas-verdict-first');container.prepend(verdict);}
    if(verdict){const v=window.AtlasVerdict(computed);verdict.dataset.verdict=v.tone;const label=verdict.querySelector('.d-verdict>b');if(label)label.textContent=v.label;}
    const evo=container.querySelector(':scope > :not(.atlas-plan-summary):not(.detail-main):not(.atlas-verdict-first)');
    if(evo){const group=document.createElement('details');group.className='atlas-detail-section atlas-evolution-column';group.open=true;group.innerHTML='<summary>Evoluční řada</summary>';evo.before(group);group.append(evo);const grid=document.createElement('div');grid.className='atlas-detail-columns';const column=document.createElement('div');column.className='atlas-detail-column';const children=[...container.children];container.prepend(grid);grid.append(column,group);children.filter(el=>el!==group).forEach(el=>column.append(el));}
    container.querySelectorAll('.d-evo-kus[data-tip]').forEach(el=>{el.tabIndex=0;const image=el.querySelector('img'),art=window.ATLAS_ART[window.__pgo.dexKeyOf(el.dataset.druh)];if(image&&art){image.removeAttribute('onerror');image.src=art;image.style.display=''};});
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
    form.innerHTML='<div class="atlas-eyebrow">UPRAVUJEŠ JEDEN KONKRÉTNÍ KUS</div><h3>'+esc(row.pokemon)+'</h3><div class="atlas-editor-grid">'+fields.map(([key,label,type,min,max,step])=>`<label>${label}<input name="${key}" type="${type}" value="${esc(row[key])}" ${min!=null?`min="${min}" max="${max}" step="${step}"`:''} ${key==='pokemon'?'required':''}></label>`).join('')+'<label>Stav / forma<select name="forma">'+forms.map(f=>`<option value="${esc(f)}" ${f===(row.forma||'Normal')?'selected':''}>${esc(f)}</option>`).join('')+'</select></label><label class="atlas-editor-note">Poznámka<textarea name="note">'+esc(row.note)+'</textarea></label></div><div class="atlas-editor-flags">'+[['dynamax','Dynamax'],['cute','CUTE'],['shiny','SHINY']].map(([key,label])=>`<label><input type="checkbox" name="${key}" ${row[key]==='Ano'?'checked':''}>${label}</label>`).join('')+'</div><p>Lucky nastavíš ve stavu/formě. Dynamax a osobní značky se ukládají samostatně. Neznámé IV nech prázdné; samotné procento je neurčuje jednoznačně.</p><div class="atlas-editor-actions"><button type="submit" class="atlas-cta">Uložit tento kus</button><button type="button" class="atlas-mini-btn" data-editor-cancel>Zrušit</button></div><p role="status" id="atlasEditorStatus"></p>';
    const baseline=new Map([...form.elements].filter(e=>e.name).map(e=>[e.name,e.type==='checkbox'?e.checked:e.value]));
    form.querySelector('[data-editor-cancel]').addEventListener('click',()=>{form.remove();document.querySelector('.atlas-drawer-header button')?.focus()});
    form.addEventListener('submit',e=>{e.preventDefault();const current=P.getRows().find(r=>r.id===id);if(!current||profile!==P.getProfile()){form.querySelector('[role=status]').textContent='Kus nebo profil se změnil. Zavři detail a zkontroluj roster.';return}if(!form.reportValidity())return;
      for(const input of form.elements){if(!input.name)continue;const value=input.type==='checkbox'?input.checked:input.value;if(value!==baseline.get(input.name))current[input.name]=input.type==='checkbox'?(value?'Ano':'Ne'):value;}
      P.prekreslit();P.persistNow();window.dispatchEvent(new CustomEvent('atlas:refresh-detail'));document.querySelector('.atlas-drawer').scrollTop=0;
    });
    host.prepend(form);form.scrollIntoView({block:'start'});form.querySelector('[name="'+(field||'pokemon')+'"]').focus({preventScroll:true});
  };
  document.addEventListener('click',e=>{const button=e.target.closest('[data-atlas-action="edit"]');if(!button)return;const id=window.__atlasTest.getState().dialogId;if(!id)return;e.preventDefault();e.stopImmediatePropagation();window.AtlasEditRow(id);},true);
  const footer=document.querySelector('.atlas-drawer>div:last-child button[data-atlas-action="edit"]');if(footer)footer.textContent='Upravit tohoto Pokémona →';
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
  const toolbar=$('#addRowBtn')?.parentElement;if(toolbar){const menu=document.createElement('details');menu.className='atlas-roster-commands';menu.innerHTML='<summary>Správa rosteru ▾</summary><div></div>';toolbar.append(menu);for(const id of ['toggleImportBtn','exportBtn','backupBtn','backupNowBtn','starKeepersBtn','clearBtn','forgetDiscardedBtn']){const el=$('#'+id);if(el)menu.lastChild.append(el)}document.addEventListener('click',e=>{if(!menu.contains(e.target))menu.open=false});menu.addEventListener('click',e=>{if(e.target.closest('button'))menu.open=false});}
})();

(() => {
  const tip=document.createElement('div');tip.className='atlas-evo-tooltip tip-bublina vidno';tip.id='atlasEvoTooltip';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.append(tip);let target=null;
  function hide(){tip.hidden=true;target?.removeAttribute('aria-describedby');target=null;document.body.classList.remove('atlas-evo-tip-open')}
  function show(el){target=el;const template=document.createElement('template');template.innerHTML=el.dataset.tip||'';template.content.querySelectorAll('*').forEach(node=>{if(!['DIV','SPAN','B','STRONG','EM','I','BR','P','SMALL','UL','LI'].includes(node.tagName)){node.replaceWith(document.createTextNode(node.textContent));return}for(const attr of [...node.attributes]){if(attr.name!=='class'&&!(attr.name==='style'&&/^\s*(font-size|margin-top|padding-top|border-top|color)\s*:/i.test(attr.value)))node.removeAttribute(attr.name)}});tip.replaceChildren(template.content.cloneNode(true));tip.style.left='0px';tip.style.top='0px';tip.hidden=false;document.body.classList.add('atlas-evo-tip-open');el.setAttribute('aria-describedby',tip.id);const rect=el.getBoundingClientRect(),box=tip.getBoundingClientRect();tip.style.left=Math.max(12,Math.min(document.documentElement.clientWidth-box.width-16,rect.left+rect.width/2-box.width/2))+'px';tip.style.top=Math.max(12,Math.min(innerHeight-box.height-12,rect.top>=box.height+12?rect.top-box.height-8:rect.bottom+8))+'px';}
  document.addEventListener('pointerover',e=>{const el=e.target.closest('#atlasModal .d-evo-kus[data-tip]');if(el&&el!==target)show(el)});
  document.addEventListener('pointerout',e=>{if(target&&target.contains(e.target)&&!target.contains(e.relatedTarget)&&!tip.contains(e.relatedTarget))hide()});
  document.addEventListener('focusin',e=>{const el=e.target.closest('#atlasModal .d-evo-kus[data-tip]');if(el)show(el)});
  document.addEventListener('focusout',e=>{if(target&&target.contains(e.target))hide()});
  document.addEventListener('click',e=>{const el=e.target.closest('#atlasModal .d-evo-kus[data-tip]');if(el){show(el);e.stopPropagation()}else if(!tip.contains(e.target))hide()},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});window.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);
})();

(() => {
  const P=window.__pgo,$=s=>document.querySelector(s);
  $('.atlas-brand').innerHTML='<span class="atlas-ball-logo" aria-hidden="true"><i></i></span><span class="atlas-brand-name">Pokémon GO<strong>Atlas</strong></span>';
  document.title='[TEST] Pokémon GO Atlas';
  const copy={cheatCard:['Tahák do soubojů','Konkrétní soupeři a sestavy z tvých Pokémonů. Výsledky jsou modelové odhady.'],prohlidkaCard:['Vyhledávání Pokémonů','Najdi druh, jeho formy, ligy a evoluční možnosti.'],rozpocetCard:['Pokrytí rolí','Najdi slabá místa svého boxu a kandidáty na doplnění.'],typesCard:['Typy a počasí','Účinnost útoků, odolnosti a vliv počasí.'],refCard:['Žebříčky','Porovnej druhy podle role; konkrétní kus vyhodnoť v jeho detailu.'],friendCard:['Výměna','Porovnej svůj roster s druhým hráčem.'],eventsCard:['Kalendář událostí','Raidy a události podle zabudovaných dat. Ověř jejich datum aktualizace.'],catchCard:['Co chytat','Pokémoni a candy pro doplnění tvého boxu.'],'settings-card':['Nastavení','Přizpůsob prahy a pravidla doporučení.'],docsCard:['Metodika a zdroje','Význam výsledků, použitá data a omezení výpočtů.']};
  function heading(){const state=__atlasTest.getState(),entry=copy[state.route];document.body.dataset.atlasCurrentRoute=state.route;if(entry&&!['home','roster','invest'].includes(state.view)){$('#atlasHeading h1').textContent=entry[0];$('#atlasHeading p').textContent=entry[1];}}
  window.addEventListener('atlas:route',heading);heading();
  const toolbar=$('#addRowBtn').closest('.toolbar');if(toolbar){const bar=document.createElement('div');bar.className='atlas-roster-commandbar';toolbar.before(bar);for(const el of [$('#addRowBtn'),$('#boxModeBtn'),$('#searchInput'),$('#filterSelect'),$('#zrusitFiltry'),$('.atlas-roster-commands')])if(el)bar.append(el);}
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
 const oldEnhance=window.AtlasEnhanceDetail;window.AtlasEnhanceDetail=(container,row,c)=>{oldEnhance(container,row,c);const block=document.createElement('section');block.className='atlas-journey';block.setAttribute('aria-label','Využití, krok, cena a údaje');block.innerHTML=AtlasJourneyHTML(c,row,true);container.querySelector('.atlas-detail-column')?.prepend(block)};
 const warning=$('#zalWarn');if(warning){const fold=document.createElement('details');fold.className='atlas-storage-fold';fold.innerHTML='<summary>Uložení a zálohování rosteru</summary>';$('.atlas-roster-commands').after(fold);fold.append(warning)}
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
 const dialog=$('#atlasImportDialog'),box=$('#importBox');let approved=false;
 window.AtlasReplaceApproved=()=>{const result=approved;approved=false;return result};
 window.AtlasAskReplace=()=>{if(dialog.querySelector('.atlas-replace-confirm'))return;const panel=document.createElement('section');panel.className='atlas-replace-confirm';panel.innerHTML='<h3>Nahradit současný roster?</h3><p>Roster bude nahrazen vybraným skenem podle nastavených voleb ochrany vzácných kusů. Předchozí stav zůstane v historii aplikace.</p><div class="atlas-result-actions"><button data-confirm-replace>Nahradit roster</button><button data-cancel-replace>Zpět k importu</button></div>';box.before(panel);box.hidden=true;panel.querySelector('[data-cancel-replace]').onclick=()=>{panel.remove();box.hidden=false};panel.querySelector('[data-confirm-replace]').onclick=()=>{panel.remove();box.hidden=false;approved=true;$('#mapReplaceBtn').click()};panel.querySelector('[data-cancel-replace]').focus()};
 window.AtlasImportDone=(data,message)=>{
  window.__atlasLastImport=data;box.classList.add('open');box.hidden=true;dialog.classList.add('atlas-import-complete');if(!dialog.open)dialog.showModal();
  $('#atlasImportTitle').textContent='Import dokončen';dialog.querySelector('header p').textContent='Změny jsou uložené. Rozbal kategorii a zkontroluj konkrétní kusy.';
  const m=data.merge,a=m?.atlasAudit||{},result=document.createElement('section');result.className='atlas-import-result';
  const groups=m?[['Aktualizované',a.updated||[]],['Nově přidané',a.added||[]],['Vylepšené',a.powered||[]],['Vyvinuté',a.evolved||[]],['Sken je nezachytil',(m.mimoSken||[]).map(after=>({after}))],['Odebrané',(data.removed||[]).map(after=>({after}))]]:[['Načtené ze souboru',data.imported.map(after=>({after}))],['Zachované vzácné kusy',data.retained.map(after=>({after}))]];
  result.innerHTML='<div class="atlas-import-stats">'+(m?[['Aktualizováno',m.updated],['Nových',m.added],['Vylepšených',m.poweredUp],['Vyvinutých',m.evolved]]:[['Načteno',data.imported.length],['Zachováno',data.retained.length]]).map(([label,n])=>'<div><strong>'+n+'</strong><span>'+label+'</span></div>').join('')+'</div><p class="atlas-result-note">Vylepšené a vyvinuté kusy jsou součástí aktualizovaných. Nezachycené kusy se samy nemažou; rozhoduje volba celého boxu.</p>'+groups.map(([label,items])=>'<details class="atlas-import-group"><summary>'+esc(label)+'<span>'+items.length+'</span></summary><ul>'+items.map(({before,after:r})=>'<li><strong>'+esc(r.pokemon)+'</strong><span>'+(before?esc(before.pokemon!==r.pokemon?before.pokemon+' → ':'')+esc(before.cp||'?')+' → ':'')+esc(r.cp||'?')+' CP</span></li>').join('')+'</ul>'+(items.length?'':'<p>Žádný kus v této kategorii.</p>')+'</details>').join('')+'<details class="atlas-import-group"><summary>Podrobné hlášení importu</summary><p class="atlas-import-message">'+esc(message)+'</p></details><div class="atlas-result-actions"><button data-result-done>Přejít do rosteru</button></div>';
  dialog.append(result);result.querySelector('[data-result-done]').onclick=()=>{dialog.close();__atlasTest.go('roster')};dialog.scrollTop=0;dialog.querySelector('header button').focus({preventScroll:true});
 };
 dialog.addEventListener('close',()=>{dialog.querySelector('.atlas-import-result')?.remove();dialog.querySelector('.atlas-replace-confirm')?.remove();box.hidden=false;dialog.classList.remove('atlas-import-complete');$('#atlasImportTitle').textContent='Import rosteru';dialog.querySelector('header p').textContent='Vyber soubor, zkontroluj náhled a rozhodni, jak data přidat.'});
})();
