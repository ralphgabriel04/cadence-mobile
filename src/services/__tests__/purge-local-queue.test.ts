import { purgeLocalSetQueue } from "../purge-local-queue";
import { createMemoryStorage, parseQueue, SetQueue } from "../set-queue";

// Stands in for the file in cadence/set-queue.json, the same one every queue uses.
const mockFile = createMemoryStorage();
jest.mock("../queue-storage", () => ({ createQueueStorage: () => mockFile }));

describe("purgeLocalSetQueue", () => {
  it("empties the file even when no queue is alive, and closes the live ones", async () => {
    mockFile.write(JSON.stringify([{ clientId: "left-by-a-previous-run" }]));
    const live = new SetQueue(mockFile, async () => ({ ok: false, message: "x", retryable: true }));
    await live.restore();

    purgeLocalSetQueue();

    expect(parseQueue(await mockFile.read())).toEqual([]);
    expect(live.pending).toHaveLength(0);
  });

  it("never throws, even if the storage does", () => {
    mockFile.write = () => {
      throw new Error("disk full");
    };
    expect(() => purgeLocalSetQueue()).not.toThrow();
  });
});
