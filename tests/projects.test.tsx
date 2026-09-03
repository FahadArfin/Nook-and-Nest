// @vitest-environment jsdom
import "fake-indexeddb/auto";
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProjectLibrary } from "../src/ProjectLibrary";
import { createSamplePlan } from "../src/domain";
import { savePlan, listLocalPlans, usePlanner, getCloudRevision } from "../src/store";

beforeEach(() => {
  usePlanner.getState().replacePlan(createSamplePlan("Test nest"));
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

it("keeps multiple local projects instead of replacing a single active slot", async () => {
  const a = createSamplePlan("Local A"), b = createSamplePlan("Local B"); await savePlan(a); await savePlan(b);
  const plans = await listLocalPlans(); expect(plans.find(p => p.id === a.id)).toEqual(a); expect(plans.find(p => p.id === b.id)).toEqual(b);
});
it("offers a top-level sign-in link only after the current build has a local backup", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => response({ signedIn: false, available: true })));
  render(<ProjectLibrary onClose={() => {}}/>);
  const link = await screen.findByRole("link", { name: /Sign in with ChatGPT/ });
  await waitFor(() => expect(link.getAttribute("href")).toBe("/signin-with-chatgpt?return_to=%2F%3Fprojects%3D1"));
  expect(link.getAttribute("target")).toBe("_top");
});
it("saves an immutable snapshot and uses the returned revision on the next save", async () => {
  const posted: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    if (url === "/api/session") return response({ signedIn: true, available: true, userId: "user-test", email: "me@example.test" });
    if (init?.method === "POST") { posted.push(JSON.parse(init.body as string)); return response({ revision: posted.length, savedAt: new Date().toISOString() }); }
    return response({ projects: [] });
  }));
  render(<ProjectLibrary onClose={() => {}}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Save online" }));
  await screen.findByText(/Saved online · version 1/);
  expect(posted[0].expectedRevision).toBe(0); expect(posted[0].plan.name).toBe("Test nest");
  expect(await getCloudRevision("user-test", posted[0].plan.id)).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Save online" }));
  await screen.findByText(/Saved online · version 2/); expect(posted[1].expectedRevision).toBe(1);
});
it("does not replace the working plan or revision when a stale save fails", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    if (url === "/api/session") return response({ signedIn: true, available: true, userId: "stale-user" });
    if (init?.method === "POST") return response({ error: "A newer version was saved elsewhere." }, 409);
    return response({ projects: [] });
  }));
  const before = usePlanner.getState().plan; render(<ProjectLibrary onClose={() => {}}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Save online" }));
  expect((await screen.findByRole("alert")).textContent).toContain("newer version");
  expect(usePlanner.getState().plan).toEqual(before); expect(await getCloudRevision("stale-user", before.id)).toBe(0);
});
it("starts an empty named project without discarding the previous local build", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => response({ signedIn: false, available: false })));
  const before = usePlanner.getState().plan, close = vi.fn(); render(<ProjectLibrary onClose={close}/>);
  fireEvent.change(screen.getByLabelText("New project name"), { target: { value: "My studio" } });
  fireEvent.click(screen.getByRole("button", { name: /New empty project/ }));
  await waitFor(() => expect(close).toHaveBeenCalled());
  const current = usePlanner.getState().plan; expect(current.name).toBe("My studio"); expect(current.floors).toHaveLength(1); expect(current.floors[0].cells).toEqual([]);
  expect((await listLocalPlans()).some(p => p.id === before.id)).toBe(true);
});
it("opens older online versions as a separate project without replacing the original", async () => {
  const original = createSamplePlan("Online home");
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/session") return response({ signedIn: true, available: true, userId: "history-user" });
    if (url === "/api/projects") return response({ projects: [{ id: original.id, name: original.name, revision: 3, savedAt: original.updatedAt }] });
    if (url.endsWith("/versions")) return response({ versions: [{ revision: 1, name: original.name, savedAt: original.updatedAt }] });
    return response({ plan: original, revision: 1 });
  }));
  const before = usePlanner.getState().plan, close = vi.fn(); render(<ProjectLibrary onClose={close}/>);
  const onlineTab=await screen.findByRole("button",{name:"Private online saves · 1"}); fireEvent.click(onlineTab);
  fireEvent.click(screen.getByRole("button",{name:"Versions"})); fireEvent.click(await screen.findByRole("button",{name:"Open copy"}));
  await waitFor(()=>expect(close).toHaveBeenCalled());
  const loaded=usePlanner.getState().plan; expect(loaded.id).not.toBe(original.id); expect(loaded.floors).toEqual(original.floors);
  expect((await listLocalPlans()).some(p=>p.id===before.id)).toBe(true);
  expect(await getCloudRevision("history-user",loaded.id)).toBe(0);
});
