import json
from typing import Any

from jsonschema import Draft202012Validator
from langchain_core.tools import BaseTool, StructuredTool

from .catalog import ALL_TOOLS, ToolDefinition
from .mcp import AAVE_SIGNED_RELAY_TOOLS, call_aave_mcp, list_aave_mcp_tools

OPEN_ARGUMENTS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {},
    "additionalProperties": True,
}
TOOL_SCHEMAS: dict[str, dict[str, Any]] = {}


def _build_tool(definition: ToolDefinition) -> BaseTool:
    async def execute(**arguments: Any) -> str:
        if definition.source == "aave":
            if definition.name in AAVE_SIGNED_RELAY_TOOLS:
                return json.dumps(
                    {
                        "source": "aave",
                        "tool": definition.name,
                        "result": {
                            "status": "blocked",
                            "reason": "Signed relay tools require an authenticated wallet flow",
                        },
                    },
                    separators=(",", ":"),
                )
            Draft202012Validator(TOOL_SCHEMAS[definition.name]).validate(arguments)
            result = await call_aave_mcp(definition.name, arguments)
            return json.dumps(
                {"source": "aave", "tool": definition.name, "result": result},
                separators=(",", ":"),
            )
        return json.dumps(
            {
                "source": "gol",
                "tool": definition.name,
                "kind": "client_handoff",
                "safeToExecute": False,
                "requiresOwnerReview": definition.name
                not in {"ask_indexed_question", "check_indexing", "preview_instruction"},
                "arguments": arguments,
            },
            separators=(",", ":"),
        )

    return StructuredTool.from_function(
        coroutine=execute,
        name=definition.name,
        description=definition.description,
        args_schema=OPEN_ARGUMENTS_SCHEMA,
    )


TOOLS = tuple(_build_tool(definition) for definition in ALL_TOOLS)
TOOL_MAP = {tool.name: tool for tool in TOOLS}
TOOL_SCHEMAS.update({tool.name: OPEN_ARGUMENTS_SCHEMA for tool in TOOLS})
AAVE_TOOL_NAMES = {definition.name for definition in ALL_TOOLS if definition.source == "aave"}


async def refresh_aave_tool_metadata() -> int:
    """Apply live MCP descriptions and JSON schemas before the model binds its tools."""
    discovered = await list_aave_mcp_tools()
    updated = 0
    for metadata in discovered:
        name = metadata.get("name")
        tool = TOOL_MAP.get(name) if isinstance(name, str) else None
        if tool is None or name not in AAVE_TOOL_NAMES:
            continue
        description = metadata.get("description")
        schema = metadata.get("inputSchema")
        if isinstance(description, str) and description.strip() and len(description) <= 12_000:
            tool.description = description.strip()
        if (
            name not in AAVE_SIGNED_RELAY_TOOLS
            and isinstance(schema, dict)
            and schema.get("type") == "object"
            and isinstance(schema.get("properties", {}), dict)
            and len(json.dumps(schema)) <= 100_000
        ):
            tool.args_schema = schema
            TOOL_SCHEMAS[name] = schema
        updated += 1
    return updated
