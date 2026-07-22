<?php

namespace App\Services;

use App\Models\Dispatch\Dumpada;
use App\Models\Dispatch\MuestraLibre;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

class CertificadoPdfService
{
    /**
     * Generar PDF de certificado para un conjunto de dumpadas
     *
     * @param array $dumpadaIds IDs de las dumpadas a incluir
     * @param string|null $numeroCertificado Número de certificado (opcional, se genera automáticamente)
     * @param bool $guardarNumero Si true, guarda el número de certificado en las dumpadas
     * @return \Barryvdh\DomPDF\PDF
     */
    /**
     * Generar PDF de certificado.
     * Acepta dumpadas, muestras específicas, o ambos tipos mezclados.
     */
    public function generarCertificado(array $dumpadaIds, ?string $numeroCertificado = null, bool $guardarNumero = true, array $muestraLibreIds = [], ?string $para = null)
    {
        $dumpadas = empty($dumpadaIds) ? collect() : Dumpada::with('frenteTrabajo')
            ->whereIn('id', $dumpadaIds)
            ->whereNotNull('ley')
            ->whereNotNull('cu_soluble')
            ->whereNotNull('cu_insoluble')
            ->orderBy('fecha')
            ->orderBy('numero_jornada')
            ->get();

        $muestrasLibres = empty($muestraLibreIds) ? collect() : MuestraLibre::whereIn('id', $muestraLibreIds)
            ->whereNotNull('ley')
            ->whereNotNull('cu_soluble')
            ->whereNotNull('cu_insoluble')
            ->orderBy('fecha')
            ->get();

        if ($dumpadas->isEmpty() && $muestrasLibres->isEmpty()) {
            throw new \Exception('No se encontraron muestras con análisis completo (ley, cu_soluble, cu_insoluble)');
        }

        if (!$numeroCertificado) {
            $numeroCertificado = $this->generarNumeroCertificado();
        }

        if ($guardarNumero) {
            $ahora = Carbon::now();
            $this->asignarCertificadoADumpadas($dumpadas, $numeroCertificado, $ahora);
            foreach ($muestrasLibres as $m) {
                $m->update(['certificado' => $numeroCertificado]);
            }
        }

        $muestrasData = array_merge(
            $this->prepararMuestras($dumpadas, $numeroCertificado),
            $this->prepararMuestrasMuestraLibre($muestrasLibres, $numeroCertificado)
        );

        $data = [
            'numeroCertificado' => $numeroCertificado,
            'fechaIngreso'      => $this->calcularFechaIngreso($dumpadas),
            'fechaEgreso'       => $this->calcularFechaEgreso($dumpadas),
            'muestras'          => $muestrasData,
            'laboratorio'       => $this->getDatosLaboratorio($para),
        ];

        $pdf = Pdf::loadView('pdf.certificado', $data);
        $pdf->setPaper('letter', 'portrait');

        return $pdf;
    }

    /**
     * Fecha de ingreso del certificado: la más antigua entre las dumpadas incluidas
     * en que se completó el análisis (se ingresó la ley). Si ninguna la tiene
     * registrada (dato histórico o certificado solo con muestras específicas),
     * se usa la fecha de la muestra como aproximación.
     */
    private function calcularFechaIngreso($dumpadas)
    {
        $fecha = $dumpadas->pluck('fecha_analisis_completado')->filter()->min();

        if (!$fecha) {
            $fecha = $dumpadas->pluck('fecha')->filter()->min();
        }

        return $fecha ? Carbon::parse($fecha)->format('d M. Y') : '-';
    }

    /**
     * Fecha de egreso del certificado: cuándo se generó por primera vez el PDF
     * (fecha_certificado_pdf). Si es un certificado histórico sin ese dato guardado,
     * se usa el momento actual como respaldo.
     */
    private function calcularFechaEgreso($dumpadas)
    {
        $fecha = $dumpadas->pluck('fecha_certificado_pdf')->filter()->min();

        return $fecha ? Carbon::parse($fecha)->format('d M. Y') : Carbon::now()->format('d M. Y');
    }

