// Everything that talks to the Python backend (backend/app.py).
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type ModelInfo = {
  id: string;
  name: string;
  detail: string;
  architecture: 'unet' | 'deeplab';
  experiment: string;
  best_epoch: number;
  val_miou: number | null;
  test_miou: number | null;
  test_pixel_acc: number | null;
  test_iou: (number | null)[] | null;
  test_dice: (number | null)[] | null;
  input_size: number[];
};

export type Sample = { name: string; url: string; has_label: boolean };

export type ClassStat = { id: number; name: string; color: string; pixels: number; percent: number };

export type PredictResult = {
  model: ModelInfo;
  inference_ms: number;
  width: number;
  height: number;
  classes: ClassStat[];
  oil_percent: number;
  oil_detected: boolean;
  oil_confidence: number | null;
  mean_confidence: number;
  image: string; // data URIs
  mask: string;
  overlay: string;
  ground_truth: null | { mask: string; iou: (number | null)[]; miou: number; pixel_acc: number };
};

// What the user wants to analyse: an uploaded photo or one of the server's test samples.
export type ImageSource =
  | { kind: 'upload'; uri: string; base64: string }
  | { kind: 'sample'; uri: string; name: string };

const STORAGE_KEY = 'serverUrl';

// Best guess for the server address, so it usually works without typing anything.
export function defaultServerUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `http://${window.location.hostname}:8000`;
  }
  // In Expo Go, hostUri is the computer running "npx expo start" (e.g. 192.168.1.5:8081).
  // The backend normally runs on the same computer, on port 8000.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:8000` : 'http://192.168.1.100:8000';
}

export async function loadServerUrl(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) || defaultServerUrl();
  } catch {
    return defaultServerUrl();
  }
}

export async function saveServerUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, url);
}

// fetch + JSON with a timeout and readable error messages
async function request<T>(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.detail ? String(body.detail) : `Server error ${response.status}`);
    }
    return body as T;
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('The server did not answer in time.');
    if (error instanceof TypeError) throw new Error('Cannot reach the server. Check the URL and Wi-Fi.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const clean = (base: string) => base.replace(/\/+$/, '');

export const api = {
  health: (base: string) =>
    request<{ status: string; device: string; models: string[] }>(`${clean(base)}/health`, {}, 5000),

  models: (base: string) => request<ModelInfo[]>(`${clean(base)}/models`),

  samples: (base: string) => request<Sample[]>(`${clean(base)}/samples`),

  sampleUrl: (base: string, sample: Sample) => `${clean(base)}${sample.url}`,

  predict: (base: string, model: string, source: ImageSource) =>
    request<PredictResult>(
      `${clean(base)}/predict`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          source.kind === 'upload'
            ? { model, image_base64: source.base64 }
            : { model, sample: source.name },
        ),
      },
      90000, // the first prediction on a CPU can take a few seconds
    ),
};

// "0.734" -> "73.4%"
export function pct(value: number | null | undefined, digits = 1): string {
  return value == null ? '–' : `${(value * 100).toFixed(digits)}%`;
}
