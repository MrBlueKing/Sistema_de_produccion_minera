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
        Schema::table('acopios', function (Blueprint $table) {
            $table->decimal('ley_lote_promedio', 5, 2)->nullable()->after('ley_visual_promedio')
                  ->comment('Promedio ponderado de ley_lote de cada dumpada (ley_dump × 0.9 si tiene ley, sino ley_visual × 0.9)');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('acopios', function (Blueprint $table) {
            $table->dropColumn('ley_lote_promedio');
        });
    }
};
