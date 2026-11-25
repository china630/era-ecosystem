/** JSON denial/result that is not a Next Response. */
export class ClinicJson {
  constructor(
    readonly status: number,
    private readonly payload: unknown,
  ) {}

  async json(): Promise<unknown> {
    return this.payload;
  }

  get body(): unknown {
    return this.payload;
  }
}
