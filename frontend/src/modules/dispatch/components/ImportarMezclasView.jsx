import { useState, useRef, useCallback, useEffect, Fragment } from 'react';
import * as XLSX from 'xlsx';
import {
  HiArrowUpTray, HiCheckCircle, HiExclamationTriangle,
  HiArrowLeft, HiArrowRight, HiDocumentArrowUp, HiTableCells, HiCheckBadge,
  HiBeaker, HiXMark, HiCalendar, HiChevronDown, HiChevronRight,
} from 'react-icons/hi2';
import { useFaena } from '../../../contexts/FaenaContext';
import dispatchService from '../services/dispatch';

const HOJA_MEZCLAS = 'Mezcla';

const COL = {
  numero_dumpada: 7,  // H
  codigo_mezcla:  8,  // I
  acopios:        9,  // J
  toneladas:      10, // K
};

const colLetra = (idx) => String.fromCharCode(65 + idx);

function detectarMapeoLeyes(rows) {
  let esCatemu = false;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    for (let c = 11; c <= 15; c++) {
      const v = r[c] !== null && r[c] !== undefined ? String(r[c]).trim().toLowerCase() : '';
      if (v.includes('soluble') || v.includes('insoluble')) {
        esCatemu = true;
        break;
      }
    }
    if (esCatemu) break;
  }

  if (!esCatemu) {
    return { ley_dump: 11, ley_visual: 12, ley_lote: 13, formato: 'cabildo' };
  }

  let sumInsol = 0, sumSol = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const hStr = r[7] !== null && r[7] !== undefined ? String(r[7]).trim() : '';
    if (!hStr || isNaN(parseFloat(hStr))) continue;
    const insol = typeof r[11] === 'number' ? r[11] : parseFloat(r[11] || 0);
    const sol   = typeof r[12] === 'number' ? r[12] : parseFloat(r[12] || 0);
    if (!isNaN(insol) && insol > 0) sumInsol += insol;
    if (!isNaN(sol)   && sol   > 0) sumSol   += sol;
  }

  if (sumInsol >= sumSol) {
    return { ley_dump: 11, ley_lote: 13, ley_visual: 14, formato: 'catemu-insoluble' };
  } else {
    return { ley_dump: 12, ley_lote: 13, ley_visual: 15, formato: 'catemu-soluble' };
  }
}

function esCabeceraMezcla(colH, colI) {
  const hVacio = colH === null || colH === undefined || String(colH).trim() === '';
  if (!hVacio) return false;
  const iStr = colI !== null && colI !== undefined ? String(colI).trim() : '';
  return iStr !== '' && isNaN(parseFloat(iStr)) && !iStr.includes(' ');
}

function esFilaRemanente(colH, colI) {
  const hVacio = colH === null || colH === undefined || String(colH).trim() === '';
  if (!hVacio) return false;
  if (colI === null || colI === undefined) return false;
  if (typeof colI === 'number') return colI > 0;
  const iStr = String(colI).trim();
  const iNum = parseFloat(iStr);
  return !isNaN(iNum) && iNum > 0 && /^\d+(\.\d+)?$/.test(iStr);
}

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function mesDesde(fechaCalc) {
  if (!fechaCalc) return null;
  const str = String(fechaCalc).substring(0, 10);
  const parts = str.split('-');
  if (parts.length < 2) return null;
  const m = parseInt(parts[1], 10);
  if (m < 1 || m > 12) return null;
  return `${MESES_ES[m - 1]} ${parts[0]}`;
}

function formatFecha(fechaCalc) {
  if (!fechaCalc) return null;
  return String(fechaCalc).substring(0, 10);
}

function roundLey(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  const pct = n < 1 ? n * 100 : n;
  return Math.round(pct * 1000) / 1000;
}

function safeLey(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'object') return null;
  return roundLey(v);
}

function buildCamposMezcla(leyCOL) {
  return [
    { label: 'Nº Dumpada',    colIdx: COL.numero_dumpada },
    { label: 'Código mezcla',  colIdx: COL.codigo_mezcla },
    { label: 'Acopio',         colIdx: COL.acopios },
    { label: 'Toneladas',      colIdx: COL.toneladas },
    { label: 'Ley dump',       colIdx: leyCOL.ley_dump },
    { label: 'Ley visual',     colIdx: leyCOL.ley_visual },
    { label: 'Ley lote',       colIdx: leyCOL.ley_lote },
  ];
}

