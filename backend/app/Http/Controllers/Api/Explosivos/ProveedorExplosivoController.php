<?php

namespace App\Http\Controllers\Api\Explosivos;

use App\Http\Controllers\Controller;
use App\Models\Explosivos\ProveedorExplosivo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Exception;

class ProveedorExplosivoController extends Controller
{
    use \App\Traits\MultiTenancy;

    public function index(Request $request)
    {
        $query = ProveedorExplosivo::query();

        $this->aplicarFiltroFaena($query, $request);

        if ($request->has('activo')) {
            $query->where('activo', $request->activo === 'true' || $request->activo === '1');
        }

        $proveedores = $query->orderBy('nombre')->get();

        return response()->json($proveedores);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:200',
            'rut' => 'nullable|string|max:20',
            'direccion' => 'nullable|string|max:300',
            'telefono' => 'nullable|string|max:50',
            'contacto' => 'nullable|string|max:150',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $proveedor = ProveedorExplosivo::create([
                'nombre' => $request->nombre,
                'rut' => $request->rut,
                'direccion' => $request->direccion,
                'telefono' => $request->telefono,
                'contacto' => $request->contacto,
                'id_faena' => $this->getFaenaParaAsignar($request, $request->id_faena),
            ]);

            return response()->json([
                'mensaje' => 'Proveedor creado exitosamente',
                'proveedor' => $proveedor
            ], 201);
        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al crear el proveedor',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    public function show($id)
    {
        $proveedor = ProveedorExplosivo::find($id);

        if (!$proveedor) {
            return response()->json(['error' => 'Proveedor no encontrado'], 404);
        }

        return response()->json($proveedor);
    }

    public function update(Request $request, $id)
    {
        $proveedor = ProveedorExplosivo::find($id);

        if (!$proveedor) {
            return response()->json(['error' => 'Proveedor no encontrado'], 404);
        }

        $validator = Validator::make($request->all(), [
            'nombre' => 'sometimes|string|max:200',
            'rut' => 'nullable|string|max:20',
            'direccion' => 'nullable|string|max:300',
            'telefono' => 'nullable|string|max:50',
            'contacto' => 'nullable|string|max:150',
            'activo' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $proveedor->update($request->only(['nombre', 'rut', 'direccion', 'telefono', 'contacto', 'activo']));

            return response()->json([
                'mensaje' => 'Proveedor actualizado',
                'proveedor' => $proveedor
            ]);
        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    public function destroy($id)
    {
        $proveedor = ProveedorExplosivo::find($id);

        if (!$proveedor) {
            return response()->json(['error' => 'Proveedor no encontrado'], 404);
        }

        $proveedor->delete();

        return response()->json(['mensaje' => 'Proveedor eliminado']);
    }
}
