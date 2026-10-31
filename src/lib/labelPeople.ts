export type LabelPeople = { applicant?: string | null; receiver?: string | null };
export function labelPeopleLines(people: LabelPeople): string[] {
 return [`Заявитель: ${people.applicant?.trim() || '—'}`, `Приёмщик: ${people.receiver?.trim() || '—'}`];
}

/** Old stored label metadata must not reintroduce request numbers or unit IDs. */
export function labelVisibleLines(lines: string[]): string[] {
 return lines.map(line=>line.trim()).filter(line=>line && !/^(?:REQ\s*[-–:]|ID\s*:|\d{4}-\d+$)/i.test(line));
}
