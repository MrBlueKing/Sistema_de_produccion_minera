import PropTypes from 'prop-types';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import Button from '../atoms/Button';

/**
 * Componente de paginación reutilizable
 * Sigue el patrón de arquitectura atómica (molecule)
 *
 * @component
 * @example
 * <Pagination
 *   currentPage={1}
 *   totalPages={10}
 *   totalRecords={150}
 *   perPage={15}
 *   onPageChange={(page) => setCurrentPage(page)}
 * />
 */
export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalRecords = 0,
  perPage = 15,
  onPageChange,
  showInfo = true,
  showFirstLast = true,
}) {
  const from = totalRecords === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const to = Math.min(currentPage * perPage, totalRecords);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  // Genera números de página visibles
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      // Mostrar todas las páginas si son pocas
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Lógica para mostrar páginas con ellipsis
      if (currentPage <= 3) {
        // Inicio: 1 2 3 4 ... último
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Final: 1 ... antepenúltimo penúltimo último
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        // Medio: 1 ... anterior actual siguiente ... último
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }

    return pages;
  };

  if (totalRecords === 0) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      {/* Información de registros */}
      {showInfo && (
        <div className="text-sm text-gray-600">
          Mostrando <span className="font-semibold text-gray-900">{from}</span> - <span className="font-semibold text-gray-900">{to}</span> de <span className="font-semibold text-gray-900">{totalRecords}</span> registros
        </div>
      )}

      {/* Controles de paginación */}
      <div className="flex items-center gap-2">
        {/* Botón Primera Página */}
        {showFirstLast && (
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              currentPage === 1
                ? 'text-gray-400 cursor-not-allowed bg-gray-100'
                : 'text-gray-700 hover:bg-gray-100 bg-white border border-gray-300'
            }`}
            title="Primera página"
          >
            Primera
          </button>
        )}

        {/* Botón Anterior */}
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`p-2 rounded-lg transition-colors ${
            currentPage === 1
              ? 'text-gray-400 cursor-not-allowed bg-gray-100'
              : 'text-gray-700 hover:bg-orange-50 border border-gray-300 bg-white'
          }`}
          title="Página anterior"
        >
          <HiChevronLeft className="w-5 h-5" />
        </button>

        {/* Números de página */}
        <div className="hidden sm:flex items-center gap-1">
          {getPageNumbers().map((page, index) => {
            if (page === '...') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-3 py-2 text-gray-500"
                >
                  ...
                </span>
              );
            }

            return (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`min-w-[40px] px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  currentPage === page
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100 bg-white border border-gray-300'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* Página actual en móvil */}
        <div className="sm:hidden px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg">
          {currentPage} / {totalPages}
        </div>

        {/* Botón Siguiente */}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`p-2 rounded-lg transition-colors ${
            currentPage === totalPages
              ? 'text-gray-400 cursor-not-allowed bg-gray-100'
              : 'text-gray-700 hover:bg-orange-50 border border-gray-300 bg-white'
          }`}
          title="Página siguiente"
        >
          <HiChevronRight className="w-5 h-5" />
        </button>

        {/* Botón Última Página */}
        {showFirstLast && (
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              currentPage === totalPages
                ? 'text-gray-400 cursor-not-allowed bg-gray-100'
                : 'text-gray-700 hover:bg-gray-100 bg-white border border-gray-300'
            }`}
            title="Última página"
          >
            Última
          </button>
        )}
      </div>
    </div>
  );
}

Pagination.propTypes = {
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  totalRecords: PropTypes.number.isRequired,
  perPage: PropTypes.number,
  onPageChange: PropTypes.func.isRequired,
  showInfo: PropTypes.bool,
  showFirstLast: PropTypes.bool,
};
