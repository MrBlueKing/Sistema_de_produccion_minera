<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Agrega campo es_descarte para marcar remanentes que no se van a utilizar
     */
    public function up(): void
    {
        Schema::table('mezclas', function (Blueprint $table) {
            $table->boolean('es_descarte')->default(false)->after('es_remanente');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('mezclas', function (Blueprint $table) {
            $table->dropColumn('es_descarte');
        });
    }
};
