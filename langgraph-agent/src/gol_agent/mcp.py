import os
from typing import Any

import httpx

AAVE_MCP_URL = os.getenv("AAVE_MCP_URL", "https://mcp.aave.com/")
AAVE_SIGNED_RELAY_TOOLS = {"submit_signed_order", "cancel_order"}
MAX_MCP_RESPONSE_BYTES = 4_000_000


def _bounded_json(response: httpx.Response) -> dict[str, Any]:
    response.raise_for_status()
    if len(response.content) > MAX_MCP_RESPONSE_BYTES:
        raise RuntimeError("Aave MCP response exceeded the configured limit")
    body = response.json()
    if not isinstance(body, dict):
        raise RuntimeError("Aave MCP returned an invalid JSON-RPC envelope")
    return body


async def list_aave_mcp_tools() -> list[dict[str, Any]]:
    payload = {
        "jsonrpc": "2.0",
        "id": os.urandom(12).hex(),
        "method": "tools/list",
        "params": {},
    }
    timeout = httpx.Timeout(20.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(AAVE_MCP_URL, json=payload)
        body = _bounded_json(response)
    if body.get("error"):
        raise RuntimeError(body["error"].get("message", "Aave MCP discovery failed"))
    tools = body.get("result", {}).get("tools", [])
    return [tool for tool in tools if isinstance(tool, dict)]


async def call_aave_mcp(name: str, arguments: dict[str, Any]) -> Any:
    if name in AAVE_SIGNED_RELAY_TOOLS:
        raise ValueError("Signed relay tools require an authenticated wallet flow")
    payload = {
        "jsonrpc": "2.0",
        "id": os.urandom(12).hex(),
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
    }
    timeout = httpx.Timeout(20.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(AAVE_MCP_URL, json=payload)
        body = _bounded_json(response)
    if body.get("error"):
        raise RuntimeError(body["error"].get("message", "Aave MCP call failed"))
    return body.get("result")
