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
 * Matching por: fecha + frente + jornada, luego posición dentro del grupo.
 */
class CompararNumerosController extends Controller
{
    use MultiTenancy;

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
     * Compara las filas del Excel con las dumpadas existentes en BD.
     * POST /api/dispatch/importar/comparar-numeros
     * Body: { faena_id, dumpadas: [{punto, jornada, fecha, numero_dumpada, ley, ton, acopios}, ...] }
     */
    public function comparar(Request $request)
    {
        $faenaId       = $request->input('faena_id');
        $dumpadasInput = $request->input('dumpadas', []);

        // Cache frentes BD indexado por nombre normalizado
        $frentesCache = FrenteTrabajo::where('id_faena', $faenaId)
            ->get()
            ->keyBy(fn($f) => $this->normalizarFrente($f->codigo_completo));

        $grupos          = [];
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
                'excel_acopios'     => $d['acopios']      ?? '',
                'excel_ley'         => isset($d['ley'])   ? (float) $d['ley']   : null,
                'excel_ton'         => isset($d['ton'])   ? (float) $d['ton']   : null,
                'excel_certificado' => $d['certificado']  ?? null,
                'frente_id'         => $frente->id,
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

            foreach ($excelRows as $pos => $excelRow) {
                $dbRow      = $dbDumpadas->get($pos);
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
                    'posicion'      => $pos + 1,
                    'ya_coincide'   => $yaCoincide,
                ];
            }
        }

        // Ordenar: fecha desc → frente → jornada
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
     * Body: { actualizaciones: [{dumpada_id, nuevo_numero_dumpada}, ...] }
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
