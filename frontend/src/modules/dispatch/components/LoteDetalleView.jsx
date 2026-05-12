import React, { useState } from 'react';
import {
  HiTruck, HiOfficeBuilding, HiBriefcase,
  HiChevronDown, HiChevronUp
} from 'react-icons/hi';
import Card from '../../../shared/components/atoms/Card';
import Badge from '../../../shared/components/atoms/Badge';

const fmt = (val, decimals = 2) =>
  val != null ? parseFloat(val).toFixed(decimals) : '-';

const fmtPct = (val, decimals = 2) =>
  val != null ? `${parseFloat(val).toFixed(decimals)}%` : '-';

const LoteDetalleView = ({ lote, onBack }) => {
  // Agrupar mezclas únicas desde camionadas (relación many-to-many via pivot)
  const mezclaMap = {};
  lote.camionadas?.forEach(cam => {
    (cam.mezclas ?? []).forEach(m => {
      if (m.id && !mezclaMap[m.id]) mezclaMap[m.id] = m;
    });
  });
  const mezclas = Object.values(mezclaMap);

  const [abiertos, setAbiertos] = useState(
    mezclas.reduce((acc, m) => ({ ...acc, [m.id]: true }), {})
  );

  const toggleMezcla = (id) =>
    setAbiertos(prev => ({ ...prev, [id]: !prev[id] }));

  const pesoTotal = lote.camionadas?.reduce(
    (s, c) => s + parseFloat(c.peso || 0), 0
  ) || 0;

  const getEstadoColor = (estado) => {
    if (estado === 'Completado') return 'green';
    if (estado === 'Recibido') return 'blue';
    if (estado === 'Despachado' || estado === 'En Tránsito') return 'yellow';
    return 'gray';
  };

  return (
    <div className="space-y-4">

      {/* Header */}
      <Card className="border-l-4 border-indigo-400">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Lote</p>
            <h2 className="text-2xl font-bold text-gray-900">
              {lote.numero_lote} — {lote.empresa?.nombre}
            </h2>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge color="blue">
                <HiOfficeBuilding className="inline mr-1" />{lote.planta?.nombre}
              </Badge>
              <Badge color={getEstadoColor(lote.estado)}>{lote.estado}</Badge>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 text-center">
            <p className="text-xs text-gray-500 mb-1">Camionadas</p>
            <p className="text-2xl font-bold text-blue-700">{lote.camionadas?.length || 0}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
            <p className="text-xs text-gray-500 mb-1">Peso Total</p>
            <p className="text-xl font-bold text-green-700">{fmt(pesoTotal)} t</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-200 text-center">
            <p className="text-xs text-gray-500 mb-1">Mezclas</p>
            <p className="text-2xl font-bold text-purple-700">{mezclas.length}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 border border-orange-200 text-center">
            <p className="text-xs text-gray-500 mb-1">Ley Lote</p>
            <p className="text-xl font-bold text-orange-700">{fmtPct(lote.ley_lote_promedio)}</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-center">
            <p className="text-xs text-gray-500 mb-1">Ley Lab</p>
            <p className="text-xl font-bold text-amber-700">{fmtPct(lote.ley_lab_promedio)}</p>
          </div>
        </div>
      </Card>

      {/* Cuerpo: dos columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

        {/* Izquierda: tabla de camionadas */}
        <div className="lg:col-span-2">
          <Card>
            <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              <HiTruck className="text-indigo-600 w-5 h-5" /> Camionadas del Lote
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-indigo-50 border-b-2 border-indigo-200">
                    <th className="text-left py-2 px-2 font-bold text-indigo-900">#</th>
                    <th className="text-left py-2 px-2 font-bold text-indigo-900">Patente</th>
                    <th className="text-left py-2 px-2 font-bold text-indigo-900">F. Rec.</th>
                    <th className="text-right py-2 px-2 font-bold text-indigo-900">Peso</th>
                    <th className="text-right py-2 px-2 font-bold text-indigo-900">Ley</th>
                    <th className="text-left py-2 px-2 font-bold text-indigo-900">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {lote.camionadas?.map((cam, idx) => (
                    <tr
                      key={cam.id}
                      className={`border-b hover:bg-indigo-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      <td className="py-2 px-2 font-bold">{cam.numero_camionada}</td>
                      <td className="py-2 px-2 font-mono text-xs">{cam.patente || '-'}</td>
                      <td className="py-2 px-2 text-xs text-gray-600">
                        {cam.fecha_recepcion
                          ? new Date(cam.fecha_recepcion).toLocaleDateString('es-CL')
                          : '-'}
                      </td>
                      <td className="py-2 px-2 text-right font-semibold">
                        {fmt(cam.peso)}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {fmtPct(cam.ley_mezcla)}
                      </td>
                      <td className="py-2 px-2">
                        <span className="font-mono text-xs font-bold text-indigo-700">
                          {cam.mezclas?.map(m => m.codigo).join(', ') || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-indigo-100 border-t-2 border-indigo-300 font-bold">
                    <td colSpan="3" className="py-2 px-2 text-indigo-900 text-sm">TOTAL</td>
                    <td className="py-2 px-2 text-right text-indigo-900 text-sm">{fmt(pesoTotal)}</td>
                    <td className="py-2 px-2 text-right text-indigo-900 text-sm">
                      {(() => {
                        const cams = lote.camionadas?.filter(c => c.ley_mezcla && c.peso) || [];
                        if (cams.length === 0) return '-';
                        const sumPeso = cams.reduce((s, c) => s + parseFloat(c.peso), 0);
                        const sumPond = cams.reduce((s, c) => s + parseFloat(c.ley_mezcla) * parseFloat(c.peso), 0);
                        return fmtPct(sumPond / sumPeso);
                      })()}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>

        {/* Derecha: acordeones por mezcla */}
        <div className="lg:col-span-3 space-y-3">
          {mezclas.length === 0 && (
            <Card>
              <p className="text-center text-gray-500 py-6">No hay mezclas asociadas a este lote</p>
            </Card>
          )}

          {mezclas.map(mezcla => {
            const detalles = mezcla.detalles || [];
            const tonTotal = detalles.reduce(
              (s, d) => s + parseFloat(d.toneladas || 0), 0
            );
            const isOpen = abiertos[mezcla.id];

            return (
              <div key={mezcla.id} className={`rounded-xl border overflow-hidden transition-all ${isOpen ? 'border-indigo-200 shadow-sm' : 'border-gray-200'}`}>
                {/* Cabecera del acordeón */}
                <button
                  onClick={() => toggleMezcla(mezcla.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isOpen ? 'bg-indigo-50' : 'bg-white hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`text-base font-bold font-mono shrink-0 ${isOpen ? 'text-indigo-700' : 'text-gray-800'}`}>
                      {mezcla.codigo}
                    </span>
                    <div className="flex flex-1 gap-2">
                      <div className="flex-1 flex flex-col items-center bg-gray-100 rounded-lg py-1.5">
                        <span className="text-xs font-bold text-gray-800">{fmt(tonTotal)}</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide">ton</span>
                      </div>
                      <div className="flex-1 flex flex-col items-center bg-gray-100 rounded-lg py-1.5">
                        <span className="text-xs font-bold text-gray-800">{detalles.length}</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide">dump.</span>
                      </div>
                      {mezcla.ley_prom_dump != null && (
                        <div className="flex-1 flex flex-col items-center bg-orange-50 rounded-lg py-1.5">
                          <span className="text-xs font-bold text-orange-600">{fmtPct(mezcla.ley_prom_dump)}</span>
                          <span className="text-[10px] text-orange-400 uppercase tracking-wide">ley</span>
                        </div>
                      )}
                      {mezcla.ley_prom_lote != null && (
                        <div className="flex-1 flex flex-col items-center bg-indigo-50 rounded-lg py-1.5">
                          <span className="text-xs font-bold text-indigo-600">{fmtPct(mezcla.ley_prom_lote)}</span>
                          <span className="text-[10px] text-indigo-400 uppercase tracking-wide">lote</span>
                        </div>
                      )}
                      {mezcla.ley_lab != null && (
                        <div className="flex-1 flex flex-col items-center bg-green-50 rounded-lg py-1.5">
                          <span className="text-xs font-bold text-green-600">{fmtPct(mezcla.ley_lab)}</span>
                          <span className="text-[10px] text-green-400 uppercase tracking-wide">lab</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {isOpen
                    ? <HiChevronUp className="w-5 h-5 text-indigo-400 shrink-0" />
                    : <HiChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                  }
                </button>

                {/* Tabla de dumpadas */}
                {isOpen && (
                  <div className="border-t border-gray-200 overflow-x-auto">
                    {detalles.length === 0 ? (
                      <p className="text-center text-gray-400 text-sm py-4">
                        Sin dumpadas registradas
                      </p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left py-2 px-3 font-semibold text-gray-600">Dump#</th>
                            <th className="text-left py-2 px-3 font-semibold text-gray-600">Acopio</th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-600">TON</th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-600">Ley Dump</th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-600">Ley Visual</th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-600">Ley Lote</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalles.map((det, idx) => (
                            <tr
                              key={det.id}
                              className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-indigo-50`}
                            >
                              <td className="py-1.5 px-3 font-mono font-semibold text-gray-700">
                                {det.tipo === 'REM'
                                  ? <span className="text-amber-600">REM</span>
                                  : det.dumpada?.numero_dumpada || '-'}
                              </td>
                              <td className="py-1.5 px-3 text-gray-600">{det.origen || '-'}</td>
                              <td className="py-1.5 px-3 text-right">{fmt(det.toneladas)}</td>
                              <td className="py-1.5 px-3 text-right">{fmtPct(det.ley_dump_ajustada)}</td>
                              <td className="py-1.5 px-3 text-right text-gray-400">
                                {det.ley_visual ? fmtPct(det.ley_visual) : '0.00%'}
                              </td>
                              <td className="py-1.5 px-3 text-right font-semibold text-indigo-700">
                                {fmtPct(det.ley_lote)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-indigo-50 border-t-2 border-indigo-200 font-bold text-xs">
                            <td colSpan="2" className="py-2 px-3 text-indigo-900">TOTAL</td>
                            <td className="py-2 px-3 text-right text-indigo-900">{fmt(tonTotal)}</td>
                            <td className="py-2 px-3 text-right text-indigo-900">
                              {fmtPct(mezcla.ley_prom_dump)}
                            </td>
                            <td className="py-2 px-3 text-right text-indigo-900">
                              {fmtPct(mezcla.ley_prom_visual)}
                            </td>
                            <td className="py-2 px-3 text-right text-indigo-900">
                              {fmtPct(mezcla.ley_prom_lote)}
                            </td>
                          </tr>
                          {mezcla.ley_lab != null && (
                            <tr className="bg-green-50 border-t border-green-200">
                              <td colSpan="5" className="py-1.5 px-3 text-green-800 font-semibold">
                                Ley Laboratorio
                              </td>
                              <td className="py-1.5 px-3 text-right font-bold text-green-800">
                                {fmtPct(mezcla.ley_lab)}
                              </td>
                            </tr>
                          )}
                        </tfoot>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LoteDetalleView;
