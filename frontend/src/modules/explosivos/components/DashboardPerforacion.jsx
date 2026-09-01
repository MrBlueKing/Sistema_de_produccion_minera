import { useState, useEffect, useMemo } from 'react';
import { HiChartBar, HiCalendar, HiCube } from 'react-icons/hi2';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import explosivosService from '../services/explosivos';
import useToast from '../../../hooks/useToast';

// Paleta de datos validada (daltonismo) — turnos
const COLOR_TURNO = {
  AM: '#2a78d6',
  PM: '#eb6834',
  Noche: '#1baf7a',
  Madrugada: '#eda100',
};
const TURNOS = ['AM', 'PM', 'Noche', 'Madrugada'];

const fmt = (n, dec = 0) =>
  (parseFloat(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: dec });

const hoyISO = () => new Date().toISOString().split('T')[0];
const isoMenosDias = (d) => new Date(Date.now() - d * 864e5).toISOString().split('T')[0];

function rangoPreset(preset) {
  const hoy = new Date();
  const f = (d) => d.toISOString().slice(0, 10);
  switch (preset) {
    case '30': return { desde: isoMenosDias(30), hasta: hoyISO() };
    case '90': return { desde: isoMenosDias(90), hasta: hoyISO() };
    case 'anio': return { desde: `${hoy.getFullYear()}-01-01`, hasta: hoyISO() };
    case 'mes_pasado': {
      const y = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
      const m = hoy.getMonth() === 0 ? 11 : hoy.getMonth() - 1;
      return { desde: f(new Date(y, m, 1)), hasta: f(new Date(y, m + 1, 0)) };
    }
    default: return null;
  }
}

const PRESETS = [
  { id: '30', label: 'Últimos 30 días' },
  { id: '90', label: 'Últimos 90 días' },
  { id: 'anio', label: 'Este año' },
  { id: 'mes_pasado', label: 'Mes pasado' },
];

