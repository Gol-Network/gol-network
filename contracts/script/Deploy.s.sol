// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { GolAccountFactory } from "../src/GolAccountFactory.sol";

interface VmBroadcast {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Deploy {
    error WrongChain(uint256 actual);

    uint256 internal constant ARC_TESTNET_CHAIN_ID = 5_042_002;
    address internal constant ARC_TESTNET_USDC = 0x3600000000000000000000000000000000000000;
    VmBroadcast internal constant vm =
        VmBroadcast(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (GolAccountFactory factory) {
        if (block.chainid != ARC_TESTNET_CHAIN_ID) revert WrongChain(block.chainid);
        vm.startBroadcast();
        factory = new GolAccountFactory(ARC_TESTNET_USDC);
        vm.stopBroadcast();
    }
}
