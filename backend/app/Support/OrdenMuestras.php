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
     * Orden cronológico de las jornadas (turnos) para el ordenamiento de muestras:
     * AM → PM → Noche → Madrugada.
     */
    /** Orden de las jornadas: el de Configuración General (AM, PM, Noche, Madrugada, ...). */
    private static ?array $ordenJornada = null;

    private static function ordenJornada(string $jornada): string
    {
        if (self::$ordenJornada === null) {
            self::$ordenJornada = \App\Models\Jornada::ordenadas()->pluck('orden', 'nombre')->all();
        }
        return str_pad((string) (self::$ordenJornada[$jornada] ?? 999), 3, '0', STR_PAD_LEFT);
    }

    /**
     * Separador de campos en la clave. Se usa un byte de control (0x01), menor que
     * cualquier carácter imprimible, para que un código de frente que es prefijo de
     * otro ("M3-12N" vs "M3-12NE") ordene primero — con "|" (0x7C) el más corto
     * quedaba después porque el separador vale más que las letras.
     */
    private const SEP = "\x01";

    /**
     * Clave de orden de una muestra dentro de su grupo (certificado o bloque de
     * historial). La colección se ordena ASCENDENTE por el string resultante.
     *
     * frente → fecha → jornada (AM, PM, Madrugada, Noche) → numero_jornada →
     * numero_dumpada. Así cada turno queda en bloque y numerado 1, 2, 3…
     */
    public static function clave(
        ?string $frenteCodigo,
        $fecha = null,
        $jornada = null,
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

        $jornadaKey = self::ordenJornada((string) $jornada);

        $numJornada = str_pad((string) (int) ($numeroJornada ?? 0), 8, '0', STR_PAD_LEFT);

        // numero_dumpada es string en la BD pero contiene números.
        $dumpada = str_pad(
            (string) (int) preg_replace('/\D/', '', (string) ($numeroDumpada ?? '0')),
            12,
            '0',
            STR_PAD_LEFT
        );

        return implode(self::SEP, [$frente, $fechaKey, $jornadaKey, $numJornada, $dumpada]);
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
        $jornada = null,
        $numeroJornada = null,
        $numeroDumpada = null
    ): string {
        $cert = trim((string) ($certificado ?? ''));

        if ($cert === '') {
            $bloque = '0' . self::SEP;
        } else {
            // Descendente: se invierte el número para poder ordenar ASC.
            $num = (int) preg_replace('/\D/', '', $cert);
            $inv = str_pad((string) (9999999999 - $num), 10, '0', STR_PAD_LEFT);
            $bloque = '1' . self::SEP . $inv . self::SEP;
        }

        return $bloque . self::clave($frenteCodigo, $fecha, $jornada, $numeroJornada, $numeroDumpada);
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
                $d->jornada,
                $d->numero_jornada,
                $d->numero_dumpada
            ), SORT_STRING)
            ->values();
    }

    /**
     * Ordena una colección de muestras libres para un certificado.
     * No tienen jornada/numero_jornada/numero_dumpada: se desempata por id.
     */
    public static function ordenarMuestrasLibres($muestras)
    {
        return $muestras
            ->sortBy(fn ($m) => self::clave(
                $m->frenteTrabajo?->codigo_completo,
                $m->fecha,
                null,
                0,
                $m->id
            ), SORT_STRING)
            ->values();
    }
}
