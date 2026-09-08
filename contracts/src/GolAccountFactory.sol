// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { GolAccount } from "./GolAccount.sol";

contract GolAccountFactory {
    error InvalidToken();

    event AccountCreated(address indexed owner, address indexed account);

    address public immutable usdc;
    mapping(address owner => address account) public accounts;

    constructor(address usdc_) {
        if (usdc_ == address(0)) revert InvalidToken();
        usdc = usdc_;
    }

    function createAccount() external returns (address account) {
        account = accounts[msg.sender];
        if (account != address(0)) return account;
        account = address(new GolAccount(msg.sender, usdc));
        accounts[msg.sender] = account;
        emit AccountCreated(msg.sender, account);
    }
}
