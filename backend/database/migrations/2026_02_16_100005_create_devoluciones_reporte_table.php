<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('devoluciones_reporte', function (Blueprint $table) {
            $table->id();
            $table->foreignId('id_reporte')
                ->constrained('reportes_perforacion')
                ->cascadeOnDelete();
            $table->foreignId('id_tipo_explosivo')
                ->constrained('tipos_explosivos');
            $table->decimal('cantidad', 12, 2);
            $table->foreignId('id_personal')->nullable()
                ->constrained('personal_autorizado_explosivos');
            $table->string('motivo', 255)->nullable();
            $table->foreignId('id_movimiento')->nullable()
                ->constrained('movimientos_explosivos')
                ->comment('Movimiento de devolución generado');
            $table->timestamps();

            $table->index('id_reporte');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('devoluciones_reporte');
    }
};
