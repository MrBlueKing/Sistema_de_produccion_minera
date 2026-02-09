<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Agrega relación entre dumpadas y tronaduras
     */
    public function up(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->foreignId('tronadura_id')
                ->nullable()
                ->after('id_frente_trabajo')
                ->constrained('tronaduras')
                ->nullOnDelete()
                ->comment('Tronadura de origen de esta dumpada');

            $table->index('tronadura_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->dropForeign(['tronadura_id']);
            $table->dropColumn('tronadura_id');
        });
    }
};
