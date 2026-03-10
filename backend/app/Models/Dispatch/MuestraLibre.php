<?php

namespace App\Models\Dispatch;

use App\Models\Ingenieria\FrenteTrabajo;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MuestraLibre extends Model
{
    use HasFactory;

    protected $table = 'muestras_libres';

    protected $fillable = [
        'user_id',
        'id_faena',
        'id_frente_trabajo',
        'nombre',
        'solicitante',
        'fecha',
        'estado',
        'ley',
        'ley_cup',
        'cu_soluble',
        'cu_insoluble',
        'rango',
        'certificado',
    ];

    protected $casts = [
        'fecha'        => 'date:d-m-Y',
        'ley'          => 'decimal:3',
        'ley_cup'      => 'decimal:3',
        'cu_soluble'   => 'decimal:3',
        'cu_insoluble' => 'decimal:3',
    ];

    protected $appends = ['codigo'];

    /**
     * Código identificador de la muestra específica.
     * Formato: ME-00001 (secuencial basado en ID)
     */
    public function getCodigoAttribute(): string
    {
        return 'ME-' . str_pad($this->id, 5, '0', STR_PAD_LEFT);
    }

    const ESTADO_INGRESADO  = 'Ingresado';
    const ESTADO_COMPLETADO = 'Completado';

    public function frenteTrabajo()
    {
        return $this->belongsTo(FrenteTrabajo::class, 'id_frente_trabajo');
    }
}
