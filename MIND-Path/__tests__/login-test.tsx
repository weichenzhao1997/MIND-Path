import React from "react";
import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import LoginScreen from "@/app/(tabs)/login";
import { useRouter, useSegments } from "expo-router";
import { useAuth } from "@/context/AuthContext";

jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return {
    ...actual,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    SafeAreaView: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  useSegments: jest.fn(),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: jest.fn(),
}));

const useRouterMock = useRouter as jest.Mock;
const useSegmentsMock = useSegments as jest.Mock;
const useAuthMock = useAuth as jest.Mock;

describe("<LoginScreen />", () => {
  let pushMock: jest.Mock;

  beforeEach(() => {
    pushMock = jest.fn();
    useRouterMock.mockReturnValue({
      replace: jest.fn(),
      push: pushMock,
    });
    useSegmentsMock.mockReturnValue(["(tabs)", "login"]);
    useAuthMock.mockReturnValue({
      logIn: jest.fn(),
      profile: null,
      isLoggedIn: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    useRouterMock.mockReset();
    useSegmentsMock.mockReset();
    useAuthMock.mockReset();
  });

  test("submits trimmed credentials and navigates on success", async () => {
    const logInMock = jest.fn().mockResolvedValue(true);
    useAuthMock.mockReturnValue({
      logIn: logInMock,
      profile: null,
      isLoggedIn: false,
    });

    const { getByPlaceholderText, getByRole, queryByText } = render(
      <LoginScreen />
    );

    fireEvent.changeText(getByPlaceholderText("Your name here"), "  user ");
    fireEvent.changeText(getByPlaceholderText("Enter your password"), " secret ");
    fireEvent.press(getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(logInMock).toHaveBeenCalledWith({
        username: "user",
        password: "secret",
      })
    );

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/(tabs)/profile"));

    await waitFor(() =>
      expect(queryByText(/Signing you in/i)).toBeNull()
    );
  });

  test("shows error when credentials are rejected", async () => {
    const logInMock = jest.fn().mockResolvedValue(false);
    useAuthMock.mockReturnValue({
      logIn: logInMock,
      profile: null,
      isLoggedIn: false,
    });

    const { getByPlaceholderText, getByRole, findByText } = render(
      <LoginScreen />
    );

    fireEvent.changeText(getByPlaceholderText("Your name here"), "user");
    fireEvent.changeText(getByPlaceholderText("Enter your password"), "secret");
    fireEvent.press(getByRole("button", { name: "Log in" }));

    expect(await findByText(/Incorrect username or password/)).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  test("navigates to create account screen", () => {
    const { getByRole } = render(<LoginScreen />);

    fireEvent.press(getByRole("button", { name: "Create an account" }));

    expect(pushMock).toHaveBeenCalledWith("/(tabs)/create-account");
  });

  test("clears credentials when profile is removed", async () => {
    const authState = {
      logIn: jest.fn(),
      createAccount: jest.fn(),
      logOut: jest.fn(),
      updateProfile: jest.fn(),
      loadingProfile: false,
      profile: {
        username: "joey",
        zipcode: "",
        previousChatSessionIds: [],
        recommendedResourceIds: [],
        clinicIds: [],
      },
      isLoggedIn: true,
    };

    useAuthMock.mockImplementation(() => ({ ...authState }));

    const utils = render(<LoginScreen />);

    await waitFor(() =>
      expect(
        utils.getByPlaceholderText("Your name here").props.value
      ).toBe("joey")
    );

    authState.profile = null;
    authState.isLoggedIn = false;
    utils.rerender(<LoginScreen />);

    await waitFor(() => {
      expect(
        utils.getByPlaceholderText("Your name here").props.value
      ).toBe("");
      expect(
        utils.getByPlaceholderText("Enter your password").props.value
      ).toBe("");
    });
  });
});
