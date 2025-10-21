export const getTokenFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  
  if (token) {
    localStorage.setItem('auth_token', token);
    // Limpiar URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  
  return localStorage.getItem('auth_token');
};