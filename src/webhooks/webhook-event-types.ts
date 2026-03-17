export const WEBHOOK_EVENT_TYPES = [
  'user.created',
  'user.updated',
  'api_key.created',
  'api_key.revoked',
  'feature_flag.created',
  'feature_flag.updated',
  'feature_flag.deleted',
  'webhook.created',
  'webhook.updated',
  'webhook.deleted',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const WEBHOOK_EVENT_DESCRIPTIONS: Record<WebhookEventType, string> = {
  'user.created': 'Triggered when a new user is created',
  'user.updated': 'Triggered when a user is updated',
  'api_key.created': 'Triggered when a new API key is created',
  'api_key.revoked': 'Triggered when an API key is revoked',
  'feature_flag.created': 'Triggered when a feature flag is created',
  'feature_flag.updated': 'Triggered when a feature flag is updated',
  'feature_flag.deleted': 'Triggered when a feature flag is deleted',
  'webhook.created': 'Triggered when a webhook is created',
  'webhook.updated': 'Triggered when a webhook is updated',
  'webhook.deleted': 'Triggered when a webhook is deleted',
};
