<?php

namespace App\Http\Controllers\Api\Explosivos;

use App\Http\Controllers\Controller;
use App\Models\Explosivos\FormulaExplosivo;
use App\Traits\MultiTenancy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Exception;

class FormulaExplosivoController extends Controller
{
    use MultiTenancy;

    /**
     * GET /api/explosivos/formulas
     */
    public function index(Request $request)
    {
        $query = FormulaExplosivo::with([
            'tipoFrente:id,nombre,abreviatura',
            'tipoExplosivo:id,codigo,nombre,unidad_medida',
        ]);

        $this->aplicarFiltroFaena($query, $request);

        $formulas = $query->get();

        // Agrupar por tipo de frente
        $agrupadas = $formulas->groupBy('id_tipo_frente')->map(function ($grupo) {
            return [
                'tipo_frente' => $grupo->first()->tipoFrente,
                'explosivos' => $grupo->map(function ($f) {
                    return [
                        'id' => $f->id,
                        'id_tipo_explosivo' => $f->id_tipo_explosivo,
                        'tipo_explosivo' => $f->tipoExplosivo,
                        'factor' => $f->factor,
                    ];
                })->values(),
            ];
        })->values();

        return response()->json($agrupadas);
    }

    /**
     * POST /api/explosivos/formulas
     */
    public function guardar(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'formulas' => 'required|array',
            'formulas.*.id_tipo_frente' => 'required|exists:tipos_frente,id',
            'formulas.*.id_tipo_explosivo' => 'required|exists:tipos_explosivos,id',
            'formulas.*.factor' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['mensaje' => 'Datos inválidos', 'errores' => $validator->errors()], 422);
        }

        try {
            $idFaena = $this->getFaenaParaFiltrar($request) ?? $request->auth_faena;

            foreach ($request->formulas as $formula) {
                if ($formula['factor'] > 0) {
                    FormulaExplosivo::updateOrCreate(
                        [
                            'id_tipo_frente' => $formula['id_tipo_frente'],
                            'id_tipo_explosivo' => $formula['id_tipo_explosivo'],
                            'id_faena' => $idFaena,
                        ],
                        [
                            'factor' => $formula['factor'],
                        ]
                    );
                } else {
                    // Si el factor es 0, eliminar la fórmula
                    FormulaExplosivo::where('id_tipo_frente', $formula['id_tipo_frente'])
                        ->where('id_tipo_explosivo', $formula['id_tipo_explosivo'])
                        ->where('id_faena', $idFaena)
                        ->delete();
                }
            }

            return response()->json(['mensaje' => 'Fórmulas guardadas correctamente']);
        } catch (Exception $e) {
            return response()->json(['mensaje' => 'Error al guardar fórmulas', 'error' => $e->getMessage()], 500);
        }
    }
}
