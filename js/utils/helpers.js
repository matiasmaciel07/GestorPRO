"use strict";

/**
 * Retrasa la ejecución de una función intensiva (Debouncing)
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Categorías estandarizadas y neutrales para la gestión de gastos.
 * Separadas por ámbito operativo (Local Comercial/Negocio) y Economía Personal.
 */
export const ExpenseCategories = {
    Local: [
        "Alquiler de Inmueble",
        "Impuestos y Tasas",
        "Servicios Básicos (Luz, Agua, Internet)",
        "Mantenimiento y Reparaciones",
        "Suministros Operativos",
        "Marketing y Publicidad",
        "Gastos y Comisiones Financieras",
        "Logística y Distribución",
        "Seguros Corporativos",
        "Otros Gastos Operativos"
    ],
    Personal: [
        "Vivienda y Servicios Habitacionales",
        "Alimentación y Supermercado",
        "Transporte y Movilidad",
        "Salud y Bienestar",
        "Educación y Capacitación",
        "Entretenimiento y Ocio",
        "Indumentaria y Calzado",
        "Seguros Personales",
        "Impuestos Personales",
        "Suscripciones y Membresías",
        "Otros Gastos Personales"
    ]
};