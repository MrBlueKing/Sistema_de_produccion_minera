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

  const tirosPorDia = data.tiros_por_dia || [];
  const totalTiros = tirosPorDia.reduce((sum, item) => sum + (parseInt(item.total_tiros) || 0), 0);

  // Escala del eje Y: techo "redondo" (siguiente múltiplo de 10/50/100 según la magnitud) y 4 marcas
  const maxTirosDato = Math.max(...tirosPorDia.map((item) => parseInt(item.total_tiros) || 0), 1);
  const magnitud = Math.pow(10, Math.floor(Math.log10(maxTirosDato)) );
  const paso = Math.ceil(maxTirosDato / 4 / magnitud) * magnitud || 1;
  const ejeYMax = paso * 4;
  const marcasEjeY = [0, 1, 2, 3, 4].map((i) => i * paso);

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="text-center border-b-4 border-gray-400">
          <p className="text-3xl font-bold text-gray-800">{totalReportes}</p>
          <p className="text-sm text-gray-500">Total Reportes</p>
        </Card>
        <Card className="text-center border-b-4 border-orange-400">
          <p className="text-3xl font-bold text-orange-700">{totalTiros.toLocaleString('es-CL')}</p>
          <p className="text-sm text-gray-500">Total Tiros</p>
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

      {/* Tiros por dia */}
      {tirosPorDia.length === 0 ? (
        <Card>
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <HiChartBar className="w-5 h-5" />
            Tiros por Día
          </h4>
          <p className="text-sm text-gray-400 py-6 text-center">No hay tiros registrados en este período.</p>
        </Card>
      ) : (() => {
        const MARGIN_LEFT = 46;
        const MARGIN_RIGHT = 10;
        const MARGIN_TOP = 24;
        const MARGIN_BOTTOM = 46;
        const PLOT_HEIGHT = 160;
        const BAR_WIDTH = 26;
        const SLOT_WIDTH = 36;
        const plotWidth = tirosPorDia.length * SLOT_WIDTH;
        const totalWidth = MARGIN_LEFT + MARGIN_RIGHT + plotWidth;
        const totalHeight = MARGIN_TOP + PLOT_HEIGHT + MARGIN_BOTTOM;
        const yFor = (valor) => MARGIN_TOP + PLOT_HEIGHT - (valor / ejeYMax) * PLOT_HEIGHT;

        return (
          <Card>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <HiChartBar className="w-5 h-5" />
              Tiros por Día
            </h4>
            <div className="overflow-x-auto pb-1">
              <svg width={totalWidth} height={totalHeight} role="img" aria-label="Tiros por día">
                {/* Grilla y eje Y */}
                {marcasEjeY.map((valor) => (
                  <g key={valor}>
                    <line
                      x1={MARGIN_LEFT}
                      x2={totalWidth - MARGIN_RIGHT}
                      y1={yFor(valor)}
                      y2={yFor(valor)}
                      className={valor === 0 ? 'stroke-gray-300' : 'stroke-gray-100'}
                      strokeWidth={1}
                    />
                    <text
                      x={MARGIN_LEFT - 8}
                      y={yFor(valor)}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="fill-gray-400 text-[9px]"
                    >
                      {valor.toLocaleString('es-CL')}
                    </text>
                  </g>
                ))}

                {/* Titulo eje Y */}
                <text
                  x={14}
                  y={MARGIN_TOP + PLOT_HEIGHT / 2}
                  textAnchor="middle"
                  className="fill-gray-500 text-[10px] font-semibold uppercase tracking-wide"
                  transform={`rotate(-90, 14, ${MARGIN_TOP + PLOT_HEIGHT / 2})`}
                >
                  N° de Tiros
                </text>

                {/* Barras + valor + fecha */}
                {tirosPorDia.map((item, index) => {
                  const total = parseInt(item.total_tiros) || 0;
                  const x = MARGIN_LEFT + index * SLOT_WIDTH + (SLOT_WIDTH - BAR_WIDTH) / 2;
                  const yBar = yFor(total);
                  const baseline = yFor(0);
                  const fecha = new Date(`${item.fecha}T00:00:00`);
                  const fechaCorta = fecha.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
                  const fechaCompleta = fecha.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });

                  return (
                    <g key={item.fecha}>
                      <title>{`${fechaCompleta}: ${total.toLocaleString('es-CL')} tiros`}</title>
                      <text
                        x={x + BAR_WIDTH / 2}
                        y={yBar - 6}
                        textAnchor="middle"
                        className="fill-gray-600 text-[9px] font-semibold"
                      >
                        {total}
                      </text>
                      <rect
                        x={x}
                        y={yBar}
                        width={BAR_WIDTH}
                        height={Math.max(baseline - yBar, total > 0 ? 2 : 0)}
                        rx={3}
                        className="fill-orange-500 hover:fill-orange-600 transition-colors"
                      />
                      <text
                        x={x + BAR_WIDTH / 2}
                        y={baseline + 14}
                        textAnchor="middle"
                        className="fill-gray-400 text-[9px]"
                      >
                        {fechaCorta}
                      </text>
                    </g>
                  );
                })}

                {/* Titulo eje X */}
                <text
                  x={MARGIN_LEFT + plotWidth / 2}
                  y={totalHeight - 4}
                  textAnchor="middle"
                  className="fill-gray-500 text-[10px] font-semibold uppercase tracking-wide"
                >
                  Fecha
                </text>
              </svg>
            </div>
          </Card>
        );
      })()}

      {/* Eficiencia: calculada vs final */}
      <Card>
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <HiChartBar className="w-5 h-5" />
          Consumo por Tipo de Explosivo (Calculado vs Real)
        </h4>
        {(data.eficiencia || []).length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            Ninguna línea de este período tiene cantidad de explosivo registrada todavía.
          </p>
        ) : (
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
        )}
      </Card>

      {/* Consumo por frente */}
      <Card>
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <HiCalendar className="w-5 h-5" />
          Consumo por Frente de Trabajo
        </h4>
        {Object.keys(consumoPorFrente).length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            Ninguna línea de este período tiene cantidad de explosivo registrada todavía.
          </p>
        ) : (
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
        )}
      </Card>
    </div>
  );
}
