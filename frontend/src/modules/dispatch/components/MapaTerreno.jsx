import { useState, useEffect } from 'react';
import { HiMap, HiPlus, HiTrash, HiRefresh, HiCursorClick, HiPencil, HiViewGridAdd, HiColorSwatch } from 'react-icons/hi';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import mapaService from '../services/mapa';
import dispatchService from '../services/dispatch';

export default function MapaTerreno({ toast }) {
  const [dumpadas, setDumpadas] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dumpadaSeleccionada, setDumpadaSeleccionada] = useState(null);

  // Herramientas de dibujo
  const [herramientaActiva, setHerramientaActiva] = useState('seleccionar'); // seleccionar, pared, cerca, zona, borrador
  const [elementosDibujados, setElementosDibujados] = useState([]); // Array de elementos: {tipo, x, y, color}
  const [colorSeleccionado, setColorSeleccionado] = useState('#6B7280'); // Gris por defecto

  // Dimensiones del mapa
  const GRID_SIZE = 40; // Tamaño de cada celda
  const GRID_COLS = 20; // Columnas
  const GRID_ROWS = 15; // Filas

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
      // Cargar todas las dumpadas (incluyendo las sin posición)
      const dumpadasRes = await dispatchService.getDumpadas({});
      setDumpadas(dumpadasRes.data || []);

      // Cargar zonas
      const zonasRes = await mapaService.getZonas();
      setZonas(zonasRes || []);
    } catch (error) {
      console.error('Error cargando mapa:', error);
      toast.error('Error', 'No se pudo cargar el mapa');
    } finally {
      setLoading(false);
    }
  };

  const handleDropDumpada = async (dumpada, x, y) => {
    try {
      await mapaService.actualizarPosicionDumpada(dumpada.id, {
        posicion_x: x,
        posicion_y: y,
        zona_id: null,
      });

      // Actualizar localmente
      setDumpadas(prev => prev.map(d =>
        d.id === dumpada.id
          ? { ...d, posicion_x: x, posicion_y: y }
          : d
      ));

      toast.success('Posición actualizada', `Dumpada ${dumpada.n_acop} colocada en el mapa`);
    } catch (error) {
      console.error('Error actualizando posición:', error);
      toast.error('Error', 'No se pudo actualizar la posición');
    }
  };

  const handleDragStart = (e, dumpada) => {
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

  const dumpadasEnMapa = dumpadas.filter(d => d.posicion_x !== null && d.posicion_y !== null);
  const dumpadasSinPosicion = dumpadas.filter(d => d.posicion_x === null || d.posicion_y === null);

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
      {/* Header */}
      <Card className="border-l-4 border-blue-400">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <HiMap className="w-7 h-7 text-blue-600" />
              Mapa de Terreno
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {dumpadasEnMapa.length} dumpadas en el mapa • {dumpadasSinPosicion.length} sin posición
            </p>
          </div>
          <div className="flex gap-2">
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
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Panel izquierdo: Dumpadas sin posición */}
        <div className="lg:col-span-1">
          <Card className="border-l-4 border-yellow-400 h-full">
            <h4 className="text-lg font-bold text-gray-900 mb-4">
              📦 Dumpadas Disponibles
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Arrastra las dumpadas al mapa para posicionarlas
            </p>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {dumpadasSinPosicion.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  Todas las dumpadas están en el mapa
                </p>
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

        {/* Mapa (cuadrícula) */}
        <div className="lg:col-span-3">
          <Card className="border-l-4 border-green-400">
            <h4 className="text-lg font-bold text-gray-900 mb-4">
              🗺️ Vista del Terreno
            </h4>

            <div
              className="relative bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg p-4 overflow-auto"
              style={{ maxHeight: '700px' }}
            >
              {/* Cuadrícula */}
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

                    return (
                      <div
                        key={`${row}-${col}`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, col, row)}
                        className={`bg-white hover:bg-blue-50 transition-colors ${
                          dumpadaEnCelda ? 'cursor-pointer' : ''
                        }`}
                        style={{ width: `${GRID_SIZE}px`, height: `${GRID_SIZE}px` }}
                        title={dumpadaEnCelda ? `#${dumpadaEnCelda.n_acop} - ${dumpadaEnCelda.acopios}` : `Celda ${col}, ${row}`}
                      >
                        {dumpadaEnCelda && (
                          <div
                            className={`w-full h-full ${getColorPorEstado(dumpadaEnCelda.estado)} rounded flex items-center justify-center text-white text-xs font-bold cursor-move`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, dumpadaEnCelda)}
                          >
                            {dumpadaEnCelda.n_acop}
                          </div>
                        )}
                      </div>
                    );
                  })
                ))}
              </div>
            </div>

            {/* Leyenda */}
            <div className="mt-4 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span>Completado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span>Ingresado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-400 rounded"></div>
                <span>Otro</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