    /**
     * Regenerar un certificado existente por su número.
     * Incluye automáticamente dumpadas y muestras específicas con ese certificado.
     */
    public function regenerarCertificado(string $numeroCertificado, ?string $para = null, ?string $watermarkTexto = null)
    {
        $dumpadas = Dumpada::with('frenteTrabajo')
            ->where('certificado', $numeroCertificado)
            ->orderBy('fecha')
            ->orderBy('numero_jornada')
            ->get();

        $muestrasLibres = MuestraLibre::where('certificado', $numeroCertificado)
            ->orderBy('fecha')
            ->get();

        if ($dumpadas->isEmpty() && $muestrasLibres->isEmpty()) {
            throw new \Exception("No se encontraron muestras con el certificado: {$numeroCertificado}");
        }

        $muestrasData = array_merge(
            $this->prepararMuestras($dumpadas, $numeroCertificado),
            $this->prepararMuestrasMuestraLibre($muestrasLibres, $numeroCertificado)
        );

        $data = [
            'numeroCertificado' => $numeroCertificado,
            'fechaIngreso'      => $this->calcularFechaIngreso($dumpadas),
            'fechaEgreso'       => $this->calcularFechaEgreso($dumpadas),
            'muestras'          => $muestrasData,
            'laboratorio'       => $this->getDatosLaboratorio($para),
            'watermarkTexto'    => $watermarkTexto,
        ];

        $pdf = Pdf::loadView('pdf.certificado', $data);
        $pdf->setPaper('letter', 'portrait');

        return $pdf;
    }

    /**
     * Asignar número de certificado a las dumpadas
     * Guarda en el campo 'certificado' (único campo)
     */
    private function asignarCertificadoADumpadas($dumpadas, $numeroCertificado, ?Carbon $ahora = null)
    {
        $ahora = $ahora ?? Carbon::now();

        foreach ($dumpadas as $dumpada) {
            $dumpada->update([
                'certificado' => $numeroCertificado,
                'fecha_certificado_pdf' => $dumpada->fecha_certificado_pdf ?? $ahora,
            ]);
        }
    }

    /**
     * Preparar los datos de las muestras para el certificado
     */
    private function prepararMuestras($dumpadas, $numeroCertificado)
    {
        return $dumpadas->map(function ($dumpada) use ($numeroCertificado) {
            return [
                'codigo' => $dumpada->codigo_completo ?? $dumpada->generarCodigoCompleto(),
                'fecha' => $dumpada->fecha ? Carbon::parse($dumpada->fecha)->format('d.m.Y') : '',
                'cu_total' => $dumpada->ley !== null ? number_format($dumpada->ley, 2, ',', '.') : '-',
                'cu_soluble' => $dumpada->cu_soluble !== null ? number_format($dumpada->cu_soluble, 2, ',', '.') : '-',
                'cu_insoluble' => $dumpada->cu_insoluble !== null ? number_format($dumpada->cu_insoluble, 2, ',', '.') : '-',
                'certificado_lab' => $numeroCertificado,
            ];
        })->toArray();
    }

    /**
     * Datos fijos del laboratorio CIMAEF
     */
    private function getDatosLaboratorio(?string $para = null)
    {
        return [
            'nombre' => 'CIMAEF',
            'titulo' => 'CENTRO INTEGRAL PARA LA MINERIA',
            'origen' => 'Laboratorio Cimaef 3H Copper',
            'destino' => $para ?? 'Mra 3H Copper Spa',
            'departamento' => 'Operaciones',
            'estado' => 'Mineral',
            'analisis' => 'Cobre',
            'responsable' => [
                'nombre' => 'Manuel Bórquez Astudillo',
                'cargo' => 'Ingeniero Químico Metalurgista',
                'titulo' => 'Jefe Laboratorio',
            ],
            'direccion' => 'Calle San Carlos N° 10',
            'ciudad' => 'Catemu, V Región',
            'contacto' => '09-62102367',
            'email' => 'cimaef@cimaef.cl',
        ];
    }

