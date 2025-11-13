# Componentes Reutilizables - Sistema de Producción

Este documento describe los componentes reutilizables creados siguiendo la arquitectura atómica del proyecto.

## 📦 Nuevos Componentes

### 1. **Pagination** (Molecule)
**Ubicación:** `src/shared/components/molecules/Pagination.jsx`

Componente de paginación profesional y completamente reutilizable.

#### Características:
- ✅ Muestra información de registros (X-Y de Z)
- ✅ Botones de navegación (Primera, Anterior, Siguiente, Última)
- ✅ Números de página con ellipsis inteligente
- ✅ Responsive (versión móvil simplificada)
- ✅ Iconos de HeroIcons v2
- ✅ Estilos consistentes con el sistema (orange-600)

#### Props:

```jsx
<Pagination
  currentPage={1}              // Página actual (requerido)
  totalPages={10}              // Total de páginas (requerido)
  totalRecords={150}           // Total de registros (requerido)
  perPage={15}                 // Registros por página (default: 15)
  onPageChange={(page) => {}}  // Callback al cambiar página (requerido)
  showInfo={true}              // Mostrar info de registros (default: true)
  showFirstLast={true}         // Mostrar botones Primera/Última (default: true)
/>
```

#### Ejemplo de uso:

```jsx
import Pagination from '../../../shared/components/molecules/Pagination';

function MiComponente() {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const perPage = 15;

  const handlePageChange = (page) => {
    setCurrentPage(page);
    // Hacer scroll arriba al cambiar página
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      {/* Tu tabla aquí */}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalRecords={totalRecords}
        perPage={perPage}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
```

---

### 2. **TableFilters** (Molecule)
**Ubicación:** `src/shared/components/molecules/TableFilters.jsx`

Componente de filtros profesional con búsqueda y múltiples tipos de filtros.

#### Características:
- ✅ Barra de búsqueda con icono y botón de limpiar
- ✅ Panel expandible de filtros avanzados
- ✅ Soporta múltiples tipos: text, select, date, number
- ✅ Muestra badges de filtros activos
- ✅ Botón para limpiar todos los filtros
- ✅ Responsive (grid adaptativo)
- ✅ Contador de filtros activos

#### Props:

```jsx
<TableFilters
  searchValue=""                          // Valor del buscador
  searchPlaceholder="Buscar..."          // Placeholder del buscador
  onSearchChange={(value) => {}}         // Callback al buscar
  filters={[]}                           // Array de configuración de filtros
  filterValues={{}}                      // Objeto con valores actuales
  onFilterChange={(name, value) => {}}   // Callback al cambiar filtro
  onClear={() => {}}                     // Callback al limpiar todo
  showSearch={true}                      // Mostrar buscador (default: true)
  showClearButton={true}                 // Mostrar botón limpiar (default: true)
/>
```

#### Configuración de Filtros:

```jsx
const filters = [
  {
    name: 'estado',              // Nombre único del filtro
    label: 'Estado',             // Label visible
    type: 'select',              // Tipo: 'text', 'select', 'date', 'number'
    options: [                   // Solo para type='select'
      { value: '1', label: 'Activo' },
      { value: '0', label: 'Inactivo' }
    ]
  },
  {
    name: 'fecha',
    label: 'Fecha de Creación',
    type: 'date'
  },
  {
    name: 'codigo',
    label: 'Código',
    type: 'text',
    placeholder: 'Ej: M5-1SH'
  },
  {
    name: 'cantidad',
    label: 'Cantidad',
    type: 'number',
    placeholder: '0'
  }
];
```

#### Ejemplo de uso completo:

```jsx
import TableFilters from '../../../shared/components/molecules/TableFilters';

function MiComponente() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    estado: '',
    fecha: '',
    categoria: ''
  });

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1); // Resetear paginación
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1); // Resetear paginación
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilters({ estado: '', fecha: '', categoria: '' });
    setCurrentPage(1);
  };

  return (
    <div>
      <TableFilters
        searchValue={searchTerm}
        searchPlaceholder="Buscar por código o nombre..."
        onSearchChange={handleSearchChange}
        filters={[
          {
            name: 'estado',
            label: 'Estado',
            type: 'select',
            options: [
              { value: 'activo', label: 'Activo' },
              { value: 'inactivo', label: 'Inactivo' }
            ]
          },
          {
            name: 'fecha',
            label: 'Fecha',
            type: 'date'
          }
        ]}
        filterValues={filters}
        onFilterChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      {/* Tu tabla aquí */}
    </div>
  );
}
```

