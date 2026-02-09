import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './core/context/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { FaenaProvider } from './contexts/FaenaContext';
import AppRoutes from './routes/AppRoutes';
import './app.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <FaenaProvider>
            <AppRoutes />
          </FaenaProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}