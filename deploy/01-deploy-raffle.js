const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const FUND_AMOUNT = ethers.parseEther("30");

module.exports = async function ({ getNamedAccounts, deployments }) {
	// 部署和日志方法
	const { deploy, log } = deployments;
	// 获取部署者，从hardhat.config.js中的namedAccounts中获取
	const { deployer } = await getNamedAccounts();
	const { chainId } = network.config;

	// 这部分全都是根据不同链配置不同的部署合约参数
	let vrfCoordinatorV2Address, subscriptionId;

	if (developmentChains.includes(network.name)) {
		// await ethers.getContract("VRFCoordinatorV2Mock")
		const vrfCoordinatorV2 = await ethers.getContract("VRFCoordinatorV2Mock");
		vrfCoordinatorV2Address = await vrfCoordinatorV2.getAddress();
		const txResponse = await vrfCoordinatorV2.createSubscription();
		const txReceipt = await txResponse.wait();
		subscriptionId = txReceipt.logs[0].args.subId;
		await vrfCoordinatorV2.fundSubscription(subscriptionId, FUND_AMOUNT);
	} else {
		vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2Address"];
		subscriptionId = networkConfig[chainId]["subscriptionId"];
	}
	const entranceFee = networkConfig[chainId]["entranceFee"];
	const gasLane = networkConfig[chainId]["gasLane"];
	const callBackGasLimit = networkConfig[chainId]["callBackGasLimit"];
	const interval = networkConfig[chainId]["interval"];
	const args = [vrfCoordinatorV2Address, entranceFee, gasLane, subscriptionId, callBackGasLimit, interval];
	log("deploying Raffle...");
	const raffle = await deploy("Raffle", {
		from: deployer,
		args: args,
		log: true,
		waitConfirmations: network.config.blockConfirmation || 1,
	});
	if (developmentChains.includes(network.name)) {
		const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
		await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address);
		log("Consumer is added and this was the fix ig");
	}

	// verify
	if (!developmentChains.includes(network.name) && process.env.ETHER_SCAN_API_KEY) {
		await verify(raffle.address, args);
	}
	log("Raffle deployed!");
	log("-------------------------------------");
};

module.exports.tags = ["all", "raffle"];
