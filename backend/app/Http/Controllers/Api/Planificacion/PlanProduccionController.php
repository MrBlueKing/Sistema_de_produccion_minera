<?php

namespace App\Http\Controllers\Api\Planificacion;

use App\Http\Controllers\Controller;
use App\Models\Ingenieria\FrenteTrabajo;
use App\Models\Planificacion\PlanProduccion;
use App\Models\Planificacion\PlanProduccionAuditoria;
use App\Models\Planificacion\PlanProduccionCelda;
use App\Models\Planificacion\PlanProduccionDia;
use App\Models\Planificacion\PlanProduccionFrente;
use App\Models\Planificacion\PlanProduccionRuta;
use App\Services\Planificacion\ComparadorPlan;
use App\Services\Planificacion\PlanVsRealService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Programa de producción mensual (tile "Planificación" del Dashboard Gerencial).
 *
 * Leer: cualquier sesión válida (Plan vs Real lo usa Gerencia).
 * Crear / editar / publicar / reabrir: rol SAC `PlanificadorProduccion`.
 * Publicado = bloqueado. Reabrir exige motivo y guarda una foto del plan publicado.
 */
class PlanProduccionController extends Controller
{
    public const ROL = 'PlanificadorProduccion';

    public function __construct(private PlanVsRealService $real)
    {
    }

    /**
     * GET /api/planificacion/planes?id_faena=&anio=&mes=
     * El plan de ese mes (o null) + lo que la pantalla necesita para armarlo.
     */
    public function show(Request $request)
    {
        $request->validate([
            'id_faena' => 'required|integer',
            'anio'     => 'required|integer|min:2024|max:2100',
            'mes'      => 'required|integer|min:1|max:12',
        ]);
        $idFaena = (int) $request->id_faena;
        $anio = (int) $request->anio;
        $mes = (int) $request->mes;

        $plan = PlanProduccion::where(compact('anio', 'mes') + ['id_faena' => $idFaena])->first();

        return response()->json([
            'success' => true,
            'data'    => [
                'plan'                => $plan ? $this->serializar($plan->cargarCompleto()) : null,
                'referencia'          => $this->real->referenciaMesAnterior($idFaena, $anio, $mes),
                // Ley real de cada frente el mes anterior: sugerencia para "ley esperada"
                'leyes_mes_anterior'  => (object) $this->real->leyesMes($idFaena, ...$this->mesAnterior($anio, $mes))->all(),
                'frentes_disponibles' => $this->frentesDisponibles($idFaena),
                'turnos'              => PlanProduccion::turnosDisponibles(),
                'dias_mes'            => Carbon::create($anio, $mes, 1)->daysInMonth,
                'puede_editar'        => $this->tieneRol($request),
            ],
        ]);
    }

    /**
     * POST /api/planificacion/planes { id_faena, anio, mes }
     * Crea el borrador: días de lunes a viernes hábiles, fines de semana libres.
     * Copia los supuestos y las rutas del último plan de la faena, si hay.
     */
    public function store(Request $request)
    {
        if (!$this->tieneRol($request)) {
            return $this->sinPermiso();
        }
        $datos = $request->validate([
            'id_faena' => 'required|integer',
            'anio'     => 'required|integer|min:2024|max:2100',
            'mes'      => 'required|integer|min:1|max:12',
        ]);

        if (PlanProduccion::where($datos)->exists()) {
            return response()->json(['success' => false, 'message' => 'Ya existe un plan para esa faena y mes.'], 422);
        }

        $anterior = PlanProduccion::with('rutas')
            ->where('id_faena', $datos['id_faena'])
            ->where(fn ($q) => $q->where('anio', '<', $datos['anio'])
                ->orWhere(fn ($q2) => $q2->where('anio', $datos['anio'])->where('mes', '<', $datos['mes'])))
            ->orderByDesc('anio')->orderByDesc('mes')
            ->first();

        $plan = DB::transaction(function () use ($datos, $anterior, $request) {
            $plan = PlanProduccion::create($datos + [
                'estado'                    => PlanProduccion::BORRADOR,
                'ton_por_disparo'           => $anterior?->ton_por_disparo,
                'tronaduras_por_perforista' => $anterior?->tronaduras_por_perforista ?? 2,
                'creado_por_id'             => $request->auth_user_id,
                'creado_por'                => $this->usuario($request),
            ]);

            $inicio = Carbon::create($datos['anio'], $datos['mes'], 1);
            for ($d = 1; $d <= $inicio->daysInMonth; $d++) {
                $finde = $inicio->copy()->day($d)->isWeekend();
                PlanProduccionDia::create([
                    'plan_id' => $plan->id, 'dia' => $d, 'tipo' => $finde ? 'libre' : 'habil', 'perforistas' => 0,
                    'turnos'  => $finde ? [] : PlanProduccion::TURNOS_POR_DEFECTO,
                ]);
            }

            foreach ($anterior?->rutas ?? [] as $i => $r) {
                PlanProduccionRuta::create($r->only(['nombre', 'ciclo_min', 'dumpers', 'peso_ton', 'horas', 'cuenta_capacidad']) + ['plan_id' => $plan->id, 'orden' => $i]);
            }

            $this->auditar($plan, 'creado', null, $request);
            return $plan;
        });

        return response()->json(['success' => true, 'data' => $this->serializar($plan->cargarCompleto()), 'message' => 'Plan creado en borrador'], 201);
    }

