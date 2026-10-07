<?php

use App\Http\Controllers\Api\RegistroProduccionController;
use App\Http\Controllers\Api\FaenaController;
use App\Http\Controllers\Api\ConfiguracionController;
use App\Http\Controllers\Api\PetroleController;
use App\Http\Controllers\Api\GerencialController;
use App\Http\Controllers\Api\Laboratorio\CertificadoController;
use Illuminate\Support\Facades\Route;

// Ruta de prueba pública
Route::get('/ping', function () {
    return response()->json([
        'status' => 'ok',
        'message' => 'API Sistema de Producción funcionando 🚀',
        'timestamp' => now()->toDateTimeString(),
    ]);
});

// Rutas protegidas
Route::middleware(['validate.token'])->group(function () {

    // Dashboard Gerencial (requiere sesión válida del SAC - módulo "Dashboard Gerencial", rol Gerente)
    Route::prefix('gerencial')->group(function () {
        Route::get('/resumen', [GerencialController::class, 'resumen']);
        Route::get('/faenas', [GerencialController::class, 'faenas']);
        Route::get('/reporte-produccion', [GerencialController::class, 'reporteProduccion']);
        Route::get('/eficiencia', [GerencialController::class, 'eficiencia']);
        Route::get('/lotes', [GerencialController::class, 'buscarLotes']);
        Route::get('/lotes/{id}/reconstruccion', [GerencialController::class, 'reconstruccionLote']);
        Route::get('/analisis-lotes', [GerencialController::class, 'analisisLotes']);
        Route::get('/dumpadas-diarias', [GerencialController::class, 'dumpadasDiarias']);
        Route::get('/dumpadas-detalle', [GerencialController::class, 'dumpadasDetalle']);
        Route::get('/resumen-dumpadas', [GerencialController::class, 'resumenDumpadas']);
        Route::get('/perforacion-tronadura', [GerencialController::class, 'perforacionTronadura']);
        Route::get('/ciclos-dumper', [GerencialController::class, 'ciclosDumper']);
        Route::get('/plan-vs-real', [\App\Http\Controllers\Api\Planificacion\PlanVsRealController::class, 'index']);
        Route::get('/plan-vs-real/dumpadas', [\App\Http\Controllers\Api\Planificacion\PlanVsRealController::class, 'dumpadas']);
        Route::get('/plantas', [GerencialController::class, 'plantas']);
        Route::get('/empresas', [GerencialController::class, 'empresas']);
        Route::get('/certificados-resumen', [GerencialController::class, 'certificadosResumen']);
        // Listado y detalle de certificados (solo lectura, sin generar/descargar PDF)
        // Solo Aprobados: los Pendientes/Rechazados no deben verse en Gerencial.
        Route::get('/certificados', [CertificadoController::class, 'certificadosAprobados']);
        Route::get('/certificados/{numeroCertificado}', [CertificadoController::class, 'dumpadasPorCertificado']);
        Route::get('/certificados/{numeroCertificado}/previsualizar', [CertificadoController::class, 'previsualizarPorNumero']);
    });

    //Rutas de registros de prueba de produccion
    Route::get('/registros', [RegistroProduccionController::class, 'index']);
    Route::post('/registros', [RegistroProduccionController::class, 'store']);

    // Rutas para Faenas (desde sistema central)
    Route::get('/faenas', [FaenaController::class, 'index']);
    Route::get('/faenas/{id}', [FaenaController::class, 'show']);

    // Configuraciones del sistema
    Route::get('/configuraciones', [ConfiguracionController::class, 'index']);
    Route::get('/configuraciones/{clave}/faenas', [ConfiguracionController::class, 'getByKey']);
    Route::get('/configuraciones/{clave}', [ConfiguracionController::class, 'show']);
    Route::put('/configuraciones/{clave}', [ConfiguracionController::class, 'update']);

    // Jornadas/turnos (módulo Configuración General). Leer: cualquiera; editar: admin_configuracion.
    Route::get('/jornadas', [\App\Http\Controllers\Api\JornadaController::class, 'index']);
    Route::post('/jornadas', [\App\Http\Controllers\Api\JornadaController::class, 'store']);
    Route::put('/jornadas/orden', [\App\Http\Controllers\Api\JornadaController::class, 'ordenar']);
    Route::put('/jornadas/{id}', [\App\Http\Controllers\Api\JornadaController::class, 'update']);

    // Programa de producción mensual (tile Planificación). Leer: cualquiera; cambiar: PlanificadorProduccion.
    Route::prefix('planificacion')->group(function () {
        Route::get('/planes', [\App\Http\Controllers\Api\Planificacion\PlanProduccionController::class, 'show']);
        Route::post('/planes', [\App\Http\Controllers\Api\Planificacion\PlanProduccionController::class, 'store']);
        Route::put('/planes/{id}', [\App\Http\Controllers\Api\Planificacion\PlanProduccionController::class, 'update']);
        Route::post('/planes/{id}/publicar', [\App\Http\Controllers\Api\Planificacion\PlanProduccionController::class, 'publicar']);
        Route::post('/planes/{id}/reabrir', [\App\Http\Controllers\Api\Planificacion\PlanProduccionController::class, 'reabrir']);
        Route::delete('/planes/{id}', [\App\Http\Controllers\Api\Planificacion\PlanProduccionController::class, 'destroy']);
    });

    // Integración con Sistema de Petróleo
    Route::prefix('petroleo')->group(function () {
        Route::get('/maquinas', [PetroleController::class, 'maquinas']);
    });

    // ========================================
    // CARGAR RUTAS DE SUB-MÓDULOS
    // ========================================

    // Sub-módulo: Ingeniería
    Route::prefix('ingenieria')->group(function () {
        require __DIR__ . '/api/ingenieria.php';
    });

    // Sub-módulo: Dispatch
    Route::prefix('dispatch')->group(function () {
        require __DIR__ . '/api/dispatch.php';
    });

    // Sub-módulo: Laboratorio
    Route::prefix('laboratorio')->group(function () {
        require __DIR__ . '/api/laboratorio.php';
    });

    // Sub-módulo: Explosivos (Inventario de Polvorín)
    Route::prefix('explosivos')->group(function () {
        require __DIR__ . '/api/explosivos.php';
    });
});
