// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import {
    AaveV3Payload
} from "aave-v3-origin/src/contracts/extensions/v3-config-engine/AaveV3Payload.sol";
import {
    EngineFlags
} from "aave-v3-origin/src/contracts/extensions/v3-config-engine/EngineFlags.sol";
import {
    IAaveV3ConfigEngine as IEngine
} from "aave-v3-origin/src/contracts/extensions/v3-config-engine/IAaveV3ConfigEngine.sol";
import { IPool } from "aave-v3-origin/src/contracts/interfaces/IPool.sol";
import { ACLManager } from "aave-v3-origin/src/contracts/protocol/configuration/ACLManager.sol";
import {
    MockAggregator
} from "aave-v3-origin/src/contracts/mocks/oracle/CLAggregators/MockAggregator.sol";
import {
    DeployFlags,
    MarketConfig,
    MarketReport,
    Roles
} from "aave-v3-origin/src/deployments/interfaces/IMarketReportTypes.sol";
import {
    AaveV3BatchOrchestration
} from "aave-v3-origin/src/deployments/projects/aave-v3-batched/AaveV3BatchOrchestration.sol";

/// @dev Testnet-only listing payload. This is not an Aave DAO-governed deployment.
contract ArcUsdcSandboxListing is AaveV3Payload {
    bytes32 internal constant POOL_ADMIN_ROLE =
        0x12ad05bde78c5ab75238ce885307f96ecd482bb402ef831f99e7018a0f169b7b;

    address public immutable usdc;
    address public immutable priceFeed;
    address internal immutable aTokenImplementation;
    address internal immutable variableDebtTokenImplementation;
    ACLManager internal immutable aclManager;

    constructor(IEngine engine, address usdc_, MarketReport memory report) AaveV3Payload(engine) {
        usdc = usdc_;
        priceFeed = address(new MockAggregator(1e8));
        aTokenImplementation = report.aToken;
        variableDebtTokenImplementation = report.variableDebtToken;
        aclManager = ACLManager(report.aclManager);
    }

    function newListingsCustom()
        public
        view
        override
        returns (IEngine.ListingWithCustomImpl[] memory listings)
    {
        listings = new IEngine.ListingWithCustomImpl[](1);
        listings[0] = IEngine.ListingWithCustomImpl({
            base: IEngine.Listing({
                asset: usdc,
                assetSymbol: "USDC",
                priceFeed: priceFeed,
                rateStrategyParams: IEngine.InterestRateInputData({
                    optimalUsageRatio: 9000,
                    baseVariableBorrowRate: 0,
                    variableRateSlope1: 400,
                    variableRateSlope2: 6000
                }),
                enabledToBorrow: EngineFlags.ENABLED,
                flashloanable: EngineFlags.DISABLED,
                ltv: 8000,
                liqThreshold: 8500,
                liqBonus: 500,
                reserveFactor: 1000,
                supplyCap: 1_000_000,
                borrowCap: 800_000,
                liqProtocolFee: 1000
            }),
            implementations: IEngine.TokenImplementations({
                aToken: aTokenImplementation, vToken: variableDebtTokenImplementation
            })
        });
    }

    function getPoolContext() public pure override returns (IEngine.PoolContext memory) {
        return IEngine.PoolContext({ networkName: "Arc", networkAbbreviation: "Arc" });
    }

    function _postExecute() internal override {
        aclManager.renounceRole(POOL_ADMIN_ROLE, address(this));
    }
}

/// @notice Deploys an isolated Aave V3-compatible sandbox on Arc testnet and lists Arc USDC.
/// @dev This deployment is for integration testing only and is not endorsed or governed by Aave.
contract DeployArcAaveSandbox is Script {
    error WrongChain(uint256 actual);

    uint256 internal constant ARC_TESTNET_CHAIN_ID = 5_042_002;
    address internal constant ARC_TESTNET_USDC = 0x3600000000000000000000000000000000000000;

    function run()
        external
        returns (MarketReport memory report, address aToken, address variableDebtToken)
    {
        if (block.chainid != ARC_TESTNET_CHAIN_ID) revert WrongChain(block.chainid);

        vm.startBroadcast();
        (report, aToken, variableDebtToken) = _deploy(msg.sender);
        vm.stopBroadcast();

        console2.log("Arc Aave-compatible sandbox pool", report.poolProxy);
        console2.log("Arc USDC aToken", aToken);
        console2.log("Arc USDC variable debt token", variableDebtToken);
    }

    function deployForTest(address deployer)
        external
        returns (MarketReport memory report, address aToken, address variableDebtToken)
    {
        if (block.chainid != ARC_TESTNET_CHAIN_ID) revert WrongChain(block.chainid);
        return _deploy(deployer);
    }

    function _deploy(address deployer)
        internal
        returns (MarketReport memory report, address aToken, address variableDebtToken)
    {
        Roles memory roles =
            Roles({ marketOwner: deployer, poolAdmin: deployer, emergencyAdmin: deployer });
        MarketConfig memory config = MarketConfig({
            networkBaseTokenPriceInUsdProxyAggregator: address(0),
            marketReferenceCurrencyPriceInUsdProxyAggregator: address(0),
            marketId: "GOL Arc Aave-compatible Sandbox",
            oracleDecimals: 8,
            providerId: 5_042_002,
            salt: bytes32(0),
            wrappedNativeToken: address(0),
            flashLoanPremium: 5,
            incentivesProxy: address(0),
            treasury: address(0)
        });
        DeployFlags memory flags = DeployFlags({ l2: false });
        MarketReport memory existing;

        report = AaveV3BatchOrchestration.deployAaveV3(deployer, roles, config, flags, existing);

        ArcUsdcSandboxListing listing =
            new ArcUsdcSandboxListing(IEngine(report.configEngine), ARC_TESTNET_USDC, report);
        ACLManager(report.aclManager).addPoolAdmin(address(listing));
        listing.execute();

        IPool pool = IPool(report.poolProxy);
        aToken = pool.getReserveAToken(ARC_TESTNET_USDC);
        variableDebtToken = pool.getReserveVariableDebtToken(ARC_TESTNET_USDC);
    }
}
