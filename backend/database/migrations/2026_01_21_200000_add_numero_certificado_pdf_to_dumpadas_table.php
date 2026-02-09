<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Agrega campo para rastrear el número de certificado PDF generado
     */
    public function up(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->string('numero_certificado_pdf', 20)->nullable()->after('certificado')
                ->comment('Número del certificado PDF generado (ej: CERT-2026-00001)');
            $table->timestamp('fecha_certificado_pdf')->nullable()->after('numero_certificado_pdf')
                ->comment('Fecha en que se generó el certificado PDF');

            // Índice para búsquedas rápidas por número de certificado
            $table->index('numero_certificado_pdf');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->dropIndex(['numero_certificado_pdf']);
            $table->dropColumn(['numero_certificado_pdf', 'fecha_certificado_pdf']);
        });
    }
};
