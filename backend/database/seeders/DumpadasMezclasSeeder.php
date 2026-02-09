<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Dispatch\Dumpada;
use App\Models\Laboratorio\Mezcla;
use App\Models\Laboratorio\MezclaDumpada;
use App\Models\Ingenieria\FrenteTrabajo;
use Illuminate\Support\Facades\DB;

class DumpadasMezclasSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        echo "🌱 Creando datos de prueba (SIN BORRAR EXISTENTES)...\n";

        // 1. Obtener un frente de trabajo existente o crear uno de prueba
        $frente = FrenteTrabajo::first();

        if (!$frente) {
            echo "⚠️  No hay frentes de trabajo. Por favor crea uno desde el módulo de Ingeniería primero.\n";
            return;
        }

        echo "✅ Usando frente: {$frente->codigo_completo}\n";

        // 2. Crear dumpadas de prueba (20 dumpadas)
        echo "📦 Creando 20 dumpadas de prueba...\n";

        $dumpadas = [];
        $n_acop_base = 5000;

        for ($i = 0; $i < 20; $i++) {
            $dumpada = Dumpada::create([
                'n_acop' => $n_acop_base + $i,
                'acopios' => 'DT-' . str_pad($n_acop_base + $i, 4, '0', STR_PAD_LEFT),
                'id_frente_trabajo' => $frente->id,
                'fecha' => now()->subDays(rand(1, 10))->format('Y-m-d'),
                'jornada' => ['AM', 'PM', 'Madrugada'][rand(0, 2)],
                'ton' => round(rand(30, 60) / 10, 2), // Entre 3.0 y 6.0 toneladas
                'ley' => round(rand(80, 180) / 100, 2), // Entre 0.80% y 1.80%
                'estado' => 'Completado',
                'id_faena' => 1,
                'user_id' => 1,
            ]);

            $dumpadas[] = $dumpada;
        }

        echo "✅ 20 dumpadas creadas (IDs: {$dumpadas[0]->id} - {$dumpadas[19]->id})\n";

        // 3. Crear 3 mezclas de ejemplo
        echo "🧪 Creando 3 mezclas de ejemplo...\n";

        // Mezcla 1: Con las primeras 8 dumpadas
        $mezcla1 = Mezcla::create([
            'codigo' => 'CZ5001',
            'fecha' => now()->subDays(5)->format('Y-m-d'),
            'id_faena' => 1,
            'estado' => 'Despachado',
            'user_id' => 1,
            'observaciones' => 'Mezcla de prueba 1 - Material de alta ley',
        ]);

        foreach (array_slice($dumpadas, 0, 8) as $dumpada) {
            MezclaDumpada::desdeDumpada($dumpada, $mezcla1->id);
        }

        $mezcla1->calcularTotales();
        $mezcla1->ley_lab = round($mezcla1->ley_prom_dump + (rand(-10, 10) / 100), 2);
        $mezcla1->save();

        echo "  ✅ Mezcla {$mezcla1->codigo}: {$mezcla1->total_ton} ton, Ley: {$mezcla1->ley_prom_dump}%\n";

        // Mezcla 2: Con 7 dumpadas
        $mezcla2 = Mezcla::create([
            'codigo' => 'CZ5002',
            'fecha' => now()->subDays(3)->format('Y-m-d'),
            'id_faena' => 1,
            'estado' => 'En Despacho',
            'user_id' => 1,
            'observaciones' => 'Mezcla de prueba 2 - Material estándar',
        ]);

        foreach (array_slice($dumpadas, 8, 7) as $dumpada) {
            MezclaDumpada::desdeDumpada($dumpada, $mezcla2->id);
        }

        $mezcla2->calcularTotales();
        $mezcla2->save();

        echo "  ✅ Mezcla {$mezcla2->codigo}: {$mezcla2->total_ton} ton, Ley: {$mezcla2->ley_prom_dump}%\n";

        // Mezcla 3: Con las últimas 5 dumpadas
        $mezcla3 = Mezcla::create([
            'codigo' => 'CZ5003',
            'fecha' => now()->subDays(1)->format('Y-m-d'),
            'id_faena' => 1,
            'estado' => 'Confirmado',
            'user_id' => 1,
            'observaciones' => 'Mezcla de prueba 3 - Recién creada',
        ]);

        foreach (array_slice($dumpadas, 15, 5) as $dumpada) {
            MezclaDumpada::desdeDumpada($dumpada, $mezcla3->id);
        }

        $mezcla3->calcularTotales();
        $mezcla3->save();

        echo "  ✅ Mezcla {$mezcla3->codigo}: {$mezcla3->total_ton} ton, Ley: {$mezcla3->ley_prom_dump}%\n";

        echo "\n";
        echo "🎉 ¡Datos de prueba creados exitosamente!\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        echo "📊 Resumen:\n";
        echo "   • Dumpadas creadas: 20\n";
        echo "   • Dumpadas en mezclas: 20\n";
        echo "   • Dumpadas disponibles: 0\n";
        echo "   • Mezclas creadas: 3\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        echo "💡 Ahora puedes:\n";
        echo "   1. Ver las mezclas en el módulo Dispatch → Mezclas\n";
        echo "   2. Crear más dumpadas desde Dispatch → Ingreso\n";
        echo "   3. Crear nuevas mezclas con las dumpadas disponibles\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    }
}
