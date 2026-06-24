/**
 * Worker messaging bridge — BroadcastChannel + structured postMessage helpers.
 */

export type WorkerMessage<TType extends string, TPayload = unknown> = {
  type: TType;
  payload?: TPayload;
  requestId?: string;
};

export type MessageHandler<T extends WorkerMessage<string>> = (message: T) => void;

export function createWorkerChannel(name: string): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(name);
}

export function postWorkerMessage<T extends WorkerMessage<string>>(
  target: Worker | MessagePort | BroadcastChannel,
  message: T,
): void {
  target.postMessage(message);
}

export function listenWorkerMessages<T extends WorkerMessage<string>>(
  source: Worker | MessagePort | BroadcastChannel,
  handler: MessageHandler<T>,
): () => void {
  const listener = (event: MessageEvent<T>) => {
    handler(event.data);
  };
  source.addEventListener("message", listener as EventListener);
  return () => source.removeEventListener("message", listener as EventListener);
}
