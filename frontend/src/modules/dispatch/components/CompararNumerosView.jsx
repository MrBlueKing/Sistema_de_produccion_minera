/**
 * [TEST] CompararNumerosView
 * Sube un Excel, compara N°Acop con numero_dumpada en BD (match por fecha+frente+jornada+posición)
 * y permite corregir los números desalineados.
 * Para quitar: eliminar este archivo + las referencias en Dispatch.jsx
 */
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { HiArrowLeft, HiDocumentArrowUp, HiCheckCircle, HiExclamationTriangle, HiXCircle, HiBeaker } from 'react-icons/hi2';
import Button from '../../../shared/components/atoms/Button';
import { useFaena } from '../../../contexts/FaenaContext';
import dispatchService from '../services/dispatch';

// ── Reutiliza la misma lógica de parsing que ImportarDumpadasView ──────────────
const HOJA_DATOS = 'DB';

function detectarFilaEncabezado(rows) {
  const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, '');
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    if ((rows[r] ?? []).some(c => { const v = norm(c); return v.includes('certificado') || v.includes('certif'); }))
      return r;
  }
  return 3;
}

const COL_DEFAULT = { punto: 2, tipo: 3, numero_dumpada: 4, acopios: 5, jornada: 6, fecha: 7, ton: 8, ley: 9, ley_cup: 10, certificado: 11 };

function detectarCOL(headerRow) {
  const cols = { ...COL_DEFAULT };
  const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, '');
  for (let c = 8; c < headerRow.length; c++) {
    const v = norm(headerRow[c]);
    if (v.includes('certif')) cols.certificado = c;
  }
  return cols;
}

