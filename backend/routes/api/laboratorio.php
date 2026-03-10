<?php

use App\Http\Controllers\Api\Laboratorio\LaboratorioController;
use App\Http\Controllers\Api\Laboratorio\MuestreoController;
use App\Http\Controllers\Api\Laboratorio\EmpresaController;
use App\Http\Controllers\Api\Laboratorio\PlantaController;
use App\Http\Controllers\Api\Laboratorio\CertificadoController;
use App\Http\Controllers\Api\Dispatch\MuestraLibreController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rutas de Laboratorio
| Prefijo: /api/laboratorio
|--------------------------------------------------------------------------
*/

// ========================================
// MÓDULO: MUESTREO
// ========================================
// Listar dumpadas pendientes de muestreo (sin leyes)
Route::get('/muestreo', [MuestreoController::class, 'index']);

// Estadísticas de muestreo
Route::get('/muestreo/estadisticas', [MuestreoController::class, 'estadisticas']);

// Actualizar estado de una dumpada (muestreo)
Route::put('/muestreo/{id}/estado', [MuestreoController::class, 'actualizarEstado']);

// Actualizar estado de múltiples dumpadas (muestreo)
Route::post('/muestreo/actualizar-estado-multiple', [MuestreoController::class, 'actualizarEstadoMultiple']);

// ========================================
// MÓDULO: ANÁLISIS DE MUESTRAS
// ========================================
// Listar dumpadas pendientes de análisis
Route::get('/dumpadas', [LaboratorioController::class, 'index']);

// Completar análisis individual
Route::put('/dumpadas/{id}/completar', [LaboratorioController::class, 'completarAnalisis']);

// Completar múltiples análisis
Route::post('/dumpadas/completar-multiples', [LaboratorioController::class, 'completarMultiplesAnalisis']);

// Estadísticas del laboratorio
Route::get('/estadisticas', [LaboratorioController::class, 'estadisticas']);

// Historial de análisis completados (para reportes/PDF)
Route::get('/historial', [LaboratorioController::class, 'historial']);

// Editar análisis de una dumpada del historial
Route::put('/historial/{id}', [LaboratorioController::class, 'editarAnalisis']);

// Empresas
Route::get('/empresas', [EmpresaController::class, 'index']);
Route::post('/empresas', [EmpresaController::class, 'store']);
Route::get('/empresas/{id}', [EmpresaController::class, 'show']);
Route::put('/empresas/{id}', [EmpresaController::class, 'update']);
Route::delete('/empresas/{id}', [EmpresaController::class, 'destroy']);

// Plantas
Route::get('/plantas', [PlantaController::class, 'index']);
Route::post('/plantas', [PlantaController::class, 'store']);
Route::get('/plantas/{id}', [PlantaController::class, 'show']);
Route::put('/plantas/{id}', [PlantaController::class, 'update']);
Route::delete('/plantas/{id}', [PlantaController::class, 'destroy']);

// ========================================
// MÓDULO: CERTIFICADOS PDF
// ========================================
// Listar dumpadas disponibles para certificado (con análisis completo)
Route::get('/certificados/dumpadas', [CertificadoController::class, 'dumpadasDisponibles']);

// Validar selección antes de generar (detecta certificados existentes)
Route::post('/certificados/validar', [CertificadoController::class, 'validarSeleccion']);

// Preview de datos del certificado (sin generar PDF)
Route::post('/certificados/preview', [CertificadoController::class, 'preview']);

// Previsualizar certificado PDF (stream en navegador)
Route::post('/certificados/previsualizar', [CertificadoController::class, 'previsualizar']);

// Generar y descargar certificado PDF
Route::post('/certificados/generar', [CertificadoController::class, 'generar']);

// Listar certificados PDF generados
Route::get('/certificados/generados', [CertificadoController::class, 'certificadosGenerados']);

// Obtener dumpadas de un certificado específico
Route::get('/certificados/{numeroCertificado}/dumpadas', [CertificadoController::class, 'dumpadasPorCertificado']);

// Regenerar certificado existente
Route::get('/certificados/{numeroCertificado}/regenerar', [CertificadoController::class, 'regenerar']);

// ========================================
// MÓDULO: MUESTRAS LIBRES
// ========================================
// Completar análisis de una muestra libre
Route::put('/muestras-libres/{id}/completar', [MuestraLibreController::class, 'completarAnalisis']);

// Editar análisis de una muestra libre ya completada
Route::put('/muestras-libres/{id}/editar', [MuestraLibreController::class, 'editarAnalisis']);

