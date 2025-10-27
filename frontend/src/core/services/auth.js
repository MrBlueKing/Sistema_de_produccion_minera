// src/services/auth.js
const AUTH_API = 'http://127.0.0.1:8001/api';
const MODULO_ID = 1;

/**
 * AuthService - Servicio de autenticación para el Sistema de Producción
 * 
 * Responsabilidades:
 * - Obtener token de URL o localStorage
 * - Validar token con SAC
 * - Gestionar datos de usuario en localStorage
 * - Logout y limpieza de sesión
 */
class AuthService {
  /**
   * Valida el token con el Sistema de Autenticación Central (SAC)
   */
  async validateToken(token) {
    try {
      const response = await fetch(`${AUTH_API}/validar-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ modulo_id: MODULO_ID })
      });

      if (!response.ok) {
        console.error('❌ Error al validar token:', response.status);
        throw new Error('Token inválido');
      }

      const data = await response.json();
      
      console.log('✅ Token validado exitosamente');
      return {
        valid: true,
        user: data.user,
        roles: data.roles,
        permisos: data.permisos
      };
    } catch (error) {
      console.error('❌ Error validando token:', error.message);
      return { valid: false };
    }
  }

  /**
   * Obtiene el token de autenticación
   * Prioridad: URL query param → localStorage
   */
  getToken() {
    // 1. Intentar obtener de URL (cuando viene desde SAC)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    
    if (tokenFromUrl) {
      console.log('🔑 Token obtenido de URL');
      // Guardar en localStorage para futuras requests
      localStorage.setItem('auth_token', tokenFromUrl);
      
      // Limpiar URL (quitar token visible)
      window.history.replaceState({}, document.title, window.location.pathname);
      
      return tokenFromUrl;
    }

    // 2. Obtener de localStorage
    const tokenFromStorage = localStorage.getItem('auth_token');
    if (tokenFromStorage) {
      console.log('🔑 Token obtenido de localStorage');
    }
    
    return tokenFromStorage;
  }

  /**
   * Guarda los datos del usuario en localStorage
   */
  setUserData(user, roles, permisos) {
    try {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('roles', JSON.stringify(roles));
      localStorage.setItem('permisos', JSON.stringify(permisos));
      console.log('💾 Datos de usuario guardados en localStorage');
    } catch (error) {
      console.error('❌ Error guardando datos de usuario:', error);
    }
  }

  /**
   * Obtiene los datos del usuario de localStorage
   */
  getUserData() {
    try {
      const user = localStorage.getItem('user');
      const roles = localStorage.getItem('roles');
      const permisos = localStorage.getItem('permisos');

      return {
        user: user ? JSON.parse(user) : null,
        roles: roles ? JSON.parse(roles) : [],
        permisos: permisos ? JSON.parse(permisos) : []
      };
    } catch (error) {
      console.error('❌ Error obteniendo datos de usuario:', error);
      return {
        user: null,
        roles: [],
        permisos: []
      };
    }
  }

  /**
   * Limpia los datos del usuario de localStorage
   */
  clearUserData() {
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('roles');
      localStorage.removeItem('permisos');
      console.log('🧹 Datos de usuario limpiados de localStorage');
    } catch (error) {
      console.error('❌ Error limpiando datos de usuario:', error);
    }
  }

  /**
   * Cierra la sesión del usuario
   * Limpia localStorage y redirige al SAC
   */
  logout() {
    console.log('👋 Ejecutando logout...');
    
    // Limpiar todo el localStorage
    localStorage.clear();
    
    // Redirigir al login del Sistema de Autenticación Central
    window.location.href = 'http://localhost:5173/login';
  }

  /**
   * Verifica si hay un token almacenado
   */
  hasToken() {
    return !!this.getToken();
  }
}

export default new AuthService();