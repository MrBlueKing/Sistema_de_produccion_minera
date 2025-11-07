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
            $table->softDeletes(); // Agrega columna deleted_at
            $table->string('deleted_by')->nullable(); // Usuario que eliminó
            $table->text('deletion_reason')->nullable(); // Razón de eliminación (opcional)
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('frentes_trabajo', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->dropColumn(['deleted_by', 'deletion_reason']);
        });
    }
};
