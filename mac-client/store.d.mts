export type StoredNote = {
  index: number;
  id: string;
  text: string;
  createdAt: string;
  receivedAt: string;
};

export const dataDirectory: string;
export function readNotes(): Promise<StoredNote[]>;
export function storeNote(note: Omit<StoredNote, "index" | "receivedAt">): Promise<StoredNote>;
export function readLastFetchedIndex(): Promise<number>;
export function writeLastFetchedIndex(index: number): Promise<void>;
