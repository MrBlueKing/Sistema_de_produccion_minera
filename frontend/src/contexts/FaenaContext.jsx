import { createContext, useContext, useState, useEffect } from 'react';
import api from '../core/services/api';

const FaenaContext = createContext();

export const FaenaProvider = ({ children }) => {
  // Obtener datos del usuario desde sessionStorage
  const userSession = JSON.parse(sessionStorage.getItem('sisprod_session') || '{}');
  const faenaUsuario = userSession.faena || null; // ID o nombre de faena del usuario
  const roles = userSession.roles || [];

  // Determinar si es usuario global (Encargado Dispatch)
  // Acepta ambos formatos: 'Encargado Dispatch' o 'encargado_dispatch'
  const esUsuarioGlobal = roles.includes('Encargado Dispatch') || roles.includes('encargado_dispatch');

  // Estado de faena seleccionada
  const [faenaSeleccionada, setFaenaSeleccionada] = useState(() => {
    // Usuarios globales: intentar recuperar de localStorage, sino null (ver todas)
    if (esUsuarioGlobal) {
      const stored = localStorage.getItem('faenaSeleccionada');
      // ✅ Convertir a número si existe, sino null
      return stored ? parseInt(stored, 10) : null;
    }
    // Usuarios de faena: siempre su faena
    return faenaUsuario;
  });

  const [faenas, setFaenas] = useState([]);
  const [loading, setLoading] = useState(false);

  // Cargar faenas si es usuario global
  useEffect(() => {
    if (esUsuarioGlobal) {
      cargarFaenas();
    }
  }, [esUsuarioGlobal]);

  // Guardar faena seleccionada en localStorage (solo para globales)
  useEffect(() => {
    if (esUsuarioGlobal && faenaSeleccionada) {
      localStorage.setItem('faenaSeleccionada', faenaSeleccionada);
    }
  }, [faenaSeleccionada, esUsuarioGlobal]);

  const cargarFaenas = async () => {
    try {
      setLoading(true);
      const response = await api.get('/faenas');
      setFaenas(response.data.data || []);
    } catch (error) {
      console.error('Error cargando faenas:', error);
      setFaenas([]);
    } finally {
      setLoading(false);
    }
  };

  const cambiarFaena = (nuevaFaenaId) => {
    if (esUsuarioGlobal) {
      // ✅ Convertir a número si existe, sino null
      const faenaIdNumero = nuevaFaenaId ? parseInt(nuevaFaenaId, 10) : null;
      console.log('🔄 [FAENA CONTEXT] Cambiando faena:', {
        nuevaFaenaId,
        faenaIdNumero,
        tipo: typeof faenaIdNumero
      });
      setFaenaSeleccionada(faenaIdNumero);
    }
  };

  // Debug: Log cuando cambia faenaSeleccionada
  useEffect(() => {
    console.log('📍 [FAENA CONTEXT] Estado actual:', {
      esUsuarioGlobal,
      faenaSeleccionada,
      tipo: typeof faenaSeleccionada,
      totalFaenas: faenas.length
    });
  }, [faenaSeleccionada, esUsuarioGlobal, faenas]);

  const value = {
    esUsuarioGlobal,
    faenaUsuario,
    faenaSeleccionada,
    cambiarFaena,
    faenas,
    loading,
  };

  return (
    <FaenaContext.Provider value={value}>
      {children}
    </FaenaContext.Provider>
  );
};

export const useFaena = () => {
  const context = useContext(FaenaContext);
  if (!context) {
    throw new Error('useFaena debe usarse dentro de FaenaProvider');
  }
  return context;
};

export default FaenaContext;
