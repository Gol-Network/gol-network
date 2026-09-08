// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { GolAccount } from "../src/GolAccount.sol";
import { GolAccountFactory } from "../src/GolAccountFactory.sol";
import { TestUSDC } from "./mocks/TestUSDC.sol";
import { TestBase, Vm } from "./TestBase.sol";

contract GolAccountTest is TestBase {
    TestUSDC internal token;
    GolAccountFactory internal factory;
    GolAccount internal account;

    address internal constant OWNER = address(0xA11CE);
    address internal constant AGENT = address(0xA6E17);
    address internal constant RECIPIENT = address(0xBEEF);
    address internal constant OTHER = address(0xBAD);

    uint256 internal mandateId;
    uint64 internal expiry;

    function setUp() public {
        vm.warp(1_800_000_000);
        token = new TestUSDC();
        factory = new GolAccountFactory(address(token));
        vm.prank(OWNER);
        account = GolAccount(payable(factory.createAccount()));
        token.mint(address(account), 100_000_000);
        expiry = uint64(block.timestamp + 7 days);
        mandateId = _createMandate(100_000_000, 100_000_000, expiry);
    }

    function test_40Then70PersistsRefusal() public {
        vm.prank(AGENT);
        assertEq(
            uint256(account.pay(mandateId, bytes32(uint256(1)), RECIPIENT, 40_000_000)),
            uint256(GolAccount.Outcome.EXECUTED)
        );
        vm.prank(AGENT);
        assertEq(
            uint256(account.pay(mandateId, bytes32(uint256(2)), RECIPIENT, 70_000_000)),
            uint256(GolAccount.Outcome.REFUSED)
        );
        GolAccount.RequestRecord memory record = account.getRequest(mandateId, bytes32(uint256(2)));
        assertEq(uint256(record.rule), uint256(GolAccount.Rule.CUMULATIVE_CAP));
        assertEq(record.attempted, 70_000_000);
        assertEq(record.headroom, 60_000_000);
        assertEq(record.spentAfter, 40_000_000);
        assertEq(token.balanceOf(RECIPIENT), 40_000_000);
        assertEq(token.balanceOf(address(account)), 60_000_000);
        assertEq(account.sequence(), 2);
    }

    function test_ExactCapsExecuteAndOneMicroOverRefuses() public {
        vm.prank(AGENT);
        account.pay(mandateId, bytes32(uint256(1)), RECIPIENT, 100_000_000);
        assertEq(account.remaining(mandateId), 0);

        vm.prank(AGENT);
        account.pay(mandateId, bytes32(uint256(2)), RECIPIENT, 1);
        GolAccount.RequestRecord memory record = account.getRequest(mandateId, bytes32(uint256(2)));
        assertEq(uint256(record.rule), uint256(GolAccount.Rule.CUMULATIVE_CAP));
        assertEq(record.headroom, 0);
    }

    function test_PerPaymentBoundaryAndEvaluationOrder() public {
        uint256 id = _createMandate(40_000_000, 100_000_000, expiry);
        vm.prank(AGENT);
        account.pay(id, bytes32(uint256(10)), RECIPIENT, 40_000_001);
        assertEq(
            uint256(account.getRequest(id, bytes32(uint256(10))).rule),
            uint256(GolAccount.Rule.PER_PAYMENT_CAP)
        );

        vm.prank(AGENT);
        account.pay(id, bytes32(uint256(11)), OTHER, 100_000_001);
        assertEq(
            uint256(account.getRequest(id, bytes32(uint256(11))).rule),
            uint256(GolAccount.Rule.RECIPIENT_NOT_ALLOWED)
        );
    }

    function test_ExpiryBoundary() public {
        vm.warp(expiry - 1);
        vm.prank(AGENT);
        account.pay(mandateId, bytes32(uint256(1)), RECIPIENT, 1);
        assertEq(
            uint256(account.getRequest(mandateId, bytes32(uint256(1))).outcome),
            uint256(GolAccount.Outcome.EXECUTED)
        );

        vm.warp(expiry);
        vm.prank(AGENT);
        account.pay(mandateId, bytes32(uint256(2)), RECIPIENT, 1);
        assertEq(
            uint256(account.getRequest(mandateId, bytes32(uint256(2))).rule),
            uint256(GolAccount.Rule.MANDATE_EXPIRED)
        );
    }

    function test_DuplicateSamePayloadIsIdempotentAndEmitsOnce() public {
        bytes32 requestId = bytes32(uint256(77));
        vm.recordLogs();
        vm.startPrank(AGENT);
        account.pay(mandateId, requestId, RECIPIENT, 40_000_000);
        account.pay(mandateId, requestId, RECIPIENT, 40_000_000);
        vm.stopPrank();

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 executedTopic =
            keccak256("Executed(uint256,bytes32,address,address,uint256,uint256,uint256,uint256)");
        uint256 outcomes;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics.length > 0 && logs[i].topics[0] == executedTopic) ++outcomes;
        }
        assertEq(outcomes, 1);
        assertEq(token.balanceOf(RECIPIENT), 40_000_000);
        assertEq(account.sequence(), 1);
    }

    function test_DuplicateChangedPayloadRevertsAndPreservesOriginal() public {
        bytes32 requestId = bytes32(uint256(77));
        vm.prank(AGENT);
        account.pay(mandateId, requestId, RECIPIENT, 40_000_000);
        vm.expectRevert(GolAccount.RequestConflict.selector);
        vm.prank(AGENT);
        account.pay(mandateId, requestId, RECIPIENT, 41_000_000);
        assertEq(token.balanceOf(RECIPIENT), 40_000_000);
        assertEq(account.sequence(), 1);
    }

    function test_ReplayAfterRevokeReturnsOriginalOutcome() public {
        bytes32 requestId = bytes32(uint256(77));
        vm.prank(AGENT);
        account.pay(mandateId, requestId, RECIPIENT, 40_000_000);
        vm.prank(OWNER);
        account.revokeMandate(mandateId);
        vm.prank(AGENT);
        assertEq(
            uint256(account.pay(mandateId, requestId, RECIPIENT, 40_000_000)),
            uint256(GolAccount.Outcome.EXECUTED)
        );
        assertEq(token.balanceOf(RECIPIENT), 40_000_000);
    }

    function test_RevokeRecordsNewRequestsAsRefused() public {
        vm.prank(OWNER);
        account.revokeMandate(mandateId);
        vm.prank(AGENT);
        account.pay(mandateId, bytes32(uint256(9)), RECIPIENT, 1);
        assertEq(
            uint256(account.getRequest(mandateId, bytes32(uint256(9))).rule),
            uint256(GolAccount.Rule.MANDATE_REVOKED)
        );
    }

    function test_UnauthorizedAndMalformedCallsDoNotPersist() public {
        bytes32 requestId = bytes32(uint256(99));
        vm.expectRevert(abi.encodeWithSelector(GolAccount.UnauthorizedAgent.selector, OTHER, AGENT));
        vm.prank(OTHER);
        account.pay(mandateId, requestId, RECIPIENT, 1);
        assertEq(
            uint256(account.getRequest(mandateId, requestId).outcome),
            uint256(GolAccount.Outcome.UNSEEN)
        );

        vm.expectRevert(GolAccount.InvalidRequestId.selector);
        vm.prank(AGENT);
        account.pay(mandateId, bytes32(0), RECIPIENT, 1);
        vm.expectRevert(GolAccount.InvalidRecipient.selector);
        vm.prank(AGENT);
        account.pay(mandateId, requestId, address(0), 1);
        vm.expectRevert(GolAccount.InvalidAmount.selector);
        vm.prank(AGENT);
        account.pay(mandateId, requestId, RECIPIENT, 0);
        vm.expectRevert(abi.encodeWithSelector(GolAccount.UnknownMandate.selector, 999));
        vm.prank(AGENT);
        account.pay(999, requestId, RECIPIENT, 1);
        assertEq(account.sequence(), 0);
    }

    function test_CompetingRequestsCannotOverspend() public {
        vm.prank(AGENT);
        account.pay(mandateId, bytes32(uint256(1)), RECIPIENT, 40_000_000);
        vm.prank(AGENT);
        account.pay(mandateId, bytes32(uint256(2)), RECIPIENT, 40_000_000);
        vm.prank(AGENT);
        account.pay(mandateId, bytes32(uint256(3)), RECIPIENT, 30_000_000);
        assertEq(token.balanceOf(RECIPIENT), 80_000_000);
        assertEq(
            uint256(account.getRequest(mandateId, bytes32(uint256(3))).rule),
            uint256(GolAccount.Rule.CUMULATIVE_CAP)
        );
    }

    function test_InsufficientBalanceRollsBackRequestAndBudget() public {
        uint256 id = _createMandate(200_000_000, 200_000_000, expiry);
        vm.expectRevert(
            abi.encodeWithSelector(GolAccount.InsufficientFunds.selector, 100_000_000, 150_000_000)
        );
        vm.prank(AGENT);
        account.pay(id, bytes32(uint256(1)), RECIPIENT, 150_000_000);
        assertEq(uint256(account.getRequest(id, bytes32(uint256(1))).outcome), 0);
        assertEq(account.remaining(id), 200_000_000);
        assertEq(account.sequence(), 0);
    }

    function test_TokenFailuresRollBackAllState() public {
        token.configureFailure(true, false, false);
        vm.expectRevert(GolAccount.TokenCallFailed.selector);
        vm.prank(AGENT);
        account.pay(mandateId, bytes32(uint256(1)), RECIPIENT, 1);
        assertEq(uint256(account.getRequest(mandateId, bytes32(uint256(1))).outcome), 0);
        assertEq(account.sequence(), 0);

        token.configureFailure(false, true, false);
        vm.expectRevert(GolAccount.TokenCallFailed.selector);
        vm.prank(AGENT);
        account.pay(mandateId, bytes32(uint256(2)), RECIPIENT, 1);
        assertEq(account.sequence(), 0);
    }

    function test_ReentrantTokenRollsBackTransfer() public {
        bytes memory callback =
            abi.encodeCall(GolAccount.pay, (mandateId, bytes32(uint256(2)), RECIPIENT, 1));
        token.configureCallback(address(account), callback);
        vm.expectRevert(GolAccount.TokenCallFailed.selector);
        vm.prank(AGENT);
        account.pay(mandateId, bytes32(uint256(1)), RECIPIENT, 1);
        assertEq(token.balanceOf(RECIPIENT), 0);
        assertEq(account.sequence(), 0);
    }

    function test_ReplacementRevokesOldAndCreatesFreshBudget() public {
        uint256 replacement = _createMandate(50_000_000, 60_000_000, expiry);
        assertEq(replacement, mandateId + 1);
        assertEq(account.getMandate(mandateId).revoked, true);
        assertEq(account.activeMandateId(), replacement);
        assertEq(account.remaining(replacement), 60_000_000);
    }

    function test_OnlyOwnerCanAdministerAndWithdrawalGoesToOwner() public {
        vm.expectRevert(GolAccount.OnlyOwner.selector);
        vm.prank(AGENT);
        account.withdraw(1);
        vm.expectRevert(GolAccount.OnlyOwner.selector);
        vm.prank(AGENT);
        account.revokeMandate(mandateId);

        vm.prank(OWNER);
        account.revokeMandate(mandateId);
        vm.prank(OWNER);
        account.withdraw(100_000_000);
        assertEq(token.balanceOf(OWNER), 100_000_000);
        assertEq(token.balanceOf(address(account)), 0);
        assertEq(account.owner(), OWNER);
    }

    function test_FactoryIsIdempotentAndOwnerIsImmutable() public {
        vm.prank(OWNER);
        address again = factory.createAccount();
        assertEq(again, address(account));
        assertEq(account.owner(), OWNER);
    }

    function test_InvalidMandatesFailAtomically() public {
        address[] memory recipients = new address[](2);
        recipients[0] = RECIPIENT;
        recipients[1] = RECIPIENT;
        vm.expectRevert(abi.encodeWithSelector(GolAccount.DuplicateRecipient.selector, RECIPIENT));
        vm.prank(OWNER);
        account.createMandate(AGENT, 1, 1, expiry, recipients);

        recipients = new address[](0);
        vm.expectRevert(GolAccount.InvalidRecipients.selector);
        vm.prank(OWNER);
        account.createMandate(AGENT, 1, 1, expiry, recipients);
        vm.expectRevert(GolAccount.InvalidCaps.selector);
        vm.prank(OWNER);
        account.createMandate(AGENT, 2, 1, expiry, _recipients());
        vm.expectRevert(GolAccount.InvalidExpiry.selector);
        vm.prank(OWNER);
        account.createMandate(AGENT, 1, 1, uint64(block.timestamp), _recipients());
        assertEq(account.activeMandateId(), mandateId);
    }

    function _createMandate(uint256 perPayment, uint256 cumulative, uint64 expiresAt)
        internal
        returns (uint256 id)
    {
        vm.prank(OWNER);
        id = account.createMandate(AGENT, perPayment, cumulative, expiresAt, _recipients());
    }

    function _recipients() internal pure returns (address[] memory recipients) {
        recipients = new address[](1);
        recipients[0] = RECIPIENT;
    }
}
