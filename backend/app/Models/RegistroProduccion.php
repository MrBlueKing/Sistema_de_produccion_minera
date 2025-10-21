<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RegistroProduccion extends Model
{
    protected $table = 'registros_produccion';

    protected $fillable = [
        'user_id',
        'descripcion',
        'cantidad',
        'fecha',
    ];

    protected $casts = [
        'fecha' => 'date',
        'cantidad' => 'decimal:2',
    ];
}