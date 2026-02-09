<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Dispatch\Dumpada;
use App\Models\ZonaTerreno;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class MapaTerrenoController extends Controller
{
    /**
     * Obtener vista completa del mapa (zonas + dumpadas con posiciones)
     * GET /api/mapa-terreno
     */
    public function index()
    {
        $zonas = ZonaTerreno::activas()
            ->with(['dumpadas' => function($query) {
                $query->select('id', 'n_acop', 'acopios', 'estado', 'posicion_x', 'posicion_y', 'zona_id', 'ley', 'ton');
            }])
            ->get();

        $dumpadasSinZona = Dumpada::whereNull('zona_id')
            ->whereNotNull('posicion_x')
            ->whereNotNull('posicion_y')
            ->select('id', 'n_acop', 'acopios', 'estado', 'posicion_x', 'posicion_y', 'ley', 'ton')
            ->get();

        return response()->json([
            'zonas' => $zonas,
            'dumpadas_sin_zona' => $dumpadasSinZona,
        ]);
    }

    /**
     * Actualizar posición de una dumpada
     * PUT /api/mapa-terreno/dumpadas/{id}/posicion
     */
    public function actualizarPosicionDumpada(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'posicion_x' => 'nullable|numeric',  // Permitir null para quitar del mapa
            'posicion_y' => 'nullable|numeric',  // Permitir null para quitar del mapa
            'zona_id' => 'nullable|exists:zonas_terreno,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        $dumpada = Dumpada::find($id);

        if (!$dumpada) {
            return response()->json(['error' => 'Dumpada no encontrada'], 404);
        }

        $dumpada->update([
            'posicion_x' => $request->posicion_x,
            'posicion_y' => $request->posicion_y,
            'zona_id' => $request->zona_id,
        ]);

        return response()->json([
            'mensaje' => 'Posición actualizada',
            'dumpada' => $dumpada
        ]);
    }

    /**
     * Listar todas las zonas
     * GET /api/mapa-terreno/zonas
     */
    public function listarZonas()
    {
        $zonas = ZonaTerreno::activas()->get();
        return response()->json($zonas);
    }

    /**
     * Crear nueva zona
     * POST /api/mapa-terreno/zonas
     */
    public function crearZona(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:100',
            'color' => 'nullable|string|max:7',
            'coordenadas' => 'nullable|array',
            'descripcion' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        $zona = ZonaTerreno::create($request->all());

        return response()->json([
            'mensaje' => 'Zona creada',
            'zona' => $zona
        ], 201);
    }

    /**
     * Actualizar zona
     * PUT /api/mapa-terreno/zonas/{id}
     */
    public function actualizarZona(Request $request, $id)
    {
        $zona = ZonaTerreno::find($id);

        if (!$zona) {
            return response()->json(['error' => 'Zona no encontrada'], 404);
        }

        $zona->update($request->only(['nombre', 'color', 'coordenadas', 'descripcion', 'activa']));

        return response()->json([
            'mensaje' => 'Zona actualizada',
            'zona' => $zona
        ]);
    }

    /**
     * Eliminar zona
     * DELETE /api/mapa-terreno/zonas/{id}
     */
    public function eliminarZona($id)
    {
        $zona = ZonaTerreno::find($id);

        if (!$zona) {
            return response()->json(['error' => 'Zona no encontrada'], 404);
        }

        // Quitar zona_id de dumpadas asociadas
        Dumpada::where('zona_id', $id)->update(['zona_id' => null]);

        $zona->delete();

        return response()->json(['mensaje' => 'Zona eliminada']);
    }
}
