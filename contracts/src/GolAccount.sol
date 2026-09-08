// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "./IERC20.sol";

contract GolAccount {
    enum Outcome {
        UNSEEN,
        EXECUTED,
        REFUSED
    }

    enum Rule {
        NONE,
        MANDATE_REVOKED,
        MANDATE_EXPIRED,
        RECIPIENT_NOT_ALLOWED,
        PER_PAYMENT_CAP,
        CUMULATIVE_CAP
    }

    struct Mandate {
        address agent;
        uint256 perPaymentCap;
        uint256 cumulativeCap;
        uint256 spent;
        uint64 expiresAt;
        bool revoked;
        bool exists;
    }

    struct RequestRecord {
        bytes32 payloadHash;
        address agent;
        address recipient;
        uint256 attempted;
        uint256 headroom;
        uint256 spentAfter;
        Outcome outcome;
        Rule rule;
        string reason;
        uint64 recordedAt;
        uint256 sequence;
    }

    error OnlyOwner();
    error UnknownMandate(uint256 mandateId);
    error UnauthorizedAgent(address caller, address expected);
    error InvalidAgent();
    error InvalidCaps();
    error InvalidExpiry();
    error InvalidRecipients();
    error DuplicateRecipient(address recipient);
    error InvalidRequestId();
    error InvalidRecipient();
    error InvalidAmount();
    error RequestConflict();
    error InsufficientFunds(uint256 balance, uint256 required);
    error TokenCallFailed();
    error Reentrancy();

    event MandateCreated(
        uint256 indexed mandateId,
        address indexed agent,
        uint256 perPaymentCap,
        uint256 cumulativeCap,
        uint64 expiresAt,
        address[] recipients
    );
    event MandateRevoked(uint256 indexed mandateId, address indexed agent);
    event Executed(
        uint256 indexed mandateId,
        bytes32 indexed requestId,
        address indexed agent,
        address recipient,
        uint256 amount,
        uint256 headroom,
        uint256 spentAfter,
        uint256 sequence
    );
    event Refused(
        uint256 indexed mandateId,
        bytes32 indexed requestId,
        address indexed agent,
        address recipient,
        uint8 rule,
        uint256 attempted,
        uint256 headroom,
        uint256 spentAfter,
        string reason,
        uint256 sequence
    );
    event Withdrawn(address indexed owner, uint256 amount);

    uint256 public constant MAX_MANDATE_DURATION = 30 days;
    uint256 public constant MAX_RECIPIENTS = 20;

    address public immutable owner;
    IERC20 public immutable usdc;
    uint256 public nextMandateId = 1;
    uint256 public activeMandateId;
    uint256 public sequence;

    mapping(uint256 mandateId => Mandate mandate) private mandates;
    mapping(uint256 mandateId => address[] recipients) private mandateRecipients;
    mapping(uint256 mandateId => mapping(address recipient => bool allowed)) private allowed;
    mapping(uint256 mandateId => mapping(bytes32 requestId => RequestRecord record)) private
        requests;

    uint256 private entered = 1;

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier nonReentrant() {
        if (entered != 1) revert Reentrancy();
        entered = 2;
        _;
        entered = 1;
    }

    constructor(address owner_, address usdc_) {
        if (owner_ == address(0) || usdc_ == address(0)) revert InvalidAgent();
        owner = owner_;
        usdc = IERC20(usdc_);
    }

    receive() external payable { }

    function createMandate(
        address agent,
        uint256 perPaymentCap,
        uint256 cumulativeCap,
        uint64 expiresAt,
        address[] calldata recipients
    ) external onlyOwner nonReentrant returns (uint256 mandateId) {
        if (
            agent == address(0) || agent == owner || agent == address(this)
                || agent == address(usdc)
        ) revert InvalidAgent();
        if (perPaymentCap == 0 || cumulativeCap == 0 || perPaymentCap > cumulativeCap) {
            revert InvalidCaps();
        }
        if (expiresAt <= block.timestamp || expiresAt > block.timestamp + MAX_MANDATE_DURATION) {
            revert InvalidExpiry();
        }
        if (recipients.length == 0 || recipients.length > MAX_RECIPIENTS) {
            revert InvalidRecipients();
        }

        mandateId = nextMandateId++;
        for (uint256 i; i < recipients.length; ++i) {
            address recipient = recipients[i];
            if (recipient == address(0) || recipient == address(this) || recipient == address(usdc))
            {
                revert InvalidRecipients();
            }
            if (allowed[mandateId][recipient]) revert DuplicateRecipient(recipient);
            allowed[mandateId][recipient] = true;
            mandateRecipients[mandateId].push(recipient);
        }

        uint256 previous = activeMandateId;
        if (previous != 0 && !mandates[previous].revoked) {
            mandates[previous].revoked = true;
            emit MandateRevoked(previous, mandates[previous].agent);
        }

        mandates[mandateId] = Mandate({
            agent: agent,
            perPaymentCap: perPaymentCap,
            cumulativeCap: cumulativeCap,
            spent: 0,
            expiresAt: expiresAt,
            revoked: false,
            exists: true
        });
        activeMandateId = mandateId;
        emit MandateCreated(mandateId, agent, perPaymentCap, cumulativeCap, expiresAt, recipients);
    }

    function revokeMandate(uint256 mandateId) external onlyOwner nonReentrant {
        Mandate storage mandate = mandates[mandateId];
        if (!mandate.exists) revert UnknownMandate(mandateId);
        if (!mandate.revoked) {
            mandate.revoked = true;
            if (activeMandateId == mandateId) activeMandateId = 0;
            emit MandateRevoked(mandateId, mandate.agent);
        }
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidAmount();
        uint256 balance = _balance();
        if (balance < amount) revert InsufficientFunds(balance, amount);
        _safeTransfer(owner, amount);
        emit Withdrawn(owner, amount);
    }

    function pay(uint256 mandateId, bytes32 requestId, address recipient, uint256 amount)
        external
        nonReentrant
        returns (Outcome outcome)
    {
        Mandate storage mandate = mandates[mandateId];
        if (!mandate.exists) revert UnknownMandate(mandateId);
        if (msg.sender != mandate.agent) revert UnauthorizedAgent(msg.sender, mandate.agent);
        if (requestId == bytes32(0)) revert InvalidRequestId();
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();

        bytes32 payloadHash = keccak256(
            abi.encode(block.chainid, address(this), mandateId, msg.sender, recipient, amount)
        );
        RequestRecord storage prior = requests[mandateId][requestId];
        if (prior.outcome != Outcome.UNSEEN) {
            if (prior.payloadHash != payloadHash) revert RequestConflict();
            return prior.outcome;
        }

        uint256 headroom = mandate.cumulativeCap - mandate.spent;
        Rule rule;
        string memory reason;
        if (mandate.revoked || mandateId != activeMandateId) {
            rule = Rule.MANDATE_REVOKED;
            reason = "Mandate revoked";
        } else if (block.timestamp >= mandate.expiresAt) {
            rule = Rule.MANDATE_EXPIRED;
            reason = "Mandate expired";
        } else if (!allowed[mandateId][recipient]) {
            rule = Rule.RECIPIENT_NOT_ALLOWED;
            reason = "Recipient not allowed";
        } else if (amount > mandate.perPaymentCap) {
            rule = Rule.PER_PAYMENT_CAP;
            reason = "Per-payment cap exceeded";
        } else if (amount > headroom) {
            rule = Rule.CUMULATIVE_CAP;
            reason = "Cumulative cap exceeded";
        }

        uint256 newSequence = ++sequence;
        if (rule != Rule.NONE) {
            return _recordRefusal(
                mandateId,
                requestId,
                recipient,
                amount,
                headroom,
                payloadHash,
                newSequence,
                rule,
                reason
            );
        }

        return _executePayment(mandateId, requestId, recipient, amount, payloadHash, newSequence);
    }

    function _executePayment(
        uint256 mandateId,
        bytes32 requestId,
        address recipient,
        uint256 amount,
        bytes32 payloadHash,
        uint256 newSequence
    ) private returns (Outcome) {
        Mandate storage mandate = mandates[mandateId];
        uint256 balance = _balance();
        if (balance < amount) revert InsufficientFunds(balance, amount);
        uint256 spentAfter = mandate.spent + amount;
        mandate.spent = spentAfter;
        uint256 remainingAfter = mandate.cumulativeCap - spentAfter;
        requests[mandateId][requestId] = RequestRecord({
            payloadHash: payloadHash,
            agent: msg.sender,
            recipient: recipient,
            attempted: amount,
            headroom: remainingAfter,
            spentAfter: spentAfter,
            outcome: Outcome.EXECUTED,
            rule: Rule.NONE,
            reason: "Payment executed",
            recordedAt: uint64(block.timestamp),
            sequence: newSequence
        });
        _safeTransfer(recipient, amount);
        emit Executed(
            mandateId,
            requestId,
            msg.sender,
            recipient,
            amount,
            remainingAfter,
            spentAfter,
            newSequence
        );
        return Outcome.EXECUTED;
    }

    function _recordRefusal(
        uint256 mandateId,
        bytes32 requestId,
        address recipient,
        uint256 amount,
        uint256 headroom,
        bytes32 payloadHash,
        uint256 newSequence,
        Rule rule,
        string memory reason
    ) private returns (Outcome) {
        uint256 spent = mandates[mandateId].spent;
        requests[mandateId][requestId] = RequestRecord({
            payloadHash: payloadHash,
            agent: msg.sender,
            recipient: recipient,
            attempted: amount,
            headroom: headroom,
            spentAfter: spent,
            outcome: Outcome.REFUSED,
            rule: rule,
            reason: reason,
            recordedAt: uint64(block.timestamp),
            sequence: newSequence
        });
        emit Refused(
            mandateId,
            requestId,
            msg.sender,
            recipient,
            uint8(rule),
            amount,
            headroom,
            spent,
            reason,
            newSequence
        );
        return Outcome.REFUSED;
    }

    function getMandate(uint256 mandateId) external view returns (Mandate memory) {
        return mandates[mandateId];
    }

    function getRecipients(uint256 mandateId) external view returns (address[] memory) {
        return mandateRecipients[mandateId];
    }

    function isRecipientAllowed(uint256 mandateId, address recipient) external view returns (bool) {
        return allowed[mandateId][recipient];
    }

    function getRequest(uint256 mandateId, bytes32 requestId)
        external
        view
        returns (RequestRecord memory)
    {
        return requests[mandateId][requestId];
    }

    function remaining(uint256 mandateId) external view returns (uint256) {
        Mandate storage mandate = mandates[mandateId];
        if (!mandate.exists) revert UnknownMandate(mandateId);
        return mandate.cumulativeCap - mandate.spent;
    }

    function _balance() private view returns (uint256 balance) {
        (bool success, bytes memory data) =
            address(usdc).staticcall(abi.encodeCall(IERC20.balanceOf, (address(this))));
        if (!success || data.length != 32) revert TokenCallFailed();
        balance = abi.decode(data, (uint256));
    }

    function _safeTransfer(address recipient, uint256 amount) private {
        (bool success, bytes memory data) =
            address(usdc).call(abi.encodeCall(IERC20.transfer, (recipient, amount)));
        if (!success || (data.length != 0 && (data.length != 32 || !abi.decode(data, (bool))))) {
            revert TokenCallFailed();
        }
    }
}
