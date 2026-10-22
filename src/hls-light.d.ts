// hls.js tidak menyertakan deklarasi untuk build "light"; API-nya sama dengan paket utama.
declare module "hls.js/light" {
  export * from "hls.js";
  export { default } from "hls.js";
}
