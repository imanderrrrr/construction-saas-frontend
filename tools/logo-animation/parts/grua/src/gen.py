#!/usr/bin/env python3
"""Genera parts/grua/index.html: marcado SVG de la grúa torre + el script de la línea de tiempo.

    python3 parts/grua/src/gen.py

El HTML resultante es lo que se entrega; este generador solo existe para no escribir a mano
las celosías (cientos de diagonales y remaches). El script (src/model.js + src/scene.js) se incrusta tal cual.
"""
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PART = os.path.dirname(HERE)
ROOT = os.path.abspath(os.path.join(PART, '..', '..'))
LJ = json.load(open(os.path.join(ROOT, 'letters.json')))
LP = {l['char']: l['d'] for l in LJ['letters']}

# ───────────────────────────── paleta ─────────────────────────────
K = dict(
    yLL='#FFE69A', yL='#FFD35C', yB='#F6B21C', yD='#D68A06', yDD='#9C6205',
    sLL='#D9D0C0', sL='#A79B88', sM='#7C7160', sD='#4A423A', sDD='#2B2621',
    rub='#0D0B09', glass='#8DC3D6', glassD='#3F7F97', glassL='#CDEBF4',
    bone='#F8F3EB', orange='#F97316', red='#FF4B3A', redD='#B3190F',
    cL='#B2A892', cB='#8F8572', cD='#625847', skin='#E3B48B', ink='#17130F',
)


def n(v):
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('', '-0') else s


def R(x, y, w, h, fill, extra=''):
    return f'<rect x="{n(x)}" y="{n(y)}" width="{n(w)}" height="{n(h)}" fill="{fill}"{extra}/>'


def Ci(cx, cy, r, fill, extra=''):
    return f'<circle cx="{n(cx)}" cy="{n(cy)}" r="{n(r)}" fill="{fill}"{extra}/>'


def Pa(d, fill='none', extra=''):
    return f'<path d="{d}" fill="{fill}"{extra}/>'


def Poly(pts, fill, extra=''):
    return '<polygon points="%s" fill="%s"%s/>' % (' '.join(f'{n(x)},{n(y)}' for x, y in pts), fill, extra)


def St(d, color, w, extra=''):
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{n(w)}"{extra}/>'


def tri(x, y, w, h, light, base, dark, lt=0.2, dt=0.22):
    """Caja de tres tonos: luz arriba, base en medio, sombra abajo."""
    return R(x, y, w, h, base) + R(x, y, w, h * lt, light) + R(x, y + h * (1 - dt), w, h * dt, dark)


def lat3(d, w=2.0, off=0.75):
    """Una barra de celosía en tres tonos: sombra desplazada, base y filo de luz."""
    return (St(d, K['yD'], w + 0.5, f' transform="translate({n(off)} {n(off)})"')
            + St(d, K['yB'], w)
            + St(d, K['yLL'], max(0.6, w * 0.32), f' transform="translate({n(-off * 0.45)} {n(-off * 0.55)})" opacity=".9"'))


def rivets(xs, y, r=0.9, fill=None):
    fill = fill or K['sD']
    return ''.join(Ci(x, y, r, fill) for x in xs)


# ───────────────────────────── geometría ─────────────────────────────
GROUND = 324
MX = 1240                      # eje del mástil
MAST_TOP, MAST_BOT = 80, 309   # el mástil va de la corona de giro a la placa base
JIB_TIP, JIB_ROOT = 572, 1240
CJ_END = 1388
TOP_Y = 38                     # cordón superior de pluma y contrapluma
BOT_Y = 54                     # cordón inferior (54..58), carril 58..60.5
PIVOT_Y = 72                   # centro de la polea del carro
APEX_Y = 9


def ytop(x):
    return TOP_Y if x >= 940 else TOP_Y + (940 - x) / (940 - 572) * 8


def sheave(gid, cy, r):
    """Polea: aro y cara fijos con degradado; radios y tornillos giran con el cable (grupo con id)."""
    sp = ''
    for ang in (0, 60, 120):
        sp += f'<line x1="{n(-r * 0.86)}" y1="0" x2="{n(r * 0.86)}" y2="0" stroke="{K["sDD"]}" stroke-width="0.55" transform="rotate({ang})"/>'
    for ang in (30, 150, 270):
        a = math.radians(ang)
        sp += Ci(r * 0.62 * math.cos(a), r * 0.62 * math.sin(a), 0.38, K['sLL'])
    return (f'<g transform="translate(0 {n(cy)})">' + Ci(0, 0, r + 0.9, K['sD']) + Ci(0, 0, r, 'url(#gru-gSheave)')
            + f'<g id="{gid}">{sp}</g>' + Ci(0, 0, r * 0.3, K['sDD']) + Ci(-r * 0.12, -r * 0.14, r * 0.1, K['sLL']) + '</g>')


def rail(x0, x1, y, step=22, h=7.2):
    """Barandilla: pasamanos, travesaño y montantes."""
    o = []
    xs = [x0 + i * step for i in range(int((x1 - x0) / step) + 1)]
    for x in xs:
        o.append(R(x - 0.4, y, 0.8, h, K['sM']))
    o.append(R(x0, y - 0.5, x1 - x0, 1.0, K['sL']) + R(x0, y - 0.5, x1 - x0, 0.35, K['sLL']))
    o.append(R(x0, y + h * 0.5, x1 - x0, 0.6, K['sM'], ' opacity=".8"'))
    return ''.join(o)


