<?php

use App\Http\Controllers\Api\RegistroProduccionController;
use App\Http\Controllers\Api\FaenaController;
use App\Http\Controllers\Api\ConfiguracionController;
use App\Http\Controllers\Api\PetroleController;
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
