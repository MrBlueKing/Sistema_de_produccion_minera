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
        Schema::create('personal_autorizado_explosivos', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('id_personal_externo')->comment('ID del personal en sistema de petroleo');
            $table->string('rut', 12);
            $table->string('nombre');
            $table->string('apellido')->nullable();
            $table->string('cargo')->nullable();
            $table->unsignedBigInteger('id_faena');
            $table->boolean('activo')->default(true);
            $table->timestamps();

            // Un personal solo puede estar autorizado una vez por faena
            $table->unique(['id_personal_externo', 'id_faena'], 'personal_faena_unique');
            $table->index('id_faena');
            $table->index('activo');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('personal_autorizado_explosivos');
    }
};
