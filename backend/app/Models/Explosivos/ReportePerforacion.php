<?php

namespace App\Models\Explosivos;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ReportePerforacion extends Model
{
    use HasFactory;

    protected $table = 'reportes_perforacion';

    protected $fillable = [
        'codigo',
        'fecha',
        'turno',
        'estado',
        'observaciones',
        'confirmado_por',
        'fecha_confirmacion',
        'id_polvorin',
        'id_faena',
        'user_id',
    ];

    protected $casts = [
        'fecha' => 'date',
        'fecha_confirmacion' => 'datetime',
    ];

    const ESTADO_BORRADOR = 'borrador';
    const ESTADO_CONFIRMADO = 'confirmado';
    const ESTADO_CERRADO = 'cerrado';

    // RELACIONES

    public function lineas()
    {
        return $this->hasMany(LineaReportePerforacion::class, 'id_reporte');
    }

    public function devoluciones()
    {
        return $this->hasMany(DevolucionReporte::class, 'id_reporte');
    }

    public function movimientos()
    {
        return $this->hasMany(MovimientoExplosivo::class, 'id_reporte_perforacion');
    }

    public function polvorin()
    {
        return $this->belongsTo(Polvorin::class, 'id_polvorin');
    }

    public function user()
    {
        return $this->belongsTo(\App\Models\User::class, 'user_id');
    }

    public function auditoria()
    {
        return $this->hasMany(AuditoriaReportePerforacion::class, 'id_reporte');
    }

    // SCOPES

    public function scopePorFaena($query, $idFaena)
    {
        if ($idFaena) {
            return $query->where('id_faena', $idFaena);
        }
        return $query;
    }