    /**
     * Generar certificado PDF para muestras específicas (MuestraLibre)
     */
    public function generarCertificadoMuestraLibre(array $muestraLibreIds, ?string $numeroCertificado = null, bool $guardarNumero = true)
    {
        $muestras = MuestraLibre::whereIn('id', $muestraLibreIds)
            ->whereNotNull('ley')
            ->whereNotNull('cu_soluble')
            ->whereNotNull('cu_insoluble')
            ->orderBy('fecha')
            ->get();

        if ($muestras->isEmpty()) {
            throw new \Exception('No se encontraron muestras específicas con análisis completo (ley, cu_soluble, cu_insoluble)');
        }

        if (!$numeroCertificado) {
            $numeroCertificado = $this->generarNumeroCertificado();
        }

        if ($guardarNumero) {
            foreach ($muestras as $m) {
                $m->update(['certificado' => $numeroCertificado]);
            }
        }

        $data = [
            'numeroCertificado' => $numeroCertificado,
            'fechaIngreso'      => Carbon::now()->format('d M. Y'),
            'fechaEgreso'       => Carbon::now()->format('d M. Y'),
            'muestras'          => $this->prepararMuestrasMuestraLibre($muestras, $numeroCertificado),
            'laboratorio'       => $this->getDatosLaboratorio(),
        ];

        $pdf = Pdf::loadView('pdf.certificado', $data);
        $pdf->setPaper('letter', 'portrait');
        return $pdf;
    }

    /**
     * Regenerar certificado PDF de muestras específicas por número
     */
    public function regenerarCertificadoMuestraLibre(string $numeroCertificado)
    {
        $muestras = MuestraLibre::where('certificado', $numeroCertificado)
            ->orderBy('fecha')
            ->get();

        if ($muestras->isEmpty()) {
            throw new \Exception("No se encontraron muestras específicas con el certificado: {$numeroCertificado}");
        }

        $data = [
            'numeroCertificado' => $numeroCertificado,
            'fechaIngreso'      => Carbon::now()->format('d M. Y'),
            'fechaEgreso'       => Carbon::now()->format('d M. Y'),
            'muestras'          => $this->prepararMuestrasMuestraLibre($muestras, $numeroCertificado),
            'laboratorio'       => $this->getDatosLaboratorio(),
        ];

        $pdf = Pdf::loadView('pdf.certificado', $data);
        $pdf->setPaper('letter', 'portrait');
        return $pdf;
    }

    /**
     * Preparar muestras específicas para el PDF
     */
    private function prepararMuestrasMuestraLibre($muestras, $numeroCertificado)
    {
        return $muestras->map(function ($m) use ($numeroCertificado) {
            return [
                'codigo'         => $m->codigo,
                'fecha'          => $m->fecha ? Carbon::parse($m->fecha)->format('d.m.Y') : '',
                'cu_total'       => $m->ley !== null ? number_format($m->ley, 2, ',', '.') : '-',
                'cu_soluble'     => $m->cu_soluble !== null ? number_format($m->cu_soluble, 2, ',', '.') : '-',
                'cu_insoluble'   => $m->cu_insoluble !== null ? number_format($m->cu_insoluble, 2, ',', '.') : '-',
                'certificado_lab' => $numeroCertificado,
            ];
        })->toArray();
    }

    /**
     * Generar número de certificado único.
     * Formato: año-número secuencial (ej: 2026-00001).
     * Considera tanto dumpadas como muestras específicas para no repetir números.
     */
    /**
     * Genera el próximo número de certificado como correlativo plano (ej: 289002),
     * continuando la numeración histórica importada desde Excel — sin prefijo de año.
     */
    private function generarNumeroCertificado()
    {
        $ultimoDumpada = Dumpada::whereNotNull('certificado')
            ->where('certificado', 'REGEXP', '^[0-9]+$')
            ->orderByRaw('CAST(certificado AS UNSIGNED) DESC')
            ->value('certificado');

        $ultimoMuestra = MuestraLibre::whereNotNull('certificado')
            ->where('certificado', 'REGEXP', '^[0-9]+$')
            ->orderByRaw('CAST(certificado AS UNSIGNED) DESC')
            ->value('certificado');

        $numDumpada = $ultimoDumpada ? (int) $ultimoDumpada : 0;
        $numMuestra = $ultimoMuestra ? (int) $ultimoMuestra : 0;
        $numero     = max($numDumpada, $numMuestra) + 1;

        return (string) $numero;
    }

