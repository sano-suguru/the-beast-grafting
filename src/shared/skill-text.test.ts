import { UNITS } from "./data/units";
import { CHURCH_UNITS } from "./data/church-units";
import { getSkillText, TEMPLATED_UNIT_IDS } from "./skill-text";
import type { UnitId } from "./types";

describe("getSkillText Lv1 consistency", () => {
  const allUnits = { ...UNITS, ...CHURCH_UNITS };

  for (const [id, data] of Object.entries(allUnits)) {
    it(`${id}: Lv1 template matches static skillText`, () => {
      const generated = getSkillText(id as UnitId, 1, "__fallback__");
      // テンプレートがあるユニットは生成値と静的値が一致すべき
      // テンプレートがないユニットはfallbackが返る
      if (generated === "__fallback__") return;
      expect(generated).toBe(data.skillText);
    });
  }
});

describe("template coverage", () => {
  for (const id of TEMPLATED_UNIT_IDS) {
    it(`${id}: Lv2 text differs from Lv1`, () => {
      const lv1 = getSkillText(id, 1, "");
      const lv2 = getSkillText(id, 2, "");
      expect(lv2).not.toBe(lv1);
    });
  }
});
