import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("SimpleStorage", function () {
  async function deployFixture() {
    const [owner, other] = await hre.ethers.getSigners();
    const SimpleStorage = await hre.ethers.getContractFactory("SimpleStorage");
    const simpleStorage = await SimpleStorage.deploy();
    return { simpleStorage, owner, other };
  }

  it("should return 0 by default", async function () {
    const { simpleStorage } = await loadFixture(deployFixture);
    expect(await simpleStorage.retrieve()).to.equal(0n);
  });

  it("should store and retrieve a value", async function () {
    const { simpleStorage } = await loadFixture(deployFixture);
    await simpleStorage.store(42);
    expect(await simpleStorage.retrieve()).to.equal(42n);
  });

  it("should emit ValueChanged on store", async function () {
    const { simpleStorage } = await loadFixture(deployFixture);
    await expect(simpleStorage.store(99))
      .to.emit(simpleStorage, "ValueChanged")
      .withArgs(99n);
  });

  it("should allow anyone to store a value", async function () {
    const { simpleStorage, other } = await loadFixture(deployFixture);
    await simpleStorage.connect(other).store(7);
    expect(await simpleStorage.retrieve()).to.equal(7n);
  });
});
