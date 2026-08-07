// src/pages/ModuloNoConfigurado.jsx
import { HiExclamationTriangle } from 'react-icons/hi2';
import { useAuth } from '../core/context/AuthContext';

export default function ModuloNoConfigurado() {
  const { user, logout } = useAuth();

  const handleVolverPortal = () => {
    window.location.href = import.meta.env.VITE_CENTRAL_URL;
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="flex justify-center mb-6">
          <div className="bg-amber-100 rounded-full p-6">
            <HiExclamationTriangle className="w-16 h-16 text-amber-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Hubo un problema
          </h1>

          <p className="text-gray-600 mb-2">
            Hola <strong>{user?.nombre}</strong>,
          </p>

          <p className="text-gray-600 mb-6">
            No pudimos determinar la página de inicio para tu rol. Esto suele pasar cuando un rol
            nuevo todavía no tiene una sección asignada.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-amber-800">
              Volvé al Portal M3H y probá entrar de nuevo. Si el problema sigue, avisa al
              administrador del sistema para que revise la configuración de tu rol.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleVolverPortal}
              className="w-full px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium"
            >
              Volver al Portal M3H
            </button>

            <button
              onClick={handleLogout}
              className="w-full px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