def mast_svg():
    N = 7
    ys = [MAST_TOP + (MAST_BOT - MAST_TOP) * k / N for k in range(N + 1)]
    o = []
    # celosía interior (aspa por tramo) en tres tonos
    d = ''
    for k in range(N):
        y0, y1 = ys[k] + 2.6, ys[k + 1] - 2.6
        d += f'M1221 {n(y0)}L1259 {n(y1)}M1259 {n(y0)}L1221 {n(y1)}'
    o.append(lat3(d, 2.0, 0.7))
    # cartelas en el cruce de cada aspa
    for k in range(N):
        cy = (ys[k] + ys[k + 1]) / 2
        o.append(Ci(MX, cy, 2.7, K['sL']) + Ci(MX - 0.5, cy - 0.5, 1.2, K['sLL']) + Ci(MX, cy, 0.8, K['sD']))
    # cordones (ángulos): luz a la izquierda, sombra a la derecha
    for x0 in (1215, 1259):
        o.append(R(x0, MAST_TOP, 6, MAST_BOT - MAST_TOP, K['yB']))
        o.append(R(x0, MAST_TOP, 1.8, MAST_BOT - MAST_TOP, K['yL']))
        o.append(R(x0 + 0.15, MAST_TOP, 0.7, MAST_BOT - MAST_TOP, K['yLL'], ' opacity=".85"'))
        o.append(R(x0 + 4.2, MAST_TOP, 1.8, MAST_BOT - MAST_TOP, K['yD']))
    # bridas de unión entre tramos (acero) con tornillos
    for k in range(N + 1):
        y = ys[k]
        o.append(tri(1211, y - 2.2, 58, 4.4, K['sLL'], K['sL'], K['sD'], 0.26, 0.3))
        o.append(rivets([1214.5, 1224, 1256, 1265.5], y, 0.85))
        o.append(Ci(1214.2, y - 0.2, 0.35, K['sLL']) + Ci(1265.2, y - 0.2, 0.35, K['sLL']))
    # escalera de gato por el interior (peldaños finos)
    for k in range(N):
        for j in range(1, 4):
            yy = ys[k] + (ys[k + 1] - ys[k]) * j / 4
            o.append(R(1231, yy - 0.4, 18, 0.8, K['sD'], ' opacity=".35"'))
    return ''.join(o)


def foot_svg():
    o = []
    # hormigón de la zapata
    o.append(Poly([(1178, 324), (1178, 318.5), (1182, 315.5), (1298, 315.5), (1302, 318.5), (1302, 324)], K['cB']))
    o.append(Poly([(1182, 315.5), (1298, 315.5), (1296, 317.4), (1180, 317.4)], K['cL']))
    o.append(R(1178, 321.6, 124, 2.4, K['cD']))
    o.append(R(1213, 317.4, 0.7, 6.6, K['cD'], ' opacity=".6"') + R(1267, 317.4, 0.7, 6.6, K['cD'], ' opacity=".6"'))
    # franja de seguridad amarillo/negro en la cara frontal del hormigón
    stripes = ''.join(Poly([(1178 + i * 9, 322.4), (1178 + i * 9 + 4.5, 322.4), (1178 + i * 9 + 8.5, 318.4), (1178 + i * 9 + 4, 318.4)], K['rub']) for i in range(-1, 15))
    o.append(R(1178, 318.4, 124, 4, K['yB']) + '<g clip-path="url(#gru-clHaz)">' + stripes + '</g>')
    # placa base de acero con pernos de anclaje
    o.append(tri(1198, 309, 84, 6.6, K['sLL'], K['sL'], K['sD'], 0.28, 0.3))
    for x in (1203, 1216, 1229, 1251, 1264, 1277):
        o.append(Ci(x, 312.4, 1.7, K['sM']) + Ci(x - 0.4, 312, 0.7, K['sLL']))
    # lastres de la base
    for x0 in (1199.5, 1268.5):
        o.append(R(x0, 296.5, 12.5, 12.5, K['cB']) + R(x0, 296.5, 12.5, 2, K['cL']) + R(x0, 306.6, 12.5, 2.4, K['cD']))
        o.append(R(x0, 302.4, 12.5, 0.7, K['cD'], ' opacity=".7"'))
        o.append(Ci(x0 + 6.25, 299.4, 1.2, K['sD']))
    return ''.join(o)


def tip_hook_svg():
    return ''


def jib_svg():
    o = []
    NSEG = 44
    xs = [JIB_TIP + (JIB_ROOT - JIB_TIP) * k / NSEG for k in range(NSEG + 1)]
    # celosía Warren con montantes en los nodos superiores
    pts = []
    for k, x in enumerate(xs):
        y = ytop(x) + 2.1 if k % 2 == 0 else BOT_Y + 2
        pts.append((x, y))
    zig = 'M' + 'L'.join(f'{n(x)} {n(y)}' for x, y in pts)
    o.append(lat3(zig, 1.9, 0.7))
    vert = ''
    for k, x in enumerate(xs):
        if k % 2 == 0:
            vert += f'M{n(x)} {n(ytop(x) + 3)}L{n(x)} {BOT_Y + 1}'
    o.append(lat3(vert, 1.5, 0.6))
    # cordón superior (polígonos en 3 tonos, con la caída hacia la punta)
    px = [JIB_TIP, 940, JIB_ROOT]
    for (a, b, col) in ((0, 1.3, K['yL']), (1.3, 3.0, K['yB']), (3.0, 4.2, K['yD'])):
        top = [(x, ytop(x) + a) for x in px]
        bot = [(x, ytop(x) + b) for x in reversed(px)]
        o.append(Poly(top + bot, col))
    o.append(Poly([(JIB_TIP, ytop(JIB_TIP) + 0.2), (940, TOP_Y + 0.2), (JIB_ROOT, TOP_Y + 0.2), (JIB_ROOT, TOP_Y + 0.7), (940, TOP_Y + 0.7), (JIB_TIP, ytop(JIB_TIP) + 0.7)], K['yLL'], ' opacity=".8"'))
    o.append(rail(JIB_ROOT - 24 * 14, JIB_ROOT - 6, TOP_Y - 7.4, 24, 7.2))
    o.append(rail(JIB_TIP + 18, JIB_TIP + 18 + 24 * 3, ytop(JIB_TIP + 40) - 7.4, 24, 7.2))
    # cordón inferior + carril del carro
    o.append(R(JIB_TIP, BOT_Y, JIB_ROOT - JIB_TIP, 4.2, K['yB']))
    o.append(R(JIB_TIP, BOT_Y, JIB_ROOT - JIB_TIP, 1.3, K['yL']))
    o.append(R(JIB_TIP, BOT_Y + 3.0, JIB_ROOT - JIB_TIP, 1.2, K['yD']))
    o.append(R(JIB_TIP + 4, 58.2, JIB_ROOT - JIB_TIP - 4, 2.4, K['sL']))
    o.append(R(JIB_TIP + 4, 58.2, JIB_ROOT - JIB_TIP - 4, 0.8, K['sLL']))
    o.append(R(JIB_TIP + 4, 59.8, JIB_ROOT - JIB_TIP - 4, 0.8, K['sD']))
    # juntas de tramo (cada 6 paneles) con tornillos
    for k in range(0, NSEG + 1, 8):
        x = xs[k]
        o.append(R(x - 1.6, ytop(x) - 0.4, 3.2, 20.8 - (ytop(x) - TOP_Y), K['sM'], ' opacity=".9"'))
        o.append(rivets([x], ytop(x) + 1.6, 0.7, K['sLL']) + rivets([x], BOT_Y + 2.2, 0.7, K['sLL']))
    # punta: placa, polea de reenvío y luz de aviso
    o.append(Poly([(JIB_TIP - 8, ytop(JIB_TIP) - 0.5), (JIB_TIP + 1, ytop(JIB_TIP) - 0.5), (JIB_TIP + 1, 60.6), (JIB_TIP - 8, 57.8)], K['yB']))
    o.append(Poly([(JIB_TIP - 8, ytop(JIB_TIP) - 0.5), (JIB_TIP + 1, ytop(JIB_TIP) - 0.5), (JIB_TIP + 1, ytop(JIB_TIP) + 1.6), (JIB_TIP - 8, ytop(JIB_TIP) + 1.6)], K['yL']))
    o.append(Poly([(JIB_TIP - 8, 55.6), (JIB_TIP + 1, 55.6), (JIB_TIP + 1, 60.6), (JIB_TIP - 8, 57.8)], K['yD']))
    o.append(rivets([JIB_TIP - 5.5, JIB_TIP - 2], ytop(JIB_TIP) + 4.5, 0.8))
    o.append(Ci(JIB_TIP - 3.4, 64.2, 4.3, K['sD']) + Ci(JIB_TIP - 3.4, 64.2, 3.2, 'url(#gru-gSheave)') + Ci(JIB_TIP - 3.4, 64.2, 1.1, K['sDD']))
    o.append(R(JIB_TIP - 4.4, 58, 2, 3.4, K['sM']))
    # cartelas donde amarran los tirantes
    for gx in (968, 612):
        gy = ytop(gx)
        o.append(Poly([(gx - 7, gy + 5), (gx - 3, gy - 2.2), (gx + 3, gy - 2.2), (gx + 7, gy + 5)], K['yD']))
        o.append(Poly([(gx - 5.4, gy + 4.2), (gx - 2.4, gy - 1.2), (gx + 2.4, gy - 1.2), (gx + 5.4, gy + 4.2)], K['yB']))
        o.append(Ci(gx, gy - 0.4, 1.5, K['sD']) + Ci(gx - 0.3, gy - 0.7, 0.55, K['sLL']))
    return ''.join(o)


