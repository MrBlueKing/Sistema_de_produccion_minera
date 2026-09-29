import { useState, useEffect } from 'react';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import explosivosService from '../services/explosivos';
import useToast from '../../../hooks/useToast';
import PerforacionTronaduraDashboard from './PerforacionTronaduraDashboard';

// Ingeniería > Reportes P&T > Dashboard. Mismo dashboard que Dashboard
// Gerencial > Operaciones > Perforación y Tronadura; acá solo están los
// filtros de fecha y la faena del usuario (o la que eligió).

const hoyISO = () => new Date().toISOString().split('T')[0];
const isoMenosDias = (d) => new Date(Date.now() - d * 864e5).toISOString().split('T')[0];

function rangoPreset(preset) {
  const hoy = new Date();
  const f = (d) => d.toISOString().slice(0, 10);
  switch (preset) {
    case '30': return { desde: isoMenosDias(29), hasta: hoyISO() };
    case '90': return { desde: isoMenosDias(89), hasta: hoyISO() };
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

function fmt2Fecha(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

export default function DashboardPerforacion({ faenaActual, faenas = [] }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [preset, setPreset] = useState('30');
  const [fechaDesde, setFechaDesde] = useState(isoMenosDias(29));
  const [fechaHasta, setFechaHasta] = useState(hoyISO());

  const cargar = async (desde = fechaDesde, hasta = fechaHasta) => {
    setLoading(true);
    try {
      const params = { fecha_desde: desde, fecha_hasta: hasta };
      if (faenaActual?.id) params.faena_id = faenaActual.id;
      const res = await explosivosService.getDashboardPerforacion(params);
      setData(res.data ?? null);
    } catch {
      toast.error('Error', 'No se pudo cargar el dashboard');
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

  const nombreFaena = (id) => {
    const f = faenas.find((x) => x.id === id) || (faenaActual?.id === id ? faenaActual : null);
    return f?.ubicacion || f?.nombre || `Faena ${id}`;
  };
  const nombreActual = faenaActual?.nombre || faenaActual?.ubicacion;

  return (
    <div className="space-y-4">
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
            {nombreActual ? ` · ${nombreActual}` : ''}
          </span>
        </div>
      </Card>

      <PerforacionTronaduraDashboard data={data} loading={loading} nombreFaena={nombreFaena} />
    </div>
  );
}
