// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.18;

// Uncomment this line to use console.log
import "hardhat/console.sol";
import "./interfaces/IStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Allocator {
    IERC20 public constant asset = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IStrategy public localStrategy;
    address public foreignStrategy;
    uint256 public localStrategyPrevPps;
    uint256 public localStrategyCurrentPps;

    mapping(address => uint256) debt;

    uint256 public foreignStrategyBalance;
    uint256 public localStrategyBalance;
    uint256 public freeMoney;

    constructor(address _localStrategy, address _foreignStrategy) {
        localStrategy = IStrategy(_localStrategy);
        foreignStrategy = _foreignStrategy;
        localStrategyCurrentPps = localStrategy.pricePerShare();
    }

    function updateLocalStrategyPps() public {
        localStrategyPrevPps = localStrategyCurrentPps;
        localStrategyCurrentPps = localStrategy.pricePerShare();
    }

    function getProofFromForeignStrategyAndUpdateDebt(
        // bytes proof,
        uint256 yesterdayPps,
        uint256 todayPps
    ) public {
        // require(proof.verify(), "Invalid proof");
        uint256 foreignStrategyAPR = _calculateAPR(yesterdayPps, todayPps);
        console.log("Foreign Strategy APR: %s", foreignStrategyAPR);

        uint256 localStrategyAPR = _calculateAPR(localStrategyPrevPps, localStrategyCurrentPps);
        console.log("Local Strategy APR: %s", localStrategyAPR);

        if (foreignStrategyAPR > localStrategyAPR) {
            // localStrategy.deposit(foreignStrategy.withdraw());
            console.log("Foreign strategy is better than local strategy");
        } else {
            // foreignStrategy.deposit(localStrategy.withdraw());
            console.log("Local strategy is better than foreign strategy");
        }
    }

    function _calculateAPR(uint256 yesterdayPps, uint256 todayPps) internal pure returns (uint256) {
        if (yesterdayPps == 0) {
            revert("Yesterday PPS cannot be zero"); // Prevent division by zero
        }

        return (todayPps - yesterdayPps) * 10000 / yesterdayPps;
    }

    function _withdrawFromLocalStrategyAndSendToForeignStrategy() internal {
        withdrawMoneyFromLocalStrategy();

        // call stargate to send money to polygon
    }

    function depositAsset(uint256 amount) public {
        asset.transferFrom(msg.sender, address(this), amount);
        freeMoney += amount;
        debt[msg.sender] += amount;
    }

    function balanceOf(address user) public view returns (uint256) {
        return debt[user];
    }

    function putMoneyIntoLocalStrategy(uint256 amount) public {
        asset.approve(address(localStrategy), amount);
        localStrategy.deposit(amount, address(this));
        freeMoney -= amount;
        localStrategyBalance += amount;
    }

    function sharesInLocalStrategy() public view returns (uint256) {
        return localStrategy.balanceOf(address(this));
    }

    function withdrawMoneyFromLocalStrategy() public {
        uint256 localStrategyShares = sharesInLocalStrategy();
        uint256 money = localStrategy.redeem(localStrategyShares, address(this), address(this));
        freeMoney += money;
        localStrategyBalance = 0;
    }
}
