export interface PushDevice { id: string; token: string; p256dh: string | null; auth: string | null; fail_count: number }
export async function deliverWebPush(device: PushDevice, send: () => Promise<unknown>, storage: { remove: (id: string) => Promise<unknown>; update: (id: string, patch: { last_success_at?: string; fail_count: number }) => Promise<unknown> }) {
  try {
    await send();
    await storage.update(device.id, { last_success_at: new Date().toISOString(), fail_count: 0 });
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) { await storage.remove(device.id); return "removed"; }
    await storage.update(device.id, { fail_count: device.fail_count + 1 });
    return "failed";
  }
}
