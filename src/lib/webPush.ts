export type WebPushState = "unsupported" | "needs-install" | "server-pending" | "default" | "granted-subscribed" | "denied";
export function getWebPushState(input: { supported: boolean; ios: boolean; standalone: boolean; permission: string; subscribed: boolean; configured: boolean }): WebPushState {
  if (input.ios && !input.standalone) return "needs-install";
  if (!input.supported) return "unsupported";
  if (!input.configured) return "server-pending";
  if (input.permission === "denied") return "denied";
  if (input.permission === "granted" && input.subscribed) return "granted-subscribed";
  return "default";
}
export function vapidKeyBytes(key: string): Uint8Array {
  const base64 = (key + "=".repeat((4 - key.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}
