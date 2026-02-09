import React, { useState, useEffect } from 'react';
import {
  HiChartBar,
  HiTruck,
  HiBriefcase,
  HiClipboardDocumentList,
  HiCube,
  HiScale,
  HiCheckCircle,
  HiClock
} from 'react-icons/hi2';
import {  HiOfficeBuilding } from 'react-icons/hi';
import Card from '../../../shared/components/atoms/Card';
import Badge from '../../../shared/components/atoms/Badge';
import Loader from '../../../shared/components/atoms/Loader';
import laboratorioService from '../../../services/laboratorio';
import useToast from '../../../hooks/useToast';

const LotesDashboard = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [plantas, setPlantas] = useState([]);
  const [empresas, setEmpresas] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [lotesRes, plantasRes, empresasRes] = await Promise.all([
        laboratorioService.getLotes(),
        laboratorioService.getPlantas({ activas: true }),
        laboratorioService.getEmpresas({ activas: true })
      ]);

      const lotesData = lotesRes.data || lotesRes || [];
      setLotes(lotesData);
      setPlantas(plantasRes || []);
      setEmpresas(empresasRes || []);

      // Calcular estadísticas
      calcularEstadisticas(lotesData);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  const calcularEstadisticas = (lotesData) => {
    // Estadísticas generales
    const totalLotes = lotesData.length;
    const lotesAbiertos = lotesData.filter(l => l.estado === 'Abierto').length;
    const lotesCompletados = lotesData.filter(l => l.estado === 'Completado').length;

    let totalCamionadas = 0;
    let totalPesoDespachado = 0;
    let totalMezclas = new Set();

    lotesData.forEach(lote => {
      const numCamionadas = lote.camionadas?.length || 0;
      totalCamionadas += numCamionadas;

      // Calcular peso
      if (lote.camionadas) {
        lote.camionadas.forEach(c => {
          totalPesoDespachado += parseFloat(c.peso || 0);
          if (c.mezcla_id) {
            totalMezclas.add(c.mezcla_id);
          }
        });
      }
    });

    // Estadísticas por planta
    const estatPlanta = {};
    lotesData.forEach(lote => {
      const plantaId = lote.planta_id;
      if (!estatPlanta[plantaId]) {
        estatPlanta[plantaId] = {
          nombre: lote.planta?.nombre || 'Sin planta',
          codigo: lote.planta?.codigo || '-',
          lotes: 0,
          camionadas: 0,
          peso: 0
        };
      }
      estatPlanta[plantaId].lotes += 1;
      const numCam = lote.camionadas?.length || 0;
      estatPlanta[plantaId].camionadas += numCam;
      if (lote.camionadas) {
        lote.camionadas.forEach(c => {
          estatPlanta[plantaId].peso += parseFloat(c.peso || 0);
        });
      }
    });

    // Estadísticas por empresa
    const estatEmpresa = {};
    lotesData.forEach(lote => {
      const empresaId = lote.empresa_id;
      if (!estatEmpresa[empresaId]) {
        estatEmpresa[empresaId] = {
          nombre: lote.empresa?.nombre || 'Sin empresa',
          codigo: lote.empresa?.codigo || '-',
          lotes: 0,
          camionadas: 0,
          peso: 0
        };
      }
      estatEmpresa[empresaId].lotes += 1;
      const numCam = lote.camionadas?.length || 0;
      estatEmpresa[empresaId].camionadas += numCam;
      if (lote.camionadas) {
        lote.camionadas.forEach(c => {
          estatEmpresa[empresaId].peso += parseFloat(c.peso || 0);
        });
      }
    });

    setEstadisticas({
      totalLotes,
      lotesAbiertos,
      lotesCompletados,
      totalCamionadas,
      totalPesoDespachado,
      totalMezclas: totalMezclas.size,
      porPlanta: Object.values(estatPlanta),
      porEmpresa: Object.values(estatEmpresa)
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader size="lg" />
      </div>
    );
  }

  if (!estadisticas) {
    return (
      <Card>
        <div className="text-center py-12">
          <HiChartBar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No hay datos para mostrar</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-l-4 border-indigo-500">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
            <HiChartBar className="w-7 h-7 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Dashboard de Lotes</h2>
            <p className="text-gray-600">Estadísticas y métricas del sistema de despacho</p>
          </div>
        </div>
      </Card>

      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Lotes */}
        <Card className="border-l-4 border-indigo-400 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Lotes</p>
              <p className="text-4xl font-bold text-indigo-600">{estadisticas.totalLotes}</p>
              <div className="mt-2 flex gap-2 text-xs">
                <span className="text-green-600 font-semibold">
                  <HiClock className="inline" /> {estadisticas.lotesAbiertos} Abiertos
                </span>
                <span className="text-gray-600">|</span>
                <span className="text-blue-600 font-semibold">
                  <HiCheckCircle className="inline" /> {estadisticas.lotesCompletados} Completados
                </span>
              </div>
            </div>
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
              <HiClipboardDocumentList className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
        </Card>

        {/* Total Camionadas */}
        <Card className="border-l-4 border-orange-400 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Camionadas</p>
              <p className="text-4xl font-bold text-orange-600">{estadisticas.totalCamionadas}</p>
              <p className="text-xs text-gray-500 mt-2">Despachos registrados</p>
            </div>
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
              <HiTruck className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </Card>

        {/* Total Peso Despachado */}
        <Card className="border-l-4 border-green-400 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Peso Total Despachado</p>
              <p className="text-4xl font-bold text-green-600">
                {estadisticas.totalPesoDespachado.toFixed(1)}
              </p>
              <p className="text-xs text-gray-500 mt-2">Toneladas</p>
            </div>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <HiScale className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </Card>

        {/* Total Mezclas Utilizadas */}
        <Card className="border-l-4 border-purple-400 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Mezclas Utilizadas</p>
              <p className="text-4xl font-bold text-purple-600">{estadisticas.totalMezclas}</p>
              <p className="text-xs text-gray-500 mt-2">Diferentes mezclas</p>
            </div>
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
              <HiCube className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Estadísticas por Planta y Empresa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por Planta */}
        <Card className="border-l-4 border-blue-400">
          <div className="flex items-center gap-2 mb-4">
            <HiOfficeBuilding className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-900">Despachos por Planta</h3>
          </div>

          {estadisticas.porPlanta.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay datos</p>
          ) : (
            <div className="space-y-4">
              {estadisticas.porPlanta.map((planta, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-bold text-blue-900">{planta.nombre}</h4>
                      <Badge color="blue" size="sm">
                        {planta.codigo}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-700">{planta.lotes}</p>
                      <p className="text-xs text-gray-600">Lotes</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-white rounded p-2 border border-blue-200">
                      <p className="text-xs text-gray-600">Camionadas</p>
                      <p className="text-lg font-bold text-orange-600">{planta.camionadas}</p>
                    </div>
                    <div className="bg-white rounded p-2 border border-blue-200">
                      <p className="text-xs text-gray-600">Peso Total</p>
                      <p className="text-lg font-bold text-green-600">{planta.peso.toFixed(1)} t</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Por Empresa */}
        <Card className="border-l-4 border-purple-400">
          <div className="flex items-center gap-2 mb-4">
            <HiBriefcase className="w-6 h-6 text-purple-600" />
            <h3 className="text-xl font-bold text-gray-900">Despachos por Empresa</h3>
          </div>

          {estadisticas.porEmpresa.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay datos</p>
          ) : (
            <div className="space-y-4">
              {estadisticas.porEmpresa.map((empresa, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-bold text-purple-900">{empresa.nombre}</h4>
                      <Badge color="purple" size="sm">
                        {empresa.codigo}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-purple-700">{empresa.lotes}</p>
                      <p className="text-xs text-gray-600">Lotes</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-white rounded p-2 border border-purple-200">
                      <p className="text-xs text-gray-600">Camionadas</p>
                      <p className="text-lg font-bold text-orange-600">{empresa.camionadas}</p>
                    </div>
                    <div className="bg-white rounded p-2 border border-purple-200">
                      <p className="text-xs text-gray-600">Peso Total</p>
                      <p className="text-lg font-bold text-green-600">{empresa.peso.toFixed(1)} t</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Promedios y Métricas Adicionales */}
      <Card className="border-l-4 border-yellow-400">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Métricas Adicionales</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Promedio Camionadas/Lote</p>
            <p className="text-3xl font-bold text-yellow-700">
              {estadisticas.totalLotes > 0
                ? (estadisticas.totalCamionadas / estadisticas.totalLotes).toFixed(1)
                : '0.0'}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Promedio Peso/Camionada</p>
            <p className="text-3xl font-bold text-green-700">
              {estadisticas.totalCamionadas > 0
                ? (estadisticas.totalPesoDespachado / estadisticas.totalCamionadas).toFixed(1)
                : '0.0'}{' '}
              t
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Promedio Peso/Lote</p>
            <p className="text-3xl font-bold text-blue-700">
              {estadisticas.totalLotes > 0
                ? (estadisticas.totalPesoDespachado / estadisticas.totalLotes).toFixed(1)
                : '0.0'}{' '}
              t
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default LotesDashboard;
