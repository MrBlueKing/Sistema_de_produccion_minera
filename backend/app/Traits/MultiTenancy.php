<?php

namespace App\Traits;

trait MultiTenancy
{
    /**
     * Verifica si el usuario actual es global (Encargado Dispatch)
     * Usuario global puede ver todas las faenas
     */
    protected function esUsuarioGlobal($request): bool
    {
        $roles = $request->auth_roles ?? [];

        // Si roles viene como array de objetos, extraer los nombres
        $rolesNombres = [];
        foreach ($roles as $rol) {
            if (is_array($rol) || is_object($rol)) {
                $rolArray = (array) $rol;
                $rolesNombres[] = $rolArray['nombre'] ?? $rolArray['name'] ?? '';
                $rolesNombres[] = $rolArray['slug'] ?? '';
            } else {
                $rolesNombres[] = $rol;
            }
        }

        // Buscar el rol "Encargado Dispatch" en diferentes formatos
        $rolesGlobales = [
            'Encargado Dispatch',
            'encargado_dispatch',
            'encargado dispatch',
            'ENCARGADO DISPATCH',
            'Encargado_Dispatch',
        ];

        foreach ($rolesGlobales as $rolGlobal) {
            if (in_array($rolGlobal, $roles) || in_array($rolGlobal, $rolesNombres)) {
                return true;
            }
        }

        // También verificar con strtolower para mayor flexibilidad
        $rolesLower = array_map('strtolower', array_filter($rolesNombres));
        if (in_array('encargado dispatch', $rolesLower) || in_array('encargado_dispatch', $rolesLower)) {
            return true;
        }

        return false;
    }

    /**
     * Verifica si el usuario puede ver todas las faenas en el módulo de ingeniería.
     * En ingeniería, TODOS los usuarios deben ver todas las faenas,
     * independientemente de su rol en dispatch.
     *
     * @param Request $request
     * @return bool
     */
    protected function esUsuarioGlobalIngenieria($request): bool
    {
        // En ingeniería, SIEMPRE retornar true para que todos vean todas las faenas
        // Esto es independiente del rol de dispatch
        return true;
    }

    /**
     * Obtiene la faena a filtrar (del usuario o del selector)
     */
    protected function getFaenaParaFiltrar($request)
    {
        if (!$this->esUsuarioGlobal($request)) {
            // Usuario de faena específica: siempre su faena
            return $request->auth_faena;
        }

        // Usuario global: puede venir de query param o header
        return $request->query('faena_id') ??
               $request->header('X-Faena-ID') ??
               null; // null = ver todas
    }

    /**
     * Aplica filtro de faena a una query
     */
    protected function aplicarFiltroFaena($query, $request, $campo = 'id_faena')
    {
        $faenaId = $this->getFaenaParaFiltrar($request);

        if ($faenaId !== null) {
            $query->where($campo, $faenaId);
        }

        return $query;
    }

    /**
     * Valida que el usuario tenga acceso a una faena específica
     */
    protected function validarAccesoFaena($request, $idFaena)
    {
        $esGlobal = $this->esUsuarioGlobal($request);

        \Illuminate\Support\Facades\Log::info('🔐 [MULTI-TENANCY] Validando acceso a faena', [
            'es_usuario_global' => $esGlobal,
            'id_faena_solicitada' => $idFaena,
            'auth_faena_usuario' => $request->auth_faena,
            'auth_roles' => $request->auth_roles ?? [],
        ]);

        if (!$esGlobal) {
            if ($request->auth_faena != $idFaena) {
                \Illuminate\Support\Facades\Log::warning('⛔ [MULTI-TENANCY] Acceso denegado a faena', [
                    'id_faena_solicitada' => $idFaena,
                    'auth_faena_usuario' => $request->auth_faena,
                ]);
                abort(403, 'No tienes acceso a datos de esta faena');
            }
        } else {
            \Illuminate\Support\Facades\Log::info('✅ [MULTI-TENANCY] Usuario global - acceso permitido a todas las faenas');
        }
    }

    /**
     * Obtiene el id_faena para asignar en creación
     */
    protected function getFaenaParaAsignar($request, $defaultFaena = null)
    {
        // Si es usuario de faena, usar su faena
        if (!$this->esUsuarioGlobal($request)) {
            return $request->auth_faena;
        }

        // Si es usuario global, usar el default proporcionado
        return $defaultFaena ?? $request->auth_faena;
    }
}
