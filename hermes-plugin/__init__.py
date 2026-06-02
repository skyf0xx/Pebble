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

# Injected into EVERY Pebble turn. The pebble_send tool description says to use
# the tool "when Pebble is the active interface" — but a cold api_server session
# has no way to know that it *is*. Without this signal the agent defaults to a
# normal CLI chat reply (plain assistant text), which Pebble can't render. This
# per-turn directive is the missing "Pebble is active" assertion, delivered via
# the user message (the only channel pre_llm_call can write to).
#
# Phrased as a neutral *standing* instruction, not a correction. An earlier
# version ("Plain text replies are NOT shown — reply now with pebble_send, not
# plain text") read as accusatory feedback: the agent would call pebble_send
# correctly, then read this and apologize in plain text ("You're right, my
# apologies — the message was delivered…") on every single turn. Stating the
# channel as a fact, without "you did it wrong", stops that loop.
_PROTOCOL_REMINDER = (
    "[Pebble is the active interface] "
    "Deliver your reply to the user through the pebble_send tool — use type "
    "\"message\" for text or \"ui\" for an interactive block. After the "
    "pebble_send call, simply end your turn; no plain-text summary is needed "
    "(plain text isn't shown to the Pebble user)."
)


def _pre_llm_call(session_id, user_message, **kwargs):
    """
    Fires once per turn, before the tool-calling loop.

    Two jobs, both via the {"context": ...} channel (the only one pre_llm_call
    has — context is merged into the user message, never the system prompt):

      1. ui_action envelope → parse it into structured context so Hermes treats
         a UI tap as a response to what it rendered, not raw JSON to puzzle over.
      2. Any other turn → inject the protocol reminder so the agent reliably
         routes its reply through pebble_send instead of replying in plain text.
    """
    if not user_message:
        # Even an empty turn must be answered via pebble_send.
        return {"context": _PROTOCOL_REMINDER}

    msg = user_message.strip()

    # ── ui_action envelope ────────────────────────────────────────────────
    if msg.startswith("{") and "ui_action" in msg:
        try:
            data = json.loads(msg)
        except json.JSONDecodeError:
            data = None

        if data and data.get("ui_action"):
            action = data["ui_action"]
            payload = data.get("payload", {})

            context_lines = [
                "[Pebble UI Interaction]",
                "The user interacted with a UI element you rendered in Pebble.",
                f"Action: {action}",
            ]
            if payload:
                context_lines.append(f"Payload: {json.dumps(payload, indent=2)}")
            context_lines.append(
                "Act on this directly — do not ask the user to rephrase or repeat "
                "themselves."
            )
            # The protocol reminder applies here too — the response still goes
            # out via pebble_send.
            context_lines.append("")
            context_lines.append(_PROTOCOL_REMINDER)

            logger.debug(
                "pebble: parsed ui_action '%s' for session %s", action, session_id
            )
            return {"context": "\n".join(context_lines)}

    # ── Normal turn ───────────────────────────────────────────────────────
    return {"context": _PROTOCOL_REMINDER}


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