def cjib_svg():
    o = []
    x0, x1 = JIB_ROOT - 36, CJ_END
    NSEG = 14
    xs = [x0 + (x1 - x0) * k / NSEG for k in range(NSEG + 1)]
    pts = [(x, TOP_Y + 2.1 if k % 2 == 0 else BOT_Y + 2) for k, x in enumerate(xs)]
    zig = 'M' + 'L'.join(f'{n(x)} {n(y)}' for x, y in pts)
    o.append(lat3(zig, 1.9, 0.7))
    vert = ''.join(f'M{n(x)} {TOP_Y + 3}L{n(x)} {BOT_Y + 1}' for k, x in enumerate(xs) if k % 2 == 0)
    o.append(lat3(vert, 1.5, 0.6))
    for (a, b, col) in ((0, 1.3, K['yL']), (1.3, 3.0, K['yB']), (3.0, 4.2, K['yD'])):
        o.append(R(x0, TOP_Y + a, x1 - x0, b - a, col))
    o.append(R(x0, TOP_Y + 0.2, x1 - x0, 0.5, K['yLL'], ' opacity=".8"'))
    o.append(R(x0, BOT_Y, x1 - x0, 4.2, K['yB']) + R(x0, BOT_Y, x1 - x0, 1.3, K['yL']) + R(x0, BOT_Y + 3, x1 - x0, 1.2, K['yD']))
    o.append(rail(x0 + 12, x1 - 6, TOP_Y - 7.4, 22, 7.2))
    # placa del extremo
    o.append(R(x1 - 1, TOP_Y - 0.5, 6, 21.5, K['yB']) + R(x1 - 1, TOP_Y - 0.5, 6, 2, K['yL']) + R(x1 + 3.4, TOP_Y - 0.5, 1.6, 21.5, K['yD']))
    o.append(rivets([x1 + 1.6, x1 + 1.6, x1 + 1.6], TOP_Y + 5, 0.7) + rivets([x1 + 1.6], TOP_Y + 12, 0.7) + rivets([x1 + 1.6], TOP_Y + 17.5, 0.7))
    # caseta del cabrestante (máquina de izado)
    hx, hy, hw, hh = 1286, 39.5, 58, 18.6
    o.append(tri(hx, hy, hw, hh, K['yL'], K['yB'], K['yD'], 0.2, 0.22))
    o.append(R(hx - 1.2, hy - 1.2, hw + 2.4, 2.6, K['yLL'], ' opacity=".9"') + R(hx - 1.2, hy - 1.2, hw + 2.4, 1, K['yL']))
    for i in range(6):                                   # rejillas de ventilación
        o.append(R(hx + 5 + i * 3.2, hy + 4.4, 1.6, 9, K['yDD'], ' opacity=".85"'))
    o.append(R(hx + 28, hy + 3.4, 16, 11.4, K['sD']) + R(hx + 28.8, hy + 4.2, 14.4, 9.8, K['sDD']))
    drum = ''.join(f'<line x1="0" y1="0" x2="{n(3.7 * math.cos(math.radians(a)))}" y2="{n(3.7 * math.sin(math.radians(a)))}" stroke="{K["sDD"]}" stroke-width="0.7"/>' for a in range(0, 360, 40))
    o.append(f'<g transform="translate({n(hx + 36)} {n(hy + 9.3)})">' + Ci(0, 0, 4.4, 'url(#gru-gSheave)') + f'<g id="gru-drum">{drum}</g>' + Ci(0, 0, 1.3, K['sDD']) + Ci(-0.4, -0.5, 0.45, K['sLL']) + '</g>')   # ventana con el tambor
    o.append(R(hx + 47, hy + 3.4, 7.4, 12.6, K['yD']) + R(hx + 47.9, hy + 4.3, 5.6, 10.8, K['yB']))
    o.append(Ci(hx + 53, hy + 10, 0.8, K['sD']))
    o.append(rivets([hx + 2, hx + 26, hx + 45, hx + hw - 2], hy + hh - 2.2, 0.7, K['yDD']))
    # chimenea del escape
    o.append(R(1334, 30, 4.4, 10.6, K['sD']) + R(1334, 30, 1.5, 10.6, K['sM']))
    o.append(R(1332.8, 28.8, 6.8, 2.2, K['sM']) + R(1332.8, 28.8, 6.8, 0.8, K['sLL']))
    # contrapesos de hormigón colgados del extremo
    cx0, cw = 1347, 38
    o.append(R(cx0 + 4, 58, 1.5, 6, K['sD']) + R(cx0 + cw - 5.5, 58, 1.5, 6, K['sD']))
    for i in range(3):
        y = 63 + i * 13.6
        o.append(R(cx0, y, cw, 12.6, K['cB']))
        o.append(R(cx0, y, cw, 2.2, K['cL']))
        o.append(R(cx0, y + 10, cw, 2.6, K['cD']))
        o.append(R(cx0 + 0.3, y + 2.4, 1.1, 7.6, K['cL'], ' opacity=".6"'))
        o.append(R(cx0, y + 5.6, cw, 0.6, K['cD'], ' opacity=".55"'))
        o.append(Ci(cx0 + 6, y + 6.2, 1.15, K['sD']) + Ci(cx0 + cw - 6, y + 6.2, 1.15, K['sD']))
        o.append(Ci(cx0 + 6 - 0.3, y + 5.8, 0.45, K['sLL']) + Ci(cx0 + cw - 6 - 0.3, y + 5.8, 0.45, K['sLL']))
    return ''.join(o)


