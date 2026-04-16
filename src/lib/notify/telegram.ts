const TELEGRAM_API = 'https://api.telegram.org/bot';

export async function sendTelegram(
  botToken: string,
  chatId: string,
  message: string
): Promise<boolean> {
  const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    }),
  });
  return res.ok;
}
