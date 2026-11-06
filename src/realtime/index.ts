import { useSyncExternalStore } from "react";
import { realtimeUrl } from "@/config/runtimeEnv";
import { getToken } from "@/lib/session";
import { RealtimeClient, type RealtimeState } from "./client";

export const realtime = new RealtimeClient({ url: realtimeUrl, token: getToken });

export const useRealtimeState = (): RealtimeState =>
  useSyncExternalStore(
    (listener) => realtime.onState(() => listener()),
    () => realtime.getState()
  );
