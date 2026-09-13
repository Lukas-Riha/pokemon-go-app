"""Bridge engine focus requests to the Atlas drawer in TEST only."""
def prepare_atlas_ui(html):
    needle='  function zamerKus(id) {'
    if needle not in html: raise RuntimeError('Missing zamerKus TEST integration point')
    return html.replace(needle,needle+'\n    if(window.AtlasFocusRow)return window.AtlasFocusRow(id);',1)
