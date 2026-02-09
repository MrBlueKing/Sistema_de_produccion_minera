import { useState, useEffect } from 'react';
import { HiMap, HiTrash, HiRefresh, HiCursorClick, HiPencil, HiViewGridAdd, HiColorSwatch, HiX, HiClock, HiDownload, HiBeaker, HiArrowRight } from 'react-icons/hi';
import {HiExclamationTriangle} from "react-icons/hi2";
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import ConfirmModal from '../../../shared/components/molecules/ConfirmModal';
import mapaService from '../services/mapa';
import dispatchService from '../services/dispatch';
import mezclasService from '../services/mezclas';

export default function MapaTerrenoMejorado({ toast }) {
  const [dumpadas, setDumpadas] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para modales de confirmación
  const [modalEliminarDumpada, setModalEliminarDumpada] = useState({ show: false, dumpada: null });
  const [modalLimpiarDumpadas, setModalLimpiarDumpadas] = useState({ show: false });
  const [modalLimpiarDibujado, setModalLimpiarDibujado] = useState({ show: false });
  const [modalEliminarZona, setModalEliminarZona] = useState({ show: false, zona: null });

  // Estado para mostrar/ocultar panel de historial
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  // Herramientas de dibujo
  const [herramientaActiva, setHerramientaActiva] = useState('seleccionar');
  const [elementosDibujados, setElementosDibujados] = useState([]);
  const [colorSeleccionado, setColorSeleccionado] = useState('#6B7280');
  const [nombreZonaActual, setNombreZonaActual] = useState('');

  // Estados para modo mezcla
  const [modoMezcla, setModoMezcla] = useState(false);
  const [dumpadasSeleccionadasMezcla, setDumpadasSeleccionadasMezcla] = useState([]);
  const [mezclas, setMezclas] = useState([]);
  const [mostrandoCrearMezcla, setMostrandoCrearMezcla] = useState(false);
  const [formMezcla, setFormMezcla] = useState({
    codigo: '',
    observaciones: ''
  });

  // Dimensiones del mapa
  const GRID_SIZE = 40;
  const GRID_COLS = 20;
  const GRID_ROWS = 15;

  // Tipos de elementos
  const TIPO_PARED = 'PARED';
  const TIPO_CERCA = 'CERCA';
  const TIPO_ZONA = 'ZONA';

  useEffect(() => {
    cargarMapa();
  }, []);

  const cargarMapa = async () => {
    setLoading(true);
    try {
      // Cargar dumpadas, zonas y mezclas en paralelo para mejor rendimiento
      const [dumpadasRes, zonasRes, mezclasRes] = await Promise.all([
        dispatchService.getDumpadas({}),
        mapaService.getZonas(),
        mezclasService.getMezclas()
      ]);

      setDumpadas(dumpadasRes.data || []);
      setZonas(zonasRes || []);
      setMezclas(mezclasRes.data || []);

      // Cargar elementos dibujados de las zonas
      const elementos = [];
      (zonasRes || []).forEach(zona => {
        if (zona.coordenadas && Array.isArray(zona.coordenadas)) {
          zona.coordenadas.forEach(coord => {
            elementos.push({
              ...coord,
              zonaId: zona.id,
              zonaColor: zona.color
            });
          });
        }
      });
      setElementosDibujados(elementos);

      console.log('✅ Mapa cargado:', {
        dumpadas: dumpadasRes.data?.length || 0,
        zonas: zonasRes?.length || 0,
        mezclas: mezclasRes.data?.length || 0,
        elementos: elementos.length
      });

    } catch (error) {
      console.error('❌ Error cargando mapa:', error);
      toast.error(
        'Error al cargar el mapa',
        error.response?.data?.message || 'No se pudo cargar la información del mapa. Intente recargar la página.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCeldaClick = async (x, y) => {
    if (herramientaActiva === 'seleccionar') return;

    if (herramientaActiva === 'borrador') {
      // Eliminar elemento en esta posición
      const elementoAEliminar = elementosDibujados.find(el => el.x === x && el.y === y);
      if (elementoAEliminar) {
        setElementosDibujados(prev => prev.filter(el => !(el.x === x && el.y === y)));
        toast.info('Elemento eliminado', `Elemento tipo ${elementoAEliminar.tipo} borrado de la posición (${x}, ${y})`);
      }
      return;
    }

    // Verificar si ya hay un elemento en esta posición
    const elementoExistente = elementosDibujados.find(el => el.x === x && el.y === y);
    if (elementoExistente) {
      toast.warning(
        'Celda ocupada',
        `Ya existe un elemento tipo ${elementoExistente.tipo} en esta posición. Use el borrador para eliminarlo primero.`
      );
      return;
    }

    // Verificar si hay una dumpada en esta posición
    const dumpadaEnPosicion = dumpadas.find(d =>
      Math.floor(d.posicion_x) === x && Math.floor(d.posicion_y) === y
    );
    if (dumpadaEnPosicion) {
      toast.warning(
        'Celda ocupada',
        `Hay una dumpada (#${dumpadaEnPosicion.n_acop}) en esta posición. No se puede dibujar sobre ella.`
      );
      return;
    }

    // Agregar nuevo elemento
    const nuevoElemento = {
      tipo: herramientaActiva.toUpperCase(),
      x,
      y,
      color: colorSeleccionado
    };

    setElementosDibujados(prev => [...prev, nuevoElemento]);
  };

  const handleDropDumpada = async (dumpada, x, y) => {
    if (herramientaActiva !== 'seleccionar') {
      toast.warning(
        'Herramienta incorrecta',
        'Debe activar la herramienta "Seleccionar" para poder mover dumpadas en el mapa'
      );
      return;
    }

    // Verificar si hay otra dumpada en esta posición
    const dumpadaExistente = dumpadas.find(d =>
      d.id !== dumpada.id &&
      Math.floor(d.posicion_x) === x &&
      Math.floor(d.posicion_y) === y
    );

    if (dumpadaExistente) {
      toast.warning(
        'Posición ocupada',
        `Ya existe la dumpada #${dumpadaExistente.n_acop} en esta posición. Elija otra celda.`
      );
      return;
    }

    try {
      await mapaService.actualizarPosicionDumpada(dumpada.id, {
        posicion_x: x,
        posicion_y: y,
        zona_id: null,
      });

      setDumpadas(prev => prev.map(d =>
        d.id === dumpada.id
          ? { ...d, posicion_x: x, posicion_y: y }
          : d
      ));

      toast.success(
        'Dumpada posicionada',
        `Dumpada #${dumpada.n_acop} colocada exitosamente en la posición (${x}, ${y})`
      );
    } catch (error) {
      console.error('❌ Error actualizando posición:', error);
      toast.error(
        'Error al posicionar',
        error.response?.data?.message || 'No se pudo actualizar la posición de la dumpada. Intente nuevamente.'
      );
    }
  };

  const handleGuardarMapa = async () => {
    if (elementosDibujados.length === 0) {
      toast.warning(
        'Sin elementos para guardar',
        'Debe dibujar al menos un elemento (pared, cerca o zona) antes de guardar el mapa'
      );
      return;
    }

    try {
      setLoading(true);

      // Generar nombre de zona si no se proporcionó
      const nombreZona = nombreZonaActual.trim() ||
        `Mapa ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

      await mapaService.crearZona({
        nombre: nombreZona,
        color: colorSeleccionado,
        coordenadas: elementosDibujados,
        descripcion: `Zona creada desde el editor de mapa con ${elementosDibujados.length} elemento(s)`,
        activa: true
      });

      toast.success(
        'Mapa guardado exitosamente',
        `La zona "${nombreZona}" con ${elementosDibujados.length} elemento(s) ha sido guardada correctamente`
      );
      setNombreZonaActual('');
      setElementosDibujados([]); // Limpiar elementos dibujados después de guardar
      await cargarMapa();
    } catch (error) {
      console.error('❌ Error guardando mapa:', error);
      toast.error(
        'Error al guardar el mapa',
        error.response?.data?.message || 'No se pudo guardar la zona del mapa. Verifique su conexión e intente nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLimpiarDibujado = () => {
    setModalLimpiarDibujado({ show: true });
  };

  const confirmarLimpiarDibujado = () => {
    setModalLimpiarDibujado({ show: false });
    setElementosDibujados([]);
    toast.info('Elementos borrados', 'Los elementos dibujados han sido eliminados correctamente');
  };

  const handleEliminarPosicionDumpada = (dumpada) => {
    setModalEliminarDumpada({ show: true, dumpada });
  };

  const confirmarEliminarDumpada = async () => {
    const dumpada = modalEliminarDumpada.dumpada;
    setModalEliminarDumpada({ show: false, dumpada: null });

    if (!dumpada) return;

    try {
      setLoading(true);
      await mapaService.actualizarPosicionDumpada(dumpada.id, {
        posicion_x: null,
        posicion_y: null,
        zona_id: null,
      });

      setDumpadas(prev => prev.map(d =>
        d.id === dumpada.id
          ? { ...d, posicion_x: null, posicion_y: null, zona_id: null }
          : d
      ));

      toast.success('Dumpada removida', `La dumpada #${dumpada.n_acop} ha sido quitada del mapa exitosamente`);
    } catch (error) {
      console.error('Error al quitar dumpada del mapa:', error);
      toast.error(
        'Error al quitar dumpada',
        error.response?.data?.message || 'No se pudo remover la dumpada del mapa. Intente nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarTodasPosiciones = () => {
    setModalLimpiarDumpadas({ show: true });
  };

  const confirmarLimpiarDumpadas = async () => {
    setModalLimpiarDumpadas({ show: false });

    try {
      setLoading(true);
      const dumpadasEnMapa = dumpadas.filter(d => d.posicion_x !== null && d.posicion_y !== null);

      if (dumpadasEnMapa.length === 0) {
        toast.info('Sin cambios', 'No hay dumpadas en el mapa para remover');
        return;
      }

      // Procesar en lote con Promise.all para mejor rendimiento
      await Promise.all(
        dumpadasEnMapa.map(dumpada =>
          mapaService.actualizarPosicionDumpada(dumpada.id, {
            posicion_x: null,
            posicion_y: null,
            zona_id: null,
          })
        )
      );

      await cargarMapa();
      toast.success(
        'Mapa limpiado exitosamente',
        `${dumpadasEnMapa.length} dumpada${dumpadasEnMapa.length > 1 ? 's han' : ' ha'} sido removida${dumpadasEnMapa.length > 1 ? 's' : ''} del mapa`
      );
    } catch (error) {
      console.error('Error al limpiar el mapa:', error);
      toast.error(
        'Error al limpiar mapa',
        error.response?.data?.message || 'No se pudieron remover todas las dumpadas. Intente nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarZona = (zona) => {
    setModalEliminarZona({ show: true, zona });
  };

  const confirmarEliminarZona = async () => {
    const zona = modalEliminarZona.zona;
    setModalEliminarZona({ show: false, zona: null });

    if (!zona) return;

    try {
      setLoading(true);
      await mapaService.eliminarZona(zona.id);

      toast.success(
        'Zona eliminada',
        `La zona "${zona.nombre}" ha sido eliminada correctamente del historial`
      );

      await cargarMapa();
    } catch (error) {
      console.error('❌ Error eliminando zona:', error);
      toast.error(
        'Error al eliminar zona',
        error.response?.data?.message || 'No se pudo eliminar la zona. Intente nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCargarZona = async (zona) => {
    try {
      if (zona.coordenadas && Array.isArray(zona.coordenadas)) {
        setElementosDibujados(zona.coordenadas.map(coord => ({
          ...coord,
          zonaId: zona.id,
          zonaColor: zona.color
        })));
        setColorSeleccionado(zona.color || '#6B7280');
        setNombreZonaActual('');
        toast.success(
          'Zona cargada',
          `Los elementos de "${zona.nombre}" han sido cargados en el editor`
        );
      }
    } catch (error) {
      console.error('❌ Error cargando zona:', error);
      toast.error('Error', 'No se pudo cargar la zona');
    }
  };

  // ========== FUNCIONES PARA MODO MEZCLA ==========

  const toggleModoMezcla = () => {
    if (modoMezcla) {
      // Salir del modo mezcla
      setModoMezcla(false);
      setDumpadasSeleccionadasMezcla([]);
      toast.info('Modo mezcla desactivado', 'Volviendo al modo normal del mapa');
    } else {
      // Entrar al modo mezcla
      const dumpadasCompletadas = dumpadasEnMapa.filter(d => d.estado === 'Completado' && d.ley);
      if (dumpadasCompletadas.length === 0) {
        toast.warning(
          'Sin dumpadas disponibles',
          'No hay dumpadas completadas en el mapa para crear mezclas. Coloca dumpadas con ley de laboratorio primero.'
        );
        return;
      }
      setModoMezcla(true);
      setDumpadasSeleccionadasMezcla([]);
      toast.success(
        'Modo mezcla activado',
        `Haz clic en las dumpadas del mapa para agregarlas a la mezcla (${dumpadasCompletadas.length} disponibles)`
      );
    }
  };

  const handleClickDumpadaMezcla = (dumpada) => {
    if (!modoMezcla) return;

    // Validar que la dumpada esté completada y tenga ley
    if (dumpada.estado !== 'Completado' || !dumpada.ley) {
      toast.warning(
        'Dumpada no válida',
        `La dumpada #${dumpada.n_acop} debe estar completada y tener ley del laboratorio para ser agregada a la mezcla`
      );
      return;
    }

    // Verificar si ya está seleccionada
    const yaSeleccionada = dumpadasSeleccionadasMezcla.find(d => d.id === dumpada.id);

    if (yaSeleccionada) {
      // Deseleccionar
      setDumpadasSeleccionadasMezcla(prev => prev.filter(d => d.id !== dumpada.id));
      toast.info('Dumpada removida', `Dumpada #${dumpada.n_acop} quitada de la mezcla`);
    } else {
      // Seleccionar
      setDumpadasSeleccionadasMezcla(prev => [...prev, dumpada]);
      toast.success('Dumpada agregada', `Dumpada #${dumpada.n_acop} agregada a la mezcla`);
    }
  };

  const calcularTotalesMezcla = () => {
    if (dumpadasSeleccionadasMezcla.length === 0) {
      return {
        totalToneladas: 0,
        leyPromedioDump: 0,
        leyPromedioVisual: 0,
        leyPromedioLote: 0,
        cantidadDumpadas: 0
      };
    }

    const totalTon = dumpadasSeleccionadasMezcla.reduce((sum, d) => sum + parseFloat(d.ton || 0), 0);

    // Ley dump ajustada (ley * 0.9)
    const sumaDumpPonderada = dumpadasSeleccionadasMezcla.reduce((sum, d) => {
      const leyAjustada = d.ley ? parseFloat(d.ley) * 0.9 : 0;
      return sum + (parseFloat(d.ton || 0) * leyAjustada);
    }, 0);

    // Ley visual
    const sumaVisualPonderada = dumpadasSeleccionadasMezcla.reduce((sum, d) => {
      return sum + (parseFloat(d.ton || 0) * parseFloat(d.ley_visual || 0));
    }, 0);

    // Ley lote (si hay ley usar esa, sino ley_visual, ambas * 0.9)
    const sumaLotePonderada = dumpadasSeleccionadasMezcla.reduce((sum, d) => {
      const leyParaLote = d.ley ? parseFloat(d.ley) : parseFloat(d.ley_visual || 0);
      const leyLote = leyParaLote * 0.9;
      return sum + (parseFloat(d.ton || 0) * leyLote);
    }, 0);

    return {
      totalToneladas: totalTon.toFixed(2),
      leyPromedioDump: totalTon > 0 ? (sumaDumpPonderada / totalTon).toFixed(3) : '0.000',
      leyPromedioVisual: totalTon > 0 ? (sumaVisualPonderada / totalTon).toFixed(3) : '0.000',
      leyPromedioLote: totalTon > 0 ? (sumaLotePonderada / totalTon).toFixed(3) : '0.000',
      cantidadDumpadas: dumpadasSeleccionadasMezcla.length
    };
  };

  const limpiarSeleccionMezcla = () => {
    setDumpadasSeleccionadasMezcla([]);
    toast.info('Selección limpiada', 'Todas las dumpadas han sido deseleccionadas');
  };

  const irACrearMezcla = () => {
    if (dumpadasSeleccionadasMezcla.length === 0) {
      toast.warning('Sin dumpadas seleccionadas', 'Selecciona al menos una dumpada para crear la mezcla');
      return;
    }

    // Generar código sugerido
    const fechaHoy = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2); // YYMMDD
    const codigoSugerido = `MZ${fechaHoy}`;

    setFormMezcla({
      codigo: codigoSugerido,
      observaciones: `Mezcla creada desde el mapa con ${dumpadasSeleccionadasMezcla.length} dumpadas`
    });
    setMostrandoCrearMezcla(true);
  };

  const handleCrearMezclaDirecta = async () => {
    if (!formMezcla.codigo.trim()) {
      toast.warning('Código requerido', 'Debes ingresar un código para la mezcla');
      return;
    }

    try {
      setLoading(true);

      const data = {
        codigo: formMezcla.codigo.trim(),
        fecha: new Date().toISOString().split('T')[0],
        dumpadas: dumpadasSeleccionadasMezcla.map(d => d.id),
        observaciones: formMezcla.observaciones.trim() || null
      };

      console.log('📦 Creando mezcla:', data);

      const resultado = await mezclasService.createMezcla(data);

      toast.success(
        '¡Mezcla creada exitosamente!',
        `Mezcla "${formMezcla.codigo}" con ${dumpadasSeleccionadasMezcla.length} dumpadas creada correctamente`
      );

      // Resetear estados
      setMostrandoCrearMezcla(false);
      setModoMezcla(false);
      setDumpadasSeleccionadasMezcla([]);
      setFormMezcla({ codigo: '', observaciones: '' });

      // Recargar el mapa para mostrar la nueva mezcla
      await cargarMapa();

    } catch (error) {
      console.error('❌ Error creando mezcla:', error);
      toast.error(
        'Error al crear mezcla',
        error.response?.data?.message || 'No se pudo crear la mezcla. Verifica el código e intenta nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancelarCrearMezcla = () => {
    setMostrandoCrearMezcla(false);
    setFormMezcla({ codigo: '', observaciones: '' });
  };

  const handleDragStart = (e, dumpada) => {
    if (herramientaActiva !== 'seleccionar') {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('dumpada', JSON.stringify(dumpada));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, x, y) => {
    e.preventDefault();
    const dumpadaData = JSON.parse(e.dataTransfer.getData('dumpada'));
    handleDropDumpada(dumpadaData, x, y);
  };

  // Separar dumpadas por posición ANTES del render
  const dumpadasEnMapa = dumpadas.filter(d => d.posicion_x !== null && d.posicion_y !== null);
  const dumpadasSinPosicion = dumpadas.filter(d => d.posicion_x === null || d.posicion_y === null);

  // Función helper para obtener la mezcla de una dumpada
  const getMezclaDeDumpada = (dumpadaId) => {
    for (const mezcla of mezclas) {
      if (mezcla.detalles && mezcla.detalles.some(d => d.dumpada_id === dumpadaId)) {
        return mezcla;
      }
    }
    return null;
  };

  // Obtener color de mezcla por ID
  const getColorMezcla = (mezclaId) => {
    const colores = [
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#F59E0B', // Amber
      '#10B981', // Emerald
      '#3B82F6', // Blue
      '#EF4444', // Red
      '#6366F1', // Indigo
      '#14B8A6', // Teal
    ];
    return colores[mezclaId % colores.length];
  };

  const getColorPorEstado = (estado) => {
    switch (estado) {
      case 'Completado':
        return 'bg-green-500';
      case 'Ingresado':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getEstiloElemento = (tipo, color) => {
    switch (tipo) {
      case TIPO_PARED:
        return {
          backgroundColor: color || '#374151',
          border: '2px solid #1F2937'
        };
      case TIPO_CERCA:
        return {
          backgroundColor: 'transparent',
          border: `3px solid ${color || '#92400E'}`,
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(146, 64, 14, 0.1) 10px, rgba(146, 64, 14, 0.1) 20px)'
        };
      case TIPO_ZONA:
        return {
          backgroundColor: color || '#DBEAFE',
          border: '1px dashed #3B82F6'
        };
      default:
        return {};
    }
  };

  if (loading) {
    return (
      <Card className="border-l-4 border-blue-400">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando mapa...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modal: Confirmar eliminar dumpada individual */}
      <ConfirmModal
        show={modalEliminarDumpada.show}
        onConfirm={confirmarEliminarDumpada}
        onCancel={() => setModalEliminarDumpada({ show: false, dumpada: null })}
        title="¿Quitar Dumpada del Mapa?"
        message={`Estás a punto de remover la dumpada del mapa:`}
        highlightText={modalEliminarDumpada.dumpada ? `#${modalEliminarDumpada.dumpada.n_acop} - ${modalEliminarDumpada.dumpada.acopios}` : ''}
        warningText="La dumpada volverá al panel lateral pero no se eliminará del sistema."
        confirmText="Quitar del Mapa"
        cancelText="Cancelar"
        variant="warning"
        icon={HiX}
      />

      {/* Modal: Confirmar limpiar todas las dumpadas */}
      <ConfirmModal
        show={modalLimpiarDumpadas.show}
        onConfirm={confirmarLimpiarDumpadas}
        onCancel={() => setModalLimpiarDumpadas({ show: false })}
        title="¿Limpiar Todas las Dumpadas?"
        message="Estás a punto de remover TODAS las dumpadas del mapa."
        highlightText={`${dumpadasEnMapa.length} dumpada${dumpadasEnMapa.length > 1 ? 's' : ''} ${dumpadasEnMapa.length > 1 ? 'serán removidas' : 'será removida'}`}
        warningText="Las dumpadas volverán al panel lateral pero no se eliminarán del sistema."
        confirmText="Limpiar Todas"
        cancelText="Cancelar"
        variant="danger"
        icon={HiTrash}
      />

      {/* Modal: Confirmar limpiar elementos dibujados */}
      <ConfirmModal
        show={modalLimpiarDibujado.show}
        onConfirm={confirmarLimpiarDibujado}
        onCancel={() => setModalLimpiarDibujado({ show: false })}
        title="¿Borrar Elementos Dibujados?"
        message="Estás a punto de eliminar todos los elementos dibujados en el mapa."
        highlightText={`${elementosDibujados.length} elemento${elementosDibujados.length > 1 ? 's' : ''} (paredes, cercas, zonas)`}
        warningText="Esta acción no afectará las dumpadas posicionadas. Solo se borrarán los elementos decorativos."
        confirmText="Borrar Elementos"
        cancelText="Cancelar"
        variant="warning"
        icon={HiTrash}
      />

      {/* Modal: Confirmar eliminar zona del historial */}
      <ConfirmModal
        show={modalEliminarZona.show}
        onConfirm={confirmarEliminarZona}
        onCancel={() => setModalEliminarZona({ show: false, zona: null })}
        title="¿Eliminar Zona del Historial?"
        message="Estás a punto de eliminar permanentemente esta zona guardada:"
        highlightText={modalEliminarZona.zona ? `"${modalEliminarZona.zona.nombre}"` : ''}
        warningText="Esta acción es permanente y no se puede deshacer. La zona será eliminada del historial."
        confirmText="Eliminar Zona"
        cancelText="Cancelar"
        variant="danger"
        icon={HiTrash}
      />

      {/* Modal: Crear Mezcla */}
      {mostrandoCrearMezcla && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <HiBeaker className="w-7 h-7 text-purple-600" />
                Crear Nueva Mezcla
              </h3>
              <button
                onClick={handleCancelarCrearMezcla}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <HiX className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Resumen de dumpadas seleccionadas */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 mb-6">
              <h4 className="font-bold text-gray-900 mb-3">Dumpadas Seleccionadas ({dumpadasSeleccionadasMezcla.length})</h4>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <span className="text-sm text-gray-600">Total Ton:</span>
                  <p className="text-lg font-bold text-blue-600">{calcularTotalesMezcla().totalToneladas}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Ley Dump (ajust.):</span>
                  <p className="text-lg font-bold text-green-600">{calcularTotalesMezcla().leyPromedioDump}%</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Ley Visual:</span>
                  <p className="text-lg font-bold text-yellow-600">{calcularTotalesMezcla().leyPromedioVisual}%</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Ley Lote:</span>
                  <p className="text-lg font-bold text-indigo-600">{calcularTotalesMezcla().leyPromedioLote}%</p>
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {dumpadasSeleccionadasMezcla.map(d => (
                  <div key={d.id} className="text-xs bg-white px-2 py-1 rounded flex justify-between">
                    <span className="font-semibold">#{d.n_acop} - {d.acopios}</span>
                    <span className="text-gray-600">{parseFloat(d.ton).toFixed(2)} Ton</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Formulario */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Código de la Mezcla *
                </label>
                <input
                  type="text"
                  value={formMezcla.codigo}
                  onChange={(e) => setFormMezcla({ ...formMezcla, codigo: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  placeholder="Ej: MZ251118"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observaciones (Opcional)
                </label>
                <textarea
                  value={formMezcla.observaciones}
                  onChange={(e) => setFormMezcla({ ...formMezcla, observaciones: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  placeholder="Ingresa cualquier nota adicional sobre esta mezcla..."
                  rows={3}
                />
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-3 mt-6">
              <Button
                variant="success"
                className="flex-1"
                icon={HiBeaker}
                onClick={handleCrearMezclaDirecta}
                disabled={loading || !formMezcla.codigo.trim()}
              >
                {loading ? 'Creando...' : `Crear Mezcla (${dumpadasSeleccionadasMezcla.length} dumpadas)`}
              </Button>
              <Button
                variant="secondary"
                onClick={handleCancelarCrearMezcla}
                disabled={loading}
              >
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Header */}
      <Card className="border-l-4 border-blue-400">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <HiMap className="w-7 h-7 text-blue-600" />
              Editor de Mapa de Terreno
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {dumpadasEnMapa.length} dumpadas • {elementosDibujados.length} elementos dibujados
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={modoMezcla ? "success" : "secondary"}
              size="sm"
              icon={HiBeaker}
              onClick={toggleModoMezcla}
            >
              {modoMezcla ? 'Salir de' : 'Modo'} Mezcla
            </Button>
            <Button
              variant={mostrarHistorial ? "primary" : "secondary"}
              size="sm"
              icon={HiClock}
              onClick={() => setMostrarHistorial(!mostrarHistorial)}
            >
              {mostrarHistorial ? 'Ocultar' : 'Ver'} Historial ({zonas.length})
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={HiTrash}
              onClick={handleEliminarTodasPosiciones}
              disabled={dumpadasEnMapa.length === 0 || modoMezcla}
            >
              Limpiar Dumpadas
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={HiRefresh}
              onClick={cargarMapa}
            >
              Recargar
            </Button>
          </div>
        </div>

        {/* Banner de Modo Mezcla Activo */}
        {modoMezcla && (
          <div className="mt-4 bg-gradient-to-r from-purple-100 to-pink-100 border-2 border-purple-400 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <HiBeaker className="w-6 h-6 text-purple-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-purple-900">Modo Mezcla Activado</p>
                <p className="text-sm text-purple-700">
                  Haz clic en las dumpadas verdes (completadas) del mapa para agregarlas a la mezcla
                </p>
              </div>
              {dumpadasSeleccionadasMezcla.length > 0 && (
                <div className="bg-purple-600 text-white px-4 py-2 rounded-full font-bold">
                  {dumpadasSeleccionadasMezcla.length} seleccionada{dumpadasSeleccionadasMezcla.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Panel de Historial de Mapas Guardados */}
      {mostrarHistorial && zonas.length > 0 && (
        <Card className="border-l-4 border-indigo-400">
          <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <HiClock className="w-6 h-6 text-indigo-600" />
            Historial de Mapas Guardados
          </h4>
          <p className="text-sm text-gray-600 mb-4">
            {zonas.length} zona{zonas.length > 1 ? 's' : ''} guardada{zonas.length > 1 ? 's' : ''}. Haz clic en "Cargar" para editar una zona guardada.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zonas.map(zona => (
              <div
                key={zona.id}
                className="border-2 border-gray-200 rounded-lg p-4 hover:border-indigo-400 transition-all bg-white"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h5 className="font-bold text-gray-900 mb-1">{zona.nombre}</h5>
                    <p className="text-xs text-gray-600 mb-2">
                      {zona.descripcion || 'Sin descripción'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <div
                          className="w-4 h-4 rounded border border-gray-300"
                          style={{ backgroundColor: zona.color || '#6B7280' }}
                        ></div>
                        {zona.coordenadas?.length || 0} elementos
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleCargarZona(zona)}
                    className="flex-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                  >
                    <HiDownload className="w-4 h-4" />
                    Cargar
                  </button>
                  <button
                    onClick={() => handleEliminarZona(zona)}
                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-semibold transition-colors"
                  >
                    <HiTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {mostrarHistorial && zonas.length === 0 && (
        <Card className="border-l-4 border-gray-400">
          <div className="text-center py-8">
            <HiClock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-semibold">No hay mapas guardados</p>
            <p className="text-sm text-gray-500 mt-1">
              Dibuja elementos y guárdalos para crear tu primer mapa
            </p>
          </div>
        </Card>
      )}

      {/* Panel de Mezclas Creadas */}
      {mezclas.length > 0 && (
        <Card className="border-l-4 border-purple-400">
          <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <HiBeaker className="w-6 h-6 text-purple-600" />
            Mezclas Activas ({mezclas.length})
          </h4>
          <p className="text-sm text-gray-600 mb-4">
            Las dumpadas que pertenecen a una mezcla se muestran con un borde de color en el mapa
          </p>

          <div className="space-y-3">
            {mezclas.map(mezcla => {
              const dumpadasEnMezcla = mezcla.detalles?.filter(d => d.tipo === 'DUMP').length || 0;
              const colorMezcla = getColorMezcla(mezcla.id);

              // Calcular información de lotes si existe
              const loteActivo = mezcla.lotes_venta?.[0]; // Asumir que hay un lote activo
              const pesoDespachado = loteActivo?.peso_despachado || 0;
              const pesoTotal = parseFloat(mezcla.total_ton || 0);
              const pesoRestante = pesoTotal - pesoDespachado;
              const porcentajeDespachado = pesoTotal > 0 ? ((pesoDespachado / pesoTotal) * 100) : 0;

              return (
                <div
                  key={mezcla.id}
                  className="border-2 rounded-lg p-4 hover:shadow-md transition-all bg-white"
                  style={{ borderColor: colorMezcla }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: colorMezcla }}
                        ></div>
                        <h5 className="font-bold text-gray-900">{mezcla.codigo}</h5>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          mezcla.estado === 'Completado' ? 'bg-green-100 text-green-700' :
                          mezcla.estado === 'En Análisis' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {mezcla.estado}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        {dumpadasEnMezcla} dumpada{dumpadasEnMezcla > 1 ? 's' : ''} • {pesoTotal.toFixed(2)} Ton
                      </p>
                    </div>
                  </div>

                  {/* Barra de progreso de despacho */}
                  {loteActivo && (
                    <div className="mt-3 mb-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">Despachado:</span>
                        <span className="font-bold text-blue-600">
                          {pesoDespachado.toFixed(2)} / {pesoTotal.toFixed(2)} Ton ({porcentajeDespachado.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(porcentajeDespachado, 100)}%`,
                            backgroundColor: porcentajeDespachado >= 100 ? '#10B981' : colorMezcla
                          }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Restante: <span className="font-bold">{Math.max(pesoRestante, 0).toFixed(2)} Ton</span>
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div>
                      <span className="text-gray-600">Ley Dump:</span>
                      <p className="font-bold text-green-600">{parseFloat(mezcla.ley_prom_dump || 0).toFixed(3)}%</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Ley Visual:</span>
                      <p className="font-bold text-yellow-600">{parseFloat(mezcla.ley_prom_visual || 0).toFixed(3)}%</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Ley Lote:</span>
                      <p className="font-bold text-indigo-600">{parseFloat(mezcla.ley_prom_lote || 0).toFixed(3)}%</p>
                    </div>
                  </div>

                  {mezcla.observaciones && (
                    <p className="text-xs text-gray-500 mt-2 italic">"{mezcla.observaciones}"</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Toolbar de herramientas */}
      <Card className="border-l-4 border-purple-400">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-bold text-gray-900">🛠️ Herramientas de Dibujo</h4>
          <div className="text-sm text-gray-600">
            {elementosDibujados.length > 0 && (
              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-semibold">
                {elementosDibujados.length} elemento{elementosDibujados.length > 1 ? 's' : ''} dibujado{elementosDibujados.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <button
            onClick={() => setHerramientaActiva('seleccionar')}
            className={`p-3 rounded-lg border-2 transition-all ${
              herramientaActiva === 'seleccionar'
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-gray-300 hover:border-blue-300'
            }`}
            title="Seleccionar y mover dumpadas en el mapa"
          >
            <HiCursorClick className="w-6 h-6 mx-auto mb-1" />
            <p className="text-xs font-semibold">Seleccionar</p>
          </button>

          <button
            onClick={() => setHerramientaActiva('pared')}
            className={`p-3 rounded-lg border-2 transition-all ${
              herramientaActiva === 'pared'
                ? 'border-gray-700 bg-gray-100 shadow-md'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            title="Dibujar paredes sólidas en el mapa"
          >
            <div className="w-6 h-6 mx-auto mb-1 bg-gray-700 rounded"></div>
            <p className="text-xs font-semibold">Pared</p>
          </button>

          <button
            onClick={() => setHerramientaActiva('cerca')}
            className={`p-3 rounded-lg border-2 transition-all ${
              herramientaActiva === 'cerca'
                ? 'border-yellow-700 bg-yellow-50 shadow-md'
                : 'border-gray-300 hover:border-yellow-400'
            }`}
            title="Dibujar cercas o límites perimetrales"
          >
            <div className="w-6 h-6 mx-auto mb-1 border-2 border-yellow-700 rounded"></div>
            <p className="text-xs font-semibold">Cerca</p>
          </button>

          <button
            onClick={() => setHerramientaActiva('zona')}
            className={`p-3 rounded-lg border-2 transition-all ${
              herramientaActiva === 'zona'
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-gray-300 hover:border-blue-300'
            }`}
            title="Marcar zonas o áreas específicas"
          >
            <HiViewGridAdd className="w-6 h-6 mx-auto mb-1" />
            <p className="text-xs font-semibold">Zona</p>
          </button>

          <button
            onClick={() => setHerramientaActiva('borrador')}
            className={`p-3 rounded-lg border-2 transition-all ${
              herramientaActiva === 'borrador'
                ? 'border-red-500 bg-red-50 shadow-md'
                : 'border-gray-300 hover:border-red-300'
            }`}
            title="Borrar elementos dibujados del mapa"
          >
            <HiX className="w-6 h-6 mx-auto mb-1" />
            <p className="text-xs font-semibold">Borrador</p>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={colorSeleccionado}
                onChange={(e) => setColorSeleccionado(e.target.value)}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={colorSeleccionado}
                onChange={(e) => setColorSeleccionado(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="#6B7280"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nombre del mapa (opcional)
            </label>
            <input
              type="text"
              value={nombreZonaActual}
              onChange={(e) => setNombreZonaActual(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Ej: Zona Norte"
            />
          </div>

          <div className="flex items-end gap-2">
            <Button
              variant="success"
              size="sm"
              onClick={handleGuardarMapa}
              disabled={elementosDibujados.length === 0}
              className="flex-1"
            >
              Guardar Mapa
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={HiTrash}
              onClick={handleLimpiarDibujado}
              disabled={elementosDibujados.length === 0}
            >
              Limpiar
            </Button>
          </div>
        </div>
      </Card>

      <div className={`grid grid-cols-1 gap-6 ${modoMezcla ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        {/* Panel izquierdo - Dumpadas disponibles */}
        <div className="lg:col-span-1">
          <Card className="border-l-4 border-yellow-400 h-full">
            <h4 className="text-lg font-bold text-gray-900 mb-4">
              📦 Dumpadas Disponibles ({dumpadasSinPosicion.length})
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              💡 <strong>Tip:</strong> Arrastra las dumpadas al mapa con la herramienta "Seleccionar" activa
            </p>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {dumpadasSinPosicion.length === 0 ? (
                <div className="text-center py-8 bg-green-50 rounded-lg border-2 border-dashed border-green-300">
                  <p className="text-sm text-green-700 font-semibold">✅ Todas las dumpadas están en el mapa</p>
                  <p className="text-xs text-green-600 mt-2">No hay dumpadas pendientes de posicionar</p>
                </div>
              ) : (
                dumpadasSinPosicion.map(dumpada => (
                  <div
                    key={dumpada.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, dumpada)}
                    className="p-3 bg-white border-2 border-gray-300 rounded-lg cursor-move hover:border-blue-500 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm">#{dumpada.n_acop}</p>
                        <p className="text-xs text-gray-600">{dumpada.acopios}</p>
                      </div>
                      <span className={`${getColorPorEstado(dumpada.estado)} text-white px-2 py-1 rounded text-xs font-bold`}>
                        {dumpada.estado}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Mapa */}
        <div className={modoMezcla ? "lg:col-span-3" : "lg:col-span-3"}>
          <Card className="border-l-4 border-green-400">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-bold text-gray-900">
                  🗺️ Terreno ({GRID_COLS}x{GRID_ROWS})
                </h4>
                <p className="text-xs text-gray-600 mt-1">
                  {dumpadasEnMapa.length} dumpada{dumpadasEnMapa.length !== 1 ? 's' : ''} posicionada{dumpadasEnMapa.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-700">
                  Herramienta activa:
                </div>
                <div className={`text-sm font-bold px-3 py-1 rounded-full inline-block ${
                  herramientaActiva === 'seleccionar' ? 'bg-blue-100 text-blue-700' :
                  herramientaActiva === 'pared' ? 'bg-gray-100 text-gray-700' :
                  herramientaActiva === 'cerca' ? 'bg-yellow-100 text-yellow-700' :
                  herramientaActiva === 'zona' ? 'bg-blue-100 text-blue-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {herramientaActiva.charAt(0).toUpperCase() + herramientaActiva.slice(1)}
                </div>
              </div>
            </div>

            {/* Mensaje cuando el mapa está vacío */}
            {dumpadasEnMapa.length === 0 && elementosDibujados.length === 0 && (
              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-900">
                  <strong>📌 Comience a trabajar:</strong>
                </p>
                <ul className="text-sm text-blue-700 mt-2 space-y-1 ml-4">
                  <li>• Arrastre dumpadas desde el panel izquierdo al mapa (con herramienta "Seleccionar")</li>
                  <li>• Use las herramientas de dibujo para crear paredes, cercas o zonas</li>
                  <li>• Las dumpadas se moverán con un simple arrastrar y soltar</li>
                  <li>• Puede quitar dumpadas del mapa haciendo clic en el botón X que aparece al pasar el cursor</li>
                </ul>
              </div>
            )}

            <div
              className="relative bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg p-4 overflow-auto"
              style={{ maxHeight: '700px' }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${GRID_COLS}, ${GRID_SIZE}px)`,
                  gridTemplateRows: `repeat(${GRID_ROWS}, ${GRID_SIZE}px)`,
                  gap: '1px',
                  backgroundColor: '#cbd5e1',
                }}
              >
                {Array.from({ length: GRID_ROWS }).map((_, row) => (
                  Array.from({ length: GRID_COLS }).map((_, col) => {
                    const dumpadaEnCelda = dumpadasEnMapa.find(
                      d => Math.floor(d.posicion_x) === col && Math.floor(d.posicion_y) === row
                    );

                    const elementoEnCelda = elementosDibujados.find(
                      el => el.x === col && el.y === row
                    );

                    return (
                      <div
                        key={`${row}-${col}`}
                        onClick={() => handleCeldaClick(col, row)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, col, row)}
                        className={`bg-white transition-colors ${
                          herramientaActiva === 'seleccionar' ? 'hover:bg-blue-50' :
                          herramientaActiva === 'borrador' ? 'hover:bg-red-50' :
                          'hover:bg-green-50 cursor-crosshair'
                        }`}
                        style={{
                          width: `${GRID_SIZE}px`,
                          height: `${GRID_SIZE}px`,
                          ...(elementoEnCelda ? getEstiloElemento(elementoEnCelda.tipo, elementoEnCelda.color) : {})
                        }}
                        title={
                          dumpadaEnCelda ? `#${dumpadaEnCelda.n_acop} - ${dumpadaEnCelda.acopios}` :
                          elementoEnCelda ? `${elementoEnCelda.tipo}` :
                          `Celda ${col}, ${row}`
                        }
                      >
                        {dumpadaEnCelda && (() => {
                          const mezcla = getMezclaDeDumpada(dumpadaEnCelda.id);
                          const colorMezcla = mezcla ? getColorMezcla(mezcla.id) : null;

                          return (
                            <div
                              className={`w-full h-full ${getColorPorEstado(dumpadaEnCelda.estado)} rounded flex items-center justify-center text-white text-xs font-bold relative group ${
                                modoMezcla
                                  ? (dumpadaEnCelda.estado === 'Completado' && dumpadaEnCelda.ley ? 'cursor-pointer hover:ring-4 hover:ring-purple-400' : 'cursor-not-allowed opacity-50')
                                  : 'cursor-move'
                              } ${
                                dumpadasSeleccionadasMezcla.find(d => d.id === dumpadaEnCelda.id)
                                  ? 'ring-4 ring-purple-500 animate-pulse'
                                  : ''
                              }`}
                              style={mezcla ? {
                                boxShadow: `inset 0 0 0 3px ${colorMezcla}`,
                                border: `2px solid ${colorMezcla}`
                              } : {}}
                              draggable={!modoMezcla && !mezcla}
                              onDragStart={(e) => (!modoMezcla && !mezcla) && handleDragStart(e, dumpadaEnCelda)}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (modoMezcla) {
                                  handleClickDumpadaMezcla(dumpadaEnCelda);
                                }
                              }}
                              title={mezcla ? `Mezcla: ${mezcla.codigo}` : `Dumpada #${dumpadaEnCelda.n_acop}`}
                            >
                              {/* Badge de mezcla */}
                              {mezcla && (
                                <div
                                  className="absolute -top-2 -left-2 text-xs px-1 rounded shadow-md font-bold"
                                  style={{
                                    backgroundColor: colorMezcla,
                                    color: 'white',
                                    fontSize: '9px'
                                  }}
                                >
                                  {mezcla.codigo}
                                </div>
                              )}
                              {dumpadaEnCelda.n_acop}
                            {/* Botón X para quitar del mapa (solo en modo normal) */}
                            {!modoMezcla && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEliminarPosicionDumpada(dumpadaEnCelda);
                                }}
                                className="absolute top-0 right-0 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Quitar del mapa"
                              >
                                <HiX className="w-3 h-3" />
                              </button>
                            )}
                            {/* Indicador de selección en modo mezcla */}
                            {modoMezcla && dumpadasSeleccionadasMezcla.find(d => d.id === dumpadaEnCelda.id) && (
                              <div className="absolute -top-1 -right-1 bg-purple-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">
                                ✓
                              </div>
                            )}
                          </div>
                          );
                        })()}
                      </div>
                    );
                  })
                ))}
              </div>
            </div>

            {/* Leyenda */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span>Completado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span>Ingresado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-700 rounded"></div>
                <span>Pared</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-yellow-700 rounded"></div>
                <span>Cerca</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-200 border border-dashed border-blue-500 rounded"></div>
                <span>Zona</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Panel derecho - Resumen de Mezcla (solo en modo mezcla) */}
        {modoMezcla && (
          <div className="lg:col-span-1">
            <Card className="border-l-4 border-purple-400 h-full sticky top-4">
              <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <HiBeaker className="w-6 h-6 text-purple-600" />
                Mezcla en Construcción
              </h4>

              {dumpadasSeleccionadasMezcla.length === 0 ? (
                <div className="text-center py-8">
                  <HiBeaker className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-semibold mb-2">Sin dumpadas seleccionadas</p>
                  <p className="text-sm text-gray-500">
                    Haz clic en las dumpadas verdes del mapa para agregarlas
                  </p>
                </div>
              ) : (
                <>
                  {/* Resumen de totales */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 mb-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-700">Dumpadas:</span>
                        <span className="text-lg font-bold text-purple-600">
                          {calcularTotalesMezcla().cantidadDumpadas}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="text-sm font-semibold text-gray-700">Total Ton:</span>
                        <span className="text-lg font-bold text-blue-600">
                          {calcularTotalesMezcla().totalToneladas}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Ley Dump (ajustada):</span>
                        <span className="text-sm font-bold text-green-600">
                          {calcularTotalesMezcla().leyPromedioDump}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Ley Visual:</span>
                        <span className="text-sm font-bold text-yellow-600">
                          {calcularTotalesMezcla().leyPromedioVisual}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Ley Lote:</span>
                        <span className="text-sm font-bold text-indigo-600">
                          {calcularTotalesMezcla().leyPromedioLote}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Lista de dumpadas seleccionadas */}
                  <div className="mb-4">
                    <h5 className="text-sm font-bold text-gray-700 mb-2">
                      Dumpadas Seleccionadas:
                    </h5>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {dumpadasSeleccionadasMezcla.map((dumpada, index) => (
                        <div
                          key={dumpada.id}
                          className="bg-white border-2 border-purple-200 rounded-lg p-2 hover:border-purple-400 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-bold text-xs text-gray-900">#{dumpada.n_acop}</p>
                              <p className="text-xs text-gray-600 truncate">{dumpada.acopios}</p>
                            </div>
                            <div className="text-right ml-2">
                              <p className="text-xs font-bold text-blue-600">{parseFloat(dumpada.ton).toFixed(2)} Ton</p>
                              <p className="text-xs text-green-600">Ley: {parseFloat(dumpada.ley).toFixed(3)}%</p>
                            </div>
                            <button
                              onClick={() => handleClickDumpadaMezcla(dumpada)}
                              className="ml-2 p-1 bg-red-100 hover:bg-red-200 rounded text-red-600 transition-colors"
                              title="Quitar de la mezcla"
                            >
                              <HiX className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="space-y-2">
                    <Button
                      variant="success"
                      className="w-full"
                      icon={HiArrowRight}
                      onClick={irACrearMezcla}
                      disabled={dumpadasSeleccionadasMezcla.length === 0}
                    >
                      Crear Mezcla ({dumpadasSeleccionadasMezcla.length})
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full"
                      icon={HiX}
                      onClick={limpiarSeleccionMezcla}
                      disabled={dumpadasSeleccionadasMezcla.length === 0}
                    >
                      Limpiar Selección
                    </Button>
                  </div>

                  {/* Nota informativa */}
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-700">
                      💡 <strong>Nota:</strong> Al hacer clic en "Crear Mezcla", serás redirigido a la vista de mezclas con estas dumpadas pre-seleccionadas.
                    </p>
                  </div>
                </>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
