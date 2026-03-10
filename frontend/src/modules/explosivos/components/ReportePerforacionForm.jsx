import { useState, useEffect, useCallback } from 'react';
import {
  HiArrowLeft,
  HiPlus,
  HiTrash,
  HiCheckCircle,
  HiExclamationTriangle,
  HiPencil,
  HiChevronDown,
  HiChevronUp,
  HiDocumentText,
  HiXCircle,
  HiClock,
  HiDocumentArrowDown,
  HiPrinter,
} from 'react-icons/hi2';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import SearchableSelect from '../../../shared/components/atoms/SearchableSelect';
import ConfirmDialog from '../../../shared/components/molecules/ConfirmDialog';
import HistorialCambios from '../../../shared/components/organisms/HistorialCambios';
import explosivosService from '../services/explosivos';
import ingenieriaService from '../../ingenieria/services/ingenieria';
import useToast from '../../../hooks/useToast';

const BARRAS_OPCIONES = [0.8, 1.2, 1.4, 1.8, 2.4, 3.2];
const MATERIALES = [
  { value: 'oxido', label: 'Oxido' },
  { value: 'sulfuro', label: 'Sulfuro' },
  { value: 'esteril', label: 'Esteril' },
];

export default function ReportePerforacionForm({ reporte, modoCrear, polvorin, polvorines = [], tipos, faenaActual, onVolver, onRefresh }) {
  const toast = useToast();

  // Polvorín seleccionado (para admin con selector)
  const [polvorinSeleccionado, setPolvorinSeleccionado] = useState(polvorin);

  // Cabecera
  const [cabecera, setCabecera] = useState({
    fecha: new Date().toISOString().split('T')[0],
    turno: 'AM',
    observaciones: '',
  });
  const [reporteId, setReporteId] = useState(null);
  const [estado, setEstado] = useState('borrador');
  const [codigo, setCodigo] = useState('');

  // Lineas
  const [lineas, setLineas] = useState([]);

  // Devoluciones
  const [devoluciones, setDevoluciones] = useState([]);
  const [showDevoluciones, setShowDevoluciones] = useState(false);
  const [sinDevoluciones, setSinDevoluciones] = useState(false);

  // Datos de referencia
  const [frentesTrabajo, setFrentesTrabajo] = useState([]);
  const [tiposFrente, setTiposFrente] = useState([]);
  const [personalAutorizado, setPersonalAutorizado] = useState([]);
  const [stockDisponible, setStockDisponible] = useState([]);

  // Columnas de explosivos (tipos que tienen formulas configuradas)
  const [columnasExplosivos, setColumnasExplosivos] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Confirm dialogs
  const [showConfirmConfirmar, setShowConfirmConfirmar] = useState(false);
  const [showConfirmCerrar, setShowConfirmCerrar] = useState(false);
  const [showConfirmCerrarSinDev, setShowConfirmCerrarSinDev] = useState(false);
  const [showConfirmAnular, setShowConfirmAnular] = useState(false);
  const [showConfirmSalir, setShowConfirmSalir] = useState(false);

  // Resumen post-accion
  const [showResumenMovimientos, setShowResumenMovimientos] = useState(false);
  const [resumenData, setResumenData] = useState(null);

  // Historial
  const [showHistorial, setShowHistorial] = useState(false);

  // Cambios sin guardar
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    cargarDatosReferencia();
  }, []);

  useEffect(() => {
    if (reporte) {
      setCabecera({
        fecha: reporte.fecha,
        turno: reporte.turno,
        observaciones: reporte.observaciones || '',
      });
      setReporteId(reporte.id);
      setEstado(reporte.estado);
      setCodigo(reporte.codigo);
      setLineas(reporte.lineas || []);
      setDevoluciones(reporte.devoluciones || []);
      if (reporte.polvorin) {
        setPolvorinSeleccionado(reporte.polvorin);
      }
      if (reporte.estado === 'confirmado') {
        setShowDevoluciones(true);
      }
    }
  }, [reporte]);

  // Warning cambios sin guardar
  useEffect(() => {
    const handler = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  const cargarDatosReferencia = async () => {
    setLoading(true);
    try {
      const params = { estado: 'activo', per_page: 500 };
      if (faenaActual?.id) params.id_faena = faenaActual.id;

      const [frentesRes, tiposFrenteRes, personalRes] = await Promise.all([
        ingenieriaService.getFrentesTrabajo(params),
        ingenieriaService.getTiposFrente(),
        explosivosService.getPersonalAutorizado({ activo: 'true' }),
      ]);
      setFrentesTrabajo(frentesRes.data || frentesRes);
      setTiposFrente(tiposFrenteRes.data || tiposFrenteRes);
      setPersonalAutorizado(personalRes);

      // Determinar columnas de explosivos a partir de tipos activos
      setColumnasExplosivos(tipos.filter((t) => t.activo !== false));

      // Cargar stock del polvorin
      const polv = polvorinSeleccionado || polvorin;
      if (polv?.id) {
        try {
          const stockRes = await explosivosService.getStock({ id_polvorin: polv.id });
          setStockDisponible(stockRes);
        } catch {
          // Stock no critico
        }
      }
    } catch (error) {
      console.error('Error cargando datos de referencia:', error);
      toast.error('Error', 'No se pudieron cargar los datos de referencia');
    } finally {
      setLoading(false);
    }
  };

  // Crear o actualizar cabecera
  const guardarBorrador = async () => {
    setSubmitting(true);
    try {
      if (reporteId) {
        await explosivosService.updateReporte(reporteId, cabecera);
        toast.success('Reporte actualizado', 'Los cambios fueron guardados');
      } else {
        const polv = polvorinSeleccionado || polvorin;
        if (!polv?.id) {
          toast.error('Error', 'Debe seleccionar un polvorín');
          setSubmitting(false);
          return;
        }
        const res = await explosivosService.createReporte({
          ...cabecera,
          id_polvorin: polv.id,
        });
        setReporteId(res.reporte.id);
        setCodigo(res.reporte.codigo);
        setEstado(res.reporte.estado);
        toast.success('Reporte creado', `Codigo: ${res.reporte.codigo}`);
      }
      setHasUnsavedChanges(false);
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo guardar el reporte');
    } finally {
      setSubmitting(false);
    }
  };

  // Agregar linea vacia
  const agregarLineaLocal = () => {
    setLineas((prev) => [
      ...prev,
      {
        _local: true,
        _key: Date.now(),
        id_frente_trabajo: '',
        id_personal: '',
        id_tipo_frente: '',
        seccion_ancho: '',
        seccion_alto: '',
        numero_tiros: '',
        largo_perforacion: '',
        barras_usadas: [],
        material: '',
        observaciones: '',
        explosivos: [],
        valores_editados: false,
      },
    ]);
    setHasUnsavedChanges(true);
  };

  const actualizarLineaLocal = (index, campo, valor) => {
    setLineas((prev) => {
      const nuevas = [...prev];
      nuevas[index] = { ...nuevas[index], [campo]: valor };
      return nuevas;
    });
    setHasUnsavedChanges(true);
  };

  const actualizarExplosivoLinea = (lineaIndex, idTipoExplosivo, valor) => {
    setLineas((prev) => {
      const nuevas = [...prev];
      const linea = { ...nuevas[lineaIndex] };
      const explosivos = [...(linea.explosivos || [])];

      const idx = explosivos.findIndex((e) => e.id_tipo_explosivo === idTipoExplosivo);
      if (idx >= 0) {
        explosivos[idx] = { ...explosivos[idx], cantidad_final: parseFloat(valor) || 0 };
      } else {
        explosivos.push({
          id_tipo_explosivo: idTipoExplosivo,
          cantidad_calculada: 0,
          cantidad_final: parseFloat(valor) || 0,
        });
      }

      linea.explosivos = explosivos;
      linea.valores_editados = true;
      nuevas[lineaIndex] = linea;
      return nuevas;
    });
    setHasUnsavedChanges(true);
  };

  // Calcular explosivos para una linea cuando cambian tiros o tipo frente
  const calcularExplosivosLinea = useCallback(
    async (lineaIndex) => {
      const linea = lineas[lineaIndex];
      if (!linea.numero_tiros || !linea.id_tipo_frente) return;

      try {
        const resultado = await explosivosService.calcularExplosivos({
          numero_tiros: parseInt(linea.numero_tiros),
          id_tipo_frente: linea.id_tipo_frente,
        });

        setLineas((prev) => {
          const nuevas = [...prev];
          const lineaActualizada = { ...nuevas[lineaIndex] };

          // Solo actualizar si no ha sido editado manualmente
          if (!lineaActualizada.valores_editados) {
            lineaActualizada.explosivos = resultado.map((r) => ({
              id_tipo_explosivo: r.id_tipo_explosivo,
              tipo_explosivo: r.tipo_explosivo,
              cantidad_calculada: r.cantidad_calculada,
              cantidad_final: r.cantidad_final,
            }));
          }

          nuevas[lineaIndex] = lineaActualizada;
          return nuevas;
        });
      } catch (error) {
        // Silencioso - las formulas pueden no estar configuradas
      }
    },
    [lineas]
  );

  // Guardar linea en servidor
  const guardarLinea = async (index) => {
    const linea = lineas[index];
    if (!linea.id_frente_trabajo || !linea.id_personal || !linea.numero_tiros || !linea.id_tipo_frente) {
      toast.error('Error', 'Complete los campos obligatorios: Frente, Operador, Tipo Labor y N Tiros');
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        id_frente_trabajo: linea.id_frente_trabajo,
        id_personal: linea.id_personal,
        id_tipo_frente: linea.id_tipo_frente,
        seccion_ancho: linea.seccion_ancho || null,
        seccion_alto: linea.seccion_alto || null,
        numero_tiros: parseInt(linea.numero_tiros),
        largo_perforacion: parseFloat(linea.largo_perforacion) || 0,
        barras_usadas: linea.barras_usadas || [],
        material: linea.material || null,
        observaciones: linea.observaciones || null,
        explosivos: (linea.explosivos || []).map((e) => ({
          id_tipo_explosivo: e.id_tipo_explosivo,
          cantidad_calculada: e.cantidad_calculada,
          cantidad_final: e.cantidad_final,
        })),
      };

      if (linea._local) {
        const res = await explosivosService.agregarLinea(reporteId, data);
        setLineas((prev) => {
          const nuevas = [...prev];
          nuevas[index] = res.linea;
          return nuevas;
        });
        toast.success('Linea guardada', 'La linea fue agregada al reporte');
      } else {
        const res = await explosivosService.actualizarLinea(reporteId, linea.id, data);
        setLineas((prev) => {
          const nuevas = [...prev];
          nuevas[index] = res.linea;
          return nuevas;
        });
        toast.success('Linea actualizada', 'Los cambios fueron guardados');
      }
      setHasUnsavedChanges(false);
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo guardar la linea');
    } finally {
      setSubmitting(false);
    }
  };

  const eliminarLinea = async (index) => {
    const linea = lineas[index];
    if (linea._local) {
      setLineas((prev) => prev.filter((_, i) => i !== index));
      return;
    }

    try {
      await explosivosService.eliminarLinea(reporteId, linea.id);
      setLineas((prev) => prev.filter((_, i) => i !== index));
      toast.success('Linea eliminada', 'La linea fue removida del reporte');
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo eliminar la linea');
    }
  };

  // Confirmar reporte
  const ejecutarConfirmar = async () => {
    setShowConfirmConfirmar(false);
    setSubmitting(true);
    try {
      const res = await explosivosService.confirmarReporte(reporteId, {
        confirmado_por: 'Supervisor',
      });
      setEstado('confirmado');
      toast.success('Reporte confirmado', res.mensaje);
      // Recargar reporte
      const detalle = await explosivosService.getReporte(reporteId);
      setLineas(detalle.lineas || []);
      setDevoluciones(detalle.devoluciones || []);
      setShowDevoluciones(true);

      // Mostrar resumen de movimientos
      setResumenData({
        tipo: 'confirmacion',
        movimientos: detalle.movimientos || [],
        totales: detalle.totales_explosivos || [],
      });
      setShowResumenMovimientos(true);

      onRefresh?.();
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo confirmar el reporte');
    } finally {
      setSubmitting(false);
    }
  };

  // Anular reporte
  const ejecutarAnular = async () => {
    setShowConfirmAnular(false);
    setSubmitting(true);
    try {
      const res = await explosivosService.anularReporte(reporteId);
      setEstado('borrador');
      toast.success('Reporte anulado', res.mensaje);
      const detalle = await explosivosService.getReporte(reporteId);
      setLineas(detalle.lineas || []);
      setDevoluciones(detalle.devoluciones || []);
      setShowDevoluciones(false);
      onRefresh?.();
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo anular el reporte');
    } finally {
      setSubmitting(false);
    }
  };

  // Devoluciones
  const agregarDevolucion = () => {
    setDevoluciones((prev) => [
      ...prev,
      {
        _local: true,
        _key: Date.now(),
        id_tipo_explosivo: '',
        cantidad: '',
        id_personal: '',
        motivo: '',
      },
    ]);
  };

  const prePopularDevoluciones = () => {
    const totales = calcularTotales();
    const nuevasDev = Object.entries(totales).map(([idTipo, cantidad]) => ({
      _local: true,
      _key: Date.now() + parseInt(idTipo),
      id_tipo_explosivo: parseInt(idTipo),
      cantidad: '',
      id_personal: '',
      motivo: '',
      _totalEntregado: cantidad,
    }));
    setDevoluciones((prev) => {
      const existentes = prev.filter((d) => !d._local);
      return [...existentes, ...nuevasDev];
    });
  };

  const actualizarDevolucion = (index, campo, valor) => {
    setDevoluciones((prev) => {
      const nuevas = [...prev];
      nuevas[index] = { ...nuevas[index], [campo]: valor };
      return nuevas;
    });
  };

  const eliminarDevolucionLocal = (index) => {
    setDevoluciones((prev) => prev.filter((_, i) => i !== index));
  };

  const ejecutarCerrar = async () => {
    setShowConfirmCerrar(false);
    const devLocales = devoluciones.filter((d) => d._local && d.id_tipo_explosivo && d.cantidad);
    if (devLocales.length === 0) {
      toast.error('Error', 'Agregue al menos una devolucion');
      return;
    }

    setSubmitting(true);
    try {
      const res = await explosivosService.registrarDevoluciones(
        reporteId,
        devLocales.map((d) => ({
          id_tipo_explosivo: d.id_tipo_explosivo,
          cantidad: parseFloat(d.cantidad),
          id_personal: d.id_personal || null,
          motivo: d.motivo || null,
        }))
      );
      setEstado('cerrado');
      toast.success('Reporte cerrado', res.mensaje);
      // Recargar
      const detalle = await explosivosService.getReporte(reporteId);
      setDevoluciones(detalle.devoluciones || []);

      // Mostrar resumen
      setResumenData({
        tipo: 'cierre',
        devoluciones: detalle.devoluciones || [],
        movimientos: detalle.movimientos?.filter((m) => m.tipo === 'devolucion') || [],
      });
      setShowResumenMovimientos(true);

      onRefresh?.();
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudieron registrar las devoluciones');
    } finally {
      setSubmitting(false);
    }
  };

  const ejecutarCerrarSinDevoluciones = async () => {
    setShowConfirmCerrarSinDev(false);
    setSubmitting(true);
    try {
      const res = await explosivosService.cerrarReporte(reporteId);
      setEstado('cerrado');
      toast.success('Reporte cerrado', res.mensaje);
      const detalle = await explosivosService.getReporte(reporteId);
      setDevoluciones(detalle.devoluciones || []);
      onRefresh?.();
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo cerrar el reporte');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVolver = () => {
    if (hasUnsavedChanges) {
      setShowConfirmSalir(true);
    } else {
      onVolver();
    }
  };

  // Totales
  const calcularTotales = () => {
    const totales = {};
    lineas.forEach((linea) => {
      (linea.explosivos || []).forEach((exp) => {
        const id = exp.id_tipo_explosivo;
        if (!totales[id]) totales[id] = 0;
        totales[id] += parseFloat(exp.cantidad_final) || 0;
      });
    });
    return totales;
  };

  const getExplosivoLinea = (linea, idTipoExplosivo) => {
    return (linea.explosivos || []).find((e) => e.id_tipo_explosivo === idTipoExplosivo);
  };

  const getStockParaTipo = (idTipoExplosivo) => {
    const stock = stockDisponible.find((s) => s.id_tipo_explosivo === idTipoExplosivo);
    return stock ? parseFloat(stock.cantidad_disponible || stock.cantidad || 0) : 0;
  };

  const getEstadoBadge = (est) => {
    const estilos = {
      borrador: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      confirmado: 'bg-blue-100 text-blue-700 border-blue-300',
      cerrado: 'bg-green-100 text-green-700 border-green-300',
    };
    const nombres = { borrador: 'Borrador', confirmado: 'Confirmado', cerrado: 'Cerrado' };
    return (
      <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold border ${estilos[est] || ''}`}>
        {nombres[est] || est}
      </span>
    );
  };

  // Opciones para SearchableSelect
  const frentesOptions = frentesTrabajo.map((f) => ({ value: f.id, label: f.codigo_completo }));
  const personalOptions = personalAutorizado.map((p) => ({ value: p.id, label: `${p.nombre} ${p.apellido || ''}` }));

  const esBorrador = estado === 'borrador';
  const esConfirmado = estado === 'confirmado';
  const esCerrado = estado === 'cerrado';
  const totales = calcularTotales();
  const devLocales = devoluciones.filter((d) => d._local);

  // PDF generation
  const handleExportPDF = async () => {
    try {
      const { generarReportePDF } = await import('../utils/reportePDF.js');
      const detalle = await explosivosService.getReporte(reporteId);
      generarReportePDF(detalle, polvorinSeleccionado || polvorin, columnasExplosivos);
    } catch (error) {
      toast.error('Error', 'No se pudo generar el PDF');
    }
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-200 border-t-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="outline" icon={HiArrowLeft} onClick={handleVolver}>
          Volver
        </Button>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3">
            <HiDocumentText className="w-6 h-6 text-red-600" />
            {modoCrear && !reporteId ? 'Nuevo Reporte P&T' : `Reporte ${codigo}`}
            {estado && getEstadoBadge(estado)}
          </h3>
        </div>
        {reporteId && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={HiClock} onClick={() => setShowHistorial(true)}>
              Historial
            </Button>
            <Button variant="outline" size="sm" icon={HiDocumentArrowDown} onClick={handleExportPDF}>
              PDF
            </Button>
            <Button variant="outline" size="sm" icon={HiPrinter} onClick={handlePrint}>
              Imprimir
            </Button>
          </div>
        )}
      </div>

      {/* Cabecera */}
      <Card>
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Informacion del Reporte</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
            <input
              type="date"
              value={cabecera.fecha}
              onChange={(e) => { setCabecera((prev) => ({ ...prev, fecha: e.target.value })); setHasUnsavedChanges(true); }}
              disabled={!esBorrador}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Turno *</label>
            <select
              value={cabecera.turno}
              onChange={(e) => { setCabecera((prev) => ({ ...prev, turno: e.target.value })); setHasUnsavedChanges(true); }}
              disabled={!esBorrador}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 disabled:bg-gray-100"
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
              <option value="Noche">Noche</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Polvorin *</label>
            {polvorines.length > 0 && modoCrear && !reporteId ? (
              <SearchableSelect
                options={polvorines.map((p) => ({ value: p.id, label: `${p.nombre} (${p.codigo})` }))}
                value={polvorinSeleccionado?.id || ''}
                onChange={(val) => {
                  const selected = polvorines.find((p) => p.id === val);
                  setPolvorinSeleccionado(selected || null);
                  // Recargar stock del nuevo polvorín
                  if (selected?.id) {
                    explosivosService.getStock({ id_polvorin: selected.id }).then((res) => {
                      setStockDisponible(res);
                    }).catch(() => {});
                  } else {
                    setStockDisponible([]);
                  }
                }}
                placeholder="Seleccionar polvorín..."
              />
            ) : (
              <input
                type="text"
                value={polvorinSeleccionado?.nombre || polvorin?.nombre || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
              />
            )}
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
          <textarea
            value={cabecera.observaciones}
            onChange={(e) => { setCabecera((prev) => ({ ...prev, observaciones: e.target.value })); setHasUnsavedChanges(true); }}
            disabled={!esBorrador}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 disabled:bg-gray-100"
          />
        </div>
        {esBorrador && (
          <div className="mt-4 flex justify-end">
            <Button variant="primary" onClick={guardarBorrador} disabled={submitting}>
              {submitting ? 'Guardando...' : reporteId ? 'Actualizar Cabecera' : 'Crear Reporte'}
            </Button>
          </div>
        )}
      </Card>

      {/* Tabla de Lineas */}
      {reporteId && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Lineas de Perforacion ({lineas.length})
            </h4>
            {esBorrador && (
              <Button variant="outline" icon={HiPlus} size="sm" onClick={agregarLineaLocal}>
                Agregar Linea
              </Button>
            )}
          </div>

          {lineas.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No hay lineas. Agregue la primera linea al reporte.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 bg-gradient-to-r from-red-50 to-orange-50">
                    <th className="px-2 py-2 text-left font-semibold text-gray-700 min-w-[140px]">Frente</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700 min-w-[140px]">Operador</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700 min-w-[110px]">Tipo Labor</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 min-w-[60px]">A</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 min-w-[60px]">H</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 min-w-[70px]">N Tiros</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 min-w-[70px]">Largo</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 min-w-[120px]">Barras</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 min-w-[80px]">Material</th>
                    {columnasExplosivos.map((te) => (
                      <th key={te.id} className="px-2 py-2 text-center font-semibold text-gray-700 min-w-[80px]">
                        <div>{te.codigo}</div>
                        <div className="text-[9px] text-gray-400 font-normal">{te.unidad_medida}</div>
                      </th>
                    ))}
                    {esBorrador && <th className="px-2 py-2 text-center font-semibold text-gray-700 min-w-[80px]">Acc.</th>}
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((linea, index) => {
                    const isLocal = linea._local;
                    const isEditable = esBorrador;

                    return (
                      <tr key={linea.id || linea._key} className="border-b hover:bg-red-50/30">
                        <td className="px-1 py-1">
                          {isEditable ? (
                            <SearchableSelect
                              size="sm"
                              options={frentesOptions}
                              value={linea.id_frente_trabajo ? parseInt(linea.id_frente_trabajo) : ''}
                              onChange={(val) => {
                                const frente = frentesTrabajo.find((f) => f.id === val);
                                actualizarLineaLocal(index, 'id_frente_trabajo', val);
                                if (frente?.id_tipo_frente) {
                                  actualizarLineaLocal(index, 'id_tipo_frente', frente.id_tipo_frente);
                                }
                              }}
                              placeholder="Frente..."
                            />
                          ) : (
                            <span className="font-mono text-xs">{linea.frente_trabajo?.codigo_completo || '-'}</span>
                          )}
                        </td>
                        <td className="px-1 py-1">
                          {isEditable ? (
                            <SearchableSelect
                              size="sm"
                              options={personalOptions}
                              value={linea.id_personal ? parseInt(linea.id_personal) : ''}
                              onChange={(val) => actualizarLineaLocal(index, 'id_personal', val)}
                              placeholder="Operador..."
                            />
                          ) : (
                            <span className="text-xs">
                              {linea.personal ? `${linea.personal.nombre} ${linea.personal.apellido || ''}` : '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-1 py-1">
                          {isEditable ? (
                            <select
                              value={linea.id_tipo_frente || ''}
                              onChange={(e) => {
                                actualizarLineaLocal(index, 'id_tipo_frente', e.target.value);
                                setTimeout(() => calcularExplosivosLinea(index), 100);
                              }}
                              className="w-full px-1 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-red-500"
                            >
                              <option value="">Seleccionar...</option>
                              {tiposFrente.map((tf) => (
                                <option key={tf.id} value={tf.id}>
                                  {tf.nombre}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs">{linea.tipo_frente?.nombre || '-'}</span>
                          )}
                        </td>
                        <td className="px-1 py-1">
                          {isEditable ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={linea.seccion_ancho || ''}
                              onChange={(e) => actualizarLineaLocal(index, 'seccion_ancho', e.target.value)}
                              placeholder="A"
                              className="w-14 px-1 py-1 text-center border border-gray-300 rounded text-xs focus:ring-1 focus:ring-red-500"
                            />
                          ) : (
                            <span className="text-xs">{linea.seccion_ancho || '-'}</span>
                          )}
                        </td>
                        <td className="px-1 py-1">
                          {isEditable ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={linea.seccion_alto || ''}
                              onChange={(e) => actualizarLineaLocal(index, 'seccion_alto', e.target.value)}
                              placeholder="H"
                              className="w-14 px-1 py-1 text-center border border-gray-300 rounded text-xs focus:ring-1 focus:ring-red-500"
                            />
                          ) : (
                            <span className="text-xs">{linea.seccion_alto || '-'}</span>
                          )}
                        </td>
                        <td className="px-1 py-1">
                          {isEditable ? (
                            <input
                              type="number"
                              min="1"
                              value={linea.numero_tiros || ''}
                              onChange={(e) => {
                                actualizarLineaLocal(index, 'numero_tiros', e.target.value);
                                actualizarLineaLocal(index, 'valores_editados', false);
                                setTimeout(() => calcularExplosivosLinea(index), 100);
                              }}
                              placeholder="0"
                              className="w-16 px-1 py-1 text-center border border-gray-300 rounded text-xs focus:ring-1 focus:ring-red-500"
                            />
                          ) : (
                            <span className="text-xs font-medium">{linea.numero_tiros}</span>
                          )}
                        </td>
                        <td className="px-1 py-1">
                          {isEditable ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={linea.largo_perforacion || ''}
                              onChange={(e) => actualizarLineaLocal(index, 'largo_perforacion', e.target.value)}
                              placeholder="0"
                              className="w-16 px-1 py-1 text-center border border-gray-300 rounded text-xs focus:ring-1 focus:ring-red-500"
                            />
                          ) : (
                            <span className="text-xs">{linea.largo_perforacion || '-'}</span>
                          )}
                        </td>
                        <td className="px-1 py-1">
                          {isEditable ? (
                            <div className="flex flex-wrap gap-0.5">
                              {BARRAS_OPCIONES.map((b) => {
                                const selected = (linea.barras_usadas || []).includes(b);
                                return (
                                  <button
                                    key={b}
                                    type="button"
                                    onClick={() => {
                                      const barras = [...(linea.barras_usadas || [])];
                                      if (selected) barras.splice(barras.indexOf(b), 1);
                                      else barras.push(b);
                                      actualizarLineaLocal(index, 'barras_usadas', barras.sort((a, c) => a - c));
                                    }}
                                    className={`px-1.5 py-0.5 text-[10px] rounded-full border transition-colors ${
                                      selected
                                        ? 'bg-red-600 text-white border-red-600'
                                        : 'bg-white text-gray-600 border-gray-300 hover:border-red-400'
                                    }`}
                                  >
                                    {b}m
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-0.5">
                              {(linea.barras_usadas || []).map((b) => (
                                <span key={b} className="px-1.5 py-0.5 text-[10px] rounded-full bg-red-100 text-red-700">
                                  {b}m
                                </span>
                              ))}
                              {(!linea.barras_usadas || linea.barras_usadas.length === 0) && <span className="text-[10px] text-gray-400">-</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-1 py-1">
                          {isEditable ? (
                            <select
                              value={linea.material || ''}
                              onChange={(e) => actualizarLineaLocal(index, 'material', e.target.value)}
                              className="w-full px-1 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-red-500"
                            >
                              <option value="">-</option>
                              {MATERIALES.map((m) => (
                                <option key={m.value} value={m.value}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs">
                              {MATERIALES.find((m) => m.value === linea.material)?.label || '-'}
                            </span>
                          )}
                        </td>
                        {/* Columnas de explosivos */}
                        {columnasExplosivos.map((te) => {
                          const exp = getExplosivoLinea(linea, te.id);
                          const cantidad = exp?.cantidad_final || '';
                          const esEditado = exp && Math.abs((exp.cantidad_calculada || 0) - (exp.cantidad_final || 0)) > 0.01;

                          return (
                            <td key={te.id} className="px-1 py-1">
                              {isEditable ? (
                                <div className="relative">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={cantidad}
                                    onChange={(e) => actualizarExplosivoLinea(index, te.id, e.target.value)}
                                    className={`w-16 px-1 py-1 text-center border rounded text-xs focus:ring-1 focus:ring-red-500 ${
                                      esEditado ? 'border-orange-400 bg-orange-50' : 'border-gray-300'
                                    }`}
                                  />
                                  {esEditado && (
                                    <HiPencil className="absolute -top-1 -right-1 w-3 h-3 text-orange-500" title="Valor editado" />
                                  )}
                                </div>
                              ) : (
                                <span className={`text-xs ${esEditado ? 'text-orange-600 font-medium' : ''}`}>
                                  {cantidad || '-'}
                                  {esEditado && <HiPencil className="inline w-3 h-3 ml-0.5 text-orange-500" />}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        {esBorrador && (
                          <td className="px-1 py-1 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              {isLocal && (
                                <button
                                  onClick={() => guardarLinea(index)}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  title="Guardar linea"
                                  disabled={submitting}
                                >
                                  <HiCheckCircle className="w-4 h-4" />
                                </button>
                              )}
                              {!isLocal && (
                                <button
                                  onClick={() => guardarLinea(index)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                  title="Actualizar linea"
                                  disabled={submitting}
                                >
                                  <HiPencil className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => eliminarLinea(index)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Eliminar linea"
                              >
                                <HiTrash className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                {/* Fila de totales + stock */}
                {lineas.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 bg-gray-100 font-semibold">
                      <td colSpan={9} className="px-2 py-2 text-right text-xs text-gray-700">
                        TOTALES
                      </td>
                      {columnasExplosivos.map((te) => (
                        <td key={te.id} className="px-2 py-2 text-center text-xs text-gray-900">
                          {totales[te.id] ? parseFloat(totales[te.id]).toLocaleString('es-CL', { maximumFractionDigits: 2 }) : '-'}
                        </td>
                      ))}
                      {esBorrador && <td></td>}
                    </tr>
                    {stockDisponible.length > 0 && (
                      <tr className="bg-blue-50/50">
                        <td colSpan={9} className="px-2 py-1.5 text-right text-[10px] text-blue-600 font-medium">
                          STOCK DISPONIBLE
                        </td>
                        {columnasExplosivos.map((te) => {
                          const stock = getStockParaTipo(te.id);
                          const total = totales[te.id] || 0;
                          const excede = total > stock && stock > 0;
                          return (
                            <td key={te.id} className={`px-2 py-1.5 text-center text-[10px] font-medium ${excede ? 'text-red-600 bg-red-50' : 'text-blue-700'}`}>
                              {stock > 0 ? parseFloat(stock).toLocaleString('es-CL', { maximumFractionDigits: 2 }) : '-'}
                              {excede && <HiExclamationTriangle className="inline w-3 h-3 ml-0.5" />}
                            </td>
                          );
                        })}
                        {esBorrador && <td></td>}
                      </tr>
                    )}
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Seccion Devoluciones (solo en confirmado/cerrado) */}
      {reporteId && (esConfirmado || esCerrado) && (
        <Card>
          <button
            className="w-full flex items-center justify-between"
            onClick={() => setShowDevoluciones(!showDevoluciones)}
          >
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Devoluciones {devoluciones.filter((d) => !d._local).length > 0 && `(${devoluciones.filter((d) => !d._local).length})`}
            </h4>
            {showDevoluciones ? <HiChevronUp className="w-5 h-5 text-gray-400" /> : <HiChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {showDevoluciones && (
            <div className="mt-4">
              {esConfirmado && (
                <>
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                    <p className="font-medium mb-1">Registre las devoluciones de explosivos no utilizados</p>
                    <p className="text-xs text-blue-600">Si todo fue utilizado, puede cerrar sin devoluciones.</p>
                  </div>
                  <div className="mb-4 flex flex-wrap gap-2 justify-end">
                    {devLocales.length === 0 && (
                      <Button variant="outline" size="sm" onClick={prePopularDevoluciones}>
                        Pre-popular con tipos del reporte
                      </Button>
                    )}
                    <Button variant="outline" icon={HiPlus} size="sm" onClick={agregarDevolucion}>
                      Agregar Devolucion
                    </Button>
                  </div>

                  {/* Opcion sin devoluciones */}
                  <div className="mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sinDevoluciones}
                        onChange={(e) => setSinDevoluciones(e.target.checked)}
                        className="w-4 h-4 text-red-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Sin devoluciones - Todo fue utilizado</span>
                    </label>
                  </div>
                </>
              )}

              {devoluciones.length === 0 && !sinDevoluciones ? (
                <p className="text-gray-500 text-sm text-center py-4">No hay devoluciones registradas.</p>
              ) : !sinDevoluciones ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="px-3 py-2 text-left font-semibold">Tipo Explosivo</th>
                        <th className="px-3 py-2 text-center font-semibold">Entregado</th>
                        <th className="px-3 py-2 text-center font-semibold">Devolucion</th>
                        <th className="px-3 py-2 text-left font-semibold">Operador</th>
                        <th className="px-3 py-2 text-left font-semibold">Motivo</th>
                        {esConfirmado && <th className="px-3 py-2 text-center font-semibold">Acc.</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {devoluciones.map((dev, index) =>
                        dev._local ? (
                          <tr key={dev._key} className="border-b">
                            <td className="px-2 py-2">
                              <select
                                value={dev.id_tipo_explosivo || ''}
                                onChange={(e) => actualizarDevolucion(index, 'id_tipo_explosivo', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-red-500"
                              >
                                <option value="">Seleccionar...</option>
                                {tipos.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.codigo} - {t.nombre}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2 text-center text-xs text-gray-500">
                              {dev._totalEntregado != null
                                ? parseFloat(dev._totalEntregado).toLocaleString('es-CL')
                                : totales[dev.id_tipo_explosivo]
                                ? parseFloat(totales[dev.id_tipo_explosivo]).toLocaleString('es-CL')
                                : '-'
                              }
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={dev.cantidad || ''}
                                onChange={(e) => actualizarDevolucion(index, 'cantidad', e.target.value)}
                                className="w-20 px-2 py-1 text-center border border-gray-300 rounded text-sm focus:ring-1 focus:ring-red-500"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <select
                                value={dev.id_personal || ''}
                                onChange={(e) => actualizarDevolucion(index, 'id_personal', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-red-500"
                              >
                                <option value="">Opcional...</option>
                                {personalAutorizado.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.nombre} {p.apellido}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                value={dev.motivo || ''}
                                onChange={(e) => actualizarDevolucion(index, 'motivo', e.target.value)}
                                placeholder="Motivo..."
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-red-500"
                              />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                onClick={() => eliminarDevolucionLocal(index)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                              >
                                <HiTrash className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ) : (
                          <tr key={dev.id} className="border-b bg-gray-50/50">
                            <td className="px-3 py-2">{dev.tipo_explosivo?.codigo} - {dev.tipo_explosivo?.nombre}</td>
                            <td className="px-3 py-2 text-center text-xs text-gray-500">-</td>
                            <td className="px-3 py-2 text-center font-medium">
                              {parseFloat(dev.cantidad).toLocaleString('es-CL')}
                            </td>
                            <td className="px-3 py-2">
                              {dev.personal ? `${dev.personal.nombre} ${dev.personal.apellido || ''}` : '-'}
                            </td>
                            <td className="px-3 py-2 text-gray-600">{dev.motivo || '-'}</td>
                            {esConfirmado && <td></td>}
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}
        </Card>
      )}

      {/* Botones de accion */}
      {reporteId && (
        <Card className="print:hidden">
          <div className="flex flex-wrap gap-3 justify-between">
            <div>
              {esConfirmado && (
                <Button
                  variant="danger"
                  icon={HiXCircle}
                  onClick={() => setShowConfirmAnular(true)}
                  disabled={submitting}
                >
                  Anular Reporte
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {esBorrador && lineas.filter((l) => !l._local).length > 0 && (
                <Button
                  variant="primary"
                  icon={HiCheckCircle}
                  onClick={() => setShowConfirmConfirmar(true)}
                  disabled={submitting}
                >
                  Confirmar Reporte
                </Button>
              )}
              {esConfirmado && sinDevoluciones && (
                <Button
                  variant="success"
                  icon={HiCheckCircle}
                  onClick={() => setShowConfirmCerrarSinDev(true)}
                  disabled={submitting}
                >
                  Cerrar sin Devoluciones
                </Button>
              )}
              {esConfirmado && !sinDevoluciones && devLocales.some((d) => d.id_tipo_explosivo && d.cantidad) && (
                <Button
                  variant="success"
                  icon={HiCheckCircle}
                  onClick={() => setShowConfirmCerrar(true)}
                  disabled={submitting}
                >
                  Registrar Devoluciones y Cerrar
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={showConfirmConfirmar}
        onClose={() => setShowConfirmConfirmar(false)}
        onConfirm={ejecutarConfirmar}
        title="Confirmar Reporte"
        message={`Confirmar reporte ${codigo}? Se validara el stock disponible y se generaran los movimientos de salida.`}
        confirmText="Confirmar"
        confirmVariant="primary"
      />

      <ConfirmDialog
        isOpen={showConfirmCerrar}
        onClose={() => setShowConfirmCerrar(false)}
        onConfirm={ejecutarCerrar}
        title="Cerrar Reporte con Devoluciones"
        message={`Registrar las devoluciones y cerrar el reporte ${codigo}? Se generaran movimientos de devolucion y el stock se actualizara.`}
        confirmText="Cerrar Reporte"
        confirmVariant="success"
      />

      <ConfirmDialog
        isOpen={showConfirmCerrarSinDev}
        onClose={() => setShowConfirmCerrarSinDev(false)}
        onConfirm={ejecutarCerrarSinDevoluciones}
        title="Cerrar sin Devoluciones"
        message={`Cerrar el reporte ${codigo} SIN registrar devoluciones? Esto indica que todos los explosivos entregados fueron utilizados.`}
        confirmText="Cerrar sin Devoluciones"
        confirmVariant="success"
      />

      <ConfirmDialog
        isOpen={showConfirmAnular}
        onClose={() => setShowConfirmAnular(false)}
        onConfirm={ejecutarAnular}
        title="Anular Reporte"
        message={`ANULAR el reporte ${codigo}? Los movimientos de salida seran revertidos y el stock restaurado. El reporte volvera a estado borrador.`}
        confirmText="Anular Reporte"
        confirmVariant="danger"
      />

      <ConfirmDialog
        isOpen={showConfirmSalir}
        onClose={() => setShowConfirmSalir(false)}
        onConfirm={() => { setShowConfirmSalir(false); onVolver(); }}
        title="Cambios sin guardar"
        message="Tiene cambios sin guardar. Esta seguro que desea salir?"
        confirmText="Salir sin guardar"
        confirmVariant="danger"
      />

      {/* Modal Resumen Movimientos */}
      {showResumenMovimientos && resumenData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {resumenData.tipo === 'confirmacion' ? 'Movimientos de Salida Generados' : 'Resumen de Cierre'}
            </h3>
            {resumenData.tipo === 'confirmacion' && (
              <div className="space-y-2">
                {(resumenData.movimientos || []).filter((m) => m.tipo === 'salida').map((m, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-red-50 rounded">
                    <span className="text-sm font-medium">{m.tipo_explosivo?.codigo} - {m.tipo_explosivo?.nombre}</span>
                    <span className="text-sm font-bold text-red-700">-{parseFloat(m.cantidad).toLocaleString('es-CL')}</span>
                  </div>
                ))}
              </div>
            )}
            {resumenData.tipo === 'cierre' && (
              <div className="space-y-2">
                {(resumenData.devoluciones || []).map((d, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-green-50 rounded">
                    <span className="text-sm font-medium">{d.tipo_explosivo?.codigo} - {d.tipo_explosivo?.nombre}</span>
                    <span className="text-sm font-bold text-green-700">+{parseFloat(d.cantidad).toLocaleString('es-CL')}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button variant="primary" onClick={() => setShowResumenMovimientos(false)}>
                Entendido
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Historial */}
      <HistorialCambios
        show={showHistorial}
        onClose={() => setShowHistorial(false)}
        frenteId={reporteId}
        loadHistorial={explosivosService.getHistorialReporte}
        onRevertir={() => {}}
        title="Historial del Reporte"
      />
    </div>
  );
}
