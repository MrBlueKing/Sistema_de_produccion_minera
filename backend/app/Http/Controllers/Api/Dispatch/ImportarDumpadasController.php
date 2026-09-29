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

class ImportarDumpadasController extends Controller
{
    use MultiTenancy;
    use DescomponeFrenteTrabajo;

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
     * quita espacios y guiones internos, y convierte a minúsculas.
     * "M3 -12S RP", "M3-12SRP" y "M312SRP" quedan igual → "m312srp"
     *
     * IMPORTANTE: se quitan los guiones porque el Excel de origen escribe
     * el mismo frente de forma inconsistente (con y sin guión, ej.
     * "M5-1SH2REC" vs "M51SH2REC"). Antes de este fix, esa inconsistencia
     * hacía que el importador creara un frente_trabajo fantasma nuevo cada
     * vez que aparecía la variante distinta, duplicando el frente real.
     */
    private function normalizarFrente(string $nombre): string
    {
        return strtolower(preg_replace('/[\s\-]+/', '', $nombre));
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
                'tunel_a_crear'    => $this->descomponerNombreFrente($nombre)['tunel'],
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
     * Obtiene el nombre de texto de una faena desde el sistema central.
     * Llamada única por request para no hacer N peticiones HTTP.
     */
    private function obtenerNombreFaena(int|string $idFaena, ?string $token): ?string
    {
        if (!$idFaena || !$token) return null;
        try {
            $response = \Illuminate\Support\Facades\Http::withToken($token)
                ->get(config('services.sistema_central_api') . '/faenas');
            if ($response->successful()) {
                $faenas = $response->json('data', []);
                $faena  = collect($faenas)->firstWhere('id', $idFaena);
                return $faena ? ($faena['ubicacion'] ?? $faena['nombre'] ?? null) : null;
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning('ImportarDumpadas: no se pudo obtener nombre de faena', [
                'id_faena' => $idFaena, 'error' => $e->getMessage(),
            ]);
        }
        return null;
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

        // Obtener nombre de faena una sola vez para toda la importación
        $nombreFaena = $this->obtenerNombreFaena($faenaId, $request->bearerToken());

        $creadas      = 0;
        $saltadas     = 0;
        $actualizadas = 0;
        $duplicadosEnArchivo = 0;
        $errores      = [];
        $frentesCreados = [];

        // Cache frentes BD indexado por nombre normalizado (sin espacios, lowercase)
        $frentesCache = FrenteTrabajo::where('id_faena', $faenaId)
            ->get()->keyBy(fn($f) => $this->normalizarFrente($f->codigo_completo));

        // Cache tipos de frente (clave = nombre en MAYÚSCULAS)
        $tiposCache = TipoFrente::all()->keyBy(fn($t) => strtoupper(trim($t->nombre)));

        // Dumpadas existentes indexadas por numero_dumpada (incluye ley para saber si actualizar)
        $dumpadasExistentes = Dumpada::where('id_faena', $faenaId)
            ->get(['id', 'numero_dumpada', 'ley'])
            ->keyBy(fn($d) => (string) $d->numero_dumpada);

        // Contador de numero_jornada en memoria para evitar N queries
        // Precarga el máximo actual por frente+jornada+fecha
        $jornadaCounter = [];

        // Numero_dumpada ya vistos dentro de ESTA corrida (ver nota mas abajo)
        $vistosEnEsteImport = [];

        foreach ($dumpadasInput as $i => $d) {
            try {
                $numeroDumpada = (string) ($d['numero_dumpada'] ?? '');

                // Detecta si este numero_dumpada ya aparecio antes DENTRO de este
                // mismo archivo (no contra la BD) - el Excel de origen es propenso
                // a traer el mismo N°Acop repetido. Sin este chequeo, la fila repetida
                // se procesaria contra el estado de la BD ANTES de correr el import
                // (el cache no se reflejaba con lo creado en la misma corrida), creando
                // un duplicado real en la tabla - el mismo tipo de error que ya se
                // corrigio manualmente para Cabildo el 25-jul.
                if (isset($vistosEnEsteImport[$numeroDumpada])) {
                    $duplicadosEnArchivo++;
                }
                $vistosEnEsteImport[$numeroDumpada] = true;

                $dumpadaExistente = $dumpadasExistentes->get($numeroDumpada);
                if ($dumpadaExistente !== null && $dumpadaExistente->ley !== null) {
                    $saltadas++;
                    continue;
                }

                $puntoNombre  = trim($d['punto'] ?? '');
                $puntoNorm    = $this->normalizarFrente($puntoNombre);
                $tipoNombre   = $this->resolverAliasTipo($d['tipo'] ?? 'FRENTE');

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
                    $frentesCreados[$puntoNorm] = $nuevoFrente->codigo_completo;
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
                        ->deFechaCorrelativo($fecha)
                        ->max('numero_jornada') ?: 0;
                }
                $jornadaCounter[$counterKey]++;
                $numeroJornada = $jornadaCounter[$counterKey];

                // Código de acopio (mismo formato que el ingreso manual, no el texto crudo del Excel)
                $fechaFormateada = $fecha ? Carbon::parse($fecha)->format('d.m.Y') : '';
                $acopiosGenerado = trim("{$frente->codigo_completo} {$numeroDumpada} {$fechaFormateada} {$jornada}-{$numeroJornada}");

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

                // Existe pero sin ley → actualizar solo campos de análisis
                if ($dumpadaExistente !== null) {
                    $dumpadaExistente->update([
                        'ley'          => $ley,
                        'ley_cup'      => $leyCup,
                        'cu_soluble'   => $cuSoluble,
                        'cu_insoluble' => $cuInsoluble,
                        'certificado'  => $certificado,
                        'ley_visual'   => $leyVisual,
                        'rango'        => $d['rango'] ?? null,
                        'estado'       => $estado,
                    ]);
                    $actualizadas++;
                    continue;
                }

                $nuevaDumpada = Dumpada::create([
                    'id_frente_trabajo' => $frente->id,
                    'id_faena'          => $faenaId,
                    'faena'             => $nombreFaena,
                    'numero_dumpada'    => $numeroDumpada,
                    'acopios'           => $acopiosGenerado,
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

                // Registrar la fila recien creada en el cache: si el mismo
                // numero_dumpada vuelve a aparecer mas abajo en este mismo
                // archivo, la proxima vuelta del loop la debe encontrar aqui
                // (y actualizarla o saltarla) en vez de crear un duplicado.
                $dumpadasExistentes->put($numeroDumpada, $nuevaDumpada);

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
            'success'              => true,
            'creadas'              => $creadas,
            'actualizadas'         => $actualizadas,
            'saltadas'             => $saltadas,
            'duplicados_en_archivo' => $duplicadosEnArchivo,
            'frentes_creados'      => array_values($frentesCreados),
            'errores'              => $errores,
        ]);
    }
}
