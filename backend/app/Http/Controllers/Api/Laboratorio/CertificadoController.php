<?php

namespace App\Http\Controllers\Api\Laboratorio;

use App\Http\Controllers\Controller;
use App\Services\CertificadoPdfService;
use App\Models\Dispatch\Dumpada;
use App\Models\Dispatch\MuestraLibre;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CertificadoController extends Controller
{
    protected $certificadoService;

    public function __construct(CertificadoPdfService $certificadoService)
    {
        $this->certificadoService = $certificadoService;
    }

    /**
     * Listar dumpadas disponibles para generar certificado
     * (dumpadas con análisis completo: ley, cu_soluble, cu_insoluble, certificado)
     */
    public function dumpadasDisponibles(Request $request)
    {
        $idFaena = $request->get('id_faena');

        $query = Dumpada::with('frenteTrabajo')
            ->conAnalisisCompleto()
            ->orderBy('fecha', 'desc')
            ->orderBy('numero_jornada', 'desc');

        if ($idFaena) {
            $query->where('id_faena', $idFaena);
        }

        $dumpadas = $query->get();

        // Agregar el código completo a cada dumpada
        $dumpadas->each(function ($dumpada) {
            $dumpada->codigo_completo = $dumpada->generarCodigoCompleto();
        });

        return response()->json([
            'success' => true,
            'data' => $dumpadas,
            'total' => $dumpadas->count()
        ]);
    }

    /**
     * Validar selección de dumpadas antes de generar certificado
     * Retorna información sobre qué acción se puede tomar
     */
    public function validarSeleccion(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'dumpada_ids' => 'required|array|min:1',
            'dumpada_ids.*' => 'required|integer|exists:dumpadas,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $dumpadas = Dumpada::whereIn('id', $request->dumpada_ids)->get();

        // Separar dumpadas con y sin certificado
        $conCertificado = $dumpadas->whereNotNull('certificado');
        $sinCertificado = $dumpadas->whereNull('certificado');

        // Caso 1: Todas SIN certificado → Puede generar nuevo
        if ($conCertificado->isEmpty()) {
            return response()->json([
                'success' => true,
                'accion' => 'generar_nuevo',
                'mensaje' => 'Puede generar un nuevo certificado',
                'total_dumpadas' => $sinCertificado->count()
            ]);
        }

        // Caso 2: Todas CON certificado
        if ($sinCertificado->isEmpty()) {
            // Verificar si todas son del MISMO certificado
            $certificadosUnicos = $conCertificado->pluck('certificado')->unique();

            if ($certificadosUnicos->count() === 1) {
                $numeroCertificado = $certificadosUnicos->first();
                // Obtener TODAS las dumpadas de ese certificado (no solo las seleccionadas)
                $totalDumpadasCertificado = Dumpada::where('certificado', $numeroCertificado)->count();

                return response()->json([
                    'success' => true,
                    'accion' => 'regenerar',
                    'mensaje' => "Las dumpadas seleccionadas pertenecen al certificado {$numeroCertificado}. Se regenerará con todas sus {$totalDumpadasCertificado} muestras.",
                    'numero_certificado' => $numeroCertificado,
                    'total_dumpadas' => $totalDumpadasCertificado
                ]);
            } else {
                // Son de DIFERENTES certificados
                $listaCertificados = $certificadosUnicos->implode(', ');
                return response()->json([
                    'success' => false,
                    'accion' => 'error_diferentes_certificados',
                    'mensaje' => "No puede mezclar dumpadas de diferentes certificados. Las dumpadas seleccionadas pertenecen a: {$listaCertificados}",
                    'certificados' => $certificadosUnicos->values()
                ], 400);
            }
        }

        // Caso 3: MEZCLA de con y sin certificado
        $certificadosExistentes = $conCertificado->pluck('certificado')->unique()->implode(', ');
        $idsConCertificado = $conCertificado->pluck('numero_dumpada')->implode(', ');

        return response()->json([
            'success' => false,
            'accion' => 'error_mezcla',
            'mensaje' => "No puede mezclar dumpadas con y sin certificado. Las dumpadas N° {$idsConCertificado} ya pertenecen al certificado: {$certificadosExistentes}",
            'dumpadas_con_certificado' => $conCertificado->map(fn($d) => [
                'id' => $d->id,
                'numero_dumpada' => $d->numero_dumpada,
                'certificado' => $d->certificado
            ])->values(),
            'total_sin_certificado' => $sinCertificado->count(),
            'total_con_certificado' => $conCertificado->count()
        ], 400);
    }

    /**
     * Generar y descargar certificado PDF.
     * Acepta dumpada_ids, muestra_libre_ids, o ambos mezclados.
     */
    public function generar(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'dumpada_ids'         => 'nullable|array',
            'dumpada_ids.*'       => 'integer|exists:dumpadas,id',
            'muestra_libre_ids'   => 'nullable|array',
            'muestra_libre_ids.*' => 'integer|exists:muestras_libres,id',
            'forzar_regenerar'    => 'nullable|boolean',
            'para'                => 'nullable|string|max:200',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $dumpadaIds      = $request->input('dumpada_ids', []);
        $muestraLibreIds = $request->input('muestra_libre_ids', []);
        $para            = $request->input('para');

        if (empty($dumpadaIds) && empty($muestraLibreIds)) {
            return response()->json(['success' => false, 'message' => 'Debe seleccionar al menos una muestra.'], 422);
        }

        try {
            // Recolectar todos los ítems seleccionados
            $dumpadas       = !empty($dumpadaIds) ? Dumpada::whereIn('id', $dumpadaIds)->get() : collect();
            $muestrasLibres = !empty($muestraLibreIds) ? MuestraLibre::whereIn('id', $muestraLibreIds)->get() : collect();

            $conCertificado = $dumpadas->whereNotNull('certificado')
                ->concat($muestrasLibres->whereNotNull('certificado'));
            $sinCertificado = $dumpadas->whereNull('certificado')
                ->concat($muestrasLibres->whereNull('certificado'));

            // No se puede mezclar items con y sin certificado
            if ($conCertificado->isNotEmpty() && $sinCertificado->isNotEmpty()) {
                $certs = $conCertificado->pluck('certificado')->unique()->implode(', ');
                return response()->json([
                    'success' => false,
                    'message' => "No puede mezclar muestras con y sin certificado. Algunas ya pertenecen a: {$certs}"
                ], 400);
            }

            // Si todos tienen certificado → regenerar
            if ($conCertificado->isNotEmpty()) {
                $certificadosUnicos = $conCertificado->pluck('certificado')->unique();
                if ($certificadosUnicos->count() > 1) {
                    return response()->json([
                        'success' => false,
                        'message' => 'No puede mezclar muestras de diferentes certificados: ' . $certificadosUnicos->implode(', ')
                    ], 400);
                }
                $pdf = $this->certificadoService->regenerarCertificado($certificadosUnicos->first(), $para);
                return $pdf->download("certificado_{$certificadosUnicos->first()}.pdf");
            }

            // Generar nuevo certificado con ambos tipos
            $pdf = $this->certificadoService->generarCertificado($dumpadaIds, null, true, $muestraLibreIds, $para);
            return $pdf->download('certificado_' . date('Y-m-d_His') . '.pdf');

        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    /**
     * Previsualizar certificado (devuelve PDF en el navegador)
     * NO guarda el número de certificado en las dumpadas
     */
    public function previsualizar(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'dumpada_ids' => 'nullable|array',
            'dumpada_ids.*' => 'integer|exists:dumpadas,id',
            'muestra_libre_ids' => 'nullable|array',
            'muestra_libre_ids.*' => 'integer|exists:muestras_libres,id',
            'numero_certificado' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        if (empty($request->dumpada_ids) && empty($request->muestra_libre_ids)) {
            return response()->json([
                'success' => false,
                'message' => 'Debe seleccionar al menos una muestra.'
            ], 422);
        }

        try {
            // Si ya tiene número de certificado asignado, es un certificado EXISTENTE:
            // usar el mismo camino que "regenerar" (sin exigir ley/cu_soluble/cu_insoluble
            // completos), porque certificados históricos importados pueden no tener
            // cu_soluble cargado por separado.
            if ($request->numero_certificado) {
                $pdf = $this->certificadoService->regenerarCertificado($request->numero_certificado);
            } else {
                // Certificado nuevo (sin número aún): sí exigir análisis completo
                $pdf = $this->certificadoService->generarCertificado(
                    $request->dumpada_ids ?? [],
                    null,
                    false,
                    $request->muestra_libre_ids ?? []
                );
            }

            return $pdf->stream('certificado_preview.pdf');
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Listar certificados PDF generados (con filtros y paginación)
     */
    public function certificadosGenerados(Request $request)
    {
        $idFaena     = $request->get('id_faena');
        $search      = $request->get('search');
        $fechaInicio = $request->get('fecha_inicio');
        $fechaFin    = $request->get('fecha_fin');
        $muestrasMin = $request->filled('muestras_min') ? (int) $request->get('muestras_min') : null;
        $muestrasMax = $request->filled('muestras_max') ? (int) $request->get('muestras_max') : null;
        $perPage     = (int) $request->get('per_page', 20);
        $page        = (int) $request->get('page', 1);

        $todos = $this->certificadoService->getCertificadosGenerados(
            $idFaena,
            $search,
            $fechaInicio,
            $fechaFin,
            $muestrasMin,
            $muestrasMax
        );

        $total    = $todos->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $offset   = ($page - 1) * $perPage;
        $items    = $todos->slice($offset, $perPage)->values();

        return response()->json([
            'success' => true,
            'data' => $items,
            'pagination' => [
                'total'        => $total,
                'per_page'     => $perPage,
                'current_page' => $page,
                'last_page'    => $lastPage,
                'from'         => $total > 0 ? $offset + 1 : null,
                'to'           => $total > 0 ? min($offset + $perPage, $total) : null,
            ],
        ]);
    }

    /**
     * Regenerar un certificado existente por su número.
     * Incluye automáticamente todos los tipos (dumpadas + muestras específicas).
     */
    public function regenerar(Request $request, string $numeroCertificado)
    {
        try {
            $para = $request->input('para');
            $pdf = $this->certificadoService->regenerarCertificado($numeroCertificado, $para);
            return $pdf->download('certificado_' . $numeroCertificado . '.pdf');
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Previsualizar un certificado existente por su número (sin descargar).
     * Usado por el Dashboard Gerencial: deja VER el PDF en el navegador,
     * pero no dispara una descarga (a diferencia de regenerar()).
     *
     * El PDF se marca con una marca de agua (usuario + fecha/hora) quemada en el
     * documento: no impide imprimir/guardar desde el visor nativo del navegador
     * (eso no se puede bloquear), pero deja rastro de quién vio el certificado
     * en cualquier copia que se saque.
     */
    public function previsualizarPorNumero(Request $request, string $numeroCertificado)
    {
        try {
            $usuario = $request->input('auth_user');
            $nombreUsuario = trim(($usuario['nombre'] ?? '') . ' ' . ($usuario['apellido'] ?? '')) ?: ($usuario['rut'] ?? 'Usuario');
            $watermarkTexto = $nombreUsuario . ' · ' . now()->format('d-m-Y H:i');

            $pdf = $this->certificadoService->regenerarCertificado($numeroCertificado, null, $watermarkTexto);
            return $pdf->stream('certificado_preview.pdf');
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Obtener dumpadas de un certificado específico
     */
    public function dumpadasPorCertificado(string $numeroCertificado)
    {
        $dumpadas = Dumpada::with('frenteTrabajo')
            ->porCertificadoPdf($numeroCertificado)
            ->orderBy('fecha')
            ->orderBy('numero_jornada')
            ->get();

        $dumpadas->each(function ($dumpada) {
            $dumpada->codigo_completo = $dumpada->generarCodigoCompleto();
            $dumpada->tipo = 'dumpada';
        });

        $muestrasLibres = MuestraLibre::where('certificado', $numeroCertificado)
            ->orderBy('fecha')
            ->get();

        $muestrasLibres->each(function ($muestra) {
            $muestra->tipo = 'muestra_libre';
        });

        if ($dumpadas->isEmpty() && $muestrasLibres->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => "No se encontraron muestras con el certificado: {$numeroCertificado}"
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $dumpadas->concat($muestrasLibres)->values(),
            'total' => $dumpadas->count() + $muestrasLibres->count()
        ]);
    }

    /**
     * Obtener datos del certificado sin generar PDF (para preview en frontend)
     */
    public function preview(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'dumpada_ids' => 'required|array|min:1',
            'dumpada_ids.*' => 'required|integer|exists:dumpadas,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $dumpadas = Dumpada::with('frenteTrabajo')
            ->whereIn('id', $request->dumpada_ids)
            ->conAnalisisCompleto()
            ->orderBy('fecha')
            ->orderBy('numero_jornada')
            ->get();

        if ($dumpadas->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'No se encontraron dumpadas con análisis completo'
            ], 400);
        }

        // Preparar datos de las muestras
        $muestras = $dumpadas->map(function ($dumpada) {
            return [
                'id' => $dumpada->id,
                'codigo' => $dumpada->generarCodigoCompleto(),
                'fecha' => $dumpada->fecha ? $dumpada->fecha->format('d.m.Y') : '',
                'cu_total' => $dumpada->ley,
                'cu_soluble' => $dumpada->cu_soluble,
                'cu_insoluble' => $dumpada->cu_insoluble,
                'certificado_lab' => $dumpada->certificado,
                'frente' => $dumpada->frenteTrabajo?->codigo_completo,
                'jornada' => $dumpada->jornada,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'muestras' => $muestras,
                'total' => $muestras->count(),
            ]
        ]);
    }
}
