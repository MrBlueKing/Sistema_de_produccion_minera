import { useState, useEffect } from 'react';
import { HiChartBar, HiCalendar, HiFunnel } from 'react-icons/hi2';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import explosivosService from '../services/explosivos';
import useToast from '../../../hooks/useToast';

export default function DashboardPerforacion({ faenaActual }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [fechaDesde, setFechaDesde] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    cargarEstadisticas();
  }, [faenaActual]);

  const cargarEstadisticas = async () => {
    setLoading(true);
    try {
      const res = await explosivosService.getEstadisticasReportes({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      });
      setData(res);
    } catch (error) {
      toast.error('Error', 'No se pudieron cargar las estadisticas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600"></div>
      </div>
    );
  }

  if (!data) return null;

  const totalesEstado = data.totales_por_estado || {};
  const totalReportes = Object.values(totalesEstado).reduce((a, b) => a + b, 0);

  // Agrupar consumo por frente para tabla
  const consumoPorFrente = {};
  (data.consumo_por_frente || []).forEach((item) => {
    if (!consumoPorFrente[item.frente]) {
      consumoPorFrente[item.frente] = {};
    }
    consumoPorFrente[item.frente][item.tipo_explosivo] = {
      total: parseFloat(item.total),
      calculado: parseFloat(item.total_calculado),
    };
  });

  // Obtener tipos unicos
  const tiposUnicos = [...new Set((data.consumo_por_frente || []).map((i) => i.tipo_explosivo))];

  // Max para barras CSS
  const maxConsumo = Math.max(...(data.eficiencia || []).map((e) => parseFloat(e.total_final) || 0), 1);

  return (
    <div className="space-y-6">
      {/* Filtro de fechas */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <HiFunnel className="w-5 h-5 text-gray-500" />
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Desde:</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Hasta:</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <Button variant="primary" size="sm" onClick={cargarEstadisticas}>
            Actualizar
          </Button>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center border-b-4 border-gray-400">
          <p className="text-3xl font-bold text-gray-800">{totalReportes}</p>
          <p className="text-sm text-gray-500">Total Reportes</p>
        </Card>
        <Card className="text-center border-b-4 border-yellow-400">
          <p className="text-3xl font-bold text-yellow-700">{totalesEstado.borrador || 0}</p>
          <p className="text-sm text-gray-500">Borradores</p>
        </Card>
        <Card className="text-center border-b-4 border-blue-400">
          <p className="text-3xl font-bold text-blue-700">{totalesEstado.confirmado || 0}</p>
          <p className="text-sm text-gray-500">Confirmados</p>
        </Card>
        <Card className="text-center border-b-4 border-green-400">
          <p className="text-3xl font-bold text-green-700">{totalesEstado.cerrado || 0}</p>
          <p className="text-sm text-gray-500">Cerrados</p>
        </Card>
      </div>

      {/* Eficiencia: calculada vs final */}
      {(data.eficiencia || []).length > 0 && (
        <Card>
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <HiChartBar className="w-5 h-5" />
            Consumo por Tipo de Explosivo (Calculado vs Real)
          </h4>
          <div className="space-y-3">
            {(data.eficiencia || []).map((item) => {
              const calculado = parseFloat(item.total_calculado) || 0;
              const real = parseFloat(item.total_final) || 0;
              const porcentaje = calculado > 0 ? ((real / calculado) * 100).toFixed(1) : 0;
              const barWidth = Math.min((real / maxConsumo) * 100, 100);

              return (
                <div key={item.tipo_explosivo} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-gray-700 text-right">{item.tipo_explosivo}</div>
                  <div className="flex-1">
                    <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all"
                        style={{ width: `${barWidth}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="w-48 text-xs text-gray-600 text-right">
                    <span className="font-medium">{real.toLocaleString('es-CL', { maximumFractionDigits: 1 })}</span>
                    <span className="text-gray-400"> / {calculado.toLocaleString('es-CL', { maximumFractionDigits: 1 })} calc.</span>
                    <span className={`ml-2 font-bold ${parseFloat(porcentaje) > 100 ? 'text-red-600' : 'text-green-600'}`}>
                      ({porcentaje}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Consumo por frente */}
      {Object.keys(consumoPorFrente).length > 0 && (
        <Card>
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <HiCalendar className="w-5 h-5" />
            Consumo por Frente de Trabajo
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 bg-gradient-to-r from-orange-50 to-yellow-50">
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Frente</th>
                  {tiposUnicos.map((tipo) => (
                    <th key={tipo} className="px-4 py-2 text-center font-semibold text-gray-700">{tipo}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(consumoPorFrente).map(([frente, datos]) => (
                  <tr key={frente} className="border-b hover:bg-orange-50/50">
                    <td className="px-4 py-2 font-mono text-xs">{frente}</td>
                    {tiposUnicos.map((tipo) => (
                      <td key={tipo} className="px-4 py-2 text-center">
                        {datos[tipo] ? (
                          <span className="font-medium">{datos[tipo].total.toLocaleString('es-CL', { maximumFractionDigits: 1 })}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