    /**
     * Obtener lista de certificados generados (con filtros, sin paginar todavía;
     * la paginación la hace el controller sobre la colección ya filtrada)
     *
     * @param int|null $idFaena Filtrar por faena
     * @param string|null $search Búsqueda parcial por número de certificado
     * @param string|null $fechaInicio Fecha de generación desde (Y-m-d)
     * @param string|null $fechaFin Fecha de generación hasta (Y-m-d)
     * @param int|null $muestrasMin Cantidad mínima de muestras incluidas
     * @param int|null $muestrasMax Cantidad máxima de muestras incluidas
     * @return \Illuminate\Support\Collection
     */
    public function getCertificadosGenerados(
        ?int $idFaena = null,
        ?string $search = null,
        ?string $fechaInicio = null,
        ?string $fechaFin = null,
        ?int $muestrasMin = null,
        ?int $muestrasMax = null
    ) {
        // fecha_certificado_pdf es la fecha real de generación (desde el fix de fechas del certificado);
        // updated_at queda como respaldo para certificados históricos que no la tienen guardada.
        $queryDumpadas = Dumpada::whereNotNull('certificado')
            ->select('certificado')
            ->selectRaw('COUNT(*) as total_muestras')
            ->selectRaw('MIN(COALESCE(fecha_certificado_pdf, updated_at)) as fecha_generacion')
            ->groupBy('certificado');

        if ($idFaena) {
            $queryDumpadas->where('id_faena', $idFaena);
        }
        if ($search) {
            $queryDumpadas->where('certificado', 'like', "%{$search}%");
        }

        $queryMuestrasLibres = MuestraLibre::whereNotNull('certificado')
            ->select('certificado')
            ->selectRaw('COUNT(*) as total_muestras')
            ->selectRaw('MIN(updated_at) as fecha_generacion')
            ->groupBy('certificado');

        if ($idFaena) {
            $queryMuestrasLibres->where('id_faena', $idFaena);
        }
        if ($search) {
            $queryMuestrasLibres->where('certificado', 'like', "%{$search}%");
        }

        // Se combinan ambas fuentes en PHP (no UNION en SQL) porque un mismo número de
        // certificado puede tener muestras repartidas entre dumpadas y muestras libres.
        $combinado = [];
        foreach ($queryDumpadas->get()->concat($queryMuestrasLibres->get()) as $fila) {
            $numero = $fila->certificado;
            if (!isset($combinado[$numero])) {
                $combinado[$numero] = ['certificado' => $numero, 'total_muestras' => 0, 'fecha_generacion' => $fila->fecha_generacion];
            }
            $combinado[$numero]['total_muestras'] += $fila->total_muestras;
            if ($fila->fecha_generacion < $combinado[$numero]['fecha_generacion']) {
                $combinado[$numero]['fecha_generacion'] = $fila->fecha_generacion;
            }
        }

        $resultado = collect(array_values($combinado));

        // Filtros que dependen de valores ya agregados (fecha mínima, conteo combinado)
        // se aplican sobre la colección en memoria, después de combinar ambas fuentes.
        if ($fechaInicio) {
            $desde = Carbon::parse($fechaInicio)->startOfDay();
            $resultado = $resultado->filter(fn($c) => $c['fecha_generacion'] && Carbon::parse($c['fecha_generacion'])->gte($desde));
        }
        if ($fechaFin) {
            $hasta = Carbon::parse($fechaFin)->endOfDay();
            $resultado = $resultado->filter(fn($c) => $c['fecha_generacion'] && Carbon::parse($c['fecha_generacion'])->lte($hasta));
        }
        if ($muestrasMin !== null) {
            $resultado = $resultado->filter(fn($c) => $c['total_muestras'] >= $muestrasMin);
        }
        if ($muestrasMax !== null) {
            $resultado = $resultado->filter(fn($c) => $c['total_muestras'] <= $muestrasMax);
        }

        return $resultado->sortByDesc('certificado')->values();
    }

    /**
     * Obtener dumpadas disponibles para certificado
     * (con leyes completas pero SIN certificado asignado)
     *
     * @param int|null $idFaena Filtrar por faena
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getDumpadasDisponibles(?int $idFaena = null)
    {
        $query = Dumpada::with('frenteTrabajo')
            ->whereNotNull('ley')
            ->whereNotNull('cu_soluble')
            ->whereNotNull('cu_insoluble')
            ->whereNull('certificado') // Solo las que NO tienen certificado
            ->orderBy('fecha', 'desc')
            ->orderBy('numero_jornada', 'desc');

        if ($idFaena) {
            $query->where('id_faena', $idFaena);
        }

        return $query->get();
    }
}
