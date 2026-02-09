<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Laboratorio\Empresa;

class EmpresasSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * Crear las empresas que venden mineral a las plantas
     */
    public function run(): void
    {
        $empresas = [
            [
                'nombre' => 'Santa Ana',
                'codigo' => 'SA',
                'rut' => null,
                'activo' => true,
            ],
            [
                'nombre' => 'MDF Inés',
                'codigo' => 'MDFI',
                'rut' => null,
                'activo' => true,
            ],
            [
                'nombre' => 'SyC Juanita',
                'codigo' => 'SYCJ',
                'rut' => null,
                'activo' => true,
            ],
        ];

        foreach ($empresas as $empresaData) {
            Empresa::updateOrCreate(
                ['codigo' => $empresaData['codigo']],
                $empresaData
            );
        }

        $this->command->info('Empresas creadas exitosamente.');
    }
}
