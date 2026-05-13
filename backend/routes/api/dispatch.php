<?php

use App\Http\Controllers\Api\Dispatch\DumpadaController;
use App\Http\Controllers\Api\Dispatch\ImportarDumpadasController;
use App\Http\Controllers\Api\Dispatch\ImportarMezclasController;
use App\Http\Controllers\Api\Dispatch\ImportarLotesCamionadasController;
use App\Http\Controllers\Api\Dispatch\MuestraLibreController;
use App\Http\Controllers\Api\Dispatch\RangoController;
use App\Http\Controllers\Api\Dispatch\TronaduraController;
use App\Http\Controllers\Api\Dispatch\AcopioController;
use App\Http\Controllers\Api\Laboratorio\MezclaController;
use App\Http\Controllers\Api\Laboratorio\CamionadaController;
use App\Http\Controllers\Api\Laboratorio\PlantaController;
use App\Http\Controllers\Api\Laboratorio\EmpresaController;
use App\Http\Controllers\Api\Laboratorio\LoteController;
use App\Http\Controllers\Api\MapaTerrenoController;
use App\Http\Controllers\Api\TonelajeMaquinaController;
use App\Http\Controllers\Api\CamionController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rutas de Dispatch
| Prefijo: /api/dispatch
|--------------------------------------------------------------------------
*/

// Resumen semanal para el hub
Route::get('/resumen-semana', [DumpadaController::class, 'resumenSemana']);

// Dumpadas
Route::prefix('dumpadas')->group(function () {
    Route::get('/', [DumpadaController::class, 'index']);
    Route::post('/', [DumpadaController::class, 'store']);
    Route::post('/bulk', [DumpadaController::class, 'bulkStore']); // Creación masiva
    Route::post('/previsualizar-acopio', [DumpadaController::class, 'previsualizarAcopio']);
    Route::post('/marcar-muestreo', [DumpadaController::class, 'marcarMuestreo']); // Marcar para muestreo de lab
    Route::get('/{id}', [DumpadaController::class, 'show']);
    Route::put('/{id}', [DumpadaController::class, 'update']);
    Route::delete('/{id}', [DumpadaController::class, 'destroy']);
});

// ==========================
// ACOPIOS
// ==========================
Route::prefix('acopios')->group(function () {
    // Detectar acopios existentes para dumpadas (debe ir primero)
    Route::post('/detectar-existentes', [AcopioController::class, 'detectarExistentes']);

    // Obtener acopios disponibles para mezclas
    Route::get('/disponibles', [AcopioController::class, 'disponibles']);

    // Obtener acopios para mezclas (alias del anterior para claridad)
    Route::get('/para-mezclas', [AcopioController::class, 'disponibles']);

    // Obtener dumpadas sin acopio
    Route::get('/dumpadas-sin-acopio', [AcopioController::class, 'dumpadasSinAcopio']);

    // Listar acopios
    Route::get('/', [AcopioController::class, 'index']);

    // Crear acopio automático
    Route::post('/automatico', [AcopioController::class, 'crearAutomatico']);

    // Crear acopio manual
    Route::post('/manual', [AcopioController::class, 'crearManual']);

    // Ver acopio específico
    Route::get('/{id}', [AcopioController::class, 'show']);

    // Agregar dumpadas al acopio
    Route::post('/{id}/agregar-dumpadas', [AcopioController::class, 'agregarDumpadas']);

    // Quitar dumpadas del acopio
    Route::post('/{id}/quitar-dumpadas', [AcopioController::class, 'quitarDumpadas']);

    // Verificar si puede cerrarse (debe ir antes de cerrar)
    Route::get('/{id}/puede-cerrarse', [AcopioController::class, 'puedeCerrarse']);

    // Cerrar acopio
    Route::post('/{id}/cerrar', [AcopioController::class, 'cerrar']);

    // Reabrir acopio
    Route::post('/{id}/reabrir', [AcopioController::class, 'reabrir']);

    // Eliminar acopio
    Route::delete('/{id}', [AcopioController::class, 'destroy']);
});

// Rangos
Route::prefix('rangos')->group(function () {
    Route::get('/', [RangoController::class, 'index']);
    Route::post('/by-ley', [RangoController::class, 'getRangoByLey']);
});

