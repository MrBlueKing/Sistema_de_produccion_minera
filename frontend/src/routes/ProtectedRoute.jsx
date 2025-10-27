// src/routes/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../core/context/AuthContext';

/**
 * ProtectedRoute - Componente que protege rutas según permisos
 * 
 * @param {ReactNode} children - Componente a renderizar si tiene permiso
 * @param {string|string[]} requiredPermission - Permiso(s) requerido(s)
 * @param {string|string[]} requiredRole - Rol(es) requerido(s) [opcional]
 * @param {boolean} requireAll - Si true, requiere TODOS los permisos. Si false, con uno basta
 * 
 * Ejemplos de uso:
 * <ProtectedRoute requiredPermission="ingreso_frentes">
 * <ProtectedRoute requiredPermission={["crear_frentes", "editar_frentes"]} requireAll={false}>
 * <ProtectedRoute requiredRole="Administrador">
 */
export default function ProtectedRoute({ 
  children, 
  requiredPermission = null,
  requiredRole = null,
  requireAll = false 
}) {
  const { hasPermission, hasRole, permisos, roles } = useAuth();

  // Verificar permisos si se especificaron
  if (requiredPermission) {
    const permissions = Array.isArray(requiredPermission) 
      ? requiredPermission 
      : [requiredPermission];
    
    const hasAccess = requireAll
      ? permissions.every(p => hasPermission(p))
      : permissions.some(p => hasPermission(p));

    if (!hasAccess) {
      console.warn('⛔ Acceso denegado - Permisos requeridos:', permissions);
      console.warn('📋 Permisos del usuario:', permisos);
      return <Navigate to="/acceso-denegado" replace />;
    }
  }

  // Verificar roles si se especificaron
  if (requiredRole) {
    const rolesRequired = Array.isArray(requiredRole) 
      ? requiredRole 
      : [requiredRole];
    
    const hasAccess = requireAll
      ? rolesRequired.every(r => hasRole(r))
      : rolesRequired.some(r => hasRole(r));

    if (!hasAccess) {
      console.warn('⛔ Acceso denegado - Roles requeridos:', rolesRequired);
      console.warn('📋 Roles del usuario:', roles);
      return <Navigate to="/acceso-denegado" replace />;
    }
  }

  // ✅ Usuario tiene permisos, renderizar componente
  return children;
}