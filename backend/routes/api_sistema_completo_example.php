<?php

/**
 * RUTAS API COMPLETAS - SISTEMA DE MEZCLAS Y LOTES DE VENTA
 * Agregar estas rutas a routes/api.php
 */

use App\Http\Controllers\Api\Laboratorio\MezclaController;
use App\Http\Controllers\Api\Laboratorio\LoteVentaController;

// ==========================
// GRUPO: MEZCLAS
// ==========================
Route::prefix('mezclas')->group(function () {

    // Listar todas las mezclas (con filtros opcionales)
    // GET /api/mezclas?fecha_desde=2025-01-01&fecha_hasta=2025-12-31&estado=Completado
    Route::get('/', [MezclaController::class, 'index']);

    // Obtener dumpadas disponibles (no asignadas a mezclas)
    // GET /api/mezclas/dumpadas-disponibles?fecha_desde=2025-11-01
    Route::get('/dumpadas-disponibles', [MezclaController::class, 'dumpadasDisponibles']);

    // Crear nueva mezcla
    // POST /api/mezclas
    Route::post('/', [MezclaController::class, 'store']);

    // Obtener mezcla específica
    // GET /api/mezclas/{id}
    Route::get('/{id}', [MezclaController::class, 'show']);

    // Actualizar mezcla
    // PUT /api/mezclas/{id}
    Route::put('/{id}', [MezclaController::class, 'update']);

    // Eliminar mezcla
    // DELETE /api/mezclas/{id}
    Route::delete('/{id}', [MezclaController::class, 'destroy']);

    // Actualizar ley de laboratorio
    // POST /api/mezclas/{id}/ley-laboratorio
    Route::post('/{id}/ley-laboratorio', [MezclaController::class, 'actualizarLeyLaboratorio']);

    // Agregar dumpadas a mezcla existente
    // POST /api/mezclas/{id}/agregar-dumpadas
    Route::post('/{id}/agregar-dumpadas', [MezclaController::class, 'agregarDumpadas']);

    // Agregar remanente manual a mezcla
    // POST /api/mezclas/{id}/agregar-remanente
    Route::post('/{id}/agregar-remanente', [MezclaController::class, 'agregarRemanente']);

    // Eliminar detalle (dumpada o remanente) de mezcla
    // DELETE /api/mezclas/{mezclaId}/detalles/{detalleId}
    Route::delete('/{mezclaId}/detalles/{detalleId}', [MezclaController::class, 'eliminarDetalle']);

    // Generar reporte de mezcla
    // GET /api/mezclas/{id}/reporte
    Route::get('/{id}/reporte', [MezclaController::class, 'reporte']);
});

// ==========================
// GRUPO: LOTES DE VENTA
// ==========================
Route::prefix('lotes-venta')->group(function () {

    // Listar todos los lotes de venta (con filtros opcionales)
    // GET /api/lotes-venta?cliente=MDF&con_remanente=true
    Route::get('/', [LoteVentaController::class, 'index']);

    // Obtener lotes con remanente disponible
    // GET /api/lotes-venta/con-remanente
    Route::get('/con-remanente', [LoteVentaController::class, 'lotesConRemanente']);

    // Crear nuevo lote de venta
    // POST /api/lotes-venta
    Route::post('/', [LoteVentaController::class, 'store']);

    // Obtener lote de venta específico
    // GET /api/lotes-venta/{id}
    Route::get('/{id}', [LoteVentaController::class, 'show']);

    // Actualizar lote de venta
    // PUT /api/lotes-venta/{id}
    Route::put('/{id}', [LoteVentaController::class, 'update']);

    // Eliminar lote de venta
    // DELETE /api/lotes-venta/{id}
    Route::delete('/{id}', [LoteVentaController::class, 'destroy']);

    // Actualizar ley de laboratorio del lote
    // POST /api/lotes-venta/{id}/ley-laboratorio
    Route::post('/{id}/ley-laboratorio', [LoteVentaController::class, 'actualizarLeyLaboratorio']);

    // Agregar remanente de este lote a una mezcla
    // POST /api/lotes-venta/{id}/agregar-a-mezcla
    Route::post('/{id}/agregar-a-mezcla', [LoteVentaController::class, 'agregarRemanenteAMezcla']);

    // Generar reporte de lote de venta
    // GET /api/lotes-venta/{id}/reporte
    Route::get('/{id}/reporte', [LoteVentaController::class, 'reporte']);
});
