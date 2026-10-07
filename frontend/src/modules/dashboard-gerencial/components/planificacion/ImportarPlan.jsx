import { useRef, useState } from 'react';
import { HiArrowDownTray, HiArrowUpTray } from 'react-icons/hi2';
import { descargarPlantilla, leerPlantilla } from '../../utils/planExcel';
import { MESES } from '../../utils/planCalculos';

// Importar el plan desde la plantilla estandarizada. Nada se guarda al subir:
// se revisa, se carga en la grilla, y se guarda con "Guardar borrador".

export default function ImportarPlan({ faena, anio, mes, turnos, abreviaturas, estado, frentesDisponibles, referencia, editable, onCargar }) {
  const [resultado, setResultado] = useState(null); // { archivo, problemas, frentes, dias, supuestos }
  const [leyendo, setLeyendo] = useState(false);
  const [generando, setGenerando] = useState(false);
  const inputRef = useRef(null);

  const descargar = async () => {
    setGenerando(true);
    try {
      await descargarPlantilla({
    faena, anio, mes, turnos, abreviaturas, referencia,
    dias: estado.dias,
    frentes: estado.frentes.map((f) => ({
      frente: f.frente,
      actividad: f.actividad,
      ley_esperada: f.ley_esperada,
      celdas: Object.entries(f.celdas).map(([k, v]) => {
        const [dia, turno] = k.split('|');
        return { dia: +dia, turno, toneladas: v };
      }),
    })),
    frentesDisponibles,
    tonPorDisparo: estado.ton_por_disparo,
    tronadurasPorPerforista: estado.tronaduras_por_perforista,
      });
    } finally {
      setGenerando(false);
    }
  };

  const leer = async (file) => {
    if (!file) return;
    setLeyendo(true);
    try {
      const r = await leerPlantilla(file, { anio, mes, turnos, abreviaturas, nDias: estado.dias.length, frentesDisponibles });
      setResultado({ archivo: file.name, ...r });
    } catch (e) {
      setResultado({ archivo: file.name, problemas: [{ nivel: 'bloquea', msg: `No se pudo leer el archivo: ${e.message}` }] });
    } finally {
      setLeyendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const bloqueos = resultado?.problemas.filter((p) => p.nivel === 'bloquea') ?? [];
  const avisos = resultado?.problemas.filter((p) => p.nivel === 'aviso') ?? [];
  const totalTon = resultado?.frentes?.reduce((s, f) => s + f.celdas.reduce((x, c) => x + (c.toneladas || 0), 0), 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <div className="text-xs font-semibold text-emerald-700">PASO 1</div>
          <div className="font-semibold text-gray-800">Descargar plantilla</div>
          <p className="text-sm text-gray-500">Excel del mes con días y turnos ya puestos, listas desplegables de frentes y actividades, totales automáticos y lo que ya esté cargado en pantalla.</p>
          <button type="button" disabled={generando} onClick={descargar} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50">
            <HiArrowDownTray className="w-4 h-4" /> {generando ? 'Generando…' : `Plantilla ${MESES[mes - 1]} · ${faena}`}
          </button>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <div className="text-xs font-semibold text-emerald-700">PASO 2</div>
          <div className="font-semibold text-gray-800">Llenar en Excel</div>
          <p className="text-sm text-gray-500">Una fila por frente y actividad, toneladas en cada turno (Fortificación: una X). Tipo de día y perforistas en la hoja <b>Dias</b>. No mover ni renombrar columnas.</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <div className="text-xs font-semibold text-emerald-700">PASO 3</div>
          <div className="font-semibold text-gray-800">Subir y revisar</div>
          <p className="text-sm text-gray-500">Se muestra qué se leyó y qué no calza. Nada se guarda hasta que lo cargues y guardes el borrador.</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" id="plan-archivo" onChange={(e) => leer(e.target.files?.[0])} />
          <label
            htmlFor="plan-archivo"
            className={`flex items-center gap-2 w-fit text-sm px-3 py-1.5 rounded-md ${editable ? 'bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer' : 'bg-gray-200 text-gray-500 pointer-events-none'}`}
          >
            <HiArrowUpTray className="w-4 h-4" /> {leyendo ? 'Leyendo…' : 'Subir Excel'}
          </label>
          {!editable && <p className="text-xs text-gray-500">El plan está publicado: para importar hay que reabrirlo.</p>}
        </div>
      </div>

      {resultado && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-gray-800">Revisión de {resultado.archivo}</div>
              {resultado.frentes && (
                <div className="text-sm text-gray-500">{resultado.frentes.length} frentes · {totalTon.toLocaleString('es-CL', { maximumFractionDigits: 0 })} t</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${bloqueos.length ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {bloqueos.length ? `${bloqueos.length} bloquean` : 'Sin errores'}
              </span>
              {avisos.length > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{avisos.length} avisos</span>}
              <button
                type="button"
                disabled={bloqueos.length > 0 || !resultado.frentes?.length}
                onClick={() => { onCargar(resultado); setResultado(null); }}
                className="text-sm px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Cargar en la grilla
              </button>
            </div>
          </div>
          {resultado.problemas.length > 0 && (
            <ul className="space-y-1.5 max-h-80 overflow-auto">
              {[...bloqueos, ...avisos].map((p, i) => (
                <li key={i} className="flex gap-2 text-sm bg-gray-50 rounded-md px-3 py-1.5">
                  <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full h-fit ${p.nivel === 'bloquea' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                    {p.nivel === 'bloquea' ? 'Bloquea' : 'Aviso'}
                  </span>
                  <span>{p.msg}</span>
                </li>
              ))}
            </ul>
          )}
          {bloqueos.length > 0 && <p className="text-xs text-gray-500">Corrige el Excel y vuelve a subirlo. Lo que está en pantalla no se tocó.</p>}
        </div>
      )}
    </div>
  );
}
