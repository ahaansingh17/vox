export const IMESSAGE_TOOL_DEFINITIONS = [
  {
    name: 'list_imessage_conversations',
    description:
      "List recent iMessage/SMS conversations from the user's macOS Messages app. Returns the 50 most recent threads with contact handle and a short snippet. Requires Full Disk Access in System Settings → Privacy & Security.",
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'list_imessage_contacts',
    description:
      "List contacts from the user's macOS AddressBook with their iMessage handles (phone numbers and email addresses). Useful for looking up who to message.",
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'send_imessage',
    description:
      'Send an iMessage or SMS to a contact via the macOS Messages app using AppleScript. The handle must be a phone number (e.g. +14155551234) or email address registered with iMessage.',
    parameters: {
      type: 'object',
      properties: {
        handle: {
          type: 'string',
          description: 'Phone number or email address of the recipient.'
        },
        text: {
          type: 'string',
          description: 'Message text to send.'
        }
      },
      required: ['handle', 'text']
    }
  }
]
