/**
 * Стандартизирует название компании к формату:
 * ООО "Название", ЗАО "Название", АО "Название", ИП Фамилия И.О.
 */
export function formatCompanyName(name: string): string {
  if (!name) return name;
  
  let result = name.trim();
  
  // Регулярные выражения для разных форматов
  const patterns = [
    // ООО - различные варианты написания
    { regex: /^(ООО|Ооо|ооо|О\.О\.О\.|о\.о\.о\.)\s*[«""']?\s*(.+?)\s*[»""']?\s*$/i, prefix: 'ООО' },
    // ЗАО - различные варианты написания
    { regex: /^(ЗАО|Зао|зао|З\.А\.О\.|з\.а\.о\.)\s*[«""']?\s*(.+?)\s*[»""']?\s*$/i, prefix: 'ЗАО' },
    // АО - различные варианты написания
    { regex: /^(АО|Ао|ао|А\.О\.|а\.о\.)\s*[«""']?\s*(.+?)\s*[»""']?\s*$/i, prefix: 'АО' },
    // ПАО - публичное акционерное общество
    { regex: /^(ПАО|Пао|пао|П\.А\.О\.|п\.а\.о\.)\s*[«""']?\s*(.+?)\s*[»""']?\s*$/i, prefix: 'ПАО' },
    // НАО - непубличное акционерное общество
    { regex: /^(НАО|Нао|нао|Н\.А\.О\.|н\.а\.о\.)\s*[«""']?\s*(.+?)\s*[»""']?\s*$/i, prefix: 'НАО' },
    // ИП - индивидуальный предприниматель
    { regex: /^(ИП|Ип|ип|И\.П\.|и\.п\.)\s+(.+)$/i, prefix: 'ИП', noQuotes: true },
  ];
  
  for (const pattern of patterns) {
    const match = result.match(pattern.regex);
    if (match) {
      const companyName = match[2].trim();
      if (pattern.noQuotes) {
        // Для ИП форматируем ФИО
        result = `${pattern.prefix} ${formatPersonName(companyName)}`;
      } else {
        // Для остальных добавляем кавычки
        result = `${pattern.prefix} "${companyName}"`;
      }
      return result;
    }
  }
  
  // Если название начинается с кавычки, возможно это просто название без префикса
  // Оставляем как есть
  return result;
}

/**
 * Форматирует ФИО в формат "Фамилия И.О."
 */
export function formatPersonName(name: string): string {
  if (!name) return name;
  
  const parts = name.trim().split(/\s+/);
  
  if (parts.length === 1) {
    // Только фамилия
    return capitalize(parts[0]);
  }
  
  if (parts.length === 2) {
    // Фамилия + Имя или уже в формате "Фамилия И."
    const [first, second] = parts;
    
    // Проверяем, не инициал ли второй элемент
    if (/^[А-ЯЁA-Z]\.?$/i.test(second)) {
      return `${capitalize(first)} ${second.charAt(0).toUpperCase()}.`;
    }
    
    return `${capitalize(first)} ${second.charAt(0).toUpperCase()}.`;
  }
  
  if (parts.length >= 3) {
    // Фамилия + Имя + Отчество
    const [surname, name, patronymic] = parts;
    
    // Проверяем, не инициалы ли уже
    if (/^[А-ЯЁA-Z]\.?$/i.test(name) && /^[А-ЯЁA-Z]\.?$/i.test(patronymic)) {
      return `${capitalize(surname)} ${name.charAt(0).toUpperCase()}.${patronymic.charAt(0).toUpperCase()}.`;
    }
    
    return `${capitalize(surname)} ${name.charAt(0).toUpperCase()}.${patronymic.charAt(0).toUpperCase()}.`;
  }
  
  return name;
}

/**
 * Делает первую букву заглавной
 */
function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Проверяет, является ли название компанией (имеет префикс ООО, АО и т.д.)
 */
export function isCompanyName(name: string): boolean {
  if (!name) return false;
  return /^(ООО|ЗАО|АО|ПАО|НАО|ИП)\s/i.test(name.trim());
}

/**
 * Нормализует название для проверки дубликатов
 */
export function normalizeForComparison(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[«»""'']/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Проверяет, являются ли два названия дубликатами
 */
export function isDuplicate(name1: string, name2: string): boolean {
  return normalizeForComparison(name1) === normalizeForComparison(name2);
}
