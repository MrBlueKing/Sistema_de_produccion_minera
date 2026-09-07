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
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->time('hora')->nullable()->after('fecha');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->dropColumn('hora');
        });
    }
};
