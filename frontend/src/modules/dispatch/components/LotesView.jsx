import React, { useState, useEffect, useMemo } from 'react';
import { HiEye, HiOfficeBuilding, HiBriefcase, HiTruck, HiChartBar } from 'react-icons/hi';
import { HiClipboardDocumentList, HiCalendar } from 'react-icons/hi2';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function getMesAnioLabel(fechaStr) {
  if (!fechaStr) return null;
  const d = new Date(fechaStr + 'T12:00:00');
  return { mes: d.getMonth(), anio: d.getFullYear(), label: `${MESES[d.getMonth()]} ${d.getFullYear()}` };
}
import Card from '../../../shared/components/atoms/Card';
import Badge from '../../../shared/components/atoms/Badge';
import Button from '../../../shared/components/atoms/Button';
import Loader from '../../../shared/components/atoms/Loader';
import LotesDashboard from './LotesDashboard';
import LoteDetalleView from './LoteDetalleView';
import laboratorioService from '../../../services/laboratorio';
import useToast from '../../../hooks/useToast';

const LotesView = () => {
  const toast = useToast();
  const [vistaActual, setVistaActual] = useState('lista'); // 'lista' o 'dashboard'
  const [loading, setLoading] = useState(false);
  const [lotes, setLotes] = useState([]);
  const [plantas, setPlantas] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [filtros, setFiltros] = useState({
    planta_id: '',
    empresa_id: '',
    mes_anio: '',
  });
  const [loteSeleccionado, setLoteSeleccionado] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [vistaDetalle, setVistaDetalle] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    cargarLotes();
  }, [filtros]);

  const cargarDatos = async () => {
    try {
      const [plantasRes, empresasRes] = await Promise.all([
        laboratorioService.getPlantas({ activas: true }),
        laboratorioService.getEmpresas({ activas: true })
      ]);

      setPlantas(plantasRes || []);
      setEmpresas(empresasRes || []);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error al cargar los datos iniciales');
    }
  };

  const cargarLotes = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filtros.planta_id) params.planta_id = filtros.planta_id;
      if (filtros.empresa_id) params.empresa_id = filtros.empresa_id;

      const response = await laboratorioService.getLotes(params);

      // Si la respuesta es paginada
      if (response.data) {
        setLotes(response.data || []);
      } else {
        setLotes(response || []);
      }
    } catch (error) {
      console.error('Error cargando lotes:', error);
      toast.error('Error al cargar los lotes');
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = async (loteId) => {
    setLoadingDetalle(true);
    try {
      const lote = await laboratorioService.getLote(loteId);
      setLoteSeleccionado(lote);
      setVistaDetalle(true);
    } catch (error) {
      console.error('Error cargando detalle:', error);
      toast.error('Error al cargar el detalle del lote');
    } finally {
      setLoadingDetalle(false);
    }
  };

  const handleVolverLista = () => {
    setVistaDetalle(false);
    setLoteSeleccionado(null);
  };

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const limpiarFiltros = () => {
    setFiltros({ planta_id: '', empresa_id: '', mes_anio: '' });
  };

  // Opciones de mes/año derivadas de los lotes cargados
  const opcionesMes = useMemo(() => {
    const map = new Map();
    lotes.forEach(l => {
      const info = getMesAnioLabel(l.fecha_creacion);
      if (info) {
        const key = `${info.anio}-${String(info.mes + 1).padStart(2,'0')}`;
        if (!map.has(key)) map.set(key, info.label);
      }
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, v]) => ({ value: k, label: v }));
  }, [lotes]);

  // Filtrado client-side por mes/año
  const lotesFiltrados = useMemo(() => {
    if (!filtros.mes_anio) return lotes;
    return lotes.filter(l => {
      const info = getMesAnioLabel(l.fecha_creacion);
      if (!info) return false;
      const key = `${info.anio}-${String(info.mes + 1).padStart(2,'0')}`;
      return key === filtros.mes_anio;
    });
  }, [lotes, filtros.mes_anio]);

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'Completado':
        return 'green';
      case 'Recibido':
        return 'blue';
      case 'En Tránsito':
      case 'Despachado':
        return 'yellow';
      case 'En Preparación':
        return 'gray';
      default:
        return 'gray';
    }
  };

  // Vista detalle drill-down
  if (vistaDetalle && loteSeleccionado) {
    return <LoteDetalleView lote={loteSeleccionado} onBack={handleVolverLista} />;
  }

  return (
    <div className="space-y-6">
      {/* Header y Filtros */}
      <Card className="border-l-4 border-indigo-400">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">📦 Gestión de Lotes</h2>
            <p className="text-gray-600">
              Vista agrupada de camionadas por planta y empresa
            </p>
          </div>

          {/* Botones de navegación entre vistas */}
          <div className="flex gap-2">
            <button
              onClick={() => setVistaActual('lista')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                vistaActual === 'lista'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <HiClipboardDocumentList className="w-5 h-5" />
              <span>Lista</span>
            </button>
            <button
              onClick={() => setVistaActual('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                vistaActual === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <HiChartBar className="w-5 h-5" />
              <span>Dashboard</span>
            </button>
          </div>
        </div>

        {/* Filtros - Solo mostrar en vista de lista */}
        {vistaActual === 'lista' && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <HiOfficeBuilding className="inline mr-1" />
                  Filtrar por Planta
                </label>
                <select
                  name="planta_id"
                  value={filtros.planta_id}
                  onChange={handleFiltroChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Todas las plantas</option>
                  {plantas.map(planta => (
                    <option key={planta.id} value={planta.id}>
                      {planta.nombre} ({planta.codigo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <HiBriefcase className="inline mr-1" />
                  Filtrar por Empresa
                </label>
                <select
                  name="empresa_id"
                  value={filtros.empresa_id}
                  onChange={handleFiltroChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Todas las empresas</option>
                  {empresas.map(empresa => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.nombre} ({empresa.codigo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <HiCalendar className="inline mr-1" />
                  Filtrar por Mes
                </label>
                <select
                  name="mes_anio"
                  value={filtros.mes_anio}
                  onChange={handleFiltroChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Todos los meses</option>
                  {opcionesMes.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={limpiarFiltros}
                  className="w-full px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors"
                >
                  Limpiar Filtros
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Vista Dashboard */}
      {vistaActual === 'dashboard' && <LotesDashboard />}

      {/* Lista de Lotes - Solo mostrar en vista de lista */}
      {vistaActual === 'lista' && (loading ? (
        <div className="flex justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : lotesFiltrados.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <HiChartBar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-700 font-medium mb-2">
              {lotes.length === 0 ? 'No hay lotes registrados' : 'No hay lotes para el mes seleccionado'}
            </p>
            <p className="text-gray-500 text-sm">
              {lotes.length === 0 ? 'Los lotes se crean automáticamente al registrar camionadas' : 'Prueba con otro filtro de mes'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {lotesFiltrados.map((lote) => (
            <Card key={lote.id} className="border-l-4 border-indigo-400 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {lote.numero_lote}
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge color="blue">
                      <HiOfficeBuilding className="inline mr-1" />
                      {lote.planta?.nombre}
                    </Badge>
                    <Badge color="purple">
                      <HiBriefcase className="inline mr-1" />
                      {lote.empresa?.nombre}
                    </Badge>
                    <Badge color={getEstadoColor(lote.estado)}>
                      {lote.estado}
                    </Badge>
                    {getMesAnioLabel(lote.fecha_creacion) && (
                      <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full text-xs font-semibold">
                        <HiCalendar className="w-3 h-3" />
                        {getMesAnioLabel(lote.fecha_creacion).label}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  icon={HiEye}
                  onClick={() => handleVerDetalle(lote.id)}
                  disabled={loadingDetalle}
                >
                  {loadingDetalle ? 'Cargando...' : 'Ver Detalle'}
                </Button>
              </div>

              {/* Estadísticas */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-gray-600 mb-1">Camionadas</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {lote.camionadas?.length || 0}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-gray-600 mb-1">Peso Total</p>
                  <p className="text-2xl font-bold text-green-700">
                    {lote.camionadas?.reduce((sum, c) => sum + parseFloat(c.peso || 0), 0).toFixed(2)} t
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                  <p className="text-xs text-gray-600 mb-1">Mezclas</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {new Set(lote.camionadas?.map(c => c.mezcla_id)).size || 0}
                  </p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                  <p className="text-xs text-gray-600 mb-1">Ley Lote</p>
                  <p className="text-2xl font-bold text-orange-700">
                    {lote.ley_lote_promedio !== null && lote.ley_lote_promedio !== undefined
                      ? `${lote.ley_lote_promedio.toFixed(2)}%`
                      : 'N/A'}
                  </p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <p className="text-xs text-gray-600 mb-1">Ley Visual</p>
                  <p className="text-2xl font-bold text-amber-700">
                    {lote.ley_visual_promedio !== null && lote.ley_visual_promedio !== undefined
                      ? `${lote.ley_visual_promedio.toFixed(2)}%`
                      : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Última actualización */}
              <div className="mt-3 text-xs text-gray-500">
                Creado: {new Date(lote.fecha_creacion).toLocaleDateString('es-CL')}
              </div>
            </Card>
          ))}
        </div>
      ))}

    </div>
  );
};

export default LotesView;
