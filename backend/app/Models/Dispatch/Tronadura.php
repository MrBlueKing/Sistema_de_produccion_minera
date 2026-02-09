<?php

namespace App\Models\Dispatch;

use App\Models\Ingenieria\FrenteTrabajo;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class Tronadura extends Model
{
    use HasFactory;

    protected $table = 'tronaduras';

    protected $fillable = [
        'codigo',
        'id_frente_trabajo',
        'fecha',
        'hora',
        'jornada',
        'toneladas_estimadas',
        'toneladas_reales',
        'dumpadas_estimadas',
        'dumpadas_reales',
        'estado',
        'observaciones',
        'user_id',
        'id_faena',
    ];

    protected $casts = [
        'fecha' => 'date',
        'toneladas_estimadas' => 'decimal:2',
        'toneladas_reales' => 'decimal:2',
    ];

    // Constantes de estados
    const ESTADO_ACTIVA = 'Activa';
    const ESTADO_COMPLETADA = 'Completada';
    const ESTADO_CANCELADA = 'Cancelada';

    /**
     * Relación: una tronadura pertenece a un frente de trabajo
     */
    public function frenteTrabajo()
    {
        return $this->belongsTo(FrenteTrabajo::class, 'id_frente_trabajo');
    }

    /**
     * Relación: una tronadura tiene muchas dumpadas
     */
    public function dumpadas()
    {
        return $this->hasMany(Dumpada::class, 'tronadura_id');
    }

    /**
     * Scope: Filtrar por faena
     */
    public function scopePorFaena($query, $idFaena)
    {
        if ($idFaena) {
            return $query->where('id_faena', $idFaena);
        }
        return $query;
    }

    /**
     * Relación: usuario que registró la tronadura
     */
    public function usuario()
    {
        return $this->belongsTo(\App\Models\User::class, 'user_id');
    }

    /**
     * Genera automáticamente el código de tronadura
     * Formato: TR-{AÑO}-{SECUENCIAL}
     */
    public static function generarCodigo()
    {
        $año = Carbon::now()->year;
        $prefijo = "TR-{$año}-";

        $ultimoNumero = self::where('codigo', 'like', $prefijo . '%')
            ->selectRaw("MAX(CAST(SUBSTRING(codigo, " . (strlen($prefijo) + 1) . ") AS UNSIGNED)) as max_num")
            ->value('max_num');

        $nuevoNumero = ($ultimoNumero ?? 0) + 1;

        return $prefijo . str_pad($nuevoNumero, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Recalcula los totales reales basándose en las dumpadas asociadas
     */
    public function recalcularTotales()
    {
        $dumpadas = $this->dumpadas;

        $this->dumpadas_reales = $dumpadas->count();
        $this->toneladas_reales = $dumpadas->sum('ton');
        $this->save();

        return $this;
    }

    /**
     * Verifica si la tronadura está completa (todas las dumpadas extraídas)
     */
    public function estaCompleta()
    {
        if (!$this->dumpadas_estimadas) {
            return false;
        }

        return $this->dumpadas_reales >= $this->dumpadas_estimadas;
    }

    /**
     * Obtiene el porcentaje de extracción
     */
    public function getPorcentajeExtraccionAttribute()
    {
        if (!$this->toneladas_estimadas || $this->toneladas_estimadas == 0) {
            return null;
        }

        return round(($this->toneladas_reales / $this->toneladas_estimadas) * 100, 1);
    }

    /**
     * Obtiene la ley promedio de las dumpadas de esta tronadura
     */
    public function getLeyPromedioAttribute()
    {
        $dumpadas = $this->dumpadas;

        if ($dumpadas->isEmpty()) {
            return null;
        }

        $totalTon = $dumpadas->sum('ton');
        if ($totalTon == 0) {
            return null;
        }

        $sumaPonderada = $dumpadas->sum(function ($d) {
            return $d->ton * ($d->ley ?? 0);
        });

        return round($sumaPonderada / $totalTon, 2);
    }
}
