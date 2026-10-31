/** Only the default entry changes; explicit request/QR URLs remain untouched. */
export function organizationEntryRoute(mobile:boolean):string {
  return mobile ? '/executive' : '/requests';
}