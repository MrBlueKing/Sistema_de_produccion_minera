<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE lotes MODIFY numero_lote VARCHAR(50) NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE lotes MODIFY numero_lote VARCHAR(50) NOT NULL');
    }
};
