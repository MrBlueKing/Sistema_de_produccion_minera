<?php

namespace App\Http\Controllers\Api\Dispatch;

use App\Http\Controllers\Controller;
use App\Models\Dispatch\OperadorAutorizado;
use App\Models\Dispatch\ReporteCyt;
use App\Models\Dispatch\ReporteCytDumper;
use App\Models\Jornada;
use App\Models\TonelajeMaquina;
use App\Traits\MultiTenancy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Report de Ciclo Carguío y Transporte (rol SAC `supervisor_cyt`, módulo Dispatch).
 *
 * El supervisor trabaja en SU faena (auth_faena). Con el rol
 * `supervisor_cyt_multifaena` (o un rol global) elige la faena: todas las rutas
 * reciben `id_faena` y se valida aquí, sin depender del header X-Faena-ID que el
 * frontend solo manda para Encargado Dispatch.
 */
class ReporteCytController extends Controller
{
    use MultiTenancy;

    public const ROL_MULTIFAENA = 'supervisor_cyt_multifaena';

    /** GET /api/dispatch/cyt/reportes?id_faena= — los últimos reports de la faena. */
    public function index(Request $request)
    {
        $idFaena = $this->faena($request);

        $reportes = ReporteCyt::where('id_faena', $idFaena)
            ->withCount('cargas')
            ->withSum('cargas', 'paladas')
            ->orderByDesc('fecha')
            ->orderByDesc('id')
            ->limit(120)
            ->get()
            ->map(fn($r) => [
                'id'                => $r->id,
                'fecha'             => $r->fecha->format('Y-m-d'),
                'jornada'           => $r->jornada,
                'estado'            => $r->estado,
                'supervisor_nombre' => $r->supervisor_nombre,
                'cargas'            => (int) $r->cargas_count,
                'paladas'           => (int) ($r->cargas_sum_paladas ?? 0),
                'updated_at'        => $r->updated_at?->toDateTimeString(),
            ]);

        return response()->json(['success' => true, 'data' => $reportes]);
    }

    /** GET /api/dispatch/cyt/reportes/buscar?id_faena=&fecha=&jornada= — el report de esa hoja, o null. */
    public function buscar(Request $request)
    {
        $request->validate(['fecha' => 'required|date', 'jornada' => 'required|string']);
        $idFaena = $this->faena($request);

        $reporte = ReporteCyt::where('id_faena', $idFaena)
            ->whereDate('fecha', $request->fecha)
            ->where('jornada', $request->jornada)
            ->first();

        return response()->json(['success' => true, 'data' => $reporte ? $this->detalle($reporte) : null]);
    }

    /** GET /api/dispatch/cyt/reportes/{id} */
    public function show(Request $request, $id)
    {
        $reporte = ReporteCyt::findOrFail($id);
        $this->faena($request->merge(['id_faena' => $reporte->id_faena]));

        return response()->json(['success' => true, 'data' => $this->detalle($reporte)]);
    }

