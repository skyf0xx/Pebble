"""Tool schemas — what the LLM sees for the Pebble protocol."""

PEBBLE_SEND = {
    "name": "pebble_send",
    "description": (
        "Send any message to the user's Pebble chat interface. "
        "Use this for ALL communication with the user — text replies, interactive UI blocks, "
        "session status updates, and proactive background pushes. "
        "Never write a plain text reply when Pebble is the active interface — always use this tool. "
        "\n\n"
        "Message types:\n"
        "  - 'message'  : a final text reply to the user (most common)\n"
        "  - 'ui'       : an interactive UI block (buttons, forms, tables, charts)\n"
        "  - 'status'   : update the session status shown in the Pebble session list\n"
        "  - 'push'     : proactive notification not tied to a user turn\n"
        "\n"
        "Streaming: a typing indicator is shown automatically while you work. "
        "Just call this tool once with your final content — no need to manage streaming yourself."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "session_id": {
                "type": "string",
                "description": (
                    "The Pebble session ID to send to. "
                    "Use the session_id from the most recent user message or ui_action. "
                    "Omit only for 'push' messages not tied to any session."
                ),
            },
            "type": {
                "type": "string",
                "enum": ["message", "ui", "status", "push"],
                "description": (
                    "Message type:\n"
                    "  'message' — text reply, renders as a chat bubble\n"
                    "  'ui'      — interactive json-render block (buttons, forms, tables)\n"
                    "  'status'  — update session status (active/waiting/done/error)\n"
                    "  'push'    — proactive push, can include text and/or a UI block"
                ),
            },
            "content": {
                "type": "string",
                "description": (
                    "Text content. Required for type='message'. "
                    "Optional alongside 'spec' for type='push'. "
                    "Supports markdown."
                ),
            },
            "spec": {
                "type": "object",
                "description": (
                    "A json-render spec for interactive UI. Required for type='ui', "
                    "optional for type='push'. "
                    "Must have a 'root' key (ID of the root element) and an 'elements' map. "
                    "Each element: { type, props?, children?, on? }. "
                    "Available types: Stack, Card, Separator, Collapsible, "
                    "Heading, Badge, Alert, Progress, Table, Avatar, Image, "
                    "Button, Link, Checkbox, Radio. "
                    "Button intent: 'confirm' | 'dismiss' | 'destructive'. "
                    "Event binding shape: { \"action\": \"name\", \"params\": {} }"
                ),
            },
            "status": {
                "type": "string",
                "enum": ["active", "waiting", "done", "error"],
                "description": (
                    "Session status. Required for type='status'. "
                    "  'active'  — agent is working\n"
                    "  'waiting' — agent needs user input\n"
                    "  'done'    — task complete\n"
                    "  'error'   — something went wrong"
                ),
            },
            "label": {
                "type": "string",
                "description": (
                    "Optional. Rename the session in the Pebble session list. "
                    "Use a short task description, e.g. 'Fix deploy script'. "
                    "Can be set on any message type."
                ),
            },
            "priority": {
                "type": "string",
                "enum": ["low", "normal", "high"],
                "description": "Notification priority for type='push'. Default: 'normal'.",
            },
        },
        "required": ["type"],
    },
}