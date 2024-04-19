import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";
import { Allocator, Allocator__factory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const usdc = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const localStrategyAddress = "0xbDb97eC319c41c6FA383E94eCE6Bdf383dFC7BE4";
const foreignStrategyAddress = "0x7fC77b5c7614E1533320Ea6DDc2Eb61fa00A9714";

const amount = 10e6;

let allocator: Allocator;
let richSigner: HardhatEthersSigner;

describe("Allocator", function () {
  this.beforeAll(async function () {
    const [owner, otherAccount] = await hre.ethers.getSigners();

    const usdcOwner = "0x4B16c5dE96EB2117bBE5fd171E4d203624B014aa";
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [usdcOwner],
    });

    richSigner = await hre.ethers.getSigner(usdcOwner);

    const Allocator = await hre.ethers.getContractFactory("Allocator");
    allocator = await Allocator.deploy(
      localStrategyAddress,
      foreignStrategyAddress
    );
  });

  it("Should set prev local pps as current, and update current", async function () {
    await allocator.updateLocalStrategyPps();
    const localStrategyPrevPps = await allocator.localStrategyPrevPps();
    expect(localStrategyPrevPps).greaterThan(0);

    const localStrategyCurrentPps = await allocator.localStrategyCurrentPps();
    expect(localStrategyCurrentPps).greaterThan(0);

    await allocator.updateLocalStrategyPps();

    const updatedLocalStrategyPrevPps = await allocator.localStrategyPrevPps();
    expect(updatedLocalStrategyPrevPps).to.equal(localStrategyCurrentPps);
  });

  it("rich signer can not deposit without allowance", async function () {
    await expect(
      allocator.connect(richSigner).depositAsset(amount)
    ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
  });

  it("rich signer can deposit after allowance", async function () {
    const USDC = await hre.ethers.getContractAt("IERC20", usdc);

    await USDC.connect(richSigner).approve(allocator, amount);
    await allocator.connect(richSigner).depositAsset(amount);

    const richUserBalance = await allocator.balanceOf(richSigner.address);
    expect(richUserBalance).to.equal(amount);
  });

  it("admin can put money into local strategy", async function () {
    const sharesBefore = await allocator.sharesInLocalStrategy();
    expect(sharesBefore).to.equal(0);

    await allocator.putMoneyIntoLocalStrategy(amount);

    const shares = await allocator.sharesInLocalStrategy();
    console.log("shares in local strategy", shares.toString());
    expect(shares).to.greaterThan(0);

    const freeMoney = await allocator.freeMoney();
    expect(freeMoney).to.equal(0);

    const localStrategyBalance = await allocator.localStrategyBalance();
    expect(localStrategyBalance).to.equal(amount);
  });

  it("admin can withdraw money from local strategy", async function () {
    await allocator.withdrawMoneyFromLocalStrategy();

    const shares = await allocator.sharesInLocalStrategy();
    console.log("shares in local strategy", shares.toString());
    expect(shares).to.be.eq(0);

    const freeMoney = await allocator.freeMoney();
    expect(freeMoney).to.equal(amount - 1);

    const localStrategyBalance = await allocator.localStrategyBalance();
    expect(localStrategyBalance).to.equal(0);
  });

  // it("Should calculate apr of local strategy", async function () {
  //   const { allocator, richSigner } = await loadFixture(
  //     deployAllocatorFixture
  //   );

  //   await allocator.updateLocalStrategyPps();
  //   await allocator.getProofFromForeignStrategyAndUpdateDebt(100, 120);
  // });
});
