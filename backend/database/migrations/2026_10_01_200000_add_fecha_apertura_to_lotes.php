<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Apertura del lote = momento en que recibe su número de lote (no cuando se
 * crea en el sistema, que es `fecha_creacion`). Desde ahora la llena el modelo
 * Lote al asignar el número.
 *
 * Lotes que ya tienen número: no hay registro de cuándo se les asignó, así que
 * se usa como aproximación cuándo se crearon en el sistema (`created_at`, con
 * hora). Si `created_at` no cae el mismo día que `fecha_creacion` (lotes
 * importados con fecha anterior) se usa `fecha_creacion`, sin hora.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lotes', function (Blueprint $table) {
            $table->dateTime('fecha_apertura')->nullable()->after('fecha_creacion');
        });

        DB::statement("
            UPDATE lotes
            SET fecha_apertura = CASE
                WHEN created_at IS NOT NULL AND DATE(created_at) = fecha_creacion THEN created_at
                ELSE fecha_creacion
            END
            WHERE numero_lote IS NOT NULL AND numero_lote <> ''
        ");
    }

    public function down(): void
    {
        Schema::table('lotes', function (Blueprint $table) {
            $table->dropColumn('fecha_apertura');
        });
    }
};
