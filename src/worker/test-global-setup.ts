import { disposeSingleton } from "./auth/test-db";

export function teardown(): Promise<void> {
  return disposeSingleton();
}
