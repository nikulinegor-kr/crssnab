export type LabelPeople = { applicant?: string | null; receiver?: string | null };
export function labelPeopleLines(people: LabelPeople): string[] {
 return [`Заявитель: ${people.applicant?.trim() || '—'}`, `Приёмщик: ${people.receiver?.trim() || '—'}`];
}
