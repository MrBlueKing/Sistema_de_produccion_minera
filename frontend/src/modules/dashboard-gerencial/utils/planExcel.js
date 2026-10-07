import * as XLSX from 'xlsx';
import { ACTIVIDADES, ACTIVIDAD, TIPOS_DIA, MESES, diaSemana, etiquetaTurno } from './planCalculos';

// Plantilla estandarizada del programa de producción. La genera el sistema (días,
// turnos y frentes ya puestos) y al subirla se valida todo antes de cargarla en
// pantalla: así no aparecen columnas corridas, turnos inventados ("TM") ni
// frentes escritos distinto, que eran los problemas del Excel a mano.

const HOJA_PLAN = 'Plan';
const HOJA_DIAS = 'Dias';
const HOJA_SUP = 'Supuestos';
const HOJA_LISTAS = 'Listas';

const pad = (n) => String(n).padStart(2, '0');
const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const clave = (s) => sinTildes(s).toUpperCase().replace(/\s+/g, '');

// Colores de la plantilla (ARGB). Mismo criterio que la grilla en pantalla:
// mineral ámbar, estéril pizarra, días que no se trabaja en gris.
const COL = {
  titulo: 'FF0C4A6E', tituloTxt: 'FFFFFFFF', sub: 'FFE0F2FE', cab: 'FFF1F5F9', cabTxt: 'FF334155',
  finde: 'FFE5E7EB', libre: 'FFD1D5DB', borde: 'FFCBD5E1', bordeDia: 'FF64748B',
  total: 'FFFEF3C7', nota: 'FF64748B', ref: 'FF0369A1',
};
const relleno = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const bordes = (izq = COL.borde) => ({
  top: { style: 'thin', color: { argb: COL.borde } },
  bottom: { style: 'thin', color: { argb: COL.borde } },
  left: { style: izq === COL.borde ? 'thin' : 'medium', color: { argb: izq } },
  right: { style: 'thin', color: { argb: COL.borde } },
});
const FILAS_EXTRA = 15; // filas vacías con listas desplegables para agregar frentes en Excel
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_SEMANA_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function colLetra(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function estilarCabecera(row) {
  row.height = 20;
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: COL.tituloTxt } };
    c.fill = relleno(COL.titulo);
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });
}

const numOVacio = (v) => (v === '' || v == null || Number.isNaN(+v) ? null : +v);

/**
 * Genera la plantilla (ExcelJS: colores, listas desplegables y paneles fijos —
 * SheetJS gratuito no escribe estilos). ExcelJS se carga solo al descargar,
 * para no sumar peso a la página. Devuelve el ArrayBuffer del .xlsx.
 */
