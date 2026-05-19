import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  HiArrowUpTray, HiCheckCircle, HiExclamationTriangle,
  HiArrowLeft, HiArrowRight, HiDocumentArrowUp, HiCheckBadge,
  HiTruck, HiChevronRight, HiChevronDown, HiBeaker, HiCalendar, HiSparkles,
  HiCircleStack,
} from 'react-icons/hi2';
import { useFaena } from '../../../contexts/FaenaContext';
import dispatchService from '../services/dispatch';

const HOJA_MEZCLAS = 'Mezcla';
const HOJA_DB      = 'DB';
const DB_FILA_INICIO = 4; // 1-based; row index 3 (0-based)
const COL_DB_DEFAULT = {
  punto: 2, tipo: 3, numero_dumpada: 4, acopios: 5, jornada: 6,
  fecha: 7, ton: 8, ley: 9, ley_cup: 10, certificado: 11, ley_visual: 13, rango: 14,
};

// Detecta columnas de la hoja DB por nombre de header para tolerar columnas extra
// (ej. Catemu tiene "Ley Soluble" entre ley_cup y certificado)
function detectarColsDB(headerRow) {
  const cols = { ...COL_DB_DEFAULT };
  const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, '');
  for (let c = 8; c < headerRow.length; c++) {
    const v = norm(headerRow[c]);
    if (v.includes('certif') || v.includes('certidicado')) cols.certificado = c;
    else if (v.includes('leyvisual') || v === 'leyvis')    cols.ley_visual  = c;
    else if (v === 'rango')                                 cols.rango       = c;
  }
  return cols;
}
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const STEPS = ['Subir Excel', 'Revisar', 'Resultado'];

function parseExcelTime(val) {
  if (!val) return null;
  if (val instanceof Date) {
    const h = String(val.getHours()).padStart(2, '0');
    const m = String(val.getMinutes()).padStart(2, '0');
    return `${h}:${m}:00`;
  }
  if (typeof val === 'number') {
    const totalMin = Math.round(val * 24 * 60);
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  }
  const s = String(val).trim();
  return s || null;
}

function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  if (typeof val === 'string') {
    const match = val.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    return val.slice(0, 10);
  }
  return null;
}

function safeLey(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'object') return null;
  const n = parseFloat(v);
  if (isNaN(n)) return null;
  const pct = n < 1 ? n * 100 : n;
  return Math.round(pct * 1000) / 1000;
}

function clasificarRVal(val) {
  const trimmed = String(val).trim().replace(/[\r\n]+/g, ' ');
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed))
    return parseInt(trimmed) > 999 ? { tipo: 'numero_lote', valor: trimmed } : { tipo: 'desconocido', valor: trimmed };
  if (!trimmed.includes(' ') && /[A-Za-z]/.test(trimmed) && /\d/.test(trimmed))
    return { tipo: 'numero_lote', valor: trimmed };
  return { tipo: 'empresa', valor: trimmed };
}

function detectarMapeoLeyes(rows) {
  let esCatemu = false;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    for (let c = 11; c <= 15; c++) {
      const v = r[c] != null ? String(r[c]).trim().toLowerCase() : '';
      if (v.includes('soluble') || v.includes('insoluble')) { esCatemu = true; break; }
    }
    if (esCatemu) break;
  }
  if (!esCatemu) return { ley_dump: 11, ley_visual: 12, ley_lote: 13 };
  let sumInsol = 0, sumSol = 0;
  for (const r of rows) {
    const hStr = r[7] != null ? String(r[7]).trim() : '';
    if (!hStr || isNaN(parseFloat(hStr))) continue;
    const insol = typeof r[11] === 'number' ? r[11] : parseFloat(r[11] || 0);
    const sol   = typeof r[12] === 'number' ? r[12] : parseFloat(r[12] || 0);
    if (!isNaN(insol) && insol > 0) sumInsol += insol;
    if (!isNaN(sol)   && sol   > 0) sumSol   += sol;
  }
  return sumInsol >= sumSol
    ? { ley_dump: 11, ley_lote: 13, ley_visual: 14 }
    : { ley_dump: 12, ley_lote: 13, ley_visual: 15 };
}

function esCabeceraMezclaExcel(colH, colI) {
  if (colH != null && String(colH).trim() !== '') return false;
  const iStr = colI != null ? String(colI).trim() : '';
  return iStr !== '' && isNaN(parseFloat(iStr)) && !iStr.includes(' ') && iStr.length <= 10;
}

function esFilaRemanente(colH, colI) {
  if (colH != null && String(colH).trim() !== '') return false;
  if (colI == null) return false;
  if (typeof colI === 'number') return colI > 0;
  const iStr = String(colI).trim();
  return !isNaN(parseFloat(iStr)) && parseFloat(iStr) > 0 && /^\d+(\.\d+)?$/.test(iStr);
}

function parsearMezclasExcel(rows) {
  const leyCOL = detectarMapeoLeyes(rows);
  const map = {};
  let codigoActual = null;
  for (const r of rows) {
    const colH = r[7], colI = r[8], colK = r[10];
    if (esCabeceraMezclaExcel(colH, colI)) {
      codigoActual = String(colI).trim();
      if (!map[codigoActual]) map[codigoActual] = { dumpadas: [], remanentes: [] };
      continue;
    }
    if (!codigoActual) continue;
    if (esFilaRemanente(colH, colI)) {
      const numeroPaladas = typeof colI === 'number' ? colI : parseInt(String(colI).trim());
      const ton = typeof colK === 'number' ? colK : parseFloat(String(colK ?? '').replace(',', '.'));
      if (!isNaN(ton) && ton > 0) {
        map[codigoActual].remanentes.push({
          numero_paladas: numeroPaladas,
          origen:    r[9] != null ? String(r[9]).trim() : '',
          toneladas: ton,
          ley_dump:   safeLey(r[leyCOL.ley_dump]),
          ley_visual: safeLey(r[leyCOL.ley_visual]),
          ley_lote:   safeLey(r[leyCOL.ley_lote]),
        });
      }
      continue;
    }
    const hStr = colH != null ? String(colH).trim() : '';
    if (!hStr || isNaN(parseFloat(hStr))) continue;
    const ton = typeof colK === 'number' ? colK : parseFloat(String(colK ?? '').replace(',', '.'));
    if (isNaN(ton) || ton <= 0) continue;
    map[codigoActual].dumpadas.push({
      numero_dumpada: hStr,
      origen:    r[9] != null ? String(r[9]).trim() : '',
      toneladas: ton,
      ley_dump:   safeLey(r[leyCOL.ley_dump]),
      ley_visual: safeLey(r[leyCOL.ley_visual]),
      ley_lote:   safeLey(r[leyCOL.ley_lote]),
    });
  }
  return map;
}

// Detecta en qué columna está el header de lotes escaneando un rango amplio.
// También detecta dinámicamente la columna "Origen" (mezcla_codigo) y "Ley Lab Camion"
// para tolerar diferencias entre faenas (ej. Catemu tiene "Consumo Ácido" que Cabildo no tiene).
function detectarColsLotes(r) {
  const SCAN_MIN = 13, SCAN_MAX = 27;
  let nLoteCol = null, camCol = null, tipo = null;

  // Trigger 1: celda exactamente "N°Lote"
  for (let c = SCAN_MIN; c <= SCAN_MAX; c++) {
    if (r[c] != null && String(r[c]).trim() === 'N°Lote') {
      nLoteCol = c; camCol = c + 1; tipo = 'nlote'; break;
    }
  }
  // Trigger 2: celda exactamente "Camionada" (case-insensitive)
  if (!tipo) {
    for (let c = SCAN_MIN; c <= SCAN_MAX; c++) {
      if (r[c] != null && String(r[c]).trim().toLowerCase() === 'camionada') {
        nLoteCol = c - 1; camCol = c; tipo = 'camionada'; break;
      }
    }
  }
  if (!tipo) return null;

  // Detectar columna "Origen" en el mismo header
  let origenCol = camCol + 10; // fallback Catemu (tiene Consumo Ácido antes)
  for (let c = camCol + 8; c <= camCol + 16; c++) {
    if (r[c] != null && String(r[c]).trim().toLowerCase() === 'origen') {
      origenCol = c; break;
    }
  }

  // "Ley Lab Camion" → primera celda con "ley lab" después de Origen
  let leyLabCol = origenCol + 1; // fallback
  for (let c = origenCol + 1; c <= camCol + 16; c++) {
    if (r[c] != null && String(r[c]).trim().toLowerCase().includes('ley lab')) {
      leyLabCol = c; break;
    }
  }

  return { tipo, nLoteCol, camCol, origenCol, leyLabCol };
}

