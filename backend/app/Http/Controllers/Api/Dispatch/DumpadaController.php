<?php

namespace App\Http\Controllers\Api\Dispatch;

use App\Http\Controllers\Controller;
use App\Models\Dispatch\Dumpada;
use App\Models\Ingenieria\FrenteTrabajo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class DumpadaController extends Controller
{
    /**
     * Convertir fecha de formato DD-MM-YYYY a Y-m-d
     */
    private function convertirFecha($fecha)
    {
        if (!$fecha) {
            return null;
        }

        // Si la fecha viene en formato DD-MM-YYYY
        if (preg_match('/^\d{2}-\d{2}-\d{4}$/', $fecha)) {
            return Carbon::createFromFormat('d-m-Y', $fecha)->format('Y-m-d');
        }

        // Si ya viene en formato Y-m-d o es una fecha válida
        return $fecha;
    }

    /**
     * Listar todas las dumpadas con paginación
     */
    public function index(Request $request)
    {
        $perPage = $request->get('per_page', 15);
        $estado = $request->get('estado'); // Filtrar por estado si se proporciona

        $query = Dumpada::with('frenteTrabajo.tipoFrente')
            ->orderBy('fecha', 'desc')
            ->orderBy('created_at', 'desc');

        if ($estado) {
            $query->where('estado', $estado);
        }

        $dumpadas = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $dumpadas->items(),
            'pagination' => [
                'total' => $dumpadas->total(),
                'per_page' => $dumpadas->perPage(),
                'current_page' => $dumpadas->currentPage(),
                'last_page' => $dumpadas->lastPage(),
                'from' => $dumpadas->firstItem(),
                'to' => $dumpadas->lastItem()
            ]
        ], 200);
    }

    /**
     * Crear una nueva dumpada
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_frente_trabajo' => 'required|exists:frentes_trabajo,id',
            'jornada' => 'required|in:AM,PM,Madrugada,Noche',
            'fecha' => 'nullable|date',
            'ton' => 'nullable|numeric|min:0',
            'ley' => 'nullable|numeric|min:0',
            'ley_cup' => 'nullable|numeric|min:0',
            'certificado' => 'nullable|string|max:100',
            'ley_visual' => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // Obtener el frente de trabajo
        $frente = FrenteTrabajo::find($request->id_frente_trabajo);

        // Generar número de acopio automáticamente
        $nAcopio = Dumpada::generarNumeroAcopio($request->id_frente_trabajo);

        // Usar la fecha proporcionada o la fecha actual, convertida al formato correcto
        $fecha = $this->convertirFecha($request->fecha) ?? now()->format('Y-m-d');

        // Generar código de acopios automáticamente
        $acopios = Dumpada::generarCodigoAcopios(
            $frente->codigo_completo,
            $request->jornada,
            $nAcopio,
            $fecha
        );

        // Determinar el rango automáticamente basado en la ley
        $rango = $request->ley ? Dumpada::determinarRango($request->ley) : null;

        // Determinar el estado basado en si tiene los datos del laboratorio
        // Solo hay 2 estados: "Ingresado" (sin datos) o "Completado" (con todos los datos)
        $estado = Dumpada::ESTADO_INGRESADO; // Estado inicial: muestra enviada al laboratorio

        // Si tiene los 3 datos del laboratorio, está completado
        if ($request->ley && $request->ley_cup && $request->certificado) {
            $estado = Dumpada::ESTADO_COMPLETADO;
        }

        // Crear la dumpada con los datos generados
        $data = [
            'id_frente_trabajo' => $request->id_frente_trabajo,
            'jornada' => $request->jornada,
            'ley_visual' => $request->ley_visual,
            'ton' => $request->ton,
            'ley' => $request->ley,
            'ley_cup' => $request->ley_cup,
            'certificado' => $request->certificado,
            'n_acop' => $nAcopio,
            'acopios' => $acopios,
            'fecha' => $fecha,
            'rango' => $rango,
            'estado' => $estado,
            'user_id' => $request->auth_user_id,
            'faena' => $request->auth_faena,
        ];

        $dumpada = Dumpada::create($data);
        $dumpada->load('frenteTrabajo.tipoFrente');

        return response()->json([
            'success' => true,
            'message' => 'Dumpada creada exitosamente',
            'data' => $dumpada
        ], 201);
    }

    /**
     * Mostrar una dumpada específica
     */
    public function show($id)
    {
        $dumpada = Dumpada::with('frenteTrabajo.tipoFrente')->find($id);

        if (!$dumpada) {
            return response()->json([
                'success' => false,
                'message' => 'Dumpada no encontrada'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $dumpada
        ], 200);
    }

    /**
     * Actualizar una dumpada
     */
    public function update(Request $request, $id)
    {
        $dumpada = Dumpada::find($id);

        if (!$dumpada) {
            return response()->json([
                'success' => false,
                'message' => 'Dumpada no encontrada'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'id_frente_trabajo' => 'required|exists:frentes_trabajo,id',
            'jornada' => 'required|in:AM,PM,Madrugada,Noche',
            'fecha' => 'nullable|date',
            'ton' => 'nullable|numeric|min:0',
            'ley' => 'nullable|numeric|min:0',
            'ley_cup' => 'nullable|numeric|min:0',
            'certificado' => 'nullable|string|max:100',
            'ley_visual' => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // Obtener el frente de trabajo
        $frente = FrenteTrabajo::find($request->id_frente_trabajo);

        // Regenerar código de acopios si cambiaron datos relevantes
        if ($request->id_frente_trabajo != $dumpada->id_frente_trabajo ||
            $request->jornada != $dumpada->jornada ||
            $request->fecha != $dumpada->fecha) {

            $fecha = $this->convertirFecha($request->fecha) ?? $dumpada->fecha;
            $acopios = Dumpada::generarCodigoAcopios(
                $frente->codigo_completo,
                $request->jornada,
                $dumpada->n_acop,
                $fecha
            );
        } else {
            $acopios = $dumpada->acopios;
        }

        // Determinar el rango automáticamente si cambió la ley
        $rango = $request->ley ? Dumpada::determinarRango($request->ley) : $dumpada->rango;

        // Actualizar estado basado en los datos proporcionados
        // Solo hay 2 estados: "Ingresado" (sin datos) o "Completado" (con todos los datos)
        $ley = $request->ley ?? $dumpada->ley;
        $leyCup = $request->ley_cup ?? $dumpada->ley_cup;
        $certificado = $request->certificado ?? $dumpada->certificado;

        if ($ley && $leyCup && $certificado) {
            $estado = Dumpada::ESTADO_COMPLETADO;
        } else {
            $estado = Dumpada::ESTADO_INGRESADO;
        }

        // Actualizar la dumpada
        $data = [
            'id_frente_trabajo' => $request->id_frente_trabajo,
            'jornada' => $request->jornada,
            'fecha' => $this->convertirFecha($request->fecha) ?? $dumpada->fecha,
            'ton' => $request->ton ?? $dumpada->ton,
            'ley' => $request->ley ?? $dumpada->ley,
            'ley_cup' => $request->ley_cup ?? $dumpada->ley_cup,
            'certificado' => $request->certificado ?? $dumpada->certificado,
            'ley_visual' => $request->ley_visual ?? $dumpada->ley_visual,
            'acopios' => $acopios,
            'rango' => $rango,
            'estado' => $estado,
        ];

        $dumpada->update($data);
        $dumpada->load('frenteTrabajo.tipoFrente');

        return response()->json([
            'success' => true,
            'message' => 'Dumpada actualizada exitosamente',
            'data' => $dumpada
        ], 200);
    }

    /**
     * Eliminar una dumpada
     */
    public function destroy($id)
    {
        $dumpada = Dumpada::find($id);

        if (!$dumpada) {
            return response()->json([
                'success' => false,
                'message' => 'Dumpada no encontrada'
            ], 404);
        }

        $dumpada->delete();

        return response()->json([
            'success' => true,
            'message' => 'Dumpada eliminada exitosamente'
        ], 200);
    }

    /**
     * Previsualizar próximo número de acopio y código completo
     */
    public function previsualizarAcopio(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_frente_trabajo' => 'required|exists:frentes_trabajo,id',
            'jornada' => 'required|in:AM,PM,Madrugada,Noche',
            'fecha' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // Obtener el frente de trabajo
        $frente = FrenteTrabajo::find($request->id_frente_trabajo);

        // Generar número de acopio automáticamente
        $nAcopio = Dumpada::generarNumeroAcopio($request->id_frente_trabajo);

        // Usar la fecha proporcionada o la fecha actual, convertida al formato correcto
        $fecha = $this->convertirFecha($request->fecha) ?? now()->format('Y-m-d');

        // Generar código de acopios automáticamente
        $acopios = Dumpada::generarCodigoAcopios(
            $frente->codigo_completo,
            $request->jornada,
            $nAcopio,
            $fecha
        );

        return response()->json([
            'success' => true,
            'data' => [
                'n_acop' => $nAcopio,
                'acopios' => $acopios,
                'codigo_frente' => $frente->codigo_completo,
                'jornada' => $request->jornada,
                'fecha' => $fecha
            ]
        ], 200);
    }
}
