import { useState, useEffect } from 'react';
import {
  HiHome,
  HiDocumentText,
  HiChartBar,
  HiCog6Tooth,
  HiExclamationTriangle,
} from 'react-icons/hi2';
import Header from '../../../shared/components/organisms/Header';
import Card from '../../../shared/components/atoms/Card';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import { useAuth } from '../../../core/context/AuthContext';
import { FaenaProvider, useFaena } from '../../../contexts/FaenaContext';
import faenaService from '../../../services/faenaService';
import explosivosService from '../../explosivos/services/explosivos';

// Componentes reutilizados de Explosivos (sin mover archivos, import cross-módulo)
import ReportesPerforacionView from '../../explosivos/components/ReportesPerforacionView';
import DashboardPerforacion from '../../explosivos/components/DashboardPerforacion';
import ConfiguracionView from '../../explosivos/components/ConfiguracionView';

// Roles que ven todas las faenas (necesitan elegir una antes de operar). jefe_mina se queda
// SIEMPRE con su faena por defecto (la asignada a su cuenta en el SAC), sin selector — si una
// persona necesita cubrir más de una faena, se le asigna también el rol `ingeniero` en el SAC
// ("Gestión de Frentes de Trabajo"), y con ESE rol entra con selector, sin cambiar el
// comportamiento del resto de los jefe_mina.
const ROLES_MULTI_FAENA = ['ingeniero'];
// Rol con poderes completos de Administrador de Explosivos (crear polvorín, ver todas las
// faenas a la vez) — misma experiencia que tenía dentro de Explosivos antes del movimiento.
const ROLES_ADMIN_COMPLETO = ['admin_explosivos'];
// Roles con acceso directo SOLO a Reportes P&T — no ven el resto del hub de Ingeniería,
// así que el breadcrumb no debe mostrar "Ingeniería" como link para ellos.
const ROLES_SOLO_REPORTES_PYT = ['admin_explosivos', 'jefe_mina'];

