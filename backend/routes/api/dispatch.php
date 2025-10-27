<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rutas de Dispatch
| Prefijo: /api/dispatch
|--------------------------------------------------------------------------
*/

Route::get('/ordenes', function () {
    return response()->json(['message' => 'Listado de órdenes de despacho']);
});

// Más rutas cuando las implementes...