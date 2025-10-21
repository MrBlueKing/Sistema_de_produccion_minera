<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RegistroProduccion;
use Illuminate\Http\Request;

class RegistroProduccionController extends Controller
{
    /**
     * Listar todos los registros
     */
    public function index(Request $request)
    {
        $registros = RegistroProduccion::orderBy('fecha', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'registros' => $registros,
            'user' => $request->input('auth_user'), // Del middleware
        ], 200);
    }

    /**
     * Crear un nuevo registro
     */
    public function store(Request $request)
    {
        $request->validate([
            'descripcion' => 'required|string|max:255',
            'cantidad' => 'required|numeric|min:0',
            'fecha' => 'required|date',
        ]);

        $user = $request->input('auth_user'); // Del middleware

        $registro = RegistroProduccion::create([
            'user_id' => $user['id'],
            'descripcion' => $request->descripcion,
            'cantidad' => $request->cantidad,
            'fecha' => $request->fecha,
        ]);

        return response()->json([
            'message' => 'Registro creado exitosamente',
            'registro' => $registro,
        ], 201);
    }
}