export default function DashboardPerforacion({ faenaActual }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [preset, setPreset] = useState('90');
  const [fechaDesde, setFechaDesde] = useState(isoMenosDias(90));
  const [fechaHasta, setFechaHasta] = useState(hoyISO());

  const cargar = async (desde = fechaDesde, hasta = fechaHasta) => {
    setLoading(true);
    try {
      const params = { fecha_desde: desde, fecha_hasta: hasta };
      if (faenaActual?.id) params.faena_id = faenaActual.id;
      const res = await explosivosService.getEstadisticasReportes(params);
      setData(res);
    } catch {
      toast.error('Error', 'No se pudieron cargar las estadísticas');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [faenaActual]);

  const aplicarPreset = (id) => {
    const r = rangoPreset(id);
    if (!r) return;
    setPreset(id);
    setFechaDesde(r.desde);
    setFechaHasta(r.hasta);
    cargar(r.desde, r.hasta);
  };

  const irAPeriodoConDatos = () => {
    const rd = data?.rango_datos;
    if (!rd?.primera) return;
    setPreset('');
    setFechaDesde(rd.primera);
    setFechaHasta(rd.ultima);
    cargar(rd.primera, rd.ultima);
  };

  // ---- derivados ----
  const totalesHist = data?.totales_por_estado || {};
  const totalesPeriodo = data?.totales_por_estado_periodo || {};
  const totalHistoricoReportes = Object.values(totalesHist).reduce((a, b) => a + b, 0);
  const totalPeriodoReportes = Object.values(totalesPeriodo).reduce((a, b) => a + b, 0);

  const eficiencia = data?.eficiencia || [];
  const sumReal = eficiencia.reduce((s, e) => s + (parseFloat(e.total_final) || 0), 0);

  const tirosPorDiaTurno = useMemo(() => data?.tiros_por_dia_turno || [], [data]);
  const totalTiros = tirosPorDiaTurno.reduce((s, t) => s + (parseInt(t.total_tiros) || 0), 0);
  const nReportesConLineas = new Set((data?.tiros_por_dia || []).map((t) => t.fecha)).size;

  const consumoSemanal = data?.consumo_semanal || [];

  // tiros por día -> pivot por turno
  const tirosPivot = useMemo(() => {
    const byFecha = {};
    tirosPorDiaTurno.forEach((row) => {
      byFecha[row.fecha] = byFecha[row.fecha] || { fecha: row.fecha };
      byFecha[row.fecha][row.turno] = parseInt(row.total_tiros) || 0;
    });
    return Object.values(byFecha).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [tirosPorDiaTurno]);

  // consumo por frente -> pivot
  const frentePivot = useMemo(() => {
    const map = {};
    const tipos = new Set();
    (data?.consumo_por_frente || []).forEach((i) => {
      map[i.frente] = map[i.frente] || {};
      map[i.frente][i.tipo_explosivo] = parseFloat(i.total) || 0;
      tipos.add(i.tipo_explosivo);
    });
    return { map, tipos: [...tipos] };
  }, [data]);

  const cobertura = data?.cobertura_stock || [];

  const periodoVacio =
    !loading && data && totalTiros === 0 && eficiencia.length === 0 && consumoSemanal.length === 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600"></div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => aplicarPreset(p.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                preset === p.id
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400'
              }`}
            >
              {p.label}
            </button>
          ))}
          <span className="text-xs text-gray-400 mx-1">o rango:</span>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => { setPreset(''); setFechaDesde(e.target.value); }}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
          />
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => { setPreset(''); setFechaHasta(e.target.value); }}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
          />
          <Button variant="primary" size="sm" onClick={() => cargar()}>Actualizar</Button>
          <span className="text-xs text-gray-500 font-mono ml-auto">
            {fmt2Fecha(fechaDesde)} – {fmt2Fecha(fechaHasta)}
            {faenaActual?.nombre ? ` · ${faenaActual.nombre}` : faenaActual?.ubicacion ? ` · ${faenaActual.ubicacion}` : ''}
          </span>
        </div>
      </Card>

      {periodoVacio ? (
        <Card>
          <div className="text-center py-10 px-4 border border-dashed border-gray-300 rounded-lg bg-gray-50/60">
            <HiChartBar className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-700 font-medium">
              No hay reportes {faenaActual?.nombre ? `de ${faenaActual.nombre} ` : ''}
              entre el {fmt2Fecha(fechaDesde)} y el {fmt2Fecha(fechaHasta)}.
            </p>
            {data.rango_datos?.primera ? (
              <>
                <p className="text-sm text-gray-500 mt-1">
                  El período con datos va del {fmt2Fecha(data.rango_datos.primera)} al {fmt2Fecha(data.rango_datos.ultima)}.
                </p>
                <button
                  onClick={irAPeriodoConDatos}
                  className="mt-4 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700"
                >
                  Ver ese período
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-500 mt-1">Esta faena todavía no tiene reportes registrados.</p>
            )}
          </div>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="col-span-2 border-l-4 border-orange-500 bg-orange-50/50">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Tiros perforados</p>
              <p className="text-3xl font-bold text-orange-700 mt-1">{fmt(totalTiros)}</p>
              <p className="text-xs text-gray-500 mt-1 font-mono">
                {nReportesConLineas > 0 ? `${fmt(totalTiros / nReportesConLineas, 0)} por día · ${nReportesConLineas} días con reporte` : 'sin líneas en el período'}
              </p>
            </Card>
            <Card className="border-b-4 border-gray-400">
              <p className="text-2xl font-bold text-gray-800">{totalPeriodoReportes}</p>
              <p className="text-sm text-gray-500">Reportes</p>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                de {totalHistoricoReportes} en total · {totalesPeriodo.borrador || 0} borradores
              </p>
            </Card>
            <Card className="border-b-4 border-blue-400">
              <p className="text-2xl font-bold text-blue-700">{fmt(sumReal)}</p>
              <p className="text-sm text-gray-500">Consumo de explosivo</p>
              <p className="text-xs text-gray-400 font-mono mt-0.5">suma de todos los tipos</p>
            </Card>
          </div>

          {/* Consumo por semana */}
          <Card>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
              <HiChartBar className="w-5 h-5" /> Consumo de explosivo por semana
            </h4>
            <p className="text-xs text-gray-400 mb-3">Lo que se movió del polvorín, sumado por semana (todos los tipos).</p>
            {consumoSemanal.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">Sin líneas con explosivo en el período.</p>
            ) : (
              <GraficoConsumoSemanal datos={consumoSemanal} />
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tiros por día por turno */}
            <Card>
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <HiChartBar className="w-5 h-5" /> Tiros por día — por turno
              </h4>
              <p className="text-xs text-gray-400 mb-3">Productividad de perforación y en qué turno se concentra.</p>
              {tirosPivot.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">No hay tiros registrados en este período.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-2">
                    {TURNOS.map((t) => (
                      <span key={t}>
                        <i className="inline-block w-3 h-3 rounded-sm align-middle mr-1" style={{ background: COLOR_TURNO[t] }} />{t}
                      </span>
                    ))}
                  </div>
                  <GraficoTirosTurno datos={tirosPivot} />
                </>
              )}
            </Card>

            {/* Consumo por tipo */}
            <Card>
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <HiChartBar className="w-5 h-5" /> Consumo por tipo de explosivo
              </h4>
              <p className="text-xs text-gray-400 mb-3">Real del período, con el % contra lo calculado.</p>
              {eficiencia.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">
                  Ninguna línea del período tiene cantidad de explosivo registrada.
                </p>
              ) : (
                <div className="space-y-2.5 mt-1">
                  {(() => {
                    const maxReal = Math.max(...eficiencia.map((e) => parseFloat(e.total_final) || 0), 1);
                    return eficiencia.map((e) => {
                      const real = parseFloat(e.total_final) || 0;
                      const calc = parseFloat(e.total_calculado) || 0;
                      const pct = calc > 0 ? (real / calc) * 100 : null;
                      return (
                        <div key={e.tipo_explosivo} className="grid grid-cols-[6rem_1fr_auto] gap-2 items-center text-sm">
                          <span className="text-right font-mono text-xs text-gray-600">{e.tipo_explosivo}</span>
                          <span className="h-4 bg-gray-100 rounded overflow-hidden">
                            <span className="block h-full bg-orange-500 rounded" style={{ width: `${(real / maxReal) * 100}%` }} />
                          </span>
                          <span className="text-xs text-gray-600 font-mono whitespace-nowrap">
                            {fmt(real, 1)}
                            {pct !== null && (
                              <span className={`ml-1.5 font-bold ${pct > 105 ? 'text-red-600' : pct < 95 ? 'text-blue-600' : 'text-green-600'}`}>
                                {fmt(pct, 0)}%
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cobertura de stock */}
            <Card>
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <HiCube className="w-5 h-5" /> Cobertura de stock del polvorín
              </h4>
              <p className="text-xs text-gray-400 mb-3">Días que dura el stock actual al ritmo de consumo del período.</p>
              {cobertura.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">
                  {faenaActual?.id ? 'El polvorín de esta faena no tiene stock cargado.' : 'Elegí una faena para ver la cobertura.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {cobertura.map((c) => {
                    const dias = c.dias_cobertura;
                    const color = dias == null ? '#9ca3af' : dias < 7 ? '#b91c1c' : dias < 15 ? '#b45309' : '#15803d';
                    const width = dias == null ? 100 : Math.min((dias / 40) * 100, 100);
                    return (
                      <div key={c.tipo_explosivo} className="grid grid-cols-[6rem_1fr_auto] gap-2 items-center text-sm">
                        <span className="text-right font-mono text-xs text-gray-600">{c.tipo_explosivo}</span>
                        <span className="h-4 bg-gray-100 rounded overflow-hidden">
                          <span className="block h-full rounded" style={{ width: `${width}%`, background: color }} />
                        </span>
                        <span className="text-xs font-semibold font-mono whitespace-nowrap flex items-center gap-1" style={{ color }}>
                          <i className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                          {dias == null ? 'sin consumo' : dias >= 40 ? '40+ días' : `${fmt(dias, 0)} días`}
                        </span>
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-gray-400 mt-2">
                    Stock actual ÷ consumo diario promedio ({fmt(data.dias_periodo)} días del período).
                  </p>
                </div>
              )}
            </Card>

            {/* Consumo por frente */}
            <Card>
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <HiCalendar className="w-5 h-5" /> Consumo por frente de trabajo
              </h4>
              <p className="text-xs text-gray-400 mb-3">Dónde se está consumiendo. Real del período.</p>
              {Object.keys(frentePivot.map).length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">
                  Ninguna línea del período tiene frente + explosivo registrado.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 bg-gradient-to-r from-orange-50 to-yellow-50">
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Frente</th>
                        {frentePivot.tipos.map((t) => (
                          <th key={t} className="px-3 py-2 text-center font-semibold text-gray-700">{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(frentePivot.map).map(([frente, datos]) => (
                        <tr key={frente} className="border-b hover:bg-orange-50/50">
                          <td className="px-3 py-2 font-mono text-xs">{frente}</td>
                          {frentePivot.tipos.map((t) => (
                            <td key={t} className="px-3 py-2 text-center font-mono text-xs">
                              {datos[t] ? fmt(datos[t], 1) : <span className="text-gray-300">-</span>}
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
        </>
      )}
    </div>
  );
}

// dd-mm-aaaa
function fmt2Fecha(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

// ---- Gráfico consumo real por semana (una serie) ----
function GraficoConsumoSemanal({ datos }) {
  const M = { l: 46, r: 10, t: 16, b: 40 };
  const H = 170;
  const slot = Math.max(28, Math.min(56, 460 / datos.length));
  const barW = slot * 0.55;
  const plotW = datos.length * slot;
  const W = M.l + M.r + plotW;
  const maxV = Math.max(...datos.map((d) => parseFloat(d.total_real) || 0), 1);
  const magnitud = Math.pow(10, Math.floor(Math.log10(maxV)));
  const paso = (Math.ceil(maxV / 4 / magnitud) * magnitud) || 1;
  const ejeMax = paso * 4;
  const marcas = [0, 1, 2, 3, 4].map((i) => i * paso);
  const y = (v) => M.t + H - (v / ejeMax) * H;

  return (
    <div className="overflow-x-auto pb-1">
      <svg width={W} height={M.t + H + M.b} role="img" aria-label="Consumo de explosivo por semana">
        {marcas.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#d1d5db' : '#f0ede8'} strokeWidth={1} />
            <text x={M.l - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#9ca3af">{fmt(v)}</text>
          </g>
        ))}
        {datos.map((d, i) => {
          const real = parseFloat(d.total_real) || 0;
          const x = M.l + i * slot + (slot - barW) / 2;
          const [yy, mm, dd] = d.semana.split('-');
          return (
            <g key={d.semana}>
              <rect x={x} y={y(real)} width={barW} height={Math.max(y(0) - y(real), 1)} rx={3} className="fill-orange-500 hover:fill-orange-600">
                <title>{`Semana del ${dd}-${mm}-${yy} · ${fmt(real)}`}</title>
              </rect>
              <text x={x + barW / 2} y={M.t + H + 14} textAnchor="middle" fontSize={9} fill="#9ca3af">{dd}-{mm}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---- Gráfico tiros por día apilado por turno ----
function GraficoTirosTurno({ datos }) {
  const M = { l: 34, r: 8, t: 16, b: 36 };
  const H = 150;
  const slot = Math.max(18, Math.min(34, 320 / datos.length));
  const barW = slot * 0.62;
  const plotW = datos.length * slot;
  const W = M.l + M.r + plotW;
  const totalPorDia = datos.map((d) => TURNOS.reduce((s, t) => s + (d[t] || 0), 0));
  const maxV = Math.max(...totalPorDia, 1);
  const magnitud = Math.pow(10, Math.floor(Math.log10(maxV)));
  const paso = (Math.ceil(maxV / 3 / magnitud) * magnitud) || 1;
  const ejeMax = paso * 3;
  const y = (v) => M.t + H - (v / ejeMax) * H;

  return (
    <div className="overflow-x-auto pb-1">
      <svg width={W} height={M.t + H + M.b} role="img" aria-label="Tiros por día por turno">
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line x1={M.l} x2={W - M.r} y1={y(i * paso)} y2={y(i * paso)} stroke={i === 0 ? '#d1d5db' : '#f0ede8'} strokeWidth={1} />
            <text x={M.l - 6} y={y(i * paso)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#9ca3af">{fmt(i * paso)}</text>
          </g>
        ))}
        {datos.map((d, i) => {
          const x = M.l + i * slot + (slot - barW) / 2;
          let acum = 0;
          const [, mm, dd] = d.fecha.split('-');
          return (
            <g key={d.fecha}>
              {TURNOS.map((t) => {
                const v = d[t] || 0;
                if (v <= 0) return null;
                const yTop = y(acum + v);
                const h = y(acum) - y(acum + v);
                acum += v;
                return (
                  <rect key={t} x={x} y={yTop} width={barW} height={Math.max(h, 1)} fill={COLOR_TURNO[t]} stroke="#fff" strokeWidth={1}>
                    <title>{`${dd}-${mm} · ${t}: ${fmt(v)} tiros`}</title>
                  </rect>
                );
              })}
              {(i % Math.ceil(datos.length / 12) === 0) && (
                <text x={x + barW / 2} y={M.t + H + 13} textAnchor="middle" fontSize={8} fill="#9ca3af">{dd}-{mm}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