function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
  }
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  if (typeof val === 'string') {
    const m = val.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
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

function formatFecha(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}
// ──────────────────────────────────────────────────────────────────────────────

export default function CompararNumerosView({ toast, setVistaActual }) {
  const { faenaUsuario } = useFaena();
  const faenaId = faenaUsuario?.id ?? faenaUsuario;

  const fileRef = useRef(null);
  const [fileName, setFileName]         = useState('');
  const [parsedDumpadas, setParsedDumpadas] = useState(null); // filas del Excel
  const [resultados, setResultados]     = useState(null);     // respuesta backend
  const [seleccionados, setSeleccionados] = useState(new Set()); // Set de dumpada_id BD
  const [loadingComparar, setLoadingComparar]   = useState(false);
  const [loadingActualizar, setLoadingActualizar] = useState(false);
  const [resumenActualizar, setResumenActualizar] = useState(null);

  // ── 1. Parsear Excel ───────────────────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResultados(null);
    setSeleccionados(new Set());
    setResumenActualizar(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'array', cellDates: true });
        const ws   = wb.Sheets[HOJA_DATOS];
        if (!ws) { toast.error('Error', `No se encontró la hoja "${HOJA_DATOS}" en el Excel`); return; }

        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
        const filaEnc = detectarFilaEncabezado(rows);
        const COL = detectarCOL(rows[filaEnc] ?? []);

        const parsed = rows
          .slice(filaEnc + 1)
          .filter(r => r[COL.punto] && r[COL.numero_dumpada])
          .map(r => ({
            punto:          String(r[COL.punto]).trim(),
            tipo:           String(r[COL.tipo] || 'FRENTE').trim().toUpperCase(),
            numero_dumpada: String(r[COL.numero_dumpada] || '').trim(),
            acopios:        String(r[COL.acopios] || '').trim(),
            jornada:        String(r[COL.jornada] || 'AM').trim().toUpperCase(),
            fecha:          parseExcelDate(r[COL.fecha]),
            ton:            r[COL.ton] != null ? parseFloat(r[COL.ton]) : null,
            ley:            roundLey(r[COL.ley]),
            certificado:    r[COL.certificado] != null ? String(r[COL.certificado]).trim() : null,
          }));

        setParsedDumpadas(parsed);
        toast.success('Excel cargado', `${parsed.length} filas encontradas`);
      } catch (err) {
        toast.error('Error al leer Excel', err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── 2. Comparar contra BD ─────────────────────────────────────────────────
  const handleComparar = async () => {
    if (!parsedDumpadas?.length || !faenaId) return;
    setLoadingComparar(true);
    setResumenActualizar(null);
    try {
      const res = await dispatchService.compararNumeros(faenaId, parsedDumpadas);
      setResultados(res);

      // Pre-seleccionar los que tienen match en BD y el número no coincide
      const presel = new Set(
        res.resultados
          .filter(r => r.db && !r.ya_coincide)
          .map(r => r.db.id)
      );
      setSeleccionados(presel);
    } catch (err) {
      toast.error('Error al comparar', err.message);
    } finally {
      setLoadingComparar(false);
    }
  };

  // ── 3. Toggle selección ───────────────────────────────────────────────────
  const toggleSeleccion = (dbId) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(dbId) ? next.delete(dbId) : next.add(dbId);
      return next;
    });
  };

  const toggleTodos = () => {
    const candidatos = resultados?.resultados.filter(r => r.db && !r.ya_coincide).map(r => r.db.id) ?? [];
    if (seleccionados.size === candidatos.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(candidatos));
    }
  };

  // ── 4. Aplicar actualización ──────────────────────────────────────────────
  const handleActualizar = async () => {
    if (!seleccionados.size || !resultados) return;

    const actualizaciones = resultados.resultados
      .filter(r => r.db && seleccionados.has(r.db.id))
      .map(r => ({ dumpada_id: r.db.id, nuevo_numero_dumpada: r.excel.numero_dumpada }));

    setLoadingActualizar(true);
    try {
      const res = await dispatchService.actualizarNumeros(actualizaciones);
      setResumenActualizar(res);
      if (res.success) {
        toast.success('Actualización completada', `${res.actualizadas} dumpada(s) actualizadas`);
        // Recargar comparación para reflejar cambios
        await handleComparar();
      }
    } catch (err) {
      toast.error('Error al actualizar', err.message);
    } finally {
      setLoadingActualizar(false);
    }
  };

  // ── Estadísticas ──────────────────────────────────────────────────────────
  const stats = resultados ? {
    total:          resultados.total,
    yaCoinciden:    resultados.ya_coinciden,
    paraActualizar: resultados.para_actualizar,
    sinMatchBD:     resultados.sin_match_bd,
    frentesNF:      resultados.frentes_no_encontrados ?? [],
  } : null;

  const candidatos = resultados?.resultados.filter(r => r.db && !r.ya_coincide) ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setVistaActual('menu')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <HiArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <HiBeaker className="w-5 h-5 text-amber-500" />
            <h1 className="text-xl font-bold text-gray-900">Comparar N° Acopio Excel vs BD</h1>
            <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 font-bold px-2 py-0.5 rounded-full">TEST</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Detecta dumpadas cuyo N°Acop del Excel no coincide con el numero_dumpada en BD y permite corregirlos.</p>
        </div>
      </div>

      {/* Paso 1: Cargar Excel */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <h2 className="font-bold text-gray-700 mb-3">1. Cargar Excel</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <HiDocumentArrowUp className="w-4 h-4 mr-1.5" /> Seleccionar archivo
          </Button>
          {fileName && <span className="text-sm text-gray-600 font-mono">{fileName}</span>}
          {parsedDumpadas && (
            <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full font-semibold">
              {parsedDumpadas.length} filas cargadas
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">El archivo debe tener una hoja llamada <strong>DB</strong> con el mismo formato del importador.</p>
      </div>

      {/* Paso 2: Comparar */}
      {parsedDumpadas && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
          <h2 className="font-bold text-gray-700 mb-3">2. Comparar con BD</h2>
          <p className="text-sm text-gray-500 mb-3">
            El sistema agrupará las filas del Excel por <strong>fecha + frente + jornada</strong> y las comparará con las dumpadas en BD en el mismo orden posicional.
          </p>
          <Button variant="primary" onClick={handleComparar} disabled={loadingComparar}>
            {loadingComparar ? 'Comparando...' : 'Comparar ahora'}
          </Button>
        </div>
      )}

      {/* Resumen de comparación */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            <p className="text-xs text-gray-500 mt-0.5">Filas Excel</p>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{stats.yaCoinciden}</p>
            <p className="text-xs text-green-600 mt-0.5">Ya correctos</p>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{stats.paraActualizar}</p>
            <p className="text-xs text-amber-600 mt-0.5">Para corregir</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.sinMatchBD}</p>
            <p className="text-xs text-red-500 mt-0.5">Sin match en BD</p>
          </div>
        </div>
      )}

      {/* Frentes no encontrados */}
      {stats?.frentesNF.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-5">
          <p className="text-sm font-semibold text-orange-700 mb-1">⚠️ Frentes del Excel no encontrados en BD ({stats.frentesNF.length})</p>
          <p className="text-xs text-orange-600">{stats.frentesNF.join(', ')}</p>
        </div>
      )}

      {/* Tabla comparación */}
      {resultados && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-5">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-bold text-gray-700">3. Resultados de comparación</h2>
              <p className="text-xs text-gray-400 mt-0.5">Solo se muestran las filas con diferencia o sin match.</p>
            </div>
            {candidatos.length > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={toggleTodos} className="text-xs text-blue-600 underline hover:text-blue-800">
                  {seleccionados.size === candidatos.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleActualizar}
                  disabled={loadingActualizar || seleccionados.size === 0}
                >
                  {loadingActualizar ? 'Actualizando...' : `Actualizar ${seleccionados.size} seleccionados`}
                </Button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide border-b border-gray-200">
                  <th className="py-2 px-3 text-left w-8"></th>
                  <th className="py-2 px-3 text-left">Fecha</th>
                  <th className="py-2 px-3 text-left">Frente</th>
                  <th className="py-2 px-3 text-center">Jornada</th>
                  <th className="py-2 px-3 text-center">Pos.</th>
                  <th className="py-2 px-3 text-right font-semibold text-amber-700">N°Acop Excel</th>
                  <th className="py-2 px-3 text-right font-semibold text-blue-700">N° BD actual</th>
                  <th className="py-2 px-3 text-right">Ley Excel</th>
                  <th className="py-2 px-3 text-right">Ley BD</th>
                  <th className="py-2 px-3 text-right">Ley Visual BD</th>
                  <th className="py-2 px-3 text-left">Dumper BD</th>
                  <th className="py-2 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {resultados.resultados
                  .filter(r => !r.ya_coincide) // solo las problemáticas
                  .map((r, i) => {
                    const isSelected = r.db && seleccionados.has(r.db.id);
                    const sinMatch   = !r.db;
                    return (
                      <tr
                        key={i}
                        className={`transition-colors ${
                          sinMatch        ? 'bg-red-50'
                          : isSelected    ? 'bg-amber-50'
                          : 'hover:bg-gray-50'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-2 px-3 text-center">
                          {!sinMatch && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSeleccion(r.db.id)}
                              className="w-3.5 h-3.5 accent-amber-500 cursor-pointer"
                            />
                          )}
                        </td>
                        <td className="py-2 px-3 tabular-nums text-gray-600">{formatFecha(r.fecha)}</td>
                        <td className="py-2 px-3 font-mono text-gray-700">{r.frente_codigo}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-semibold">{r.jornada}</span>
                        </td>
                        <td className="py-2 px-3 text-center text-gray-400">{r.posicion}</td>

                        {/* N° Excel */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-amber-700">
                          {r.excel.numero_dumpada || '—'}
                        </td>

                        {/* N° BD */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-blue-700">
                          {sinMatch
                            ? <span className="text-red-500 font-normal">No encontrada</span>
                            : r.db.numero_dumpada}
                        </td>

                        {/* Ley Excel */}
                        <td className="py-2 px-3 text-right tabular-nums text-gray-500">
                          {r.excel.ley != null ? `${r.excel.ley.toFixed(3)}%` : '—'}
                        </td>

                        {/* Ley BD */}
                        <td className="py-2 px-3 text-right tabular-nums text-gray-500">
                          {r.db?.ley != null ? `${parseFloat(r.db.ley).toFixed(3)}%` : '—'}
                        </td>

                        {/* Ley Visual BD */}
                        <td className="py-2 px-3 text-right tabular-nums text-purple-600 font-semibold">
                          {r.db?.ley_visual != null ? `${parseFloat(r.db.ley_visual).toFixed(2)}%` : '—'}
                        </td>

                        {/* Dumper */}
                        <td className="py-2 px-3 text-gray-500 truncate max-w-[120px]">
                          {r.db?.nombre_maquina || '—'}
                        </td>

                        {/* Estado */}
                        <td className="py-2 px-3 text-center">
                          {sinMatch ? (
                            <HiXCircle className="w-4 h-4 text-red-400 mx-auto" />
                          ) : r.db.estado === 'Completado' ? (
                            <HiCheckCircle className="w-4 h-4 text-green-500 mx-auto" title="Completado" />
                          ) : (
                            <HiExclamationTriangle className="w-4 h-4 text-amber-400 mx-auto" title="Ingresado" />
                          )}
                        </td>
                      </tr>
                    );
                  })}

                {resultados.resultados.filter(r => !r.ya_coincide).length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-10 text-center text-green-600 font-semibold">
                      <HiCheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                      Todos los números ya coinciden
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resumen post-actualización */}
      {resumenActualizar && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="font-semibold text-green-800">
            ✅ {resumenActualizar.actualizadas} dumpada(s) actualizadas correctamente.
          </p>
          {resumenActualizar.errores?.length > 0 && (
            <ul className="mt-2 text-xs text-red-600 list-disc pl-4">
              {resumenActualizar.errores.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
