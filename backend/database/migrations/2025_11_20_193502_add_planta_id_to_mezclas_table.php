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
            $table->unsignedBigInteger('planta_id')->nullable()->after('id_faena')->comment('Planta destino de la mezcla');
            $table->foreign('planta_id')->references('id')->on('plantas')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('mezclas', function (Blueprint $table) {
            $table->dropForeign(['planta_id']);
            $table->dropColumn('planta_id');
        });
    }
};
