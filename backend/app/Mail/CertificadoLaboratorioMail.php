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

    public function __construct(
        public readonly string $numeroCertificado,
        public readonly string $pdfBinario,
        public readonly ?string $mensaje = null
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Certificado de Laboratorio N° {$this->numeroCertificado}"
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.certificado-laboratorio',
            with: [
                'numeroCertificado' => $this->numeroCertificado,
                'mensaje' => $this->mensaje,
            ],
        );
    }

    public function attachments(): array
    {
        return [
            Attachment::fromData(fn () => $this->pdfBinario, "certificado_{$this->numeroCertificado}.pdf")
                ->withMime('application/pdf'),
        ];
    }
}
