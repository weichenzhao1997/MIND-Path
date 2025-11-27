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
import { Linking } from "react-native";
import ProfileScreen from "@/app/(tabs)/profile";
import { useAuth } from "@/context/AuthContext";
import { useSegments } from "expo-router";
import { fetchProvidersByIds } from "@/utils/supabaseProvider";
import { fetchResourcesByIds } from "@/utils/supabaseContent";

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

jest.mock("@/utils/supabaseProvider", () => ({
  fetchProvidersByIds: jest.fn(),
}));

jest.mock("@/utils/supabaseContent", () => ({
  fetchResourcesByIds: jest.fn(),
}));

const useAuthMock = useAuth as jest.Mock;
const useSegmentsMock = useSegments as jest.Mock;
const fetchProvidersByIdsMock = fetchProvidersByIds as jest.Mock;
const fetchResourcesByIdsMock = fetchResourcesByIds as jest.Mock;

const mockProfile = {
  username: "joey",
  zipcode: "90210",
  previousChatSessionIds: ["chat-1", "chat-2"],
  recommendedResourceIds: ["res-1"],
  clinicIds: ["123"],
};

describe("<ProfileScreen />", () => {
  let logOutMock: jest.Mock;
  let updateProfileMock: jest.Mock;
  let consoleErrorSpy: jest.SpyInstance;
  let openUrlSpy: jest.SpyInstance;

  beforeEach(() => {
    logOutMock = jest.fn();
    updateProfileMock = jest.fn().mockResolvedValue(undefined);
    const profileClone = {
      ...mockProfile,
      previousChatSessionIds: [...mockProfile.previousChatSessionIds],
      recommendedResourceIds: [...mockProfile.recommendedResourceIds],
      clinicIds: [...mockProfile.clinicIds],
    };

    useAuthMock.mockReturnValue({
      isLoggedIn: true,
      profile: profileClone,
      logOut: logOutMock,
      updateProfile: updateProfileMock,
    });
    useSegmentsMock.mockReturnValue(["(tabs)", "profile"]);
    fetchProvidersByIdsMock.mockResolvedValue([
      {
        provider_id: 123,
        basic_name: "Mindful Clinic",
        city: "Los Angeles",
        state: "CA",
        phone: "123-456-7890",
        taxonomy_desc: null,
        specialty: "Therapy",
        enumeration_type: null,
        npi: null,
        updated_at: null,
        distance_m: null,
      },
    ]);
    fetchResourcesByIdsMock.mockResolvedValue([
      {
        id: "res-1",
        title: "Calm Breathing Guide",
        type: "article",
        org: "Mindful Org",
        url: "https://example.com",
      },
    ]);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    openUrlSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
    openUrlSpy.mockRestore();
    useSegmentsMock.mockReset();
    fetchProvidersByIdsMock.mockReset();
    fetchResourcesByIdsMock.mockReset();
  });

  test("renders multiple saved resources in order", async () => {
    useAuthMock.mockReturnValue({
      isLoggedIn: true,
      profile: {
        ...mockProfile,
        recommendedResourceIds: ["res-1", "res-2", "res-3"],
      },
      logOut: logOutMock,
      updateProfile: updateProfileMock,
    });

    fetchResourcesByIdsMock.mockResolvedValueOnce([
      { id: "res-1", title: "First", type: "article", org: "Org A", url: "https://a.test" },
      { id: "res-2", title: "Second", type: "video", org: "Org B", url: "https://b.test" },
      { id: "res-3", title: "Third", type: "podcast", org: "Org C", url: "https://c.test" },
    ]);

    const utils = render(<ProfileScreen />);

    await waitFor(() => {
      expect(fetchResourcesByIdsMock).toHaveBeenCalledWith(["res-1", "res-2", "res-3"]);
      expect(utils.getByText("First")).toBeTruthy();
      expect(utils.getByText("Second")).toBeTruthy();
      expect(utils.getByText("Third")).toBeTruthy();
    });
  });

  test("shows profile data sections", async () => {
    const utils = render(<ProfileScreen />);

    await waitFor(() => {
      expect(fetchProvidersByIdsMock).toHaveBeenCalledWith([123]);
      expect(fetchResourcesByIdsMock).toHaveBeenCalledWith(["res-1"]);
      expect(utils.getByText("Previous chats / Resources")).toBeTruthy();
      expect(utils.getByText("chat-1")).toBeTruthy();
      expect(utils.getByText("Calm Breathing Guide")).toBeTruthy();
      expect(utils.getByText("Mindful Clinic")).toBeTruthy();
      expect(utils.getByText("Los Angeles, CA")).toBeTruthy();
      expect(utils.getByText("Phone: 123-456-7890")).toBeTruthy();
    });
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

  test("removes a saved resource through edit mode", async () => {
    const utils = render(<ProfileScreen />);

    await waitFor(() => {
      expect(utils.getByText("Calm Breathing Guide")).toBeTruthy();
    });

    updateProfileMock.mockClear();
    const editButtons = utils.getAllByText("Edit");
    fireEvent.press(editButtons[0]);

    await waitFor(() => {
      expect(utils.getAllByText("Remove").length).toBeGreaterThan(0);
    });

    fireEvent.press(utils.getAllByText("Remove")[0]);

    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({ recommendedResourceIds: [] })
    );
  });

  test("removes a saved provider through edit mode", async () => {
    const utils = render(<ProfileScreen />);

    await waitFor(() => {
      expect(utils.getByText("Mindful Clinic")).toBeTruthy();
    });

    updateProfileMock.mockClear();
    const editButtons = utils.getAllByText("Edit");
    const providerEditButton = editButtons[editButtons.length - 1];
    fireEvent.press(providerEditButton);

    await waitFor(() => expect(utils.getByText("Remove")).toBeTruthy());
    const removeButton = utils.getByText("Remove");
    fireEvent.press(removeButton);

    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({ clinicIds: [] })
    );
  });

  test("shows empty saved resources state when ids resolve to nothing", async () => {
    useAuthMock.mockReturnValue({
      isLoggedIn: true,
      profile: { ...mockProfile, recommendedResourceIds: ["ghost-id"] },
      logOut: logOutMock,
      updateProfile: updateProfileMock,
    });

    fetchResourcesByIdsMock.mockResolvedValueOnce([]);

    const utils = render(<ProfileScreen />);

    await waitFor(() => {
      expect(fetchResourcesByIdsMock).toHaveBeenCalledWith(["ghost-id"]);
      expect(utils.getByText("No resources saved yet.")).toBeTruthy();
    });
  });

  test("tapping a saved resource opens its URL without toggling selection", async () => {
    fetchResourcesByIdsMock.mockResolvedValueOnce([
      { id: "res-1", title: "Calm Breathing Guide", type: "article", org: "Mindful Org", url: "example.com" },
    ]);

    const utils = render(<ProfileScreen />);

    await waitFor(() => {
      expect(utils.getByText("Calm Breathing Guide")).toBeTruthy();
    });

    const resourceText = utils.getByText("Calm Breathing Guide");
    const resourceCard =
      (resourceText.parent as any)?.props?.onPress
        ? (resourceText.parent as any)
        : (resourceText.parent as any)?.parent ?? resourceText;
    const initialBg =
      Array.isArray(resourceCard?.props?.style) && resourceCard.props.style[1]
        ? resourceCard.props.style[1].backgroundColor
        : null;

    fireEvent.press(resourceCard);

    await waitFor(() =>
      expect(openUrlSpy).toHaveBeenCalledWith("https://example.com")
    );

    const updatedBg =
      Array.isArray(resourceCard?.props?.style) && resourceCard.props.style[1]
        ? resourceCard.props.style[1].backgroundColor
        : null;
    expect(updatedBg).toBe(initialBg);
  });
});