def root_svg():
    """Pórtico donde se unen pluma, contrapluma y cabeza de la torre (tapa los extremos recortados)."""
    x0, x1 = 1212, 1268
    o = []
    d = f'M{x0 + 4} {TOP_Y + 4}L{MX} {BOT_Y}L{x1 - 4} {TOP_Y + 4}M{x0 + 4} {BOT_Y}L{MX} {TOP_Y + 4}L{x1 - 4} {BOT_Y}'
    o.append(lat3(d, 1.8, 0.65))
    for (a, b, col) in ((0, 1.3, K['yL']), (1.3, 3.0, K['yB']), (3.0, 4.2, K['yD'])):
        o.append(R(x0, TOP_Y + a, x1 - x0, b - a, col))
    o.append(R(x0, BOT_Y, x1 - x0, 4.2, K['yB']) + R(x0, BOT_Y, x1 - x0, 1.3, K['yL']) + R(x0, BOT_Y + 3, x1 - x0, 1.2, K['yD']))
    for px in (x0 - 1.2, x1 - 3.8):
        o.append(R(px, TOP_Y - 0.4, 5, 20.8, K['yB']) + R(px, TOP_Y - 0.4, 1.6, 20.8, K['yL']) + R(px + 3.4, TOP_Y - 0.4, 1.6, 20.8, K['yD']))
    o.append(tri(MX - 16, TOP_Y + 3.6, 32, 12.4, K['yL'], K['yB'], K['yD'], 0.22, 0.26))
    o.append(rivets([MX - 12.5, MX - 4, MX + 4, MX + 12.5], TOP_Y + 6.4, 0.75, K['yDD']) + rivets([MX - 12.5, MX + 12.5], TOP_Y + 13, 0.75, K['yDD']))
    o.append(Ci(MX, TOP_Y + 9.8, 3.4, K['sD']) + Ci(MX, TOP_Y + 9.8, 2.6, 'url(#gru-gSheave)') + Ci(MX, TOP_Y + 9.8, 0.9, K['sDD']))
    return ''.join(o)


def cathead_svg():
    """Cabeza de la torre (A-frame) con cruceta y placa superior; base en y=TOP_Y."""
    o = []
    bl, br = 1219, 1261
    ax = MX
    legs = f'M{bl} {TOP_Y + 1}L{ax - 3} {APEX_Y + 1}M{br} {TOP_Y + 1}L{ax + 3} {APEX_Y + 1}'
    cross = ''
    for y in (31.5, 24, 17):
        t = (TOP_Y - y) / (TOP_Y - APEX_Y)
        xl = bl + (ax - 3 - bl) * t
        xr = br + (ax + 3 - br) * t
        cross += f'M{n(xl)} {y}L{n(xr)} {y}'
    zig = ''
    levels = [TOP_Y, 31.5, 24, 17, APEX_Y + 2]
    for i in range(len(levels) - 1):
        ya, yb = levels[i], levels[i + 1]
        ta = (TOP_Y - ya) / (TOP_Y - APEX_Y)
        tb = (TOP_Y - yb) / (TOP_Y - APEX_Y)
        xla, xra = bl + (ax - 3 - bl) * ta, br + (ax + 3 - br) * ta
        xlb, xrb = bl + (ax - 3 - bl) * tb, br + (ax + 3 - br) * tb
        if i % 2 == 0:
            zig += f'M{n(xla)} {ya}L{n(xrb)} {yb}'
        else:
            zig += f'M{n(xra)} {ya}L{n(xlb)} {yb}'
    o.append(lat3(zig, 1.5, 0.55))
    o.append(lat3(cross, 1.5, 0.55))
    o.append(lat3(legs, 3.3, 0.8))
    # cabezal con la polea de los tirantes
    o.append(tri(ax - 6, APEX_Y - 1.4, 12, 5.4, K['yL'], K['yB'], K['yD'], 0.28, 0.3))
    o.append(Ci(ax, APEX_Y + 1.2, 1.4, K['sD']) + Ci(ax - 0.3, APEX_Y + 0.9, 0.5, K['sLL']))
    o.append(R(ax - 0.9, 4.2, 1.8, 4, K['sM']))
    return ''.join(o)


