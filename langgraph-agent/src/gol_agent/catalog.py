from dataclasses import dataclass
from typing import Literal

ToolSource = Literal["gol", "aave"]


@dataclass(frozen=True)
class ToolDefinition:
    name: str
    description: str
    source: ToolSource


GOL_TOOLS = (
    ToolDefinition("create_account", "Create the account that holds agent payment funds.", "gol"),
    ToolDefinition("provision_agent", "Add a separate agent wallet after owner review.", "gol"),
    ToolDefinition("fund_agent_gas", "Add Arc network fee funds to the agent wallet.", "gol"),
    ToolDefinition("fund_account", "Add an exact USDC amount to the agent payment balance.", "gol"),
    ToolDefinition("withdraw", "Return payment funds to the personal wallet.", "gol"),
    ToolDefinition("sign_mandate", "Set or update the agent spending limit.", "gol"),
    ToolDefinition("revoke_mandate", "Turn off the active spending rule.", "gol"),
    ToolDefinition(
        "preview_instruction", "Resolve a payment instruction before queueing it.", "gol"
    ),
    ToolDefinition("submit_instruction", "Submit a payment allowed by the active rule.", "gol"),
    ToolDefinition(
        "ask_indexed_question", "Answer from indexed GOL evidence without signing.", "gol"
    ),
    ToolDefinition(
        "check_indexing", "Refresh journal records against indexed chain events.", "gol"
    ),
    ToolDefinition("export_owner_wallet", "Open the owner-only wallet export flow.", "gol"),
)


AAVE_TOOL_NAMES = (
    "get_chains",
    "get_markets",
    "get_emode_categories",
    "get_user_positions",
    "get_position_items",
    "get_user_summary",
    "get_transaction_processed",
    "get_reserve_details",
    "get_apy_history",
    "get_user_activity",
    "get_protocol_history",
    "get_user_summary_history",
    "get_hubs",
    "get_hub_assets",
    "prepare_liquidation",
    "prepare_set_emode",
    "prepare_action",
    "prepare_set_collateral",
    "preview_action",
    "get_swappable_tokens",
    "get_swap_quote",
    "prepare_order",
    "submit_signed_order",
    "prepare_cancel_order",
    "cancel_order",
    "get_order_status",
    "get_pending_orders",
    "get_user_rewards",
    "prepare_claim_rewards",
    "get_sgho_vault",
    "get_sgho_preview",
    "prepare_sgho_action",
    "prepare_stkgho_migrate",
    "search_governance_proposals",
    "get_governance_proposal",
    "get_proposal_votes",
    "get_user_vote",
    "get_proposal_payloads",
    "get_aave_guide",
    "get_started",
)


AAVE_TOOLS = tuple(
    ToolDefinition(
        name,
        f"Call the connected Aave MCP capability {name.replace('_', ' ')}.",
        "aave",
    )
    for name in AAVE_TOOL_NAMES
)


ALL_TOOLS = GOL_TOOLS + AAVE_TOOLS
TOOL_BY_NAME = {tool.name: tool for tool in ALL_TOOLS}
