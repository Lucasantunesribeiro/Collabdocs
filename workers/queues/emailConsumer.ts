import { logger } from '../lib/logger';

export interface EmailNotificationMessage {
  type: 'collaborator_added';
  toEmail: string;
  toName: string;
  documentTitle: string;
  documentId: string;
  addedByName: string;
  permission: string;
}

/**
 * Sends email via MailChannels (free with Cloudflare Workers).
 * Falls back to logging if MAILCHANNELS is not available.
 */
async function sendEmail(msg: EmailNotificationMessage): Promise<void> {
  const subject = `You were added as a collaborator — ${msg.documentTitle}`;
  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #3b82f6;">CollabDocs</h2>
      <p>Hi ${msg.toName},</p>
      <p>
        <strong>${msg.addedByName}</strong> added you as a
        <strong>${msg.permission}</strong> on the document
        "<strong>${msg.documentTitle}</strong>".
      </p>
      <p>
        <a href="https://collabdocs-app.vercel.app/document/${msg.documentId}"
           style="background:#3b82f6;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:12px">
          Open Document
        </a>
      </p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">
        You can manage your notifications in your account settings.
      </p>
    </div>
  `;

  const payload = {
    personalizations: [{ to: [{ email: msg.toEmail, name: msg.toName }] }],
    from: { email: 'noreply@collabdocs.workers.dev', name: 'CollabDocs' },
    subject,
    content: [{ type: 'text/html', value: htmlBody }],
  };

  const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok && response.status !== 202) {
    const text = await response.text().catch(() => 'unknown error');
    throw new Error(`MailChannels returned ${response.status}: ${text}`);
  }
}

/**
 * Cloudflare Queue consumer handler.
 * Registered in wrangler.toml as [[queues.consumers]].
 */
export async function processEmailQueue(
  batch: MessageBatch<EmailNotificationMessage>
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await sendEmail(message.body);
      logger.info('Email notification sent', {
        to: message.body.toEmail,
        documentId: message.body.documentId,
        type: message.body.type,
      });
      message.ack();
    } catch (error) {
      logger.error('Failed to send email notification', error, {
        to: message.body.toEmail,
        documentId: message.body.documentId,
      });
      // retry=true by default — Cloudflare will retry up to queue's maxRetries
      message.retry();
    }
  }
}
