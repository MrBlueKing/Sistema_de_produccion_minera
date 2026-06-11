/**
 * [TEST] CompararMezclasView
 * Sube un Excel, compara códigos de mezcla con los existentes en BD
 * (match por dumpadas contenidas) y permite corregir los códigos desalineados.
 * Para quitar: eliminar este archivo + referencias en Dispatch.jsx
 */
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { HiArrowLeft, HiDocumentArrowUp, HiCheckCircle, HiExclamationTriangle, HiXCircle, HiBeaker } from 'react-icons/hi2';
import Button from '../../../shared/components/atoms/Button';
import { useFaena } from '../../../contexts/FaenaContext';
import dispatchService from '../services/dispatch';

const HOJA_MEZCLAS = 'Mezcla';

// ── Parsing de mezclas del Excel (col I = código, col H = numero_dumpada) ──────

function esCabeceraMezcla(colH, colI) {
  if (colH != null && String(colH).trim() !== '') return false;
  const iStr = colI != null ? String(colI).trim() : '';
  return iStr !== '' && isNaN(parseFloat(iStr)) && !iStr.includes(' ') && iStr.length <= 10;
}

function esFilaDumpada(colH) {
  if (colH == null) return false;
  const s = String(colH).trim();
  return s !== '' && !isNaN(parseFloat(s));
}

function parsearMezclasDesdeExcel(rows) {
  const resultado = []; // [{codigo, dumpadas: [numero_dumpada, ...]}]
  let actual = null;

  for (const r of rows) {
    const colH = r[7];
    const colI = r[8];

    if (esCabeceraMezcla(colH, colI)) {
      if (actual) resultado.push(actual);
      actual = { codigo: String(colI).trim(), dumpadas: [] };
      continue;
    }
    if (!actual) continue;
    if (esFilaDumpada(colH)) {
      actual.dumpadas.push(String(colH).trim());
    }
  }
  if (actual) resultado.push(actual);
  return resultado.filter(m => m.dumpadas.length > 0);
}

// ── Colores según tipo de match ───────────────────────────────────────────────
function badgeMatch(tipo) {
  if (tipo === 'exacto')   return { bg: 'bg-green-100 text-green-800',  label: '✅ Exacto' };
  if (tipo === 'parcial')  return { bg: 'bg-amber-100 text-amber-800',  label: '⚠️ Parcial' };
  if (tipo === 'debil')    return { bg: 'bg-orange-100 text-orange-800', label: '⚠️ Débil' };
  return { bg: 'bg-red-100 text-red-700', label: 'Sin match' };
}

