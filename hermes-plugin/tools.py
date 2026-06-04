"""Tool handlers for the Pebble communication protocol."""

import json
import logging

logger = logging.getLogger(__name__)


def _validate_spec(spec: str) -> str | None:
    """Return an error string if the spec is invalid, else None.

    `spec` is OpenUI Lang source: a string of `name = Expression` lines that
    must define `root = Stack([...])`. (It is NOT a json-render `{root,
    elements}` node tree — that format is gone.)
    """
    if not isinstance(spec, str):
        return "spec must be a string of OpenUI Lang source"
    if not spec.strip():
        return "spec must not be empty"
    if "root" not in spec:
        return "spec must define a 'root' entry point (root = Stack([...]))"
    return None


def pebble_send(args: dict, **kwargs) -> str:
    """
    Single handler for all outbound Pebble communication.

    Pebble intercepts the tool call from the Hermes SSE stream and
    renders it client-side. This handler validates the payload and
    returns a structured result — no direct HTTP call needed.
    """
    msg_type = args.get("type")
    content = args.get("content")
    spec = args.get("spec")
    status = args.get("status")
    label = args.get("label")
    priority = args.get("priority", "normal")

    # session_id is implicit: the agent is replying inside a session's chat
    # stream, and Pebble routes the rendered output by that stream's session —
    # it ignores any session_id in the payload. So we never require it from the
    # agent (asking made it burn tool calls hunting for an id it can't easily
    # know). Fall back to the run's session_id from kwargs when present.
    session_id = args.get("session_id") or kwargs.get("session_id")

    # ── Type-specific validation ─────────────────────────────────────────

    if msg_type == "message":
        if not content:
            return json.dumps({"error": "type='message' requires 'content'"})

    elif msg_type == "ui":
        if not spec:
            return json.dumps({"error": "type='ui' requires 'spec'"})
        err = _validate_spec(spec)
        if err:
            return json.dumps({"error": f"invalid spec: {err}"})

    elif msg_type == "status":
        if not status:
            return json.dumps({"error": "type='status' requires 'status'"})

    elif msg_type == "push":
        if not content and not spec:
            return json.dumps({"error": "type='push' requires at least one of: content, spec"})
        if spec:
            err = _validate_spec(spec)
            if err:
                return json.dumps({"error": f"invalid spec: {err}"})
        if priority not in ("low", "normal", "high"):
            return json.dumps({"error": "priority must be 'low', 'normal', or 'high'"})

    else:
        return json.dumps({"error": f"unknown type '{msg_type}'"})

    # ── Build the outbound payload ────────────────────────────────────────

    payload = {"type": msg_type}

    if session_id:
        payload["session_id"] = session_id
    if content:
        payload["content"] = content
    if spec:
        payload["spec"] = spec
    if status:
        payload["status"] = status
    if label:
        payload["label"] = label
    if msg_type == "push":
        payload["priority"] = priority

    logger.debug("pebble_send: %s", payload)

    # Pebble reads this tool call from the SSE stream and renders it client-side.
    # The handler just validates and acknowledges — no HTTP call back to Pebble.
    return json.dumps({"ok": True, "sent": payload})