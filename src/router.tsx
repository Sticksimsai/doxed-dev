import { createHashHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppShell } from "./components/layout";
import { DiscoverPage } from "./pages/discover";
import { TokenPage } from "./pages/token";
import { DevPage } from "./pages/dev";
import { LaunchPage } from "./pages/launch";
import { HowItWorksPage } from "./pages/how-it-works";
import { AdminPage } from "./pages/admin";

const root = createRootRoute({ component: AppShell });

const routeTree = root.addChildren([
  createRoute({ getParentRoute: () => root, path: "/", component: DiscoverPage }),
  createRoute({ getParentRoute: () => root, path: "/token/$mint", component: TokenPage }),
  createRoute({ getParentRoute: () => root, path: "/dev/$id", component: DevPage }),
  createRoute({ getParentRoute: () => root, path: "/launch", component: LaunchPage }),
  createRoute({ getParentRoute: () => root, path: "/how-it-works", component: HowItWorksPage }),
  createRoute({ getParentRoute: () => root, path: "/admin", component: AdminPage }),
]);

export const router = createRouter({
  routeTree,
  // Single-file preview builds use hash URLs so they work from any host.
  history: import.meta.env.MODE === "preview" ? createHashHistory() : undefined,
  scrollRestoration: true,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
