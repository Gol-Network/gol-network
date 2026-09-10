import importlib
import json
import time
import uuid

import pytest
from fastapi.testclient import TestClient
from jsonschema import ValidationError
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from gol_agent.app import app
from gol_agent.catalog import AAVE_TOOLS, GOL_TOOLS
from gol_agent.graph import _select_tool
from gol_agent.tools import TOOL_MAP, refresh_aave_tool_metadata


@pytest.fixture(autouse=True)
def disable_live_discovery(monkeypatch):
    monkeypatch.setenv("AAVE_MCP_DISCOVERY", "false")


def agui_input(prompt: str) -> dict:
    return {
        "threadId": f"thread-{uuid.uuid4().hex}",
        "runId": f"run-{uuid.uuid4().hex}",
        "state": {"ownerAddress": None, "mandateReady": False},
        "messages": [{"id": uuid.uuid4().hex, "role": "user", "content": prompt}],
        "tools": [],
        "context": [],
        "forwardedProps": {},
    }


def event_payloads(body: str) -> list[dict]:
    return [
        json.loads(line.removeprefix("data: "))
        for line in body.splitlines()
        if line.startswith("data: ")
    ]


def test_catalog_exposes_all_gol_and_aave_tools() -> None:
    assert len(GOL_TOOLS) == 12
    assert len(AAVE_TOOLS) == 40
    assert len({tool.name for tool in (*GOL_TOOLS, *AAVE_TOOLS)}) == 52


