<?php

use App\Http\Controllers\Api\Dispatch\DumpadaController;
use App\Http\Controllers\Api\Dispatch\RangoController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rutas de Dispatch
| Prefijo: /api/dispatch
|--------------------------------------------------------------------------
*/

// Dumpadas
Route::prefix('dumpadas')->group(function () {
    Route::get('/', [DumpadaController::class, 'index']);
    Route::post('/', [DumpadaController::class, 'store']);
    Route::post('/previsualizar-acopio', [DumpadaController::class, 'previsualizarAcopio']);
    Route::get('/{id}', [DumpadaController::class, 'show']);
    Route::put('/{id}', [DumpadaController::class, 'update']);
    Route::delete('/{id}', [DumpadaController::class, 'destroy']);
});

// Rangos
Route::prefix('rangos')->group(function () {
    Route::get('/', [RangoController::class, 'index']);
    Route::post('/by-ley', [RangoController::class, 'getRangoByLey']);
});

Route::get('/ordenes', function () {
    return response()->json(['message' => 'Listado de órdenes de despacho']);
});