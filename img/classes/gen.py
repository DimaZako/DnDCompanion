# Генерує емблеми класів (SVG) у цій теці й друкує CSS-палітри класів для styles.css.
# Запуск: python3 img/classes/gen.py
import os, colorsys

OUT = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)

# base — основний колір класу, light — світлий відтінок, dark — темний
PAL = {
    'barbarian': ('#e2622f', '#ffb27a', '#6e2410'),
    'bard':      ('#d6539b', '#ffb0dc', '#6b1d4a'),
    'cleric':    ('#b9c9dc', '#ffffff', '#3f5670'),
    'druid':     ('#4caf50', '#b4ecae', '#1f5a22'),
    'fighter':   ('#d24b4b', '#ffa196', '#5e1717'),
    'monk':      ('#3fa7d6', '#b2e7fd', '#154e6b'),
    'paladin':   ('#e2b13c', '#fff1bd', '#6e5210'),
    'ranger':    ('#8d9b3a', '#dbe596', '#3c4414'),
    'rogue':     ('#7d8794', '#d3d9e1', '#20252c'),
    'sorcerer':  ('#20c0d0', '#b0f6fc', '#0b5560'),
    'warlock':   ('#9b4fd1', '#e0bcff', '#3d1660'),
    'wizard':    ('#4f6ef0', '#c0cbff', '#1d2b75'),
}
STEEL = ('#d9dfe6', '#ffffff', '#4a525a')
WOOD = ('#9a6431', '#d6a06a', '#4a2a10')


def frame(c, body, extra_defs=''):
    base, light, dark = c
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<defs>
<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="{base}" stop-opacity=".55"/><stop offset=".6" stop-color="{base}" stop-opacity=".18"/><stop offset="1" stop-color="{base}" stop-opacity="0"/></radialGradient>
<linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{light}"/><stop offset="1" stop-color="{base}"/></linearGradient>
<linearGradient id="st" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{STEEL[1]}"/><stop offset="1" stop-color="{STEEL[0]}"/></linearGradient>
<linearGradient id="wd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{WOOD[1]}"/><stop offset="1" stop-color="{WOOD[0]}"/></linearGradient>
{extra_defs}
</defs>
<circle cx="100" cy="100" r="99" fill="url(#glow)"/>
<circle cx="100" cy="100" r="86" fill="none" stroke="{base}" stroke-opacity=".5" stroke-width="2.5"/>
<circle cx="100" cy="100" r="78" fill="none" stroke="{light}" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="1.5 6"/>
<g stroke-linejoin="round" stroke-linecap="round">
{body}
</g>
</svg>
'''


def sword(x, y, length, rot, blade='url(#st)', dark=STEEL[2], guard=None, grip=None):
    # меч вістрям угору; (x, y) — центр гарди
    g = guard or '#c9a227'
    gr = grip or WOOD[2]
    return f'''<g transform="rotate({rot} {x} {y})">
<path d="M{x-6},{y} L{x-6},{y-length+18} L{x},{y-length} L{x+6},{y-length+18} L{x+6},{y} Z" fill="{blade}" stroke="{dark}" stroke-width="2.5"/>
<path d="M{x},{y-length+6} L{x},{y-4}" stroke="{dark}" stroke-opacity=".35" stroke-width="1.5"/>
<rect x="{x-20}" y="{y-2}" width="40" height="7" rx="3.5" fill="{g}" stroke="{dark}" stroke-width="2.5"/>
<rect x="{x-4.5}" y="{y+5}" width="9" height="24" rx="3" fill="{gr}" stroke="{dark}" stroke-width="2"/>
<circle cx="{x}" cy="{y+33}" r="6" fill="{g}" stroke="{dark}" stroke-width="2.5"/>
</g>'''


def barbarian(c):
    b, l, d = c
    blade = 'M104,64 L138,46 Q164,84 138,122 L104,104 Q116,84 104,64 Z'
    return frame(c, f'''
