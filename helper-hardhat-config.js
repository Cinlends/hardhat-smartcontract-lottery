const { ethers } = require("hardhat");

const networkConfig = {
	// 不同链的 chainId 对应的配置
	31337: {
		name: "localhost",
		entranceFee: ethers.parseEther("0.02"),
		gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
		callBackGasLimit: "500000",
		interval: "5",
	},
	11155111: {
		name: "sepolia",
		// 线上的 VRF 合约地址
		vrfCoordinatorV2Address: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
		entranceFee: ethers.parseEther("0.01"),
		gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
		subscriptionId: "0",
		callBackGasLimit: "500000",
		interval: "30",
	},
};

const developmentChains = ["hardhat", "localhost"];

module.exports = {
	networkConfig,
	developmentChains,
};
