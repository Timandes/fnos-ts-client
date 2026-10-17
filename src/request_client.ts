/** Minimal request contract shared by WebSocket and OAuth transports. */
export interface FnosRequestClient {
  requestPayloadWithResponse(req: string, payload: any, timeout?: number): Promise<any>;
}