<g transform="rotate(-18 100 100)">
<rect x="94" y="38" width="12" height="134" rx="5" fill="url(#wd)" stroke="{WOOD[2]}" stroke-width="2.5"/>
<path d="M94,150 h12 M94,158 h12 M94,166 h12" stroke="{d}" stroke-width="3"/>
<path d="{blade}" fill="url(#m)" stroke="{d}" stroke-width="3"/>
<path d="{blade}" transform="translate(200 0) scale(-1 1)" fill="url(#m)" stroke="{d}" stroke-width="3"/>
<path d="M136,54 Q152,84 136,114" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3"/>
<path d="M64,54 Q48,84 64,114" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3"/>
<rect x="90" y="70" width="20" height="30" rx="4" fill="{b}" stroke="{d}" stroke-width="2.5"/>
<path d="M100,24 L108,40 L92,40 Z" fill="url(#st)" stroke="{STEEL[2]}" stroke-width="2.5"/>
</g>''')


def bard(c):
    b, l, d = c
    return frame(c, f'''
<g transform="rotate(-32 100 104)">
<path d="M100,96 C70,96 56,122 60,146 C64,170 84,182 100,182 C116,182 136,170 140,146 C144,122 130,96 100,96 Z" fill="url(#m)" stroke="{d}" stroke-width="3"/>
<path d="M78,124 C74,136 76,152 86,164" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="3"/>
<rect x="92" y="34" width="16" height="70" rx="3" fill="url(#wd)" stroke="{WOOD[2]}" stroke-width="2.5"/>
<path d="M90,36 L86,14 L114,14 L110,36 Z" fill="{WOOD[0]}" stroke="{WOOD[2]}" stroke-width="2.5"/>
<g fill="{l}" stroke="{d}" stroke-width="1.5"><circle cx="83" cy="20" r="3.5"/><circle cx="82" cy="30" r="3.5"/><circle cx="117" cy="20" r="3.5"/><circle cx="118" cy="30" r="3.5"/></g>
<circle cx="100" cy="134" r="13" fill="{d}" stroke="{l}" stroke-width="2"/>
<circle cx="100" cy="134" r="8" fill="none" stroke="{l}" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="2 2.5"/>
<rect x="86" y="160" width="28" height="6" rx="2" fill="{WOOD[2]}"/>
<path d="M96,38 V162 M100,38 V162 M104,38 V162" stroke="#fff" stroke-opacity=".8" stroke-width="1"/>
</g>
<g fill="{l}" stroke="{d}" stroke-width="2">
<path d="M150,52 v-26 l14,-4 v26" fill="none"/><ellipse cx="146" cy="53" rx="6" ry="4.5"/><ellipse cx="160" cy="49" rx="6" ry="4.5"/>
</g>''')


def cleric(c):
    b, l, d = c
    rays = ''.join(f'<path d="M100,30 L108,58 L92,58 Z" transform="rotate({a} 100 100)"/>' for a in range(0, 360, 30))
    rays2 = ''.join(f'<path d="M100,44 L104,60 L96,60 Z" transform="rotate({a} 100 100)"/>' for a in range(15, 360, 30))
    return frame(c, f'''
<g fill="url(#m)" stroke="{d}" stroke-width="2.5">{rays}</g>
<g fill="{l}" stroke="{d}" stroke-width="1.5" opacity=".9">{rays2}</g>
<circle cx="100" cy="100" r="36" fill="url(#m)" stroke="{d}" stroke-width="3"/>
<circle cx="100" cy="100" r="27" fill="none" stroke="{d}" stroke-opacity=".5" stroke-width="2"/>
<path d="M100,78 L108,92 L122,100 L108,108 L100,122 L92,108 L78,100 L92,92 Z" fill="#fff" stroke="{d}" stroke-width="2.5"/>
<circle cx="100" cy="100" r="5" fill="{b}" stroke="{d}" stroke-width="2"/>''')


def druid(c):
    b, l, d = c
    leaf = 'M100,168 C62,132 64,74 100,32 C136,74 138,132 100,168 Z'
    veins = ''.join(f'<path d="M100,{y} L{100-w},{y-14} M100,{y} L{100+w},{y-14}"/>' for y, w in [(140, 20), (118, 24), (96, 22), (74, 16)])
    return frame(c, f'''
