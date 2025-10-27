// src/pages/AccesoDenegado.jsx
import { useNavigate } from 'react-router-dom';
import { HiShieldExclamation, HiArrowLeft } from 'react-icons/hi2';
import { useAuth } from '../core/context/AuthContext';

export default function AccesoDenegado() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleGoBack = () => {
    // Intenta volver atrás en el historial
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Si no hay historial, redirige al login del SAC
      window.location.href = 'http://localhost:5173/login';
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Icono */}
        <div className="flex justify-center mb-6">
          <div className="bg-red-100 rounded-full p-6">
            <HiShieldExclamation className="w-16 h-16 text-red-600" />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-xl p-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Acceso Denegado
          </h1>
          
          <p className="text-gray-600 mb-2">
            Lo sentimos <strong>{user?.nombre}</strong>,
          </p>
          
          <p className="text-gray-600 mb-6">
            No tienes los permisos necesarios para acceder a esta sección del Sistema de Producción.
          </p>

          {/* Información adicional */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-red-800 mb-2">
              <strong>¿Por qué veo esto?</strong>
            </p>
            <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
              <li>No tienes el rol necesario para este módulo</li>
              <li>No tienes los permisos específicos requeridos</li>
              <li>Tu acceso puede haber sido revocado recientemente</li>
            </ul>
          </div>

          {/* Botones */}
          <div className="space-y-3">
            <button
              onClick={handleGoBack}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium"
            >
              <HiArrowLeft className="w-5 h-5" />
              Volver Atrás
            </button>

            <button
              onClick={handleLogout}
              className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
            >
              Cerrar Sesión
            </button>
          </div>

          {/* Contacto */}
          <p className="text-sm text-gray-500 mt-6">
            Si crees que esto es un error, contacta al administrador del sistema.
          </p>
        </div>
      </div>
    </div>
  );
}