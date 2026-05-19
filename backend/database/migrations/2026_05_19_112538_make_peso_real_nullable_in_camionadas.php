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
        Schema::table('camionadas', function (Blueprint $table) {
            $table->decimal('peso_real', 10, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('camionadas', function (Blueprint $table) {
            $table->decimal('peso_real', 10, 2)->nullable(false)->change();
        });
    }
};
