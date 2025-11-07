<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RangoSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $rangos = [
            // Orden ascendente por límite inferior
            ['nomenclatura' => 'Descarte', 'limite_inferior' => 0.00, 'limite_superior' => 0.59, 'amplitud' => 0.59, 'orden' => 1],
            ['nomenclatura' => 'A', 'limite_inferior' => 0.60, 'limite_superior' => 0.74, 'amplitud' => 0.14, 'orden' => 2],
            ['nomenclatura' => 'B', 'limite_inferior' => 0.75, 'limite_superior' => 0.89, 'amplitud' => 0.14, 'orden' => 3],
            ['nomenclatura' => 'Reserva', 'limite_inferior' => 0.90, 'limite_superior' => 1.04, 'amplitud' => 0.14, 'orden' => 4],
            ['nomenclatura' => 'C', 'limite_inferior' => 1.05, 'limite_superior' => 1.19, 'amplitud' => 0.14, 'orden' => 5],
            ['nomenclatura' => 'D', 'limite_inferior' => 1.20, 'limite_superior' => 1.34, 'amplitud' => 0.14, 'orden' => 6],
            ['nomenclatura' => 'E', 'limite_inferior' => 1.35, 'limite_superior' => 1.49, 'amplitud' => 0.14, 'orden' => 7],
            ['nomenclatura' => 'F', 'limite_inferior' => 1.50, 'limite_superior' => 1.74, 'amplitud' => 0.24, 'orden' => 8],
            ['nomenclatura' => 'G', 'limite_inferior' => 1.75, 'limite_superior' => 1.89, 'amplitud' => 0.14, 'orden' => 9],
            ['nomenclatura' => 'H', 'limite_inferior' => 1.90, 'limite_superior' => 2.09, 'amplitud' => 0.19, 'orden' => 10],
            ['nomenclatura' => 'I', 'limite_inferior' => 2.10, 'limite_superior' => 2.24, 'amplitud' => 0.14, 'orden' => 11],
            ['nomenclatura' => 'J', 'limite_inferior' => 2.25, 'limite_superior' => 2.49, 'amplitud' => 0.24, 'orden' => 12],
            ['nomenclatura' => 'K', 'limite_inferior' => 2.50, 'limite_superior' => 2.74, 'amplitud' => 0.24, 'orden' => 13],
            ['nomenclatura' => 'L', 'limite_inferior' => 2.75, 'limite_superior' => 99.99, 'amplitud' => 0.25, 'orden' => 14],
        ];

        foreach ($rangos as $rango) {
            DB::table('rangos')->insert([
                'nomenclatura' => $rango['nomenclatura'],
                'limite_inferior' => $rango['limite_inferior'],
                'limite_superior' => $rango['limite_superior'],
                'amplitud' => $rango['amplitud'],
                'orden' => $rango['orden'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
