<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->timestamp('fecha_analisis_completado')->nullable()->after('estado');
        });
    }

    public function down(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->dropColumn('fecha_analisis_completado');
        });
    }
};
