<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Jornada;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Jornadas/turnos del módulo Configuración General.
 *
 * GET lo usan todos los formularios y filtros (cualquier sesión válida).
 * Crear/editar solo con el rol SAC `admin_configuracion` (módulo
 * "Configuración General"): los roles que llegan en auth_roles son los del
 * módulo por el que se entró desde el Portal.
 */
class JornadaController extends Controller
{
    public const ROL_ADMIN = 'admin_configuracion';

    /**
     * GET /api/jornadas                         → todas, en orden (pantalla de config)
     * GET /api/jornadas?formulario=perforacion  → las que se ofrecen en ese formulario
     *     (&incluir_inactivas=1 para filtros: también las apagadas, que pueden tener registros)
     */
    public function index(Request $request)
    {
        $jornadas = Jornada::ordenadas();

        if ($request->filled('formulario')) {
            $form = $request->formulario;
            $jornadas = $jornadas->filter(fn($j) => in_array($form, $j->formularios ?? [])
                && ($j->activa || $request->boolean('incluir_inactivas')))->values();
        }

        return response()->json([
            'success'      => true,
            'data'         => $jornadas,
            'puede_editar' => $this->esAdmin($request),
        ]);
    }

    public function store(Request $request)
    {
        if (!$this->esAdmin($request)) {
            return $this->sinPermiso();
        }

        $datos = $this->validar($request);
        if ($datos instanceof \Illuminate\Http\JsonResponse) {
            return $datos;
        }

        $datos['orden'] = (Jornada::max('orden') ?? 0) + 1;
        $jornada = Jornada::create($datos);

        return response()->json(['success' => true, 'data' => $jornada, 'message' => 'Jornada creada'], 201);
    }

    public function update(Request $request, $id)
    {
        if (!$this->esAdmin($request)) {
            return $this->sinPermiso();
        }

        $jornada = Jornada::findOrFail($id);
        $datos = $this->validar($request, $jornada);
        if ($datos instanceof \Illuminate\Http\JsonResponse) {
            return $datos;
        }

        // El nombre es lo que queda guardado en dumpadas.jornada / reportes_perforacion.turno:
        // cambiarlo dejaría esos registros apuntando a una jornada que ya no existe.
        if (isset($datos['nombre']) && $datos['nombre'] !== $jornada->nombre && $this->tieneRegistros($jornada->nombre)) {
            return response()->json([
                'success' => false,
                'message' => "No se puede cambiar el nombre: ya hay registros guardados como \"{$jornada->nombre}\". Puedes apagarla y crear otra.",
            ], 422);
        }

        $jornada->update($datos);

        return response()->json(['success' => true, 'data' => $jornada->fresh(), 'message' => 'Jornada actualizada']);
    }

    /** PUT /api/jornadas/orden  { ids: [3,1,2,...] } */
    public function ordenar(Request $request)
    {
        if (!$this->esAdmin($request)) {
            return $this->sinPermiso();
        }

        $request->validate(['ids' => 'required|array', 'ids.*' => 'integer|exists:jornadas,id']);
        foreach ($request->ids as $i => $id) {
            Jornada::where('id', $id)->update(['orden' => $i + 1]);
        }

        return response()->json(['success' => true, 'data' => Jornada::ordenadas()]);
    }

    private function validar(Request $request, ?Jornada $jornada = null)
    {
        $id = $jornada?->id;
        $v = Validator::make($request->all(), [
            'nombre'        => [$jornada ? 'sometimes' : 'required', 'string', 'max:50', Rule::unique('jornadas', 'nombre')->ignore($id)],
            'abreviatura'   => [$jornada ? 'sometimes' : 'required', 'string', 'max:20', 'regex:/^[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]+$/u', Rule::unique('jornadas', 'abreviatura')->ignore($id)],
            'color'         => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'activa'        => ['sometimes', 'boolean'],
            'formularios'   => [$jornada ? 'sometimes' : 'required', 'array'],
            'formularios.*' => [Rule::in(Jornada::FORMULARIOS)],
        ], [
            'abreviatura.regex' => 'La abreviatura va en los códigos: solo letras y números, sin espacios ni guiones.',
            'nombre.unique'     => 'Ya existe una jornada con ese nombre.',
            'abreviatura.unique'=> 'Ya existe una jornada con esa abreviatura.',
        ]);

        if ($v->fails()) {
            return response()->json(['success' => false, 'message' => $v->errors()->first(), 'errors' => $v->errors()], 422);
        }

        $datos = $v->validated();
        if (isset($datos['formularios'])) {
            $datos['formularios'] = array_values(array_unique($datos['formularios']));
        }
        return $datos;
    }

    private function tieneRegistros(string $nombre): bool
    {
        return \DB::table('dumpadas')->where('jornada', $nombre)->exists()
            || \DB::table('reportes_perforacion')->where('turno', $nombre)->exists()
            || \DB::table('acopios')->where('jornada', $nombre)->exists();
    }

    private function esAdmin(Request $request): bool
    {
        foreach ($request->auth_roles ?? [] as $rol) {
            $rol = is_array($rol) || is_object($rol) ? ((array) $rol)['codigo_externo'] ?? ((array) $rol)['nombre'] ?? '' : $rol;
            if (strcasecmp((string) $rol, self::ROL_ADMIN) === 0) {
                return true;
            }
        }
        return false;
    }

    private function sinPermiso()
    {
        return response()->json(['success' => false, 'message' => 'Solo el Administrador de Configuración puede cambiar las jornadas.'], 403);
    }
}
