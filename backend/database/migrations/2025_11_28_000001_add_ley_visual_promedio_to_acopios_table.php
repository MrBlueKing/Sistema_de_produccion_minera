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
            $table->decimal('ley_visual_promedio', 8, 3)
                ->nullable()
                ->after('ley_promedio')
                ->comment('Promedio ponderado de las leyes visuales de las dumpadas');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('acopios', function (Blueprint $table) {
            $table->dropColumn('ley_visual_promedio');
        });
    }
};
