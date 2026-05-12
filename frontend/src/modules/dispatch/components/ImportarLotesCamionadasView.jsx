import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  HiArrowUpTray, HiCheckCircle, HiExclamationTriangle,
  HiArrowLeft, HiArrowRight, HiDocumentArrowUp, HiTableCells, HiCheckBadge,
  HiTruck, HiChevronRight, HiChevronDown, HiBeaker, HiCalendar, HiXMark,
} from 'react-icons/hi2';
import { useFaena } from '../../../contexts/FaenaContext';
import dispatchService from '../services/dispatch';

const HOJA_MEZCLAS = 'Mezcla';

const colLetra = (idx) =>
  idx < 26 ? String.fromCharCode(65 + idx) : 'A' + String.fromCharCode(65 + idx - 26);

const CAMPOS_CAM = [
  { label: 'N° Camionada',    colIdx: 18 },
  { label: 'Ticket',          colIdx: 19 },
  { label: 'Patente',         colIdx: 20 },
  { label: 'Fecha Despacho',  colIdx: 21 },
  { label: 'Peso (ton)',      colIdx: 24 },
  { label: 'Ley mezcla',     colIdx: 25 },
  { label: 'Ley visual',     colIdx: 26 },
  { label: 'Mezcla origen',  colIdx: 27 },
  { label: 'Ley lab camión', colIdx: 28 },
];

const STEPS = ['Configurar', 'Revisar', 'Resultado'];

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
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed) > 999 ? { tipo: 'numero_lote', valor: trimmed } : { tipo: 'desconocido', valor: trimmed };
  }
  if (!trimmed.includes(' ') && /[A-Za-z]/.test(trimmed) && /\d/.test(trimmed)) {
    return { tipo: 'numero_lote', valor: trimmed };
  }
  return { tipo: 'empresa', valor: trimmed };
}

// ── Helpers para parsear la sección de mezclas del Excel (cols H-P) ──

// Detecta qué columnas contienen las leyes según el formato del archivo
function detectarMapeoLeyes(rows) {
  let esCatemu = false;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    for (let c = 11; c <= 15; c++) {
      const v = r[c] !== null && r[c] !== undefined ? String(r[c]).trim().toLowerCase() : '';
      if (v.includes('soluble') || v.includes('insoluble')) { esCatemu = true; break; }
    }
    if (esCatemu) break;
  }
  if (!esCatemu) return { ley_dump: 11, ley_visual: 12, ley_lote: 13 };
  let sumInsol = 0, sumSol = 0;
  for (const r of rows) {
    const hStr = r[7] !== null && r[7] !== undefined ? String(r[7]).trim() : '';
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

// Detecta si una fila es el encabezado de una mezcla (col H vacía, col I = código como "CN001")
function esCabeceraMezclaExcel(colH, colI) {
  if (colH !== null && colH !== undefined && String(colH).trim() !== '') return false;
  const iStr = colI !== null && colI !== undefined ? String(colI).trim() : '';
  return iStr !== '' && isNaN(parseFloat(iStr)) && !iStr.includes(' ') && iStr.length <= 10;
}

// Parsea la sección izquierda (cols H-P) de la hoja Mezcla y retorna Map<codigo, {dumpadas}>
function parsearMezclasExcel(rows) {
  const leyCOL = detectarMapeoLeyes(rows);
  const map = {};
  let codigoActual = null;

  for (const r of rows) {
    const colH = r[7];  // col H: numero_dumpada
    const colI = r[8];  // col I: codigo_mezcla
    const colK = r[10]; // col K: toneladas

    if (esCabeceraMezclaExcel(colH, colI)) {
      codigoActual = String(colI).trim();
      if (!map[codigoActual]) map[codigoActual] = { dumpadas: [] };
      continue;
    }
    if (!codigoActual) continue;

    const hStr = colH !== null && colH !== undefined ? String(colH).trim() : '';
    if (!hStr || isNaN(parseFloat(hStr))) continue;

    const ton = typeof colK === 'number' ? colK : parseFloat(String(colK ?? '').replace(',', '.'));
    if (isNaN(ton) || ton <= 0) continue;

    map[codigoActual].dumpadas.push({
      numero_dumpada: hStr,
      origen: r[9] != null ? String(r[9]).trim() : '',
      toneladas: ton,
      ley_dump:   safeLey(r[leyCOL.ley_dump]),
      ley_visual: safeLey(r[leyCOL.ley_visual]),
      ley_lote:   safeLey(r[leyCOL.ley_lote]),
    });
  }
  return map;
}

// Agrupa camionadas por mezcla_codigo preservando orden de aparición
function agruparPorMezcla(camionadas) {
  const map = new Map();
  for (const cam of camionadas) {
    const key = cam.mezcla_codigo || '__sin_mezcla__';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(cam);
  }
  return map;
}

function wAvg(items, field) {
  const valid = items.filter(d => d[field] != null && (d.toneladas ?? 0) > 0);
  if (!valid.length) return null;
  const tot = valid.reduce((s, d) => s + d.toneladas, 0);
  return tot ? valid.reduce((s, d) => s + d[field] * d.toneladas, 0) / tot : null;
}

function normStr(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

function formatFechaCL(dateStr) {
  if (!dateStr) return '—';
  try {
    const s = String(dateStr).includes('T') ? dateStr : dateStr + 'T12:00:00';
    return new Date(s).toLocaleDateString('es-CL');
  } catch { return String(dateStr); }
}

function parsearLotes(rows) {
  const lotes = [];
  let actual = null;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const colR = r[17];
    const colS = r[18];

    const esHeader = typeof colR === 'string' && colR.trim() === 'N°Lote';
    if (esHeader) {
      if (actual) lotes.push(actual);

      let plantaDestino = null;
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        const prev = rows[j][17];
        if (prev !== null && prev !== undefined) {
          const s = String(prev).trim().replace(/[\r\n]+/g, ' ');
          if (s && s !== 'N°Lote' && s !== '-') {
            if (!/^\d+$/.test(s)) {
              plantaDestino = s;
              break;
            }
          }
        }
      }

      actual = {
        numero_lote: null,
        empresa_nombre: null,
        planta_destino: plantaDestino,
        camionadas: [],
        _rVals: [],
        _firstCamRow: null,
      };
      continue;
    }

    if (!actual) continue;

    const numCam = typeof colS === 'number' && Number.isInteger(colS) && colS > 0
      ? colS
      : (typeof colS === 'string' && /^\d+$/.test(colS.trim()) ? parseInt(colS) : null);

    if (!numCam) continue;

    if (colR !== null && colR !== undefined) {
      const rStr = String(colR).trim().replace(/[\r\n]+/g, ' ');
      if (rStr && rStr !== 'N°Lote') actual._rVals.push(rStr);
    }

    const patente  = r[20] != null ? String(r[20]).trim() : null;
    const pesoRaw  = r[24];
    const peso     = typeof pesoRaw === 'number' ? pesoRaw : parseFloat(String(pesoRaw ?? ''));

    if (!patente && (isNaN(peso) || peso <= 0)) continue;

    const toISO = (v) => {
      if (!v) return null;
      if (v instanceof Date) return v.toISOString();
      return String(v);
    };

    const camRow = {
      numero_camionada: numCam,
      ticket:           r[19] != null ? String(r[19]).trim() || null : null,
      patente:          patente || null,
      fecha_despacho:   toISO(r[21]),
      fecha_recepcion:  toISO(r[22]),
      hora:             r[23] != null ? String(r[23]).trim() || null : null,
      peso:             isNaN(peso) ? null : peso,
      ley_mezcla:       safeLey(r[25]),
      ley_visual:       safeLey(r[26]),
      mezcla_codigo:    r[27] != null ? String(r[27]).trim() || null : null,
      ley_lab_camion:   safeLey(r[28]),
    };

    if (!actual._firstCamRow) actual._firstCamRow = r;
    actual.camionadas.push(camRow);
  }

  if (actual) lotes.push(actual);

  for (const lote of lotes) {
    for (const val of lote._rVals) {
      const clasif = clasificarRVal(val);
      if (!clasif) continue;
      if (clasif.tipo === 'numero_lote' && !lote.numero_lote) {
        lote.numero_lote = clasif.valor;
      } else if (clasif.tipo === 'empresa' && !lote.empresa_nombre) {
        lote.empresa_nombre = clasif.valor;
      }
    }
    delete lote._rVals;
  }

  return lotes.filter(l => l.camionadas.length > 0);
}

