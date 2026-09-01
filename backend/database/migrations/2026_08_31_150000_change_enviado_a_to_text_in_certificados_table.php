<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Amplía enviado_a para poder guardar varios correos separados por coma
     * (envío de certificados a múltiples destinatarios a la vez).
     */
    public function up(): void
    {
        Schema::table('certificados', function (Blueprint $table) {
            $table->text('enviado_a')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('certificados', function (Blueprint $table) {
            $table->string('enviado_a', 150)->nullable()->change();
        });
    }
};
