/**
 * [TEST] CompararNumerosView
 * Tres modos:
 *  - "numero": compara N°Acop con numero_dumpada en BD (match por fecha+frente+jornada+posición)
 *    y permite corregir los números desalineados.
 *  - "frente": compara el frente/tipo correcto (según Excel corregido) contra el que tiene
 *    asignado cada dumpada en BD (match directo por numero_dumpada) y permite corregirlo.
 *  - "fecha": compara la fecha correcta (según Excel corregido) contra la que tiene asignada
 *    cada dumpada en BD (match directo por numero_dumpada) y permite corregirla.
 *  - "estructura": revisa frente por frente (no dumpada por dumpada) si sus columnas
 *    tunel/manto/calle/hebra/numero_frente coinciden con lo que el Excel indica, y permite
 *    repararlas. Útil para frentes creados antes de que se reconociera el prefijo "NIVEL"
 *    como túnel: su codigo_completo ya es correcto, pero su estructura interna quedó mal.
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

// Fila "Campo BD | Valor" para el preview de cómo quedaría guardado un frente nuevo.
function FilaPreviewFrente({ campo, valor, mono = false }) {
  const vacio = valor === null || valor === undefined || valor === '';
  return (
    <tr className="border-t border-purple-100 first:border-t-0">
      <td className="px-3 py-1 text-purple-500 font-medium w-40 align-top">{campo}</td>
      <td className={`px-3 py-1 text-purple-900 ${mono ? 'font-mono' : ''} ${vacio ? 'text-purple-300 italic' : ''}`}>
        {vacio ? 'null' : String(valor)}
      </td>
    </tr>
  );
}
// ──────────────────────────────────────────────────────────────────────────────

export default function CompararNumerosView({ toast, setVistaActual }) {
  const { faenaUsuario } = useFaena();
  const faenaId = faenaUsuario?.id ?? faenaUsuario;

  const [modo, setModo] = useState('numero'); // 'numero' | 'frente' | 'fecha' | 'estructura'

  const fileRef = useRef(null);
  const [fileName, setFileName]         = useState('');
  const [parsedDumpadas, setParsedDumpadas] = useState(null); // filas del Excel
  const [resultados, setResultados]     = useState(null);     // respuesta backend (modo numero)
  const [seleccionados, setSeleccionados] = useState(new Set()); // Set de dumpada_id BD
  const [loadingComparar, setLoadingComparar]   = useState(false);
  const [loadingActualizar, setLoadingActualizar] = useState(false);
  const [resumenActualizar, setResumenActualizar] = useState(null);

  // ── Estado modo "frente" ────────────────────────────────────────────────────
  const [resultadosFrente, setResultadosFrente]       = useState(null); // respuesta backend (modo frente)
  const [seleccionadosFrente, setSeleccionadosFrente] = useState(new Set()); // Set de numero_dumpada
  const [loadingCompararFrente, setLoadingCompararFrente]     = useState(false);
  const [loadingCorregirFrente, setLoadingCorregirFrente]     = useState(false);
  const [resumenCorregirFrente, setResumenCorregirFrente]     = useState(null);
  const [mostrarCorrectosFrente, setMostrarCorrectosFrente]   = useState(false);

  // ── Estado modo "fecha" ─────────────────────────────────────────────────────
  const [resultadosFecha, setResultadosFecha]       = useState(null); // respuesta backend (modo fecha)
  const [seleccionadosFecha, setSeleccionadosFecha] = useState(new Set()); // Set de numero_dumpada
  const [loadingCompararFecha, setLoadingCompararFecha]     = useState(false);
  const [loadingCorregirFecha, setLoadingCorregirFecha]     = useState(false);
  const [resumenCorregirFecha, setResumenCorregirFecha]     = useState(null);
  const [mostrarCorrectosFecha, setMostrarCorrectosFecha]   = useState(false);

  // ── Estado modo "estructura" ─────────────────────────────────────────────────
  const [resultadosEstructura, setResultadosEstructura]       = useState(null); // respuesta backend (modo estructura)
  const [seleccionadosEstructura, setSeleccionadosEstructura] = useState(new Set()); // Set de frente_id
  const [loadingCompararEstructura, setLoadingCompararEstructura] = useState(false);
  const [loadingCorregirEstructura, setLoadingCorregirEstructura] = useState(false);
  const [resumenCorregirEstructura, setResumenCorregirEstructura] = useState(null);

  // ── 1. Parsear Excel ───────────────────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResultados(null);
    setSeleccionados(new Set());
    setResumenActualizar(null);
    setResultadosFrente(null);
    setSeleccionadosFrente(new Set());
    setResumenCorregirFrente(null);
    setMostrarCorrectosFrente(false);
    setResultadosFecha(null);
    setSeleccionadosFecha(new Set());
    setResumenCorregirFecha(null);
    setMostrarCorrectosFecha(false);
    setResultadosEstructura(null);
    setSeleccionadosEstructura(new Set());
    setResumenCorregirEstructura(null);

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

      // Pre-seleccionar solo los match por LEY (confianza alta), no los posicionales
      const presel = new Set(
        res.resultados
          .filter(r => r.db && !r.ya_coincide && r.match_tipo === 'ley')
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

  // ── Modo "frente": 2. Comparar contra BD ────────────────────────────────────
  const handleCompararFrente = async () => {
    if (!parsedDumpadas?.length || !faenaId) return;
    setLoadingCompararFrente(true);
    setResumenCorregirFrente(null);
    try {
      const res = await dispatchService.compararFrentes(faenaId, parsedDumpadas);
      setResultadosFrente(res);
      setSeleccionadosFrente(new Set(
        res.resultados.filter(r => !r.sin_match && !r.ya_correcto).map(r => r.numero_dumpada)
      ));
    } catch (err) {
      toast.error('Error al comparar', err.message);
    } finally {
      setLoadingCompararFrente(false);
    }
  };

  const toggleSeleccionFrente = (numeroDumpada) => {
    setSeleccionadosFrente(prev => {
      const next = new Set(prev);
      next.has(numeroDumpada) ? next.delete(numeroDumpada) : next.add(numeroDumpada);
      return next;
    });
  };

  const toggleTodosFrente = () => {
    const candidatos = candidatosFrente.map(r => r.numero_dumpada);
    if (seleccionadosFrente.size === candidatos.length) {
      setSeleccionadosFrente(new Set());
    } else {
      setSeleccionadosFrente(new Set(candidatos));
    }
  };

  // ── Modo "frente": 3. Aplicar corrección ────────────────────────────────────
  const handleCorregirFrente = async () => {
    if (!seleccionadosFrente.size || !resultadosFrente) return;

    const correcciones = resultadosFrente.resultados
      .filter(r => !r.sin_match && seleccionadosFrente.has(r.numero_dumpada))
      .map(r => ({ dumpada_id: r.dumpada_id, punto: r.punto_excel, tipo: r.tipo_excel }));

    setLoadingCorregirFrente(true);
    try {
      const res = await dispatchService.corregirFrentes(faenaId, correcciones);
      setResumenCorregirFrente(res);
      if (res.success) {
        toast.success('Corrección completada', `${res.corregidas} dumpada(s) corregidas (${res.frentes_creados} frente(s) nuevo(s))`);
        await handleCompararFrente();
      }
    } catch (err) {
      toast.error('Error al corregir', err.message);
    } finally {
      setLoadingCorregirFrente(false);
    }
  };

  const statsFrente = resultadosFrente ? {
    total:            resultadosFrente.total,
    yaCorrectos:      resultadosFrente.ya_correctos,
    paraCorregir:     resultadosFrente.para_corregir,
    sinMatchBD:       resultadosFrente.sin_match_bd,
    frentesNuevos:      resultadosFrente.frentes_nuevos ?? 0,
    frentesNuevosLista: resultadosFrente.frentes_nuevos_lista ?? [],
    tiposNuevos:        resultadosFrente.tipos_nuevos ?? 0,
    tiposNuevosLista:   resultadosFrente.tipos_nuevos_lista ?? [],
  } : null;

  const candidatosFrente = resultadosFrente?.resultados.filter(r => !r.sin_match && !r.ya_correcto) ?? [];
  const filasTablaFrente = resultadosFrente
    ? (mostrarCorrectosFrente ? resultadosFrente.resultados : resultadosFrente.resultados.filter(r => !r.ya_correcto))
    : [];

  // ── Modo "fecha": 2. Comparar contra BD ─────────────────────────────────────
  const handleCompararFecha = async () => {
    if (!parsedDumpadas?.length || !faenaId) return;
    setLoadingCompararFecha(true);
    setResumenCorregirFecha(null);
    try {
      const res = await dispatchService.compararFechas(faenaId, parsedDumpadas);
      setResultadosFecha(res);
      setSeleccionadosFecha(new Set(
        res.resultados.filter(r => !r.sin_match && !r.ya_correcto).map(r => r.numero_dumpada)
      ));
    } catch (err) {
      toast.error('Error al comparar', err.message);
    } finally {
      setLoadingCompararFecha(false);
    }
  };

  const toggleSeleccionFecha = (numeroDumpada) => {
    setSeleccionadosFecha(prev => {
      const next = new Set(prev);
      next.has(numeroDumpada) ? next.delete(numeroDumpada) : next.add(numeroDumpada);
      return next;
    });
  };

  const toggleTodosFecha = () => {
    const candidatos = candidatosFecha.map(r => r.numero_dumpada);
    if (seleccionadosFecha.size === candidatos.length) {
      setSeleccionadosFecha(new Set());
    } else {
      setSeleccionadosFecha(new Set(candidatos));
    }
  };

  // ── Modo "fecha": 3. Aplicar corrección ──────────────────────────────────────
  const handleCorregirFecha = async () => {
    if (!seleccionadosFecha.size || !resultadosFecha) return;

    const correcciones = resultadosFecha.resultados
      .filter(r => !r.sin_match && seleccionadosFecha.has(r.numero_dumpada))
      .map(r => ({ dumpada_id: r.dumpada_id, fecha: r.fecha_excel }));

    setLoadingCorregirFecha(true);
    try {
      const res = await dispatchService.corregirFechas(faenaId, correcciones);
      setResumenCorregirFecha(res);
      if (res.success) {
        toast.success('Corrección completada', `${res.corregidas} dumpada(s) corregidas`);
        await handleCompararFecha();
      }
    } catch (err) {
      toast.error('Error al corregir', err.message);
    } finally {
      setLoadingCorregirFecha(false);
    }
  };

  const statsFecha = resultadosFecha ? {
    total:         resultadosFecha.total,
    yaCorrectos:   resultadosFecha.ya_correctos,
    paraCorregir:  resultadosFecha.para_corregir,
    sinMatchBD:    resultadosFecha.sin_match_bd,
  } : null;

  const candidatosFecha = resultadosFecha?.resultados.filter(r => !r.sin_match && !r.ya_correcto) ?? [];
  const filasTablaFecha = resultadosFecha
    ? (mostrarCorrectosFecha ? resultadosFecha.resultados : resultadosFecha.resultados.filter(r => !r.ya_correcto))
    : [];

  // ── Modo "estructura": 2. Comparar contra BD ────────────────────────────────
  const handleCompararEstructura = async () => {
    if (!parsedDumpadas?.length || !faenaId) return;
    setLoadingCompararEstructura(true);
    setResumenCorregirEstructura(null);
    try {
      const res = await dispatchService.compararEstructura(faenaId, parsedDumpadas);
      setResultadosEstructura(res);
      setSeleccionadosEstructura(new Set(res.resultados.map(r => r.frente_id)));
    } catch (err) {
      toast.error('Error al comparar', err.message);
    } finally {
      setLoadingCompararEstructura(false);
    }
  };

  const toggleSeleccionEstructura = (frenteId) => {
    setSeleccionadosEstructura(prev => {
      const next = new Set(prev);
      next.has(frenteId) ? next.delete(frenteId) : next.add(frenteId);
      return next;
    });
  };

  const toggleTodosEstructura = () => {
    const candidatos = (resultadosEstructura?.resultados ?? []).map(r => r.frente_id);
    if (seleccionadosEstructura.size === candidatos.length) {
      setSeleccionadosEstructura(new Set());
    } else {
      setSeleccionadosEstructura(new Set(candidatos));
    }
  };

  // ── Modo "estructura": 3. Aplicar reparación ────────────────────────────────
  const handleCorregirEstructura = async () => {
    if (!seleccionadosEstructura.size || !resultadosEstructura) return;

    const correcciones = resultadosEstructura.resultados
      .filter(r => seleccionadosEstructura.has(r.frente_id))
      .map(r => ({ frente_id: r.frente_id, ...r.propuesto }));

    setLoadingCorregirEstructura(true);
    try {
      const res = await dispatchService.corregirEstructura(faenaId, correcciones);
      setResumenCorregirEstructura(res);
      if (res.success) {
        toast.success('Reparación completada', `${res.corregidos} frente(s) reparados`);
        await handleCompararEstructura();
      }
    } catch (err) {
      toast.error('Error al reparar', err.message);
    } finally {
      setLoadingCorregirEstructura(false);
    }
  };

  const statsEstructura = resultadosEstructura ? {
    total:              resultadosEstructura.total,
    dumpadasAfectadas:  resultadosEstructura.resultados.reduce((sum, r) => sum + r.dumpadas_asociadas, 0),
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
            <h1 className="text-xl font-bold text-gray-900">Comparar Excel vs BD</h1>
            <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 font-bold px-2 py-0.5 rounded-full">TEST</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {modo === 'numero'
              ? 'Detecta dumpadas cuyo N°Acop del Excel no coincide con el numero_dumpada en BD y permite corregirlos.'
              : modo === 'frente'
              ? 'Detecta dumpadas cuyo frente/tipo quedó mal asignado y lo corrige según el Excel corregido.'
              : modo === 'fecha'
              ? 'Detecta dumpadas cuya fecha quedó mal asignada y la corrige según el Excel corregido.'
              : 'Revisa frente por frente (no dumpada por dumpada) si su estructura (túnel/manto/calle/hebra/número) quedó mal descompuesta, y permite repararla.'}
          </p>
        </div>
      </div>

      {/* Selector de modo */}
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => setModo('numero')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
            modo === 'numero' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          N° Acopio
        </button>
        <button
          onClick={() => setModo('frente')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
            modo === 'frente' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Frente / Tipo
        </button>
        <button
          onClick={() => setModo('fecha')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
            modo === 'fecha' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Fecha
        </button>
        <button
          onClick={() => setModo('estructura')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
            modo === 'estructura' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Estructura
        </button>
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
        <p className="text-xs text-gray-400 mt-2">El archivo debe tener una hoja llamada <strong>DB</strong> con el mismo formato del importador (con punto y tipo ya corregidos).</p>
      </div>

      {/* Paso 2: Comparar */}
      {parsedDumpadas && modo === 'numero' && (
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

      {parsedDumpadas && modo === 'frente' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
          <h2 className="font-bold text-gray-700 mb-3">2. Comparar con BD</h2>
          <p className="text-sm text-gray-500 mb-3">
            El sistema busca cada dumpada en BD directamente por <strong>número de dumpada</strong> y compara su frente/tipo actual contra el correcto según este Excel.
          </p>
          <Button variant="primary" onClick={handleCompararFrente} disabled={loadingCompararFrente}>
            {loadingCompararFrente ? 'Comparando...' : 'Comparar ahora'}
          </Button>
        </div>
      )}

      {parsedDumpadas && modo === 'fecha' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
          <h2 className="font-bold text-gray-700 mb-3">2. Comparar con BD</h2>
          <p className="text-sm text-gray-500 mb-3">
            El sistema busca cada dumpada en BD directamente por <strong>número de dumpada</strong> y compara su fecha actual contra la correcta según este Excel.
          </p>
          <Button variant="primary" onClick={handleCompararFecha} disabled={loadingCompararFecha}>
            {loadingCompararFecha ? 'Comparando...' : 'Comparar ahora'}
          </Button>
        </div>
      )}

      {parsedDumpadas && modo === 'estructura' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
          <h2 className="font-bold text-gray-700 mb-3">2. Revisar estructura</h2>
          <p className="text-sm text-gray-500 mb-3">
            El sistema toma cada <strong>frente único</strong> mencionado en el Excel (no cada dumpada) y compara su estructura guardada (túnel/manto/calle/hebra/número) contra la que se calcula hoy desde el texto real del punto. No afecta a <code>codigo_completo</code> ni a las dumpadas ya asignadas.
          </p>
          <Button variant="primary" onClick={handleCompararEstructura} disabled={loadingCompararEstructura}>
            {loadingCompararEstructura ? 'Revisando...' : 'Revisar ahora'}
          </Button>
        </div>
      )}

      {/* Resumen de comparación */}
      {modo === 'numero' && stats && (
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
      {modo === 'numero' && stats?.frentesNF.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-5">
          <p className="text-sm font-semibold text-orange-700 mb-1">⚠️ Frentes del Excel no encontrados en BD ({stats.frentesNF.length})</p>
          <p className="text-xs text-orange-600">{stats.frentesNF.join(', ')}</p>
        </div>
      )}

      {/* Tabla comparación */}
      {modo === 'numero' && resultados && (
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
                  <th className="py-2 px-3 text-center">Confianza</th>
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
                        {/* Confianza del match */}
                        <td className="py-2 px-3 text-center">
                          {sinMatch ? (
                            <span className="text-[10px] font-bold text-red-500">Sin match</span>
                          ) : r.match_tipo === 'ley' ? (
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full" title="Match encontrado por ley coincidente">✅ Ley</span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full" title="Match por posición — verificar manualmente">⚠️ Posic.</span>
                          )}
                        </td>

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

      {/* Resumen post-actualización (modo numero) */}
      {modo === 'numero' && resumenActualizar && (
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

      {/* ── Modo "frente": resumen de comparación ──────────────────────────── */}
      {modo === 'frente' && statsFrente && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">{statsFrente.total}</p>
            <p className="text-xs text-gray-500 mt-0.5">Filas Excel</p>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{statsFrente.yaCorrectos}</p>
            <p className="text-xs text-green-600 mt-0.5">Ya correctos</p>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{statsFrente.paraCorregir}</p>
            <p className="text-xs text-amber-600 mt-0.5">Para corregir</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{statsFrente.sinMatchBD}</p>
            <p className="text-xs text-red-500 mt-0.5">N° no encontrado en BD</p>
          </div>
        </div>
      )}

      {/* ── Modo "frente": resumen de creación (frentes/tipos nuevos) ──────── */}
      {modo === 'frente' && statsFrente && (statsFrente.frentesNuevos > 0 || statsFrente.tiposNuevos > 0) && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-5">
          <p className="text-sm font-semibold text-purple-800 mb-2">
            📌 Al aplicar la corrección de los seleccionados se crearán registros nuevos en BD. Así quedarían guardados:
          </p>

          {statsFrente.tiposNuevos > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-purple-700 mb-1.5">
                {statsFrente.tiposNuevos} tipo(s) de frente nuevo(s) (tabla <code>tipos_frente</code>):
              </p>
              <div className="flex flex-wrap gap-2">
                {statsFrente.tiposNuevosLista.map((t, i) => (
                  <span key={i} className="text-xs font-mono bg-white border border-purple-200 rounded-lg px-2.5 py-1 text-purple-700">
                    nombre=<strong>{t.nombre}</strong> · abreviatura=<strong>{t.abreviatura}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {statsFrente.frentesNuevos > 0 && (
            <div>
              <p className="text-xs font-semibold text-purple-700 mb-1.5">
                {statsFrente.frentesNuevos} frente(s) de trabajo nuevo(s) (tabla <code>frentes_trabajo</code>):
              </p>
              <div className="max-h-[28rem] overflow-y-auto space-y-2 pr-1">
                {statsFrente.frentesNuevosLista.map((f, i) => (
                  <div key={i} className="bg-white border border-purple-200 rounded-lg overflow-hidden">
                    <div className="bg-purple-100 px-3 py-1.5 text-xs font-mono font-semibold text-purple-800">
                      {f.codigo}
                    </div>
                    <table className="w-full text-xs">
                      <tbody>
                        <FilaPreviewFrente campo="tunel" valor={f.tunel} />
                        <FilaPreviewFrente campo="manto" valor={f.manto} />
                        <FilaPreviewFrente campo="calle" valor={f.calle} />
                        <FilaPreviewFrente campo="hebra" valor={f.hebra} />
                        <FilaPreviewFrente campo="numero_frente" valor={f.numero_frente} />
                        <FilaPreviewFrente campo="codigo_completo" valor={f.codigo} mono />
                        <FilaPreviewFrente
                          campo="tipo (relación id_tipo_frente)"
                          valor={`${f.tipo}${f.tipo_abreviatura ? ` (abrev ${f.tipo_abreviatura})` : ''}${f.tipo_nuevo ? ' — se crea ahora' : ' — ya existe'}`}
                        />
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modo "frente": tabla comparación ───────────────────────────────── */}
      {modo === 'frente' && resultadosFrente && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-5">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-bold text-gray-700">3. Resultados de comparación</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {mostrarCorrectosFrente
                  ? 'Mostrando todas las filas, incluidos los ya correctos.'
                  : 'Solo se muestran las filas con diferencia o sin match.'}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {statsFrente?.yaCorrectos > 0 && (
                <button
                  onClick={() => setMostrarCorrectosFrente(v => !v)}
                  className="text-xs text-green-700 underline hover:text-green-900"
                >
                  {mostrarCorrectosFrente
                    ? 'Ocultar los ya correctos'
                    : `Ver también los ${statsFrente.yaCorrectos} ya correctos`}
                </button>
              )}
              {candidatosFrente.length > 0 && (
                <div className="flex items-center gap-2">
                  <button onClick={toggleTodosFrente} className="text-xs text-blue-600 underline hover:text-blue-800">
                    {seleccionadosFrente.size === candidatosFrente.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCorregirFrente}
                    disabled={loadingCorregirFrente || seleccionadosFrente.size === 0}
                  >
                    {loadingCorregirFrente ? 'Corrigiendo...' : `Corregir ${seleccionadosFrente.size} seleccionados`}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide border-b border-gray-200">
                  <th className="py-2 px-3 text-left w-8"></th>
                  <th className="py-2 px-3 text-right">N° Dumpada</th>
                  <th className="py-2 px-3 text-left font-semibold text-blue-700">Frente actual (BD)</th>
                  <th className="py-2 px-3 text-left font-semibold text-amber-700">Frente correcto (Excel)</th>
                  <th className="py-2 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filasTablaFrente.map((r, i) => {
                    const isSelected = !r.sin_match && seleccionadosFrente.has(r.numero_dumpada);
                    return (
                      <tr
                        key={i}
                        className={`transition-colors ${
                          r.sin_match     ? 'bg-red-50'
                          : r.ya_correcto ? 'bg-green-50'
                          : isSelected    ? 'bg-amber-50'
                          : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="py-2 px-3 text-center">
                          {!r.sin_match && !r.ya_correcto && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSeleccionFrente(r.numero_dumpada)}
                              className="w-3.5 h-3.5 accent-amber-500 cursor-pointer"
                            />
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-gray-700">{r.numero_dumpada}</td>
                        <td className="py-2 px-3">
                          {r.sin_match ? (
                            <span className="text-red-500">No encontrada en BD</span>
                          ) : (
                            <>
                              <span className="font-mono text-blue-700">{r.frente_actual?.codigo ?? '—'}</span>
                              <span className="text-gray-400"> · {r.frente_actual?.tipo ?? '—'}</span>
                            </>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {r.sin_match ? (
                            <span className="text-gray-400">
                              <span className="font-mono">{r.punto_excel}</span> · {r.tipo_excel}
                            </span>
                          ) : (
                            <>
                              <span className="font-mono text-amber-700">{r.frente_correcto.codigo}</span>
                              <span className="text-gray-400"> · {r.frente_correcto.tipo}</span>
                              {!r.ya_correcto && !r.frente_correcto.existe && (
                                <>
                                  <span className="ml-2 text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full">
                                    Frente nuevo
                                  </span>
                                  {!r.frente_correcto.tipo_existe && (
                                    <span className="ml-1 text-[10px] font-bold text-fuchsia-600 bg-fuchsia-50 border border-fuchsia-200 px-1.5 py-0.5 rounded-full">
                                      Tipo nuevo
                                    </span>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {r.sin_match ? (
                            <HiXCircle className="w-4 h-4 text-red-400 mx-auto" title="N° de dumpada no existe en BD, no se puede corregir" />
                          ) : r.ya_correcto ? (
                            <HiCheckCircle className="w-4 h-4 text-green-500 mx-auto" title="Ya correcto, sin acción necesaria" />
                          ) : (
                            <HiExclamationTriangle className="w-4 h-4 text-amber-400 mx-auto" title="Frente/tipo distinto" />
                          )}
                        </td>
                      </tr>
                    );
                  })}

                {filasTablaFrente.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-green-600 font-semibold">
                      <HiCheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                      Todos los frentes ya son correctos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resumen post-corrección (modo frente) */}
      {modo === 'frente' && resumenCorregirFrente && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="font-semibold text-green-800">
            ✅ {resumenCorregirFrente.corregidas} dumpada(s) corregidas ({resumenCorregirFrente.frentes_creados} frente(s) nuevo(s) creado(s)).
          </p>
          {resumenCorregirFrente.errores?.length > 0 && (
            <ul className="mt-2 text-xs text-red-600 list-disc pl-4">
              {resumenCorregirFrente.errores.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* ── Modo "fecha": resumen de comparación ───────────────────────────── */}
      {modo === 'fecha' && statsFecha && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">{statsFecha.total}</p>
            <p className="text-xs text-gray-500 mt-0.5">Filas Excel</p>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{statsFecha.yaCorrectos}</p>
            <p className="text-xs text-green-600 mt-0.5">Ya correctos</p>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{statsFecha.paraCorregir}</p>
            <p className="text-xs text-amber-600 mt-0.5">Para corregir</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{statsFecha.sinMatchBD}</p>
            <p className="text-xs text-red-500 mt-0.5">N° no encontrado en BD</p>
          </div>
        </div>
      )}

      {/* ── Modo "fecha": tabla comparación ─────────────────────────────────── */}
      {modo === 'fecha' && resultadosFecha && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-5">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-bold text-gray-700">3. Resultados de comparación</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {mostrarCorrectosFecha
                  ? 'Mostrando todas las filas, incluidos los ya correctos.'
                  : 'Solo se muestran las filas con diferencia o sin match.'}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {statsFecha?.yaCorrectos > 0 && (
                <button
                  onClick={() => setMostrarCorrectosFecha(v => !v)}
                  className="text-xs text-green-700 underline hover:text-green-900"
                >
                  {mostrarCorrectosFecha
                    ? 'Ocultar los ya correctos'
                    : `Ver también los ${statsFecha.yaCorrectos} ya correctos`}
                </button>
              )}
              {candidatosFecha.length > 0 && (
                <div className="flex items-center gap-2">
                  <button onClick={toggleTodosFecha} className="text-xs text-blue-600 underline hover:text-blue-800">
                    {seleccionadosFecha.size === candidatosFecha.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCorregirFecha}
                    disabled={loadingCorregirFecha || seleccionadosFecha.size === 0}
                  >
                    {loadingCorregirFecha ? 'Corrigiendo...' : `Corregir ${seleccionadosFecha.size} seleccionados`}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide border-b border-gray-200">
                  <th className="py-2 px-3 text-left w-8"></th>
                  <th className="py-2 px-3 text-right">N° Dumpada</th>
                  <th className="py-2 px-3 text-left font-semibold text-blue-700">Fecha actual (BD)</th>
                  <th className="py-2 px-3 text-left font-semibold text-amber-700">Fecha correcta (Excel)</th>
                  <th className="py-2 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filasTablaFecha.map((r, i) => {
                    const isSelected = !r.sin_match && seleccionadosFecha.has(r.numero_dumpada);
                    return (
                      <tr
                        key={i}
                        className={`transition-colors ${
                          r.sin_match     ? 'bg-red-50'
                          : r.ya_correcto ? 'bg-green-50'
                          : isSelected    ? 'bg-amber-50'
                          : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="py-2 px-3 text-center">
                          {!r.sin_match && !r.ya_correcto && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSeleccionFecha(r.numero_dumpada)}
                              className="w-3.5 h-3.5 accent-amber-500 cursor-pointer"
                            />
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-gray-700">{r.numero_dumpada}</td>
                        <td className="py-2 px-3 font-mono text-blue-700">
                          {r.sin_match ? <span className="text-red-500 font-normal">No encontrada en BD</span> : formatFecha(r.fecha_actual)}
                        </td>
                        <td className="py-2 px-3 font-mono text-amber-700">
                          {!r.sin_match && formatFecha(r.fecha_excel)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {r.sin_match ? (
                            <HiXCircle className="w-4 h-4 text-red-400 mx-auto" title="N° de dumpada no existe en BD" />
                          ) : r.ya_correcto ? (
                            <HiCheckCircle className="w-4 h-4 text-green-500 mx-auto" title="Ya correcta, sin acción necesaria" />
                          ) : (
                            <HiExclamationTriangle className="w-4 h-4 text-amber-400 mx-auto" title="Fecha distinta" />
                          )}
                        </td>
                      </tr>
                    );
                  })}

                {filasTablaFecha.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-green-600 font-semibold">
                      <HiCheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                      Todas las fechas ya son correctas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resumen post-corrección (modo fecha) */}
      {modo === 'fecha' && resumenCorregirFecha && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="font-semibold text-green-800">
            ✅ {resumenCorregirFecha.corregidas} dumpada(s) corregidas.
          </p>
          {resumenCorregirFecha.errores?.length > 0 && (
            <ul className="mt-2 text-xs text-red-600 list-disc pl-4">
              {resumenCorregirFecha.errores.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* ── Modo "estructura": resumen ──────────────────────────────────────── */}
      {modo === 'estructura' && statsEstructura && (
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 mb-5">
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{statsEstructura.total}</p>
            <p className="text-xs text-amber-600 mt-0.5">Frentes con estructura desactualizada</p>
          </div>
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">{statsEstructura.dumpadasAfectadas}</p>
            <p className="text-xs text-gray-500 mt-0.5">Dumpadas apuntando a esos frentes</p>
          </div>
        </div>
      )}

      {/* ── Modo "estructura": tabla ─────────────────────────────────────────── */}
      {modo === 'estructura' && resultadosEstructura && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-5">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-bold text-gray-700">3. Frentes a reparar</h2>
              <p className="text-xs text-gray-400 mt-0.5">Ordenados por cantidad de dumpadas asociadas. El código y las dumpadas no cambian, solo estas columnas.</p>
            </div>
            {resultadosEstructura.resultados.length > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={toggleTodosEstructura} className="text-xs text-blue-600 underline hover:text-blue-800">
                  {seleccionadosEstructura.size === resultadosEstructura.resultados.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCorregirEstructura}
                  disabled={loadingCorregirEstructura || seleccionadosEstructura.size === 0}
                >
                  {loadingCorregirEstructura ? 'Reparando...' : `Reparar ${seleccionadosEstructura.size} seleccionados`}
                </Button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide border-b border-gray-200">
                  <th className="py-2 px-3 text-left w-8"></th>
                  <th className="py-2 px-3 text-left">Código</th>
                  <th className="py-2 px-3 text-right">Dumpadas</th>
                  <th className="py-2 px-3 text-left font-semibold text-blue-700">Actual</th>
                  <th className="py-2 px-3 text-left font-semibold text-amber-700">Propuesto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {resultadosEstructura.resultados.map((r) => {
                  const isSelected = seleccionadosEstructura.has(r.frente_id);
                  const fmt = (o) => [o.tunel, o.manto, o.calle, o.hebra, o.numero_frente].filter(Boolean).join(' · ') || '—';
                  return (
                    <tr key={r.frente_id} className={`transition-colors ${isSelected ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSeleccionEstructura(r.frente_id)}
                          className="w-3.5 h-3.5 accent-amber-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-gray-700">{r.codigo}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-600">{r.dumpadas_asociadas}</td>
                      <td className="py-2 px-3 font-mono text-blue-700">{fmt(r.actual)}</td>
                      <td className="py-2 px-3 font-mono text-amber-700">{fmt(r.propuesto)}</td>
                    </tr>
                  );
                })}

                {resultadosEstructura.resultados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-green-600 font-semibold">
                      <HiCheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                      Todos los frentes ya tienen su estructura correcta
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resumen post-reparación (modo estructura) */}
      {modo === 'estructura' && resumenCorregirEstructura && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="font-semibold text-green-800">
            ✅ {resumenCorregirEstructura.corregidos} frente(s) reparados.
          </p>
          {resumenCorregirEstructura.errores?.length > 0 && (
            <ul className="mt-2 text-xs text-red-600 list-disc pl-4">
              {resumenCorregirEstructura.errores.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
