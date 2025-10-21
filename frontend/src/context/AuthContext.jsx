import { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [roles, setRoles] = useState([]);
    const [permisos, setPermisos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        validateSession();
    }, []);

    const validateSession = async () => {
        const token = authService.getToken();

        if (!token) {
            //Frontend sistema de autenticacion centralizado
            window.location.href = 'http://localhost:5173/login';
            return;
        }

        const result = await authService.validateToken(token);

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

    const hasPermission = (permiso) => permisos.includes(permiso);
    const hasRole = (rol) => roles.includes(rol);
    const logout = () => authService.logout();

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

    if (!authenticated) {
        return null;
    }

    return (
        <AuthContext.Provider value={{
            user,
            roles,
            permisos,
            hasPermission,
            hasRole,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe usarse dentro de AuthProvider');
    }
    return context;
};