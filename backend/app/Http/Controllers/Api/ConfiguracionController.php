<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ConfiguracionSistema;
use App\Config\MezclaConfig;
use Illuminate\Http\Request;

class ConfiguracionController extends Controller
{
    /**
     * Obtener configuraciones públicas del sistema
     * GET /api/configuraciones
     * GET /api/configuraciones?id_faena=1 (para obtener config específica de faena)
     */
    public function index(Request $request)
    {
        $idFaena = $request->query('id_faena');

        return response()->json([
            'factor_ajuste_ley' => MezclaConfig::getFactorAjusteLey(),
            'peso_camion_default' => ConfiguracionSistema::obtener('peso_camion_default', 29, $idFaena),
            'tonelaje_dumpada_default' => ConfiguracionSistema::obtener('tonelaje_dumpada_default', 4.6, $idFaena),
            'ley_capping_maximo' => (float) ConfiguracionSistema::obtener('ley_capping_maximo', 3, $idFaena),
            'toneladas_por_palada' => (float) ConfiguracionSistema::obtener('toneladas_por_palada', 1.82, $idFaena),
            'usar_sistema_acopios' => ConfiguracionSistema::usarSistemaAcopios(),
            'id_faena' => $idFaena,
        ]);
    }

    /**
     * Obtener una configuración específica
     * GET /api/configuraciones/{clave}
     * GET /api/configuraciones/{clave}?id_faena=1 (para obtener config específica de faena)
     */
    public function show($clave, Request $request)
    {
        $idFaena = $request->query('id_faena');
        $valor = ConfiguracionSistema::obtener($clave, null, $idFaena);

        if ($valor === null) {
            return response()->json([
                'error' => 'Configuración no encontrada'
            ], 404);
        }

        return response()->json([
            'clave' => $clave,
            'valor' => $valor,
            'id_faena' => $idFaena,
        ]);
    }

    /**
     * Actualizar una configuración específica
     * PUT /api/configuraciones/{clave}
     * Body: { valor: "4.6", id_faena: 1 } (id_faena es opcional, null = global)
     */
    public function update($clave, Request $request)
    {
        $request->validate([
            'valor' => 'required',
            'id_faena' => 'nullable|integer',
        ]);

        try {
            $idFaena = $request->id_faena;
            $userId = auth()->id();

            ConfiguracionSistema::establecer($clave, $request->valor, $userId, $idFaena);

            return response()->json([
                'mensaje' => 'Configuración actualizada exitosamente',
                'clave' => $clave,
                'valor' => $request->valor,
                'id_faena' => $idFaena,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar configuración',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener todas las configuraciones de una clave específica (todas las faenas)
     * GET /api/configuraciones/{clave}/faenas
     * Útil para Encargado Dispatch que necesita ver todas las faenas
     */
    public function getByKey($clave)
    {
        $configs = ConfiguracionSistema::where('clave', $clave)
            ->select('id', 'clave', 'id_faena', 'valor', 'tipo', 'updated_at')
            ->get()
            ->map(function ($config) {
                return [
                    'id' => $config->id,
                    'clave' => $config->clave,
                    'id_faena' => $config->id_faena,
                    'valor' => ConfiguracionSistema::convertirValorPublic($config->valor, $config->tipo),
                    'updated_at' => $config->updated_at,
                ];
            });

        return response()->json([
            'clave' => $clave,
            'configuraciones' => $configs,
        ]);
    }
}
