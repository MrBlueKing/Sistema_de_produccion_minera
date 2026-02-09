<?php

namespace App\Console\Commands;

use App\Models\Dispatch\Acopio;
use Illuminate\Console\Command;

class RecalcularAcopios extends Command
{
    protected $signature = 'acopios:recalcular';
    protected $description = 'Recalcular totales de todos los acopios (toneladas, ley promedio, ley visual promedio)';

    public function handle()
    {
        $this->info('Recalculando totales de acopios...');

        $acopios = Acopio::all();
        $total = $acopios->count();
        $this->info("Total de acopios a procesar: {$total}");

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        foreach ($acopios as $acopio) {
            $acopio->recalcularTotales();
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("✅ Todos los acopios han sido recalculados exitosamente");

        return 0;
    }
}
