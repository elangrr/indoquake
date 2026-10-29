/** Canvas layers need a concrete colour, so resolve a design token (light-dark()) on a probe element. */
export function tokenColor(host: HTMLElement, token: string): string {
  const probe = document.createElement("span");
  probe.style.color = "var(" + token + ")";
  host.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}