def ties_svg():
    """Tirantes: del vértice a la pluma y a la contrapluma. Cada uno es un <g> con 3 trazos (pathLength=1)."""
    A = (MX, APEX_Y + 1.2)
    targets = [('1', (968, TOP_Y + 0.4)), ('2', (612, ytop(612) + 0.4)), ('3', (1352, TOP_Y + 0.4)), ('4', (1386, TOP_Y + 0.4))]
    o = []
    for tid, (x, y) in targets:
        d = f'M{n(A[0])} {n(A[1])}L{n(x)} {n(y)}'
        s = f'<g id="gru-tie{tid}">'
        s += St(d, K['sD'], 2.0, ' pathLength="1" stroke-dasharray="1 1" transform="translate(0.5 0.7)"')
        s += St(d, K['sL'], 1.4, ' pathLength="1" stroke-dasharray="1 1"')
        s += St(d, K['sLL'], 0.5, ' pathLength="1" stroke-dasharray="1 1" transform="translate(-0.2 -0.35)"')
        s += '</g>'
        o.append(s)
        # tensor (manguito) a mitad del tirante
        mx, my = A[0] + (x - A[0]) * 0.5, A[1] + (y - A[1]) * 0.5
        ang = math.degrees(math.atan2(y - A[1], x - A[0]))
        o.append(f'<g id="gru-tt{tid}" transform="translate({n(mx)} {n(my)}) rotate({n(ang)})" opacity="0">'
                 + R(-4.5, -1.5, 9, 3, K['yD']) + R(-4.5, -1.5, 9, 1.1, K['yL']) + R(-4.5, 0.5, 9, 1, K['yDD'])
                 + Ci(-4.5, 0, 0.9, K['sD']) + Ci(4.5, 0, 0.9, K['sD']) + '</g>')
    return ''.join(o)


def turret_svg():
    o = []
    # plataforma de giro
    o.append(tri(1204, 58, 72, 16, K['yL'], K['yB'], K['yD'], 0.2, 0.24))
    o.append(R(1203, 57, 74, 2.2, K['yLL'], ' opacity=".9"'))
    for x in (1218, 1232, 1246, 1260):
        o.append(R(x, 61, 0.8, 9.6, K['yDD'], ' opacity=".55"'))
    for i in range(4):
        o.append(R(1262 + i * 3.2, 62, 1.6, 7, K['yDD'], ' opacity=".8"'))
    o.append(rivets([1207, 1275], 60.4, 0.75, K['yDD']) + rivets([1207, 1275], 71.4, 0.75, K['yDD']))
    # corona de giro
    o.append(tri(1209, 74, 62, 6.2, K['sLL'], K['sL'], K['sD'], 0.26, 0.34))
    for i in range(9):
        o.append(Ci(1213.5 + i * 6.7, 77, 0.95, K['sD']) + Ci(1213.2 + i * 6.7, 76.6, 0.35, K['sLL']))
    return ''.join(o)


def cab_svg():
    o = []
    x, y, w, h = 1202, 74, 36, 26
    # estructura amarilla
    o.append(R(x, y, w, h, K['yB'], ' rx="2.2"'))
    o.append(R(x + 0.5, y, w - 1, 4.2, K['yL'], ' rx="1.6"'))
    o.append(R(x, y + h - 4.6, w, 4.6, K['yD'], ' rx="1.4"'))
    o.append(R(x + w - 1.8, y + 3, 1.8, h - 6, K['yDD'], ' opacity=".55"'))
    # techo con equipo de aire y antena
    o.append(tri(x + 8, y - 3.2, 16, 3.4, K['sLL'], K['sL'], K['sD'], 0.34, 0.3))
    o.append(R(x + 27, y - 1.2, 1.2, 1.4, K['sD']) + R(x + 27.3, y - 8.4, 0.6, 7.4, K['sM']) + Ci(x + 27.6, y - 8.8, 1.1, K['red']))
    # ventana (cristal con degradado, marco y operario)
    o.append(R(x + 3, y + 5, 21.4, 14.8, K['sD'], ' rx="1.6"'))
    o.append('<g clip-path="url(#gru-clWin)">')
    o.append(R(x + 4.2, y + 6.2, 19, 12.4, 'url(#gru-gGlass)'))
    # operario: casco, cabeza, torso y palanca
    o.append(f'<g id="gru-op">')
    o.append(R(x + 8.8, y + 14.4, 9.6, 5, '#3A332C', ' rx="2"'))
    o.append(Ci(x + 13.4, y + 11.4, 3.1, K['skin']))
    o.append(Pa(f'M{n(x + 10)} {n(y + 10.8)}A3.5 3.5 0 0 1 {n(x + 16.8)} {n(y + 10.8)}Z', K['bone']))
    o.append(R(x + 9.6, y + 10.5, 7.6, 0.9, K['yB']))
    o.append(R(x + 16.8, y + 15.6, 4.6, 0.9, K['sD']) + Ci(x + 21.6, y + 15.8, 1, K['red']))
    o.append('</g>')
    o.append(f'<g id="gru-glare"><polygon points="{n(x + 2)},{n(y + 19)} {n(x + 6.5)},{n(y + 6)} {n(x + 9.6)},{n(y + 6)} {n(x + 5.2)},{n(y + 19)}" fill="#fff" opacity=".42"/>'
             f'<polygon points="{n(x + 10.4)},{n(y + 19)} {n(x + 14.9)},{n(y + 6)} {n(x + 16.2)},{n(y + 6)} {n(x + 11.7)},{n(y + 19)}" fill="#fff" opacity=".3"/></g>')
    o.append('</g>')
    o.append(R(x + 3, y + 5, 21.4, 1.2, K['sM'], ' rx=".6"'))
    # puerta/panel lateral y detalles
    o.append(R(x + 26.4, y + 6, 7, 14, K['yD'], ' rx="1"') + R(x + 27.2, y + 6.8, 5.4, 12.4, K['yB'], ' rx=".7"'))
    o.append(R(x + 27.8, y + 12, 2.2, 0.9, K['sD']))
    o.append(rivets([x + 1.8, x + w - 1.8], y + h - 2.3, 0.7, K['yDD']))
    # faldón y escalerilla
    o.append(R(x + 3, y + h - 1.4, w - 6, 2.4, K['sD']) + R(x + 3, y + h - 1.4, w - 6, 0.8, K['sM']))
    return ''.join(o)


def lamp_svg(idx, cx, cy, r=2.3):
    return (f'<g transform="translate({n(cx)} {n(cy)})">'
            f'<circle id="gru-lampG{idx}" cx="0" cy="0" r="{n(r * 4.2)}" fill="url(#gru-gRed)" opacity="0"/>'
            + Ci(0, 0, r, K['redD']) + Ci(0, 0, r * 0.8, K['red'])
            + f'<circle id="gru-lampC{idx}" cx="0" cy="0" r="{n(r * 0.8)}" fill="#FFD2C8" opacity="0"/>'
            + Ci(-r * 0.3, -r * 0.35, r * 0.28, '#fff', ' opacity=".8"') + '</g>')