// ==========================
// TRONADURAS (Explosiones/Disparos)
// ==========================
Route::prefix('tronaduras')->group(function () {
    // Listar tronaduras
    Route::get('/', [TronaduraController::class, 'index']);

    // Obtener tronaduras activas (para selector)
    Route::get('/activas', [TronaduraController::class, 'activas']);

    // Crear tronadura
    Route::post('/', [TronaduraController::class, 'store']);

    // Ver tronadura específica
    Route::get('/{id}', [TronaduraController::class, 'show']);

    // Actualizar tronadura
    Route::put('/{id}', [TronaduraController::class, 'update']);

    // Eliminar tronadura
    Route::delete('/{id}', [TronaduraController::class, 'destroy']);

    // Asignar dumpadas a tronadura
    Route::post('/{id}/asignar-dumpadas', [TronaduraController::class, 'asignarDumpadas']);

    // Desasignar dumpadas de tronadura
    Route::post('/{id}/desasignar-dumpadas', [TronaduraController::class, 'desasignarDumpadas']);

    // Marcar como completada
    Route::post('/{id}/completar', [TronaduraController::class, 'completar']);
});

// ==========================
// MEZCLAS
// ==========================
Route::prefix('mezclas')->group(function () {
    // Listar mezclas
    Route::get('/', [MezclaController::class, 'index']);

    // Obtener dumpadas disponibles
    Route::get('/dumpadas-disponibles', [MezclaController::class, 'dumpadasDisponibles']);

    // Obtener mezclas con remanente disponible
    Route::get('/remanentes-disponibles', [MezclaController::class, 'remanentesDisponibles']);

    // Marcar remanente como descarte
    Route::post('/{id}/marcar-descarte', [MezclaController::class, 'marcarDescarte']);

    // Crear mezcla
    Route::post('/', [MezclaController::class, 'store']);

    // Ver mezcla específica
    Route::get('/{id}', [MezclaController::class, 'show']);

    // Actualizar mezcla
    Route::put('/{id}', [MezclaController::class, 'update']);

    // Eliminar mezcla
    Route::delete('/{id}', [MezclaController::class, 'destroy']);

    // Actualizar ley de laboratorio
    Route::post('/{id}/ley-laboratorio', [MezclaController::class, 'actualizarLeyLaboratorio']);

    // Agregar dumpadas
    Route::post('/{id}/agregar-dumpadas', [MezclaController::class, 'agregarDumpadas']);

    // Agregar remanente manual
    Route::post('/{id}/agregar-remanente', [MezclaController::class, 'agregarRemanente']);

    // Editar detalle (remanente)
    Route::put('/{mezclaId}/detalles/{detalleId}', [MezclaController::class, 'editarDetalle']);

    // Eliminar detalle
    Route::delete('/{mezclaId}/detalles/{detalleId}', [MezclaController::class, 'eliminarDetalle']);

    // Generar reporte
    Route::get('/{id}/reporte', [MezclaController::class, 'reporte']);

    // Aplicar ajuste manual de toneladas
    Route::post('/{id}/ajustar-toneladas', [MezclaController::class, 'aplicarAjusteToneladas']);

    // Revertir ajuste de toneladas
    Route::post('/{id}/revertir-ajuste', [MezclaController::class, 'revertirAjusteToneladas']);
});

// ==========================
// CAMIONADAS (DESPACHOS)
// Sistema simplificado: Mezclas -> Camionadas (sin lotes intermedios)
// ==========================
Route::prefix('camionadas')->group(function () {
    // Listar camionadas
    Route::get('/', [CamionadaController::class, 'index']);

    // Obtener mezclas con remanente disponible para despacho
    Route::get('/mezclas-disponibles', [CamionadaController::class, 'mezclasDisponibles']);

    // Reordenar camionadas dentro de un lote
    Route::post('/reordenar', [CamionadaController::class, 'reordenar']);

    // Crear camionada (despacho directo desde mezcla)
    Route::post('/', [CamionadaController::class, 'store']);

    // Ver camionada específica
    Route::get('/{id}', [CamionadaController::class, 'show']);

    // Actualizar camionada
    Route::put('/{id}', [CamionadaController::class, 'update']);

    // Eliminar camionada
    Route::delete('/{id}', [CamionadaController::class, 'destroy']);

    // Marcar como recibida
    Route::post('/{id}/recibir', [CamionadaController::class, 'marcarRecibida']);

    // Recepcionar camionada (con peso real y datos de recepción)
    Route::post('/{id}/recepcionar', [CamionadaController::class, 'recepcionar']);

    // Anular recepción de una camionada
    Route::post('/{id}/anular-recepcion', [CamionadaController::class, 'anularRecepcion']);

    // Actualizar ley de laboratorio
    Route::post('/{id}/ley-laboratorio', [CamionadaController::class, 'actualizarLeyLaboratorio']);
});

// Resumen de camionadas por mezcla
Route::get('/mezclas/{mezclaId}/resumen-camionadas', [CamionadaController::class, 'resumenPorMezcla']);

// ==========================
// PLANTAS
// ==========================
Route::prefix('plantas')->group(function () {
    Route::get('/', [PlantaController::class, 'index']);
    Route::post('/', [PlantaController::class, 'store']);
    Route::get('/{id}', [PlantaController::class, 'show']);
    Route::put('/{id}', [PlantaController::class, 'update']);
    Route::delete('/{id}', [PlantaController::class, 'destroy']);
});