function parsearLotes(rows) {
  const lotes = [];
  let actual = null;
  // Posición por defecto (formato estándar R/S)
  let nLoteCol  = 17;
  let camCol    = 18;
  let origenCol = 28; // camCol + 10 por defecto
  let leyLabCol = 29; // camCol + 11 por defecto

  const toISO = (v) => { if (!v) return null; if (v instanceof Date) return v.toISOString(); return String(v); };

  for (let i = 0; i < rows.length; i++) {
    const r     = rows[i];
    const found = detectarColsLotes(r);

    if (found) {
      // Actualiza las posiciones detectadas para este bloque
      nLoteCol  = found.nLoteCol;
      camCol    = found.camCol;
      origenCol = found.origenCol;
      leyLabCol = found.leyLabCol;

      if (found.tipo === 'nlote') {
        // Trigger 1: busca planta en las filas previas de la misma columna
        if (actual) lotes.push(actual);
        let plantaDestino = null;
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
          const prev = rows[j][nLoteCol];
          if (prev != null) {
            const s = String(prev).trim().replace(/[\r\n]+/g, ' ');
            if (s && s !== 'N°Lote' && s !== '-' && !/^\d+$/.test(s)) { plantaDestino = s; break; }
          }
        }
        actual = { numero_lote: null, empresa_nombre: null, planta_destino: plantaDestino, camionadas: [], _rVals: [], _sinPeso: 0 };
      } else {
        // Trigger 2: la empresa puede venir en la celda nLoteCol de la misma fila header
        if (actual) lotes.push(actual);
        const empresaHeader = r[nLoteCol] != null ? String(r[nLoteCol]).trim() : null;
        actual = { numero_lote: null, empresa_nombre: empresaHeader || null, planta_destino: null, camionadas: [], _rVals: [], _sinPeso: 0 };
      }
      continue;
    }

    if (!actual) continue;

    const colR   = r[nLoteCol];
    const colCam = r[camCol];
    const numCam = typeof colCam === 'number' && Number.isInteger(colCam) && colCam > 0
      ? colCam : (typeof colCam === 'string' && /^\d+$/.test(colCam.trim()) ? parseInt(colCam) : null);
    if (!numCam) continue;

    if (colR != null) {
      const rStr = String(colR).trim().replace(/[\r\n]+/g, ' ');
      if (rStr && rStr !== 'N°Lote') actual._rVals.push(rStr);
    }

    const mezclaCodigo = r[origenCol] != null ? String(r[origenCol]).trim() || null : null;
    if (!mezclaCodigo || mezclaCodigo.toUpperCase() === 'N/A') continue;

    const patente = r[camCol + 2] != null ? String(r[camCol + 2]).trim() : null;
    const pesoRaw = r[camCol + 6];
    const peso    = typeof pesoRaw === 'number' ? pesoRaw : parseFloat(String(pesoRaw ?? ''));
    const pendiente = isNaN(peso) || peso <= 0;
    if (pendiente) actual._sinPeso++;

    actual.camionadas.push({
      numero_camionada: numCam,
      ticket:          r[camCol + 1] != null ? String(r[camCol + 1]).trim() || null : null,
      patente:         patente || null,
      fecha_despacho:  toISO(r[camCol + 3]),
      fecha_recepcion: toISO(r[camCol + 4]),
      hora:            parseExcelTime(r[camCol + 5]),
      peso:            pendiente ? 29 : peso,
      peso_pendiente:  pendiente,
      ley_mezcla:      safeLey(r[camCol + 7]),
      ley_visual:      safeLey(r[camCol + 8]),
      mezcla_codigo:   mezclaCodigo,
      ley_lab_camion:  safeLey(r[leyLabCol]),
    });
  }
  if (actual) lotes.push(actual);

  for (const lote of lotes) {
    for (const val of lote._rVals) {
      const clasif = clasificarRVal(val);
      if (!clasif) continue;
      if (clasif.tipo === 'numero_lote' && !lote.numero_lote) lote.numero_lote = clasif.valor;
      else if (clasif.tipo === 'empresa' && !lote.empresa_nombre) lote.empresa_nombre = clasif.valor;
    }
    delete lote._rVals;
    lote.tiene_pendientes = lote._sinPeso > 0;
    delete lote._sinPeso;
  }

  // Carry-forward: si un lote no tiene planta, hereda la del lote anterior
  let ultimaPlanta = null;
  for (const lote of lotes) {
    if (lote.planta_destino) ultimaPlanta = lote.planta_destino;
    else if (ultimaPlanta)   lote.planta_destino = ultimaPlanta;
  }

  return lotes.filter(l => l.camionadas.length > 0);
}

function limpiarNombreEmpresa(raw) {
  if (!raw) return '';
  return raw
    .replace(/[ ​‌‍﻿]/g, ' ')  // espacios especiales → espacio normal
    .replace(/\s+/g, ' ')                                 // múltiples espacios → uno
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());              // Title Case
}

