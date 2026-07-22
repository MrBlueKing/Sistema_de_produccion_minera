import os
import xml.sax.saxutils as sax

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Subir este numero cada vez que se corra el script con cambios nuevos,
# para NO pisar el .drawio de la version anterior (cada version queda como
# su propio archivo, así se puede comparar/volver atrás).
VERSION = 4

nodes = {}
edges = []

def node(id, x, y, w, h, style, value):
    nodes[id] = dict(x=x, y=y, w=w, h=h, style=style, value=value)

def edge(id, source, target, style, value=None, points=None):
    edges.append(dict(id=id, source=source, target=target, style=style, value=value, points=points))

# ---- Titulo ----
node("titulo", 10, 10, 1950, 45,
     "text;html=1;strokeColor=#c0400a;fillColor=#E06010;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=1;fontColor=#ffffff;fontSize=26;fontStyle=1;",
     "SISTEMA DE GESTIÓN OPERATIVO 3H — Flujo de Datos (incluye Ingeniería)")

# ---- Carril INGENIERIA (sin cambios respecto a version_2) ----
node("bg_ing", 10, 145, 1930, 130, "rounded=0;whiteSpace=wrap;html=1;fillColor=#7E6BC4;strokeColor=#333333;strokeWidth=1.5;fontColor=#ffffff;fontSize=14;", "")
node("hdr_ing", 10, 145, 120, 130, "rounded=0;whiteSpace=wrap;html=1;fillColor=#E06010;strokeColor=#c0400a;fontColor=#ffffff;fontSize=15;fontStyle=1;align=center;verticalAlign=middle;", "MÓDULO\nINGENIERÍA")
node("n_start", 110, 170, 65, 45, "ellipse;whiteSpace=wrap;html=1;fillColor=#E06010;strokeColor=#c0400a;fontColor=#ffffff;fontStyle=1;fontSize=13;", "INICIO")
node("ing1", 345, 167, 150, 62, "rounded=1;whiteSpace=wrap;html=1;fillColor=#E3DCFA;strokeColor=#5E35B1;fontSize=13;", "Crear/Definir\nFrente de Trabajo\n(túnel/manto/calle/tipo)")
node("ing2", 540, 167, 150, 62, "rounded=1;whiteSpace=wrap;html=1;fillColor=#E3DCFA;strokeColor=#5E35B1;fontSize=13;", "Seguimiento de Estado\n(ventilación, estabilidad,\nfecha estimada)")
node("ing3", 745, 155, 125, 85, "rhombus;whiteSpace=wrap;html=1;fillColor=#FFD54F;strokeColor=#E06010;fontSize=12.5;fontStyle=1;", "¿Frente\nlisto para\noperar?")
edge("e1", "n_start", "ing1", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;")
edge("e2", "ing1", "ing2", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;")
edge("e3", "ing2", "ing3", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;")

# ---- Carril OPERACIONES ----
node("bg_op", 10, 287, 1930, 130, "rounded=0;whiteSpace=wrap;html=1;fillColor=#C98A55;strokeColor=#333333;strokeWidth=1.5;fontColor=#ffffff;fontSize=14;", "")
node("hdr_op", 10, 287, 120, 130, "rounded=0;whiteSpace=wrap;html=1;fillColor=#E06010;strokeColor=#c0400a;fontColor=#ffffff;fontSize=15;fontStyle=1;align=center;verticalAlign=middle;", "MÓDULO\nOPERACIONES")
node("op1", 745, 309, 150, 62, "rounded=1;whiteSpace=wrap;html=1;fillColor=#FFE0C0;strokeColor=#E06010;fontSize=13;", "Registro de Perforación\ny Tronadura")
node("op2", 940, 309, 150, 62, "rounded=1;whiteSpace=wrap;html=1;fillColor=#FFE0C0;strokeColor=#E06010;fontSize=13;", "Extracción mineral\nmina → cancha\n(camión dumper)")
edge("e4", "ing3", "op1", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;strokeColor=#2E7D32;fontColor=#2E7D32;fontStyle=1;", "Sí", [(807, 281)])
edge("e5", "op1", "op2", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;")

# ---- Carril DISPATCH ----
node("bg_dis", 10, 429, 1930, 260, "rounded=0;whiteSpace=wrap;html=1;fillColor=#3F9B3F;strokeColor=#333333;strokeWidth=1.5;fontColor=#ffffff;fontSize=14;", "")
node("hdr_dis", 10, 429, 120, 260, "rounded=0;whiteSpace=wrap;html=1;fillColor=#E06010;strokeColor=#c0400a;fontColor=#ffffff;fontSize=15;fontStyle=1;align=center;verticalAlign=middle;", "MÓDULO\nDISPATCH")
node("dis1", 940, 451, 150, 62, "rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF9C4;strokeColor=#F9A825;fontSize=13;", "Registro de\nDumpadas")
node("dis2", 1135, 451, 150, 62, "rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF9C4;strokeColor=#F9A825;fontSize=13;", "Toma de Muestra\n(en cancha hasta\ncumplir ley)")
node("dis3", 1330, 451, 150, 62, "rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF9C4;strokeColor=#F9A825;fontSize=13;", "Envío de muestra\na laboratorio")
node("dis4", 1330, 551, 150, 62, "rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF9C4;strokeColor=#F9A825;fontSize=13;", "Generar Lotes\nInternos")
node("dis5", 1135, 551, 150, 62, "rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF9C4;strokeColor=#F9A825;fontSize=13;", "Cargar camiones\nde distintos lotes")
node("dis6", 940, 551, 150, 62, "rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF9C4;strokeColor=#F9A825;fontSize=13;", "Despacho de\ncamiones a planta")
edge("e6", "op2", "dis1", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;")
edge("e7", "dis1", "dis2", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;")
edge("e8", "dis2", "dis3", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;")
edge("e9", "dis3", "dis4", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;")
edge("e10", "dis4", "dis5", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;")
edge("e11", "dis5", "dis6", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;")
node("nota_autocreate", 940, 619, 190, 30, "rounded=1;whiteSpace=wrap;html=1;fillColor=#FFE8D0;strokeColor=#E06010;fontSize=12;fontStyle=2;align=center;", "↑ el frente también se autogenera acá si no existe en el catálogo")

# ---- Carril LABORATORIO Y PLANTA ----
node("bg_lab", 10, 701, 1930, 235, "rounded=0;whiteSpace=wrap;html=1;fillColor=#3F9B3F;strokeColor=#333333;strokeWidth=1.5;fontColor=#ffffff;fontSize=14;", "")
node("hdr_lab", 10, 701, 120, 235, "rounded=0;whiteSpace=wrap;html=1;fillColor=#E06010;strokeColor=#c0400a;fontColor=#ffffff;fontSize=15;fontStyle=1;align=center;verticalAlign=middle;", "LABORATORIO\nY PLANTA")
node("n_analisis", 1330, 723, 150, 62, "rounded=1;whiteSpace=wrap;html=1;fillColor=#D6E8FF;strokeColor=#1565C0;fontSize=13;", "Análisis de muestras\ny paquetes de segunda\nEntrega de resultados")
node("n_lote_candidato", 1500, 717, 170, 72, "rounded=1;whiteSpace=wrap;html=1;fillColor=#D6E8FF;strokeColor=#1565C0;fontSize=11;", "Generar LOTE INTERNO\nObj: 1.3% Cu insoluble\nMezcla 100t · Error 19%")
node("n_cumple", 1780, 711, 125, 85, "rhombus;whiteSpace=wrap;html=1;fillColor=#FFD54F;strokeColor=#E06010;fontSize=12.5;fontStyle=1;", "¿Mezcla de\ndumpadas\ncumple?")
node("n_planta_in", 940, 823, 150, 62, "rounded=1;whiteSpace=wrap;html=1;fillColor=#D6E8FF;strokeColor=#1565C0;fontSize=13;", "Ingresan camiones a planta\n(ticket: N° lote planta,\npeso, fecha, hora)")
node("n_proc", 1135, 823, 150, 62, "rounded=1;whiteSpace=wrap;html=1;fillColor=#D6E8FF;strokeColor=#1565C0;fontSize=13;", "Procesamiento\nmineral en planta")
node("n_paq", 745, 823, 150, 62, "rounded=1;whiteSpace=wrap;html=1;fillColor=#D6E8FF;strokeColor=#1565C0;fontSize=13;", "Muestra representativa\n(paquete de segunda)")
edge("e12", "dis3", "n_analisis", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;", None, [(1510, 482), (1510, 754)])
edge("e13", "n_analisis", "n_lote_candidato", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;", "Ley\ndumpada")
edge("e13b", "n_lote_candidato", "n_cumple", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;")
edge("e14", "n_cumple", "dis1", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;dashed=1;fontStyle=2;strokeColor=#c0400a;fontColor=#c0400a;", "No · se mantiene\nen cancha hasta cumplir", [(1842, 903), (960, 903), (960, 436)])
edge("e16", "n_cumple", "dis4", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;strokeColor=#2E7D32;fontColor=#2E7D32;fontStyle=1;", "Sí", [(1842, 703), (1405, 703)])
edge("e17", "dis6", "n_planta_in", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;")
edge("e18", "n_planta_in", "n_proc", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;")
edge("e19", "n_proc", "n_paq", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;", None, [(1210, 918), (820, 918)])

# ---- Carril GERENCIA (CORREGIDO: se agrega intercambio de leyes / Lab Externo / Lote Planta) ----
node("bg_ger", 10, 948, 1930, 235, "rounded=0;whiteSpace=wrap;html=1;fillColor=#C98A55;strokeColor=#333333;strokeWidth=1.5;fontColor=#ffffff;fontSize=14;", "")
node("hdr_ger", 10, 948, 120, 235, "rounded=0;whiteSpace=wrap;html=1;fillColor=#E06010;strokeColor=#c0400a;fontColor=#ffffff;fontSize=15;fontStyle=1;align=center;verticalAlign=middle;", "MÓDULO\nGERENCIA")
node("n_comparar", 745, 970, 150, 62, "rounded=1;whiteSpace=wrap;html=1;fillColor=#C8F0D0;strokeColor=#2E7D32;fontSize=13;", "Comparar ley Lote\nInterno vs paquete\nde segunda")
node("n_diez", 948, 958, 125, 85, "rhombus;whiteSpace=wrap;html=1;fillColor=#FFD54F;strokeColor=#E06010;fontSize=12.5;fontStyle=1;", "¿Dentro de\n±10%?")
node("n_intercambio", 1130, 960, 185, 82, "rounded=1;whiteSpace=wrap;html=1;fillColor=#C8F0D0;strokeColor=#2E7D32;fontSize=11.5;", "Intercambio de leyes\n(planta v/s productor) +\nLab. Externo → ley\nLOTE PLANTA (paquete 3°)")
node("n_punto", 1345, 958, 125, 85, "rhombus;whiteSpace=wrap;html=1;fillColor=#FFD54F;strokeColor=#E06010;fontSize=12.5;fontStyle=1;", "¿Lote Planta\ndentro de\n0.10%?")
node("n_canje", 1520, 970, 150, 62, "rounded=1;whiteSpace=wrap;html=1;fillColor=#C8F0D0;strokeColor=#2E7D32;fontSize=13;", "Canje paquete de\nsegunda por paquete\nde planta")
node("n_auditoria", 948, 1070, 140, 46, "rounded=1;whiteSpace=wrap;html=1;fillColor=#FFE8D0;strokeColor=#E06010;fontSize=12;fontStyle=2;align=center;", "Auditoría Interna")
edge("e20", "n_paq", "n_comparar", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;")
edge("e21", "n_comparar", "n_diez", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;")
edge("e22", "n_diez", "n_auditoria", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;strokeColor=#c0400a;fontColor=#c0400a;fontStyle=1;", "No")
edge("e23", "n_diez", "n_intercambio", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;strokeColor=#2E7D32;fontColor=#2E7D32;fontStyle=1;", "Sí")
edge("e23b", "n_intercambio", "n_punto", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;")
edge("e24", "n_punto", "n_intercambio", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;dashed=1;fontStyle=2;strokeColor=#c0400a;fontColor=#c0400a;", "No · reintentar arbitraje (¿?)", [(1407, 1120), (1222, 1120)])
edge("e25", "n_punto", "n_canje", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;strokeColor=#2E7D32;fontColor=#2E7D32;fontStyle=1;", "Sí")

# ---- Carril CONTABILIDAD ----
node("bg_cont", 10, 1195, 1930, 130, "rounded=0;whiteSpace=wrap;html=1;fillColor=#C98A55;strokeColor=#333333;strokeWidth=1.5;fontColor=#ffffff;fontSize=14;", "")
node("hdr_cont", 10, 1195, 120, 130, "rounded=0;whiteSpace=wrap;html=1;fillColor=#E06010;strokeColor=#c0400a;fontColor=#ffffff;fontSize=15;fontStyle=1;align=center;verticalAlign=middle;", "CONTABILIDAD")
node("n_liq", 1330, 1217, 150, 62, "rounded=1;whiteSpace=wrap;html=1;fillColor=#F8BBD9;strokeColor=#AD1457;fontSize=13;", "Planta emite\nliquidación de pago")
node("n_dep", 1525, 1217, 150, 62, "rounded=1;whiteSpace=wrap;html=1;fillColor=#F8BBD9;strokeColor=#AD1457;fontSize=13;", "Depósito + factura\n(Contabilidad registra\nel pago)")
node("n_end", 1740, 1225, 65, 45, "ellipse;whiteSpace=wrap;html=1;fillColor=#E06010;strokeColor=#c0400a;fontColor=#ffffff;fontStyle=1;fontSize=13;", "FIN")
edge("e26", "n_canje", "n_liq", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;", None, [(1595, 1150), (1405, 1150)])
edge("e27", "n_liq", "n_dep", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;")
edge("e28", "n_dep", "n_end", "edgeStyle=orthogonalEdgeStyle;fontSize=13;rounded=0;")

node("leyenda", 10, 1342, 1200, 20, "text;html=1;align=left;verticalAlign=middle;fontSize=11;fontColor=#555555;",
     "Flechas punteadas naranjas = loops/reintentos. Flecha gris = creación automática de frente desde Dispatch. Rojo con '¿?' = dirección asumida, pendiente confirmar contra el PDF de Gerencia.")

# ============================================================
# VALIDACION
# ============================================================
errors = []

# 1. edges referencing missing nodes
for e in edges:
    if e["source"] not in nodes:
        errors.append(f"Edge {e['id']}: source '{e['source']}' no existe")
    if e["target"] not in nodes:
        errors.append(f"Edge {e['id']}: target '{e['target']}' no existe")

# 2. overlap check (solo entre nodos "de contenido", no fondos de carril ni headers)
bg_ids = {k for k in nodes if k.startswith("bg_") or k.startswith("hdr_") or k == "titulo" or k == "leyenda"}
content_ids = [k for k in nodes if k not in bg_ids]

def rect(n):
    return (n["x"], n["y"], n["x"] + n["w"], n["y"] + n["h"])

def overlaps(r1, r2):
    return not (r1[2] <= r2[0] or r2[2] <= r1[0] or r1[3] <= r2[1] or r2[3] <= r1[1])

for i in range(len(content_ids)):
    for j in range(i + 1, len(content_ids)):
        a, b = content_ids[i], content_ids[j]
        if overlaps(rect(nodes[a]), rect(nodes[b])):
            errors.append(f"Overlap: {a} y {b}")

# 3. fuera de pagina
PAGE_W = 1970
for k, n in nodes.items():
    if n["x"] + n["w"] > PAGE_W + 5:
        errors.append(f"{k} se sale del ancho de pagina ({n['x']+n['w']} > {PAGE_W})")

if errors:
    print("VALIDACION FALLIDA:")
    for e in errors:
        print(" -", e)
else:
    print("Validacion OK: sin overlaps, sin refs rotas, todo dentro de pagina.")

# ============================================================
# GENERAR XML
# ============================================================
def esc(s):
    return sax.escape(s, {'"': "&quot;"})

cells = []
for id, n in nodes.items():
    val = esc(n["value"]).replace("\n", "&#xa;")
    cells.append(
        f'<mxCell id="{id}" parent="1" style="{n["style"]}" value="{val}" vertex="1">'
        f'<mxGeometry height="{n["h"]}" width="{n["w"]}" x="{n["x"]}" y="{n["y"]}" as="geometry" /></mxCell>'
    )

for e in edges:
    val_attr = f' value="{esc(e["value"])}"' if e["value"] else ""
    if e["points"]:
        pts = "".join(f'<mxPoint x="{px}" y="{py}" />' for px, py in e["points"])
        geom = f'<mxGeometry relative="1" as="geometry"><Array as="points">{pts}</Array></mxGeometry>'
    else:
        geom = '<mxGeometry relative="1" as="geometry"></mxGeometry>'
    cells.append(
        f'<mxCell id="{e["id"]}" edge="1" parent="1" source="{e["source"]}" target="{e["target"]}" '
        f'style="{e["style"]}"{val_attr}>{geom}</mxCell>'
    )

xml = (
    '<mxfile host="app.diagrams.net" agent="Claude AI">\n'
    f'  <diagram id="flujo-dispatch-lab-3h-v{VERSION}" name="Flujo Ingeniería-Dispatch-Laboratorio (v{VERSION})">\n'
    '    <mxGraphModel dx="2200" dy="1400" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1970" pageHeight="1400" math="0" shadow="1">\n'
    '      <root>\n'
    '        <mxCell id="0" />\n'
    '        <mxCell id="1" parent="0" />\n'
    + "".join(cells) +
    '\n      </root>\n'
    '    </mxGraphModel>\n'
    '  </diagram>\n'
    '</mxfile>\n'
)

out_path = os.path.join(SCRIPT_DIR, f"flujo_dispatch_laboratorio_version_{VERSION}.drawio")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(xml)
print("XML escrito en", out_path)

# ============================================================
# PREVIEW PNG
# ============================================================
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as patches

fig, ax = plt.subplots(figsize=(19.7, 14))
ax.set_xlim(0, 1970)
ax.set_ylim(0, 1400)
ax.invert_yaxis()
ax.axis("off")

def fill_of(style):
    for part in style.split(";"):
        if part.startswith("fillColor="):
            return part.split("=", 1)[1]
    return "#ffffff"

def is_diamond(style):
    return style.startswith("rhombus")

def is_ellipse(style):
    return style.startswith("ellipse")

for id, n in nodes.items():
    x, y, w, h = n["x"], n["y"], n["w"], n["h"]
    color = fill_of(n["style"])
    if is_diamond(n["style"]):
        cx, cy = x + w / 2, y + h / 2
        poly = patches.Polygon([(cx, y), (x + w, cy), (cx, y + h), (x, cy)], closed=True, facecolor=color, edgecolor="black", linewidth=0.8)
        ax.add_patch(poly)
    elif is_ellipse(n["style"]):
        ell = patches.Ellipse((x + w / 2, y + h / 2), w, h, facecolor=color, edgecolor="black", linewidth=0.8)
        ax.add_patch(ell)
    else:
        rect_p = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=4", facecolor=color, edgecolor="black", linewidth=0.8)
        ax.add_patch(rect_p)
    fontsize = 6.5
    ax.text(x + w / 2, y + h / 2, n["value"], ha="center", va="center", fontsize=fontsize, wrap=True)

for e in edges:
    s, t = nodes[e["source"]], nodes[e["target"]]
    sx, sy = s["x"] + s["w"] / 2, s["y"] + s["h"] / 2
    tx, ty = t["x"] + t["w"] / 2, t["y"] + t["h"] / 2
    pts = [(sx, sy)] + (e["points"] or []) + [(tx, ty)]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    color = "black"
    for part in e["style"].split(";"):
        if part.startswith("strokeColor="):
            color = part.split("=", 1)[1]
    ax.plot(xs, ys, color=color, linewidth=1, linestyle="--" if "dashed=1" in e["style"] else "-")
    if e["value"]:
        mx, my = xs[len(xs) // 2], ys[len(xs) // 2]
        ax.text(mx, my, e["value"], fontsize=6, color=color)

plt.tight_layout()
png_path = os.path.join(SCRIPT_DIR, f"preview_v{VERSION}.png")
plt.savefig(png_path, dpi=150)
print("PNG escrito en", png_path)

