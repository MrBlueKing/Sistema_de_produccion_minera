<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tipos_explosivos', function (Blueprint $table) {
            $table->integer('dias_cobertura_stock')->default(15)
                ->after('stock_minimo')
                ->comment('Días de anticipación (reposición) usados para sugerir el stock mínimo: promedio diario hábil de consumo x este valor');
        });
    }

    public function down(): void
    {
        Schema::table('tipos_explosivos', function (Blueprint $table) {
            $table->dropColumn('dias_cobertura_stock');
        });
    }
};
