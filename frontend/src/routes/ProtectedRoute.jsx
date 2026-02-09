// src/routes/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../core/context/AuthContext';

/**
 * ProtectedRoute - Componente que protege rutas
 *
 * ✅ ACTUALIZADO para Sistema de Producción con ROLES INTERNOS:
 * - Si NO se especifican permisos/roles requeridos, permite el acceso
 * - La validación de acceso ya fue realizada por el Sistema de Autenticación Centralizado
 * - Solo valida permisos/roles si se especifican explícitamente
 *
 * @param {ReactNode} children - Componente a renderizar si tiene acceso
 * @param {string|string[]} requiredPermission - Permiso(s) requerido(s) [OPCIONAL]
 * @param {string|string[]} requiredRole - Rol(es) requerido(s) [OPCIONAL]
 * @param {boolean} requireAll - Si true, requiere TODOS los permisos/roles. Si false, con uno basta
 *
 * Ejemplos de uso:
 * <ProtectedRoute>  // ✅ Permite acceso (roles internos)
 * <ProtectedRoute requiredPermission="crear_frentes">  // Solo si necesitas validación específica
 * <ProtectedRoute requiredRole="Administrador">  // Solo si necesitas validación de rol
 */
export default function ProtectedRoute({
  children,
  requiredPermission = null,
  requiredRole = null,
  requireAll = false
}) {
  const { hasPermission, hasRole } = useAuth();

  // ✅ Si NO se requieren permisos ni roles, permitir acceso
  // Esto es para sistemas con ROLES INTERNOS donde el acceso ya fue validado
  if (!requiredPermission && !requiredRole) {
    console.log('✅ Acceso permitido - No se requiere validación adicional (Roles Internos)');
    return children;
  }

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
      return <Navigate to="/acceso-denegado" replace />;
    }
  }

  // ✅ Usuario tiene permisos/roles necesarios, renderizar componente
  return children;
}