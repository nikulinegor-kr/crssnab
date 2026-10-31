import { type QrKind } from "./warehouseQr";

import type { LabelPeople } from './labelPeople';
export interface LabelInput extends LabelPeople {
  kind: QrKind;
  token: string;
  title: string;
  lines: string[];
}

