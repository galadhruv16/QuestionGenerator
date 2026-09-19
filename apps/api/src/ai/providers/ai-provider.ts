export interface AIProvider {
  generate(request: unknown): Promise<unknown>;
  embed(text: string): Promise<number[]>;
}
