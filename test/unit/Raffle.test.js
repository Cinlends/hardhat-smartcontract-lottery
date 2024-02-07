const { ethers, getNamedAccounts, network, waffle } = require("hardhat");
const { networkConfig } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

describe("Raffle Unit Tests", () => {
	let deployer, raffle, VRFCoordinatorV2Mock, entranceFee, interval, accounts;
	const chainId = network.config.chainId;
	beforeEach(async () => {
		deployer = (await getNamedAccounts()).deployer;
		accounts = await ethers.getSigners();
		await deployments.fixture(["all"]);
		raffle = await ethers.getContract("Raffle", deployer);
		VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
		entranceFee = await raffle.getEntranceFee();
		interval = await raffle.getInterval();
	});

	describe("constructor", () => {
		it("Should set the correct VRFCoordinatorV2Mock in the constructor", async () => {
			const vrfCoordinatorV2Address = await raffle.getVrfCoordinator();
			const vrfCoordinatorV2MockAddress = await VRFCoordinatorV2Mock.getAddress();
			assert.equal(vrfCoordinatorV2Address, vrfCoordinatorV2MockAddress);
		});
		it("Should set the correct raffle state in the constructor", async () => {
			const raffleState = await raffle.getRaffleState();
			const interval = await raffle.getInterval();
			assert.equal(raffleState.toString(), "0");
			assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
		});
	});

	describe("enterRaffle", () => {
		it("Should revert if the entrance fee is not paid", async () => {
			await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(raffle, "Raffle__NotEnoughETHEntered");
		});
		it("Should records the players when they call enterRaffle", async () => {
			await raffle.enterRaffle({ value: entranceFee });
			const playerAddress = await raffle.getPlayer("0");
			assert.equal(playerAddress, deployer);
		});
		it("Emit event in enterRaffle", async () => {
			await expect(raffle.enterRaffle({ value: entranceFee })).to.be.emit(raffle, "RaffleEnter");
		});
		it("doesn't allow entrance when raffle is calculating", async () => {
			await raffle.enterRaffle({ value: entranceFee });
			await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
			await network.provider.request({ method: "evm_mine", params: [] });
			await raffle.performUpkeep("0x");
			await expect(raffle.enterRaffle({ value: entranceFee })).to.be.revertedWithCustomError(raffle, "Raffle__RaffleNotOpen");
		});
	});

	describe("checkUpkeep", () => {
		it("Should return false if player haven't send any ether", async () => {
			await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
			await network.provider.request({ method: "evm_mine", params: [] });
			const { upkeepNeeded } = await raffle.checkUpkeep("0x");
			assert(!upkeepNeeded);
		});
		it("Should return true if all conditions are met", async () => {
			await raffle.enterRaffle({ value: entranceFee });
			await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
			await network.provider.request({ method: "evm_mine", params: [] });
			const { upkeepNeeded } = await raffle.checkUpkeep("0x");
			assert(upkeepNeeded);
		});
		it("Should return false if raffle is calculating", async () => {
			await raffle.enterRaffle({ value: entranceFee });
			await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
			await network.provider.request({ method: "evm_mine", params: [] });
			await raffle.performUpkeep("0x");
			const { upkeepNeeded } = await raffle.checkUpkeep("0x");
			assert(!upkeepNeeded);
		});
		it("Should return false if haven't enough players", async () => {
			await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
			await network.provider.request({ method: "evm_mine", params: [] });
			const { upkeepNeeded } = await raffle.checkUpkeep("0x");
			assert(!upkeepNeeded);
		});
		it("Should return false if haven't passed enough time", async () => {
			await raffle.enterRaffle({ value: entranceFee });
			await network.provider.send("evm_increaseTime", [Number(interval) - 5]);
			await network.provider.request({ method: "evm_mine", params: [] });
			const { upkeepNeeded } = await raffle.checkUpkeep("0x");
			assert(!upkeepNeeded);
		});
	});

	describe("performUpkeep", () => {
		it("Should revert if the upkeep is not needed", async () => {
			await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(raffle, "Raffle__UpkeepNotNeeded");
		});
		it("Should run if the upkeepNeeded is true", async () => {
			await raffle.enterRaffle({ value: entranceFee });
			await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
			await network.provider.request({ method: "evm_mine", params: [] });
			const txResponse = await raffle.performUpkeep("0x");
			assert(txResponse);
		});
		it("Update the raffle state and emit event", async () => {
			await raffle.enterRaffle({ value: entranceFee });
			await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
			await network.provider.request({ method: "evm_mine", params: [] });
			await expect(raffle.performUpkeep("0x")).to.be.emit(raffle, "RequestRaffleWinner");
			const raffleState = await raffle.getRaffleState();
			assert.equal(raffleState.toString(), "1");
		});
	});
	describe("fulfillRandomWords", () => {
		beforeEach(async () => {
			await raffle.enterRaffle({ value: entranceFee });
			await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
			await network.provider.request({ method: "evm_mine", params: [] });
		});
		it("Only call after performUpkeep", async () => {
			await expect(VRFCoordinatorV2Mock.fulfillRandomWords(0, raffle)).to.be.revertedWith("nonexistent request");
		});
		// The full process
		it("Pick a winner,resets and sends money", async () => {
			const additionalEntrances = 3; // to test
			const startingIndex = 2;
			let startingBalance;
			for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
				// 多人参与抽奖
				raffle = await raffle.connect(accounts[i]);
				await raffle.enterRaffle({ value: entranceFee });
			}
			const startingTimeStamp = await raffle.getLatestTimeStamp();

			await new Promise(async (resolve, reject) => {
				// 先创建一个监听事件，不使用 await 进行等待，它得到一个 promise，直接运行下面的代码
				raffle.once("WinnerPicked", async () => {
					// event listener for WinnerPicked
					console.log("WinnerPicked event triggered!");

					try {
						// assert 各种状态是否正确更新
						resolve(); // if try passes, resolves the promise
					} catch (e) {
						reject(e); // if try fails, rejects the promise
					}
				});

				// kicking off the event by mocking the chainlink keepers and vrf coordinator
				try {
					const tx = await raffle.performUpkeep("0x");
					const txReceipt = await tx.wait(1);
					startingBalance = await ethers.provider.getBalance(accounts[2]);
					const raffleAddress = await raffle.getAddress();
					console.log(`requestId: ${txReceipt.logs[1].args.requestId}`);
					await VRFCoordinatorV2Mock.fulfillRandomWords(txReceipt.logs[1].args.requestId, raffleAddress);
				} catch (e) {
					reject(e);
				}
			});
		});
	});
});
