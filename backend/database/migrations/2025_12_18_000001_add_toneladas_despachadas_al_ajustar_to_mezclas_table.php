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
        Schema::table('mezclas', function (Blueprint $table) {
            $table->decimal('toneladas_despachadas_al_ajustar', 10, 2)->nullable()->after('ajuste_toneladas');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('mezclas', function (Blueprint $table) {
            $table->dropColumn('toneladas_despachadas_al_ajustar');
        });
    }
};
