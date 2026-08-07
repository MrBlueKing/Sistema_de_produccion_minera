<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Models\Dispatch\Dumpada;

return new class extends Migration
{
    /**
     * Rangos anteriores (14 bandas, ancho ~0.14-0.25) — se guardan acá para poder
     * restaurarlos en down().
     */
    private array $rangosAnteriores = [
        ['nomenclatura' => 'Descarte', 'limite_inferior' => 0.00, 'limite_superior' => 0.59, 'amplitud' => 0.59, 'orden' => 1],
        ['nomenclatura' => 'A', 'limite_inferior' => 0.60, 'limite_superior' => 0.74, 'amplitud' => 0.14, 'orden' => 2],
        ['nomenclatura' => 'B', 'limite_inferior' => 0.75, 'limite_superior' => 0.89, 'amplitud' => 0.14, 'orden' => 3],
        ['nomenclatura' => 'Reserva', 'limite_inferior' => 0.90, 'limite_superior' => 1.04, 'amplitud' => 0.14, 'orden' => 4],
        ['nomenclatura' => 'C', 'limite_inferior' => 1.05, 'limite_superior' => 1.19, 'amplitud' => 0.14, 'orden' => 5],
        ['nomenclatura' => 'D', 'limite_inferior' => 1.20, 'limite_superior' => 1.34, 'amplitud' => 0.14, 'orden' => 6],
        ['nomenclatura' => 'E', 'limite_inferior' => 1.35, 'limite_superior' => 1.49, 'amplitud' => 0.14, 'orden' => 7],
        ['nomenclatura' => 'F', 'limite_inferior' => 1.50, 'limite_superior' => 1.74, 'amplitud' => 0.24, 'orden' => 8],
        ['nomenclatura' => 'G', 'limite_inferior' => 1.75, 'limite_superior' => 1.89, 'amplitud' => 0.14, 'orden' => 9],
        ['nomenclatura' => 'H', 'limite_inferior' => 1.90, 'limite_superior' => 2.09, 'amplitud' => 0.19, 'orden' => 10],
        ['nomenclatura' => 'I', 'limite_inferior' => 2.10, 'limite_superior' => 2.24, 'amplitud' => 0.14, 'orden' => 11],
        ['nomenclatura' => 'J', 'limite_inferior' => 2.25, 'limite_superior' => 2.49, 'amplitud' => 0.24, 'orden' => 12],
        ['nomenclatura' => 'K', 'limite_inferior' => 2.50, 'limite_superior' => 2.74, 'amplitud' => 0.24, 'orden' => 13],
        ['nomenclatura' => 'L', 'limite_inferior' => 2.75, 'limite_superior' => 99.99, 'amplitud' => 0.25, 'orden' => 14],
    ];

    /**
     * Rangos nuevos: mismos nombres/orden que antes (Descarte, A, B, Reserva, C...H),
     * pero cada banda mide 0.4 puntos de ley — salvo la última (H), que se corta en 3.69
     * porque el tope de ley_cup pasa a ser 3.7 (ninguna dumpada debería superarlo).
     */
    private array $rangosNuevos = [
        ['nomenclatura' => 'Descarte', 'limite_inferior' => 0.00, 'limite_superior' => 0.39, 'amplitud' => 0.40, 'orden' => 1],
        ['nomenclatura' => 'A', 'limite_inferior' => 0.40, 'limite_superior' => 0.79, 'amplitud' => 0.40, 'orden' => 2],
        ['nomenclatura' => 'B', 'limite_inferior' => 0.80, 'limite_superior' => 1.19, 'amplitud' => 0.40, 'orden' => 3],
        ['nomenclatura' => 'Reserva', 'limite_inferior' => 1.20, 'limite_superior' => 1.59, 'amplitud' => 0.40, 'orden' => 4],
        ['nomenclatura' => 'C', 'limite_inferior' => 1.60, 'limite_superior' => 1.99, 'amplitud' => 0.40, 'orden' => 5],
        ['nomenclatura' => 'D', 'limite_inferior' => 2.00, 'limite_superior' => 2.39, 'amplitud' => 0.40, 'orden' => 6],
        ['nomenclatura' => 'E', 'limite_inferior' => 2.40, 'limite_superior' => 2.79, 'amplitud' => 0.40, 'orden' => 7],
        ['nomenclatura' => 'F', 'limite_inferior' => 2.80, 'limite_superior' => 3.19, 'amplitud' => 0.40, 'orden' => 8],
        ['nomenclatura' => 'G', 'limite_inferior' => 3.20, 'limite_superior' => 3.59, 'amplitud' => 0.40, 'orden' => 9],
        ['nomenclatura' => 'H', 'limite_inferior' => 3.60, 'limite_superior' => 3.69, 'amplitud' => 0.10, 'orden' => 10],
    ];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('rangos')->delete();

        $ahora = now();
        DB::table('rangos')->insert(array_map(function ($r) use ($ahora) {
            $r['descripcion'] = null;
            $r['created_at'] = $ahora;
            $r['updated_at'] = $ahora;
            return $r;
        }, $this->rangosNuevos));

        // Tope de ley_cup: 3 -> 3.7
        DB::table('configuraciones_sistema')
            ->where('clave', 'ley_capping_maximo')
            ->whereNull('id_faena')
            ->update(['valor' => '3.7', 'updated_at' => $ahora]);

        $this->recalcularRangos();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('rangos')->delete();

        $ahora = now();
        DB::table('rangos')->insert(array_map(function ($r) use ($ahora) {
            $r['descripcion'] = null;
            $r['created_at'] = $ahora;
            $r['updated_at'] = $ahora;
            return $r;
        }, $this->rangosAnteriores));

        DB::table('configuraciones_sistema')
            ->where('clave', 'ley_capping_maximo')
            ->whereNull('id_faena')
            ->update(['valor' => '3', 'updated_at' => $ahora]);

        $this->recalcularRangos();
    }

    /**
     * Recorre dumpadas y muestras_libres con ley registrada y recalcula su campo `rango`
     * con la tabla de rangos vigente (según Dumpada::determinarRango, misma lógica que
     * usa el sistema en vivo al registrar una ley).
     */
    private function recalcularRangos(): void
    {
        DB::table('dumpadas')->whereNotNull('ley')->orderBy('id')->chunkById(500, function ($registros) {
            foreach ($registros as $registro) {
                $nuevoRango = Dumpada::determinarRango($registro->ley);
                DB::table('dumpadas')->where('id', $registro->id)->update(['rango' => $nuevoRango]);
            }
        });

        DB::table('muestras_libres')->whereNotNull('ley')->orderBy('id')->chunkById(500, function ($registros) {
            foreach ($registros as $registro) {
                $nuevoRango = Dumpada::determinarRango($registro->ley);
                DB::table('muestras_libres')->where('id', $registro->id)->update(['rango' => $nuevoRango]);
            }
        });
    }
};
