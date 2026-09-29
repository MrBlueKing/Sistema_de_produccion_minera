<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Catálogo de puntos de transbordo (ej. Santa Ana): lugares donde un
     * camión descarga y otro distinto recoge el mismo material para llevarlo
     * a la planta final. Tabla propia y ampliable -- agregar un punto nuevo
     * es insertar una fila, no tocar código (ver [[feedback_no_hardcodear_ids_migraciones]]).
     */
    public function up(): void
    {
        Schema::create('puntos_transbordo', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 150)->unique();
            // Faena donde está físicamente el punto (informativo -- la faena
            // que liquida el material siempre es la de ORIGEN de la camionada,
            // no esta).
            $table->unsignedBigInteger('id_faena')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();
        });

        DB::table('puntos_transbordo')->insert([
            'nombre' => 'Santa Ana',
            'id_faena' => 1, // Cabildo
            'activo' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('puntos_transbordo');
    }
};
