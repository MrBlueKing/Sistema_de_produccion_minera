<?php

namespace App\Http\Controllers\Api\Laboratorio;

use App\Http\Controllers\Controller;
use App\Models\Laboratorio\Empresa;
use Illuminate\Http\Request;

class EmpresaController extends Controller
{
    /**
     * Listar todas las empresas activas
     * GET /api/laboratorio/empresas
     */
    public function index(Request $request)
    {
        $query = Empresa::query();

        // Filtrar solo activas si se solicita
        if ($request->has('activas')) {
            $query->activas();
        }

        $empresas = $query->orderBy('nombre')->get();

        return response()->json($empresas);
    }

    /**
     * Obtener una empresa específica
     * GET /api/laboratorio/empresas/{id}
     */
    public function show($id)
    {
        $empresa = Empresa::with(['lotes.planta'])->findOrFail($id);
        return response()->json($empresa);
    }
}
