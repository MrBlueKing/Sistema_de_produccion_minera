import axios from 'axios';
import authService from './auth';

/**
 * Configuración de Axios para el Sistema de Producción
 *
 * Características:
 * - Auto-inyección de token y módulo ID
 * - Manejo automático de errores de autenticación
 * - Renovación automática de sesión en cada request
 * - Logging de errores para debugging
 */

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 segundos
});

/**
 * Interceptor de Request
 * - Inyecta token y módulo ID automáticamente
 * - Renueva la sesión en cada request (keep-alive)
 * - Valida que haya sesión antes de enviar request
 */
api.interceptors.request.use(
  (config) => {
    // Verificar si hay sesión válida
    if (!authService.hasValidSession()) {
      console.warn('⚠️ No hay sesión válida, redirigiendo...');
      authService.logout();
      return Promise.reject(new Error('Sesión no válida'));
    }

    const token = authService.getToken();
    const moduloId = authService.getModuloId();

    // Inyectar headers de autenticación
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (moduloId) {
      config.headers['X-Modulo-ID'] = moduloId;
    }

    // Renovar expiración de sesión en cada request (keep-alive)
    authService.refreshSession();

    return config;
  },
  (error) => {
    console.error('❌ Error en request interceptor:', error);
    return Promise.reject(error);
  }
);

/**
 * Interceptor de Response
 * - Maneja errores de autenticación
 * - Logging de errores
 * - Logout automático en 401/403
 */
api.interceptors.response.use(
  (response) => {
    // Request exitoso
    return response;
  },
  (error) => {
    // Manejar errores de respuesta
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;

    if (status === 401) {
      console.error('❌ No autorizado (401):', message);
      authService.logout();
    } else if (status === 403) {
      console.error('❌ Acceso denegado (403):', message);
      authService.logout();
    } else if (status === 404) {
      console.error('❌ Recurso no encontrado (404):', error.config?.url);
    } else if (status === 422) {
      console.error('❌ Error de validación (422):', error.response?.data?.errors);
    } else if (status >= 500) {
      console.error('❌ Error del servidor (5xx):', message);
    } else {
      console.error('❌ Error en request:', message);
    }

    return Promise.reject(error);
  }
);

export default api;