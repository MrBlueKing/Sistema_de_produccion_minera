<?php

namespace App\Http\Controllers\Api\Ingenieria;

use App\Http\Controllers\Controller;
use App\Models\Ingenieria\SeguimientoEstadoFrente;
use App\Models\Ingenieria\FrenteTrabajo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SeguimientoEstadoFrenteController extends Controller
{
    public function index(Request $request)
    {
        $perPage  = $request->get('per_page', 15);
        $frenteId = $request->get('frente_trabajo_id');
        $faenaId  = $request->get('id_faena');

        $query = SeguimientoEstadoFrente::with([
            'frenteTrabajo.tipoFrente',
        ])->orderBy('created_at', 'desc');

        if ($frenteId) {
            $query->where('frente_trabajo_id', $frenteId);
        }

        // Filtrar por faena a través del frente de trabajo
        if ($faenaId) {
            if (strpos($faenaId, ',') !== false) {
                $faenas = array_map('trim', explode(',', $faenaId));
                $query->whereHas('frenteTrabajo', fn($q) => $q->whereIn('id_faena', $faenas));
            } else {
                $query->whereHas('frenteTrabajo', fn($q) => $q->where('id_faena', $faenaId));
            }
        }

        $total  = $query->count();
        $items  = $query->paginate($perPage);

        return response()->json([
            'data'         => $items->items(),
            'total'        => $total,
            'current_page' => $items->currentPage(),
            'last_page'    => $items->lastPage(),
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'frente_trabajo_id'     => 'required|exists:frentes_trabajo,id',
            'ventilacion'           => 'required|integer|min:1|max:5',
            'estabilidad'           => 'required|in:FC,PM,AC,CH,FO',
            'duracion_estimada'     => 'required|integer|min:1',
            'fecha_inicio_estimada' => 'required|date',
            'fecha_inicio_real'     => 'nullable|date',
            'observaciones'         => 'nullable|string|max:1000',
            'registrado_por'        => 'required|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $seguimiento = SeguimientoEstadoFrente::create($validator->validated());
        $seguimiento->load('frenteTrabajo.tipoFrente');

        return response()->json(['data' => $seguimiento], 201);
    }

    public function show($id)
    {
        $seguimiento = SeguimientoEstadoFrente::with('frenteTrabajo.tipoFrente')->findOrFail($id);
        return response()->json(['data' => $seguimiento]);
    }

    public function update(Request $request, $id)
    {
        $seguimiento = SeguimientoEstadoFrente::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'ventilacion'           => 'sometimes|integer|min:1|max:5',
            'estabilidad'           => 'sometimes|in:FC,PM,AC,CH,FO',
            'duracion_estimada'     => 'sometimes|integer|min:1',
            'fecha_inicio_estimada' => 'sometimes|date',
            'fecha_inicio_real'     => 'nullable|date',
            'observaciones'         => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $seguimiento->update($validator->validated());
        $seguimiento->load('frenteTrabajo.tipoFrente');

        return response()->json(['data' => $seguimiento]);
    }

    public function marcarInicio(Request $request, $id)
    {
        $seguimiento = SeguimientoEstadoFrente::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'fecha_inicio_real' => 'required|date',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $seguimiento->update(['fecha_inicio_real' => $request->fecha_inicio_real]);

        return response()->json([
            'data'    => $seguimiento->fresh(),
            'message' => 'Inicio real registrado correctamente.',
        ]);
    }

    public function destroy($id)
    {
        $seguimiento = SeguimientoEstadoFrente::findOrFail($id);
        $seguimiento->delete();

        return response()->json(['message' => 'Registro eliminado.']);
    }

    // Estadísticas para el gráfico estimado vs real
    public function estadisticas(Request $request)
    {
        $faenaId = $request->get('id_faena');

        $query = SeguimientoEstadoFrente::with('frenteTrabajo')
            ->whereNotNull('fecha_inicio_real');

        if ($faenaId) {
            if (strpos($faenaId, ',') !== false) {
                $faenas = array_map('trim', explode(',', $faenaId));
                $query->whereHas('frenteTrabajo', fn($q) => $q->whereIn('id_faena', $faenas));
            } else {
                $query->whereHas('frenteTrabajo', fn($q) => $q->where('id_faena', $faenaId));
            }
        }

        $registros = $query->get()->map(function ($s) {
            return [
                'id'                    => $s->id,
                'frente'                => $s->frenteTrabajo->codigo_completo ?? "Frente #{$s->frente_trabajo_id}",
                'fecha_inicio_estimada' => $s->fecha_inicio_estimada->toDateString(),
                'fecha_inicio_real'     => $s->fecha_inicio_real->toDateString(),
                'desvio'                => $s->desvio,
                'duracion_estimada'     => $s->duracion_estimada,
            ];
        });

        return response()->json(['data' => $registros]);
    }
}
