<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE seguimiento_estado_frentes MODIFY estabilidad ENUM('FC', 'AC', 'MP', 'PC', 'P', 'FO')");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE seguimiento_estado_frentes MODIFY estabilidad ENUM('FC', 'PM', 'AC', 'CH', 'FO')");
    }
};
