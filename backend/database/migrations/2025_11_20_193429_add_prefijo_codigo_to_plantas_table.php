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
        Schema::table('plantas', function (Blueprint $table) {
            $table->string('prefijo_codigo', 10)->nullable()->after('codigo')->comment('Prefijo para códigos de mezclas (ej: CZ, EN)');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('plantas', function (Blueprint $table) {
            $table->dropColumn('prefijo_codigo');
        });
    }
};
