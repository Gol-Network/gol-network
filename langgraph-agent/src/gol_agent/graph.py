import json
import os
import re
import uuid
from typing import Any, NotRequired

from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from .catalog import TOOL_BY_NAME
from .streaming_model import streaming_text_model
from .tools import TOOLS

SYSTEM_PROMPT = """You are GOL Agent, a DeFi assistant connected to GOL account controls and Aave.
Use read tools for market and position questions. For an Aave action, resolve current market and
position identifiers first, preview risky actions, then prepare only the unsigned transaction the
owner requested. Continue calling tools until the read or unsigned preparation is complete. Never
call submit_signed_order or cancel_order. GOL write tools are human handoffs only: never claim that
a wallet signed, a transaction was submitted, or value moved. Ask for a wallet address only when a
tool requires one and Connected owner is none. Be concise and preserve exact token amounts."""


def _last_user_text(messages: list[BaseMessage]) -> str:
    for message in reversed(messages):
        if message.type == "human":
            return str(message.content).strip()
    return ""


def _parse_tool_command(prompt: str) -> tuple[str, dict[str, Any]] | None:
    if not prompt.startswith("/tool "):
        return None
    _, _, command = prompt.partition("/tool ")
    name, _, raw_arguments = command.strip().partition(" ")
    if name not in TOOL_BY_NAME:
        return None
    if not raw_arguments:
        return name, {}
    try:
        arguments = json.loads(raw_arguments)
    except json.JSONDecodeError:
        return None
    return (name, arguments) if isinstance(arguments, dict) else None


class GolState(MessagesState):
    ownerAddress: NotRequired[str]
    mandateReady: NotRequired[bool]
    modelDriven: NotRequired[bool]


def _select_tool(
    prompt: str, owner_address: str | None = None
) -> tuple[str, dict[str, Any]] | None:
    direct = _parse_tool_command(prompt)
    if direct:
        return direct
    if re.search(r"^(pay|send|transfer)\s+", prompt, re.IGNORECASE):
        return "preview_instruction", {"instruction": prompt}
    if re.search(r"\b(create|deploy)\b.*\b(gol\s+)?account\b", prompt, re.IGNORECASE):
        return "create_account", {}
    if re.search(
        r"\b(add|fund|top up)\b.*\b(agent|signer)\b.*\b(gas|network fees?)\b",
        prompt,
        re.IGNORECASE,
    ) or re.search(r"\badd\b.*\bnetwork fee funds?\b", prompt, re.IGNORECASE):
        return "fund_agent_gas", {}
    if re.search(
        r"\b(add|create|provision|connect|set up)\b.*\b(agent|signer)\b",
        prompt,
        re.IGNORECASE,
    ):
        return "provision_agent", {}
    if re.search(
        r"\b(add|deposit|fund)\b.*\b(gol\s+account|payment\s+(account|funds?|balance))\b",
        prompt,
        re.IGNORECASE,
    ):
        amount = re.search(r"\b([0-9]+(?:\.[0-9]+)?)\s*USDC\b", prompt, re.IGNORECASE)
        return "fund_account", {"amountUsdc": amount.group(1)} if amount else {}
    if re.search(
        r"\bwithdraw\b.*\b(gol\s+account|payment\s+(funds?|balance))\b",
        prompt,
        re.IGNORECASE,
    ):
        amount = re.search(r"\b([0-9]+(?:\.[0-9]+)?)\s*USDC\b", prompt, re.IGNORECASE)
        return "withdraw", {"amountUsdc": amount.group(1)} if amount else {}
    if re.search(
        r"\b(why|what|show|review|explain)\b.*\b(refused|payment history|activity)\b",
        prompt,
        re.IGNORECASE,
    ):
        return "ask_indexed_question", {"question": prompt}
    if re.search(
        r"\b(revoke|cancel|turn off|disable)\b.*\b(mandate|payment rule|spending rule)\b",
        prompt,
        re.IGNORECASE,
    ):
        return "revoke_mandate", {}
    if re.search(
        r"\b(create|sign|replace|review|set|change|update)\b.*"
        r"\b(mandate|payment rule|spending limit)\b",
        prompt,
        re.IGNORECASE,
    ):
        return "sign_mandate", {}
    if re.search(r"\b(export|reveal)\b.*\b(owner\s+|personal\s+)?wallet\b", prompt, re.IGNORECASE):
        return "export_owner_wallet", {}
    if re.search(
        r"\b(refresh|check|sync)\b.*\b(index|indexing|activity|payment history)\b",
        prompt,
        re.IGNORECASE,
    ):
        return "check_indexing", {}
    if re.search(r"\b(position|health factor|aave account)\b", prompt, re.IGNORECASE):
        arguments: dict[str, Any] = {"version": "all"}
        if owner_address:
            arguments["user"] = owner_address
        return "get_user_summary", arguments
    if re.search(r"\b(yield|market|rate|apy)\b", prompt, re.IGNORECASE):
        match = re.search(r"\b(USDC|GHO|ETH|AAVE)\b", prompt, re.IGNORECASE)
        symbols = [match.group(1).upper()] if match else ["USDC", "GHO"]
        return "get_markets", {"version": "all", "symbols": symbols}
    if re.search(r"\b(governance|proposal|vote)\b", prompt, re.IGNORECASE):
        return "search_governance_proposals", {}
    return None


