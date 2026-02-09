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
            $table->decimal('cu_soluble', 12, 6)->nullable()->after('ley_cup');
            $table->decimal('cu_insoluble', 12, 6)->nullable()->after('cu_soluble');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->dropColumn(['cu_soluble', 'cu_insoluble']);
        });
    }
};
