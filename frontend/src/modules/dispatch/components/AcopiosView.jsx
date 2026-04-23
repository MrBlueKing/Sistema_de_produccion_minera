import { useState, useEffect } from 'react';
import { HiCube, HiPlus, HiEye, HiTrash, HiLockClosed, HiLockOpen, HiCheckCircle, HiXCircle, HiPencil, HiClock, HiCalendar, HiBeaker, HiTruck, HiChartBar, HiMagnifyingGlass, HiAdjustmentsHorizontal, HiArchiveBox, HiInformationCircle } from 'react-icons/hi2';
import Button from '../../../shared/components/atoms/Button';
import Card from '../../../shared/components/atoms/Card';
import Badge from '../../../shared/components/atoms/Badge';
import Input from '../../../shared/components/atoms/Input';
import ConfirmModal from '../../../shared/components/molecules/ConfirmModal';
import AcopioEditModal from '../../../shared/components/molecules/AcopioEditModal';
import Pagination from '../../../shared/components/molecules/Pagination';
import { useConfig } from '../../../hooks/useConfig';
import acopiosService from '../../../services/acopios';

export default function AcopiosView({ toast, formatearFecha }) {
  const { tonelajeDumpadaDefault, factorAjusteLey } = useConfig();
  const [showInfo, setShowInfo] = useState(false);
  const [acopios, setAcopios] = useState([]);
  const [dumpadasSinAcopio, setDumpadasSinAcopio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vistaActual, setVistaActual] = useState('lista'); // 'lista' | 'crear-manual' | 'detalle'
  const [acopioSeleccionado, setAcopioSeleccionado] = useState(null);

  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(6); // Mostrar 6 acopios por página

  // Estados para filtros
  const [tabActivo, setTabActivo] = useState('activos'); // 'activos' | 'historial' | 'todos'
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [ordenamiento, setOrdenamiento] = useState('reciente'); // 'reciente' | 'antiguo' | 'alfabetico'

  // Estados para creación manual
  const [nombreAcopio, setNombreAcopio] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [dumpadasSeleccionadas, setDumpadasSeleccionadas] = useState([]);

  // Estados para modales
  const [confirmModal, setConfirmModal] = useState({ show: false, action: null, acopio: null });
  const [showEditModal, setShowEditModal] = useState(false);
  const [acopioEditar, setAcopioEditar] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [acopiosRes, dumpadasRes] = await Promise.all([
        acopiosService.getAcopios(),
        acopiosService.getDumpadasSinAcopio(),
      ]);

      setAcopios(acopiosRes.data || []);
      setDumpadasSinAcopio(dumpadasRes.data || []);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast?.error('Error al cargar datos', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCrearManual = async () => {
    if (dumpadasSeleccionadas.length === 0) {
      toast?.warning('Atención', 'Debes seleccionar al menos una dumpada');
      return;
    }

    setLoading(true);
    try {
      await acopiosService.crearAcopioManual({
        nombre: nombreAcopio || null,
        observaciones: observaciones || null,
        dumpada_ids: dumpadasSeleccionadas,
      });

      toast?.success('Acopio manual creado', 'El acopio ha sido creado exitosamente');

      // Resetear formulario
      setNombreAcopio('');
      setObservaciones('');
      setDumpadasSeleccionadas([]);
      setVistaActual('lista');

      await loadData();
    } catch (error) {
      console.error('Error creando acopio:', error);
      toast?.error('Error al crear acopio', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCerrarAcopio = async (acopio) => {
    setLoading(true);
    try {
      // Primero verificar si puede cerrarse
      const verificacion = await acopiosService.puedeCerrarse(acopio.id);

      if (!verificacion.puede_cerrarse) {
        const dumpadasSinLey = verificacion.dumpadas_sin_ley || 0;
        const mensaje = `No se puede cerrar el acopio. ${dumpadasSinLey} dumpada(s) no tienen ley de laboratorio ni ley visual. Todas las dumpadas deben tener al menos una ley asignada.`;
        toast?.warning('Acopio no puede cerrarse', mensaje);
        setLoading(false);
        return;
      }

      // Si puede cerrarse, proceder
      await acopiosService.cerrarAcopio(acopio.id);
      toast?.success('Acopio cerrado', 'El acopio ha sido cerrado exitosamente y está disponible para mezclas');
      await loadData();
    } catch (error) {
      console.error('Error cerrando acopio:', error);
      toast?.error('Error al cerrar acopio', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReabrirAcopio = async (acopio) => {
    setLoading(true);
    try {
      await acopiosService.reabrirAcopio(acopio.id);
      toast?.success('Acopio reabierto', 'El acopio ha sido reabierto exitosamente');
      await loadData();
    } catch (error) {
      console.error('Error reabriendo acopio:', error);
      toast?.error('Error al reabrir acopio', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarAcopio = async () => {
    const acopio = confirmModal.acopio;
    setConfirmModal({ show: false, action: null, acopio: null });
    setLoading(true);

    try {
      await acopiosService.eliminarAcopio(acopio.id);
      toast?.success('Acopio eliminado', 'El acopio ha sido eliminado exitosamente');
      await loadData();
    } catch (error) {
      console.error('Error eliminando acopio:', error);
      toast?.error('Error al eliminar acopio', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = async (acopio) => {
    setLoading(true);
    try {
      const response = await acopiosService.getAcopio(acopio.id);
      setAcopioSeleccionado(response.data);
      setVistaActual('detalle');
    } catch (error) {
      console.error('Error cargando detalle:', error);
      toast?.error('Error al cargar detalle', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarAcopio = (acopio) => {
    setAcopioEditar(acopio);
    setShowEditModal(true);
  };

  const handleEditSuccess = async () => {
    await loadData();
    setShowEditModal(false);
    setAcopioEditar(null);
  };

  const toggleDumpadaSeleccion = (dumpadaId) => {
    setDumpadasSeleccionadas(prev => {
      if (prev.includes(dumpadaId)) {
        return prev.filter(id => id !== dumpadaId);
      } else {
        return [...prev, dumpadaId];
      }
    });
  };

  const getEstadoColor = (estado) => {
    const colors = {
      'ABIERTO': 'bg-green-500',
      'CERRADO': 'bg-blue-500',
      'EN_MEZCLA': 'bg-purple-500'
    };
    return colors[estado] || 'bg-gray-500';
  };

  const getTipoColor = (tipo) => {
    const colors = {
      'AUTOMATICO': 'bg-blue-100 text-blue-800',
      'MANUAL': 'bg-orange-100 text-orange-800'
    };
    return colors[tipo] || 'bg-gray-100 text-gray-800';
  };

  // =====================================================
  // LÓGICA DE FILTRADO Y PAGINACIÓN
  // =====================================================

  // Filtrar acopios según tab activo
  const acopiosFiltradosPorTab = acopios.filter(acopio => {
    if (tabActivo === 'activos') {
      // Activos: ABIERTO o CERRADO (no en mezcla)
      return acopio.estado === 'ABIERTO' || acopio.estado === 'CERRADO';
    } else if (tabActivo === 'historial') {
      // Historial: EN_MEZCLA
      return acopio.estado === 'EN_MEZCLA';
    }
    // 'todos': mostrar todos
    return true;
  });

  // Aplicar filtros de búsqueda y filtros adicionales
  const acopiosFiltrados = acopiosFiltradosPorTab.filter(acopio => {
    // Filtro de búsqueda
    if (busqueda) {
      const searchLower = busqueda.toLowerCase();
      const cumpleBusqueda =
        acopio.codigo_acopio?.toLowerCase().includes(searchLower) ||
        acopio.nombre?.toLowerCase().includes(searchLower) ||
        acopio.frente_trabajo?.codigo_completo?.toLowerCase().includes(searchLower) ||
        acopio.jornada?.toLowerCase().includes(searchLower);

      if (!cumpleBusqueda) return false;
    }

    // Filtro por estado
    if (filtroEstado && acopio.estado !== filtroEstado) {
      return false;
    }

    // Filtro por tipo
    if (filtroTipo && acopio.tipo !== filtroTipo) {
      return false;
    }

    return true;
  });

  // Ordenar acopios
  const acopiosOrdenados = [...acopiosFiltrados].sort((a, b) => {
    if (ordenamiento === 'reciente') {
      return new Date(b.created_at) - new Date(a.created_at);
    } else if (ordenamiento === 'antiguo') {
      return new Date(a.created_at) - new Date(b.created_at);
    } else if (ordenamiento === 'alfabetico') {
      return a.codigo_acopio.localeCompare(b.codigo_acopio);
    }
    return 0;
  });

  // Calcular paginación
  const totalAcopios = acopiosOrdenados.length;
  const totalPages = Math.ceil(totalAcopios / perPage);
  const startIndex = (currentPage - 1) * perPage;
  const endIndex = startIndex + perPage;
  const acopiosPaginados = acopiosOrdenados.slice(startIndex, endIndex);

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [tabActivo, busqueda, filtroEstado, filtroTipo, ordenamiento]);

  // Contador de acopios por estado (para tabs)
  const contadores = {
    activos: acopios.filter(a => a.estado === 'ABIERTO' || a.estado === 'CERRADO').length,
    historial: acopios.filter(a => a.estado === 'EN_MEZCLA').length,
    todos: acopios.length
  };

  if (loading && acopios.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando acopios...</p>
        </div>
      </div>
    );
  }

  // Vista: Crear Acopio Manual
  if (vistaActual === 'crear-manual') {
    return (
      <div className="space-y-6">
        <Card className="border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Crear Acopio Manual</h3>
              <p className="text-sm text-gray-600 mt-1">
                Selecciona dumpadas para crear un acopio personalizado
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setVistaActual('lista');
                setDumpadasSeleccionadas([]);
                setNombreAcopio('');
                setObservaciones('');
              }}
            >
              Cancelar
            </Button>
          </div>

          {/* Formulario */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Input
              label="Nombre del Acopio (opcional)"
              value={nombreAcopio}
              onChange={(e) => setNombreAcopio(e.target.value)}
              placeholder="Ej: Alta Ley para Venta"
            />
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Observaciones (opcional)
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas sobre este acopio..."
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Dumpadas sin acopio */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-bold text-blue-900 mb-4">
              Dumpadas Disponibles ({dumpadasSinAcopio.length})
            </h4>

            {dumpadasSinAcopio.length === 0 ? (
              <p className="text-center text-gray-600 py-8">
                No hay dumpadas disponibles sin acopio
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
                {dumpadasSinAcopio.map((dumpada) => (
                  <label
                    key={dumpada.id}
                    className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      dumpadasSeleccionadas.includes(dumpada.id)
                        ? 'border-blue-500 bg-blue-100'
                        : 'border-gray-300 bg-white hover:border-blue-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={dumpadasSeleccionadas.includes(dumpada.id)}
                      onChange={() => toggleDumpadaSeleccion(dumpada.id)}
                      className="w-5 h-5 text-blue-600"
                    />
                    <div className="flex-1 grid grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="font-bold text-blue-900">
                          {dumpada.frente_trabajo?.codigo_completo || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs">
                          {dumpada.jornada}
                        </span>
                      </div>
                      <div className="text-gray-700">
                        {formatearFecha(dumpada.fecha)}
                      </div>
                      <div className="text-gray-700">
                        {dumpada.ton} ton • Ley: {dumpada.ley_visual}%
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Resumen */}
          {dumpadasSeleccionadas.length > 0 && (
            <div className="mt-6 bg-green-50 border-2 border-green-300 rounded-lg p-4">
              <h4 className="font-bold text-green-900 mb-2">Resumen del Acopio</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-green-700">Dumpadas seleccionadas:</span>
                  <p className="font-bold text-green-900">{dumpadasSeleccionadas.length}</p>
                </div>
                <div>
                  <span className="text-green-700">Total estimado:</span>
                  <p className="font-bold text-green-900">
                    {(dumpadasSeleccionadas.length * tonelajeDumpadaDefault).toFixed(2)} ton
                  </p>
                </div>
                <div>
                  <span className="text-green-700">Tipo:</span>
                  <p className="font-bold text-green-900">MANUAL</p>
                </div>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="mt-6 flex gap-3">
            <Button
              variant="success"
              onClick={handleCrearManual}
              disabled={dumpadasSeleccionadas.length === 0 || loading}
            >
              {loading ? 'Creando...' : `Crear Acopio con ${dumpadasSeleccionadas.length} Dumpadas`}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Vista: Detalle de Acopio
  if (vistaActual === 'detalle' && acopioSeleccionado) {
    return (
      <div className="space-y-6">
        <Card className="border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                Detalle del Acopio: {acopioSeleccionado.codigo_acopio}
              </h3>
              {acopioSeleccionado.nombre && (
                <p className="text-sm text-gray-600 mt-1">{acopioSeleccionado.nombre}</p>
              )}
            </div>
            <Button
              variant="secondary"
              onClick={() => setVistaActual('lista')}
            >
              Volver
            </Button>
          </div>

          {/* Info general */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-700 mb-1">Tipo</p>
              <p className={`font-bold px-2 py-1 rounded inline-block ${getTipoColor(acopioSeleccionado.tipo)}`}>
                {acopioSeleccionado.tipo}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-700 mb-1">Estado</p>
              <p className={`${getEstadoColor(acopioSeleccionado.estado)} text-white px-2 py-1 rounded font-bold inline-block`}>
                {acopioSeleccionado.estado}
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border-2 border-purple-200 shadow-lg">
              <p className="text-sm text-purple-700 mb-2 font-semibold uppercase tracking-wide">Dumpadas</p>
              <p className="text-4xl font-bold text-purple-900">{acopioSeleccionado.cantidad_dumpadas || 0}</p>
            </div>
          </div>

          {/* Estadísticas de leyes y toneladas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border-2 border-orange-200 shadow-lg">
              <p className="text-sm text-orange-700 mb-2 font-semibold uppercase tracking-wide">Total Toneladas</p>
              <p className="text-4xl font-bold text-orange-900">
                {acopioSeleccionado.total_toneladas
                  ? parseFloat(acopioSeleccionado.total_toneladas).toFixed(2)
                  : '0.00'}
                <span className="text-2xl ml-2 text-orange-700">ton</span>
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200 shadow-lg">
              <p className="text-sm text-blue-700 mb-2 font-semibold uppercase tracking-wide">Ley Promedio</p>
              <p className="text-4xl font-bold text-blue-900">
                {acopioSeleccionado.ley_promedio
                  ? parseFloat(acopioSeleccionado.ley_promedio).toFixed(2)
                  : '-'}
                {acopioSeleccionado.ley_promedio && <span className="text-2xl ml-2 text-blue-700">%</span>}
              </p>
            </div>
            <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl p-6 border-2 border-teal-200 shadow-lg">
              <p className="text-sm text-teal-700 mb-2 font-semibold uppercase tracking-wide">Ley Visual Promedio</p>
              <p className="text-4xl font-bold text-teal-900">
                {acopioSeleccionado.ley_visual_promedio
                  ? parseFloat(acopioSeleccionado.ley_visual_promedio).toFixed(2)
                  : '-'}
                {acopioSeleccionado.ley_visual_promedio && <span className="text-2xl ml-2 text-teal-700">%</span>}
              </p>
            </div>
          </div>

          {/* Dumpadas del acopio con cálculos detallados */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-bold text-gray-900 mb-4">
              📦 Composición del Acopio ({acopioSeleccionado.dumpadas?.length || 0} dumpadas)
            </h4>

            {acopioSeleccionado.dumpadas && acopioSeleccionado.dumpadas.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-300">
                  <thead>
                    <tr className="border-b-2 border-gray-300 bg-gradient-to-r from-blue-50 to-blue-100">
                      <th className="text-left py-3 px-3 font-bold text-blue-900 text-xs">N° Dump</th>
                      <th className="text-left py-3 px-3 font-bold text-blue-900 text-xs">Frente</th>
                      <th className="text-left py-3 px-3 font-bold text-blue-900 text-xs">Fecha</th>
                      <th className="text-right py-3 px-3 font-bold text-blue-900 text-xs">Toneladas</th>
                      <th className="text-right py-3 px-3 font-bold text-blue-900 text-xs">Ley Dump</th>
                      <th className="text-right py-3 px-3 font-bold text-blue-900 text-xs">Ley Visual</th>
                      <th className="text-right py-3 px-3 font-bold text-blue-900 text-xs">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acopioSeleccionado.dumpadas.map((dumpada, index) => {
                      // Mostrar valores CRUDOS (sin ajuste) de cada dumpada
                      const ley = parseFloat(dumpada.ley || 0);
                      const leyVisual = parseFloat(dumpada.ley_visual || 0);
                      const toneladas = parseFloat(dumpada.ton || 0);

                      return (
                        <tr key={dumpada.id} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="py-2 px-3 font-mono font-bold text-gray-800 text-xs">
                            {dumpada.numero_dumpada || '-'}
                          </td>
                          <td className="py-2 px-3 font-bold text-blue-900 text-xs">
                            {dumpada.frente_trabajo?.codigo_completo || 'N/A'}
                          </td>
                          <td className="py-2 px-3 text-xs">{formatearFecha(dumpada.fecha)}</td>
                          <td className="py-2 px-3 font-semibold text-right text-xs">
                            {toneladas.toFixed(2)} t
                          </td>
                          <td className="py-2 px-3 text-right text-xs">
                            {ley > 0 ? `${ley.toFixed(2)}%` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right text-xs">
                            {leyVisual > 0 ? `${leyVisual.toFixed(2)}%` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right text-xs">
                            <span className={`${
                              dumpada.estado === 'Completado' ? 'bg-green-500' : 'bg-yellow-500'
                            } text-white px-2 py-0.5 rounded-full text-xs font-bold`}>
                              {dumpada.estado}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Fila de totales - Muestra promedios ajustados que vienen del backend */}
                    <tr className="bg-gradient-to-r from-blue-100 to-blue-200 border-t-2 border-blue-400 font-bold">
                      <td className="py-3 px-3 text-sm text-blue-900" colSpan="3">
                        📊 TOTALES (Promedios Ajustados)
                      </td>
                      <td className="py-3 px-3 text-sm text-blue-900 text-right">
                        {acopioSeleccionado.total_toneladas
                          ? parseFloat(acopioSeleccionado.total_toneladas).toFixed(2)
                          : '0.00'} t
                      </td>
                      <td className="py-3 px-3 text-sm text-blue-900 text-right">
                        {(() => {
                          // ley_promedio YA viene con factor aplicado desde el backend
                          const leyPromedio = parseFloat(acopioSeleccionado.ley_promedio || 0);
                          return leyPromedio > 0 ? `${leyPromedio.toFixed(2)}%` : '-';
                        })()}
                      </td>
                      <td className="py-3 px-3 text-sm text-blue-900 text-right">
                        {(() => {
                          // ley_visual_promedio YA viene con factor aplicado desde el backend
                          const leyVisualPromedio = parseFloat(acopioSeleccionado.ley_visual_promedio || 0);
                          return leyVisualPromedio > 0 ? `${leyVisualPromedio.toFixed(2)}%` : '-';
                        })()}
                      </td>
                      <td className="py-3 px-3 text-sm text-blue-900 text-right">
                        -
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Explicación de fórmulas */}
                <div className="mt-3 bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                  <h5 className="text-xs font-bold text-blue-900 mb-2">📐 Fórmulas de Cálculo:</h5>
                  <div className="text-xs text-blue-800 space-y-1">
                    <div>
                      <span className="font-semibold">Ley Dump Ajustada:</span> Σ(ton<sub>i</sub> × ley_dump<sub>i</sub> × 0.9) / Total_Toneladas
                    </div>
                    <div>
                      <span className="font-semibold">Ley Visual Ajustada:</span> Σ(ton<sub>i</sub> × ley_visual<sub>i</sub> × 0.9) / Total_Toneladas
                    </div>
                    <div className="text-blue-600 italic mt-2">
                      Factor de ajuste: {factorAjusteLey} (configurable en sistema)
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-600 py-8">No hay dumpadas en este acopio</p>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Vista: Lista de Acopios
  return (
    <div className="space-y-6">
      {/* Modal de confirmación */}
      <ConfirmModal
        show={confirmModal.show}
        onConfirm={handleEliminarAcopio}
        onCancel={() => setConfirmModal({ show: false, action: null, acopio: null })}
        title="¿Eliminar Acopio?"
        message={`Estás a punto de eliminar el acopio:`}
        highlightText={confirmModal.acopio?.codigo_acopio}
        warningText="Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        icon={HiTrash}
      />

      {/* Modal de edición */}
      <AcopioEditModal
        show={showEditModal}
        acopio={acopioEditar}
        onClose={() => {
          setShowEditModal(false);
          setAcopioEditar(null);
        }}
        onSuccess={handleEditSuccess}
        toast={toast}
        formatearFecha={formatearFecha}
      />

      <Card className="border-l-4 border-purple-500">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Gestión de Acopios</h3>
            <p className="text-sm text-gray-600 mt-1">
              Total: <span className="font-semibold text-purple-600">{acopios.length}</span> acopios registrados
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowInfo(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                showInfo ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-blue-500 border-blue-200 hover:bg-blue-50'
              }`}
              title="¿Cómo funciona?"
            >
              <HiInformationCircle className="w-4 h-4" />
              <span className="hidden sm:inline">¿Cómo funciona?</span>
            </button>
            <Button
              variant="primary"
              icon={HiPlus}
              onClick={() => setVistaActual('crear-manual')}
              disabled={dumpadasSinAcopio.length === 0}
            >
              Crear Acopio Manual
            </Button>
          </div>
        </div>

        {/* Panel ¿Cómo funciona? */}
        {showInfo && (
          <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl">

            {/* ── Flujo del dato ── */}
            <div className="mb-4 pb-4 border-b border-blue-100">
              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-2.5">Flujo del dato</p>
              <div className="flex items-start">
                {[
                  { n: 1, label: 'Ingreso', color: 'bg-orange-500', active: false },
                  { n: 2, label: 'Envío\nMuestras', color: 'bg-teal-500', active: false },
                  { n: 3, label: 'Acopios', color: 'bg-emerald-600', active: true },
                  { n: 4, label: 'Mezclas', color: 'bg-purple-600', active: false },
                  { n: 5, label: 'Despacho', color: 'bg-indigo-600', active: false },
                ].flatMap((p, i, arr) => [
                  <div key={`s${i}`} className={`flex flex-col items-center ${!p.active ? 'opacity-35' : ''}`} style={{minWidth:'44px'}}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${p.active ? p.color : 'bg-gray-300'}`}>{p.n}</div>
                    <span className={`mt-1 text-[9px] font-semibold text-center leading-tight whitespace-pre-line ${p.active ? 'text-gray-700' : 'text-gray-400'}`}>{p.label}</span>
                  </div>,
                  ...(i < arr.length - 1 ? [<div key={`l${i}`} className="flex-1 h-px bg-gray-200 mt-3.5 mx-0.5 min-w-[8px]" />] : [])
                ])}
              </div>
            </div>

            {/* ── Específico: Acopios ── */}
            <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2.5">¿Cómo funciona el módulo de Acopios?</p>
            <div className="space-y-2">
              <div className="bg-white border border-emerald-200 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-emerald-700">Qué es un acopio</p>
                <p className="text-xs text-gray-500 mt-0.5">Un acopio agrupa físicamente dumpadas en el terreno antes de ser mezcladas. Permite consolidar material de distintas jornadas o frentes en un solo volumen para su posterior procesamiento.</p>
              </div>
              <div className="bg-white border border-emerald-200 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-emerald-700">Estados: Activo y Cerrado</p>
                <p className="text-xs text-gray-500 mt-0.5">Un acopio <strong className="text-emerald-600">Activo</strong> puede seguir recibiendo dumpadas. Al <strong>cerrar</strong> el acopio, queda disponible para ser incluido en una mezcla. Solo acopios cerrados pueden mezclarse.</p>
              </div>
              <div className="bg-white border border-emerald-200 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-emerald-700">Ajuste de toneladas reales</p>
                <p className="text-xs text-gray-500 mt-0.5">Al cerrar un acopio se puede registrar el peso real medido en terreno. Si difiere del tonelaje estimado (suma de dumpadas), el sistema aplica el <strong>factor de ajuste de ley</strong> para recalcular la ley del acopio. Este factor es configurable — contactar al administrador del sistema.</p>
              </div>
              <div className="bg-white border border-emerald-200 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-emerald-700">Activación del sistema</p>
                <p className="text-xs text-gray-500 mt-0.5">El sistema de acopios se activa o desactiva por faena. Cuando está activo, las mezclas se construyen desde acopios en lugar de dumpadas individuales. Para cambiar esta configuración, contactar al administrador del sistema.</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs de navegación */}
        <div className="flex gap-2 mb-6 border-b-2 border-gray-200">
          <button
            onClick={() => setTabActivo('activos')}
            className={`px-6 py-3 font-semibold text-sm transition-all relative ${
              tabActivo === 'activos'
                ? 'text-purple-600 border-b-2 border-purple-600 -mb-0.5'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <HiCube className="w-5 h-5" />
              Acopios Activos
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                tabActivo === 'activos' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-700'
              }`}>
                {contadores.activos}
              </span>
            </div>
          </button>

          <button
            onClick={() => setTabActivo('historial')}
            className={`px-6 py-3 font-semibold text-sm transition-all relative ${
              tabActivo === 'historial'
                ? 'text-indigo-600 border-b-2 border-indigo-600 -mb-0.5'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <HiArchiveBox className="w-5 h-5" />
              Historial (En Mezcla)
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                tabActivo === 'historial' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-700'
              }`}>
                {contadores.historial}
              </span>
            </div>
          </button>

          <button
            onClick={() => setTabActivo('todos')}
            className={`px-6 py-3 font-semibold text-sm transition-all relative ${
              tabActivo === 'todos'
                ? 'text-blue-600 border-b-2 border-blue-600 -mb-0.5'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <HiAdjustmentsHorizontal className="w-5 h-5" />
              Todos
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                tabActivo === 'todos' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'
              }`}>
                {contadores.todos}
              </span>
            </div>
          </button>
        </div>

        {/* Barra de filtros y búsqueda */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 mb-6 border border-purple-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Búsqueda */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <HiMagnifyingGlass className="inline w-4 h-4 mr-1" />
                Buscar
              </label>
              <input
                type="text"
                placeholder="Código, nombre, frente, jornada..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Filtro por Estado */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Estado
              </label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Todos los estados</option>
                <option value="ABIERTO">Abierto</option>
                <option value="CERRADO">Cerrado</option>
                <option value="EN_MEZCLA">En Mezcla</option>
              </select>
            </div>

            {/* Filtro por Tipo */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tipo
              </label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Todos los tipos</option>
                <option value="AUTOMATICO">Automático</option>
                <option value="MANUAL">Manual</option>
              </select>
            </div>
          </div>

          {/* Ordenamiento */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-700">Ordenar por:</label>
              <select
                value={ordenamiento}
                onChange={(e) => setOrdenamiento(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              >
                <option value="reciente">Más reciente</option>
                <option value="antiguo">Más antiguo</option>
                <option value="alfabetico">Código (A-Z)</option>
              </select>
            </div>

            {/* Limpiar filtros */}
            {(busqueda || filtroEstado || filtroTipo) && (
              <button
                onClick={() => {
                  setBusqueda('');
                  setFiltroEstado('');
                  setFiltroTipo('');
                }}
                className="px-4 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Contador de resultados */}
        <div className="mb-4 text-sm text-gray-600">
          Mostrando <span className="font-bold text-purple-600">{acopiosPaginados.length}</span> de{' '}
          <span className="font-bold text-purple-600">{totalAcopios}</span> acopio(s)
          {totalAcopios > 0 && ` (Página ${currentPage} de ${totalPages})`}
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-green-700 mb-1">Acopios Abiertos</p>
            <p className="text-2xl font-bold text-green-900">
              {acopios.filter(a => a.estado === 'ABIERTO').length}
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-700 mb-1">Acopios Cerrados</p>
            <p className="text-2xl font-bold text-blue-900">
              {acopios.filter(a => a.estado === 'CERRADO').length}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm text-purple-700 mb-1">En Mezcla</p>
            <p className="text-2xl font-bold text-purple-900">
              {acopios.filter(a => a.estado === 'EN_MEZCLA').length}
            </p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <p className="text-sm text-orange-700 mb-1">Dumpadas sin Acopio</p>
            <p className="text-2xl font-bold text-orange-900">
              {dumpadasSinAcopio.length}
            </p>
          </div>
        </div>

        {/* Lista de acopios */}
        {acopiosPaginados.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <HiCube className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium mb-2">
              {acopios.length === 0
                ? 'No hay acopios registrados'
                : 'No se encontraron acopios con los filtros aplicados'}
            </p>
            <p className="text-sm text-gray-500">
              {acopios.length === 0
                ? 'Los acopios se crean automáticamente al ingresar dumpadas'
                : 'Intenta ajustar los filtros de búsqueda'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {acopiosPaginados.map((acopio) => (
              <div
                key={acopio.id}
                className="bg-gradient-to-br from-white via-purple-50/30 to-blue-50/30 border-2 border-purple-200 rounded-2xl overflow-hidden hover:shadow-2xl hover:border-purple-400 transition-all duration-300"
              >
                {/* Header de la tarjeta */}
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                        <HiCube className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-white tracking-wide">
                          {acopio.codigo_acopio}
                        </h4>
                        {acopio.nombre && (
                          <p className="text-sm text-purple-100 mt-0.5">{acopio.nombre}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${getTipoColor(acopio.tipo)}`}>
                        {acopio.tipo}
                      </span>
                      <span className={`${getEstadoColor(acopio.estado)} text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg`}>
                        {acopio.estado}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cuerpo de la tarjeta */}
                <div className="p-6">
                  {/* Métricas principales */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {/* Dumpadas */}
                    <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl p-4 border-2 border-purple-300 shadow-md hover:shadow-lg transition-shadow">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-600 p-3 rounded-lg shadow-md">
                          <HiTruck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-purple-700 font-semibold uppercase tracking-wide">Dumpadas</p>
                          <p className="text-3xl font-bold text-purple-900">
                            {acopio.cantidad_dumpadas || 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Toneladas */}
                    <div className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl p-4 border-2 border-orange-300 shadow-md hover:shadow-lg transition-shadow">
                      <div className="flex items-center gap-3">
                        <div className="bg-orange-600 p-3 rounded-lg shadow-md">
                          <HiChartBar className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-orange-700 font-semibold uppercase tracking-wide">Toneladas</p>
                          <p className="text-3xl font-bold text-orange-900">
                            {acopio.total_toneladas ? parseFloat(acopio.total_toneladas).toFixed(2) : '0.00'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Ley Promedio */}
                    <div className={`bg-gradient-to-br ${
                      acopio.ley_promedio > 0 ? 'from-green-100 to-green-200 border-green-300' : 'from-gray-100 to-gray-200 border-gray-300'
                    } rounded-xl p-4 border-2 shadow-md hover:shadow-lg transition-shadow`}>
                      <div className="flex items-center gap-3">
                        <div className={`${acopio.ley_promedio > 0 ? 'bg-green-600' : 'bg-gray-500'} p-3 rounded-lg shadow-md`}>
                          <HiBeaker className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className={`text-xs ${acopio.ley_promedio > 0 ? 'text-green-700' : 'text-gray-600'} font-semibold uppercase tracking-wide`}>
                            Ley Prom.
                          </p>
                          <p className={`text-3xl font-bold ${acopio.ley_promedio > 0 ? 'text-green-900' : 'text-gray-700'}`}>
                            {acopio.ley_promedio ? parseFloat(acopio.ley_promedio).toFixed(2) : '0.00'}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Información adicional */}
                  <div className="bg-white rounded-xl p-4 border border-gray-200 mb-4 shadow-sm">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Frente de Trabajo */}
                      {acopio.frente_trabajo && (
                        <div className="flex items-center gap-2">
                          <div className="bg-blue-100 p-2 rounded-lg">
                            <HiCube className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 font-medium">Frente</p>
                            <p className="text-sm font-bold text-blue-900">
                              {acopio.frente_trabajo.codigo_completo}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Jornada */}
                      {acopio.jornada && (
                        <div className="flex items-center gap-2">
                          <div className="bg-indigo-100 p-2 rounded-lg">
                            <HiClock className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 font-medium">Jornada</p>
                            <p className="text-sm font-bold text-indigo-900">{acopio.jornada}</p>
                          </div>
                        </div>
                      )}

                      {/* Fecha */}
                      {acopio.fecha && (
                        <div className="flex items-center gap-2">
                          <div className="bg-pink-100 p-2 rounded-lg">
                            <HiCalendar className="w-4 h-4 text-pink-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 font-medium">Fecha</p>
                            <p className="text-sm font-bold text-pink-900">
                              {formatearFecha(acopio.fecha)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Creado */}
                      {acopio.created_at && (
                        <div className="flex items-center gap-2">
                          <div className="bg-teal-100 p-2 rounded-lg">
                            <HiClock className="w-4 h-4 text-teal-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 font-medium">Creado</p>
                            <p className="text-sm font-bold text-teal-900">
                              {new Date(acopio.created_at).toLocaleDateString('es-CL')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Observaciones si es manual */}
                    {acopio.observaciones && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 font-medium mb-1">Observaciones:</p>
                        <p className="text-sm text-gray-700 italic">{acopio.observaciones}</p>
                      </div>
                    )}
                  </div>

                  {/* Indicadores de estado */}
                  <div className="flex gap-2 mb-4">
                    {acopio.estado === 'CERRADO' && acopio.ley_promedio > 0 && (
                      <div className="flex items-center gap-2 bg-green-100 border border-green-300 px-3 py-2 rounded-lg">
                        <HiCheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-xs font-semibold text-green-700">
                          Disponible para mezclas
                        </span>
                      </div>
                    )}
                    {acopio.estado === 'ABIERTO' && (
                      <div className="flex items-center gap-2 bg-yellow-100 border border-yellow-300 px-3 py-2 rounded-lg">
                        <HiLockOpen className="w-5 h-5 text-yellow-600" />
                        <span className="text-xs font-semibold text-yellow-700">
                          Acopio abierto - Se pueden agregar dumpadas
                        </span>
                      </div>
                    )}
                    {acopio.estado === 'EN_MEZCLA' && (
                      <div className="flex items-center gap-2 bg-purple-100 border border-purple-300 px-3 py-2 rounded-lg">
                        <HiBeaker className="w-5 h-5 text-purple-600" />
                        <span className="text-xs font-semibold text-purple-700">
                          En uso en una mezcla
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Footer con acciones */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={HiEye}
                      onClick={() => handleVerDetalle(acopio)}
                    >
                      Ver Detalle
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      icon={HiPencil}
                      onClick={() => handleEditarAcopio(acopio)}
                    >
                      Editar
                    </Button>

                    {acopio.estado === 'ABIERTO' && acopio.tipo === 'AUTOMATICO' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={HiLockClosed}
                        onClick={() => handleCerrarAcopio(acopio)}
                      >
                        Cerrar Acopio
                      </Button>
                    )}

                    {acopio.estado === 'CERRADO' && acopio.tipo === 'AUTOMATICO' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={HiLockOpen}
                        onClick={() => handleReabrirAcopio(acopio)}
                      >
                        Reabrir
                      </Button>
                    )}

                    {acopio.estado !== 'EN_MEZCLA' && (
                      <Button
                        variant="danger"
                        size="sm"
                        icon={HiTrash}
                        onClick={() => setConfirmModal({ show: true, action: 'eliminar', acopio })}
                      >
                        Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              ))}
            </div>

            {/* Componente de Paginación */}
            {totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalRecords={totalAcopios}
                  perPage={perPage}
                  onPageChange={(page) => setCurrentPage(page)}
                  showInfo={true}
                  showFirstLast={true}
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
