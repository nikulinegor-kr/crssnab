export const CLAUDE_MODEL = "claude-sonnet-5-5";
export async function callClaude(apiKey: string, body: Record<string, unknown>, fetcher = fetch) {
  const signal = AbortSignal.timeout(60_000);
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetcher("https://api.anthropic.com/v1/messages", {
      method: "POST", signal,
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ max_tokens: 2048, ...body, model: CLAUDE_MODEL }),
    });
    if ([429, 529].includes(response.status) && attempt < 2) {
      await response.body?.cancel();
      await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(response.status === 404 ? "Указанная модель Claude недоступна в Anthropic. Требуется проверить её название." : response.status === 401 ? "Anthropic отклонил ключ. Проверьте настройку доступа." : "Claude временно недоступен. Попробуйте позже.");
    }
    return await response.json();
  }
  throw new Error("Claude перегружен. Попробуйте позже.");
}
