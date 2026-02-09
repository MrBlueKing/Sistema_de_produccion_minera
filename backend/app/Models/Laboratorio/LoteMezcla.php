<?php

namespace App\Models\Laboratorio;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LoteMezcla extends Model
{
    use HasFactory;

    protected $table = 'lote_mezcla';

    protected $fillable = [
        'lote_id',
        'mezcla_id',
        'peso_usado',
        'ley_mezcla',
    ];

    protected $casts = [
        'peso_usado' => 'decimal:2',
        'ley_mezcla' => 'decimal:3',
    ];

    /**
     * Relación: un registro pertenece a un lote
     */
    public function lote()
    {
        return $this->belongsTo(LoteVenta::class, 'lote_id');
    }

    /**
     * Relación: un registro pertenece a una mezcla
     */
    public function mezcla()
    {
        return $this->belongsTo(Mezcla::class, 'mezcla_id');
    }
}
