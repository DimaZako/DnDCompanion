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



# ---------- Підкласи (архетипи): власна емблема й палітра ----------
import math


def star(cx, cy, R, r, n=4, rot=-90):
    pts = []
    for i in range(n * 2):
        a = math.radians(rot + i * 180 / n)
        rr = R if i % 2 == 0 else r
        pts.append(f'{cx + rr * math.cos(a):.1f},{cy + rr * math.sin(a):.1f}')
    return 'M' + ' L'.join(pts) + ' Z'


def g(tx, ty, sc, body, rot=0):
    return f'<g transform="translate({tx} {ty}) rotate({rot}) scale({sc}) translate(-100 -100)">{body}</g>'


def inner(svg):
    # вміст емблеми класу без рамки (для повторного використання)
    return svg.split('<g stroke-linejoin="round" stroke-linecap="round">')[1].rsplit('</g>', 1)[0]


FLAME = 'M100,176 C62,172 50,136 66,106 C72,94 72,80 66,64 C88,72 96,90 94,106 C104,90 114,66 104,26 C142,52 158,96 148,130 C142,156 126,174 100,176 Z'
FLAME_IN = 'M100,166 C80,162 74,142 84,124 C88,132 94,136 98,134 C96,120 102,104 112,94 C126,116 130,140 122,154 C116,162 110,166 100,166 Z'
LEAF = 'M100,168 C62,132 64,74 100,32 C136,74 138,132 100,168 Z'
HEART = 'M100,158 C58,128 46,96 64,74 C78,58 98,64 100,82 C102,64 122,58 136,74 C154,96 142,128 100,158 Z'
BOLT = 'M112,30 L68,110 L96,110 L84,170 L134,84 L106,84 Z'
DROP = 'M100,56 C114,78 128,96 128,116 A28,28 0 0 1 72,116 C72,96 86,78 100,56 Z'
SKULL = 'M100,46 C68,46 52,70 54,96 C55,110 62,120 70,124 L70,146 L84,146 L84,136 L93,136 L93,148 L107,148 L107,136 L116,136 L116,146 L130,146 L130,124 C138,120 145,110 146,96 C148,70 132,46 100,46 Z'
SHIELD = 'M100,40 L150,54 C150,108 134,142 100,164 C66,142 50,108 50,54 Z'
CLOUD = 'M58,118 C40,118 36,94 54,90 C52,70 76,60 90,72 C96,52 128,52 132,74 C150,68 164,84 156,100 C170,104 166,122 150,122 L62,122 Z'
PAW_PAD = 'M100,170 C78,170 66,156 70,140 C74,124 88,116 100,116 C112,116 126,124 130,140 C134,156 122,170 100,170 Z'


def crescent(cx, cy, r, k=.84, off=.42):
    # півмісяць, відкритий праворуч: зовнішнє коло мінус зміщене внутрішнє
    r2, o = r * k, r * off
    x = (r * r - r2 * r2 + o * o) / (2 * o)
    y = math.sqrt(max(r * r - x * x, 0))
    small = 1 if x - o > 0 else 0
    return (f'M{cx + x:.1f},{cy - y:.1f} A{r},{r} 0 1 0 {cx + x:.1f},{cy + y:.1f} '
            f'A{r2:.1f},{r2:.1f} 0 {small} 1 {cx + x:.1f},{cy - y:.1f} Z')


def paw(c, cx=100, cy=100, sc=1):
    b, l, d = c
    toes = ''.join(f'<ellipse cx="{x}" cy="{y}" rx="13" ry="17" transform="rotate({rt} {x} {y})"/>' for x, y, rt in [(64, 104, -25), (86, 82, -8), (114, 82, 8), (136, 104, 25)])
    return g(cx, cy, sc, f'<g fill="url(#m)" stroke="{d}" stroke-width="3">{toes}<path d="{PAW_PAD}"/></g>')


def book(c, y=0):
    b, l, d = c
    return (f'<g transform="translate(0 {y})">'
            f'<path d="M100,118 C82,108 58,108 36,114 L40,160 C62,154 84,156 100,164 C116,156 138,154 160,160 L164,114 C142,108 118,108 100,118 Z" fill="{b}" stroke="{d}" stroke-width="3"/>'
            f'<path d="M100,112 C82,100 60,100 42,106 L44,150 C64,144 84,146 100,156 Z" fill="#f4ecd8" stroke="{d}" stroke-width="2.5"/>'
            f'<path d="M100,112 C118,100 140,100 158,106 L156,150 C136,144 116,146 100,156 Z" fill="#fbf5e6" stroke="{d}" stroke-width="2.5"/>'
            f'<g stroke="{d}" stroke-opacity=".35" stroke-width="2"><path d="M54,118 C66,115 78,116 90,120 M54,128 C66,125 78,126 90,130 M54,138 C66,135 78,136 90,140"/>'
            f'<path d="M110,120 C122,116 134,115 146,118 M110,130 C122,126 134,125 146,128 M110,140 C122,136 134,135 146,138"/></g>'
            f'<path d="M100,112 V156" stroke="{d}" stroke-width="2.5"/></g>')


def school(c, sym):
    return frame(c, f'{book(c, 12)}<g transform="translate(0 -4)">{sym}</g>')


