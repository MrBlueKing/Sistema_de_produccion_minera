// src/constants/faenaColors.js
// 🎨 SISTEMA CENTRALIZADO DE COLORES POR FAENA

export const FAENA_COLORS = {
  1: {
    name: "Cabildo",
    region: "Región de Valparaíso",
    // Colores para fondo y bordes
    bg: "bg-green-50",
    border: "border-l-green-400",
    borderFull: "border-green-200",

    // Badges y etiquetas
    badge: "bg-green-100 text-green-800",

    // Iconos y textos
    icon: "text-green-600",
    text: "text-green-800",

    // Gradientes
    gradient: "bg-gradient-to-r from-green-600 to-green-700",
    gradientLight: "bg-gradient-to-r from-green-50 to-green-100/50",

    // Colores específicos (hex)
    primary: "#059669", // green-600
    light: "#d1fae5",   // green-100
    dark: "#047857",    // green-700

    // Elementos decorativos
    emoji: "🌿",
    id: 1
  },

  2: {
    name: "Catemu",
    region: "Región de Valparaíso",

    // Colores para fondo y bordes - ROJO MANZANA VISIBLE
    bg: "bg-red-200",              // ✅ Fondo rojo suave y visible (sin opacidad)
    border: "border-l-red-600",     // ✅ Borde izquierdo rojo intenso
    borderFull: "border-red-400",   // ✅ Borde completo rojo medio

    // Badges y etiquetas
    badge: "bg-red-200 text-red-900",  // ✅ Badge visible

    // Iconos y textos
    icon: "text-red-600",     // ✅ Ícono rojo manzana
    text: "text-red-900",     // ✅ Texto oscuro para contraste

    // Gradientes
    gradient: "bg-gradient-to-r from-red-700 to-red-900",
    gradientLight: "bg-gradient-to-r from-red-50 to-red-100",

    // Colores específicos (hex) — rojo manzana
    primary: "#e0002b", // rojo manzana fuerte
    light: "#ffe5e9",   // rosado suave
    dark: "#a00020",    // rojo profundo

    // Elementos decorativos
    emoji: "🍎",
    id: 2
  },

  4: {
    name: "Tiltil",
    region: "Región Metropolitana",
    // Colores para fondo y bordes
    bg: "bg-red-50/30",
    border: "border-l-red-400",
    borderFull: "border-red-200",

    // Badges y etiquetas
    badge: "bg-red-100 text-red-800",

    // Iconos y textos
    icon: "text-red-600",
    text: "text-red-800",

    // Gradientes
    gradient: "bg-gradient-to-r from-red-600 to-red-700",
    gradientLight: "bg-gradient-to-r from-red-50 to-red-100/50",

    // Colores específicos (hex)
    primary: "#dc2626", // red-600
    light: "#fee2e2",   // red-100
    dark: "#b91c1c",    // red-700

    // Elementos decorativos
    emoji: "🏔️",
    id: 4
  },
  8: {
    name: "Rungue",
    region: "Región Metropolitana",
    // Colores para fondo y bordes
    bg: "bg-purple-200/40",
    border: "border-l-purple-500",
    borderFull: "border-purple-200",

    // Badges y etiquetas
    badge: "bg-purple-100 text-purple-800",

    // Iconos y textos
    icon: "text-purple-600",
    text: "text-purple-800",

    // Gradientes
    gradient: "bg-gradient-to-r from-purple-600 to-purple-700",
    gradientLight: "bg-gradient-to-r from-purple-50 to-purple-100/50",

    // Colores específicos (hex)
    primary: "#7e22ce", // purple-700
    light: "#f3e8ff",   // purple-100
    dark: "#581c87",    // purple-900

    // Estilo alternativo especial
    specialGlow: "bg-gradient-to-r from-purple-400 via-fuchsia-500 to-pink-500",
    specialText: "text-fuchsia-600",

    // Elementos decorativos
    emoji: "🌋",
    id: 8
  },
  7: {
    name: "La Cruz",
    region: "Región de Valparaíso",
    // Colores para fondo y bordes
    bg: "bg-yellow-50/40",
    border: "border-l-yellow-500",
    borderFull: "border-yellow-200",

    // Badges y etiquetas
    badge: "bg-yellow-100 text-yellow-800",

    // Iconos y textos
    icon: "text-yellow-600",
    text: "text-yellow-800",

    // Gradientes
    gradient: "bg-gradient-to-r from-yellow-500 to-yellow-600",
    gradientLight: "bg-gradient-to-r from-yellow-50 to-yellow-100/50",

    // Colores específicos (hex)
    primary: "#ca8a04", // yellow-600
    light: "#fef9c3",   // yellow-100
    dark: "#a16207",    // yellow-700

    // Estilo alternativo especial
    specialGlow: "bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500",
    specialText: "text-amber-600",

    // Elementos decorativos
    emoji: "🏢",
    id: 7
  },
  6: {
    name: "Laboratorio",
    region: "Región Metropolitana",
    // Colores para fondo y bordes
    bg: "bg-blue-50/40",
    border: "border-l-blue-500",
    borderFull: "border-blue-200",

    // Badges y etiquetas
    badge: "bg-blue-100 text-blue-800",

    // Iconos y textos
    icon: "text-blue-600",
    text: "text-blue-800",

    // Gradientes
    gradient: "bg-gradient-to-r from-blue-600 to-blue-700",
    gradientLight: "bg-gradient-to-r from-blue-50 to-blue-100/50",

    // Colores específicos (hex)
    primary: "#2563eb", // blue-600
    light: "#dbeafe",   // blue-100
    dark: "#1e40af",    // blue-700

    // Elementos decorativos
    emoji: "🧪",
    id: 6
  },
};

