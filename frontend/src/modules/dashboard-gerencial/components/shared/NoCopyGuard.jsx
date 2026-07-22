import { useEffect } from 'react';

/**
 * Envuelve contenido sensible (Dashboard Gerencial) y dificulta copiarlo:
 * sin clic derecho, sin selección de texto, sin impresión.
 *
 * Límite real: nada de esto evita una foto de pantalla con otro celular —
 * eso está fuera del alcance de cualquier página web. La marca de agua con
 * usuario + fecha va quemada en el PDF de la vista previa de certificados
 * (CertificadoPdfService), no como overlay de pantalla.
 */
export default function NoCopyGuard({ children }) {
  useEffect(() => {
    const bloquearMenuContextual = (e) => e.preventDefault();
    const bloquearCopiar = (e) => e.preventDefault();
    const bloquearAtajos = (e) => {
      // Ctrl/Cmd + P (imprimir), Ctrl/Cmd + S (guardar), Ctrl/Cmd + C (copiar)
      const combo = (e.ctrlKey || e.metaKey) && ['p', 's', 'c'].includes(e.key.toLowerCase());
      if (combo) e.preventDefault();
    };

    document.addEventListener('contextmenu', bloquearMenuContextual);
    document.addEventListener('copy', bloquearCopiar);
    document.addEventListener('keydown', bloquearAtajos);

    return () => {
      document.removeEventListener('contextmenu', bloquearMenuContextual);
      document.removeEventListener('copy', bloquearCopiar);
      document.removeEventListener('keydown', bloquearAtajos);
    };
  }, []);

  return (
    <div className="select-none print:hidden" style={{ WebkitUserSelect: 'none' }}>
      {children}
    </div>
  );
}