# --- маг: школи ---
def w_abjuration(c):
    b, l, d = c
    return school(c, f'<circle cx="100" cy="58" r="42" fill="none" stroke="{l}" stroke-opacity=".6" stroke-width="2" stroke-dasharray="4 4"/>'
                     f'<path d="M100,22 L130,31 C130,64 120,84 100,96 C80,84 70,64 70,31 Z" fill="url(#m)" stroke="{d}" stroke-width="3"/>'
                     f'<path d="{star(100, 56, 15, 5)}" fill="#fff" stroke="{d}" stroke-width="1.5"/>')


def w_conjuration(c):
    b, l, d = c
    sp = 'M100,58 m-4,0 a4,4 0 1 1 8,0 a10,10 0 1 1 -18,2 a16,16 0 1 1 30,-6 a24,24 0 1 1 -40,10 a32,32 0 1 1 52,-14'
    return school(c, f'<circle cx="100" cy="58" r="36" fill="url(#m)" fill-opacity=".35" stroke="{d}" stroke-width="2.5"/>'
                     f'<path d="{sp}" fill="none" stroke="{d}" stroke-width="6"/><path d="{sp}" fill="none" stroke="{l}" stroke-width="3"/>'
                     f'<g fill="{l}"><path d="{star(148, 32, 8, 2.4)}"/><path d="{star(54, 84, 6, 2)}"/></g>')


def w_divination(c):
    b, l, d = c
    return school(c, f'<path d="M80,94 L120,94 L127,106 L73,106 Z" fill="{WOOD[0]}" stroke="{WOOD[2]}" stroke-width="2.5"/>'
                     f'<circle cx="100" cy="62" r="34" fill="url(#m)" stroke="{d}" stroke-width="3"/>'
                     f'<path d="M78,62 C87,51 113,51 122,62 C113,73 87,73 78,62 Z" fill="#fff" stroke="{d}" stroke-width="2"/><circle cx="100" cy="62" r="6.5" fill="{d}"/>'
                     f'<path d="M82,44 C87,38 95,35 102,35" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3"/>')


def w_enchantment(c):
    b, l, d = c
    return school(c, g(100, 60, .52, f'<path d="{HEART}" fill="url(#m)" stroke="{d}" stroke-width="5.5"/><path d="M76,86 C72,98 76,110 86,118" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="5"/>')
                  + f'<g fill="{l}" stroke="{d}" stroke-width="1"><path d="{star(56, 40, 9, 2.7)}"/><path d="{star(146, 50, 10, 3)}"/><path d="{star(136, 90, 6, 2)}"/></g>')


def w_evocation(c):
    b, l, d = c
    rays = ''.join(f'<path d="M100,16 L105,30 L95,30 Z" transform="rotate({a} 100 60)"/>' for a in range(0, 360, 45))
    return school(c, f'<g fill="{l}" opacity=".9">{rays}</g><circle cx="100" cy="60" r="28" fill="url(#m)" stroke="{d}" stroke-width="3"/>'
                  + g(100, 60, .34, f'<path d="{FLAME}" fill="#fff6c8" stroke="{d}" stroke-width="6"/>'))


def w_illusion(c):
    b, l, d = c
    return school(c, f'<path d="M98,22 L132,86 L64,86 Z" fill="url(#m)" fill-opacity=".9" stroke="{d}" stroke-width="3"/>'
                     f'<path d="M98,22 L98,86 M81,54 L115,54" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>'
                     f'<path d="M36,62 L82,56" stroke="#fff" stroke-width="3.5"/>'
                     f'<g stroke-width="4" fill="none"><path d="M118,58 L162,46" stroke="#ff7a7a"/><path d="M121,64 L166,62" stroke="#ffd36a"/><path d="M123,70 L164,78" stroke="#6ae0a0"/><path d="M125,76 L158,94" stroke="#7ab8ff"/></g>')


def w_necromancy(c):
    b, l, d = c
    return school(c, g(100, 56, .5, f'<path d="{SKULL}" fill="url(#m)" stroke="{d}" stroke-width="6"/><ellipse cx="82" cy="96" rx="11" ry="13" fill="{d}"/><ellipse cx="118" cy="96" rx="11" ry="13" fill="{d}"/><path d="M100,108 L94,122 L106,122 Z" fill="{d}"/>')
                  + f'<g fill="none" stroke="{l}" stroke-width="2.5" stroke-opacity=".75"><path d="M54,26 C46,42 58,50 50,66"/><path d="M146,26 C154,42 142,50 150,66"/></g>')


