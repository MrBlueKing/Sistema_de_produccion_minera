<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Cambia todas las columnas de leyes de decimal(X, 3) a decimal(X, 2)
     * para que coincidan con los modelos y el frontend.
     */
    public function up(): void
    {
        // Tabla: mezclas
        Schema::table('mezclas', function (Blueprint $table) {
            $table->decimal('ley_prom_dump', 5, 2)->nullable()->change();
            $table->decimal('ley_prom_visual', 5, 2)->nullable()->change();
            $table->decimal('ley_prom_lote', 5, 2)->nullable()->change();
            $table->decimal('ley_lab', 5, 2)->nullable()->change();
        });

        // Tabla: mezcla_dumpada
        Schema::table('mezcla_dumpada', function (Blueprint $table) {
            $table->decimal('ley_dump_ajustada', 5, 2)->nullable()->change();
            $table->decimal('ley_visual', 5, 2)->nullable()->change();
            $table->decimal('ley_lote', 5, 2)->nullable()->change();
        });

        // Tabla: acopios
        Schema::table('acopios', function (Blueprint $table) {
            $table->decimal('ley_promedio', 5, 2)->nullable()->change();
            $table->decimal('ley_visual_promedio', 5, 2)->nullable()->change();
        });

        // Tabla: dumpadas
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->decimal('ley', 5, 2)->nullable()->change();
            $table->decimal('ley_visual', 5, 2)->nullable()->change();
        });

        // Tabla: lotes_venta (legacy)
        if (Schema::hasTable('lotes_venta')) {
            Schema::table('lotes_venta', function (Blueprint $table) {
                if (Schema::hasColumn('lotes_venta', 'ley_prom')) {
                    $table->decimal('ley_prom', 5, 2)->nullable()->change();
                }
            });
        }

        // Tabla: camionadas
        Schema::table('camionadas', function (Blueprint $table) {
            if (Schema::hasColumn('camionadas', 'ley_mezcla')) {
                $table->decimal('ley_mezcla', 5, 2)->nullable()->change();
            }
        });

        // Tabla: lote_mezcla
        if (Schema::hasTable('lote_mezcla')) {
            Schema::table('lote_mezcla', function (Blueprint $table) {
                if (Schema::hasColumn('lote_mezcla', 'ley_mezcla')) {
                    $table->decimal('ley_mezcla', 5, 2)->nullable()->change();
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Tabla: mezclas
        Schema::table('mezclas', function (Blueprint $table) {
            $table->decimal('ley_prom_dump', 5, 3)->nullable()->change();
            $table->decimal('ley_prom_visual', 5, 3)->nullable()->change();
            $table->decimal('ley_prom_lote', 5, 3)->nullable()->change();
            $table->decimal('ley_lab', 5, 3)->nullable()->change();
        });

        // Tabla: mezcla_dumpada
        Schema::table('mezcla_dumpada', function (Blueprint $table) {
            $table->decimal('ley_dump_ajustada', 5, 3)->nullable()->change();
            $table->decimal('ley_visual', 5, 3)->nullable()->change();
            $table->decimal('ley_lote', 5, 3)->nullable()->change();
        });

        // Tabla: acopios
        Schema::table('acopios', function (Blueprint $table) {
            $table->decimal('ley_promedio', 5, 3)->nullable()->change();
            $table->decimal('ley_visual_promedio', 5, 3)->nullable()->change();
        });

        // Tabla: dumpadas
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->decimal('ley', 5, 3)->nullable()->change();
            $table->decimal('ley_visual', 5, 3)->nullable()->change();
        });

        // Tabla: lotes_venta (legacy)
        if (Schema::hasTable('lotes_venta')) {
            Schema::table('lotes_venta', function (Blueprint $table) {
                if (Schema::hasColumn('lotes_venta', 'ley_prom')) {
                    $table->decimal('ley_prom', 5, 3)->nullable()->change();
                }
            });
        }

        // Tabla: camionadas
        Schema::table('camionadas', function (Blueprint $table) {
            if (Schema::hasColumn('camionadas', 'ley_mezcla')) {
                $table->decimal('ley_mezcla', 5, 3)->nullable()->change();
            }
        });

        // Tabla: lote_mezcla
        if (Schema::hasTable('lote_mezcla')) {
            Schema::table('lote_mezcla', function (Blueprint $table) {
                if (Schema::hasColumn('lote_mezcla', 'ley_mezcla')) {
                    $table->decimal('ley_mezcla', 5, 3)->nullable()->change();
                }
            });
        }
    }
};
