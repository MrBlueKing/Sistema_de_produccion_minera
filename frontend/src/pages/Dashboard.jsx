// src/pages/Dashboard.jsx (OPCIONAL - No se usa por defecto)
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../core/context/AuthContext';
import { getRoutesByModule } from '../routes/routesConfig';
import Header from '../shared/components/organisms/Header';

/**
 * Dashboard - Página opcional que muestra módulos disponibles
 * 
 * NOTA: Este dashboard es OPCIONAL. Por defecto, los usuarios vienen
 * directamente desde el SAC a URLs específicas como:
 * /ingenieria/frentes-trabajo
 * 
 * Este dashboard solo se usaría si decides agregarlo como ruta en routesConfig.
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const { user, permisos, roles, getUserInfo } = useAuth();
  const userInfo = getUserInfo();

  // Obtener rutas agrupadas por módulo según permisos del usuario
  const routesByModule = getRoutesByModule(permisos, roles);

  const moduleColors = {
    ingenieria: 'blue',
    dispatch: 'green',
    laboratorio: 'purple',
    general: 'gray'
  };

  const getColorClasses = (module) => {
    const color = moduleColors[module] || 'gray';
    return {
      bg: `bg-${color}-50`,
      border: `border-${color}-200`,
      text: `text-${color}-700`,
      hover: `hover:border-${color}-400`,
    };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Información del usuario */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Bienvenido, {userInfo.nombreCompleto}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <p className="text-sm text-gray-500">RUT</p>
              <p className="font-medium text-gray-900">{userInfo.rut}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{userInfo.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Faena</p>
              <p className="font-medium text-gray-900">{userInfo.faena}</p>
            </div>
          </div>
        </div>

        {/* Módulos disponibles */}
        {Object.keys(routesByModule).length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-yellow-800">
              No tienes acceso a ningún módulo en este sistema.
            </p>
            <p className="text-yellow-700 text-sm mt-2">
              Contacta al administrador si crees que esto es un error.
            </p>
          </div>
        ) : (
          Object.entries(routesByModule).map(([moduleName, routes]) => (
            <div key={moduleName} className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4 capitalize">
                {moduleName.replace('_', ' ')}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {routes.map((route) => {
                  const colors = getColorClasses(route.module);
                  
                  return (
                    <div
                      key={route.path}
                      onClick={() => navigate(route.path)}
                      className={`${colors.bg} border-2 ${colors.border} ${colors.hover} rounded-lg p-6 cursor-pointer transition-all hover:shadow-md`}
                    >
                      <h4 className={`font-semibold ${colors.text} text-lg mb-2`}>
                        {route.label}
                      </h4>
                      
                      <p className="text-sm text-gray-600 mb-4">
                        {route.path}
                      </p>

                      {/* Permisos requeridos */}
                      {route.requiredPermission && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-500 mb-1">Requiere:</p>
                          <div className="flex flex-wrap gap-1">
                            {(Array.isArray(route.requiredPermission) 
                              ? route.requiredPermission 
                              : [route.requiredPermission]
                            ).map((perm, idx) => (
                              <span
                                key={idx}
                                className={`px-2 py-0.5 ${colors.bg} ${colors.text} text-xs rounded border ${colors.border}`}
                              >
                                {perm}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className={`text-center text-sm font-medium ${colors.text}`}>
                          Acceder →
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* Debug info (solo en desarrollo) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 bg-gray-100 rounded-lg p-4">
            <p className="text-xs text-gray-600 font-mono">
              <strong>Debug Info:</strong><br />
              Roles: {roles.join(', ')}<br />
              Permisos: {permisos.join(', ')}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}