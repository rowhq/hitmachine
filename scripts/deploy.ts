import { Provider, Wallet } from "zksync-ethers";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as dotenv from "dotenv";
dotenv.config();

async function main(hre: HardhatRuntimeEnvironment) {
    const provider = new Provider(hre.network.config.url);
    const wallet = new Wallet(process.env.WALLET_PRIVATE_KEY!, provider);
    const deployer = new Deployer(hre, wallet);

    const artifact = await deployer.loadArtifact("Storage");

    const usdcAddress = "0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F";
    const adminAddress = wallet.address;

    console.log(`Deploying with admin: ${adminAddress} and USDC: ${usdcAddress}`);

    const contract = await deployer.deploy(artifact, [usdcAddress, adminAddress]);

    console.log(`✅ Storage contract deployed to: ${contract.address}`);
}

main(require("hardhat"))
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("❌ Deployment failed:", err);
        process.exit(1);
    });
