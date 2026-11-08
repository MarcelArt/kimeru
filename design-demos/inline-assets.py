"""Make the draft HTML files portable after local preview assets are final."""
from pathlib import Path
import base64
import mimetypes

root=Path(__file__).parent
assets={}
for p in (root/'assets').iterdir():
    if p.suffix in ('.png','.jpg','.svg','.woff2','.ttf'):
        mime=mimetypes.guess_type(p)[0] or 'application/octet-stream'
        assets['assets/'+p.name]='data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()

for p in [root/f'dir-{i}.html' for i in (1,2,3)]:
    if not p.exists(): continue
    s=p.read_text()
    for name,url in assets.items():
        s=s.replace(name,url)
    font=next((url for name,url in assets.items() if name.endswith('.ttf')),None)
    fontcss='@font-face{font-family:Inter;src:url('+font+') format("truetype");font-weight:100 900;font-style:normal;font-display:swap;}' if font else ''
    if '/* embedded-preset */' not in s:
        preset=(root/'assets'/'preset.css').read_text() if (root/'assets'/'preset.css').exists() else ''
        s=s.replace('</head>','<style>/* embedded-preset */'+fontcss+'\n'+preset+'</style></head>')
    p.write_text(s)
    print(p.name, 'embedded assets; bytes:', len(s))
