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
        const token = authService.getToken();

        // Sin token, no hacer nada (AppRoutes manejará la redirección)
        if (!token) {
            console.warn('⚠️ No hay token disponible');
            setLoading(false);
            setAuthenticated(false);
            return;
        }

        // Validar token con SAC
        const result = await authService.validateToken(token);

        if (result.valid) {
            console.log('✅ Token válido - Sesión establecida');
            console.log('👤 Usuario:', result.user.nombre, result.user.apellido);
            console.log('🎭 Roles:', result.roles);
            console.log('🔑 Permisos:', result.permisos);

            setUser(result.user);
            setRoles(result.roles);
            setPermisos(result.permisos);
            setAuthenticated(true);
            authService.setUserData(result.user, result.roles, result.permisos);
        } else {
            console.error('❌ Token inválido - Limpiando sesión');
            // Limpiar datos pero NO redirigir (lo hace AppRoutes)
            setUser(null);
            setRoles([]);
            setPermisos([]);
            setAuthenticated(false);
            authService.clearUserData();
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