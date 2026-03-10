import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export function generarReportePDF(reporte, polvorin, columnasExplosivos) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Reporte de Perforacion y Tronadura', pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Codigo: ${reporte.codigo}`, 14, 25);
  doc.text(`Fecha: ${reporte.fecha}`, 14, 30);
  doc.text(`Turno: ${reporte.turno}`, 14, 35);
  doc.text(`Estado: ${reporte.estado?.toUpperCase()}`, 14, 40);
  doc.text(`Polvorin: ${polvorin?.nombre || '-'}`, 120, 25);
  doc.text(`Confirmado por: ${reporte.confirmado_por || '-'}`, 120, 30);

  if (reporte.observaciones) {
    doc.text(`Observaciones: ${reporte.observaciones}`, 14, 45);
  }

  // Tabla de lineas
  const baseColumns = [
    { header: 'Frente', dataKey: 'frente' },
    { header: 'Operador', dataKey: 'operador' },
    { header: 'Tipo', dataKey: 'tipo' },
    { header: 'A', dataKey: 'ancho' },
    { header: 'H', dataKey: 'alto' },
    { header: 'Tiros', dataKey: 'tiros' },
    { header: 'Largo', dataKey: 'largo' },
    { header: 'Barras', dataKey: 'barras' },
    { header: 'Material', dataKey: 'material' },
  ];

  const explosivoCols = (columnasExplosivos || []).map((te) => ({
    header: te.codigo,
    dataKey: `exp_${te.id}`,
  }));

  const columns = [...baseColumns, ...explosivoCols];

  const rows = (reporte.lineas || []).map((linea) => {
    const row = {
      frente: linea.frente_trabajo?.codigo_completo || '-',
      operador: linea.personal ? `${linea.personal.nombre} ${linea.personal.apellido || ''}` : '-',
      tipo: linea.tipo_frente?.nombre || '-',
      ancho: linea.seccion_ancho || '-',
      alto: linea.seccion_alto || '-',
      tiros: linea.numero_tiros,
      largo: linea.largo_perforacion || '-',
      barras: (linea.barras_usadas || []).join(', ') || '-',
      material: linea.material || '-',
    };

    (columnasExplosivos || []).forEach((te) => {
      const exp = (linea.explosivos || []).find((e) => e.id_tipo_explosivo === te.id);
      row[`exp_${te.id}`] = exp?.cantidad_final || '-';
    });

    return row;
  });

  // Fila de totales
  const totalesRow = {
    frente: '',
    operador: '',
    tipo: '',
    ancho: '',
    alto: '',
    tiros: '',
    largo: '',
    barras: '',
    material: 'TOTALES',
  };

  const totales = {};
  (reporte.lineas || []).forEach((linea) => {
    (linea.explosivos || []).forEach((exp) => {
      if (!totales[exp.id_tipo_explosivo]) totales[exp.id_tipo_explosivo] = 0;
      totales[exp.id_tipo_explosivo] += parseFloat(exp.cantidad_final) || 0;
    });
  });

  (columnasExplosivos || []).forEach((te) => {
    totalesRow[`exp_${te.id}`] = totales[te.id]
      ? parseFloat(totales[te.id]).toFixed(2)
      : '-';
  });

  rows.push(totalesRow);

  doc.autoTable({
    columns,
    body: rows,
    startY: reporte.observaciones ? 50 : 45,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [220, 53, 69], textColor: 255, fontSize: 7 },
    didParseCell: (data) => {
      // Bold for totals row
      if (data.row.index === rows.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [245, 245, 245];
      }
    },
  });

  // Devoluciones
  if (reporte.devoluciones && reporte.devoluciones.length > 0) {
    const devY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Devoluciones', 14, devY);

    doc.autoTable({
      columns: [
        { header: 'Tipo Explosivo', dataKey: 'tipo' },
        { header: 'Cantidad', dataKey: 'cantidad' },
        { header: 'Operador', dataKey: 'operador' },
        { header: 'Motivo', dataKey: 'motivo' },
      ],
      body: reporte.devoluciones.map((d) => ({
        tipo: d.tipo_explosivo ? `${d.tipo_explosivo.codigo} - ${d.tipo_explosivo.nombre}` : '-',
        cantidad: parseFloat(d.cantidad).toFixed(2),
        operador: d.personal ? `${d.personal.nombre} ${d.personal.apellido || ''}` : '-',
        motivo: d.motivo || '-',
      })),
      startY: devY + 3,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [40, 167, 69], textColor: 255 },
    });
  }

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Generado: ${new Date().toLocaleString('es-CL')} - Pagina ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 5,
      { align: 'center' }
    );
  }

  doc.save(`Reporte_${reporte.codigo}.pdf`);
}
