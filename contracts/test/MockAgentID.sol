// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Test-only stand-in for the Agent ID contract. Not deployed to mainnet.
contract MockAgentID {
    mapping(address => uint256) public balanceOf;

    function setHolder(address who, bool holds) external {
        balanceOf[who] = holds ? 1 : 0;
    }
}
