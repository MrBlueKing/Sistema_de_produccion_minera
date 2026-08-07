<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('movimientos_explosivos', function (Blueprint $table) {
            $table->string('comprobante_pago', 100)->nullable()
                ->after('guia_despacho')
                ->comment('N° de comprobante de pago de la Autorización para Comprar (DGMN), junto a la guía de despacho');
        });
    }

    public function down(): void
    {
        Schema::table('movimientos_explosivos', function (Blueprint $table) {
            $table->dropColumn('comprobante_pago');
        });
    }
};