// ==========================
// EMPRESAS
// ==========================
Route::prefix('empresas')->group(function () {
    Route::get('/', [EmpresaController::class, 'index']);
    Route::post('/', [EmpresaController::class, 'store']);
    Route::get('/{id}', [EmpresaController::class, 'show']);
    Route::put('/{id}', [EmpresaController::class, 'update']);
    Route::delete('/{id}', [EmpresaController::class, 'destroy']);
});

// ==========================
// LOTES
// ==========================
Route::prefix('lotes')->group(function () {
    // Obtener lotes abiertos con camionadas (vista cards)
    Route::get('/abiertos-con-camionadas', [LoteController::class, 'lotesAbiertosConCamionadas']);

    // Obtener lotes abiertos por planta y empresa (debe ir primero para no confundir con /{id})
    Route::get('/abiertos', [LoteController::class, 'lotesAbiertos']);

    // CRUD básico
    Route::get('/', [LoteController::class, 'index']);
    Route::post('/', [LoteController::class, 'store']);
    Route::get('/{id}', [LoteController::class, 'show']);
    Route::put('/{id}', [LoteController::class, 'update']);
    Route::delete('/{id}', [LoteController::class, 'destroy']);

    // Acciones específicas de lotes
    Route::post('/{id}/cerrar', [LoteController::class, 'cerrar']);
    Route::get('/{id}/resumen', [LoteController::class, 'resumen']);
    Route::get('/{id}/reconstruccion', [LoteController::class, 'reconstruccion']);
});

// ==========================
// MAPA DE TERRENO
// ==========================
Route::prefix('mapa-terreno')->group(function () {
    // Obtener mapa completo (zonas + dumpadas)
    Route::get('/', [MapaTerrenoController::class, 'index']);

    // Gestión de posiciones de dumpadas
    Route::put('/dumpadas/{id}/posicion', [MapaTerrenoController::class, 'actualizarPosicionDumpada']);

    // Gestión de zonas
    Route::get('/zonas', [MapaTerrenoController::class, 'listarZonas']);
    Route::post('/zonas', [MapaTerrenoController::class, 'crearZona']);
    Route::put('/zonas/{id}', [MapaTerrenoController::class, 'actualizarZona']);
    Route::delete('/zonas/{id}', [MapaTerrenoController::class, 'eliminarZona']);
});

// ==========================
// IMPORTACIÓN DESDE EXCEL
// ==========================
Route::prefix('importar')->group(function () {
    Route::post('/preview', [ImportarDumpadasController::class, 'preview']);
    Route::post('/confirmar', [ImportarDumpadasController::class, 'confirmar']);
    Route::post('/mezclas/preview', [ImportarMezclasController::class, 'preview']);
    Route::post('/mezclas/confirmar', [ImportarMezclasController::class, 'confirmar']);
    Route::post('/lotes/preview', [ImportarLotesCamionadasController::class, 'preview']);
    Route::post('/lotes/confirmar', [ImportarLotesCamionadasController::class, 'confirmar']);
});

Route::get('/ordenes', function () {
    return response()->json(['message' => 'Listado de órdenes de despacho']);
});

// ==========================
// MUESTRAS LIBRES
// ==========================
Route::prefix('muestras-libres')->group(function () {
    Route::get('/historial', [MuestraLibreController::class, 'historial']);
    Route::get('/', [MuestraLibreController::class, 'index']);
    Route::post('/', [MuestraLibreController::class, 'store']);
    Route::put('/{id}/completar', [MuestraLibreController::class, 'completarAnalisis']);
    Route::delete('/{id}', [MuestraLibreController::class, 'destroy']);
});

// ==========================
// CAMIONES (Tabla local)
// ==========================
Route::prefix('camiones')->group(function () {
    Route::get('/', [CamionController::class, 'index']);
    Route::post('/', [CamionController::class, 'store']);
    Route::put('/{id}', [CamionController::class, 'update']);
    Route::delete('/{id}', [CamionController::class, 'destroy']);
});

// ==========================
// TONELAJE POR MÁQUINA
// ==========================
Route::prefix('tonelaje-maquinas')->group(function () {
    // Listar máquinas con su tonelaje configurado
    Route::get('/', [TonelajeMaquinaController::class, 'index']);

    // Configurar tonelaje para una máquina
    Route::post('/', [TonelajeMaquinaController::class, 'store']);

    // Obtener tonelaje de una máquina específica
    Route::get('/{idMaquina}', [TonelajeMaquinaController::class, 'show']);

    // Eliminar configuración (vuelve a usar default)
    Route::delete('/{id}', [TonelajeMaquinaController::class, 'destroy']);
});