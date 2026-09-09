import { deleteLocalRecord, readLocalCollection, upsertLocalRecord } from "./local-store";

describe("local-store", () => {
  beforeEach(() => window.localStorage.clear());

  it("isolates records by anonymous user", () => {
    upsertLocalRecord("notes", "user-a", { id: "note-1", title: "Mitosis" });
    expect(readLocalCollection("notes", "user-a")).toHaveLength(1);
    expect(readLocalCollection("notes", "user-b")).toEqual([]);
  });

  it("upserts and deletes by id", () => {
    upsertLocalRecord("notes", "user-a", { id: "note-1", title: "First" });
    upsertLocalRecord("notes", "user-a", { id: "note-1", title: "Updated" });
    expect(readLocalCollection<{ id: string; title: string }>("notes", "user-a")[0].title).toBe("Updated");
    deleteLocalRecord("notes", "user-a", "note-1");
    expect(readLocalCollection("notes", "user-a")).toEqual([]);
  });
});
