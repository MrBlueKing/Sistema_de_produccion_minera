<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Programa de producción mensual por faena (tile "Planificación" del Dashboard
 * Gerencial) — reemplaza el Excel "octubre_plan_vf.xlsx" de P&T / jefatura mina.
 *
 * Un plan por faena y mes. Se arma en borrador y al publicarlo queda bloqueado:
 * contra eso se mide Plan vs Real todo el mes. Si hay que corregirlo, quien tenga
 * el rol de planificación lo reabre con un motivo y queda en la auditoría junto
 * con una foto del plan como estaba publicado.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('planes_produccion', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('id_faena');
            $table->unsignedSmallInteger('anio');
            $table->unsignedTinyInteger('mes');
            $table->enum('estado', ['borrador', 'publicado'])->default('borrador');
            // Supuestos de perforación: meta = Σ días trabajados × perforistas del día
            // × tronaduras por perforista × ton por disparo (el "× 2" del Excel).
            $table->decimal('ton_por_disparo', 8, 2)->nullable();
            $table->decimal('tronaduras_por_perforista', 5, 2)->nullable();
            $table->text('observaciones')->nullable();
            $table->unsignedBigInteger('creado_por_id')->nullable();
            $table->string('creado_por', 150)->nullable();
            $table->timestamp('publicado_en')->nullable();
            $table->string('publicado_por', 150)->nullable();
            $table->timestamps();

            $table->unique(['id_faena', 'anio', 'mes']);
        });

        // Un registro por día del mes: qué tipo de día es y cuántos perforistas hay.
        // Reemplaza los tramos "7 hábiles con 5 perforistas / 14 con 6 / 4 TC".
        Schema::create('plan_produccion_dias', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plan_id')->constrained('planes_produccion')->cascadeOnDelete();
            $table->unsignedTinyInteger('dia');
            // habil (se trabaja, con sus turnos) / libre (no se trabaja)
            $table->string('tipo', 10)->default('habil');
            $table->decimal('perforistas', 4, 1)->default(0);
            // Turnos que se trabajan ese día (ej. ["AM","PM"] o ["AM","PM","Noche","Turno corto"]):
            // cada día puede tener los suyos, como el Excel original (TN solo algunos días).
            // Nombres = jornadas de Configuración General.
            $table->json('turnos')->nullable();
            $table->unique(['plan_id', 'dia']);
        });

        Schema::create('plan_produccion_frentes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plan_id')->constrained('planes_produccion')->cascadeOnDelete();
            $table->unsignedBigInteger('id_frente_trabajo');
            // desarrollo = estéril; preparacion / camara = mineral; fortificacion = sin toneladas
            $table->string('actividad', 20);
            $table->decimal('ley_esperada', 6, 3)->nullable();
            $table->unsignedSmallInteger('orden')->default(0);
            $table->foreign('id_frente_trabajo')->references('id')->on('frentes_trabajo');
            $table->unique(['plan_id', 'id_frente_trabajo', 'actividad'], 'plan_frente_actividad_unique');
        });

        // Toneladas planificadas de un frente en un día y turno. Fortificación no lleva
        // toneladas: la celda solo marca que ese turno se fortifica.
        Schema::create('plan_produccion_celdas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plan_frente_id')->constrained('plan_produccion_frentes')->cascadeOnDelete();
            $table->unsignedTinyInteger('dia');
            $table->string('turno', 50);
            $table->decimal('toneladas', 8, 2)->nullable();
            $table->unique(['plan_frente_id', 'dia', 'turno']);
        });

        // Rutas de transporte para la capacidad: (60 / ciclo) × dumpers × peso × horas.
        // cuenta_capacidad = false para rutas de re-manejo (ej. Cancha A → Cancha B),
        // que no limitan lo que sale de la mina.
        Schema::create('plan_produccion_rutas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plan_id')->constrained('planes_produccion')->cascadeOnDelete();
            $table->string('nombre', 100);
            $table->decimal('ciclo_min', 6, 2);
            $table->decimal('dumpers', 4, 1);
            $table->decimal('peso_ton', 5, 2);
            $table->decimal('horas', 4, 1);
            $table->boolean('cuenta_capacidad')->default(true);
            $table->unsignedSmallInteger('orden')->default(0);
        });

        Schema::create('plan_produccion_auditoria', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plan_id')->constrained('planes_produccion')->cascadeOnDelete();
            $table->string('accion', 20); // creado / publicado / reabierto
            $table->text('motivo')->nullable();
            // Al reabrir: el plan como estaba publicado, para no perder contra qué se midió.
            $table->json('snapshot')->nullable();
            // Al volver a publicar tras reabrir: qué cambió respecto de lo publicado antes.
            $table->json('cambios')->nullable();
            $table->unsignedBigInteger('usuario_id')->nullable();
            $table->string('usuario', 150)->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plan_produccion_auditoria');
        Schema::dropIfExists('plan_produccion_rutas');
        Schema::dropIfExists('plan_produccion_celdas');
        Schema::dropIfExists('plan_produccion_frentes');
        Schema::dropIfExists('plan_produccion_dias');
        Schema::dropIfExists('planes_produccion');
    }
};
