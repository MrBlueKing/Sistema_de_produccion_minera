<?php

namespace App\Http\Controllers\Api\Explosivos;

use App\Http\Controllers\Controller;
use App\Models\Explosivos\StockExplosivo;
use App\Models\Explosivos\TipoExplosivo;
use App\Traits\MultiTenancy;
use Illuminate\Http\Request;

class StockExplosivoController extends Controller
{
    use MultiTenancy;

    /**
     * GET /api/explosivos/stock
     * Obtener stock actual con filtros
     */
    public function index(Request $request)
    {
        $query = StockExplosivo::with([
            'tipoExplosivo:id,codigo,nombre,unidad_medida,stock_minimo,stock_maximo',
            'tipoExplosivo.categoria:id,nombre',
            'polvorin:id,codigo,nombre'
        ]);

        $this->aplicarFiltroFaena($query, $request);

        if ($request->has('id_polvorin')) {
            $query->where('id_polvorin', $request->id_polvorin);
        }

        if ($request->has('id_tipo_explosivo')) {
            $query->where('id_tipo_explosivo', $request->id_tipo_explosivo);
        }

        if ($request->has('con_stock')) {
            $query->where('cantidad', '>', 0);
        }

        if ($request->has('bajo_minimo')) {
            $query->bajoMinimo();
        }

        $stocks = $query->get();

        // Agregar atributos calculados
        $stocks->each(function ($stock) {
            $stock->cantidad_disponible = $stock->cantidad_disponible;
            $stock->esta_bajo_minimo = $stock->esta_bajo_minimo;
            $stock->esta_sobre_maximo = $stock->esta_sobre_maximo;
        });

        return response()->json($stocks);
    }

    /**
     * GET /api/explosivos/stock/resumen
     * Resumen del stock por categoría
     */
    public function resumen(Request $request)
    {
        $query = StockExplosivo::with([
            'tipoExplosivo:id,codigo,nombre,unidad_medida,id_categoria',
            'tipoExplosivo.categoria:id,nombre'
        ]);

        $this->aplicarFiltroFaena($query, $request);

        if ($request->has('id_polvorin')) {
            $query->where('id_polvorin', $request->id_polvorin);
        }

        $stocks = $query->where('cantidad', '>', 0)->get();

        // Agrupar por categoría
        $resumen = $stocks->groupBy(function ($stock) {
            return $stock->tipoExplosivo->categoria->nombre ?? 'Sin Categoría';
        })->map(function ($grupo, $categoria) {
            return [
                'categoria' => $categoria,
                'items' => $grupo->map(function ($stock) {
                    return [
                        'tipo' => $stock->tipoExplosivo->codigo . ' - ' . $stock->tipoExplosivo->nombre,
                        'cantidad' => $stock->cantidad,
                        'unidad' => $stock->tipoExplosivo->unidad_medida,
                        'disponible' => $stock->cantidad_disponible,
                        'reservada' => $stock->cantidad_reservada,
                        'bajo_minimo' => $stock->esta_bajo_minimo,
                    ];
                })->values(),
                'total_items' => $grupo->count(),
            ];
        })->values();

        return response()->json([
            'resumen' => $resumen,
            'totales' => [
                'tipos_con_stock' => $stocks->count(),
                'items_bajo_minimo' => $stocks->filter(fn($s) => $s->esta_bajo_minimo)->count(),
            ]
        ]);
    }

    /**
     * GET /api/explosivos/stock/alertas
     * Obtener alertas de stock (bajo mínimo, sobre máximo)
     */
    public function alertas(Request $request)
    {
        $query = StockExplosivo::with([
            'tipoExplosivo:id,codigo,nombre,unidad_medida,stock_minimo,stock_maximo',
            'polvorin:id,codigo,nombre'
        ]);

        $this->aplicarFiltroFaena($query, $request);

        if ($request->has('id_polvorin')) {
            $query->where('id_polvorin', $request->id_polvorin);
        }

        $stocks = $query->get();

        $alertas = [
            'bajo_minimo' => $stocks->filter(fn($s) => $s->esta_bajo_minimo)->map(function ($stock) {
                return [
                    'tipo_explosivo' => $stock->tipoExplosivo->codigo . ' - ' . $stock->tipoExplosivo->nombre,
                    'polvorin' => $stock->polvorin->nombre,
                    'cantidad_actual' => $stock->cantidad,
                    'stock_minimo' => $stock->tipoExplosivo->stock_minimo,
                    'unidad' => $stock->tipoExplosivo->unidad_medida,
                    'deficit' => $stock->tipoExplosivo->stock_minimo - $stock->cantidad,
                ];
            })->values(),
            'sobre_maximo' => $stocks->filter(fn($s) => $s->esta_sobre_maximo)->map(function ($stock) {
                return [
                    'tipo_explosivo' => $stock->tipoExplosivo->codigo . ' - ' . $stock->tipoExplosivo->nombre,
                    'polvorin' => $stock->polvorin->nombre,
                    'cantidad_actual' => $stock->cantidad,
                    'stock_maximo' => $stock->tipoExplosivo->stock_maximo,
                    'unidad' => $stock->tipoExplosivo->unidad_medida,
                    'exceso' => $stock->cantidad - $stock->tipoExplosivo->stock_maximo,
                ];
            })->values(),
        ];

        return response()->json($alertas);
    }

    /**
     * GET /api/explosivos/stock/por-tipo/{idTipoExplosivo}
     * Obtener stock de un tipo específico en todos los polvorines
     */
    public function porTipo($idTipoExplosivo, Request $request)
    {
        $tipo = TipoExplosivo::find($idTipoExplosivo);

        if (!$tipo) {
            return response()->json(['error' => 'Tipo de explosivo no encontrado'], 404);
        }

        $query = StockExplosivo::with('polvorin:id,codigo,nombre')
            ->where('id_tipo_explosivo', $idTipoExplosivo);

        $this->aplicarFiltroFaena($query, $request);

        $stocks = $query->get();

        return response()->json([
            'tipo_explosivo' => [
                'id' => $tipo->id,
                'codigo' => $tipo->codigo,
                'nombre' => $tipo->nombre,
                'unidad_medida' => $tipo->unidad_medida,
            ],
            'stock_por_polvorin' => $stocks->map(function ($stock) {
                return [
                    'polvorin' => $stock->polvorin->nombre,
                    'cantidad' => $stock->cantidad,
                    'disponible' => $stock->cantidad_disponible,
                    'reservada' => $stock->cantidad_reservada,
                ];
            }),
            'total' => $stocks->sum('cantidad'),
            'total_disponible' => $stocks->sum('cantidad_disponible'),
        ]);
    }
}
