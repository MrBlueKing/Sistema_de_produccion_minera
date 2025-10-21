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
    
    Route::get('/registros', [RegistroProduccionController::class, 'index']);
    Route::post('/registros', [RegistroProduccionController::class, 'store']);
    
});