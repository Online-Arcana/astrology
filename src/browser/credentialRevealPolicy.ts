const issuer = document.querySelector<HTMLInputElement>("#signingIssuer");
const privateKey = document.querySelector<HTMLInputElement>("#signingPrivatePkcs8");
const toggle = document.querySelector<HTMLButtonElement>("#showSigningKeyFields");

const synchronise = (): void => {
  if (issuer === null || privateKey === null) return;
  issuer.readOnly = privateKey.readOnly;
  issuer.setAttribute("aria-readonly", String(issuer.readOnly));
};

synchronise();
toggle?.addEventListener("click", synchronise);