def w_transmutation(c):
    b, l, d = c
    flask = 'M92,22 L108,22 L108,44 C126,50 134,64 132,78 C130,92 116,98 100,98 C84,98 70,92 68,78 C66,64 74,50 92,44 Z'
    liquid = 'M70,72 C82,68 92,76 100,74 C110,72 120,66 131,72 C130,88 116,96 100,96 C84,96 70,88 70,72 Z'
    return school(c, f'<path d="{flask}" fill="#eef6ff" fill-opacity=".9"/><path d="{liquid}" fill="url(#m)"/><path d="{flask}" fill="none" stroke="{d}" stroke-width="3"/>'
                     f'<rect x="87" y="15" width="26" height="9" rx="3" fill="{WOOD[0]}" stroke="{WOOD[2]}" stroke-width="2"/>'
                     f'<g fill="#fff" fill-opacity=".85"><circle cx="92" cy="82" r="3"/><circle cx="106" cy="86" r="2.2"/><circle cx="114" cy="78" r="2.6"/></g>'
                     f'<path d="M142,36 C156,44 158,60 148,72 M150,62 L148,72 L138,68" fill="none" stroke="{l}" stroke-width="3"/>'
                     f'<path d="M58,72 C44,64 42,48 52,36 M50,46 L52,36 L62,40" fill="none" stroke="{l}" stroke-width="3"/>')


# --- варвар ---
def b_berserker(c):
    b, l, d = c
    blade = 'M104,64 L138,46 Q164,84 138,122 L104,104 Q116,84 104,64 Z'
    axe = (f'<rect x="95" y="44" width="10" height="122" rx="4" fill="url(#wd)" stroke="{WOOD[2]}" stroke-width="2.5"/>'
           f'<path d="{blade}" fill="url(#m)" stroke="{d}" stroke-width="3"/><path d="M136,54 Q152,84 136,114" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>')
    return frame(c, g(124, 100, .78, axe, 22) + g(76, 100, .78, f'<g transform="translate(200 0) scale(-1 1)">{axe}</g>', -22)
                 + f'<path d="M84,40 L92,54 M100,34 L100,52 M116,40 L108,54" stroke="{l}" stroke-width="4"/>')


def b_totem(c):
    b, l, d = c
    feather = 'M100,30 C116,52 118,84 104,112 L100,128 L96,112 C82,84 84,52 100,30 Z'
    fs = ''.join(g(100, 128, 1, f'<path d="{feather}" fill="url(#m)" stroke="{d}" stroke-width="2.5"/><path d="M100,36 V122" stroke="{d}" stroke-opacity=".5" stroke-width="1.5"/>', a) for a in (-40, 40))
    return frame(c, fs + paw(c, 100, 104, .64)
                 + f'<path d="M62,152 L138,152" stroke="{WOOD[2]}" stroke-width="5"/><g fill="#3fb4a4" stroke="{d}" stroke-width="1.5"><circle cx="76" cy="152" r="5"/><circle cx="100" cy="152" r="6"/><circle cx="124" cy="152" r="5"/></g>')


# --- бард ---
def bd_lore(c):
    b, l, d = c
    quill = 'M140,28 C122,40 100,66 86,104 L90,108 C108,78 130,54 148,34 Z'
    return frame(c, '<g transform="rotate(-6 100 110)">'
                    f'<path d="M52,70 L148,70 L148,150 L52,150 Z" fill="#f6eedb" stroke="{d}" stroke-width="3"/>'
                    f'<rect x="44" y="62" width="112" height="14" rx="7" fill="url(#m)" stroke="{d}" stroke-width="2.5"/><rect x="44" y="144" width="112" height="14" rx="7" fill="url(#m)" stroke="{d}" stroke-width="2.5"/>'
                    f'<g stroke="{d}" stroke-opacity=".4" stroke-width="2.5"><path d="M62,92 H118 M62,104 H112 M62,116 H104 M62,128 H120"/></g>'
                    f'<g stroke="{b}" stroke-width="2.5"><path d="M128,112 v-18 l12,-4 v18" fill="none"/><ellipse cx="125" cy="113" rx="4.5" ry="3.2" fill="{b}"/><ellipse cx="137" cy="109" rx="4.5" ry="3.2" fill="{b}"/></g></g>'
                    f'<path d="{quill}" fill="#fff" stroke="{d}" stroke-width="2.5"/><path d="M88,106 L78,124" stroke="{d}" stroke-width="3"/>'
                    f'<path d="M142,34 C126,48 108,72 96,96" stroke="{l}" stroke-width="1.5" fill="none"/>')


def bd_valor(c):
    return frame(c, sword(100, 140, 116, 34) + g(96, 104, .8, inner(bard(c)), -4))


# --- жрець ---
def c_knowledge(c):
    b, l, d = c
    return frame(c, book(c, 8) + f'<path d="M100,26 L132,44 L132,80 L100,98 L68,80 L68,44 Z" fill="url(#m)" stroke="{d}" stroke-width="3"/>'
                    f'<circle cx="100" cy="52" r="10" fill="#fff" stroke="{d}" stroke-width="2.5"/><path d="M100,62 V86 M100,76 H109 M100,83 H107" stroke="{d}" stroke-width="4"/>')


def c_life(c):
    b, l, d = c
    return frame(c, f'<path d="{HEART}" fill="url(#m)" stroke="{d}" stroke-width="3.5"/><path d="M74,88 C70,100 76,114 86,122" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3"/>'
                    f'<path d="M92,80 h16 v14 h14 v16 h-14 v14 h-16 v-14 h-14 v-16 h14 Z" fill="#fff" stroke="{d}" stroke-width="2.5"/>'
                    f'<g fill="#7bd38a" stroke="#1f5a22" stroke-width="5">' + g(60, 154, .3, f'<path d="{LEAF}"/>', -58) + g(140, 154, .3, f'<path d="{LEAF}"/>', 58) + '</g>')


