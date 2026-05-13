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
const COL_DB = {
  punto: 2, tipo: 3, numero_dumpada: 4, acopios: 5, jornada: 6,
  fecha: 7, ton: 8, ley: 9, ley_cup: 10, certificado: 11, ley_visual: 13, rango: 14,
};
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const STEPS = ['Subir Excel', 'Revisar', 'Resultado'];

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

function parsearLotes(rows) {
  const lotes = [];
  let actual = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const colR = r[17], colS = r[18];

    // Trigger 1: "N°Lote" en columna R (formato estándar)
    if (typeof colR === 'string' && colR.trim() === 'N°Lote') {
      if (actual) lotes.push(actual);
      let plantaDestino = null;
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        const prev = rows[j][17];
        if (prev != null) {
          const s = String(prev).trim().replace(/[\r\n]+/g, ' ');
          if (s && s !== 'N°Lote' && s !== '-' && !/^\d+$/.test(s)) { plantaDestino = s; break; }
        }
      }
      actual = { numero_lote: null, empresa_nombre: null, planta_destino: plantaDestino, camionadas: [], _rVals: [] };
      continue;
    }

    // Trigger 2: "Camionada" en columna S (bloques sin encabezado N°Lote)
    if (colS != null && String(colS).trim().toLowerCase() === 'camionada') {
      if (actual) lotes.push(actual);
      const empresaHeader = colR != null ? String(colR).trim() : null;
      actual = { numero_lote: null, empresa_nombre: empresaHeader || null, planta_destino: null, camionadas: [], _rVals: [] };
      continue;
    }

    if (!actual) continue;
    const numCam = typeof colS === 'number' && Number.isInteger(colS) && colS > 0
      ? colS : (typeof colS === 'string' && /^\d+$/.test(colS.trim()) ? parseInt(colS) : null);
    if (!numCam) continue;
    if (colR != null) {
      const rStr = String(colR).trim().replace(/[\r\n]+/g, ' ');
      if (rStr && rStr !== 'N°Lote') actual._rVals.push(rStr);
    }
    const patente = r[20] != null ? String(r[20]).trim() : null;
    const pesoRaw = r[24];
    const peso = typeof pesoRaw === 'number' ? pesoRaw : parseFloat(String(pesoRaw ?? ''));
    if (!patente && (isNaN(peso) || peso <= 0)) continue;
    const toISO = (v) => { if (!v) return null; if (v instanceof Date) return v.toISOString(); return String(v); };
    actual.camionadas.push({
      numero_camionada: numCam,
      ticket:          r[19] != null ? String(r[19]).trim() || null : null,
      patente:         patente || null,
      fecha_despacho:  toISO(r[21]),
      fecha_recepcion: toISO(r[22]),
      hora:            r[23] != null ? String(r[23]).trim() || null : null,
      peso:            isNaN(peso) ? null : peso,
      ley_mezcla:      safeLey(r[25]),
      ley_visual:      safeLey(r[26]),
      mezcla_codigo:   r[27] != null ? String(r[27]).trim() || null : null,
      ley_lab_camion:  safeLey(r[28]),
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
  }
  return lotes.filter(l => l.camionadas.length > 0);
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
    let resMezclas  = { creadas: 0, saltadas: 0, errores: [] };
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
          resMezclas.creadas  += r.creadas  ?? 0;
          resMezclas.saltadas += r.saltadas ?? 0;
          resMezclas.errores   = [...resMezclas.errores, ...(r.errores ?? [])];
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

          {(sinEmpresa > 0 || sinPlanta > 0) && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <HiExclamationTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>
                {sinEmpresa > 0 && <><span className="font-semibold">{sinEmpresa} lote(s) sin empresa.</span>{' '}</>}
                {sinPlanta  > 0 && <><span className="font-semibold">{sinPlanta} lote(s) sin planta.</span>{' '}</>}
                Asigna manualmente abajo.
              </p>
            </div>
          )}

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
                          <option value="">— {l.planta_destino ? `"${l.planta_destino}"` : 'Sin planta'} —</option>
                          {plantasDB.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}{p.codigo ? ` (${p.codigo})` : ''}</option>)}
                        </select>
                        <select value={empresaOverrides[l.numero_lote] ?? ''}
                          onChange={e => setEmpresaOverrides(p => ({ ...p, [l.numero_lote]: e.target.value }))}
                          className={`text-xs border rounded px-2 py-1 w-40 ${!empresaOverrides[l.numero_lote] ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-700'}`}>
                          <option value="">— {l.empresa_nombre ? `"${l.empresa_nombre}"` : 'Sin empresa'} —</option>
                          {empresasDB.map(e => <option key={e.id} value={String(e.id)}>{e.nombre}</option>)}
                        </select>
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
