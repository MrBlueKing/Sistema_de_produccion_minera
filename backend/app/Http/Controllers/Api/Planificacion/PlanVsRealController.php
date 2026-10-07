<?php

namespace App\Http\Controllers\Api\Planificacion;

use App\Http\Controllers\Controller;
use App\Models\Planificacion\PlanProduccion;
use App\Services\Planificacion\PlanVsRealService;
use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * Pestaña "Plan vs Real" de Operaciones (Dashboard Gerencial).
 *
 * Devuelve por faena el plan PUBLICADO del mes y lo real sin procesar (dumpadas y
 * tronaduras por frente/día/turno); el frontend arma los KPIs, gráficos y tablas
 * con eso, igual que Avance Diario. Un plan en borrador no se compara: se avisa.
 */
class PlanVsRealController extends Controller
{
    public function __construct(private PlanVsRealService $real)
    {
    }

    /** GET /api/gerencial/plan-vs-real?id_faena=1,2&anio=2026&mes=10 */
    public function index(Request $request)
    {
        $request->validate([
            'id_faena' => 'required|string',
            'anio'     => 'required|integer|min:2024|max:2100',
            'mes'      => 'required|integer|min:1|max:12',
        ]);
        $anio = (int) $request->anio;
        $mes = (int) $request->mes;
        $faenas = collect(explode(',', $request->id_faena))->map(fn ($f) => (int) trim($f))->filter()->unique()->values();

        $data = $faenas->map(function (int $idFaena) use ($anio, $mes) {
            $plan = PlanProduccion::where(['id_faena' => $idFaena, 'anio' => $anio, 'mes' => $mes])->first();
            $publicado = $plan?->estaPublicado();

            return [
                'id_faena'     => $idFaena,
                'estado_plan'  => $plan ? $plan->estado : null,
                'plan'         => $publicado ? $this->plan($plan->load(['dias', 'frentes.celdas', 'frentes.frenteTrabajo:id,codigo_completo', 'rutas'])) : null,
                'dumpadas'     => $this->real->dumpadas($idFaena, $anio, $mes),
                'tronaduras'   => $this->real->tronaduras($idFaena, $anio, $mes),
                'referencia'   => $this->real->referenciaMesAnterior($idFaena, $anio, $mes),
            ];
        });

        $hoy = Carbon::today();
        $diasMes = Carbon::create($anio, $mes, 1)->daysInMonth;

        return response()->json([
            'success' => true,
            'data'    => [
                'anio'     => $anio,
                'mes'      => $mes,
                'dias_mes' => $diasMes,
                // Último día que se compara por defecto: ayer si es el mes en curso
                // (el día de hoy todavía se está ingresando), el mes entero si ya pasó.
                'corte_sugerido' => $hoy->year === $anio && $hoy->month === $mes
                    ? max(1, $hoy->day - 1)
                    : ($hoy->lt(Carbon::create($anio, $mes, 1)) ? 0 : $diasMes),
                'faenas'   => $data,
            ],
        ]);
    }

    /**
     * GET /api/gerencial/plan-vs-real/dumpadas?id_faena=1&fecha=2026-10-01&id_frente_trabajo=142&mineral=1
     * Las dumpadas de un frente en un día (detalle de una fila de la tabla).
     */
    public function dumpadas(Request $request)
    {
        $request->validate([
            'id_faena'          => 'required|integer',
            'fecha'             => 'required|date',
            'id_frente_trabajo' => 'nullable|integer',
            'mineral'           => 'required|boolean',
        ]);

        return response()->json([
            'success' => true,
            'data'    => $this->real->dumpadasDelDia(
                (int) $request->id_faena,
                Carbon::parse($request->fecha)->format('Y-m-d'),
                $request->filled('id_frente_trabajo') ? (int) $request->id_frente_trabajo : null,
                $request->boolean('mineral'),
            ),
        ]);
    }

    private function plan(PlanProduccion $plan): array
    {
        return [
            'id'                        => $plan->id,
            'publicado_en'              => $plan->publicado_en?->format('Y-m-d H:i'),
            'publicado_por'             => $plan->publicado_por,
            'ton_por_disparo'           => $plan->ton_por_disparo,
            'tronaduras_por_perforista' => $plan->tronaduras_por_perforista,
            'dias'    => app(PlanProduccionController::class)->diasConTurnos($plan),
            'frentes' => $plan->frentes->map(fn ($f) => [
                'id_frente_trabajo' => $f->id_frente_trabajo,
                'frente'            => $f->frenteTrabajo?->codigo_completo,
                'actividad'         => $f->actividad,
                'mineral'           => PlanProduccion::esMineral($f->actividad),
                'ley_esperada'      => $f->ley_esperada,
                'celdas'            => $f->celdas->map(fn ($c) => ['dia' => $c->dia, 'turno' => $c->turno, 'toneladas' => $c->toneladas])->values(),
            ])->values(),
            'rutas'   => $plan->rutas->map(fn ($r) => $r->only(['nombre', 'ciclo_min', 'dumpers', 'peso_ton', 'horas', 'cuenta_capacidad']))->values(),
        ];
    }
}
