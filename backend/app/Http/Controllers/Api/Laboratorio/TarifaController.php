<?php

namespace App\Http\Controllers\Api\Laboratorio;

use App\Http\Controllers\Controller;
use App\Models\Laboratorio\Tarifa;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TarifaController extends Controller
{
    /**
     * Listar todas las tarifas, más recientes primero.
     * GET /api/dispatch/tarifas
     */
    public function index()
    {
        $tarifas = Tarifa::orderByDesc('anio')->orderByDesc('mes')->get();

        return response()->json([
            'success' => true,
            'data' => $tarifas,
        ]);
    }

    private function reglasValidacion($id = null): array
    {
        return [
            'mes' => 'required|integer|min:1|max:12',
            'anio' => 'required|integer|min:2020|max:2100',
            'tarifa_base' => 'required|numeric|min:0',
            'escala' => 'required|numeric|min:0',
            'fondo_estabilizacion' => 'required|numeric|min:0',
            'ley_base' => 'nullable|numeric|min:0|max:100',
            'iva_porcentaje' => 'nullable|numeric|min:0|max:1',
            'observaciones' => 'nullable|string',
        ];
    }

    /**
     * Crear la tarifa de un mes.
     * POST /api/dispatch/tarifas
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), $this->reglasValidacion());

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors(),
            ], 422);
        }

        if (Tarifa::where('mes', $request->mes)->where('anio', $request->anio)->exists()) {
            return response()->json([
                'error' => 'Ya existe una tarifa para ese mes',
                'mensaje' => "Ya hay una tarifa cargada para {$request->mes}/{$request->anio}.",
            ], 409);
        }

        $tarifa = Tarifa::create($request->only([
            'mes', 'anio', 'tarifa_base', 'escala', 'fondo_estabilizacion',
            'ley_base', 'iva_porcentaje', 'observaciones',
        ]));

        return response()->json([
            'mensaje' => 'Tarifa creada correctamente',
            'data' => $tarifa,
        ], 201);
    }

    /**
     * Actualizar la tarifa de un mes.
     * PUT /api/dispatch/tarifas/{id}
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), $this->reglasValidacion($id));

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors(),
            ], 422);
        }

        $tarifa = Tarifa::findOrFail($id);

        if (Tarifa::where('mes', $request->mes)->where('anio', $request->anio)->where('id', '!=', $id)->exists()) {
            return response()->json([
                'error' => 'Ya existe una tarifa para ese mes',
                'mensaje' => "Ya hay otra tarifa cargada para {$request->mes}/{$request->anio}.",
            ], 409);
        }

        $tarifa->update($request->only([
            'mes', 'anio', 'tarifa_base', 'escala', 'fondo_estabilizacion',
            'ley_base', 'iva_porcentaje', 'observaciones',
        ]));

        return response()->json([
            'mensaje' => 'Tarifa actualizada correctamente',
            'data' => $tarifa->fresh(),
        ]);
    }

    /**
     * Eliminar la tarifa de un mes.
     * DELETE /api/dispatch/tarifas/{id}
     */
    public function destroy($id)
    {
        $tarifa = Tarifa::findOrFail($id);
        $tarifa->delete();

        return response()->json([
            'mensaje' => 'Tarifa eliminada correctamente',
        ]);
    }

    /**
     * Extrae los valores de Tarifa desde el PDF de la Circular de ENAMI, SOLO como
     * previsualización — nunca guarda nada, el usuario revisa/corrige y confirma
     * usando store()/update() como siempre.
     *
     * Fila usada: "tarifas nacionales excepto indicadas" de MINERALES DE FLOTACIÓN,
     * página en US$ — verificada al céntimo contra 2 liquidaciones reales de ENAMI
     * (L 41356 y L 41394, ver conversación del 27-ago-2026). El IVA no viene en el
     * PDF (la Circular solo menciona una "retención" del 4%, que es otra cosa) —
     * se deja fijo en 19% para que el usuario lo confirme o ajuste a mano.
     *
     * POST /api/dispatch/tarifas/previsualizar-pdf
     */
    public function previsualizarPdf(Request $request)
    {
        $request->validate([
            'pdf' => 'required|file|mimes:pdf|max:10240',
        ]);

        try {
            $parser = new \Smalot\PdfParser\Parser();
            $pdf = $parser->parseFile($request->file('pdf')->getRealPath());
        } catch (\Throwable $e) {
            return response()->json(['error' => 'No se pudo leer el PDF. ¿Es un archivo válido?'], 422);
        }

        $paginaUsd = null;
        foreach ($pdf->getPages() as $pagina) {
            $texto = $pagina->getText();
            if (stripos($texto, 'VALORES EN US$') !== false) {
                $paginaUsd = $texto;
                break;
            }
        }

        if ($paginaUsd === null) {
            return response()->json(['error' => 'No se encontró una página en US$ dentro del PDF — ¿es una Circular de Tarifas de ENAMI?'], 422);
        }

        if (!preg_match('/tarifas\s+nacionales\s+excepto\s+indicadas\s*([\d.,]+)/ui', $paginaUsd, $bloque)) {
            return response()->json(['error' => 'No se encontró la fila "tarifas nacionales excepto indicadas" — el formato de esta Circular puede ser distinto. Cárgala a mano.'], 422);
        }
        preg_match_all('/\d+,\d{2,4}/', $bloque[1], $numeros);
        if (count($numeros[0]) < 3) {
            return response()->json(['error' => 'No se pudieron leer los 3 valores de la fila de tarifa. Cárgala a mano.'], 422);
        }
        [$tarifaBase, $escala, $fondoEstabilizacion] = array_map(
            fn ($n) => (float) str_replace(',', '.', $n),
            array_slice($numeros[0], 0, 3)
        );

        $leyBase = null;
        if (preg_match('/BASE\s+([\d,]+)\s*%\s*CU\s+INSOLUBLE/ui', $paginaUsd, $mLey)) {
            $leyBase = (float) str_replace(',', '.', $mLey[1]);
        }

        $mes = null;
        $anio = null;
        $nombresMeses = ['enero' => 1, 'febrero' => 2, 'marzo' => 3, 'abril' => 4, 'mayo' => 5, 'junio' => 6,
            'julio' => 7, 'agosto' => 8, 'septiembre' => 9, 'octubre' => 10, 'noviembre' => 11, 'diciembre' => 12];
        if (preg_match('/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})/ui', $paginaUsd, $mFecha)) {
            $mes = $nombresMeses[strtolower($mFecha[1])];
            $anio = (int) $mFecha[2];
        }

        return response()->json([
            'mensaje' => 'Valores extraídos del PDF — revisa que calcen antes de guardar.',
            'data' => [
                'mes' => $mes,
                'anio' => $anio,
                'tarifa_base' => $tarifaBase,
                'escala' => $escala,
                'fondo_estabilizacion' => $fondoEstabilizacion,
                'ley_base' => $leyBase,
                'iva_porcentaje' => 0.19,
                'observaciones' => 'Importado desde PDF (fila "tarifas nacionales excepto indicadas", US$) — revisar antes de guardar.',
            ],
        ]);
    }
}
