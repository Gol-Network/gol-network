import hmac
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from ag_ui_langgraph import LangGraphAgent, add_langgraph_fastapi_endpoint
from fastapi import Depends, FastAPI, Header, HTTPException, Response

from .graph import graph
from .tools import TOOLS, refresh_aave_tool_metadata


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.aave_discovery = "disabled"
    app.state.aave_tools = 0
    if os.getenv("AAVE_MCP_DISCOVERY", "true").lower() not in {"0", "false", "no"}:
        try:
            app.state.aave_tools = await refresh_aave_tool_metadata()
            app.state.aave_discovery = "ready"
        except Exception:
            # The service remains available for GOL handoffs and deterministic reads. A later
            # direct Aave call still reports its own bounded provider failure.
            app.state.aave_discovery = "unavailable"
    yield


app = FastAPI(title="GOL LangGraph Agent", version="0.1.0", lifespan=lifespan)


def require_internal_token(x_gol_agent_token: str | None = Header(default=None)) -> None:
    expected = os.getenv("GOL_AGENT_SHARED_SECRET")
    if expected and (not x_gol_agent_token or not hmac.compare_digest(x_gol_agent_token, expected)):
        raise HTTPException(status_code=401, detail="AGENT_AUTH_REQUIRED")


agent = LangGraphAgent(
    name="gol-agent",
    description="GOL account controls and Aave DeFi tools",
    graph=graph,
    enable_legacy_on_interrupt_event=False,
    emit_interrupt_outcome=True,
    emit_raw_events=False,
)

add_langgraph_fastapi_endpoint(
    app,
    agent,
    "/agent",
    dependencies=[Depends(require_internal_token)],
)


@app.get("/health")
def health(response: Response) -> dict[str, str | int | bool]:
    discovery = app.state.aave_discovery
    if discovery == "unavailable":
        response.status_code = 503
    return {
        "status": "ok" if discovery in {"ready", "disabled"} else "degraded",
        "service": "gol-langgraph-agent",
        "tools": len(TOOLS),
        "modelConfigured": bool(os.getenv("OPENAI_API_KEY")),
        "routingMode": "model" if os.getenv("OPENAI_API_KEY") else "deterministic",
        "aaveToolsDiscovered": app.state.aave_tools,
        "aaveDiscovery": discovery,
    }
