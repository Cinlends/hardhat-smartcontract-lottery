// Raffle

// 需要让别人可以进入合约，支付一定的代币进行抽奖
// 需要随机抽取一个中奖者，把这次的奖池全部发送给中奖者
// 需要定时进行抽奖，不需要人工去触发维护，让合约永远自动执行下去

// 为了实现功能，我们需要 chainlink 提供 -> 可验证的随机数(不可篡改),自动触发的定时器(keeper)

// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

/* Error */
// 自定义错误，表明属于哪个合约，错误信息
error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__RaffleNotOpen();
error Raffle__UpkeepNotNeeded();

contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
	/* Type */
	enum RaffleState {
		OPEN,
		CALCULATING
	}

	/* State Variables */
	// 设置入场费
	uint256 private immutable i_entranceFee;
	// 存储参与抽奖的人，需要是可支付的地址
	address payable[] private s_players;
	VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
	// gas Lane key hash value，最大gas 您愿意为请求支付的价格（以 wei 为单位），超过这个gas就不会调用
	bytes32 private immutable i_gasLane;
	// 订阅的chainlink合约id
	uint64 private immutable i_subscriptionId;
	// 限制回调我们 fulfillRandomWords() 可以使用的gas，防止 fulfillRandomWords() 花费了太多gas
	uint32 private immutable i_callBackGasLimit;
	// 请求随机数后需要的区块确认数，常量 3
	uint16 private constant REQUEST_CONFIRMATIONS = 3;
	// 设置请求随机数的个数
	uint32 private constant NUM_WORDS = 1;

	// Lottery Variables
	address private s_recentWinner;
	RaffleState private s_raffleState;
	// 记录上一次抽奖的时间戳
	uint256 private s_latestTimeStamp;
	// 设置抽奖的时间间隔
	uint256 private immutable i_interval;

	/* Events */
	// 事件命名最好是与函数命名相反
	event RaffleEnter(address indexed player);
	event RequestRaffleWinner(uint256 indexed requestId);
	event WinnerPicked(address indexed winner);

	/* Function */
	// vrfCoordinatorV2是随机数验证的合约地址
	constructor(
		address vrfCoordinatorV2,
		uint256 entranceFee,
		bytes32 gasLane,
		uint64 subscriptionId,
		uint32 callBackGasLimit,
		uint256 interval
	) VRFConsumerBaseV2(vrfCoordinatorV2) {
		i_entranceFee = entranceFee;
		i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
		i_gasLane = gasLane;
		i_subscriptionId = subscriptionId;
		i_callBackGasLimit = callBackGasLimit;
		// 初始化抽奖状态为开启
		s_raffleState = RaffleState.OPEN;
		// 初始化第一次抽奖的时间戳
		s_latestTimeStamp = block.timestamp;
		i_interval = interval;
	}

	// 参与抽奖
	/**
	 * @dev 用户参与抽奖的函数。
	 * @notice 用户需要支付足够的入场费用才能参与抽奖。
	 * @notice 只有在抽奖状态为OPEN时才能参与抽奖。
	 * @notice 参与抽奖后，用户的地址将被存储在参与者数组中。
	 * @notice 在更新参与者数组时，会触发RaffleEnter事件。
	 */
	function enterRaffle() public payable {
		if (msg.value < i_entranceFee) {
			revert Raffle__NotEnoughETHEntered();
		}
		if (s_raffleState != RaffleState.OPEN) {
			revert Raffle__RaffleNotOpen();
		}
		s_players.push(payable(msg.sender));
		emit RaffleEnter(msg.sender);
	}

	/**
	 * @dev 这个函数是 chainlink keeper 调用的，用来检查是否需要触发执行 performUpkeep()，条件是 upkeepNeeded 返回 true
	 * 想要让 upkeepNeeded 返回 true,需要以下条件：
	 * 1. 时间间隔大于设定值
	 * 2. 抽奖需要至少一人参与，奖池里有足够的ether
	 * 3. 我们的 keeper 要有足够的 LINK 来支付
	 * 4. 抽奖要处于开启状态(比如在请求随机数期间就应该关闭参与抽奖，防止新的人参加)
	 */
	function checkUpkeep(bytes memory /* checkData */) public view override returns (bool upkeepNeeded, bytes memory /* performData */) {
		bool isOpen = (s_raffleState == RaffleState.OPEN);
		bool hasEnoughPlayers = (s_players.length > 0);
		bool timePassed = ((block.timestamp - s_latestTimeStamp) > i_interval);
		bool hasEnoughEther = (address(this).balance > 0);
		// 满足上面所有条件，返回true，触发performUpkeep()
		upkeepNeeded = (isOpen && hasEnoughPlayers && timePassed && hasEnoughEther);
	}

	// 选择一个随机的中奖者(这里就需要使用到 chainlink VRF 和 chainlink keeper 了)
	function performUpkeep(bytes calldata /* performData */) external override {
		(bool upkeepNeeded, ) = checkUpkeep("");
		if (!upkeepNeeded) {
			revert Raffle__UpkeepNotNeeded();
		}
		s_raffleState = RaffleState.CALCULATING;
		// requestRandomWords会返回调用者的信息
		uint256 requestId = i_vrfCoordinator.requestRandomWords(
			i_gasLane, // gaslane 你愿意支付的最大gas费，不同网络上的gas费不一样
			i_subscriptionId,
			REQUEST_CONFIRMATIONS,
			i_callBackGasLimit,
			NUM_WORDS
		);
		// 链外log
		emit RequestRaffleWinner(requestId);
	}

	// 重写VRF的函数
	function fulfillRandomWords(uint256 /*requestId*/, uint256[] memory randomWords) internal override {
		uint256 winnerIndex = randomWords[0] % s_players.length;
		address payable recentWinner = s_players[winnerIndex];
		s_recentWinner = recentWinner;
		s_raffleState = RaffleState.OPEN;
		// 清空参与抽奖的人
		s_players = new address payable[](0);
		// 更新抽奖的时间戳
		s_latestTimeStamp = block.timestamp;
		// 把奖池的钱发送给中奖者
		(bool success, ) = recentWinner.call{value: address(this).balance}("");
		// require(success, "Failed to send money to winner"); 用 revert 更省gas
		if (!success) {
			revert Raffle__TransferFailed();
		}
		emit WinnerPicked(recentWinner);
	}

	/* view / pure functions */
	function getEntranceFee() public view returns (uint256) {
		return i_entranceFee;
	}

	function getPlayer(uint256 index) public view returns (address) {
		return s_players[index];
	}

	function getRecentWinner() public view returns (address) {
		return s_recentWinner;
	}

	function getRaffleState() public view returns (RaffleState) {
		return s_raffleState;
	}

	function getNumWords() public pure returns (uint32) {
		return NUM_WORDS;
	}

	function getNumberOfPlayers() public view returns (uint256) {
		return s_players.length;
	}

	function getInterval() public view returns (uint256) {
		return i_interval;
	}

	function getLatestTimeStamp() public view returns (uint256) {
		return s_latestTimeStamp;
	}

	function getConfirmations() public pure returns (uint16) {
		return REQUEST_CONFIRMATIONS;
	}

	function getVrfCoordinator() public view returns (address) {
		return address(i_vrfCoordinator);
	}

	function getSubscriptionId() public view returns (uint64) {
		return i_subscriptionId;
	}
}
