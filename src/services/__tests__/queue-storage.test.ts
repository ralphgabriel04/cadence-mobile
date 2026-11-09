import { eraseQueueFile } from "../queue-storage";

// A tiny in-memory file system standing in for expo-file-system.
const fs = { present: true, deleteWorks: true, directoryThrows: false, deleteThrows: false };
jest.mock("expo-file-system", () => ({
  Paths: { document: "doc" },
  Directory: class {
    constructor() {
      if (fs.directoryThrows) throw new Error("no file system");
    }
  },
  File: class {
    get exists() {
      return fs.present;
    }
    delete() {
      if (fs.deleteThrows) throw new Error("permission denied");
      if (fs.deleteWorks) fs.present = false;
    }
  },
}));

beforeEach(() =>
  Object.assign(fs, {
    present: true,
    deleteWorks: true,
    directoryThrows: false,
    deleteThrows: false,
  })
);

describe("eraseQueueFile", () => {
  it("erased only after re-checking that cadence/set-queue.json is gone", () => {
    expect(eraseQueueFile()).toEqual({ erased: true });
    expect(fs.present).toBe(false);
  });

  it("an absent file counts as erased", () => {
    fs.present = false;
    expect(eraseQueueFile()).toEqual({ erased: true });
  });

  it("not erased when the delete throws", () => {
    fs.deleteThrows = true;
    expect(eraseQueueFile()).toEqual({ erased: false });
  });

  it("not erased when the delete claims success but the file is still there", () => {
    fs.deleteWorks = false;
    expect(eraseQueueFile()).toEqual({ erased: false });
  });

  it("not erased when there is no file system (the memory fallback is not an erased file)", () => {
    fs.directoryThrows = true;
    expect(eraseQueueFile()).toEqual({ erased: false });
  });
});
