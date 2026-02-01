export type RouteHandler = (params: Record<string, string>) => void | Promise<void>;

interface Route {
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

const routes: Route[] = [];

export function addRoute(path: string, handler: RouteHandler): void {
  const paramNames: string[] = [];
  const pattern = path.replace(/:(\w+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  routes.push({ pattern: new RegExp(`^${pattern}$`), paramNames, handler });
}

export function navigate(path: string): void {
  location.hash = path;
}

export function startRouter(): void {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute(): void {
  const hash = location.hash.replace(/^#/, '') || '/library';

  for (const route of routes) {
    const match = hash.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      route.handler(params);
      return;
    }
  }

  // Default to library
  navigate('/library');
}
