import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { Marketplace } from "../typechain-types";

describe("Marketplace", function () {
    async function deployMarketplaceFixture() {
        const [owner, user1, user2] = await ethers.getSigners();

        const Marketplace = await ethers.getContractFactory("Marketplace");
        const marketplace = await Marketplace.deploy();

        return { marketplace, owner, user1, user2 };
    }

    describe("User Registration", function () {
        it("Should register a new user", async function () {
            const { marketplace, user1 } = await loadFixture(deployMarketplaceFixture);

            await expect(marketplace.connect(user1).registerUser("user1"))
                .to.emit(marketplace, "UserRegistered")
                .withArgs(user1.address, "user1");

            const user = await marketplace.users(user1.address);
            expect(user.username).to.equal("user1");
            expect(user.isRegistered).to.be.true;
        });

        it("Should not allow registering with an existing username", async function () {
            const { marketplace, user1, user2 } = await loadFixture(deployMarketplaceFixture);

            await marketplace.connect(user1).registerUser("user1");

            await expect(marketplace.connect(user2).registerUser("user1"))
                .to.be.revertedWith("Username already taken");
        });

        it("Should not allow a user to register twice", async function () {
            const { marketplace, user1 } = await loadFixture(deployMarketplaceFixture);

            await marketplace.connect(user1).registerUser("user1");

            await expect(marketplace.connect(user1).registerUser("newuser1"))
                .to.be.revertedWith("User already registered");
        });
    });

    describe("Item Listing", function () {
        it("Should list a new item", async function () {
            const { marketplace, user1 } = await loadFixture(deployMarketplaceFixture);

            await marketplace.connect(user1).registerUser("user1");

            await expect(marketplace.connect(user1).listItem("Item1", "Description1", ethers.parseEther("1")))
                .to.emit(marketplace, "ItemListed")
                .withArgs(1, "Item1", ethers.parseEther("1"), user1.address);

            const item = await marketplace.items(1);
            expect(item.name).to.equal("Item1");
            expect(item.description).to.equal("Description1");
            expect(item.price).to.equal(ethers.parseEther("1"));
            expect(item.isAvailable).to.be.true;
            expect(item.owner).to.equal(user1.address);
        });

        it("Should not allow unregistered users to list items", async function () {
            const { marketplace, user1 } = await loadFixture(deployMarketplaceFixture);

            await expect(marketplace.connect(user1).listItem("Item1", "Description1", ethers.parseEther("1")))
                .to.be.revertedWith("User not registered");
        });
    });

    describe("Item Purchase", function () {
        it("Should allow a user to buy an item", async function () {
            const { marketplace, user1, user2 } = await loadFixture(deployMarketplaceFixture);

            await marketplace.connect(user1).registerUser("user1");
            await marketplace.connect(user2).registerUser("user2");

            await marketplace.connect(user1).listItem("Item1", "Description1", ethers.parseEther("1"));

            await expect(marketplace.connect(user2).buyItem(1, { value: ethers.parseEther("1") }))
                .to.emit(marketplace, "ItemSold")
                .withArgs(1, user1.address, user2.address, ethers.parseEther("1"));

            const item = await marketplace.items(1);
            expect(item.isAvailable).to.be.false;
            expect(item.owner).to.equal(user2.address);

            const seller = await marketplace.users(user1.address);
            expect(seller.balance).to.equal(ethers.parseEther("1"));

            expect(item.owner).to.equal(user2.address);
        });

        it("Should not allow buying an unavailable item", async function () {
            const { marketplace, user1, user2 } = await loadFixture(deployMarketplaceFixture);

            await marketplace.connect(user1).registerUser("user1");
            await marketplace.connect(user2).registerUser("user2");

            await marketplace.connect(user1).listItem("Item1", "Description1", ethers.parseEther("1"));
            await marketplace.connect(user2).buyItem(1, { value: ethers.parseEther("1") });

            await expect(marketplace.connect(user2).buyItem(1, { value: ethers.parseEther("1") }))
                .to.be.revertedWith("Item is not available");
        });
    });

    describe("Fund Withdrawal", function () {
        it("Should allow a user to withdraw their funds", async function () {
            const { marketplace, user1, user2 } = await loadFixture(deployMarketplaceFixture);

            await marketplace.connect(user1).registerUser("user1");
            await marketplace.connect(user2).registerUser("user2");

            await marketplace.connect(user1).listItem("Item1", "Description1", ethers.parseEther("1"));
            await marketplace.connect(user2).buyItem(1, { value: ethers.parseEther("1") });

            await expect(marketplace.connect(user1).withdrawFunds())
                .to.emit(marketplace, "FundsWithdrawn")
                .withArgs(user1.address, ethers.parseEther("1"));

            const user = await marketplace.users(user1.address);
            expect(user.balance).to.equal(0);
        });
    });
});
