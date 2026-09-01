<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * El estado de laboratorio solo cambia en 2 hitos (Segunda y Canje), no en
     * cada ley cargada — se quita "Listo para Canje" (nunca llegó a producción).
     * Además se agrega la fecha de carga de cada ley, para reflejar el
     * cuaderno real de don Carlos (ver session_produccion_2026_08_25).
     */
    public function up(): void
    {
        Schema::table('lotes', function (Blueprint $table) {
            $table->timestamp('fecha_ley_paquete_segunda')->nullable()->after('ley_paquete_segunda');
            $table->timestamp('fecha_ley_paquete_segunda_prima')->nullable()->after('ley_paquete_segunda_prima');
            $table->timestamp('fecha_ley_paquete_primera')->nullable()->after('ley_paquete_primera');
            $table->timestamp('fecha_ley_canje')->nullable()->after('ley_canje');
            $table->timestamp('fecha_ley_paquete_tercera')->nullable()->after('ley_paquete_tercera');
        });

        DB::statement("UPDATE lotes SET estado_laboratorio = 'Con Paquete Segunda' WHERE estado_laboratorio = 'Listo para Canje'");

        Schema::table('lotes', function (Blueprint $table) {
            $table->enum('estado_laboratorio', [
                'Cerrado',
                'Con Paquete Segunda',
                'Canjeado',
                'En Tercero',
                'Resuelto por Tercero',
            ])->default('Cerrado')->change();
        });
    }

    public function down(): void
    {
        Schema::table('lotes', function (Blueprint $table) {
            $table->enum('estado_laboratorio', [
                'Cerrado',
                'Con Paquete Segunda',
                'Listo para Canje',
                'Canjeado',
                'En Tercero',
                'Resuelto por Tercero',
            ])->default('Cerrado')->change();
        });

        Schema::table('lotes', function (Blueprint $table) {
            $table->dropColumn([
                'fecha_ley_paquete_segunda',
                'fecha_ley_paquete_segunda_prima',
                'fecha_ley_paquete_primera',
                'fecha_ley_canje',
                'fecha_ley_paquete_tercera',
            ]);
        });
    }
};
