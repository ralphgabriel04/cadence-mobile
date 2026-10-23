import {
  makeAthleteProfile,
  makeCoachProfile,
  makePendingOnboardingProfile,
  makeProfile,
  resetProfileFixtures,
} from "../profile.fixtures";
import {
  FALLBACK_INITIALS,
  ROLE_LABELS,
  formatDisplayName,
  formatInitials,
  toProfileViewModel,
} from "../profile.view-model";

beforeEach(() => {
  resetProfileFixtures();
});

describe("toProfileViewModel", () => {
  it("should return null when there is no profile", () => {
    expect(toProfileViewModel(null)).toBeNull();
  });

  it("should map an athlete profile", () => {
    expect(toProfileViewModel(makeAthleteProfile())).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      displayName: "Alex Tremblay",
      initials: "AT",
      email: "athlete1@cadence.test",
      roleLabel: "Athlète",
      roleTone: "athlete",
      avatarUrl: null,
      onboardingPending: false,
    });
  });

  it("should map a coach profile", () => {
    const viewModel = toProfileViewModel(makeCoachProfile());

    expect(viewModel.displayName).toBe("Camille Roy");
    expect(viewModel.roleLabel).toBe(ROLE_LABELS.coach);
    expect(viewModel.roleTone).toBe("coach");
  });

  it("should expose the avatar url", () => {
    const avatarUrl = "https://cdn.cadence.test/avatar.png";

    expect(toProfileViewModel(makeProfile({ avatar_url: avatarUrl })).avatarUrl).toBe(avatarUrl);
  });

  it("should flag a pending onboarding", () => {
    expect(toProfileViewModel(makePendingOnboardingProfile()).onboardingPending).toBe(true);
  });

  it("should use no display name when both names are empty", () => {
    const viewModel = toProfileViewModel(makeProfile({ first_name: "", last_name: "" }));

    expect(viewModel.displayName).toBeNull();
    expect(viewModel.initials).toBe("A");
  });
});

describe("formatDisplayName", () => {
  it("should join first and last name", () => {
    expect(formatDisplayName("Zoe", "Gagnon")).toBe("Zoe Gagnon");
  });

  it("should trim surrounding whitespace", () => {
    expect(formatDisplayName("  Zoe ", " Gagnon  ")).toBe("Zoe Gagnon");
  });

  it("should keep a lone first or last name without extra space", () => {
    expect(formatDisplayName("Zoe", "")).toBe("Zoe");
    expect(formatDisplayName("", "Gagnon")).toBe("Gagnon");
  });

  it("should return null for blank names", () => {
    expect(formatDisplayName("", "")).toBeNull();
    expect(formatDisplayName("  ", " ")).toBeNull();
  });
});

describe("formatInitials", () => {
  it("should combine the first letters of both names in uppercase", () => {
    expect(formatInitials("zoe", "gagnon", "z@cadence.test")).toBe("ZG");
  });

  it("should keep accented letters", () => {
    expect(formatInitials("Élodie", "Ouellet", "e@cadence.test")).toBe("ÉO");
  });

  it("should use a single name when the other is empty", () => {
    expect(formatInitials("", "Gagnon", "z@cadence.test")).toBe("G");
  });

  it("should fall back to the email when names are blank", () => {
    expect(formatInitials(" ", "", "marie@cadence.test")).toBe("M");
  });

  it("should fall back to a placeholder when nothing is available", () => {
    expect(formatInitials("", "", "")).toBe(FALLBACK_INITIALS);
  });
});
