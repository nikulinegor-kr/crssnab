export type LabelPeople = { applicant?: string | null; receiver?: string | null };
export function labelPeopleLines(people: LabelPeople): string[] {
 return [`Заявитель: ${people.applicant?.trim() || '—'}`, `Приёмщик: ${people.receiver?.trim() || '—'}`];
}

/** Old stored label metadata must not reintroduce request numbers or unit IDs. */
export function labelVisibleLines(lines: string[]): string[] {
 return lines.map(line=>line.trim()).filter(line=>line
  && !/^(?:REQ\s*[-–:]|ID\s*:|\d{4}-\d+$)/i.test(line)
  && !/^(?:Материал|Изделие)(?:\s*·.*)?$/i.test(line)
  && !/^(?:[\d.,]+|—)\s+(?:шт\.?|ед\.?|мм|см|м|км|м²|м³|кг|г|т|л|мл|—)$/i.test(line)
  && !/^(?:шт\.?|ед\.?)$/i.test(line));
}