    /**
     * PUT /api/planificacion/planes/{id}
     * Guarda el borrador completo (supuestos, días, frentes con sus celdas, rutas).
     * Reemplaza lo que había: la pantalla siempre manda el plan entero.
     */
    public function update(Request $request, $id)
    {
        if (!$this->tieneRol($request)) {
            return $this->sinPermiso();
        }
        $plan = PlanProduccion::findOrFail($id);
        if ($plan->estaPublicado()) {
            return response()->json(['success' => false, 'message' => 'El plan está publicado. Para cambiarlo hay que reabrirlo indicando el motivo.'], 422);
        }

        $datos = $this->validarPlan($request, $plan);
        if ($datos instanceof \Illuminate\Http\JsonResponse) {
            return $datos;
        }

        DB::transaction(function () use ($plan, $datos) {
            $plan->update([
                'ton_por_disparo'           => $datos['ton_por_disparo'] ?? null,
                'tronaduras_por_perforista' => $datos['tronaduras_por_perforista'] ?? null,
                'observaciones'             => $datos['observaciones'] ?? null,
            ]);

            foreach ($datos['dias'] as $d) {
                PlanProduccionDia::updateOrCreate(
                    ['plan_id' => $plan->id, 'dia' => $d['dia']],
                    ['tipo' => $d['tipo'], 'perforistas' => $d['perforistas'] ?? 0, 'turnos' => $this->ordenarTurnos($d['turnos'] ?? [])]
                );
            }

            $plan->frentes()->delete(); // las celdas caen en cascada
            foreach ($datos['frentes'] as $i => $f) {
                $pf = PlanProduccionFrente::create([
                    'plan_id'           => $plan->id,
                    'id_frente_trabajo' => $f['id_frente_trabajo'],
                    'actividad'         => $f['actividad'],
                    'ley_esperada'      => $f['ley_esperada'] ?? null,
                    'orden'             => $i,
                ]);
                $filas = collect($f['celdas'] ?? [])
                    ->filter(fn ($c) => $f['actividad'] === 'fortificacion' || (float) ($c['toneladas'] ?? 0) > 0)
                    ->map(fn ($c) => [
                        'plan_frente_id' => $pf->id,
                        'dia'            => $c['dia'],
                        'turno'          => $c['turno'],
                        'toneladas'      => $f['actividad'] === 'fortificacion' ? null : $c['toneladas'],
                    ])->values()->all();
                if ($filas) {
                    PlanProduccionCelda::insert($filas);
                }
            }

            $plan->rutas()->delete();
            foreach ($datos['rutas'] ?? [] as $i => $r) {
                PlanProduccionRuta::create([
                    'plan_id'          => $plan->id,
                    'nombre'           => $r['nombre'],
                    'ciclo_min'        => $r['ciclo_min'],
                    'dumpers'          => $r['dumpers'],
                    'peso_ton'         => $r['peso_ton'],
                    'horas'            => $r['horas'],
                    'cuenta_capacidad' => $r['cuenta_capacidad'] ?? true,
                    'orden'            => $i,
                ]);
            }
        });

        return response()->json(['success' => true, 'data' => $this->serializar($plan->fresh()->cargarCompleto()), 'message' => 'Plan guardado']);
    }

