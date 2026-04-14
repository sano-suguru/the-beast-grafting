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
  // bone_tree: Lv1とLv2のバフ値が同じ({1,1})のためテキストも同一
  const LV1_EQUALS_LV2: ReadonlySet<UnitId> = new Set(["bone_tree"] as UnitId[]);

  for (const id of TEMPLATED_UNIT_IDS) {
    if (LV1_EQUALS_LV2.has(id)) {
      it(`${id}: Lv3 text differs from Lv1`, () => {
        const lv1 = getSkillText(id, 1, "");
        const lv3 = getSkillText(id, 3, "");
        expect(lv3).not.toBe(lv1);
      });
    } else {
      it(`${id}: Lv2 text differs from Lv1`, () => {
        const lv1 = getSkillText(id, 1, "");
        const lv2 = getSkillText(id, 2, "");
        expect(lv2).not.toBe(lv1);
      });
    }
  }
});
