"""Structured import reporting for Atlas TEST only; matching rules are unchanged."""
def prepare_atlas_import(html):
    def replace(a,b):
        nonlocal html
        if a not in html: raise RuntimeError('Missing Atlas import integration point: '+a)
        html=html.replace(a,b,1)
    replace('var updated = 0, added = 0, poweredUp = 0, evolved = 0, nejasnych = 0, taken = [];','var updated = 0, added = 0, poweredUp = 0, evolved = 0, nejasnych = 0, taken = [];var atlasAudit={updated:[],added:[],powered:[],evolved:[]};')
    replace('if (cpN !== cpO) poweredUp++;','if (cpN !== cpO) {poweredUp++;atlasAudit.powered.push({before:Object.assign({},target),after:Object.assign({},imp)});}')
    replace('if (target && bylVylepsen(target, imp)) poweredUp++;','if (target && bylVylepsen(target, imp)) {poweredUp++;atlasAudit.powered.push({before:Object.assign({},target),after:Object.assign({},imp)});}')
    replace('target.pokemon = imp.pokemon;   //','atlasAudit.evolved.push({before:Object.assign({},target),after:Object.assign({},imp)});target.pokemon = imp.pokemon;   //')
    replace('if (!target) { rows.push(imp); added++;','if (!target) {atlasAudit.added.push({after:Object.assign({},imp)});rows.push(imp); added++;')
    replace('      updated++;','      updated++;atlasAudit.updated.push({before:Object.assign({},target),after:Object.assign({},imp)});')
    replace('return { updated: updated, added: added, poweredUp: poweredUp, evolved: evolved,','return {atlasAudit:atlasAudit, updated: updated, added: added, poweredUp: poweredUp, evolved: evolved,')
    replace('    window.alert(report',"    window.AtlasImportDone({mode:mode,imported:imported,merge:typeof m==='undefined'?null:m,retained:typeof podrzene==='undefined'?[]:podrzene,removed:jeCelyBox&&typeof kSmazani!=='undefined'?kSmazani:[],skipped:skipped,duplicates:mergedCount},report")
    replace('''    if (!rows.length) { finishImport("replace"); return; }
    appPotvrdit("Nahradit celý roster? Přijdeš o ruční úpravy (Forma, poznámky).",
      function () { finishImport("replace"); }, "Nahradit");''',
            '''    if(rows.length && !window.AtlasReplaceApproved()){window.AtlasAskReplace();return;}
    finishImport("replace");''')
    return html
