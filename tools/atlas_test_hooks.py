"""Úpravy, které platí JEN pro testovací build. Do výpočtů se nesahá.

Zbylo tu jediné: oddělení úložiště. Testovací verze se otevírá ze stejného
místa jako produkční, takže by si sáhla na tentýž `localStorage` a přepsala
uživateli roster, profily i zálohy. Přejmenováním předpony `pgo_` na
`pgo_test_` dostane test vlastní prostor a produkce zůstane nedotčená.

Vykreslení detailu, řazení zvenčí a událost o změně záložky tu dřív byly
taky — vpichovaly se do enginu textovou náhradou. Od 11. 9. 2026 je to
veřejné API enginu (`atlasSort`, `atlasDetail`, `atlasImage` a událost
`atlas:route`), popsané v docs/ATLAS_KONTRAKT.md, takže se nic vpichovat
nemusí.
"""
import re


def prepare_atlas_test(html):
    # Kdyby API z enginu zmizelo, testovací verze by se rozpadla až v
    # prohlížeči a na první pohled by to vypadalo jako chyba vzhledu.
    for cast in ("atlasSort:", "atlasDetail:", "atlasImage:", '"atlas:route"'):
        if cast not in html:
            raise SystemExit(
                "STOP: engine uz nenabizi %s, na kterem stoji vzhledova vrstva.\n"
                "      Viz docs/ATLAS_KONTRAKT.md, oddil API pro vzhledovou vrstvu." % cast)
    html = re.sub(r'''(["'])pgo_''', r'\1pgo_test_', html)
    return html.replace("__pgo_profily_zalohy", "__pgo_test_profily_zalohy")
