import { useState, useEffect, useCallback, useRef } from 'react';
import { HiPlus, HiPencil, HiTrash, HiXMark, HiDocumentArrowUp } from 'react-icons/hi2';
import Card from '../../../../shared/components/atoms/Card';
import Button from '../../../../shared/components/atoms/Button';
import useToast from '../../../../hooks/useToast';
import extraerMensajeError from '../../../../core/services/apiError';
import gerencialService from '../../services/gerencialService';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const FORM_VACIO = {
  mes: '', anio: '', tarifa_base: '', escala: '', fondo_estabilizacion: '', ley_base: '2.5', iva_porcentaje: '0.19', observaciones: '',
};

export default function TarifasAdmin() {
  const toast = useToast();
  const [tarifas, setTarifas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ show: false, editando: null, desdePdf: false });
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [importandoPdf, setImportandoPdf] = useState(false);
  const inputPdfRef = useRef(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const response = await gerencialService.getTarifas();
      setTarifas(response.data || []);
    } catch (error) {
      toast.error('Error al cargar tarifas', await extraerMensajeError(error, error.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirCrear = () => {
    setForm(FORM_VACIO);
    setModal({ show: true, editando: null, desdePdf: false });
  };

  const handleArchivoPdf = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportandoPdf(true);
    try {
      const response = await gerencialService.previsualizarTarifaPdf(file);
      const d = response.data || {};
      setForm({
        mes: d.mes ?? '',
        anio: d.anio ?? '',
        tarifa_base: d.tarifa_base ?? '',
        escala: d.escala ?? '',
        fondo_estabilizacion: d.fondo_estabilizacion ?? '',
        ley_base: d.ley_base ?? '2.5',
        iva_porcentaje: d.iva_porcentaje ?? '0.19',
        observaciones: d.observaciones ?? '',
      });
      setModal({ show: true, editando: null, desdePdf: true });
      toast.success('Valores extraídos del PDF', 'Revisa que calcen antes de guardar.');
    } catch (error) {
      toast.error('No se pudo leer el PDF', await extraerMensajeError(error, error.message));
    } finally {
      setImportandoPdf(false);
    }
  };

  const abrirEditar = (tarifa) => {
    setForm({
      mes: tarifa.mes,
      anio: tarifa.anio,
      tarifa_base: tarifa.tarifa_base,
      escala: tarifa.escala,
      fondo_estabilizacion: tarifa.fondo_estabilizacion,
      ley_base: tarifa.ley_base,
      iva_porcentaje: tarifa.iva_porcentaje,
      observaciones: tarifa.observaciones || '',
    });
    setModal({ show: true, editando: tarifa.id, desdePdf: false });
  };

  const guardar = async () => {
    if (!form.mes || !form.anio || !form.tarifa_base || !form.escala || !form.fondo_estabilizacion) {
      toast.error('Faltan datos', 'Mes, año, tarifa base, escala y fondo de estabilización son obligatorios.');
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        mes: parseInt(form.mes, 10),
        anio: parseInt(form.anio, 10),
        tarifa_base: parseFloat(form.tarifa_base),
        escala: parseFloat(form.escala),
        fondo_estabilizacion: parseFloat(form.fondo_estabilizacion),
        ley_base: parseFloat(form.ley_base || 2.5),
        iva_porcentaje: parseFloat(form.iva_porcentaje || 0.19),
        observaciones: form.observaciones || null,
      };
      if (modal.editando) {
        await gerencialService.actualizarTarifa(modal.editando, payload);
        toast.success('Tarifa actualizada');
      } else {
        await gerencialService.crearTarifa(payload);
        toast.success('Tarifa creada');
      }
      setModal({ show: false, editando: null, desdePdf: false });
      cargar();
    } catch (error) {
      toast.error('Error al guardar la tarifa', await extraerMensajeError(error, error.message));
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (tarifa) => {
    if (!window.confirm(`¿Eliminar la tarifa de ${MESES[tarifa.mes - 1]} ${tarifa.anio}?`)) return;
    try {
      await gerencialService.eliminarTarifa(tarifa.id);
      toast.success('Tarifa eliminada');
      cargar();
    } catch (error) {
      toast.error('Error al eliminar la tarifa', await extraerMensajeError(error, error.message));
    }
  };

  return (
    <Card className="border-l-4 border-amber-400">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Tarifas de compra (mensual)</h3>
          <p className="text-sm text-gray-600 mt-1">Valores de la Circular ENAMI vigente cada mes, usados para calcular el Saldo Líquido esperado.</p>
        </div>
        <div className="flex gap-2">
          <input ref={inputPdfRef} type="file" accept="application/pdf" className="hidden" onChange={handleArchivoPdf} />
          <Button variant="secondary" size="sm" icon={HiDocumentArrowUp} disabled={importandoPdf} onClick={() => inputPdfRef.current?.click()}>
            {importandoPdf ? 'Leyendo PDF...' : 'Importar PDF'}
          </Button>
          <Button variant="primary" size="sm" icon={HiPlus} onClick={abrirCrear}>
            Nueva Tarifa
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : tarifas.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Todavía no hay tarifas cargadas.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200 text-left text-gray-600">
                <th className="py-2 px-3">Mes</th>
                <th className="py-2 px-3">Tarifa Base</th>
                <th className="py-2 px-3">Escala</th>
                <th className="py-2 px-3">Fondo Estab.</th>
                <th className="py-2 px-3">Ley Base</th>
                <th className="py-2 px-3">IVA</th>
                <th className="py-2 px-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tarifas.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="py-2 px-3 font-semibold text-gray-900">{MESES[t.mes - 1]} {t.anio}</td>
                  <td className="py-2 px-3 text-gray-600">{t.tarifa_base}</td>
                  <td className="py-2 px-3 text-gray-600">{t.escala}</td>
                  <td className="py-2 px-3 text-gray-600">{t.fondo_estabilizacion}</td>
                  <td className="py-2 px-3 text-gray-600">{t.ley_base}%</td>
                  <td className="py-2 px-3 text-gray-600">{(t.iva_porcentaje * 100).toFixed(0)}%</td>
                  <td className="py-2 px-3">
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" icon={HiPencil} onClick={() => abrirEditar(t)}>Editar</Button>
                      <Button variant="danger" size="sm" icon={HiTrash} onClick={() => eliminar(t)}>Eliminar</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">{modal.editando ? 'Editar Tarifa' : 'Nueva Tarifa'}</h3>
              <button onClick={() => setModal({ show: false, editando: null, desdePdf: false })} className="text-gray-400 hover:text-gray-600">
                <HiXMark className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {modal.desdePdf && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                  <HiDocumentArrowUp className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Valores extraídos automáticamente del PDF — revisa que calcen con la Circular antes de guardar. IVA queda fijo en 19% (no viene en el PDF).</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mes</label>
                  <select value={form.mes} onChange={(e) => setForm((f) => ({ ...f, mes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500">
                    <option value="">Selecciona...</option>
                    {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Año</label>
                  <input type="number" value={form.anio} onChange={(e) => setForm((f) => ({ ...f, anio: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" placeholder="2026" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tarifa Base (US$/tms)</label>
                  <input type="number" step="0.0001" value={form.tarifa_base} onChange={(e) => setForm((f) => ({ ...f, tarifa_base: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" placeholder="Ej: 244.5197" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Escala (US$/tms x 1%)</label>
                  <input type="number" step="0.0001" value={form.escala} onChange={(e) => setForm((f) => ({ ...f, escala: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" placeholder="Ej: 116.4839" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fondo Estabilización</label>
                  <input type="number" step="0.0001" value={form.fondo_estabilizacion} onChange={(e) => setForm((f) => ({ ...f, fondo_estabilizacion: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" placeholder="Ej: 5.7886" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ley Base (%)</label>
                  <input type="number" step="0.1" value={form.ley_base} onChange={(e) => setForm((f) => ({ ...f, ley_base: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">IVA (ej: 0.19 = 19%)</label>
                  <input type="number" step="0.01" value={form.iva_porcentaje} onChange={(e) => setForm((f) => ({ ...f, iva_porcentaje: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones (opcional)</label>
                  <textarea value={form.observaciones} onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" rows={2} />
                </div>
              </div>
              <button onClick={guardar} disabled={guardando}
                className="w-full px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar Tarifa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
