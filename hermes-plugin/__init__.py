"""
Pebble plugin — full communication protocol.

All outbound messages go through the `pebble_send` tool (text, UI, status,
push). Pebble intercepts each pebble_send call from the Hermes SSE stream and
renders it client-side.

Inbound ui_action parsing:
  When the user taps a button or submits a form in Pebble, the next turn's
  message arrives as:
    {"ui_action": "action_name", "payload": {...}, "session_id": "..."}
  The pre_llm_call hook parses this and injects structured context so Hermes
  treats it as a UI response and acts on it directly, rather than seeing raw
  JSON it has to puzzle over.

Typing indicator:
  Not handled here. A hook cannot push an event into the SSE stream, so there
  is nothing useful a plugin can do. Pebble shows the "typing…" indicator
  client-side for the duration of the chat/stream request.
"""

import json
import logging

from . import schemas, tools

logger = logging.getLogger(__name__)


# ── Hooks ─────────────────────────────────────────────────────────────────────

def _pre_llm_call(session_id, user_message, **kwargs):
    """
    Fires once per turn, before the tool-calling loop.

    If the incoming message is a Pebble ui_action envelope, parse it and inject
    structured context so Hermes understands it as a response to UI it rendered
    — not free text to re-interpret. Returns a context dict Hermes merges into
    the turn, or None to leave the turn unchanged.
    """
    if not user_message:
        return None

    msg = user_message.strip()
    if not (msg.startswith("{") and "ui_action" in msg):
        return None

    try:
        data = json.loads(msg)
    except json.JSONDecodeError:
        return None

    action = data.get("ui_action")
    if not action:
        return None
    payload = data.get("payload", {})

    context_lines = [
        "[Pebble UI Interaction]",
        "The user interacted with a UI element you rendered in Pebble.",
        f"Action: {action}",
    ]
    if payload:
        context_lines.append(f"Payload: {json.dumps(payload, indent=2)}")
    context_lines.append(
        "Act on this directly — do not ask the user to rephrase or repeat themselves."
    )

    logger.debug("pebble: parsed ui_action '%s' for session %s", action, session_id)
    return {"context": "\n".join(context_lines)}


# ── Registration ──────────────────────────────────────────────────────────────

def register(ctx):
    ctx.register_tool(
        name="pebble_send",
        toolset="pebble",
        schema=schemas.PEBBLE_SEND,
        handler=tools.pebble_send,
    )

    ctx.register_hook("pre_llm_call", _pre_llm_call)

    # Bundle the protocol skill so the agent loads it with:
    #   skill_view("pebble:pebble-protocol")
    from pathlib import Path
    skills_dir = Path(__file__).parent / "skills"
    for child in sorted(skills_dir.iterdir()):
        skill_md = child / "SKILL.md"
        if child.is_dir() and skill_md.exists():
            ctx.register_skill(child.name, skill_md)
