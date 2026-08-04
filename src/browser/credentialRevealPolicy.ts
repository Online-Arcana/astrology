const issuer = document.querySelector<HTMLInputElement>("#signingIssuer");
const privateKey = document.querySelector<HTMLInputElement>("#signingPrivatePkcs8");
const publicKey = document.querySelector<HTMLInputElement>("#signingPublicRaw");
const toggle = document.querySelector<HTMLButtonElement>("#showSigningKeyFields");

const synchronise = (): void => {
  if (issuer === null || privateKey === null || publicKey === null) return;
  const visible = privateKey.type === "text";
  const readOnly = !visible;
  for (const field of [issuer, privateKey, publicKey]) {
    field.type = visible ? "text" : "password";
    field.readOnly = readOnly;
    field.setAttribute("aria-readonly", String(readOnly));
  }
};

synchronise();
toggle?.addEventListener("click", synchronise);
