<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CertificadoLaboratorioMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param array $certificados lista de ['numero' => string, 'binario' => string]
     *                            (uno o varios certificados en el mismo correo).
     */
    public function __construct(
        public readonly array $certificados,
        public readonly ?string $mensaje = null
    ) {
    }

    private function numeros(): array
    {
        return array_map(fn ($c) => $c['numero'], $this->certificados);
    }

    public function envelope(): Envelope
    {
        $numeros = $this->numeros();
        $subject = count($numeros) === 1
            ? "Certificado de Laboratorio N° {$numeros[0]}"
            : 'Certificados de Laboratorio N° ' . implode(', ', $numeros);

        // Copia oculta a la casilla remitente (notificaciones@m3h.cl): deja registro
        // de cada correo enviado con su PDF adjunto, para revisarlo ante un reclamo.
        $copia = config('mail.from.address');

        return new Envelope(
            subject: $subject,
            bcc: $copia ? [$copia] : [],
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.certificado-laboratorio',
            with: [
                'numeros' => $this->numeros(),
                'mensaje' => $this->mensaje,
            ],
        );
    }

    public function attachments(): array
    {
        return array_map(
            fn ($c) => Attachment::fromData(fn () => $c['binario'], "certificado_{$c['numero']}.pdf")
                ->withMime('application/pdf'),
            $this->certificados
        );
    }
}
