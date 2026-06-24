// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std-1.9.6/src/Test.sol";
import {SimpleStorage} from "../src/SimpleStorage.sol";

contract SimpleStorageTest is Test {
    SimpleStorage public simpleStorage;

    function setUp() public {
        simpleStorage = new SimpleStorage();
    }

    function test_defaultValueIsZero() public view {
        assertEq(simpleStorage.retrieve(), 0);
    }

    function test_storeAndRetrieve() public {
        simpleStorage.store(42);
        assertEq(simpleStorage.retrieve(), 42);
    }

    function test_emitsValueChanged() public {
        vm.expectEmit(true, true, true, true);
        emit SimpleStorage.ValueChanged(99);
        simpleStorage.store(99);
    }

    function test_anyoneCanStore() public {
        address user = makeAddr("user");
        vm.prank(user);
        simpleStorage.store(7);
        assertEq(simpleStorage.retrieve(), 7);
    }

    function testFuzz_storeArbitraryValue(uint256 value) public {
        simpleStorage.store(value);
        assertEq(simpleStorage.retrieve(), value);
    }
}
