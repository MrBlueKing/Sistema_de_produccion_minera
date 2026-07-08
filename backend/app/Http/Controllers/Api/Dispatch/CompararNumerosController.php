<?php

namespace App\Http\Controllers\Api\Dispatch;

use App\Http\Controllers\Controller;
use App\Models\Dispatch\Dumpada;
use App\Models\Ingenieria\FrenteTrabajo;
use App\Models\Ingenieria\TipoFrente;
use App\Traits\DescomponeFrenteTrabajo;
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
    use DescomponeFrenteTrabajo;

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
     * Limpia del resultado de descomponerNombreFrente() la información que solo
     * repite el tipo ya asignado (nombre o abreviatura), en dos casos:
     *   - numero_frente: se anula si coincide exacto con el tipo (ej. "DQ" cuando
     *     el tipo ya es "Dq"/abrev "DQ") — admite null, se puede dejar vacío.
     *   - manto: SOLO se anula cuando es la única palabra que quedó tras sacar el
     *     túnel (sin calle/hebra/numero) Y coincide con el tipo — ej. "NIVEL 1018 REC"
     *     con tipo "Rec" no aporta nada que "manto=REC" no repita ya. Si manto trae
     *     información real que no está en el tipo (ej. "ACOPIO" con tipo genérico
     *     "Frente"), se conserva intacto.
     */
    private function limpiarRedundanciaConTipo(array $descomp, ?string $tipoNombre, ?string $tipoAbreviatura): array
    {
        $nombreNorm = strtoupper(trim((string) $tipoNombre));
        $abrevNorm  = strtoupper(trim((string) $tipoAbreviatura));

        $coincideConTipo = function ($valor) use ($nombreNorm, $abrevNorm) {
            if ($valor === null || $valor === '') return false;
            // Se resuelve por alias también (ej. manto="DESQ" debe reconocerse
            // como el mismo tipo "Desquinche", no solo comparar el texto crudo).
            $valorNorm = $this->resolverAliasTipo((string) $valor);
            return ($abrevNorm !== '' && $valorNorm === $abrevNorm) || ($nombreNorm !== '' && $valorNorm === $nombreNorm);
        };

        if ($coincideConTipo($descomp['numero'])) {
            $descomp['numero'] = null;
        }

        $esUnicaPalabra = $descomp['calle'] === null && $descomp['hebra'] === null && $descomp['numero'] === null;
        if ($esUnicaPalabra && $coincideConTipo($descomp['manto'])) {
            $descomp['manto'] = null;
        }

        return $descomp;
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

    /**
     * [TEST] Compara el frente/tipo correcto (según Excel corregido) contra el
     * frente que tiene asignado hoy cada dumpada en BD. Matching directo por
     * numero_dumpada (dato confiable, no se vio afectado por el problema de columnas).
     * POST /api/dispatch/importar/comparar-frentes
     */
    public function compararFrentes(Request $request)
    {
        $faenaId       = $request->input('faena_id');
        $dumpadasInput = $request->input('dumpadas', []);

        $frentesCache = FrenteTrabajo::where('id_faena', $faenaId)
            ->get()
            ->keyBy(fn($f) => $this->normalizarFrente($f->codigo_completo));

        $tiposCache = TipoFrente::all()->keyBy(fn($t) => strtoupper(trim($t->nombre)));

        $dumpadasCache = Dumpada::where('id_faena', $faenaId)
            ->with('frenteTrabajo.tipoFrente')
            ->get(['id', 'numero_dumpada', 'id_frente_trabajo'])
            ->keyBy(fn($d) => (string) $d->numero_dumpada);

        $resultados        = [];
        $frentesNuevosSet   = []; // puntoNorm => detalle (para deduplicar)
        $tiposNuevosSet     = []; // tipoExcel => detalle (para deduplicar)

        foreach ($dumpadasInput as $d) {
            $numeroDumpada = (string) ($d['numero_dumpada'] ?? '');
            $puntoExcel    = trim($d['punto'] ?? '');
            $tipoExcel     = $this->resolverAliasTipo($d['tipo'] ?? '');
            $puntoNorm     = $this->normalizarFrente($puntoExcel);

            $dumpada = $dumpadasCache->get($numeroDumpada);
            if (!$dumpada) {
                $resultados[] = [
                    'numero_dumpada' => $numeroDumpada,
                    'punto_excel'    => $puntoExcel,
                    'tipo_excel'     => $tipoExcel,
                    'sin_match'      => true,
                    'ya_correcto'    => false,
                ];
                continue;
            }

            $frenteActual      = $dumpada->frenteTrabajo;
            $frenteCorrectoDB  = $frentesCache->get($puntoNorm);
            $tipoActualNombre  = strtoupper(trim($frenteActual?->tipoFrente?->nombre ?? ''));
            $tipoExisteDB      = $tiposCache->has($tipoExcel);

            $yaCorrecto = $frenteActual
                && $this->normalizarFrente($frenteActual->codigo_completo) === $puntoNorm
                && $tipoActualNombre === $tipoExcel;

            // El tipo solo se crea como parte de crear un frente nuevo (ver corregirFrentes):
            // si el frente ya existe, la corrección solo reasigna la dumpada sin tocar su tipo.
            if (!$yaCorrecto && !$frenteCorrectoDB) {
                if (!isset($frentesNuevosSet[$puntoNorm])) {
                    $frentesNuevosSet[$puntoNorm] = $this->previsualizarFrenteNuevo($puntoExcel, $tipoExcel, $tiposCache);
                }
                if (!$tipoExisteDB && !isset($tiposNuevosSet[$tipoExcel])) {
                    $tiposNuevosSet[$tipoExcel] = [
                        'nombre'      => ucfirst(strtolower($tipoExcel)),
                        'abreviatura' => substr($tipoExcel, 0, 3),
                    ];
                }
            }

            $resultados[] = [
                'dumpada_id'      => $dumpada->id,
                'numero_dumpada'  => $numeroDumpada,
                'punto_excel'     => $puntoExcel,
                'tipo_excel'      => $tipoExcel,
                'sin_match'       => false,
                'ya_correcto'     => $yaCorrecto,
                'frente_actual'   => $frenteActual ? [
                    'id'     => $frenteActual->id,
                    'codigo' => $frenteActual->codigo_completo,
                    'tipo'   => $frenteActual->tipoFrente->nombre ?? '—',
                ] : null,
                'frente_correcto' => [
                    'codigo'      => $frenteCorrectoDB->codigo_completo ?? $this->codigoSinEspacios($puntoExcel),
                    'existe'      => $frenteCorrectoDB !== null,
                    'tipo'        => $tipoExcel,
                    'tipo_existe' => $tipoExisteDB,
                ],
            ];
        }

        $paraCorregir = array_filter($resultados, fn($r) => !$r['sin_match'] && !$r['ya_correcto']);

        return response()->json([
            'success'            => true,
            'resultados'         => $resultados,
            'total'              => count($resultados),
            'ya_correctos'       => count(array_filter($resultados, fn($r) => $r['ya_correcto'])),
            'para_corregir'      => count($paraCorregir),
            'sin_match_bd'       => count(array_filter($resultados, fn($r) => $r['sin_match'])),
            'frentes_nuevos'     => count($frentesNuevosSet),
            'frentes_nuevos_lista' => array_values($frentesNuevosSet),
            'tipos_nuevos'       => count($tiposNuevosSet),
            'tipos_nuevos_lista' => array_values($tiposNuevosSet),
        ]);
    }

    /**
     * Calcula, sin guardar nada, cómo quedaría un frente si se crea a partir del
     * texto crudo del Excel — mismo resultado exacto que producirá corregirFrentes()
     * al aplicarse, incluyendo la deduplicación de numero_frente contra la
     * abreviatura del tipo (ej. "DQ" no se repite si el tipo ya es "Dq"/abrev "DQ").
     */
    private function previsualizarFrenteNuevo(string $puntoExcel, string $tipoExcel, $tiposCache): array
    {
        $descomp     = $this->descomponerNombreFrente($puntoExcel);
        $tipoActual  = $tiposCache->get($tipoExcel);
        $tipoEsNuevo = $tipoActual === null;

        // Si el tipo ya existe, se usa su abreviatura real (puede ser null/vacía,
        // en cuyo caso simplemente no hay nada contra qué deduplicar). Solo se
        // "inventa" una abreviatura (primeras 3 letras) cuando el tipo es nuevo,
        // igual que hace corregirFrentes() al crearlo con TipoFrente::firstOrCreate().
        $tipoNombre      = $tipoEsNuevo ? ucfirst(strtolower($tipoExcel)) : $tipoActual->nombre;
        $tipoAbreviatura = $tipoEsNuevo ? substr($tipoExcel, 0, 3) : $tipoActual->abreviatura;

        $descomp = $this->limpiarRedundanciaConTipo($descomp, $tipoNombre, $tipoAbreviatura);

        return [
            'codigo'           => $this->codigoSinEspacios($puntoExcel),
            'tunel'            => $descomp['tunel'],
            'manto'            => $descomp['manto'],
            'calle'            => $descomp['calle'],
            'hebra'            => $descomp['hebra'],
            'numero_frente'    => $descomp['numero'],
            'tipo'             => $tipoNombre,
            'tipo_abreviatura' => $tipoAbreviatura,
            'tipo_nuevo'       => $tipoEsNuevo,
        ];
    }

    /**
     * [TEST] Aplica la corrección de frente/tipo a las dumpadas seleccionadas.
     * Crea el frente correcto si todavía no existe (misma lógica que el importador).
     * No elimina los frentes viejos que queden sin dumpadas asociadas.
     * POST /api/dispatch/importar/corregir-frentes
     */
    public function corregirFrentes(Request $request)
    {
        $faenaId         = $request->input('faena_id');
        $correcciones    = $request->input('correcciones', []); // [{dumpada_id, punto, tipo}]

        DB::beginTransaction();
        try {
            $frentesCache = FrenteTrabajo::where('id_faena', $faenaId)
                ->get()->keyBy(fn($f) => $this->normalizarFrente($f->codigo_completo));

            $tiposCache = TipoFrente::all()->keyBy(fn($t) => strtoupper(trim($t->nombre)));

            $corregidas    = 0;
            $frentesCreados = 0;
            $errores       = [];

            foreach ($correcciones as $c) {
                try {
                    $dumpada = Dumpada::find($c['dumpada_id']);
                    if (!$dumpada) {
                        $errores[] = "Dumpada ID {$c['dumpada_id']} no encontrada";
                        continue;
                    }

                    $puntoExcel = trim($c['punto'] ?? '');
                    $tipoNombre = $this->resolverAliasTipo($c['tipo'] ?? 'FRENTE');
                    $puntoNorm  = $this->normalizarFrente($puntoExcel);

                    if (!$frentesCache->has($puntoNorm)) {
                        $tipoFrente = $tiposCache->get($tipoNombre);
                        if (!$tipoFrente) {
                            $nombreTipo = ucfirst(strtolower($tipoNombre));
                            $tipoFrente = TipoFrente::firstOrCreate(
                                ['nombre' => $nombreTipo],
                                ['abreviatura' => substr($tipoNombre, 0, 3)]
                            );
                            $tiposCache->put(strtoupper($tipoFrente->nombre), $tipoFrente);
                        }

                        $descomp = $this->descomponerNombreFrente($puntoExcel);
                        $descomp = $this->limpiarRedundanciaConTipo($descomp, $tipoFrente->nombre, $tipoFrente->abreviatura);

                        $nuevoFrente = FrenteTrabajo::create([
                            'codigo_completo' => $this->codigoSinEspacios($puntoExcel),
                            'tunel'           => $descomp['tunel'],
                            'manto'           => $descomp['manto'],
                            'calle'           => $descomp['calle'],
                            'hebra'           => $descomp['hebra'],
                            'numero_frente'   => $descomp['numero'],
                            'id_tipo_frente'  => $tipoFrente->id,
                            'id_faena'        => $faenaId,
                            'estado'          => 'activo',
                        ]);
                        $frentesCache->put($puntoNorm, $nuevoFrente);
                        $frentesCreados++;
                    }

                    $dumpada->update(['id_frente_trabajo' => $frentesCache->get($puntoNorm)->id]);
                    $corregidas++;

                } catch (\Exception $e) {
                    $errores[] = "Dumpada ID {$c['dumpada_id']}: {$e->getMessage()}";
                }
            }

            DB::commit();

            return response()->json([
                'success'         => true,
                'corregidas'      => $corregidas,
                'frentes_creados' => $frentesCreados,
                'errores'         => $errores,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[CompararNumeros] Error corrigiendo frentes', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * [TEST] Compara la fecha correcta (según Excel corregido) contra la fecha
     * que tiene asignada hoy cada dumpada en BD. Matching directo por
     * numero_dumpada (dato confiable, no se vio afectado por el problema de columnas).
     * POST /api/dispatch/importar/comparar-fechas
     */
    public function compararFechas(Request $request)
    {
        $faenaId       = $request->input('faena_id');
        $dumpadasInput = $request->input('dumpadas', []);

        $dumpadasCache = Dumpada::where('id_faena', $faenaId)
            ->get(['id', 'numero_dumpada', 'fecha'])
            ->keyBy(fn($d) => (string) $d->numero_dumpada);

        $resultados = [];

        foreach ($dumpadasInput as $d) {
            $numeroDumpada = (string) ($d['numero_dumpada'] ?? '');
            $fechaExcel    = $d['fecha'] ?? null; // formato Y-m-d, ya parseado en el frontend

            $dumpada = $dumpadasCache->get($numeroDumpada);
            if (!$dumpada) {
                $resultados[] = [
                    'numero_dumpada' => $numeroDumpada,
                    'fecha_excel'    => $fechaExcel,
                    'sin_match'      => true,
                    'ya_correcto'    => false,
                ];
                continue;
            }

            $fechaActual = $dumpada->fecha ? Carbon::parse($dumpada->fecha)->format('Y-m-d') : null;
            $yaCorrecto  = $fechaExcel !== null && $fechaActual === $fechaExcel;

            $resultados[] = [
                'dumpada_id'      => $dumpada->id,
                'numero_dumpada'  => $numeroDumpada,
                'fecha_actual'    => $fechaActual,
                'fecha_excel'     => $fechaExcel,
                'sin_match'       => false,
                'ya_correcto'     => $yaCorrecto,
            ];
        }

        $paraCorregir = array_filter($resultados, fn($r) => !$r['sin_match'] && !$r['ya_correcto']);

        return response()->json([
            'success'       => true,
            'resultados'    => $resultados,
            'total'         => count($resultados),
            'ya_correctos'  => count(array_filter($resultados, fn($r) => $r['ya_correcto'])),
            'para_corregir' => count($paraCorregir),
            'sin_match_bd'  => count(array_filter($resultados, fn($r) => $r['sin_match'])),
        ]);
    }

    /**
     * [TEST] Aplica la corrección de fecha a las dumpadas seleccionadas.
     * POST /api/dispatch/importar/corregir-fechas
     */
    public function corregirFechas(Request $request)
    {
        $correcciones = $request->input('correcciones', []); // [{dumpada_id, fecha}]

        DB::beginTransaction();
        try {
            $corregidas = 0;
            $errores    = [];

            foreach ($correcciones as $c) {
                try {
                    $dumpada = Dumpada::find($c['dumpada_id']);
                    if (!$dumpada) {
                        $errores[] = "Dumpada ID {$c['dumpada_id']} no encontrada";
                        continue;
                    }

                    $dumpada->update(['fecha' => $c['fecha']]);
                    $corregidas++;

                } catch (\Exception $e) {
                    $errores[] = "Dumpada ID {$c['dumpada_id']}: {$e->getMessage()}";
                }
            }

            DB::commit();

            return response()->json([
                'success'    => true,
                'corregidas' => $corregidas,
                'errores'    => $errores,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[CompararNumeros] Error corrigiendo fechas', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * [TEST] Revisa, frente por frente (no dumpada por dumpada), si la estructura
     * guardada (tunel/manto/calle/hebra/numero_frente) coincide con la que el trait
     * de descomposición calcularía hoy a partir del texto real del Excel (con espacios).
     * Útil para frentes creados antes de reconocer el prefijo "NIVEL" como túnel:
     * su codigo_completo ya es correcto (el matching de dumpadas sigue funcionando),
     * pero sus columnas estructuradas quedaron mal descompuestas.
     * No depende de si la dumpada individual está "ya correcta" o no.
     * POST /api/dispatch/importar/comparar-estructura
     */
    public function compararEstructura(Request $request)
    {
        $faenaId       = $request->input('faena_id');
        $dumpadasInput = $request->input('dumpadas', []);

        $frentesPorCodigo = FrenteTrabajo::where('id_faena', $faenaId)
            ->with('tipoFrente')
            ->get()
            ->keyBy(fn($f) => $this->normalizarFrente($f->codigo_completo));

        $dumpadasPorFrente = Dumpada::where('id_faena', $faenaId)
            ->selectRaw('id_frente_trabajo, COUNT(*) as total')
            ->groupBy('id_frente_trabajo')
            ->pluck('total', 'id_frente_trabajo');

        $normalizar = fn($v) => $v === null ? '' : trim((string) $v);
        $vistos     = [];
        $resultados = [];

        foreach ($dumpadasInput as $d) {
            $puntoExcel = trim($d['punto'] ?? '');
            $puntoNorm  = $this->normalizarFrente($puntoExcel);
            if ($puntoNorm === '' || isset($vistos[$puntoNorm])) {
                continue;
            }
            $vistos[$puntoNorm] = true;

            $frente = $frentesPorCodigo->get($puntoNorm);
            if (!$frente) {
                continue; // no existe aún: eso lo resuelve el modo "Frente/Tipo", no este
            }

            $descomp = $this->descomponerNombreFrente($puntoExcel);
            $descomp = $this->limpiarRedundanciaConTipo(
                $descomp,
                $frente->tipoFrente->nombre ?? null,
                $frente->tipoFrente->abreviatura ?? null
            );

            $actual = [
                'tunel'         => $frente->tunel,
                'manto'         => $frente->manto,
                'calle'         => $frente->calle,
                'hebra'         => $frente->hebra,
                'numero_frente' => $frente->numero_frente,
            ];
            $propuesto = [
                'tunel'         => $descomp['tunel'],
                'manto'         => $descomp['manto'],
                'calle'         => $descomp['calle'],
                'hebra'         => $descomp['hebra'],
                'numero_frente' => $descomp['numero'],
            ];

            $difiere = false;
            foreach ($actual as $campo => $valorActual) {
                if ($normalizar($valorActual) !== $normalizar($propuesto[$campo])) {
                    $difiere = true;
                    break;
                }
            }

            if ($difiere) {
                $resultados[] = [
                    'frente_id'          => $frente->id,
                    'codigo'             => $frente->codigo_completo,
                    'dumpadas_asociadas' => (int) ($dumpadasPorFrente[$frente->id] ?? 0),
                    'actual'             => $actual,
                    'propuesto'          => $propuesto,
                ];
            }
        }

        usort($resultados, fn($a, $b) => $b['dumpadas_asociadas'] <=> $a['dumpadas_asociadas']);

        return response()->json([
            'success'    => true,
            'resultados' => $resultados,
            'total'      => count($resultados),
        ]);
    }

    /**
     * [TEST] Aplica la reparación de estructura a los frentes seleccionados.
     * Solo toca tunel/manto/calle/hebra/numero_frente — nunca codigo_completo
     * ni id_tipo_frente, por lo que ninguna dumpada existente se ve afectada
     * (siguen matcheando por codigo_completo, que no cambia).
     * POST /api/dispatch/importar/corregir-estructura
     */
    public function corregirEstructura(Request $request)
    {
        $correcciones = $request->input('correcciones', []); // [{frente_id, tunel, manto, calle, hebra, numero_frente}]

        DB::beginTransaction();
        try {
            $corregidos = 0;
            $errores    = [];

            foreach ($correcciones as $c) {
                try {
                    $frente = FrenteTrabajo::find($c['frente_id']);
                    if (!$frente) {
                        $errores[] = "Frente ID {$c['frente_id']} no encontrado";
                        continue;
                    }

                    $frente->update([
                        'tunel'         => $c['tunel'] ?: null,
                        'manto'         => $c['manto'],
                        'calle'         => $c['calle'] ?: null,
                        'hebra'         => $c['hebra'] ?: null,
                        'numero_frente' => $c['numero_frente'] ?: null,
                    ]);
                    $corregidos++;

                } catch (\Exception $e) {
                    $errores[] = "Frente ID {$c['frente_id']}: {$e->getMessage()}";
                }
            }

            DB::commit();

            return response()->json([
                'success'    => true,
                'corregidos' => $corregidos,
                'errores'    => $errores,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[CompararNumeros] Error corrigiendo estructura de frentes', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }
}