    public function scopePorEstado($query, $estado)
    {
        if ($estado) {
            return $query->where('estado', $estado);
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

    // MÉTODOS ESTÁTICOS

    public static function generarCodigo()
    {
        $año = Carbon::now()->year;
        $prefijo = "RPT-{$año}-";

        $ultimoNumero = self::where('codigo', 'like', $prefijo . '%')
            ->selectRaw("MAX(CAST(SUBSTRING(codigo, " . (strlen($prefijo) + 1) . ") AS UNSIGNED)) as max_num")
            ->value('max_num');

        $nuevoNumero = ($ultimoNumero ?? 0) + 1;

        return $prefijo . str_pad($nuevoNumero, 4, '0', STR_PAD_LEFT);
    }

    // MÉTODOS DE NEGOCIO

    public function calcularTotalesExplosivos()
    {
        $totales = [];

        foreach ($this->lineas as $linea) {
            foreach ($linea->explosivos as $exp) {
                $idTipo = $exp->id_tipo_explosivo;
                if (!isset($totales[$idTipo])) {
                    $totales[$idTipo] = [
                        'id_tipo_explosivo' => $idTipo,
                        'tipo_explosivo' => $exp->tipoExplosivo,
                        'cantidad_total' => 0,
                    ];
                }
                $totales[$idTipo]['cantidad_total'] += $exp->cantidad_final;
            }
        }

        return array_values($totales);
    }

    public function confirmar($confirmadoPor)
    {
        return DB::transaction(function () use ($confirmadoPor) {
            $totales = $this->calcularTotalesExplosivos();

            // Validar stock para cada tipo de explosivo
            foreach ($totales as $total) {
                if ($total['cantidad_total'] <= 0) continue;

                $stock = StockExplosivo::where('id_polvorin', $this->id_polvorin)
                    ->where('id_tipo_explosivo', $total['id_tipo_explosivo'])
                    ->first();

                if (!$stock || $stock->cantidad_disponible < $total['cantidad_total']) {
                    $nombre = $total['tipo_explosivo']->nombre ?? 'Desconocido';
                    $disponible = $stock ? $stock->cantidad_disponible : 0;
                    throw new \Exception("Stock insuficiente de {$nombre}. Disponible: {$disponible}, Requerido: {$total['cantidad_total']}");
                }
            }

            // Generar movimientos de salida agrupados por tipo explosivo
            foreach ($totales as $total) {
                if ($total['cantidad_total'] <= 0) continue;

                $movimiento = MovimientoExplosivo::create([
                    'codigo' => MovimientoExplosivo::generarCodigo(),
                    'tipo' => MovimientoExplosivo::TIPO_SALIDA,
                    'id_polvorin_origen' => $this->id_polvorin,
                    'id_tipo_explosivo' => $total['id_tipo_explosivo'],
                    'cantidad' => $total['cantidad_total'],
                    'id_reporte_perforacion' => $this->id,
                    'fecha' => $this->fecha,
                    'hora' => Carbon::now()->format('H:i'),
                    'autorizado_por' => $confirmadoPor,
                    'motivo' => "Salida por reporte {$this->codigo}",
                    'id_faena' => $this->id_faena,
                    'user_id' => auth()->id(),
                ]);

                // Descontar stock
                $stock = StockExplosivo::where('id_polvorin', $this->id_polvorin)
                    ->where('id_tipo_explosivo', $total['id_tipo_explosivo'])
                    ->first();
                $stock->decrementar($total['cantidad_total']);
            }

            // Actualizar estado
            $this->estado = self::ESTADO_CONFIRMADO;
            $this->confirmado_por = $confirmadoPor;
            $this->fecha_confirmacion = Carbon::now();
            $this->save();

            return $this;
        });
    }

    public function anular()
    {
        return DB::transaction(function () {
            // Obtener movimientos de salida del reporte
            $movimientosSalida = $this->movimientos()
                ->where('tipo', MovimientoExplosivo::TIPO_SALIDA)
                ->get();

            foreach ($movimientosSalida as $movimiento) {
                // Devolver al stock
                $stock = StockExplosivo::obtenerOCrear(
                    $this->id_polvorin,
                    $movimiento->id_tipo_explosivo,
                    $this->id_faena
                );
                $stock->incrementar($movimiento->cantidad);

                // Crear movimiento de ajuste
                MovimientoExplosivo::create([
                    'codigo' => MovimientoExplosivo::generarCodigo(),
                    'tipo' => MovimientoExplosivo::TIPO_AJUSTE,
                    'id_polvorin_destino' => $this->id_polvorin,
                    'id_tipo_explosivo' => $movimiento->id_tipo_explosivo,
                    'cantidad' => $movimiento->cantidad,
                    'id_reporte_perforacion' => $this->id,
                    'fecha' => Carbon::now()->toDateString(),
                    'hora' => Carbon::now()->format('H:i'),
                    'motivo' => "Anulación reporte {$this->codigo}",
                    'id_faena' => $this->id_faena,
                    'user_id' => auth()->id(),
                ]);
            }

            // Resetear estado
            $this->estado = self::ESTADO_BORRADOR;
            $this->confirmado_por = null;
            $this->fecha_confirmacion = null;
            $this->save();

            return $this;
        });
    }

    public function cerrar($devoluciones = [])
    {
        return DB::transaction(function () use ($devoluciones) {
            foreach ($devoluciones as $dev) {
                // Crear movimiento de devolución
                $movimiento = MovimientoExplosivo::create([
                    'codigo' => MovimientoExplosivo::generarCodigo(),
                    'tipo' => MovimientoExplosivo::TIPO_DEVOLUCION,
                    'id_polvorin_destino' => $this->id_polvorin,
                    'id_tipo_explosivo' => $dev['id_tipo_explosivo'],
                    'cantidad' => $dev['cantidad'],
                    'id_reporte_perforacion' => $this->id,
                    'fecha' => Carbon::now()->toDateString(),
                    'hora' => Carbon::now()->format('H:i'),
                    'motivo' => $dev['motivo'] ?? "Devolución reporte {$this->codigo}",
                    'id_faena' => $this->id_faena,
                    'user_id' => auth()->id(),
                ]);

                // Incrementar stock
                $stock = StockExplosivo::obtenerOCrear(
                    $this->id_polvorin,
                    $dev['id_tipo_explosivo'],
                    $this->id_faena
                );
                $stock->incrementar($dev['cantidad']);

                // Registrar devolución
                DevolucionReporte::create([
                    'id_reporte' => $this->id,
                    'id_tipo_explosivo' => $dev['id_tipo_explosivo'],
                    'cantidad' => $dev['cantidad'],
                    'id_personal' => $dev['id_personal'] ?? null,
                    'motivo' => $dev['motivo'] ?? null,
                    'id_movimiento' => $movimiento->id,
                ]);
            }

            $this->estado = self::ESTADO_CERRADO;
            $this->save();

            return $this;
        });
    }
}