def c_nature(c):
    b, l, d = c
    a = 'M92,96 C80,80 70,66 72,44 M78,72 C66,68 58,58 56,46 M74,56 C80,48 82,40 80,30'
    ant = f'<path d="{a}" fill="none" stroke="{WOOD[2]}" stroke-width="9"/><path d="{a}" fill="none" stroke="{WOOD[1]}" stroke-width="5"/>'
    return frame(c, ant + f'<g transform="translate(200 0) scale(-1 1)">{ant}</g>'
                 + g(100, 122, .54, f'<path d="{LEAF}" fill="url(#m)" stroke="{d}" stroke-width="5"/><path d="M100,166 L100,46" stroke="{d}" stroke-opacity=".5" stroke-width="3"/>'))


def c_tempest(c):
    b, l, d = c
    return frame(c, f'<path d="{CLOUD}" fill="#dfe8f2" stroke="{d}" stroke-width="3" transform="translate(0 -28)"/>'
                 + g(104, 122, .62, f'<path d="{BOLT}" fill="url(#m)" stroke="{d}" stroke-width="5"/>')
                 + f'<g stroke="{l}" stroke-width="3"><path d="M62,112 L54,128 M146,110 L138,126 M72,128 L66,140"/></g>')


def c_trickery(c):
    b, l, d = c
    mask = 'M60,58 C80,50 120,50 140,58 C146,96 132,130 100,142 C68,130 54,96 60,58 Z'
    eyes = 'M80,84 C86,78 94,80 96,88 C90,90 84,90 80,84 Z M120,84 C114,78 106,80 104,88 C110,90 116,90 120,84 Z'
    return frame(c, g(120, 104, .72, f'<path d="{mask}" fill="#3a2440" stroke="{d}" stroke-width="4"/><path d="{eyes}" fill="#fff"/><path d="M80,120 C92,110 108,110 120,120" fill="none" stroke="#fff" stroke-width="4"/>', 16)
                 + g(82, 98, .78, f'<path d="{mask}" fill="url(#m)" stroke="{d}" stroke-width="4"/><path d="{eyes}" fill="{d}"/><path d="M80,110 C92,122 108,122 120,110" fill="none" stroke="{d}" stroke-width="4"/>', -12)
                 + f'<g fill="{l}"><path d="{star(150, 48, 8, 2.5)}"/><path d="{star(46, 150, 6, 2)}"/></g>')


def c_war(c):
    b, l, d = c
    return frame(c, '<g transform="rotate(-28 100 100)">'
                    f'<path d="M98,26 V176" stroke="{WOOD[2]}" stroke-width="8"/><path d="M98,26 V176" stroke="{WOOD[1]}" stroke-width="4"/>'
                    f'<path d="M98,12 L106,30 L90,30 Z" fill="url(#st)" stroke="{STEEL[2]}" stroke-width="2.5"/>'
                    f'<path d="M100,36 L150,40 L138,56 L150,72 L100,68 Z" fill="url(#m)" stroke="{d}" stroke-width="3"/></g>'
                 + sword(112, 136, 100, 26)
                 + g(100, 130, .46, f'<path d="{SHIELD}" fill="url(#m)" stroke="{d}" stroke-width="6"/><path d="{star(100, 98, 28, 10, 4)}" fill="#fff" stroke="{d}" stroke-width="3"/>'))


# --- друїд ---
def d_land(c):
    b, l, d = c
    return frame(c, f'<circle cx="146" cy="46" r="11" fill="#ffe08a" stroke="{d}" stroke-width="2"/>'
                    f'<path d="M30,150 L76,76 L98,108 L120,60 L170,150 Z" fill="url(#m)" stroke="{d}" stroke-width="3"/>'
                    f'<path d="M120,60 L133,82 L124,79 L118,90 L110,80 L104,84 Z M76,76 L87,93 L80,90 L74,99 L67,90 Z" fill="#fff" stroke="{d}" stroke-width="1.5"/>'
                    f'<rect x="96" y="122" width="8" height="28" fill="{WOOD[0]}" stroke="{WOOD[2]}" stroke-width="2"/>'
                    f'<circle cx="100" cy="114" r="18" fill="#6fbf5a" stroke="#1f5a22" stroke-width="2.5"/><path d="M30,150 L170,150" stroke="{d}" stroke-width="3"/>')


def d_moon(c):
    b, l, d = c
    return frame(c, f'<path d="{crescent(94, 86, 56)}" fill="url(#m)" stroke="{d}" stroke-width="3"/>'
                    f'<g fill="{l}"><path d="{star(148, 50, 9, 2.7)}"/><path d="{star(152, 96, 5, 1.6)}"/><path d="{star(126, 30, 4, 1.4)}"/></g>'
                 + paw(c, 130, 134, .44))


