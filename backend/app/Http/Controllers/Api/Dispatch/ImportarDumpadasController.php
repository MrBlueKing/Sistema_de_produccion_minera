<?php

namespace App\Http\Controllers\Api\Dispatch;

use App\Http\Controllers\Controller;
use App\Models\Dispatch\Dumpada;
use App\Models\Ingenieria\FrenteTrabajo;
use App\Models\Ingenieria\TipoFrente;
use App\Traits\MultiTenancy;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ImportarDumpadasController extends Controller
{
    use MultiTenancy;

    private function normalizarJornada(string $jornada): string
    {
        $map = [
            'AM'        => 'AM',
            'PM'        => 'PM',
            'MADRUGADA' => 'Madrugada',
            'NOCHE'     => 'Noche',
        ];
        return $map[strtoupper(trim($jornada))] ?? 'AM';
    }

    /**
     * Normaliza un nombre de frente para comparación:
     * quita espacios internos y convierte a minúsculas.
     * "M3 -12S RP" y "M3-12SRP" quedan igual → "m3-12srp"
     */
    private function normalizarFrente(string $nombre): string
    {
        return strtolower(preg_replace('/\s+/', '', $nombre));
    }

    /**
     * Genera el codigo_completo sin espacios a partir del nombre del Excel.
     * Equivale a lo que haría el formulario manual al concatenar componentes.
     * "M5 -4SH2 REC" → "M5-4SH2REC"
     */
    private function codigoSinEspacios(string $nombre): string
    {
        return preg_replace('/\s+/', '', $nombre);
    }

    /**
     * Descompone el nombre del frente (Excel) en sus campos estructurales.
     *
     * Patrones reconocidos:
     *   M5 -1SH2 REC  → manto=M5, calle=-1, hebra=SH, numero=2REC
     *   M3 -11S REC   → manto=M3, calle=-11S, numero=REC
     *   M3 -11S       → manto=M3, calle=-11S
     *   DRIFT 468     → manto=DRIFT, calle=468
     *
     * @return array{manto:string, calle:string|null, hebra:string|null, numero_frente:string|null}
     */
    private function descomponerNombreFrente(string $nombre): array
    {
        $partes  = preg_split('/\s+/', trim($nombre));
        $manto   = $partes[0] ?? $nombre;
        $calle   = null;
        $hebra   = null;
        $numero  = null;

        if (count($partes) < 2) {
            return compact('manto', 'calle', 'hebra', 'numero');
        }

        $seg   = $partes[1];
        $resto = array_slice($partes, 2);

        // Patrón M5: "-1SH2", "1NH2", "-4SH2" → calle + hebra (NH/SH) + número
        if (preg_match('/^(-?\d+)(NH|SH)(\d*.*)$/i', $seg, $m)) {
            $calle  = $m[1];
            $hebra  = strtoupper($m[2]);
            $numero = $m[3] . implode('', $resto) ?: null;
            return compact('manto', 'calle', 'hebra', 'numero');
        }

        // Patrón M3: "-11S", "-10N", "11S", "10N" → calle incluye letra de dirección
        if (preg_match('/^(-?\d+[NS])$/i', $seg, $m)) {
            $calle  = strtoupper($m[1]);
            $numero = $resto ? implode('', $resto) : null;
            return compact('manto', 'calle', 'hebra', 'numero');
        }

        // Número puro: "468", "1", "-2" → calle sin letra
        if (preg_match('/^(-?\d+)$/', $seg, $m)) {
            $calle  = $m[1];
            $numero = $resto ? implode('', $resto) : null;
            return compact('manto', 'calle', 'hebra', 'numero');
        }

        // No reconoce patrón → todo el resto en numero_frente
        $numero = implode(' ', array_slice($partes, 1));
        return compact('manto', 'calle', 'hebra', 'numero');
    }

    /**
     * Preview: verifica qué frentes existen en BD para la faena dada.
     * POST /api/dispatch/importar/preview
     * Body: { faena_id, frentes: [{nombre, tipo}, ...] }
     */
    public function preview(Request $request)
    {
        $faenaId      = $request->input('faena_id');
        $frentesInput = $request->input('frentes', []);

        // Indexar por nombre normalizado (sin espacios, lowercase) para comparación tolerante
        $frentesDB = FrenteTrabajo::where('id_faena', $faenaId)
            ->withTrashed(false)
            ->get(['id', 'codigo_completo'])
            ->keyBy(fn($f) => $this->normalizarFrente($f->codigo_completo));

        $resultado = [];
        foreach ($frentesInput as $f) {
            $nombre      = trim($f['nombre'] ?? '');
            $tipo        = $f['tipo'] ?? '';
            $normalizado = $this->normalizarFrente($nombre);
            $frenteDB    = $frentesDB->get($normalizado);

            $resultado[] = [
                'nombre'           => $nombre,
                'codigo_a_crear'   => $this->codigoSinEspacios($nombre), // código que se guardará si se crea
                'manto_a_crear'    => $this->descomponerNombreFrente($nombre)['manto'],
                'tipo'             => $tipo,
                'existe'           => $frenteDB !== null,
                'id'               => $frenteDB?->id,
                'codigo_existente' => $frenteDB?->codigo_completo,
            ];
        }

        return response()->json([
            'success' => true,
            'frentes' => $resultado,
        ]);
    }

    /**
     * Confirmar importación masiva de dumpadas.
     * POST /api/dispatch/importar/confirmar
     * Body: { faena_id, tipo_ley, dumpadas: [...] }
     */
    public function confirmar(Request $request)
    {
        $faenaId      = $request->input('faena_id');
        $tipoLey      = $request->input('tipo_ley', 'cu_insoluble');
        $dumpadasInput = $request->input('dumpadas', []);

        $creadas  = 0;
        $saltadas = 0;
        $errores  = [];

        // Cache frentes BD indexado por nombre normalizado (sin espacios, lowercase)
        $frentesCache = FrenteTrabajo::where('id_faena', $faenaId)
            ->get()->keyBy(fn($f) => $this->normalizarFrente($f->codigo_completo));

        // Cache tipos de frente (clave = nombre en MAYÚSCULAS)
        $tiposCache = TipoFrente::all()->keyBy(fn($t) => strtoupper(trim($t->nombre)));

        // Números de dumpada ya existentes para esta faena (lookup O(1))
        $numerosExistentes = Dumpada::where('id_faena', $faenaId)
            ->pluck('numero_dumpada')
            ->map(fn($n) => (string) $n)
            ->flip();

        // Contador de numero_jornada en memoria para evitar N queries
        // Precarga el máximo actual por frente+jornada+fecha
        $jornadaCounter = [];

        foreach ($dumpadasInput as $i => $d) {
            try {
                $numeroDumpada = (string) ($d['numero_dumpada'] ?? '');

                if (isset($numerosExistentes[$numeroDumpada])) {
                    $saltadas++;
                    continue;
                }

                $puntoNombre  = trim($d['punto'] ?? '');
                $puntoNorm    = $this->normalizarFrente($puntoNombre);
                $tipoNombre   = strtoupper(trim($d['tipo'] ?? 'FRENTE'));

                // Obtener o crear frente (lookup por nombre normalizado)
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

                    $descomp = $this->descomponerNombreFrente($puntoNombre);
                    $nuevoFrente = FrenteTrabajo::create([
                        'codigo_completo' => $this->codigoSinEspacios($puntoNombre),
                        'manto'           => $descomp['manto'],
                        'calle'           => $descomp['calle'],
                        'hebra'           => $descomp['hebra'],
                        'numero_frente'   => $descomp['numero'],
                        'id_tipo_frente'  => $tipoFrente->id,
                        'id_faena'        => $faenaId,
                        'estado'          => 'activo',
                    ]);
                    $frentesCache->put($puntoNorm, $nuevoFrente);
                }

                $frente  = $frentesCache->get($puntoNorm);
                $jornada = $this->normalizarJornada($d['jornada'] ?? 'AM');

                $fecha = null;
                if (!empty($d['fecha'])) {
                    try {
                        $fecha = Carbon::parse($d['fecha'])->format('Y-m-d');
                    } catch (\Exception $e) {
                        $fecha = now()->format('Y-m-d');
                    }
                }

                // numero_jornada desde memoria (evita una query por fila)
                $counterKey = "{$frente->id}_{$jornada}_{$fecha}";
                if (!isset($jornadaCounter[$counterKey])) {
                    $jornadaCounter[$counterKey] = (int) Dumpada::where('id_frente_trabajo', $frente->id)
                        ->where('jornada', $jornada)
                        ->whereDate('fecha', $fecha)
                        ->max('numero_jornada') ?: 0;
                }
                $jornadaCounter[$counterKey]++;
                $numeroJornada = $jornadaCounter[$counterKey];

                // Ley (ya viene como porcentaje desde el frontend, ej: 2.64)
                $ley      = isset($d['ley'])      ? (float) $d['ley']      : null;
                $leyCup   = isset($d['ley_cup'])  ? (float) $d['ley_cup']  : $ley;
                $leyVisual = isset($d['ley_visual']) ? (float) $d['ley_visual'] : 0;

                // Mapear ley al campo correcto según tipo_ley
                $cuSoluble   = null;
                $cuInsoluble = null;
                if ($tipoLey === 'cu_insoluble') {
                    $cuInsoluble = $ley;
                } elseif ($tipoLey === 'cu_soluble') {
                    $cuSoluble = $ley;
                }

                $certificado = isset($d['certificado']) && $d['certificado'] !== '' && $d['certificado'] !== null
                    ? (string) $d['certificado']
                    : null;

                $estado = ($ley !== null && $leyCup !== null && $certificado !== null)
                    ? Dumpada::ESTADO_COMPLETADO
                    : Dumpada::ESTADO_INGRESADO;

                Dumpada::create([
                    'id_frente_trabajo' => $frente->id,
                    'id_faena'          => $faenaId,
                    'numero_dumpada'    => $numeroDumpada,
                    'acopios'           => $d['acopios'] ?? '',
                    'jornada'           => $jornada,
                    'numero_jornada'    => $numeroJornada,
                    'fecha'             => $fecha,
                    'ton'               => isset($d['ton']) ? (float) $d['ton'] : 4.6,
                    'ley'               => $ley,
                    'ley_cup'           => $leyCup,
                    'cu_soluble'        => $cuSoluble,
                    'cu_insoluble'      => $cuInsoluble,
                    'certificado'       => $certificado,
                    'ley_visual'        => $leyVisual,
                    'rango'             => $d['rango'] ?? null,
                    'estado'            => $estado,
                    'user_id'           => $request->auth_user_id,
                ]);

                $numerosExistentes[$numeroDumpada] = 1;
                $creadas++;

            } catch (\Exception $e) {
                $errores[] = [
                    'index'          => $i,
                    'numero_dumpada' => $d['numero_dumpada'] ?? '?',
                    'punto'          => $d['punto'] ?? '?',
                    'error'          => $e->getMessage(),
                ];
                Log::error('Error importando dumpada', [
                    'index'   => $i,
                    'error'   => $e->getMessage(),
                    'dumpada' => $d,
                ]);
            }
        }

        return response()->json([
            'success'  => true,
            'creadas'  => $creadas,
            'saltadas' => $saltadas,
            'errores'  => $errores,
        ]);
    }
}
