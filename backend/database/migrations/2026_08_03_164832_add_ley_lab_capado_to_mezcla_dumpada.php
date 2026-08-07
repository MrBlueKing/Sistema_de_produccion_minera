<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('mezcla_dumpada', function (Blueprint $table) {
            $table->decimal('ley_lab_capado', 8, 3)->nullable()->after('ley_dump_ajustada')
                ->comment('Ley de laboratorio ya con fracción seleccionada (cu_insoluble/soluble/total según ley_base) y capping aplicado, guardada al momento de armar la mezcla. Reemplaza la necesidad de reconstruir este valor desde ley_lote (que introducía error de redondeo). Null si la dumpada no tenía lab (solo visual).');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('mezcla_dumpada', function (Blueprint $table) {
            $table->dropColumn('ley_lab_capado');
        });
    }
};
