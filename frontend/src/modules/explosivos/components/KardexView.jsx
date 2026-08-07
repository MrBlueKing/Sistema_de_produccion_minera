import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { HiTableCells, HiArrowDownTray, HiShieldCheck } from 'react-icons/hi2';
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

// Vista de solo lectura: reemplazo digital del libro físico de control de
// explosivos y del Excel que se llevaba en paralelo. No registra datos nuevos,
// solo lee y muestra lo que ya se cargó por otras pantallas (Registrar Guía de
// Despacho para entradas, Confirmar Reporte de Perforación para salidas).
export default function KardexView({ polvorin, polvorines = [], esAdmin = false, tipos = [] }) {
  const toast = useToast();

  const primerDiaMes = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  };
  const hoy = () => new Date().toISOString().split('T')[0];

  const [idTipoExplosivo, setIdTipoExplosivo] = useState('');
  const [idPolvorin, setIdPolvorin] = useState(polvorin?.id || '');
  const [fechaDesde, setFechaDesde] = useState(primerDiaMes());
  const [fechaHasta, setFechaHasta] = useState(hoy());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!idPolvorin && polvorin?.id) setIdPolvorin(polvorin.id);
  }, [polvorin]);

  const cargarKardex = useCallback(async () => {
    if (!idTipoExplosivo || !idPolvorin || !fechaDesde || !fechaHasta) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const resultado = await explosivosService.getKardex({
        id_tipo_explosivo: idTipoExplosivo,
        id_polvorin: idPolvorin,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      });
      setData(resultado);
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo cargar el Kardex');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [idTipoExplosivo, idPolvorin, fechaDesde, fechaHasta]);

  useEffect(() => {
    cargarKardex();
  }, [cargarKardex]);

  const tipoSeleccionado = tipos.find(t => String(t.id) === String(idTipoExplosivo));

  const exportarExcel = () => {
    if (!data) return;

    const filas = [
      {
        Fecha: '',
        Documento: '',
        'F/A': data.f_a || '',
        Entrada: '',
        Salida: '',
        Saldo: data.existencia_anterior,
        Detalle: 'Existencia Anterior',
      },
      ...data.filas.map(f => ({
        Fecha: formatFecha(f.fecha),
        Documento: f.documento,
        'F/A': data.f_a || '',
        Entrada: f.entrada || '',
        Salida: f.salida || '',
        Saldo: f.saldo,
        Detalle: '',
      })),
    ];

    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Kardex');

    const nombreArchivo = `Libro_Explosivos_${tipoSeleccionado?.codigo || 'explosivo'}_${fechaDesde}_a_${fechaHasta}.xlsx`;
    XLSX.writeFile(libro, nombreArchivo);
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <HiTableCells className="w-6 h-6 text-red-600" />
            Libro de Explosivos
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Versión digital del libro de control: por cada día, cuánto había antes, cuánto entró, cuánto salió y cuánto queda — para un tipo de explosivo a la vez, igual que las hojas del libro físico.
          </p>
        </div>
        <Button variant="outline" icon={HiArrowDownTray} onClick={exportarExcel} disabled={!data || data.filas.length === 0}>
          Exportar a Excel
        </Button>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Explosivo *</label>
          <select
            value={idTipoExplosivo}
            onChange={(e) => setIdTipoExplosivo(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 bg-white"
          >
            <option value="">Seleccione...</option>
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
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      {!idTipoExplosivo || !idPolvorin ? (
        <div className="text-center py-12">
          <HiTableCells className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Seleccione un tipo de explosivo{esAdmin ? ' y un polvorín' : ''} para ver el libro</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-red-200 border-t-red-600"></div>
        </div>
      ) : data ? (
        <>
          {/* Resumen */}
          <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg text-sm">
            <span className="flex items-center gap-1.5 text-gray-600">
              <HiShieldCheck className="w-4 h-4" />
              Autoridad Fiscalizadora: <span className="font-semibold text-gray-800">
                {data.autoridad_fiscalizadora ? `${data.autoridad_fiscalizadora} (F/A ${data.f_a})` : 'Sin asignar en el polvorín'}
              </span>
            </span>
            <span className="text-gray-600">
              Existencia anterior: <span className="font-semibold text-gray-800">{formatNumero(data.existencia_anterior)}</span>
            </span>
            <span className="text-gray-600">
              Saldo final: <span className="font-semibold text-gray-800">{formatNumero(data.saldo_final)}</span>
            </span>
          </div>

          {data.filas.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Sin movimientos en el período seleccionado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                    <th className="px-4 py-3 text-left font-semibold">Documento</th>
                    <th className="px-4 py-3 text-center font-semibold">F/A</th>
                    <th className="px-4 py-3 text-right font-semibold">Entrada</th>
                    <th className="px-4 py-3 text-right font-semibold">Salida</th>
                    <th className="px-4 py-3 text-right font-semibold">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b bg-blue-50/50 italic text-gray-600">
                    <td className="px-4 py-2" colSpan={5}>Existencia Anterior</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatNumero(data.existencia_anterior)}</td>
                  </tr>
                  {data.filas.map((fila, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{formatFecha(fila.fecha)}</td>
                      <td className="px-4 py-2 text-gray-600">{fila.documento || '-'}</td>
                      <td className="px-4 py-2 text-center text-gray-600">{data.f_a || '-'}</td>
                      <td className="px-4 py-2 text-right text-green-700">{fila.entrada ? formatNumero(fila.entrada) : ''}</td>
                      <td className="px-4 py-2 text-right text-red-700">{fila.salida ? formatNumero(fila.salida) : ''}</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatNumero(fila.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </Card>
  );
}
