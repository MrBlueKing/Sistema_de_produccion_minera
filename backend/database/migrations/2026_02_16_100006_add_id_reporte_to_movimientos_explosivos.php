<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('movimientos_explosivos', function (Blueprint $table) {
            $table->foreignId('id_reporte_perforacion')->nullable()->after('id_tronadura')
                ->constrained('reportes_perforacion')
                ->comment('Reporte de perforación asociado');
        });
    }

    public function down(): void
    {
        Schema::table('movimientos_explosivos', function (Blueprint $table) {
            $table->dropForeign(['id_reporte_perforacion']);
            $table->dropColumn('id_reporte_perforacion');
        });
    }
};
