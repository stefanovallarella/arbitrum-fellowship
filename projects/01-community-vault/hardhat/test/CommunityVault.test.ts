import { expect } from "chai";
import hre from "hardhat";
import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

const GOAL = 10n * 10n ** 18n; // 10 ETH
const ONE_WEEK = 7 * 24 * 60 * 60;

describe("CommunityVault", function () {
  async function deployFixture() {
    const [owner, alice, bob] = await hre.ethers.getSigners();

    const deadline = (await time.latest()) + ONE_WEEK;

    const CommunityVault = await hre.ethers.getContractFactory("CommunityVault");
    const vault = await CommunityVault.deploy(GOAL, deadline, "Vault Receipt", "VRT");

    return { vault, owner, alice, bob, deadline };
  }

  it("mints receipt tokens 1:1 and tracks contributions on contribute()", async function () {
    const { vault, alice } = await loadFixture(deployFixture);

    await vault.connect(alice).contribute({ value: hre.ethers.parseEther("1") });

    expect(await vault.balanceOf(alice.address)).to.equal(hre.ethers.parseEther("1"));
    expect(await vault.contributions(alice.address)).to.equal(hre.ethers.parseEther("1"));
    expect(await vault.totalRaised()).to.equal(hre.ethers.parseEther("1"));
  });

  it("emits ContributionReceived on contribute()", async function () {
    const { vault, alice } = await loadFixture(deployFixture);

    await expect(vault.connect(alice).contribute({ value: hre.ethers.parseEther("1") }))
      .to.emit(vault, "ContributionReceived")
      .withArgs(alice.address, hre.ethers.parseEther("1"));
  });

  it("reverts contribution after the deadline", async function () {
    const { vault, alice, deadline } = await loadFixture(deployFixture);

    await time.increaseTo(deadline + 1);

    await expect(
      vault.connect(alice).contribute({ value: hre.ethers.parseEther("1") }),
    ).to.be.revertedWithCustomError(vault, "DeadlinePassed");
  });

  it("allows the owner to withdraw once the goal is met", async function () {
    const { vault, owner, alice } = await loadFixture(deployFixture);

    await vault.connect(alice).contribute({ value: GOAL });

    await expect(vault.connect(owner).withdraw())
      .to.emit(vault, "FundsWithdrawn")
      .withArgs(owner.address, GOAL);

    expect(await hre.ethers.provider.getBalance(await vault.getAddress())).to.equal(0n);
  });

  it("reverts withdraw before the goal is met", async function () {
    const { vault, owner, alice } = await loadFixture(deployFixture);

    await vault.connect(alice).contribute({ value: GOAL - 1n });

    await expect(vault.connect(owner).withdraw()).to.be.revertedWithCustomError(
      vault,
      "GoalNotMet",
    );
  });

  it("reverts withdraw from a non-owner account", async function () {
    const { vault, alice } = await loadFixture(deployFixture);

    await vault.connect(alice).contribute({ value: GOAL });

    await expect(vault.connect(alice).withdraw()).to.be.revertedWithCustomError(
      vault,
      "OwnableUnauthorizedAccount",
    );
  });

  it("allows a contributor to claim a refund after a failed deadline", async function () {
    const { vault, alice, deadline } = await loadFixture(deployFixture);

    await vault.connect(alice).contribute({ value: hre.ethers.parseEther("1") });
    await time.increaseTo(deadline + 1);

    await expect(vault.connect(alice).refund())
      .to.emit(vault, "RefundClaimed")
      .withArgs(alice.address, hre.ethers.parseEther("1"));

    expect(await vault.contributions(alice.address)).to.equal(0n);
  });

  it("reverts refund before the deadline", async function () {
    const { vault, alice } = await loadFixture(deployFixture);

    await vault.connect(alice).contribute({ value: hre.ethers.parseEther("1") });

    await expect(vault.connect(alice).refund()).to.be.revertedWithCustomError(
      vault,
      "DeadlineNotReached",
    );
  });

  it("reverts refund when the goal was met", async function () {
    const { vault, alice, deadline } = await loadFixture(deployFixture);

    await vault.connect(alice).contribute({ value: GOAL });
    await time.increaseTo(deadline + 1);

    await expect(vault.connect(alice).refund()).to.be.revertedWithCustomError(
      vault,
      "GoalAlreadyMet",
    );
  });

  it("reverts a second refund from the same contributor", async function () {
    const { vault, alice, deadline } = await loadFixture(deployFixture);

    await vault.connect(alice).contribute({ value: hre.ethers.parseEther("1") });
    await time.increaseTo(deadline + 1);
    await vault.connect(alice).refund();

    await expect(vault.connect(alice).refund()).to.be.revertedWithCustomError(
      vault,
      "NoContribution",
    );
  });

  it("reports Active, Successful and Failed status correctly", async function () {
    const { vault, alice, bob, deadline } = await loadFixture(deployFixture);

    expect(await vault.getStatus()).to.equal("Active");

    await vault.connect(alice).contribute({ value: hre.ethers.parseEther("1") });
    await time.increaseTo(deadline + 1);
    expect(await vault.getStatus()).to.equal("Failed");

    const { vault: vault2, deadline: deadline2 } = await loadFixture(deployFixture);
    await vault2.connect(bob).contribute({ value: GOAL });
    expect(await vault2.getStatus()).to.equal("Successful");
  });
});
