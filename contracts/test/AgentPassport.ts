import { expect } from "chai";
import { ethers } from "hardhat";

describe("AgentPassport", function () {
  it("mints, validates, and revokes an agent passport", async function () {
    const [controller, agent, other] = await ethers.getSigners();

    const AgentPassport = await ethers.getContractFactory("AgentPassport");
    const passport = await AgentPassport.deploy();

    const hash = ethers.keccak256(ethers.toUtf8Bytes("read_products,compare_prices"));

    await passport
      .connect(controller)
      .mintPassport(agent.address, "ipfs://metadata", hash);

    expect(await passport.isValidAgent(1, agent.address)).to.equal(true);
    expect(await passport.isValidAgent(1, other.address)).to.equal(false);

    await passport.connect(controller).revokePassport(1);

    expect(await passport.isValidAgent(1, agent.address)).to.equal(false);
  });

  it("blocks transfers", async function () {
    const [controller, agent, receiver] = await ethers.getSigners();

    const AgentPassport = await ethers.getContractFactory("AgentPassport");
    const passport = await AgentPassport.deploy();

    const hash = ethers.keccak256(ethers.toUtf8Bytes("read_products"));
    await passport.connect(controller).mintPassport(agent.address, "ipfs://metadata", hash);

    await expect(
      passport
        .connect(controller)
        .transferFrom(controller.address, receiver.address, 1)
    ).to.be.revertedWithCustomError(passport, "SoulboundToken");
  });
});
