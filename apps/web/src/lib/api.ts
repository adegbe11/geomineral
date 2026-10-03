export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    let message = "The service is unavailable. Please try again shortly.";
    try {
      const body = await response.json();
      message =
        typeof body.detail === "string"
          ? body.detail
          : body.detail?.[0]?.msg || message;
    } catch {
      /* proxy failures may not be JSON */
    }
    throw new Error(message);
  }
  return response.json();
}
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const coordinates = (p: { lat: number; lng: number }) =>
  `${Math.abs(p.lat).toFixed(4)}° ${p.lat >= 0 ? "N" : "S"}, ${Math.abs(p.lng).toFixed(4)}° ${p.lng >= 0 ? "E" : "W"}`;
