import { useState, useRef, useEffect } from 'react';
import { HiArrowRightOnRectangle, HiChevronDown, HiUser } from 'react-icons/hi2';
import { useAuth } from '../../../core/context/AuthContext';
import logo from '../../../assets/logo.png';

export default function Header() {
  const { getUser, getUserInfo, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const user = getUser();
  const userInfo = getUserInfo();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getUserInitials = () => {
    const nombre = user?.nombre || '';
    const apellido = user?.apellido || '';
    return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
  };

  const getRolPrincipal = () => {
    if (!user?.roles || user.roles.length === 0) return 'Usuario';
    const prioridad = ['Encargado Dispatch', 'Operador Dispatch', 'Laboratorio', 'ingeniero'];
    for (const rolPrioridad of prioridad) {
      if (user.roles.some(rol => rol === rolPrioridad || rol.toLowerCase() === rolPrioridad.toLowerCase())) {
        return rolPrioridad;
      }
    }
    return user.roles[0];
  };

  return (
    <header className="relative bg-gradient-to-r from-orange-500 to-orange-600 shadow-xl">

      {/* Línea inferior sutil */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/20" />

      <div className="flex items-center h-[78px]">

        {/* Logo solo */}
        <div className="flex items-center px-6 h-full">
          <img src={logo} alt="Logo Empresa" className="h-14 w-auto object-contain drop-shadow-md" />
        </div>

        {/* Separador */}
        <div className="w-px h-9 bg-white/30 flex-shrink-0" />

        {/* Título */}
        <div className="flex-1 px-7">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-white font-black text-[26px] tracking-tight leading-none drop-shadow-sm">
              SISTEMA DE PRODUCCIÓN
            </span>
            <span className="text-white/75 font-black text-[26px] tracking-tight leading-none drop-shadow-sm">
              MINERA
            </span>
          </div>
          <p className="text-white/60 text-[10px] tracking-[0.28em] uppercase font-semibold mt-1.5">
            Producción &nbsp;·&nbsp; Gestión &nbsp;·&nbsp; Control Integrado
          </p>
        </div>

        {/* Separador */}
        <div className="w-px h-9 bg-white/30 flex-shrink-0" />

        {/* Usuario */}
        <div className="relative h-full flex items-center px-5" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-black/10 transition-all duration-200 group"
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white text-orange-600 font-bold text-sm flex-shrink-0 shadow-md">
              {getUserInitials()}
            </div>

            <div className="text-left hidden sm:block">
              <p className="text-white font-semibold text-[13px] leading-tight">
                {userInfo.nombreCompleto || 'Usuario'}
              </p>
              <p className="text-white/60 text-[11px] leading-tight mt-0.5">
                {getRolPrincipal()}
              </p>
            </div>

            <HiChevronDown
              className={`w-4 h-4 text-white/70 flex-shrink-0 transition-all duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-3 top-[calc(100%-4px)] w-64 rounded-xl overflow-hidden z-50 shadow-2xl border border-gray-100">

              {/* Header dropdown */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center bg-white text-orange-600 font-bold flex-shrink-0 shadow-md">
                    {getUserInitials()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">
                      {userInfo.nombreCompleto || 'Usuario'}
                    </p>
                    <p className="text-white/70 text-xs truncate mt-0.5">{userInfo.email}</p>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="py-1 bg-white">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    window.location.href = `${import.meta.env.VITE_CENTRAL_URL}/profile`;
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-orange-50 flex items-center gap-3 text-gray-700 hover:text-orange-600 transition-colors"
                >
                  <HiUser className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium">Mi Perfil</span>
                </button>
              </div>

              {/* Logout */}
              <div className="border-t border-gray-100 bg-white">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-red-50 flex items-center gap-3 text-red-500 hover:text-red-600 transition-colors"
                >
                  <HiArrowRightOnRectangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
