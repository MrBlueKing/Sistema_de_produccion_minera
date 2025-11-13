import PropTypes from 'prop-types';
import { HiSearch, HiX, HiFilter } from 'react-icons/hi';
import { useState } from 'react';
import Button from '../atoms/Button';

/**
 * Componente de filtros para tablas reutilizable
 * Sigue el patrón de arquitectura atómica (molecule)
 *
 * @component
 * @example
 * <TableFilters
 *   searchValue={searchTerm}
 *   onSearchChange={(value) => setSearchTerm(value)}
 *   filters={[
 *     { name: 'estado', label: 'Estado', type: 'select', options: [...] },
 *     { name: 'fecha', label: 'Fecha', type: 'date' }
 *   ]}
 *   filterValues={{ estado: '', fecha: '' }}
 *   onFilterChange={(name, value) => setFilters({...filters, [name]: value})}
 *   onClear={() => clearFilters()}
 * />
 */
export default function TableFilters({
  searchValue = '',
  searchPlaceholder = 'Buscar...',
  onSearchChange,
  filters = [],
  filterValues = {},
  onFilterChange,
  onClear,
  showSearch = true,
  showClearButton = true,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters = () => {
    if (searchValue) return true;
    return Object.values(filterValues).some((value) => value !== '' && value !== null);
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    }
    setIsExpanded(false);
  };

  const handleSearchChange = (e) => {
    if (onSearchChange) {
      onSearchChange(e.target.value);
    }
  };

  const handleFilterChange = (filterName, value) => {
    if (onFilterChange) {
      onFilterChange(filterName, value);
    }
  };

  const renderFilterInput = (filter) => {
    const value = filterValues[filter.name] || '';

    switch (filter.type) {
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleFilterChange(filter.name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
          >
            <option value="">Todos</option>
            {filter.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleFilterChange(filter.name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleFilterChange(filter.name, e.target.value)}
            placeholder={filter.placeholder || ''}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
          />
        );

      case 'text':
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFilterChange(filter.name, e.target.value)}
            placeholder={filter.placeholder || ''}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
          />
        );
    }
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Barra de búsqueda y botones principales */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Buscador */}
        {showSearch && (
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <HiSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchValue}
              onChange={handleSearchChange}
              placeholder={searchPlaceholder}
              className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
            />
            {searchValue && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <HiX className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex gap-2">
          {filters.length > 0 && (
            <Button
              variant={isExpanded ? 'primary' : 'outline'}
              onClick={() => setIsExpanded(!isExpanded)}
              icon={HiFilter}
            >
              {isExpanded ? 'Ocultar Filtros' : 'Filtros'}
              {hasActiveFilters() && !isExpanded && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-orange-600 text-white rounded-full">
                  {Object.values(filterValues).filter((v) => v).length}
                </span>
              )}
            </Button>
          )}

          {showClearButton && hasActiveFilters() && (
            <Button variant="secondary" onClick={handleClear} icon={HiX}>
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Panel de filtros expandible */}
      {isExpanded && filters.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filters.map((filter) => (
              <div key={filter.name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {filter.label}
                </label>
                {renderFilterInput(filter)}
              </div>
            ))}
          </div>

          {/* Información de filtros activos */}
          {hasActiveFilters() && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-gray-600 font-medium">Filtros activos:</span>
                {searchValue && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    Búsqueda: {searchValue}
                    <button
                      onClick={() => onSearchChange('')}
                      className="ml-2 hover:text-orange-900"
                    >
                      <HiX className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {filters.map((filter) => {
                  const value = filterValues[filter.name];
                  if (!value) return null;

                  let displayValue = value;
                  if (filter.type === 'select') {
                    const option = filter.options?.find((opt) => opt.value === value);
                    displayValue = option?.label || value;
                  }

                  return (
                    <span
                      key={filter.name}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800"
                    >
                      {filter.label}: {displayValue}
                      <button
                        onClick={() => handleFilterChange(filter.name, '')}
                        className="ml-2 hover:text-orange-900"
                      >
                        <HiX className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

TableFilters.propTypes = {
  searchValue: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  onSearchChange: PropTypes.func,
  filters: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['text', 'select', 'date', 'number']).isRequired,
      options: PropTypes.arrayOf(
        PropTypes.shape({
          value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
          label: PropTypes.string.isRequired,
        })
      ),
      placeholder: PropTypes.string,
    })
  ),
  filterValues: PropTypes.object,
  onFilterChange: PropTypes.func,
  onClear: PropTypes.func,
  showSearch: PropTypes.bool,
  showClearButton: PropTypes.bool,
};
