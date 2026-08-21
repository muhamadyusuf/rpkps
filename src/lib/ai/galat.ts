/** Galat yang aman ditampilkan ke pengguna: tidak pernah memuat kunci API. */
export class GalatAi extends Error {
  constructor(pesan: string) {
    super(pesan);
    this.name = "GalatAi";
  }
}
