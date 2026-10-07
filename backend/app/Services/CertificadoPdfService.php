<?php

namespace App\Services;

use App\Models\Dispatch\Dumpada;
use App\Models\Dispatch\MuestraLibre;
use App\Models\Laboratorio\Certificado;
use App\Support\OrdenMuestras;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

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
    public function generarCertificado(array $dumpadaIds, ?string $numeroCertificado = null, bool $guardarNumero = true, array $muestraLibreIds = [], ?string $para = null, ?string $generadoPor = null)
    {
        $dumpadas = empty($dumpadaIds) ? collect() : OrdenMuestras::ordenarDumpadas(
            Dumpada::with('frenteTrabajo')
                ->whereIn('id', $dumpadaIds)
                ->whereNotNull('ley')
                ->whereNotNull('cu_soluble')
                ->whereNotNull('cu_insoluble')
                ->get()
        );

        $muestrasLibres = empty($muestraLibreIds) ? collect() : OrdenMuestras::ordenarMuestrasLibres(
            MuestraLibre::with('frenteTrabajo')
                ->whereIn('id', $muestraLibreIds)
                ->whereNotNull('ley')
                ->whereNotNull('cu_soluble')
                ->whereNotNull('cu_insoluble')
                ->get()
        );

        if ($dumpadas->isEmpty() && $muestrasLibres->isEmpty()) {
            throw new \Exception('No se encontraron muestras con análisis completo (ley, cu_soluble, cu_insoluble)');
        }

        if (!$numeroCertificado) {
            $numeroCertificado = $this->generarNumeroCertificado();
        }

        if ($guardarNumero) {
            $ahora = Carbon::now();
            $destino = $para !== null && trim($para) !== '' ? trim($para) : null;
            DB::transaction(function () use ($dumpadas, $muestrasLibres, $numeroCertificado, $ahora, $generadoPor, $destino) {
                $this->asignarCertificadoADumpadas($dumpadas, $numeroCertificado, $ahora);
                foreach ($muestrasLibres as $m) {
                    $m->update(['certificado' => $numeroCertificado]);
                }
                $cert = Certificado::firstOrCreate(
                    ['numero_certificado' => $numeroCertificado],
                    ['estado' => Certificado::ESTADO_PENDIENTE, 'generado_por' => $generadoPor, 'destino' => $destino]
                );
                // Si la fila ya existía sin destino (p.ej. certificado rechazado que
                // se está re-generando), guardarlo ahora.
                if ($destino !== null && $cert->destino !== $destino) {
                    $cert->update(['destino' => $destino]);
                }
            });
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
        // Si no viene un "Para" explícito, usar el que quedó guardado en el
        // certificado al generarlo. Antes esto se perdía y siempre volvía al default.
        if ($para === null || trim($para) === '') {
            $para = Certificado::where('numero_certificado', $numeroCertificado)->value('destino');
        }

        $dumpadas = OrdenMuestras::ordenarDumpadas(
            Dumpada::with('frenteTrabajo')
                ->where('certificado', $numeroCertificado)
                ->get()
        );

        $muestrasLibres = OrdenMuestras::ordenarMuestrasLibres(
            MuestraLibre::with('frenteTrabajo')
                ->where('certificado', $numeroCertificado)
                ->get()
        );

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
        $muestras = OrdenMuestras::ordenarMuestrasLibres(
            MuestraLibre::with('frenteTrabajo')
                ->whereIn('id', $muestraLibreIds)
                ->whereNotNull('ley')
                ->whereNotNull('cu_soluble')
                ->whereNotNull('cu_insoluble')
                ->get()
        );

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
        $muestras = OrdenMuestras::ordenarMuestrasLibres(
            MuestraLibre::with('frenteTrabajo')
                ->where('certificado', $numeroCertificado)
                ->get()
        );

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
            $codigo = $m->nombre ? "{$m->codigo}-{$m->nombre}" : $m->codigo;
            // El frente es opcional en la muestra específica: si lo tiene, va después del nombre
            $frente = $m->frenteTrabajo?->codigo_completo;

            return [
                'codigo'         => $frente ? "{$codigo} {$frente}" : $codigo,
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
     *
     * Se calcula sobre el MAX de 3 fuentes, no solo de las dumpadas: un certificado
     * rechazado libera sus dumpadas (vuelven a certificado=NULL para poder corregirlas),
     * así que mirar solo dumpadas/muestras podía recalcular un número ya usado por un
     * certificado rechazado — `Certificado::firstOrCreate` encontraba esa fila vieja y
     * la dejaba en estado Rechazado, dejando el certificado nuevo sin poder aprobarse
     * nunca. Incluir la tabla `certificados` evita reciclar números ya usados.
     */
    public function generarNumeroCertificado()
    {
        $ultimoDumpada = Dumpada::whereNotNull('certificado')
            ->where('certificado', 'REGEXP', '^[0-9]+$')
            ->orderByRaw('CAST(certificado AS UNSIGNED) DESC')
            ->value('certificado');

        $ultimoMuestra = MuestraLibre::whereNotNull('certificado')
            ->where('certificado', 'REGEXP', '^[0-9]+$')
            ->orderByRaw('CAST(certificado AS UNSIGNED) DESC')
            ->value('certificado');

        $ultimoCertificado = Certificado::where('numero_certificado', 'REGEXP', '^[0-9]+$')
            ->orderByRaw('CAST(numero_certificado AS UNSIGNED) DESC')
            ->value('numero_certificado');

        $numDumpada     = $ultimoDumpada ? (int) $ultimoDumpada : 0;
        $numMuestra     = $ultimoMuestra ? (int) $ultimoMuestra : 0;
        $numCertificado = $ultimoCertificado ? (int) $ultimoCertificado : 0;
        $numero         = max($numDumpada, $numMuestra, $numCertificado) + 1;

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
        ?int $muestrasMax = null,
        bool $soloAprobados = false
    ) {
        // Si hay término de búsqueda, primero se determina QUÉ certificados calzan
        // (por su propio número, o porque alguna dumpada/muestra libre incluida
        // coincide en número de dumpada, acopio o frente de trabajo). Así el listado
        // sigue mostrando el certificado completo (todas sus muestras), no solo la
        // fila que hizo match.
        $numerosCoincidentes = null;
        if ($search) {
            $porCertificado = Dumpada::whereNotNull('certificado')
                ->where('certificado', 'like', "%{$search}%")
                ->pluck('certificado');

            $porDumpada = Dumpada::whereNotNull('certificado')
                ->where(function ($q) use ($search) {
                    $q->where('numero_dumpada', 'like', "%{$search}%")
                      ->orWhere('acopios', 'like', "%{$search}%")
                      ->orWhereHas('frenteTrabajo', fn($fq) => $fq->where('codigo_completo', 'like', "%{$search}%"));
                })
                ->pluck('certificado');

            $porMuestraLibre = MuestraLibre::whereNotNull('certificado')
                ->where(function ($q) use ($search) {
                    $q->where('certificado', 'like', "%{$search}%")
                      ->orWhere('nombre', 'like', "%{$search}%")
                      ->orWhereHas('frenteTrabajo', fn($fq) => $fq->where('codigo_completo', 'like', "%{$search}%"));
                })
                ->pluck('certificado');

            $numerosCoincidentes = $porCertificado->concat($porDumpada)->concat($porMuestraLibre)->unique()->values();
        }

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
        if ($numerosCoincidentes !== null) {
            $queryDumpadas->whereIn('certificado', $numerosCoincidentes);
        }

        $queryMuestrasLibres = MuestraLibre::whereNotNull('certificado')
            ->select('certificado')
            ->selectRaw('COUNT(*) as total_muestras')
            ->selectRaw('MIN(updated_at) as fecha_generacion')
            ->groupBy('certificado');

        if ($idFaena) {
            $queryMuestrasLibres->where('id_faena', $idFaena);
        }
        if ($numerosCoincidentes !== null) {
            $queryMuestrasLibres->whereIn('certificado', $numerosCoincidentes);
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

        // Mergear estado de aprobación. Un número sin fila en `certificados` es un
        // certificado histórico (previo a este control) y se considera Aprobado.
        $numeros = $resultado->pluck('certificado')->all();
        $estados = Certificado::mapaParaNumeros($numeros);

        $resultado = $resultado->map(function ($c) use ($estados) {
            $cert = $estados->get($c['certificado']);
            $c['estado_aprobacion'] = $cert->estado ?? Certificado::ESTADO_APROBADO;
            $c['motivo_rechazo'] = $cert->motivo_rechazo ?? null;
            $c['aprobado_por'] = $cert->aprobado_por ?? null;
            $c['fecha_aprobacion'] = $cert->fecha_aprobacion ?? null;
            $c['destino'] = $cert->destino ?? null;
            return $c;
        });

        if ($soloAprobados) {
            $resultado = $resultado->filter(fn($c) => $c['estado_aprobacion'] === Certificado::ESTADO_APROBADO);
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
