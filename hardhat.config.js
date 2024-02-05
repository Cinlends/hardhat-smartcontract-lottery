// 测试用的
require("@nomiclabs/hardhat-waffle");
// 扫描验证合约用的
require("@nomiclabs/hardhat-etherscan");
// 部署合约用的
require("hardhat-deploy");
// 测试单元测试对合约的覆盖率用的
require("solidity-coverage");
// 生成合约的gas消耗报告用的
require("hardhat-gas-reporter");
// 合约大小分析用的
require("hardhat-contract-sizer");
// 读取环境变量用的
require("dotenv").config();

// 给验证合约设置代理
const LOCAL_HTTP_PROXY = process.env.LOCAL_HTTP_PROXY || "http://127.0.0.1:10809";
const { setGlobalDispatcher, ProxyAgent } = require("undici");
const proxyAgent = new ProxyAgent(LOCAL_HTTP_PROXY);
setGlobalDispatcher(proxyAgent);

// 从环境变量中获取私钥和rpc地址
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "private key";
const ETHER_SCAN_API_KEY = process.env.ETHER_SCAN_API_KEY || "ether scan api key";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
	solidity: "0.8.7",
	defaultNetwork: "hardhat",
	networks: {
		hardhat: {
			chainId: 31337,
			blockConfirmation: 1,
		},
		local: {
			url: "http://localhost:8545",
			chainId: 31337,
			blockConfirmation: 1,
		},
		sepolia: {
			url: SEPOLIA_RPC_URL,
			accounts: [PRIVATE_KEY],
			chainId: 11155111,
			blockConfirmation: 6, // 6个区块确认
		},
	},
	namedAccounts: {
		deployer: {
			default: 0, // 部署者默认为第一个账户
		},
		player: {
			default: 1,
		},
	},
};
