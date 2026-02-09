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
import FrentesTrabajoHistorial from '../modules/ingenieria/pages/FrentesTrabajoHistorial';
import TiposFrente from '../modules/ingenieria/pages/TiposFrente';
import Dumpadas from '../modules/dispatch/pages/Dispatch';
import Laboratorio from '../modules/laboratorio/pages/Laboratorio';
import Muestreo from '../modules/laboratorio/pages/Muestreo';
import HistorialAnalisis from '../modules/laboratorio/pages/HistorialAnalisis';
import Explosivos from '../modules/explosivos/pages/Explosivos';

export const routesConfig = [
  // ========================================
  // MÓDULO: INGENIERÍA
  // ========================================
  {
    path: '/ingenieria/frentes-trabajo',
    component: FrentesTrabajo,
    // ✅ SIN requiredPermission - Sistema con ROLES INTERNOS no valida permisos
    // El acceso ya fue validado por el Sistema de Autenticación Centralizado
    label: 'Frentes de Trabajo',
    module: 'ingenieria',
  },
  {
    path: '/ingenieria/frentes-trabajo/historial',
    component: FrentesTrabajoHistorial,
    label: 'Historial de Frentes',
    module: 'ingenieria',
  },
  {
    path: '/ingenieria/tipos-frente',
    component: TiposFrente,
    label: 'Tipos de Frente',
    module: 'ingenieria',
  },
  // Agregar más rutas de ingeniería aquí:
  // {
  //   path: '/ingenieria/planificacion',
  //   component: Planificacion,
  //   label: 'Planificación',
  //   module: 'ingenieria',
  // },

  // ========================================
  // MÓDULO: DISPATCH
  // ========================================
   {
     path: '/dispatch/dumpadas',
     component: Dumpadas,
     // ✅ SIN requiredPermission - La URL específica ya indica el acceso permitido
     label: 'Dumpadas',
     module: 'dispatch',
  },
  // {
  //   path: '/dispatch/vehiculos',
  //   component: Vehiculos,
  //   label: 'Vehículos',
  //   module: 'dispatch',
  // },

  // ========================================
  // MÓDULO: LABORATORIO
  // ========================================
  {
    path: '/laboratorio/muestreo',
    component: Muestreo,
    requiredRole: 'Muestreo', // Requiere rol "Muestreo" del SAC
    label: 'Muestreo',
    module: 'laboratorio',
  },
  {
    path: '/laboratorio/analisis',
    component: Laboratorio,
    // SIN requiredRole - El acceso ya fue validado por el SAC
    label: 'Análisis de Muestras',
    module: 'laboratorio',
  },
  {
    path: '/laboratorio/historial',
    component: HistorialAnalisis,
    label: 'Historial de Análisis',
    module: 'laboratorio',
  },

  // ========================================
  // MÓDULO: EXPLOSIVOS (Inventario Polvorín)
  // ========================================
  {
    path: '/explosivos/inventario',
    component: Explosivos,
    // Roles permitidos: polvorinero, supervisor_explosivos, admin_explosivos, visualizador_explosivos
    // El SAC valida el acceso según los roles asignados al usuario
    label: 'Inventario de Explosivos',
    module: 'explosivos',
  },
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