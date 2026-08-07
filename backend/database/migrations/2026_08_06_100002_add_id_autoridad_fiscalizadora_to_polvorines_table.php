<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('polvorines', function (Blueprint $table) {
            $table->foreignId('id_autoridad_fiscalizadora')->nullable()
                ->after('id_faena')
                ->constrained('autoridades_fiscalizadoras')
                ->comment('Autoridad Fiscalizadora (DGMN) que rige este polvorín, para el código F/A del libro de control');
        });
    }

    public function down(): void
    {
        Schema::table('polvorines', function (Blueprint $table) {
            $table->dropConstrainedForeignId('id_autoridad_fiscalizadora');
        });
    }
};
