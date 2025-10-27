// src/routes/AppRoutes.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../core/context/AuthContext';
import ProtectedRoute from '../routes/ProtectedRoute';
import AccesoDenegado from '../pages/AccesoDenegado';
import { routesConfig } from './routesConfig';

/**
 * AppRoutes - Manejo inteligente de rutas del Sistema de Producción
 * 
 * Características:
 * - Protección automática por permisos
 * - Respeta la URL original del usuario (viene desde SAC con token)
 * - No redirige a dashboard innecesario
 * - Página de acceso denegado para permisos insuficientes
 */
export default function AppRoutes() {
  const { authenticated, loading } = useAuth();

  // ========================================
  // LOADING STATE
  // ========================================
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Validando sesión...</p>
        </div>
      </div>
    );
  }

  // ========================================
  // NOT AUTHENTICATED - Redirigir a SAC
  // ========================================
  if (!authenticated) {
    console.log("Usuario no autenticado...")
    window.location.href = 'http://localhost:5173/login';
    return null;
  }

  // ========================================
  // AUTHENTICATED - Renderizar rutas protegidas
  // ========================================
  return (
    <Routes>
      {/* Ruta raíz - Redirige al login de SAC */}
      {/* El usuario SIEMPRE debe venir con una URL específica desde SAC */}
      <Route 
        path="/" 
        element={
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center max-w-md">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                Sistema de Producción
              </h1>
              <p className="text-gray-600 mb-6">
                Este sistema debe ser accedido desde el Dashboard de Autenticación Central.
              </p>
              <button
                onClick={() => window.location.href = 'http://localhost:5173'}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ir al Dashboard Central
              </button>
            </div>
          </div>
        } 
      />

      {/* Generar rutas dinámicamente desde configuración */}
      {routesConfig.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={
            <ProtectedRoute
              requiredPermission={route.requiredPermission}
              requiredRole={route.requiredRole}
              requireAll={route.requireAll}
            >
              <route.component />
            </ProtectedRoute>
          }
        />
      ))}

      {/* Página de Acceso Denegado */}
      <Route path="/acceso-denegado" element={<AccesoDenegado />} />

      {/* 404 - Ruta no encontrada */}
      <Route 
        path="*" 
        element={
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
              <p className="text-xl text-gray-600 mb-6">Página no encontrada</p>
              <button
                onClick={() => window.location.href = 'http://localhost:5173'}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Volver al Dashboard Central
              </button>
            </div>
          </div>
        } 
      />
    </Routes>
  );
}