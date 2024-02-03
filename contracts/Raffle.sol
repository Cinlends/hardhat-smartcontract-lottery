// Raffle

// 需要让别人可以进入合约，支付一定的代币进行抽奖
// 需要随机抽取一个中奖者，把这次的奖池全部发送给中奖者
// 需要定时进行抽奖，不需要人工去触发维护，让合约永远自动执行下去

// 为了实现功能，我们需要 chainlink 提供 -> 可验证的随机数(不可篡改),自动触发的定时器(keeper)

// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.7;

contract Raffle {}
