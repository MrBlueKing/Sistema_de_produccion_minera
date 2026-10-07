<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Report de Ciclo Carguío y Transporte (Report CyT): la hoja que el Supervisor CyT
 * llena en la pala, dentro de la mina (mina → Parrilla A). Hasta ahora en papel.
 *
 * - reportes_cyt: una hoja por faena + fecha + jornada.
 * - reporte_cyt_cargas: cada carga en la pala (llegada del dumper, carguío, paladas).
 * - reporte_cyt_dumpers: estado de cada dumper en la jornada (horas fuera de servicio).
 *
 * Máquinas y personas se guardan con id + nombre: los id vienen de Petróleo y el
 * nombre deja el registro legible aunque allá cambien o se borren.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reportes_cyt', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('id_faena');
            $table->date('fecha');
            $table->string('jornada', 50);
            $table->unsignedBigInteger('supervisor_id')->nullable(); // usuario SAC
            $table->string('supervisor_nombre', 150)->nullable();
            $table->string('estado', 20)->default('borrador'); // borrador | guardado
            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->unique(['id_faena', 'fecha', 'jornada'], 'reportes_cyt_faena_fecha_jornada_unique');
        });

        Schema::create('reporte_cyt_cargas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('id_reporte')->constrained('reportes_cyt')->cascadeOnDelete();
            $table->unsignedSmallInteger('orden')->default(0);
            $table->foreignId('id_frente_trabajo')->nullable()->constrained('frentes_trabajo')->nullOnDelete();
            $table->unsignedBigInteger('id_pala')->nullable();
            $table->string('nombre_pala', 100)->nullable();
            $table->unsignedBigInteger('id_operador_pala')->nullable();
            $table->string('nombre_operador_pala', 150)->nullable();
            $table->time('hora_llegada')->nullable();       // llegada del dumper a la pala
            $table->decimal('tiempo_carguio', 5, 1)->nullable(); // minutos
            $table->unsignedSmallInteger('paladas')->nullable();
            $table->unsignedBigInteger('id_dumper')->nullable();
            $table->string('nombre_dumper', 100)->nullable();
            $table->unsignedBigInteger('id_operador_dumper')->nullable();
            $table->string('nombre_operador_dumper', 150)->nullable();
            $table->timestamps();

            $table->index(['id_reporte', 'orden']);
        });

        Schema::create('reporte_cyt_dumpers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('id_reporte')->constrained('reportes_cyt')->cascadeOnDelete();
            $table->unsignedBigInteger('id_dumper')->nullable();
            $table->string('nombre_dumper', 100);
            $table->string('estado', 30)->default('Operativo'); // Operativo | Mantención | Falla | Sin operador | Otro
            $table->decimal('horas_fuera', 4, 1)->nullable();
            $table->string('motivo', 255)->nullable();
            $table->timestamps();
        });

        // Operadores de pala: misma lista que los operadores de dumper de Dispatch,
        // separada por tipo. Una persona puede estar en las dos.
        Schema::table('operadores_autorizados_dispatch', function (Blueprint $table) {
            $table->string('tipo', 10)->default('dumper')->after('id_faena');
        });
        Schema::table('operadores_autorizados_dispatch', function (Blueprint $table) {
            $table->dropUnique('op_aut_dispatch_persona_faena_unique');
            $table->unique(['id_personal_externo', 'id_faena', 'tipo'], 'op_aut_dispatch_persona_faena_tipo_unique');
        });

        // Las 4 jornadas de siempre también se ofrecen en el Report CyT.
        DB::table('jornadas')->whereIn('nombre', ['AM', 'PM', 'Noche', 'Madrugada'])->get()->each(function ($j) {
            $formularios = json_decode($j->formularios, true) ?: [];
            if (!in_array('cyt', $formularios)) {
                $formularios[] = 'cyt';
                DB::table('jornadas')->where('id', $j->id)->update(['formularios' => json_encode($formularios)]);
            }
        });
    }

    public function down(): void
    {
        DB::table('jornadas')->get()->each(function ($j) {
            $formularios = array_values(array_diff(json_decode($j->formularios, true) ?: [], ['cyt']));
            DB::table('jornadas')->where('id', $j->id)->update(['formularios' => json_encode($formularios)]);
        });

        Schema::table('operadores_autorizados_dispatch', function (Blueprint $table) {
            $table->dropUnique('op_aut_dispatch_persona_faena_tipo_unique');
        });
        DB::table('operadores_autorizados_dispatch')->where('tipo', 'pala')->delete();
        Schema::table('operadores_autorizados_dispatch', function (Blueprint $table) {
            $table->unique(['id_personal_externo', 'id_faena'], 'op_aut_dispatch_persona_faena_unique');
            $table->dropColumn('tipo');
        });

        Schema::dropIfExists('reporte_cyt_dumpers');
        Schema::dropIfExists('reporte_cyt_cargas');
        Schema::dropIfExists('reportes_cyt');
    }
};
