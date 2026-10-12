export interface GenerateOptions {
  model?: string;
  system?: string;
  prompt: string;
  format?: 'json';
  temperature?: number;
  seed?: number;
  timeoutMs?: number;
}

export interface AIProvider {
  generate(options: GenerateOptions): Promise<string>;
  embed(text: string): Promise<number[] | null>;
}