---

## 🔧 Integración Backend (Laravel)

### Modificaciones en el Controller:

```php
public function index(Request $request)
{
    // Parámetros de paginación
    $perPage = $request->get('per_page', 15);
    $page = $request->get('page', 1);

    // Parámetros de filtros
    $search = $request->get('search');
    $estado = $request->get('estado');
    $fecha = $request->get('fecha');

    // Construir query
    $query = MiModelo::with('relaciones')
        ->orderBy('created_at', 'desc');

    // Aplicar búsqueda general
    if ($search) {
        $query->where(function ($q) use ($search) {
            $q->where('campo1', 'like', '%' . $search . '%')
                ->orWhere('campo2', 'like', '%' . $search . '%')
                ->orWhere('campo3', 'like', '%' . $search . '%');
        });
    }

    // Filtros específicos
    if ($estado) {
        $query->where('estado', $estado);
    }

    if ($fecha) {
        $query->whereDate('created_at', $fecha);
    }

    // Paginar resultados
    $datos = $query->paginate($perPage, ['*'], 'page', $page);

    return response()->json([
        'success' => true,
        'data' => $datos->items(),
        'pagination' => [
            'total' => $datos->total(),
            'per_page' => $datos->perPage(),
            'current_page' => $datos->currentPage(),
            'last_page' => $datos->lastPage(),
            'from' => $datos->firstItem(),
            'to' => $datos->lastItem()
        ]
    ], 200);
}
```

### Modificaciones en el Service (Frontend):

```javascript
// services/miModulo.js
async getMisDatos(params = {}) {
  const response = await api.get('/mi-endpoint', { params });
  return response.data;
}
```

---

## 📋 Implementación Completa - Ejemplo

### 1. Estado del componente:

```jsx
import { useState, useEffect } from 'react';
import Pagination from '../../../shared/components/molecules/Pagination';
import TableFilters from '../../../shared/components/molecules/TableFilters';

function MiModulo() {
  // Datos
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const perPage = 15;

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    estado: '',
    categoria: ''
  });

  // Recargar al cambiar página o filtros
  useEffect(() => {
    loadData();
  }, [currentPage, searchTerm, filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Construir parámetros
      const params = {
        page: currentPage,
        per_page: perPage,
        search: searchTerm || undefined,
        estado: filters.estado || undefined,
        categoria: filters.categoria || undefined,
      };

      // Limpiar undefined
      Object.keys(params).forEach(key =>
        params[key] === undefined && delete params[key]
      );

      const response = await miService.getMisDatos(params);

      setDatos(response.data || []);

      if (response.pagination) {
        setTotalPages(response.pagination.last_page);
        setTotalRecords(response.pagination.total);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilters({ estado: '', categoria: '' });
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <Card>
        <TableFilters
          searchValue={searchTerm}
          searchPlaceholder="Buscar..."
          onSearchChange={handleSearchChange}
          filters={[
            {
              name: 'estado',
              label: 'Estado',
              type: 'select',
              options: [
                { value: 'activo', label: 'Activo' },
                { value: 'inactivo', label: 'Inactivo' }
              ]
            }
          ]}
          filterValues={filters}
          onFilterChange={handleFilterChange}
          onClear={handleClearFilters}
        />

        {/* Tu tabla aquí */}
        <table>
          {/* ... */}
        </table>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalRecords={totalRecords}
          perPage={perPage}
          onPageChange={handlePageChange}
        />
      </Card>
    </div>
  );
}
```

---

## ✅ Checklist de Implementación

Al agregar paginación y filtros a un módulo nuevo:

### Backend:
- [ ] Modificar método `index()` del controller
- [ ] Agregar parámetro `Request $request`
- [ ] Cambiar `.get()` por `.paginate($perPage)`
- [ ] Agregar lógica de filtros con `where()` condicionales
- [ ] Retornar estructura con `data` y `pagination`

### Frontend - Service:
- [ ] Modificar método para aceptar `params = {}`
- [ ] Pasar `{ params }` en la llamada a `api.get()`