def anem_svg():
    cx, cy = 1390.5, 31
    o = [R(cx - 0.6, cy, 1.2, 8, K['sM'])]
    o.append(f'<g id="gru-anem" transform="translate({cx} {cy})"><g id="gru-anemR">'
             + R(-5, -0.5, 10, 1, K['sD']) + R(-0.5, -5, 1, 10, K['sD'])
             + Ci(5, 0, 1.6, K['sLL']) + Ci(-5, 0, 1.6, K['sL']) + Ci(0, 5, 1.6, K['sLL']) + Ci(0, -5, 1.6, K['sL'])
             + '</g></g>')
    return ''.join(o)


# ───────────────────────────── piezas (letras) ─────────────────────────────
# bbox (cx, top, bot, w) medidos del contorno; 'a' = semi-separación de las eslingas
PIECES = {
    'd':  dict(cx=611.31, top=230.77, bot=290.81, w=41.89, src='d', clip=None, fill='bone',
               lugs=[(604.0, 247.0), (627.4, 230.9)]),
    'Ts': dict(cx=662.09, top=243.20, bot=290.09, w=10.50, src='T', clip='Ts', fill='orange',
               lugs=[(662.1, 243.3)]),
    'Tb': dict(cx=662.15, top=233.93, bot=243.20, w=45.69, src='T', clip='Tb', fill='orange',
               lugs=[(646.4, 234.0), (677.9, 234.0)]),
    'r':  dict(cx=701.16, top=246.35, bot=290.16, w=28.14, src='r', clip=None, fill='orange',
               lugs=[(692.0, 247.3), (707.0, 246.6)]),
    'Ao': dict(cx=734.61, top=246.31, bot=290.81, w=32.34, src='a', clip='Ao', fill='orange',
               lugs=[(727.0, 247.9), (743.0, 247.8)]),
    'As': dict(cx=755.55, top=246.44, bot=290.40, w=9.55, src='a', clip='As', fill='orange',
               lugs=[(755.55, 246.6)]),
}
for _k, _p in PIECES.items():
    _p['hang'] = sum(x for x, _ in _p['lugs']) / len(_p['lugs'])
    _p['a'] = (max(x for x, _ in _p['lugs']) - min(x for x, _ in _p['lugs'])) / 2
ORDER = ['d', 'Ts', 'Tb', 'r', 'Ao', 'As']
# posición de cada pieza colgada en la fila de espera (x de la pluma) y su orden de salida
ROW = {'d': 976, 'Ts': 1022, 'Tb': 1068, 'r': 1114, 'Ao': 1152, 'As': 1190}
LUG_DROP = 40          # del extremo del cable (origen del bloque del gancho) a la cara superior de la pieza
SLING_Y0, SLING_Y1 = 25.0, 36.0


def defs_svg():
    o = []
    o.append(f'<linearGradient id="gru-gGlass" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="{K["glassL"]}"/><stop offset=".5" stop-color="{K["glass"]}"/><stop offset="1" stop-color="{K["glassD"]}"/></linearGradient>')
    o.append(f'<linearGradient id="gru-gSheave" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{K["sLL"]}"/><stop offset=".5" stop-color="{K["sL"]}"/><stop offset="1" stop-color="{K["sD"]}"/></linearGradient>')
    o.append('<radialGradient id="gru-gGlow"><stop offset="0" stop-color="#FFFFFF" stop-opacity="1"/><stop offset=".3" stop-color="#FFF0B8" stop-opacity=".85"/><stop offset=".65" stop-color="#FFB030" stop-opacity=".35"/><stop offset="1" stop-color="#FF8A00" stop-opacity="0"/></radialGradient>')
    o.append(f'<radialGradient id="gru-gRed"><stop offset="0" stop-color="{K["red"]}" stop-opacity=".95"/><stop offset=".4" stop-color="{K["red"]}" stop-opacity=".4"/><stop offset="1" stop-color="{K["red"]}" stop-opacity="0"/></radialGradient>')
    o.append('<radialGradient id="gru-gShadow"><stop offset="0" stop-color="#000" stop-opacity=".62"/><stop offset=".6" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>')
    o.append('<radialGradient id="gru-gDust"><stop offset="0" stop-color="#D9CBB1" stop-opacity=".85"/><stop offset=".6" stop-color="#BFAE92" stop-opacity=".45"/><stop offset="1" stop-color="#A6957A" stop-opacity="0"/></radialGradient>')
    o.append('<radialGradient id="gru-gSmoke"><stop offset="0" stop-color="#6E655B" stop-opacity=".8"/><stop offset=".6" stop-color="#4A423A" stop-opacity=".4"/><stop offset="1" stop-color="#2B2621" stop-opacity="0"/></radialGradient>')
    # contornos de las letras (sin relleno: lo pone quien las usa)
    for ch in ('d', 'T', 'r', 'a'):
        o.append(f'<path id="gru-p-{ch}" d="{LP[ch]}" fill-rule="evenodd"/>')
    # recortes: la T se parte en barra y palo; la a en óvalo (una «c») y palo derecho
    o.append('<clipPath id="gru-cl-Ts"><rect x="630" y="243.2" width="70" height="60"/></clipPath>')
    o.append('<clipPath id="gru-cl-Tb"><rect x="630" y="225" width="70" height="18.2"/></clipPath>')
    o.append('<clipPath id="gru-cl-Ao"><rect x="712" y="240" width="38.78" height="60"/></clipPath>')
    o.append('<clipPath id="gru-cl-As"><rect x="750.78" y="240" width="20" height="60"/></clipPath>')
    for key, p in PIECES.items():
        if p['clip']:
            o.append(f'<g id="gru-pc-{key}" clip-path="url(#gru-cl-{p["clip"]})"><use href="#gru-p-{p["src"]}"/></g>')
        else:
            o.append(f'<g id="gru-pc-{key}"><use href="#gru-p-{p["src"]}"/></g>')
    # recortes de la cabina, de la corona del mástil y del suelo
    o.append('<clipPath id="gru-clHaz"><rect x="1178" y="318.4" width="124" height="4"/></clipPath>')
    o.append('<clipPath id="gru-clWin"><rect x="1205.2" y="80.2" width="19.2" height="12.8" rx="1"/></clipPath>')
    o.append('<clipPath id="gru-clGround"><rect x="-200" y="-200" width="1900" height="524"/></clipPath>')
    o.append('<clipPath id="gru-clJib"><rect x="-300" y="-100" width="1514" height="500"/></clipPath>')
    o.append('<clipPath id="gru-clCj"><rect x="1266" y="-100" width="300" height="500"/></clipPath>')
    o.append('<clipPath id="gru-clMast"><rect id="gru-clMastR" x="1100" y="309" width="300" height="240"/></clipPath>')
    return '<defs>' + ''.join(o) + '</defs>'


