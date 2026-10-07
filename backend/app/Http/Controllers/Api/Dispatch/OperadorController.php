<?php

namespace App\Http\Controllers\Api\Dispatch;

use App\Http\Controllers\Controller;
use App\Models\Dispatch\OperadorAutorizado;
use App\Traits\MultiTenancy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * Operadores de dumper para el Ingreso de Dumpadas.
 *
 * La lista del Ingreso sale SOLO de operadores_autorizados_dispatch (local), que
 * se administra en Configuración de Dispatch eligiendo gente del personal interno
 * de Petróleo — mismo patrón que Explosivos > Personal Autorizado. Así el Ingreso
 * no depende de que Petróleo responda; Petróleo solo se consulta al autorizar.
 * Los id_faena coinciden entre ambos sistemas (1 Cabildo, 2 Catemu).
 */
class OperadorController extends Controller
{
    use MultiTenancy;

    /**
     * GET /api/dispatch/operadores
     * Operadores autorizados (activos) de la faena, para el selector del Ingreso.
     */
    public function index(Request $request)
    {
        $query = OperadorAutorizado::activos()->tipo(OperadorAutorizado::TIPO_DUMPER);
        $this->aplicarFiltroFaena($query, $request);

        $operadores = $query->orderBy('nombre')->get()->map(fn ($o) => [
            'id'          => $o->id,
            'id_operador' => $o->id_personal_externo,
            'nombre'      => $o->nombre,
            'cargo'       => $o->cargo,
            'id_faena'    => $o->id_faena,
        ]);

        return response()->json(['data' => $operadores]);
    }

    /**
     * GET /api/dispatch/operadores/disponibles
     * Personal interno de Petróleo de la faena, marcando quiénes ya están autorizados.
     */
    public function disponibles(Request $request)
    {
        $idFaena = $this->getFaenaParaFiltrar($request) ?? $request->auth_faena;

        $personal = OperadorAutorizado::personalDePetroleo($idFaena);
        // Si con filtro de faena no vino nadie (persona sin faena asignada en
        // Petróleo), mostrar todo el personal antes que una lista vacía.
        if ($personal !== null && empty($personal) && $idFaena) {
            $personal = OperadorAutorizado::personalDePetroleo(null);
        }

        if ($personal === null) {
            // 502 y no el status crudo de Petróleo: un 401/403 reenviado tal cual lo
            // toma el interceptor del frontend como sesión expirada (ver Explosivos).
            return response()->json([
                'error'   => 'Error al conectar con el sistema de petróleo',
                'mensaje' => 'No se pudo obtener el personal desde Petróleo. Intenta de nuevo en un rato.',
            ], 502);
        }

        $autorizadosIds = $idFaena
            ? OperadorAutorizado::activos()->tipo(OperadorAutorizado::TIPO_DUMPER)->where('id_faena', $idFaena)->pluck('id_personal_externo')->all()
            : [];

        $data = collect($personal)
            ->unique('id_personal_interno')
            ->map(fn ($p) => [
                'id_personal_externo' => $p['id_personal_interno'],
                'rut'                 => $p['rut'] ?? null,
                'nombre'              => trim(($p['nombre'] ?? '') . ' ' . ($p['apellido'] ?? '')),
                'cargo'               => $p['cargo'] ?? null,
                'es_operador'         => stripos($p['cargo'] ?? '', 'operador') !== false,
                'ya_autorizado'       => in_array($p['id_personal_interno'], $autorizadosIds),
            ])
            ->filter(fn ($p) => $p['nombre'] !== '')
            // Operadores primero (por cargo), después el resto, alfabético
            ->sortBy([['es_operador', 'desc'], ['nombre', 'asc']])
            ->values();

        return response()->json(['data' => $data]);
    }

    /**
     * POST /api/dispatch/operadores
     * Autorizar a una persona en la faena (o reactivarla si ya estuvo).
     */
    public function store(Request $request)
    {
        $idFaena = $this->getFaenaParaFiltrar($request) ?? $request->auth_faena;
        if (!$idFaena) {
            return response()->json(['mensaje' => 'Selecciona una faena antes de autorizar operadores'], 400);
        }

        $validator = Validator::make($request->all(), [
            'id_personal_externo' => 'required|integer',
            'rut'                 => 'nullable|string|max:12',
            'nombre'              => 'required|string|max:150',
            'cargo'               => 'nullable|string|max:150',
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => 'Datos inválidos', 'detalles' => $validator->errors()], 422);
        }

        $existente = OperadorAutorizado::where('id_personal_externo', $request->id_personal_externo)
            ->where('id_faena', $idFaena)
            ->tipo(OperadorAutorizado::TIPO_DUMPER)
            ->first();

        if ($existente && $existente->activo) {
            return response()->json(['mensaje' => 'Esta persona ya está autorizada'], 422);
        }

        $datos = [
            'rut'    => $request->rut,
            'nombre' => $request->nombre,
            'cargo'  => $request->cargo,
            'activo' => true,
        ];

        $operador = $existente
            ? tap($existente)->update($datos)
            : OperadorAutorizado::create($datos + [
                'id_personal_externo' => $request->id_personal_externo,
                'id_faena'            => $idFaena,
            ]);

        return response()->json(['mensaje' => 'Operador autorizado', 'operador' => $operador], $existente ? 200 : 201);
    }

    /**
     * DELETE /api/dispatch/operadores/{id}
     * Quitar de la lista (activo = false). Las dumpadas ya registradas con este
     * operador no cambian — guardan su propio nombre.
     */
    public function destroy(Request $request, $id)
    {
        $query = OperadorAutorizado::where('id', $id)->tipo(OperadorAutorizado::TIPO_DUMPER);
        $this->aplicarFiltroFaena($query, $request);
        $operador = $query->first();

        if (!$operador) {
            return response()->json(['mensaje' => 'Operador no encontrado'], 404);
        }

        $operador->update(['activo' => false]);

        return response()->json(['mensaje' => 'Operador quitado de la lista']);
    }
}