    /** POST /api/planificacion/planes/{id}/publicar */
    public function publicar(Request $request, $id)
    {
        if (!$this->tieneRol($request)) {
            return $this->sinPermiso();
        }
        $plan = PlanProduccion::findOrFail($id);
        if ($plan->estaPublicado()) {
            return response()->json(['success' => false, 'message' => 'El plan ya está publicado.'], 422);
        }

        $tieneToneladas = PlanProduccionCelda::whereIn('plan_frente_id', $plan->frentes()->pluck('id'))
            ->where('toneladas', '>', 0)->exists();
        if (!$tieneToneladas) {
            return response()->json(['success' => false, 'message' => 'El plan no tiene toneladas en ningún frente.'], 422);
        }

        // Si se está volviendo a publicar después de reabrirlo: qué cambió respecto
        // de lo que estaba publicado (la foto que se guardó al reabrir).
        $cambios = null;
        $ultima = $plan->auditoria()->first();
        if ($ultima?->accion === 'reabierto' && $ultima->snapshot) {
            $cambios = app(ComparadorPlan::class)->comparar($ultima->snapshot, $this->serializar($plan->cargarCompleto()));
            if (!$cambios) {
                $cambios = ['Sin cambios respecto de lo publicado antes'];
            }
        }

        $plan->update([
            'estado'        => PlanProduccion::PUBLICADO,
            'publicado_en'  => now(),
            'publicado_por' => $this->usuario($request),
        ]);
        $this->auditar($plan, 'publicado', null, $request, null, $cambios);

        return response()->json(['success' => true, 'data' => $this->serializar($plan->fresh()->cargarCompleto()), 'message' => 'Plan publicado']);
    }

    /** POST /api/planificacion/planes/{id}/reabrir { motivo } */
    public function reabrir(Request $request, $id)
    {
        if (!$this->tieneRol($request)) {
            return $this->sinPermiso();
        }
        $request->validate(['motivo' => 'required|string|min:10|max:1000'], [
            'motivo.required' => 'Escribe por qué se reabre el plan.',
            'motivo.min'      => 'El motivo es muy corto: explica qué se va a corregir y por qué.',
        ]);

        $plan = PlanProduccion::findOrFail($id);
        if (!$plan->estaPublicado()) {
            return response()->json(['success' => false, 'message' => 'El plan no está publicado.'], 422);
        }

        DB::transaction(function () use ($plan, $request) {
            $foto = $this->serializar($plan->cargarCompleto());
            unset($foto['auditoria']);
            $this->auditar($plan, 'reabierto', $request->motivo, $request, $foto);
            $plan->update(['estado' => PlanProduccion::BORRADOR]);
        });

        return response()->json(['success' => true, 'data' => $this->serializar($plan->fresh()->cargarCompleto()), 'message' => 'Plan reabierto']);
    }

    /** DELETE /api/planificacion/planes/{id} — solo un borrador que nunca se publicó. */
    public function destroy(Request $request, $id)
    {
        if (!$this->tieneRol($request)) {
            return $this->sinPermiso();
        }
        $plan = PlanProduccion::findOrFail($id);
        if ($plan->estaPublicado() || $plan->auditoria()->where('accion', 'publicado')->exists()) {
            return response()->json(['success' => false, 'message' => 'Un plan que ya se publicó no se puede eliminar.'], 422);
        }
        $plan->delete();

        return response()->json(['success' => true, 'message' => 'Borrador eliminado']);
    }

    // ---------------------------------------------------------------------