<path d="M150,40 A40,40 0 1 0 172,104 A32,32 0 1 1 150,40 Z" fill="#f4f1d0" stroke="{d}" stroke-width="2.5" opacity=".9"/>
<g transform="rotate(-38 100 168)"><path d="{leaf}" transform="translate(100 168) scale(.62) translate(-100 -168)" fill="{l}" stroke="{d}" stroke-width="3"/></g>
<g transform="rotate(38 100 168)"><path d="{leaf}" transform="translate(100 168) scale(.62) translate(-100 -168)" fill="{l}" stroke="{d}" stroke-width="3"/></g>
<path d="{leaf}" fill="url(#m)" stroke="{d}" stroke-width="3"/>
<g stroke="{d}" stroke-opacity=".55" stroke-width="2" fill="none"><path d="M100,166 L100,46"/>{veins}</g>
<path d="M100,168 Q98,182 90,188" fill="none" stroke="{WOOD[2]}" stroke-width="4"/>''')


def fighter(c):
    b, l, d = c
    return frame(c, f'''
{sword(64, 150, 132, 40)}
{sword(136, 150, 132, -40)}
<path d="M100,56 L142,68 C142,112 128,140 100,158 C72,140 58,112 58,68 Z" fill="url(#m)" stroke="{d}" stroke-width="3.5"/>
<path d="M100,66 L132,75 C131,108 121,130 100,145 C79,130 69,108 68,75 Z" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
<path d="M66,92 L100,112 L134,92 L134,106 L100,126 L66,106 Z" fill="{STEEL[0]}" stroke="{d}" stroke-width="2.5"/>
<circle cx="100" cy="80" r="7" fill="#c9a227" stroke="{d}" stroke-width="2.5"/>''')


def monk(c):
    b, l, d = c
    petal = 'M100,146 C86,118 86,86 100,58 C114,86 114,118 100,146 Z'
    ps = ''
    for a, s, f in [(-62, .78, l), (62, .78, l), (-32, .92, 'url(#m)'), (32, .92, 'url(#m)'), (0, 1.0, 'url(#m)')]:
        ps += f'<path d="{petal}" transform="rotate({a} 100 146) translate(100 146) scale({s}) translate(-100 -146)" fill="{f}" stroke="{d}" stroke-width="3"/>'
    return frame(c, f'''
<circle cx="100" cy="72" r="14" fill="none" stroke="{l}" stroke-width="3" opacity=".8"/>
{ps}
<path d="M100,138 L100,90" stroke="#fff" stroke-opacity=".5" stroke-width="2.5"/>
<path d="M44,156 Q72,144 100,156 T156,156" fill="none" stroke="{d}" stroke-width="4"/>
<path d="M54,170 Q77,160 100,170 T146,170" fill="none" stroke="{b}" stroke-width="3.5"/>''')


def paladin(c):
    b, l, d = c
    rays = ''.join(f'<path d="M100,24 L104,40 L96,40 Z" transform="rotate({a} 100 92)"/>' for a in range(-80, 81, 20))
    wing = 'M88,112 C70,96 52,98 34,86 C40,104 50,112 62,116 C52,118 44,118 38,116 C48,128 64,130 78,126 C70,130 64,134 58,134 C70,142 84,138 92,128 Z'
    return frame(c, f'''
<g fill="{l}" stroke="{d}" stroke-width="1.5">{rays}</g>
<circle cx="100" cy="92" r="44" fill="none" stroke="url(#m)" stroke-width="7"/>
<circle cx="100" cy="92" r="44" fill="none" stroke="{d}" stroke-width="1.5" stroke-opacity=".6"/>
<path d="{wing}" fill="url(#m)" stroke="{d}" stroke-width="2.5"/>
<path d="{wing}" transform="translate(200 0) scale(-1 1)" fill="url(#m)" stroke="{d}" stroke-width="2.5"/>
{sword(100, 126, 104, 0, guard=b, grip=d, dark=d)}''')


def ranger(c):
    b, l, d = c
    return frame(c, f'''
