<?php

namespace App\Models\Dispatch;

use App\Models\Ingenieria\FrenteTrabajo;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Dumpada extends Model
{
    use HasFactory;

    protected $table = 'dumpadas';

    protected $fillable = [
        'id_frente_trabajo',
        'n_acop',
        'acopios',
        'jornada',
        'fecha',
        'ton',
        'ley',
        'ley_cup',
        'certificado',
        'columna1',
        'ley_visual',
        'rango',
    ];

    // Relación: una dumpada pertenece a un frente de trabajo
    public function frenteTrabajo()
    {
        return $this->belongsTo(FrenteTrabajo::class, 'id_frente_trabajo');
    }
}
