<?php

namespace App\Http\Controllers\Api\Dispatch;

use App\Http\Controllers\Controller;
use App\Models\Dispatch\Dumpada;
use App\Models\Ingenieria\FrenteTrabajo;
use App\Traits\MultiTenancy;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * [TEST] Comparar N°Acopio del Excel con numero_dumpada en BD.
 * Matching: fecha + frente + jornada → ley (primario) → posicional (fallback).
 */
class CompararNumerosController extends Controller
{
    use MultiTenancy;

    private const LEY_TOLERANCIA = 0.01; // ±0.01% para considerar leyes iguales

    private function normalizarFrente(string $nombre): string
    {
        return strtolower(preg_replace('/\s+/', '', $nombre));
    }

    private function normalizarJornada(string $jornada): string
    {
        $map = ['AM' => 'AM', 'PM' => 'PM', 'MADRUGADA' => 'Madrugada', 'NOCHE' => 'Noche'];
        return $map[strtoupper(trim($jornada))] ?? 'AM';
    }

    /**
     * Match Excel rows → BD dumpadas dentro de un grupo (mismo fecha+frente+jornada).
     *
     * Paso 1 — Por ley: para cada fila Excel con ley conocida, busca la BD
     *   dumpada cuya ley esté dentro de la tolerancia. Solo asigna si el match
     *   es único (1 candidato).
     *
     * Paso 2 — Posicional: las filas Excel y BD que quedaron sin asignar se
     *   emparejan por orden (pos 0→0, 1→1, ...).
     *
     * @param  array      $excelRows  Filas del Excel para el grupo
     * @param  \Illuminate\Support\Collection $dbDumpadas  Dumpadas BD ordenadas
     * @return array  Mapa excel_idx → ['db_idx' => int|null, 'tipo' => 'ley'|'posicional']
     */
    private function matchGrupo(array $excelRows, $dbDumpadas): array
    {
        $excelToDb  = [];   // excel_idx → ['db_idx', 'tipo']
        $dbUsados   = [];   // db_idx → true

        // ── Paso 1: match por ley ─────────────────────────────────────────────
        foreach ($excelRows as $exIdx => $exRow) {
            $exLey = $exRow['excel_ley'];
            if ($exLey === null) continue;

            $candidatos = [];
            foreach ($dbDumpadas as $dbIdx => $dbRow) {
                if (isset($dbUsados[$dbIdx])) continue;
                if ($dbRow->ley === null) continue;
                if (abs((float) $dbRow->ley - $exLey) <= self::LEY_TOLERANCIA) {
                    $candidatos[] = $dbIdx;
                }
            }

            if (count($candidatos) === 1) {
                $dbIdx = $candidatos[0];
                $excelToDb[$exIdx] = ['db_idx' => $dbIdx, 'tipo' => 'ley'];
                $dbUsados[$dbIdx]  = true;
            }
            // Si hay 0 o múltiples candidatos: deja sin asignar para el paso 2
        }

        // ── Paso 2: posicional para los que quedaron sin asignar ──────────────
        $excelSinAsignar = array_values(
            array_filter(range(0, count($excelRows) - 1), fn($i) => !isset($excelToDb[$i]))
        );
        $dbSinAsignar = array_values(
            array_filter(range(0, $dbDumpadas->count() - 1), fn($i) => !isset($dbUsados[$i]))
        );

        foreach ($excelSinAsignar as $pos => $exIdx) {
            if (isset($dbSinAsignar[$pos])) {
                $excelToDb[$exIdx] = ['db_idx' => $dbSinAsignar[$pos], 'tipo' => 'posicional'];
            } else {
                $excelToDb[$exIdx] = ['db_idx' => null, 'tipo' => 'sin_match'];
            }
        }

        return $excelToDb;
    }