<g transform="rotate(-38 100 100)">
<path d="M78,26 Q60,20 66,34 Q146,100 66,166 Q60,180 78,174" fill="none" stroke="{WOOD[2]}" stroke-width="12"/>
<path d="M78,26 Q60,20 66,34 Q146,100 66,166 Q60,180 78,174" fill="none" stroke="url(#wd)" stroke-width="7"/>
<rect x="96" y="88" width="10" height="24" rx="3" fill="{b}" stroke="{d}" stroke-width="2"/>
<path d="M70,32 L70,168" stroke="{l}" stroke-width="1.8"/>
<path d="M60,100 L162,100" stroke="{WOOD[2]}" stroke-width="5"/>
<path d="M60,100 L162,100" stroke="{WOOD[1]}" stroke-width="2.5"/>
<path d="M176,100 L158,90 L162,100 L158,110 Z" fill="url(#st)" stroke="{STEEL[2]}" stroke-width="2.5"/>
<path d="M70,100 L52,88 L44,88 L58,100 L44,112 L52,112 Z" fill="url(#m)" stroke="{d}" stroke-width="2.5"/>
</g>
<g fill="{l}" stroke="{d}" stroke-width="1.5" opacity=".9">
<path d="M150,150 C158,138 172,138 176,146 C168,148 160,152 150,150 Z"/><path d="M146,160 C150,172 162,176 168,170 C160,166 154,162 146,160 Z"/>
</g>''')


def rogue(c):
    b, l, d = c
    mask = 'M42,94 C56,80 82,82 100,92 C118,82 144,80 158,94 C160,112 150,128 132,128 C118,128 108,118 100,110 C92,118 82,128 68,128 C50,128 40,112 42,94 Z'
    return frame(c, f'''
<g transform="rotate(42 100 100)">
<path d="M94,104 L94,36 L100,16 L106,36 L106,104 Z" fill="url(#st)" stroke="{STEEL[2]}" stroke-width="2.5"/>
<path d="M100,24 V100" stroke="{STEEL[2]}" stroke-opacity=".4" stroke-width="1.5"/>
<path d="M80,104 Q100,112 120,104 L120,110 Q100,118 80,110 Z" fill="{b}" stroke="{d}" stroke-width="2.5"/>
<rect x="95" y="112" width="10" height="34" rx="3" fill="{d}" stroke="#000" stroke-opacity=".4" stroke-width="2"/>
<path d="M95,120 h10 M95,128 h10 M95,136 h10" stroke="{b}" stroke-width="2"/>
<circle cx="100" cy="152" r="7" fill="{b}" stroke="{d}" stroke-width="2.5"/>
</g>
<path d="{mask}" fill="{d}" stroke="#000" stroke-opacity=".5" stroke-width="3"/>
<path d="{mask}" fill="none" stroke="{l}" stroke-opacity=".5" stroke-width="1.5" transform="translate(100 105) scale(.93) translate(-100 -105)"/>
<path d="M58,104 C66,96 80,96 88,106 C80,114 66,114 58,104 Z" fill="{b}" stroke="{l}" stroke-width="1.5"/>
<path d="M142,104 C134,96 120,96 112,106 C120,114 134,114 142,104 Z" fill="{b}" stroke="{l}" stroke-width="1.5"/>
<path d="M158,100 C170,106 176,118 172,130 M158,108 C166,116 166,126 160,136" fill="none" stroke="{d}" stroke-width="4"/>''')


def sorcerer(c):
    b, l, d = c
    flame = 'M100,176 C62,172 50,136 66,106 C72,94 72,80 66,64 C88,72 96,90 94,106 C104,90 114,66 104,26 C142,52 158,96 148,130 C142,156 126,174 100,176 Z'
    inner = 'M100,166 C80,162 74,142 84,124 C88,132 94,136 98,134 C96,120 102,104 112,94 C126,116 130,140 122,154 C116,162 110,166 100,166 Z'
    sparks = ''.join(f'<path d="M{x},{y-s} L{x+s*.3},{y-s*.3} L{x+s},{y} L{x+s*.3},{y+s*.3} L{x},{y+s} L{x-s*.3},{y+s*.3} L{x-s},{y} L{x-s*.3},{y-s*.3} Z"/>' for x, y, s in [(52, 62, 9), (152, 50, 7), (160, 150, 6), (44, 142, 5)])
    return frame(c, f'''
<path d="{flame}" fill="url(#m)" stroke="{d}" stroke-width="3"/>
<path d="{inner}" fill="#fff" fill-opacity=".85" stroke="{l}" stroke-width="2"/>
<g fill="{l}" stroke="{d}" stroke-width="1.5">{sparks}</g>''')


def warlock(c):
    b, l, d = c
    return frame(c, f'''
