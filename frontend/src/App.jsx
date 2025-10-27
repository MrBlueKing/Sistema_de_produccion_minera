import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './core/context/AuthContext';
import AppRoutes from './routes/AppRoutes';
import './app.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}