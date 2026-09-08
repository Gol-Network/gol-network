// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface ICallbackTarget {
    function pay(uint256, bytes32, address, uint256) external returns (uint8);
}

contract TestUSDC {
    string public constant name = "Test USDC";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;
    mapping(address => uint256) private balances;

    bool public returnFalse;
    bool public revertBalance;
    bool public revertTransfer;
    bytes public callback;
    address public callbackTarget;

    function mint(address recipient, uint256 amount) external {
        balances[recipient] += amount;
    }

    function configureFailure(bool falseReturn, bool balanceFailure, bool transferFailure)
        external
    {
        returnFalse = falseReturn;
        revertBalance = balanceFailure;
        revertTransfer = transferFailure;
    }

    function configureCallback(address target, bytes calldata data) external {
        callbackTarget = target;
        callback = data;
    }

    function balanceOf(address account) external view returns (uint256) {
        if (revertBalance) revert("balance failure");
        return balances[account];
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        if (revertTransfer) revert("transfer failure");
        if (returnFalse) return false;
        require(balances[msg.sender] >= amount, "balance");
        balances[msg.sender] -= amount;
        balances[recipient] += amount;
        if (callbackTarget != address(0)) {
            (bool success,) = callbackTarget.call(callback);
            require(success, "callback failed");
        }
        return true;
    }
}
