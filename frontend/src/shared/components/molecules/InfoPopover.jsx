import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HiXMark, HiInformationCircle } from 'react-icons/hi2';

/**
 * Ícono ⓘ que al hacer click abre un popover con una explicación breve
 * (ej. "cómo se calcula este número"). Se cierra con click afuera, ESC o el
 * botón de cerrar. Mismo patrón de posicionamiento que RangoTooltip.jsx.
 */
export default function InfoPopover({ text, title = 'Cómo se calcula', className = '' }) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, showAbove: false });
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const popoverHeight = 180;
      const spaceBelow = viewportHeight - rect.bottom;
      const showAbove = spaceBelow < popoverHeight && rect.top > popoverHeight;

      setPosition({
        top: showAbove ? rect.top - 8 : rect.bottom + 8,
        left: rect.left + rect.width / 2,
        showAbove,
      });
    }
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    setShow((s) => !s);
  };

  useEffect(() => {
    if (show) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [show]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        show &&
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        popoverRef.current && !popoverRef.current.contains(e.target)
      ) {
        setShow(false);
      }
    };
    const handleEscape = (e) => { if (e.key === 'Escape') setShow(false); };

    if (show) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [show]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={handleToggle}
        className={`inline-flex items-center justify-center text-gray-300 hover:text-blue-500 cursor-pointer transition-colors align-middle ${className}`}
        title="Click para ver cómo se calcula"
      >
        <HiInformationCircle className="w-3.5 h-3.5" />
      </button>

      {show && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999]"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: position.showAbove ? 'translate(-50%, -100%)' : 'translateX(-50%)',
          }}
        >
          <div className="relative bg-white rounded-lg shadow-2xl border-2 border-blue-200 p-3 w-72">
            <div
              className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-blue-200 rotate-45 ${
                position.showAbove
                  ? 'bottom-[-7px] border-r-2 border-b-2'
                  : 'top-[-7px] border-l-2 border-t-2'
              }`}
            />
            <div className="relative">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-xs font-bold text-blue-900">{title}</p>
                <button
                  onClick={() => setShow(false)}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0 cursor-pointer"
                  title="Cerrar"
                >
                  <HiXMark className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">{text}</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
