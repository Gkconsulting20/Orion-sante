// Keep Workers' global DOM declarations out of the Node Express project.
declare module "cloudflare:node" {
  export function handleAsNodeRequest(port: number, request: Request): Promise<Response>;
}
