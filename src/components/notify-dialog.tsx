'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ColumnMeta } from '@/types';

interface NotifyDialogProps {
  open: boolean;
  onClose: () => void;
  columns: ColumnMeta[];
  projectCode: string;
}

export default function NotifyDialog({
  open,
  onClose,
  columns,
  projectCode,
}: NotifyDialogProps) {
  const [channel, setChannel] = useState<'telegram' | 'sms'>('telegram');
  const [contactColumn, setContactColumn] = useState(columns[0]?.name || '');
  const [messageTemplate, setMessageTemplate] = useState(
    '안녕하세요 {{이름}}님, {{group}}에 배정되었습니다.'
  );
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioFromNumber, setTwilioFromNumber] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; error?: string } | null>(null);
  const [tgUsers, setTgUsers] = useState<{ chatId: number; username: string; firstName: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // username→chatId map
  const usernameMap = new Map<string, number>();
  for (const u of tgUsers) {
    if (u.username) usernameMap.set(u.username.toLowerCase(), u.chatId);
  }

  async function fetchTelegramUsers() {
    if (!telegramBotToken) return;
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/telegram-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: telegramBotToken }),
      });
      const data = await res.json();
      if (data.users) setTgUsers(data.users);
      else alert(data.error || '조회 실패');
    } catch {
      alert('조회 실패');
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      // Build username→chatId mapping for Telegram
      const usernameToChatId: Record<string, number> = {};
      if (channel === 'telegram') {
        for (const u of tgUsers) {
          if (u.username) usernameToChatId[u.username.toLowerCase()] = u.chatId;
        }
      }

      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: projectCode,
          channel,
          contactColumn,
          messageTemplate,
          telegramBotToken,
          twilioAccountSid,
          twilioAuthToken,
          twilioFromNumber,
          usernameToChatId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ sent: 0, failed: -1, error: data.error || '발송 실패' });
      } else {
        const errMsg = data.errors?.length ? `\n${data.errors.join('\n')}` : '';
        setResult({
          sent: data.sent ?? 0,
          failed: data.failed ?? 0,
          error: data.failed > 0 ? errMsg : undefined,
        });
      }
    } catch (e) {
      setResult({ sent: 0, failed: -1, error: e instanceof Error ? e.message : '네트워크 오류' });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>결과 발송</DialogTitle>
          <DialogDescription>
            배정 결과를 각 인원의 연락처로 발송합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>발송 채널</Label>
            <Select value={channel} onValueChange={(v) => v && setChannel(v as 'telegram' | 'sms')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="sms">SMS (Twilio)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>연락처 칼럼</Label>
            <Select value={contactColumn} onValueChange={(v) => v && setContactColumn(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {channel === 'telegram' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Telegram Bot Token</Label>
                <Input
                  type="password"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  placeholder="123456:ABC-DEF..."
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchTelegramUsers}
                  disabled={loadingUsers || !telegramBotToken}
                >
                  {loadingUsers ? '조회 중...' : '봇에 /start한 유저 조회'}
                </Button>
                {tgUsers.length > 0 && (
                  <span className="text-xs text-muted-foreground">{tgUsers.length}명 감지</span>
                )}
              </div>
              {tgUsers.length > 0 && (
                <div className="text-xs bg-muted p-2 rounded-md max-h-32 overflow-y-auto space-y-0.5">
                  {tgUsers.map((u) => (
                    <div key={u.chatId}>
                      {u.username || u.firstName} → <span className="font-mono">{u.chatId}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                연락처 칼럼에 @username 또는 chat ID(숫자)를 넣으세요. @username은 자동으로 chat ID로 변환됩니다.
              </p>
            </div>
          )}

          {channel === 'sms' && (
            <>
              <div className="space-y-2">
                <Label>Twilio Account SID</Label>
                <Input
                  type="password"
                  value={twilioAccountSid}
                  onChange={(e) => setTwilioAccountSid(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Twilio Auth Token</Label>
                <Input
                  type="password"
                  value={twilioAuthToken}
                  onChange={(e) => setTwilioAuthToken(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>발신 번호</Label>
                <Input
                  value={twilioFromNumber}
                  onChange={(e) => setTwilioFromNumber(e.target.value)}
                  placeholder="+1234567890"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>메시지 템플릿</Label>
            <Textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {'{{group}}'}은 그룹명, {'{{칼럼명}}'}은 해당 칼럼 값으로 치환됩니다.
            </p>
          </div>

          {result && (
            <div className={`text-sm p-3 rounded-md whitespace-pre-wrap ${result.failed !== 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>
              {result.sent > 0 || result.failed > 0
                ? `발송 완료: 성공 ${result.sent}건, 실패 ${result.failed}건`
                : ''}
              {result.error && `\n${result.error}`}
            </div>
          )}

          <Button className="w-full" onClick={handleSend} disabled={sending}>
            {sending ? '발송 중...' : '발송하기'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