### Frontend - Componente:
- [ ] Importar `Pagination` y `TableFilters`
- [ ] Agregar estados de paginación (currentPage, totalPages, totalRecords)
- [ ] Agregar estados de filtros (searchTerm, filters)
- [ ] Agregar `useEffect` que dependa de página y filtros
- [ ] Modificar `loadData()` para enviar parámetros
- [ ] Agregar handlers (handleSearchChange, handleFilterChange, etc.)
- [ ] Integrar componentes en la UI
- [ ] Actualizar contador de registros (usar `totalRecords` en vez de `array.length`)

---

## 🎨 Personalización

### Cambiar color del tema:

Ambos componentes usan la paleta `orange-*` por defecto. Para cambiar:

1. Buscar en el archivo: `orange-600`, `orange-500`, etc.
2. Reemplazar por tu color: `blue-600`, `green-500`, etc.

### Cambiar registros por página:

```jsx
const perPage = 20; // Cambiar de 15 a 20
```

También actualizar en el backend si es necesario.

---

## 📚 Módulos que ya usan estos componentes

✅ **Frentes de Trabajo** (`/ingenieria/frentes-trabajo`)
- Paginación: 15 registros por página
- Debounce: 500ms en búsqueda
- Filtros: Búsqueda general, Tipo de Frente, Manto
- Backend: `FrenteTrabajoController.php:17`
- Frontend: `FrentesTrabajo.jsx:14` (importa useDebounce)
- Búsqueda en: código_completo, manto, calle, hebra, numero_frente

✅ **Dumpadas - Historial** (`/dispatch` - Vista Historial)
- Paginación: 15 registros por página
- Debounce: 500ms en búsqueda
- Filtros: Búsqueda general, Estado, Jornada, Frente de Trabajo, Rango de Fechas
- Backend: `DumpadaController.php:35`
- Frontend: `Dispatch.jsx:12` (importa useDebounce)
- Búsqueda en: acopios, certificado, n_acopio, código frente trabajo

---

## 🚀 Próximos módulos a actualizar

Estos módulos podrían beneficiarse de paginación y filtros:

1. **Tipos de Frente** - Agregar si crece el catálogo
2. **Laboratorio** - Módulos de análisis
3. **Usuarios** - Si el sistema crece
4. **Rangos** - Si el catálogo crece

---

## 🎯 Hook useDebounce

**Ubicación:** `src/hooks/useDebounce.js`

Este hook personalizado evita que la búsqueda se ejecute en cada letra, esperando a que el usuario deje de escribir.

### Uso:

```jsx
import useDebounce from '../../../hooks/useDebounce';

function MiComponente() {
  const [searchTerm, setSearchTerm] = useState('');

  // El valor con debounce se actualiza 500ms después de que el usuario deja de escribir
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    // Esta función solo se ejecuta después de 500ms de inactividad
    loadData();
  }, [debouncedSearchTerm]); // Usar el valor con debounce, no searchTerm

  const loadData = async () => {
    const params = {
      search: debouncedSearchTerm || undefined, // Usar el valor con debounce
      // ... otros parámetros
    };
    // ... petición al backend
  };

  return (
    <TableFilters
      searchValue={searchTerm} // El input usa el valor sin debounce (respuesta inmediata)
      onSearchChange={setSearchTerm}
      // ...
    />
  );
}
```

### Beneficios:
- ✅ Reduce peticiones al servidor (menos carga)
- ✅ Mejor rendimiento (no busca en cada tecla)
- ✅ UX más fluida (sin parpadeos constantes)
- ✅ El usuario ve lo que escribe inmediatamente, pero la búsqueda espera

---

## 💡 Buenas Prácticas

1. **Siempre usar debounce** en búsquedas para evitar múltiples peticiones
2. **Siempre resetear a página 1** al filtrar o buscar
3. **Hacer scroll arriba** al cambiar de página
4. **Limpiar parámetros undefined** antes de enviar al backend
5. **Mostrar loading states** mientras se cargan datos
6. **El input debe usar el valor sin debounce** para respuesta inmediata visual
7. **Las peticiones deben usar el valor con debounce** en el useEffect

---

**Creado por:** Claude Code
**Fecha:** 2025-11-10
**Arquitectura:** Atomic Design Pattern
