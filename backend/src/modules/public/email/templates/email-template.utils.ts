export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[character];
  });
}

export function validateActionUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('A valid action URL is required.');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('The action URL must use HTTP or HTTPS.');
  }

  return url.toString();
}

export function getGreeting(recipientName: string): string {
  const name = recipientName.trim();

  return name ? `Hello, ${name}` : 'Hello';
}

export function getEmailLayout(content: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <title>Tennis-Xpress</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#202938;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Tennis-Xpress account notification
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;">
            <tr>
              <td style="padding:32px 28px;">
                <p style="margin:0 0 24px;font-size:22px;font-weight:bold;color:#176b45;">Tennis-Xpress</p>
                ${content}
                <hr style="margin:32px 0 20px;border:0;border-top:1px solid #e5e7eb;" />
                <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
                  If you did not request this, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">
            Tennis-Xpress account services
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function getActionButton(label: string, url: string): string {
  return `<p style="margin:28px 0;">
    <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 22px;background:#176b45;color:#ffffff;text-decoration:none;font-weight:bold;border-radius:6px;">
      ${escapeHtml(label)}
    </a>
  </p>`;
}
