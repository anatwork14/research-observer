export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const requestUrl = new URL(request.url);
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || request.headers.get("host");
    if (!host) return new URL(origin).origin === requestUrl.origin;

    const protocol = forwardedProtocol || requestUrl.protocol.slice(0, -1);
    return new URL(origin).origin === `${protocol}://${host}`;
  } catch {
    return false;
  }
}
