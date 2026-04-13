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
            $this->asignarCertificadoADumpadas($dumpadas, $numeroCertificado);
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
            'fechaEmision'      => Carbon::now()->format('d M. Y'),
            'muestras'          => $muestrasData,
            'laboratorio'       => $this->getDatosLaboratorio($para),
        ];

        $pdf = Pdf::loadView('pdf.certificado', $data);
        $pdf->setPaper('letter', 'portrait');

        return $pdf;
    }

    /**
     * Regenerar un certificado existente por su número.
     * Incluye automáticamente dumpadas y muestras específicas con ese certificado.
     */
    public function regenerarCertificado(string $numeroCertificado, ?string $para = null)
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
            'fechaEmision'      => Carbon::now()->format('d M. Y'),
            'muestras'          => $muestrasData,
            'laboratorio'       => $this->getDatosLaboratorio($para),
        ];

        $pdf = Pdf::loadView('pdf.certificado', $data);
        $pdf->setPaper('letter', 'portrait');

        return $pdf;
    }

    /**
     * Asignar número de certificado a las dumpadas
     * Guarda en el campo 'certificado' (único campo)
     */
    private function asignarCertificadoADumpadas($dumpadas, $numeroCertificado)
    {
        foreach ($dumpadas as $dumpada) {
            $dumpada->update([
                'certificado' => $numeroCertificado,
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
                'cu_total' => number_format($dumpada->ley, 2, ',', '.'),
                'cu_soluble' => number_format($dumpada->cu_soluble, 2, ',', '.'),
                'cu_insoluble' => number_format($dumpada->cu_insoluble, 2, ',', '.'),
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
            'fechaEmision'      => Carbon::now()->format('d M. Y'),
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
            'fechaEmision'      => Carbon::now()->format('d M. Y'),
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
                'cu_total'       => number_format($m->ley, 2, ',', '.'),
                'cu_soluble'     => number_format($m->cu_soluble, 2, ',', '.'),
                'cu_insoluble'   => number_format($m->cu_insoluble, 2, ',', '.'),
                'certificado_lab' => $numeroCertificado,
            ];
        })->toArray();
    }

    /**
     * Generar número de certificado único.
     * Formato: año-número secuencial (ej: 2026-00001).
     * Considera tanto dumpadas como muestras específicas para no repetir números.
     */
    private function generarNumeroCertificado()
    {
        $year    = Carbon::now()->year;
        $prefijo = $year . '-';

        $ultimoDumpada = Dumpada::where('certificado', 'like', $prefijo . '%')
            ->whereNotNull('certificado')
            ->orderByRaw('CAST(SUBSTRING(certificado, 6) AS UNSIGNED) DESC')
            ->value('certificado');

        $ultimoMuestra = MuestraLibre::where('certificado', 'like', $prefijo . '%')
            ->whereNotNull('certificado')
            ->orderByRaw('CAST(SUBSTRING(certificado, 6) AS UNSIGNED) DESC')
            ->value('certificado');

        $numDumpada = $ultimoDumpada ? (int) substr($ultimoDumpada, 5) : 0;
        $numMuestra = $ultimoMuestra ? (int) substr($ultimoMuestra, 5) : 0;
        $numero     = max($numDumpada, $numMuestra) + 1;

        return $prefijo . str_pad($numero, 5, '0', STR_PAD_LEFT);
    }

    /**
     * Obtener lista de certificados generados
     *
     * @param int|null $idFaena Filtrar por faena
     * @return \Illuminate\Support\Collection
     */
    public function getCertificadosGenerados(?int $idFaena = null)
    {
        $query = Dumpada::whereNotNull('certificado')
            ->where('certificado', 'like', '____-%') // Formato: YYYY-XXXXX
            ->select('certificado')
            ->selectRaw('COUNT(*) as total_dumpadas')
            ->selectRaw('MIN(updated_at) as fecha_generacion')
            ->groupBy('certificado')
            ->orderBy('certificado', 'desc');

        if ($idFaena) {
            $query->where('id_faena', $idFaena);
        }

        return $query->get();
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
