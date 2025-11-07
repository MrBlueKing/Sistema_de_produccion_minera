import { useState, useEffect, useRef } from 'react';
import { HiHome, HiPencil, HiTrash, HiInformationCircle, HiCheckCircle, HiXCircle, HiEye, HiDocumentPlus, HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import Header from '../../../shared/components/organisms/Header';
import Button from '../../../shared/components/atoms/Button';
import Input from '../../../shared/components/atoms/Input';
import Card from '../../../shared/components/atoms/Card';
import Badge from '../../../shared/components/atoms/Badge';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import dispatchService from '../services/dispatch';
import ingenieriaService from '../../ingenieria/services/ingenieria';

export default function Dispatch() {
  const navigate = useNavigate();
  const [dumpadas, setDumpadas] = useState([]);
  const [frentes, setFrentes] = useState([]);
  const [rangos, setRangos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const perPage = 15;

  // Vista actual: 'ingreso' o 'historial'
  const [vistaActual, setVistaActual] = useState('ingreso');

  const frenteRef = useRef(null);

  const jornadas = ['AM', 'PM', 'Madrugada', 'Noche'];
  const TONELADAS_CONSTANTE = 4.6;

  // Ingreso masivo: array de formularios
  const [formsIngresoMasivo, setFormsIngresoMasivo] = useState([
    {
      id: 1,
      id_frente_trabajo: '',
      jornada: '',
      ley_visual: '',
    }
  ]);

  // Formulario de completado (para agregar ley, cup, certificado)
  const [formDataCompletado, setFormDataCompletado] = useState({
    ley: '',
    ley_cup: '',
    certificado: '',
  });

  useEffect(() => {
    loadData();
    loadMaestros();
  }, []);

  useEffect(() => {
    if (vistaActual === 'historial') {
      loadData();
    }
  }, [currentPage, vistaActual]);

  const loadMaestros = async () => {
    try {
      const [frentesRes, rangosRes] = await Promise.all([
        ingenieriaService.getFrentesTrabajo(),
        dispatchService.getRangos(),
      ]);

      setFrentes(frentesRes.data || []);
      setRangos(rangosRes.data || []);
    } catch (error) {
      console.error('❌ Error cargando maestros:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = vistaActual === 'historial' ? { page: currentPage, per_page: perPage } : {};
      const dumpadasRes = await dispatchService.getDumpadas(params);

      setDumpadas(dumpadasRes.data || []);

      if (dumpadasRes.pagination) {
        setTotalPages(dumpadasRes.pagination.last_page);
        setTotalRecords(dumpadasRes.pagination.total);
      }

    } catch (error) {
      console.error('❌ Error cargando datos:', error);
      setError(
        error.response?.data?.message ||
        error.message ||
        'Error al cargar datos'
      );
    } finally {
      setLoading(false);
    }
  };

  const resetFormIngreso = () => {
    setFormsIngresoMasivo([
      {
        id: 1,
        id_frente_trabajo: '',
        jornada: '',
        ley_visual: '',
      }
    ]);
    setTimeout(() => frenteRef.current?.focus(), 100);
  };

  const agregarFilaIngreso = () => {
    const newId = Math.max(...formsIngresoMasivo.map(f => f.id)) + 1;
    setFormsIngresoMasivo([...formsIngresoMasivo, {
      id: newId,
      id_frente_trabajo: '',
      jornada: '',
      ley_visual: '',
    }]);
  };

  const eliminarFilaIngreso = (id) => {
    if (formsIngresoMasivo.length > 1) {
      setFormsIngresoMasivo(formsIngresoMasivo.filter(f => f.id !== id));
    }
  };

  const actualizarFilaIngreso = (id, field, value) => {
    setFormsIngresoMasivo(formsIngresoMasivo.map(f =>
      f.id === id ? { ...f, [field]: value } : f
    ));
  };

  const resetFormCompletado = () => {
    setFormDataCompletado({
      ley: '',
      ley_cup: '',
      certificado: '',
    });
    setEditingId(null);
  };

  // Ingreso masivo - Guardar todas las filas
  const handleSubmitIngresoMasivo = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Validar que todas las filas estén completas
    const filasValidas = formsIngresoMasivo.filter(f =>
      f.id_frente_trabajo && f.jornada && f.ley_visual
    );

    if (filasValidas.length === 0) {
      setError('Debes completar al menos una fila para guardar');
      setLoading(false);
      return;
    }

    try {
      // Enviar todas las dumpadas en paralelo
      const promises = filasValidas.map(form =>
        dispatchService.createDumpada({
          id_frente_trabajo: form.id_frente_trabajo,
          jornada: form.jornada,
          ley_visual: form.ley_visual,
          ton: TONELADAS_CONSTANTE
        })
      );

      await Promise.all(promises);

      setSuccess(`${filasValidas.length} dumpada(s) ingresadas exitosamente - En espera de análisis de laboratorio`);

      resetFormIngreso();
      await loadData();

      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('❌ Error guardando dumpadas:', error);

      const errorMsg = error.response?.data?.message ||
        JSON.stringify(error.response?.data?.errors) ||
        error.message ||
        'Error al guardar dumpadas';

      setError(errorMsg);
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  // Completar dumpada - Agregar ley, cup, certificado
  const handleSubmitCompletado = async (e) => {
    e.preventDefault();
    if (!editingId) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const dumpada = dumpadas.find(d => d.id === editingId);
      const dataToSend = {
        ...formDataCompletado,
        id_frente_trabajo: dumpada.id_frente_trabajo,
        jornada: dumpada.jornada,
        ley_visual: dumpada.ley_visual,
        ton: TONELADAS_CONSTANTE
      };

      await dispatchService.updateDumpada(editingId, dataToSend);
      setSuccess('Dumpada completada exitosamente');

      resetFormCompletado();
      await loadData();

      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('❌ Error completando dumpada:', error);
      const errorMsg = error.response?.data?.message || 'Error al completar dumpada';
      setError(errorMsg);
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleCompletar = (dumpada) => {
    setFormDataCompletado({
      ley: dumpada.ley || '',
      ley_cup: dumpada.ley_cup || '',
      certificado: dumpada.certificado || '',
    });
    setEditingId(dumpada.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta dumpada?')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await dispatchService.deleteDumpada(id);
      setSuccess('Dumpada eliminada exitosamente');
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('❌ Error eliminando dumpada:', error);
      setError(error.response?.data?.message || 'Error al eliminar dumpada');
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    window.location.href = 'http://localhost:5173';
  };

  const getEstadoColor = (estado) => {
    const colors = {
      'Ingresado': 'bg-yellow-500',
      'En Análisis': 'bg-blue-500',
      'Completado': 'bg-green-600'
    };
    return colors[estado] || 'bg-gray-500';
  };

  const getRangoColor = (rango) => {
    const colors = {
      'L': 'bg-purple-600',
      'K': 'bg-indigo-600',
      'J': 'bg-blue-600',
      'I': 'bg-cyan-600',
      'H': 'bg-teal-600',
      'G': 'bg-green-600',
      'F': 'bg-lime-600',
      'E': 'bg-yellow-600',
      'D': 'bg-orange-600',
      'C': 'bg-red-600',
      'B': 'bg-pink-600',
      'A': 'bg-rose-600',
      'Reserva': 'bg-gray-600',
      'Descarte': 'bg-slate-800'
    };
    return colors[rango] || 'bg-gray-600';
  };

  if (loading && dumpadas.length === 0 && frentes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Breadcrumb
            items={[
              {
                label: 'Dashboard Central',
                href: 'http://localhost:5173',
                onClick: (e) => {
                  e.preventDefault();
                  handleGoBack();
                },
                icon: HiHome
              },
              {
                label: 'Dispatch - Dumpadas'
              }
            ]}
          />
        </div>

        {/* Mensajes */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start gap-3 shadow-sm">
            <HiXCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-800">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-500 rounded-lg p-4 flex items-start gap-3 shadow-sm">
            <HiCheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-green-800">{success}</p>
            </div>
            <button
              onClick={() => setSuccess(null)}
              className="text-green-500 hover:text-green-700 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header con Switch de Vista */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                Gestión de Dumpadas
              </h2>
              <p className="text-gray-600 mt-1">
                {vistaActual === 'ingreso' ? 'Modo: Ingreso de nuevas dumpadas' : `Modo: Historial (${totalRecords} registros)`}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowInfo(!showInfo)}
                icon={HiInformationCircle}
              >
                {showInfo ? 'Ocultar' : 'Ayuda'}
              </Button>
            </div>
          </div>

          {/* Tabs Mejorados */}
          <div className="mt-6 border-b-2 border-gray-200">
            <div className="flex gap-1 -mb-0.5">
              <button
                onClick={() => {
                  setVistaActual('ingreso');
                  resetFormCompletado();
                }}
                className={`relative flex items-center gap-2 px-6 py-3 font-semibold transition-all rounded-t-lg ${vistaActual === 'ingreso'
                  ? 'bg-blue-600 text-white shadow-lg transform translate-y-0.5'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <HiDocumentPlus className="w-5 h-5" />
                <span>Ingreso de Dumpadas</span>
                {vistaActual === 'ingreso' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></span>
                )}
              </button>
              <button
                onClick={() => {
                  setVistaActual('historial');
                  setCurrentPage(1);
                }}
                className={`relative flex items-center gap-2 px-6 py-3 font-semibold transition-all rounded-t-lg ${vistaActual === 'historial'
                  ? 'bg-blue-600 text-white shadow-lg transform translate-y-0.5'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <HiEye className="w-5 h-5" />
                <span>Historial</span>
                {totalRecords > 0 && (
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${vistaActual === 'historial'
                    ? 'bg-white text-blue-600'
                    : 'bg-blue-100 text-blue-700'
                    }`}>
                    {totalRecords}
                  </span>
                )}
                {vistaActual === 'historial' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Panel de Información */}
        {showInfo && (
          <Card className="mb-6 border-l-4 border-blue-400 bg-blue-50">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <HiInformationCircle className="w-7 h-7 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-blue-900 mb-4">Información del Sistema</h3>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-blue-800 mb-2">📝 Ingreso Inicial</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Registre: Punto, Jornada y Ley Visual</li>
                      <li>• Queda en estado: <strong>Ingresado</strong></li>
                      <li>• Espera resultados de laboratorio</li>
                    </ul>
                  </div>

                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-blue-800 mb-2">🔬 Completar Análisis</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• En Historial, click en "Completar"</li>
                      <li>• Agregue: Ley, Ley Cup y Certificado</li>
                      <li>• Estado final: <strong>Completado</strong></li>
                    </ul>
                  </div>

                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-blue-800 mb-2">✨ Automático</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• <strong>Fecha:</strong> Actual del sistema</li>
                      <li>• <strong>Toneladas:</strong> {TONELADAS_CONSTANTE} Ton</li>
                      <li>• <strong>N° Acopio:</strong> Auto-incremental</li>
                      <li>• <strong>Rango:</strong> Según ley ingresada</li>
                    </ul>
                  </div>

                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-blue-800 mb-2">🎯 Estados</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold">Ingresado</span>
                        <span className="text-xs">Sin análisis</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold">En Análisis</span>
                        <span className="text-xs">Parcialmente completado</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold">Completado</span>
                        <span className="text-xs">Con todos los datos</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Vista de Ingreso */}
        {vistaActual === 'ingreso' && (
          <>
            {/* Formulario de completado (si hay uno seleccionado) */}
            {editingId && (
              <Card className="mb-6 border-l-4 border-green-400">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900">
                    🔬 Completar Análisis de Laboratorio
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Agregue los resultados del laboratorio para completar el registro
                  </p>
                </div>

                <form onSubmit={handleSubmitCompletado} className="space-y-6">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-4">Resultados de Laboratorio</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input
                        label="Ley (%)"
                        type="number"
                        step="0.001"
                        value={formDataCompletado.ley}
                        onChange={(e) => setFormDataCompletado({ ...formDataCompletado, ley: e.target.value })}
                        placeholder="Ej: 2.500"
                        required
                      />

                      <Input
                        label="Ley Cup - Cobre (%)"
                        type="number"
                        step="0.001"
                        value={formDataCompletado.ley_cup}
                        onChange={(e) => setFormDataCompletado({ ...formDataCompletado, ley_cup: e.target.value })}
                        placeholder="Ej: 0.850"
                        required
                      />

                      <Input
                        label="Certificado"
                        type="text"
                        value={formDataCompletado.certificado}
                        onChange={(e) => setFormDataCompletado({ ...formDataCompletado, certificado: e.target.value })}
                        placeholder="N° de certificado"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      variant="success"
                      disabled={loading}
                    >
                      {loading ? 'Guardando...' : 'Completar Dumpada'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={resetFormCompletado}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {/* Formulario de ingreso masivo */}
            {!editingId && (
              <Card className="mb-6 border-l-4 border-blue-400">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      📝 Ingreso Masivo de Dumpadas
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Registre múltiples dumpadas a la vez • Agregue o elimine filas según necesite
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={agregarFilaIngreso}
                      icon={HiDocumentPlus}
                    >
                      Agregar Fila
                    </Button>
                  </div>
                </div>

                <form onSubmit={handleSubmitIngresoMasivo} className="space-y-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b-2 border-blue-300">
                            <th className="text-left py-2 px-2 font-bold text-blue-900 text-sm">#</th>
                            <th className="text-left py-2 px-2 font-bold text-blue-900 text-sm">Frente <span className="text-red-500">*</span></th>
                            <th className="text-left py-2 px-2 font-bold text-blue-900 text-sm">Jornada <span className="text-red-500">*</span></th>
                            <th className="text-left py-2 px-2 font-bold text-blue-900 text-sm">Ley Visual (%)</th>
                            <th className="text-center py-2 px-2 font-bold text-blue-900 text-sm">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formsIngresoMasivo.map((form, index) => (
                            <tr key={form.id} className="border-b border-blue-200 hover:bg-blue-100 transition-colors">
                              <td className="py-2 px-2">
                                <span className="font-mono text-sm font-bold text-gray-700">{index + 1}</span>
                              </td>
                              <td className="py-2 px-2">
                                <select
                                  ref={index === 0 ? frenteRef : null}
                                  value={form.id_frente_trabajo}
                                  onChange={(e) => actualizarFilaIngreso(form.id, 'id_frente_trabajo', e.target.value)}
                                  required
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                >
                                  <option value="">Seleccione...</option>
                                  {frentes.map((frente) => (
                                    <option key={frente.id} value={frente.id}>
                                      {frente.codigo_completo}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-2">
                                <select
                                  value={form.jornada}
                                  onChange={(e) => actualizarFilaIngreso(form.id, 'jornada', e.target.value)}
                                  required
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                >
                                  <option value="">Seleccione...</option>
                                  {jornadas.map((jornada) => (
                                    <option key={jornada} value={jornada}>
                                      {jornada}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.001"
                                  value={form.ley_visual}
                                  onChange={(e) => actualizarFilaIngreso(form.id, 'ley_visual', e.target.value)}
                                  placeholder="2.300"
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                {formsIngresoMasivo.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => eliminarFilaIngreso(form.id)}
                                    className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                                    title="Eliminar fila"
                                  >
                                    <HiTrash className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-3 p-3 bg-blue-200 rounded-lg">
                      <p className="text-xs text-blue-900">
                        <strong>ℹ️ Información:</strong> Fecha actual, {TONELADAS_CONSTANTE} Ton constante, N° Acopio automático.
                        Las filas completas se guardarán en estado "Ingresado" hasta agregar los resultados del laboratorio.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      variant="success"
                      disabled={loading}
                    >
                      {loading ? 'Guardando...' : `Registrar ${formsIngresoMasivo.filter(f => f.id_frente_trabajo && f.jornada).length} Dumpada(s)`}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={resetFormIngreso}
                    >
                      Limpiar Todo
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {/* Últimos registros ingresados */}
            <Card className="border-l-4 border-yellow-400">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900">Últimos Registros Ingresados</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Registros recientes en espera de análisis de laboratorio
                </p>
              </div>

              {dumpadas.filter(d => d.estado === 'Ingresado').length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">No hay registros en espera</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-yellow-100">
                        <th className="text-left py-3 px-4 font-bold text-yellow-900">Frente</th>
                        <th className="text-left py-3 px-4 font-bold text-yellow-900">N° Acop</th>
                        <th className="text-left py-3 px-4 font-bold text-yellow-900">Acopios</th>
                        <th className="text-left py-3 px-4 font-bold text-yellow-900">Jornada</th>
                        <th className="text-left py-3 px-4 font-bold text-yellow-900">Fecha</th>
                        <th className="text-left py-3 px-4 font-bold text-yellow-900">Ley Visual</th>
                        <th className="text-left py-3 px-4 font-bold text-yellow-900">Estado</th>
                        <th className="text-left py-3 px-4 font-bold text-yellow-900">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dumpadas.filter(d => d.estado === 'Ingresado').slice(0, 10).map((dumpada, index) => (
                        <tr
                          key={dumpada.id}
                          className={`border-b border-gray-200 hover:bg-yellow-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                            }`}
                        >
                          <td className="py-3 px-4">
                            <span className="font-bold text-blue-900 bg-blue-100 px-2 py-1 rounded text-sm">
                              {dumpada.frente_trabajo?.codigo_completo || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-gray-800">
                              {dumpada.n_acop ? String(dumpada.n_acop).padStart(3, '0') : '-'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-sm text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                              {dumpada.acopios || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
                              {dumpada.jornada}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-800">
                            {dumpada.fecha ? new Date(dumpada.fecha).toLocaleDateString('es-CL') : '-'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            {dumpada.ley_visual ? `${parseFloat(dumpada.ley_visual).toFixed(3)}%` : '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`${getEstadoColor(dumpada.estado)} text-white px-3 py-1 rounded-full text-xs font-bold`}>
                              {dumpada.estado}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleCompletar(dumpada)}
                            >
                              Completar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}

        {/* Vista de Historial */}
        {vistaActual === 'historial' && (
          <Card className="border-l-4 border-blue-400">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Historial de Dumpadas</h3>
              <p className="text-sm text-gray-600 mt-1">
                Página {currentPage} de {totalPages} • Total: {totalRecords} registros
              </p>
            </div>

            {loading && dumpadas.length === 0 ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 font-medium">Cargando historial...</p>
              </div>
            ) : dumpadas.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-700 font-medium mb-2">No hay registros</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100">
                        <th className="text-left py-4 px-4 font-bold text-blue-900">Frente</th>
                        <th className="text-left py-4 px-4 font-bold text-blue-900">N° Acop</th>
                        <th className="text-left py-4 px-4 font-bold text-blue-900">Acopios</th>
                        <th className="text-left py-4 px-4 font-bold text-blue-900">Fecha</th>
                        <th className="text-left py-4 px-4 font-bold text-blue-900">Jornada</th>
                        <th className="text-left py-4 px-4 font-bold text-blue-900">Ley</th>
                        <th className="text-left py-4 px-4 font-bold text-blue-900">Ley Cup</th>
                        <th className="text-left py-4 px-4 font-bold text-blue-900">Rango</th>
                        <th className="text-left py-4 px-4 font-bold text-blue-900">Estado</th>
                        <th className="text-left py-4 px-4 font-bold text-blue-900">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dumpadas.map((dumpada, index) => (
                        <tr
                          key={dumpada.id}
                          className={`border-b border-gray-200 hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                            }`}
                        >
                           <td className="py-4 px-4">
                            <span className="font-bold text-blue-900 bg-gradient-to-r from-blue-100 to-blue-200 px-3 py-1 rounded-lg shadow-sm border border-blue-300 inline-block">
                              {dumpada.frente_trabajo?.codigo_completo || '-'}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="font-mono font-bold text-gray-800">
                              {dumpada.n_acop ? String(dumpada.n_acop).padStart(3, '0') : '-'}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="font-mono text-sm text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200 font-semibold">
                              {dumpada.acopios || '-'}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-semibold text-gray-800">
                            {dumpada.fecha ? new Date(dumpada.fecha).toLocaleDateString('es-CL') : '-'}
                          </td>
                          <td className="py-4 px-4">
                            {dumpada.jornada ? (
                              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-sm">
                                {dumpada.jornada}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-4 px-4 text-gray-700">
                            {dumpada.ley ? `${parseFloat(dumpada.ley).toFixed(3)}%` : '-'}
                          </td>
                          <td className="py-4 px-4 text-gray-700">
                            {dumpada.ley_cup ? `${parseFloat(dumpada.ley_cup).toFixed(3)}%` : '-'}
                          </td>
                          <td className="py-4 px-4">
                            {dumpada.rango ? (
                              <span className={`${getRangoColor(dumpada.rango)} text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm`}>
                                {dumpada.rango}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`${getEstadoColor(dumpada.estado)} text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm`}>
                              {dumpada.estado}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex gap-2">
                              {dumpada.estado !== 'Completado' && (
                                <button
                                  onClick={() => {
                                    setVistaActual('ingreso');
                                    handleCompletar(dumpada);
                                  }}
                                  className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-xs"
                                  title="Completar"
                                >
                                  Completar
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(dumpada.id)}
                                className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                                title="Eliminar"
                              >
                                <HiTrash className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Mostrando {(currentPage - 1) * perPage + 1} - {Math.min(currentPage * perPage, totalRecords)} de {totalRecords}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <HiChevronLeft className="w-5 h-5" />
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      Siguiente
                      <HiChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
