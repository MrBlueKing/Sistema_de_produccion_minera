<?php

namespace App\Models\Explosivos;

use App\Models\Ingenieria\TipoFrente;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FormulaExplosivo extends Model
{
    use HasFactory;

    protected $table = 'formulas_explosivos';

    protected $fillable = [
        'id_tipo_frente',
        'id_tipo_explosivo',
        'factor',
        'id_faena',
    ];

    protected $casts = [
        'factor' => 'decimal:4',
    ];

    public function tipoFrente()
    {
        return $this->belongsTo(TipoFrente::class, 'id_tipo_frente');
    }

    public function tipoExplosivo()
    {
        return $this->belongsTo(TipoExplosivo::class, 'id_tipo_explosivo');
    }

    public function scopePorFaena($query, $idFaena)
    {
        if ($idFaena) {
            return $query->where('id_faena', $idFaena);
        }
        return $query;
    }
}
