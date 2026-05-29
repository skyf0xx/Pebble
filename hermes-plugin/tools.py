"""Tool handlers for the Pebble communication protocol."""

import json
import logging

logger = logging.getLogger(__name__)


def _validate_spec(spec: dict) -> str | None:
    """Return an error string if the spec is invalid, else None."""
    if not isinstance(spec, dict):
        return "spec must be an object"
    if "root" not in spec:
        return "spec must have a 'root' key"
    if "elements" not in spec or not isinstance(spec["elements"], dict):
        return "spec must have an 'elements' map"
    if spec["root"] not in spec["elements"]:
        return f"root element '{spec['root']}' not found in elements"
    return None


def pebble_send(args: dict, **kwargs) -> str:
    """
    Single handler for all outbound Pebble communication.

    Pebble intercepts the tool call from the Hermes SSE stream and
    renders it client-side. This handler validates the payload and
    returns a structured result — no direct HTTP call needed.
    """
    msg_type = args.get("type")
    session_id = args.get("session_id")
    content = args.get("content")
    spec = args.get("spec")
    status = args.get("status")
    label = args.get("label")
    priority = args.get("priority", "normal")

    # ── Type-specific validation ─────────────────────────────────────────

    if msg_type == "message":
        if not content:
            return json.dumps({"error": "type='message' requires 'content'"})
        if not session_id:
            return json.dumps({"error": "type='message' requires 'session_id'"})

    elif msg_type == "ui":
        if not spec:
            return json.dumps({"error": "type='ui' requires 'spec'"})
        if not session_id:
            return json.dumps({"error": "type='ui' requires 'session_id'"})
        err = _validate_spec(spec)
        if err:
            return json.dumps({"error": f"invalid spec: {err}"})

    elif msg_type == "status":
        if not status:
            return json.dumps({"error": "type='status' requires 'status'"})
        if not session_id:
            return json.dumps({"error": "type='status' requires 'session_id'"})

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