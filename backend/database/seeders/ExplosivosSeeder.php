<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Explosivos\CategoriaExplosivo;
use App\Models\Explosivos\TipoExplosivo;

class ExplosivosSeeder extends Seeder
{
    /**
     * Seed the application's database with explosives catalog.
     */
    public function run(): void
    {
        echo "🧨 Creando catálogo de explosivos...\n";

        // =============================================
        // CATEGORÍAS DE EXPLOSIVOS
        // =============================================
        $categorias = [
            [
                'nombre' => 'Agentes de Voladura',
                'descripcion' => 'Explosivos a granel para carga de pozos (ANFO, emulsiones)',
                'orden' => 1,
            ],
            [
                'nombre' => 'Iniciadores',
                'descripcion' => 'Detonadores, boosters y cordón detonante',
                'orden' => 2,
            ],
            [
                'nombre' => 'Explosivos Encartuchados',
                'descripcion' => 'Dinamitas y emulsiones encartuchadas',
                'orden' => 3,
            ],
            [
                'nombre' => 'Accesorios de Voladura',
                'descripcion' => 'Mecha lenta, conectores, retardos',
                'orden' => 4,
            ],
        ];

        foreach ($categorias as $catData) {
            CategoriaExplosivo::updateOrCreate(
                ['nombre' => $catData['nombre']],
                $catData
            );
        }

        echo "  ✅ " . count($categorias) . " categorías creadas\n";

        // =============================================
        // TIPOS DE EXPLOSIVOS
        // =============================================

        // Obtener IDs de categorías
        $catAgentes = CategoriaExplosivo::where('nombre', 'Agentes de Voladura')->first()->id;
        $catIniciadores = CategoriaExplosivo::where('nombre', 'Iniciadores')->first()->id;
        $catEncartuchados = CategoriaExplosivo::where('nombre', 'Explosivos Encartuchados')->first()->id;
        $catAccesorios = CategoriaExplosivo::where('nombre', 'Accesorios de Voladura')->first()->id;

        $tipos = [
            // AGENTES DE VOLADURA
            [
                'codigo' => 'ANFO-STD',
                'nombre' => 'ANFO Standard',
                'id_categoria' => $catAgentes,
                'unidad_medida' => 'kg',
                'requiere_lote' => true,
                'dias_alerta_vencimiento' => 180,
                'stock_minimo' => 500,
                'stock_maximo' => 10000,
                'fabricante' => 'ENAEX',
                'clasificacion_onu' => '1.1D',
                'descripcion' => 'Nitrato de amonio con fuel oil, uso general en minería',
            ],
            [
                'codigo' => 'ANFO-AL',
                'nombre' => 'ANFO Aluminizado',
                'id_categoria' => $catAgentes,
                'unidad_medida' => 'kg',
                'requiere_lote' => true,
                'dias_alerta_vencimiento' => 180,
                'stock_minimo' => 200,
                'stock_maximo' => 5000,
                'fabricante' => 'ENAEX',
                'clasificacion_onu' => '1.1D',
                'descripcion' => 'ANFO con aluminio para mayor potencia',
            ],
            [
                'codigo' => 'EMU-BULK',
                'nombre' => 'Emulsión a Granel',
                'id_categoria' => $catAgentes,
                'unidad_medida' => 'kg',
                'requiere_lote' => true,
                'dias_alerta_vencimiento' => 120,
                'stock_minimo' => 300,
                'stock_maximo' => 8000,
                'fabricante' => 'ORICA',
                'clasificacion_onu' => '1.1D',
                'descripcion' => 'Emulsión explosiva bombeada directamente a pozos',
            ],

            // INICIADORES
            [
                'codigo' => 'DET-ELEC',
                'nombre' => 'Detonador Eléctrico',
                'id_categoria' => $catIniciadores,
                'unidad_medida' => 'unidades',
                'requiere_lote' => true,
                'dias_alerta_vencimiento' => 365,
                'stock_minimo' => 100,
                'stock_maximo' => 2000,
                'fabricante' => 'ENAEX',
                'clasificacion_onu' => '1.1B',
                'descripcion' => 'Detonador eléctrico instantáneo',
            ],
            [
                'codigo' => 'DET-NONEL',
                'nombre' => 'Detonador No Eléctrico (Nonel)',
                'id_categoria' => $catIniciadores,
                'unidad_medida' => 'unidades',
                'requiere_lote' => true,
                'dias_alerta_vencimiento' => 365,
                'stock_minimo' => 200,
                'stock_maximo' => 3000,
                'fabricante' => 'ORICA',
                'clasificacion_onu' => '1.1B',
                'descripcion' => 'Detonador con tubo de choque',
            ],
            [
                'codigo' => 'DET-ELEC-RET',
                'nombre' => 'Detonador Eléctrico con Retardo',
                'id_categoria' => $catIniciadores,
                'unidad_medida' => 'unidades',
                'requiere_lote' => true,
                'dias_alerta_vencimiento' => 365,
                'stock_minimo' => 100,
                'stock_maximo' => 2000,
                'fabricante' => 'ENAEX',
                'clasificacion_onu' => '1.1B',
                'descripcion' => 'Detonador con retardo milisegundo/segundo',
            ],
            [
                'codigo' => 'BOOSTER-1LB',
                'nombre' => 'Booster Pentolita 1 lb',
                'id_categoria' => $catIniciadores,
                'unidad_medida' => 'unidades',
                'requiere_lote' => true,
                'dias_alerta_vencimiento' => 365,
                'stock_minimo' => 50,
                'stock_maximo' => 500,
                'fabricante' => 'ENAEX',
                'clasificacion_onu' => '1.1D',
                'descripcion' => 'Carga iniciadora de pentolita 454g',
            ],
            [
                'codigo' => 'CORD-DET',
                'nombre' => 'Cordón Detonante',
                'id_categoria' => $catIniciadores,
                'unidad_medida' => 'metros',
                'requiere_lote' => true,
                'dias_alerta_vencimiento' => 365,
                'stock_minimo' => 500,
                'stock_maximo' => 5000,
                'fabricante' => 'ORICA',
                'clasificacion_onu' => '1.1D',
                'descripcion' => 'Cordón con PETN para línea troncal',
            ],

            // EXPLOSIVOS ENCARTUCHADOS
            [
                'codigo' => 'DIN-65',
                'nombre' => 'Dinamita 65%',
                'id_categoria' => $catEncartuchados,
                'unidad_medida' => 'kg',
                'requiere_lote' => true,
                'dias_alerta_vencimiento' => 180,
                'stock_minimo' => 50,
                'stock_maximo' => 500,
                'fabricante' => 'ENAEX',
                'clasificacion_onu' => '1.1D',
                'descripcion' => 'Dinamita gelatinosa 65% NG',
            ],
            [
                'codigo' => 'EMU-CART',
                'nombre' => 'Emulsión Encartuchada',
                'id_categoria' => $catEncartuchados,
                'unidad_medida' => 'kg',
                'requiere_lote' => true,
                'dias_alerta_vencimiento' => 180,
                'stock_minimo' => 100,
                'stock_maximo' => 1000,
                'fabricante' => 'ORICA',
                'clasificacion_onu' => '1.1D',
                'descripcion' => 'Emulsión en cartuchos para carga manual',
            ],

            // ACCESORIOS
            [
                'codigo' => 'MECHA-LENTA',
                'nombre' => 'Mecha Lenta de Seguridad',
                'id_categoria' => $catAccesorios,
                'unidad_medida' => 'metros',
                'requiere_lote' => true,
                'dias_alerta_vencimiento' => 365,
                'stock_minimo' => 100,
                'stock_maximo' => 1000,
                'fabricante' => 'ENAEX',
                'clasificacion_onu' => '1.4S',
                'descripcion' => 'Mecha de seguridad velocidad 120 seg/m',
            ],
            [
                'codigo' => 'CONECTOR-MS',
                'nombre' => 'Conector Milisegundo',
                'id_categoria' => $catAccesorios,
                'unidad_medida' => 'unidades',
                'requiere_lote' => true,
                'dias_alerta_vencimiento' => 365,
                'stock_minimo' => 50,
                'stock_maximo' => 500,
                'fabricante' => 'ORICA',
                'clasificacion_onu' => '1.4B',
                'descripcion' => 'Conector de retardo para línea troncal',
            ],
        ];

        foreach ($tipos as $tipoData) {
            TipoExplosivo::updateOrCreate(
                ['codigo' => $tipoData['codigo']],
                $tipoData
            );
        }

        echo "  ✅ " . count($tipos) . " tipos de explosivos creados\n";

        echo "\n🎉 Catálogo de explosivos creado exitosamente\n";
        echo "   Puede crear polvorines y registrar lotes desde la API\n";
    }
}
