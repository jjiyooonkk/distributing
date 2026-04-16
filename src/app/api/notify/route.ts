import { NextResponse } from 'next/server';
import { getProject } from '@/lib/project';
import { sendTelegram } from '@/lib/notify/telegram';
import { sendSMS } from '@/lib/notify/sms';

export async function POST(request: Request) {
  try {
    const {
      code,
      channel,
      contactColumn,
      messageTemplate,
      telegramBotToken,
      twilioAccountSid,
      twilioAuthToken,
      twilioFromNumber,
    } = await request.json();

    const project = await getProject(code);
    if (!project || !project.results) {
      return NextResponse.json({ error: '배정 결과가 없습니다.' }, { status: 400 });
    }

    let sent = 0;
    let failed = 0;

    for (const group of project.results.groups) {
      for (const member of group.members) {
        const contact = member[contactColumn];
        if (!contact) {
          failed++;
          continue;
        }

        // Build message from template
        let message = messageTemplate
          .replace('{{group}}', group.name)
          .replace('{{name}}', member['이름'] || member['name'] || member['Name'] || '');

        // Replace any {{column}} placeholders
        for (const [key, val] of Object.entries(member)) {
          message = message.replace(`{{${key}}}`, val || '');
        }

        let ok = false;
        if (channel === 'telegram') {
          ok = await sendTelegram(telegramBotToken, contact, message);
        } else if (channel === 'sms') {
          ok = await sendSMS(twilioAccountSid, twilioAuthToken, twilioFromNumber, contact, message);
        }

        if (ok) sent++;
        else failed++;
      }
    }

    return NextResponse.json({ sent, failed, total: sent + failed });
  } catch (e) {
    console.error('POST /api/notify error:', e);
    return NextResponse.json({ error: '발송 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
