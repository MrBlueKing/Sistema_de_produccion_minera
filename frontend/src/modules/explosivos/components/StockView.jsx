import { useState, useEffect } from 'react';
import {
  HiCube,
  HiExclamationTriangle,
  HiArrowTrendingDown,
  HiArrowTrendingUp,
  HiMagnifyingGlass,
} from 'react-icons/hi2';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import explosivosService from '../services/explosivos';
import useToast from '../../../hooks/useToast';

export default function StockView({ polvorin, tipos, categorias, alertas, onRefresh }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [stock, setStock] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (polvorin?.id) {
      loadStock();
    } else {
      // Si no hay polvorín válido, quitar el loading
      setLoading(false);
    }
  }, [polvorin]);

  const loadStock = async () => {
    setLoading(true);
    try {
      const response = await explosivosService.getStock({
        id_polvorin: polvorin.id,
      });
      setStock(response);
    } catch (error) {
      toast.error('Error', 'No se pudo cargar el stock');
    } finally {
      setLoading(false);
    }
  };

  // Agrupar stock por categoría
  const stockAgrupado = stock.reduce((acc, item) => {
    const categoria = item.tipo_explosivo?.categoria?.nombre || 'Sin Categoría';
    if (!acc[categoria]) {
      acc[categoria] = [];
    }
    acc[categoria].push(item);
    return acc;
  }, {});

  // Filtrar
  const stockFiltrado = Object.entries(stockAgrupado).reduce((acc, [cat, items]) => {
    if (filtroCategoria && cat !== filtroCategoria) return acc;

    const itemsFiltrados = items.filter(item => {
      if (!busqueda) return true;
      const texto = `${item.tipo_explosivo?.codigo} ${item.tipo_explosivo?.nombre}`.toLowerCase();
      return texto.includes(busqueda.toLowerCase());
    });

    if (itemsFiltrados.length > 0) {
      acc[cat] = itemsFiltrados;
    }
    return acc;
  }, {});

  const getEstadoStock = (item) => {
    if (item.esta_bajo_minimo) return 'bajo';
    if (item.esta_sobre_maximo) return 'alto';
    return 'ok';
  };

  const getEstadoClasses = (estado) => {
    switch (estado) {
      case 'bajo':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'alto':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      default:
        return 'bg-green-50 border-green-200 text-green-700';
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-200 border-t-red-600"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por código o nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
          >
            <option value="">Todas las categorías</option>
            {categorias.map(cat => (
              <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
            ))}
          </select>
          <Button variant="outline" onClick={loadStock}>
            Actualizar
          </Button>
        </div>
      </Card>

      {/* Alertas de stock */}
      {(alertas.bajo_minimo?.length > 0 || alertas.sobre_maximo?.length > 0) && (
        <Card className="border-l-4 border-red-500">
          <h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
            <HiExclamationTriangle className="w-5 h-5" />
            Alertas de Stock
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {alertas.bajo_minimo?.length > 0 && (
              <div className="bg-red-50 rounded-lg p-4">
                <h4 className="font-medium text-red-700 mb-2 flex items-center gap-2">
                  <HiArrowTrendingDown className="w-4 h-4" />
                  Bajo Mínimo ({alertas.bajo_minimo.length})
                </h4>
                <ul className="space-y-1 text-sm">
                  {alertas.bajo_minimo.map((alerta, idx) => (
                    <li key={idx} className="text-red-600">
                      {alerta.tipo_explosivo}: {alerta.cantidad_actual} {alerta.unidad}
                      (mín: {alerta.stock_minimo})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {alertas.sobre_maximo?.length > 0 && (
              <div className="bg-yellow-50 rounded-lg p-4">
                <h4 className="font-medium text-yellow-700 mb-2 flex items-center gap-2">
                  <HiArrowTrendingUp className="w-4 h-4" />
                  Sobre Máximo ({alertas.sobre_maximo.length})
                </h4>
                <ul className="space-y-1 text-sm">
                  {alertas.sobre_maximo.map((alerta, idx) => (
                    <li key={idx} className="text-yellow-600">
                      {alerta.tipo_explosivo}: {alerta.cantidad_actual} {alerta.unidad}
                      (máx: {alerta.stock_maximo})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Stock por categoría */}
      {Object.keys(stockFiltrado).length === 0 ? (
        <Card className="text-center py-12">
          <HiCube className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay stock registrado</p>
        </Card>
      ) : (
        Object.entries(stockFiltrado).map(([categoria, items]) => (
          <Card key={categoria}>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">
              {categoria}
            </h3>
            <div className="grid gap-3">
              {items.map((item) => {
                const estado = getEstadoStock(item);
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border ${getEstadoClasses(estado)}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        <span className="font-mono text-sm bg-white/50 px-2 py-0.5 rounded">
                          {item.tipo_explosivo?.codigo}
                        </span>
                        <span className="ml-2 font-medium">
                          {item.tipo_explosivo?.nombre}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold">
                            {parseFloat(item.cantidad).toLocaleString('es-CL')}
                          </p>
                          <p className="text-sm opacity-75">
                            {item.tipo_explosivo?.unidad_medida}
                          </p>
                        </div>
                        {item.cantidad_reservada > 0 && (
                          <div className="text-right text-sm">
                            <p className="text-gray-600">Reservado</p>
                            <p className="font-semibold">{item.cantidad_reservada}</p>
                          </div>
                        )}
                        {estado === 'bajo' && (
                          <HiArrowTrendingDown className="w-6 h-6 text-red-500" />
                        )}
                        {estado === 'alto' && (
                          <HiArrowTrendingUp className="w-6 h-6 text-yellow-500" />
                        )}
                      </div>
                    </div>
                    {(item.tipo_explosivo?.stock_minimo || item.tipo_explosivo?.stock_maximo) && (
                      <div className="mt-2 pt-2 border-t border-current/20 text-sm opacity-75">
                        {item.tipo_explosivo?.stock_minimo && (
                          <span className="mr-4">Mín: {item.tipo_explosivo.stock_minimo}</span>
                        )}
                        {item.tipo_explosivo?.stock_maximo && (
                          <span>Máx: {item.tipo_explosivo.stock_maximo}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
