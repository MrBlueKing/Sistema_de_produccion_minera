<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ConfiguracionesSistemaSeeder extends Seeder
{
    /**
     * Seedear configuraciones iniciales del sistema
     */
    public function run(): void
    {
        $configuraciones = [
            [
                'clave' => 'factor_ajuste_ley',
                'valor' => '0.9',
                'tipo' => 'number',
                'descripcion' => 'Factor de ajuste aplicado a las leyes en mezclas (ej: ley_dump × 0.9 = ley_ajustada)',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'clave' => 'peso_camion_default',
                'valor' => '29',
                'tipo' => 'number',
                'descripcion' => 'Peso teórico predefinido por camión en toneladas (capacidad estándar del camión)',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'clave' => 'tonelaje_dumpada_default',
                'valor' => '4.6',
                'tipo' => 'number',
                'descripcion' => 'Tonelaje teórico por defecto para cada dumpada (capacidad estándar del dumper)',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'clave' => 'factor_remanente_visual',
                'valor' => '1.11',
                'tipo' => 'number',
                'descripcion' => 'Factor para calcular ley visual de remanentes (ley_visual = ley_lote × factor)',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        foreach ($configuraciones as $config) {
            DB::table('configuraciones_sistema')->updateOrInsert(
                ['clave' => $config['clave']],
                $config
            );
        }

        $this->command->info('✅ Configuraciones del sistema sedeadas correctamente');
    }
}
