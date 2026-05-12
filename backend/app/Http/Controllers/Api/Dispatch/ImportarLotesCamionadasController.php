<?php

namespace App\Http\Controllers\Api\Dispatch;

use App\Http\Controllers\Controller;
use App\Models\Laboratorio\Camionada;
use App\Models\Laboratorio\Empresa;
use App\Models\Laboratorio\Lote;
use App\Models\Laboratorio\Mezcla;
use App\Models\Laboratorio\Planta;
use App\Traits\MultiTenancy;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ImportarLotesCamionadasController extends Controller
{
    use MultiTenancy;

    /**
     * Preview: valida plantas, empresas, lotes y mezclas antes de importar.
     * POST /api/dispatch/importar/lotes/preview
     * Body: { faena_id, lotes: [{ numero_lote, empresa_nombre, planta_destino, camionadas: [...] }] }
     */
    public function preview(Request $request)
    {
        $faenaId    = $request->input('faena_id');
        $lotesInput = $request->input('lotes', []);

        $empresas = Empresa::all();
        $plantas  = Planta::all();

        $numerosLote     = collect($lotesInput)->pluck('numero_lote')->filter()->unique()->toArray();
        $lotesExistentes = Lote::where('id_faena', $faenaId)
            ->whereIn('numero_lote', $numerosLote)
            ->pluck('id', 'numero_lote');

        $codigosMezcla = collect($lotesInput)
            ->flatMap(fn($l) => collect($l['camionadas'] ?? [])->pluck('mezcla_codigo'))
            ->filter()->unique()->values()->toArray();
        $mezclasDB = Mezcla::where('id_faena', $faenaId)
            ->whereIn('codigo', $codigosMezcla)
            ->get()
            ->keyBy('codigo');

        // Para cada mezcla encontrada, cargar sus dumpadas de origen
        $mezclasDetalle = [];
        foreach ($mezclasDB as $codigo => $mezcla) {
            $dumpadas = DB::table('mezcla_dumpada')
                ->where('mezcla_dumpada.mezcla_id', $mezcla->id)
                ->where('mezcla_dumpada.tipo', 'DUMP')
                ->leftJoin('dumpadas', 'mezcla_dumpada.dumpada_id', '=', 'dumpadas.id')
                ->select(
                    'mezcla_dumpada.origen',
                    'mezcla_dumpada.toneladas',
                    'mezcla_dumpada.ley_dump_ajustada',
                    'mezcla_dumpada.ley_visual',
                    'mezcla_dumpada.ley_lote',
                    'dumpadas.fecha',
                    'dumpadas.numero_dumpada'
                )
                ->orderBy('dumpadas.fecha')
                ->orderBy('mezcla_dumpada.id')
                ->get();

            $mezclasDetalle[$codigo] = [
                'existe'                => true,
                'id'                    => $mezcla->id,
                'total_ton'             => (float) $mezcla->total_ton,
                'toneladas_disponibles' => (float) $mezcla->toneladas_disponibles,
                'ley_prom_dump'         => $mezcla->ley_prom_dump    !== null ? (float) $mezcla->ley_prom_dump    : null,
                'ley_prom_visual'       => $mezcla->ley_prom_visual   !== null ? (float) $mezcla->ley_prom_visual  : null,
                'ley_prom_lote'         => $mezcla->ley_prom_lote     !== null ? (float) $mezcla->ley_prom_lote    : null,
                'ley_lab'               => $mezcla->ley_lab            !== null ? (float) $mezcla->ley_lab          : null,
                'dumpadas'              => $dumpadas->map(fn($d) => [
                    'origen'            => $d->origen,
                    'fecha'             => $d->fecha,
                    'toneladas'         => (float) $d->toneladas,
                    'ley_dump_ajustada' => $d->ley_dump_ajustada !== null ? (float) $d->ley_dump_ajustada : null,
                    'ley_visual'        => $d->ley_visual !== null ? (float) $d->ley_visual : null,
                    'ley_lote'          => $d->ley_lote !== null ? (float) $d->ley_lote : null,
                    'numero_dumpada'    => $d->numero_dumpada,
                ])->values()->toArray(),
            ];
        }
        foreach ($codigosMezcla as $codigo) {
            if (!isset($mezclasDetalle[$codigo])) {
                $mezclasDetalle[$codigo] = ['existe' => false, 'dumpadas' => []];
            }
        }

        $resultado = [];
        foreach ($lotesInput as $lote) {
            $numeroLote    = (string)($lote['numero_lote'] ?? '');
            $empresaNombre = $lote['empresa_nombre'] ?? '';
            $plantaDestino = $lote['planta_destino'] ?? '';
            $camionadas    = $lote['camionadas'] ?? [];

            $empresaMatch = $this->buscarEmpresa($empresas, $empresaNombre);
            $plantaMatch  = $this->buscarPlanta($plantas, $plantaDestino);

            $mezclasNoEncontradas = [];
            $camionadasValidas    = 0;

            foreach ($camionadas as $cam) {
                $codigo = $cam['mezcla_codigo'] ?? '';
                if ($codigo && !$mezclasDB->has($codigo)) {
                    $mezclasNoEncontradas[] = $codigo;
                }
                $peso = isset($cam['peso']) ? (float)$cam['peso'] : 0;
                if (!empty($cam['patente']) || $peso > 0) {
                    $camionadasValidas++;
                }
            }

            $resultado[] = [
                'numero_lote'            => $numeroLote,
                'empresa_nombre'         => $empresaNombre,
                'planta_destino'         => $plantaDestino,
                'existe'                 => $lotesExistentes->has($numeroLote),
                'empresa_id'             => $empresaMatch['id'] ?? null,
                'empresa_match_nombre'   => $empresaMatch['nombre'] ?? null,
                'empresa_sin_match'      => $empresaMatch === null,
                'planta_id'              => $plantaMatch['id'] ?? null,
                'planta_match_nombre'    => $plantaMatch['nombre'] ?? null,
                'planta_sin_match'       => $plantaMatch === null,
                'camionadas_total'       => count($camionadas),
                'camionadas_validas'     => $camionadasValidas,
                'mezclas_no_encontradas' => array_values(array_unique($mezclasNoEncontradas)),
            ];
        }

        return response()->json([
            'success'         => true,
            'lotes'           => $resultado,
            'empresas'        => $empresas->map(fn($e) => ['id' => $e->id, 'nombre' => $e->nombre])->values(),
            'plantas'         => $plantas->map(fn($p) => ['id' => $p->id, 'nombre' => $p->nombre, 'codigo' => $p->codigo])->values(),
            'mezclas_detalle' => $mezclasDetalle,
        ]);
    }

    /**
     * Confirmar importación masiva de lotes y camionadas.
     * POST /api/dispatch/importar/lotes/confirmar
     * Body: { faena_id, lotes: [...], empresa_overrides: { "11004": 3 }, planta_overrides: { "11004": 1 } }
     */
    public function confirmar(Request $request)
    {
        $faenaId          = $request->input('faena_id');
        $lotesInput       = $request->input('lotes', []);
        $empresaOverrides = $request->input('empresa_overrides', []);
        $plantaOverrides  = $request->input('planta_overrides', []);

        $empresas = Empresa::all();
        $plantas  = Planta::all();

        $numerosLote     = collect($lotesInput)->pluck('numero_lote')->filter()->unique()->toArray();
        $lotesExistentes = Lote::where('id_faena', $faenaId)
            ->whereIn('numero_lote', $numerosLote)
            ->pluck('id', 'numero_lote');

        $codigosMezcla = collect($lotesInput)
            ->flatMap(fn($l) => collect($l['camionadas'] ?? [])->pluck('mezcla_codigo'))
            ->filter()->unique()->toArray();
        $mezclasDB = Mezcla::where('id_faena', $faenaId)
            ->whereIn('codigo', $codigosMezcla)
            ->get()->keyBy('codigo');

        $creados  = 0;
        $saltados = 0;
        $errores  = [];

        foreach ($lotesInput as $i => $loteData) {
            try {
                $numeroLote    = (string)($loteData['numero_lote'] ?? '');
                $empresaNombre = $loteData['empresa_nombre'] ?? '';
                $plantaDestino = $loteData['planta_destino'] ?? '';
                $camionadas    = $loteData['camionadas'] ?? [];

                if (!$numeroLote) { $saltados++; continue; }
                if ($lotesExistentes->has($numeroLote)) { $saltados++; continue; }

                // Empresa: override > match automático
                $empresaId = isset($empresaOverrides[$numeroLote]) && $empresaOverrides[$numeroLote]
                    ? (int)$empresaOverrides[$numeroLote]
                    : ($this->buscarEmpresa($empresas, $empresaNombre)['id'] ?? null);

                if (!$empresaId) {
                    $errores[] = ['numero_lote' => $numeroLote, 'error' => "Empresa '{$empresaNombre}' sin match. Asígnala manualmente."];
                    continue;
                }

                // Planta: override > match automático
                $plantaId = isset($plantaOverrides[$numeroLote]) && $plantaOverrides[$numeroLote]
                    ? (int)$plantaOverrides[$numeroLote]
                    : ($this->buscarPlanta($plantas, $plantaDestino)['id'] ?? null);

                if (!$plantaId) {
                    $errores[] = ['numero_lote' => $numeroLote, 'error' => "Planta '{$plantaDestino}' sin match. Asígnala manualmente."];
                    continue;
                }

                $primeraFecha = collect($camionadas)
                    ->filter(fn($c) => !empty($c['fecha_despacho']))
                    ->map(fn($c) => $this->parseFecha($c['fecha_despacho']))
                    ->filter()->sort()->first();

                DB::beginTransaction();

                $lote = Lote::create([
                    'numero_lote'    => $numeroLote,
                    'planta_id'      => $plantaId,
                    'empresa_id'     => $empresaId,
                    'id_faena'       => $faenaId,
                    'fecha_creacion' => $primeraFecha ?? now()->toDateString(),
                    'estado'         => Lote::ESTADO_COMPLETADO,
                    'observaciones'  => 'Importado desde Excel',
                    'user_id'        => $request->auth_user_id,
                ]);

                $mezclasAfectadas = [];

                foreach ($camionadas as $camData) {
                    $numeroCamionada = (int)($camData['numero_camionada'] ?? 0);
                    $patente         = isset($camData['patente']) ? trim($camData['patente']) : null;
                    $peso            = isset($camData['peso']) ? (float)$camData['peso'] : null;

                    if (!$numeroCamionada) continue;
                    if (!$patente && (!$peso || $peso <= 0)) continue;

                    $codigoMezcla = $camData['mezcla_codigo'] ?? '';
                    $mezcla       = $mezclasDB->has($codigoMezcla) ? $mezclasDB->get($codigoMezcla) : null;

                    $fechaDespacho  = $this->parseFecha($camData['fecha_despacho']  ?? null);
                    $fechaRecepcion = $this->parseFecha($camData['fecha_recepcion'] ?? null) ?? $fechaDespacho;
                    $leyMezcla      = isset($camData['ley_mezcla'])     ? (float)$camData['ley_mezcla']     : null;
                    $leyVisual      = isset($camData['ley_visual'])     ? (float)$camData['ley_visual']     : null;
                    $leyLab         = isset($camData['ley_lab_camion']) ? (float)$camData['ley_lab_camion'] : null;

                    $camionada = Camionada::create([
                        'lote_id'          => $lote->id,
                        'id_faena'         => $faenaId,
                        'numero_camionada' => $numeroCamionada,
                        'ticket'           => isset($camData['ticket']) ? trim($camData['ticket']) ?: null : null,
                        'patente'          => $patente,
                        'planta'           => $plantaDestino ?: null,
                        'cliente'          => $empresaNombre ?: null,
                        'fecha_despacho'   => $fechaDespacho,
                        'hora_despacho'    => $camData['hora'] ?? null,
                        'fecha_recepcion'  => $fechaRecepcion,
                        'peso'             => $peso,
                        'peso_real'        => $peso,
                        'ley_mezcla'       => $leyMezcla,
                        'ley_visual'       => $leyVisual,
                        'ley_lab_camion'   => $leyLab,
                        'estado'           => Camionada::ESTADO_COMPLETADO,
                        'user_id'          => $request->auth_user_id,
                    ]);

                    if ($mezcla) {
                        $camionada->mezclas()->attach($mezcla->id, [
                            'toneladas'  => $peso ?? 0,
                            'ley_mezcla' => $leyMezcla,
                        ]);
                        $mezclasAfectadas[$mezcla->id] = ($mezclasAfectadas[$mezcla->id] ?? 0) + ($peso ?? 0);
                    }
                }

                foreach ($mezclasAfectadas as $mezclaId => $tonAdd) {
                    $m = Mezcla::find($mezclaId);
                    if (!$m) continue;
                    $m->toneladas_despachadas = round(($m->toneladas_despachadas ?? 0) + $tonAdd, 2);
                    $m->toneladas_disponibles = round(max(0, $m->total_ton - $m->toneladas_despachadas), 2);
                    $m->save();
                }

                DB::commit();
                $creados++;

            } catch (\Exception $e) {
                DB::rollBack();
                $errores[] = [
                    'numero_lote' => $lotesInput[$i]['numero_lote'] ?? "índice {$i}",
                    'error'       => $e->getMessage(),
                ];
                Log::error('Error importando lote', ['index' => $i, 'error' => $e->getMessage()]);
            }
        }

        return response()->json([
            'success'  => true,
            'creados'  => $creados,
            'saltados' => $saltados,
            'errores'  => $errores,
        ]);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private function buscarEmpresa($empresas, string $nombre): ?array
    {
        if (!$nombre) return null;
        $norm = $this->normalizar($nombre);
        foreach ($empresas as $e) {
            if ($this->normalizar($e->nombre) === $norm) return ['id' => $e->id, 'nombre' => $e->nombre];
        }
        foreach ($empresas as $e) {
            $eNorm = $this->normalizar($e->nombre);
            if (str_contains($eNorm, $norm) || str_contains($norm, $eNorm)) return ['id' => $e->id, 'nombre' => $e->nombre];
        }
        return null;
    }

    private function buscarPlanta($plantas, string $nombre): ?array
    {
        if (!$nombre) return null;
        $norm = $this->normalizar($nombre);
        foreach ($plantas as $p) {
            if ($this->normalizar($p->nombre) === $norm) return ['id' => $p->id, 'nombre' => $p->nombre];
        }
        // Partial match: "Cenizas" → "Planta Cenizas", "Enami" → "Planta Enami"
        foreach ($plantas as $p) {
            $pNorm = $this->normalizar($p->nombre);
            if (str_contains($pNorm, $norm) || str_contains($norm, $pNorm)) return ['id' => $p->id, 'nombre' => $p->nombre];
        }
        // Match by code
        foreach ($plantas as $p) {
            if ($p->codigo && $this->normalizar($p->codigo) === $norm) return ['id' => $p->id, 'nombre' => $p->nombre];
        }
        return null;
    }

    private function normalizar(string $str): string
    {
        $str = mb_strtolower(trim($str));
        return str_replace(
            ['á','é','í','ó','ú','ü','ñ','à','è','ì','ò','ù',"\r","\n"],
            ['a','e','i','o','u','u','n','a','e','i','o','u',' ',' '],
            $str
        );
    }

    private function parseFecha(?string $fecha): ?string
    {
        if (!$fecha) return null;
        try { return Carbon::parse($fecha)->toDateString(); } catch (\Exception $e) { return null; }
    }
}
