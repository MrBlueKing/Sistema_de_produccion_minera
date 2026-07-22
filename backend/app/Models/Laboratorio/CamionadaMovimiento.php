<?php

namespace App\Models\Laboratorio;

use Illuminate\Database\Eloquent\Model;

class CamionadaMovimiento extends Model
{
    protected $table = 'camionada_movimientos';

    protected $fillable = [
        'camionada_id',
        'lote_origen_id',
        'lote_destino_id',
        'user_id',
    ];

    public function camionada()
    {
        return $this->belongsTo(Camionada::class, 'camionada_id');
    }

    public function loteOrigen()
    {
        return $this->belongsTo(Lote::class, 'lote_origen_id');
    }

    public function loteDestino()
    {
        return $this->belongsTo(Lote::class, 'lote_destino_id');
    }
}
