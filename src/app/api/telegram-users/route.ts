import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { botToken } = await request.json();
    if (!botToken) {
      return NextResponse.json({ error: '봇 토큰을 입력해주세요.' }, { status: 400 });
    }

    // Fetch recent messages to the bot
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates?limit=100`
    );
    const data = await res.json();

    if (!data.ok) {
      return NextResponse.json({ error: data.description || '봇 토큰이 잘못되었습니다.' }, { status: 400 });
    }

    // Extract unique users who sent /start or any message
    const users = new Map<number, { chatId: number; username: string; firstName: string }>();
    for (const update of data.result || []) {
      const msg = update.message;
      if (msg?.from) {
        users.set(msg.from.id, {
          chatId: msg.chat.id,
          username: msg.from.username ? `@${msg.from.username}` : '',
          firstName: msg.from.first_name || '',
        });
      }
    }

    return NextResponse.json({ users: [...users.values()] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
