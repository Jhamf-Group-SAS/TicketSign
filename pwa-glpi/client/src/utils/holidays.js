
/**
 * Calcula los días festivos de Colombia para un año dado.
 * Implementa el cálculo de festivos fijos, Ley Emiliani y Semana Santa.
 * @param {number} year - Año para el cual calcular los festivos.
 * @returns {Date[]} Array de fechas de los festivos.
 */
export const getColombianHolidays = (year) => {
    const holidays = [];

    // Festivos fijos (Fecha exacta)
    const fixedHolidays = [
        { month: 0, day: 1 },   // Año Nuevo
        { month: 4, day: 1 },   // Día del Trabajo
        { month: 6, day: 20 },  // Día de la Independencia
        { month: 7, day: 7 },   // Batalla de Boyacá
        { month: 11, day: 8 },  // Inmaculada Concepción
        { month: 11, day: 25 }, // Navidad
    ];

    fixedHolidays.forEach(h => {
        holidays.push(new Date(year, h.month, h.day));
    });

    // Ley Emiliani (Se mueven al siguiente lunes)
    const emilianiHolidays = [
        { month: 0, day: 6 },   // Reyes Magos
        { month: 2, day: 19 },  // San José
        { month: 5, day: 29 },  // San Pedro y San Pablo
        { month: 7, day: 15 },  // Asunción de la Virgen
        { month: 9, day: 12 },  // Día de la Raza
        { month: 10, day: 1 },  // Todos los Santos
        { month: 10, day: 11 }, // Independencia de Cartagena
    ];

    emilianiHolidays.forEach(h => {
        const date = new Date(year, h.month, h.day);
        if (date.getDay() !== 1) { // Si no es lunes
            // Mover al siguiente lunes
            // getDay(): 0=Dom, 1=Lun, ..., 6=Sab
            // Días a sumar: Si es domingo (0) -> +1. Si es martes(2) -> +6. Si es sabado(6) -> +2
            // Formula general para llegar al lunes (1): (8 - day) % 7
            // Pero si es Martes (2): (8-2)=6 dias (mie, jue, vie, sab, dom, lun). Correcto.
            // Si es Domingo (0): (8-0)=8 % 7 = 1 dia. Correcto.
            let daysOnWeek = date.getDay();
            let daysToNextMonday = 0;
            if (daysOnWeek === 0) daysToNextMonday = 1;
            else if (daysOnWeek > 1) daysToNextMonday = 8 - daysOnWeek;

            date.setDate(date.getDate() + daysToNextMonday);
        }
        holidays.push(date);
    });

    // Festivos basados en Pascua (Semana Santa)
    const easter = getEasterDate(year);

    // Jueves Santo (-3 días desde Pascua)
    const juevesSanto = new Date(easter);
    juevesSanto.setDate(easter.getDate() - 3);
    holidays.push(juevesSanto);

    // Viernes Santo (-2 días desde Pascua)
    const viernesSanto = new Date(easter);
    viernesSanto.setDate(easter.getDate() - 2);
    holidays.push(viernesSanto);

    // Ascensión del Señor (+43 días -> Lunes siguiente) - Realmente es +40 días (Jueves) movido al Lunes (+3)
    const ascension = new Date(easter);
    ascension.setDate(easter.getDate() + 43);
    holidays.push(ascension);

    // Corpus Christi (+64 días -> Lunes siguiente) - Realmente es +61 días (Jueves) movido al Lunes (+3)
    const corpusChristi = new Date(easter);
    corpusChristi.setDate(easter.getDate() + 64);
    holidays.push(corpusChristi);

    // Sagrado Corazón (+71 días -> Lunes siguiente) - Realmente es +68 días (Viernes) movido al Lunes (+3)
    const sagradoCorazon = new Date(easter);
    sagradoCorazon.setDate(easter.getDate() + 71);
    holidays.push(sagradoCorazon);

    return holidays;
};

/**
 * Algoritmo de Butcher para calcular la fecha de Pascua (Domingo de Resurrección)
 */
function getEasterDate(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed month
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(year, month, day);
}

/**
 * Verifica si una fecha dada es festivo en Colombia
 * @param {Date} date - Fecha a verificar
 * @returns {boolean} True si es festivo
 */
export const isHoliday = (date) => {
    const year = date.getFullYear();
    const holidays = getColombianHolidays(year);
    return holidays.some(h =>
        h.getDate() === date.getDate() &&
        h.getMonth() === date.getMonth() &&
        h.getFullYear() === date.getFullYear()
    );
}
