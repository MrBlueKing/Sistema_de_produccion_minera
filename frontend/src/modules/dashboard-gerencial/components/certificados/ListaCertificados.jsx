import { useState, useEffect, useCallback } from 'react';
import { HiDocumentText, HiEye, HiXMark, HiOutlineDocumentMagnifyingGlass } from 'react-icons/hi2';
import Card from '../../../../shared/components/atoms/Card';
import Button from '../../../../shared/components/atoms/Button';
import TableFilters from '../../../../shared/components/molecules/TableFilters';
import Pagination from '../../../../shared/components/molecules/Pagination';
import useDebounce from '../../../../hooks/useDebounce';
import useToast from '../../../../hooks/useToast';
import gerencialService from '../../services/gerencialService';

const formatearFecha = (fecha) => {
  if (!fecha) return '-';
  const date = new Date(fecha);
  if (isNaN(date.getTime())) return '-';
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const anio = date.getFullYear();
  return `${dia}-${mes}-${anio}`;
};

/**
 * Listado de certificados para el Dashboard Gerencial: solo consulta.
 * A diferencia del equivalente en Laboratorio, NO tiene "Vista previa" ni
 * "Descargar" — acá no se puede sacar el PDF del certificado hacia afuera.
 */
export default function ListaCertificados({ idFaena }) {
  const toast = useToast();
  const [certificados, setCertificados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalleModal, setDetalleModal] = useState({ show: false, numero: null, items: [], loading: false });
  const [previsualizando, setPrevisualizando] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const perPage = 20;

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

      const response = await gerencialService.getCertificados(params);
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

  useEffect(() => {
    setCurrentPage(1);
  }, [idFaena]);

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

  const verPrevisualizacion = async (numero) => {
    setPrevisualizando(numero);
    try {
      const response = await gerencialService.previsualizarCertificado(numero);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      // #toolbar=0 oculta la barra de descarga/impresión del visor de PDF nativo (Chrome/Firefox)
      window.open(`${url}#toolbar=0`, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      toast.error('Error al previsualizar', error.response?.data?.message || error.message);
    } finally {
      setPrevisualizando(null);
    }
  };

  const verDetalle = async (numero) => {
    setDetalleModal({ show: true, numero, items: [], loading: true });
    try {
      const response = await gerencialService.getCertificadoDetalle(numero);
      setDetalleModal({ show: true, numero, items: response.data || [], loading: false });
    } catch (error) {
      toast.error('Error al cargar el detalle', error.response?.data?.message || error.message);
      setDetalleModal({ show: false, numero: null, items: [], loading: false });
    }
  };

  return (
    <Card className="border-l-4 border-blue-400">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900">Certificados Emitidos</h3>
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
        searchPlaceholder="Buscar por N° de certificado..."
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
                <th className="py-2 px-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {certificados.map((c) => (
                <tr key={c.certificado} className="hover:bg-gray-50">
                  <td className="py-2 px-3 font-semibold text-gray-900">{c.certificado}</td>
                  <td className="py-2 px-3 text-gray-600">{formatearFecha(c.fecha_generacion)}</td>
                  <td className="py-2 px-3 text-gray-600">{c.total_muestras}</td>
                  <td className="py-2 px-3">
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" icon={HiEye} onClick={() => verDetalle(c.certificado)}>
                        Ver detalle
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={HiOutlineDocumentMagnifyingGlass}
                        onClick={() => verPrevisualizacion(c.certificado)}
                        disabled={previsualizando === c.certificado}
                      >
                        {previsualizando === c.certificado ? 'Abriendo...' : 'Vista previa'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
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
    </Card>
  );
}
