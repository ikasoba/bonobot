export interface Config {
  feedInterval: number;
  feedSendInterval: number;
}

export function isConfig(
  value: unknown,
  state: { error?: Error }
): value is Config {
  if (value != null && typeof value == "object" && !(value instanceof Array)) {
    if (typeof (value as any)["feedInterval"] != "number") {
      state.error = new Error(
        "設定 feedInterval は無効な値が設定されています。\n値は数値である必要があります。"
      );
      return false;
    }

    if (typeof (value as any)["feedSendInterval"] != "number") {
      state.error = new Error(
        "設定 feedSendInterval は無効な値が設定されています。\n値は数値である必要があります。"
      );
      return false;
    }

    return true;
  }

  state.error = new Error("無効な値です");

  return false;
}
