<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Certificado N° {{ $numeroCertificado }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            color: #333;
            line-height: 1.4;
        }

        .container {
            max-width: 700px;
            margin: 0 auto;
            padding: 20px 30px;
        }

        /* Header / Logo */
        .header {
            text-align: center;
            margin-bottom: 15px;
            border-bottom: 4px solid #E65100;
            padding-bottom: 15px;
        }

        .logo-img {
            max-height: 80px;
            margin-bottom: 5px;
        }

        .logo-text {
            font-size: 52px;
            font-weight: bold;
            color: #E65100;
            letter-spacing: 4px;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
        }

        .logo-text .highlight {
            color: #333;
        }

        .subtitle {
            font-size: 16px;
            font-weight: bold;
            color: #E65100;
            letter-spacing: 2px;
            margin-top: 8px;
            text-transform: uppercase;
        }

        /* Certificado Number */
        .certificado-numero {
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            margin: 15px 0;
        }

        /* Info Section */
        .info-section {
            display: table;
            width: 100%;
            margin-bottom: 15px;
        }

        .info-left {
            display: table-cell;
            width: 45%;
            vertical-align: top;
            padding-right: 15px;
            border: 1px solid #ccc;
            padding: 10px;
        }

        .info-right {
            display: table-cell;
            width: 55%;
            vertical-align: top;
            padding-left: 15px;
        }

        .info-left p,
        .info-right p {
            margin-bottom: 5px;
        }

        .info-label {
            font-weight: bold;
        }

        .informe-box {
            border: 1px solid #ccc;
            padding: 8px 12px;
            margin-bottom: 10px;
        }

        /* Disclaimer */
        .disclaimer {
            font-size: 9px;
            font-style: italic;
            margin: 15px 0;
            color: #666;
        }

        /* Table */
        .table-container {
            margin: 20px 0;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        table th,
        table td {
            border: 1px solid #333;
            padding: 8px 10px;
            text-align: center;
        }

        table th {
            background-color: #f5f5f5;
            font-weight: bold;
            font-size: 10px;
        }

        table th.muestras-col {
            text-align: left;
            width: 45%;
        }

        table td.muestras-col {
            text-align: left;
        }

        table td {
            font-size: 11px;
        }

        /* Diagonal header cell */
        .diagonal-cell {
            position: relative;
            width: 45%;
        }

        .diagonal-cell .top-right {
            position: absolute;
            top: 2px;
            right: 5px;
            font-size: 9px;
        }

        .diagonal-cell .bottom-left {
            position: absolute;
            bottom: 2px;
            left: 5px;
            font-size: 9px;
        }

        /* Footer / Signature */
        .footer {
            margin-top: 40px;
            text-align: center;
        }

        .signature-line {
            width: 200px;
            border-top: 1px solid #333;
            margin: 0 auto 5px;
            padding-top: 5px;
        }

        .signature-name {
            font-weight: bold;
            font-size: 12px;
            text-decoration: underline;
        }

        .signature-title {
            font-size: 10px;
            font-style: italic;
        }

        .contact-info {
            margin-top: 20px;
            font-size: 9px;
            color: #666;
        }

        .contact-info p {
            margin: 2px 0;
        }

        /* Print styles */
        @media print {
            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
        }

        /* Page break for multiple certificates */
        .page-break {
            page-break-after: always;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            {{-- Si tienes logo, descomenta esta línea y pon la ruta del logo --}}
            {{-- <img src="{{ public_path('images/logo-cimaef.png') }}" alt="CIMAEF" class="logo-img"> --}}

            <div class="logo-text">
                C<span class="highlight">I</span>MA<span class="highlight">E</span>F
            </div>
            <div class="subtitle">{{ $laboratorio['titulo'] }}</div>
        </div>

        <!-- Certificado Number -->
        <div class="certificado-numero">
            CERTIFICADO N°{{ $numeroCertificado }}
        </div>

        <!-- Info Section -->
        <div class="info-section">
            <div class="info-left">
                <p><span class="info-label">Muestra:</span> {{ $numeroCertificado }}</p>
                <p><span class="info-label">Estado:</span> {{ $laboratorio['estado'] }}</p>
                <p><span class="info-label">Ingreso Laboratorio:</span> {{ $fechaEmision }}</p>
                <p><span class="info-label">Egreso:</span> {{ $fechaEmision }}</p>
                <p><span class="info-label">Análisis:</span> {{ $laboratorio['analisis'] }}</p>
            </div>
            <div class="info-right">
                <div class="informe-box">
                    <p><span class="info-label">Informe:</span> N°{{ $numeroCertificado }}</p>
                </div>
                <p><span class="info-label">De:</span> {{ $laboratorio['origen'] }}</p>
                <p><span class="info-label">Para:</span> {{ $laboratorio['destino'] }}</p>
                <p>{{ $laboratorio['departamento'] }}.</p>
            </div>
        </div>

        <!-- Disclaimer -->
        <div class="disclaimer">
            *Los resultados de análisis son válidos solo para las muestras proporcionadas por el cliente
        </div>

        <!-- Table -->
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th class="muestras-col" style="text-align: left;">
                            <div style="position: relative; height: 30px;">
                                <span style="position: absolute; top: 0; right: 5px; font-size: 9px;">ANALISIS</span>
                                <span style="position: absolute; bottom: 0; left: 5px; font-size: 9px;">MUESTRAS</span>
                            </div>
                        </th>
                        <th>Cu<br>Total<br>%</th>
                        <th>Cu<br>Soluble<br>%</th>
                        <th>Cu<br>Insoluble<br>%</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($muestras as $muestra)
                    <tr>
                        <td class="muestras-col">{{ $muestra['codigo'] }}</td>
                        <td>{{ $muestra['cu_total'] }}</td>
                        <td>{{ $muestra['cu_soluble'] }}</td>
                        <td>{{ $muestra['cu_insoluble'] }}</td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        </div>

        <!-- Footer / Signature -->
        <div class="footer">
            <div class="signature-line">
                <span class="signature-name">{{ $laboratorio['responsable']['nombre'] }}</span>
            </div>
            <div class="signature-title">{{ $laboratorio['responsable']['cargo'] }}</div>
            <div class="signature-title">{{ $laboratorio['responsable']['titulo'] }}</div>

            <div class="contact-info">
                <p>{{ $laboratorio['direccion'] }}</p>
                <p>{{ $laboratorio['ciudad'] }}</p>
                <p>Contacto: {{ $laboratorio['contacto'] }} / Gmail: {{ $laboratorio['email'] }}</p>
            </div>
        </div>
    </div>
</body>
</html>