function normStr(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

function wAvg(items, field) {
  const valid = items.filter(d => d[field] != null && (d.toneladas ?? 0) > 0);
  if (!valid.length) return null;
  const tot = valid.reduce((s, d) => s + d.toneladas, 0);
  return tot ? valid.reduce((s, d) => s + d[field] * d.toneladas, 0) / tot : null;
}

function formatFechaCL(dateStr) {
  if (!dateStr) return '—';
  try {
    const s = String(dateStr).includes('T') ? dateStr : dateStr + 'T12:00:00';
    return new Date(s).toLocaleDateString('es-CL');
  } catch { return String(dateStr); }
}

function getMesBadge(fechaStr) {
  if (!fechaStr) return null;
  try {
    const d = new Date(String(fechaStr).includes('T') ? fechaStr : fechaStr + 'T12:00:00');
    return `${MESES_CORTO[d.getMonth()]} ${d.getFullYear()}`;
  } catch { return null; }
}

/**
 * Parsea el campo `origen` de una dumpada (col J de la hoja Mezcla) para extraer
 * frente, jornada y fecha. Formato esperado: "{frente} AM/PM {numero} DD-MM-YYYY"
 */
function parsearOrigenDumpada(origen) {
  if (!origen) return null;
  const m = String(origen).match(/^(.+?)\s+(AM|PM|MADRUGADA|NOCHE)\s+\d+\s+(\d{2}-\d{2}-\d{4})$/i);
  if (!m) return null;
  const [dd, mm, yyyy] = m[3].split('-');
  return {
    punto:   m[1].trim(),
    jornada: m[2].toUpperCase(),
    fecha:   `${yyyy}-${mm}-${dd}`,
  };
}

export default function ImportarFlujoCompletoView({ toast, setVistaActual }) {
  const { faenaUsuario, faenas } = useFaena();
  const faenaId = faenaUsuario?.id ?? faenaUsuario;

  const [step, setStep]               = useState(0);
  const [archivoNombre, setArchivoNombre] = useState('');
  const [mesAnio, setMesAnio]         = useState(null);
  const [parseando, setParseando]     = useState(false);
  const [importando, setImportando]   = useState(false);
  const [loadingMsg, setLoadingMsg]   = useState('');
  const [avisoFaena, setAvisoFaena]   = useState(null);

  const [tipoLey, setTipoLey]               = useState('cu_insoluble');
  const [mezclasExcel, setMezclasExcel]     = useState({});
  const [lotesParseados, setLotesParseados] = useState([]);

  const [mezclasPreview, setMezclasPreview] = useState([]);
  const [lotesPreview, setLotesPreview]     = useState([]);
  const [empresasDB, setEmpresasDB]         = useState([]);
  const [creandoEmpresa, setCreandoEmpresa] = useState({});
  const [plantasDB, setPlantasDB]           = useState([]);

  const [seleccionadas, setSeleccionadas]       = useState({});
  const [empresaOverrides, setEmpresaOverrides] = useState({});
  const [plantaOverrides, setPlantaOverrides]   = useState({});
  const [expandidosLote, setExpandidosLote]     = useState({});
  const [expandidosMezcla, setExpandidosMezcla] = useState({});
  const [resultado, setResultado] = useState(null);
  const [dumpadasDBSheet, setDumpadasDBSheet] = useState(new Map());

  const dropRef  = useRef(null);
  const inputRef = useRef(null);

  const parsearArchivo = useCallback(async (file) => {
    setArchivoNombre(file.name);
    setAvisoFaena(null);
    console.log('[FlujoCompleto] faenaId:', faenaId, '| faenaUsuario:', faenaUsuario);
    const faenaActual = faenas.find(f => f.id == faenaId);
    if (faenaActual) {
      const nomFaena = faenaActual.ubicacion || faenaActual.nombre || '';
      if (nomFaena && !normStr(file.name).includes(normStr(nomFaena)))
        setAvisoFaena(`El archivo "${file.name}" no parece corresponder a la faena "${nomFaena}".`);
    }
    setLoadingMsg('Leyendo archivo Excel…');
    setParseando(true);
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: 'array', cellDates: true });
      if (!wb.SheetNames.includes(HOJA_MEZCLAS)) {
        toast?.error(`El archivo no tiene una hoja llamada "${HOJA_MEZCLAS}"`);
        setParseando(false);
        return;
      }
      const ws   = wb.Sheets[HOJA_MEZCLAS];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
      const row2 = rows[1] ?? [];
      setMesAnio(row2[0] && row2[1] ? { mes: String(row2[0]).trim(), anio: String(row2[1]).trim() } : null);
      const leyCOL  = detectarMapeoLeyes(rows);
      setTipoLey(leyCOL.ley_dump === 12 ? 'cu_soluble' : 'cu_insoluble');
      const mezMap  = parsearMezclasExcel(rows);
      const loteArr = parsearLotes(rows);
      if (loteArr.length === 0 && Object.keys(mezMap).length === 0) {
        toast?.error('No se encontraron datos válidos en la hoja "Mezcla"');
        setParseando(false);
        return;
      }
      console.log('[FlujoCompleto] Parseo OK → mezclas:', Object.keys(mezMap), '| lotes:', loteArr.map(l => l.numero_lote));
      setMezclasExcel(mezMap);
      setLotesParseados(loteArr);

      // Parsear hoja DB para datos completos de dumpadas (certificado, rango, etc.)
      const dbMap = new Map();
      if (wb.SheetNames.includes(HOJA_DB)) {
        const wsDB   = wb.Sheets[HOJA_DB];
        const rowsDB = XLSX.utils.sheet_to_json(wsDB, { header: 1, defval: null, raw: true });
        const COL_DB = detectarColsDB(rowsDB[DB_FILA_INICIO - 2] ?? []); // header row
        for (let i = DB_FILA_INICIO - 1; i < rowsDB.length; i++) {
          const r       = rowsDB[i];
          const numRaw  = r[COL_DB.numero_dumpada];
          if (numRaw == null) continue;
          const numStr  = String(numRaw).trim();
          if (!numStr)   continue;
          const punto   = r[COL_DB.punto]   ? String(r[COL_DB.punto]).trim()   : null;
          const jornada = r[COL_DB.jornada] ? String(r[COL_DB.jornada]).trim().toUpperCase() : null;
          if (!punto || !jornada) continue;
          const tonRaw  = r[COL_DB.ton];
          const ton     = typeof tonRaw === 'number' ? tonRaw : parseFloat(String(tonRaw ?? ''));
          dbMap.set(numStr, {
            punto,
            tipo:        r[COL_DB.tipo]        ? String(r[COL_DB.tipo]).trim()        : null,
            acopios:     r[COL_DB.acopios]     ? String(r[COL_DB.acopios]).trim()     : '',
            jornada,
            fecha:       parseExcelDate(r[COL_DB.fecha]),
            ton:         isNaN(ton) ? null : ton,
            ley:         safeLey(r[COL_DB.ley]),
            ley_cup:     safeLey(r[COL_DB.ley_cup]),
            certificado: r[COL_DB.certificado] != null && r[COL_DB.certificado] !== ''
                           ? String(r[COL_DB.certificado]).trim() : null,
            ley_visual:  safeLey(r[COL_DB.ley_visual]),
            rango:       r[COL_DB.rango] != null && r[COL_DB.rango] !== ''
                           ? String(r[COL_DB.rango]).trim() : null,
          });
        }
        console.log('[FlujoCompleto] Hoja DB parseada →', dbMap.size, 'dumpadas');
      }
      setDumpadasDBSheet(dbMap);
    } catch (err) {
      toast?.error('Error al leer el archivo: ' + err.message);
    }
    setParseando(false);
  }, [toast, faenas, faenaId]);

  const handleContinuar = useCallback(async () => {
    setLoadingMsg('Validando con la base de datos…');
    setParseando(true);
    try {
      const mezclasArr = Object.entries(mezclasExcel).map(([codigo, data]) => ({
        codigo,
        dumpadas: data.dumpadas.map(d => ({
          numero_dumpada: d.numero_dumpada, toneladas: d.toneladas,
          ley_dump: d.ley_dump, ley_visual: d.ley_visual, ley_lote: d.ley_lote, acopios: d.origen || '',
        })),
        remanentes: (data.remanentes ?? []).map(rem => ({
          toneladas: rem.toneladas,
          ley_dump: rem.ley_dump, ley_visual: rem.ley_visual, ley_lote: rem.ley_lote,
          numero_paladas: rem.numero_paladas,
          origen: rem.origen || '',
        })),
      }));

      const [resMezclas, resLotes] = await Promise.all([
        mezclasArr.length > 0
          ? dispatchService.importarMezclasPreview(faenaId, mezclasArr)
          : Promise.resolve({ mezclas: [] }),
        lotesParseados.length > 0
          ? dispatchService.importarLotesPreview(faenaId, lotesParseados)
          : Promise.resolve({ lotes: [], empresas: [], plantas: [] }),
      ]);

      console.log('[FlujoCompleto] Preview mezclas:', resMezclas);
      console.log('[FlujoCompleto] Preview lotes:', resLotes);
      setMezclasPreview(resMezclas.mezclas ?? []);
      setLotesPreview(resLotes.lotes ?? []);
      setEmpresasDB(resLotes.empresas ?? []);
      setPlantasDB(resLotes.plantas ?? []);

      const sel = {}, empOvr = {}, pltOvr = {};
      (resLotes.lotes ?? []).forEach(l => {
        sel[l.numero_lote]    = !l.existe;
        if (l.empresa_id) empOvr[l.numero_lote] = String(l.empresa_id);
        if (l.planta_id)  pltOvr[l.numero_lote] = String(l.planta_id);
      });
      setSeleccionadas(sel);
      setEmpresaOverrides(empOvr);
      setPlantaOverrides(pltOvr);
      setStep(1);
    } catch (err) {
      toast?.error('Error al validar: ' + (err.response?.data?.message || err.message));
    }
    setParseando(false);
  }, [faenaId, mezclasExcel, lotesParseados, toast]);

  const handleImportar = async () => {
    const selArr = lotesParseados.filter(l => seleccionadas[l.numero_lote]);
    console.log('[FlujoCompleto] handleImportar → faenaId:', faenaId, '| lotes seleccionados:', selArr.map(l => l.numero_lote));
    console.log('[FlujoCompleto] empresaOverrides:', empresaOverrides, '| plantaOverrides:', plantaOverrides);
    if (selArr.length === 0) { toast?.error('Selecciona al menos un lote'); return; }

    const codigosNecesarios = new Set(
      selArr.flatMap(l => l.camionadas.map(c => c.mezcla_codigo)).filter(Boolean)
    );
    const mezclasACrear = Object.entries(mezclasExcel)
      .filter(([cod]) => codigosNecesarios.has(cod) && !(mezclasPreview.find(m => m.codigo === cod)?.existe))
      .map(([cod, data]) => ({
        codigo: cod,
        dumpadas: data.dumpadas.map(d => ({
          numero_dumpada: d.numero_dumpada, toneladas: d.toneladas,
          ley_dump: d.ley_dump, ley_visual: d.ley_visual, ley_lote: d.ley_lote, acopios: d.origen || '',
        })),
        remanentes: (data.remanentes ?? []).map(rem => ({
          toneladas: rem.toneladas,
          ley_dump: rem.ley_dump, ley_visual: rem.ley_visual, ley_lote: rem.ley_lote,
          numero_paladas: rem.numero_paladas,
          origen: rem.origen || '',
        })),
      }));

    setImportando(true);
    let resDumpadas = { creadas: 0, saltadas: 0, errores: [] };
    let resMezclas  = { creadas: 0, saltadas: 0, saltadas_detalle: [], errores: [] };
    let resLotes    = { creados: 0, saltados: 0, errores: [] };

    try {
      // ── Paso 0: crear dumpadas faltantes ────────────────────────────────────
      {
        const faltantesMap = new Map(); // numero_dumpada → datos excel
        for (const m of mezclasACrear) {
          const prevM = mezclasPreview.find(pm => pm.codigo === m.codigo);
          const faltantes = new Set((prevM?.dumpadas_faltantes ?? []).map(String));
          if (!faltantes.size) continue;
          for (const dump of (mezclasExcel[m.codigo]?.dumpadas ?? [])) {
            const num = String(dump.numero_dumpada);
            if (faltantes.has(num) && !faltantesMap.has(num)) faltantesMap.set(num, dump);
          }
        }

        if (faltantesMap.size > 0) {
          const dumpadasACrear = [];
          const sinParsear = [];
          for (const [num, data] of faltantesMap) {
            const dbRow = dumpadasDBSheet.get(num);
            if (dbRow?.punto) {
              // Datos completos desde hoja DB (incluye certificado, rango, ley_cup real)
              dumpadasACrear.push({
                numero_dumpada: num,
                punto:          dbRow.punto,
                tipo:           dbRow.tipo || 'FRENTE',
                jornada:        dbRow.jornada,
                fecha:          dbRow.fecha,
                ton:            dbRow.ton ?? data.toneladas,
                ley:            dbRow.ley,
                ley_cup:        dbRow.ley_cup,
                ley_visual:     dbRow.ley_visual,
                certificado:    dbRow.certificado,
                rango:          dbRow.rango,
                acopios:        dbRow.acopios || data.origen || '',
              });
            } else {
              // Fallback: extraer frente/jornada/fecha del campo origen de la hoja Mezcla
              const parsed = parsearOrigenDumpada(data.origen);
              if (!parsed?.punto) { sinParsear.push(num); continue; }
              const leyDump = data.ley_dump ?? (data.ley_lote != null ? Math.round(data.ley_lote / 0.9 * 1000) / 1000 : null);
              dumpadasACrear.push({
                numero_dumpada: num,
                punto:          parsed.punto,
                jornada:        parsed.jornada,
                fecha:          parsed.fecha,
                ton:            data.toneladas,
                ley:            leyDump,
                ley_cup:        leyDump,
                ley_visual:     data.ley_visual,
                acopios:        data.origen || '',
              });
            }
          }
          if (dumpadasACrear.length > 0) {
            setLoadingMsg(`Creando ${dumpadasACrear.length} dumpada${dumpadasACrear.length !== 1 ? 's' : ''} faltantes…`);
            resDumpadas = await dispatchService.importarConfirmar(faenaId, tipoLey, dumpadasACrear);
          }
          if (sinParsear.length > 0) {
            resDumpadas.errores = [...(resDumpadas.errores ?? []),
              ...sinParsear.map(n => ({ numero_dumpada: n, error: 'No se pudo extraer frente del origen' })),
            ];
          }
        }
      }

      if (mezclasACrear.length > 0) {
        setLoadingMsg(`Importando ${mezclasACrear.length} mezcla${mezclasACrear.length !== 1 ? 's' : ''}…`);
        // Agrupar mezclas por planta del primer lote seleccionado que las use
        const grupos = new Map();
        for (const m of mezclasACrear) {
          const plantaId = (() => {
            for (const lote of selArr) {
              if (lote.camionadas.some(c => c.mezcla_codigo === m.codigo))
                return plantaOverrides[lote.numero_lote] || null;
            }
            return null;
          })();
          const key = plantaId ?? 'null';
          if (!grupos.has(key)) grupos.set(key, []);
          grupos.get(key).push(m);
        }
        for (const [k, grupo] of grupos) {
          const plantaId = k === 'null' ? null : k;
          const r = await dispatchService.importarMezclasConfirmar(faenaId, plantaId, grupo);
          resMezclas.creadas          += r.creadas  ?? 0;
          resMezclas.saltadas         += r.saltadas ?? 0;
          resMezclas.saltadas_detalle  = [...resMezclas.saltadas_detalle, ...(r.saltadas_detalle ?? [])];
          resMezclas.errores           = [...resMezclas.errores, ...(r.errores ?? [])];
        }
      }

      setLoadingMsg(`Importando ${selArr.length} lote${selArr.length !== 1 ? 's' : ''}…`);
      resLotes = await dispatchService.importarLotesConfirmar(faenaId, selArr, empresaOverrides, plantaOverrides);
      console.log('[FlujoCompleto] Resultado dumpadas:', resDumpadas, '| mezclas:', resMezclas, '| lotes:', resLotes);
      setResultado({ dumpadas: resDumpadas, mezclas: resMezclas, lotes: resLotes });
      setStep(2);
    } catch (err) {
      toast?.error('Error al importar: ' + (err.response?.data?.message || err.message));
    }
    setImportando(false);
  };

  const resetear = () => {
    setStep(0); setArchivoNombre(''); setMesAnio(null);
    setMezclasExcel({}); setLotesParseados([]);
    setMezclasPreview([]); setLotesPreview([]);
    setEmpresasDB([]); setPlantasDB([]);
    setSeleccionadas({}); setEmpresaOverrides({}); setPlantaOverrides({});
    setExpandidosLote({}); setExpandidosMezcla({});
    setResultado(null); setAvisoFaena(null); setDumpadasDBSheet(new Map());
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dropRef.current?.classList.remove('border-teal-400', 'bg-teal-50');
    const file = e.dataTransfer.files[0];
    if (file) parsearArchivo(file);
  }, [parsearArchivo]);

  const totalSel      = Object.values(seleccionadas).filter(Boolean).length;
  const sinEmpresa    = lotesPreview.filter(l => seleccionadas[l.numero_lote] && !empresaOverrides[l.numero_lote]).length;
  const sinPlanta     = lotesPreview.filter(l => seleccionadas[l.numero_lote] && !plantaOverrides[l.numero_lote]).length;
  const numMezNuevas  = mezclasPreview.filter(m => !m.existe).length;
  const numMezExisten = mezclasPreview.filter(m => m.existe).length;
  const numLotNuevos  = lotesPreview.filter(l => !l.existe).length;
  const numLotExisten = lotesPreview.filter(l => l.existe).length;

  return (
    <div className="space-y-6 relative">

      {/* Loading overlay */}
      {(parseando || importando) && (
        <div className="absolute inset-0 z-20 bg-white/75 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center gap-4 min-h-[200px]">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-200 border-t-teal-600" />
          <p className="text-sm font-semibold text-teal-700">{loadingMsg}</p>
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, idx) => (
          <div key={idx} className="flex items-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors
              ${idx === step ? 'bg-teal-600 text-white shadow-sm' : idx < step ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                ${idx === step ? 'bg-white/30' : idx < step ? 'bg-teal-300 text-teal-700' : 'bg-gray-300 text-gray-500'}`}>
                {idx < step ? '✓' : idx + 1}
              </span>
              {s}
            </div>
            {idx < STEPS.length - 1 && <div className={`h-px w-6 mx-1 ${idx < step ? 'bg-teal-300' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* ── PASO 0 ── */}
      {step === 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div
                ref={dropRef}
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); dropRef.current?.classList.add('border-teal-400','bg-teal-50'); }}
                onDragLeave={() => dropRef.current?.classList.remove('border-teal-400','bg-teal-50')}
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer transition-all hover:border-teal-300 hover:bg-teal-50/40 group"
              >
                <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => e.target.files[0] && parsearArchivo(e.target.files[0])} />
                {parseando ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500" />
                    <p className="text-gray-500 text-sm">Leyendo hoja "Mezcla"…</p>
                  </div>
                ) : archivoNombre ? (
                  <div className="flex flex-col items-center gap-3">
                    <HiCheckCircle className="w-12 h-12 text-green-500" />
                    <p className="font-semibold text-gray-700">{archivoNombre}</p>
                    {mesAnio && (
                      <span className="inline-flex items-center gap-1.5 bg-teal-100 text-teal-700 border border-teal-200 px-3 py-1 rounded-full text-xs font-semibold">
                        <HiCalendar className="w-3.5 h-3.5" />{mesAnio.mes} {mesAnio.anio}
                      </span>
                    )}
                    <p className="text-sm text-gray-400">Haz clic para cambiar el archivo</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <HiDocumentArrowUp className="w-14 h-14 text-gray-300 group-hover:text-teal-400 transition-colors" />
                    <p className="font-semibold text-gray-600 text-lg">Arrastra tu archivo Excel aquí</p>
                    <p className="text-sm text-gray-400">o haz clic para seleccionarlo</p>
                    <p className="text-xs text-gray-300 mt-1">La hoja debe llamarse <span className="font-mono font-bold">Mezcla</span></p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 text-xs text-teal-700 space-y-2">
              <p className="font-bold text-sm">Flujo completo en un paso</p>
              <div className="flex items-start gap-2">
                <HiBeaker className="w-3.5 h-3.5 mt-0.5 text-violet-500 flex-shrink-0" />
                <p><span className="font-semibold">Mezclas y dumpadas</span> — cols H–P</p>
              </div>
              <div className="flex items-start gap-2">
                <HiTruck className="w-3.5 h-3.5 mt-0.5 text-emerald-500 flex-shrink-0" />
                <p><span className="font-semibold">Lotes y camionadas</span> — cols R+</p>
              </div>
              <p className="pt-1 text-teal-600 border-t border-teal-100">Crea primero las mezclas y luego los lotes automáticamente.</p>
            </div>
          </div>

          {avisoFaena && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <HiExclamationTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>{avisoFaena}</p>
            </div>
          )}

          {lotesParseados.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Mezclas',    val: Object.keys(mezclasExcel).length,                                      color: 'text-violet-600', bg: 'bg-violet-50 border-violet-100' },
                  { label: 'Dumpadas',   val: Object.values(mezclasExcel).reduce((s, m) => s + m.dumpadas.length, 0), color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-100' },
                  { label: 'Lotes',      val: lotesParseados.length,                                                  color: 'text-teal-600',   bg: 'bg-teal-50 border-teal-100' },
                  { label: 'Camionadas', val: lotesParseados.reduce((s, l) => s + l.camionadas.length, 0),            color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
                ].map(k => (
                  <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                    <p className={`text-3xl font-bold tabular-nums ${k.color}`}>{k.val}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{k.label} detectados</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button onClick={handleContinuar} disabled={parseando}
                  className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm">
                  Continuar y validar <HiArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PASO 1: REVISAR ── */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Mezclas nuevas',  val: numMezNuevas,  color: 'text-violet-600', bg: 'bg-violet-50 border-violet-100' },
              { label: 'Mezclas en BD',   val: numMezExisten, color: 'text-blue-500',   bg: 'bg-blue-50 border-blue-100' },
              { label: 'Lotes nuevos',    val: numLotNuevos,  color: 'text-teal-600',   bg: 'bg-teal-50 border-teal-100' },
              { label: 'Lotes en BD',     val: numLotExisten, color: 'text-blue-500',   bg: 'bg-blue-50 border-blue-100' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
                <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.val}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Desglose mensual */}
          {(() => {
            const selectedLotes = lotesParseados.filter(l => seleccionadas[l.numero_lote]);
            const byMonth = {};
            selectedLotes.forEach(lote => {
              (lote.camionadas ?? []).forEach(cam => {
                if (!cam.fecha_despacho) return;
                const key = cam.fecha_despacho.substring(0, 7);
                if (!byMonth[key]) byMonth[key] = { lotes: new Set(), cams: 0, fechas: [] };
                byMonth[key].lotes.add(lote.numero_lote);
                byMonth[key].cams++;
                byMonth[key].fechas.push(cam.fecha_despacho);
              });
            });
            const months = Object.keys(byMonth).sort();
            if (months.length === 0) return null;
            const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
            const mesLabel = (key) => {
              const [y, m] = key.split('-');
              return `${MESES[parseInt(m, 10) - 1]} ${y}`;
            };
            return (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
                  <HiCalendar className="w-4 h-4 text-teal-500" />
                  <p className="font-bold text-gray-700 text-sm">
                    Distribución mensual — {months.length} mes{months.length !== 1 ? 'es' : ''}
                  </p>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide text-left">
                      <th className="px-4 py-2 font-semibold">Mes</th>
                      <th className="px-4 py-2 font-semibold text-right">Lotes</th>
                      <th className="px-4 py-2 font-semibold text-right">Camionadas</th>
                      <th className="px-4 py-2 font-semibold">Desde</th>
                      <th className="px-4 py-2 font-semibold">Hasta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {months.map(key => {
                      const g = byMonth[key];
                      const sorted = [...g.fechas].sort();
                      return (
                        <tr key={key} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-semibold text-gray-800">{mesLabel(key)}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-teal-700 font-bold">{g.lotes.size}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-emerald-700 font-bold">{g.cams}</td>
                          <td className="px-4 py-2 text-gray-500 font-mono">{sorted[0]}</td>
                          <td className="px-4 py-2 text-gray-500 font-mono">{sorted[sorted.length - 1]}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Dumpadas que quedarán en estado Ingresado (sin análisis completo) */}
          {(() => {
            const sinAnalisis = [...dumpadasDBSheet.values()].filter(
              d => d.ley === null || d.ley_cup === null || d.certificado === null
            );
            if (sinAnalisis.length === 0) return null;
            return (
              <div className="bg-amber-50 border border-amber-300 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
                  <HiExclamationTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <p className="font-bold text-amber-800 text-sm">
                    {sinAnalisis.length} dumpada{sinAnalisis.length !== 1 ? 's' : ''} quedarán en estado <span className="font-mono">Ingresado</span>
                  </p>
                  <span className="ml-auto text-xs text-amber-600">Les falta ley, ley CuP o certificado</span>
                </div>
                <div className="overflow-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-amber-100 text-amber-700 uppercase tracking-wide">
                        <th className="px-3 py-2 text-left font-semibold">Nº Dumpada</th>
                        <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                        <th className="px-3 py-2 text-left font-semibold">Frente</th>
                        <th className="px-3 py-2 text-center font-semibold">Ley</th>
                        <th className="px-3 py-2 text-center font-semibold">Ley CuP</th>
                        <th className="px-3 py-2 text-center font-semibold">Certificado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {sinAnalisis.map((d, i) => (
                        <tr key={i} className="hover:bg-amber-50">
                          <td className="px-3 py-1.5 font-mono font-semibold text-amber-900">{d.numero_dumpada || '—'}</td>
                          <td className="px-3 py-1.5 text-gray-600">{d.fecha ?? '—'}</td>
                          <td className="px-3 py-1.5 text-gray-600">{d.punto ?? '—'}</td>
                          <td className="px-3 py-1.5 text-center">
                            {d.ley !== null ? <span className="text-green-700">{d.ley}%</span> : <span className="text-red-500 font-bold">—</span>}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {d.ley_cup !== null ? <span className="text-green-700">{d.ley_cup}%</span> : <span className="text-red-500 font-bold">—</span>}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {d.certificado !== null ? <span className="text-green-700">{d.certificado}</span> : <span className="text-red-500 font-bold">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {(sinEmpresa > 0 || sinPlanta > 0) && (() => {
            const lotesEmp = lotesPreview.filter(l => seleccionadas[l.numero_lote] && !empresaOverrides[l.numero_lote]);
            const lotesPlanta = lotesPreview.filter(l => seleccionadas[l.numero_lote] && !plantaOverrides[l.numero_lote]);
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-2">
                <div className="flex items-center gap-2">
                  <HiExclamationTriangle className="w-5 h-5 flex-shrink-0" />
                  <p className="font-semibold">Estos lotes <span className="underline">no se importarán</span> si no asignas empresa/planta manualmente:</p>
                </div>
                {lotesEmp.length > 0 && (
                  <div className="space-y-1 pl-7">
                    <p className="text-amber-700 font-medium text-xs">Sin empresa — selecciona del desplegable en cada lote:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {lotesEmp.map(l => (
                        <span key={l.numero_lote} className="bg-amber-100 border border-amber-300 text-amber-800 font-mono text-xs px-2 py-0.5 rounded">
                          {l.numero_lote}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {lotesPlanta.length > 0 && (
                  <div className="space-y-1 pl-7">
                    <p className="text-amber-700 font-medium text-xs">Sin planta — selecciona del desplegable en cada lote:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {lotesPlanta.map(l => (
                        <span key={l.numero_lote} className="bg-amber-100 border border-amber-300 text-amber-800 font-mono text-xs px-2 py-0.5 rounded">
                          {l.numero_lote}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Árbol */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="font-bold text-gray-700 text-sm flex items-center gap-2">
                <HiSparkles className="w-4 h-4 text-teal-500" />
                Flujo completo — Lote → Mezcla → Dumpadas / Camionadas
              </p>
              <div className="flex gap-2 text-xs">
                <button onClick={() => { const s = {}; lotesPreview.forEach(l => { s[l.numero_lote] = !l.existe; }); setSeleccionadas(s); }}
                  className="text-teal-600 hover:underline font-semibold">Solo nuevos</button>
                <span className="text-gray-300">|</span>
                <button onClick={() => { const s = {}; lotesPreview.forEach(l => { s[l.numero_lote] = true; }); setSeleccionadas(s); }}
                  className="text-teal-600 hover:underline font-semibold">Todos</button>
                <span className="text-gray-300">|</span>
                <button onClick={() => { const s = {}; lotesPreview.forEach(l => { s[l.numero_lote] = false; }); setSeleccionadas(s); }}
                  className="text-gray-400 hover:underline">Ninguno</button>
              </div>
            </div>

            <div className="overflow-auto">
              {lotesPreview.map(l => {
                const parsedLote  = lotesParseados.find(lp => lp.numero_lote === l.numero_lote);
                const isExpanded  = !!expandidosLote[l.numero_lote];
                const mezCods     = [...new Set((parsedLote?.camionadas ?? []).map(c => c.mezcla_codigo).filter(Boolean))];
                const mesBadge    = parsedLote?.camionadas[0]?.fecha_despacho ? getMesBadge(parsedLote.camionadas[0].fecha_despacho) : null;

                return (
                  <div key={l.numero_lote} className="border-b border-gray-100 last:border-0">
                    {/* Fila lote */}
                    <div className={`flex flex-wrap items-center gap-2 px-4 py-3 hover:bg-gray-50 ${!seleccionadas[l.numero_lote] ? 'opacity-50' : ''}`}>
                      <input type="checkbox" checked={!!seleccionadas[l.numero_lote]}
                        onChange={e => setSeleccionadas(p => ({ ...p, [l.numero_lote]: e.target.checked }))}
                        className="accent-teal-600 w-4 h-4 flex-shrink-0" />
                      <button onClick={() => setExpandidosLote(p => ({ ...p, [l.numero_lote]: !p[l.numero_lote] }))}
                        className="text-gray-400 hover:text-teal-600">
                        {isExpanded ? <HiChevronDown className="w-4 h-4" /> : <HiChevronRight className="w-4 h-4" />}
                      </button>
                      <span className="font-mono font-bold text-gray-800 text-sm">{l.numero_lote}</span>
                      {l.existe
                        ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Ya existe</span>
                        : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Nuevo</span>}
                      {mesBadge && (
                        <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded text-xs font-semibold">
                          <HiCalendar className="w-3 h-3" />{mesBadge}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{parsedLote?.camionadas.length ?? 0} cam · {mezCods.length} mezcla{mezCods.length !== 1 ? 's' : ''}</span>
                      <div className="ml-auto flex items-center gap-2">
                        <select value={plantaOverrides[l.numero_lote] ?? ''}
                          onChange={e => setPlantaOverrides(p => ({ ...p, [l.numero_lote]: e.target.value }))}
                          className={`text-xs border rounded px-2 py-1 w-36 ${!plantaOverrides[l.numero_lote] ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-700'}`}>
                          <option value="">{l.planta_destino ? `No está en BD: ${l.planta_destino}` : 'No encontrada en Excel'}</option>
                          {plantasDB.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}{p.codigo ? ` (${p.codigo})` : ''}</option>)}
                        </select>
                        <div className="flex items-center gap-1">
                          <select value={empresaOverrides[l.numero_lote] ?? ''}
                            onChange={e => setEmpresaOverrides(p => ({ ...p, [l.numero_lote]: e.target.value }))}
                            className={`text-xs border rounded px-2 py-1 w-40 ${!empresaOverrides[l.numero_lote] ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-700'}`}>
                            <option value="">{l.empresa_nombre ? `No está en BD: ${l.empresa_nombre}` : 'No encontrada en Excel'}</option>
                            {empresasDB.map(e => <option key={e.id} value={String(e.id)}>{e.nombre}</option>)}
                          </select>
                          {l.empresa_nombre && !empresaOverrides[l.numero_lote] && (() => {
                            const nombreLimpio = limpiarNombreEmpresa(l.empresa_nombre);
                            const cargando = !!creandoEmpresa[l.numero_lote];
                            return (
                              <button
                                disabled={cargando}
                                title={`Crear empresa "${nombreLimpio}"`}
                                onClick={async () => {
                                  setCreandoEmpresa(p => ({ ...p, [l.numero_lote]: true }));
                                  try {
                                    const nueva = await dispatchService.crearEmpresa(nombreLimpio);
                                    setEmpresasDB(prev => [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)));
                                    setEmpresaOverrides(p => ({ ...p, [l.numero_lote]: String(nueva.id) }));
                                    toast?.success(`Empresa "${nueva.nombre}" creada`);
                                  } catch (err) {
                                    toast?.error('Error al crear empresa: ' + (err.response?.data?.detalles?.nombre?.[0] || err.message));
                                  }
                                  setCreandoEmpresa(p => ({ ...p, [l.numero_lote]: false }));
                                }}
                                className="flex-shrink-0 text-xs bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white px-2 py-1 rounded font-semibold transition-colors"
                              >
                                {cargando ? '…' : '+ Crear'}
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Árbol expandido */}
                    {isExpanded && parsedLote && (
                      <div className="pl-10 pr-4 pb-3 bg-slate-50 space-y-3">

                        {/* 1. Tabla de camionadas (todas, con badge de mezcla) */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                          <p className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 flex items-center gap-1">
                            <HiTruck className="w-3 h-3" /> Camionadas ({parsedLote.camionadas.length})
                          </p>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                                <th className="px-3 py-1 text-left font-semibold">N° Cam</th>
                                <th className="px-3 py-1 text-left font-semibold">Patente</th>
                                <th className="px-3 py-1 text-left font-semibold">Fecha</th>
                                <th className="px-3 py-1 text-right font-semibold">Ton</th>
                                <th className="px-3 py-1 text-left font-semibold">Mezcla origen</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {parsedLote.camionadas.map((c, ci) => {
                                const prevMezcla = c.mezcla_codigo ? mezclasPreview.find(m => m.codigo === c.mezcla_codigo) : null;
                                return (
                                  <tr key={ci} className="hover:bg-emerald-50/30">
                                    <td className="px-3 py-1 font-mono font-semibold text-gray-700">{c.numero_camionada}</td>
                                    <td className="px-3 py-1 text-gray-700">{c.patente ?? '—'}</td>
                                    <td className="px-3 py-1 text-gray-500">{formatFechaCL(c.fecha_despacho)}</td>
                                    <td className="px-3 py-1 text-right tabular-nums text-gray-700 font-semibold">{c.peso != null ? c.peso.toFixed(2) : '—'}</td>
                                    <td className="px-3 py-1">
                                      {c.mezcla_codigo ? (
                                        <span className={`font-mono text-xs px-1.5 py-0.5 rounded font-bold ${prevMezcla?.existe ? 'bg-blue-100 text-blue-800' : 'bg-violet-100 text-violet-800'}`}>
                                          {c.mezcla_codigo}
                                        </span>
                                      ) : <span className="text-gray-300">—</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* 2. Mezclas (expandibles → dumpadas) */}
                        {mezCods.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-bold text-gray-500 flex items-center gap-1.5 pl-1">
                              <HiBeaker className="w-3.5 h-3.5 text-amber-500" /> Mezclas de origen
                            </p>
                            {mezCods.map(cod => {
                              const prevMezcla    = mezclasPreview.find(m => m.codigo === cod);
                              const excelMezcla   = mezclasExcel[cod];
                              const isMezExpanded = !!expandidosMezcla[`${l.numero_lote}-${cod}`];
                              const dumpadas      = excelMezcla?.dumpadas ?? [];
                              const camsCount     = parsedLote.camionadas.filter(c => c.mezcla_codigo === cod).length;

                              return (
                                <div key={cod} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                  <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50"
                                    onClick={() => setExpandidosMezcla(p => ({ ...p, [`${l.numero_lote}-${cod}`]: !p[`${l.numero_lote}-${cod}`] }))}>
                                    {isMezExpanded ? <HiChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <HiChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                    <HiBeaker className="w-3.5 h-3.5 text-amber-500" />
                                    <span className="font-mono font-bold text-sm text-gray-800">{cod}</span>
                                    {prevMezcla?.existe
                                      ? <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">✓ BD</span>
                                      : <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-semibold">Nueva</span>}
                                    <span className="text-xs text-gray-400">
                                      {prevMezcla?.total_ton != null ? `${Number(prevMezcla.total_ton).toFixed(1)}t` : ''}
                                      {prevMezcla?.ley_prom_dump != null ? ` · ${Number(prevMezcla.ley_prom_dump).toFixed(3)}%` : ''}
                                      {` · ${dumpadas.length} dump.${(excelMezcla?.remanentes?.length ?? 0) > 0 ? ` + ${excelMezcla.remanentes.length} rem.` : ''} · ${camsCount} cam.`}
                                    </span>
                                  </div>

                                  {isMezExpanded && (dumpadas.length > 0 || (excelMezcla?.remanentes?.length ?? 0) > 0) && (() => {
                                    const existe    = !!prevMezcla?.existe;
                                    const remanentes = excelMezcla?.remanentes ?? [];
                                    const allItems  = [...dumpadas, ...remanentes];
                                    const totalTon  = existe ? prevMezcla.total_ton             : allItems.reduce((s, d) => s + (d.toneladas ?? 0), 0);
                                    const dispTon   = existe ? prevMezcla.toneladas_disponibles : null;
                                    const lLote     = existe ? prevMezcla.ley_prom_lote         : wAvg(allItems, 'ley_lote');
                                    const lDump     = existe ? prevMezcla.ley_prom_dump         : (lLote != null ? Math.round(lLote / 0.9 * 1000) / 1000 : null);
                                    const lVis      = existe ? prevMezcla.ley_prom_visual       : wAvg(allItems, 'ley_visual');
                                    const lLab      = existe ? prevMezcla.ley_lab               : (lDump != null ? Math.round(lDump / 0.9 * 1000) / 1000 : null);
                                    return (
                                      <div className="border-t border-amber-100">
                                        {/* Barra resumen */}
                                        <div className="flex flex-wrap gap-x-5 gap-y-1 px-3 py-2 bg-amber-50 border-b border-amber-100 text-xs">
                                          {totalTon != null && (
                                            <div>
                                              <p className="text-gray-400">Total ton</p>
                                              <p className="font-bold text-gray-800 tabular-nums">{Number(totalTon).toFixed(2)}</p>
                                            </div>
                                          )}
                                          {dispTon != null && (
                                            <div>
                                              <p className="text-gray-400">Disponible</p>
                                              <p className="font-bold text-gray-700 tabular-nums">{Number(dispTon).toFixed(2)}</p>
                                            </div>
                                          )}
                                          <div className="w-px bg-amber-200 mx-1 self-stretch" />
                                          {lDump != null && (
                                            <div>
                                              <p className="text-gray-400">Ley dump prom.</p>
                                              <p className="font-bold text-amber-700 tabular-nums">{lDump.toFixed(3)}%</p>
                                            </div>
                                          )}
                                          {lVis != null && (
                                            <div>
                                              <p className="text-gray-400">Ley visual prom.</p>
                                              <p className="font-bold text-blue-600 tabular-nums">{lVis.toFixed(3)}%</p>
                                            </div>
                                          )}
                                          {lLote != null && (
                                            <div>
                                              <p className="text-gray-400">Ley lote prom.</p>
                                              <p className="font-bold text-emerald-700 tabular-nums">{lLote.toFixed(3)}%</p>
                                            </div>
                                          )}
                                          {lLab != null && (
                                            <div>
                                              <p className="text-gray-400">Ley lab</p>
                                              <p className="font-bold text-violet-700 tabular-nums">{lLab.toFixed(3)}%</p>
                                            </div>
                                          )}
                                        </div>
                                        {/* Tabla dumpadas */}
                                        {dumpadas.length > 0 && (
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="bg-amber-50/60 text-amber-800 uppercase tracking-wide">
                                                <th className="px-3 py-1 text-left font-semibold">N° Dump</th>
                                                <th className="px-3 py-1 text-left font-semibold">Origen</th>
                                                <th className="px-3 py-1 text-right font-semibold">Ton</th>
                                                <th className="px-3 py-1 text-right font-semibold">Ley dump</th>
                                                <th className="px-3 py-1 text-right font-semibold">Ley visual</th>
                                                <th className="px-3 py-1 text-right font-semibold">Ley lote</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-amber-100">
                                              {dumpadas.map((d, di) => (
                                                <tr key={di} className="hover:bg-amber-50/30">
                                                  <td className="px-3 py-1 font-mono text-gray-700">{d.numero_dumpada}</td>
                                                  <td className="px-3 py-1 text-gray-500">{d.origen || '—'}</td>
                                                  <td className="px-3 py-1 text-right tabular-nums text-gray-600">{d.toneladas?.toFixed(2) ?? '—'}</td>
                                                  <td className="px-3 py-1 text-right tabular-nums text-amber-700 font-semibold">{d.ley_dump != null ? `${d.ley_dump.toFixed(3)}%` : '—'}</td>
                                                  <td className="px-3 py-1 text-right tabular-nums text-blue-600">{d.ley_visual != null ? `${d.ley_visual.toFixed(3)}%` : '—'}</td>
                                                  <td className="px-3 py-1 text-right tabular-nums text-emerald-700">{d.ley_lote != null ? `${d.ley_lote.toFixed(3)}%` : '—'}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        )}
                                        {/* Tabla remanentes / paladas */}
                                        {remanentes.length > 0 && (
                                          <>
                                            <p className="px-3 py-1.5 text-xs font-bold text-orange-700 bg-orange-50 border-t border-orange-200 flex items-center gap-1">
                                              Remanentes / Paladas ({remanentes.length})
                                            </p>
                                            <table className="w-full text-xs">
                                              <thead>
                                                <tr className="bg-orange-50/60 text-orange-800 uppercase tracking-wide">
                                                  <th className="px-3 py-1 text-left font-semibold">N° Paladas</th>
                                                  <th className="px-3 py-1 text-left font-semibold">Origen</th>
                                                  <th className="px-3 py-1 text-right font-semibold">Ton</th>
                                                  <th className="px-3 py-1 text-right font-semibold">Ley dump</th>
                                                  <th className="px-3 py-1 text-right font-semibold">Ley visual</th>
                                                  <th className="px-3 py-1 text-right font-semibold">Ley lote</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-orange-100">
                                                {remanentes.map((rem, ri) => (
                                                  <tr key={ri} className="hover:bg-orange-50/30">
                                                    <td className="px-3 py-1 font-mono text-gray-700">{rem.numero_paladas}</td>
                                                    <td className="px-3 py-1 text-gray-500">{rem.origen || '—'}</td>
                                                    <td className="px-3 py-1 text-right tabular-nums text-gray-600">{rem.toneladas?.toFixed(2) ?? '—'}</td>
                                                    <td className="px-3 py-1 text-right tabular-nums text-amber-700 font-semibold">{rem.ley_dump != null ? `${rem.ley_dump.toFixed(3)}%` : '—'}</td>
                                                    <td className="px-3 py-1 text-right tabular-nums text-blue-600">{rem.ley_visual != null ? `${rem.ley_visual.toFixed(3)}%` : '—'}</td>
                                                    <td className="px-3 py-1 text-right tabular-nums text-emerald-700">{rem.ley_lote != null ? `${rem.ley_lote.toFixed(3)}%` : '—'}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button onClick={resetear} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-semibold">
              <HiArrowLeft className="w-4 h-4" /> Volver
            </button>
            <button onClick={handleImportar} disabled={importando || totalSel === 0}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm">
              {importando
                ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Importando…</>
                : <><HiArrowUpTray className="w-4 h-4" />Importar {totalSel} lote{totalSel !== 1 ? 's' : ''}</>}
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 2: RESULTADO ── */}
      {step === 2 && resultado && (
        <div className="space-y-6">
          {(() => {
            const sinErrores = resultado.mezclas.errores.length === 0
              && (resultado.lotes.errores?.length ?? 0) === 0
              && (resultado.dumpadas?.errores?.length ?? 0) === 0;
            return (
              <div className="flex flex-col items-center py-8 gap-4">
                {sinErrores
                  ? <HiCheckBadge className="w-20 h-20 text-green-500" />
                  : <HiExclamationTriangle className="w-20 h-20 text-yellow-500" />}
                <h2 className="text-2xl font-bold text-gray-800">
                  {sinErrores ? '¡Flujo importado!' : 'Importación con advertencias'}
                </h2>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {resultado.dumpadas && (resultado.dumpadas.creadas > 0 || resultado.dumpadas.saltadas > 0 || resultado.dumpadas.errores?.length > 0) && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
                <p className="font-bold text-amber-700 mb-3 flex items-center gap-2"><HiCircleStack className="w-4 h-4" /> Dumpadas</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-2xl font-bold text-green-600">{resultado.dumpadas.creadas}</p><p className="text-xs text-gray-500">Creadas</p></div>
                  <div><p className="text-2xl font-bold text-blue-500">{resultado.dumpadas.saltadas}</p><p className="text-xs text-gray-500">Ya existían</p></div>
                  <div><p className={`text-2xl font-bold ${resultado.dumpadas.errores?.length > 0 ? 'text-red-500' : 'text-gray-300'}`}>{resultado.dumpadas.errores?.length ?? 0}</p><p className="text-xs text-gray-500">Errores</p></div>
                </div>
              </div>
            )}
            <div className="bg-violet-50 border border-violet-100 rounded-xl p-5">
              <p className="font-bold text-violet-700 mb-3 flex items-center gap-2"><HiBeaker className="w-4 h-4" /> Mezclas</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-2xl font-bold text-green-600">{resultado.mezclas.creadas}</p><p className="text-xs text-gray-500">Creadas</p></div>
                <div><p className="text-2xl font-bold text-blue-500">{resultado.mezclas.saltadas}</p><p className="text-xs text-gray-500">Ya existían</p></div>
                <div><p className={`text-2xl font-bold ${resultado.mezclas.errores.length > 0 ? 'text-red-500' : 'text-gray-300'}`}>{resultado.mezclas.errores.length}</p><p className="text-xs text-gray-500">Errores</p></div>
              </div>
              {resultado.mezclas.saltadas_detalle?.length > 0 && (
                <div className="mt-3 border-t border-violet-200 pt-3">
                  <p className="text-xs font-semibold text-violet-600 mb-1">Detalle omitidas:</p>
                  <div className="space-y-1">
                    {resultado.mezclas.saltadas_detalle.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold text-violet-800">{d.codigo}</span>
                        <span className="text-gray-500">{d.razon}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-5">
              <p className="font-bold text-teal-700 mb-3 flex items-center gap-2"><HiTruck className="w-4 h-4" /> Lotes</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-2xl font-bold text-green-600">{resultado.lotes.creados}</p><p className="text-xs text-gray-500">Creados</p></div>
                <div><p className="text-2xl font-bold text-blue-500">{resultado.lotes.saltados}</p><p className="text-xs text-gray-500">Ya existían</p></div>
                <div><p className={`text-2xl font-bold ${(resultado.lotes.errores?.length ?? 0) > 0 ? 'text-red-500' : 'text-gray-300'}`}>{resultado.lotes.errores?.length ?? 0}</p><p className="text-xs text-gray-500">Errores</p></div>
              </div>
            </div>
          </div>

          {/* Detalle de errores */}
          {(() => {
            const errDump = resultado.dumpadas?.errores ?? [];
            const errMez  = resultado.mezclas?.errores  ?? [];
            const errLote = resultado.lotes?.errores    ?? [];
            const total   = errDump.length + errMez.length + errLote.length;
            if (total === 0) return null;
            return (
              <div className="max-w-3xl mx-auto w-full border border-red-200 rounded-xl overflow-hidden">
                <div className="bg-red-50 px-4 py-3 flex items-center gap-2">
                  <HiExclamationTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="font-bold text-red-700 text-sm">{total} error{total !== 1 ? 'es' : ''} — detalle</p>
                </div>
                <div className="divide-y divide-red-100 bg-white text-xs">
                  {errDump.map((e, i) => (
                    <div key={`d-${i}`} className="px-4 py-2.5 flex gap-3">
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-semibold whitespace-nowrap">Dump #{e.numero_dumpada ?? i}</span>
                      <span className="text-gray-700">{e.error}</span>
                    </div>
                  ))}
                  {errMez.map((e, i) => (
                    <div key={`m-${i}`} className="px-4 py-2.5 flex gap-3">
                      <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 px-2 py-0.5 rounded font-semibold whitespace-nowrap">Mezcla {e.codigo ?? i}</span>
                      <span className="text-gray-700">{e.error}</span>
                    </div>
                  ))}
                  {errLote.map((e, i) => (
                    <div key={`l-${i}`} className="px-4 py-2.5 flex gap-3">
                      <span className="inline-flex items-center gap-1 bg-teal-100 text-teal-700 px-2 py-0.5 rounded font-semibold whitespace-nowrap">Lote {e.numero_lote ?? i}</span>
                      <span className="text-gray-700">{e.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="flex items-center justify-center gap-4 pt-2">
            <button onClick={resetear}
              className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors">
              Importar otro archivo
            </button>
            <button onClick={() => setVistaActual('despachos')}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm">
              <HiArrowRight className="w-4 h-4" /> Ver en Despachos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
