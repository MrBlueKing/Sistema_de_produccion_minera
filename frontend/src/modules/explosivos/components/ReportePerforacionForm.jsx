import { useState, useEffect, useCallback, useRef } from 'react';
import {
  HiArrowLeft,
  HiPlus,
  HiTrash,
  HiCheckCircle,
  HiExclamationTriangle,
  HiPencil,
  HiPencilSquare,
  HiDocumentText,
  HiXCircle,
  HiClock,
  HiWrenchScrewdriver,
  HiArrowUturnLeft,
  HiInformationCircle,
} from 'react-icons/hi2';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import SearchableSelect from '../../../shared/components/atoms/SearchableSelect';
import ConfirmDialog from '../../../shared/components/molecules/ConfirmDialog';
import HistorialCambios from '../../../shared/components/organisms/HistorialCambios';
import explosivosService from '../services/explosivos';
import ingenieriaService from '../../ingenieria/services/ingenieria';
import useToast from '../../../hooks/useToast';

const BARRAS_OPCIONES = [0.8, 1.2, 1.6, 1.8, 2.4, 3.2];
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

  // Modo corrección: reporte Confirmado/Cerrado que se está editando con los
  // movimientos de stock revertidos temporalmente.
  const [enCorreccion, setEnCorreccion] = useState(false);
  const [correccionPrevio, setCorreccionPrevio] = useState(null); // 'confirmado' | 'cerrado'
  const [correccionPor, setCorreccionPor] = useState(null);
  const [devolucionesRevisar, setDevolucionesRevisar] = useState([]);

  // Lineas
  const [lineas, setLineas] = useState([]);

  // Devoluciones
  const [devoluciones, setDevoluciones] = useState([]);

  // Extras: material solicitado después de confirmado, sin tocar las líneas
  const [extras, setExtras] = useState([]);
  const [mostrarFormExtra, setMostrarFormExtra] = useState(false);
  const [extraForm, setExtraForm] = useState({ id_tipo_explosivo: '', cantidad: '', motivo: '', id_linea_reporte: '' });
  const [submittingExtra, setSubmittingExtra] = useState(false);

  // Datos de referencia
  const [frentesTrabajo, setFrentesTrabajo] = useState([]);
  const [tiposFrente, setTiposFrente] = useState([]);
  const [personalAutorizado, setPersonalAutorizado] = useState([]);
  const [stockDisponible, setStockDisponible] = useState([]);

  // Columnas de explosivos (tipos que tienen formulas configuradas)
  const [columnasExplosivos, setColumnasExplosivos] = useState([]);

  // Debounce por línea del cálculo automático al escribir N° Tiros (una entrada por índice
  // de línea, para no mezclar el tecleo de una fila con el de otra).
  const debounceTirosRef = useRef({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Confirm dialogs
  const [showConfirmConfirmar, setShowConfirmConfirmar] = useState(false);
  const [showConfirmEliminar, setShowConfirmEliminar] = useState(false);
  const [showConfirmSalir, setShowConfirmSalir] = useState(false);
  const [showConfirmHabilitarCorreccion, setShowConfirmHabilitarCorreccion] = useState(false);
  const [showConfirmConfirmarCorreccion, setShowConfirmConfirmarCorreccion] = useState(false);
  const [showConfirmDescartarCorreccion, setShowConfirmDescartarCorreccion] = useState(false);

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
      setExtras(reporte.extras || []);
      if (reporte.polvorin) {
        setPolvorinSeleccionado(reporte.polvorin);
      }

      setEnCorreccion(!!reporte.en_correccion);
      setCorreccionPrevio(reporte.correccion_estado_previo || null);
      setCorreccionPor(reporte.correccion_por || null);
      // Si el reporte venía Cerrado, se prepara la lista de devoluciones a revisar
      // (partiendo de las que tenía antes de la corrección).
      if (reporte.en_correccion && reporte.correccion_estado_previo === 'cerrado') {
        const devsSnap = reporte.correccion_snapshot?.devoluciones || [];
        setDevolucionesRevisar(
          devsSnap.map((d) => ({
            id_tipo_explosivo: d.id_tipo_explosivo,
            cantidad: d.cantidad ?? '',
            id_personal: d.id_personal || '',
            motivo: d.motivo || '',
          })),
        );
      } else {
        setDevolucionesRevisar([]);
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
      nuevas[index] = { ...nuevas[index], [campo]: valor, _dirty: true };
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
      linea._dirty = true;
      nuevas[lineaIndex] = linea;
      return nuevas;
    });
    setHasUnsavedChanges(true);
  };

  // Calcular explosivos para una linea cuando cambian tiros o tipo frente
  const calcularExplosivosLinea = useCallback(
    // `overrides` permite pasar el valor recién tecleado/elegido directamente en vez de
    // releerlo desde `lineas`: como esta función es un useCallback memoizado con `lineas`
    // como dependencia, y se llamaba desde un setTimeout, el closure quedaba "atrasado" un
    // tecleo — al escribir "35" calculaba con "3" (el valor previo al último tecleo), nunca
    // con el valor final. Bug real que descontaba mal el stock.
    async (lineaIndex, overrides = {}) => {
      const linea = lineas[lineaIndex];
      if (!linea) return;
      const numeroTiros = overrides.numero_tiros ?? linea.numero_tiros;
      const idTipoFrente = overrides.id_tipo_frente ?? linea.id_tipo_frente;
      if (!numeroTiros || !idTipoFrente) return;

      try {
        const resultado = await explosivosService.calcularExplosivos({
          numero_tiros: parseInt(numeroTiros),
          id_tipo_frente: idTipoFrente,
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
            lineaActualizada._dirty = true;
          }

          nuevas[lineaIndex] = lineaActualizada;
          return nuevas;
        });
      } catch {
        // Silencioso - las formulas pueden no estar configuradas
      }
    },
    [lineas]
  );

  // Construye el payload de una línea (sin tocar UI ni toasts).
  const payloadLinea = (linea) => ({
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
  });

  // Persiste TODAS las líneas al servidor. Se usa antes de confirmar (reporte o
  // corrección) y desde el botón "Guardar líneas". Devuelve true si quedó todo ok.
  const guardarTodasLasLineas = async ({ mostrarToast = false } = {}) => {
    if (lineas.length === 0) return true;
    const incompleta = lineas.find(
      (l) => !l.id_frente_trabajo || !l.id_personal || !l.numero_tiros || !l.id_tipo_frente,
    );
    if (incompleta) {
      toast.error('Error', 'Hay una línea con campos obligatorios vacíos (Frente, Operador, Tipo Labor o N° Tiros).');
      return false;
    }
    const pendientes = lineas.some((l) => l._local || l._dirty);
    try {
      const guardadas = await Promise.all(
        lineas.map((l) =>
          l._local
            ? explosivosService.agregarLinea(reporteId, payloadLinea(l)).then((r) => r.linea)
            : explosivosService.actualizarLinea(reporteId, l.id, payloadLinea(l)).then((r) => r.linea),
        ),
      );
      setLineas(guardadas);
      setHasUnsavedChanges(false);
      if (mostrarToast) {
        toast.success('Líneas guardadas', pendientes ? 'Los cambios de las líneas fueron guardados.' : 'No había cambios pendientes.');
      }
      return true;
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudieron guardar las líneas');
      return false;
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
      // Guarda cualquier edición de línea que no se haya persistido.
      const lineasOk = await guardarTodasLasLineas();
      if (!lineasOk) {
        setSubmitting(false);
        return;
      }

      const res = await explosivosService.confirmarReporte(reporteId, {
        confirmado_por: 'Supervisor',
      });
      setEstado('confirmado');
      toast.success('Reporte confirmado', res.mensaje);
      // Recargar reporte
      const detalle = await explosivosService.getReporte(reporteId);
      setLineas(detalle.lineas || []);
      setDevoluciones(detalle.devoluciones || []);
      setExtras(detalle.extras || []);

      onRefresh?.();
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo confirmar el reporte');
    } finally {
      setSubmitting(false);
    }
  };

  // Eliminar reporte (cualquier estado). Si tenía movimientos, el backend los revierte.
  const ejecutarEliminar = async () => {
    setShowConfirmEliminar(false);
    setSubmitting(true);
    try {
      const res = await explosivosService.deleteReporte(reporteId);
      toast.success('Reporte eliminado', res.mensaje);
      setHasUnsavedChanges(false);
      onRefresh?.();
      onVolver();
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo eliminar el reporte');
      setSubmitting(false);
    }
  };

  // Solicitar extra: material pedido después de confirmado el reporte. No
  // toca las cantidades de las líneas — queda como un registro aparte con su
  // motivo, y descuenta stock real del polvorín.
  const ejecutarRegistrarExtra = async () => {
    if (!extraForm.id_tipo_explosivo || !extraForm.cantidad || !extraForm.id_linea_reporte) {
      toast?.error('Completa la línea, el explosivo y la cantidad');
      return;
    }
    setSubmittingExtra(true);
    try {
      const res = await explosivosService.registrarExtra(reporteId, {
        id_tipo_explosivo: extraForm.id_tipo_explosivo,
        cantidad: parseFloat(extraForm.cantidad),
        motivo: extraForm.motivo.trim() || null,
        id_linea_reporte: extraForm.id_linea_reporte,
      });
      toast.success('Extra registrado', res.mensaje);
      setExtras(res.extras || []);
      setExtraForm({ id_tipo_explosivo: '', cantidad: '', motivo: '', id_linea_reporte: '' });
      setMostrarFormExtra(false);

      // El stock del polvorín bajó — refrescarlo para que se vea al tiro.
      const polv = polvorinSeleccionado || polvorin;
      if (polv?.id) {
        try {
          const stockRes = await explosivosService.getStock({ id_polvorin: polv.id });
          setStockDisponible(stockRes);
        } catch { /* no critico */ }
      }
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo registrar el extra');
    } finally {
      setSubmittingExtra(false);
    }
  };

  // ---- Modo corrección ----

  const CLAVE_EXPLICACION_CORRECCION = 'reportes_pt_correccion_explicada';

  // "Habilitar corrección": si es la primera vez muestra el diálogo explicativo,
  // las siguientes va directo.
  const pedirHabilitarCorreccion = () => {
    let yaExplicado = false;
    try { yaExplicado = localStorage.getItem(CLAVE_EXPLICACION_CORRECCION) === '1'; } catch { /* noop */ }
    if (yaExplicado) {
      ejecutarHabilitarCorreccion();
    } else {
      setShowConfirmHabilitarCorreccion(true);
    }
  };

  const ejecutarHabilitarCorreccion = async () => {
    setShowConfirmHabilitarCorreccion(false);
    try { localStorage.setItem(CLAVE_EXPLICACION_CORRECCION, '1'); } catch { /* noop */ }
    setSubmitting(true);
    try {
      const res = await explosivosService.habilitarCorreccion(reporteId);
      toast.success('Corrección habilitada', res.mensaje);
      const detalle = await explosivosService.getReporte(reporteId);
      aplicarDetalleCorreccion(detalle);
      onRefresh?.();
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo habilitar la corrección');
    } finally {
      setSubmitting(false);
    }
  };

  const ejecutarConfirmarCorreccion = async () => {
    setShowConfirmConfirmarCorreccion(false);
    // Si venía Cerrado, se mandan las devoluciones revisadas por la operadora
    const devsPayload = correccionPrevio === 'cerrado'
      ? devolucionesRevisar
          .filter((d) => d.id_tipo_explosivo && parseFloat(d.cantidad) > 0)
          .map((d) => ({
            id_tipo_explosivo: d.id_tipo_explosivo,
            cantidad: parseFloat(d.cantidad),
            id_personal: d.id_personal || null,
            motivo: d.motivo || null,
          }))
      : [];

    setSubmitting(true);
    try {
      // Persistir cualquier edición de celda que no se haya guardado fila por fila.
      const lineasOk = await guardarTodasLasLineas();
      if (!lineasOk) {
        setSubmitting(false);
        return;
      }

      const res = await explosivosService.confirmarCorreccion(reporteId, devsPayload);
      toast.success('Corrección confirmada', res.mensaje);
      const detalle = await explosivosService.getReporte(reporteId);
      aplicarDetalleCorreccion(detalle);
      onRefresh?.();
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo confirmar la corrección');
    } finally {
      setSubmitting(false);
    }
  };

  const ejecutarDescartarCorreccion = async () => {
    setShowConfirmDescartarCorreccion(false);
    setSubmitting(true);
    try {
      const res = await explosivosService.descartarCorreccion(reporteId);
      toast.success('Corrección descartada', res.mensaje);
      const detalle = await explosivosService.getReporte(reporteId);
      aplicarDetalleCorreccion(detalle);
      setHasUnsavedChanges(false);
      onRefresh?.();
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo descartar la corrección');
    } finally {
      setSubmitting(false);
    }
  };

  // Refresca el estado local del formulario tras cualquier acción de corrección.
  const aplicarDetalleCorreccion = (detalle) => {
    setEstado(detalle.estado);
    setLineas(detalle.lineas || []);
    setDevoluciones(detalle.devoluciones || []);
    setExtras(detalle.extras || []);
    setEnCorreccion(!!detalle.en_correccion);
    setCorreccionPrevio(detalle.correccion_estado_previo || null);
    setCorreccionPor(detalle.correccion_por || null);
    setHasUnsavedChanges(false); // el estado local ya coincide con el servidor
    if (detalle.en_correccion && detalle.correccion_estado_previo === 'cerrado') {
      const devsSnap = detalle.correccion_snapshot?.devoluciones || [];
      setDevolucionesRevisar(
        devsSnap.map((d) => ({
          id_tipo_explosivo: d.id_tipo_explosivo,
          cantidad: d.cantidad ?? '',
          id_personal: d.id_personal || '',
          motivo: d.motivo || '',
        })),
      );
    } else {
      setDevolucionesRevisar([]);
    }
  };

  // En corrección: solo se edita la cantidad/motivo de las devoluciones que el
  // polvorinero ya había registrado. No se agregan ni se quitan desde acá.
  const actualizarDevolucionRevisar = (index, campo, valor) => {
    setDevolucionesRevisar((prev) => {
      const nuevas = [...prev];
      nuevas[index] = { ...nuevas[index], [campo]: valor };
      return nuevas;
    });
  };

  const handleVolver = () => {
    if (enCorreccion) {
      // No se sale de una corrección a medias por la puerta de atrás
      setShowConfirmSalir(true);
      return;
    }
    if (hasUnsavedChanges) {
      setShowConfirmSalir(true);
    } else {
      onVolver(reporteId);
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

  // Extras por tipo de explosivo — se muestran aparte de `totales` (líneas),
  // nunca fusionados: lo planificado en las líneas queda intacto siempre.
  const calcularExtras = () => {
    const porTipo = {};
    extras.forEach((ex) => {
      const id = ex.id_tipo_explosivo;
      if (!porTipo[id]) porTipo[id] = 0;
      porTipo[id] += parseFloat(ex.cantidad) || 0;
    });
    return porTipo;
  };

  const calcularTotalTiros = () => {
    return lineas.reduce((suma, linea) => suma + (parseInt(linea.numero_tiros) || 0), 0);
  };

  const getExplosivoLinea = (linea, idTipoExplosivo) => {
    return (linea.explosivos || []).find((e) => e.id_tipo_explosivo === idTipoExplosivo);
  };

  const getStockParaTipo = (idTipoExplosivo) => {
    const stock = stockDisponible.find((s) => s.id_tipo_explosivo === idTipoExplosivo);
    return stock ? parseFloat(stock.cantidad_disponible || stock.cantidad || 0) : 0;
  };

  const getEstadoBadge = (est) => {
    if (enCorreccion) {
      return (
        <span className="inline-flex px-3 py-1 rounded-full text-sm font-semibold border bg-amber-100 text-amber-800 border-amber-300">
          En corrección
        </span>
      );
    }
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
  // Borrador "de verdad" (reporte nuevo en armado), distinto de un borrador que
  // en realidad está en modo corrección.
  const esBorradorReal = esBorrador && !enCorreccion;
  const puedeHabilitarCorreccion = reporteId && !enCorreccion && (esConfirmado || esCerrado);
  const totales = calcularTotales();
  const extrasTotales = calcularExtras();
  const totalTiros = calcularTotalTiros();

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
          </div>
        )}
      </div>

      {/* Banner: puerta de entrada a la corrección (reporte Confirmado/Cerrado) */}
      {puedeHabilitarCorreccion && (
        <div className="print:hidden rounded-xl border border-gray-300 bg-gray-50 p-4 flex items-start gap-3">
          <HiInformationCircle className="w-6 h-6 text-gray-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-gray-800">
              Reporte {esCerrado ? 'cerrado' : 'confirmado'} — solo lectura
            </p>
            <p className="text-sm text-gray-600 mt-0.5">
              Los movimientos de stock de este reporte ya están registrados. Para editar cualquier dato,
              habilitá la corrección.
            </p>
            {reporte?.corregido_en && (
              <p className="text-xs text-amber-700 mt-1.5 flex items-center gap-1">
                <HiPencilSquare className="w-3.5 h-3.5" />
                Ya fue corregido el {new Date(reporte.corregido_en).toLocaleDateString('es-CL')}
                {reporte.corregido_por ? ` por ${reporte.corregido_por}` : ''}
                {reporte.corregido_toco_devoluciones ? ' (devoluciones ajustadas)' : ''}.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" icon={HiWrenchScrewdriver} size="sm" onClick={pedirHabilitarCorreccion} disabled={submitting}>
                Habilitar corrección
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Banner fijo: corrección en curso */}
      {enCorreccion && (
        <div className="print:hidden sticky top-2 z-30 rounded-xl border border-amber-300 bg-amber-50 shadow-sm p-4 flex items-start gap-3">
          <HiWrenchScrewdriver className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900">
              Corrigiendo — los movimientos se regenerarán al confirmar
            </p>
            <p className="text-sm text-amber-800 mt-0.5">
              Las salidas de stock de este reporte fueron revertidas temporalmente
              {correccionPrevio === 'cerrado' && ' (y las devoluciones del cierre)'}.
              Editá lo que necesites y confirmá para volver a aplicarlas con los valores nuevos.
              {correccionPor && <span className="text-amber-700"> · iniciada por {correccionPor}</span>}
            </p>
          </div>
        </div>
      )}

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
              <option value="Madrugada">Madrugada</option>
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
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Lineas de Perforacion ({lineas.length})
              {esBorrador && lineas.some((l) => l._local || l._dirty) && (
                <span className="ml-2 normal-case text-xs font-normal text-amber-600">
                  · cambios sin guardar
                </span>
              )}
            </h4>
            {esBorrador && (
              <div className="flex flex-wrap gap-2">
                {lineas.some((l) => l._local || l._dirty) && (
                  <Button
                    variant="outline"
                    icon={HiCheckCircle}
                    size="sm"
                    onClick={async () => {
                      // disabled={submitting} solo protege contra doble-click si ESTA
                      // función también prende `submitting` — antes no lo hacía, así que
                      // un doble-click rápido disparaba dos guardarTodasLasLineas()
                      // concurrentes, cada una viendo la misma línea _local:true y
                      // creándola por separado (línea duplicada en el reporte).
                      setSubmitting(true);
                      try {
                        await guardarTodasLasLineas({ mostrarToast: true });
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    disabled={submitting}
                  >
                    Guardar líneas
                  </Button>
                )}
                <Button variant="outline" icon={HiPlus} size="sm" onClick={agregarLineaLocal}>
                  Agregar Linea
                </Button>
              </div>
            )}
          </div>
          {esBorrador && (
            <p className="text-xs text-gray-400 -mt-2 mb-3">
              Editá las celdas libremente. Los cambios se guardan al confirmar
              {enCorreccion ? ' la corrección' : ' el reporte'}, o con "Guardar líneas".
            </p>
          )}

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
                    const sinGuardar = isEditable && (linea._local || linea._dirty);

                    return (
                      <tr
                        key={linea.id || linea._key}
                        className={`border-b hover:bg-red-50/30 ${sinGuardar ? 'bg-amber-50/60 border-l-2 border-l-amber-400' : ''}`}
                      >
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
                                const valor = e.target.value;
                                actualizarLineaLocal(index, 'id_tipo_frente', valor);
                                calcularExplosivosLinea(index, { id_tipo_frente: valor });
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
                                const valor = e.target.value;
                                actualizarLineaLocal(index, 'numero_tiros', valor);
                                actualizarLineaLocal(index, 'valores_editados', false);
                                clearTimeout(debounceTirosRef.current[index]);
                                debounceTirosRef.current[index] = setTimeout(() => {
                                  calcularExplosivosLinea(index, { numero_tiros: valor });
                                }, 300);
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
                            <div className="flex items-center gap-1.5 justify-center">
                              {sinGuardar && (
                                <span
                                  className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"
                                  title={isLocal ? 'Línea nueva sin guardar' : 'Cambios sin guardar'}
                                />
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
                      <td colSpan={5} className="px-2 py-2 text-right text-xs text-gray-700">
                        TOTALES
                      </td>
                      <td className="px-2 py-2 text-center text-xs text-gray-900">
                        {totalTiros || '-'}
                      </td>
                      <td colSpan={3}></td>
                      {columnasExplosivos.map((te) => (
                        <td key={te.id} className="px-2 py-2 text-center text-xs text-gray-900">
                          {totales[te.id] ? parseFloat(totales[te.id]).toLocaleString('es-CL', { maximumFractionDigits: 2 }) : '-'}
                        </td>
                      ))}
                      {esBorrador && <td></td>}
                    </tr>
                    {Object.keys(extrasTotales).length > 0 && (
                      <>
                        <tr className="bg-violet-50 text-violet-700">
                          <td colSpan={6} className="px-2 py-1.5 text-right text-[10px] font-semibold">
                            <span className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                              EXTRA SOLICITADO
                            </span>
                          </td>
                          <td colSpan={3}></td>
                          {columnasExplosivos.map((te) => (
                            <td key={te.id} className="px-2 py-1.5 text-center text-[10px] font-bold">
                              {extrasTotales[te.id] ? `+ ${parseFloat(extrasTotales[te.id]).toLocaleString('es-CL', { maximumFractionDigits: 2 })}` : '—'}
                            </td>
                          ))}
                          {esBorrador && <td></td>}
                        </tr>
                        <tr className="border-t bg-gray-50 font-bold">
                          <td colSpan={6} className="px-2 py-2 text-right text-xs text-gray-800">
                            TOTAL REAL
                          </td>
                          <td colSpan={3}></td>
                          {columnasExplosivos.map((te) => {
                            const total = (parseFloat(totales[te.id]) || 0) + (parseFloat(extrasTotales[te.id]) || 0);
                            return (
                              <td key={te.id} className="px-2 py-2 text-center text-xs text-gray-900">
                                {total ? total.toLocaleString('es-CL', { maximumFractionDigits: 2 }) : '-'}
                              </td>
                            );
                          })}
                          {esBorrador && <td></td>}
                        </tr>
                      </>
                    )}
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

      {/* Extras: material solicitado después de confirmado, sin tocar las líneas */}
      {reporteId && esConfirmado && !enCorreccion && (
        <Card>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Extras solicitados {extras.length > 0 && `(${extras.length})`}
              </h4>
              <p className="text-xs text-gray-400 mt-0.5">
                Material pedido después de confirmar, sin tocar las cantidades de las líneas. Sale del stock real del polvorín.
              </p>
            </div>
            <Button
              variant="outline"
              icon={HiPlus}
              onClick={() => setMostrarFormExtra((v) => !v)}
            >
              Solicitar Extra
            </Button>
          </div>

          {extras.length === 0 ? (
            <p className="text-gray-500 text-sm py-1">Todavía no se ha solicitado ningún extra para este reporte.</p>
          ) : (
            <div className="flex flex-col gap-2 mb-1">
              {extras.map((ex) => (
                <div key={ex.id} className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                  <div className="font-bold text-violet-700 text-sm min-w-[110px]">
                    + {parseFloat(ex.cantidad).toLocaleString('es-CL', { maximumFractionDigits: 2 })} {ex.tipo_explosivo?.unidad_medida}
                    <div className="text-[11px] font-semibold opacity-75">{ex.tipo_explosivo?.codigo}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    {ex.motivo && <div className="text-sm text-gray-800">"{ex.motivo}"</div>}
                    <div className="text-[11px] text-gray-500 flex gap-2 flex-wrap">
                      {ex.linea_reporte?.frente_trabajo && (
                        <span className="font-semibold text-violet-700">
                          Frente {ex.linea_reporte.frente_trabajo.codigo_completo}
                        </span>
                      )}
                      {ex.personal && <span className="font-semibold">{ex.personal.nombre} {ex.personal.apellido || ''}</span>}
                      <span>{new Date(ex.created_at).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {mostrarFormExtra && (
            <div className="mt-4 border-2 border-dashed border-violet-200 bg-violet-50/60 rounded-xl p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Línea (Frente)</label>
                  <select
                    value={extraForm.id_linea_reporte}
                    onChange={(e) => setExtraForm((f) => ({ ...f, id_linea_reporte: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  >
                    <option value="">Seleccionar...</option>
                    {lineas.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.frente_trabajo?.codigo_completo || `Frente ${l.id_frente_trabajo}`}
                        {l.personal ? ` — ${l.personal.nombre} ${l.personal.apellido || ''}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Explosivo</label>
                  <select
                    value={extraForm.id_tipo_explosivo}
                    onChange={(e) => setExtraForm((f) => ({ ...f, id_tipo_explosivo: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  >
                    <option value="">Seleccionar...</option>
                    {columnasExplosivos.map((te) => (
                      <option key={te.id} value={te.id}>{te.codigo} — {te.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                    Cantidad {extraForm.id_tipo_explosivo && `(${columnasExplosivos.find((t) => t.id === parseInt(extraForm.id_tipo_explosivo))?.unidad_medida || ''})`}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={extraForm.cantidad}
                    onChange={(e) => setExtraForm((f) => ({ ...f, cantidad: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Observaciones (opcional)</label>
                <input
                  type="text"
                  value={extraForm.motivo}
                  onChange={(e) => setExtraForm((f) => ({ ...f, motivo: e.target.value }))}
                  placeholder="Por qué se necesitó el extra"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
                />
              </div>
              {extraForm.id_tipo_explosivo && (
                <p className="text-xs text-gray-500 mb-3">
                  Stock disponible: <span className="font-semibold text-violet-700">
                    {parseFloat(getStockParaTipo(parseInt(extraForm.id_tipo_explosivo))).toLocaleString('es-CL', { maximumFractionDigits: 2 })}
                  </span>
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => { setMostrarFormExtra(false); setExtraForm({ id_tipo_explosivo: '', cantidad: '', motivo: '', id_linea_reporte: '' }); }} disabled={submittingExtra}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={ejecutarRegistrarExtra} disabled={submittingExtra}>
                  {submittingExtra ? 'Registrando...' : 'Registrar extra'}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Devoluciones registradas por el polvorín (solo lectura, en reportes cerrados) */}
      {reporteId && esCerrado && !enCorreccion && (
        <Card>
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Devoluciones al polvorín {devoluciones.length > 0 && `(${devoluciones.length})`}
          </h4>
          {devoluciones.length === 0 ? (
            <p className="text-gray-500 text-sm py-2">
              El polvorín cerró este reporte sin devoluciones — todo lo entregado se consumió.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-3 py-2 text-left font-semibold">Tipo Explosivo</th>
                    <th className="px-3 py-2 text-center font-semibold">Devolución</th>
                    <th className="px-3 py-2 text-left font-semibold">Operador</th>
                    <th className="px-3 py-2 text-left font-semibold">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {devoluciones.map((dev) => (
                    <tr key={dev.id} className="border-b">
                      <td className="px-3 py-2">{dev.tipo_explosivo?.codigo} - {dev.tipo_explosivo?.nombre}</td>
                      <td className="px-3 py-2 text-center font-medium">
                        {parseFloat(dev.cantidad).toLocaleString('es-CL')} {dev.tipo_explosivo?.unidad_medida}
                      </td>
                      <td className="px-3 py-2">
                        {dev.personal ? `${dev.personal.nombre} ${dev.personal.apellido || ''}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{dev.motivo || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-3">
            Las devoluciones las registra el polvorinero al cerrar el reporte. Desde acá solo se pueden revisar durante una corrección.
          </p>
        </Card>
      )}

      {/* Corrección: revisar las devoluciones que el polvorinero registró (solo edición) */}
      {enCorreccion && correccionPrevio === 'cerrado' && (
        <Card className="print:hidden border-l-4 border-amber-400">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Devoluciones del polvorín — revisar
          </h4>
          {devolucionesRevisar.length === 0 ? (
            <p className="text-sm text-gray-500">
              El polvorinero cerró este reporte sin devoluciones. Al confirmar la corrección se vuelve a cerrar igual.
              Si con los cambios algo debería volver al polvorín, avisale para que lo registre.
            </p>
          ) : (
            <>
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                Estas devoluciones las contó el polvorinero. Una devolución es un conteo físico: el sistema no la
                recalcula solo. Ajustá la cantidad si tus cambios lo requieren, o dejala como está. No se pueden
                agregar ni quitar desde acá — eso lo hace el polvorinero.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-3 py-2 text-left font-semibold">Tipo Explosivo</th>
                      <th className="px-3 py-2 text-center font-semibold">Entregado (nuevo total)</th>
                      <th className="px-3 py-2 text-center font-semibold">Devolución</th>
                      <th className="px-3 py-2 text-left font-semibold">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devolucionesRevisar.map((dev, index) => {
                      const idTipo = dev.id_tipo_explosivo ? parseInt(dev.id_tipo_explosivo) : '';
                      const tipo = tipos.find((t) => t.id === idTipo);
                      const nuevoTotal = totales[idTipo];
                      return (
                        <tr key={index} className="border-b">
                          <td className="px-3 py-2">
                            {tipo ? `${tipo.codigo} - ${tipo.nombre}` : `Tipo ${idTipo}`}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-600">
                            {nuevoTotal ? parseFloat(nuevoTotal).toLocaleString('es-CL', { maximumFractionDigits: 2 }) : '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={dev.cantidad}
                              onChange={(e) => actualizarDevolucionRevisar(index, 'cantidad', e.target.value)}
                              className="w-24 px-2 py-1 text-center border border-amber-300 rounded focus:ring-1 focus:ring-amber-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={dev.motivo}
                              onChange={(e) => actualizarDevolucionRevisar(index, 'motivo', e.target.value)}
                              placeholder="Motivo..."
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-red-500"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Botones de accion */}
      {reporteId && (
        <Card className="print:hidden">
          {enCorreccion ? (
            <div className="flex flex-wrap gap-3 justify-between items-center">
              <Button
                variant="outline"
                icon={HiArrowUturnLeft}
                onClick={() => setShowConfirmDescartarCorreccion(true)}
                disabled={submitting}
              >
                Descartar y salir
              </Button>
              <Button
                variant="success"
                icon={HiCheckCircle}
                onClick={() => setShowConfirmConfirmarCorreccion(true)}
                disabled={submitting || lineas.length === 0}
              >
                Confirmar correcciones
              </Button>
            </div>
          ) : (
          <div className="flex flex-wrap gap-3 justify-between">
            <div>
              <Button
                variant="danger"
                icon={HiXCircle}
                onClick={() => setShowConfirmEliminar(true)}
                disabled={submitting}
              >
                Eliminar reporte
              </Button>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              {esBorradorReal && lineas.length > 0 && (
                <Button
                  variant="primary"
                  icon={HiCheckCircle}
                  onClick={() => setShowConfirmConfirmar(true)}
                  disabled={submitting}
                >
                  Confirmar Reporte
                </Button>
              )}
              {esConfirmado && (
                <span className="text-sm text-gray-500">
                  Confirmado — el polvorín lo prepara y cierra desde Explosivos → Solicitudes.
                </span>
              )}
            </div>
          </div>
          )}
        </Card>
      )}

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={showConfirmConfirmar}
        onClose={() => setShowConfirmConfirmar(false)}
        onConfirm={ejecutarConfirmar}
        title="Confirmar Reporte"
        message={`Confirmar reporte ${codigo}? Se guardan las líneas, se valida el stock disponible y se generan los movimientos de salida.`}
        confirmText="Confirmar"
        confirmVariant="primary"
      />

      <ConfirmDialog
        isOpen={showConfirmEliminar}
        onClose={() => setShowConfirmEliminar(false)}
        onConfirm={ejecutarEliminar}
        title="Eliminar reporte"
        message={
          esBorradorReal
            ? `Eliminar el reporte ${codigo}? Esta acción no se puede deshacer.`
            : `Eliminar el reporte ${codigo}? Se revierten sus movimientos de stock (el polvorín queda como si el reporte no existiera) y se borra el reporte con todas sus líneas. Esta acción no se puede deshacer. Si solo querés corregir un dato, usá "Habilitar corrección".`
        }
        confirmText="Eliminar reporte"
        confirmVariant="danger"
      />

      <ConfirmDialog
        isOpen={showConfirmSalir}
        onClose={() => setShowConfirmSalir(false)}
        onConfirm={() => { setShowConfirmSalir(false); onVolver(reporteId); }}
        title={enCorreccion ? 'Corrección en curso' : 'Cambios sin guardar'}
        message={
          enCorreccion
            ? 'Este reporte quedará marcado "En corrección" con sus movimientos de stock revertidos. Podés volver más tarde para confirmar o descartar la corrección. ¿Salir igual?'
            : 'Tiene cambios sin guardar. Esta seguro que desea salir?'
        }
        confirmText={enCorreccion ? 'Salir y seguir después' : 'Salir sin guardar'}
        confirmVariant="danger"
      />

      <ConfirmDialog
        isOpen={showConfirmHabilitarCorreccion}
        onClose={() => setShowConfirmHabilitarCorreccion(false)}
        onConfirm={ejecutarHabilitarCorreccion}
        title="Habilitar corrección"
        message={`Para editar este reporte necesito revertir temporalmente sus movimientos de stock${esCerrado ? ' (salidas y devoluciones del cierre)' : ' (salidas)'}. Cuando termines y confirmes, se regeneran con los valores corregidos. ¿Continuar?`}
        confirmText="Habilitar corrección"
        confirmVariant="primary"
      />

      <ConfirmDialog
        isOpen={showConfirmConfirmarCorreccion}
        onClose={() => setShowConfirmConfirmarCorreccion(false)}
        onConfirm={ejecutarConfirmarCorreccion}
        title="Confirmar correcciones"
        message={
          correccionPrevio === 'cerrado'
            ? `Se regeneran los movimientos de salida con las líneas actuales y el reporte ${codigo} se vuelve a cerrar con las devoluciones que revisaste. ¿Confirmar?`
            : `Se regeneran los movimientos de salida del reporte ${codigo} con las líneas actuales. Se validará el stock disponible. ¿Confirmar?`
        }
        confirmText="Confirmar correcciones"
        confirmVariant="success"
      />

      <ConfirmDialog
        isOpen={showConfirmDescartarCorreccion}
        onClose={() => setShowConfirmDescartarCorreccion(false)}
        onConfirm={ejecutarDescartarCorreccion}
        title="Descartar correcciones"
        message={`Se descartan los cambios y el reporte ${codigo} vuelve a su estado original (${correccionPrevio === 'cerrado' ? 'Cerrado' : 'Confirmado'}) con sus movimientos de stock tal como estaban. ¿Descartar?`}
        confirmText="Descartar y restaurar"
        confirmVariant="danger"
      />

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
