<?php

use App\Http\Controllers\Api\Explosivos\CategoriaExplosivoController;
use App\Http\Controllers\Api\Explosivos\TipoExplosivoController;
use App\Http\Controllers\Api\Explosivos\PolvorinController;
use App\Http\Controllers\Api\Explosivos\LoteExplosivoController;
use App\Http\Controllers\Api\Explosivos\StockExplosivoController;
use App\Http\Controllers\Api\Explosivos\MovimientoExplosivoController;
use App\Http\Controllers\Api\Explosivos\PersonalAutorizadoController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rutas de Explosivos (Inventario de Polvorín)
| Prefijo: /api/explosivos
|--------------------------------------------------------------------------
*/

// CATEGORÍAS DE EXPLOSIVOS
Route::prefix('categorias')->group(function () {
    Route::get('/', [CategoriaExplosivoController::class, 'index']);
    Route::post('/', [CategoriaExplosivoController::class, 'store']);
    Route::get('/{id}', [CategoriaExplosivoController::class, 'show']);
    Route::put('/{id}', [CategoriaExplosivoController::class, 'update']);
    Route::delete('/{id}', [CategoriaExplosivoController::class, 'destroy']);
});

// TIPOS DE EXPLOSIVOS (Catálogo)
Route::prefix('tipos')->group(function () {
    Route::get('/', [TipoExplosivoController::class, 'index']);
    Route::post('/', [TipoExplosivoController::class, 'store']);
    Route::get('/{id}', [TipoExplosivoController::class, 'show']);
    Route::put('/{id}', [TipoExplosivoController::class, 'update']);
    Route::delete('/{id}', [TipoExplosivoController::class, 'destroy']);
});

// POLVORINES (Ubicaciones de almacenamiento)
Route::prefix('polvorines')->group(function () {
    Route::get('/', [PolvorinController::class, 'index']);
    Route::post('/', [PolvorinController::class, 'store']);
    Route::get('/por-faena/{idFaena}', [PolvorinController::class, 'porFaena']);
    Route::get('/{id}', [PolvorinController::class, 'show']);
    Route::put('/{id}', [PolvorinController::class, 'update']);
    Route::get('/{id}/alertas', [PolvorinController::class, 'alertas']);
});

// LOTES DE EXPLOSIVOS (Trazabilidad)
Route::prefix('lotes')->group(function () {
    Route::get('/', [LoteExplosivoController::class, 'index']);
    Route::get('/disponibles', [LoteExplosivoController::class, 'disponibles']);
    Route::post('/', [LoteExplosivoController::class, 'store']);
    Route::get('/{id}', [LoteExplosivoController::class, 'show']);
    Route::put('/{id}', [LoteExplosivoController::class, 'update']);
    Route::post('/{id}/marcar-vencido', [LoteExplosivoController::class, 'marcarVencido']);
});

// STOCK DE EXPLOSIVOS
Route::prefix('stock')->group(function () {
    Route::get('/', [StockExplosivoController::class, 'index']);
    Route::get('/resumen', [StockExplosivoController::class, 'resumen']);
    Route::get('/alertas', [StockExplosivoController::class, 'alertas']);
    Route::get('/por-tipo/{idTipoExplosivo}', [StockExplosivoController::class, 'porTipo']);
});

// MOVIMIENTOS DE EXPLOSIVOS
Route::prefix('movimientos')->group(function () {
    Route::get('/', [MovimientoExplosivoController::class, 'index']);
    Route::get('/reporte', [MovimientoExplosivoController::class, 'reporte']);
    Route::get('/por-tronadura/{idTronadura}', [MovimientoExplosivoController::class, 'porTronadura']);
    Route::post('/entrada', [MovimientoExplosivoController::class, 'registrarEntrada']);
    Route::post('/salida', [MovimientoExplosivoController::class, 'registrarSalida']);
    Route::post('/salida-multiple', [MovimientoExplosivoController::class, 'registrarSalidaMultiple']);
    Route::post('/ajuste', [MovimientoExplosivoController::class, 'registrarAjuste']);
    Route::get('/{id}', [MovimientoExplosivoController::class, 'show']);
});

// PERSONAL AUTORIZADO PARA SOLICITAR EXPLOSIVOS
Route::prefix('personal-autorizado')->group(function () {
    Route::get('/', [PersonalAutorizadoController::class, 'index']);
    Route::get('/disponible', [PersonalAutorizadoController::class, 'disponible']);
    Route::post('/', [PersonalAutorizadoController::class, 'store']);
    Route::delete('/{id}', [PersonalAutorizadoController::class, 'destroy']);
    Route::put('/{id}/reactivar', [PersonalAutorizadoController::class, 'reactivar']);
});
