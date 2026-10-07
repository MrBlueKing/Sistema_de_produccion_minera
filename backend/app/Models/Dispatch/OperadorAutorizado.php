<?php

namespace App\Models\Dispatch;

use Illuminate\Database\Eloquent\Model;

/**
 * Operador autorizado para aparecer en el Ingreso de Dumpadas de una faena.
 * id_personal_externo = personal_interno.id_personal_interno del sistema de
 * Petróleo — es el mismo valor que se guarda en dumpadas.id_operador.
 */
class OperadorAutorizado extends Model
{
    protected $table = 'operadores_autorizados_dispatch';

    protected $fillable = [
        'id_personal_externo',
        'rut',
        'nombre',
        'cargo',
        'id_faena',
        'tipo',
        'activo',
    ];

    public const TIPO_DUMPER = 'dumper';
    public const TIPO_PALA = 'pala'; // Report CyT

    protected $casts = [
        'activo' => 'boolean',
    ];

    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }

    public function scopeTipo($query, string $tipo)
    {
        return $query->where('tipo', $tipo);
    }

    /**
     * Personal interno de Petróleo (de una faena o todo).
     * null = Petróleo no respondió; [] = respondió sin nadie.
     */
    public static function personalDePetroleo($idFaena): ?array
    {
        try {
            $response = \Illuminate\Support\Facades\Http::timeout(8)
                ->withHeaders(['X-API-Key' => config('services.petroleo_api_key')])
                ->get(config('services.petroleo_api') . '/personal-interno-disponible', array_filter([
                    'id_faena' => $idFaena,
                ]));

            if (!$response->successful()) {
                \Illuminate\Support\Facades\Log::warning('[OPERADORES] Petróleo no respondió bien', ['status' => $response->status()]);
                return null;
            }

            return $response->json('data') ?? [];
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning('[OPERADORES] Error al consultar Petróleo', ['message' => $e->getMessage()]);
            return null;
        }
    }
}
