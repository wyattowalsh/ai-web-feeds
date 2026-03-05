const DEVICE_ID_KEY = "aiwebfeeds_device_id";
const DEVICE_DATA_KEY = "aiwebfeeds_device_data";

type DeviceDataExport = {
  version: number;
  deviceId: string;
  exportedAt: string;
};

let memoryDeviceId: string | null = null;
let memoryDeviceData: string | null = null;

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createDeviceId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Ignore crypto failures and use fallback ID.
  }

  return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getDeviceId(): string {
  const storage = getStorage();

  if (storage) {
    try {
      const existingId = storage.getItem(DEVICE_ID_KEY);
      if (existingId) {
        return existingId;
      }

      const nextId = createDeviceId();
      storage.setItem(DEVICE_ID_KEY, nextId);
      return nextId;
    } catch {
      // Fall through to in-memory fallback.
    }
  }

  if (!memoryDeviceId) {
    memoryDeviceId = createDeviceId();
  }

  return memoryDeviceId;
}

export function exportDeviceData(): string {
  const payload: DeviceDataExport = {
    version: 1,
    deviceId: getDeviceId(),
    exportedAt: new Date().toISOString(),
  };
  const serialized = JSON.stringify(payload);

  memoryDeviceData = serialized;

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(DEVICE_DATA_KEY, serialized);
    } catch {
      // Ignore persistence errors.
    }
  }

  return serialized;
}

function parseDeviceData(data: string): DeviceDataExport | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    if (typeof record.deviceId !== "string" || record.deviceId.length === 0) {
      return null;
    }

    return {
      version: typeof record.version === "number" ? record.version : 1,
      deviceId: record.deviceId,
      exportedAt:
        typeof record.exportedAt === "string"
          ? record.exportedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function importDeviceData(data: string | null | undefined): boolean {
  if (!data) {
    if (!memoryDeviceData) {
      return false;
    }
    data = memoryDeviceData;
  }

  const parsed = parseDeviceData(data);
  if (!parsed) {
    return false;
  }

  const serialized = JSON.stringify(parsed);
  memoryDeviceId = parsed.deviceId;
  memoryDeviceData = serialized;

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(DEVICE_ID_KEY, parsed.deviceId);
      storage.setItem(DEVICE_DATA_KEY, serialized);
    } catch {
      // Ignore persistence errors.
    }
  }

  return true;
}
