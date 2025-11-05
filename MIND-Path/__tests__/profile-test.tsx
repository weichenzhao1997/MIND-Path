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
import ProfileScreen from "@/app/(tabs)/profile";
import { useAuth } from "@/context/AuthContext";
import { useSegments } from "expo-router";

jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return {
    ...actual,
    SafeAreaView: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({
    replace: jest.fn(),
    push: jest.fn(),
  })),
  useSegments: jest.fn(),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: jest.fn(),
}));

const useAuthMock = useAuth as jest.Mock;
const useSegmentsMock = useSegments as jest.Mock;

const mockProfile = {
  username: "joey",
  zipcode: "90210",
  previousChatSessionIds: ["chat-1", "chat-2"],
  recommendedResourceIds: ["res-1"],
  clinicIds: ["clinic-1"],
};

describe("<ProfileScreen />", () => {
  let logOutMock: jest.Mock;
  let updateProfileMock: jest.Mock;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    logOutMock = jest.fn();
    updateProfileMock = jest.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      isLoggedIn: true,
      profile: mockProfile,
      logOut: logOutMock,
      updateProfile: updateProfileMock,
    });
    useSegmentsMock.mockReturnValue(["(tabs)", "profile"]);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
    useSegmentsMock.mockReset();
  });

  test("shows profile data, including zipcode inline", async () => {
    const utils = render(<ProfileScreen />);

    await waitFor(() => {
      expect(utils.getByText("Previous chats / Resources")).toBeTruthy();
      expect(utils.getByText(/Near by Me/)).toBeTruthy();
      expect(utils.getByText(/90210/)).toBeTruthy();
      expect(utils.getByText("chat-1")).toBeTruthy();
      expect(utils.getByText("res-1")).toBeTruthy();
      expect(utils.getByText("clinic-1")).toBeTruthy();
    });
  });

  test("opens zipcode editor and saves changes", async () => {
    const { getByText, getByPlaceholderText } = render(<ProfileScreen />);

    fireEvent.press(getByText("Edit"));

    const zipInput = getByPlaceholderText("Enter zipcode");
    fireEvent.changeText(zipInput, "10001");
    fireEvent.press(getByText("Save"));

    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({ zipcode: "10001" })
    );
  });

  test("logs out when button pressed", async () => {
    const { getByText } = render(<ProfileScreen />);

    fireEvent.press(getByText("Log out"));

    await waitFor(() => expect(logOutMock).toHaveBeenCalled());
  });

  test("renders login screen when not authenticated", async () => {
    useAuthMock.mockReturnValueOnce({
      isLoggedIn: false,
      profile: null,
      logOut: jest.fn(),
      updateProfile: jest.fn(),
    });

    const { getAllByText } = render(<ProfileScreen />);

    await waitFor(() => {
      expect(getAllByText("Log in").length).toBeGreaterThan(0);
    });
  });
});
