// src/routes/routesConfig.js
import { lazy } from 'react';

const Ingenieria            = lazy(() => import('../modules/ingenieria/pages/Ingenieria'));
const FrentesTrabajo        = lazy(() => import('../modules/ingenieria/pages/FrentesTrabajo'));
const FrentesTrabajoHistorial = lazy(() => import('../modules/ingenieria/pages/FrentesTrabajoHistorial'));
const TiposFrente           = lazy(() => import('../modules/ingenieria/pages/TiposFrente'));
const Dumpadas              = lazy(() => import('../modules/dispatch/pages/Dispatch'));
const Laboratorio           = lazy(() => import('../modules/laboratorio/pages/Laboratorio'));
const Muestreo              = lazy(() => import('../modules/laboratorio/pages/Muestreo'));
const HistorialAnalisis     = lazy(() => import('../modules/laboratorio/pages/HistorialAnalisis'));
const Explosivos            = lazy(() => import('../modules/explosivos/pages/Explosivos'));

export const routesConfig = [
  // ========================================
  // MÓDULO: INGENIERÍA
  // ========================================
  {
    path: '/ingenieria',
    component: Ingenieria,
    label: 'Ingeniería Hub',
    module: 'ingenieria',
  },
  {
    path: '/ingenieria/frentes-trabajo',
    component: FrentesTrabajo,
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

  // ========================================
  // MÓDULO: DISPATCH
  // ========================================
  {
    path: '/dispatch/dumpadas',
    component: Dumpadas,
    label: 'Dumpadas',
    module: 'dispatch',
  },

  // ========================================
  // MÓDULO: LABORATORIO
  // ========================================
  {
    path: '/laboratorio/muestreo',
    component: Muestreo,
    requiredRole: 'Muestreo',
    label: 'Muestreo',
    module: 'laboratorio',
  },
  {
    path: '/laboratorio/analisis',
    component: Laboratorio,
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
  // MÓDULO: EXPLOSIVOS
  // ========================================
  {
    path: '/explosivos/inventario',
    component: Explosivos,
    label: 'Inventario de Explosivos',
    module: 'explosivos',
  },
];

export const getAvailableRoutes = (permisos, roles) => {
  return routesConfig.filter(route => {
    if (!route.requiredPermission && !route.requiredRole) return true;

    if (route.requiredPermission) {
      const permissions = Array.isArray(route.requiredPermission)
        ? route.requiredPermission : [route.requiredPermission];
      const hasPermission = route.requireAll
        ? permissions.every(p => permisos.includes(p))
        : permissions.some(p => permisos.includes(p));
      if (!hasPermission) return false;
    }

    if (route.requiredRole) {
      const rolesRequired = Array.isArray(route.requiredRole)
        ? route.requiredRole : [route.requiredRole];
      const hasRole = route.requireAll
        ? rolesRequired.every(r => roles.includes(r))
        : rolesRequired.some(r => roles.includes(r));
      if (!hasRole) return false;
    }

    return true;
  });
};

export const getRoutesByModule = (permisos, roles) => {
  const availableRoutes = getAvailableRoutes(permisos, roles);
  return availableRoutes.reduce((acc, route) => {
    const module = route.module || 'general';
    if (!acc[module]) acc[module] = [];
    acc[module].push(route);
    return acc;
  }, {});
};
