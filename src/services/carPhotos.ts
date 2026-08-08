import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Fotos del carro para la tarjeta del garaje.
 *
 * Con una sola foto la tarjeta muestra una imagen fija; con varias, tomadas
 * caminando alrededor del carro, se convierte en un giro de 360°. Es como
 * funcionan los visores de las marcas: no es un modelo 3D, es una secuencia de
 * fotos que se cambia al arrastrar.
 */

const DIR_NAME = 'car-photos';
const INDEX_KEY = 'velocidad.carPhotos.v2';

/** Ancho al que se reescalan: de sobra en pantalla y evita llenar el teléfono. */
const TARGET_WIDTH = 1100;
const JPEG_QUALITY = 0.82;

export const MIN_FRAMES_FOR_SPIN = 4;
export const RECOMMENDED_FRAMES = 16;

export type CarPhotos = {
  /** URIs listas para pintar, en orden de giro. */
  frames: string[];
  updatedAt: number | null;
};

export const NO_PHOTOS: CarPhotos = { frames: [], updatedAt: null };

function photosDirectory(): Directory {
  return new Directory(Paths.document, DIR_NAME);
}

/**
 * En el índice se guardan solo los nombres, no las rutas completas: iOS cambia
 * el identificador del contenedor de la app al actualizarla, y las rutas
 * absolutas guardadas dejarían de existir.
 */
type StoredIndex = { names: string[]; updatedAt: number };

export async function loadCarPhotos(): Promise<CarPhotos> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    if (!raw) return NO_PHOTOS;
    const index = JSON.parse(raw) as StoredIndex;
    const dir = photosDirectory();
    if (!dir.exists) return NO_PHOTOS;

    const frames = index.names
      .map((name) => new File(dir, name))
      .filter((file) => file.exists)
      .map((file) => file.uri);

    return frames.length ? { frames, updatedAt: index.updatedAt } : NO_PHOTOS;
  } catch {
    return NO_PHOTOS;
  }
}

export type SaveProgress = (done: number, total: number) => void;

/**
 * Procesa y guarda las fotos elegidas, en el orden recibido.
 * Reemplaza por completo el conjunto anterior.
 */
export async function saveCarPhotos(
  sourceUris: string[],
  onProgress?: SaveProgress
): Promise<CarPhotos> {
  const dir = photosDirectory();
  if (dir.exists) dir.delete();
  dir.create({ intermediates: true, idempotent: true });

  const names: string[] = [];

  for (let i = 0; i < sourceUris.length; i++) {
    const resized = await ImageManipulator.manipulateAsync(
      sourceUris[i],
      [{ resize: { width: TARGET_WIDTH } }],
      { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
    );

    const name = `frame-${String(i).padStart(2, '0')}.jpg`;
    new File(resized.uri).copy(new File(dir, name));
    names.push(name);
    onProgress?.(i + 1, sourceUris.length);
  }

  const updatedAt = Date.now();
  const index: StoredIndex = { names, updatedAt };
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));

  return { frames: names.map((n) => new File(dir, n).uri), updatedAt };
}

export async function clearCarPhotos(): Promise<void> {
  try {
    const dir = photosDirectory();
    if (dir.exists) dir.delete();
  } catch {
    // Si el borrado falla, al menos que el índice quede vacío.
  }
  await AsyncStorage.removeItem(INDEX_KEY);
}

/** Tamaño ocupado en disco, en bytes. */
export function photosDiskSize(): number {
  try {
    const dir = photosDirectory();
    return dir.exists ? (dir.size ?? 0) : 0;
  } catch {
    return 0;
  }
}
