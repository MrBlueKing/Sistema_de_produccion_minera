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
        Schema::table('frentes_trabajo', function (Blueprint $table) {
            $table->string('manto', 20)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('frentes_trabajo', function (Blueprint $table) {
            $table->string('manto', 10)->change();
        });
    }
};
