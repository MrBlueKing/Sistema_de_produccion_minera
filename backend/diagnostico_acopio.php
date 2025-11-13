<?php
/**
 * Script de diagnóstico para revisar el problema del número de acopio
 * Ejecutar desde la terminal: php diagnostico_acopio.php
 */

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Dispatch\Dumpada;

echo "\n=== DIAGNÓSTICO DE NÚMEROS DE ACOPIO ===\n\n";

// 1. Contar total de registros
$total = Dumpada::count();
echo "✓ Total de dumpadas en la BD: {$total}\n\n";

// 2. Obtener el valor máximo de n_acop
$maxAcopio = Dumpada::max('n_acop');
echo "✓ Valor MAX de n_acop: {$maxAcopio}\n";
echo "  Tipo de dato: " . gettype($maxAcopio) . "\n\n";

// 3. Obtener últimos 10 registros por ID
echo "=== ÚLTIMOS 10 REGISTROS (por ID descendente) ===\n";
$ultimos = Dumpada::orderBy('id', 'desc')->take(10)->get(['id', 'n_acop', 'acopios', 'created_at']);
foreach ($ultimos as $d) {
    echo sprintf("ID: %5d | n_acop: %-10s (tipo: %s) | Creado: %s\n",
        $d->id,
        $d->n_acop ?? 'NULL',
        gettype($d->n_acop),
        $d->created_at->format('Y-m-d H:i:s')
    );
}

// 4. Buscar registros con n_acop NULL o vacío
echo "\n=== REGISTROS CON n_acop NULL O VACÍO ===\n";
$nulos = Dumpada::whereNull('n_acop')->orWhere('n_acop', '')->count();
echo "✓ Cantidad: {$nulos}\n";

// 5. Buscar registros con n_acop no numérico
echo "\n=== REGISTROS CON n_acop NO NUMÉRICO ===\n";
$todos = Dumpada::all(['id', 'n_acop']);
$noNumericos = [];
foreach ($todos as $d) {
    if ($d->n_acop && !is_numeric($d->n_acop)) {
        $noNumericos[] = $d;
    }
}
echo "✓ Cantidad: " . count($noNumericos) . "\n";
if (count($noNumericos) > 0) {
    echo "Primeros 5 ejemplos:\n";
    foreach (array_slice($noNumericos, 0, 5) as $d) {
        echo "  ID: {$d->id} | n_acop: '{$d->n_acop}'\n";
    }
}

// 6. Ordenar por n_acop y mostrar los 5 más altos
echo "\n=== TOP 5 n_acop MÁS ALTOS (ordenados numéricamente) ===\n";
$topAcopios = Dumpada::all(['id', 'n_acop'])
    ->filter(fn($d) => is_numeric($d->n_acop))
    ->sortByDesc(fn($d) => (int)$d->n_acop)
    ->take(5);

foreach ($topAcopios as $d) {
    echo sprintf("ID: %5d | n_acop: %d\n", $d->id, (int)$d->n_acop);
}

// 7. Probar la función generarNumeroAcopio()
echo "\n=== PRUEBA DE generarNumeroAcopio() ===\n";
$siguienteAcopio = Dumpada::generarNumeroAcopio();
echo "✓ Siguiente número de acopio que se asignaría: {$siguienteAcopio}\n";

// 8. Verificar si hay duplicados
echo "\n=== VERIFICAR DUPLICADOS ===\n";
$duplicados = Dumpada::select('n_acop')
    ->whereNotNull('n_acop')
    ->where('n_acop', '!=', '')
    ->groupBy('n_acop')
    ->havingRaw('COUNT(*) > 1')
    ->get();

if ($duplicados->count() > 0) {
    echo "⚠ Se encontraron {$duplicados->count()} valores duplicados:\n";
    foreach ($duplicados->take(5) as $dup) {
        $cant = Dumpada::where('n_acop', $dup->n_acop)->count();
        echo "  n_acop: {$dup->n_acop} (repetido {$cant} veces)\n";
    }
} else {
    echo "✓ No hay duplicados\n";
}

echo "\n=== FIN DEL DIAGNÓSTICO ===\n\n";
