<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('auditoria_reportes_perforacion', function (Blueprint $table) {
            $table->id();
            $table->foreignId('id_reporte')
                ->constrained('reportes_perforacion')
                ->cascadeOnDelete();
            $table->string('accion', 30);
            $table->string('usuario', 150);
            $table->foreignId('user_id')->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->json('cambios')->nullable();
            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->index('id_reporte');
            $table->index('accion');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('auditoria_reportes_perforacion');
    }
};
