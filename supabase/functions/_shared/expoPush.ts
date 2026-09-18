// Minimal Expo push sender — no SDK needed, it's a plain HTTPS POST.
export async function sendExpoPush(tokens: string[], title: string, body: string) {
  if (tokens.length === 0) return;

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(tokens.map((to) => ({ to, title, body }))),
  });
}
