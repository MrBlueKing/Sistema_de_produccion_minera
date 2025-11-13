# Sistema de Toast Notifications

Sistema de notificaciones tipo toast implementado siguiendo Atomic Design.

## Estructura

```
frontend/src/
├── shared/components/
│   ├── atoms/
│   │   └── Toast.jsx                 # Componente individual de toast
│   └── organisms/
│       └── ToastContainer.jsx        # Contenedor de toasts
├── contexts/
│   └── ToastContext.jsx              # Provider y contexto
└── hooks/
    └── useToast.js                   # Hook para usar toasts
```

## Uso

### 1. El Provider ya está configurado en App.jsx

```jsx
import { ToastProvider } from './contexts/ToastContext';

<ToastProvider>
  <AppRoutes />
</ToastProvider>
```

### 2. Usar en cualquier componente

```jsx
import useToast from '../../../hooks/useToast';

function MiComponente() {
  const toast = useToast();

  const handleSubmit = async () => {
    try {
      // ... tu lógica
      toast.success('¡Operación exitosa!', 'Los datos se guardaron correctamente');
    } catch (error) {
      toast.error('Error', error.message);
    }
  };

  return (
    // ... tu JSX
  );
}
```

## Métodos disponibles

- **`toast.success(message, description?)`** - Notificación de éxito (verde, 5s)
- **`toast.error(message, description?)`** - Notificación de error (rojo, 7s)
- **`toast.warning(message, description?)`** - Notificación de advertencia (amarillo, 6s)
- **`toast.info(message, description?)`** - Notificación informativa (azul, 5s)

## Características

✅ **Posición fija** - Aparece en la esquina superior derecha, siempre visible
✅ **Auto-cierre** - Se cierra automáticamente según el tipo
✅ **Apilamiento** - Múltiples toasts se apilan verticalmente
✅ **Animaciones** - Entrada suave desde la derecha
✅ **Cierre manual** - Botón X para cerrar antes de tiempo
✅ **Accesibilidad** - Soporte para lectores de pantalla
✅ **Atomic Design** - Estructura modular y reutilizable

## Integración actual

- ✅ Módulo de Frentes de Trabajo
- ✅ Módulo de Dumpadas (Dispatch)

## Ventajas vs AlertMessage

| AlertMessage (anterior) | Toast (nuevo) |
|------------------------|---------------|
| Requiere scroll para ver | Siempre visible |
| Ocupa espacio en el layout | Flota sobre el contenido |
| Necesita setState manual | Auto-gestionado |
| Un mensaje a la vez | Múltiples simultáneos |
| Menos profesional | Estándar moderno |
