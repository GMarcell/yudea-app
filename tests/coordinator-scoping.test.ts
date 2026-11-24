// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockRequireViewAccess = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server-auth", () => ({
  requireViewAccess: mockRequireViewAccess,
  requireEditAccess: vi.fn(),
}));

const mockMemberFindFirst = vi.hoisted(() => vi.fn());
const mockMemberCount = vi.hoisted(() => vi.fn());
const mockFamilyFindFirst = vi.hoisted(() => vi.fn());
const mockFamilyCount = vi.hoisted(() => vi.fn());
const mockRegionFindUnique = vi.hoisted(() => vi.fn());
const mockRegionCount = vi.hoisted(() => vi.fn());
const mockBranchCount = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    member: { findFirst: mockMemberFindFirst, count: mockMemberCount },
    family: { findFirst: mockFamilyFindFirst, count: mockFamilyCount },
    region: { findUnique: mockRegionFindUnique, count: mockRegionCount },
    branch: { count: mockBranchCount },
  },
}));

import { GET as getMember } from "@/app/api/member/[id]/route";
import { GET as getFamily } from "@/app/api/family/[id]/route";
import { GET as getFamilyCount } from "@/app/api/family/count/route";
import { GET as getDashboardCounts } from "@/app/api/dashboard/counts/route";
import { GET as getRegion } from "@/app/api/region/[id]/route";

const request = (path: string) => new NextRequest(`http://localhost${path}`);

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireViewAccess.mockResolvedValue({
    user: { id: "user-1", role: "COORDINATOR", regionId: "region-1" },
    error: null,
  });
});

describe("coordinator single-record scoping", () => {
  it("scopes member reads to the coordinator's region", async () => {
    mockMemberFindFirst.mockResolvedValue(null);

    const response = await getMember(request("/api/member/member-2"), params("member-2"));

    expect(response.status).toBe(404);
    expect(mockMemberFindFirst).toHaveBeenCalledWith({
      where: { id: "member-2", family: { regionId: "region-1" } },
      include: { family: true },
    });
  });

  it("scopes family reads to the coordinator's region", async () => {
    mockFamilyFindFirst.mockResolvedValue(null);

    const response = await getFamily(request("/api/family/family-2"), params("family-2"));

    expect(response.status).toBe(404);
    expect(mockFamilyFindFirst).toHaveBeenCalledWith({
      where: { id: "family-2", regionId: "region-1" },
      include: { region: true, members: true },
    });
  });

  it("scopes the family count to the coordinator's region", async () => {
    mockFamilyCount.mockResolvedValue(7);

    const response = await getFamilyCount();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ all: 7 });
    expect(mockFamilyCount).toHaveBeenCalledWith({
      where: { regionId: "region-1" },
    });
  });

  it("scopes the dashboard branch count to the coordinator's region", async () => {
    mockMemberCount.mockResolvedValue(0);
    mockFamilyCount.mockResolvedValue(0);
    mockRegionCount.mockResolvedValue(0);
    mockBranchCount.mockResolvedValue(1);

    const response = await getDashboardCounts();

    expect(response.status).toBe(200);
    expect(mockBranchCount).toHaveBeenCalledWith({
      where: { regions: { some: { id: "region-1" } } },
    });
  });

  it("returns 404 without querying another region", async () => {
    const response = await getRegion(request("/api/region/region-2"), params("region-2"));

    expect(response.status).toBe(404);
    expect(mockRegionFindUnique).not.toHaveBeenCalled();
  });

  it("allows a coordinator to read their own region", async () => {
    mockRegionFindUnique.mockResolvedValue({
      id: "region-1",
      name: "Region A",
      branch: {},
      families: [],
      coordinator: null,
    });

    const response = await getRegion(request("/api/region/region-1"), params("region-1"));

    expect(response.status).toBe(200);
    expect(mockRegionFindUnique).toHaveBeenCalledTimes(1);
  });

  it("does not add a region filter for staff", async () => {
    mockRequireViewAccess.mockResolvedValue({
      user: { id: "user-2", role: "STAFF" },
      error: null,
    });
    mockMemberFindFirst.mockResolvedValue(null);

    await getMember(request("/api/member/member-2"), params("member-2"));

    expect(mockMemberFindFirst).toHaveBeenCalledWith({
      where: { id: "member-2" },
      include: { family: true },
    });
  });
});
