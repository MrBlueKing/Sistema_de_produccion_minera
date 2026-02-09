# 🏭 SISTEMA COMPLETO DE MEZCLAS Y LOTES DE VENTA

## 📊 FLUJO DEL PROCESO MINERO

```
1. DUMPADAS                    2. MEZCLA                     3. LOTE DE VENTA              4. REMANENTE
   (Descargas)                    (Lote Interno)                (Venta a Cliente)              (Si sobra)
   ┌─────────┐                   ┌──────────────┐              ┌──────────────┐              ┌───────────┐
   │ Dump 1  │──┐                │   CZ1224     │              │   Lote L500  │              │ 5 ton     │
   │ 4.6 t   │  │             ┌─→│              │──────────────→│ Para: MDF    │──────────────→│ Sobra     │
   ├─────────┤  ├─────────────┘  │ 85.48 t      │              │ Enviado: 80t │              │           │
   │ Dump 2  │──┘                │ Ley: 1.04    │              │ Remanente:5t │              └─────┬─────┘
   │ 4.8 t   │                   └──────────────┘              └──────────────┘                    │
   ├─────────┤                                                                                      │
   │ Dump 3  │                                                                                      │
   │ 5.2 t   │                                                                                      ▼
   └─────────┘                                                                            5. NUEVA MEZCLA
                                                                                            (CZ1225)
                                                                                          Usa remanente
                                                                                          + Nuevas dumpadas
```

---

## 🗂️ ESTRUCTURA DE TABLAS

### **Tabla 1: dumpadas** (Ya existe)
Descargas individuales de camiones mineros.

### **Tabla 2: mezclas**
Lotes internos formados por múltiples dumpadas.

| Campo           | Tipo          | Descripción                        |
|-----------------|---------------|------------------------------------|
| id              | BIGINT PK     | ID autoincremental                 |
| codigo          | VARCHAR(50)   | Código único (ej: CZ1224)          |
| fecha           | DATE          | Fecha de preparación               |
| total_ton       | DECIMAL(10,2) | Toneladas totales                  |
| ley_prom_dump   | DECIMAL(8,3)  | Ley promedio dump (ajustada)       |
| ley_prom_visual | DECIMAL(8,3)  | Ley promedio visual                |
| ley_prom_lote   | DECIMAL(8,3)  | Ley promedio lote                  |
| ley_lab         | DECIMAL(8,3)  | Ley de laboratorio (opcional)      |
| estado          | ENUM          | Pendiente/En Análisis/Completado   |

### **Tabla 3: mezcla_dumpada** (Pivot/Detalle)
Relaciona mezclas con dumpadas o remanentes.

| Campo              | Tipo          | Descripción                              |
|--------------------|---------------|------------------------------------------|
| id                 | BIGINT PK     | ID autoincremental                       |
| mezcla_id          | BIGINT FK     | Mezcla a la que pertenece                |
| dumpada_id         | BIGINT FK NULL| Dumpada (NULL si es remanente)           |
| lote_venta_id      | BIGINT FK NULL| Lote de venta origen (si es remanente)   |
| tipo               | ENUM          | 'DUMP' o 'REM'                           |
| origen             | VARCHAR(150)  | Descripción del origen                   |
| toneladas          | DECIMAL(8,2)  | Toneladas de este detalle                |
| ley_dump_ajustada  | DECIMAL(8,3)  | Ley dump con ajuste -0.009               |
| ley_visual         | DECIMAL(8,3)  | Ley visual                               |
| ley_lote           | DECIMAL(8,3)  | Ley lote                                 |

**Lógica:**
- Si `tipo='DUMP'`: `dumpada_id` tiene valor, `lote_venta_id=NULL`
- Si `tipo='REM'`: `dumpada_id=NULL`, `lote_venta_id` tiene valor (origen del remanente)

### **Tabla 4: lotes_venta**
Lotes enviados a clientes (ventas).

| Campo            | Tipo          | Descripción                              |
|------------------|---------------|------------------------------------------|
| id               | BIGINT PK     | ID autoincremental                       |
| numero_lote      | VARCHAR(50)   | Número único (ej: L1001)                 |
| mezcla_id        | BIGINT FK     | Mezcla utilizada                         |
| cliente          | VARCHAR(150)  | Cliente/Destino (ej: "MDF Inés")         |
| fecha_envio      | DATE          | Fecha de envío                           |
| peso_enviado     | DECIMAL(10,2) | Peso enviado en toneladas                |
| ley_lab          | DECIMAL(8,3)  | Ley de laboratorio del lote vendido      |
| peso_remanente   | DECIMAL(10,2) | Peso que sobró (remanente)               |
| porcentaje_error | DECIMAL(5,2)  | % diferencia entre ley esperada y real   |
| estado           | ENUM          | Preparado/Enviado/Completado             |

---

