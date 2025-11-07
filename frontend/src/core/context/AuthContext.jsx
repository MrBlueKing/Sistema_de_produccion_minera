import { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/auth';

const AuthContext = createContext(null);

/**
 * AuthProvider - Contexto de autenticación del Sistema de Producción
 *
 * Mejoras implementadas:
 * - Usa SecureStorage para datos sensibles
 * - Minimiza datos en state (solo lo necesario para UI)
 * - Auto-renovación de sesión
 * - Validación mejorada de sesión
 * - Mejor manejo de errores
 */
export const AuthProvider = ({ children }) => {
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        initializeSession();
    }, []);

    /**
     * Inicializa y valida la sesión
     */
    const initializeSession = async () => {
        try {
            console.log('🔐 Inicializando sesión...');

            // Inicializar desde URL si hay parámetros
            await authService.initializeFromUrl();

            // Verificar si hay sesión válida
            if (!authService.hasValidSession()) {
                console.warn('⚠️ No hay sesión válida');
                setAuthenticated(false);
                setLoading(false);
                authService.logout();
                return;
            }

            // Sesión válida encontrada
            console.log('✅ Sesión válida encontrada');
            setAuthenticated(true);

        } catch (error) {
            console.error('❌ Error inicializando sesión:', error);
            setAuthenticated(false);
            authService.logout();
        } finally {
            setLoading(false);
        }
    };

    /**
     * Obtiene el usuario actual desde SecureStorage
     */
    const getUser = () => {
        return authService.getUser();
    };

    /**
     * Obtiene información resumida del usuario
     */
    const getUserInfo = () => {
        const user = getUser();
        return {
            nombre: user?.nombre || '',
            apellido: user?.apellido || '',
            nombreCompleto: `${user?.nombre || ''} ${user?.apellido || ''}`.trim(),
            email: user?.email || '',
            rut: user?.rut || '',
            id: user?.id || null,
        };
    };

    /**
     * Verifica si el usuario tiene un rol específico
     */
    const hasRole = (roleId) => {
        const has = authService.hasRole(roleId);
        if (!has) {
            const user = getUser();
            console.warn(`⚠️ Rol "${roleId}" no encontrado. Roles disponibles:`, user?.roles);
        }
        return has;
    };

    /**
     * Verifica si el usuario tiene un permiso específico
     */
    const hasPermission = (permissionId) => {
        const has = authService.hasPermission(permissionId);
        if (!has) {
            const user = getUser();
            console.warn(`⚠️ Permiso "${permissionId}" no encontrado. Permisos disponibles:`, user?.permisos);
        }
        return has;
    };

    /**
     * Obtiene información del estado de la sesión
     */
    const getSessionInfo = () => {
        return authService.getSessionInfo();
    };

    /**
     * Cierra la sesión del usuario
     */
    const logout = () => {
        console.log('👋 Cerrando sesión desde contexto...');
        authService.logout();
    };

    // Mostrar loading mientras valida
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                    <p className="text-blue-900 font-semibold text-lg">Validando sesión...</p>
                    <p className="text-blue-600 text-sm mt-2">Sistema de Producción</p>
                </div>
            </div>
        );
    }

    // Proveer contexto con funciones mejoradas
    return (
        <AuthContext.Provider value={{
            authenticated,
            loading,
            getUser,
            getUserInfo,
            hasRole,
            hasPermission,
            getSessionInfo,
            logout,
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