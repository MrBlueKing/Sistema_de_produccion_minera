<?php

namespace App\Http\Controllers\Api\Laboratorio;

use App\Http\Controllers\Controller;
use App\Services\CertificadoPdfService;
use App\Models\Dispatch\Dumpada;
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
     * Generar y descargar certificado PDF
     * Incluye validación automática de certificados existentes
     */
    public function generar(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'dumpada_ids' => 'required|array|min:1',
            'dumpada_ids.*' => 'required|integer|exists:dumpadas,id',
            'forzar_regenerar' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $dumpadas = Dumpada::whereIn('id', $request->dumpada_ids)->get();

            $conCertificado = $dumpadas->whereNotNull('certificado');
            $sinCertificado = $dumpadas->whereNull('certificado');

            // Validar mezcla
            if ($conCertificado->isNotEmpty() && $sinCertificado->isNotEmpty()) {
                $certificadosExistentes = $conCertificado->pluck('certificado')->unique()->implode(', ');
                return response()->json([
                    'success' => false,
                    'message' => "No puede mezclar dumpadas con y sin certificado. Algunas ya pertenecen a: {$certificadosExistentes}"
                ], 400);
            }

            // Validar diferentes certificados
            if ($conCertificado->isNotEmpty()) {
                $certificadosUnicos = $conCertificado->pluck('certificado')->unique();

                if ($certificadosUnicos->count() > 1) {
                    return response()->json([
                        'success' => false,
                        'message' => "No puede mezclar dumpadas de diferentes certificados: " . $certificadosUnicos->implode(', ')
                    ], 400);
                }

                // Regenerar certificado existente (con TODAS sus dumpadas)
                $numeroCertificado = $certificadosUnicos->first();
                $pdf = $this->certificadoService->regenerarCertificado($numeroCertificado);
                return $pdf->download("certificado_{$numeroCertificado}.pdf");
            }

            // Generar nuevo certificado
            $pdf = $this->certificadoService->generarCertificado($request->dumpada_ids);

            $nombreArchivo = 'certificado_' . date('Y-m-d_His') . '.pdf';

            return $pdf->download($nombreArchivo);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Previsualizar certificado (devuelve PDF en el navegador)
     * NO guarda el número de certificado en las dumpadas
     */
    public function previsualizar(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'dumpada_ids' => 'required|array|min:1',
            'dumpada_ids.*' => 'required|integer|exists:dumpadas,id',
            'numero_certificado' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // guardarNumero = false para previsualización
            $pdf = $this->certificadoService->generarCertificado(
                $request->dumpada_ids,
                $request->numero_certificado,
                false
            );

            return $pdf->stream('certificado_preview.pdf');
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Listar certificados PDF generados
     */
    public function certificadosGenerados(Request $request)
    {
        $idFaena = $request->get('id_faena');

        $certificados = $this->certificadoService->getCertificadosGenerados($idFaena);

        return response()->json([
            'success' => true,
            'data' => $certificados
        ]);
    }

    /**
     * Regenerar un certificado existente por su número
     */
    public function regenerar(Request $request, string $numeroCertificado)
    {
        try {
            $pdf = $this->certificadoService->regenerarCertificado($numeroCertificado);

            $nombreArchivo = 'certificado_' . $numeroCertificado . '.pdf';

            return $pdf->download($nombreArchivo);
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

        if ($dumpadas->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => "No se encontraron dumpadas con el certificado: {$numeroCertificado}"
            ], 404);
        }

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
