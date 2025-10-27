<?php

use App\Http\Controllers\Api\RegistroProduccionController;
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
});