    private function validarPlan(Request $request, PlanProduccion $plan)
    {
        $diasMes = Carbon::create($plan->anio, $plan->mes, 1)->daysInMonth;
        // Turnos: las jornadas activas + las que ya tenga guardadas el plan (si alguien
        // apaga una jornada después, el plan se sigue pudiendo editar).
        $turnos = PlanProduccion::turnosDisponibles()->pluck('nombre')
            ->merge(PlanProduccionCelda::whereIn('plan_frente_id', $plan->frentes()->pluck('id'))->distinct()->pluck('turno'))
            ->unique()->values()->all();

        $v = Validator::make($request->all(), [
            'ton_por_disparo'            => 'nullable|numeric|min:0|max:10000',
            'tronaduras_por_perforista'  => 'nullable|numeric|min:0|max:20',
            'observaciones'              => 'nullable|string|max:2000',
            'dias'                       => 'required|array',
            'dias.*.dia'                 => "required|integer|min:1|max:{$diasMes}",
            'dias.*.tipo'                => ['required', Rule::in(PlanProduccion::TIPOS_DIA)],
            'dias.*.perforistas'         => 'nullable|numeric|min:0|max:100',
            'dias.*.turnos'              => 'present|array',
            'dias.*.turnos.*'            => [Rule::in($turnos)],
            'frentes'                    => 'present|array',
            'frentes.*.id_frente_trabajo'=> 'required|integer',
            'frentes.*.actividad'        => ['required', Rule::in(PlanProduccion::ACTIVIDADES)],
            'frentes.*.ley_esperada'     => 'nullable|numeric|min:0|max:100',
            'frentes.*.celdas'           => 'present|array',
            'frentes.*.celdas.*.dia'     => "required|integer|min:1|max:{$diasMes}",
            'frentes.*.celdas.*.turno'   => ['required', Rule::in($turnos)],
            'frentes.*.celdas.*.toneladas' => 'nullable|numeric|min:0|max:100000',
            'rutas'                      => 'present|array',
            'rutas.*.nombre'             => 'required|string|max:100',
            'rutas.*.ciclo_min'          => 'required|numeric|gt:0|max:1000',
            'rutas.*.dumpers'            => 'required|numeric|gt:0|max:100',
            'rutas.*.peso_ton'           => 'required|numeric|gt:0|max:100',
            'rutas.*.horas'              => 'required|numeric|gt:0|max:24',
            'rutas.*.cuenta_capacidad'   => 'boolean',
        ], [
            'frentes.*.celdas.*.turno.in' => 'Hay un turno que no existe en la planificación.',
        ]);

        if ($v->fails()) {
            return response()->json(['success' => false, 'message' => $v->errors()->first(), 'errors' => $v->errors()], 422);
        }
        $datos = $v->validated();

        // Cada celda tiene que caer en un turno que ese día trabaja.
        $turnosDia = collect($datos['dias'])->mapWithKeys(fn ($d) => [$d['dia'] => $d['turnos'] ?? []]);
        foreach ($datos['frentes'] as $f) {
            foreach ($f['celdas'] as $c) {
                if (!in_array($c['turno'], $turnosDia[$c['dia']] ?? [], true)) {
                    $turno = $c['turno'] === 'Noche' ? 'TN' : $c['turno'];
                    return response()->json(['success' => false, 'message' => "El día {$c['dia']} tiene toneladas en el turno {$turno}, pero ese día no tiene ese turno."], 422);
                }
            }
        }

        // Los frentes tienen que ser de la faena del plan.
        $ids = collect($datos['frentes'])->pluck('id_frente_trabajo')->unique();
        $validos = FrenteTrabajo::whereIn('id', $ids)->where('id_faena', $plan->id_faena)->pluck('id');
        $malos = $ids->diff($validos);
        if ($malos->isNotEmpty()) {
            return response()->json(['success' => false, 'message' => 'Hay frentes que no pertenecen a esta faena.'], 422);
        }

        // Un mismo frente no puede repetirse con la misma actividad.
        $repetidos = collect($datos['frentes'])->groupBy(fn ($f) => $f['id_frente_trabajo'] . '|' . $f['actividad'])->filter(fn ($g) => $g->count() > 1);
        if ($repetidos->isNotEmpty()) {
            $f = $repetidos->first()->first();
            $nombre = FrenteTrabajo::find($f['id_frente_trabajo'])?->codigo_completo;
            return response()->json(['success' => false, 'message' => "El frente {$nombre} está dos veces como {$f['actividad']}."], 422);
        }

        return $datos;
    }

