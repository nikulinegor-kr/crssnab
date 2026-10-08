/** Сопоставление перевозчика со страницей отслеживания груза. */
interface CarrierRule {
  match: RegExp;
  url: (ttn: string) => string;
  /** true — номер подставляется в ссылку, иначе нужно вставить вручную. */
  direct: boolean;
}

const enc = encodeURIComponent;

const RULES: CarrierRule[] = [
  { match: /делов|dellin/i, url: (t) => `https://www.dellin.ru/tracker/?rwID=${enc(t)}`, direct: true },
  { match: /тройк|troyka/i, url: () => "https://troyka-dv.ru/poiskpottn.html", direct: false },
  { match: /слтк|sltk/i, url: () => "https://xn--j1abrf.xn--p1ai/trek-nomer", direct: false },
  { match: /пэк|pecom|\bpek\b/i, url: (t) => `https://pecom.ru/services-are/order-status/?cargoCodes=${enc(t)}`, direct: true },
  { match: /сдэк|cdek/i, url: (t) => `https://www.cdek.ru/ru/tracking?order_id=${enc(t)}`, direct: true },
  { match: /возовоз|vozovoz/i, url: (t) => `https://vozovoz.ru/tracking/?code=${enc(t)}`, direct: true },
  { match: /энерги|nrg/i, url: () => "https://nrg-tk.ru/client/tracking/", direct: false },
  { match: /байкал|baikal/i, url: () => "https://www.baikalsr.ru/tools/tracking/", direct: false },
];

export const getCarrierTracker = (carrier: string | null | undefined, ttn: string) => {
  if (!carrier) return null;
  const rule = RULES.find((r) => r.match.test(carrier));
  return rule ? { url: rule.url(ttn.trim()), direct: rule.direct } : null;
};
