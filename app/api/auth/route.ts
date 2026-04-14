export async function POST(request: Request) {
  const devPassword = process.env.DEV_PASSWORD;
  if (!devPassword) {
    return new Response(JSON.stringify({ error: "Not configured" }), { status: 404 });
  }

  const { password } = (await request.json()) as { password?: string };
  if (password === devPassword) {
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "Wrong password" }, { status: 401 });
}
