/**
 * SecureStorage - Gestión segura de almacenamiento
 *
 * Características:
 * - Usa sessionStorage (se limpia al cerrar pestaña)
 * - Validación de integridad de datos
 * - Expiración automática de tokens
 * - Limpieza automática de datos expirados
 * - Manejo centralizado de errores
 */

const STORAGE_PREFIX = 'sisprod_';
const TOKEN_KEY = `${STORAGE_PREFIX}auth`;
const SESSION_KEY = `${STORAGE_PREFIX}session`;

class SecureStorage {
  constructor() {
    // Limpiar datos legacy sin prefijo (del sistema viejo)
    this.cleanLegacyData();

    // Migrar datos si es necesario (agregar campos faltantes)
    this.migrateSessionData();

    // Limpiar datos expirados al iniciar
    this.cleanExpiredData();
  }

  /**
   * Migra datos de sesión para agregar campos faltantes
   * (útil cuando se agregan nuevos campos al sistema)
   */
  migrateSessionData() {
    try {
      const sessionData = this.getSessionData();
      const legacyUser = sessionStorage.getItem('user');

      // Si no hay apellido en sisprod_session pero sí en el user legacy
      if (sessionData && !sessionData.apellido && legacyUser) {
        const oldUser = JSON.parse(legacyUser);

        if (oldUser.apellido || oldUser.rut) {
          console.log('🔄 Migrando datos de usuario...');

          const updatedData = {
            ...sessionData,
            apellido: oldUser.apellido || '',
            rut: oldUser.rut || ''
          };

          sessionStorage.setItem(SESSION_KEY, JSON.stringify(updatedData));
          console.log('✅ Datos migrados exitosamente');
        }
      }
    } catch (error) {
      console.error('❌ Error en migración:', error);
    }
  }

