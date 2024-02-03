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
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
	solidity: "0.8.7",
};
