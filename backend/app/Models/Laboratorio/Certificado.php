<?php

namespace App\Models\Laboratorio;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class Certificado extends Model
{
    protected $table = 'certificados';

    protected $fillable = [
        'numero_certificado',
        'estado',
        'generado_por',
        'destino',
        'aprobado_por',
        'fecha_aprobacion',
        'motivo_rechazo',
        'enviado_a',
        'fecha_envio_correo',
    ];

    protected $casts = [
        'fecha_aprobacion' => 'datetime',
        'fecha_envio_correo' => 'datetime',
    ];

    const ESTADO_PENDIENTE = 'Pendiente';
    const ESTADO_APROBADO = 'Aprobado';
    const ESTADO_RECHAZADO = 'Rechazado';

    /**
     * Estado de un número de certificado. Si no existe fila, se considera
     * Aprobado (certificado histórico, generado antes de este control).
     */
    public static function estadoParaNumero(string $numeroCertificado): string
    {
        $certificado = self::where('numero_certificado', $numeroCertificado)->first();

        return $certificado->estado ?? self::ESTADO_APROBADO;
    }

    /**
     * Mapa numero_certificado => Certificado para mergear estados en una lista.
     */
    public static function mapaParaNumeros(array $numeros): Collection
    {
        return self::whereIn('numero_certificado', $numeros)->get()->keyBy('numero_certificado');
    }

    public function aprobar(string $aprobadoPor): self
    {
        if ($this->estado === self::ESTADO_APROBADO) {
            throw new \Exception('El certificado ya está aprobado.');
        }

        $this->estado = self::ESTADO_APROBADO;
        $this->aprobado_por = $aprobadoPor;
        $this->fecha_aprobacion = now();
        $this->motivo_rechazo = null;
        $this->save();

        return $this;
    }

    public function rechazar(string $motivo, string $rechazadoPor): self
    {
        if (trim($motivo) === '') {
            throw new \Exception('Debe indicar un motivo de rechazo.');
        }

        $this->estado = self::ESTADO_RECHAZADO;
        $this->motivo_rechazo = $motivo;
        $this->aprobado_por = $rechazadoPor;
        $this->fecha_aprobacion = now();
        $this->save();

        return $this;
    }
}
