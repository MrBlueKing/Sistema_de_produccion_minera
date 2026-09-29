<?php

namespace App\Services\Explosivos;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Datos del dashboard "Perforación y Tronadura".
 *
 * Lo usan dos pantallas con el mismo componente de frontend:
 *  - Dashboard Gerencial > Operaciones > Perforación y Tronadura (varias faenas)
 *  - Ingeniería > Reportes P&T > Dashboard (la faena del usuario)
 *
 * Devuelve filas agregadas con su id_faena, sin sumar entre faenas: el
 * frontend las junta según lo que tenga seleccionado. Se excluyen los
 * reportes en borrador (no confirmados), igual que en el resto de los KPIs.
 */
class PerforacionTronaduraService
{
    public function dashboard(string $desde, string $hasta, ?array $idsFaena): array
    {
        $reportes = fn () => DB::table('reportes_perforacion as r')
            ->when($idsFaena, fn ($q) => $q->whereIn('r.id_faena', $idsFaena))
            ->where('r.estado', '!=', 'borrador')
            ->whereBetween('r.fecha', [$desde, $hasta]);

        $conLineas = fn () => $reportes()->join('lineas_reporte_perforacion as l', 'l.id_reporte', '=', 'r.id');

        // Tiros y metros perforados por día y turno.
        $turnos = $conLineas()
            ->selectRaw('r.id_faena, r.fecha, r.turno, SUM(l.numero_tiros) as tiros, SUM(l.numero_tiros * l.largo_perforacion) as metros')
            ->groupBy('r.id_faena', 'r.fecha', 'r.turno')
            ->get();

        // Tiros por frente y día (mapa de calor).
        $frenteDia = $conLineas()
            ->join('frentes_trabajo as ft', 'ft.id', '=', 'l.id_frente_trabajo')
            ->selectRaw('r.id_faena, l.id_frente_trabajo, ft.codigo_completo as frente, r.fecha, SUM(l.numero_tiros) as tiros')
            ->groupBy('r.id_faena', 'l.id_frente_trabajo', 'ft.codigo_completo', 'r.fecha')
            ->get();

        // Lo extraído (dumpadas) por día y por frente, con la ley Cu Insoluble
        // ponderada por tonelaje — mismo criterio que Resumen de Dumpadas.
        $dumpadas = fn () => DB::table('dumpadas as d')
            ->when($idsFaena, fn ($q) => $q->whereIn('d.id_faena', $idsFaena))
            ->whereBetween('d.fecha', [$desde, $hasta]);

        $tonDia = $dumpadas()
            ->selectRaw('d.id_faena, d.fecha, SUM(d.ton) as ton')
            ->groupBy('d.id_faena', 'd.fecha')
            ->get();

        $tonFrente = $dumpadas()
            ->whereNotNull('d.id_frente_trabajo')
            ->selectRaw('d.id_faena, d.id_frente_trabajo, SUM(d.ton) as ton, '
                . 'SUM(CASE WHEN d.cu_insoluble IS NOT NULL THEN d.ton END) as ton_con_ley, '
                . 'SUM(CASE WHEN d.cu_insoluble IS NOT NULL THEN d.ton * d.cu_insoluble END) as ton_x_ley')
            ->groupBy('d.id_faena', 'd.id_frente_trabajo')
            ->get()
            ->map(fn ($r) => [
                'id_faena'          => (int) $r->id_faena,
                'id_frente_trabajo' => (int) $r->id_frente_trabajo,
                'ton'               => round((float) $r->ton, 2),
                'ley'               => $r->ton_con_ley > 0 ? round($r->ton_x_ley / $r->ton_con_ley, 3) : null,
            ]);

        // Explosivos usados (real) contra lo que calculaba la fórmula, por tipo.
        $explosivos = $conLineas()
            ->join('explosivos_linea_reporte as e', 'e.id_linea_reporte', '=', 'l.id')
            ->join('tipos_explosivos as te', 'te.id', '=', 'e.id_tipo_explosivo')
            ->selectRaw('r.id_faena, te.codigo as tipo, te.unidad_medida, SUM(e.cantidad_calculada) as calculado, SUM(e.cantidad_final) as real_usado')
            ->groupBy('r.id_faena', 'te.codigo', 'te.unidad_medida')
            ->get();

        // Stock actual de cada tipo en el polvorín de la faena (para la cobertura).
        $stock = DB::table('stock_explosivos as s')
            ->join('polvorines as p', 'p.id', '=', 's.id_polvorin')
            ->join('tipos_explosivos as te', 'te.id', '=', 's.id_tipo_explosivo')
            ->when($idsFaena, fn ($q) => $q->whereIn('p.id_faena', $idsFaena))
            ->selectRaw('p.id_faena, te.codigo as tipo, te.unidad_medida, SUM(s.cantidad) as stock')
            ->groupBy('p.id_faena', 'te.codigo', 'te.unidad_medida')
            ->get();

        // Perforistas: tiros, metros, días y reportes en los que aparecen.
        $perforistas = $conLineas()
            ->join('personal_autorizado_explosivos as p', 'p.id', '=', 'l.id_personal')
            ->selectRaw("r.id_faena, p.rut, TRIM(CONCAT(p.nombre, ' ', COALESCE(p.apellido, ''))) as nombre, "
                . 'COUNT(DISTINCT r.id) as reportes, COUNT(DISTINCT r.fecha) as dias, '
                . 'SUM(l.numero_tiros) as tiros, SUM(l.numero_tiros * l.largo_perforacion) as metros')
            ->groupBy('r.id_faena', 'p.rut', 'p.nombre', 'p.apellido')
            ->get();

        // Reportes del período por estado (un reporte sin cerrar todavía no
        // descontó sus explosivos del stock).
        $estados = $reportes()
            ->selectRaw('r.id_faena, r.estado, COUNT(*) as total')
            ->groupBy('r.id_faena', 'r.estado')
            ->get();

        $num = fn ($v) => round((float) $v, 2);

        return [
            'periodo' => [
                'desde' => $desde,
                'hasta' => $hasta,
                'dias'  => Carbon::parse($desde)->diffInDays(Carbon::parse($hasta)) + 1,
            ],
            'turnos' => $turnos->map(fn ($r) => [
                'id_faena' => (int) $r->id_faena, 'fecha' => $r->fecha, 'turno' => $r->turno,
                'tiros' => (int) $r->tiros, 'metros' => $num($r->metros),
            ])->values(),
            'frente_dia' => $frenteDia->map(fn ($r) => [
                'id_faena' => (int) $r->id_faena, 'id_frente_trabajo' => (int) $r->id_frente_trabajo,
                'frente' => $r->frente, 'fecha' => $r->fecha, 'tiros' => (int) $r->tiros,
            ])->values(),
            'ton_dia' => $tonDia->map(fn ($r) => [
                'id_faena' => (int) $r->id_faena, 'fecha' => $r->fecha, 'ton' => $num($r->ton),
            ])->values(),
            'ton_frente' => $tonFrente->values(),
            'explosivos' => $explosivos->map(fn ($r) => [
                'id_faena' => (int) $r->id_faena, 'tipo' => $r->tipo, 'unidad' => $r->unidad_medida,
                'calculado' => $num($r->calculado), 'real' => $num($r->real_usado),
            ])->values(),
            'stock' => $stock->map(fn ($r) => [
                'id_faena' => (int) $r->id_faena, 'tipo' => $r->tipo, 'unidad' => $r->unidad_medida, 'stock' => $num($r->stock),
            ])->values(),
            'perforistas' => $perforistas->map(fn ($r) => [
                'id_faena' => (int) $r->id_faena, 'rut' => $r->rut, 'nombre' => $r->nombre,
                'reportes' => (int) $r->reportes, 'dias' => (int) $r->dias,
                'tiros' => (int) $r->tiros, 'metros' => $num($r->metros),
            ])->values(),
            'estados' => $estados->map(fn ($r) => [
                'id_faena' => (int) $r->id_faena, 'estado' => $r->estado, 'total' => (int) $r->total,
            ])->values(),
        ];
    }
}
