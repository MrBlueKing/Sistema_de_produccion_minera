<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rutas de Laboratorio
| Prefijo: /api/laboratorio
|--------------------------------------------------------------------------
*/

Route::get('/muestras', function () {
    return response()->json(['message' => 'Listado de muestras de laboratorio']);
});