# --- воїн ---
def f_champion(c):
    b, l, d = c
    leaves = ''
    for side in (-1, 1):
        for i in range(7):
            ang = 112 + i * 21 if side < 0 else 68 - i * 21
            a = math.radians(ang)
            x, y = 100 + 64 * math.cos(a), 100 + 64 * math.sin(a)
            leaves += f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="6.5" ry="14" transform="rotate({ang + 90 + side * 28:.0f} {x:.1f} {y:.1f})"/>'
    return frame(c, f'<g fill="#9ccc65" stroke="#33691e" stroke-width="2">{leaves}</g>' + sword(100, 128, 104, 0, guard=b, dark=d)
                 + f'<path d="{star(100, 30, 9, 3.2, 5)}" fill="{l}" stroke="{d}" stroke-width="1.5"/>')


def f_battle_master(c):
    b, l, d = c
    return frame(c, f'<path d="M70,30 V172" stroke="{WOOD[2]}" stroke-width="8"/><path d="M70,30 V172" stroke="{WOOD[1]}" stroke-width="4"/><circle cx="70" cy="27" r="6" fill="#c9a227" stroke="{d}" stroke-width="2"/>'
                    f'<path d="M74,38 C100,30 124,46 152,38 L152,98 C124,106 100,90 74,98 Z" fill="url(#m)" stroke="{d}" stroke-width="3"/>'
                    f'<path d="{star(113, 68, 17, 7, 4)}" fill="#fff" stroke="{d}" stroke-width="1.5"/>'
                 + g(126, 138, .42, f'<path d="{SHIELD}" fill="{STEEL[0]}" stroke="{STEEL[2]}" stroke-width="6"/><path d="M62,86 L100,116 L138,86" fill="none" stroke="{b}" stroke-width="13"/>'))


def f_eldritch_knight(c):
    b, l, d = c
    runes = ''.join(f'<path d="{star(100 + 58 * math.cos(math.radians(a)), 100 + 58 * math.sin(math.radians(a)), 7, 2.2)}"/>' for a in range(-90, 270, 60))
    return frame(c, f'<circle cx="100" cy="100" r="58" fill="none" stroke="{l}" stroke-width="2.5" stroke-dasharray="5 5"/>'
                    f'<path d="{star(100, 100, 50, 24, 6, -90)}" fill="url(#m)" fill-opacity=".3" stroke="{b}" stroke-width="2"/><g fill="{l}">{runes}</g>'
                 + sword(100, 136, 112, 0, blade='url(#m)', dark=d, guard='#c9a227'))


# --- монах ---
def m_open_hand(c):
    b, l, d = c
    fingers = ''.join(f'<rect x="{x}" y="{y}" width="17" height="{h}" rx="8.5" transform="rotate({r} {x + 8} {y + h})"/>'
                      for x, y, h, r in [(66, 52, 54, -10), (84, 38, 66, -3), (102, 40, 64, 3), (120, 54, 52, 10)])
    return frame(c, f'<circle cx="100" cy="104" r="66" fill="none" stroke="{l}" stroke-width="2" stroke-opacity=".5"/>'
                    f'<g fill="url(#m)" stroke="{d}" stroke-width="3">{fingers}<rect x="52" y="88" width="18" height="48" rx="9" transform="rotate(-38 61 134)"/>'
                    f'<path d="M66,100 L138,100 L140,140 C138,160 120,172 100,172 C80,172 64,160 64,140 Z"/></g>'
                    f'<circle cx="102" cy="134" r="11" fill="none" stroke="{d}" stroke-width="2.5"/><path d="M102,123 C97,130 107,138 102,145" fill="none" stroke="{d}" stroke-width="2"/>')


def m_shadow(c):
    b, l, d = c
    return frame(c, f'<path d="{crescent(100, 100, 68, .84)}" fill="{d}" stroke="{b}" stroke-width="2.5"/>'
                    f'<path d="{star(106, 100, 48, 12, 4, -45)}" fill="url(#st)" stroke="{STEEL[2]}" stroke-width="3"/><circle cx="106" cy="100" r="8" fill="{d}" stroke="{STEEL[2]}" stroke-width="2.5"/>'
                    f'<g fill="{l}" opacity=".85"><path d="{star(50, 54, 6, 2)}"/><path d="{star(152, 154, 5, 1.6)}"/></g>')


def m_four_elements(c):
    b, l, d = c
    return frame(c, f'<circle cx="100" cy="100" r="52" fill="none" stroke="{l}" stroke-width="2" stroke-dasharray="3 6"/>'
                    f'<circle cx="100" cy="100" r="22" fill="url(#m)" stroke="{d}" stroke-width="3"/>'
                 + g(100, 46, .32, f'<path d="{FLAME}" fill="#ff8a3d" stroke="#7a2a08" stroke-width="7"/>')
                 + g(154, 98, .38, f'<path d="{DROP}" fill="#4fb3ff" stroke="#0d4a7a" stroke-width="6"/>')
                 + '<g transform="translate(100 154)"><path d="M-22,6 L-12,-12 L4,-14 L20,-4 L18,12 L-4,16 Z" fill="#b08a5a" stroke="#4a3418" stroke-width="2.5"/></g>'
                 + '<g transform="translate(48 100)" fill="none" stroke="#e8f4ff" stroke-width="4"><path d="M-18,-6 C-6,-14 8,-12 10,-4 C12,4 2,8 -4,2"/><path d="M-18,8 C-4,4 10,8 18,14"/></g>')


