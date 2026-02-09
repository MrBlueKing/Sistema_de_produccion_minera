<?php

namespace App\Models\Explosivos;

use App\Models\Dispatch\Tronadura;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class MovimientoExplosivo extends Model
{
    use HasFactory;

    protected $table = 'movimientos_explosivos';

    protected $fillable = [
        'codigo',
        'tipo',
        'id_polvorin_origen',
        'id_polvorin_destino',
        'id_tipo_explosivo',
        'id_lote',
        'cantidad',
        'id_tronadura',
        'fecha',
        'hora',
        'autorizado_por',
        'recibido_por',
        'entregado_por',
        'guia_despacho',
        'motivo',
        'observaciones',
        'id_faena',
        'user_id',
    ];

    protected $casts = [
        'fecha' => 'date',
        'cantidad' => 'decimal:2',
    ];

    // Tipos de movimiento
    const TIPO_ENTRADA = 'entrada';
    const TIPO_SALIDA = 'salida';
    const TIPO_TRANSFERENCIA = 'transferencia';
    const TIPO_AJUSTE = 'ajuste';
    const TIPO_DEVOLUCION = 'devolucion';

    /**
     * RELACIONES
     */
    public function polvorinOrigen()
    {
        return $this->belongsTo(Polvorin::class, 'id_polvorin_origen');
    }

    public function polvorinDestino()
    {
        return $this->belongsTo(Polvorin::class, 'id_polvorin_destino');
    }

    public function tipoExplosivo()
    {
        return $this->belongsTo(TipoExplosivo::class, 'id_tipo_explosivo');
    }

    public function lote()
    {
        return $this->belongsTo(LoteExplosivo::class, 'id_lote');
    }

    public function tronadura()
    {
        return $this->belongsTo(Tronadura::class, 'id_tronadura');
    }

    public function usuario()
    {
        return $this->belongsTo(\App\Models\User::class, 'user_id');
    }

    /**
     * SCOPES
     */
    public function scopePorFaena($query, $idFaena)
    {
        if ($idFaena) {
            return $query->where('id_faena', $idFaena);
        }
        return $query;
    }

    public function scopePorTipo($query, $tipo)
    {
        if ($tipo) {
            return $query->where('tipo', $tipo);
        }
        return $query;
    }

    public function scopeEntreFechas($query, $fechaDesde, $fechaHasta)
    {
        if ($fechaDesde) {
            $query->where('fecha', '>=', $fechaDesde);
        }
        if ($fechaHasta) {
            $query->where('fecha', '<=', $fechaHasta);
        }
        return $query;
    }

    /**
     * MÉTODOS ESTÁTICOS
     */
    public static function generarCodigo()
    {
        $año = Carbon::now()->year;
        $prefijo = "MOV-{$año}-";

        $ultimoNumero = self::where('codigo', 'like', $prefijo . '%')
            ->selectRaw("MAX(CAST(SUBSTRING(codigo, " . (strlen($prefijo) + 1) . ") AS UNSIGNED)) as max_num")
            ->value('max_num');

        $nuevoNumero = ($ultimoNumero ?? 0) + 1;

        return $prefijo . str_pad($nuevoNumero, 5, '0', STR_PAD_LEFT);
    }

    /**
     * Registrar entrada de explosivos (compra/recepción)
     */
    public static function registrarEntrada($datos)
    {
        return DB::transaction(function () use ($datos) {
            // Crear el movimiento
            $movimiento = self::create([
                'codigo' => self::generarCodigo(),
                'tipo' => self::TIPO_ENTRADA,
                'id_polvorin_destino' => $datos['id_polvorin'],
                'id_tipo_explosivo' => $datos['id_tipo_explosivo'],
                'id_lote' => $datos['id_lote'] ?? null,
                'cantidad' => $datos['cantidad'],
                'fecha' => $datos['fecha'] ?? Carbon::now()->toDateString(),
                'hora' => $datos['hora'] ?? Carbon::now()->format('H:i'),
                'autorizado_por' => $datos['autorizado_por'] ?? null,
                'recibido_por' => $datos['recibido_por'] ?? null,
                'guia_despacho' => $datos['guia_despacho'] ?? null,
                'motivo' => $datos['motivo'] ?? 'Recepción de explosivos',
                'observaciones' => $datos['observaciones'] ?? null,
                'id_faena' => $datos['id_faena'],
                'user_id' => $datos['user_id'] ?? auth()->id(),
            ]);

            // Actualizar stock
            $stock = StockExplosivo::obtenerOCrear(
                $datos['id_polvorin'],
                $datos['id_tipo_explosivo'],
                $datos['id_faena']
            );
            $stock->incrementar($datos['cantidad']);

            return $movimiento;
        });
    }

    /**
     * Registrar salida de explosivos (consumo en tronadura)
     */
    public static function registrarSalida($datos)
    {
        return DB::transaction(function () use ($datos) {
            // Validar stock disponible
            $stock = StockExplosivo::where('id_polvorin', $datos['id_polvorin'])
                ->where('id_tipo_explosivo', $datos['id_tipo_explosivo'])
                ->first();

            if (!$stock || $stock->cantidad_disponible < $datos['cantidad']) {
                throw new \Exception("Stock insuficiente para la salida");
            }

            // Crear el movimiento
            $movimiento = self::create([
                'codigo' => self::generarCodigo(),
                'tipo' => self::TIPO_SALIDA,
                'id_polvorin_origen' => $datos['id_polvorin'],
                'id_tipo_explosivo' => $datos['id_tipo_explosivo'],
                'id_lote' => $datos['id_lote'] ?? null,
                'cantidad' => $datos['cantidad'],
                'id_tronadura' => $datos['id_tronadura'] ?? null,
                'fecha' => $datos['fecha'] ?? Carbon::now()->toDateString(),
                'hora' => $datos['hora'] ?? Carbon::now()->format('H:i'),
                'autorizado_por' => $datos['autorizado_por'] ?? null,
                'entregado_por' => $datos['entregado_por'] ?? null,
                'motivo' => $datos['motivo'] ?? 'Consumo en tronadura',
                'observaciones' => $datos['observaciones'] ?? null,
                'id_faena' => $datos['id_faena'],
                'user_id' => $datos['user_id'] ?? auth()->id(),
            ]);

            // Descontar del stock
            $stock->decrementar($datos['cantidad']);

            // Si hay lote, descontar del lote
            if (isset($datos['id_lote']) && $datos['id_lote']) {
                $lote = LoteExplosivo::find($datos['id_lote']);
                if ($lote) {
                    $lote->descontar($datos['cantidad']);
                }
            }

            return $movimiento;
        });
    }

    /**
     * Registrar ajuste de inventario
     */
    public static function registrarAjuste($datos)
    {
        return DB::transaction(function () use ($datos) {
            $stock = StockExplosivo::obtenerOCrear(
                $datos['id_polvorin'],
                $datos['id_tipo_explosivo'],
                $datos['id_faena']
            );

            $diferencia = $datos['cantidad_nueva'] - $stock->cantidad;

            // Crear el movimiento
            $movimiento = self::create([
                'codigo' => self::generarCodigo(),
                'tipo' => self::TIPO_AJUSTE,
                'id_polvorin_origen' => $diferencia < 0 ? $datos['id_polvorin'] : null,
                'id_polvorin_destino' => $diferencia > 0 ? $datos['id_polvorin'] : null,
                'id_tipo_explosivo' => $datos['id_tipo_explosivo'],
                'cantidad' => abs($diferencia),
                'fecha' => $datos['fecha'] ?? Carbon::now()->toDateString(),
                'hora' => $datos['hora'] ?? Carbon::now()->format('H:i'),
                'autorizado_por' => $datos['autorizado_por'] ?? null,
                'motivo' => $datos['motivo'] ?? 'Ajuste de inventario',
                'observaciones' => $datos['observaciones'] ?? null,
                'id_faena' => $datos['id_faena'],
                'user_id' => $datos['user_id'] ?? auth()->id(),
            ]);

            // Actualizar stock directamente
            $stock->cantidad = $datos['cantidad_nueva'];
            $stock->save();

            return $movimiento;
        });
    }

    /**
     * ATRIBUTOS
     */
    public function getTipoFormateadoAttribute()
    {
        $tipos = [
            self::TIPO_ENTRADA => 'Entrada',
            self::TIPO_SALIDA => 'Salida',
            self::TIPO_TRANSFERENCIA => 'Transferencia',
            self::TIPO_AJUSTE => 'Ajuste',
            self::TIPO_DEVOLUCION => 'Devolución',
        ];
        return $tipos[$this->tipo] ?? $this->tipo;
    }

    public function getEsPositivoAttribute()
    {
        return in_array($this->tipo, [self::TIPO_ENTRADA, self::TIPO_DEVOLUCION]);
    }
}
