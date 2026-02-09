<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TonelajeMaquina extends Model
{
    use HasFactory;

    protected $table = 'tonelaje_maquinas';

    protected $fillable = [
        'id_maquina',
        'nombre_maquina',
        'patente',
        'tonelaje',
        'id_faena',
        'activo',
    ];

    protected $casts = [
        'tonelaje' => 'decimal:2',
        'activo' => 'boolean',
    ];

    /**
     * Scope: filtrar por faena (incluyendo globales)
     */
    public function scopePorFaena($query, $idFaena)
    {
        return $query->where(function ($q) use ($idFaena) {
            $q->where('id_faena', $idFaena)
              ->orWhereNull('id_faena');
        });
    }

    /**
     * Scope: solo activos
     */
    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }

    /**
     * Obtener tonelaje de una máquina específica
     * Busca primero config de faena, luego global, luego default
     */
    public static function obtenerTonelaje($idMaquina, $idFaena = null, $default = null)
    {
        // Primero buscar específico de la faena
        if ($idFaena) {
            $configFaena = self::where('id_maquina', $idMaquina)
                ->where('id_faena', $idFaena)
                ->where('activo', true)
                ->first();

            if ($configFaena) {
                return (float) $configFaena->tonelaje;
            }
        }

        // Luego buscar global (id_faena = null)
        $configGlobal = self::where('id_maquina', $idMaquina)
            ->whereNull('id_faena')
            ->where('activo', true)
            ->first();

        if ($configGlobal) {
            return (float) $configGlobal->tonelaje;
        }

        // Si no hay config de máquina, retornar el default del sistema
        if ($default === null) {
            $default = ConfiguracionSistema::obtener('tonelaje_dumpada_default', 4.6, $idFaena);
        }

        return (float) $default;
    }

    /**
     * Establecer tonelaje para una máquina
     */
    public static function establecerTonelaje($idMaquina, $nombreMaquina, $tonelaje, $idFaena = null, $patente = null)
    {
        return self::updateOrCreate(
            [
                'id_maquina' => $idMaquina,
                'id_faena' => $idFaena,
            ],
            [
                'nombre_maquina' => $nombreMaquina,
                'patente' => $patente,
                'tonelaje' => $tonelaje,
                'activo' => true,
            ]
        );
    }
}
