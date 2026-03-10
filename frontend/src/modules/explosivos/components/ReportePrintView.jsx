export default function ReportePrintView({ reporte, polvorin, columnasExplosivos }) {
  if (!reporte) return null;

  const totales = {};
  (reporte.lineas || []).forEach((linea) => {
    (linea.explosivos || []).forEach((exp) => {
      if (!totales[exp.id_tipo_explosivo]) totales[exp.id_tipo_explosivo] = 0;
      totales[exp.id_tipo_explosivo] += parseFloat(exp.cantidad_final) || 0;
    });
  });

  return (
    <div className="hidden print:block p-4 text-black bg-white">
      <h1 className="text-xl font-bold text-center mb-2">Reporte de Perforacion y Tronadura</h1>
      <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
        <div><strong>Codigo:</strong> {reporte.codigo}</div>
        <div><strong>Fecha:</strong> {reporte.fecha}</div>
        <div><strong>Turno:</strong> {reporte.turno}</div>
        <div><strong>Polvorin:</strong> {polvorin?.nombre || '-'}</div>
        <div><strong>Estado:</strong> {reporte.estado}</div>
        <div><strong>Confirmado por:</strong> {reporte.confirmado_por || '-'}</div>
      </div>
      {reporte.observaciones && (
        <p className="text-sm mb-4"><strong>Observaciones:</strong> {reporte.observaciones}</p>
      )}

      <table className="w-full text-xs border-collapse border border-black mb-4">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-black px-1 py-1">Frente</th>
            <th className="border border-black px-1 py-1">Operador</th>
            <th className="border border-black px-1 py-1">Tipo</th>
            <th className="border border-black px-1 py-1">A</th>
            <th className="border border-black px-1 py-1">H</th>
            <th className="border border-black px-1 py-1">Tiros</th>
            <th className="border border-black px-1 py-1">Largo</th>
            <th className="border border-black px-1 py-1">Barras</th>
            <th className="border border-black px-1 py-1">Material</th>
            {(columnasExplosivos || []).map((te) => (
              <th key={te.id} className="border border-black px-1 py-1">{te.codigo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(reporte.lineas || []).map((linea) => (
            <tr key={linea.id}>
              <td className="border border-black px-1 py-0.5">{linea.frente_trabajo?.codigo_completo || '-'}</td>
              <td className="border border-black px-1 py-0.5">
                {linea.personal ? `${linea.personal.nombre} ${linea.personal.apellido || ''}` : '-'}
              </td>
              <td className="border border-black px-1 py-0.5">{linea.tipo_frente?.nombre || '-'}</td>
              <td className="border border-black px-1 py-0.5 text-center">{linea.seccion_ancho || '-'}</td>
              <td className="border border-black px-1 py-0.5 text-center">{linea.seccion_alto || '-'}</td>
              <td className="border border-black px-1 py-0.5 text-center">{linea.numero_tiros}</td>
              <td className="border border-black px-1 py-0.5 text-center">{linea.largo_perforacion || '-'}</td>
              <td className="border border-black px-1 py-0.5 text-center">{(linea.barras_usadas || []).join(', ') || '-'}</td>
              <td className="border border-black px-1 py-0.5 text-center">{linea.material || '-'}</td>
              {(columnasExplosivos || []).map((te) => {
                const exp = (linea.explosivos || []).find((e) => e.id_tipo_explosivo === te.id);
                return (
                  <td key={te.id} className="border border-black px-1 py-0.5 text-center">
                    {exp?.cantidad_final || '-'}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="bg-gray-200 font-bold">
            <td colSpan={9} className="border border-black px-1 py-1 text-right">TOTALES</td>
            {(columnasExplosivos || []).map((te) => (
              <td key={te.id} className="border border-black px-1 py-1 text-center">
                {totales[te.id] ? parseFloat(totales[te.id]).toFixed(2) : '-'}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {reporte.devoluciones && reporte.devoluciones.length > 0 && (
        <>
          <h2 className="text-sm font-bold mb-2">Devoluciones</h2>
          <table className="w-full text-xs border-collapse border border-black">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-black px-2 py-1">Tipo Explosivo</th>
                <th className="border border-black px-2 py-1">Cantidad</th>
                <th className="border border-black px-2 py-1">Operador</th>
                <th className="border border-black px-2 py-1">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {reporte.devoluciones.map((d) => (
                <tr key={d.id}>
                  <td className="border border-black px-2 py-0.5">
                    {d.tipo_explosivo ? `${d.tipo_explosivo.codigo} - ${d.tipo_explosivo.nombre}` : '-'}
                  </td>
                  <td className="border border-black px-2 py-0.5 text-center">{parseFloat(d.cantidad).toFixed(2)}</td>
                  <td className="border border-black px-2 py-0.5">
                    {d.personal ? `${d.personal.nombre} ${d.personal.apellido || ''}` : '-'}
                  </td>
                  <td className="border border-black px-2 py-0.5">{d.motivo || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