export default function CompararMezclasView({ toast, setVistaActual }) {
  const { faenaUsuario } = useFaena();
  const faenaId = faenaUsuario?.id ?? faenaUsuario;

  const [parseando, setParsando]       = useState(false);
  const [comparando, setComparando]    = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [archivoNombre, setArchivoNombre] = useState('');
  const [mezclasExcel, setMezclasExcel] = useState([]);
  const [resultados, setResultados]    = useState(null);
  const [seleccionadas, setSeleccionadas] = useState({});
  const inputRef = useRef(null);

  const parsearArchivo = async (file) => {
    setArchivoNombre(file.name);
    setResultados(null);
    setSeleccionadas({});
    setParsando(true);
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: 'array', cellDates: true });
      if (!wb.SheetNames.includes(HOJA_MEZCLAS)) {
        toast?.error(`El archivo no tiene una hoja llamada "${HOJA_MEZCLAS}"`);
        setParsando(false);
        return;
      }
      const ws   = wb.Sheets[HOJA_MEZCLAS];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
      const mezclas = parsearMezclasDesdeExcel(rows);
      if (mezclas.length === 0) {
        toast?.error('No se encontraron mezclas con dumpadas en la hoja "Mezcla"');
        setParsando(false);
        return;
      }
      setMezclasExcel(mezclas);
      toast?.success(`${mezclas.length} mezclas detectadas`);
    } catch (err) {
      toast?.error('Error al leer el archivo: ' + err.message);
    }
    setParsando(false);
  };

  const handleComparar = async () => {
    setComparando(true);
    try {
      const payload = mezclasExcel.map(m => ({
        codigo_excel: m.codigo,
        dumpadas: m.dumpadas,
      }));
      const res = await dispatchService.compararMezclas(faenaId, payload);
      setResultados(res);
      // Pre-seleccionar solo matches exactos que no coincidan ya
      const sel = {};
      (res.resultados ?? []).forEach((r, i) => {
        if (r.match_tipo === 'exacto' && !r.ya_coincide && r.db) sel[i] = true;
      });
      setSeleccionadas(sel);
    } catch (err) {
      toast?.error('Error al comparar: ' + (err.response?.data?.message || err.message));
    }
    setComparando(false);
  };

  const handleActualizar = async () => {
    const act = (resultados?.resultados ?? [])
      .filter((r, i) => seleccionadas[i] && r.db && !r.ya_coincide)
      .map(r => ({ mezcla_id: r.db.id, nuevo_codigo: r.excel.codigo }));

    if (act.length === 0) { toast?.error('Selecciona al menos una mezcla para actualizar'); return; }

    setActualizando(true);
    try {
      const res = await dispatchService.actualizarMezclas(act);
      if (res.success) {
        toast?.success(`${res.actualizadas} código${res.actualizadas !== 1 ? 's' : ''} actualizado${res.actualizadas !== 1 ? 's' : ''}`);
        if (res.errores?.length) toast?.error('Errores: ' + res.errores.join(', '));
        // Refrescar comparación
        await handleComparar();
      } else {
        toast?.error('Error: ' + res.error);
      }
    } catch (err) {
      toast?.error('Error al actualizar: ' + (err.response?.data?.message || err.message));
    }
    setActualizando(false);
  };

  const toggleTodos = (valor) => {
    const sel = {};
    (resultados?.resultados ?? []).forEach((r, i) => {
      if (r.db && !r.ya_coincide) sel[i] = valor;
    });
    setSeleccionadas(sel);
  };

  const selCount = Object.values(seleccionadas).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setVistaActual('hub')} className="text-gray-400 hover:text-gray-600">
          <HiArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-800">Comparar Códigos de Mezcla</h2>
            <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">[TEST]</span>
          </div>
          <p className="text-sm text-gray-500">Corrige códigos de mezcla (CZ1001 → CZ1503) usando el Excel como referencia</p>
        </div>
      </div>

      {/* Upload */}
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-all"
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={e => e.target.files[0] && parsearArchivo(e.target.files[0])} />
        {parseando ? (
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
            <p className="text-sm text-gray-500">Leyendo hoja "Mezcla"…</p>
          </div>
        ) : archivoNombre ? (
          <div className="flex flex-col items-center gap-2">
            <HiCheckCircle className="w-10 h-10 text-green-500" />
            <p className="font-semibold text-gray-700">{archivoNombre}</p>
            <p className="text-sm text-gray-400">{mezclasExcel.length} mezclas con dumpadas detectadas · Haz clic para cambiar</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <HiDocumentArrowUp className="w-12 h-12 text-gray-300" />
            <p className="font-semibold text-gray-600">Sube el Excel con la hoja <span className="font-mono">Mezcla</span></p>
            <p className="text-xs text-gray-400">Se usarán las dumpadas de cada mezcla para hacer el match</p>
          </div>
        )}
      </div>

      {/* Botón comparar */}
      {mezclasExcel.length > 0 && !resultados && (
        <div className="flex justify-end">
          <Button onClick={handleComparar} disabled={comparando} variant="primary">
            {comparando ? 'Comparando…' : `Comparar ${mezclasExcel.length} mezclas`}
          </Button>
        </div>
      )}

      {/* Resultados */}
      {resultados && (
        <div className="space-y-4">
          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Ya coinciden',    val: resultados.ya_coinciden,    color: 'text-green-600',  bg: 'bg-green-50 border-green-100' },
              { label: 'Para actualizar', val: resultados.para_actualizar, color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-100' },
              { label: 'Sin match',       val: resultados.sin_match,       color: 'text-red-500',    bg: 'bg-red-50 border-red-100' },
              { label: 'Total',           val: resultados.total,           color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-200' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
                <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.val}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-between">
            <div className="flex gap-3 text-xs">
              <button onClick={() => toggleTodos(true)}  className="text-amber-600 hover:underline font-semibold">Seleccionar todos</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => toggleTodos(false)} className="text-gray-400 hover:underline">Ninguno</button>
              <span className="text-gray-300">|</span>
              <button onClick={handleComparar} disabled={comparando} className="text-teal-600 hover:underline font-semibold">
                {comparando ? 'Actualizando…' : 'Refrescar'}
              </button>
            </div>
            <Button onClick={handleActualizar} disabled={actualizando || selCount === 0} variant="primary">
              {actualizando ? 'Actualizando…' : `Actualizar ${selCount} código${selCount !== 1 ? 's' : ''}`}
            </Button>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide text-xs border-b border-gray-200">
                  <th className="px-3 py-3 text-left w-8"></th>
                  <th className="px-3 py-3 text-left">Código Excel</th>
                  <th className="px-3 py-3 text-left">Código en BD</th>
                  <th className="px-3 py-3 text-center">Match</th>
                  <th className="px-3 py-3 text-center">Dump. coincidentes</th>
                  <th className="px-3 py-3 text-right">Ton BD</th>
                  <th className="px-3 py-3 text-center">Estado BD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(resultados.resultados ?? []).map((r, i) => {
                  const badge = badgeMatch(r.match_tipo);
                  const puedeSeleccionar = r.db && !r.ya_coincide;
                  return (
                    <tr key={i} className={`hover:bg-gray-50 ${r.ya_coincide ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-2.5">
                        {puedeSeleccionar && (
                          <input type="checkbox" checked={!!seleccionadas[i]}
                            onChange={e => setSeleccionadas(p => ({ ...p, [i]: e.target.checked }))}
                            className="accent-amber-500 w-4 h-4" />
                        )}
                        {r.ya_coincide && <HiCheckCircle className="w-4 h-4 text-green-500" />}
                        {!r.db && <HiXCircle className="w-4 h-4 text-red-400" />}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono font-bold text-gray-800">{r.excel.codigo}</span>
                        <span className="text-xs text-gray-400 ml-1">({r.excel.n_dumpadas} dump.)</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {r.db
                          ? <span className={`font-mono font-bold ${r.ya_coincide ? 'text-green-700' : 'text-amber-700'}`}>{r.db.codigo}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.bg}`}>{badge.label}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-500">
                        {r.db ? `${r.n_coincidentes}/${r.excel.n_dumpadas}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-600 tabular-nums">
                        {r.db?.total_ton != null ? `${Number(r.db.total_ton).toFixed(1)} t` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {r.db?.estado
                          ? <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{r.db.estado}</span>
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