export default function ImportarLotesCamionadasView({ toast, setVistaActual }) {
  const { faenaUsuario, faenas } = useFaena();
  const faenaId = faenaUsuario?.id ?? faenaUsuario;

  const [step, setStep]               = useState(0);
  const [archivoNombre, setArchivoNombre] = useState('');
  const [parseando, setParseando]     = useState(false);
  const [importando, setImportando]   = useState(false);

  const [lotesTemp, setLotesTemp]         = useState(null);
  const [colData, setColData]             = useState(null);

  const [lotesPreview, setLotesPreview]   = useState([]);
  const [lotesParseados, setLotesParseados] = useState([]);
  const [empresasDB, setEmpresasDB]       = useState([]);
  const [plantasDB, setPlantasDB]         = useState([]);
  const [mezclasDetalle, setMezclasDetalle] = useState({});
  const [mezclasExcel, setMezclasExcel]     = useState({});
  const [modalMezcla, setModalMezcla]       = useState(null); // { codigo, dumpadas, fromDB, porFecha }

  const [seleccionadas, setSeleccionadas]       = useState({});
  const [empresaOverrides, setEmpresaOverrides] = useState({});
  const [plantaOverrides, setPlantaOverrides]   = useState({});
  const [expandidosStep0, setExpandidosStep0]   = useState({});
  const [expandidosStep1, setExpandidosStep1]   = useState({});

  const [resultado, setResultado]   = useState(null);
  const [avisoFaena, setAvisoFaena] = useState(null);
  const [mesAnio, setMesAnio]       = useState(null);
  const [loadingMsg, setLoadingMsg] = useState('');

  const dropRef  = useRef(null);
  const inputRef = useRef(null);

  // ── Fase 1: parseo local ─────────────────────────────────────────────
  const parsearArchivo = useCallback(async (file) => {
    setArchivoNombre(file.name);
    setColData(null);
    setLotesTemp(null);
    setAvisoFaena(null);

    // Validar que el nombre del archivo corresponda a la faena activa
    const faenaActual = faenas.find(f => f.id == faenaId);
    if (faenaActual) {
      const nomFaena = faenaActual.ubicacion || faenaActual.nombre || '';
      if (nomFaena && !normStr(file.name).includes(normStr(nomFaena))) {
        setAvisoFaena(`El archivo "${file.name}" no parece corresponder a la faena "${nomFaena}". Verifica que sea el Excel correcto antes de continuar.`);
      }
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
      const mesRaw = row2[0], anioRaw = row2[1];
      setMesAnio(mesRaw && anioRaw ? { mes: String(mesRaw).trim(), anio: String(anioRaw).trim() } : null);

      const lotesArr = parsearLotes(rows);
      setMezclasExcel(parsearMezclasExcel(rows));

      if (lotesArr.length === 0) {
        toast?.error('No se encontraron lotes válidos con camionadas en la hoja "Mezcla"');
        setParseando(false);
        return;
      }

      const firstCamRow = lotesArr.find(l => l._firstCamRow)?._firstCamRow
        ?? rows.find(r => typeof r[18] === 'number' && r[18] > 0 && (r[20] || r[24]));

      setColData({ firstCamRow });
      setLotesTemp({ lotesArr });
    } catch (err) {
      console.error(err);
      toast?.error('Error al leer el archivo: ' + err.message);
    }
    setParseando(false);
  }, [toast]);

  // ── Fase 2: validar con backend ──────────────────────────────────────
  const handleContinuar = useCallback(async () => {
    if (!lotesTemp) return;
    setLoadingMsg('Validando con la base de datos…');
    setParseando(true);
    try {
      const res = await dispatchService.importarLotesPreview(faenaId, lotesTemp.lotesArr);
      setLotesPreview(res.lotes ?? []);
      setLotesParseados(lotesTemp.lotesArr);
      setEmpresasDB(res.empresas ?? []);
      setPlantasDB(res.plantas ?? []);
      setMezclasDetalle(res.mezclas_detalle ?? {});

      const sel = {};
      const empOvr = {};
      const pltOvr = {};
      (res.lotes ?? []).forEach(l => {
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
  }, [faenaId, lotesTemp, toast]);

  // ── Drag & Drop ──────────────────────────────────────────────────────
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dropRef.current?.classList.remove('border-emerald-400', 'bg-emerald-50');
    const file = e.dataTransfer.files[0];
    if (file) parsearArchivo(file);
  }, [parsearArchivo]);

  const handleDragOver  = (e) => { e.preventDefault(); dropRef.current?.classList.add('border-emerald-400', 'bg-emerald-50'); };
  const handleDragLeave = ()  => { dropRef.current?.classList.remove('border-emerald-400', 'bg-emerald-50'); };

  // ── Importar ─────────────────────────────────────────────────────────
  const handleImportar = async () => {
    const selArr = lotesParseados.filter(l => seleccionadas[l.numero_lote]);
    if (selArr.length === 0) {
      toast?.error('Selecciona al menos un lote para importar');
      return;
    }
    setLoadingMsg(`Importando ${selArr.length} lote${selArr.length !== 1 ? 's' : ''}…`);
    setImportando(true);
    try {
      const res = await dispatchService.importarLotesConfirmar(faenaId, selArr, empresaOverrides, plantaOverrides);
      setResultado(res);
      setStep(2);
    } catch (err) {
      toast?.error('Error al importar: ' + (err.response?.data?.message || err.message));
    }
    setImportando(false);
  };

  const resetear = () => {
    setStep(0);
    setArchivoNombre('');
    setLotesTemp(null);
    setColData(null);
    setLotesPreview([]);
    setLotesParseados([]);
    setSeleccionadas({});
    setEmpresaOverrides({});
    setPlantaOverrides({});
    setExpandidosStep0({});
    setExpandidosStep1({});
    setMezclasDetalle({});
    setMezclasExcel({});
    setResultado(null);
    setAvisoFaena(null);
    setMesAnio(null);
  };

  const totalSel   = Object.values(seleccionadas).filter(Boolean).length;
  const existentes = lotesPreview.filter(l => l.existe).length;
  const nuevos     = lotesPreview.filter(l => !l.existe).length;
  const sinEmpresa = lotesPreview.filter(l => !empresaOverrides[l.numero_lote]).length;
  const sinPlanta  = lotesPreview.filter(l => !plantaOverrides[l.numero_lote]).length;
  const conMezclasErr = lotesPreview.filter(l => (l.mezclas_no_encontradas?.length ?? 0) > 0).length;
  const todosMezclasNoEncontradas = [...new Set(
    lotesPreview.flatMap(l => l.mezclas_no_encontradas ?? [])
  )];

  return (
    <div className="space-y-6 relative">

      {/* Overlay de carga */}
      {(parseando || importando) && (
        <div className="absolute inset-0 z-20 bg-white/75 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center gap-4 min-h-[200px]">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-200 border-t-emerald-600" />
          <p className="text-sm font-semibold text-emerald-700">{loadingMsg}</p>
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, idx) => (
          <div key={idx} className="flex items-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors
              ${idx === step ? 'bg-emerald-600 text-white shadow-sm' :
                idx < step  ? 'bg-emerald-100 text-emerald-700' :
                              'bg-gray-100 text-gray-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                ${idx === step ? 'bg-white/30' :
                  idx < step  ? 'bg-emerald-300 text-emerald-700' :
                                'bg-gray-300 text-gray-500'}`}>
                {idx < step ? '✓' : idx + 1}
              </span>
              {s}
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-px w-6 mx-1 ${idx < step ? 'bg-emerald-300' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── PASO 0: CONFIGURAR ── */}
      {step === 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Drop zone */}
            <div className="lg:col-span-2">
              <div
                ref={dropRef}
                onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer transition-all duration-150 hover:border-emerald-300 hover:bg-emerald-50/40 group"
              >
                <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => e.target.files[0] && parsearArchivo(e.target.files[0])} />
                {parseando ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
                    <p className="text-gray-500 text-sm">Leyendo hoja "Mezcla"…</p>
                  </div>
                ) : archivoNombre ? (
                  <div className="flex flex-col items-center gap-3">
                    <HiCheckCircle className="w-12 h-12 text-green-500" />
                    <p className="font-semibold text-gray-700">{archivoNombre}</p>
                    {mesAnio && (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-semibold">
                        <HiCalendar className="w-3.5 h-3.5" />
                        {mesAnio.mes} {mesAnio.anio}
                      </span>
                    )}
                    <p className="text-sm text-gray-400">Haz clic para cambiar el archivo</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <HiDocumentArrowUp className="w-14 h-14 text-gray-300 group-hover:text-emerald-400 transition-colors" />
                    <p className="font-semibold text-gray-600 text-lg">Arrastra tu archivo Excel aquí</p>
                    <p className="text-sm text-gray-400">o haz clic para seleccionarlo</p>
                    <p className="text-xs text-gray-300 mt-1">La hoja debe llamarse <span className="font-mono font-bold">Mezcla</span></p>
                  </div>
                )}
              </div>
            </div>

            {/* Panel info */}
            <div className="space-y-5">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-xs text-emerald-700 space-y-1.5">
                <p className="font-bold">¿Qué se importará?</p>
                <p>• Lotes de venta y camionadas desde la hoja <span className="font-mono font-bold">Mezcla</span></p>
                <p>• Un lote por cada bloque "N°Lote" detectado</p>
                <p>• La planta de cada lote se lee del Excel y se cruza con la BD</p>
                <p>• Solo se importan filas con patente o peso registrado</p>
                <p>• Vincula automáticamente cada camionada a su mezcla (col. AB)</p>
                <p>• Actualiza toneladas despachadas/disponibles en las mezclas</p>
              </div>
            </div>
          </div>

          {/* Aviso de faena */}
          {avisoFaena && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <HiExclamationTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>{avisoFaena}</p>
            </div>
          )}

          {/* Panel columnas detectadas */}
          {colData && lotesTemp && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                  <HiTableCells className="w-4 h-4 text-emerald-400" />
                  <p className="font-bold text-gray-700 text-sm">Columnas detectadas</p>
                  <span className="ml-auto text-xs text-gray-400 font-semibold tabular-nums">
                    {lotesTemp.lotesArr.length} lotes · {lotesTemp.lotesArr.reduce((s, l) => s + l.camionadas.length, 0)} camionadas
                  </span>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                        <th className="px-4 py-2 text-left font-semibold">Campo</th>
                        <th className="px-4 py-2 text-left font-semibold">Col. Excel</th>
                        <th className="px-4 py-2 text-left font-semibold">Ejemplo (1ª camionada)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {CAMPOS_CAM.map(({ label, colIdx }) => {
                        const rawVal = colData.firstCamRow ? colData.firstCamRow[colIdx] : null;
                        let ejemplo = '—';
                        if (rawVal !== null && rawVal !== undefined) {
                          if (label.startsWith('Ley')) {
                            const v = safeLey(rawVal);
                            ejemplo = v !== null ? `${v.toFixed(3)}%` : '—';
                          } else if (rawVal instanceof Date) {
                            ejemplo = rawVal.toLocaleDateString('es-CL');
                          } else {
                            ejemplo = String(rawVal);
                          }
                        }
                        return (
                          <tr key={label} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-semibold text-gray-700 text-sm">{label}</td>
                            <td className="px-4 py-2">
                              <span className="font-mono text-xs font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                                {colLetra(colIdx)}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-600">{ejemplo}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-100 text-xs text-emerald-700">
                  Si los datos se ven correctos, haz clic en <strong>Continuar</strong> para validar con la base de datos.
                </div>
              </div>

              {/* Resumen de lotes detectados — agrupado por mezcla */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="font-bold text-gray-700 text-sm">Lotes detectados en el Excel</p>
                  <p className="text-xs text-gray-400 mt-0.5">Expande un lote para ver sus mezclas de origen y camionadas</p>
                </div>
                <div className="overflow-auto max-h-[600px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                        <th className="px-3 py-2 w-6"></th>
                        <th className="px-3 py-2 text-left font-semibold">N°Lote</th>
                        <th className="px-3 py-2 text-left font-semibold">Mes</th>
                        <th className="px-3 py-2 text-left font-semibold">Empresa (Excel)</th>
                        <th className="px-3 py-2 text-left font-semibold">Planta destino</th>
                        <th className="px-3 py-2 text-right font-semibold">Camionadas</th>
                        <th className="px-3 py-2 text-right font-semibold">Mezclas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lotesTemp.lotesArr.map((l, idx) => {
                        const key = l.numero_lote ?? `idx-${idx}`;
                        const abierto = !!expandidosStep0[key];
                        const grupos = agruparPorMezcla(l.camionadas);
                        const numMezclas = [...grupos.keys()].filter(k => k !== '__sin_mezcla__').length;
                        return (
                          <>
                            <tr
                              key={key}
                              onClick={() => setExpandidosStep0(prev => ({ ...prev, [key]: !prev[key] }))}
                              className="hover:bg-emerald-50 cursor-pointer select-none"
                            >
                              <td className="px-3 py-1.5 text-gray-400">
                                {abierto
                                  ? <HiChevronDown className="w-3.5 h-3.5" />
                                  : <HiChevronRight className="w-3.5 h-3.5" />}
                              </td>
                              <td className="px-3 py-1.5 font-mono font-bold text-gray-800">
                                {l.numero_lote ?? <span className="text-amber-500 italic">sin número</span>}
                              </td>
                              <td className="px-3 py-1.5">
                                {(() => {
                                  const f = l.camionadas[0]?.fecha_despacho;
                                  if (!f) return <span className="text-gray-300">—</span>;
                                  const d = new Date(f);
                                  const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                                  return (
                                    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded text-xs font-semibold">
                                      <HiCalendar className="w-3 h-3" />
                                      {MESES_CORTO[d.getMonth()]} {d.getFullYear()}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="px-3 py-1.5 text-gray-600">{l.empresa_nombre ?? '—'}</td>
                              <td className="px-3 py-1.5 text-gray-500">{l.planta_destino ?? '—'}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-gray-600 font-semibold">{l.camionadas.length}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">
                                <span className="bg-emerald-100 text-emerald-700 font-semibold px-1.5 py-0.5 rounded">
                                  {numMezclas}
                                </span>
                              </td>
                            </tr>
                            {abierto && (
                              <tr key={`${key}-detail`}>
                                <td colSpan={7} className="p-0 bg-slate-50">
                                  <div className="px-4 py-3 space-y-3">
                                    {/* Tabla plana de camionadas con columna de mezcla */}
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                                          <th className="px-3 py-1.5 text-left font-semibold">N° Cam</th>
                                          <th className="px-3 py-1.5 text-left font-semibold">Patente</th>
                                          <th className="px-3 py-1.5 text-left font-semibold">Fecha despacho</th>
                                          <th className="px-3 py-1.5 text-right font-semibold">Peso (ton)</th>
                                          <th className="px-3 py-1.5 text-right font-semibold">Ley mezcla</th>
                                          <th className="px-3 py-1.5 text-left font-semibold">Mezcla origen</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {l.camionadas.map((c, ci) => (
                                          <tr key={ci} className="hover:bg-emerald-50/30">
                                            <td className="px-3 py-1 font-mono font-semibold text-gray-700">{c.numero_camionada}</td>
                                            <td className="px-3 py-1 text-gray-700">{c.patente ?? '—'}</td>
                                            <td className="px-3 py-1 text-gray-500">{formatFechaCL(c.fecha_despacho)}</td>
                                            <td className="px-3 py-1 text-right tabular-nums text-gray-700">{c.peso != null ? c.peso.toFixed(2) : '—'}</td>
                                            <td className="px-3 py-1 text-right tabular-nums text-emerald-700 font-semibold">
                                              {c.ley_mezcla != null ? `${c.ley_mezcla.toFixed(3)}%` : '—'}
                                            </td>
                                            <td className="px-3 py-1">
                                              {c.mezcla_codigo
                                                ? <span className="font-mono text-xs bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">{c.mezcla_codigo}</span>
                                                : <span className="text-gray-300">—</span>}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    {/* Resumen de mezclas usadas */}
                                    {numMezclas > 0 && (
                                      <div className="border-t border-emerald-100 pt-2">
                                        <p className="text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1.5">
                                          <HiBeaker className="w-3.5 h-3.5 text-amber-500" />
                                          Mezclas — lote <span className="font-mono text-gray-700">{key}</span>
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                          {[...grupos.entries()].filter(([k]) => k !== '__sin_mezcla__').map(([cod, cams]) => {
                                            const dExcel = mezclasExcel[cod]?.dumpadas ?? [];
                                            const ton = cams.reduce((s, c) => s + (c.peso ?? 0), 0);
                                            return (
                                              <div key={cod} className="flex items-center gap-2 bg-white border border-emerald-200 rounded-lg px-3 py-1.5 text-xs shadow-sm">
                                                <span className="font-mono font-bold text-emerald-800">{cod}</span>
                                                <span className="text-gray-400">{cams.length} cam · {ton.toFixed(1)} ton</span>
                                                {dExcel.length > 0 && (
                                                  <button
                                                    onClick={() => setModalMezcla({ codigo: cod, dumpadas: dExcel, fromDB: false, porFecha: {} })}
                                                    className="flex items-center gap-1 text-amber-600 hover:text-amber-800 font-semibold border-l border-gray-200 pl-2"
                                                  >
                                                    <HiBeaker className="w-3 h-3" />{dExcel.length} dump.
                                                  </button>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={handleContinuar} disabled={parseando}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm">
                  {parseando ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Validando…</>
                  ) : (
                    <>Continuar y validar<HiArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PASO 1: REVISAR ── */}
      {step === 1 && (
        <div className="space-y-5">

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Lotes en Excel',        val: lotesPreview.length,    color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
              { label: 'Nuevos (a importar)',   val: nuevos,                 color: 'text-green-600',   bg: 'bg-green-50 border-green-100' },
              { label: 'Ya existen en BD',      val: existentes,             color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-100' },
              { label: 'Sin empresa/planta',    val: sinEmpresa + sinPlanta, color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100' },
              { label: 'Con mezclas faltantes', val: conMezclasErr,          color: conMezclasErr > 0 ? 'text-orange-600' : 'text-gray-400', bg: conMezclasErr > 0 ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100' },
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
                {sinEmpresa > 0 && <><span className="font-semibold">{sinEmpresa} lote(s) sin empresa reconocida.</span>{' '}</>}
                {sinPlanta  > 0 && <><span className="font-semibold">{sinPlanta} lote(s) sin planta reconocida.</span>{' '}</>}
                Asigna manualmente en las columnas correspondientes. Los lotes sin empresa o planta serán omitidos.
              </p>
            </div>
          )}

          {todosMezclasNoEncontradas.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-3">
                <HiExclamationTriangle className="w-5 h-5 flex-shrink-0 text-orange-500 mt-0.5" />
                <div className="text-sm text-orange-800">
                  <p>
                    <span className="font-semibold">{conMezclasErr} lote(s) tienen camionadas con códigos de mezcla no encontrados en la BD.</span>{' '}
                    Esas camionadas se importarán sin vínculo a mezcla (toneladas despachadas no se actualizarán).
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {todosMezclasNoEncontradas.map(cod => (
                      <span key={cod} className="font-mono text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded">
                        {cod}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HiTruck className="w-4 h-4 text-gray-400" />
                <p className="font-bold text-gray-700 text-sm">Lotes detectados</p>
                <span className="text-xs text-gray-400">— expande para ver mezclas de origen y dumpadas</span>
              </div>
              <div className="flex gap-2 text-xs">
                <button onClick={() => {
                  const s = {};
                  lotesPreview.forEach(l => { s[l.numero_lote] = !l.existe; });
                  setSeleccionadas(s);
                }} className="text-emerald-600 hover:underline font-semibold">Solo nuevos</button>
                <span className="text-gray-300">|</span>
                <button onClick={() => {
                  const s = {};
                  lotesPreview.forEach(l => { s[l.numero_lote] = true; });
                  setSeleccionadas(s);
                }} className="text-emerald-600 hover:underline font-semibold">Todos</button>
                <span className="text-gray-300">|</span>
                <button onClick={() => {
                  const s = {};
                  lotesPreview.forEach(l => { s[l.numero_lote] = false; });
                  setSeleccionadas(s);
                }} className="text-gray-400 hover:underline">Ninguno</button>
              </div>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide sticky top-0">
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2 text-left font-semibold">N°Lote</th>
                    <th className="px-3 py-2 text-left font-semibold">Planta</th>
                    <th className="px-3 py-2 text-left font-semibold">Empresa</th>
                    <th className="px-3 py-2 text-right font-semibold">Camionadas</th>
                    <th className="px-3 py-2 text-left font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lotesPreview.map(l => {
                    const isExpanded = !!expandidosStep1[l.numero_lote];
                    const parsedLote = lotesParseados.find(lp => lp.numero_lote === l.numero_lote);
                    const grupos = parsedLote ? agruparPorMezcla(parsedLote.camionadas) : new Map();
                    return (
                      <>
                        <tr key={l.numero_lote} className={`hover:bg-gray-50 ${!seleccionadas[l.numero_lote] ? 'opacity-40' : ''}`}>
                          <td className="px-3 py-2">
                            <input type="checkbox"
                              checked={!!seleccionadas[l.numero_lote]}
                              onChange={e => setSeleccionadas(prev => ({ ...prev, [l.numero_lote]: e.target.checked }))}
                              className="accent-emerald-600 w-4 h-4" />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => setExpandidosStep1(prev => ({ ...prev, [l.numero_lote]: !prev[l.numero_lote] }))}
                              className="flex items-center gap-1 font-mono font-bold text-gray-800 hover:text-emerald-700 transition-colors"
                            >
                              {isExpanded
                                ? <HiChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />
                                : <HiChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />}
                              {l.numero_lote || <span className="text-amber-500 italic text-xs">sin número</span>}
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={plantaOverrides[l.numero_lote] ?? ''}
                              onChange={e => setPlantaOverrides(prev => ({ ...prev, [l.numero_lote]: e.target.value }))}
                              className={`text-xs border rounded px-2 py-1 w-full max-w-[180px] ${
                                !plantaOverrides[l.numero_lote]
                                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                                  : 'border-gray-200 bg-white text-gray-700'
                              }`}
                            >
                              <option value="">— {l.planta_destino ? `"${l.planta_destino}" sin match` : 'Sin planta'} —</option>
                              {plantasDB.map(p => (
                                <option key={p.id} value={String(p.id)}>{p.nombre}{p.codigo ? ` (${p.codigo})` : ''}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={empresaOverrides[l.numero_lote] ?? ''}
                              onChange={e => setEmpresaOverrides(prev => ({ ...prev, [l.numero_lote]: e.target.value }))}
                              className={`text-xs border rounded px-2 py-1 w-full max-w-[200px] ${
                                !empresaOverrides[l.numero_lote]
                                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                                  : 'border-gray-200 bg-white text-gray-700'
                              }`}
                            >
                              <option value="">— {l.empresa_nombre ? `"${l.empresa_nombre}" sin match` : 'Sin empresa'} —</option>
                              {empresasDB.map(e => (
                                <option key={e.id} value={String(e.id)}>{e.nombre}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                            <span className="font-semibold text-emerald-700">{l.camionadas_validas}</span>
                            <span className="text-gray-400">/{l.camionadas_total}</span>
                            {(l.mezclas_no_encontradas?.length ?? 0) > 0 && (
                              <span className="ml-1 text-amber-500 cursor-help"
                                title={`Mezclas no encontradas: ${l.mezclas_no_encontradas.join(', ')}`}>⚠</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {l.existe ? (
                              <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                                <HiCheckCircle className="w-3 h-3" /> Ya existe
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                                Nuevo
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* Fila expandida: camionadas + resumen mezclas */}
                        {isExpanded && parsedLote && (
                          <tr key={`${l.numero_lote}-detail`}>
                            <td colSpan={6} className="p-0 bg-slate-50 border-b border-gray-200">
                              <div className="px-4 py-3 space-y-3">
                                {/* Tabla plana de camionadas con columna de mezcla */}
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                                      <th className="px-3 py-1.5 text-left font-semibold">N° Cam</th>
                                      <th className="px-3 py-1.5 text-left font-semibold">Patente</th>
                                      <th className="px-3 py-1.5 text-left font-semibold">Fecha despacho</th>
                                      <th className="px-3 py-1.5 text-right font-semibold">Peso (ton)</th>
                                      <th className="px-3 py-1.5 text-right font-semibold">Ley mezcla</th>
                                      <th className="px-3 py-1.5 text-left font-semibold">Mezcla origen</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {parsedLote.camionadas.map((c, ci) => {
                                      const exMezcla = c.mezcla_codigo ? (mezclasDetalle[c.mezcla_codigo]?.existe ?? false) : false;
                                      return (
                                        <tr key={ci} className="hover:bg-gray-50">
                                          <td className="px-3 py-1 font-mono font-semibold text-gray-700">{c.numero_camionada}</td>
                                          <td className="px-3 py-1 text-gray-700">{c.patente ?? '—'}</td>
                                          <td className="px-3 py-1 text-gray-500">{formatFechaCL(c.fecha_despacho)}</td>
                                          <td className="px-3 py-1 text-right tabular-nums text-gray-700">{c.peso != null ? c.peso.toFixed(2) : '—'}</td>
                                          <td className="px-3 py-1 text-right tabular-nums text-emerald-700 font-semibold">
                                            {c.ley_mezcla != null ? `${c.ley_mezcla.toFixed(3)}%` : '—'}
                                          </td>
                                          <td className="px-3 py-1">
                                            {c.mezcla_codigo
                                              ? <span className={`font-mono text-xs px-1.5 py-0.5 rounded font-bold ${exMezcla ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}`}>{c.mezcla_codigo}</span>
                                              : <span className="text-gray-300">—</span>}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                                {/* Resumen de mezclas con botón para ver dumpadas */}
                                {grupos.size > 0 && (
                                  <div className="border-t border-gray-100 pt-2">
                                    <p className="text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1.5">
                                      <HiBeaker className="w-3.5 h-3.5 text-amber-500" />
                                      Mezclas — lote <span className="font-mono text-gray-700">{l.numero_lote}</span>
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {[...grupos.entries()].filter(([k]) => k !== '__sin_mezcla__').map(([cod, cams]) => {
                                        const detDB  = mezclasDetalle[cod];
                                        const existe = detDB?.existe ?? false;
                                        const dumpDB = detDB?.dumpadas ?? [];
                                        const dExcel = mezclasExcel[cod]?.dumpadas ?? [];
                                        const dumps  = existe ? dumpDB : dExcel;
                                        const ton    = cams.reduce((s, c) => s + (c.peso ?? 0), 0);
                                        const openModal = () => {
                                          if (existe) {
                                            const pf = {};
                                            for (const d of dumpDB) {
                                              const fk = d.fecha ?? 'Sin fecha';
                                              if (!pf[fk]) pf[fk] = [];
                                              pf[fk].push(d);
                                            }
                                            setModalMezcla({
                                              codigo: cod, dumpadas: dumpDB, fromDB: true, porFecha: pf,
                                              totalTon:     detDB?.total_ton,
                                              dispTon:      detDB?.toneladas_disponibles,
                                              leyPromDump:  detDB?.ley_prom_dump,
                                              leyPromVis:   detDB?.ley_prom_visual,
                                              leyProm:      detDB?.ley_prom_lote,
                                              leyLab:       detDB?.ley_lab,
                                            });
                                          } else {
                                            setModalMezcla({ codigo: cod, dumpadas: dExcel, fromDB: false, porFecha: {} });
                                          }
                                        };
                                        return (
                                          <div key={cod} className={`flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5 text-xs shadow-sm ${existe ? 'border-emerald-200' : 'border-orange-200'}`}>
                                            <span className={`font-mono font-bold ${existe ? 'text-emerald-800' : 'text-orange-800'}`}>{cod}</span>
                                            {existe
                                              ? <span className="text-green-600 font-semibold">✓ BD</span>
                                              : <span className="text-orange-500 font-semibold">≠ BD</span>}
                                            <span className="text-gray-400">{cams.length} cam · {ton.toFixed(1)} ton</span>
                                            {dumps.length > 0 && (
                                              <button onClick={openModal}
                                                className="flex items-center gap-1 text-amber-600 hover:text-amber-800 font-semibold border-l border-gray-200 pl-2">
                                                <HiBeaker className="w-3 h-3" />{dumps.length} dump.
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button onClick={resetear}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-semibold">
              <HiArrowLeft className="w-4 h-4" /> Volver
            </button>
            <button onClick={handleImportar} disabled={importando || totalSel === 0}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm">
              {importando ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Importando {totalSel} lotes…</>
              ) : (
                <><HiArrowUpTray className="w-4 h-4" />Importar {totalSel} lote{totalSel !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 2: RESULTADO ── */}
      {step === 2 && resultado && (
        <div className="space-y-6">
          <div className="flex flex-col items-center py-8 gap-4">
            {resultado.errores?.length === 0 ? (
              <HiCheckBadge className="w-20 h-20 text-green-500" />
            ) : (
              <HiExclamationTriangle className="w-20 h-20 text-yellow-500" />
            )}
            <h2 className="text-2xl font-bold text-gray-800">
              {resultado.errores?.length === 0 ? '¡Lotes importados!' : 'Importación con advertencias'}
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto">
            <div className="bg-green-50 border border-green-100 rounded-xl p-5 text-center">
              <p className="text-4xl font-bold text-green-600 tabular-nums">{resultado.creados}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Creados</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-center">
              <p className="text-4xl font-bold text-blue-500 tabular-nums">{resultado.saltados}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Ya existían</p>
            </div>
            <div className={`rounded-xl p-5 text-center border ${resultado.errores?.length > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
              <p className={`text-4xl font-bold tabular-nums ${resultado.errores?.length > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                {resultado.errores?.length ?? 0}
              </p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Errores</p>
            </div>
          </div>

          {resultado.errores?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
              <p className="px-4 py-3 font-bold text-red-700 text-sm border-b border-red-100">Detalles de errores</p>
              <div className="overflow-auto max-h-48">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-red-100/50 text-red-700">
                      <th className="px-4 py-2 text-left">N°Lote</th>
                      <th className="px-4 py-2 text-left">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {resultado.errores.map((e, i) => (
                      <tr key={i}>
                        <td className="px-4 py-1.5 font-mono font-semibold">{e.numero_lote}</td>
                        <td className="px-4 py-1.5 text-red-600">{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-4 pt-2">
            <button onClick={resetear}
              className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors">
              Importar otro archivo
            </button>
            <button onClick={() => setVistaActual('despachos')}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm">
              <HiArrowRight className="w-4 h-4" />
              Ver en Despachos
            </button>
          </div>
        </div>
      )}
      {/* Modal: composición de dumpadas de una mezcla */}
      {modalMezcla && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setModalMezcla(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <HiBeaker className="w-5 h-5 text-amber-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-gray-800">
                  Mezcla <span className="font-mono text-emerald-700">{modalMezcla.codigo}</span>
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    {modalMezcla.fromDB ? '— composición en BD' : '— composición del Excel'}
                  </span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {modalMezcla.dumpadas.length} dumpada{modalMezcla.dumpadas.length !== 1 ? 's' : ''}
                  {' · '}{modalMezcla.dumpadas.reduce((s, d) => s + (d.toneladas ?? 0), 0).toFixed(2)} ton en mezcla
                </p>
              </div>
              <button onClick={() => setModalMezcla(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 flex-shrink-0">
                <HiXMark className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen (BD o Excel) */}
            {(() => {
              const dumps = modalMezcla.dumpadas;
              const totalTon  = modalMezcla.totalTon  ?? dumps.reduce((s, d) => s + (d.toneladas ?? 0), 0);
              const dispTon   = modalMezcla.dispTon;
              const lDump     = modalMezcla.fromDB ? modalMezcla.leyPromDump  : wAvg(dumps, 'ley_dump');
              const lVis      = modalMezcla.fromDB ? modalMezcla.leyPromVis   : wAvg(dumps, 'ley_visual');
              const lLote     = modalMezcla.fromDB ? modalMezcla.leyProm      : wAvg(dumps, 'ley_lote');
              const lLab      = modalMezcla.fromDB ? modalMezcla.leyLab       : (lDump != null ? Math.round(lDump / 0.9 * 1000) / 1000 : null);
              return (
                <div className="flex flex-wrap gap-x-5 gap-y-1 px-5 py-2.5 bg-emerald-50 border-b border-emerald-100 flex-shrink-0 text-xs">
                  <div>
                    <p className="text-gray-400">Total ton</p>
                    <p className="font-bold text-gray-800 tabular-nums">{totalTon.toFixed(2)}</p>
                  </div>
                  {dispTon != null && (
                    <div>
                      <p className="text-gray-400">Disponible</p>
                      <p className="font-bold text-gray-700 tabular-nums">{dispTon.toFixed(2)}</p>
                    </div>
                  )}
                  <div className="w-px bg-emerald-200 mx-1 self-stretch" />
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
              );
            })()}

            {/* Cuerpo */}
            <div className="overflow-auto flex-1">
              {modalMezcla.fromDB ? (
                <div className="p-4 space-y-4">
                  {Object.entries(modalMezcla.porFecha).map(([fecha, dumps]) => (
                    <div key={fecha}>
                      <p className="text-xs font-semibold text-amber-700 mb-1.5 flex items-center gap-1.5">
                        <HiCalendar className="w-3.5 h-3.5" />
                        {fecha !== 'Sin fecha' ? formatFechaCL(fecha) : 'Sin fecha'}
                        <span className="font-normal text-amber-500">
                          · {dumps.reduce((s, d) => s + (d.toneladas ?? 0), 0).toFixed(2)} ton
                        </span>
                      </p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-amber-50 text-amber-800 uppercase tracking-wide">
                            <th className="px-3 py-1.5 text-left font-semibold">N° Dump</th>
                            <th className="px-3 py-1.5 text-left font-semibold">Origen / Frente</th>
                            <th className="px-3 py-1.5 text-right font-semibold">Ton</th>
                            <th className="px-3 py-1.5 text-right font-semibold">Ley dump aj.</th>
                            <th className="px-3 py-1.5 text-right font-semibold">Ley visual</th>
                            <th className="px-3 py-1.5 text-right font-semibold">Ley lote</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100">
                          {dumps.map((d, di) => (
                            <tr key={di} className="hover:bg-amber-50/60">
                              <td className="px-3 py-1.5 font-mono text-gray-700">{d.numero_dumpada ?? '—'}</td>
                              <td className="px-3 py-1.5 text-gray-700">{d.origen ?? '—'}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 font-semibold">{d.toneladas?.toFixed(2) ?? '—'}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-amber-700 font-semibold">
                                {d.ley_dump_ajustada != null ? `${d.ley_dump_ajustada.toFixed(3)}%` : '—'}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-blue-600">
                                {d.ley_visual != null ? `${d.ley_visual.toFixed(3)}%` : '—'}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">
                                {d.ley_lote != null ? `${d.ley_lote.toFixed(3)}%` : '—'}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-amber-50 font-semibold border-t-2 border-amber-200">
                            <td colSpan={2} className="px-3 py-1.5 text-amber-800">Subtotal</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-gray-800">
                              {dumps.reduce((s, d) => s + (d.toneladas ?? 0), 0).toFixed(2)}
                            </td>
                            <td colSpan={3} />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ) : (<>
                <table className="w-full text-xs">
                  <thead className="sticky top-0">
                    <tr className="bg-amber-50 text-amber-800 uppercase tracking-wide">
                      <th className="px-3 py-2 text-left font-semibold">N° Dump</th>
                      <th className="px-3 py-2 text-left font-semibold">Origen / Frente</th>
                      <th className="px-3 py-2 text-right font-semibold">Ton</th>
                      <th className="px-3 py-2 text-right font-semibold">Ley dump</th>
                      <th className="px-3 py-2 text-right font-semibold">Ley visual</th>
                      <th className="px-3 py-2 text-right font-semibold">Ley lote</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {modalMezcla.dumpadas.map((d, di) => (
                      <tr key={di} className="hover:bg-amber-50/60">
                        <td className="px-3 py-1.5 font-mono text-gray-700">{d.numero_dumpada}</td>
                        <td className="px-3 py-1.5 text-gray-700">{d.origen || '—'}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 font-semibold">{d.toneladas?.toFixed(2) ?? '—'}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-amber-700 font-semibold">
                          {d.ley_dump != null ? `${d.ley_dump.toFixed(3)}%` : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-blue-600">
                          {d.ley_visual != null ? `${d.ley_visual.toFixed(3)}%` : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">
                          {d.ley_lote != null ? `${d.ley_lote.toFixed(3)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                    {(() => {
                      const dumps = modalMezcla.dumpadas;
                      const totalTon = dumps.reduce((s, d) => s + (d.toneladas ?? 0), 0);
                      const avgDump  = wAvg(dumps, 'ley_dump');
                      const avgVis   = wAvg(dumps, 'ley_visual');
                      const avgLote  = wAvg(dumps, 'ley_lote');
                      return (
                        <tr className="bg-amber-50 font-semibold border-t-2 border-amber-200 sticky bottom-0 text-xs">
                          <td colSpan={2} className="px-3 py-1.5 text-amber-800">Total / Prom.</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-gray-800">{totalTon.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-amber-700">{avgDump != null ? `${avgDump.toFixed(3)}%` : '—'}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-blue-600">{avgVis  != null ? `${avgVis.toFixed(3)}%`  : '—'}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">{avgLote != null ? `${avgLote.toFixed(3)}%` : '—'}</td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
