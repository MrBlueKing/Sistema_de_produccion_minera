<?php

namespace App\Services;

use App\Models\Dispatch\Dumpada;
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
    public function generarCertificado(array $dumpadaIds, ?string $numeroCertificado = null, bool $guardarNumero = true)
    {
        // Obtener las dumpadas con leyes completas (sin requerir certificado)
        $dumpadas = Dumpada::with('frenteTrabajo')
            ->whereIn('id', $dumpadaIds)
            ->whereNotNull('ley')
            ->whereNotNull('cu_soluble')
            ->whereNotNull('cu_insoluble')
            ->orderBy('fecha')
            ->orderBy('numero_jornada')
            ->get();

        if ($dumpadas->isEmpty()) {
            throw new \Exception('No se encontraron dumpadas con análisis completo (ley, cu_soluble, cu_insoluble)');
        }

        // Generar número de certificado si no se proporciona
        if (!$numeroCertificado) {
            $numeroCertificado = $this->generarNumeroCertificado();
        }

        // Guardar el número de certificado en las dumpadas
        if ($guardarNumero) {
            $this->asignarCertificadoADumpadas($dumpadas, $numeroCertificado);
        }

        // Preparar datos para la vista
        $data = [
            'numeroCertificado' => $numeroCertificado,
            'fechaEmision' => Carbon::now()->format('d M. Y'),
            'muestras' => $this->prepararMuestras($dumpadas, $numeroCertificado),
            'laboratorio' => $this->getDatosLaboratorio(),
        ];

        // Generar PDF
        $pdf = Pdf::loadView('pdf.certificado', $data);
        $pdf->setPaper('letter', 'portrait');

        return $pdf;
    }

    /**
     * Regenerar un certificado PDF existente por su número
     *
     * @param string $numeroCertificado El número del certificado a regenerar
     * @return \Barryvdh\DomPDF\PDF
     */
    public function regenerarCertificado(string $numeroCertificado)
    {
        $dumpadas = Dumpada::with('frenteTrabajo')
            ->where('certificado', $numeroCertificado)
            ->orderBy('fecha')
            ->orderBy('numero_jornada')
            ->get();

        if ($dumpadas->isEmpty()) {
            throw new \Exception("No se encontraron dumpadas con el certificado: {$numeroCertificado}");
        }

        // Preparar datos para la vista
        $data = [
            'numeroCertificado' => $numeroCertificado,
            'fechaEmision' => Carbon::now()->format('d M. Y'),
            'muestras' => $this->prepararMuestras($dumpadas, $numeroCertificado),
            'laboratorio' => $this->getDatosLaboratorio(),
        ];

        // Generar PDF
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
    private function getDatosLaboratorio()
    {
        return [
            'nombre' => 'CIMAEF',
            'titulo' => 'CENTRO INTEGRAL PARA LA MINERIA',
            'origen' => 'Laboratorio Cimaef 3H Copper',
            'destino' => 'Mra 3H Copper Spa',
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
     * Generar número de certificado único
     * Formato: año-número secuencial (ej: 2026-00001)
     */
    private function generarNumeroCertificado()
    {
        $year = Carbon::now()->year;
        $prefijo = $year . '-';

        // Buscar el último número de certificado del año actual
        $ultimoCertificado = Dumpada::where('certificado', 'like', $prefijo . '%')
            ->whereNotNull('certificado')
            ->orderByRaw('CAST(SUBSTRING(certificado, 6) AS UNSIGNED) DESC')
            ->value('certificado');

        if ($ultimoCertificado) {
            // Extraer el número después del año (ej: "2026-00001" -> 1)
            $numero = (int) substr($ultimoCertificado, 5) + 1;
        } else {
            $numero = 1;
        }

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
