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
        Schema::table('dumpadas', function (Blueprint $table) {
            // Agregar campo id_faena después de user_id
            $table->unsignedBigInteger('id_faena')->nullable()->after('user_id');

            // Nota: Mantenemos el campo 'faena' (string) por compatibilidad
            // Se puede eliminar en una migración futura después de migrar los datos
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->dropColumn('id_faena');
        });
    }
};
