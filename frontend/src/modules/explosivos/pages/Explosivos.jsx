import { useState, useEffect } from 'react';
import {
  HiHome,
  HiCube,
  HiArchiveBox,
  HiArrowsRightLeft,
  HiCog6Tooth,
  HiExclamationTriangle,
  HiPlus,
  HiArrowDownTray,
  HiArrowUpTray,
  HiAdjustmentsHorizontal,
  HiMagnifyingGlass,
  HiXMark,
  HiCheckCircle,
  HiClock,
  HiDocumentText,
  HiClipboardDocumentList,
  HiChartBar,
} from 'react-icons/hi2';
import Header from '../../../shared/components/organisms/Header';
import Button from '../../../shared/components/atoms/Button';
import Card from '../../../shared/components/atoms/Card';
import Input from '../../../shared/components/atoms/Input';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import Pagination from '../../../shared/components/molecules/Pagination';
import ConfirmDialog from '../../../shared/components/molecules/ConfirmDialog';
import useToast from '../../../hooks/useToast';
import { useFaena } from '../../../contexts/FaenaContext';
import { useAuth } from '../../../core/context/AuthContext';
import explosivosService from '../services/explosivos';

// Componentes de vistas
import StockView from '../components/StockView';
import MovimientosView from '../components/MovimientosView';
import LotesView from '../components/LotesView';
import ConfiguracionView from '../components/ConfiguracionView';
import ReportesPerforacionView from '../components/ReportesPerforacionView';
import DashboardPerforacion from '../components/DashboardPerforacion';
import SolicitudesView from '../components/SolicitudesView';

// Roles que ven la vista de Jefe de Mina (Reportes P&T)
const ROLES_JEFE_MINA = ['jefe_mina', 'supervisor_tronadura'];
// Roles admin que ven TODAS las tabs
const ROLES_ADMIN = ['admin_explosivos'];

