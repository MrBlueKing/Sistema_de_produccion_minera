<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Crear tabla pivot
        Schema::create('camionada_mezcla', function (Blueprint $table) {
            $table->id();
            $table->foreignId('camionada_id')->constrained('camionadas')->onDelete('cascade');
            $table->foreignId('mezcla_id')->constrained('mezclas')->onDelete('cascade');
            $table->decimal('toneladas', 10, 2);
            $table->decimal('ley_mezcla', 8, 4)->nullable();
            $table->timestamps();
        });

        // 2. Migrar datos existentes: camionadas.mezcla_id → pivot
        DB::table('camionadas')
            ->whereNotNull('mezcla_id')
            ->orderBy('id')
            ->each(function ($camionada) {
                DB::table('camionada_mezcla')->insert([
                    'camionada_id' => $camionada->id,
                    'mezcla_id'    => $camionada->mezcla_id,
                    'toneladas'    => $camionada->peso ?? 0,
                    'ley_mezcla'   => $camionada->ley_mezcla,
                    'created_at'   => now(),
                    'updated_at'   => now(),
                ]);
            });

        // 3. Hacer nullable mezcla_id (columna legacy, ya no se usa)
        Schema::table('camionadas', function (Blueprint $table) {
            $table->unsignedBigInteger('mezcla_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Restaurar mezcla_id desde pivot (primera mezcla por camionada)
        DB::table('camionada_mezcla')
            ->select('camionada_id', DB::raw('MIN(mezcla_id) as mezcla_id'))
            ->groupBy('camionada_id')
            ->get()
            ->each(function ($row) {
                DB::table('camionadas')
                    ->where('id', $row->camionada_id)
                    ->update(['mezcla_id' => $row->mezcla_id]);
            });

        Schema::dropIfExists('camionada_mezcla');
    }
};
