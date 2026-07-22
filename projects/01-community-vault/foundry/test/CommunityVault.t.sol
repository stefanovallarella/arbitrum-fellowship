// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std-1.9.6/src/Test.sol";
import {CommunityVault} from "../src/CommunityVault.sol";

contract CommunityVaultTest is Test {
    CommunityVault public vault;

    address public owner = address(this);
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 public constant GOAL = 10 ether;
    uint256 public deadline;

    event ContributionReceived(address indexed contributor, uint256 amount);
    event FundsWithdrawn(address indexed owner, uint256 amount);
    event RefundClaimed(address indexed contributor, uint256 amount);

    function setUp() public {
        deadline = block.timestamp + 7 days;
        vault = new CommunityVault(GOAL, deadline, "Vault Receipt", "VRT");

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    function test_contributeMintsTokensAndTracksState() public {
        vm.prank(alice);
        vault.contribute{value: 1 ether}();

        assertEq(vault.balanceOf(alice), 1 ether);
        assertEq(vault.contributions(alice), 1 ether);
        assertEq(vault.totalRaised(), 1 ether);
        assertEq(address(vault).balance, 1 ether);
    }

    function test_contributeEmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit ContributionReceived(alice, 1 ether);
        vm.prank(alice);
        vault.contribute{value: 1 ether}();
    }

    function test_revertOnZeroContribution() public {
        vm.prank(alice);
        vm.expectRevert(CommunityVault.ZeroContribution.selector);
        vault.contribute{value: 0}();
    }

    function test_revertContributeAfterDeadline() public {
        vm.warp(deadline + 1);
        vm.prank(alice);
        vm.expectRevert(CommunityVault.DeadlinePassed.selector);
        vault.contribute{value: 1 ether}();
    }

    function test_withdrawAfterGoalMet() public {
        vm.prank(alice);
        vault.contribute{value: GOAL}();

        uint256 ownerBalanceBefore = owner.balance;

        vm.expectEmit(true, true, true, true);
        emit FundsWithdrawn(owner, GOAL);
        vault.withdraw();

        assertEq(owner.balance, ownerBalanceBefore + GOAL);
        assertEq(address(vault).balance, 0);
        assertTrue(vault.withdrawn());
    }

    function test_revertWithdrawBeforeGoalMet() public {
        vm.prank(alice);
        vault.contribute{value: GOAL - 1}();

        vm.expectRevert(CommunityVault.GoalNotMet.selector);
        vault.withdraw();
    }

    function test_revertWithdrawByNonOwner() public {
        vm.prank(alice);
        vault.contribute{value: GOAL}();

        vm.prank(bob);
        vm.expectRevert();
        vault.withdraw();
    }

    function test_revertDoubleWithdraw() public {
        vm.prank(alice);
        vault.contribute{value: GOAL}();
        vault.withdraw();

        vm.expectRevert(CommunityVault.AlreadyWithdrawn.selector);
        vault.withdraw();
    }

    function test_refundAfterFailedDeadline() public {
        vm.prank(alice);
        vault.contribute{value: 1 ether}();

        vm.warp(deadline + 1);

        uint256 aliceBalanceBefore = alice.balance;

        vm.expectEmit(true, true, true, true);
        emit RefundClaimed(alice, 1 ether);
        vm.prank(alice);
        vault.refund();

        assertEq(alice.balance, aliceBalanceBefore + 1 ether);
        assertEq(vault.contributions(alice), 0);
    }

    function test_revertRefundBeforeDeadline() public {
        vm.prank(alice);
        vault.contribute{value: 1 ether}();

        vm.prank(alice);
        vm.expectRevert(CommunityVault.DeadlineNotReached.selector);
        vault.refund();
    }

    function test_revertRefundWhenGoalMet() public {
        vm.prank(alice);
        vault.contribute{value: GOAL}();

        vm.warp(deadline + 1);

        vm.prank(alice);
        vm.expectRevert(CommunityVault.GoalAlreadyMet.selector);
        vault.refund();
    }

    function test_revertDoubleRefund() public {
        vm.prank(alice);
        vault.contribute{value: 1 ether}();

        vm.warp(deadline + 1);

        vm.prank(alice);
        vault.refund();

        vm.prank(alice);
        vm.expectRevert(CommunityVault.NoContribution.selector);
        vault.refund();
    }

    function test_getStatusTransitions() public {
        assertEq(vault.getStatus(), "Active");

        vm.prank(alice);
        vault.contribute{value: GOAL}();
        assertEq(vault.getStatus(), "Successful");

        vm.warp(deadline + 1);
        assertEq(vault.getStatus(), "Successful");
    }

    function test_getStatusFailed() public {
        vm.prank(alice);
        vault.contribute{value: 1 ether}();

        vm.warp(deadline + 1);
        assertEq(vault.getStatus(), "Failed");
    }

    /// @notice Fuzz invariant: no matter how contributions are split across contributors,
    /// the sum of all refunds claimed can never exceed what the contract actually holds.
    function testFuzz_refundsNeverExceedContractBalance(uint96 aliceAmount, uint96 bobAmount) public {
        aliceAmount = uint96(bound(aliceAmount, 1, GOAL - 1));
        bobAmount = uint96(bound(bobAmount, 1, GOAL - 1 - aliceAmount));

        vm.prank(alice);
        vault.contribute{value: aliceAmount}();
        vm.prank(bob);
        vault.contribute{value: bobAmount}();

        vm.warp(deadline + 1);

        uint256 contractBalanceBefore = address(vault).balance;
        uint256 totalRefunded;

        vm.prank(alice);
        vault.refund();
        totalRefunded += aliceAmount;

        vm.prank(bob);
        vault.refund();
        totalRefunded += bobAmount;

        assertLe(totalRefunded, contractBalanceBefore);
        assertEq(totalRefunded, contractBalanceBefore);
        assertEq(address(vault).balance, 0);
    }

    receive() external payable {}
}
