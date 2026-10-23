import {
  PROFILE_FIXTURE_LANGUAGE,
  PROFILE_FIXTURE_TIMESTAMP,
  PROFILE_FIXTURE_TIMEZONE,
  currentProfileFixtureSequence,
  makeAthleteProfile,
  makeCoachProfile,
  makeDeletedProfile,
  makePendingOnboardingProfile,
  makeProfile,
  makeProfiles,
  resetProfileFixtures,
} from "../profile.fixtures";
import { isActiveProfile, isAthlete, isCoach, isUserRole } from "../profile.types";

/** Colonnes de la table `profiles` (001_initial_schema.sql). */
const PROFILE_COLUMNS = [
  "avatar_url",
  "bio",
  "created_at",
  "deleted_at",
  "email",
  "first_name",
  "id",
  "is_deleted",
  "last_active_at",
  "last_name",
  "onboarding_completed",
  "phone",
  "preferred_language",
  "role",
  "timezone",
  "updated_at",
];

beforeEach(() => {
  resetProfileFixtures();
});

describe("makeProfile", () => {
  it("should return every column of the profiles table", () => {
    expect(Object.keys(makeProfile()).sort()).toEqual(PROFILE_COLUMNS);
  });

  it("should default to the athlete role", () => {
    expect(makeProfile().role).toBe("athlete");
  });

  it("should apply the schema defaults", () => {
    const profile = makeProfile();

    expect(profile.timezone).toBe(PROFILE_FIXTURE_TIMEZONE);
    expect(profile.preferred_language).toBe(PROFILE_FIXTURE_LANGUAGE);
    expect(profile.onboarding_completed).toBe(true);
    expect(profile.is_deleted).toBe(false);
    expect(profile.deleted_at).toBeNull();
  });

  it("should use fixed timestamps rather than the current clock", () => {
    const profile = makeProfile();

    expect(profile.created_at).toBe(PROFILE_FIXTURE_TIMESTAMP);
    expect(profile.updated_at).toBe(PROFILE_FIXTURE_TIMESTAMP);
    expect(profile.last_active_at).toBe(PROFILE_FIXTURE_TIMESTAMP);
  });

  it("should leave optional columns null", () => {
    const profile = makeProfile();

    expect(profile.avatar_url).toBeNull();
    expect(profile.phone).toBeNull();
    expect(profile.bio).toBeNull();
  });

  it("should generate a predictable uuid from the sequence", () => {
    expect(makeProfile().id).toBe("00000000-0000-4000-8000-000000000001");
    expect(makeProfile().id).toBe("00000000-0000-4000-8000-000000000002");
  });

  it("should generate a distinct id on every call", () => {
    const ids = [makeProfile().id, makeProfile().id, makeProfile().id];

    expect(new Set(ids).size).toBe(3);
  });

  it("should derive the email prefix from the role", () => {
    expect(makeProfile().email).toBe("athlete1@cadence.test");
    expect(makeProfile({ role: "coach" }).email).toBe("coach2@cadence.test");
  });

  it("should apply overrides over the defaults", () => {
    const profile = makeProfile({ first_name: "Zoe", bio: "Rameuse", phone: "+15145550199" });

    expect(profile.first_name).toBe("Zoe");
    expect(profile.bio).toBe("Rameuse");
    expect(profile.phone).toBe("+15145550199");
  });

  it("should let an override replace the generated id", () => {
    expect(makeProfile({ id: "custom-id" }).id).toBe("custom-id");
  });

  it("should return an independent object on every call", () => {
    const first = makeProfile();
    const second = makeProfile();

    first.first_name = "Mutee";

    expect(second.first_name).toBe("Alex");
  });
});

describe("resetProfileFixtures", () => {
  it("should restart the id sequence", () => {
    makeProfile();
    makeProfile();
    resetProfileFixtures();

    expect(makeProfile().id).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("should expose the current sequence value", () => {
    expect(currentProfileFixtureSequence()).toBe(0);

    makeProfile();
    makeProfile();

    expect(currentProfileFixtureSequence()).toBe(2);
  });
});

describe("makeCoachProfile", () => {
  it("should build a coach", () => {
    const coach = makeCoachProfile();

    expect(coach.role).toBe("coach");
    expect(isCoach(coach)).toBe(true);
  });

  it("should use coach-specific default names", () => {
    const coach = makeCoachProfile();

    expect(coach.first_name).toBe("Camille");
    expect(coach.last_name).toBe("Roy");
  });

  it("should force the role even when an override contradicts it", () => {
    expect(makeCoachProfile({ role: "athlete" }).role).toBe("coach");
  });

  it("should still accept other overrides", () => {
    expect(makeCoachProfile({ bio: "Entraineur-chef" }).bio).toBe("Entraineur-chef");
  });
});

describe("makeAthleteProfile", () => {
  it("should build an athlete", () => {
    const athlete = makeAthleteProfile();

    expect(athlete.role).toBe("athlete");
    expect(isAthlete(athlete)).toBe(true);
  });

  it("should force the role even when an override contradicts it", () => {
    expect(makeAthleteProfile({ role: "coach" }).role).toBe("athlete");
  });
});

describe("makeDeletedProfile", () => {
  it("should mark the profile as soft-deleted", () => {
    const profile = makeDeletedProfile();

    expect(profile.is_deleted).toBe(true);
    expect(profile.deleted_at).toBe(PROFILE_FIXTURE_TIMESTAMP);
    expect(isActiveProfile(profile)).toBe(false);
  });
});

describe("makePendingOnboardingProfile", () => {
  it("should leave onboarding incomplete", () => {
    expect(makePendingOnboardingProfile().onboarding_completed).toBe(false);
  });
});

describe("makeProfiles", () => {
  it("should build the requested number of profiles", () => {
    expect(makeProfiles(4)).toHaveLength(4);
  });

  it("should return an empty array for a count of zero", () => {
    expect(makeProfiles(0)).toEqual([]);
  });

  it("should give every profile a distinct id", () => {
    const ids = makeProfiles(5).map((profile) => profile.id);

    expect(new Set(ids).size).toBe(5);
  });

  it("should apply the overrides to every profile", () => {
    const roles = makeProfiles(3, { role: "coach" }).map((profile) => profile.role);

    expect(roles).toEqual(["coach", "coach", "coach"]);
  });
});

describe("coherence with the domain guards", () => {
  it("should produce roles accepted by isUserRole", () => {
    expect(isUserRole(makeCoachProfile().role)).toBe(true);
    expect(isUserRole(makeAthleteProfile().role)).toBe(true);
  });

  it("should produce active profiles by default", () => {
    expect(isActiveProfile(makeProfile())).toBe(true);
  });

  it("should keep coach and athlete guards mutually exclusive", () => {
    const coach = makeCoachProfile();

    expect(isCoach(coach)).toBe(true);
    expect(isAthlete(coach)).toBe(false);
  });
});