# --- паладин ---
def p_ancients(c):
    b, l, d = c
    canopy = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x, y, r in [(100, 62, 30), (70, 84, 24), (130, 84, 24), (84, 108, 20), (116, 108, 20)])
    return frame(c, f'<rect x="94" y="110" width="12" height="46" fill="{WOOD[0]}" stroke="{WOOD[2]}" stroke-width="2.5"/>'
                    f'<path d="M100,156 C90,162 80,164 70,164 M100,156 C110,162 120,164 130,164" fill="none" stroke="{WOOD[2]}" stroke-width="4"/>'
                    f'<g fill="url(#m)" stroke="{d}" stroke-width="3">{canopy}</g><g fill="url(#m)">{canopy.replace("r=", "data-r=").replace("data-r=", "r=")}</g>'
                    f'<path d="{star(100, 84, 16, 5, 4)}" fill="#fff8d0" stroke="{d}" stroke-width="1.5"/><g fill="#ffe28a"><circle cx="68" cy="80" r="3"/><circle cx="128" cy="98" r="3"/><circle cx="112" cy="52" r="2.5"/></g>')


def p_vengeance(c):
    return frame(c, g(100, 94, .64, f'<path d="{FLAME}" fill="url(#m)" stroke="{c[2]}" stroke-width="5"/><path d="{FLAME_IN}" fill="#ffd27a" fill-opacity=".85"/>')
                 + sword(100, 62, 104, 180, guard='#3a3a3a', grip='#1a1a1a', dark='#1a1a1a'))


# --- слідопит ---
def r_beast_master(c):
    b, l, d = c
    return frame(c, paw(c, 100, 108, .9)
                 + f'<path d="M46,46 L68,70 M154,46 L132,70" stroke="{WOOD[1]}" stroke-width="4"/>'
                   f'<path d="M42,42 L56,44 L44,56 Z M158,42 L144,44 L156,56 Z" fill="url(#st)" stroke="{STEEL[2]}" stroke-width="2"/>')


# --- пройдисвіт ---
def ro_thief(c):
    b, l, d = c
    bag = 'M78,72 C60,94 52,126 62,148 C70,164 130,164 138,148 C148,126 140,94 122,72 Z'
    return frame(c, f'<path d="{bag}" fill="url(#m)" stroke="{d}" stroke-width="3"/><path d="M80,72 C86,62 114,62 120,72 L114,80 L86,80 Z" fill="{b}" stroke="{d}" stroke-width="2.5"/>'
                    f'<path d="M84,78 C92,84 108,84 116,78" stroke="{d}" stroke-width="4" fill="none"/><path d="M78,96 C70,112 68,128 74,142" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>'
                    f'<g fill="#f2c94c" stroke="#7a5a10" stroke-width="2.5"><ellipse cx="146" cy="152" rx="16" ry="7"/><ellipse cx="146" cy="144" rx="16" ry="7"/><ellipse cx="150" cy="136" rx="16" ry="7"/></g>'
                    f'<g transform="rotate(-30 70 50)"><circle cx="56" cy="50" r="10" fill="none" stroke="{STEEL[2]}" stroke-width="6"/><circle cx="56" cy="50" r="10" fill="none" stroke="{STEEL[0]}" stroke-width="3"/>'
                    f'<path d="M66,50 H100 M92,50 V59 M98,50 V57" stroke="{STEEL[2]}" stroke-width="5"/><path d="M66,50 H100" stroke="{STEEL[0]}" stroke-width="2"/></g>'
                    f'<circle cx="100" cy="118" r="13" fill="{l}" stroke="{d}" stroke-width="2.5"/><path d="{star(100, 118, 8, 3, 4)}" fill="{d}"/>')


def ro_assassin(c):
    b, l, d = c
    hood = 'M100,30 C66,30 46,62 48,100 C50,128 60,150 74,162 L126,162 C140,150 150,128 152,100 C154,62 134,30 100,30 Z'
    return frame(c, f'<path d="{hood}" fill="url(#m)" stroke="{d}" stroke-width="3"/>'
                    f'<path d="M100,58 C78,58 68,82 70,106 C72,124 84,138 100,140 C116,138 128,124 130,106 C132,82 122,58 100,58 Z" fill="#111" stroke="{d}" stroke-width="2"/>'
                    f'<path d="M80,98 L94,103 M120,98 L106,103" stroke="{l}" stroke-width="4"/>'
                    '<g transform="rotate(-140 132 140)">'
                    f'<path d="M128,140 L128,104 L132,90 L136,104 L136,140 Z" fill="url(#st)" stroke="{STEEL[2]}" stroke-width="2"/><rect x="120" y="140" width="24" height="5" rx="2" fill="{d}"/><rect x="129" y="145" width="6" height="16" rx="2" fill="{d}"/></g>'
                 + g(152, 156, .22, f'<path d="{DROP}" fill="#7ee36a" stroke="#1d5a10" stroke-width="10"/>'))


def ro_arcane_trickster(c):
    b, l, d = c
    return frame(c, f'<circle cx="100" cy="100" r="66" fill="none" stroke="{l}" stroke-width="2" stroke-dasharray="3 6"/>' + inner(rogue(c))
                 + f'<g fill="{l}" stroke="{d}" stroke-width="1"><path d="{star(52, 50, 11, 3.2)}"/><path d="{star(150, 56, 8, 2.4)}"/><path d="{star(58, 152, 7, 2.2)}"/></g>')


