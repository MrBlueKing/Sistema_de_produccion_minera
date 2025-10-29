<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TiposFrenteSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('tipos_frente')->insert([
            ['nombre' => 'Levante', 'abreviatura' => 'LEV', 'created_at' => now(), 'updated_at' => now()],
            ['nombre' => 'Frente', 'abreviatura' => 'FR', 'created_at' => now(), 'updated_at' => now()],
            ['nombre' => 'Recuperacion', 'abreviatura' => 'RC', 'created_at' => now(), 'updated_at' => now()],
            ['nombre' => 'Drift', 'abreviatura' => 'DF', 'created_at' => now(), 'updated_at' => now()],
            ['nombre' => 'Rebaje Piso', 'abreviatura' => 'RP', 'created_at' => now(), 'updated_at' => now()],
            ['nombre' => 'Chimenea', 'abreviatura' => 'CHIM', 'created_at' => now(), 'updated_at' => now()],
            ['nombre' => 'Banco', 'abreviatura' => 'BC', 'created_at' => now(), 'updated_at' => now()],
            ['nombre' => 'Rebaje Techo', 'abreviatura' => 'RT', 'created_at' => now(), 'updated_at' => now()],
            ['nombre' => 'Desquinche', 'abreviatura' => 'DQ', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }
}
