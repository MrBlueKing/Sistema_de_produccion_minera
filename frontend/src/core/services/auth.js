import secureStorage from './secureStorage';

const AUTH_API = 'http://127.0.0.1:8001/api';
const CENTRAL_URL = 'http://localhost:5173';

/**
 * AuthService - Servicio de autenticación para el Sistema de Producción
 *
 * Responsabilidades:
 * - Inicializar sesión desde URL
 * - Validar tokens con el Sistema Central
 * - Gestionar autenticación de forma segura
 * - Manejar logout y redirecciones
 *
 * Mejoras de seguridad:
 * - Usa SecureStorage con expiración automática
 * - Minimiza datos guardados
 * - Limpieza completa de sesión
 * - Validación de integridad
 */
class AuthService {

  /**
   * Inicializa la sesión desde parámetros de URL
   * Solo se ejecuta una vez al cargar la aplicación
   */
  async initializeFromUrl() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const moduloId = urlParams.get('modulo_id');

      if (!token || !moduloId) {
        console.log('ℹ️ No hay parámetros de autenticación en URL');
        return false;
      }

      console.log('🔐 Inicializando sesión desde URL...');

      // Validar token antes de guardarlo
      const validation = await this.validateToken(token, moduloId);

      if (!validation.valid) {
        console.error('❌ Token de URL inválido');
        this.logout();
        return false;
      }

      // Guardar datos de autenticación (token expira en 8 horas por defecto)
      secureStorage.setAuthData(token, moduloId, 480);

      // Guardar datos mínimos del usuario (roles y permisos vienen por separado del SAC)
      if (validation.user) {
        secureStorage.setSessionData(
          validation.user,
          validation.roles,
          validation.permisos
        );
      }

      // Limpiar URL después de guardar TODO
      window.history.replaceState({}, document.title, window.location.pathname);

      console.log('✅ Sesión inicializada correctamente');
      return true;

    } catch (error) {
      console.error('❌ Error inicializando desde URL:', error);
      this.logout();
      return false;
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

      if (!response.ok) {
        throw new Error('Token inválido');
      }

      const data = await response.json();

      return {
        valid: true,
        user: data.user,
        roles: data.roles,
        permisos: data.permisos
      };
    } catch (error) {
      console.error('❌ Error validando token:', error);
      return { valid: false };
    }
  }

  /**
   * Obtiene el token de autenticación
   */
  getToken() {
    return secureStorage.getToken();
  }

  /**
   * Obtiene el ID del módulo
   */
  getModuloId() {
    return secureStorage.getModuloId();
  }

  /**
   * Obtiene el usuario actual
   */
  getUser() {
    return secureStorage.getUser();
  }

  /**
   * Obtiene los datos completos de la sesión
   */
  getSessionData() {
    return secureStorage.getSessionData();
  }

  /**
   * Verifica si hay una sesión válida
   */
  hasValidSession() {
    return secureStorage.hasValidSession();
  }

  /**
   * Verifica si hay un token almacenado (legacy)
   */
  hasToken() {
    return this.hasValidSession();
  }

  /**
   * Verifica si el usuario tiene un rol específico
   */
  hasRole(roleId) {
    return secureStorage.hasRole(roleId);
  }

  /**
   * Verifica si el usuario tiene un permiso específico
   */
  hasPermission(permissionId) {
    return secureStorage.hasPermission(permissionId);
  }

  /**
   * Obtiene el tiempo restante de la sesión en minutos
   */
  getSessionTimeLeft() {
    return secureStorage.getSessionTimeLeft();
  }

  /**
   * Renueva la sesión (útil para keep-alive)
   */
  refreshSession() {
    return secureStorage.refreshExpiration();
  }

  /**
   * Cierra la sesión del usuario
   * Limpia todos los datos y redirige al Sistema Central
   */
  logout() {
    console.log('👋 Cerrando sesión...');

    try {
      // Limpiar todos los datos de sesión
      secureStorage.clearAll();

      // También limpiar localStorage por si acaso (compatibilidad)
      localStorage.clear();

      console.log('✅ Sesión cerrada correctamente');

      // Redirigir al login del Sistema Central
      window.location.href = `${CENTRAL_URL}/login`;
    } catch (error) {
      console.error('❌ Error en logout:', error);
      // Forzar limpieza y redirección de todos modos
      sessionStorage.clear();
      localStorage.clear();
      window.location.href = `${CENTRAL_URL}/login`;
    }
  }

  /**
   * Verifica si la sesión está por expirar (menos de 30 minutos)
   */
  isSessionExpiringSoon() {
    const timeLeft = this.getSessionTimeLeft();
    return timeLeft > 0 && timeLeft < 30;
  }

  /**
   * Obtiene información del estado de la sesión (útil para debugging)
   */
  getSessionInfo() {
    return {
      hasSession: this.hasValidSession(),
      user: this.getUser(),
      timeLeft: this.getSessionTimeLeft(),
      expiringSoon: this.isSessionExpiringSoon()
    };
  }
}

export default new AuthService();