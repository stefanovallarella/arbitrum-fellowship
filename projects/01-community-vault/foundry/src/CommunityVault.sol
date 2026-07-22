// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "@openzeppelin-contracts-5.1.0/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin-contracts-5.1.0/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin-contracts-5.1.0/utils/ReentrancyGuard.sol";

/// @notice Mini crowdfunding vault: contributors send ETH before a deadline and receive
/// ERC-20 receipt tokens 1:1 (wei:token). Owner withdraws if the goal is met; otherwise
/// contributors pull their own refund after the deadline.
contract CommunityVault is ERC20, Ownable, ReentrancyGuard {
    uint256 public immutable goal;
    uint256 public immutable deadline;
    uint256 public totalRaised;
    bool public withdrawn;

    mapping(address => uint256) public contributions;

    event ContributionReceived(address indexed contributor, uint256 amount);
    event FundsWithdrawn(address indexed owner, uint256 amount);
    event RefundClaimed(address indexed contributor, uint256 amount);

    error ZeroContribution();
    error DeadlinePassed();
    error DeadlineNotReached();
    error GoalNotMet();
    error GoalAlreadyMet();
    error AlreadyWithdrawn();
    error NoContribution();
    error TransferFailed();

    constructor(uint256 _goal, uint256 _deadline, string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        Ownable(msg.sender)
    {
        require(_goal > 0, "goal must be > 0");
        require(_deadline > block.timestamp, "deadline must be in the future");
        goal = _goal;
        deadline = _deadline;
    }

    /// @notice Contribute ETH before the deadline; mints receipt tokens 1 wei : 1 token.
    function contribute() external payable {
        if (block.timestamp >= deadline) revert DeadlinePassed();
        if (msg.value == 0) revert ZeroContribution();

        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;

        _mint(msg.sender, msg.value);

        emit ContributionReceived(msg.sender, msg.value);
    }

    /// @notice Owner-only withdrawal of the full balance, only once the goal has been met.
    function withdraw() external onlyOwner nonReentrant {
        if (totalRaised < goal) revert GoalNotMet();
        if (withdrawn) revert AlreadyWithdrawn();

        withdrawn = true;
        uint256 amount = address(this).balance;

        (bool success,) = owner().call{value: amount}("");
        if (!success) revert TransferFailed();

        emit FundsWithdrawn(owner(), amount);
    }

    /// @notice Pull-pattern refund for contributors when the deadline passes without the goal being met.
    function refund() external nonReentrant {
        if (block.timestamp < deadline) revert DeadlineNotReached();
        if (totalRaised >= goal) revert GoalAlreadyMet();

        uint256 amount = contributions[msg.sender];
        if (amount == 0) revert NoContribution();

        contributions[msg.sender] = 0;

        (bool success,) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit RefundClaimed(msg.sender, amount);
    }

    /// @notice Human-readable campaign status.
    function getStatus() external view returns (string memory) {
        if (totalRaised >= goal) return "Successful";
        if (block.timestamp < deadline) return "Active";
        return "Failed";
    }

    receive() external payable {
        revert("use contribute()");
    }
}
