<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Guarda el destinatario ("Para") elegido al generar el certificado, para que
     * la descarga, la vista previa y el envío por correo lo respeten. Antes solo
     * se usaba en el PDF inicial y las regeneraciones volvían al valor por defecto.
     */
    public function up(): void
    {
        Schema::table('certificados', function (Blueprint $table) {
            $table->string('destino', 200)->nullable()->after('generado_por')
                ->comment('Destinatario "Para" del certificado');
        });
    }

    public function down(): void
    {
        Schema::table('certificados', function (Blueprint $table) {
            $table->dropColumn('destino');
        });
    }
};