@pytest.mark.asyncio
async def test_greeting_is_helpful_without_a_model_key(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    result = await importlib.import_module("gol_agent.graph").graph.ainvoke(
        {"messages": [HumanMessage(content="hi")]},
        config={"configurable": {"thread_id": f"test-{uuid.uuid4().hex}"}},
    )

    assert str(result["messages"][-1].content).startswith("Hi!")
    assert "could not select" not in str(result["messages"][-1].content)


@pytest.mark.asyncio
async def test_deterministic_text_is_observably_streamed() -> None:
    model = importlib.import_module("gol_agent.streaming_model").streaming_text_model
    arrivals = []
    async for chunk in model.astream(
        [HumanMessage(content="This response has enough words to produce several visible chunks.")]
    ):
        arrivals.append((time.monotonic(), chunk.content))

    assert len(arrivals) >= 3
    assert arrivals[-1][0] - arrivals[0][0] >= 0.1
    assert "".join(str(content) for _, content in arrivals).startswith("This response")


@pytest.mark.parametrize(
    ("prompt", "expected"),
    [
        ("Create my GOL account", "create_account"),
        ("Add the agent wallet", "provision_agent"),
        ("Add 1 USDC to the agent wallet for network fees", "fund_agent_gas"),
        ("Add 25 USDC to the payment balance", "fund_account"),
        ("Withdraw 5 USDC from payment funds", "withdraw"),
        ("Review my payment rule", "sign_mandate"),
        ("Set the agent spending limit", "sign_mandate"),
        ("Turn off the spending rule", "revoke_mandate"),
        ("Export personal wallet", "export_owner_wallet"),
        ("Refresh payment history", "check_indexing"),
        ("Show my payment activity", "ask_indexed_question"),
        ("Send 10 USDC to Design contractor", "preview_instruction"),
        ("Transfer 10 USDC to Design contractor", "preview_instruction"),
    ],
)
def test_natural_gol_actions_route_to_client_handoffs(prompt: str, expected: str) -> None:
    selected = _select_tool(prompt)
    assert selected is not None
    assert selected[0] == expected


def test_payment_stream_emits_tool_and_chunk_events() -> None:
    with TestClient(app) as client:
        response = client.post("/agent", json=agui_input("Pay 70 USDC to Design contractor"))

    assert response.status_code == 200
    events = event_payloads(response.text)
    event_types = [event["type"] for event in events]
    assert event_types[0] == "RUN_STARTED"
    assert "TOOL_CALL_START" in event_types
    assert "TOOL_CALL_RESULT" in event_types
    assert event_types.count("TEXT_MESSAGE_CONTENT") >= 2
    assert event_types[-1] == "RUN_FINISHED"

    tool_start = next(event for event in events if event["type"] == "TOOL_CALL_START")
    assert tool_start["toolCallName"] == "preview_instruction"
    tool_result = next(event for event in events if event["type"] == "TOOL_CALL_RESULT")
    handoff = json.loads(tool_result["content"])
    assert handoff["source"] == "gol"
    assert handoff["kind"] == "client_handoff"
    assert handoff["safeToExecute"] is False


def test_agent_endpoint_can_require_internal_token(monkeypatch) -> None:
    monkeypatch.setenv("GOL_AGENT_SHARED_SECRET", "test-internal-token")
    with TestClient(app) as client:
        missing = client.post("/agent", json=agui_input("hello"))
        accepted = client.post(
            "/agent",
            json=agui_input("hello"),
            headers={"x-gol-agent-token": "test-internal-token"},
        )

    assert missing.status_code == 401
    assert accepted.status_code == 200


def test_signed_aave_relay_is_not_executed() -> None:
    with TestClient(app) as client:
        response = client.post("/agent", json=agui_input("/tool cancel_order {}"))

    assert response.status_code == 200
    events = event_payloads(response.text)
    tool_result = next(event for event in events if event["type"] == "TOOL_CALL_RESULT")
    assert "authenticated wallet flow" in tool_result["content"]


@pytest.mark.asyncio
async def test_model_driven_runs_can_continue_after_a_tool(monkeypatch) -> None:
    graph_module = importlib.import_module("gol_agent.graph")

    class FakeModel:
        calls = 0

        async def ainvoke(self, _messages):
            self.calls += 1
            if self.calls == 1:
                return AIMessage(
                    content="",
                    tool_calls=[
                        {
                            "name": "check_indexing",
                            "args": {},
                            "id": "model-tool-call",
                            "type": "tool_call",
                        }
                    ],
                )
            return AIMessage(content="The multi-step run is complete.")

    fake_model = FakeModel()
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(graph_module, "_model", lambda: fake_model)
    result = await graph_module.graph.ainvoke(
        {"messages": [HumanMessage(content="Handle this complex request")]},
        config={"configurable": {"thread_id": f"test-{uuid.uuid4().hex}"}},
    )

    assert fake_model.calls == 2
    assert any(isinstance(message, ToolMessage) for message in result["messages"])
    assert result["messages"][-1].content == "The multi-step run is complete."


@pytest.mark.asyncio
async def test_live_discovery_updates_model_tool_schema(monkeypatch) -> None:
    tools_module = importlib.import_module("gol_agent.tools")
    tool = TOOL_MAP["prepare_action"]
    original_description = tool.description
    original_schema = tool.args_schema
    original_validation_schema = tools_module.TOOL_SCHEMAS["prepare_action"]

    async def fake_discovery():
        return [
            {
                "name": "prepare_action",
                "description": "Build an unsigned Aave action.",
                "inputSchema": {
                    "type": "object",
                    "properties": {"action": {"type": "string"}},
                    "required": ["action"],
                    "additionalProperties": False,
                },
            }
        ]

    async def fake_call(name, arguments):
        return {"called": name, "arguments": arguments}

    monkeypatch.setattr(tools_module, "list_aave_mcp_tools", fake_discovery)
    monkeypatch.setattr(tools_module, "call_aave_mcp", fake_call)
    try:
        assert await refresh_aave_tool_metadata() == 1
        assert tool.description == "Build an unsigned Aave action."
        assert tool.args_schema["required"] == ["action"]
        result = json.loads(await tool.ainvoke({"action": "supply"}))
        assert result["result"]["arguments"] == {"action": "supply"}
        with pytest.raises(ValidationError):
            await tool.ainvoke({})
    finally:
        tool.description = original_description
        tool.args_schema = original_schema
        tools_module.TOOL_SCHEMAS["prepare_action"] = original_validation_schema
