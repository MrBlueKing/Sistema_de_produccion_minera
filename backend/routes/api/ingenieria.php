<?php

use App\Http\Controllers\Api\Ingenieria\TipoFrenteController;
use App\Http\Controllers\Api\Ingenieria\FrenteTrabajoController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rutas de Ingeniería
| Prefijo: /api/ingenieria
|--------------------------------------------------------------------------
*/

// Tipos de Frente
Route::prefix('tipos-frente')->group(function () {
    Route::get('/', [TipoFrenteController::class, 'index']);
    Route::post('/', [TipoFrenteController::class, 'store']);
    Route::get('/{id}', [TipoFrenteController::class, 'show']);
    Route::put('/{id}', [TipoFrenteController::class, 'update']);
    Route::delete('/{id}', [TipoFrenteController::class, 'destroy']);
});

// Frentes de Trabajo
Route::prefix('frentes-trabajo')->group(function () {
    Route::get('/', [FrenteTrabajoController::class, 'index']);
    Route::post('/', [FrenteTrabajoController::class, 'store']);
    Route::get('/{id}', [FrenteTrabajoController::class, 'show']);
    Route::put('/{id}', [FrenteTrabajoController::class, 'update']);
    Route::delete('/{id}', [FrenteTrabajoController::class, 'destroy']);
});

// Ruta de prueba pública
Route::get('/ping', function () {
    return response()->json([
        'status' => 'ok',
        'message' => 'VAAAAAAAAAAAAAAAAAAAAAA',
        'timestamp' => now()->toDateTimeString(),
    ]);
});
