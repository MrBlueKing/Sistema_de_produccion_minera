<?php

namespace App\Services\Planificacion;

/**
 * Qué cambió entre dos versiones de un plan (la foto guardada al reabrir y el plan
 * que se vuelve a publicar). Devuelve frases cortas para el historial, ej.
 * "M3-12S (Preparación): 1.080 → 960 t, 6 turnos cambiados".
 *
 * Ambos lados vienen en el formato de PlanProduccionController::serializar().
 */
class ComparadorPlan
{
    private const ACTIVIDAD = [
        'preparacion' => 'Preparación', 'camara' => 'Cámara', 'desarrollo' => 'Desarrollo', 'fortificacion' => 'Fortificación',
    ];
    private const TIPO_DIA = ['habil' => 'Hábil', 'tc' => 'Hábil', 'tl' => 'Hábil', 'libre' => 'Libre'];

    /** @return string[] */
    public function comparar(array $antes, array $despues): array
    {
        // La foto viene de JSON (arrays) y el plan actual de serializar() (con
        // Collections adentro): se dejan los dos como arrays planos.
        $antes = json_decode(json_encode($antes), true);
        $despues = json_decode(json_encode($despues), true);
        $c = [];

        foreach (['ton_por_disparo' => 'Ton por disparo', 'tronaduras_por_perforista' => 'Tronaduras por perforista'] as $k => $label) {
            if (!$this->igual($antes[$k] ?? null, $despues[$k] ?? null)) {
                $c[] = "{$label}: {$this->n($antes[$k] ?? null, 2)} → {$this->n($despues[$k] ?? null, 2)}";
            }
        }

        // Días: tipo y perforistas
        $diasAntes = collect($antes['dias'] ?? [])->keyBy('dia');
        $tipos = [];
        $perf = [];
        $turnos = [];
        $tn = fn ($l) => implode(' ', array_map(fn ($t) => $t === 'Noche' ? 'TN' : $t, $l ?: [])) ?: 'ninguno';
        foreach ($despues['dias'] ?? [] as $d) {
            $a = $diasAntes->get($d['dia']);
            if (!$a) {
                continue;
            }
            if ($a['tipo'] !== $d['tipo']) {
                $tipos[] = "{$d['dia']} (" . (self::TIPO_DIA[$a['tipo']] ?? $a['tipo']) . ' → ' . (self::TIPO_DIA[$d['tipo']] ?? $d['tipo']) . ')';
            }
            if (isset($a['turnos'], $d['turnos']) && $a['turnos'] != $d['turnos']) {
                $turnos[] = "{$d['dia']} ({$tn($a['turnos'])} → {$tn($d['turnos'])})";
            }
            if (!$this->igual($a['perforistas'], $d['perforistas'])) {
                $perf[] = "{$d['dia']} ({$this->n($a['perforistas'])} → {$this->n($d['perforistas'])})";
            }
        }
        if ($tipos) {
            $c[] = 'Tipo de día: ' . $this->lista($tipos);
        }
        if ($turnos) {
            $c[] = 'Turnos: ' . $this->lista($turnos);
        }
        if ($perf) {
            $c[] = 'Perforistas: ' . $this->lista($perf);
        }

        // Frentes: agregados, quitados, toneladas y ley
        $clave = fn ($f) => $f['id_frente_trabajo'] . '|' . $f['actividad'];
        $fa = collect($antes['frentes'] ?? [])->keyBy($clave);
        $fd = collect($despues['frentes'] ?? [])->keyBy($clave);
        $nombre = fn ($f) => ($f['frente'] ?? "Frente {$f['id_frente_trabajo']}") . ' (' . (self::ACTIVIDAD[$f['actividad']] ?? $f['actividad']) . ')';

        foreach ($fd as $k => $f) {
            if (!$fa->has($k)) {
                $c[] = "Se agregó {$nombre($f)}: {$this->n($this->total($f))} t";
            }
        }
        foreach ($fa as $k => $f) {
            if (!$fd->has($k)) {
                $c[] = "Se quitó {$nombre($f)} (tenía {$this->n($this->total($f))} t)";
            }
        }
        foreach ($fd as $k => $f) {
            $a = $fa->get($k);
            if (!$a) {
                continue;
            }
            $partes = [];
            $celdasA = $this->celdas($a);
            $celdasD = $this->celdas($f);
            $turnos = collect(array_keys($celdasA + $celdasD))
                ->filter(fn ($t) => !$this->igual($celdasA[$t] ?? null, $celdasD[$t] ?? null))
                ->count();
            if ($turnos) {
                $ta = $this->total($a);
                $td = $this->total($f);
                $partes[] = ($this->igual($ta, $td) ? "{$this->n($td)} t (mismo total)" : "{$this->n($ta)} → {$this->n($td)} t")
                    . ", {$turnos} " . ($turnos === 1 ? 'turno cambiado' : 'turnos cambiados');
            }
            if (!$this->igual($a['ley_esperada'] ?? null, $f['ley_esperada'] ?? null)) {
                $partes[] = "ley {$this->n($a['ley_esperada'] ?? null, 2)} → {$this->n($f['ley_esperada'] ?? null, 2)} %";
            }
            if ($partes) {
                $c[] = "{$nombre($f)}: " . implode('; ', $partes);
            }
        }

        // Rutas de transporte
        $ra = collect($antes['rutas'] ?? [])->keyBy('nombre');
        $rd = collect($despues['rutas'] ?? [])->keyBy('nombre');
        foreach ($rd as $n => $r) {
            $a = $ra->get($n);
            if (!$a) {
                $c[] = "Se agregó la ruta {$n}";
                continue;
            }
            $dif = [];
            foreach (['ciclo_min' => 'ciclo', 'dumpers' => 'dumpers', 'peso_ton' => 'peso', 'horas' => 'horas'] as $k => $label) {
                if (!$this->igual($a[$k] ?? null, $r[$k] ?? null)) {
                    $dif[] = "{$label} {$this->n($a[$k] ?? null, 1)} → {$this->n($r[$k] ?? null, 1)}";
                }
            }
            if ($dif) {
                $c[] = "Ruta {$n}: " . implode(', ', $dif);
            }
        }
        foreach ($ra as $n => $r) {
            if (!$rd->has($n)) {
                $c[] = "Se quitó la ruta {$n}";
            }
        }

        return $c;
    }

