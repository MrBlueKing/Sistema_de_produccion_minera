import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { HiArrowUpTray, HiCheckCircle, HiExclamationTriangle, HiXCircle, HiArrowLeft, HiArrowRight, HiDocumentArrowUp, HiTableCells, HiCheckBadge } from 'react-icons/hi2';
import Button from '../../../shared/components/atoms/Button';
import { useFaena } from '../../../contexts/FaenaContext';
import dispatchService from '../services/dispatch';

const HOJA_DATOS = 'DB';
const FILA_ENCABEZADO = 3;
const FILA_DATOS_INICIO = 4;

const COL_DEFAULT = {
  punto:          2,  // C
  tipo:           3,  // D
  numero_dumpada: 4,  // E
  acopios:        5,  // F
  jornada:        6,  // G
  fecha:          7,  // H
  ton:            8,  // I
  ley:            9,  // J
  ley_cup:        10, // K
  certificado:    11, // L
  ley_visual:     13, // N
  rango:          14, // O
};

function detectarCOL(headerRow) {
  const cols = { ...COL_DEFAULT };
  const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, '');
  for (let c = 8; c < headerRow.length; c++) {
    const v = norm(headerRow[c]);
    if (v.includes('certif') || v.includes('certidicado')) cols.certificado = c;
    else if (v.includes('leyvisual') || v === 'leyvis')    cols.ley_visual  = c;
    else if (v === 'rango')                                 cols.rango       = c;
  }
  return cols;
}

const colLetra = (idx) => String.fromCharCode(65 + idx);

const CAMPOS_DUMP = [
  { label: 'Frente',       colIdx: COL.punto,          key: 'punto' },
  { label: 'Tipo frente',  colIdx: COL.tipo,           key: 'tipo' },
  { label: 'Nº Dumpada',  colIdx: COL.numero_dumpada, key: 'numero_dumpada' },
  { label: 'Fecha',        colIdx: COL.fecha,          key: 'fecha' },
  { label: 'Toneladas',    colIdx: COL.ton,            key: 'ton' },
  { label: 'Ley',          colIdx: COL.ley,            key: 'ley' },
  { label: 'Ley CuP',     colIdx: COL.ley_cup,        key: 'ley_cup' },
  { label: 'Certificado',  colIdx: COL.certificado,    key: 'certificado' },
  { label: 'Ley visual',   colIdx: COL.ley_visual,     key: 'ley_visual' },
  { label: 'Rango',        colIdx: COL.rango,          key: 'rango' },
];

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

function roundLey(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  const pct = n < 1 ? n * 100 : n;
  return Math.round(pct * 1000) / 1000;
}

const STEPS = ['Configurar', 'Validar', 'Resultado'];

const TIPO_LEY_OPCIONES = [
  { value: 'cu_insoluble', label: 'Cu Insoluble', desc: 'Recomendado para Cabildo' },
  { value: 'cu_soluble',   label: 'Cu Soluble',   desc: 'Recomendado para Catemu' },
  { value: 'cu_total',     label: 'Cu Total',      desc: 'Solo ley general' },
];

function formatEjemplo(key, val) {
  if (val === null || val === undefined) return '—';
  if (key === 'ley' || key === 'ley_cup' || key === 'ley_visual') {
    return val !== null ? `${val.toFixed(3)}%` : '—';
  }
  return String(val);
}

