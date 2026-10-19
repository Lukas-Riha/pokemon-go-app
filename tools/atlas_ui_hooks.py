"""Bridge engine focus requests to the Atlas drawer in TEST only.

Vrstva ma misto tabulky vlastni seznam, takze `zamerKus` v ni radek
nenajde a kus by se nikde neoznacil. Prepis se proto vklada az za
prepocet poradi a zruseni filtru — kdyz se predavalo hned na zacatku
funkce, `renderBody()` nikdy neprobehl a rucne pridany kus se do
seznamu vrstvy nedostal (lastVisibleIds zustaly stare).
"""
def prepare_atlas_ui(html):
    needle = '    /* ATLAS-ZAMER '
    i = html.find(needle)
    if i < 0:
        raise RuntimeError('Missing zamerKus TEST integration point')
    konec = html.find('*/', i)
    if konec < 0:
        raise RuntimeError('Unterminated ATLAS-ZAMER marker')
    konec += 2
    patch = '\n    if (window.AtlasFocusRow) return window.AtlasFocusRow(id);'
    return html[:konec] + patch + html[konec:]
