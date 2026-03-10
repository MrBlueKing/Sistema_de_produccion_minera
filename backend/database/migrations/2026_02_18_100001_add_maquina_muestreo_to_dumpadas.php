<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->unsignedInteger('id_maquina')->nullable()->after('zona_id');
            $table->string('nombre_maquina', 150)->nullable()->after('id_maquina');
            $table->boolean('para_muestreo')->nullable()->default(null)->after('nombre_maquina');
        });
    }

    public function down(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->dropColumn(['id_maquina', 'nombre_maquina', 'para_muestreo']);
        });
    }
};