function normStr(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

function weightedAvg(items, field) {
  const valid = items.filter(d => d[field] != null && (d.toneladas ?? 0) > 0);
  if (!valid.length) return null;
  const totalTon = valid.reduce((s, d) => s + d.toneladas, 0);
  if (!totalTon) return null;
  return valid.reduce((s, d) => s + d[field] * d.toneladas, 0) / totalTon;
}

const STEPS = ['Configurar', 'Revisar', 'Resultado'];

const FORMATO_LABELS = {
  'cabildo':          { label: 'Cabildo (ley única)',  color: 'bg-orange-100 text-orange-700' },
  'catemu-insoluble': { label: 'Catemu — Insoluble',   color: 'bg-blue-100 text-blue-700' },
  'catemu-soluble':   { label: 'Catemu — Soluble',     color: 'bg-teal-100 text-teal-700' },
};

export default function ImportarMezclasView({ toast, setVistaActual }) {
  const { faenaUsuario, faenas } = useFaena();
  const faenaId = faenaUsuario?.id ?? faenaUsuario;

  const [step, setStep]             = useState(0);
  const [archivoNombre, setArchivoNombre] = useState('');
  const [parseando, setParseando]   = useState(false);
  const [importando, setImportando] = useState(false);
  const [plantaId, setPlantaId]     = useState('');
  const [plantas, setPlantas]       = useState([]);
  const [mesFiltro, setMesFiltro]   = useState('');

  const [mezclasParseadas, setMezclasParseadas] = useState([]);
  const [mezclasPreview, setMezclasPreview]     = useState([]);
  const [seleccionadas, setSeleccionadas]        = useState({});
  const [resultado, setResultado]               = useState(null);
  const [formatoDetectado, setFormatoDetectado] = useState('');
  const [modalMezcla, setModalMezcla]           = useState(null);
  const [expandidosMezcla, setExpandidosMezcla] = useState({});
  const [avisoFaena, setAvisoFaena]             = useState(null);
  const [mesAnio, setMesAnio]                   = useState(null);
  const [loadingMsg, setLoadingMsg]             = useState('');

  // Estado intermedio antes de llamar al backend
  const [colMapData, setColMapData] = useState(null); // { leyCOL, camposMezcla, firstDataRow }
  const [mezclasTemp, setMezclasTemp] = useState(null); // { mezclasArr }

  const dropRef  = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    dispatchService.getPlantas(faenaId)
      .then(data => {
        const lista = data.plantas ?? data.data ?? (Array.isArray(data) ? data : []);
        setPlantas(lista);
        if (lista.length === 1) setPlantaId(String(lista[0].id));
      })
      .catch(() => toast?.error('No se pudieron cargar las plantas'));
  }, [faenaId]);

  // ── Fase 1: parseo local del Excel (sin llamada al backend) ──────────
  const parsearArchivo = useCallback(async (file) => {
    if (!plantaId) {
      toast?.error('Selecciona una planta antes de cargar el archivo');
      return;
    }
    setArchivoNombre(file.name);
    setColMapData(null);
    setMezclasTemp(null);
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

      const leyCOL = detectarMapeoLeyes(rows);
      setFormatoDetectado(leyCOL.formato);

      // Encontrar la primera fila de datos real (no cabecera, no remanente)
      let firstDataRow = null;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const colH = r[COL.numero_dumpada];
        const colK = r[COL.toneladas];
        const hStr = colH !== null && colH !== undefined ? String(colH).trim() : '';
        if (!hStr || isNaN(parseFloat(hStr))) continue;
        const tonRaw = typeof colK === 'number' ? colK : parseFloat(String(colK ?? ''));
        if (!isNaN(tonRaw) && tonRaw > 0) {
          firstDataRow = r;
          break;
        }
      }

      // Agrupar filas por mezcla
      const mezclasMap = new Map();
      let codigoActual = null;

      for (let i = 0; i < rows.length; i++) {
        const r    = rows[i];
        const colH = r[COL.numero_dumpada];
        const colI = r[COL.codigo_mezcla];
        const colK = r[COL.toneladas];

        if (esCabeceraMezcla(colH, colI)) {
          codigoActual = String(colI).trim();
          if (!mezclasMap.has(codigoActual)) {
            mezclasMap.set(codigoActual, { dumpadas: [], remanentes: [] });
          }
          continue;
        }

        if (!codigoActual) continue;

        if (esFilaRemanente(colH, colI)) {
          const numeroPaladas = parseInt(String(colI).trim());
          const origen = r[COL.acopios] !== null && r[COL.acopios] !== undefined
            ? String(r[COL.acopios]).trim() : '';
          const tonRaw = typeof colK === 'number' ? colK : parseFloat(String(colK ?? '').replace(',', '.'));
          if (!isNaN(tonRaw) && tonRaw > 0) {
            mezclasMap.get(codigoActual).remanentes.push({
              numero_paladas: numeroPaladas,
              origen,
              toneladas:  tonRaw,
              ley_dump:   safeLey(r[leyCOL.ley_dump]),
              ley_visual: safeLey(r[leyCOL.ley_visual]),
              ley_lote:   safeLey(r[leyCOL.ley_lote]),
            });
          }
          continue;
        }

        const hStr = colH !== null && colH !== undefined ? String(colH).trim() : '';
        if (!hStr || isNaN(parseFloat(hStr))) continue;

        const tonRaw = typeof colK === 'number' ? colK : parseFloat(String(colK ?? '').replace(',', '.'));
        if (isNaN(tonRaw) || tonRaw <= 0) continue;

        mezclasMap.get(codigoActual).dumpadas.push({
          numero_dumpada: hStr,
          acopios:        r[COL.acopios] !== null && r[COL.acopios] !== undefined
                            ? String(r[COL.acopios]).trim() : '',
          toneladas:      tonRaw,
          ley_dump:       safeLey(r[leyCOL.ley_dump]),
          ley_visual:     safeLey(r[leyCOL.ley_visual]),
          ley_lote:       safeLey(r[leyCOL.ley_lote]),
        });
      }

      const mezclasArr = Array.from(mezclasMap.entries())
        .filter(([, { dumpadas, remanentes }]) => dumpadas.length > 0 || remanentes.length > 0)
        .map(([codigo, { dumpadas, remanentes }]) => ({ codigo, dumpadas, remanentes }));

      if (mezclasArr.length === 0) {
        toast?.error('No se encontraron mezclas válidas en la hoja "Mezcla"');
        setParseando(false);
        return;
      }

      setColMapData({
        leyCOL,
        camposMezcla: buildCamposMezcla(leyCOL),
        firstDataRow,
      });
      setMezclasTemp({ mezclasArr });
    } catch (err) {
      console.error(err);
      toast?.error('Error al leer el archivo: ' + err.message);
    }
    setParseando(false);
  }, [plantaId, toast]);

  // ── Fase 2: validar con backend y avanzar a paso 1 ──────────────────
  const handleContinuar = useCallback(async () => {
    if (!mezclasTemp) return;
    setLoadingMsg('Validando con la base de datos…');
    setParseando(true);
    try {
      const previewRes = await dispatchService.importarMezclasPreview(faenaId, mezclasTemp.mezclasArr);

      const preview = (previewRes.mezclas ?? []).map(m => ({
        ...m,
        fecha_calculada: formatFecha(m.fecha_calculada),
        mes_calc: mesDesde(m.fecha_calculada),
      }));

      setMezclasParseadas(mezclasTemp.mezclasArr);
      setMezclasPreview(preview);

      const sel = {};
      preview.forEach(m => { sel[m.codigo] = !m.existe; });
      setSeleccionadas(sel);

      const mesesCon = [...new Set(preview.map(m => m.mes_calc).filter(Boolean))];
      if (mesesCon.length > 0) setMesFiltro(mesesCon[mesesCon.length - 1]);

      setStep(1);
    } catch (err) {
      console.error(err);
      toast?.error('Error al validar mezclas: ' + (err.response?.data?.message || err.message));
    }
    setParseando(false);
  }, [faenaId, mezclasTemp, toast]);

  // ── Drag & Drop ───────────────────────────────────────────────────
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dropRef.current?.classList.remove('border-violet-400', 'bg-violet-50');
    const file = e.dataTransfer.files[0];
    if (file) parsearArchivo(file);
  }, [parsearArchivo]);

  const handleDragOver = (e) => {
    e.preventDefault();
    dropRef.current?.classList.add('border-violet-400', 'bg-violet-50');
  };
  const handleDragLeave = () => {
    dropRef.current?.classList.remove('border-violet-400', 'bg-violet-50');
  };

  // ── Importar ──────────────────────────────────────────────────────
  const handleImportar = async () => {
    const seleccionadasArr = mezclasParseadas.filter(m => seleccionadas[m.codigo]);
    if (seleccionadasArr.length === 0) {
      toast?.error('Selecciona al menos una mezcla para importar');
      return;
    }
    setLoadingMsg(`Importando ${seleccionadasArr.length} mezcla${seleccionadasArr.length !== 1 ? 's' : ''}…`);
    setImportando(true);
    try {
      const res = await dispatchService.importarMezclasConfirmar(faenaId, plantaId, seleccionadasArr);
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
    setMezclasParseadas([]);
    setMezclasPreview([]);
    setSeleccionadas({});
    setResultado(null);
    setMesFiltro('');
    setColMapData(null);
    setMezclasTemp(null);
    setAvisoFaena(null);
    setMesAnio(null);
    setExpandidosMezcla({});
  };

  const parsedMap = new Map(mezclasParseadas.map(m => [m.codigo, m]));

  const mesesDisponibles = [...new Set(mezclasPreview.map(m => m.mes_calc).filter(Boolean))];
  const mezclasVistas    = mesFiltro === '__sin_fecha__'
    ? mezclasPreview.filter(m => !m.mes_calc)
    : mesFiltro
      ? mezclasPreview.filter(m => m.mes_calc === mesFiltro)
      : mezclasPreview;

  const totalSeleccionadas = Object.values(seleccionadas).filter(Boolean).length;
  const existentes    = mezclasVistas.filter(m => m.existe).length;
  const nuevas        = mezclasVistas.filter(m => !m.existe).length;
  const conFaltantes  = mezclasVistas.filter(m => m.dumpadas_faltantes?.length > 0).length;

  return (
    <div className="space-y-6 relative">

      {/* Overlay de carga */}
      {(parseando || importando) && (
        <div className="absolute inset-0 z-20 bg-white/75 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center gap-4 min-h-[200px]">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-violet-200 border-t-violet-600" />
          <p className="text-sm font-semibold text-violet-700">{loadingMsg}</p>
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, idx) => (
          <div key={idx} className="flex items-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors
              ${idx === step ? 'bg-violet-600 text-white shadow-sm' :
                idx < step  ? 'bg-violet-100 text-violet-700' :
                              'bg-gray-100 text-gray-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                ${idx === step ? 'bg-white/30' :
                  idx < step  ? 'bg-violet-300 text-violet-700' :
                                'bg-gray-300 text-gray-500'}`}>
                {idx < step ? '✓' : idx + 1}
              </span>
              {s}
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-px w-6 mx-1 ${idx < step ? 'bg-violet-300' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── PASO 0: CONFIGURAR ── */}
      {step === 0 && (
        <div className="space-y-6">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Zona drag & drop */}
            <div className="lg:col-span-2">
              <div
                ref={dropRef}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer transition-all duration-150 hover:border-violet-300 hover:bg-violet-50/40 group"
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={e => e.target.files[0] && parsearArchivo(e.target.files[0])}
                />
                {parseando ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500" />
                    <p className="text-gray-500 text-sm">Leyendo hoja "Mezcla"…</p>
                  </div>
                ) : archivoNombre ? (
                  <div className="flex flex-col items-center gap-3">
                    <HiCheckCircle className="w-12 h-12 text-green-500" />
                    <p className="font-semibold text-gray-700">{archivoNombre}</p>
                    {mesAnio && (
                      <span className="inline-flex items-center gap-1.5 bg-violet-100 text-violet-700 border border-violet-200 px-3 py-1 rounded-full text-xs font-semibold">
                        <HiCalendar className="w-3.5 h-3.5" />
                        {mesAnio.mes} {mesAnio.anio}
                      </span>
                    )}
                    <p className="text-sm text-gray-400">Haz clic para cambiar el archivo</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <HiDocumentArrowUp className="w-14 h-14 text-gray-300 group-hover:text-violet-400 transition-colors" />
                    <p className="font-semibold text-gray-600 text-lg">Arrastra tu archivo Excel aquí</p>
                    <p className="text-sm text-gray-400">o haz clic para seleccionarlo</p>
                    <p className="text-xs text-gray-300 mt-1">La hoja debe llamarse <span className="font-mono font-bold">Mezcla</span></p>
                  </div>
                )}
              </div>
            </div>

            {/* Panel opciones */}
            <div className="space-y-5">

              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <p className="font-bold text-gray-700 text-sm">Planta de destino</p>
                {plantas.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Cargando plantas…</p>
                ) : (
                  plantas.map(p => (
                    <label key={p.id} className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer border transition-colors
                      ${String(plantaId) === String(p.id) ? 'border-violet-300 bg-violet-50' : 'border-transparent hover:bg-gray-50'}`}>
                      <input
                        type="radio"
                        name="planta"
                        value={p.id}
                        checked={String(plantaId) === String(p.id)}
                        onChange={() => setPlantaId(String(p.id))}
                        className="mt-0.5 accent-violet-600"
                      />
                      <div>
                        <p className="font-semibold text-sm text-gray-700">{p.nombre}</p>
                        {p.codigo && <p className="text-xs text-gray-400">{p.codigo}</p>}
                      </div>
                    </label>
                  ))
                )}
                {!plantaId && plantas.length > 0 && (
                  <p className="text-xs text-amber-600 font-semibold">Selecciona una planta para continuar</p>
                )}
              </div>

              <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-xs text-violet-700 space-y-1.5">
                <p className="font-bold">¿Qué se importará?</p>
                <p>• Mezclas desde la hoja <span className="font-mono font-bold">Mezcla</span></p>
                <p>• Vincula cada mezcla a sus dumpadas ya importadas (por número de dumpada)</p>
                <p>• Las leyes se toman del Excel (ya con descuentos aplicados)</p>
                <p>• La fecha de la mezcla = fecha más reciente de sus dumpadas en BD</p>
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

          {/* ── Panel: columnas detectadas ── */}
          {colMapData && mezclasTemp && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                  <HiTableCells className="w-4 h-4 text-violet-400" />
                  <p className="font-bold text-gray-700 text-sm">Columnas detectadas</p>
                  {formatoDetectado && (() => {
                    const fmt = FORMATO_LABELS[formatoDetectado];
                    return fmt ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${fmt.color}`}>
                        {fmt.label}
                      </span>
                    ) : null;
                  })()}
                  <span className="ml-auto text-xs text-gray-400 font-semibold tabular-nums">
                    {mezclasTemp.mezclasArr.length} mezclas encontradas
                  </span>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                        <th className="px-4 py-2 text-left font-semibold">Campo</th>
                        <th className="px-4 py-2 text-left font-semibold">Col. Excel</th>
                        <th className="px-4 py-2 text-left font-semibold">Ejemplo (1ª fila de datos)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {colMapData.camposMezcla.map(({ label, colIdx }) => {
                        const rawVal = colMapData.firstDataRow ? colMapData.firstDataRow[colIdx] : null;
                        let ejemplo = '—';
                        if (rawVal !== null && rawVal !== undefined) {
                          if (label.startsWith('Ley')) {
                            const leyVal = safeLey(rawVal);
                            ejemplo = leyVal !== null ? `${leyVal.toFixed(3)}%` : '—';
                          } else {
                            ejemplo = String(rawVal);
                          }
                        }
                        return (
                          <tr key={label} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-semibold text-gray-700 text-sm">{label}</td>
                            <td className="px-4 py-2">
                              <span className="font-mono text-xs font-bold bg-violet-50 text-violet-700 px-2 py-0.5 rounded">
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
                <div className="px-4 py-3 bg-violet-50 border-t border-violet-100 text-xs text-violet-700">
                  Si los datos se ven correctos, haz clic en <strong>Continuar</strong> para validar con la base de datos.
                  Si algo está mal, carga un archivo diferente.
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleContinuar}
                  disabled={parseando}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
                >
                  {parseando ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Validando…
                    </>
                  ) : (
                    <>
                      Continuar y validar
                      <HiArrowRight className="w-4 h-4" />
                    </>
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

          {/* Formato detectado */}
          {formatoDetectado && (() => {
            const fmt = FORMATO_LABELS[formatoDetectado];
            return fmt ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">Formato detectado:</span>
                <span className={`px-2 py-0.5 rounded-full font-semibold ${fmt.color}`}>
                  {fmt.label}
                </span>
              </div>
            ) : null;
          })()}

          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Mezclas en Excel',        val: mezclasPreview.length, color: 'text-violet-600', bg: 'bg-violet-50 border-violet-100' },
              { label: 'Nuevas (a importar)',      val: nuevas,                color: 'text-green-600',  bg: 'bg-green-50 border-green-100' },
              { label: 'Ya existen en BD',         val: existentes,            color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-100' },
              { label: 'Con dumpadas faltantes',   val: conFaltantes,          color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-100' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
                <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.val}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filtro de mes */}
          {(mesesDisponibles.length > 0) && (
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-600 mr-1">Mes:</p>
              {mesesDisponibles.map(mes => (
                <button
                  key={mes}
                  onClick={() => setMesFiltro(mes)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    mesFiltro === mes
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                  }`}
                >
                  {mes}
                </button>
              ))}
              {mezclasPreview.some(m => !m.mes_calc) && (
                <button
                  onClick={() => setMesFiltro('__sin_fecha__')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    mesFiltro === '__sin_fecha__'
                      ? 'bg-gray-600 text-white border-gray-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  Sin fecha
                </button>
              )}
              <button
                onClick={() => setMesFiltro('')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  mesFiltro === ''
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                }`}
              >
                Todos
              </button>
            </div>
          )}

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HiTableCells className="w-4 h-4 text-gray-400" />
                <p className="font-bold text-gray-700 text-sm">
                  Mezclas detectadas
                  {mesFiltro && <span className="ml-2 text-violet-500 font-normal">— {mesFiltro}</span>}
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => {
                    const sel = { ...seleccionadas };
                    mezclasVistas.forEach(m => { sel[m.codigo] = !m.existe; });
                    setSeleccionadas(sel);
                  }}
                  className="text-violet-600 hover:underline font-semibold"
                >Solo nuevas</button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => {
                    const sel = { ...seleccionadas };
                    mezclasVistas.forEach(m => { sel[m.codigo] = true; });
                    setSeleccionadas(sel);
                  }}
                  className="text-violet-600 hover:underline font-semibold"
                >Todas</button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => {
                    const sel = { ...seleccionadas };
                    mezclasVistas.forEach(m => { sel[m.codigo] = false; });
                    setSeleccionadas(sel);
                  }}
                  className="text-gray-400 hover:underline"
                >Ninguna</button>
              </div>
            </div>
            <div className="overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide sticky top-0">
                    <th className="px-3 py-2 w-14"></th>
                    <th className="px-3 py-2 text-left font-semibold">Código</th>
                    <th className="px-3 py-2 text-left font-semibold">Fecha calc.</th>
                    <th className="px-3 py-2 text-right font-semibold">Dumpadas</th>
                    <th className="px-3 py-2 text-right font-semibold">Total ton</th>
                    <th className="px-3 py-2 text-right font-semibold">Ley dump</th>
                    <th className="px-3 py-2 text-right font-semibold">Ley visual</th>
                    <th className="px-3 py-2 text-right font-semibold">Ley lote</th>
                    <th className="px-3 py-2 text-left font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mezclasVistas.map(m => {
                    const parsed    = parsedMap.get(m.codigo);
                    const leyVisual = parsed ? weightedAvg(parsed.dumpadas, 'ley_visual') : null;
                    const faltantes = new Set(m.dumpadas_faltantes ?? []);
                    const isExpanded = !!expandidosMezcla[m.codigo];
                    return (
                      <Fragment key={m.codigo}>
                        <tr className={`hover:bg-gray-50 ${!seleccionadas[m.codigo] ? 'opacity-40' : ''}`}>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={!!seleccionadas[m.codigo]}
                                onChange={e => setSeleccionadas(prev => ({ ...prev, [m.codigo]: e.target.checked }))}
                                className="accent-violet-600 w-4 h-4"
                              />
                              <button
                                onClick={() => setExpandidosMezcla(p => ({ ...p, [m.codigo]: !p[m.codigo] }))}
                                className="text-gray-300 hover:text-violet-500 transition-colors"
                              >
                                {isExpanded
                                  ? <HiChevronDown className="w-3.5 h-3.5" />
                                  : <HiChevronRight className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => setModalMezcla({ codigo: m.codigo, dumpadas: parsed?.dumpadas ?? [], remanentes: parsed?.remanentes ?? [], faltantes, preview: m })}
                              className="flex items-center gap-1.5 font-mono font-semibold text-gray-800 hover:text-violet-700 transition-colors group"
                            >
                              <HiBeaker className="w-3.5 h-3.5 text-violet-300 group-hover:text-violet-500 flex-shrink-0" />
                              {m.codigo}
                            </button>
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-500 text-xs">{m.fecha_calculada ?? '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                            <span className={faltantes.size > 0 ? 'text-amber-600 font-semibold' : ''}>
                              {m.dumpadas_encontradas}/{m.dumpadas_total}
                            </span>
                            {m.remanentes_count > 0 && (
                              <span className="ml-1 text-violet-500 text-xs font-semibold">+{m.remanentes_count}R</span>
                            )}
                            {faltantes.size > 0 && (
                              <span className="ml-1 text-amber-500 cursor-help" title={`Faltantes: ${[...faltantes].join(', ')}`}>⚠</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">{m.total_ton?.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-violet-700">{m.ley_prom_dump?.toFixed(3) ?? '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-blue-600">{leyVisual != null ? leyVisual.toFixed(3) : '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{m.ley_prom_lote?.toFixed(3) ?? '—'}</td>
                          <td className="px-3 py-2">
                            {m.existe ? (
                              <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                                <HiCheckCircle className="w-3 h-3" /> Ya existe
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                                Nueva
                              </span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="p-0 bg-slate-50 border-b border-violet-100">
                              <div className="px-10 py-2 space-y-2">
                                {parsed && parsed.dumpadas.length > 0 && (
                                  <>
                                    <p className="text-xs font-bold text-violet-700 pt-1">Dumpadas ({parsed.dumpadas.length})</p>
                                    <table className="w-full text-xs border border-violet-200 rounded overflow-hidden">
                                      <thead>
                                        <tr className="bg-violet-50 text-violet-800 uppercase tracking-wide">
                                          <th className="px-3 py-1 text-left font-semibold">N° Dump</th>
                                          <th className="px-3 py-1 text-left font-semibold">Origen</th>
                                          <th className="px-3 py-1 text-right font-semibold">Ton</th>
                                          <th className="px-3 py-1 text-right font-semibold">Ley dump</th>
                                          <th className="px-3 py-1 text-right font-semibold">Ley visual</th>
                                          <th className="px-3 py-1 text-right font-semibold">Ley lote</th>
                                          <th className="px-3 py-1 text-center font-semibold">En BD</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-violet-100 bg-white">
                                        {parsed.dumpadas.map((d, di) => {
                                          const enBD = !faltantes.has(d.numero_dumpada);
                                          return (
                                            <tr key={di} className={enBD ? 'hover:bg-violet-50/30' : 'bg-amber-50 hover:bg-amber-100/60'}>
                                              <td className="px-3 py-1 font-mono text-gray-700">{d.numero_dumpada}</td>
                                              <td className="px-3 py-1 text-gray-500">{d.acopios || '—'}</td>
                                              <td className="px-3 py-1 text-right tabular-nums text-gray-600">{d.toneladas?.toFixed(2) ?? '—'}</td>
                                              <td className="px-3 py-1 text-right tabular-nums text-violet-700 font-semibold">{d.ley_dump != null ? `${d.ley_dump.toFixed(3)}%` : '—'}</td>
                                              <td className="px-3 py-1 text-right tabular-nums text-blue-600">{d.ley_visual != null ? `${d.ley_visual.toFixed(3)}%` : '—'}</td>
                                              <td className="px-3 py-1 text-right tabular-nums text-emerald-700">{d.ley_lote != null ? `${d.ley_lote.toFixed(3)}%` : '—'}</td>
                                              <td className="px-3 py-1 text-center">
                                                {enBD ? <span className="text-green-600 font-bold">✓</span> : <span className="text-amber-600 text-xs font-semibold">⚠</span>}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </>
                                )}
                                {parsed?.remanentes?.length > 0 && (
                                  <>
                                    <p className="text-xs font-bold text-orange-700">Remanentes / Paladas ({parsed.remanentes.length})</p>
                                    <table className="w-full text-xs border border-orange-200 rounded overflow-hidden">
                                      <thead>
                                        <tr className="bg-orange-50 text-orange-800 uppercase tracking-wide">
                                          <th className="px-3 py-1 text-left font-semibold">N° Paladas</th>
                                          <th className="px-3 py-1 text-left font-semibold">Origen</th>
                                          <th className="px-3 py-1 text-right font-semibold">Ton</th>
                                          <th className="px-3 py-1 text-right font-semibold">Ley dump</th>
                                          <th className="px-3 py-1 text-right font-semibold">Ley visual</th>
                                          <th className="px-3 py-1 text-right font-semibold">Ley lote</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-orange-100 bg-white">
                                        {parsed.remanentes.map((rem, ri) => (
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
                                {(!parsed || (parsed.dumpadas.length === 0 && (parsed.remanentes?.length ?? 0) === 0)) && (
                                  <p className="text-xs text-gray-400 py-1">Sin detalle disponible</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {conFaltantes > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <HiExclamationTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{conFaltantes} mezcla(s) {mesFiltro ? `de ${mesFiltro}` : ''} tienen dumpadas no encontradas en BD</p>
                <p className="text-xs mt-0.5 text-amber-700">
                  Esas dumpadas serán ignoradas. Pasa el cursor sobre el ⚠ para ver cuáles faltan.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={resetear}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-semibold"
            >
              <HiArrowLeft className="w-4 h-4" /> Volver
            </button>
            <button
              onClick={handleImportar}
              disabled={importando || totalSeleccionadas === 0}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
            >
              {importando ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Importando {totalSeleccionadas} mezclas…
                </>
              ) : (
                <>
                  <HiArrowUpTray className="w-4 h-4" />
                  Importar {totalSeleccionadas} mezcla{totalSeleccionadas !== 1 ? 's' : ''}
                </>
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
              {resultado.errores?.length === 0 ? '¡Mezclas importadas!' : 'Importación con advertencias'}
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto">
            <div className="bg-green-50 border border-green-100 rounded-xl p-5 text-center">
              <p className="text-4xl font-bold text-green-600 tabular-nums">{resultado.creadas}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Creadas</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-center">
              <p className="text-4xl font-bold text-blue-500 tabular-nums">{resultado.saltadas}</p>
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
                      <th className="px-4 py-2 text-left">Fila</th>
                      <th className="px-4 py-2 text-left">Mezcla</th>
                      <th className="px-4 py-2 text-left">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {resultado.errores.map((e, i) => (
                      <tr key={i}>
                        <td className="px-4 py-1.5 font-mono">{e.index}</td>
                        <td className="px-4 py-1.5 font-mono font-semibold">{e.codigo}</td>
                        <td className="px-4 py-1.5 text-red-600">{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              onClick={resetear}
              className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
            >
              Importar otro archivo
            </button>
            <button
              onClick={() => setVistaActual('mezclas')}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
            >
              <HiArrowRight className="w-4 h-4" />
              Ver en Mezclas
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
              <HiBeaker className="w-5 h-5 text-violet-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-gray-800">
                  Mezcla <span className="font-mono text-violet-700">{modalMezcla.codigo}</span>
                  {modalMezcla.preview?.fecha_calculada && (
                    <span className="ml-2 text-xs font-normal text-gray-400">— {modalMezcla.preview.fecha_calculada}</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {modalMezcla.dumpadas.length} dumpada{modalMezcla.dumpadas.length !== 1 ? 's' : ''}
                  {modalMezcla.remanentes.length > 0 && ` · ${modalMezcla.remanentes.length} remanente${modalMezcla.remanentes.length !== 1 ? 's' : ''}`}
                  {' · '}{modalMezcla.dumpadas.reduce((s, d) => s + (d.toneladas ?? 0), 0).toFixed(2)} ton
                  {modalMezcla.faltantes?.size > 0 && (
                    <span className="ml-2 text-amber-600 font-semibold">⚠ {modalMezcla.faltantes.size} no encontrada{modalMezcla.faltantes.size !== 1 ? 's' : ''} en BD</span>
                  )}
                </p>
              </div>
              {/* Resumen de leyes */}
              <div className="flex gap-4 text-xs text-right flex-shrink-0">
                {modalMezcla.preview?.ley_prom_dump != null && (
                  <div>
                    <p className="text-gray-400">Ley dump prom.</p>
                    <p className="font-bold text-violet-700 tabular-nums">{modalMezcla.preview.ley_prom_dump.toFixed(3)}%</p>
                  </div>
                )}
                {modalMezcla.preview?.ley_prom_lote != null && (
                  <div>
                    <p className="text-gray-400">Ley lote prom.</p>
                    <p className="font-bold text-emerald-700 tabular-nums">{modalMezcla.preview.ley_prom_lote.toFixed(3)}%</p>
                  </div>
                )}
                {modalMezcla.preview?.total_ton != null && (
                  <div>
                    <p className="text-gray-400">Total ton</p>
                    <p className="font-bold text-gray-800 tabular-nums">{modalMezcla.preview.total_ton.toFixed(2)}</p>
                  </div>
                )}
                {(() => {
                  const allItems = [...modalMezcla.dumpadas, ...modalMezcla.remanentes];
                  const avgLote  = weightedAvg(allItems, 'ley_lote');
                  const avgDump  = avgLote != null ? Math.round(avgLote / 0.9 * 1000) / 1000 : null;
                  const leyLab   = avgDump != null ? Math.round(avgDump / 0.9 * 1000) / 1000 : null;
                  return leyLab != null ? (
                    <div>
                      <p className="text-gray-400">Ley lab</p>
                      <p className="font-bold text-violet-700 tabular-nums">{leyLab.toFixed(3)}%</p>
                    </div>
                  ) : null;
                })()}
              </div>
              <button onClick={() => setModalMezcla(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 flex-shrink-0 ml-2">
                <HiXMark className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo */}
            <div className="overflow-auto flex-1">
              {/* Tabla de dumpadas */}
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="bg-violet-50 text-violet-800 uppercase tracking-wide">
                    <th className="px-3 py-2 text-left font-semibold">N° Dump</th>
                    <th className="px-3 py-2 text-left font-semibold">Origen / Acopio</th>
                    <th className="px-3 py-2 text-right font-semibold">Ton</th>
                    <th className="px-3 py-2 text-right font-semibold">Ley dump</th>
                    <th className="px-3 py-2 text-right font-semibold">Ley visual</th>
                    <th className="px-3 py-2 text-right font-semibold">Ley lote</th>
                    <th className="px-3 py-2 text-center font-semibold">En BD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {modalMezcla.dumpadas.map((d, di) => {
                    const enBD = !modalMezcla.faltantes?.has(d.numero_dumpada);
                    return (
                      <tr key={di} className={enBD ? 'hover:bg-violet-50/30' : 'bg-amber-50 hover:bg-amber-100/60'}>
                        <td className="px-3 py-1.5 font-mono font-semibold text-gray-700">{d.numero_dumpada}</td>
                        <td className="px-3 py-1.5 text-gray-600">{d.acopios || '—'}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 font-semibold">{d.toneladas?.toFixed(2) ?? '—'}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-violet-700 font-semibold">
                          {d.ley_dump != null ? `${d.ley_dump.toFixed(3)}%` : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-blue-600">
                          {d.ley_visual != null ? `${d.ley_visual.toFixed(3)}%` : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">
                          {d.ley_lote != null ? `${d.ley_lote.toFixed(3)}%` : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {enBD
                            ? <span className="text-green-600 font-bold">✓</span>
                            : <span className="text-amber-600 font-semibold text-xs">⚠ No encontrada</span>}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-violet-50 font-semibold border-t-2 border-violet-200 sticky bottom-0">
                    <td colSpan={2} className="px-3 py-1.5 text-violet-800">Total</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-800">
                      {modalMezcla.dumpadas.reduce((s, d) => s + (d.toneladas ?? 0), 0).toFixed(2)}
                    </td>
                    <td colSpan={4} />
                  </tr>
                </tbody>
              </table>

              {/* Remanentes */}
              {modalMezcla.remanentes.length > 0 && (
                <div className="border-t-2 border-orange-200">
                  <p className="px-3 py-2 text-xs font-bold text-orange-700 bg-orange-50">
                    Remanentes ({modalMezcla.remanentes.length})
                  </p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-orange-50 text-orange-800 uppercase tracking-wide">
                        <th className="px-3 py-1.5 text-left font-semibold">N° Paladas</th>
                        <th className="px-3 py-1.5 text-left font-semibold">Origen / Acopio</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Ton</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Ley dump</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Ley visual</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Ley lote</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orange-100">
                      {modalMezcla.remanentes.map((r, ri) => (
                        <tr key={ri} className="hover:bg-orange-50/40">
                          <td className="px-3 py-1.5 font-mono text-gray-700">{r.numero_paladas}</td>
                          <td className="px-3 py-1.5 text-gray-600">{r.origen || '—'}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 font-semibold">{r.toneladas?.toFixed(2) ?? '—'}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-violet-700 font-semibold">
                            {r.ley_dump != null ? `${r.ley_dump.toFixed(3)}%` : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-blue-600">
                            {r.ley_visual != null ? `${r.ley_visual.toFixed(3)}%` : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">
                            {r.ley_lote != null ? `${r.ley_lote.toFixed(3)}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
