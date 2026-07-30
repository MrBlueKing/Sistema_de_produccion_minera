<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\Dispatch\Dumpada;

/**
 * Corrige 16 dumpadas de Cabildo (numero_dumpada 10516 a 10531, certificado de
 * laboratorio del 04-jul-2026) cuya Ley Dump quedo invertida en orden espejo al
 * importar: el valor que le correspondia a la dumpada 10531 quedo en la 10516,
 * el de la 10530 en la 10517, y asi sucesivamente hasta el medio del grupo.
 * Confirmado comparando 1 a 1 contra la hoja "DB" de Cabildo.xlsx (fuente de
 * verdad de laboratorio) - las 16 filas calzan exacto en orden inverso.
 *
 * Recalcula ley_cup (capping) y rango con los metodos ya existentes del modelo,
 * usando el valor de ley correcto.
 */
return new class extends Migration
{
    private const VALORES_CORRECTOS = [
        '10516' => 1.87,
        '10517' => 2.99,
        '10518' => 1.97,
        '10519' => 1.46,
        '10520' => 1.84,
        '10521' => 2.45,
        '10522' => 2.39,
        '10523' => 3.17,
        '10524' => 4.26,
        '10525' => 2.50,
        '10526' => 1.65,
        '10527' => 2.81,
        '10528' => 3.03,
        '10529' => 1.40,
        '10530' => 0.89,
        '10531' => 2.81,
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
            // cu_insoluble = ley - cu_soluble (misma formula que LaboratorioController); mantiene
            // coherencia interna con la Ley Dump corregida.
            $cuInsoluble = round($ley - (float) ($dumpada->cu_soluble ?? 0), 3);

            $dumpada->update([
                'ley' => $ley,
                'ley_cup' => $leyCup,
                'rango' => $rango,
                'cu_insoluble' => $cuInsoluble,
            ]);
            $corregidas++;
        }

        \Log::info('🔧 [FIX LEY DUMP INVERTIDA] Dumpadas corregidas', ['cantidad' => $corregidas]);
    }

    public function down(): void
    {
        // No reversible de forma segura de manera automática.
    }
};
