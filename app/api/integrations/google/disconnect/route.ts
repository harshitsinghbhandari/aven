export async function POST() {
  const response = Response.json({ connected: false });
  response.headers.append("set-cookie", "aven_google=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  return response;
}
