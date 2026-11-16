import { REQUEST_SECTION_OPEN_EVENT } from "./FormSectionCard";

const ITEMS = [
  { id: "req-sec-main", label: "Заявка" },
  { id: "req-sec-invoice", label: "Счета" },
  { id: "req-sec-items", label: "Позиции" },
  { id: "req-sec-logistics", label: "Логистика" },
  { id: "req-sec-zrs", label: "ЗРС" },
];

/** Section navigation for the request forms: opens the block and scrolls to it. */
export const RequestFormNav = () => (
  <nav className="request-form-nav" aria-label="Разделы заявки">
    {ITEMS.map((item) => (
      <button
        key={item.id}
        type="button"
        className="request-form-nav__item"
        onClick={(e) => {
          window.dispatchEvent(new CustomEvent(REQUEST_SECTION_OPEN_EVENT, { detail: item.id }));
          const win = e.currentTarget.closest(".request-form-redesign") ?? document;
          window.requestAnimationFrame(() => {
            const body = win.querySelector<HTMLElement>(".request-form-body");
            const target = win.querySelector<HTMLElement>(`[data-request-section="${item.id}"]`);
            if (!body || !target) return;
            const top = target.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 12;
            body.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
          });
        }}
      >
        {item.label}
      </button>
    ))}
  </nav>
);
