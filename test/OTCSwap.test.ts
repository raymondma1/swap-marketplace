import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { OTCSwap, MockERC20 } from "../typechain-types";

describe("OTCSwap", function () {
  async function deployOTCSwapFixture() {
    const [owner, initiator, counterparty] = await ethers.getSigners();

    const TokenMock = await ethers.getContractFactory("MockERC20");
    const tokenX = await TokenMock.deploy("TokenX", "TKX") as MockERC20;
    const tokenY = await TokenMock.deploy("TokenY", "TKY") as MockERC20;

    await tokenX.mint(initiator.address, ethers.parseEther("1000000"));
    await tokenY.mint(counterparty.address, ethers.parseEther("1000000"));

    const OTCSwap = await ethers.getContractFactory("OTCSwap");
    const otcSwap = await OTCSwap.deploy();

    return { otcSwap, tokenX, tokenY, owner, initiator, counterparty };
  }

  async function createSwap(otcSwap: OTCSwap, initiator: any, counterparty: any, tokenX: MockERC20, tokenY: MockERC20, expiration: number) {
    const swapId = 1;
    const amountX = ethers.parseEther("100");
    const amountY = ethers.parseEther("200");

    const swap = {
      swapId,
      initiator: initiator.address,
      counterparty: counterparty.address,
      tokenX: tokenX.target,
      tokenY: tokenY.target,
      amountX,
      amountY,
      expiration,
    };

    const domain = {
      name: "OTCSwap",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: otcSwap.target,
    };

    const types = {
      Swap: [
        { name: "swapId", type: "uint256" },
        { name: "initiator", type: "address" },
        { name: "counterparty", type: "address" },
        { name: "tokenX", type: "address" },
        { name: "tokenY", type: "address" },
        { name: "amountX", type: "uint256" },
        { name: "amountY", type: "uint256" },
        { name: "expiration", type: "uint256" },
      ],
    };

    const signature = await initiator.signTypedData(domain, types, swap);

    return { swap, signature };
  }

  describe("Swap Execution", function () {
    it("Should execute a valid swap", async function () {
      const { otcSwap, tokenX, tokenY, initiator, counterparty } = await loadFixture(deployOTCSwapFixture);

      const { swap, signature } = await createSwap(otcSwap, initiator, counterparty, tokenX, tokenY, (await time.latest()) + 3600);

      await tokenX.connect(initiator).approve(otcSwap.target, swap.amountX);
      await tokenY.connect(counterparty).approve(otcSwap.target, swap.amountY);

      await expect(otcSwap.connect(counterparty).executeSwap(swap, signature))
        .to.emit(otcSwap, "SwapExecuted")
        .withArgs(ethers.solidityPackedKeccak256(
          ["uint256", "address", "address", "address", "address", "uint256", "uint256", "uint256"],
          Object.values(swap)
        ));

      expect(await tokenX.balanceOf(counterparty.address)).to.equal(swap.amountX);
      expect(await tokenY.balanceOf(initiator.address)).to.equal(swap.amountY);
    });

    it("Should not execute an expired swap", async function () {
      const { otcSwap, tokenX, tokenY, initiator, counterparty } = await loadFixture(deployOTCSwapFixture);

      const { swap, signature } = await createSwap(otcSwap, initiator, counterparty, tokenX, tokenY, (await time.latest()) + 10);

      await time.increase(11);

      await expect(
        otcSwap.connect(counterparty).executeSwap(swap, signature)
      ).to.be.revertedWith("Swap expired");
    });

    it("Should not allow someone to execute a swap not intended for them", async function () {
      const { otcSwap, tokenX, tokenY, initiator, counterparty, owner } = await loadFixture(deployOTCSwapFixture);

      const { swap, signature } = await createSwap(otcSwap, initiator, counterparty, tokenX, tokenY, (await time.latest()) + 3600);

      await tokenX.connect(initiator).approve(otcSwap.target, swap.amountX);
      await tokenY.connect(owner).approve(otcSwap.target, swap.amountY);

      await expect(
        otcSwap.connect(owner).executeSwap(swap, signature)
      ).to.be.revertedWith("Only counterparty can execute");
    });
  });

  describe("Swap Cancellation", function () {
    it("Should allow initiator to cancel a swap", async function () {
      const { otcSwap, tokenX, tokenY, initiator, counterparty } = await loadFixture(deployOTCSwapFixture);

      const { swap, signature } = await createSwap(otcSwap, initiator, counterparty, tokenX, tokenY, (await time.latest()) + 3600);

      await expect(otcSwap.connect(initiator).cancelSwap(swap, signature))
        .to.emit(otcSwap, "SwapCancelled")
        .withArgs(ethers.solidityPackedKeccak256(
          ["uint256", "address", "address", "address", "address", "uint256", "uint256", "uint256"],
          Object.values(swap)
        ));

      await expect(
        otcSwap.connect(counterparty).executeSwap(swap, signature)
      ).to.be.revertedWith("Swap has been cancelled");
    });

    it("Should not allow non-initiator to cancel a swap", async function () {
      const { otcSwap, tokenX, tokenY, initiator, counterparty } = await loadFixture(deployOTCSwapFixture);

      const { swap, signature } = await createSwap(otcSwap, initiator, counterparty, tokenX, tokenY, (await time.latest()) + 3600);

      await expect(
        otcSwap.connect(counterparty).cancelSwap(swap, signature)
      ).to.be.revertedWith("Only initiator can cancel");
    });
  });
});
