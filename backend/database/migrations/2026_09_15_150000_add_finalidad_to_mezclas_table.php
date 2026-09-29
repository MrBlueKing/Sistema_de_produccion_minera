<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Reemplaza 'es_descarte' (boolean, sin usar en ningún frontend, único
     * efecto real: filtro en remanentesDisponibles()) por 'finalidad' (string),
     * que sí soporta más de dos valores a futuro sin otro cambio de esquema.
     *
     * Migra las mezclas que hoy usan la planta ficticia "DESCARTE" (buscada
     * por nombre, no por id — el id puede diferir entre entornos) a
     * finalidad='Descarte' + planta_id=null, y desactiva esa planta.
     */
    public function up(): void
    {
        Schema::table('mezclas', function (Blueprint $table) {
            $table->string('finalidad', 30)->default('Venta')->after('es_descarte');
        });

        $plantaDescarteId = DB::table('plantas')->where('nombre', 'DESCARTE')->value('id');

        if ($plantaDescarteId) {
            DB::table('mezclas')
                ->where('planta_id', $plantaDescarteId)
                ->update(['finalidad' => 'Descarte', 'planta_id' => null]);

            DB::table('plantas')->where('id', $plantaDescarteId)->update(['activo' => false]);
        }

        Schema::table('mezclas', function (Blueprint $table) {
            $table->dropColumn('es_descarte');
        });
    }

    public function down(): void
    {
        Schema::table('mezclas', function (Blueprint $table) {
            $table->boolean('es_descarte')->default(false)->after('es_remanente');
        });

        $plantaDescarteId = DB::table('plantas')->where('nombre', 'DESCARTE')->value('id');

        if ($plantaDescarteId) {
            DB::table('mezclas')
                ->where('finalidad', 'Descarte')
                ->update(['es_descarte' => true, 'planta_id' => $plantaDescarteId]);

            DB::table('plantas')->where('id', $plantaDescarteId)->update(['activo' => true]);
        }

        Schema::table('mezclas', function (Blueprint $table) {
            $table->dropColumn('finalidad');
        });
    }
};