    /**
     * POST /api/dispatch/cyt/reportes — crea o reemplaza la hoja de esa faena + fecha + jornada.
     * Borrador: se aceptan filas incompletas. Guardado: cada carga necesita frente, pala, hora y dumper.
     */
    public function guardar(Request $request)
    {
        $idFaena = $this->faena($request);
        $guardado = $request->input('estado') === ReporteCyt::ESTADO_GUARDADO;
        $req = $guardado ? 'required' : 'nullable';

        $existente = ReporteCyt::where('id_faena', $idFaena)
            ->whereDate('fecha', $request->input('fecha'))
            ->where('jornada', $request->input('jornada'))
            ->first();

        $v = Validator::make($request->all(), [
            'fecha'                          => 'required|date|after_or_equal:2025-01-01|before_or_equal:tomorrow',
            'jornada'                        => ['required', Jornada::regla('cyt', $existente?->jornada)],
            'estado'                         => ['required', Rule::in([ReporteCyt::ESTADO_BORRADOR, ReporteCyt::ESTADO_GUARDADO])],
            'observaciones'                  => 'nullable|string|max:2000',
            'cargas'                         => [$guardado ? 'required' : 'present', 'array'],
            'cargas.*.id_frente_trabajo'     => [$req, 'nullable', Rule::exists('frentes_trabajo', 'id')],
            'cargas.*.id_pala'               => 'nullable|integer',
            'cargas.*.nombre_pala'           => [$req, 'nullable', 'string', 'max:100'],
            'cargas.*.id_operador_pala'      => 'nullable|integer',
            'cargas.*.nombre_operador_pala'  => 'nullable|string|max:150',
            'cargas.*.hora_llegada'          => [$req, 'nullable', 'date_format:H:i'],
            'cargas.*.tiempo_carguio'        => 'nullable|numeric|min:0|max:600',
            'cargas.*.paladas'               => 'nullable|integer|min:0|max:100',
            'cargas.*.id_dumper'             => 'nullable|integer',
            'cargas.*.nombre_dumper'         => [$req, 'nullable', 'string', 'max:100'],
            'cargas.*.id_operador_dumper'    => 'nullable|integer',
            'cargas.*.nombre_operador_dumper'=> 'nullable|string|max:150',
            'dumpers'                        => 'present|array',
            'dumpers.*.id_dumper'            => 'nullable|integer',
            'dumpers.*.nombre_dumper'        => 'required|string|max:100',
            'dumpers.*.estado'               => ['required', Rule::in(ReporteCytDumper::ESTADOS)],
            'dumpers.*.horas_fuera'          => 'nullable|numeric|min:0|max:24',
            'dumpers.*.motivo'               => 'nullable|string|max:255',
        ], [
            'cargas.required'                       => 'Agrega al menos una carga antes de guardar el report.',
            'cargas.*.id_frente_trabajo.required'   => 'Falta el sector en una de las cargas.',
            'cargas.*.nombre_pala.required'         => 'Falta la pala en una de las cargas.',
            'cargas.*.hora_llegada.required'        => 'Falta la hora de llegada en una de las cargas.',
            'cargas.*.hora_llegada.date_format'     => 'Una hora de llegada no tiene el formato hh:mm.',
            'cargas.*.nombre_dumper.required'       => 'Falta el dumper en una de las cargas.',
            'jornada.in'                            => 'Esa jornada no está activa para el Report CyT.',
        ]);

        if ($v->fails()) {
            return response()->json(['success' => false, 'message' => $v->errors()->first(), 'errors' => $v->errors()], 422);
        }

        $reporte = DB::transaction(function () use ($request, $idFaena, $existente) {
            $usuario = $request->auth_user ?? [];
            $reporte = $existente ?? new ReporteCyt([
                'id_faena'          => $idFaena,
                'supervisor_id'     => $request->auth_user_id,
                'supervisor_nombre' => trim(($usuario['nombre'] ?? '') . ' ' . ($usuario['apellido'] ?? '')) ?: null,
            ]);
            $reporte->fill([
                'fecha'         => $request->fecha,
                'jornada'       => $request->jornada,
                'estado'        => $request->estado,
                'observaciones' => $request->observaciones,
            ])->save();

            // La hoja se guarda completa cada vez: más simple y sin filas huérfanas.
            $reporte->cargas()->delete();
            foreach (array_values($request->cargas ?? []) as $i => $c) {
                $reporte->cargas()->create([
                    'orden'                  => $i + 1,
                    'id_frente_trabajo'      => $c['id_frente_trabajo'] ?? null,
                    'id_pala'                => $c['id_pala'] ?? null,
                    'nombre_pala'            => $c['nombre_pala'] ?? null,
                    'id_operador_pala'       => $c['id_operador_pala'] ?? null,
                    'nombre_operador_pala'   => $c['nombre_operador_pala'] ?? null,
                    'hora_llegada'           => $c['hora_llegada'] ?? null,
                    'tiempo_carguio'         => $c['tiempo_carguio'] ?? null,
                    'paladas'                => $c['paladas'] ?? null,
                    'id_dumper'              => $c['id_dumper'] ?? null,
                    'nombre_dumper'          => $c['nombre_dumper'] ?? null,
                    'id_operador_dumper'     => $c['id_operador_dumper'] ?? null,
                    'nombre_operador_dumper' => $c['nombre_operador_dumper'] ?? null,
                ]);
            }

            $reporte->dumpers()->delete();
            foreach ($request->dumpers ?? [] as $d) {
                $reporte->dumpers()->create([
                    'id_dumper'     => $d['id_dumper'] ?? null,
                    'nombre_dumper' => $d['nombre_dumper'],
                    'estado'        => $d['estado'],
                    'horas_fuera'   => $d['estado'] === 'Operativo' ? null : ($d['horas_fuera'] ?? null),
                    'motivo'        => $d['motivo'] ?? null,
                ]);
            }

            return $reporte;
        });

        return response()->json([
            'success' => true,
            'message' => $reporte->estado === ReporteCyt::ESTADO_GUARDADO ? 'Report guardado' : 'Borrador guardado',
            'data'    => $this->detalle($reporte->fresh()),
        ], $existente ? 200 : 201);
    }

    /** DELETE /api/dispatch/cyt/reportes/{id} — solo borradores. */
    public function destroy(Request $request, $id)
    {
        $reporte = ReporteCyt::findOrFail($id);
        $this->faena($request->merge(['id_faena' => $reporte->id_faena]));

        if ($reporte->estado !== ReporteCyt::ESTADO_BORRADOR) {
            return response()->json(['success' => false, 'message' => 'Solo se pueden eliminar borradores.'], 422);
        }
        $reporte->delete();

        return response()->json(['success' => true, 'message' => 'Borrador eliminado']);
    }