function ReportesPerforacionContent() {
  const { getRolActivo } = useAuth();
  const { faenaUsuario } = useFaena();
  const rolActivo = getRolActivo();
  const esMultiFaena = ROLES_MULTI_FAENA.includes(rolActivo);
  const esAdminCompleto = ROLES_ADMIN_COMPLETO.includes(rolActivo);
  const puedeVerHub = !ROLES_SOLO_REPORTES_PYT.includes(rolActivo);

  const [faenas, setFaenas] = useState([]);
  const [faenaElegida, setFaenaElegida] = useState(null);
  const faenaId = esMultiFaena ? faenaElegida : faenaUsuario;
  const faenaActual = esAdminCompleto
    ? null
    : (faenas.find(f => f.id === faenaId) || (faenaId ? { id: faenaId } : null));

  const [tabActual, setTabActual] = useState('reportes');
  const [loading, setLoading] = useState(true);
  const [polvorin, setPolvorin] = useState(null);
  const [polvorines, setPolvorines] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [tipos, setTipos] = useState([]);

  // Se pide siempre (no solo para multi-faena/admin): jefe_mina también la necesita, para
  // mostrar el NOMBRE real de su faena en vez de solo el id (ver faenaActual más abajo).
  useEffect(() => {
    faenaService.getFaenas()
      .then(res => setFaenas(res.data || res || []))
      .catch(() => setFaenas([]));
  }, []);

  useEffect(() => {
    if (esAdminCompleto) {
      loadDatosAdmin();
    } else if (faenaId) {
      loadDatos();
    } else {
      setLoading(false);
    }
  }, [esAdminCompleto, faenaId]);

  const loadDatos = async () => {
    setLoading(true);
    try {
      const [polvorinRes, categoriasRes, tiposRes] = await Promise.all([
        explosivosService.getPolvorinPorFaena(faenaId),
        explosivosService.getCategorias({ activo: true }),
        explosivosService.getTipos({ activo: true }),
      ]);
      setPolvorin(polvorinRes?.id ? polvorinRes : null);
      setCategorias(categoriasRes);
      setTipos(tiposRes);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Administrador de Explosivos: ve todos los polvorines de todas las faenas a la vez,
  // igual que dentro del módulo Explosivos (esAdmin=true), no queda atado a una sola faena.
  const loadDatosAdmin = async () => {
    setLoading(true);
    try {
      const [polvorinesRes, categoriasRes, tiposRes] = await Promise.all([
        explosivosService.getPolvorines(),
        explosivosService.getCategorias({ activo: true }),
        explosivosService.getTipos({ activo: true }),
      ]);
      setPolvorines(polvorinesRes || []);
      setCategorias(categoriasRes);
      setTipos(tiposRes);
    } catch (error) {
      console.error('Error cargando datos de administrador:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = esAdminCompleto ? loadDatosAdmin : loadDatos;

  const tabs = [
    { id: 'reportes', label: 'Reportes P&T', icon: HiDocumentText },
    { id: 'dashboard', label: 'Dashboard', icon: HiChartBar },
    { id: 'formulas', label: 'Fórmulas', icon: HiCog6Tooth },
  ];

  const renderTab = () => {
    switch (tabActual) {
      case 'reportes':
        return (
          <ReportesPerforacionView
            polvorin={esAdminCompleto ? null : polvorin}
            polvorines={esAdminCompleto ? polvorines : []}
            tipos={tipos}
            faenaActual={faenaActual}
            onRefresh={onRefresh}
          />
        );
      case 'dashboard':
        return <DashboardPerforacion faenaActual={faenaActual} />;
      case 'formulas':
        return (
          <ConfiguracionView
            polvorin={esAdminCompleto ? null : polvorin}
            polvorines={esAdminCompleto ? polvorines : []}
            esAdmin={esAdminCompleto}
            faenas={faenas}
            categorias={categorias}
            tipos={tipos}
            faenaActual={faenaActual}
            onPolvorinCreated={esAdminCompleto ? () => loadDatosAdmin() : undefined}
            onRefresh={onRefresh}
          />
        );
      default:
        return null;
    }
  };

  // Usuario multi-faena (ingeniero) sin faena elegida todavía
  if (esMultiFaena && !faenaId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-yellow-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="mb-6">
            <Breadcrumb
              items={[
                { label: 'Portal M3H', href: import.meta.env.VITE_CENTRAL_URL, icon: HiHome },
                { label: 'Ingeniería', href: puedeVerHub ? '/ingenieria' : undefined },
                { label: 'Reportes de Perforación y Tronadura' },
              ]}
            />
          </div>
          <Card className="text-center py-12">
            <HiExclamationTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Seleccione una faena</h3>
            <p className="text-gray-500 mb-6">
              Elija la faena para ver o generar reportes de perforación y tronadura.
            </p>
            <select
              defaultValue=""
              onChange={(e) => { if (e.target.value) setFaenaElegida(parseInt(e.target.value, 10)); }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none min-w-[240px] bg-white text-gray-700"
            >
              <option value="" disabled>-- Seleccione una faena --</option>
              {faenas.map(f => (
                <option key={f.id} value={f.id}>{f.ubicacion || f.nombre || `Faena ${f.id}`}</option>
              ))}
            </select>
          </Card>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-yellow-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-yellow-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <Breadcrumb
            items={[
              { label: 'Portal M3H', href: import.meta.env.VITE_CENTRAL_URL, icon: HiHome },
              { label: 'Ingeniería', href: puedeVerHub ? '/ingenieria' : undefined },
              { label: 'Reportes de Perforación y Tronadura' },
            ]}
          />
        </div>

        <Card className="mb-6 border-l-4 border-orange-500">
          <h2 className="text-3xl font-bold mb-2 text-orange-600">Reporte de Perforación y Tronadura</h2>
          <p className="text-gray-600">
            {esAdminCompleto ? (
              <>Vista completa — <span className="font-semibold">Todas las faenas</span></>
            ) : (
              <>Planificación de explosivos por jornada — <span className="font-semibold">{faenaActual?.nombre || faenaActual?.ubicacion || 'Faena actual'}</span></>
            )}
            {esMultiFaena && (
              <button
                type="button"
                onClick={() => setFaenaElegida(null)}
                className="ml-3 text-sm text-orange-600 underline hover:text-orange-700"
              >
                Cambiar faena
              </button>
            )}
          </p>
        </Card>

        <div className="mb-6">
          <div className="flex flex-wrap gap-2 bg-white rounded-lg p-2 shadow-sm">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tabActual === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTabActual(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                    ${isActive
                      ? 'bg-orange-600 text-white shadow-md'
                      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {renderTab()}
      </main>
    </div>
  );
}

export default function ReportesPerforacion() {
  return (
    <FaenaProvider>
      <ReportesPerforacionContent />
    </FaenaProvider>
  );
}
