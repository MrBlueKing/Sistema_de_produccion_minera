import React from 'react';
import { HiPencil, HiTrash, HiCheckCircle, HiTruck } from 'react-icons/hi';

const CamionadaCard = ({ camionada, onEdit, onDelete, onMarcarRecibida }) => {
  const getEstadoBadge = (estado) => {
    const badges = {
      'Despachado': 'bg-yellow-100 text-yellow-800',
      'En Tránsito': 'bg-blue-100 text-blue-800',
      'Recibido': 'bg-green-100 text-green-800',
      'Completado': 'bg-gray-100 text-gray-800'
    };
    return badges[estado] || 'bg-gray-100 text-gray-800';
  };

  const getPorcentajeErrorColor = (porcentaje) => {
    if (!porcentaje) return 'text-gray-500';
    const abs = Math.abs(porcentaje);
    if (abs <= 5) return 'text-green-600';
    if (abs <= 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatFecha = (fecha) => {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const diferencia = camionada.diferencia || 0;
  const porcentajeError = camionada.porcentaje_error || 0;
  const estaRecibida = camionada.estado === 'Recibido' || camionada.estado === 'Completado';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <HiTruck className="text-blue-600 text-xl" />
          <div>
            <h4 className="font-bold text-gray-800">
              Camionada #{camionada.numero_camionada}
            </h4>
            <p className="text-sm text-gray-600">{camionada.patente}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoBadge(camionada.estado)}`}>
          {camionada.estado}
        </span>
      </div>

      {/* Información principal */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <span className="text-gray-600">Fecha Despacho:</span>
          <p className="font-medium text-gray-800">{formatFecha(camionada.fecha_despacho)}</p>
        </div>
        <div>
          <span className="text-gray-600">Peso:</span>
          <p className="font-medium text-gray-800">{camionada.peso} ton</p>
        </div>
        {camionada.ticket && (
          <div>
            <span className="text-gray-600">Ticket:</span>
            <p className="font-medium text-gray-800">{camionada.ticket}</p>
          </div>
        )}
        {camionada.ley_mezcla && (
          <div>
            <span className="text-gray-600">Ley Mezcla:</span>
            <p className="font-medium text-gray-800">{parseFloat(camionada.ley_mezcla).toFixed(3)}</p>
          </div>
        )}
      </div>

      {/* Información de diferencia */}
      {diferencia !== 0 && (
        <div className="bg-gray-50 rounded p-2 mb-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Diferencia vs Teórico:</span>
            <span className={`font-bold ${diferencia > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {diferencia > 0 ? '+' : ''}{diferencia.toFixed(2)} ton
            </span>
          </div>
          <div className="flex justify-between items-center text-sm mt-1">
            <span className="text-gray-600">% Error:</span>
            <span className={`font-bold ${getPorcentajeErrorColor(porcentajeError)}`}>
              {porcentajeError.toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* Información del lote */}
      {camionada.lote_venta && (
        <div className="border-t pt-2 mb-3">
          <p className="text-xs text-gray-600">
            Lote: <span className="font-medium text-gray-800">{camionada.lote_venta.numero_lote}</span>
          </p>
          {camionada.lote_venta.mezcla && (
            <p className="text-xs text-gray-600">
              Mezcla: <span className="font-medium text-gray-800">{camionada.lote_venta.mezcla.codigo}</span>
            </p>
          )}
        </div>
      )}

      {/* Recepción */}
      {camionada.fecha_recepcion && (
        <div className="bg-green-50 border border-green-200 rounded p-2 mb-3">
          <div className="flex items-center gap-1 text-green-800 text-sm mb-1">
            <HiCheckCircle />
            <span className="font-medium">Recibido</span>
          </div>
          <p className="text-xs text-green-700">
            {formatFecha(camionada.fecha_recepcion)}
            {camionada.hora_recepcion && ` - ${camionada.hora_recepcion}`}
          </p>
          {camionada.ley_lab_camion && (
            <p className="text-xs text-green-700 mt-1">
              Ley Lab: <span className="font-bold">{parseFloat(camionada.ley_lab_camion).toFixed(3)}</span>
            </p>
          )}
        </div>
      )}

      {/* Observaciones */}
      {camionada.observaciones && (
        <div className="bg-blue-50 rounded p-2 mb-3">
          <p className="text-xs text-blue-800">{camionada.observaciones}</p>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2 pt-3 border-t">
        {!estaRecibida && onMarcarRecibida && (
          <button
            onClick={() => onMarcarRecibida(camionada)}
            className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 transition-colors"
          >
            <HiCheckCircle />
            Marcar Recibida
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(camionada)}
            className="flex items-center justify-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 transition-colors"
          >
            <HiPencil />
            Editar
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(camionada)}
            className="flex items-center justify-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 transition-colors"
          >
            <HiTrash />
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
};

export default CamionadaCard;