export default function Explosivos() {
  const toast = useToast();
  const { faenaSeleccionada, faenas } = useFaena();
  const { getRolActivo } = useAuth();

  const rolActivo = getRolActivo();
  const esAdmin = ROLES_ADMIN.includes(rolActivo);
  const esJefeMina = ROLES_JEFE_MINA.includes(rolActivo) || esAdmin;

  // Obtener objeto faena actual
  const faenaActual = faenas.find(f => f.id === faenaSeleccionada) || { id: faenaSeleccionada };

  // Vista actual: depende del rol
  const [vistaActual, setVistaActual] = useState(esJefeMina ? 'reportes' : 'stock');

  // Estado global del módulo
  const [loading, setLoading] = useState(true);
  const [polvorin, setPolvorin] = useState(null);
  const [polvorines, setPolvorines] = useState([]);
  const [alertas, setAlertas] = useState({ bajo_minimo: [], sobre_maximo: [] });
  const [categorias, setCategorias] = useState([]);
  const [tipos, setTipos] = useState([]);

  // Estadísticas
  const [stats, setStats] = useState({
    tiposConStock: 0,
    lotesActivos: 0,
    alertasTotal: 0,
    movimientosHoy: 0,
  });

  // Cargar datos iniciales
  useEffect(() => {
    if (faenaSeleccionada || esAdmin) {
      loadDatosIniciales();
    } else {
      // Si no hay faena seleccionada, quitar el estado de carga
      setLoading(false);
    }
  }, [faenaSeleccionada]);

  const loadDatosIniciales = async () => {
    if (!faenaSeleccionada && !esAdmin) return;

    setLoading(true);
    try {
      // Para admin, cargar todos los polvorines
      if (esAdmin) {
        try {
          const polvorinesRes = await explosivosService.getPolvorines();
          setPolvorines(polvorinesRes || []);
        } catch {
          setPolvorines([]);
        }
      }

      // Cargar polvorín de la faena (si hay faena seleccionada)
      let polvorinData = null;
      if (faenaSeleccionada) {
        const polvorinRes = await explosivosService.getPolvorinPorFaena(faenaSeleccionada);
        polvorinData = polvorinRes?.id ? polvorinRes : null;
      }
      setPolvorin(polvorinData);

      // Cargar categorías y tipos
      const [categoriasRes, tiposRes] = await Promise.all([
        explosivosService.getCategorias({ activo: true }),
        explosivosService.getTipos({ activo: true }),
      ]);
      setCategorias(categoriasRes);
      setTipos(tiposRes);

      // Cargar alertas si hay polvorín
      if (polvorinData?.id) {
        const polvorinId = polvorinData.id;
        const alertasRes = await explosivosService.getStockAlertas({ id_polvorin: polvorinId });
        setAlertas(alertasRes);

        // Calcular estadísticas
        const stockRes = await explosivosService.getStock({ id_polvorin: polvorinId, con_stock: true });
        setStats({
          tiposConStock: stockRes.length,
          lotesActivos: polvorinData?.lotes_activos?.length || 0,
          alertasTotal: (alertasRes.bajo_minimo?.length || 0) + (alertasRes.sobre_maximo?.length || 0),
          movimientosHoy: 0,
        });
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      if (error.response?.status !== 404) {
        toast.error('Error', 'No se pudieron cargar los datos del polvorín');
      }
    } finally {
      setLoading(false);
    }
  };

  // Pestañas según rol
  const vistas = esAdmin
    ? [
        { id: 'reportes', label: 'Reportes P&T', icon: HiDocumentText },
        { id: 'dashboard', label: 'Dashboard', icon: HiChartBar },
        { id: 'stock', label: 'Stock Actual', icon: HiCube },
        { id: 'solicitudes', label: 'Solicitudes', icon: HiClipboardDocumentList },
        { id: 'movimientos', label: 'Movimientos', icon: HiArrowsRightLeft },
        { id: 'lotes', label: 'Lotes', icon: HiArchiveBox },
        { id: 'configuracion', label: 'Configuración', icon: HiCog6Tooth },
      ]
    : esJefeMina
    ? [
        { id: 'reportes', label: 'Reportes P&T', icon: HiDocumentText },
        { id: 'dashboard', label: 'Dashboard', icon: HiChartBar },
        { id: 'configuracion', label: 'Fórmulas', icon: HiCog6Tooth },
      ]
    : [
        { id: 'stock', label: 'Stock Actual', icon: HiCube },
        { id: 'solicitudes', label: 'Solicitudes', icon: HiClipboardDocumentList },
        { id: 'movimientos', label: 'Movimientos', icon: HiArrowsRightLeft },
        { id: 'lotes', label: 'Lotes', icon: HiArchiveBox },
        { id: 'configuracion', label: 'Configuración', icon: HiCog6Tooth },
      ];

  const renderVista = () => {
    // El jefe de mina y admin no necesitan polvorín para crear reportes
    if (!esJefeMina && !polvorin && vistaActual !== 'configuracion') {
      return (
        <Card className="text-center py-12">
          <HiExclamationTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No hay polvorín configurado
          </h3>
          <p className="text-gray-500 mb-6">
            Debe crear un polvorín para esta faena antes de gestionar explosivos.
          </p>
          <Button
            variant="primary"
            icon={HiPlus}
            onClick={() => setVistaActual('configuracion')}
          >
            Ir a Configuración
          </Button>
        </Card>
      );
    }

    switch (vistaActual) {
      case 'stock':
        return (
          <StockView
            polvorin={polvorin}
            tipos={tipos}
            categorias={categorias}
            alertas={alertas}
            onRefresh={loadDatosIniciales}
          />
        );
      case 'reportes':
        return (
          <ReportesPerforacionView
            polvorin={polvorin}
            polvorines={esAdmin ? polvorines : []}
            tipos={tipos}
            faenaActual={faenaActual}
            onRefresh={loadDatosIniciales}
          />
        );
      case 'dashboard':
        return (
          <DashboardPerforacion
            faenaActual={faenaActual}
          />
        );
      case 'solicitudes':
        return (
          <SolicitudesView
            polvorin={polvorin}
            tipos={tipos}
            faenaActual={faenaActual}
            onRefresh={loadDatosIniciales}
          />
        );
      case 'movimientos':
        return (
          <MovimientosView
            polvorin={polvorin}
            tipos={tipos}
            faenaActual={faenaActual}
            onRefresh={loadDatosIniciales}
          />
        );
      case 'lotes':
        return (
          <LotesView
            polvorin={polvorin}
            tipos={tipos}
            onRefresh={loadDatosIniciales}
          />
        );
      case 'configuracion':
        return (
          <ConfiguracionView
            polvorin={polvorin}
            polvorines={esAdmin ? polvorines : []}
            esAdmin={esAdmin}
            faenas={faenas}
            categorias={categorias}
            tipos={tipos}
            faenaActual={faenaActual}
            onPolvorinCreated={(nuevoPolvorin) => {
              setPolvorin(nuevoPolvorin);
              loadDatosIniciales();
            }}
            onRefresh={loadDatosIniciales}
          />
        );
      default:
        return null;
    }
  };

  const bgGradient = esAdmin
    ? 'min-h-screen bg-gradient-to-br from-purple-50 via-white to-orange-50'
    : esJefeMina
    ? 'min-h-screen bg-gradient-to-br from-orange-50 via-white to-yellow-50'
    : 'min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50';

  const spinnerColor = esAdmin
    ? 'border-purple-200 border-t-purple-600'
    : esJefeMina
    ? 'border-orange-200 border-t-orange-600'
    : 'border-red-200 border-t-red-600';

  if (loading) {
    return (
      <div className={bgGradient}>
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center py-20">
            <div className={`animate-spin rounded-full h-12 w-12 border-4 ${spinnerColor}`}></div>
          </div>
        </main>
      </div>
    );
  }

  // Mostrar mensaje si no hay faena seleccionada (admin puede continuar sin faena)
  if (!faenaSeleccionada && !esAdmin) {
    return (
      <div className={bgGradient}>
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <Card className="text-center py-12">
            <HiExclamationTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Seleccione una faena
            </h3>
            <p className="text-gray-500">
              Debe seleccionar una faena para acceder al inventario de explosivos.
            </p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className={bgGradient}>
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Breadcrumb
            items={[
              { label: 'Dashboard Central', href: import.meta.env.VITE_CENTRAL_URL, icon: HiHome },
              { label: esAdmin ? 'Explosivos - Admin' : esJefeMina ? 'Perforación y Tronadura' : 'Explosivos - Polvorín' }
            ]}
          />
        </div>

        {/* Header con estadísticas */}
        <Card className={`mb-6 border-l-4 ${esJefeMina ? 'border-orange-500' : 'border-red-500'}`}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className={`text-3xl font-bold mb-2 ${esJefeMina ? 'text-orange-600' : 'text-red-600'}`}>
                {esAdmin ? 'Administración de Explosivos' : esJefeMina ? 'Reporte de Perforación y Tronadura' : 'Inventario de Explosivos'}
              </h2>
              <p className="text-gray-600">
                {esAdmin ? (
                  <>Vista completa — <span className="font-semibold">{faenaActual?.nombre || 'Todas las faenas'}</span></>
                ) : esJefeMina ? (
                  <>Planificación de explosivos por jornada — <span className="font-semibold">{faenaActual?.nombre || 'Faena actual'}</span></>
                ) : polvorin ? (
                  <>Polvorín: <span className="font-semibold">{polvorin.nombre}</span> ({polvorin.codigo})</>
                ) : (
                  'Sin polvorín configurado'
                )}
              </p>
            </div>

            {/* Estadísticas - para polvorinero y admin */}
            {(!esJefeMina || esAdmin) && polvorin && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-3 text-center border-b-[3px] border-blue-500 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-default">
                  <HiCube className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-700">{stats.tiposConStock}</p>
                  <p className="text-xs text-blue-600">Tipos con Stock</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center border-b-[3px] border-green-500 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-default">
                  <HiArchiveBox className="w-6 h-6 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700">{stats.lotesActivos}</p>
                  <p className="text-xs text-green-600">Lotes Activos</p>
                </div>
                <div className={`rounded-lg p-3 text-center border-b-[3px] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-default ${stats.alertasTotal > 0 ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-gray-300'}`}>
                  <HiExclamationTriangle className={`w-6 h-6 mx-auto mb-1 ${stats.alertasTotal > 0 ? 'text-red-600' : 'text-gray-400'}`} />
                  <p className={`text-2xl font-bold ${stats.alertasTotal > 0 ? 'text-red-700' : 'text-gray-500'}`}>
                    {stats.alertasTotal}
                  </p>
                  <p className={`text-xs ${stats.alertasTotal > 0 ? 'text-red-600' : 'text-gray-500'}`}>Alertas</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center border-b-[3px] border-purple-500 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-default">
                  <HiArrowsRightLeft className="w-6 h-6 text-purple-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-purple-700">{stats.movimientosHoy}</p>
                  <p className="text-xs text-purple-600">Mov. Hoy</p>
                </div>
              </div>
            )}
          </div>

          {/* Alertas rápidas - para polvorinero y admin */}
          {(!esJefeMina || esAdmin) && alertas.bajo_minimo?.length > 0 && (
            <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <span className="relative flex h-5 w-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <HiExclamationTriangle className="relative w-5 h-5" />
                </span>
                <span className="font-semibold">Stock bajo mínimo:</span>
                <span>
                  {alertas.bajo_minimo.slice(0, 3).map(a => a.tipo_explosivo).join(', ')}
                  {alertas.bajo_minimo.length > 3 && ` y ${alertas.bajo_minimo.length - 3} más`}
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* Navegación por pestañas */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 bg-white rounded-lg p-2 shadow-sm">
            {vistas.map((vista) => {
              const Icon = vista.icon;
              const isActive = vistaActual === vista.id;
              return (
                <button
                  key={vista.id}
                  onClick={() => setVistaActual(vista.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                    ${isActive
                      ? esJefeMina ? 'bg-orange-600 text-white shadow-md' : 'bg-red-600 text-white shadow-md'
                      : esJefeMina ? 'text-gray-600 hover:bg-orange-50 hover:text-orange-600' : 'text-gray-600 hover:bg-red-50 hover:text-red-600'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {vista.label}
                  {vista.id === 'stock' && stats.alertasTotal > 0 && (
                    <span className={`
                      px-2 py-0.5 text-xs rounded-full
                      ${isActive ? 'bg-white text-red-600' : 'bg-red-100 text-red-600'}
                    `}>
                      {stats.alertasTotal}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenido de la vista */}
        {renderVista()}
      </main>
    </div>
  );
}
