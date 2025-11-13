import { useState, useEffect } from 'react';
import { HiXMark, HiPencil } from 'react-icons/hi2';
import Button from '../atoms/Button';
import Input from '../atoms/Input';
import SearchableSelect from '../atoms/SearchableSelect';

export default function EditDumpadaModal({ show, dumpada, frentes, jornadas, onConfirm, onCancel }) {
  const [formData, setFormData] = useState({
    id: null,
    id_frente_trabajo: '',
    jornada: '',
    fecha: '',
    ton: '',
    ley: '',
    ley_cup: '',
    certificado: '',
    ley_visual: '',
  });

  useEffect(() => {
    if (dumpada) {
      // Convertir fecha de formato DD-MM-YYYY a YYYY-MM-DD para el input date
      let fechaFormatted = '';
      if (dumpada.fecha) {
        if (typeof dumpada.fecha === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(dumpada.fecha)) {
          const [dia, mes, anio] = dumpada.fecha.split('-');
          fechaFormatted = `${anio}-${mes}-${dia}`;
        } else {
          fechaFormatted = dumpada.fecha;
        }
      }

      setFormData({
        id: dumpada.id,
        id_frente_trabajo: dumpada.id_frente_trabajo || '',
        jornada: dumpada.jornada || '',
        fecha: fechaFormatted,
        ton: dumpada.ton || '',
        ley: dumpada.ley || '',
        ley_cup: dumpada.ley_cup || '',
        certificado: dumpada.certificado || '',
        ley_visual: dumpada.ley_visual || '',
      });
    }
  }, [dumpada]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Convertir fecha de YYYY-MM-DD a DD-MM-YYYY antes de enviar
    let fechaToSend = formData.fecha;
    if (fechaToSend && /^\d{4}-\d{2}-\d{2}$/.test(fechaToSend)) {
      const [anio, mes, dia] = fechaToSend.split('-');
      fechaToSend = `${dia}-${mes}-${anio}`;
    }

    onConfirm({
      ...formData,
      fecha: fechaToSend
    });
  };

  if (!show || !dumpada) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-500 text-white p-6 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <HiPencil className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Editar Dumpada</h2>
              <p className="text-blue-100 text-sm">
                {dumpada.acopios || `N° Acopio: ${dumpada.n_acop}`}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
          >
            <HiXMark className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Frente de Trabajo */}
            <div className="md:col-span-2">
              <SearchableSelect
                label="Frente de Trabajo *"
                options={frentes.map(frente => ({
                  value: frente.id,
                  label: frente.codigo_completo
                }))}
                value={formData.id_frente_trabajo}
                onChange={(value) => handleChange('id_frente_trabajo', value)}
                placeholder="Buscar frente..."
                emptyMessage="No hay frentes disponibles"
                required
              />
            </div>

            {/* Jornada */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Jornada <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.jornada}
                onChange={(e) => handleChange('jornada', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Seleccione...</option>
                {jornadas.map((jornada) => (
                  <option key={jornada} value={jornada}>
                    {jornada}
                  </option>
                ))}
              </select>
            </div>

            {/* Fecha */}
            <Input
              label="Fecha"
              type="date"
              value={formData.fecha}
              onChange={(e) => handleChange('fecha', e.target.value)}
            />

            {/* Toneladas */}
            <Input
              label="Toneladas"
              type="number"
              step="0.01"
              value={formData.ton}
              onChange={(e) => handleChange('ton', e.target.value)}
              placeholder="Ej: 4.60"
            />

            {/* Ley Visual */}
            <Input
              label="Ley Visual (%)"
              type="number"
              step="0.001"
              value={formData.ley_visual}
              onChange={(e) => handleChange('ley_visual', e.target.value)}
              placeholder="Ej: 2.300"
            />

            {/* Ley */}
            <Input
              label="Ley (%)"
              type="number"
              step="0.001"
              value={formData.ley}
              onChange={(e) => handleChange('ley', e.target.value)}
              placeholder="Ej: 2.500"
            />

            {/* Ley Cup */}
            <Input
              label="Ley Cup (%)"
              type="number"
              step="0.001"
              value={formData.ley_cup}
              onChange={(e) => handleChange('ley_cup', e.target.value)}
              placeholder="Ej: 2.450"
            />

            {/* Certificado */}
            <Input
              label="Certificado"
              type="text"
              value={formData.certificado}
              onChange={(e) => handleChange('certificado', e.target.value)}
              placeholder="Ej: CERT-12345"
            />
          </div>

          {/* Información */}
          <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>ℹ️ Nota:</strong> El código de acopios se regenerará automáticamente si cambia el frente, jornada o fecha.
              El rango se calculará automáticamente según la ley ingresada.
            </p>
          </div>

          {/* Botones */}
          <div className="mt-6 flex gap-3 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Guardar Cambios
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