  /**
   * Limpia datos del sistema viejo (sin prefijo sisprod_)
   * Esta función se ejecuta una sola vez al iniciar
   */
  cleanLegacyData() {
    try {
      const legacyKeys = [
        'auth_token',
        'modulo_id',
        'permisos',
        'roles',
        'user'
      ];

      let cleaned = 0;
      legacyKeys.forEach(key => {
        if (sessionStorage.getItem(key)) {
          sessionStorage.removeItem(key);
          cleaned++;
        }
        // También limpiar localStorage por si acaso
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          cleaned++;
        }
      });

      if (cleaned > 0) {
        console.log(`🧹 Limpiados ${cleaned} datos legacy del sistema viejo`);
      }
    } catch (error) {
      console.error('❌ Error limpiando datos legacy:', error);
    }
  }

  /**
   * Guarda datos de autenticación con expiración
   */
  setAuthData(token, moduloId, expiresInMinutes = 480) {
    try {
      const expiresAt = Date.now() + (expiresInMinutes * 60 * 1000);

      const authData = {
        token,
        moduloId,
        expiresAt,
        createdAt: Date.now()
      };

      sessionStorage.setItem(TOKEN_KEY, JSON.stringify(authData));

      console.log('✅ Datos de autenticación guardados (expira en', expiresInMinutes, 'minutos)');
    } catch (error) {
      console.error('❌ Error guardando datos de auth:', error);
      throw new Error('No se pudo guardar la sesión');
    }
  }

  /**
   * Obtiene el token si es válido
   */
  getToken() {
    const authData = this.getAuthData();
    return authData?.token || null;
  }

  /**
   * Obtiene el módulo ID
   */
  getModuloId() {
    const authData = this.getAuthData();
    return authData?.moduloId || null;
  }

  /**
   * Obtiene datos de autenticación completos
   */
  getAuthData() {
    try {
      const data = sessionStorage.getItem(TOKEN_KEY);
      if (!data) return null;

      const authData = JSON.parse(data);

      // Validar si el token ha expirado
      if (authData.expiresAt && Date.now() > authData.expiresAt) {
        console.warn('⚠️ Token expirado, limpiando sesión...');
        this.clearAuth();
        return null;
      }

      return authData;
    } catch (error) {
      console.error('❌ Error obteniendo datos de auth:', error);
      this.clearAuth();
      return null;
    }
  }

  /**
   * Verifica si hay una sesión válida
   */
  hasValidSession() {
    const authData = this.getAuthData();
    return authData !== null && !!authData.token;
  }

  /**
   * Guarda datos mínimos de usuario (solo lo necesario)
   */
  setSessionData(user, roles = null, permisos = null) {
    try {
      // Determinar cómo extraer roles y permisos
      // Pueden venir como user.roles o como parámetro separado
      const userRoles = roles || user.roles || [];
      const userPermisos = permisos || user.permisos || [];

      // Normalizar: pueden ser strings, números u objetos
      const normalizedRoles = Array.isArray(userRoles)
        ? userRoles.map(r => typeof r === 'object' ? (r.id || r.nombre || r) : r)
        : [];

      const normalizedPermisos = Array.isArray(userPermisos)
        ? userPermisos.map(p => typeof p === 'object' ? (p.id || p.codigo || p.nombre || p) : p)
        : [];

      const minimalUserData = {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido || '',
        email: user.email,
        rut: user.rut || '',
        roles: normalizedRoles,
        permisos: normalizedPermisos
      };

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(minimalUserData));

      console.log('✅ Datos de sesión guardados:', {
        roles: normalizedRoles,
        permisos: normalizedPermisos
      });
    } catch (error) {
      console.error('❌ Error guardando datos de sesión:', error);
    }
  }

  /**
   * Obtiene datos de usuario
   */
  getSessionData() {
    try {
      const data = sessionStorage.getItem(SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('❌ Error obteniendo datos de sesión:', error);
      return null;
    }
  }

  /**
   * Obtiene el usuario actual
   */
  getUser() {
    const sessionData = this.getSessionData();
    return sessionData || null;
  }

  /**
   * Verifica si el usuario tiene un rol específico
   * Soporta: strings, números, o nombres de rol
   */
  hasRole(roleIdentifier) {
    const sessionData = this.getSessionData();
    if (!sessionData || !sessionData.roles) return false;

    // Normalizar el identificador a string para comparación flexible
    const normalizedId = String(roleIdentifier).toLowerCase();

    return sessionData.roles.some(role => {
      const normalizedRole = String(role).toLowerCase();
      return normalizedRole === normalizedId;
    });
  }

  /**
   * Verifica si el usuario tiene un permiso específico
   * Soporta: strings (códigos), números, o nombres de permiso
   */
  hasPermission(permissionIdentifier) {
    const sessionData = this.getSessionData();
    if (!sessionData || !sessionData.permisos) return false;

    // Normalizar el identificador a string para comparación flexible
    const normalizedId = String(permissionIdentifier).toLowerCase();

    return sessionData.permisos.some(permiso => {
      const normalizedPermiso = String(permiso).toLowerCase();
      return normalizedPermiso === normalizedId;
    });
  }

  /**
   * Limpia solo los datos de autenticación
   */
  clearAuth() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      console.log('🧹 Datos de autenticación limpiados');
    } catch (error) {
      console.error('❌ Error limpiando auth:', error);
    }
  }

  /**
   * Limpia todos los datos de la sesión
   */
  clearAll() {
    try {
      // Limpiar solo nuestras keys
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith(STORAGE_PREFIX)) {
          sessionStorage.removeItem(key);
        }
      });

      console.log('🧹 Todos los datos de sesión limpiados');
    } catch (error) {
      console.error('❌ Error limpiando sesión:', error);
      // Fallback: limpiar todo
      sessionStorage.clear();
    }
  }

  /**
   * Limpia datos expirados automáticamente
   */
  cleanExpiredData() {
    try {
      const authData = this.getAuthData();
      // getAuthData ya limpia si está expirado
      if (!authData) {
        this.clearAuth();
      }
    } catch (error) {
      console.error('❌ Error limpiando datos expirados:', error);
    }
  }

  /**
   * Obtiene tiempo restante de sesión en minutos
   */
  getSessionTimeLeft() {
    const authData = this.getAuthData();
    if (!authData || !authData.expiresAt) return 0;

    const timeLeft = authData.expiresAt - Date.now();
    return Math.max(0, Math.floor(timeLeft / 60000)); // Convertir a minutos
  }

  /**
   * Renueva la expiración del token (útil para keep-alive)
   */
  refreshExpiration(expiresInMinutes = 480) {
    const authData = this.getAuthData();
    if (!authData) return false;

    const newExpiresAt = Date.now() + (expiresInMinutes * 60 * 1000);
    authData.expiresAt = newExpiresAt;

    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(authData));
    console.log('🔄 Expiración de sesión renovada');
    return true;
  }
}

export default new SecureStorage();
