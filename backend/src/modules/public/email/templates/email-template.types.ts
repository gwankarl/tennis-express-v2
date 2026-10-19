export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface ActionEmailTemplateInput {
  recipientName: string;
  actionUrl: string;
}
