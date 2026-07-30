<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\Dispatch\Dumpada;

/**
 * Corrige 8 dumpadas de Cabildo (numero_dumpada 9115 a 9122, certificados de
 * laboratorio 28996/28997, frente M5-1SH2 REC, 04-may-2026) cuya Ley Dump en la
 * BD no coincide con la hoja "DB" de Cabildo.xlsx. A diferencia del grupo de
 * 10516-10531 (fix en 2026_07_30_000002), esta diferencia no es un reordenamiento
 * detectable matematicamente entre ambos lados - son valores genuinamente
 * distintos. Se decidio tratar el Excel como fuente de verdad (igual criterio
 * aplicado en el resto de la auditoria BD vs Excel de esta sesion).
 *
 * Recalcula ley_cup (capping), rango y cu_insoluble con los metodos ya
 * existentes del modelo, usando el valor de ley correcto.
 */
return new class extends Migration
{
    private const VALORES_CORRECTOS = [
        '9115' => 1.50,
        '9116' => 0.92,
        '9117' => 2.10,
        '9118' => 3.28,
        '9119' => 1.59,
        '9120' => 1.55,
        '9121' => 2.49,
        '9122' => 2.85,
    ];

    public function up(): void
    {
        $corregidas = 0;

        foreach (self::VALORES_CORRECTOS as $numeroDumpada => $ley) {
            $dumpada = Dumpada::where('id_faena', 1)
                ->where('numero_dumpada', $numeroDumpada)
                ->first();

            if (!$dumpada) {
                continue;
            }

            $rango = Dumpada::determinarRango($ley);
            $leyCup = Dumpada::calcularCapping($ley, 1);
            $cuInsoluble = round($ley - (float) ($dumpada->cu_soluble ?? 0), 3);

            $dumpada->update([
                'ley' => $ley,
                'ley_cup' => $leyCup,
                'rango' => $rango,
                'cu_insoluble' => $cuInsoluble,
            ]);
            $corregidas++;
        }

        \Log::info('🔧 [FIX LEY DUMP GRUPO 1] Dumpadas corregidas', ['cantidad' => $corregidas]);
    }

    public function down(): void
    {
        // No reversible de forma segura de manera automática.
    }
};