def rig_svg(key):
    """Carro + cable + bloque del gancho + eslingas + pieza colgada. Origen = centro de la polea del carro."""
    p = PIECES[key]
    a = p['a']
    o = [f'<g id="gru-rig-{key}"><g transform="translate(0 {PIVOT_Y})">']
    # carro: cuerpo, ruedas sobre el carril, bastidor y polea
    o.append(tri(-11, -11.7, 22, 9.2, K['yL'], K['yB'], K['yD'], 0.24, 0.26))
    o.append(R(-11.6, -12.2, 23.2, 1.3, K['sM']))
    o.append(Ci(-7.2, -11.4, 2.15, K['sL']) + Ci(7.2, -11.4, 2.15, K['sL']) + Ci(-7.2, -11.4, 0.8, K['sDD']) + Ci(7.2, -11.4, 0.8, K['sDD']))
    o.append(rivets([-8.4, 8.4], -4.6, 0.65, K['yDD']))
    o.append(R(-3.8, -3, 7.6, 4.2, K['sD']))
    o.append(sheave(f'gru-ts-{key}', 0.4, 3.1))
    # péndulo: cable + bloque + eslingas + carga
    o.append(f'<g id="gru-sw-{key}">')
    o.append(f'<line class="gru-cab-{key}" x1="0" y1="0" x2="0" y2="6" stroke="{K["sD"]}" stroke-width="1.7"/>')
    o.append(f'<line class="gru-cab-{key}" x1="-0.45" y1="0" x2="-0.45" y2="6" stroke="{K["sLL"]}" stroke-width="0.5"/>')
    o.append(f'<g id="gru-hb-{key}">')
    # bloque del gancho (amarillo, polea de acero), vástago, gancho y argolla
    o.append(R(-4.2, -0.2, 8.4, 2.8, K['sD']))
    o.append(tri(-8, 2.4, 16, 10.4, K['yL'], K['yB'], K['yD'], 0.24, 0.28))
    o.append(R(-8.6, 2.0, 17.2, 1.2, K['sM']))
    o.append(sheave(f'gru-hs-{key}', 7.4, 2.7))
    o.append(rivets([-6, 6], 10.6, 0.6, K['yDD']))
    o.append(R(-2.1, 12.6, 4.2, 3, K['sM']) + R(-2.1, 12.6, 1.4, 3, K['sL']))
    o.append(St('M0 15.4L0 19.6C0 24.2 6.2 24.2 6.2 19.4L6.2 18', K['sD'], 3.1, ' stroke-linecap="round"'))
    o.append(St('M0 15.4L0 19.6C0 24.2 6.2 24.2 6.2 19.4L6.2 18', K['sL'], 2.0, ' stroke-linecap="round"'))
    o.append(St('M-0.5 15.8L-0.5 19.6', K['sLL'], 0.6))
    o.append(f'<ellipse cx="2.3" cy="22.2" rx="3.3" ry="2.7" fill="none" stroke="{K["sD"]}" stroke-width="1.5"/>')
    o.append(f'<ellipse cx="2.3" cy="22.2" rx="3.3" ry="2.7" fill="none" stroke="{K["sL"]}" stroke-width=".55" transform="translate(-.25 -.3)"/>')
    # eslingas flojas (tras soltar) y carga
    sl = max(a, 3.0) * 0.55
    o.append(f'<g id="gru-slk-{key}" opacity="0">'
             + St(f'M2.3 25 C{n(2.3 - sl * 0.2)} 29 {n(2.3 - sl)} 28 {n(2.3 - sl * 1.1)} 34', K['sD'], 1.4, ' stroke-linecap="round"')
             + St(f'M2.3 25 C{n(2.3 + sl * 0.2)} 29 {n(2.3 + sl)} 28 {n(2.3 + sl * 1.1)} 34', K['sD'], 1.4, ' stroke-linecap="round"') + '</g>')
    cs = f'<g id="gru-c-{key}" opacity="0">'
    lugs = [(lx - p['hang'], LUG_DROP + (ly - p['top'])) for lx, ly in p['lugs']]
    for (lx, ly) in lugs:
        cs += St(f'M2.3 {SLING_Y0}L{n(lx)} {n(ly - 3.1)}', K['sD'], 1.5)
        cs += St(f'M2.1 {SLING_Y0}L{n(lx - 0.2)} {n(ly - 3.1)}', K['sL'], 0.5)
    for (lx, ly) in lugs:
        cs += R(lx - 2.5, ly - 3.6, 5, 4.0, K['sM'], ' rx=".6"') + R(lx - 2.5, ly - 3.6, 5, 1.3, K['sL'], ' rx=".5"')
        cs += Ci(lx, ly - 1.6, 0.85, K['sDD'])
    cs += f'<use href="#gru-pc-{key}" fill="{K[p["fill"]]}" transform="translate({n(-p["hang"])} {n(LUG_DROP - p["top"])})"/>'
    cs += '</g>'
    o.append(cs)
    o.append('</g></g></g></g>')   # hb, sw, translate, rig
    return ''.join(o)


def letters_svg():
    o = ['<g id="gru-letters">']
    for key in ORDER:
        p = PIECES[key]
        o.append(f'<use id="gru-L-{key}" href="#gru-pc-{key}" fill="{K[p["fill"]]}" opacity="0"/>')
    o.append(f'<use id="gru-L-T" href="#gru-p-T" fill="{K["orange"]}" opacity="0"/>')
    o.append(f'<use id="gru-L-a" href="#gru-p-a" fill="{K["orange"]}" opacity="0"/>')
    o.append('</g>')
    return ''.join(o)


