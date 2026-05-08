import React, { useState, useEffect, useCallback } from 'react';
import {
  HiCog,
  HiSave,
  HiRefresh,
  HiInformationCircle,
  HiCheckCircle,
  HiExclamationCircle,
  HiOfficeBuilding,
  HiTruck,
  HiPencil,
  HiTrash,
  HiX
} from 'react-icons/hi';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import useToast from '../../../hooks/useToast';
import { useFaena } from '../../../contexts/FaenaContext';
import configuracionService from '../../../services/configuracion';

const ConfiguracionView = ({ onTonelajeMaquinaUpdated, onConfigDefaultUpdated }) => {
  const toast = useToast();
  const { esUsuarioGlobal, faenaSeleccionada, faenas, faenaUsuario } = useFaena();

  // Estados
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tonelajeActual, setTonelajeActual] = useState(4.6);
  const [tonelajeGlobal, setTonelajeGlobal] = useState(4.6);
  const [tonelajeInput, setTonelajeInput] = useState('4.6');
  const [tieneConfigEspecifica, setTieneConfigEspecifica] = useState(false);

  // Estados para Capping de Ley
  const [savingCapping, setSavingCapping] = useState(false);
  const [cappingActual, setCappingActual] = useState(3);
  const [cappingGlobal, setCappingGlobal] = useState(3);
  const [cappingInput, setCappingInput] = useState('3');
  const [tieneConfigCapping, setTieneConfigCapping] = useState(false);
  const [configsCappingPorFaena, setConfigsCappingPorFaena] = useState([]);

  // Estados para Peso de Palada
  const [savingPalada, setSavingPalada] = useState(false);
  const [paladaGlobal, setPaladaGlobal] = useState(1.82);
  const [paladaInput, setPaladaInput] = useState('1.82');

  // Para Encargado Dispatch: configuraciones por faena
  const [configsPorFaena, setConfigsPorFaena] = useState([]);
  const [faenaSeleccionadaConfig, setFaenaSeleccionadaConfig] = useState(null);

  // Estados para tonelaje por máquina
  const [maquinas, setMaquinas] = useState([]);
  const [loadingMaquinas, setLoadingMaquinas] = useState(false);
  const [editandoMaquina, setEditandoMaquina] = useState(null);
  const [tonelajeMaquinaInput, setTonelajeMaquinaInput] = useState('');
  const [savingMaquina, setSavingMaquina] = useState(false);

  // Determinar la faena a usar
  const faenaActiva = esUsuarioGlobal ? faenaSeleccionadaConfig : faenaUsuario;

  // Cargar configuraciones
  const cargarConfiguraciones = useCallback(async () => {
    try {
      setLoading(true);

      // Siempre cargar el valor global primero
      const dataGlobal = await configuracionService.getAll(null);
      setTonelajeGlobal(dataGlobal.tonelaje_dumpada_default || 4.6);
      setCappingGlobal(dataGlobal.ley_capping_maximo || 3);
      const paladaVal = dataGlobal.toneladas_por_palada || 1.82;
      setPaladaGlobal(paladaVal);
      setPaladaInput(paladaVal.toString());

      // Cargar configs de capping por faena
      const responseCapping = await configuracionService.getByKeyAllFaenas('ley_capping_maximo');
      setConfigsCappingPorFaena(responseCapping.configuraciones || []);

      if (esUsuarioGlobal) {
        // Encargado: cargar todas las configuraciones por faena
        const response = await configuracionService.getByKeyAllFaenas('tonelaje_dumpada_default');
        setConfigsPorFaena(response.configuraciones || []);

        // Si hay una faena seleccionada, cargar su configuracion
        if (faenaSeleccionadaConfig) {
          const dataFaena = await configuracionService.getAll(faenaSeleccionadaConfig);
          const valorFaena = dataFaena.tonelaje_dumpada_default || 4.6;
          setTonelajeActual(valorFaena);
          setTonelajeInput(valorFaena.toString());

          const valorCapping = dataFaena.ley_capping_maximo || 3;
          setCappingActual(valorCapping);
          setCappingInput(valorCapping.toString());

          // Verificar si tiene config especifica
          const configEspecifica = (response.configuraciones || []).find(
            c => c.id_faena === faenaSeleccionadaConfig
          );
          setTieneConfigEspecifica(!!configEspecifica);

          const configCapping = (responseCapping.configuraciones || []).find(
            c => c.id_faena === faenaSeleccionadaConfig
          );
          setTieneConfigCapping(!!configCapping);
        } else {
          // Sin faena seleccionada: mostrar global
          setTonelajeActual(dataGlobal.tonelaje_dumpada_default || 4.6);
          setTonelajeInput((dataGlobal.tonelaje_dumpada_default || 4.6).toString());
          setCappingActual(dataGlobal.ley_capping_maximo || 3);
          setCappingInput((dataGlobal.ley_capping_maximo || 3).toString());
          setTieneConfigEspecifica(false);
          setTieneConfigCapping(false);
        }
      } else {
        // Operador: cargar config de su faena
        const dataFaena = await configuracionService.getAll(faenaUsuario);
        const valorFaena = dataFaena.tonelaje_dumpada_default || 4.6;
        setTonelajeActual(valorFaena);
        setTonelajeInput(valorFaena.toString());

        const valorCapping = dataFaena.ley_capping_maximo || 3;
        setCappingActual(valorCapping);
        setCappingInput(valorCapping.toString());

        // Verificar si tiene config especifica
        const response = await configuracionService.getByKeyAllFaenas('tonelaje_dumpada_default');
        const configEspecifica = (response.configuraciones || []).find(
          c => c.id_faena === faenaUsuario
        );
        setTieneConfigEspecifica(!!configEspecifica);

        const configCapping = (responseCapping.configuraciones || []).find(
          c => c.id_faena === faenaUsuario
        );
        setTieneConfigCapping(!!configCapping);
      }
    } catch (error) {
      console.error('Error cargando configuraciones:', error);
      toast.error('Error al cargar configuraciones');
    } finally {
      setLoading(false);
    }
  }, [esUsuarioGlobal, faenaSeleccionadaConfig, faenaUsuario, toast]);

  useEffect(() => {
    cargarConfiguraciones();
  }, [cargarConfiguraciones]);

  // Guardar configuracion
  const guardarConfiguracion = async () => {
    const valor = parseFloat(tonelajeInput);

    if (isNaN(valor) || valor <= 0) {
      toast.error('El tonelaje debe ser un numero mayor a 0');
      return;
    }

    if (valor > 100) {
      toast.error('El tonelaje parece demasiado alto. Maximo: 100 Ton');
      return;
    }

    try {
      setSaving(true);

      // Determinar para que faena guardar
      const idFaenaGuardar = faenaActiva;

      await configuracionService.update('tonelaje_dumpada_default', valor, idFaenaGuardar);

      toast.success(
        idFaenaGuardar
          ? `Tonelaje actualizado para la faena seleccionada: ${valor} Ton`
          : `Tonelaje global actualizado: ${valor} Ton`
      );

      // Recargar configuraciones
      configuracionService.clearCache();
      await cargarConfiguraciones();
      onTonelajeMaquinaUpdated?.();
      onConfigDefaultUpdated?.();
    } catch (error) {
      console.error('Error guardando configuracion:', error);
      toast.error('Error al guardar la configuracion');
    } finally {
      setSaving(false);
    }
  };

  // Guardar configuracion de capping
  const guardarCapping = async () => {
    const valor = parseFloat(cappingInput);

    if (isNaN(valor) || valor <= 0) {
      toast.error('El capping debe ser un numero mayor a 0');
      return;
    }

    if (valor > 20) {
      toast.error('El capping parece demasiado alto. Maximo: 20%');
      return;
    }

    try {
      setSavingCapping(true);
      const idFaenaGuardar = faenaActiva;

      await configuracionService.update('ley_capping_maximo', valor, idFaenaGuardar);

      toast.success(
        idFaenaGuardar
          ? `Capping de ley actualizado para la faena seleccionada: ${valor}%`
          : `Capping de ley global actualizado: ${valor}%`
      );

      configuracionService.clearCache();
      await cargarConfiguraciones();
    } catch (error) {
      console.error('Error guardando capping:', error);
      toast.error('Error al guardar el capping');
    } finally {
      setSavingCapping(false);
    }
  };

  // Guardar peso de palada
  const guardarPalada = async () => {
    const valor = parseFloat(paladaInput);

    if (isNaN(valor) || valor <= 0) {
      toast.error('El peso de palada debe ser mayor a 0');
      return;
    }

    if (valor > 20) {
      toast.error('El peso parece demasiado alto. Maximo: 20 Ton');
      return;
    }

    try {
      setSavingPalada(true);
      await configuracionService.update('toneladas_por_palada', valor, null); // Siempre global
      toast.success(`Peso de palada actualizado: ${valor} Ton`);
      configuracionService.clearCache();
      await cargarConfiguraciones();
    } catch (error) {
      console.error('Error guardando peso de palada:', error);
      toast.error('Error al guardar el peso de palada');
    } finally {
      setSavingPalada(false);
    }
  };

  // Obtener nombre de faena
  const getNombreFaena = (idFaena) => {
    if (!idFaena) return 'Global (todas las faenas)';
    const faena = faenas.find(f => f.id === idFaena || f.id_faena === idFaena);
    return faena ? (faena.ubicacion || faena.nombre || `Faena ${idFaena}`) : `Faena ${idFaena}`;
  };

  // Obtener tonelaje de una faena especifica
  const getTonelajeFaena = (idFaena) => {
    const config = configsPorFaena.find(c => c.id_faena === idFaena);
    return config ? config.valor : tonelajeGlobal;
  };

  // Verificar si faena tiene config especifica
  const faenaTieneConfigEspecifica = (idFaena) => {
    return configsPorFaena.some(c => c.id_faena === idFaena || c.id_faena === parseInt(idFaena));
  };

  // =============================================
  // FUNCIONES PARA TONELAJE POR MÁQUINA
  // =============================================

  // Cargar máquinas con tonelaje
  const cargarMaquinas = useCallback(async () => {
    setLoadingMaquinas(true);
    try {
      const response = await configuracionService.getTonelajeMaquinas();
      setMaquinas(response.data || []);
    } catch (error) {
      console.error('Error cargando máquinas:', error);
      // No mostrar error, simplemente no hay máquinas
      setMaquinas([]);
    } finally {
      setLoadingMaquinas(false);
    }
  }, []);

  // Cargar máquinas al montar el componente
  useEffect(() => {
    cargarMaquinas();
  }, [cargarMaquinas]);

  // Iniciar edición de tonelaje de máquina
  const iniciarEdicionMaquina = (maquina) => {
    setEditandoMaquina(maquina);
    setTonelajeMaquinaInput(maquina.tonelaje.toString());
  };

  // Cancelar edición
  const cancelarEdicionMaquina = () => {
    setEditandoMaquina(null);
    setTonelajeMaquinaInput('');
  };

  // Guardar tonelaje de máquina
  const guardarTonelajeMaquina = async () => {
    const valor = parseFloat(tonelajeMaquinaInput);

    if (isNaN(valor) || valor <= 0) {
      toast.error('El tonelaje debe ser un número mayor a 0');
      return;
    }

    if (valor > 100) {
      toast.error('El tonelaje parece demasiado alto. Máximo: 100 Ton');
      return;
    }

    setSavingMaquina(true);
    try {
      await configuracionService.setTonelajeMaquina({
        id_maquina: editandoMaquina.id_maquina,
        nombre_maquina: editandoMaquina.nombre_maquina,
        tonelaje: valor,
        patente: editandoMaquina.patente,
        es_global: false, // Configuración específica de faena
      });

      toast.success(`Tonelaje de ${editandoMaquina.nombre_maquina} actualizado a ${valor} Ton`);
      cancelarEdicionMaquina();
      cargarMaquinas();
      onTonelajeMaquinaUpdated?.();
    } catch (error) {
      console.error('Error guardando tonelaje:', error);
      toast.error('Error al guardar el tonelaje');
    } finally {
      setSavingMaquina(false);
    }
  };

  // Eliminar configuración de tonelaje (volver a default)
  const eliminarTonelajeMaquina = async (maquina) => {
    if (!maquina.config_id) {
      toast.info('Esta máquina ya usa el tonelaje por defecto');
      return;
    }

    try {
      await configuracionService.deleteTonelajeMaquina(maquina.config_id);
      toast.success(`${maquina.nombre_maquina} ahora usa el tonelaje por defecto`);
      cargarMaquinas();
      onTonelajeMaquinaUpdated?.();
    } catch (error) {
      console.error('Error eliminando configuración:', error);
      toast.error('Error al eliminar la configuración');
    }
  };

  if (loading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mr-3"></div>
          <span className="text-gray-600">Cargando configuraciones...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-l-4 border-gray-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <HiCog className="w-7 h-7 text-gray-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Configuracion de Dispatch</h2>
              <p className="text-gray-500">
                {esUsuarioGlobal
                  ? 'Administra el tonelaje por dumpada para cada faena'
                  : 'Configura el tonelaje por dumpada de tu faena'}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={cargarConfiguraciones}
            disabled={loading}
          >
            <HiRefresh className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel de Configuracion */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <HiCog className="w-5 h-5 text-gray-500" />
            Tonelaje por Dumpada
          </h3>

          {/* Selector de Faena (solo Encargado) */}
          {esUsuarioGlobal && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar Faena
              </label>
              <select
                value={faenaSeleccionadaConfig || ''}
                onChange={(e) => setFaenaSeleccionadaConfig(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Configuracion Global --</option>
                {faenas.map(faena => (
                  <option key={faena.id || faena.id_faena} value={faena.id || faena.id_faena}>
                    {faena.ubicacion || faena.nombre || `Faena ${faena.id || faena.id_faena}`}
                    {faenaTieneConfigEspecifica(faena.id || faena.id_faena) ? ' (tiene config especifica)' : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Selecciona una faena para configurar su tonelaje especifico, o deja vacio para modificar el valor global
              </p>
            </div>
          )}

          {/* Operador: mostrar su faena */}
          {!esUsuarioGlobal && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700">
                <HiOfficeBuilding className="w-5 h-5" />
                <span className="font-medium">Tu Faena: {getNombreFaena(faenaUsuario)}</span>
              </div>
            </div>
          )}

          {/* Input de Tonelaje */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tonelaje (Toneladas)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                value={tonelajeInput}
                onChange={(e) => setTonelajeInput(e.target.value)}
                className="flex-1 px-4 py-3 text-lg font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej: 4.6"
              />
              <span className="text-gray-500 font-medium">Ton</span>
            </div>
          </div>

          {/* Informacion del valor */}
          <div className="mb-4 space-y-2">
            {tieneConfigEspecifica ? (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <HiCheckCircle className="w-5 h-5" />
                <span>Esta faena tiene configuracion especifica</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-yellow-600 text-sm">
                <HiExclamationCircle className="w-5 h-5" />
                <span>Usando valor global: {tonelajeGlobal} Ton</span>
              </div>
            )}
          </div>

          {/* Boton Guardar */}
          <Button
            variant="primary"
            onClick={guardarConfiguracion}
            disabled={saving}
            className="w-full"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              <>
                <HiSave className="w-5 h-5 mr-2" />
                Guardar Configuracion
              </>
            )}
          </Button>
        </Card>

        {/* Panel de Informacion */}
        <Card className="bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <HiInformationCircle className="w-5 h-5 text-blue-500" />
            Informacion
          </h3>

          <div className="space-y-4 text-sm text-gray-600">
            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-1">Que es el Tonelaje por Dumpada?</h4>
              <p>
                Es el peso en toneladas que se asigna automaticamente a cada dumpada al momento de su ingreso.
                Este valor se usa para calcular el total de toneladas procesadas.
              </p>
            </div>

            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-1">Configuracion por Faena</h4>
              <p>
                Cada faena puede tener su propio valor de tonelaje. Si una faena no tiene configuracion especifica,
                se usa el valor global como respaldo.
              </p>
            </div>

            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-1">Valor Global</h4>
              <p>
                <strong>Valor actual:</strong> {tonelajeGlobal} Toneladas
              </p>
              <p className="mt-1">
                Este es el valor que se aplica a todas las faenas que no tienen configuracion especifica.
              </p>
            </div>
          </div>

          {/* Resumen de configuraciones por faena (solo Encargado) */}
          {esUsuarioGlobal && configsPorFaena.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-900 mb-2">Faenas con configuracion especifica:</h4>
              <div className="space-y-1">
                {configsPorFaena
                  .filter(c => c.id_faena !== null)
                  .map(config => (
                    <div
                      key={config.id}
                      className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 text-sm"
                    >
                      <span className="text-gray-700">{getNombreFaena(config.id_faena)}</span>
                      <span className="font-semibold text-blue-600">{config.valor} Ton</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* =============================================
          SECCION: CAPPING DE LEY
          ============================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <HiCog className="w-5 h-5 text-orange-500" />
            Capping de Ley (ley_cup)
          </h3>

          {/* Info faena seleccionada */}
          {esUsuarioGlobal && (
            <div className="mb-3 p-2 bg-gray-50 rounded-lg text-sm text-gray-600">
              Configurando para: <strong>{faenaSeleccionadaConfig ? getNombreFaena(faenaSeleccionadaConfig) : 'Global (todas las faenas)'}</strong>
            </div>
          )}

          {!esUsuarioGlobal && (
            <div className="mb-3 p-2 bg-orange-50 rounded-lg text-sm text-orange-700">
              Faena: <strong>{getNombreFaena(faenaUsuario)}</strong>
            </div>
          )}

          {/* Input de Capping */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ley maxima (Capping)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="20"
                value={cappingInput}
                onChange={(e) => setCappingInput(e.target.value)}
                className="flex-1 px-4 py-3 text-lg font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Ej: 3"
              />
              <span className="text-gray-500 font-medium">%</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Si la ley de una dumpada supera este valor, se limita a este maximo al calcular la mezcla
            </p>
          </div>

          {/* Info del valor */}
          <div className="mb-4 space-y-2">
            {tieneConfigCapping ? (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <HiCheckCircle className="w-5 h-5" />
                <span>Esta faena tiene capping especifico: {cappingActual}%</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-yellow-600 text-sm">
                <HiExclamationCircle className="w-5 h-5" />
                <span>Usando valor global: {cappingGlobal}%</span>
              </div>
            )}
          </div>

          {/* Boton Guardar */}
          <Button
            variant="primary"
            onClick={guardarCapping}
            disabled={savingCapping}
            className="w-full bg-orange-600 hover:bg-orange-700"
          >
            {savingCapping ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              <>
                <HiSave className="w-5 h-5 mr-2" />
                Guardar Capping
              </>
            )}
          </Button>
        </Card>

        {/* Info Capping */}
        <Card className="bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <HiInformationCircle className="w-5 h-5 text-orange-500" />
            Sobre el Capping
          </h3>

          <div className="space-y-4 text-sm text-gray-600">
            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-1">Que es el Capping?</h4>
              <p>
                Es el valor maximo de ley que se considera al agregar una dumpada a una mezcla.
                Si la ley de laboratorio supera este valor, se usa el capping en su lugar para los calculos de la mezcla.
              </p>
            </div>

            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-1">Ejemplo</h4>
              <p>
                Con capping en <strong>{cappingGlobal}%</strong>: una dumpada con ley 4.6% se calcula como {cappingGlobal}% en la mezcla.
                La dumpada mantiene su ley original (4.6%).
              </p>
            </div>

            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-1">Valor Global</h4>
              <p>
                <strong>Valor actual:</strong> {cappingGlobal}%
              </p>
            </div>
          </div>

          {/* Resumen de cappings por faena */}
          {esUsuarioGlobal && configsCappingPorFaena.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-900 mb-2">Faenas con capping especifico:</h4>
              <div className="space-y-1">
                {configsCappingPorFaena
                  .filter(c => c.id_faena !== null)
                  .map(config => (
                    <div
                      key={config.id}
                      className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 text-sm"
                    >
                      <span className="text-gray-700">{getNombreFaena(config.id_faena)}</span>
                      <span className="font-semibold text-orange-600">{config.valor}%</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* =============================================
          SECCION: PESO DE PALADA
          ============================================= */}
      <Card className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <HiCog className="w-5 h-5 text-indigo-500" />
              Peso por Palada
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Toneladas que representa una palada al usar dumpadas parciales en mezclas
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Valor actual: <strong>{paladaGlobal} Ton/palada</strong> — Ej: una dumpada de 3.9 t tiene {Math.floor(3.9 / paladaGlobal)} paladas completas
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <input
              type="number"
              step="0.01"
              min="0.1"
              max="20"
              value={paladaInput}
              onChange={(e) => setPaladaInput(e.target.value)}
              className="w-28 px-3 py-2 text-lg font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center"
              placeholder="1.82"
            />
            <span className="text-gray-500 font-medium">Ton</span>
            <Button
              variant="primary"
              onClick={guardarPalada}
              disabled={savingPalada}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {savingPalada ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <>
                  <HiSave className="w-4 h-4 mr-1" />
                  Guardar
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* =============================================
          SECCION: TONELAJE POR MAQUINA
          ============================================= */}
      <Card className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <HiTruck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Tonelaje por Maquina</h3>
              <p className="text-sm text-gray-500">
                Configura el tonelaje especifico para cada camion/dumper
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={cargarMaquinas}
            disabled={loadingMaquinas}
          >
            <HiRefresh className={`w-5 h-5 mr-2 ${loadingMaquinas ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {loadingMaquinas ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-600">Cargando maquinas...</span>
          </div>
        ) : maquinas.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <HiTruck className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No hay maquinas disponibles</p>
            <p className="text-sm">Verifica la conexion con el sistema de petroleo</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Maquina</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Patente</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Tonelaje</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Estado</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {maquinas.map((maquina) => (
                  <tr key={maquina.id_maquina} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <HiTruck className="w-5 h-5 text-gray-400" />
                        <span className="font-medium">{maquina.nombre_maquina}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {maquina.patente || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editandoMaquina?.id_maquina === maquina.id_maquina ? (
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="100"
                            value={tonelajeMaquinaInput}
                            onChange={(e) => setTonelajeMaquinaInput(e.target.value)}
                            className="w-20 px-2 py-1 text-center border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                          <span className="text-gray-500 text-xs">Ton</span>
                        </div>
                      ) : (
                        <span className="font-semibold text-blue-600">{maquina.tonelaje} Ton</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {maquina.tiene_config_especifica ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <HiCheckCircle className="w-3 h-3" />
                          Personalizado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Default ({maquina.tonelaje_default} Ton)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editandoMaquina?.id_maquina === maquina.id_maquina ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={guardarTonelajeMaquina}
                            disabled={savingMaquina}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="Guardar"
                          >
                            {savingMaquina ? (
                              <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <HiSave className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={cancelarEdicionMaquina}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                            title="Cancelar"
                          >
                            <HiX className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => iniciarEdicionMaquina(maquina)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="Editar tonelaje"
                          >
                            <HiPencil className="w-4 h-4" />
                          </button>
                          {maquina.tiene_config_especifica && (
                            <button
                              onClick={() => eliminarTonelajeMaquina(maquina)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Usar tonelaje por defecto"
                            >
                              <HiTrash className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
          <HiInformationCircle className="w-5 h-5 inline mr-2" />
          Las maquinas sin configuracion especifica usan el <strong>tonelaje por defecto</strong> configurado arriba.
          Puedes personalizar el tonelaje de cada maquina individualmente.
        </div>
      </Card>
    </div>
  );
};

export default ConfiguracionView;
