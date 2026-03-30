import { phase } from "./state/game-store";
import { TitleScreen } from "./screens/title-screen";
import { LoreScreen } from "./screens/lore-screen";
import { OriginScreen } from "./screens/origin-screen";
import { ShopScreen } from "./screens/shop-screen";
import { PreBattleScreen } from "./screens/pre-battle-screen";
import { BattleScreen } from "./screens/battle-screen";
import { ResultScreen } from "./screens/result-screen";

export function App() {
  switch (phase.value) {
    case "TITLE":
      return <TitleScreen />;
    case "ORIGIN":
      return <OriginScreen />;
    case "SHOP":
      return <ShopScreen />;
    case "PRE_BATTLE":
      return <PreBattleScreen />;
    case "BATTLE":
      return <BattleScreen />;
    case "RESULT":
      return <ResultScreen />;
    case "LORE":
      return <LoreScreen />;
    default:
      return null;
  }
}
