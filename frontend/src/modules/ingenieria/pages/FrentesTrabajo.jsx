import { useState, useEffect } from 'react';
import { HiPlus, HiArrowLeft } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import Header from '../../../shared/components/organisms/Header';
import Button from '../../../shared/components/atoms/Button';
import Input from '../../../shared/components/atoms/Input';
import Card from '../../../shared/components/atoms/Card';
import Badge from '../../../shared/components/atoms/Badge';
import ingenieriaService from '../../ingenieria/services/ingenieria';

export default function FrentesTrabajo() {
  const navigate = useNavigate();
  const [frentes, setFrentes] = useState([]); // ✅ CORREGIDO: era setFrente
  const [tiposFrente, setTiposFrente] = useState([]);
  const [loading, setLoading] = useState(true); // ✅ CAMBIO: inicia en true
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null); // ✅ NUEVO: manejo de errores
  const [formData, setFormData] = useState({
    nombre: '',
    id_tipo_frente: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔄 Cargando datos de ingeniería...');
      
      const [frentesRes, tiposRes] = await Promise.all([
        ingenieriaService.getFrentesTrabajo(),
        ingenieriaService.getTiposFrente(),
      ]);
      
      console.log('✅ Frentes obtenidos:', frentesRes);
      console.log('✅ Tipos obtenidos:', tiposRes);
      
      setFrentes(frentesRes.data || []); // ✅ CORREGIDO: era setFrente
      setTiposFrente(tiposRes.data || []);
    } catch (error) {
      console.error('❌ Error cargando datos:', error);
      console.error('Error completo:', error.response?.data || error.message);
      
      setError(
        error.response?.data?.message || 
        error.message || 
        'Error al cargar datos'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log('📝 Creando frente:', formData);
      
      const response = await ingenieriaService.createFrenteTrabajo(formData);
      
      console.log('✅ Frente creado:', response);
      
      setFormData({ nombre: '', id_tipo_frente: '' });
      setShowForm(false);
      await loadData();
      
      alert('✅ Frente de trabajo creado exitosamente');
    } catch (error) {
      console.error('❌ Error creando frente:', error);
      console.error('Error completo:', error.response?.data || error.message);
      
      const errorMsg = error.response?.data?.message || 
                       error.response?.data?.errors ||
                       error.message || 
                       'Error al crear frente de trabajo';
      
      alert(`❌ ${errorMsg}`);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // ✅ NUEVO: Volver al SAC en lugar de dashboard local
  const handleGoBack = () => {
    window.location.href = 'http://localhost:5173';
  };

  // ✅ NUEVO: Loading state mejorado
  if (loading && frentes.length === 0 && tiposFrente.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={handleGoBack} // ✅ CORREGIDO: va al SAC
            icon={HiArrowLeft}
          >
            Volver al Dashboard Central
          </Button>
        </div>

        {/* ✅ NUEVO: Mensaje de error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {/* Header de sección */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Frentes de Trabajo</h2>
            <p className="text-gray-600">Gestiona los frentes de trabajo de ingeniería</p>
          </div>
          <Button 
            variant="primary" 
            onClick={() => setShowForm(!showForm)}
            icon={HiPlus}
            disabled={loading}
          >
            {showForm ? 'Cancelar' : 'Nuevo Frente'}
          </Button>
        </div>

        {/* Formulario */}
        {showForm && (
          <Card className="mb-6">
            <h3 className="text-xl font-bold mb-4">Nuevo Frente de Trabajo</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Nombre del Frente"
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                placeholder="Ej: Frente Norte"
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Frente
                </label>
                <select
                  value={formData.id_tipo_frente}
                  onChange={(e) => setFormData({...formData, id_tipo_frente: e.target.value})}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccione un tipo</option>
                  {tiposFrente.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.nombre} ({tipo.abreviatura})
                    </option>
                  ))}
                </select>
              </div>

              <Button 
                type="submit" 
                variant="success" 
                disabled={loading}
              >
                {loading ? 'Guardando...' : '💾 Guardar Frente'}
              </Button>
            </form>
          </Card>
        )}

        {/* Tabla de Frentes */}
        <Card>
          <h3 className="text-xl font-bold mb-4">Listado de Frentes</h3>
          
          {loading && frentes.length === 0 ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-500">Cargando frentes...</p>
            </div>
          ) : frentes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-2">No hay frentes registrados</p>
              <p className="text-sm text-gray-400">
                Haz click en "Nuevo Frente" para crear uno
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">ID</th>
                    <th className="text-left py-3 px-4">Nombre</th>
                    <th className="text-left py-3 px-4">Tipo</th>
                    <th className="text-left py-3 px-4">Abreviatura</th>
                    <th className="text-left py-3 px-4">Fecha Creación</th>
                  </tr>
                </thead>
                <tbody>
                  {frentes.map((frente) => (
                    <tr key={frente.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{frente.id}</td>
                      <td className="py-3 px-4 font-medium">{frente.nombre}</td>
                      <td className="py-3 px-4">
                        <Badge variant="primary">
                          {frente.tipo_frente?.nombre || 'Sin tipo'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {frente.tipo_frente?.abreviatura || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(frente.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* ✅ NUEVO: Info de debugging (solo en desarrollo) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 bg-gray-100 rounded-lg p-3">
            <p className="text-xs text-gray-600 font-mono">
              Debug: {frentes.length} frentes, {tiposFrente.length} tipos cargados
            </p>
          </div>
        )}
      </main>
    </div>
  );
}