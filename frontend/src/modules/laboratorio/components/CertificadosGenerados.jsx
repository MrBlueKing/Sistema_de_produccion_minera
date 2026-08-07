import { useState, useEffect, useCallback } from 'react';
import {
  HiDocumentText, HiDocumentArrowDown, HiEye, HiXMark, HiOutlineDocumentMagnifyingGlass,
  HiCheckCircle, HiXCircle, HiEnvelope,
} from 'react-icons/hi2';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import TableFilters from '../../../shared/components/molecules/TableFilters';
import Pagination from '../../../shared/components/molecules/Pagination';
import useDebounce from '../../../hooks/useDebounce';
import useToast from '../../../hooks/useToast';
import laboratorioService from '../services/laboratorio';
import { useAuth } from '../../../core/context/AuthContext';

const ESTADO_BADGE = {
  Pendiente: 'bg-yellow-100 text-yellow-800',
  Aprobado: 'bg-green-100 text-green-800',
  Rechazado: 'bg-red-100 text-red-800',
};

const formatearFecha = (fecha) => {
  if (!fecha) return '-';
  const date = new Date(fecha);
  if (isNaN(date.getTime())) return '-';
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const anio = date.getFullYear();
  return `${dia}-${mes}-${anio}`;
};

export default function CertificadosGenerados({ idFaena }) {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const puedeAprobar = hasPermission('aprobar_certificados_laboratorio');
  const [certificados, setCertificados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [descargando, setDescargando] = useState(null);
  const [previsualizando, setPrevisualizando] = useState(null);
  const [aprobando, setAprobando] = useState(null);
  const [detalleModal, setDetalleModal] = useState({ show: false, numero: null, items: [], loading: false });
  const [rechazarModal, setRechazarModal] = useState({ show: false, numero: null, motivo: '', loading: false, estadoActual: null });
  const [correoModal, setCorreoModal] = useState({ show: false, numero: null, destinatario: '', mensaje: '', loading: false });

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const perPage = 20;

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    muestras_min: '',
    muestras_max: '',
  });
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        per_page: perPage,
        id_faena: idFaena || undefined,
        search: debouncedSearchTerm || undefined,
        fecha_inicio: filters.fecha_inicio || undefined,
        fecha_fin: filters.fecha_fin || undefined,
        muestras_min: filters.muestras_min || undefined,
        muestras_max: filters.muestras_max || undefined,
      };
      Object.keys(params).forEach((key) => params[key] === undefined && delete params[key]);

      const response = await laboratorioService.getCertificadosGenerados(params);
      setCertificados(response.data || []);
      if (response.pagination) {
        setTotalPages(response.pagination.last_page);
        setTotalRecords(response.pagination.total);
      }
    } catch (error) {
      console.error('Error cargando certificados:', error);
      toast.error('Error al cargar certificados', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  }, [idFaena, currentPage, debouncedSearchTerm, filters]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilters({ fecha_inicio: '', fecha_fin: '', muestras_min: '', muestras_max: '' });
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Si cambia la faena seleccionada (filtro del padre), volver a la página 1
  useEffect(() => {
    setCurrentPage(1);
  }, [idFaena]);

  const verDetalle = async (numero) => {
    setDetalleModal({ show: true, numero, items: [], loading: true });
    try {
      const response = await laboratorioService.getDumpadasPorCertificado(numero);
      setDetalleModal({ show: true, numero, items: response.data || [], loading: false });
    } catch (error) {
      toast.error('Error al cargar el detalle', error.response?.data?.message || error.message);
      setDetalleModal({ show: false, numero: null, items: [], loading: false });
    }
  };

  const previsualizar = async (numero) => {
    setPrevisualizando(numero);
    try {
      const detalle = await laboratorioService.getDumpadasPorCertificado(numero);
      const items = detalle.data || [];
      const dumpadaIds = items.filter((i) => i.tipo === 'dumpada').map((i) => i.id);
      const muestraLibreIds = items.filter((i) => i.tipo === 'muestra_libre').map((i) => i.id);

      const response = await laboratorioService.previsualizarCertificadoPdf(dumpadaIds, numero, muestraLibreIds);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      toast.error('Error al previsualizar', error.response?.data?.message || error.message);
    } finally {
      setPrevisualizando(null);
    }
  };

  const descargar = async (numero) => {
    setDescargando(numero);
    try {
      const response = await laboratorioService.regenerarCertificado(numero);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificado_${numero}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Error al descargar', error.response?.data?.message || error.message);
    } finally {
      setDescargando(null);
    }
  };

  const aprobar = async (numero) => {
    setAprobando(numero);
    try {
      await laboratorioService.aprobarCertificado(numero);
      toast.success('Certificado aprobado');
      cargar();
    } catch (error) {
      toast.error('Error al aprobar', error.response?.data?.message || error.message);
    } finally {
      setAprobando(null);
    }
  };

  const confirmarRechazo = async () => {
    if (!rechazarModal.motivo.trim()) return;
    setRechazarModal((prev) => ({ ...prev, loading: true }));
    try {
      await laboratorioService.rechazarCertificado(rechazarModal.numero, rechazarModal.motivo.trim());
      toast.success('Certificado rechazado');
      setRechazarModal({ show: false, numero: null, motivo: '', loading: false, estadoActual: null });
      cargar();
    } catch (error) {
      toast.error('Error al rechazar', error.response?.data?.message || error.message);
      setRechazarModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const confirmarEnvioCorreo = async () => {
    if (!correoModal.destinatario.trim()) return;
    setCorreoModal((prev) => ({ ...prev, loading: true }));
    try {
      await laboratorioService.enviarCorreoCertificado(correoModal.numero, correoModal.destinatario.trim(), correoModal.mensaje.trim() || null);
      toast.success('Certificado enviado por correo');
      setCorreoModal({ show: false, numero: null, destinatario: '', mensaje: '', loading: false });
    } catch (error) {
      toast.error('Error al enviar correo', error.response?.data?.message || error.message);
      setCorreoModal((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <Card className="border-l-4 border-blue-400">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900">Certificados Generados</h3>
        <p className="text-sm text-gray-600 mt-1">
          {loading ? (
            'Cargando...'
          ) : (
            <>Total: <span className="font-semibold text-blue-600">{totalRecords}</span> certificado{totalRecords !== 1 ? 's' : ''}</>
          )}
        </p>
      </div>

      <TableFilters
        searchValue={searchTerm}
        searchPlaceholder="Buscar por N° certificado, N° dumpada, acopio o frente..."
        onSearchChange={handleSearchChange}
        filters={[
          { name: 'fecha_inicio', label: 'Fecha Desde', type: 'date' },
          { name: 'fecha_fin', label: 'Fecha Hasta', type: 'date' },
          { name: 'muestras_min', label: 'Mín. muestras incluidas', type: 'number', placeholder: 'Ej: 1' },
          { name: 'muestras_max', label: 'Máx. muestras incluidas', type: 'number', placeholder: 'Ej: 20' },
        ]}
        filterValues={filters}
        onFilterChange={handleFilterChange}
        onClear={handleClearFilters}
        alwaysExpanded={true}
      />

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : certificados.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <HiDocumentText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          {totalRecords === 0 && !searchTerm && !filters.fecha_inicio && !filters.fecha_fin && !filters.muestras_min && !filters.muestras_max
            ? 'Todavía no se generó ningún certificado.'
            : 'No hay certificados con los filtros aplicados.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200 text-left text-gray-600">
                <th className="py-2 px-3">N° Certificado</th>
                <th className="py-2 px-3">Fecha de generación</th>
                <th className="py-2 px-3">Muestras incluidas</th>
                <th className="py-2 px-3">Estado</th>
                <th className="py-2 px-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {certificados.map((c) => {
                const estado = c.estado_aprobacion || 'Aprobado';
                const aprobado = estado === 'Aprobado';
                const pendiente = estado === 'Pendiente';
                return (
                <tr key={c.certificado} className="hover:bg-gray-50">
                  <td className="py-2 px-3 font-semibold text-gray-900">{c.certificado}</td>
                  <td className="py-2 px-3 text-gray-600">{formatearFecha(c.fecha_generacion)}</td>
                  <td className="py-2 px-3 text-gray-600">{c.total_muestras}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_BADGE[estado] || ESTADO_BADGE.Pendiente}`}
                      title={estado === 'Rechazado' ? (c.motivo_rechazo || '') : undefined}
                    >
                      {estado}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="secondary" size="sm" icon={HiEye} onClick={() => verDetalle(c.certificado)}>
                        Ver detalle
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={HiOutlineDocumentMagnifyingGlass}
                        onClick={() => previsualizar(c.certificado)}
                        disabled={previsualizando === c.certificado}
                      >
                        {previsualizando === c.certificado ? 'Abriendo...' : 'Vista previa'}
                      </Button>
                      {puedeAprobar && pendiente && (
                        <Button
                          variant="success"
                          size="sm"
                          icon={HiCheckCircle}
                          onClick={() => aprobar(c.certificado)}
                          disabled={aprobando === c.certificado}
                        >
                          {aprobando === c.certificado ? 'Aprobando...' : 'Aprobar'}
                        </Button>
                      )}
                      {puedeAprobar && (pendiente || aprobado) && (
                        <Button
                          variant="danger"
                          size="sm"
                          icon={HiXCircle}
                          onClick={() => setRechazarModal({ show: true, numero: c.certificado, motivo: '', loading: false, estadoActual: estado })}
                        >
                          Rechazar
                        </Button>
                      )}
                      <Button
                        variant="success"
                        size="sm"
                        icon={HiDocumentArrowDown}
                        onClick={() => descargar(c.certificado)}
                        disabled={descargando === c.certificado || !aprobado}
                        title={!aprobado ? 'Debe estar Aprobado para descargar' : undefined}
                      >
                        {descargando === c.certificado ? 'Descargando...' : 'Descargar'}
                      </Button>
                      {aprobado && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={HiEnvelope}
                          onClick={() => setCorreoModal({ show: true, numero: c.certificado, destinatario: '', mensaje: '', loading: false })}
                        >
                          Enviar correo
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalRecords > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalRecords={totalRecords}
          perPage={perPage}
          onPageChange={handlePageChange}
          showInfo={true}
          showFirstLast={true}
        />
      )}

      {detalleModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Certificado {detalleModal.numero}</h3>
              <button
                onClick={() => setDetalleModal({ show: false, numero: null, items: [], loading: false })}
                className="text-gray-400 hover:text-gray-600"
              >
                <HiXMark className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {detalleModal.loading ? (
                <div className="text-center py-8 text-gray-500">Cargando...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-600">
                      <th className="py-2 pr-3">Tipo</th>
                      <th className="py-2 pr-3">Código / Nombre</th>
                      <th className="py-2 pr-3">Fecha</th>
                      <th className="py-2 pr-3">Ley Cu Total</th>
                      <th className="py-2 pr-3">Cu Soluble</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detalleModal.items.map((item) => (
                      <tr key={`${item.tipo}_${item.id}`}>
                        <td className="py-2 pr-3 text-gray-500">
                          {item.tipo === 'dumpada' ? 'Dumpada' : 'Muestra específica'}
                        </td>
                        <td className="py-2 pr-3 font-medium text-gray-800">
                          {item.tipo === 'dumpada' ? (item.codigo_completo || item.acopios) : item.nombre}
                        </td>
                        <td className="py-2 pr-3 text-gray-600">{formatearFecha(item.fecha)}</td>
                        <td className="py-2 pr-3 text-gray-600">{item.ley ?? '-'}</td>
                        <td className="py-2 pr-3 text-gray-600">{item.cu_soluble ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {rechazarModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Rechazar certificado {rechazarModal.numero}</h3>
              <button
                onClick={() => setRechazarModal({ show: false, numero: null, motivo: '', loading: false, estadoActual: null })}
                className="text-gray-400 hover:text-gray-600"
              >
                <HiXMark className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {rechazarModal.estadoActual === 'Aprobado' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
                  Este certificado ya está <strong>Aprobado</strong> — puede que ya se haya descargado o enviado por correo.
                  Al rechazarlo, las muestras quedarán liberadas para corregir y volver a generar un certificado nuevo.
                </div>
              )}
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo del rechazo *</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                rows={3}
                value={rechazarModal.motivo}
                onChange={(e) => setRechazarModal((prev) => ({ ...prev, motivo: e.target.value }))}
                placeholder="Explique por qué se rechaza este certificado..."
              />
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setRechazarModal({ show: false, numero: null, motivo: '', loading: false, estadoActual: null })}
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={confirmarRechazo}
                  disabled={!rechazarModal.motivo.trim() || rechazarModal.loading}
                >
                  {rechazarModal.loading ? 'Rechazando...' : 'Rechazar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {correoModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Enviar certificado {correoModal.numero}</h3>
              <button
                onClick={() => setCorreoModal({ show: false, numero: null, destinatario: '', mensaje: '', loading: false })}
                className="text-gray-400 hover:text-gray-600"
              >
                <HiXMark className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo del destinatario *</label>
              <input
                type="email"
                className="w-full border border-gray-300 rounded-lg p-2 text-sm mb-3"
                value={correoModal.destinatario}
                onChange={(e) => setCorreoModal((prev) => ({ ...prev, destinatario: e.target.value }))}
                placeholder="cliente@empresa.cl"
              />
              <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje (opcional)</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                rows={3}
                value={correoModal.mensaje}
                onChange={(e) => setCorreoModal((prev) => ({ ...prev, mensaje: e.target.value }))}
                placeholder="Mensaje adicional para el destinatario..."
              />
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCorreoModal({ show: false, numero: null, destinatario: '', mensaje: '', loading: false })}
                >
                  Cancelar
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  icon={HiEnvelope}
                  onClick={confirmarEnvioCorreo}
                  disabled={!correoModal.destinatario.trim() || correoModal.loading}
                >
                  {correoModal.loading ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
