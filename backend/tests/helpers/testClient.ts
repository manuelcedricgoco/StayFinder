// Minimal HTTP client that behaves like a browser: it remembers the session cookie.
export class TestClient {
  cookie = '';
  constructor(private baseUrl: string) {}

  async request(method: string, url: string, body?: unknown) {
    const isMultipart = body instanceof FormData;
    const response = await fetch(this.baseUrl + url, {
      method,
      headers: {
        ...(body !== undefined && !isMultipart ? { 'Content-Type': 'application/json' } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      body: body !== undefined ? (isMultipart ? body : JSON.stringify(body)) : undefined,
    });

    const sessionCookie = response.headers
      .getSetCookie()
      .find((c) => c.startsWith('stayfinder_session='));
    if (sessionCookie) {
      const pair = sessionCookie.split(';')[0];
      this.cookie = pair.endsWith('=') ? '' : pair; // a cleared cookie is empty
    }

    const data = (await response.json().catch(() => null)) as Record<string, any> | null;
    return { status: response.status, data };
  }
}