    private function serializar(PlanProduccion $plan): array
    {
        return [
            'id'                        => $plan->id,
            'id_faena'                  => $plan->id_faena,
            'anio'                      => $plan->anio,
            'mes'                       => $plan->mes,
            'estado'                    => $plan->estado,
            'ton_por_disparo'           => $plan->ton_por_disparo,
            'tronaduras_por_perforista' => $plan->tronaduras_por_perforista,
            'observaciones'             => $plan->observaciones,
            'creado_por'                => $plan->creado_por,
            'publicado_en'              => $plan->publicado_en?->format('Y-m-d H:i'),
            'publicado_por'             => $plan->publicado_por,
            'dias'                      => $this->diasConTurnos($plan),
            'frentes'                   => $plan->frentes->map(fn ($f) => [
                'id'                => $f->id,
                'id_frente_trabajo' => $f->id_frente_trabajo,
                'frente'            => $f->frenteTrabajo?->codigo_completo,
                'actividad'         => $f->actividad,
                'mineral'           => PlanProduccion::esMineral($f->actividad),
                'ley_esperada'      => $f->ley_esperada,
                'celdas'            => $f->celdas->map(fn ($c) => ['dia' => $c->dia, 'turno' => $c->turno, 'toneladas' => $c->toneladas])->values(),
            ])->values(),
            'rutas'                     => $plan->rutas->map(fn ($r) => $r->only(['nombre', 'ciclo_min', 'dumpers', 'peso_ton', 'horas', 'cuenta_capacidad']))->values(),
            'auditoria'                 => $plan->relationLoaded('auditoria')
                ? $plan->auditoria->map(fn ($a) => ['accion' => $a->accion, 'motivo' => $a->motivo, 'cambios' => $a->cambios, 'usuario' => $a->usuario, 'fecha' => $a->created_at?->format('Y-m-d H:i')])->values()
                : [],
        ];
    }

    private function mesAnterior(int $anio, int $mes): array
    {
        $ant = Carbon::create($anio, $mes, 1)->subMonth();
        return [$ant->year, $ant->month];
    }

    /**
     * Días con sus turnos. Si un día no tiene turnos guardados (planes creados antes
     * de que existieran), se arman con los turnos que tienen toneladas ese día, más
     * AM y PM si se trabaja.
     */
    public function diasConTurnos(PlanProduccion $plan)
    {
        $usados = [];
        foreach ($plan->frentes as $f) {
            foreach ($f->celdas as $c) {
                $usados[$c->dia][$c->turno] = true;
            }
        }
        return $plan->dias->map(function ($d) use ($usados) {
            $turnos = $d->turnos;
            if ($turnos === null) {
                $turnos = array_keys($usados[$d->dia] ?? []);
                if ($d->tipo !== 'libre') {
                    $turnos = array_merge(PlanProduccion::TURNOS_POR_DEFECTO, $turnos);
                }
            }
            $tipo = $d->tipo === 'libre' ? 'libre' : 'habil'; // planes con el tipo viejo tc/tl
            return ['dia' => $d->dia, 'tipo' => $tipo, 'perforistas' => $d->perforistas, 'turnos' => $this->ordenarTurnos($turnos)];
        })->values();
    }

    /** En el orden de Configuración General; los que ya no existen, al final. */
    private function ordenarTurnos(array $turnos): array
    {
        $orden = \App\Models\Jornada::ordenadas()->pluck('nombre')->all();
        $conocidos = array_values(array_filter($orden, fn ($t) => in_array($t, $turnos, true)));
        return array_values(array_unique(array_merge($conocidos, $turnos)));
    }

    private function frentesDisponibles(int $idFaena)
    {
        return FrenteTrabajo::where('id_faena', $idFaena)
            ->where('estado', 'activo')
            ->orderBy('codigo_completo')
            ->get(['id', 'codigo_completo'])
            ->map(fn ($f) => ['id' => $f->id, 'codigo' => $f->codigo_completo]);
    }

    private function auditar(PlanProduccion $plan, string $accion, ?string $motivo, Request $request, ?array $snapshot = null, ?array $cambios = null): void
    {
        PlanProduccionAuditoria::create([
            'plan_id'    => $plan->id,
            'accion'     => $accion,
            'motivo'     => $motivo,
            'snapshot'   => $snapshot,
            'cambios'    => $cambios,
            'usuario_id' => $request->auth_user_id,
            'usuario'    => $this->usuario($request),
        ]);
    }

    private function usuario(Request $request): string
    {
        $u = $request->auth_user ?? [];
        return trim(($u['nombre'] ?? '') . ' ' . ($u['apellido'] ?? '')) ?: 'Sistema';
    }

    private function tieneRol(Request $request): bool
    {
        foreach ($request->auth_roles ?? [] as $rol) {
            $rol = is_array($rol) || is_object($rol) ? ((array) $rol)['codigo_externo'] ?? ((array) $rol)['nombre'] ?? '' : $rol;
            if (strcasecmp((string) $rol, self::ROL) === 0) {
                return true;
            }
        }
        return false;
    }

    private function sinPermiso()
    {
        return response()->json(['success' => false, 'message' => 'Solo quien tiene el rol de Planificación puede cambiar el plan.'], 403);
    }
}
