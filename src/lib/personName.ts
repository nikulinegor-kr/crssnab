/**
 * Единый формат имени человека во всём приложении: «Фамилия И.О.».
 * Понимает как полное ФИО («Никулин Егор Владимирович»),
 * так и уже сокращённую запись («Никулин Е.В.»).
 */
export const formatPersonName = (raw?: string | null): string => {
  const source = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!source) return "";

  const parts = source.split(" ");
  if (parts.length === 1) return parts[0];

  const [last, ...rest] = parts;
  const initials = rest
    .map((token) => {
      const letters = token.replace(/[^A-Za-zА-Яа-яЁё]/g, "");
      if (!letters) return "";
      // «Е.В.» — уже инициалы: каждая буква становится инициалом
      if (token.includes(".")) {
        return letters
          .split("")
          .map((letter) => `${letter.toUpperCase()}.`)
          .join("");
      }
      return `${letters[0].toUpperCase()}.`;
    })
    .join("");

  return initials ? `${last} ${initials}` : last;
};
