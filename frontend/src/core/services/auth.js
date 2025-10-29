// src/services/auth.js
const AUTH_API = 'http://127.0.0.1:8001/api';

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

  // ✅ NUEVO: Método que lee TODO de la URL de una vez
  initializeFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const moduloFromUrl = urlParams.get('modulo_id');

    let hasParams = false;

    if (tokenFromUrl) {
      sessionStorage.setItem('auth_token', tokenFromUrl);
      hasParams = true;
    }

    if (moduloFromUrl) {
      sessionStorage.setItem('modulo_id', moduloFromUrl);
      hasParams = true;
    }

    // Limpiar URL solo UNA VEZ después de guardar TODO
    if (hasParams) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  /**
   * Valida el token con el Sistema de Autenticación Central (SAC)
   */
  async validateToken(token, moduloId) {
    try {
      const response = await fetch(`${AUTH_API}/validar-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ modulo_id: moduloId })
      });

      if (!response.ok) throw new Error('Token inválido');

      const data = await response.json();
      return {
        valid: true,
        user: data.user,
        roles: data.roles,
        permisos: data.permisos
      };
    } catch (error) {
      console.error('Error validando token:', error);
      return { valid: false };
    }
  }

  /**
   * Obtiene el token de autenticación
   * Prioridad: URL query param → localStorage
   */
  getToken() {
    return sessionStorage.getItem('auth_token');
  }

  getModuloId() {
    return sessionStorage.getItem('modulo_id');
  }

  /**
   * Guarda los datos del usuario en localStorage
   */
  setUserData(user, roles, permisos) {
    sessionStorage.setItem('user', JSON.stringify(user));
    sessionStorage.setItem('roles', JSON.stringify(roles));
    sessionStorage.setItem('permisos', JSON.stringify(permisos));
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