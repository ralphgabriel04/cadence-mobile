import {
  PROFILE_FIXTURE_AVATAR_URL,
  PROFILE_FIXTURE_BIO,
  PROFILE_FIXTURE_PHONE,
  currentProfileFixtureSequence,
  makeAthleteStats,
  makeCoachStats,
  makeCompleteProfile,
  profileLoading,
  resetProfileFixtures,
} from "../profile.fixtures";
import { type ProfileStats } from "../profile.types";
import { type ProfileState } from "../profile.view-model";

beforeEach(() => {
  resetProfileFixtures();
});

describe("makeCompleteProfile", () => {
  it("should fill every optional column", () => {
    const profile = makeCompleteProfile();

    expect(profile.avatar_url).toBe(PROFILE_FIXTURE_AVATAR_URL);
    expect(profile.phone).toBe(PROFILE_FIXTURE_PHONE);
    expect(profile.bio).toBe(PROFILE_FIXTURE_BIO);
  });

  it("should let an override clear an optional column", () => {
    expect(makeCompleteProfile({ avatar_url: null }).avatar_url).toBeNull();
  });

  it("should accept a role override", () => {
    expect(makeCompleteProfile({ role: "coach" }).role).toBe("coach");
  });
});

describe("profileLoading", () => {
  it("should be a loading state", () => {
    expect(profileLoading()).toEqual({ status: "loading" });
  });
});

describe("makeCoachStats", () => {
  it("should build coach stats with default counts", () => {
    expect(makeCoachStats()).toEqual({
      role: "coach",
      activeAthleteCount: 12,
      activeProgramCount: 3,
    });
  });

  it("should apply overrides", () => {
    expect(makeCoachStats({ activeAthleteCount: 0 }).activeAthleteCount).toBe(0);
  });

  it("should force the coach role", () => {
    const overrides = { role: "athlete" } as Parameters<typeof makeCoachStats>[0];

    expect(makeCoachStats(overrides).role).toBe("coach");
  });
});

describe("makeAthleteStats", () => {
  it("should build athlete stats with an active program", () => {
    expect(makeAthleteStats()).toEqual({
      role: "athlete",
      completedSessionCount: 24,
      activeProgramName: "Préparation 10 km",
    });
  });

  it("should allow an athlete without an active program", () => {
    expect(makeAthleteStats({ activeProgramName: null }).activeProgramName).toBeNull();
  });

  it("should force the athlete role", () => {
    const overrides = { role: "coach" } as Parameters<typeof makeAthleteStats>[0];

    expect(makeAthleteStats(overrides).role).toBe("athlete");
  });
});

describe("display fixtures", () => {
  it("should not consume profile ids for stats and loading", () => {
    makeCoachStats();
    makeAthleteStats();
    profileLoading();

    expect(currentProfileFixtureSequence()).toBe(0);
  });

  it("should be assignable to the domain types", () => {
    const stats: ProfileStats[] = [makeCoachStats(), makeAthleteStats()];
    const state: ProfileState = profileLoading();

    expect(stats.map((entry) => entry.role)).toEqual(["coach", "athlete"]);
    expect(state.status).toBe("loading");
  });
});
