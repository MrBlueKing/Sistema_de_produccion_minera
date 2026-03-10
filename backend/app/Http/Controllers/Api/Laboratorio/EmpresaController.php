<?php

namespace App\Http\Controllers\Api\Laboratorio;

use App\Http\Controllers\Controller;
use App\Models\Laboratorio\Empresa;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

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

    /**
     * Crear una nueva empresa
     * POST /api/laboratorio/empresas
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:150|unique:empresas,nombre',
            'codigo' => 'nullable|string|max:50|unique:empresas,codigo',
            'rut' => 'nullable|string|max:20|unique:empresas,rut',
            'contacto' => 'nullable|string|max:150',
            'telefono' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:150',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        $empresa = Empresa::create($request->all());

        return response()->json([
            'mensaje' => 'Empresa creada exitosamente',
            'empresa' => $empresa
        ], 201);
    }

    /**
     * Actualizar una empresa existente
     * PUT /api/laboratorio/empresas/{id}
     */
    public function update(Request $request, $id)
    {
        $empresa = Empresa::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'nombre' => 'sometimes|string|max:150|unique:empresas,nombre,' . $id,
            'codigo' => 'nullable|string|max:50|unique:empresas,codigo,' . $id,
            'rut' => 'nullable|string|max:20|unique:empresas,rut,' . $id,
            'contacto' => 'nullable|string|max:150',
            'telefono' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:150',
            'activo' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        $empresa->update($request->all());

        return response()->json([
            'mensaje' => 'Empresa actualizada exitosamente',
            'empresa' => $empresa
        ]);
    }

    /**
     * Eliminar una empresa
     * DELETE /api/laboratorio/empresas/{id}
     */
    public function destroy($id)
    {
        $empresa = Empresa::findOrFail($id);

        if ($empresa->lotes()->exists()) {
            return response()->json([
                'error' => 'No se puede eliminar',
                'mensaje' => 'La empresa tiene lotes asociados'
            ], 400);
        }

        $empresa->delete();

        return response()->json([
            'mensaje' => 'Empresa eliminada exitosamente'
        ]);
    }
}