## 🔄 FLUJO DE TRABAJO COMPLETO

### **PASO 1: Crear Dumpadas**
```
Dumpada 4157: 4.6 t, ley 1.12
Dumpada 4158: 4.8 t, ley 0.98
Dumpada 4159: 5.2 t, ley 1.05
```

### **PASO 2: Crear Mezcla con Dumpadas**
```http
POST /api/mezclas
{
  "codigo": "CZ1224",
  "fecha": "2025-11-17",
  "dumpadas": [4157, 4158, 4159]
}

Resultado:
- Total: 14.6 t
- Ley promedio dump: 1.04 (con ajuste)
```

### **PASO 3: Crear Lote de Venta**
```http
POST /api/lotes-venta
{
  "mezcla_id": 1,
  "cliente": "MDF Inés",
  "fecha_envio": "2025-11-18",
  "peso_enviado": 12.0
}

Resultado:
- Lote L1001 creado
- Peso enviado: 12 t
- Remanente calculado automáticamente: 2.6 t (14.6 - 12.0)
```

### **PASO 4: Usar Remanente en Nueva Mezcla**
```http
POST /api/mezclas
{
  "codigo": "CZ1225",
  "fecha": "2025-11-19",
  "dumpadas": [4160, 4161, 4162],
  "lotes_venta_remanentes": [1]  // Lote L1001 con remanente 2.6t
}

Resultado:
- Mezcla CZ1225 incluye:
  - Dumpadas 4160-4162
  - Remanente de 2.6 t del lote L1001
- Total: Dumpadas + remanente
```

---

## 📡 API ENDPOINTS

### **Mezclas**

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/mezclas` | Listar mezclas |
| POST | `/api/mezclas` | Crear mezcla |
| GET | `/api/mezclas/{id}` | Ver mezcla |
| PUT | `/api/mezclas/{id}` | Actualizar mezcla |
| DELETE | `/api/mezclas/{id}` | Eliminar mezcla |
| POST | `/api/mezclas/{id}/agregar-dumpadas` | Agregar dumpadas |
| POST | `/api/mezclas/{id}/agregar-remanente` | Agregar remanente manual |
| GET | `/api/mezclas/dumpadas-disponibles` | Dumpadas sin asignar |

### **Lotes de Venta**

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/lotes-venta` | Listar lotes de venta |
| POST | `/api/lotes-venta` | Crear lote de venta |
| GET | `/api/lotes-venta/{id}` | Ver lote |
| PUT | `/api/lotes-venta/{id}` | Actualizar lote |
| DELETE | `/api/lotes-venta/{id}` | Eliminar lote |
| POST | `/api/lotes-venta/{id}/ley-laboratorio` | Actualizar ley lab |
| GET | `/api/lotes-venta/con-remanente` | Lotes con remanente disponible |
| POST | `/api/lotes-venta/{id}/agregar-a-mezcla` | Agregar remanente a mezcla |
| GET | `/api/lotes-venta/{id}/reporte` | Generar reporte |

---

## 🎯 EJEMPLOS COMPLETOS

### **Ejemplo 1: Flujo Completo**

#### **1.1 Crear Mezcla CZ1224**
```http
POST /api/mezclas
Content-Type: application/json

{
  "codigo": "CZ1224",
  "fecha": "2025-11-17",
  "dumpadas": [4157, 4158, 4159, 4160, 4161],
  "user_id": 5
}
```

**Response:**
```json
{
  "mensaje": "Mezcla creada exitosamente",
  "mezcla": {
    "id": 1,
    "codigo": "CZ1224",
    "total_ton": 23.40,
    "ley_prom_dump": 1.04,
    "estado": "Pendiente"
  }
}
```

#### **1.2 Crear Lote de Venta L1001**
```http
POST /api/lotes-venta
Content-Type: application/json

{
  "mezcla_id": 1,
  "cliente": "MDF Inés",
  "fecha_envio": "2025-11-18",
  "peso_enviado": 20.0,
  "user_id": 5
}
```

**Response:**
```json
{
  "mensaje": "Lote de venta creado exitosamente",
  "lote": {
    "id": 1,
    "numero_lote": "L1001",
    "mezcla_id": 1,
    "cliente": "MDF Inés",
    "peso_enviado": 20.00,
    "peso_remanente": 3.40,
    "estado": "Preparado"
  }
}
```

#### **1.3 Obtener Lotes con Remanente**
```http
GET /api/lotes-venta/con-remanente
```

**Response:**
```json
[
  {
    "id": 1,
    "numero_lote": "L1001",
    "peso_remanente": 3.40,
    "mezcla": {
      "codigo": "CZ1224",
      "ley_prom_dump": 1.04
    }
  }
]
```

#### **1.4 Crear Nueva Mezcla con Remanente**
```http
POST /api/mezclas
Content-Type: application/json

{
  "codigo": "CZ1225",
  "fecha": "2025-11-19",
  "dumpadas": [4162, 4163, 4164],
  "lotes_venta_remanentes": [1]
}
```

