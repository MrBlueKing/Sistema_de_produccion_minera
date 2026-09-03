<?php

namespace App\Support;

use Carbon\Carbon;

/**
 * Orden estándar de las muestras (dumpadas y muestras libres) en los certificados
 * y en el Historial de Laboratorio.
 *
 * Regla acordada (feedback marcha blanca, sep-2026):
 *   Certificado : frente (A→Z por codigo_completo) → fecha → numero_jornada asc
 *                 → numero_dumpada asc.
 *   Historial   : sin certificado primero → (con certificado) N° de certificado
 *                 descendente → luego el mismo orden que el certificado.
 *
 * El orden NO depende de cómo se seleccionaron las muestras.
 */
class OrdenMuestras
{
    /**
     * Clave de orden de una muestra dentro de su grupo (certificado o bloque de
     * historial). La colección se ordena ASCENDENTE por el string resultante.
     */
    public static function clave(
        ?string $frenteCodigo,
        $fecha = null,
        $numeroJornada = null,
        $numeroDumpada = null
    ): string {
        // Los frentes con código van primero (prefijo "1"); sin código, al final ("2").
        $frente = $frenteCodigo !== null && trim($frenteCodigo) !== ''
            ? '1' . mb_strtolower(trim($frenteCodigo))
            : '2';

        $fechaKey = $fecha
            ? Carbon::parse($fecha)->format('Y-m-d')
            : '9999-99-99';

        $jornada = str_pad((string) (int) ($numeroJornada ?? 0), 8, '0', STR_PAD_LEFT);

        // numero_dumpada es string en la BD pero contiene números.
        $dumpada = str_pad(
            (string) (int) preg_replace('/\D/', '', (string) ($numeroDumpada ?? '0')),
            12,
            '0',
            STR_PAD_LEFT
        );

        return "{$frente}|{$fechaKey}|{$jornada}|{$dumpada}";
    }

    /**
     * Clave de orden para el Historial de Laboratorio: bloque "sin certificado"
     * (0) antes que "con certificado" (1); dentro de "con certificado", número de
     * certificado descendente; luego el mismo orden que el certificado.
     */
    public static function claveHistorial(
        $certificado,
        ?string $frenteCodigo,
        $fecha = null,
        $numeroJornada = null,
        $numeroDumpada = null
    ): string {
        $cert = trim((string) ($certificado ?? ''));

        if ($cert === '') {
            $bloque = '0|';
        } else {
            // Descendente: se invierte el número para poder ordenar ASC.
            $num = (int) preg_replace('/\D/', '', $cert);
            $inv = str_pad((string) (9999999999 - $num), 10, '0', STR_PAD_LEFT);
            $bloque = "1|{$inv}|";
        }

        return $bloque . self::clave($frenteCodigo, $fecha, $numeroJornada, $numeroDumpada);
    }

    /**
     * Ordena una colección de dumpadas para un certificado.
     */
    public static function ordenarDumpadas($dumpadas)
    {
        return $dumpadas
            ->sortBy(fn ($d) => self::clave(
                $d->frenteTrabajo?->codigo_completo,
                $d->fecha,
                $d->numero_jornada,
                $d->numero_dumpada
            ))
            ->values();
    }

    /**
     * Ordena una colección de muestras libres para un certificado.
     * No tienen numero_jornada/numero_dumpada: se desempata por id.
     */
    public static function ordenarMuestrasLibres($muestras)
    {
        return $muestras
            ->sortBy(fn ($m) => self::clave(
                $m->frenteTrabajo?->codigo_completo,
                $m->fecha,
                0,
                $m->id
            ))
            ->values();
    }
}