def fx_svg():
    """Chispas, destellos, polvo y humo: todo al principio invisible; el guion los coloca."""
    o = ['<g id="gru-fx">']
    # destellos de soldadura (cada uno en su propio origen para escalar sobre sí mismo)
    o.append('<g transform="translate(662 243.4)"><circle id="gru-flT" cx="0" cy="0" r="26" fill="url(#gru-gGlow)" opacity="0"/></g>')
    o.append('<g transform="translate(751 268)"><circle id="gru-flA" cx="0" cy="0" r="40" fill="url(#gru-gGlow)" opacity="0"/></g>')
    o.append('<g transform="translate(751 247)"><circle id="gru-flA2" cx="0" cy="0" r="15" fill="url(#gru-gGlow)" opacity="0"/></g>')
    o.append(f'<use id="gru-hiT" href="#gru-p-T" fill="#FFF8E6" opacity="0"/>')
    o.append(f'<use id="gru-hiA" href="#gru-p-a" fill="#FFF8E6" opacity="0"/>')
    o.append('<rect id="gru-seamA" x="749.9" y="246" width="1.9" height="0" fill="#FFF3C4" opacity="0" rx=".9"/>')
    o.append('<rect id="gru-seamT" x="656.4" y="242.4" width="11.3" height="1.8" fill="#FFF3C4" opacity="0" rx=".9"/>')
    # chispas (se colocan por JS en gru-sp0..N) y polvo/humo
    for i in range(52):
        o.append(f'<g id="gru-sp{i}" opacity="0"><circle cx="0" cy="0" r="3.4" fill="url(#gru-gGlow)" opacity=".5"/><rect x="-3.4" y="-0.6" width="6.8" height="1.2" rx=".6" fill="#FFC85A"/><rect x="-1.2" y="-0.5" width="4.6" height="1" rx=".5" fill="#FFE9A6"/><rect x="0.6" y="-0.32" width="2.8" height="0.64" rx=".3" fill="#FFFFFF"/></g>')
    for i in range(48):
        o.append(f'<circle id="gru-du{i}" cx="0" cy="0" r="5" fill="url(#gru-gDust)" opacity="0"/>')
    for i in range(6):
        o.append(f'<circle id="gru-sm{i}" cx="0" cy="0" r="4.5" fill="url(#gru-gSmoke)" opacity="0"/>')
    o.append('</g>')
    return ''.join(o)


def build():
    defs = defs_svg()
    shadow = ('<g id="gru-shadow" opacity="0">'
              '<ellipse cx="1240" cy="323.4" rx="84" ry="5.2" fill="url(#gru-gShadow)"/>'
              '<ellipse cx="1240" cy="323.6" rx="46" ry="3" fill="#000" opacity=".28"/></g>')
    foot = (f'<g transform="translate(1240 324)"><g id="gru-foot">'
            f'<g transform="translate(-1240 -324)">{foot_svg()}</g></g></g>')
    mast = f'<g clip-path="url(#gru-clMast)"><g id="gru-mast">{mast_svg()}</g></g>'
    # cabeza giratoria: contrapluma, torreta, cabeza de la torre, tirantes, pluma y carros, cabina
    cj = f'<g clip-path="url(#gru-clCj)"><g id="gru-cjibX">{cjib_svg()}{lamp_svg(3, CJ_END + 1.6, TOP_Y - 3.2, 1.9)}{anem_svg()}</g></g>'
    turret = f'<g id="gru-turret">{turret_svg()}</g>'
    root = f'<g id="gru-root">{root_svg()}</g>'
    cat = (f'<g transform="translate({MX} {TOP_Y})"><g id="gru-cathead">'
           f'<g transform="translate({-MX} {-TOP_Y})">{cathead_svg()}{lamp_svg(1, MX, 3.6, 2.2)}</g></g></g>')
    ties = f'<g id="gru-ties">{ties_svg()}</g>'
    jib = f'<g clip-path="url(#gru-clJib)"><g id="gru-jibX">{jib_svg()}{lamp_svg(2, JIB_TIP - 4.6, ytop(JIB_TIP) - 3.4, 1.9)}</g></g>'
    rigs = '<g clip-path="url(#gru-clJib)"><g id="gru-rigs">' + ''.join(rig_svg(k) for k in ORDER) + '</g></g>'
    cab = f'<g id="gru-cab">{cab_svg()}</g>'
    head = f'<g clip-path="url(#gru-clGround)"><g id="gru-head">{cj}{jib}{rigs}{turret}{root}{cat}{ties}{cab}</g></g>'
    stage = (f'<svg id="gru-stage" viewBox="0 0 1400 360" width="1400" height="360" aria-hidden="true">'
             f'{defs}{shadow}{letters_svg()}{mast}{head}{foot}{fx_svg()}</svg>')
    return stage


def main():
    model = open(os.path.join(HERE, 'model.js'), encoding='utf-8').read()
    scene = open(os.path.join(HERE, 'scene.js'), encoding='utf-8').read()
    pieces_js = json.dumps({k: dict(cx=v['cx'], hang=round(v['hang'], 2), top=v['top'], bot=v['bot'], w=v['w'], a=v['a']) for k, v in PIECES.items()}, separators=(',', ':'))
    row_js = json.dumps(ROW, separators=(',', ':'))
    html = f'''<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1400, height=360" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      /* Transparente: sin fondo en html, body ni #root. */
      html, body {{ margin: 0; width: 1400px; height: 360px; overflow: hidden; background: transparent; }}
      #root {{ position: relative; width: 1400px; height: 360px; background: transparent; }}
      #root svg {{ position: absolute; left: 0; top: 0; overflow: visible; }}
    </style>
  </head>
  <body>
    <!-- GRÚA TORRE (pieza «grua», prefijo gru-). Lienzo 1400×360, 5,6 s. Generado por src/gen.py: ver NOTAS.md. -->
    <div id="root" data-composition-id="main" data-start="0" data-duration="5.6" data-width="1400" data-height="360">
      {build()}
    </div>
    <script>
    (function () {{
      const PIECES = {pieces_js};
      const ROW = {row_js};
{model}
{scene}
    }})();
    </script>
  </body>
</html>
'''
    out = os.path.join(PART, 'index.html')
    open(out, 'w', encoding='utf-8').write(html)
    print('escrito', out, len(html), 'bytes')


if __name__ == '__main__':
    main()
