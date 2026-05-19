import { useEffect } from "react";

/**
 * Глобальное поведение для мобильной клавиатуры:
 * 1. Сохраняет фокус активного поля при изменении высоты visualViewport
 *    (открытие/закрытие клавиатуры iOS/Android), чтобы курсор не "терялся".
 * 2. Автоматически прокручивает активное поле в видимую область при фокусе
 *    и при ресайзе visualViewport — форма не уезжает за клавиатуру.
 *
 * Подключается один раз на уровне App.
 */
export function useMobileKeyboardFocus() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isEditable = (el: Element | null): el is HTMLElement => {
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT") {
        const type = (el as HTMLInputElement).type;
        // Чекбоксы/радио/кнопки не нужно скроллить
        return !["checkbox", "radio", "button", "submit", "reset", "hidden", "range", "color"].includes(type);
      }
      if (tag === "TEXTAREA") return true;
      if ((el as HTMLElement).isContentEditable) return true;
      return false;
    };

    const scrollIntoView = (el: HTMLElement) => {
      // requestAnimationFrame даёт браузеру отработать ресайз/раскладку
      requestAnimationFrame(() => {
        try {
          el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        } catch {
          el.scrollIntoView();
        }
      });
    };

    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleScroll = (el: HTMLElement, delay = 250) => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => scrollIntoView(el), delay);
    };

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null;
      if (!isEditable(target)) return;
      // На iOS клавиатура анимируется ~250ms — ждём, затем скроллим
      scheduleScroll(target as HTMLElement, 280);
    };

    // При изменении высоты visualViewport (показ/скрытие клавиатуры,
    // поворот экрана) удерживаем фокус и прокрутку.
    const vv = window.visualViewport;
    let lastHeight = vv?.height ?? window.innerHeight;

    const onViewportChange = () => {
      const active = document.activeElement;
      if (!isEditable(active)) {
        lastHeight = vv?.height ?? window.innerHeight;
        return;
      }
      const newHeight = vv?.height ?? window.innerHeight;
      // Высота уменьшилась — клавиатура открылась
      if (newHeight < lastHeight - 80) {
        scheduleScroll(active as HTMLElement, 120);
      }
      lastHeight = newHeight;
    };

    document.addEventListener("focusin", onFocusIn);
    vv?.addEventListener("resize", onViewportChange);
    vv?.addEventListener("scroll", onViewportChange);

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      vv?.removeEventListener("resize", onViewportChange);
      vv?.removeEventListener("scroll", onViewportChange);
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, []);
}
