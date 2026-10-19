import type { NotificationTemplateKey } from "@/models/Notification";

export interface TemplateDef {
  subject: string;
  body: string;
  smsBody: string;
  /** Transactional/security messages ignore channel preferences for email. */
  transactional?: boolean;
  /** Marketing requires explicit marketing consent. */
  marketing?: boolean;
}

export const DEFAULT_TEMPLATES: Record<NotificationTemplateKey, TemplateDef> = {
  registration: {
    subject: "Welcome to iPay Ghana",
    body: "Hi {{name}}, welcome to iPay Ghana. Browse iPhones and choose a plan that fits your budget.",
    smsBody: "Welcome to iPay Ghana, {{name}}. Your account is ready.",
  },
  verification_result: {
    subject: "Your identity verification: {{status}}",
    body: "Hi {{name}}, your identity verification is now {{status}}. {{note}}",
    smsBody: "iPay Ghana: your identity verification is {{status}}.",
  },
  application_approved: {
    subject: "Order {{orderNumber}} approved",
    body: "Good news {{name}} — your application for {{product}} has been approved. Pay your deposit of {{deposit}} to continue.",
    smsBody: "iPay Ghana: order {{orderNumber}} approved. Pay your deposit of {{deposit}} to continue.",
  },
  application_rejected: {
    subject: "Update on order {{orderNumber}}",
    body: "Hi {{name}}, we are unable to approve your application for {{product}} at this time. Reason: {{reason}}. Contact support if you have questions.",
    smsBody: "iPay Ghana: we could not approve order {{orderNumber}}. Details in your account.",
  },
  deposit_confirmed: {
    subject: "Deposit received for {{orderNumber}}",
    body: "Thank you {{name}}. We have confirmed your deposit of {{amount}} for {{product}}. Outstanding balance: {{outstanding}}.",
    smsBody: "iPay Ghana: deposit of {{amount}} confirmed for {{orderNumber}}. Balance {{outstanding}}.",
  },
  device_ready: {
    subject: "Your {{product}} is ready for collection",
    body: "Hi {{name}}, your {{product}} (order {{orderNumber}}) is ready for collection. Please bring a valid ID.",
    smsBody: "iPay Ghana: your {{product}} is ready for collection. Bring a valid ID.",
  },
  device_collected: {
    subject: "Device collected — order {{orderNumber}}",
    body: "Hi {{name}}, we've recorded the collection of your {{product}}. Enjoy your new iPhone!",
    smsBody: "iPay Ghana: collection of your {{product}} recorded. Enjoy!",
  },
  payment_reminder: {
    subject: "Upcoming payment of {{amount}} on {{dueDate}}",
    body: "Hi {{name}}, a friendly reminder that installment {{installmentNumber}} of {{amount}} for order {{orderNumber}} is due on {{dueDate}}.",
    smsBody: "iPay Ghana: reminder — {{amount}} due {{dueDate}} for order {{orderNumber}}.",
  },
  payment_confirmed: {
    subject: "Payment received — {{amount}}",
    body: "Thank you {{name}}. We have confirmed your payment of {{amount}} (ref {{reference}}) for order {{orderNumber}}. Outstanding balance: {{outstanding}}.",
    smsBody: "iPay Ghana: payment of {{amount}} confirmed. Ref {{reference}}. Balance {{outstanding}}.",
  },
  payment_failed: {
    subject: "Payment not completed",
    body: "Hi {{name}}, your payment of {{amount}} (ref {{reference}}) was not completed. No money has been applied to your balance. You can try again from your account.",
    smsBody: "iPay Ghana: payment {{reference}} was not completed. You can retry from your account.",
  },
  installment_overdue: {
    subject: "Installment {{installmentNumber}} is overdue",
    body: "Hi {{name}}, installment {{installmentNumber}} of {{amount}} for order {{orderNumber}} was due on {{dueDate}}. Please make a payment when you can, or contact us if you need help.",
    smsBody: "iPay Ghana: installment of {{amount}} due {{dueDate}} is outstanding. Contact us if you need help.",
  },
  refund_processed: {
    subject: "Refund processed — {{amount}}",
    body: "Hi {{name}}, a {{type}} of {{amount}} has been processed for payment {{reference}}. Outstanding balance: {{outstanding}}.",
    smsBody: "iPay Ghana: {{type}} of {{amount}} processed for {{reference}}.",
  },
  plan_completed: {
    subject: "Congratulations — plan completed!",
    body: "Congratulations! You have completed your iPay Ghana installment plan. Your outstanding balance is GH₵0.00. You can now explore and order your next device.",
    smsBody: "iPay Ghana: congratulations! Your plan for {{product}} is complete. Balance GH₵0.00.",
  },
  password_reset: {
    subject: "Reset your iPay Ghana password",
    body: "Hi {{name}}, use this link to reset your password. It expires in 30 minutes: {{link}}. If you did not request this, ignore this message.",
    smsBody: "iPay Ghana password reset requested. Check your email.",
    transactional: true,
  },
  promotion: {
    subject: "{{title}}",
    body: "{{body}}",
    smsBody: "{{title}} — {{body}}",
    marketing: true,
  },
};

export function renderTemplate(text: string, vars: Record<string, string | number | null | undefined>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => {
    const v = vars[k];
    return v == null ? "" : String(v);
  });
}