# --- чародій ---
def s_draconic(c):
    b, l, d = c
    scale = 'M0,-16 C14,-16 20,-2 20,8 C12,4 6,8 0,16 C-6,8 -12,4 -20,8 C-20,-2 -14,-16 0,-16 Z'
    sc = ''.join(f'<path d="{scale}" transform="translate({x} {y})"/>' for x, y in [(80, 76), (120, 76), (60, 106), (100, 106), (140, 106), (80, 136), (120, 136)])
    return frame(c, f'<g fill="url(#m)" stroke="{d}" stroke-width="2.5">{sc}</g>'
                    f'<path d="M98,42 C110,32 126,30 140,34 C128,38 120,46 118,56 Z M102,42 C90,32 74,30 60,34 C72,38 80,46 82,56 Z" fill="{d}" stroke="{l}" stroke-width="1.5"/>'
                    f'<path d="M76,164 L86,150 M100,168 L100,152 M124,164 L114,150" stroke="{l}" stroke-width="4"/>')


def s_wild(c):
    b, l, d = c
    defs = '<linearGradient id="rb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6ad5"/><stop offset=".35" stop-color="#ffd36a"/><stop offset=".65" stop-color="#6affc8"/><stop offset="1" stop-color="#6aa8ff"/></linearGradient>'
    sp = 'M100,100 m-6,0 a6,6 0 1 1 12,0 a14,14 0 1 1 -26,4 a22,22 0 1 1 42,-10 a32,32 0 1 1 -58,16 a42,42 0 1 1 78,-22'
    return frame(c, f'<path d="{star(100, 100, 76, 34, 7, -80)}" fill="url(#m)" fill-opacity=".35" stroke="{b}" stroke-width="2"/>'
                    f'<path d="{sp}" fill="none" stroke="{d}" stroke-width="9"/><path d="{sp}" fill="none" stroke="url(#rb)" stroke-width="5"/>'
                    f'<g fill="#fff"><path d="{star(148, 44, 9, 2.7)}"/><path d="{star(50, 152, 7, 2.2)}"/><path d="{star(54, 50, 5, 1.6)}"/></g>', defs)


# --- чаклун ---
def wl_archfey(c):
    b, l, d = c
    w1 = 'M100,100 C86,70 60,46 40,52 C26,58 34,90 56,100 C70,106 88,104 100,100 Z'
    w2 = 'M100,104 C84,112 64,128 62,146 C62,160 82,160 92,146 C98,136 100,120 100,104 Z'
    wings = (f'<path d="{w1}" fill="url(#m)" stroke="{d}" stroke-width="3"/><path d="{w2}" fill="url(#m)" stroke="{d}" stroke-width="3"/>'
             f'<circle cx="58" cy="74" r="7" fill="#fff" fill-opacity=".7"/><circle cx="78" cy="136" r="5" fill="#fff" fill-opacity=".7"/>')
    return frame(c, wings + f'<g transform="translate(200 0) scale(-1 1)">{wings}</g><rect x="96" y="70" width="8" height="72" rx="4" fill="{d}"/>'
                    f'<path d="M98,72 C94,58 86,52 80,50 M102,72 C106,58 114,52 120,50" fill="none" stroke="{d}" stroke-width="2.5"/>'
                    f'<g fill="#fff"><path d="{star(100, 38, 8, 2.4)}"/><path d="{star(152, 152, 5, 1.6)}"/></g>')


def wl_fiend(c):
    b, l, d = c
    return frame(c, f'<path d="M58,92 C38,74 36,46 50,26 C54,48 66,62 84,70 Z" fill="#2a0e0e" stroke="{l}" stroke-width="2.5"/>'
                    f'<path d="M142,92 C162,74 164,46 150,26 C146,48 134,62 116,70 Z" fill="#2a0e0e" stroke="{l}" stroke-width="2.5"/>'
                 + g(100, 108, .66, f'<path d="{FLAME}" fill="url(#m)" stroke="{d}" stroke-width="5"/><path d="{FLAME_IN}" fill="#ffe08a" fill-opacity=".85"/>'))


def wl_great_old_one(c):
    b, l, d = c
    tent = ''
    for x0, cx1, cx2, x1, y1 in [(70, 46, 30, 38, 168), (88, 76, 64, 74, 180), (112, 124, 136, 126, 180), (130, 154, 170, 162, 168)]:
        path = f'M{x0},116 C{cx1},140 {cx2},150 {x1},{y1}'
        tent += f'<path d="{path}" fill="none" stroke="{d}" stroke-width="13"/><path d="{path}" fill="none" stroke="url(#m)" stroke-width="7"/>'
    return frame(c, tent + f'<path d="M30,92 C56,54 144,54 170,92 C144,130 56,130 30,92 Z" fill="{d}" stroke="{b}" stroke-width="3.5"/>'
                    f'<path d="M40,92 C64,62 136,62 160,92 C136,122 64,122 40,92 Z" fill="#e6fff4"/><circle cx="100" cy="92" r="27" fill="url(#m)" stroke="{d}" stroke-width="3"/>'
                    f'<path d="M100,70 C108,82 108,102 100,114 C92,102 92,82 100,70 Z" fill="#06140e"/><circle cx="91" cy="83" r="4" fill="#fff" fill-opacity=".85"/>')


