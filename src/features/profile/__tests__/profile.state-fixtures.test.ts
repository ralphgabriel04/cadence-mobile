import {
  athleteReady,
  coachReady,
  currentProfileFixtureSequence,
  makeAthleteProfile,
  makeCoachProfile,
  profileError,
  resetProfileFixtures,
} from "../profile.fixtures";
import {
  PROFILE_ERROR_MESSAGE,
  type ProfileState,
  toProfileViewModel,
} from "../profile.view-model";

beforeEach(() => {
  resetProfileFixtures();
});

describe("athleteReady", () => {
  it("should be a ready state holding an athlete view model", () => {
    const state = athleteReady();

    expect(state.status).toBe("ready");
    expect(state.viewModel.roleTone).toBe("athlete");
    expect(state.viewModel.roleLabel).toBe("Athlète");
  });

  it("should match the view model built from the athlete factory", () => {
    const state = athleteReady();
    resetProfileFixtures();

    expect(state.viewModel).toEqual(toProfileViewModel(makeAthleteProfile()));
  });

  it("should apply overrides to the underlying profile", () => {
    expect(athleteReady({ first_name: "Zoe" }).viewModel.displayName).toBe("Zoe Tremblay");
  });

  it("should force the athlete role", () => {
    expect(athleteReady({ role: "coach" }).viewModel.roleTone).toBe("athlete");
  });
});

describe("coachReady", () => {
  it("should be a ready state holding a coach view model", () => {
    const state = coachReady();

    expect(state.status).toBe("ready");
    expect(state.viewModel.roleTone).toBe("coach");
    expect(state.viewModel.displayName).toBe("Camille Roy");
  });

  it("should match the view model built from the coach factory", () => {
    const state = coachReady();
    resetProfileFixtures();

    expect(state.viewModel).toEqual(toProfileViewModel(makeCoachProfile()));
  });

  it("should force the coach role", () => {
    expect(coachReady({ role: "athlete" }).viewModel.roleTone).toBe("coach");
  });
});

describe("profileError", () => {
  it("should be an error state with the default message", () => {
    expect(profileError()).toEqual({ status: "error", message: PROFILE_ERROR_MESSAGE });
  });

  it("should accept a custom message", () => {
    expect(profileError("Hors ligne").message).toBe("Hors ligne");
  });

  it("should not consume a profile id", () => {
    profileError();

    expect(currentProfileFixtureSequence()).toBe(0);
  });
});

describe("state fixtures", () => {
  it("should not touch the id sequence until called", () => {
    expect(currentProfileFixtureSequence()).toBe(0);
  });

  it("should be assignable to ProfileState", () => {
    const states: ProfileState[] = [athleteReady(), coachReady(), profileError()];

    expect(states.map((state) => state.status)).toEqual(["ready", "ready", "error"]);
  });
});