    /**
     * GET /api/dispatch/cyt/maquinas — palas/excavadoras y dumpers desde Petróleo.
     * Si Petróleo no responde, los dumpers salen del caché local de tonelajes
     * (el mismo que usa el Ingreso de Dumpadas) y las palas de la última lista que
     * respondió Petróleo; solo si nunca respondió quedan vacías con aviso.
     */
    public function maquinas()
    {
        $palas = $this->desdePetroleo('/maquinas-carguio');
        if ($palas !== null) {
            Cache::forever('cyt_palas_petroleo', $palas);
        } else {
            $palas = Cache::get('cyt_palas_petroleo');
        }
        $dumpers = $this->desdePetroleo('/dumpers');

        if ($dumpers === null) {
            $dumpers = TonelajeMaquina::activos()
                ->whereNotNull('id_maquina')
                ->get(['id_maquina', 'nombre_maquina'])
                ->unique('id_maquina')
                ->map(fn($m) => ['id_maquina' => $m->id_maquina, 'nombre_maquina' => $m->nombre_maquina])
                ->values()->all();
        }

        $orden = fn($lista) => collect($lista ?? [])
            ->map(fn($m) => ['id' => $m['id_maquina'], 'nombre' => $m['nombre_maquina'], 'categoria' => $m['categoria'] ?? null])
            ->sortBy('nombre', SORT_NATURAL)->values();

        return response()->json([
            'success'           => true,
            'palas'             => $orden($palas),
            'dumpers'           => $orden($dumpers),
            'petroleo_sin_palas'=> $palas === null,
        ]);
    }

    // ── Operadores de pala ───────────────────────────────────────────────

    /** GET /api/dispatch/cyt/operadores?id_faena=&tipo=pala|dumper */
    public function operadores(Request $request)
    {
        $idFaena = $this->faena($request);
        $tipo = $request->input('tipo') === OperadorAutorizado::TIPO_PALA ? OperadorAutorizado::TIPO_PALA : OperadorAutorizado::TIPO_DUMPER;

        $data = OperadorAutorizado::activos()->tipo($tipo)->where('id_faena', $idFaena)
            ->orderBy('nombre')->get()
            ->map(fn($o) => ['id' => $o->id, 'id_operador' => $o->id_personal_externo, 'nombre' => $o->nombre, 'rut' => $o->rut, 'cargo' => $o->cargo]);

        return response()->json(['success' => true, 'data' => $data]);
    }

    /** GET /api/dispatch/cyt/operadores/disponibles?id_faena= — personal de Petróleo, marcando los ya autorizados como operador de pala. */
    public function operadoresDisponibles(Request $request)
    {
        $idFaena = $this->faena($request);
        $personal = OperadorAutorizado::personalDePetroleo($idFaena);
        if ($personal !== null && empty($personal)) {
            $personal = OperadorAutorizado::personalDePetroleo(null);
        }
        if ($personal === null) {
            return response()->json(['success' => false, 'message' => 'No se pudo obtener el personal desde Petróleo. Intenta de nuevo en un rato.'], 502);
        }

        $autorizados = OperadorAutorizado::activos()->tipo(OperadorAutorizado::TIPO_PALA)
            ->where('id_faena', $idFaena)->pluck('id_personal_externo')->all();

        $data = collect($personal)->unique('id_personal_interno')
            ->map(fn($p) => [
                'id_personal_externo' => $p['id_personal_interno'],
                'rut'                 => $p['rut'] ?? null,
                'nombre'              => trim(($p['nombre'] ?? '') . ' ' . ($p['apellido'] ?? '')),
                'cargo'               => $p['cargo'] ?? null,
                'es_operador'         => stripos($p['cargo'] ?? '', 'operador') !== false,
                'ya_autorizado'       => in_array($p['id_personal_interno'], $autorizados),
            ])
            ->filter(fn($p) => $p['nombre'] !== '')
            ->sortBy([['es_operador', 'desc'], ['nombre', 'asc']])
            ->values();

        return response()->json(['success' => true, 'data' => $data]);
    }

