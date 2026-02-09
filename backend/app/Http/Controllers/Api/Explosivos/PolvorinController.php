<?php

namespace App\Http\Controllers\Api\Explosivos;

use App\Http\Controllers\Controller;
use App\Models\Explosivos\Polvorin;
use App\Traits\MultiTenancy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Exception;

class PolvorinController extends Controller
{
    use MultiTenancy;

    /**
     * GET /api/explosivos/polvorines
     * Listar polvorines
     */
    public function index(Request $request)
    {
        $query = Polvorin::query();

        $this->aplicarFiltroFaena($query, $request);

        if ($request->has('activo')) {
            $query->where('activo', $request->activo === 'true' || $request->activo === '1');
        }

        $polvorines = $query->orderBy('nombre')->get();

        // Agregar info de stock total
        $polvorines->each(function ($polvorin) {
            $polvorin->stock_total_kg = $polvorin->getStockTotal();
        });

        return response()->json($polvorines);
    }

    /**
     * POST /api/explosivos/polvorines
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:150',
            'ubicacion' => 'nullable|string|max:255',
            'capacidad_maxima_kg' => 'nullable|numeric|min:0',
            'responsable' => 'nullable|string|max:150',
            'telefono_responsable' => 'nullable|string|max:50',
            'id_faena' => 'required|integer',
            'observaciones' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        // Verificar que la faena no tenga ya un polvorín
        $existente = Polvorin::where('id_faena', $request->id_faena)->first();
        if ($existente) {
            return response()->json([
                'error' => 'Ya existe un polvorín para esta faena',
                'polvorin_existente' => $existente
            ], 422);
        }

        try {
            $polvorin = Polvorin::create([
                'codigo' => Polvorin::generarCodigo($request->id_faena),
                'nombre' => $request->nombre,
                'ubicacion' => $request->ubicacion,
                'capacidad_maxima_kg' => $request->capacidad_maxima_kg,
                'responsable' => $request->responsable,
                'telefono_responsable' => $request->telefono_responsable,
                'id_faena' => $request->id_faena,
                'observaciones' => $request->observaciones,
                'activo' => true,
            ]);

            return response()->json([
                'mensaje' => 'Polvorín creado exitosamente',
                'polvorin' => $polvorin
            ], 201);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al crear el polvorín',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/explosivos/polvorines/{id}
     */
    public function show($id)
    {
        $polvorin = Polvorin::with([
            'stocks.tipoExplosivo:id,codigo,nombre,unidad_medida',
            'lotesActivos:id,numero_lote,id_tipo_explosivo,id_polvorin,cantidad_actual,fecha_vencimiento'
        ])->find($id);

        if (!$polvorin) {
            return response()->json(['error' => 'Polvorín no encontrado'], 404);
        }

        $polvorin->stock_total_kg = $polvorin->getStockTotal();
        $polvorin->lotes_proximos_vencer = $polvorin->getLotesProximosVencer();
        $polvorin->lotes_vencidos = $polvorin->getLotesVencidos();

        return response()->json($polvorin);
    }

    /**
     * PUT /api/explosivos/polvorines/{id}
     */
    public function update(Request $request, $id)
    {
        $polvorin = Polvorin::find($id);

        if (!$polvorin) {
            return response()->json(['error' => 'Polvorín no encontrado'], 404);
        }

        $validator = Validator::make($request->all(), [
            'nombre' => 'sometimes|string|max:150',
            'ubicacion' => 'nullable|string|max:255',
            'capacidad_maxima_kg' => 'nullable|numeric|min:0',
            'responsable' => 'nullable|string|max:150',
            'telefono_responsable' => 'nullable|string|max:50',
            'observaciones' => 'nullable|string',
            'activo' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $polvorin->update($request->only([
                'nombre', 'ubicacion', 'capacidad_maxima_kg',
                'responsable', 'telefono_responsable', 'observaciones', 'activo'
            ]));

            return response()->json([
                'mensaje' => 'Polvorín actualizado',
                'polvorin' => $polvorin
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/explosivos/polvorines/por-faena/{idFaena}
     * Obtener el polvorín de una faena específica
     */
    public function porFaena($idFaena)
    {
        $polvorin = Polvorin::where('id_faena', $idFaena)
            ->with('stocks.tipoExplosivo:id,codigo,nombre,unidad_medida')
            ->first();

        if (!$polvorin) {
            return response()->json([
                'mensaje' => 'No hay polvorín configurado para esta faena',
                'polvorin' => null
            ]);
        }

        $polvorin->stock_total_kg = $polvorin->getStockTotal();

        return response()->json($polvorin);
    }

    /**
     * GET /api/explosivos/polvorines/{id}/alertas
     * Obtener alertas del polvorín (vencimientos, stock bajo)
     */
    public function alertas($id)
    {
        $polvorin = Polvorin::find($id);

        if (!$polvorin) {
            return response()->json(['error' => 'Polvorín no encontrado'], 404);
        }

        $alertas = [
            'lotes_proximos_vencer' => $polvorin->getLotesProximosVencer(),
            'lotes_vencidos' => $polvorin->getLotesVencidos(),
            'stock_bajo_minimo' => $polvorin->stocks()
                ->with('tipoExplosivo:id,codigo,nombre,stock_minimo,unidad_medida')
                ->get()
                ->filter(function ($stock) {
                    return $stock->esta_bajo_minimo;
                })
                ->values(),
        ];

        return response()->json($alertas);
    }
}