**Response:**
```json
{
  "mensaje": "Mezcla creada exitosamente",
  "mezcla": {
    "id": 2,
    "codigo": "CZ1225",
    "total_ton": 17.80,
    "detalles": [
      {
        "id": 6,
        "tipo": "REM",
        "lote_venta_id": 1,
        "origen": "Remanente Lote L1001 (3.4 t)",
        "toneladas": 3.40,
        "ley_dump_ajustada": 1.031
      },
      {
        "id": 7,
        "tipo": "DUMP",
        "dumpada_id": 4162,
        "toneladas": 4.80
      },
      ...
    ]
  }
}
```

#### **1.5 Actualizar Ley de Laboratorio del Lote**
```http
POST /api/lotes-venta/1/ley-laboratorio
Content-Type: application/json

{
  "ley_lab": 1.15
}
```

**Response:**
```json
{
  "mensaje": "Ley de laboratorio actualizada",
  "lote": {
    "id": 1,
    "numero_lote": "L1001",
    "ley_lab": 1.15,
    "porcentaje_error": 10.58,
    "estado": "Completado"
  }
}
```

---

## 🔧 VALIDACIONES AUTOMÁTICAS

✅ **Mezclas:**
- Dumpadas no pueden estar en dos mezclas
- Remanentes de lotes solo se usan una vez
- Cálculos automáticos de totales y promedios
- Ajuste de ley (-0.009) aplicado automáticamente

✅ **Lotes de Venta:**
- Peso enviado no puede superar peso de mezcla
- Remanente calculado automáticamente
- Porcentaje de error calculado automáticamente
- No se puede eliminar lote si remanente fue usado

---

## 📈 CÁLCULOS AUTOMÁTICOS

### **1. Remanente del Lote**
```
peso_remanente = peso_mezcla - peso_enviado
```

**Ejemplo:**
```
Mezcla CZ1224: 85.48 t
Lote L1001 enviado: 80.00 t
Remanente: 85.48 - 80.00 = 5.48 t
```

### **2. Porcentaje de Error**
```
error% = |ley_lab - ley_promedio_mezcla| / ley_promedio_mezcla × 100
```

**Ejemplo:**
```
Ley esperada (mezcla): 1.04
Ley real (laboratorio): 1.15
Error: |1.15 - 1.04| / 1.04 × 100 = 10.58%
```

### **3. Ajuste de Ley en Mezclas**
```
ley_ajustada = ley_original - 0.009
```

### **4. Promedios Ponderados**
```
ley_promedio = Σ(toneladas × ley) / Σ(toneladas)
```

---

## 🚨 MANEJO DE ERRORES

### **Error 1: Dumpada ya en mezcla**
```json
{
  "error": "Error al crear la mezcla",
  "mensaje": "La dumpada #4157 ya está en una mezcla"
}
```

### **Error 2: Remanente ya usado**
```json
{
  "error": "Error al crear la mezcla",
  "mensaje": "Remanente del lote L1001 ya fue utilizado"
}
```

### **Error 3: Peso excede mezcla**
```json
{
  "error": "Error al crear el lote de venta",
  "mensaje": "El peso enviado (90 t) no puede superar el total de la mezcla (85.48 t)"
}
```

### **Error 4: No hay remanente**
```json
{
  "error": "Error al agregar remanente",
  "mensaje": "Lote L1001 no tiene remanente disponible"
}
```

---

## 📋 MIGRACIONES A EJECUTAR

```bash
cd backend
php artisan migrate
```

Esto creará/modificará:
1. `mezclas`
2. `mezcla_dumpada` (con campo `lote_venta_id`)
3. `lotes_venta`

---

## ✅ RESUMEN

### **Tablas Creadas:**
- ✅ mezclas
- ✅ mezcla_dumpada
- ✅ lotes_venta

### **Modelos Creados:**
- ✅ Mezcla
- ✅ MezclaDumpada
- ✅ LoteVenta
- ✅ Dumpada (actualizado)

### **Servicios Creados:**
- ✅ MezclaService
- ✅ LoteVentaService

### **Controladores Creados:**
- ✅ MezclaController
- ✅ LoteVentaController

### **Funcionalidades:**
- ✅ Crear mezclas con dumpadas
- ✅ Crear lotes de venta desde mezclas
- ✅ Calcular remanentes automáticamente
- ✅ Usar remanentes en nuevas mezclas
- ✅ Calcular promedios ponderados
- ✅ Aplicar ajuste de ley (-0.009)
- ✅ Calcular porcentaje de error
- ✅ Validar duplicados
- ✅ Generar reportes

---

Este sistema ahora maneja correctamente el flujo completo desde dumpadas hasta lotes de venta con remanentes.
