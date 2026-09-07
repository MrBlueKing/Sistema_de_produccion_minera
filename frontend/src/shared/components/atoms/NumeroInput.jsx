import { forwardRef } from 'react';

/**
 * Input numérico para datos sensibles (leyes, Cu, pesos).
 *
 * A diferencia de `<input type="number">`, NO cambia de valor con la rueda del
 * mouse ni con las flechas ↑/↓ — así no se altera una ley sin querer al
 * navegar/scrollear la grilla de ingreso.
 *
 * Es un reemplazo directo: mantiene el contrato de `onChange` (recibe el evento,
 * `e.target.value` es el string) y acepta `className`, `value`, `placeholder`,
 * `disabled`, etc. Solo deja escribir dígitos y un separador decimal.
 */
const NumeroInput = forwardRef(function NumeroInput(
  { onChange, onKeyDown, permitirNegativo = false, ...props },
  ref
) {
  const patron = permitirNegativo ? /^-?\d*[.,]?\d*$/ : /^\d*[.,]?\d*$/;

  return (
    <input
      ref={ref}
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      onChange={(e) => {
        if (patron.test(e.target.value)) {
          // Normaliza coma a punto ANTES de que el consumidor reciba el evento:
          // parseFloat("3,25") corta en la coma y da 3, no 3.25 — como el patrón
          // de arriba permite tipear con coma (costumbre chilena), sin esto
          // cualquier parseFloat() río abajo trunca el decimal en silencio.
          e.target.value = e.target.value.replace(',', '.');
          onChange?.(e);
        }
      }}
      onWheel={(e) => e.currentTarget.blur()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
        }
        onKeyDown?.(e);
      }}
    />
  );
});

export default NumeroInput;
