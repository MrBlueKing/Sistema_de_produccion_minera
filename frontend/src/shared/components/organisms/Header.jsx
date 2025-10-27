import { HiArrowRightOnRectangle } from 'react-icons/hi2';
import { useAuth } from '../../../core/context/AuthContext';
import Button from '../atoms/Button';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              📦 Sistema de Producción
            </h1>
            <p className="text-sm text-gray-600">
              Bienvenido, {user?.nombre} {user?.apellido}
            </p>
          </div>
          <Button 
            variant="danger" 
            onClick={logout}
            icon={HiArrowRightOnRectangle}
          >
            Cerrar Sesión
          </Button>
        </div>
      </div>
    </header>
  );
}