// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/auth';

const AuthContext = createContext(null);

/**
 * AuthProvider - Contexto de autenticación del Sistema de Producción
 * 
 * Características:
 * - Valida token con SAC al cargar
 * - Almacena user, roles y permisos
 * - Provee helpers: hasPermission, hasRole
 * - NO hace redirecciones (eso lo maneja AppRoutes)
 */
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [roles, setRoles] = useState([]);
    const [permisos, setPermisos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        validateSession();
    }, []);

    /**
     * Valida la sesión con el SAC
     */
    const validateSession = async () => {
        // ✅ PRIMERO: Leer y guardar todos los parámetros de la URL
        authService.initializeFromUrl();

        // ✅ SEGUNDO: Obtener de sessionStorage
        const token = authService.getToken();
        const moduloId = authService.getModuloId();

        if (!token || !moduloId) {
            console.log("Token o Modulo ID no encontrado, redirigiendo a SAC...");
            window.location.href = 'http://localhost:5173/login';
            return;
        }

        const result = await authService.validateToken(token, moduloId);

        if (result.valid) {
            setUser(result.user);
            setRoles(result.roles);
            setPermisos(result.permisos);
            setAuthenticated(true);
            authService.setUserData(result.user, result.roles, result.permisos);
        } else {
            authService.logout();
        }

        setLoading(false);
    };

    /**
     * Verifica si el usuario tiene un permiso específico
     */
    const hasPermission = (permiso) => {
        const has = permisos.includes(permiso);
        if (!has) {
            console.warn(`⚠️ Permiso "${permiso}" no encontrado. Permisos disponibles:`, permisos);
        }
        return has;
    };

    /**
     * Verifica si el usuario tiene un rol específico
     */
    const hasRole = (rol) => {
        const has = roles.includes(rol);
        if (!has) {
            console.warn(`⚠️ Rol "${rol}" no encontrado. Roles disponibles:`, roles);
        }
        return has;
    };

    /**
     * Cierra la sesión del usuario
     */
    const logout = () => {
        console.log('👋 Cerrando sesión...');
        authService.logout();
    };

    /**
     * Obtener información resumida del usuario
     */
    const getUserInfo = () => ({
        nombre: user?.nombre || '',
        apellido: user?.apellido || '',
        nombreCompleto: `${user?.nombre || ''} ${user?.apellido || ''}`.trim(),
        email: user?.email || '',
        rut: user?.rut || '',
        faena: user?.faena?.ubicacion || 'No asignada',
    });

    // Mostrar loading mientras valida
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Validando sesión...</p>
                </div>
            </div>
        );
    }

    // Proveer contexto
    return (
        <AuthContext.Provider value={{
            user,
            roles,
            permisos,
            authenticated,
            loading,
            hasPermission,
            hasRole,
            logout,
            getUserInfo,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

/**
 * Hook para usar el contexto de autenticación
 */
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe usarse dentro de AuthProvider');
    }
    return context;
};