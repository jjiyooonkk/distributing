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

    if ('assignments' in project.results) {
      // Schedule mode: send per-person schedule
      const schedResult = project.results as { assignments: { date: string; roomName: string; personId: string }[]; dates: string[] };
      const personSchedule = new Map<string, Map<string, string>>();
      for (const a of schedResult.assignments) {
        if (!personSchedule.has(a.personId)) personSchedule.set(a.personId, new Map());
        personSchedule.get(a.personId)!.set(a.date, a.roomName);
      }

      for (const person of project.data) {
        const schedule = personSchedule.get(person.id);
        if (!schedule || schedule.size === 0) continue;

        const contact = person[contactColumn];
        if (!contact) { failed++; continue; }

        // Merge consecutive dates with same room into ranges
        const sortedDates = schedResult.dates.filter((d: string) => schedule.has(d));
        const ranges: { start: string; end: string; room: string }[] = [];
        for (const d of sortedDates) {
          const room = schedule.get(d)!;
          const last = ranges[ranges.length - 1];
          if (last && last.room === room) {
            last.end = d;
          } else {
            ranges.push({ start: d, end: d, room });
          }
        }
        const scheduleLines = ranges
          .map((r) => r.start === r.end ? `${r.start} ${r.room}` : `${r.start}~${r.end} ${r.room}`)
          .join('\n');

        let message = messageTemplate
          .replace('{{name}}', person['이름'] || person['name'] || person['Name'] || person['성명'] || '')
          .replace('{{schedule}}', scheduleLines)
          .replace('{{group}}', schedule.values().next().value || '');

        for (const [key, val] of Object.entries(person)) {
          message = message.replace(`{{${key}}}`, val || '');
        }

        let ok = false;
        if (channel === 'telegram') {
          ok = await sendTelegram(telegramBotToken, contact, message);
        } else if (channel === 'sms') {
          ok = await sendSMS(twilioAccountSid, twilioAuthToken, twilioFromNumber, contact, message);
        }
        if (ok) sent++; else failed++;
      }
    } else {
      // Group mode
      for (const group of project.results.groups) {
        for (const member of group.members) {
          const contact = member[contactColumn];
          if (!contact) { failed++; continue; }

          let message = messageTemplate
            .replace('{{group}}', group.name)
            .replace('{{name}}', member['이름'] || member['name'] || member['Name'] || '');

          for (const [key, val] of Object.entries(member)) {
            message = message.replace(`{{${key}}}`, val || '');
          }

          let ok = false;
          if (channel === 'telegram') {
            ok = await sendTelegram(telegramBotToken, contact, message);
          } else if (channel === 'sms') {
            ok = await sendSMS(twilioAccountSid, twilioAuthToken, twilioFromNumber, contact, message);
          }
          if (ok) sent++; else failed++;
        }
      }
    }

    return NextResponse.json({ sent, failed, total: sent + failed });
  } catch (e) {
    console.error('POST /api/notify error:', e);
    return NextResponse.json({ error: '발송 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
