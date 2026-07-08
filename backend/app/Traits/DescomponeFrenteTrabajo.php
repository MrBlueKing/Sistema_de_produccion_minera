<?php

namespace App\Traits;

trait DescomponeFrenteTrabajo
{
    /**
     * Alias conocidos: texto que aparece en la columna "tipo" del Excel pero que
     * en esta faena significa lo mismo que un TipoFrente ya existente, solo
     * escrito distinto (otra abreviatura, otro nombre). Sin esto, cada variante
     * de escritura termina creando un TipoFrente nuevo (ej. "DESQ" creaba un
     * tipo "Desq" separado de "Desquinche", que ya significan lo mismo).
     * Clave = texto del Excel en mayúsculas, valor = nombre EXACTO (con tilde,
     * mayúscula/minúscula normal) del TipoFrente ya existente al que resuelve.
     * El valor se pasa por strtoupper() igual que el resto del código para que
     * calce con el caché keyBy(strtoupper(nombre)), incluida la rareza de que
     * PHP strtoupper() no toca acentos ("Recuperación" → "RECUPERACIóN", con
     * ó minúscula) — por eso NO se hardcodea el valor ya mayusculizado.
     */
    private const ALIAS_TIPO_FRENTE = [
        'DESQ'      => 'Desquinche',
        'DQ'        => 'Desquinche',
        'BANCO SUR' => 'Banco',
        'RT'        => 'Rebaje Techo',
        'RP'        => 'Rebaje Piso',
        'REC'       => 'Recuperación',
    ];

    /**
     * Resuelve el texto crudo de la columna "tipo" del Excel a su forma
     * canónica, aplicando ALIAS_TIPO_FRENTE si corresponde. Siempre devuelve
     * mayúsculas (mismo formato que usan los cachés keyBy(strtoupper(nombre))).
     */
    private function resolverAliasTipo(string $tipoExcel): string
    {
        $norm  = strtoupper(trim($tipoExcel));
        $alias = self::ALIAS_TIPO_FRENTE[$norm] ?? null;
        return $alias !== null ? strtoupper(trim($alias)) : $norm;
    }

    /**
     * Genera el codigo_completo sin espacios a partir del nombre del Excel.
     * Equivale a lo que haría el formulario manual al concatenar componentes.
     * "M5 -4SH2 REC" → "M5-4SH2REC"
     */
    private function codigoSinEspacios(string $nombre): string
    {
        return preg_replace('/\s+/', '', $nombre);
    }

    /**
     * Descompone el nombre del frente (Excel) en sus campos estructurales.
     *
     * Si el nombre empieza con "NIVEL" + número (ej. "NIVEL 974 M4 6N L33"),
     * ese prefijo se reconoce como el túnel ("NIVEL974") y se retira antes de
     * aplicar el resto de los patrones sobre lo que queda ("M4 6N L33").
     * Si no matchea (Cabildo, o Catemu sin prefijo "NIVEL" como "M3-11S"),
     * el comportamiento es idéntico al de siempre.
     *
     * Patrones reconocidos (sobre el nombre sin el prefijo de túnel, si lo hubo):
     *   M5 -1SH2 REC  → manto=M5, calle=-1, hebra=SH, numero=2REC
     *   M3 -11S REC   → manto=M3, calle=-11S, numero=REC
     *   M3 -11S       → manto=M3, calle=-11S
     *   DRIFT 468     → manto=DRIFT, calle=468
     *
     * @return array{tunel:string|null, manto:string, calle:string|null, hebra:string|null, numero:string|null}
     */
    private function descomponerNombreFrente(string $nombre): array
    {
        $nombre = trim($nombre);
        $tunel  = null;

        // Túnel: literalmente "NIVEL" (no "NIVELACION" ni similar) + número,
        // con o sin espacio entre ambos. Se retira del string antes de procesar el resto,
        // pero solo si queda algo más después (ej. "NIVEL 974 M4 6N"): si "NIVEL 970" es
        // el nombre completo (sin manto/calle propios), se deja intacto para que el
        // algoritmo de siempre lo trate como manto="NIVEL", calle="970" (comportamiento actual).
        if (preg_match('/^NIVEL(?![A-Z])\s*(-?\d+)\s*/i', $nombre, $mTunel)) {
            $restoTrasTunel = trim(substr($nombre, strlen($mTunel[0])));
            if ($restoTrasTunel !== '') {
                $tunel  = 'NIVEL' . $mTunel[1];
                $nombre = $restoTrasTunel;
            }
        }

        $partes  = preg_split('/\s+/', trim($nombre));
        $manto   = $partes[0] ?? $nombre;
        $calle   = null;
        $hebra   = null;
        $numero  = null;

        if (count($partes) < 2) {
            return compact('tunel', 'manto', 'calle', 'hebra', 'numero');
        }

        $seg   = $partes[1];
        $resto = array_slice($partes, 2);

        // Patrón M5: "-1SH2", "1NH2", "-4SH2" → calle + hebra (NH/SH) + número
        if (preg_match('/^(-?\d+)(NH|SH)(\d*.*)$/i', $seg, $m)) {
            $calle  = $m[1];
            $hebra  = strtoupper($m[2]);
            $numero = $m[3] . implode('', $resto) ?: null;
            return compact('tunel', 'manto', 'calle', 'hebra', 'numero');
        }

        // Patrón M3: "-11S", "-10N", "11S", "10N" → calle incluye letra de dirección
        if (preg_match('/^(-?\d+[NS])$/i', $seg, $m)) {
            $calle  = strtoupper($m[1]);
            $numero = $resto ? implode('', $resto) : null;
            return compact('tunel', 'manto', 'calle', 'hebra', 'numero');
        }

        // Número puro: "468", "1", "-2" → calle sin letra
        if (preg_match('/^(-?\d+)$/', $seg, $m)) {
            $calle  = $m[1];
            $numero = $resto ? implode('', $resto) : null;
            return compact('tunel', 'manto', 'calle', 'hebra', 'numero');
        }

        // No reconoce patrón → todo el resto en numero_frente
        $numero = implode(' ', array_slice($partes, 1));
        return compact('tunel', 'manto', 'calle', 'hebra', 'numero');
    }
}
