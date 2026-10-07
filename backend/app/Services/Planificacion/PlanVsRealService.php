<?php

namespace App\Services\Planificacion;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Lo "real" contra lo que se compara el programa de producción:
 *  - dumpadas por frente, día (fecha de extracción) y jornada → toneladas y ley;
 *  - tronaduras = líneas de los Reportes de Perforación (cada línea es un disparo
 *    de un perforista en un frente), sin contar los reportes en borrador, igual
 *    que PerforacionTronaduraService.
 */
class PlanVsRealService
{
    /**
     * Dumpadas del mes agrupadas por frente / día / jornada / tipo de material.
     *
     * El día es el de llegada a cancha (fecha_cyt): cuándo el material salió
     * efectivamente de la mina — una dumpada extraída el 30 que llegó el 1 cuenta
     * para el mes nuevo. Si no tiene CyT (antes del 29-09-2026) se usa la fecha
     * de extracción, igual que Avance Diario. La jornada es la registrada en la
     * dumpada (la de extracción).
     */
    public function dumpadas(int $idFaena, int $anio, int $mes)
    {
        [$desde, $hasta] = $this->rango($anio, $mes);
        $fecha = 'COALESCE(d.fecha_cyt, d.fecha)';

        return DB::table('dumpadas as d')
            ->leftJoin('frentes_trabajo as f', 'f.id', '=', 'd.id_frente_trabajo')
            ->where('d.id_faena', $idFaena)
            ->whereRaw("{$fecha} BETWEEN ? AND ?", [$desde, $hasta])
            ->selectRaw("d.id_frente_trabajo, f.codigo_completo as frente, DAY({$fecha}) as dia,
                COALESCE(d.jornada, 'Sin jornada') as jornada, COALESCE(d.tipo_material, 'mineral') as tipo_material,
                COUNT(*) as cantidad, COALESCE(SUM(d.ton), 0) as toneladas,
                COALESCE(SUM(CASE WHEN d.cu_insoluble IS NOT NULL THEN d.ton END), 0) as toneladas_con_ley,
                COALESCE(SUM(CASE WHEN d.cu_insoluble IS NOT NULL THEN d.ton * d.cu_insoluble END), 0) as cu_por_ton")
            ->groupBy('d.id_frente_trabajo', 'f.codigo_completo', DB::raw("DAY({$fecha})"), 'jornada', 'tipo_material')
            ->get()
            ->map(fn ($r) => [
                'id_frente_trabajo' => $r->id_frente_trabajo !== null ? (int) $r->id_frente_trabajo : null,
                'frente'            => $r->frente,
                'dia'               => (int) $r->dia,
                'jornada'           => $r->jornada,
                'tipo_material'     => $r->tipo_material,
                'cantidad'          => (int) $r->cantidad,
                'toneladas'         => (float) $r->toneladas,
                'toneladas_con_ley' => (float) $r->toneladas_con_ley,
                'cu_por_ton'        => (float) $r->cu_por_ton,
            ]);
    }

    /**
     * Dumpadas de un frente en un día (por llegada a cancha, igual que dumpadas()),
     * una por una: para el detalle al hacer clic en un frente en Plan vs Real.
     * $idFrente null = dumpadas sin frente.
     */
    public function dumpadasDelDia(int $idFaena, string $fecha, ?int $idFrente, bool $mineral)
    {
        return DB::table('dumpadas as d')
            ->where('d.id_faena', $idFaena)
            ->whereRaw('COALESCE(d.fecha_cyt, d.fecha) = ?', [$fecha])
            ->when($idFrente, fn ($q) => $q->where('d.id_frente_trabajo', $idFrente), fn ($q) => $q->whereNull('d.id_frente_trabajo'))
            ->when($mineral, fn ($q) => $q->where(fn ($q2) => $q2->where('d.tipo_material', '!=', 'esteril')->orWhereNull('d.tipo_material')),
                fn ($q) => $q->where('d.tipo_material', 'esteril'))
            ->orderByRaw('COALESCE(d.hora_cyt, d.hora)')
            ->orderBy('d.numero_dumpada')
            ->get(['d.id', 'd.numero_dumpada', 'd.jornada', 'd.numero_jornada', 'd.fecha', 'd.hora', 'd.fecha_cyt', 'd.hora_cyt',
                'd.ton', 'd.ley_visual', 'd.cu_insoluble', 'd.estado', 'd.certificado', 'd.nombre_maquina', 'd.nombre_operador'])
            ->map(fn ($r) => [
                'id'             => $r->id,
                'numero_dumpada' => $r->numero_dumpada,
                'jornada'        => $r->jornada,
                'numero_jornada' => $r->numero_jornada,
                'fecha'          => $r->fecha,
                'hora'           => $r->hora ? substr($r->hora, 0, 5) : null,
                'fecha_cyt'      => $r->fecha_cyt,
                'hora_cyt'       => $r->hora_cyt ? substr($r->hora_cyt, 0, 5) : null,
                'ton'            => (float) $r->ton,
                'ley_visual'     => $r->ley_visual !== null ? (float) $r->ley_visual : null,
                'cu_insoluble'   => $r->cu_insoluble !== null ? round((float) $r->cu_insoluble, 3) : null,
                'estado'         => $r->estado,
                'certificado'    => $r->certificado,
                'dumper'         => $r->nombre_maquina,
                'operador'       => $r->nombre_operador,
            ]);
    }

    /** Tronaduras (disparos) del mes por frente / día / turno / perforista. */
    public function tronaduras(int $idFaena, int $anio, int $mes)
    {
        [$desde, $hasta] = $this->rango($anio, $mes);

        return DB::table('reportes_perforacion as r')
            ->join('lineas_reporte_perforacion as l', 'l.id_reporte', '=', 'r.id')
            ->leftJoin('frentes_trabajo as f', 'f.id', '=', 'l.id_frente_trabajo')
            ->leftJoin('personal_autorizado_explosivos as p', 'p.id', '=', 'l.id_personal')
            ->where('r.id_faena', $idFaena)
            ->where('r.estado', '!=', 'borrador')
            ->whereBetween('r.fecha', [$desde, $hasta])
            ->selectRaw('l.id_frente_trabajo, f.codigo_completo as frente, DAY(r.fecha) as dia, r.turno,
                l.id_personal, TRIM(CONCAT(COALESCE(p.nombre, ""), " ", COALESCE(p.apellido, ""))) as perforista,
                COUNT(*) as disparos, COALESCE(SUM(l.numero_tiros), 0) as tiros')
            ->groupBy('l.id_frente_trabajo', 'f.codigo_completo', DB::raw('DAY(r.fecha)'), 'r.turno', 'l.id_personal', 'perforista')
            ->get()
            ->map(fn ($r) => [
                'id_frente_trabajo' => $r->id_frente_trabajo !== null ? (int) $r->id_frente_trabajo : null,
                'frente'            => $r->frente,
                'dia'               => (int) $r->dia,
                'turno'             => $r->turno,
                'id_personal'       => $r->id_personal !== null ? (int) $r->id_personal : null,
                'perforista'        => $r->perforista ?: 'Sin perforista',
                'disparos'          => (int) $r->disparos,
                'tiros'             => (int) $r->tiros,
            ]);
    }

    /**
     * Cuánto dieron en la realidad los supuestos del plan en un mes: toneladas por
     * disparo y tronaduras por perforista al día (turno-perforista = un perforista
     * que disparó al menos una vez ese día). Es la referencia que se muestra al
     * planificar el mes siguiente.
     */
    public function referenciaMes(int $idFaena, int $anio, int $mes): array
    {
        [$desde, $hasta] = $this->rango($anio, $mes);

        $perf = DB::table('reportes_perforacion as r')
            ->join('lineas_reporte_perforacion as l', 'l.id_reporte', '=', 'r.id')
            ->where('r.id_faena', $idFaena)
            ->where('r.estado', '!=', 'borrador')
            ->whereBetween('r.fecha', [$desde, $hasta])
            ->selectRaw('COUNT(*) as disparos, COUNT(DISTINCT CONCAT(l.id_personal, "|", r.fecha)) as perforista_dias,
                COUNT(DISTINCT l.id_personal) as perforistas')
            ->first();

        $ton = (float) DB::table('dumpadas')
            ->where('id_faena', $idFaena)
            ->whereBetween('fecha', [$desde, $hasta])
            ->sum('ton');

        $disparos = (int) ($perf->disparos ?? 0);
        $perfDias = (int) ($perf->perforista_dias ?? 0);

        return [
            'anio'                      => $anio,
            'mes'                       => $mes,
            'toneladas'                 => round($ton, 2),
            'disparos'                  => $disparos,
            'perforista_dias'           => $perfDias,
            'perforistas'               => (int) ($perf->perforistas ?? 0),
            'ton_por_disparo'           => $disparos ? round($ton / $disparos, 2) : null,
            'tronaduras_por_perforista' => $perfDias ? round($disparos / $perfDias, 2) : null,
        ];
    }

    /**
     * Ley real de cada frente en un mes: Cu Insoluble ponderado por tonelaje, solo
     * dumpadas de mineral que ya tienen resultado de Laboratorio. Se ofrece como
     * sugerencia de "ley esperada" al planificar el mes siguiente.
     */
    public function leyesMes(int $idFaena, int $anio, int $mes)
    {
        [$desde, $hasta] = $this->rango($anio, $mes);

        return DB::table('dumpadas')
            ->where('id_faena', $idFaena)
            ->whereBetween('fecha', [$desde, $hasta])
            ->where('tipo_material', 'mineral')
            ->whereNotNull('cu_insoluble')
            ->whereNotNull('id_frente_trabajo')
            ->selectRaw('id_frente_trabajo, SUM(ton * cu_insoluble) / SUM(ton) as ley, SUM(ton) as toneladas')
            ->groupBy('id_frente_trabajo')
            ->havingRaw('SUM(ton) > 0')
            ->get()
            ->mapWithKeys(fn ($r) => [(int) $r->id_frente_trabajo => ['ley' => round((float) $r->ley, 2), 'toneladas' => round((float) $r->toneladas, 1)]]);
    }

    /** Referencia del mes anterior al indicado. */
    public function referenciaMesAnterior(int $idFaena, int $anio, int $mes): array
    {
        $ant = Carbon::create($anio, $mes, 1)->subMonth();
        return $this->referenciaMes($idFaena, $ant->year, $ant->month);
    }

    private function rango(int $anio, int $mes): array
    {
        $inicio = Carbon::create($anio, $mes, 1);
        return [$inicio->format('Y-m-d'), $inicio->copy()->endOfMonth()->format('Y-m-d')];
    }
}
