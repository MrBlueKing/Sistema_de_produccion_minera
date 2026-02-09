<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Laboratorio\Planta;

class PlantasSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * Crear las plantas donde se vende el mineral
     */
    public function run(): void
    {
        $plantas = [
            [
                'nombre' => 'Enami',
                'codigo' => 'EN',
                'prefijo_codigo' => 'EN',
                'descripcion' => 'Planta Enami',
                'activo' => true,
            ],
            [
                'nombre' => 'Cenizas',
                'codigo' => 'CZ',
                'prefijo_codigo' => 'CZ',
                'descripcion' => 'Planta Cenizas',
                'activo' => true,
            ],
        ];

        foreach ($plantas as $plantaData) {
            Planta::updateOrCreate(
                ['codigo' => $plantaData['codigo']],
                $plantaData
            );
        }

        $this->command->info('Plantas creadas exitosamente.');
    }
}
