const { network, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

// 每次发起随机数调用请求的费用
const BASE_FEE = ethers.parseEther("0.25");
// 每gas对应的link数量
const GAS_PRICE_LINK = 1e9;

module.exports = async function ({ getNamedAccounts, deployments }) {
	const { deploy, log } = deployments;
	const { deployer } = await getNamedAccounts();
	const args = [BASE_FEE, GAS_PRICE_LINK];
	// 判断只需要在本地部署
	if (developmentChains.includes(network.name)) {
		log(`Local network detected, delpoying mock contract...`);
		await deploy("VRFCoordinatorV2Mock", {
			from: deployer,
			args: args,
			log: true,
		});
		log(`Mock VRFCoordinatorV2 deployed!`);
		log("------------------------------------");
	}
};

module.exports.tags = ["all", "mock"];
