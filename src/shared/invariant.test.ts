import { invariant, mustGet } from "./invariant";

describe("invariant", () => {
  it("truthy条件なら何もしない", () => {
    expect(() => invariant(true, "ok")).not.toThrow();
  });

  it("falsy条件で[INVARIANT]エラーをthrow", () => {
    expect(() => invariant(false, "boom")).toThrow("[INVARIANT] boom");
  });
});

describe("mustGet", () => {
  it("有効なインデックスで要素を返す", () => {
    expect(mustGet([10, 20, 30], 1, "idx1")).toBe(20);
  });

  it("範囲外インデックスで[INVARIANT]エラーをthrow", () => {
    expect(() => mustGet([10], 5, "oob")).toThrow("[INVARIANT] oob");
  });

  it("空配列で[INVARIANT]エラーをthrow", () => {
    expect(() => mustGet([], 0, "empty")).toThrow("[INVARIANT] empty");
  });
});
