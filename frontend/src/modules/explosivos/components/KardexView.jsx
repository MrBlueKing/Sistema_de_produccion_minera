import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { HiTableCells, HiArrowDownTray, HiShieldCheck, HiChevronRight, HiArrowLeft } from 'react-icons/hi2';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import explosivosService from '../services/explosivos';
import useToast from '../../../hooks/useToast';

const formatFecha = (fecha) => {
  if (!fecha) return '-';
  const [year, month, day] = fecha.split('-');
  return `${day}/${month}/${year}`;
};

const formatNumero = (n) => (n ?? 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });

const primerDiaMes = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
};
const hoy = () => new Date().toISOString().split('T')[0];

// Vista de solo lectura: reemplazo digital del libro físico de control de
// explosivos. "Todos" muestra el resumen ingreso/salida/saldo de cada tipo;
// al elegir un tipo, el libro diario de ese explosivo (que exige la DGMN).
export default function KardexView({ polvorin, polvorines = [], esAdmin = false, tipos = [] }) {
  const toast = useToast();

  const [idTipoExplosivo, setIdTipoExplosivo] = useState('todos');
  const [idPolvorin, setIdPolvorin] = useState(polvorin?.id || '');
  const [fechaDesde, setFechaDesde] = useState(primerDiaMes());
  const [fechaHasta, setFechaHasta] = useState(hoy());
  const [data, setData] = useState(null);       // libro diario de un tipo
  const [resumen, setResumen] = useState(null); // matriz de todos los tipos
  const [loading, setLoading] = useState(false);

  const esTodos = idTipoExplosivo === 'todos';

  useEffect(() => {
    if (!idPolvorin && polvorin?.id) setIdPolvorin(polvorin.id);
  }, [polvorin, idPolvorin]);

  const cargar = useCallback(async () => {
    if (!idPolvorin || !fechaDesde || !fechaHasta) {
      setData(null); setResumen(null);
      return;
    }
    setLoading(true);
    try {
      if (esTodos) {
        const r = await explosivosService.getKardexResumen({
          id_polvorin: idPolvorin, fecha_desde: fechaDesde, fecha_hasta: fechaHasta,
        });
        setResumen(r); setData(null);
      } else {
        const r = await explosivosService.getKardex({
          id_tipo_explosivo: idTipoExplosivo, id_polvorin: idPolvorin,
          fecha_desde: fechaDesde, fecha_hasta: fechaHasta,
        });
        setData(r); setResumen(null);
      }
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo cargar el Libro de Explosivos');
      setData(null); setResumen(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idTipoExplosivo, idPolvorin, fechaDesde, fechaHasta, esTodos]);

  useEffect(() => { cargar(); }, [cargar]);

  const tipoSeleccionado = tipos.find(t => String(t.id) === String(idTipoExplosivo));

  const exportarExcel = () => {
    const libro = XLSX.utils.book_new();
    let nombreArchivo;

    if (esTodos && resumen) {
      const filas = resumen.filas.map(f => ({
        Código: f.codigo,
        Explosivo: f.nombre,
        Unidad: f.unidad_medida,
        'Existencia anterior': f.existencia_anterior,
        'Entradas (compras)': f.entradas,
        'Salidas (tronadura)': f.salidas,
        Devoluciones: f.devoluciones,
        Ajustes: f.ajustes,
        'Saldo actual': f.saldo,
      }));
      XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), 'Resumen');
      nombreArchivo = `Libro_Explosivos_Resumen_${fechaDesde}_a_${fechaHasta}.xlsx`;
    } else if (data) {
      const filas = [
        { Fecha: '', Documento: '', 'F/A': data.f_a || '', Entrada: '', Salida: '', Devolución: '', Ajuste: '', Saldo: data.existencia_anterior, Detalle: 'Existencia Anterior' },
        ...data.filas.map(f => ({
          Fecha: formatFecha(f.fecha), Documento: f.documento, 'F/A': data.f_a || '',
          Entrada: f.entrada || '', Salida: f.salida || '', Devolución: f.devolucion || '', Ajuste: f.ajuste || '', Saldo: f.saldo, Detalle: '',
        })),
      ];
      XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), 'Kardex');
      nombreArchivo = `Libro_Explosivos_${tipoSeleccionado?.codigo || 'explosivo'}_${fechaDesde}_a_${fechaHasta}.xlsx`;
    } else {
      return;
    }
    XLSX.writeFile(libro, nombreArchivo);
  };

  const puedeExportar = (esTodos && resumen?.filas?.length > 0) || (!esTodos && data?.filas);

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <HiTableCells className="w-6 h-6 text-red-600" />
            Libro de Explosivos
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {esTodos
              ? 'Ingreso, salida y saldo de cada tipo de explosivo en el período. Elegí un tipo para ver su libro diario.'
              : 'Libro diario del tipo seleccionado: por cada día, cuánto había antes, cuánto entró, cuánto salió y cuánto queda.'}
          </p>
        </div>
        <Button variant="outline" icon={HiArrowDownTray} onClick={exportarExcel} disabled={!puedeExportar}>
          Exportar a Excel
        </Button>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Explosivo</label>
          <select
            value={idTipoExplosivo}
            onChange={(e) => setIdTipoExplosivo(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 bg-white"
          >
            <option value="todos">Todos los tipos</option>
            {tipos.map(t => (
              <option key={t.id} value={t.id}>{t.nombre} ({t.codigo})</option>
            ))}
          </select>
        </div>
        {esAdmin && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Polvorín *</label>
            <select
              value={idPolvorin}
              onChange={(e) => setIdPolvorin(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 bg-white"
            >
              <option value="">Seleccione...</option>
              {polvorines.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
        </div>
      </div>

      {!idPolvorin ? (
        <div className="text-center py-12">
          <HiTableCells className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Seleccione un polvorín para ver el libro</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-red-200 border-t-red-600"></div>
        </div>
      ) : esTodos && resumen ? (
        <>
          <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg text-sm">
            <span className="flex items-center gap-1.5 text-gray-600">
              <HiShieldCheck className="w-4 h-4" />
              Autoridad Fiscalizadora: <span className="font-semibold text-gray-800">
                {resumen.autoridad_fiscalizadora ? `${resumen.autoridad_fiscalizadora} (F/A ${resumen.f_a})` : 'Sin asignar en el polvorín'}
              </span>
            </span>
          </div>

          {resumen.filas.length === 0 ? (
            <div className="text-center py-8"><p className="text-gray-500">Sin datos para el período</p></div>
          ) : (() => {
            const hayAjustes = (resumen.total_ajustes || 0) !== 0;
            return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold">Tipo de explosivo</th>
                    <th className="px-4 py-3 text-right font-semibold">Existencia<br />anterior</th>
                    <th className="px-4 py-3 text-right font-semibold">Entradas<br /><span className="font-normal text-xs text-gray-400">compras</span></th>
                    <th className="px-4 py-3 text-right font-semibold">Salidas<br /><span className="font-normal text-xs text-gray-400">a tronadura</span></th>
                    <th className="px-4 py-3 text-right font-semibold">Devoluciones<br /><span className="font-normal text-xs text-gray-400">volvió sin usar</span></th>
                    {hayAjustes && <th className="px-4 py-3 text-right font-semibold">Ajustes</th>}
                    <th className="px-4 py-3 text-right font-semibold">Saldo actual</th>
                    <th className="px-4 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.filas.map((f) => (
                    <tr
                      key={f.id_tipo_explosivo}
                      onClick={() => setIdTipoExplosivo(String(f.id_tipo_explosivo))}
                      className="border-b hover:bg-red-50/40 cursor-pointer"
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{f.codigo}</span>
                        <span className="ml-2 text-gray-800">{f.nombre}</span>
                        <span className="ml-1 text-xs text-gray-400">{f.unidad_medida}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{formatNumero(f.existencia_anterior)}</td>
                      <td className="px-4 py-2.5 text-right text-green-700 font-medium">{f.entradas ? `+ ${formatNumero(f.entradas)}` : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-red-700 font-medium">{f.salidas ? `− ${formatNumero(f.salidas)}` : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-blue-700 font-medium">{f.devoluciones ? `+ ${formatNumero(f.devoluciones)}` : '—'}</td>
                      {hayAjustes && (
                        <td className="px-4 py-2.5 text-right text-amber-700 font-medium">
                          {f.ajustes ? `${f.ajustes > 0 ? '+' : '−'} ${formatNumero(Math.abs(f.ajustes))}` : '—'}
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-right font-bold text-gray-800">{formatNumero(f.saldo)}</td>
                      <td className="px-4 py-2.5 text-right"><HiChevronRight className="w-4 h-4 text-gray-300 inline" /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-gray-50 font-semibold">
                    <td className="px-4 py-3">Total período</td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right text-green-700">+ {formatNumero(resumen.total_entradas)}</td>
                    <td className="px-4 py-3 text-right text-red-700">− {formatNumero(resumen.total_salidas)}</td>
                    <td className="px-4 py-3 text-right text-blue-700">+ {formatNumero(resumen.total_devoluciones)}</td>
                    {hayAjustes && <td className="px-4 py-3 text-right text-amber-700">{resumen.total_ajustes > 0 ? '+' : '−'} {formatNumero(Math.abs(resumen.total_ajustes))}</td>}
                    <td className="px-4 py-3"></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            );
          })()}
        </>
      ) : !esTodos && data ? (
        <>
          <button
            onClick={() => setIdTipoExplosivo('todos')}
            className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 mb-3"
          >
            <HiArrowLeft className="w-4 h-4" /> Volver a todos los tipos
          </button>

          <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg text-sm">
            <span className="font-mono text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{tipoSeleccionado?.codigo}</span>
            <span className="font-semibold text-gray-800">{tipoSeleccionado?.nombre}</span>
            <span className="flex items-center gap-1.5 text-gray-600">
              <HiShieldCheck className="w-4 h-4" />
              F/A: <span className="font-semibold text-gray-800">
                {data.autoridad_fiscalizadora ? `${data.autoridad_fiscalizadora} (${data.f_a})` : 'Sin asignar'}
              </span>
            </span>
            <span className="text-gray-600">Existencia anterior: <span className="font-semibold text-gray-800">{formatNumero(data.existencia_anterior)}</span></span>
            <span className="text-gray-600">Saldo final: <span className="font-semibold text-gray-800">{formatNumero(data.saldo_final)}</span></span>
          </div>

          {data.filas.length === 0 ? (
            <div className="text-center py-8"><p className="text-gray-500">Sin movimientos en el período seleccionado</p></div>
          ) : (() => {
            const hayAjustes = data.filas.some((f) => (f.ajuste || 0) !== 0);
            const nCols = hayAjustes ? 7 : 6;
            return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                    <th className="px-4 py-3 text-left font-semibold">Documento</th>
                    <th className="px-4 py-3 text-center font-semibold">F/A</th>
                    <th className="px-4 py-3 text-right font-semibold">Entrada</th>
                    <th className="px-4 py-3 text-right font-semibold">Salida</th>
                    <th className="px-4 py-3 text-right font-semibold">Devolución</th>
                    {hayAjustes && <th className="px-4 py-3 text-right font-semibold">Ajuste</th>}
                    <th className="px-4 py-3 text-right font-semibold">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b bg-blue-50/50 italic text-gray-600">
                    <td className="px-4 py-2" colSpan={nCols - 1}>Existencia Anterior</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatNumero(data.existencia_anterior)}</td>
                  </tr>
                  {data.filas.map((fila, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{formatFecha(fila.fecha)}</td>
                      <td className="px-4 py-2 text-gray-600">{fila.documento || '-'}</td>
                      <td className="px-4 py-2 text-center text-gray-600">{data.f_a || '-'}</td>
                      <td className="px-4 py-2 text-right text-green-700">{fila.entrada ? formatNumero(fila.entrada) : ''}</td>
                      <td className="px-4 py-2 text-right text-red-700">{fila.salida ? formatNumero(fila.salida) : ''}</td>
                      <td className="px-4 py-2 text-right text-blue-700">{fila.devolucion ? formatNumero(fila.devolucion) : ''}</td>
                      {hayAjustes && (
                        <td className="px-4 py-2 text-right text-amber-700">
                          {fila.ajuste ? `${fila.ajuste > 0 ? '+' : '−'}${formatNumero(Math.abs(fila.ajuste))}` : ''}
                        </td>
                      )}
                      <td className="px-4 py-2 text-right font-semibold">{formatNumero(fila.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            );
          })()}
        </>
      ) : null}
    </Card>
  );
}
