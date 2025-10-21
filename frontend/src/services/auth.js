const AUTH_API = 'http://127.0.0.1:8001/api';
const MODULO_ID = 2;

class AuthService {
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

  getToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    
    if (tokenFromUrl) {
      localStorage.setItem('auth_token', tokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
      return tokenFromUrl;
    }

    return localStorage.getItem('auth_token');
  }

  setUserData(user, roles, permisos) {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('roles', JSON.stringify(roles));
    localStorage.setItem('permisos', JSON.stringify(permisos));
  }

  getUserData() {
    const user = localStorage.getItem('user');
    const roles = localStorage.getItem('roles');
    const permisos = localStorage.getItem('permisos');

    return {
      user: user ? JSON.parse(user) : null,
      roles: roles ? JSON.parse(roles) : [],
      permisos: permisos ? JSON.parse(permisos) : []
    };
  }

  logout() {
    localStorage.clear();
    //Frontend sistema de autenticacion centralizado
    window.location.href = 'http://localhost:5173/login';
  }
}

export default new AuthService();