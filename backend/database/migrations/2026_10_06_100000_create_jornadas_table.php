<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Jornadas/turnos configurables (módulo Configuración General). Antes la lista
 * AM/PM/Noche/Madrugada estaba escrita a mano en ~20 lugares; ahora cada jornada
 * dice en qué formularios se ofrece ('dumpadas', 'perforacion').
 *
 * Turno corto / Turno largo: pedido de Perforación y Tronadura (06-10-2026),
 * solo etiquetas, sin horario.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jornadas', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 50)->unique();
            // Va en los códigos (ej. reporte de P&T "2026-10-06-TC-Polvorín-0001"),
            // por eso sin espacios.
            $table->string('abreviatura', 20)->unique();
            $table->string('color', 20)->nullable();
            $table->unsignedSmallInteger('orden')->default(0);
            $table->boolean('activa')->default(true);
            $table->json('formularios');
            $table->timestamps();
        });

        $ahora = now();
        $todas = json_encode(['dumpadas', 'perforacion']);
        DB::table('jornadas')->insert([
            ['nombre' => 'AM',          'abreviatura' => 'AM',        'color' => '#2a78d6', 'orden' => 1, 'activa' => true, 'formularios' => $todas, 'created_at' => $ahora, 'updated_at' => $ahora],
            ['nombre' => 'PM',          'abreviatura' => 'PM',        'color' => '#eb6834', 'orden' => 2, 'activa' => true, 'formularios' => $todas, 'created_at' => $ahora, 'updated_at' => $ahora],
            ['nombre' => 'Noche',       'abreviatura' => 'Noche',     'color' => '#1baf7a', 'orden' => 3, 'activa' => true, 'formularios' => $todas, 'created_at' => $ahora, 'updated_at' => $ahora],
            ['nombre' => 'Madrugada',   'abreviatura' => 'Madrugada', 'color' => '#eda100', 'orden' => 4, 'activa' => true, 'formularios' => $todas, 'created_at' => $ahora, 'updated_at' => $ahora],
            ['nombre' => 'Turno corto', 'abreviatura' => 'TC',        'color' => '#0e9f8e', 'orden' => 5, 'activa' => true, 'formularios' => json_encode(['perforacion']), 'created_at' => $ahora, 'updated_at' => $ahora],
            ['nombre' => 'Turno largo', 'abreviatura' => 'TL',        'color' => '#8b5cf6', 'orden' => 6, 'activa' => true, 'formularios' => json_encode(['perforacion']), 'created_at' => $ahora, 'updated_at' => $ahora],
        ]);

        // dumpadas.jornada era ENUM con las 4 jornadas fijas: una jornada nueva
        // activada para Dumpadas no se podría guardar. Mismo largo que la columna
        // original (string 50) antes de que la pasaran a ENUM.
        DB::statement("ALTER TABLE dumpadas MODIFY jornada VARCHAR(50) NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE dumpadas MODIFY jornada ENUM('AM','PM','Madrugada','Noche') NULL");
        Schema::dropIfExists('jornadas');
    }
};