# палітри підкласів (base, light, dark) і емблеми
SUB = {
    'barbarian-berserker': (('#d33a2c', '#ff9c84', '#5c120c'), b_berserker),
    'barbarian-totem': (('#b8803c', '#f2cf8e', '#4d3010'), b_totem),
    'bard-lore': (('#5b7fd6', '#c2d1ff', '#1f306b'), bd_lore),
    'bard-valor': (('#d9893a', '#ffd19a', '#5c3410'), bd_valor),
    'cleric-knowledge': (('#4a7fd4', '#bcd2ff', '#17336b'), c_knowledge),
    'cleric-life': (('#e0607a', '#ffc2cf', '#6b1c2c'), c_life),
    'cleric-light': (('#f2b632', '#fff3c2', '#7a5508'), cleric),
    'cleric-nature': (('#5aa84a', '#c4ecb6', '#21521a'), c_nature),
    'cleric-tempest': (('#4fa3e8', '#c4e4ff', '#123e66'), c_tempest),
    'cleric-trickery': (('#b05cc8', '#ecc2f8', '#4a1a5a'), c_trickery),
    'cleric-war': (('#c0392b', '#ffa69b', '#4f100a'), c_war),
    'druid-land': (('#7a9a3a', '#d6e8a2', '#334214'), d_land),
    'druid-moon': (('#7f9ed8', '#dde7ff', '#25386b'), d_moon),
    'fighter-champion': (('#d7a03a', '#ffe2a0', '#5e400e'), f_champion),
    'fighter-battle_master': (('#5d8bbf', '#c6dcf5', '#1e3552'), f_battle_master),
    'fighter-eldritch_knight': (('#8c6ae0', '#d8cbff', '#33206b'), f_eldritch_knight),
    'monk-open_hand': (('#e5a03c', '#ffe0a8', '#6b440e'), m_open_hand),
    'monk-shadow': (('#6a6f9e', '#c9cdf0', '#1c1f3a'), m_shadow),
    'monk-four_elements': (('#3bb0a0', '#b2f0e6', '#0f4a42'), m_four_elements),
    'paladin-devotion': (('#e8c45a', '#fff6cf', '#6e5410'), paladin),
    'paladin-ancients': (('#6fb04a', '#d2f0b8', '#294a16'), p_ancients),
    'paladin-vengeance': (('#b22a3a', '#ff9aa6', '#4a0c14'), p_vengeance),
    'ranger-hunter': (('#8d9b3a', '#dbe596', '#3c4414'), ranger),
    'ranger-beast_master': (('#b8873a', '#f2d29a', '#4f3410'), r_beast_master),
    'rogue-thief': (('#c8a03c', '#f6e2a4', '#574010'), ro_thief),
    'rogue-assassin': (('#9e2a3a', '#ff9aa8', '#3a0a12'), ro_assassin),
    'rogue-arcane_trickster': (('#7e6ad8', '#d4cbff', '#2a1f60'), ro_arcane_trickster),
    'sorcerer-draconic': (('#e0452e', '#ffb09c', '#5c140a'), s_draconic),
    'sorcerer-wild': (('#c84fd8', '#f2c4fb', '#4f1458'), s_wild),
    'warlock-archfey': (('#58c49a', '#c6f5df', '#14503a'), wl_archfey),
    'warlock-fiend': (('#d63a2a', '#ffb08a', '#4a0e08'), wl_fiend),
    'warlock-great_old_one': (('#3f9e86', '#bff0e0', '#0f3a30'), wl_great_old_one),
    'wizard-abjuration': (('#6aa0d8', '#d4e8ff', '#1f3f66'), w_abjuration),
    'wizard-conjuration': (('#e0a030', '#ffe0a0', '#5e400a'), w_conjuration),
    'wizard-divination': (('#4fb8d8', '#c8f0ff', '#134a5c'), w_divination),
    'wizard-enchantment': (('#e06fae', '#ffd0ea', '#6b1d4a'), w_enchantment),
    'wizard-evocation': (('#e4572e', '#ffbea8', '#5e1a08'), w_evocation),
    'wizard-illusion': (('#9b7ae6', '#e2d6ff', '#36246e'), w_illusion),
    'wizard-necromancy': (('#7fb77e', '#d8f2d6', '#1e3a1e'), w_necromancy),
    'wizard-transmutation': (('#3fb48a', '#c0f2df', '#0f4a36'), w_transmutation),
}
for k, (pal, fn) in SUB.items():
    with open(f'{OUT}/{k}.svg', 'w') as fh:
        fh.write(fn(pal))


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
for k, ((b, l, d), fn) in SUB.items():
    txt = '#ffffff' if contrast(b, '#ffffff') >= contrast(b, '#111111') else '#111111'
    css.append(f"[data-sub={k}] {{ --cls: {b}; --cls-l: {l}; --cls-d: {d}; --cls-text: {txt}; --cls-img: url(img/classes/{k}.svg); }}")
print('\n'.join(css))
