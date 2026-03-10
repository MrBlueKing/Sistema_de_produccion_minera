<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reportes_perforacion', function (Blueprint $table) {
            $table->unique(['fecha', 'turno', 'id_polvorin', 'id_faena'], 'uq_reporte_fecha_turno_polvorin_faena');
        });
    }

    public function down(): void
    {
        Schema::table('reportes_perforacion', function (Blueprint $table) {
            $table->dropUnique('uq_reporte_fecha_turno_polvorin_faena');
        });
    }
};
