<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tabla CERTIFICADOS: control de aprobación (visto bueno) de certificados de Laboratorio.
     *
     * Un "certificado" hoy es solo un número compartido en dumpadas.certificado y
     * muestras_libres.certificado (no una entidad). Esta tabla agrega el estado de
     * aprobación por número de certificado. Si un número no tiene fila aquí, se
     * considera Aprobado (certificados históricos, generados antes de este control).
     */
    public function up(): void
    {
        Schema::create('certificados', function (Blueprint $table) {
            $table->id();

            $table->string('numero_certificado', 100)->unique();

            $table->string('estado', 20)->default('Pendiente'); // Pendiente | Aprobado | Rechazado

            $table->string('generado_por', 150)->nullable();

            // Quien tomó la última decisión (aprobar o rechazar). Sin FK: los usuarios
            // viven en el SAC externo, no hay tabla users local (mismo patrón que
            // muestras_libres.user_id).
            $table->string('aprobado_por', 150)->nullable();
            $table->timestamp('fecha_aprobacion')->nullable();
            $table->string('motivo_rechazo', 500)->nullable();

            $table->string('enviado_a', 150)->nullable();
            $table->timestamp('fecha_envio_correo')->nullable();

            $table->timestamps();

            $table->index('estado');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('certificados');
    }
};