    /** POST /api/dispatch/cyt/operadores — autorizar operador de pala en la faena. */
    public function autorizarOperador(Request $request)
    {
        $idFaena = $this->faena($request);
        $request->validate([
            'id_personal_externo' => 'required|integer',
            'rut'                 => 'nullable|string|max:12',
            'nombre'              => 'required|string|max:150',
            'cargo'               => 'nullable|string|max:150',
        ]);

        $existente = OperadorAutorizado::where('id_personal_externo', $request->id_personal_externo)
            ->where('id_faena', $idFaena)->tipo(OperadorAutorizado::TIPO_PALA)->first();
        if ($existente && $existente->activo) {
            return response()->json(['success' => false, 'message' => 'Esta persona ya está autorizada como operador de pala'], 422);
        }

        $datos = ['rut' => $request->rut, 'nombre' => $request->nombre, 'cargo' => $request->cargo, 'activo' => true];
        $operador = $existente
            ? tap($existente)->update($datos)
            : OperadorAutorizado::create($datos + [
                'id_personal_externo' => $request->id_personal_externo,
                'id_faena'            => $idFaena,
                'tipo'                => OperadorAutorizado::TIPO_PALA,
            ]);

        return response()->json(['success' => true, 'message' => 'Operador de pala autorizado', 'data' => $operador], $existente ? 200 : 201);
    }

    /** DELETE /api/dispatch/cyt/operadores/{id} — quitar de la lista (los reports guardan su propio nombre). */
    public function quitarOperador(Request $request, $id)
    {
        $operador = OperadorAutorizado::tipo(OperadorAutorizado::TIPO_PALA)->findOrFail($id);
        $this->faena($request->merge(['id_faena' => $operador->id_faena]));
        $operador->update(['activo' => false]);

        return response()->json(['success' => true, 'message' => 'Operador quitado de la lista']);
    }

    // ── Apoyo ────────────────────────────────────────────────────────────

    private function detalle(ReporteCyt $r): array
    {
        $r->load(['cargas.frenteTrabajo:id,codigo_completo', 'dumpers']);

        return [
            'id'                => $r->id,
            'id_faena'          => $r->id_faena,
            'fecha'             => $r->fecha->format('Y-m-d'),
            'jornada'           => $r->jornada,
            'estado'            => $r->estado,
            'supervisor_nombre' => $r->supervisor_nombre,
            'observaciones'     => $r->observaciones,
            'cargas'            => $r->cargas->map(fn($c) => [
                'id_frente_trabajo'      => $c->id_frente_trabajo,
                'frente'                 => $c->frenteTrabajo?->codigo_completo,
                'id_pala'                => $c->id_pala,
                'nombre_pala'            => $c->nombre_pala,
                'id_operador_pala'       => $c->id_operador_pala,
                'nombre_operador_pala'   => $c->nombre_operador_pala,
                'hora_llegada'           => $c->hora_llegada ? substr($c->hora_llegada, 0, 5) : null,
                'tiempo_carguio'         => $c->tiempo_carguio,
                'paladas'                => $c->paladas,
                'id_dumper'              => $c->id_dumper,
                'nombre_dumper'          => $c->nombre_dumper,
                'id_operador_dumper'     => $c->id_operador_dumper,
                'nombre_operador_dumper' => $c->nombre_operador_dumper,
            ])->values(),
            'dumpers'           => $r->dumpers->map(fn($d) => [
                'id_dumper'     => $d->id_dumper,
                'nombre_dumper' => $d->nombre_dumper,
                'estado'        => $d->estado,
                'horas_fuera'   => $d->horas_fuera,
                'motivo'        => $d->motivo,
            ])->values(),
        ];
    }

    private function esMultifaena(Request $request): bool
    {
        if ($this->esUsuarioGlobal($request)) {
            return true;
        }
        foreach ($request->auth_roles ?? [] as $rol) {
            $rol = is_array($rol) || is_object($rol) ? ((array) $rol)['codigo_externo'] ?? ((array) $rol)['nombre'] ?? '' : $rol;
            if (strcasecmp((string) $rol, self::ROL_MULTIFAENA) === 0) {
                return true;
            }
        }
        return false;
    }

    /** Faena del pedido: la del usuario, o la elegida si es multifaena. */
    private function faena(Request $request): int
    {
        $pedida = $request->input('id_faena');
        $propia = is_numeric($request->auth_faena) ? (int) $request->auth_faena : null;

        if ($this->esMultifaena($request)) {
            $id = $pedida ?: $propia;
        } else {
            if ($pedida && $propia && (int) $pedida !== $propia) {
                abort(403, 'No tienes acceso a reports de esa faena.');
            }
            $id = $propia;
        }

        if (!$id) {
            abort(400, 'Falta la faena del report.');
        }
        return (int) $id;
    }

    /** Lista desde un endpoint público de Petróleo; null si no respondió. */
    private function desdePetroleo(string $ruta): ?array
    {
        try {
            $r = Http::timeout(6)->get(config('services.petroleo_api') . $ruta);
            return $r->successful() ? ($r->json('data') ?? []) : null;
        } catch (\Exception $e) {
            Log::warning('[CYT] Petróleo no respondió', ['ruta' => $ruta, 'message' => $e->getMessage()]);
            return null;
        }
    }
}