// 🔧 COLORES POR DEFECTO para faenas desconocidas
export const DEFAULT_FAENA_COLORS = {
  name: "Faena Desconocida",
  bg: "bg-gray-50/25",
  border: "border-l-gray-400",
  borderFull: "border-gray-200",
  badge: "bg-gray-100 text-gray-800",
  icon: "text-gray-600",
  text: "text-gray-800",
  gradient: "bg-gradient-to-r from-gray-500 to-gray-600",
  gradientLight: "bg-gradient-to-r from-gray-50 to-gray-100/50",
  primary: "#6b7280", // gray-500
  light: "#f3f4f6",   // gray-100
  dark: "#374151",    // gray-700
  emoji: "🏢",
  id: null
};

// 🛠️ FUNCIÓN INTELIGENTE: Detecta automáticamente si es ID o nombre
export const getFaenaColors = (faenaIdOrName) => {
  // Si no se proporciona nada, devolver colores por defecto
  if (faenaIdOrName === null || faenaIdOrName === undefined) {
    return DEFAULT_FAENA_COLORS;
  }

  // Detectar si es un número (ID) o string (nombre)
  const isNumber = typeof faenaIdOrName === 'number' ||
    (typeof faenaIdOrName === 'string' && !isNaN(parseInt(faenaIdOrName)));

  if (isNumber) {
    // Es un ID de faena
    const id = typeof faenaIdOrName === 'string' ? parseInt(faenaIdOrName) : faenaIdOrName;
    const faenaInfo = FAENA_COLORS[id];
    if (faenaInfo) {
      return faenaInfo;
    }
  } else {
    // Es un nombre de faena
    if (typeof faenaIdOrName === 'string') {
      const normalizedName = faenaIdOrName.trim().toLowerCase();

      for (const [key, colors] of Object.entries(FAENA_COLORS)) {
        if (colors.name.toLowerCase() === normalizedName) {
          return colors;
        }
      }
    }
  }

  return DEFAULT_FAENA_COLORS;
};

// 🛠️ FUNCIÓN ESPECÍFICA: Obtener colores por ID (mantener para compatibilidad)
export const getFaenaColorsById = (faenaId) => {
  return getFaenaColors(faenaId);
};

// 🛠️ FUNCIÓN ESPECÍFICA: Obtener colores por nombre (mantener para compatibilidad)
export const getFaenaColorsByName = (faenaName) => {
  return getFaenaColors(faenaName);
};

// 🛠️ FUNCIÓN DE UTILIDAD: Obtener solo colores hex
export const getFaenaHexColors = (faenaId) => {
  const colors = getFaenaColorsById(faenaId);
  return {
    primary: colors.primary,
    light: colors.light,
    dark: colors.dark,
    name: colors.name,
    emoji: colors.emoji
  };
};

// 🛠️ FUNCIÓN DE UTILIDAD: Obtener lista de todas las faenas
export const getAllFaenas = () => {
  return Object.values(FAENA_COLORS).map(faena => ({
    id: faena.id,
    name: faena.name,
    emoji: faena.emoji,
    primary: faena.primary
  }));
};

// 🛠️ FUNCIÓN DE UTILIDAD: Verificar si existe una faena
export const faenaExists = (faenaId) => {
  const id = typeof faenaId === 'string' ? parseInt(faenaId) : faenaId;
  return FAENA_COLORS.hasOwnProperty(id);
};
