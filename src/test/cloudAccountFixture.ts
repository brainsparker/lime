import { afterEach, beforeEach, vi } from "vitest";
import type { OemCloudCurrentSession } from "@/lib/api/oemCloudControlPlaneTypes";
import { readCloudAccount, updateCloudSessionView } from "@/lib/cloudAccount";
import type {
  AppServerAccount,
  AppServerCloudRequestParams,
} from "@/lib/api/appServerTypes";

const fixture = vi.hoisted(() => ({
  account: null as AppServerAccount | null,
  sessions: new Map<string, OemCloudCurrentSession>(),
  login: vi.fn(),
  logout: vi.fn(),
  read: vi.fn(),
  request: vi.fn(),
}));

vi.mock("@/lib/api/account", () => ({
  loginAccount: fixture.login,
  logoutAccount: fixture.logout,
  readAccount: fixture.read,
}));
vi.mock("@/lib/api/cloud", () => ({ requestCloud: fixture.request }));

export const accountFixture = fixture;
export const cloudRequestMock = fixture.request;

type SessionInput = {
  token?: string;
  tenant: Pick<OemCloudCurrentSession["tenant"], "id"> &
    Partial<OemCloudCurrentSession["tenant"]>;
  user: Pick<OemCloudCurrentSession["user"], "id"> &
    Partial<OemCloudCurrentSession["user"]>;
  session: Pick<OemCloudCurrentSession["session"], "id"> &
    Partial<OemCloudCurrentSession["session"]>;
};

export async function seedCloudAccount(
  input: SessionInput,
  baseUrl = "https://user.limeai.run",
) {
  const session: OemCloudCurrentSession = {
    ...input,
    tenant: { name: input.tenant.id, slug: input.tenant.id, ...input.tenant },
    user: {
      email: "",
      displayName: input.user.id,
      roles: [],
      passwordConfigured: false,
      ...input.user,
    },
    session: {
      tenantId: input.tenant.id,
      userId: input.user.id,
      provider: "password",
      roles: [],
      issuedAt: "",
      expiresAt: "",
      ...input.session,
    },
  };
  if (input.token) fixture.sessions.set(input.token, session);
  fixture.account = {
    type: "cloud",
    baseUrl,
    tenantId: session.tenant.id,
    userId: session.user.id,
    sessionId: session.session.id,
    email: session.user.email,
    displayName: session.user.displayName,
    expiresAt: null,
  };
  await readCloudAccount();
  updateCloudSessionView(session);
  return session;
}

/** Supplies a response at the typed RPC gateway, without emulating a renderer HTTP request. */
export function stubCloudRequest(response: (...args: never[]) => unknown) {
  fixture.request.mockImplementation(
    async (_params: AppServerCloudRequestParams) => {
      const result = (await response()) as {
        status?: number;
        ok?: boolean;
        json: () => Promise<unknown>;
      };
      return {
        status: result.status ?? (result.ok === false ? 500 : 200),
        body: await result.json(),
        account: fixture.account,
      };
    },
  );
}

beforeEach(async () => {
  fixture.account = null;
  fixture.sessions.clear();
  fixture.read.mockImplementation(async () => ({
    account: fixture.account,
    requiresOpenaiAuth: false,
  }));
  fixture.login.mockImplementation(
    async (params: {
      baseUrl: string;
      tenantId: string;
      accessToken: string;
    }) => {
      const session = fixture.sessions.get(params.accessToken);
      fixture.account = {
        type: "cloud",
        baseUrl: params.baseUrl,
        tenantId: params.tenantId,
        userId: session?.user.id ?? "user-001",
        sessionId: session?.session.id ?? "session-001",
        email: session?.user.email ?? null,
        displayName: session?.user.displayName ?? null,
        expiresAt: null,
      };
      return { type: "cloudAuthTokens" };
    },
  );
  fixture.logout.mockImplementation(async () => {
    fixture.account = null;
    return {};
  });
  fixture.request.mockReset();
  await readCloudAccount();
});

afterEach(async () => {
  fixture.account = null;
  fixture.read.mockImplementation(async () => ({
    account: null,
    requiresOpenaiAuth: false,
  }));
  await readCloudAccount();
});
