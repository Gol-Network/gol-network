// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { GolAccount } from "../src/GolAccount.sol";
import { TestUSDC } from "./mocks/TestUSDC.sol";
import { TestBase, Vm } from "./TestBase.sol";

contract GolAccountHandler {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    GolAccount public immutable account;
    address public immutable agent;
    address public immutable recipient;
    uint256 public immutable mandateId;
    uint256 public nextRequest = 1;

    constructor(GolAccount account_, address agent_, address recipient_, uint256 mandateId_) {
        account = account_;
        agent = agent_;
        recipient = recipient_;
        mandateId = mandateId_;
    }

    function payAllowed(uint96 rawAmount) external {
        uint256 amount = uint256(rawAmount) % 60_000_001;
        if (amount == 0) amount = 1;
        vm.prank(agent);
        account.pay(mandateId, bytes32(nextRequest++), recipient, amount);
    }

    function payUnlisted(uint96 rawAmount) external {
        uint256 amount = uint256(rawAmount) % 120_000_001;
        if (amount == 0) amount = 1;
        vm.prank(agent);
        account.pay(mandateId, bytes32(nextRequest++), address(0xBAD), amount);
    }

    function replayLast(uint96 rawAmount) external {
        if (nextRequest == 1) return;
        uint256 amount = uint256(rawAmount) % 60_000_001;
        if (amount == 0) amount = 1;
        vm.prank(agent);
        try account.pay(mandateId, bytes32(nextRequest - 1), recipient, amount) { } catch { }
    }
}

contract GolAccountInvariantTest is TestBase {
    TestUSDC internal token;
    GolAccount internal account;
    GolAccountHandler internal handler;

    address internal constant OWNER = address(0xA11CE);
    address internal constant AGENT = address(0xA6E17);
    address internal constant RECIPIENT = address(0xBEEF);
    uint256 internal constant CAP = 100_000_000;
    address[] private targets;

    function setUp() public {
        vm.warp(1_800_000_000);
        token = new TestUSDC();
        account = new GolAccount(OWNER, address(token));
        token.mint(address(account), CAP);
        address[] memory recipients = new address[](1);
        recipients[0] = RECIPIENT;
        vm.prank(OWNER);
        uint256 mandateId = account.createMandate(
            AGENT, 60_000_000, CAP, uint64(block.timestamp + 7 days), recipients
        );
        handler = new GolAccountHandler(account, AGENT, RECIPIENT, mandateId);
        targets.push(address(handler));
    }

    function targetContracts() public view returns (address[] memory) {
        return targets;
    }

    function invariant_SpentNeverExceedsCumulativeCap() public view {
        GolAccount.Mandate memory mandate = account.getMandate(1);
        assert(mandate.spent <= mandate.cumulativeCap);
        assertEq(mandate.cumulativeCap, CAP);
    }

    function invariant_ExecutedValueEqualsRecipientDelta() public view {
        GolAccount.Mandate memory mandate = account.getMandate(1);
        assertEq(token.balanceOf(RECIPIENT), mandate.spent);
        assertEq(token.balanceOf(address(account)) + mandate.spent, CAP);
    }

    function invariant_OwnerNeverChanges() public view {
        assertEq(account.owner(), OWNER);
    }
}