def _deterministic_route(state: GolState) -> AIMessage:
    messages = state["messages"]
    prompt = _last_user_text(messages)
    selected = _select_tool(prompt, state.get("ownerAddress"))
    if not selected:
        if re.fullmatch(r"\s*(hi|hello|hey|chào|xin chào)[!.?\s]*", prompt, re.IGNORECASE):
            return AIMessage(
                content=(
                    "Hi! I can inspect Aave markets and positions, prepare unsigned Aave "
                    "actions, or guide an owner-reviewed GOL payment. What would you like to do?"
                )
            )
        return AIMessage(
            content=(
                "Tell me whether you want to inspect Aave, prepare a protocol action, or manage "
                "your GOL account. For example: “Best USDC yield”, “Review my Aave position”, "
                "or “Pay 40 USDC to Design contractor”."
            )
        )
    name, arguments = selected
    return AIMessage(
        content="",
        tool_calls=[
            {
                "name": name,
                "args": arguments,
                "id": f"call_{uuid.uuid4().hex}",
                "type": "tool_call",
            }
        ],
    )


def _model() -> Any | None:
    if not os.getenv("OPENAI_API_KEY"):
        return None
    return ChatOpenAI(
        model=os.getenv("GOL_LANGGRAPH_MODEL", "gpt-5.5-2026-04-23"),
        temperature=0,
        streaming=True,
    ).bind_tools(list(TOOLS))


async def _stream_text(text: str) -> AIMessage:
    combined: AIMessageChunk | None = None
    async for chunk in streaming_text_model.astream([HumanMessage(content=text)]):
        combined = chunk if combined is None else combined + chunk
    return AIMessage(content=str(combined.content) if combined else text)


async def route_request(state: GolState) -> dict[str, Any]:
    messages = state["messages"]
    prompt = _last_user_text(messages)
    continuing_model_run = state.get("modelDriven") is True and messages[-1].type == "tool"
    if continuing_model_run:
        model = _model()
        if model is None:
            return {
                "messages": [await _stream_text("The configured model became unavailable.")],
                "modelDriven": False,
            }
        context = (
            f"\nConnected owner: {state.get('ownerAddress') or 'none'}. "
            f"Active mandate: {state.get('mandateReady') is True}."
        )
        response = await model.ainvoke([SystemMessage(content=SYSTEM_PROMPT + context), *messages])
        return {"messages": [response], "modelDriven": True}

    direct = _select_tool(prompt, state.get("ownerAddress"))
    if direct or not os.getenv("OPENAI_API_KEY"):
        routed = _deterministic_route(state)
        if routed.tool_calls:
            if routed.tool_calls[0]["name"] == "get_user_summary" and not state.get("ownerAddress"):
                return {
                    "messages": [
                        await _stream_text(
                            "Create or connect the owner wallet first so I can scope the Aave "
                            "position read."
                        )
                    ],
                    "modelDriven": False,
                }
            return {"messages": [routed], "modelDriven": False}
        return {"messages": [await _stream_text(str(routed.content))], "modelDriven": False}
    model = _model()
    context = (
        f"\nConnected owner: {state.get('ownerAddress') or 'none'}. "
        f"Active mandate: {state.get('mandateReady') is True}."
    )
    response = await model.ainvoke([SystemMessage(content=SYSTEM_PROMPT + context), *messages])
    return {"messages": [response], "modelDriven": True}


def after_route(state: GolState) -> str:
    message = state["messages"][-1]
    return "tools" if isinstance(message, AIMessage) and message.tool_calls else END


def after_tools(state: GolState) -> str:
    return "route_request" if state.get("modelDriven") is True else "finalize_tool"


async def finalize_tool(state: GolState) -> dict[str, list[AIMessage]]:
    result_message = state["messages"][-1]
    if not isinstance(result_message, ToolMessage):
        return {"messages": [await _stream_text("The tool run ended without a result.")]}
    try:
        payload = json.loads(str(result_message.content))
    except json.JSONDecodeError:
        payload = {}
    source = payload.get("source")
    tool_name = payload.get("tool", "tool")
    if source == "aave":
        text = "The live Aave MCP result is ready. Review the protocol data below."
    elif tool_name == "preview_instruction":
        text = (
            "Review the resolved GOL payment details before any request is submitted."
            if state.get("mandateReady")
            else "Finish account setup and approve a spending limit before making a payment."
        )
    elif tool_name == "ask_indexed_question":
        text = "I am checking indexed GOL evidence only. This path has no signing access."
    else:
        text = (
            "This GOL action is ready for the app's owner-review flow. "
            "Nothing was signed or submitted by LangGraph."
        )
    return {"messages": [await _stream_text(text)]}


workflow = StateGraph(GolState)
workflow.add_node("route_request", route_request)
workflow.add_node("tools", ToolNode(list(TOOLS), handle_tool_errors=True))
workflow.add_node("finalize_tool", finalize_tool)
workflow.add_edge(START, "route_request")
workflow.add_conditional_edges("route_request", after_route, {"tools": "tools", END: END})
workflow.add_conditional_edges(
    "tools", after_tools, {"route_request": "route_request", "finalize_tool": "finalize_tool"}
)
workflow.add_edge("finalize_tool", END)

graph = workflow.compile(checkpointer=InMemorySaver())
