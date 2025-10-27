// src/routes/routesConfig.js
/**
 * Configuración centralizada de rutas del Sistema de Producción
 * 
 * Cada ruta define:
 * - path: URL de la ruta
 * - component: Componente a renderizar (importado dinámicamente)
 * - requiredPermission: Permiso(s) necesario(s) para acceder
 * - requiredRole: Rol(es) necesario(s) [opcional]
 * - requireAll: Si true, requiere TODOS los permisos/roles. Si false, con uno basta
 * - label: Nombre legible para navegación
 * - module: Módulo al que pertenece (para organización)
 */

// Importaciones de páginas
import FrentesTrabajo from '../modules/ingenieria/pages/FrentesTrabajo';
// import Dumpadas from '../modules/dispatch/pages/Dumpadas';
// import Muestras from '../modules/laboratorio/pages/Muestras';

export const routesConfig = [
  // ========================================
  // MÓDULO: INGENIERÍA
  // ========================================
  {
    path: '/ingenieria/frentes-trabajo',
    component: FrentesTrabajo,
    requiredPermission: 'ingreso_frentes', // Debe coincidir con BD
    label: 'Frentes de Trabajo',
    module: 'ingenieria',
  },
  // Agregar más rutas de ingeniería aquí:
  // {
  //   path: '/ingenieria/planificacion',
  //   component: Planificacion,
  //   requiredPermission: 'ver_planificacion',
  //   label: 'Planificación',
  //   module: 'ingenieria',
  // },

  // ========================================
  // MÓDULO: DISPATCH
  // ========================================
  // {
  //   path: '/dispatch/dumpadas',
  //   component: Dumpadas,
  //   requiredPermission: 'ingreso_dumpadas',
  //   label: 'Dumpadas',
  //   module: 'dispatch',
  // },
  // {
  //   path: '/dispatch/vehiculos',
  //   component: Vehiculos,
  //   requiredPermission: 'gestionar_vehiculos',
  //   label: 'Vehículos',
  //   module: 'dispatch',
  // },

  // ========================================
  // MÓDULO: LABORATORIO
  // ========================================
  // {
  //   path: '/laboratorio/muestras',
  //   component: Muestras,
  //   requiredPermission: 'ingreso_muestras',
  //   label: 'Muestras',
  //   module: 'laboratorio',
  // },
  // {
  //   path: '/laboratorio/analisis',
  //   component: Analisis,
  //   requiredPermission: 'ver_analisis',
  //   label: 'Análisis',
  //   module: 'laboratorio',
  // },
];

/**
 * Obtener rutas disponibles para un usuario según sus permisos
 */
export const getAvailableRoutes = (permisos, roles) => {
  return routesConfig.filter(route => {
    // Si no requiere permisos específicos, está disponible
    if (!route.requiredPermission && !route.requiredRole) {
      return true;
    }

    // Verificar permisos
    if (route.requiredPermission) {
      const permissions = Array.isArray(route.requiredPermission)
        ? route.requiredPermission
        : [route.requiredPermission];

      const hasPermission = route.requireAll
        ? permissions.every(p => permisos.includes(p))
        : permissions.some(p => permisos.includes(p));

      if (!hasPermission) return false;
    }

    // Verificar roles
    if (route.requiredRole) {
      const rolesRequired = Array.isArray(route.requiredRole)
        ? route.requiredRole
        : [route.requiredRole];

      const hasRole = route.requireAll
        ? rolesRequired.every(r => roles.includes(r))
        : rolesRequired.some(r => roles.includes(r));

      if (!hasRole) return false;
    }

    return true;
  });
};

/**
 * Agrupar rutas por módulo
 */
export const getRoutesByModule = (permisos, roles) => {
  const availableRoutes = getAvailableRoutes(permisos, roles);
  
  const grouped = availableRoutes.reduce((acc, route) => {
    const module = route.module || 'general';
    if (!acc[module]) {
      acc[module] = [];
    }
    acc[module].push(route);
    return acc;
  }, {});

  return grouped;
};