    private function celdas(array $f): array
    {
        $out = [];
        foreach ($f['celdas'] ?? [] as $c) {
            // Fortificación no tiene toneladas: la celda cuenta como "marcada"
            $out["{$c['dia']}|{$c['turno']}"] = $c['toneladas'] ?? 'X';
        }
        return $out;
    }

    private function total(array $f): float
    {
        return array_sum(array_map(fn ($c) => (float) ($c['toneladas'] ?? 0), $f['celdas'] ?? []));
    }

    private function igual($a, $b): bool
    {
        if (is_numeric($a) && is_numeric($b)) {
            return abs((float) $a - (float) $b) < 0.0001;
        }
        return $a === $b;
    }

    private function n($v, int $dec = 0): string
    {
        if ($v === null || $v === '') {
            return '—';
        }
        if (!is_numeric($v)) {
            return (string) $v;
        }
        $v = (float) $v;
        // Sin decimales sobrantes: 18,00 → 18; 18,08 → 18,08
        $dec = $dec && fmod($v, 1) != 0 ? $dec : 0;
        return number_format($v, $dec, ',', '.');
    }

    /** Lista corta: si son muchos, muestra los primeros y cuántos más. */
    private function lista(array $items, int $max = 8): string
    {
        $extra = count($items) - $max;
        return implode(', ', array_slice($items, 0, $max)) . ($extra > 0 ? " y {$extra} más" : '');
    }
}