export default function ImportarDumpadasView({ toast, setVistaActual }) {
  const { faenaUsuario } = useFaena();
  const faenaId = faenaUsuario?.id ?? faenaUsuario;

  const [step, setStep]           = useState(0);
  const [archivoNombre, setArchivoNombre] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [tipoLey, setTipoLey]     = useState('cu_insoluble');
  const [parseando, setParseando] = useState(false);
  const [importando, setImportando] = useState(false);

  const [dumpadas, setDumpadas]   = useState([]);
  const [frentes, setFreentes]    = useState([]);
  const [resultado, setResultado] = useState(null);

  // Estado intermedio antes de llamar al backend
  const [colMapData, setColMapData] = useState(null); // { headerRow, ejemplo }
  const [parsedTemp, setParsedTemp] = useState(null); // { parsed, frentesUnicos }

  const dropRef = useRef(null);
  const inputRef = useRef(null);

  // ── Fase 1: parseo local del Excel (sin llamada al backend) ──────────
  const parsearArchivo = useCallback(async (file) => {
    setArchivoNombre(file.name);
    setColMapData(null);
    setParsedTemp(null);
    setParseando(true);
    try {
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: 'array', cellDates: true });

      if (!wb.SheetNames.includes(HOJA_DATOS)) {
        toast?.error(`El archivo no tiene una hoja llamada "${HOJA_DATOS}"`);
        setParseando(false);
        return;
      }

      const ws   = wb.Sheets[HOJA_DATOS];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

      const headerRow = rows[FILA_ENCABEZADO] ?? [];
      const COL = detectarCOL(headerRow);

      const desde = fechaDesde ? new Date(fechaDesde + 'T00:00:00') : null;
      const hasta = fechaHasta ? new Date(fechaHasta + 'T23:59:59') : null;

      const parsed = [];
      for (let i = FILA_DATOS_INICIO; i < rows.length; i++) {
        const r = rows[i];
        if (!r[COL.punto]) continue;

        const fechaStr = parseExcelDate(r[COL.fecha]);
        if (!fechaStr) continue;

        const fechaObj = new Date(fechaStr + 'T12:00:00');
        if (desde && fechaObj < desde) continue;
        if (hasta && fechaObj > hasta) continue;

        parsed.push({
          punto:          String(r[COL.punto]).trim(),
          tipo:           String(r[COL.tipo] || 'FRENTE').trim().toUpperCase(),
          numero_dumpada: String(r[COL.numero_dumpada] || '').trim(),
          acopios:        String(r[COL.acopios] || '').trim(),
          jornada:        String(r[COL.jornada] || 'AM').trim().toUpperCase(),
          fecha:          fechaStr,
          ton:            r[COL.ton] !== null ? parseFloat(r[COL.ton]) : 4.6,
          ley:            roundLey(r[COL.ley]),
          ley_cup:        roundLey(r[COL.ley_cup]),
          certificado:    r[COL.certificado] !== null ? String(r[COL.certificado]).trim() : null,
          ley_visual:     roundLey(r[COL.ley_visual]) ?? 0,
          rango:          r[COL.rango] ? String(r[COL.rango]).trim() : null,
        });
      }

      if (parsed.length === 0) {
        toast?.error('No se encontraron dumpadas en el rango de fechas indicado');
        setParseando(false);
        return;
      }

      const frentesUnicos = [...new Map(
        parsed.map(d => [d.punto, { nombre: d.punto, tipo: d.tipo }])
      ).values()];

      setColMapData({ headerRow, ejemplo: parsed[0] });
      setParsedTemp({ parsed, frentesUnicos });
    } catch (err) {
      console.error(err);
      toast?.error('Error al leer el archivo Excel: ' + err.message);
    }
    setParseando(false);
  }, [fechaDesde, fechaHasta, toast]);

  // ── Fase 2: validar con backend y avanzar a paso 1 ──────────────────
  const handleContinuar = useCallback(async () => {
    if (!parsedTemp) return;
    setParseando(true);
    try {
      const previewRes = await dispatchService.importarPreview(faenaId, parsedTemp.frentesUnicos);
      setDumpadas(parsedTemp.parsed);
      setFreentes(previewRes.frentes || []);
      setStep(1);
    } catch (err) {
      console.error(err);
      toast?.error('Error al validar frentes: ' + (err.response?.data?.message || err.message));
    }
    setParseando(false);
  }, [faenaId, parsedTemp, toast]);

  // ── Drag & Drop ───────────────────────────────────────────────────
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dropRef.current?.classList.remove('border-orange-400', 'bg-orange-50');
    const file = e.dataTransfer.files[0];
    if (file) parsearArchivo(file);
  }, [parsearArchivo]);

  const handleDragOver = (e) => {
    e.preventDefault();
    dropRef.current?.classList.add('border-orange-400', 'bg-orange-50');
  };

  const handleDragLeave = () => {
    dropRef.current?.classList.remove('border-orange-400', 'bg-orange-50');
  };

  // ── Importar ──────────────────────────────────────────────────────
  const handleImportar = async () => {
    setImportando(true);
    try {
      const res = await dispatchService.importarConfirmar(faenaId, tipoLey, dumpadas);
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
    setDumpadas([]);
    setFreentes([]);
    setResultado(null);
    setColMapData(null);
    setParsedTemp(null);
  };

  const frentesNuevos   = frentes.filter(f => !f.existe);
  const frentesExisten  = frentes.filter(f => f.existe);

  // ── RENDER ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Stepper */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, idx) => (
          <div key={idx} className="flex items-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors
              ${idx === step ? 'bg-orange-500 text-white shadow-sm' :
                idx < step  ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                ${idx === step ? 'bg-white/30' :
                  idx < step  ? 'bg-orange-300 text-orange-700' :
                                'bg-gray-300 text-gray-500'}`}>
                {idx < step ? '✓' : idx + 1}
              </span>
              {s}
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-px w-6 mx-1 ${idx < step ? 'bg-orange-300' : 'bg-gray-200'}`} />
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
                className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer transition-all duration-150 hover:border-orange-300 hover:bg-orange-50/40 group"
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
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
                    <p className="text-gray-500 text-sm">Leyendo Excel…</p>
                  </div>
                ) : archivoNombre ? (
                  <div className="flex flex-col items-center gap-3">
                    <HiCheckCircle className="w-12 h-12 text-green-500" />
                    <p className="font-semibold text-gray-700">{archivoNombre}</p>
                    <p className="text-sm text-gray-400">Haz clic para cambiar el archivo</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <HiDocumentArrowUp className="w-14 h-14 text-gray-300 group-hover:text-orange-400 transition-colors" />
                    <p className="font-semibold text-gray-600 text-lg">Arrastra tu archivo Excel aquí</p>
                    <p className="text-sm text-gray-400">o haz clic para seleccionarlo</p>
                    <p className="text-xs text-gray-300 mt-1">La hoja debe llamarse <span className="font-mono font-bold">DB</span></p>
                  </div>
                )}
              </div>
            </div>

            {/* Panel de opciones */}
            <div className="space-y-5">

              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <p className="font-bold text-gray-700 text-sm">Rango de fechas</p>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Desde</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={e => setFechaDesde(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={e => setFechaHasta(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                  />
                </div>
                <p className="text-xs text-gray-400">Deja vacío para importar todas las fechas</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                <p className="font-bold text-gray-700 text-sm">Tipo de ley registrada</p>
                {TIPO_LEY_OPCIONES.map(op => (
                  <label key={op.value} className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer border transition-colors
                    ${tipoLey === op.value ? 'border-orange-300 bg-orange-50' : 'border-transparent hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="tipo_ley"
                      value={op.value}
                      checked={tipoLey === op.value}
                      onChange={() => setTipoLey(op.value)}
                      className="mt-0.5 accent-orange-500"
                    />
                    <div>
                      <p className="font-semibold text-sm text-gray-700">{op.label}</p>
                      <p className="text-xs text-gray-400">{op.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

            </div>
          </div>

          {/* ── Panel: columnas detectadas ── */}
          {colMapData && parsedTemp && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                  <HiTableCells className="w-4 h-4 text-orange-400" />
                  <p className="font-bold text-gray-700 text-sm">Columnas detectadas</p>
                  <span className="ml-auto text-xs text-gray-400 font-semibold tabular-nums">
                    {parsedTemp.parsed.length} dumpadas encontradas
                  </span>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                        <th className="px-4 py-2 text-left font-semibold">Campo</th>
                        <th className="px-4 py-2 text-left font-semibold">Col. Excel</th>
                        <th className="px-4 py-2 text-left font-semibold">Encabezado en Excel</th>
                        <th className="px-4 py-2 text-left font-semibold">Ejemplo (1ª fila)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {CAMPOS_DUMP.map(({ label, colIdx, key }) => {
                        const encabezado = colMapData.headerRow[colIdx];
                        const ejemplo = colMapData.ejemplo[key];
                        return (
                          <tr key={key} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-semibold text-gray-700 text-sm">{label}</td>
                            <td className="px-4 py-2">
                              <span className="font-mono text-xs font-bold bg-orange-50 text-orange-700 px-2 py-0.5 rounded">
                                {colLetra(colIdx)}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-500 font-mono">
                              {encabezado !== null && encabezado !== undefined ? String(encabezado) : '—'}
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-600">
                              {formatEjemplo(key, ejemplo)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 bg-orange-50 border-t border-orange-100 text-xs text-orange-700">
                  Si los datos se ven correctos, haz clic en <strong>Continuar</strong> para validar con la base de datos.
                  Si algo está mal, carga un archivo diferente.
                </div>
              </div>

              {/* Aviso: dumpadas que quedarán en estado Ingresado */}
              {(() => {
                const sinAnalisis = parsedTemp.parsed.filter(
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
                              <td className="px-3 py-1.5 text-gray-600">{d.fecha}</td>
                              <td className="px-3 py-1.5 text-gray-600">{d.punto}</td>
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

              <div className="flex justify-end">
                <button
                  onClick={handleContinuar}
                  disabled={parseando}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
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

      {/* ── PASO 1: VALIDAR ── */}
      {step === 1 && (
        <div className="space-y-5">

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Dumpadas a importar', val: dumpadas.length, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' },
              { label: 'Frentes encontrados', val: frentes.length, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
              { label: 'Frentes nuevos', val: frentesNuevos.length, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-100' },
              { label: 'Frentes ya en BD', val: frentesExisten.length, color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
                <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.val}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <HiTableCells className="w-4 h-4 text-gray-400" />
              <p className="font-bold text-gray-700 text-sm">Frentes detectados en el Excel</p>
            </div>
            <div className="overflow-auto max-h-64">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="px-4 py-2 text-left font-semibold">Nombre Excel</th>
                    <th className="px-4 py-2 text-left font-semibold">Código en BD</th>
                    <th className="px-4 py-2 text-left font-semibold">Tipo</th>
                    <th className="px-4 py-2 text-left font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {frentes.map(f => (
                    <tr key={f.nombre} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs font-semibold text-gray-700">{f.nombre}</td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-500">
                        {f.existe ? f.codigo_existente : (
                          <span className="text-yellow-700">{f.codigo_a_crear}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{f.tipo}</td>
                      <td className="px-4 py-2">
                        {f.existe ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                            <HiCheckCircle className="w-3 h-3" /> Existe en BD
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">
                            <HiExclamationTriangle className="w-3 h-3" /> Se creará
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="font-bold text-gray-700 text-sm">Vista previa — primeras 20 dumpadas</p>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                    {['#Dump', 'Frente', 'Jornada', 'Fecha', 'Ton', 'Ley', 'Ley Cup', 'Certificado', 'Rango'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dumpadas.slice(0, 20).map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-mono font-semibold text-gray-700">{d.numero_dumpada}</td>
                      <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{d.punto}</td>
                      <td className="px-3 py-1.5">{d.jornada}</td>
                      <td className="px-3 py-1.5 font-mono">{d.fecha}</td>
                      <td className="px-3 py-1.5 tabular-nums">{d.ton}</td>
                      <td className="px-3 py-1.5 tabular-nums font-semibold text-orange-600">{d.ley?.toFixed(3) ?? '—'}</td>
                      <td className="px-3 py-1.5 tabular-nums">{d.ley_cup?.toFixed(3) ?? '—'}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-500">{d.certificado ?? '—'}</td>
                      <td className="px-3 py-1.5">
                        {d.rango && (
                          <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold">{d.rango}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dumpadas.length > 20 && (
                <p className="text-center text-xs text-gray-400 py-2 border-t border-gray-100">
                  … y {dumpadas.length - 20} más
                </p>
              )}
            </div>
          </div>

          {frentesNuevos.length > 0 && (
            <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
              <HiExclamationTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Se crearán {frentesNuevos.length} frentes de trabajo nuevos</p>
                <p className="text-xs mt-0.5 text-yellow-700">
                  {frentesNuevos.map(f => f.nombre).join(', ')}
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
              disabled={importando}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
            >
              {importando ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Importando {dumpadas.length} dumpadas…
                </>
              ) : (
                <>
                  <HiArrowUpTray className="w-4 h-4" />
                  Importar {dumpadas.length} dumpadas
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
              {resultado.errores?.length === 0 ? '¡Importación completada!' : 'Importación con advertencias'}
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
                      <th className="px-4 py-2 text-left">#Dump</th>
                      <th className="px-4 py-2 text-left">Frente</th>
                      <th className="px-4 py-2 text-left">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {resultado.errores.map((e, i) => (
                      <tr key={i}>
                        <td className="px-4 py-1.5 font-mono">{e.index}</td>
                        <td className="px-4 py-1.5 font-mono">{e.numero_dumpada}</td>
                        <td className="px-4 py-1.5">{e.punto}</td>
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
              onClick={() => setVistaActual('historial')}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
            >
              <HiArrowRight className="w-4 h-4" />
              Ver en Historial
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
