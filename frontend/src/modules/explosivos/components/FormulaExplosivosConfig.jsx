import { useState, useEffect } from 'react';
import {
  HiCalculator,
  HiCheckCircle,
} from 'react-icons/hi2';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import explosivosService from '../services/explosivos';
import ingenieriaService from '../../ingenieria/services/ingenieria';
import useToast from '../../../hooks/useToast';

export default function FormulaExplosivosConfig({ tipos, faenaActual }) {
  const toast = useToast();

  const [tiposFrente, setTiposFrente] = useState([]);
  const [factores, setFactores] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, [faenaActual]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [tiposFrenteRes, formulasRes] = await Promise.all([
        ingenieriaService.getTiposFrente(),
        explosivosService.getFormulas(),
      ]);

      setTiposFrente(tiposFrenteRes.data || tiposFrenteRes);

      // Construir mapa de factores: { "tipoFrente_tipoExplosivo": factor }
      const mapa = {};
      formulasRes.forEach((grupo) => {
        grupo.explosivos.forEach((exp) => {
          const key = `${grupo.tipo_frente.id}_${exp.id_tipo_explosivo}`;
          mapa[key] = exp.factor;
        });
      });
      setFactores(mapa);
    } catch (error) {
      console.error('Error al cargar datos de fórmulas:', error);
      toast.error('Error', 'No se pudieron cargar las fórmulas');
    } finally {
      setLoading(false);
    }
  };

  const handleFactorChange = (idTipoFrente, idTipoExplosivo, value) => {
    const key = `${idTipoFrente}_${idTipoExplosivo}`;
    setFactores((prev) => ({ ...prev, [key]: value }));
  };

  const guardar = async () => {
    setSubmitting(true);
    try {
      const formulas = [];
      tiposFrente.forEach((tf) => {
        tiposActivos.forEach((te) => {
          const key = `${tf.id}_${te.id}`;
          const factor = parseFloat(factores[key]) || 0;
          formulas.push({
            id_tipo_frente: tf.id,
            id_tipo_explosivo: te.id,
            factor,
          });
        });
      });

      await explosivosService.guardarFormulas({ formulas });
      toast.success('Fórmulas guardadas', 'Las fórmulas se guardaron correctamente');
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudieron guardar las fórmulas');
    } finally {
      setSubmitting(false);
    }
  };

  const tiposActivos = tipos.filter((t) => t.activo !== false);

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-200 border-t-red-600"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <HiCalculator className="w-5 h-5 text-red-600" />
            Fórmulas de Cálculo de Explosivos
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Cantidad = N° Tiros x Factor. Configure el factor multiplicador para cada combinación de tipo de labor y explosivo.
          </p>
        </div>
        <Button variant="primary" icon={HiCheckCircle} onClick={guardar} disabled={submitting}>
          {submitting ? 'Guardando...' : 'Guardar Fórmulas'}
        </Button>
      </div>

      {tiposFrente.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No hay tipos de frente configurados. Configúrelos en el módulo de Ingeniería.</p>
        </div>
      ) : tiposActivos.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No hay tipos de explosivos activos configurados.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 bg-gradient-to-r from-red-50 to-orange-50">
                <th className="px-3 py-3 text-left font-semibold text-gray-700 sticky left-0 bg-red-50 z-10 min-w-[150px]">
                  Tipo de Labor
                </th>
                {tiposActivos.map((te) => (
                  <th key={te.id} className="px-3 py-3 text-center font-semibold text-gray-700 min-w-[100px]">
                    <div className="text-xs">{te.codigo}</div>
                    <div className="text-[10px] text-gray-400 font-normal">{te.unidad_medida}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tiposFrente.map((tf) => (
                <tr key={tf.id} className="border-b hover:bg-red-50/30">
                  <td className="px-3 py-2 font-medium sticky left-0 bg-white z-10">
                    <span className="text-gray-500 text-xs mr-1">{tf.abreviatura}</span>
                    {tf.nombre}
                  </td>
                  {tiposActivos.map((te) => {
                    const key = `${tf.id}_${te.id}`;
                    return (
                      <td key={te.id} className="px-2 py-2 text-center">
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          value={factores[key] || ''}
                          onChange={(e) => handleFactorChange(tf.id, te.id, e.target.value)}
                          placeholder="0"
                          className="w-20 px-2 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
