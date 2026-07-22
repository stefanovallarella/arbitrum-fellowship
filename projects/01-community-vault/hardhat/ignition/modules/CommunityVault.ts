import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ONE_WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

const CommunityVaultModule = buildModule("CommunityVaultModule", (m) => {
  const goal = m.getParameter("goal", 10n ** 19n); // 10 ETH default
  const deadline = m.getParameter(
    "deadline",
    Math.floor(Date.now() / 1000) + ONE_WEEK_IN_SECONDS,
  );
  const name = m.getParameter("name", "Vault Receipt");
  const symbol = m.getParameter("symbol", "VRT");

  const communityVault = m.contract("CommunityVault", [goal, deadline, name, symbol]);

  return { communityVault };
});

export default CommunityVaultModule;
