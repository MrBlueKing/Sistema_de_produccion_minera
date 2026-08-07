<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Certificado de Laboratorio N° {{ $numeroCertificado }}</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f5; font-family: Arial, Helvetica, sans-serif; color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5; padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden;">
          <tr>
            <td style="background:#b91c1c; padding:20px 28px;">
              <span style="color:#ffffff; font-size:18px; font-weight:bold;">CIMAEF</span>
              <div style="color:#fecaca; font-size:12px;">Laboratorio Cimaef 3H Copper</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="font-size:15px; line-height:1.5; margin:0 0 16px 0;">
                Estimado(a),
              </p>
              <p style="font-size:15px; line-height:1.5; margin:0 0 16px 0;">
                Adjunto encontrará el <strong>Certificado de Laboratorio N° {{ $numeroCertificado }}</strong>.
              </p>
              @if(!empty($mensaje))
              <div style="background:#f9fafb; border-left:3px solid #b91c1c; padding:12px 16px; margin:0 0 16px 0; font-size:14px; color:#374151;">
                {{ $mensaje }}
              </div>
              @endif
              <p style="font-size:14px; line-height:1.5; margin:0; color:#6b7280;">
                Este correo fue generado automáticamente por el Sistema de Producción.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px; background:#f9fafb; border-top:1px solid #e5e7eb; font-size:12px; color:#6b7280;">
              CIMAEF · Centro Integral para la Minería · Calle San Carlos N° 10, Catemu, V Región
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