export async function generarPlantilla({ faena, anio, mes, turnos, abreviaturas = {}, dias, frentes, frentesDisponibles, tonPorDisparo, tronadurasPorPerforista, referencia }) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Producción M3H';
  const libre = new Set(dias.filter((d) => d.tipo === 'libre').map((d) => d.dia));
  const primeraCol = 4; // D: después de Frente, Actividad, Ley
  // Columnas: cada día con SUS turnos. Un día sin turnos lleva una columna
  // "DD Libre" para que se vea (al subir se ignora).
  const cols = [];
  dias.forEach((d) => {
    const ts = d.turnos?.length ? d.turnos : [null];
    ts.forEach((t, j) => cols.push({ c: primeraCol + cols.length, dia: d.dia, turno: t, primero: j === 0, n: ts.length }));
  });
  const colInfo = new Map(cols.map((x) => [x.c, x]));
  const ultimaCol = primeraCol + cols.length - 1;
  const colTotal = ultimaCol + 1;
  const fondoDia = (d) => {
    const ds = diaSemana(anio, mes, d);
    return libre.has(d) ? COL.libre : ds === 0 || ds === 6 ? COL.finde : null;
  };
  const inicioDia = (c) => !!colInfo.get(c)?.primero;
  // En la plantilla se usa la abreviatura de Configuración General (TC, TL), TN para Noche
  const etiqueta = (t) => (t === 'Madrugada' ? t : etiquetaTurno(t, abreviaturas));

  // ---------- Hoja Plan ----------
  const ws = wb.addWorksheet(HOJA_PLAN, {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 4, zoomScale: 90 }],
    properties: { tabColor: { argb: COL.titulo } },
  });
  ws.getColumn(1).width = 24;
  ws.getColumn(2).width = 15;
  ws.getColumn(3).width = 10;
  for (let c = primeraCol; c <= ultimaCol; c++) ws.getColumn(c).width = 5.5;
  ws.getColumn(colTotal).width = 10;

  // Fila 1: título
  ws.mergeCells(1, 1, 1, 15);
  const titulo = ws.getCell(1, 1);
  titulo.value = `PROGRAMA DE PRODUCCIÓN · ${String(faena).toUpperCase()} · ${MESES[mes - 1].toUpperCase()} ${anio}`;
  titulo.font = { bold: true, size: 14, color: { argb: COL.tituloTxt } };
  titulo.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 28;
  for (let c = 1; c <= colTotal; c++) ws.getCell(1, c).fill = relleno(COL.titulo);

  // Fila 2: faena / año / mes (el sistema los verifica al subir) + instrucción
  [['Faena', faena], ['Año', anio], ['Mes', mes]].forEach(([k, v], i) => {
    const a = ws.getCell(2, 1 + i * 2);
    a.value = k;
    a.font = { bold: true, color: { argb: COL.cabTxt } };
    const b = ws.getCell(2, 2 + i * 2);
    b.value = v;
    b.font = { bold: true };
    b.alignment = { horizontal: 'left' };
  });
  ws.mergeCells(2, 7, 2, 40);
  const nota = ws.getCell(2, 7);
  nota.value = 'Una fila por frente y actividad. En cada celda, las toneladas de ese turno (Fortificación: una X). Elige frente y actividad de la lista. No muevas ni renombres columnas.';
  nota.font = { italic: true, size: 9, color: { argb: COL.nota } };
  nota.alignment = { vertical: 'middle' };
  for (let c = 1; c <= colTotal; c++) ws.getCell(2, c).fill = relleno(COL.sub);

  // Filas 3-4: día (combinado sobre sus turnos) y encabezados "01 AM" que se leen al subir
  ['Frente', 'Actividad', 'Ley esp. %'].forEach((h, i) => {
    ws.mergeCells(3, i + 1, 4, i + 1);
    ws.getCell(3, i + 1).value = h;
  });
  cols.forEach(({ c, dia, turno, primero, n }) => {
    if (primero) {
      if (n > 1) ws.mergeCells(3, c, 3, c + n - 1);
      ws.getCell(3, c).value = `${DIAS_SEMANA[diaSemana(anio, mes, dia)]} ${pad(dia)}`;
    }
    ws.getCell(4, c).value = `${pad(dia)} ${turno ? etiqueta(turno) : 'Libre'}`;
  });
  ws.mergeCells(3, colTotal, 4, colTotal);
  ws.getCell(3, colTotal).value = 'Total';
  [3, 4].forEach((r) => {
    ws.getRow(r).height = r === 3 ? 18 : 30;
    for (let c = 1; c <= colTotal; c++) {
      const cell = ws.getCell(r, c);
      const esTurno = r === 4 && c >= primeraCol && c <= ultimaCol;
      cell.font = { bold: !esTurno, size: esTurno ? 7 : 10, color: { argb: COL.cabTxt } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      const dia = colInfo.get(c)?.dia ?? null;
      cell.fill = relleno((dia && fondoDia(dia)) || COL.cab);
      cell.border = bordes(inicioDia(c) ? COL.bordeDia : COL.borde);
    }
  });

  // Filas de frentes (las del plan + vacías para agregar)
  const lista = [...frentes];
  for (let i = 0; i < FILAS_EXTRA; i++) lista.push({ frente: '', actividad: null, ley_esperada: null, celdas: [] });
  const fila0 = 5;
  const filaFin = fila0 + lista.length - 1;
  lista.forEach((f, i) => {
    const r = fila0 + i;
    const mapa = new Map((f.celdas || []).map((c) => [`${c.dia}|${c.turno}`, c.toneladas]));
    const act = ACTIVIDAD[f.actividad];
    const color = !act ? 'FF111827' : act.sinToneladas ? 'FF6B7280' : act.mineral ? 'FFB45309' : 'FF475569';

    ws.getCell(r, 1).value = f.frente || null;
    ws.getCell(r, 1).font = { bold: true };
    ws.getCell(r, 2).value = act ? act.label : null;
    ws.getCell(r, 2).font = { color: { argb: color } };
    ws.getCell(r, 3).value = numOVacio(f.ley_esperada);
    ws.getCell(r, 3).numFmt = '0.00';
    [1, 2, 3].forEach((c) => { ws.getCell(r, c).border = bordes(); });

    cols.forEach(({ c, dia, turno, primero }) => {
      const cell = ws.getCell(r, c);
      cell.border = bordes(primero ? COL.bordeDia : COL.borde);
      const fondo = fondoDia(dia);
      if (fondo) cell.fill = relleno(fondo);
      if (!turno) return;
      const k = `${dia}|${turno}`;
      if (mapa.has(k)) cell.value = act?.sinToneladas ? 'X' : numOVacio(mapa.get(k));
      cell.font = { color: { argb: color }, bold: mapa.has(k) };
      cell.alignment = { horizontal: 'center' };
      cell.numFmt = '#,##0.##';
    });

    const tot = ws.getCell(r, colTotal);
    tot.value = { formula: `SUM(${colLetra(primeraCol)}${r}:${colLetra(ultimaCol)}${r})` };
    tot.numFmt = '#,##0;-#,##0;""';
    tot.font = { bold: true };
    tot.fill = relleno(COL.cab);
    tot.border = bordes();

    // Listas desplegables: Excel no deja escribir algo fuera de la lista
    ws.getCell(r, 1).dataValidation = {
      type: 'list', allowBlank: true, formulae: [`${HOJA_LISTAS}!$A$2:$A$${Math.max(frentesDisponibles.length, 1) + 1}`],
      showErrorMessage: true, errorTitle: 'Frente', error: 'Elige un frente de la lista (hoja Listas).',
    };
    ws.getCell(r, 2).dataValidation = {
      type: 'list', allowBlank: true, formulae: [`"${ACTIVIDADES.map((a) => a.label).join(',')}"`],
      showErrorMessage: true, errorTitle: 'Actividad', error: 'Preparación, Cámara, Desarrollo o Fortificación.',
    };
    ws.getCell(r, 3).dataValidation = {
      type: 'decimal', allowBlank: true, operator: 'between', formulae: [0, 100],
      showErrorMessage: true, errorTitle: 'Ley', error: 'Ley en porcentaje, ej. 1,51',
    };
  });

  // Fila de totales por turno
  const rt = filaFin + 1;
  ws.mergeCells(rt, 1, rt, 3);
  ws.getCell(rt, 1).value = 'TOTAL';
  for (let c = primeraCol; c <= colTotal; c++) {
    const cell = ws.getCell(rt, c);
    cell.value = { formula: `SUM(${colLetra(c)}${fila0}:${colLetra(c)}${filaFin})` };
    cell.numFmt = '#,##0;-#,##0;""';
    cell.alignment = { horizontal: 'center' };
  }
  for (let c = 1; c <= colTotal; c++) {
    const cell = ws.getCell(rt, c);
    cell.font = { bold: true, size: c >= primeraCol && c <= ultimaCol ? 8 : 10 };
    cell.fill = relleno(COL.total);
    cell.border = bordes(inicioDia(c) ? COL.bordeDia : COL.borde);
  }

  // ---------- Hoja Dias ----------
  const wd = wb.addWorksheet(HOJA_DIAS, { views: [{ state: 'frozen', ySplit: 1 }], properties: { tabColor: { argb: 'FF0369A1' } } });
  wd.columns = [
    { header: 'Día', key: 'dia', width: 6 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Día semana', key: 'sem', width: 12 },
    { header: 'Tipo', key: 'tipo', width: 16 },
    { header: 'Perforistas', key: 'perf', width: 12 },
  ];
  const tipoLabel = Object.fromEntries(TIPOS_DIA.map((x) => [x.id, x.label]));
  dias.forEach((d) => {
    const row = wd.addRow({
      dia: d.dia,
      fecha: `${pad(d.dia)}-${pad(mes)}-${anio}`,
      sem: DIAS_SEMANA_LARGO[diaSemana(anio, mes, d.dia)],
      tipo: tipoLabel[d.tipo] ?? 'Hábil',
      perf: d.tipo === 'libre' ? 0 : numOVacio(d.perforistas) ?? 0,
    });
    const fondo = fondoDia(d.dia);
    row.eachCell({ includeEmpty: true }, (c) => {
      c.border = bordes();
      if (fondo) c.fill = relleno(fondo);
    });
    row.getCell('tipo').dataValidation = {
      type: 'list', allowBlank: false, formulae: [`"${TIPOS_DIA.map((x) => x.label).join(',')}"`],
      showErrorMessage: true, errorTitle: 'Tipo de día', error: 'Hábil o No se trabaja.',
    };
    row.getCell('perf').dataValidation = {
      type: 'decimal', allowBlank: true, operator: 'between', formulae: [0, 100],
      showErrorMessage: true, errorTitle: 'Perforistas', error: 'Número de perforistas.',
    };
    row.getCell('dia').alignment = { horizontal: 'center' };
    row.getCell('perf').alignment = { horizontal: 'center' };
  });
  estilarCabecera(wd.getRow(1));

  // ---------- Hoja Supuestos ----------
  const wsS = wb.addWorksheet(HOJA_SUP, { properties: { tabColor: { argb: 'FFB45309' } } });
  wsS.columns = [{ width: 34 }, { width: 10 }, { width: 20 }, { width: 58 }];
  wsS.addRow(['Supuesto', 'Valor', 'Mes anterior (real)', 'Cómo se usa']);
  wsS.addRow(['Ton por disparo', numOVacio(tonPorDisparo), referencia?.ton_por_disparo ?? null, 'Meta = Σ perforistas del día × tronaduras por perforista × ton por disparo']);
  wsS.addRow(['Tronaduras por perforista al día', numOVacio(tronadurasPorPerforista), referencia?.tronaduras_por_perforista ?? null, 'Cada perforista hace este número de tronaduras al día (el "× 2" del Excel anterior)']);
  estilarCabecera(wsS.getRow(1));
  [2, 3].forEach((r) => {
    for (let c = 1; c <= 4; c++) wsS.getCell(r, c).border = bordes();
    wsS.getCell(r, 2).numFmt = '0.00';
    wsS.getCell(r, 2).font = { bold: true };
    wsS.getCell(r, 3).numFmt = '0.00';
    wsS.getCell(r, 3).font = { color: { argb: COL.ref } };
    wsS.getCell(r, 4).font = { italic: true, size: 9, color: { argb: COL.nota } };
  });
  wsS.getCell(5, 1).value = 'Las rutas de transporte se editan en la pantalla (pestaña Supuestos y capacidad).';
  wsS.getCell(5, 1).font = { italic: true, size: 9, color: { argb: COL.nota } };

  // ---------- Hoja Listas ----------
  const wl = wb.addWorksheet(HOJA_LISTAS, { views: [{ state: 'frozen', ySplit: 1 }], properties: { tabColor: { argb: 'FF94A3B8' } } });
  wl.columns = [{ width: 26 }, { width: 16 }, { width: 16 }, { width: 10 }];
  wl.addRow(['Frentes válidos', 'Actividades', 'Tipos de día', 'Turnos']);
  const largo = Math.max(frentesDisponibles.length, ACTIVIDADES.length, TIPOS_DIA.length, turnos.length);
  for (let i = 0; i < largo; i++) {
    wl.addRow([frentesDisponibles[i]?.codigo ?? null, ACTIVIDADES[i]?.label ?? null, TIPOS_DIA[i]?.label ?? null, turnos[i] ? etiqueta(turnos[i]) : null]);
  }
  estilarCabecera(wl.getRow(1));

  return wb.xlsx.writeBuffer();
}

export async function descargarPlantilla(opciones) {
  const buf = await generarPlantilla(opciones);
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `Plan_${opciones.faena}_${MESES[opciones.mes - 1]}_${opciones.anio}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const txt = String(v).trim();
  // "1.234,5" (formato chileno) o "18.5" / "18,5"
  const n = Number(txt.includes(',') ? txt.replace(/\./g, '').replace(',', '.') : txt);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Lee la plantilla y devuelve lo que se cargaría en pantalla + los problemas.
 * nivel 'bloquea' = no se puede cargar; 'aviso' = se carga igual.
 */
export async function leerPlantilla(file, { anio, mes, turnos, abreviaturas = {}, nDias, frentesDisponibles }) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const problemas = [];
  const bloquea = (msg) => problemas.push({ nivel: 'bloquea', msg });
  const aviso = (msg) => problemas.push({ nivel: 'aviso', msg });

  const ws = wb.Sheets[HOJA_PLAN];
  if (!ws) {
    bloquea(`El archivo no tiene la hoja "${HOJA_PLAN}". Usa la plantilla que descarga el sistema.`);
    return { problemas };
  }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  const iCab = rows.findIndex((r) => clave(r?.[0]) === 'FRENTE');
  if (iCab < 0) {
    bloquea('No se encontró la fila de encabezados (la que empieza con "Frente").');
    return { problemas };
  }

  // Año y mes de la plantilla (celda siguiente a "Año" / "Mes", arriba de los encabezados)
  const meta = (txt) => {
    for (const r of rows.slice(0, iCab)) {
      const i = (r || []).findIndex((v) => clave(v) === txt);
      if (i >= 0) return r[i + 1];
    }
    return null;
  };
  const metaAnio = meta('ANO');
  const metaMes = meta('MES');
  if (metaAnio != null && metaMes != null && (+metaAnio !== anio || +metaMes !== mes)) {
    bloquea(`La plantilla es de ${MESES[+metaMes - 1] ?? metaMes} ${metaAnio} y estás cargando ${MESES[mes - 1]} ${anio}.`);
  }

  // Encabezados "01 AM": en la misma fila de "Frente" (plantilla simple) o en la
  // siguiente (plantilla con el día combinado arriba).
  const esDiaTurno = (v) => /^\d{1,2}\s+\S/.test(String(v ?? '').trim());
  const iTurnos = (rows[iCab] || []).some(esDiaTurno) ? iCab : iCab + 1;

  // Columnas de día/turno: "01 AM", "01 PM", "01 Noche"…
  // Se acepta el nombre (Turno corto) o la abreviatura (TC); TN = Noche
  const turnoPorClave = Object.fromEntries(turnos.flatMap((t) => [[clave(t), t], ...(abreviaturas[t] ? [[clave(abreviaturas[t]), t]] : [])]));
  turnoPorClave.TN = turnoPorClave.TN ?? turnos.find((t) => clave(t) === 'NOCHE');
  const columnas = [];
  (rows[iTurnos] || []).forEach((h, c) => {
    if (c < 3 || h == null || h === '' || clave(h) === 'TOTAL' || /^\d{1,2}\s+libre$/i.test(String(h).trim())) return;
    const m = String(h).trim().match(/^(\d{1,2})\s+(.+)$/);
    const turno = m && turnoPorClave[clave(m[2])];
    if (!m || !turno || +m[1] < 1 || +m[1] > nDias) {
      bloquea(`La columna "${h}" no es un día y turno válido (se espera, por ejemplo, "05 AM").`);
      return;
    }
    columnas.push({ c, dia: +m[1], turno });
  });

  // Turnos de cada día = las columnas que trae la plantilla para ese día
  const turnosPorDia = {};
  columnas.forEach(({ dia, turno }) => {
    turnosPorDia[dia] = turnosPorDia[dia] || [];
    if (!turnosPorDia[dia].includes(turno)) turnosPorDia[dia].push(turno);
  });

  const porCodigo = new Map(frentesDisponibles.map((f) => [clave(f.codigo), f]));
  const porActividad = new Map(ACTIVIDADES.flatMap((a) => [[clave(a.label), a.id], [clave(a.id), a.id]]));
  const frentes = [];
  const vistos = new Set();
  let leyEnFraccion = false;

  for (let i = iTurnos + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const n = i + 1; // fila como la ve Excel
    const codigo = r[0] == null ? '' : String(r[0]).trim();
    if (clave(codigo) === 'TOTAL') continue;
    const tieneDatos = columnas.some(({ c }) => r[c] != null && r[c] !== '');
    if (!codigo && !tieneDatos) continue;
    if (!codigo) { bloquea(`Fila ${n}: tiene toneladas pero no dice el frente.`); continue; }

    const frente = porCodigo.get(clave(codigo));
    if (!frente) { bloquea(`Fila ${n}: el frente "${codigo}" no existe en la faena (o está inactivo). Revisa la hoja "${HOJA_LISTAS}".`); continue; }
    if (clave(codigo) === clave(frente.codigo) && codigo !== frente.codigo) {
      aviso(`Fila ${n}: "${codigo}" se leyó como ${frente.codigo}.`);
    }

    const actividad = porActividad.get(clave(r[1]));
    if (!actividad) { bloquea(`Fila ${n}: la actividad "${r[1] ?? ''}" no es válida (Preparación, Cámara, Desarrollo o Fortificación).`); continue; }

    const k = `${frente.id}|${actividad}`;
    if (vistos.has(k)) { bloquea(`Fila ${n}: ${frente.codigo} está dos veces como ${ACTIVIDAD[actividad].label}.`); continue; }
    vistos.add(k);

    let ley = num(r[2]);
    if (Number.isNaN(ley)) { bloquea(`Fila ${n}: la ley "${r[2]}" no es un número.`); ley = null; }
    if (ley != null && ley > 0 && ley < 0.1) { ley = +(ley * 100).toFixed(3); leyEnFraccion = true; }

    const celdas = [];
    columnas.forEach(({ c, dia, turno }) => {
      const v = r[c];
      if (v == null || v === '') return;
      if (actividad === 'fortificacion') { celdas.push({ dia, turno, toneladas: null }); return; }
      const t = num(v);
      if (Number.isNaN(t) || t < 0) { bloquea(`Fila ${n}, ${pad(dia)} ${turno}: "${v}" no es un tonelaje válido.`); return; }
      if (t > 0) celdas.push({ dia, turno, toneladas: t });
    });

    frentes.push({ id_frente_trabajo: frente.id, frente: frente.codigo, actividad, ley_esperada: ley, celdas });
  }
  if (leyEnFraccion) aviso('Algunas leyes venían como fracción (ej. 0,0151) y se pasaron a porcentaje (1,51 %).');
  if (!frentes.length) bloquea('La hoja Plan no tiene ningún frente con datos.');

  // Días: tipo y perforistas (opcional: si no está la hoja se dejan los de pantalla)
  let dias = null;
  const wsD = wb.Sheets[HOJA_DIAS];
  if (wsD) {
    const porTipo = new Map(TIPOS_DIA.flatMap((t) => [[clave(t.label), t.id], [clave(t.id), t.id], [clave(t.corto), t.id]]));
    porTipo.set('LIBRE', 'libre');
    // Plantillas viejas: turno corto / largo como tipo de día = día hábil
    ['TURNOCORTO', 'TURNOLARGO', 'TC', 'TL'].forEach((k) => porTipo.set(k, 'habil'));
    dias = [];
    XLSX.utils.sheet_to_json(wsD, { header: 1, defval: null, raw: true }).slice(1).forEach((r, i) => {
      const dia = +r?.[0];
      if (!dia) return;
      if (dia < 1 || dia > nDias) { bloquea(`Hoja Dias, fila ${i + 2}: el día ${r[0]} no existe en el mes.`); return; }
      const tipo = porTipo.get(clave(r[3])) ?? (r[3] == null || r[3] === '' ? 'habil' : null);
      if (!tipo) { bloquea(`Hoja Dias, día ${dia}: el tipo "${r[3]}" no es válido (Hábil o No se trabaja).`); return; }
      const perf = num(r[4]);
      if (Number.isNaN(perf) || (perf != null && perf < 0)) { bloquea(`Hoja Dias, día ${dia}: perforistas "${r[4]}" no es un número.`); return; }
      if (perf != null && perf % 1) aviso(`Hoja Dias, día ${dia}: ${perf} perforistas no es un número entero.`);
      dias.push({ dia, tipo, perforistas: perf ?? 0 });
    });
    if (dias.length !== nDias) aviso(`La hoja Dias trae ${dias.length} de ${nDias} días; los que faltan quedan como estaban.`);
  }

  if (dias) {
    const libres = new Set(dias.filter((d) => d.tipo === 'libre').map((d) => d.dia));
    const conTon = [...new Set(frentes.flatMap((f) => f.celdas.filter((c) => c.toneladas > 0 && libres.has(c.dia)).map((c) => c.dia)))].sort((a, b) => a - b);
    if (conTon.length) aviso(`Hay toneladas en días marcados "No se trabaja": ${conTon.join(', ')}.`);
  }

  let supuestos = null;
  const wsS = wb.Sheets[HOJA_SUP];
  if (wsS) {
    const s = XLSX.utils.sheet_to_json(wsS, { header: 1, defval: null, raw: true });
    const valor = (txt) => {
      const r = s.find((x) => clave(x?.[0]).startsWith(clave(txt)));
      const v = num(r?.[1]);
      return Number.isNaN(v) ? null : v;
    };
    supuestos = { ton_por_disparo: valor('Ton por disparo'), tronaduras_por_perforista: valor('Tronaduras por perforista') };
  }

  return { problemas, frentes, dias, supuestos, turnosPorDia };
}