    /**
     * Compara las filas del Excel con las dumpadas existentes en BD.
     * POST /api/dispatch/importar/comparar-numeros
     */
    public function comparar(Request $request)
    {
        $faenaId       = $request->input('faena_id');
        $dumpadasInput = $request->input('dumpadas', []);

        $frentesCache = FrenteTrabajo::where('id_faena', $faenaId)
            ->get()
            ->keyBy(fn($f) => $this->normalizarFrente($f->codigo_completo));

        $grupos               = [];
        $frentesNoEncontrados = [];

        foreach ($dumpadasInput as $d) {
            $puntoNorm = $this->normalizarFrente($d['punto'] ?? '');
            $frente    = $frentesCache->get($puntoNorm);

            if (!$frente) {
                $frentesNoEncontrados[] = $d['punto'] ?? '?';
                continue;
            }

            $fecha = null;
            if (!empty($d['fecha'])) {
                try { $fecha = Carbon::parse($d['fecha'])->format('Y-m-d'); } catch (\Exception $e) {}
            }

            $jornada = $this->normalizarJornada($d['jornada'] ?? 'AM');
            $key     = "{$fecha}|{$frente->id}|{$jornada}";

            $grupos[$key][] = [
                'excel_numero'      => (string) ($d['numero_dumpada'] ?? ''),
                'excel_acopios'     => $d['acopios']     ?? '',
                'excel_ley'         => isset($d['ley'])  ? (float) $d['ley']  : null,
                'excel_ton'         => isset($d['ton'])  ? (float) $d['ton']  : null,
                'excel_certificado' => $d['certificado'] ?? null,
                'frente_codigo'     => $frente->codigo_completo,
                'fecha'             => $fecha,
                'jornada'           => $jornada,
            ];
        }

        $resultados = [];

        foreach ($grupos as $key => $excelRows) {
            [$fecha, $frenteId, $jornada] = explode('|', $key, 3);

            $dbDumpadas = Dumpada::where('id_frente_trabajo', (int) $frenteId)
                ->where('jornada', $jornada)
                ->whereDate('fecha', $fecha)
                ->orderBy('numero_jornada', 'asc')
                ->orderBy('id', 'asc')
                ->get(['id', 'numero_dumpada', 'acopios', 'ley', 'ley_visual',
                       'nombre_maquina', 'ton', 'fecha', 'jornada', 'numero_jornada', 'estado'])
                ->values();

            // Match mejorado: ley primero, posicional como fallback
            $matchMap = $this->matchGrupo($excelRows, $dbDumpadas);

            foreach ($excelRows as $exIdx => $excelRow) {
                $match      = $matchMap[$exIdx] ?? ['db_idx' => null, 'tipo' => 'sin_match'];
                $dbRow      = $match['db_idx'] !== null ? $dbDumpadas->get($match['db_idx']) : null;
                $matchTipo  = $match['tipo'];
                $yaCoincide = $dbRow && (string) $dbRow->numero_dumpada === $excelRow['excel_numero'];

                $resultados[] = [
                    'excel' => [
                        'numero_dumpada' => $excelRow['excel_numero'],
                        'acopios'        => $excelRow['excel_acopios'],
                        'ley'            => $excelRow['excel_ley'],
                        'ton'            => $excelRow['excel_ton'],
                        'certificado'    => $excelRow['excel_certificado'],
                    ],
                    'db' => $dbRow ? [
                        'id'             => $dbRow->id,
                        'numero_dumpada' => $dbRow->numero_dumpada,
                        'acopios'        => $dbRow->acopios,
                        'ley'            => $dbRow->ley,
                        'ley_visual'     => $dbRow->ley_visual,
                        'nombre_maquina' => $dbRow->nombre_maquina,
                        'ton'            => $dbRow->ton,
                        'estado'         => $dbRow->estado,
                        'numero_jornada' => $dbRow->numero_jornada,
                    ] : null,
                    'frente_codigo' => $excelRow['frente_codigo'],
                    'fecha'         => $excelRow['fecha'],
                    'jornada'       => $excelRow['jornada'],
                    'posicion'      => $exIdx + 1,
                    'match_tipo'    => $matchTipo,   // 'ley' | 'posicional' | 'sin_match'
                    'ya_coincide'   => $yaCoincide,
                ];
            }
        }

        usort($resultados, function ($a, $b) {
            $ka = "{$b['fecha']}_{$a['frente_codigo']}_{$a['jornada']}";
            $kb = "{$a['fecha']}_{$b['frente_codigo']}_{$b['jornada']}";
            return strcmp($ka, $kb);
        });

        return response()->json([
            'success'                => true,
            'resultados'             => $resultados,
            'total'                  => count($resultados),
            'ya_coinciden'           => count(array_filter($resultados, fn($r) => $r['ya_coincide'])),
            'para_actualizar'        => count(array_filter($resultados, fn($r) => !$r['ya_coincide'] && $r['db'] !== null)),
            'sin_match_bd'           => count(array_filter($resultados, fn($r) => $r['db'] === null)),
            'frentes_no_encontrados' => array_values(array_unique($frentesNoEncontrados)),
        ]);
    }

    /**
     * Aplica la actualización de numero_dumpada y regenera acopios.
     * POST /api/dispatch/importar/actualizar-numeros
     */
    public function actualizarNumeros(Request $request)
    {
        $actualizaciones = $request->input('actualizaciones', []);

        DB::beginTransaction();
        try {
            $actualizadas = 0;
            $errores      = [];

            foreach ($actualizaciones as $act) {
                $dumpada = Dumpada::with('frenteTrabajo')->find($act['dumpada_id']);

                if (!$dumpada) {
                    $errores[] = "Dumpada ID {$act['dumpada_id']} no encontrada";
                    continue;
                }

                $nuevoNumero     = (string) $act['nuevo_numero_dumpada'];
                $frente          = $dumpada->frenteTrabajo;
                $fechaFormateada = Carbon::parse($dumpada->fecha)->format('d.m.Y');

                $nuevosAcopios = trim(
                    "{$frente->codigo_completo} {$dumpada->jornada} {$dumpada->numero_jornada} {$nuevoNumero} {$fechaFormateada}"
                );

                $dumpada->update([
                    'numero_dumpada' => $nuevoNumero,
                    'acopios'        => $nuevosAcopios,
                ]);

                $actualizadas++;
            }

            DB::commit();

            return response()->json([
                'success'      => true,
                'actualizadas' => $actualizadas,
                'errores'      => $errores,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[CompararNumeros] Error actualizando', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }
}