<path d="M62,74 C46,58 46,36 58,22 C60,40 70,52 84,60 Z" fill="url(#m)" stroke="{d}" stroke-width="3"/>
<path d="M138,74 C154,58 154,36 142,22 C140,40 130,52 116,60 Z" fill="url(#m)" stroke="{d}" stroke-width="3"/>
<path d="M30,104 C56,66 144,66 170,104 C144,142 56,142 30,104 Z" fill="{d}" stroke="{b}" stroke-width="3.5"/>
<path d="M40,104 C64,74 136,74 160,104 C136,134 64,134 40,104 Z" fill="#f3eaff"/>
<circle cx="100" cy="104" r="27" fill="url(#m)" stroke="{d}" stroke-width="3"/>
<circle cx="100" cy="104" r="19" fill="none" stroke="{d}" stroke-opacity=".45" stroke-width="2"/>
<path d="M100,82 C108,94 108,114 100,126 C92,114 92,94 100,82 Z" fill="#14051f"/>
<circle cx="91" cy="95" r="4" fill="#fff" fill-opacity=".85"/>
<path d="M58,146 C70,160 86,166 100,166 C114,166 130,160 142,146" fill="none" stroke="{b}" stroke-width="3" stroke-dasharray="2 7"/>''')


def wizard(c):
    b, l, d = c
    s = 22
    star = f'M100,{58-s} L{100+s*.28},{58-s*.28} L{100+s},58 L{100+s*.28},{58+s*.28} L100,{58+s} L{100-s*.28},{58+s*.28} L{100-s},58 L{100-s*.28},{58-s*.28} Z'
    return frame(c, f'''
<path d="M100,118 C82,108 58,108 36,114 L40,160 C62,154 84,156 100,164 C116,156 138,154 160,160 L164,114 C142,108 118,108 100,118 Z" fill="{b}" stroke="{d}" stroke-width="3"/>
<path d="M100,112 C82,100 60,100 42,106 L44,150 C64,144 84,146 100,156 Z" fill="#f4ecd8" stroke="{d}" stroke-width="2.5"/>
<path d="M100,112 C118,100 140,100 158,106 L156,150 C136,144 116,146 100,156 Z" fill="#fbf5e6" stroke="{d}" stroke-width="2.5"/>
<g stroke="{d}" stroke-opacity=".35" stroke-width="2"><path d="M54,116 C66,113 78,114 90,118 M54,126 C66,123 78,124 90,128 M54,136 C66,133 78,134 90,138"/><path d="M110,118 C122,114 134,113 146,116 M110,128 C122,124 134,123 146,126 M110,138 C122,134 134,133 146,136"/></g>
<path d="M100,112 V156" stroke="{d}" stroke-width="2.5"/>
<circle cx="100" cy="58" r="30" fill="none" stroke="{l}" stroke-opacity=".6" stroke-width="2" stroke-dasharray="3 5"/>
<path d="{star}" fill="url(#m)" stroke="{d}" stroke-width="2.5"/>
<g fill="{l}"><circle cx="64" cy="70" r="3"/><circle cx="138" cy="44" r="2.5"/><circle cx="142" cy="82" r="2"/><circle cx="58" cy="40" r="2"/></g>
<path d="M100,88 V106" stroke="{l}" stroke-opacity=".7" stroke-width="2" stroke-dasharray="2 4"/>''')


FN = dict(barbarian=barbarian, bard=bard, cleric=cleric, druid=druid, fighter=fighter, monk=monk, paladin=paladin,
          ranger=ranger, rogue=rogue, sorcerer=sorcerer, warlock=warlock, wizard=wizard)
for k, f in FN.items():
    with open(f'{OUT}/{k}.svg', 'w') as fh:
        fh.write(f(PAL[k]))


def lum(h):
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda c: c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b)


def contrast(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + .05) / (lb + .05)


css = []
for k, (b, l, d) in PAL.items():
    txt = '#ffffff' if contrast(b, '#ffffff') >= contrast(b, '#111111') else '#111111'
    css.append(f"[data-cls={k}] {{ --cls: {b}; --cls-l: {l}; --cls-d: {d}; --cls-text: {txt}; --cls-img: url(img/classes/{k}.svg); }}")
print('\n'.join(css))
